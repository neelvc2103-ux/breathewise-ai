"""Reproducible Playwright browser functional, visual regression, Hindi i18n, and axe-core accessibility suite.

Usage:
  python scripts/qa-browser.py
  QA_BASELINE_DIR=/path/to/baseline/breathewise-ai python scripts/qa-browser.py
"""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

CHROME = os.environ.get("CHROME_BIN", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
APP_DIR = Path(__file__).resolve().parent.parent
BASELINE_DIR = Path(os.environ["QA_BASELINE_DIR"]) if os.environ.get("QA_BASELINE_DIR") else None
OUT_DIR = APP_DIR / "qa_artifacts"
SCREENSHOT_DIR = OUT_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"

VIEWPORTS = [
    ("desktop", 1920, 1080),
    ("laptop", 1366, 768),
    ("tablet", 768, 1024),
    ("mobile", 390, 844),
]

def wait_for_health(port: int, timeout_s: float = 20.0) -> float:
    t0 = time.perf_counter()
    url = f"http://127.0.0.1:{port}/api/v1/health"
    while time.perf_counter() - t0 < timeout_s:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return time.perf_counter() - t0
        except Exception:
            time.sleep(0.25)
    raise RuntimeError(f"Server on port {port} did not become healthy within {timeout_s}s")

def start_server(cwd: Path, port: int, db_path: Path):
    if db_path.exists():
        try:
            db_path.unlink()
        except OSError:
            pass
    env = os.environ.copy()
    env["NODE_ENV"] = "production"
    env["PORT"] = str(port)
    env["DEMO_MODE"] = "true"
    env["SQLITE_PATH"] = str(db_path)
    env["AUTH_SECRET"] = "qa-verification-secret-32-chars-long"
    env["GEMINI_API_KEY"] = ""
    tsx_bin = cwd / "node_modules" / ".bin" / ("tsx.cmd" if os.name == "nt" else "tsx")
    return subprocess.Popen(
        [str(tsx_bin), "server.ts"],
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

def kill_proc_tree(proc):
    if proc and proc.poll() is None:
        if os.name == "nt":
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        else:
            proc.terminate()

def diff_images(img1_path: Path, img2_path: Path) -> float:
    with Image.open(img1_path) as im1, Image.open(img2_path) as im2:
        im1_rgb = im1.convert("RGB")
        im2_rgb = im2.convert("RGB")
        if im1_rgb.size != im2_rgb.size:
            return 100.0
        diff = ImageChops.difference(im1_rgb, im2_rgb)
        px = diff.getdata()
        changed = sum(1 for r, g, b in px if r > 2 or g > 2 or b > 2)
        total = im1_rgb.size[0] * im1_rgb.size[1]
        return round((changed / total) * 100.0, 4)

def capture_flow(page, base_url: str, tag: str, vp_name: str, w: int, h: int, run_axe: bool = False):
    page.set_viewport_size({"width": w, "height": h})
    shots = {}
    axe_results = {}

    def snap(name: str):
        p = SCREENSHOT_DIR / f"{tag}_{vp_name}_{name}.png"
        page.wait_for_timeout(250)
        page.screenshot(path=str(p), full_page=False)
        shots[name] = p
        if run_axe:
            try:
                res = page.evaluate("""async () => {
                    if (!window.axe) return { error: 'axe not loaded' };
                    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
                    return {
                        violations: r.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length, help: v.help })),
                        passes: r.passes.length
                    };
                }""")
                axe_results[name] = res
            except Exception as e:
                axe_results[name] = {"error": str(e)}

    page.goto(base_url, wait_until="networkidle")
    page.wait_for_timeout(1600)
    if run_axe:
        page.add_script_tag(url=AXE_CDN)
    snap("landing")

    sign_in_btn = page.get_by_role("button", name="Sign In").first
    if sign_in_btn.is_visible():
        sign_in_btn.click()
        page.wait_for_timeout(300)
        if run_axe:
            page.add_script_tag(url=AXE_CDN)
        snap("auth")

        demo_btn = page.get_by_role("button", name="Family Admin").first
        if demo_btn.is_visible():
            demo_btn.click()
            page.wait_for_timeout(900)
            if run_axe:
                page.add_script_tag(url=AXE_CDN)
            snap("dashboard")

            if vp_name in ("laptop", "mobile"):
                tabs = ["AI Assistant", "Routine Planner", "Indoor Air", "Impact & Swaps", "Family", "Community", "Learn", "Settings"]
                for tab_label in tabs:
                    if vp_name == "mobile":
                        close_btn = page.get_by_role("button", name="Close navigation")
                        if not close_btn.is_visible():
                            menu_btn = page.get_by_role("button", name="Open menu")
                            if menu_btn.is_visible():
                                menu_btn.click()
                                page.wait_for_timeout(200)
                        if tab_label == "AI Assistant":
                            snap("mobile_drawer")
                        nav_btn = page.locator("div.fixed nav").get_by_role("button", name=tab_label).first
                    else:
                        nav_btn = page.locator("aside nav").get_by_role("button", name=tab_label).first
                    if nav_btn.is_visible():
                        nav_btn.click()
                        page.wait_for_timeout(500)
                        snap(f"tab_{tab_label.lower().replace(' ', '_')}")

    return shots, axe_results

def run_functional_e2e(page, base_url: str):
    errors = []
    page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))
    page.on("console", lambda msg: errors.append(f"console.error: {msg.text}") if msg.type == "error" else None)

    results = {}
    page.set_viewport_size({"width": 1366, "height": 768})
    page.goto(base_url, wait_until="networkidle")
    page.wait_for_timeout(1600)
    results["landing_loaded"] = "BreatheWise AI" in page.content()

    page.get_by_role("button", name="Sign In").first.click()
    page.wait_for_timeout(250)
    page.get_by_role("button", name="System Admin").first.click()
    page.wait_for_timeout(900)
    results["demo_admin_login"] = "BreatheWise AI /" in page.inner_text("header")

    page.locator("aside nav").get_by_role("button", name="AI Assistant").first.click()
    page.wait_for_timeout(400)
    chat_input = page.locator("input[placeholder*='Ask'], textarea[placeholder*='Ask']").first
    chat_input.fill("Is it safe for a morning walk today?")
    page.get_by_role("button", name="Send").first.click()
    page.wait_for_timeout(1200)
    results["assistant_reply"] = "not medical advice" in page.content().lower() or "aqi" in page.content().lower()

    page.locator("aside nav").get_by_role("button", name="Routine Planner").first.click()
    page.wait_for_timeout(500)
    gen_btn = page.get_by_role("button", name="Generate Adaptive Routine").first
    if gen_btn.is_visible():
        gen_btn.click()
        page.wait_for_timeout(900)
    results["routine_loaded"] = "routine" in page.content().lower()

    page.locator("aside nav").get_by_role("button", name="Indoor Air").first.click()
    page.wait_for_timeout(500)
    results["indoor_loaded"] = "indoor" in page.content().lower()

    page.locator("aside nav").get_by_role("button", name="Impact & Swaps").first.click()
    page.wait_for_timeout(500)
    results["impact_loaded"] = "co2" in page.content().lower()

    page.locator("aside nav").get_by_role("button", name="Family").first.click()
    page.wait_for_timeout(400)
    results["family_loaded"] = "household" in page.content().lower()

    page.locator("aside nav").get_by_role("button", name="Community").first.click()
    page.wait_for_timeout(400)
    results["community_loaded"] = "community" in page.content().lower()

    page.locator("aside nav").get_by_role("button", name="Admin").first.click()
    page.wait_for_timeout(500)
    results["admin_loaded"] = "users" in page.content().lower()

    # Language switching via accessible <select> label "Language"
    page.locator("aside nav").get_by_role("button", name="Settings").first.click()
    page.wait_for_timeout(400)
    lang_select = page.get_by_label("Language")
    lang_select.select_option("hi")
    page.wait_for_timeout(300)
    results["lang_switched_hi"] = page.evaluate("document.documentElement.lang") == "hi"
    results["hindi_nav_rendered"] = "डैशबोर्ड" in page.locator("aside nav").inner_text()

    # Mobile language switch back to English + mobile drawer Escape & focus restoration
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(200)
    lang_select.select_option("en")
    page.wait_for_timeout(200)
    results["lang_switched_en_mobile"] = page.evaluate("document.documentElement.lang") == "en"

    menu_btn = page.get_by_role("button", name="Open menu")
    menu_btn.click()
    page.wait_for_timeout(250)
    drawer_open = page.locator("[role='dialog'][aria-modal='true']").is_visible()
    page.keyboard.press("Escape")
    page.wait_for_timeout(250)
    drawer_closed = not page.locator("[role='dialog'][aria-modal='true']").is_visible()
    focus_restored = page.evaluate("document.activeElement?.getAttribute('aria-label') === 'Open menu'")
    results["mobile_drawer_escape_and_focus"] = drawer_open and drawer_closed and focus_restored

    page.set_viewport_size({"width": 1366, "height": 768})
    page.wait_for_timeout(200)
    page.get_by_role("button", name="Sign Out").first.click()
    page.wait_for_timeout(500)
    results["logout_returned_landing"] = page.get_by_role("button", name="Sign In").first.is_visible()
    results["browser_errors"] = errors
    return results

