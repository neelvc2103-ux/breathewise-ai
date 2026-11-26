# REST API Documentation (`/api/v1`)

Machine-readable OpenAPI 3.0 specification is served at `GET /api/v1/docs/openapi.json`.

## Endpoint Groups

- **Health & Spec:** `GET /api/v1/health`, `GET /api/v1/docs/openapi.json`
- **Auth:** `POST /auth/register`, `POST /auth/login`, `POST /auth/demo-login`, `POST /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/change-password`, `DELETE /auth/account`
- **Profile:** `GET /profile`, `PUT /profile`
- **Environmental:** `GET /locations/search?q=`, `GET /air-quality?city=&lat=&lon=&standard=&demoScenario=`
- **AI & Routines:** `POST /assistant/chat`, `GET /assistant/conversations`, `GET /assistant/conversations/:id`, `GET /routines/latest`, `POST /routines/generate`, `PATCH /routines/activities/:id`, `GET /indoor/guidance`, `GET /alternatives`
- **Impact:** `GET /impact/factors`, `GET /impact/summary`, `GET /impact/activities`, `POST /impact/activities`, `DELETE /impact/activities/:id`
- **Family & Community:** `GET /households`, `POST /households`, `POST /households/:id/invite`, `POST /households/invitations/:token/respond`, `GET /communities/posts`, `POST /communities/posts`, `POST /communities/reports`, `GET /challenges`, `POST /challenges/:id/join`, `POST /challenges/:id/progress`, `GET /achievements`
- **Notifications & Resources:** `GET /notifications`, `PATCH /notifications/:id/read`, `DELETE /notifications`, `GET /notifications/preferences`, `PUT /notifications/preferences`, `GET /resources`, `POST /feedback`
- **Admin & Moderation:** `GET /admin/overview`, `GET /admin/users`, `PATCH /admin/users/:id/role`, `GET /admin/moderation/reports`, `POST /admin/moderation/reports/:id/resolve`, `GET /admin/audit-logs`, `POST /admin/resources`
