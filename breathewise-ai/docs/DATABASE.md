# Database Design & Relationships

BreatheWise AI uses normalized relational tables with foreign keys, unique constraints, and indexes. Local/preview environments run on zero-config embedded SQLite (`src/server/db/database.ts`), while `prisma/schema.prisma` mirrors the exact relational model for PostgreSQL deployments.

```mermaid
erDiagram
  USERS ||--o| USER_PROFILES : has
  USERS ||--o{ SESSIONS : owns
  USERS ||--o{ AI_CONVERSATIONS : starts
  AI_CONVERSATIONS ||--o{ AI_MESSAGES : contains
  USERS ||--o{ DAILY_ROUTINES : generates
  DAILY_ROUTINES ||--o{ ROUTINE_ACTIVITIES : includes
  USERS ||--o{ ACTIVITY_LOGS : logs
  EMISSION_FACTORS ||--o{ ACTIVITY_LOGS : calculates
  HOUSEHOLDS ||--o{ HOUSEHOLD_MEMBERS : contains
  USERS ||--o{ HOUSEHOLD_MEMBERS : joins
  HOUSEHOLDS ||--o{ HOUSEHOLD_INVITATIONS : issues
  COMMUNITIES ||--o{ COMMUNITY_POSTS : hosts
  COMMUNITY_POSTS ||--o{ COMMUNITY_REPORTS : receives
  USERS ||--o{ NOTIFICATIONS : receives
```
