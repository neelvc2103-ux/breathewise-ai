# BreatheWise AI

**Tagline:** Breathe Better. Live Smarter. Together.

**Live Deployment:** https://breathewise-ai-qbgl.onrender.com

BreatheWise AI is a full-stack, GenAI-powered environmental health and sustainability assistant built for **Hack2skill PromptWars Challenge 6** to help individuals, families, and communities navigate severe winter smog and urban air pollution. It combines real-time environmental telemetry, deterministic AQI standards (US EPA and India National AQI), grounded Gemini AI recommendations, adaptive daily routine planning, indoor air quality checklists, and transparent emissions-impact calculations.

## Core Workflow

`Observe → Understand → Recommend → Act → Measure → Improve`

## Technology Stack

- **Frontend:** React 19, TypeScript (strict), Tailwind CSS v4, Recharts, Lucide Icons, Zod
- **Backend:** Express.js, TypeScript (`tsx`), Helmet security headers, `trust proxy = 1`, structured JSON logging with circular-safe credential redaction
- **Database:** Embedded SQLite (`node:sqlite`, `./data/breathewise.db`) for zero-config execution + PostgreSQL Prisma schema (`prisma/schema.prisma`)
- **AI Engine:** `@google/genai` (`gemini-4-hydrogen`) strictly server-side with structured JSON schemas, prompt-injection neutralization, Google Maps Grounding, and a deterministic rule-based fallback engine
- **Environmental Data:** Open-Meteo Air Quality, Weather, and Geocoding APIs (Copernicus CAMS) with 15-minute SQLite TTL caching, in-flight request deduplication, `Retry-After` 429 cooldowns, weather-failure isolation, stale-cache fallback, and optional free secondary fallback via OpenWeatherMap Air Pollution API (`OPENWEATHER_API_KEY`)
- **Verification:** Vitest (`node` backend unit & integration suites + V8 coverage), `tsc --noEmit` strict check, `oxlint`, Playwright E2E + `axe-core` WCAG 2.2 AA audits

## Quick Start & Demo Access

```bash
npm ci --include=dev
cp .env.example .env
npm run dev
```

Visit `http://localhost:3000`. Click **Sign In** and choose any **Demo Mode** role (`Family Admin`, `Individual User`, `Family Member`, `Community Moderator`, `System Admin`) when `DEMO_MODE=true`, or create a new account.

## Environment Variables (see `.env.example`)

- `GEMINI_API_KEY` — Optional in dev (uses deterministic fallback when unset); required in production for live Gemini `gemini-4-hydrogen` replies
- `AUTH_SECRET` — Session signing secret (`32+` chars recommended in production; auto-generated in `render.yaml`)
- `OPENWEATHER_API_KEY` — Optional free OpenWeatherMap API key for key-authenticated Air Pollution fallback if Open-Meteo rate-limits (`HTTP 429`) shared cloud IPs (native 1–5 AQI is ignored; India NAQI / US EPA AQI is computed deterministically from `µg/m³` pollutants)
- `VITE_GOOGLE_MAPS_API_KEY` — Optional browser Google Maps Platform key
- `DEMO_MODE` — `true` enables evaluator Demo Mode accounts and scenarios (`severe_smog`, `moderate_pollution`, `improved_air`, `api_failure`, `ai_failure`)
- `SQLITE_PATH` — Defaults to `./data/breathewise.db`

## Scripts

- `npm run dev` — Starts full-stack Express + Vite server on port `3000`
- `npm run typecheck` — Runs strict TypeScript check (`tsc --noEmit`)
- `npm run lint` — Runs `oxlint` static analysis (`0` errors, `0` warnings)
- `npm test` — Runs all `15` Vitest unit and integration test files (`48` tests)
- `npx vitest run --coverage` — Measures V8 coverage across `src/server/**/*.ts` & `src/validators/**/*.ts` (`86.85%` stmts, `70.80%` branches, `90.50%` funcs, `87.48%` lines)
- `npm run build` — Builds production client bundle into `dist/`
- `npm start` — Starts production server (`tsx server.ts`)
- `npm audit --audit-level=high` — Checks dependency vulnerabilities (`0` high/critical)
- `python scripts/qa-browser.py` — Runs Playwright functional E2E (`14/14` checks), Hindi i18n verification, and `axe-core` WCAG 2.2 AA audits (`0` violations across Desktop & Mobile)

## Known Deployment Limitations

- **Ephemeral SQLite on Render Free Tier:** On Render's free plan without a Persistent Disk mounted to `breathewise-ai/data`, restarting or redeploying resets `./data/breathewise.db` and re-seeds demo/reference data.
- **Node.js `22.14.0`:** Configured in `render.yaml` and `.github/workflows/ci.yml`; local verification was performed on Node `v24.12.0`.

## Documentation Index

- [Architecture & Data Flow](docs/ARCHITECTURE.md)
- [Database Schema & ER Diagram](docs/DATABASE.md)
- [REST API Reference](docs/API.md)
- [AI Integration & Prompt Engineering](docs/AI_INTEGRATION.md)
- [Environmental Impact Calculations](docs/ENVIRONMENTAL_CALCULATIONS.md)
- [Testing & QA Strategy](docs/TESTING.md)
- [Threat Model & Security](docs/THREAT_MODEL.md)
- [Demo Mode Guide](docs/DEMO_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
