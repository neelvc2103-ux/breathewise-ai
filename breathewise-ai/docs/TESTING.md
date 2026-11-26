# Testing Strategy & Results

Automated tests run via `npm test` (`vitest run`):

1. `tests/unit/aqi.test.ts` — Verifies US EPA and India NAQI sub-index breakpoints, non-mixing of scales, and accessible severity metadata.
2. `tests/unit/impactCalculator.test.ts` — Verifies deterministic `(Baseline − Alternative) × Quantity` math, fuel/km calculations, and SHA-256 duplicate activity rejection.
3. `tests/unit/aiSafety.test.ts` — Verifies prompt-injection delimiter stripping, forecast-driven window selection, and structured deterministic fallback output.
4. `tests/unit/notifications.test.ts` — Verifies overnight quiet hours timezone logic and duplicate alert suppression.
5. `tests/integration/api.test.ts` — Boots the real Express server with in-memory SQLite (`createApp(':memory:')`) and verifies registration, email verification, RBAC 401/403 enforcement, severe smog demo scenario, AI fallback, routine generation, and cross-account IDOR rejection (`404`).

All 5 test suites (14 test cases) run without requiring paid external API subscriptions.
