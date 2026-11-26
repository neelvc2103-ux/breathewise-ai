import crypto from 'node:crypto';
import path from 'node:path';

const ephemeralSecret = crypto.randomBytes(32).toString('hex');

export const envConfig = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  authSecret: process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16
    ? process.env.AUTH_SECRET
    : ephemeralSecret,
  sqlitePath: path.resolve(process.cwd(), process.env.SQLITE_PATH ?? './data/breathewise.db'),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  aiModel: process.env.AI_MODEL || 'gemini-4-hydrogen',
  aiDailyUserLimit: Number(process.env.AI_DAILY_USER_LIMIT ?? 40),
  airQualityApiBase: process.env.AIR_QUALITY_API_BASE || 'https://air-quality-api.open-meteo.com/v1',
  weatherApiBase: process.env.WEATHER_API_BASE || 'https://api.open-meteo.com/v1',
  geocodingApiBase: process.env.GEOCODING_API_BASE || 'https://geocoding-api.open-meteo.com/v1',
  demoMode: process.env.DEMO_MODE !== 'false',
};
