# Changelog

## 1.0.1 — 2026-11-27
- Decomposed monolithic `src/server/routes/api.ts` into modular domain routers (`authRoutes`, `environmentRoutes`, `assistantRoutes`, `impactRoutes`, `communityRoutes`, `engagementRoutes`, `adminRoutes`, `helpers`) with `asyncHandler` error forwarding.
- Enabled TypeScript `strict`, `noUnusedLocals`, and `noUnusedParameters` (`npm run typecheck`) and added `oxlint` static analysis (`npm run lint`) with 0 errors and 0 warnings.
- Hardened `trust proxy = 1` for Render, `authService` rate-limiter memory bounds, `logger.ts` circular-reference redaction, coordinate bounds validation, and `adminResourceSchema` URL protocol validation.
- Resolved all automated WCAG 2.2 AA `axe-core` violations across Desktop and Mobile (`0` violations): added `aria-current`, `role="dialog"` focus trapping/restoration, `Escape` close, `document.documentElement.lang` synchronization, `role="img"` chart semantics, `space-y-3` Settings checkbox spacing, and approved contrast fix on locked achievement cards in `FamilyCommunityPage.tsx`.
- Expanded Vitest suite to 42 passing tests across 14 files (85.63% statement / 90.18% function coverage on `src/server/**` and `src/validators/**`), persisted `scripts/qa-browser.py`, and configured root `.github/workflows/ci.yml`.

## 1.0.0 — 2026-11-26
- Initial production-ready release of BreatheWise AI.
- Implemented full-stack Express + React + SQLite runtime with PostgreSQL Prisma production schema.
- Added US EPA & India NAQI dual-scale environmental dashboard with Open-Meteo integration and TTL caching.
- Added server-side Gemini AI personal assistant (`gemini-4-hydrogen`) with structured recommendations and deterministic fallback.
- Added Smart Daily Routine Planner, Indoor Air Quality Assistant, Sustainable Alternatives Engine, and Deterministic Impact Calculator.
- Added Family Household Management, Community Challenges, Moderation Queue, RBAC Admin Panel, and Demo Mode scenarios.
