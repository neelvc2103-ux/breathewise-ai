# Security Policy

## Reporting a Vulnerability
Please report security vulnerabilities privately via the project security contact or repository security advisories rather than opening a public issue.

## Core Security Controls Implemented
- Passwords hashed using `bcryptjs` (salt rounds: 10); plaintext passwords are never stored.
- Session tokens, verification tokens, and password reset tokens are generated via `crypto.randomBytes` and stored exclusively as SHA-256 hashes.
- Bearer session tokens are held strictly in client React memory (never persisted in `localStorage` or `sessionStorage`).
- Server-side Zod validation on all API request payloads; parameterized SQL statements across all database queries.
- Server-side RBAC middleware (`requireAuth`, `requireRoles`) enforced on every protected and administrative route.
- Sensitive keys (`password`, `token`, `apiKey`, `secret`) are automatically redacted from structured server logs.
- `GEMINI_API_KEY` and `AUTH_SECRET` remain strictly server-side (`process.env`).
