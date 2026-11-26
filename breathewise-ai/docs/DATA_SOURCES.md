# Environmental Data & Reference Sources

1. **Ambient Air Quality & Forecasts:** Open-Meteo Air Quality API (Copernicus Atmospheric Monitoring Service — CAMS) providing PM2.5, PM10, NO2, SO2, CO, O3, and hourly forecasts.
2. **Meteorology:** Open-Meteo Weather API (temperature, relative humidity, 10m wind speed, weather code) used to flag calm winter temperature inversion risk.
3. **Geocoding:** Open-Meteo Geocoding API with fallback to local reference city coordinates.
4. **AQI Standards:** US EPA AQI breakpoints and India Central Pollution Control Board (CPCB) National AQI breakpoints (`src/server/services/air-quality/aqiStandards.ts`).
5. **Emission Factors:** DEFRA / UK DESNZ (2024), US EPA GHG Inventories (2024), US DOE Argonne National Lab (2023), India Central Electricity Authority v19 (2024), IEA (2023), IPCC (2023), WHO Household Energy Database (2023).
