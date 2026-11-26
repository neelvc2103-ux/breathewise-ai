# Accessibility Implementation (Target: WCAG 2.2 Level AA)

- **Multi-Modal Severity Signaling:** Air quality status never relies on color alone; every display shows numeric AQI, text severity category, a semantic icon (`AqiStatusDisplay`), AQI scale identifier (`India NAQI` or `US EPA AQI`), and plain-language advice.
- **Accessible Charts:** Hourly forecast charts include a one-click `View Accessible Table` toggle (`EnvironmentalCharts.tsx`) with semantic `<table>` headers and tabular numerals (`tabular-nums`).
- **Keyboard & Focus Navigation:** Skip-to-content links on both public and workspace shells, visible `2px` teal focus-visible outlines (`src/index.css`), modal `role="dialog"` `aria-modal="true"` containers, and `prefers-reduced-motion` CSS rules.
- **Localization Readiness:** English (`en`), Hindi (`hi`), and Gujarati (`gu`) translation dictionaries (`src/i18n/translations.ts`).
- **Note on Verification:** Automated TypeScript and component checks were run; full assistive-technology (NVDA/VoiceOver) manual audits remain a recommended pre-release step.
