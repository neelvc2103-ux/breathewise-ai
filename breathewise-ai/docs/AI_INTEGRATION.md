# AI Integration & Grounded Recommendation Flow

BreatheWise AI invokes Google Gemini (`gemini-4-hydrogen`) strictly on the server via `@google/genai` inside `src/server/services/ai/aiService.ts`.

```mermaid
sequenceDiagram
  participant User
  participant API as Express /api/v1/assistant/chat
  participant Env as Environmental Service
  participant AI as Gemini (gemini-4-hydrogen)
  participant Fallback as Deterministic Rule Engine

  User->>API: Question + Bearer Token
  API->>Env: Fetch live/cached AQI + Forecast
  Env-->>API: Grounded Snapshot
  API->>AI: Sanitized Context + Structured JSON Schema
  alt Gemini Available
    AI-->>API: Structured Recommendations JSON
    API->>API: Zod Validation
  else Provider Error / Key Missing / Simulated Outage
    API->>Fallback: Generate deterministic recommendations
    Fallback-->>API: Grounded Fallback Response
  end
  API-->>User: AssistantReply + Medical Disclaimer
```
