# Prompt Engineering & Safety Safeguards

1. **Untrusted Input Delimitation:** User questions are sanitized (`sanitizeUserPrompt`) and wrapped inside `<untrusted_user_question>` delimiters so prompt instructions inside user text cannot override system behavior.
2. **Data Grounding:** Exact current AQI, pollutant concentrations, hourly forecast windows, and deterministic emission savings are injected into `ENVIRONMENTAL_CONTEXT` and `DETERMINISTIC_FACTS`. The model is instructed never to invent measurements or arithmetic.
3. **Structured Output Enforcement:** Requests specify `responseMimeType: 'application/json'` and `responseSchema`, followed by Zod validation (`aiPayloadSchema`) before rendering.
4. **Exposure & Medical Guardrails:** Prompts explicitly prohibit recommending outdoor cycling/jogging during severe smog and require separating environmental advice from clinical medical guidance.
