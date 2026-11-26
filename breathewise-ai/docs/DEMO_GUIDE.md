# Evaluator Demo Mode Guide

Demo Mode (`DEMO_MODE=true`) allows evaluators to test full application logic without paid subscriptions:

1. Click **Sign In** or **Explore Demo Mode** on the landing page.
2. Select any of the 5 seeded evaluator roles (`Family Admin`, `Individual User`, `Family Member`, `Community Moderator`, or `System Admin`).
3. On the Dashboard, use the **Scenario** selector in the toolbar to test:
   - **Live API** (Open-Meteo live data + 15-min cache)
   - **Demo: Severe Winter Smog** (high PM2.5 + temperature inversion + exposure-safe indoor routines)
   - **Demo: Moderate Pollution**
   - **Demo: Improved Air Quality**
   - **Demo: Simulated API Outage** (exercises stale-cache fallback)
   - **Demo: Simulated AI Outage** (exercises deterministic recommendation engine)
