# Threat Model & Security Mitigations

| Threat | Entry Point | Implemented Mitigation | Source File |
|---|---|---|---|
| Credential Theft / Plaintext Exposure | Registration / DB leak | `bcryptjs` password hashing; SHA-256 hashed session, verification & reset tokens | `src/server/services/auth/authService.ts` |
| Token Theft via XSS | Client browser storage | Bearer token stored strictly in React memory (`useState`), never `localStorage` | `src/context/AuthContext.tsx` |
| Brute-Force & Enumeration | `/auth/login`, `/auth/forgot-password` | Per-IP/email rate limiting (`429`); uniform responses preventing account enumeration | `src/server/routes/api.ts` |
| SQL Injection | Query parameters & JSON bodies | Strict Zod validation + parameterized prepared statements across all SQL calls | `src/validators/schemas.ts` |
| Broken Access Control / IDOR | Conversation, routine, household, admin APIs | Server-side `requireAuth`, `requireRoles`, and user/household ownership joins | `src/server/routes/api.ts` |
| Prompt Injection | AI Assistant chat input | Input sanitization, `<untrusted_user_question>` isolation, Zod output validation | `src/server/services/ai/aiService.ts` |
| API Key Exposure | Gemini API integration | `GEMINI_API_KEY` accessed exclusively server-side (`process.env`) | `src/server/config/env.ts` |
| Secret Leakage in Logs | Structured logging | Automatic recursive redaction of `password`, `token`, `secret`, `apiKey` fields | `src/server/utils/logger.ts` |
