# BreatheWise AI

**Tagline:** Breathe Better. Live Smarter. Together.

BreatheWise AI is a full-stack, GenAI-powered environmental health and sustainability assistant designed to help families and communities navigate severe winter smog and urban air pollution. It combines real-time environmental telemetry, deterministic AQI standards (US EPA and India National AQI), grounded Gemini AI recommendations, adaptive daily routine planning, indoor air quality checklists, and transparent emissions-impact calculations.

## Core Workflow

`Observe → Understand → Recommend → Act → Measure → Improve`

## Technology Stack

- **Frontend:** React 19, TypeScript (strict), Tailwind CSS v4, Recharts, Lucide Icons, Zod
- **Backend:** Express.js, TypeScript (`tsx`), Helmet security headers, structured JSON logging with automatic credential redaction
- **Database:** Embedded SQLite (`node:sqlite`) for zero-config local/preview execution + PostgreSQL Prisma schema (`prisma/schema.prisma`) for Docker/Cloud deployments
- **AI Engine:** `@google/genai` (`gemini-4-hydrogen`) strictly server-side with structured JSON schemas, prompt-injection sanitization, and a deterministic rule-based fallback engine
- **Environmental Data:** Open-Meteo Air Quality, Weather, and Geocoding APIs (Copernicus CAMS) with 15-minute TTL caching and stale-cache fallback
- **Testing:** Vitest unit, security, RBAC, IDOR, and full-stack HTTP integration tests

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Visit `http://localhost:3000`.

## Scripts

- `npm run dev` — Starts full-stack Express + Vite server on port 3000
- `npm run lint` — Runs TypeScript type checking (`tsc --noEmit`)
- `npm test` — Runs Vitest unit and integration test suites
- `npm run build` — Builds production client bundle into `dist/`
- `npm start` — Starts production server (`tsx server.ts`)

## Documentation Index

- [Architecture & Data Flow](docs/ARCHITECTURE.md)
- [Database Schema & ER Diagram](docs/DATABASE.md)
- [REST API Reference](docs/API.md)
- [AI Integration & Prompt Engineering](docs/AI_INTEGRATION.md)
- [Environmental Impact Calculations](docs/ENVIRONMENTAL_CALCULATIONS.md)
- [Threat Model & Security](docs/THREAT_MODEL.md)
- [Evaluation Matrix](docs/EVALUATION_MATRIX.md)
- [Demo Mode Guide](docs/DEMO_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
