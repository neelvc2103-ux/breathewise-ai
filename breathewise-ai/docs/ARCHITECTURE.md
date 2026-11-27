# System Architecture

BreatheWise AI follows a modular, layered architecture separating presentation, authentication, API validation, deterministic environmental engines, AI orchestration, and persistence.

```mermaid
flowchart TB
  Client[React 19 SPA + Recharts + Tailwind CSS] -->|/api/v1/* Bearer Auth| API[Express REST Router + Zod Validation]
  API --> Auth[Auth & RBAC Service]
  API --> Env[Environmental Service]
  API --> AI[GenAI Assistant Service]
  API --> Impact[Deterministic Impact Calculator]
  API --> Routine[Routine & Indoor Services]
  Env -->|Live + Retry| OpenMeteo[Open-Meteo AQI / Weather / Geocoding]
  Env <-->|15m TTL Cache| DB[(SQLite / PostgreSQL)]
  AI -->|Structured JSON| Gemini[Google Gemini API: gemini-4-hydrogen]
  AI -->|On Failure / Key Unset| Fallback[Deterministic Rule Engine]
  Auth <--> DB
  Impact <--> DB
  Routine <--> DB
```

## Module Responsibilities

- `src/server/routes/api.ts`: Composes the versioned `/api/v1` REST API from modular domain routers (`authRoutes.ts`, `environmentRoutes.ts`, `assistantRoutes.ts`, `impactRoutes.ts`, `communityRoutes.ts`, `engagementRoutes.ts`, `adminRoutes.ts`) and shared validation helpers (`helpers.ts`).
- `src/server/services/air-quality/`: Explicit US EPA vs. India NAQI breakpoint math (`aqiStandards.ts`) and Open-Meteo fetching/caching (`environmentalService.ts`).
- `src/server/services/ai/`: Gemini SDK wrapper with prompt-injection neutralization and deterministic fallback (`aiService.ts`).
- `src/server/services/emissions/`: Deterministic emissions-factor calculations and duplicate-activity guards (`impactCalculator.ts`).
- `src/server/services/routines/`, `indoor/`, `alternatives/`, `notifications/`: Domain-specific guidance modules.
