# Performance & API Quota Optimization

- **Environmental Caching:** Open-Meteo AQI & weather snapshots are cached per `lat:lon` grid key in SQLite (`environmental_cache`) for 15 minutes, eliminating redundant upstream API calls and enabling graceful stale-cache fallback on network failures.
- **Bounded Network Requests:** Upstream API requests use `AbortSignal.timeout(5000)` and bounded retries (max 2 attempts with backoff).
- **Deterministic Computation Offloading:** All AQI conversions and CO2e/fuel/kWh calculations execute locally in TypeScript rather than consuming LLM tokens.
- **AI Rate & Context Controls:** Per-user daily AI request caps (`AI_DAILY_USER_LIMIT`), compact JSON context payloads, and SQLite indexing on `users(email)`, `sessions(token_hash)`, `ai_messages(conversation_id)`, and `activity_logs(user_id, activity_date)`.