def main():
    run_id = int(time.time())
    opt_db = OUT_DIR / f"optimized_{run_id}.db"
    p_opt = start_server(APP_DIR, 3106, opt_db)
    p_base = None
    try:
        opt_boot = wait_for_health(3106)
        base_boot = None
        if BASELINE_DIR and BASELINE_DIR.exists():
            base_db = OUT_DIR / f"baseline_{run_id}.db"
            p_base = start_server(BASELINE_DIR, 3107, base_db)
            base_boot = wait_for_health(3107)

        report = {
            "startup_seconds": {"baseline": round(base_boot, 3) if base_boot else None, "optimized": round(opt_boot, 3)},
            "visual_diff_pct": {},
            "axe_accessibility": {},
            "functional_e2e": {},
        }

        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME, headless=True)
            page_opt = browser.new_context().new_page()
            page_base = browser.new_context().new_page() if p_base else None

            for vp_name, w, h in VIEWPORTS:
                o_shots, o_axe = capture_flow(
                    page_opt, "http://127.0.0.1:3106", "opt", vp_name, w, h, run_axe=(vp_name in ("laptop", "mobile"))
                )
                if o_axe:
                    report["axe_accessibility"][vp_name] = o_axe
                if page_base:
                    b_shots, _ = capture_flow(page_base, "http://127.0.0.1:3107", "base", vp_name, w, h, run_axe=False)
                    report["visual_diff_pct"][vp_name] = {
                        k: diff_images(b_shots[k], o_shots[k]) for k in b_shots if k in o_shots
                    }

            page_e2e = browser.new_context().new_page()
            report["functional_e2e"] = run_functional_e2e(page_e2e, "http://127.0.0.1:3106")
            browser.close()

        out_file = OUT_DIR / "qa_browser_report.json"
        out_file.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
    finally:
        kill_proc_tree(p_opt)
        kill_proc_tree(p_base)

if __name__ == "__main__":
    main()
