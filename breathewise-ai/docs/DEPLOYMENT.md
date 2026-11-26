# Deployment Guide

## Local / AI Studio Preview
1. `npm install`
2. Configure `.env` (or Settings > Secrets) with `GEMINI_API_KEY`.
3. `npm run build`
4. `npm start` (serves Express API + built React SPA on port `3000`).

## Docker & PostgreSQL Production Deployment
1. Set `DEMO_MODE=false` and a strong 32+ char `AUTH_SECRET` in `.env`.
2. Run `docker compose up --build -d` (uses `Dockerfile`, `docker-compose.yml`, and `prisma/schema.prisma`).
3. Verify health at `GET /api/v1/health`.
4. Schedule automated `pg_dump` backups of the `pg_data` volume.
