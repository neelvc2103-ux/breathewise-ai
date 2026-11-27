# Testing & Quality Assurance Strategy

BreatheWise AI uses **Vitest** with V8 coverage, **TypeScript strict mode**, **oxlint** static analysis, and **Playwright + axe-core** browser verification.

## Commands (run inside `breathewise-ai/`)

- `npm run typecheck` — Strict TypeScript check (`tsc --noEmit` with `strict`, `noUnusedLocals`, `noUnusedParameters`)
- `npm run lint` — Static analysis via `oxlint` (TypeScript, React, JSX-a11y, OXC correctness & suspicious rules)
- `npm test` — Run all Vitest unit and integration test suites
- `npx vitest run --coverage` — Run tests with V8 statement, branch, function, and line coverage
- `npm run build` — Production Vite client build
- `npm audit --audit-level=high` — Dependency vulnerability scan
- `python scripts/qa-browser.py` — Browser functional E2E, Hindi i18n, and `axe-core` WCAG 2.2 AA audit (set `QA_BASELINE_DIR` to compare screenshots against a baseline worktree)

## Test Suites

1. **Unit Tests (`tests/unit/`):**
   - `aqi.test.ts` — US EPA & India NAQI breakpoint math
   - `aiSafety.test.ts` — Prompt injection neutralization, forecast window selection, deterministic fallback, Maps grounding extraction
   - `impactCalculator.test.ts` — Deterministic CO2e math and duplicate-submission idempotency
   - `notifications.test.ts` — Overnight quiet hours and alert deduplication
   - `authAndLogger.test.ts` — Password hashing, single-use tokens, session revocation on reset, rate-limit sliding window, circular-safe log redaction
   - `validatorsAndRoutes.test.ts` — Coordinate bounds, safe JSON parsing, Zod URL protocol validation
   - `domainServices.test.ts` — Personalized alternatives exposure guardrails and indoor air guidance
   - `envAndAiEdgeCases.test.ts` — Mocked Open-Meteo geocoding/AQI/weather, stale-cache fallback, Places Grounding fallback, logger levels
2. **Integration Tests (`tests/integration/`):**
   - `api.test.ts` — Registration, verification, RBAC enforcement, severe smog demo scenario, AI fallback, routine generation
   - `securityAndDomain.test.ts` — Health/OpenAPI, coordinate bounds enforcement, admin URL/404 validation
   - `fullDomainRoutes.test.ts` — Impact CRUD, households, invitations, community posts/reports, challenges, achievements, notifications, preferences, resources, feedback
   - `authAndAdminRoutes.test.ts` — Full auth lifecycle, sessions, profile PUT, account deletion, admin moderation resolution
