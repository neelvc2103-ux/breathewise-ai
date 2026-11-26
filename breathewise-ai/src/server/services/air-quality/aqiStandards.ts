import type { AqiSeverityMeta, AqiStandard, PollutantReadings } from '../../../types/domain';

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

const US_EPA_PM25_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
];

const US_EPA_PM10_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
];

// India National Air Quality Index (CPCB) breakpoints
const INDIA_NAQI_PM25_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
  { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100 },
  { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200 },
  { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300 },
  { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400 },
  { cLow: 251, cHigh: 500, iLow: 401, iHigh: 500 },
];

const INDIA_NAQI_PM10_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 431, cHigh: 600, iLow: 401, iHigh: 500 },
];

function computeSubIndex(concentration: number | null, breakpoints: Breakpoint[]): number {
  if (concentration === null || Number.isNaN(concentration) || concentration < 0) return 0;
  for (const bp of breakpoints) {
    if (concentration <= bp.cHigh) {
      const clamped = Math.max(concentration, bp.cLow);
      return Math.round(((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (clamped - bp.cLow) + bp.iLow);
    }
  }
  return 500;
}

/**
 * Computes AQI strictly using the requested regional standard (US EPA or India NAQI).
 * Never mixes incompatible AQI scales.
 */
export function computeAqiFromPollutants(
  pollutants: Pick<PollutantReadings, 'pm25' | 'pm10'>,
  standard: AqiStandard,
): number {
  if (standard === 'INDIA_NAQI') {
    const pm25Idx = computeSubIndex(pollutants.pm25, INDIA_NAQI_PM25_BREAKPOINTS);
    const pm10Idx = computeSubIndex(pollutants.pm10, INDIA_NAQI_PM10_BREAKPOINTS);
    return Math.max(pm25Idx, pm10Idx);
  }
  const pm25Idx = computeSubIndex(pollutants.pm25, US_EPA_PM25_BREAKPOINTS);
  const pm10Idx = computeSubIndex(pollutants.pm10, US_EPA_PM10_BREAKPOINTS);
  return Math.max(pm25Idx, pm10Idx);
}

/**
 * Maps a numeric AQI value into explicit, accessible metadata (text category,
 * color, icon name, and plain-language guidance) for the chosen standard.
 */
export function getAqiSeverityMeta(aqiValue: number, standard: AqiStandard): AqiSeverityMeta {
  const aqi = Math.max(0, Math.min(500, Math.round(aqiValue)));

  if (standard === 'INDIA_NAQI') {
    if (aqi <= 50) {
      return {
        standard,
        aqi,
        category: 'Good',
        level: 'good',
        colorHex: '#15803D',
        badgeBgClass: 'bg-emerald-50 dark:bg-emerald-950/60',
        badgeTextClass: 'text-emerald-800 dark:text-emerald-300',
        iconName: 'CheckCircle2',
        plainLanguageSummary: 'Minimal air pollution impact. Outdoor air is generally favorable for daily routines.',
        outdoorGuidance: 'Normal outdoor exercise, cycling, and window ventilation are suitable.',
        sensitiveGroupGuidance: 'No special restrictions needed under typical conditions.',
      };
    }
    if (aqi <= 100) {
      return {
        standard,
        aqi,
        category: 'Satisfactory',
        level: 'moderate',
        colorHex: '#0D9488',
        badgeBgClass: 'bg-teal-50 dark:bg-teal-950/60',
        badgeTextClass: 'text-teal-800 dark:text-teal-300',
        iconName: 'Info',
        plainLanguageSummary: 'Acceptable air quality, with minor discomfort possible for unusually sensitive people.',
        outdoorGuidance: 'Outdoor walks and commutes are fine; prefer parks over congested roadways.',
        sensitiveGroupGuidance: 'Sensitive individuals should monitor breathing comfort during intense exertion.',
      };
    }
    if (aqi <= 200) {
      return {
        standard,
        aqi,
        category: 'Moderate',
        level: 'sensitive',
        colorHex: '#D97706',
        badgeBgClass: 'bg-amber-50 dark:bg-amber-950/60',
        badgeTextClass: 'text-amber-800 dark:text-amber-300',
        iconName: 'AlertTriangle',
        plainLanguageSummary: 'Noticeable particulate load that can irritate lungs in children, older adults, and sensitive households.',
        outdoorGuidance: 'Shorten prolonged vigorous outdoor exercise; prefer metro or enclosed transit.',
        sensitiveGroupGuidance: 'Children, older adults, and sensitive individuals should limit heavy outdoor exertion.',
      };
    }
    if (aqi <= 300) {
      return {
        standard,
        aqi,
        category: 'Poor',
        level: 'unhealthy',
        colorHex: '#EA580C',
        badgeBgClass: 'bg-orange-50 dark:bg-orange-950/60',
        badgeTextClass: 'text-orange-800 dark:text-orange-300',
        iconName: 'ShieldAlert',
        plainLanguageSummary: 'Elevated pollution likely to cause breathing discomfort on prolonged exposure.',
        outdoorGuidance: 'Move exercise indoors. Wear a fitted N95/FFP2 mask for necessary outdoor commutes.',
        sensitiveGroupGuidance: 'Keep windows closed during traffic peaks; run HEPA filtration indoors if available.',
      };
    }
    if (aqi <= 400) {
      return {
        standard,
        aqi,
        category: 'Very Poor',
        level: 'very_unhealthy',
        colorHex: '#DC2626',
        badgeBgClass: 'bg-red-50 dark:bg-red-950/60',
        badgeTextClass: 'text-red-800 dark:text-red-300',
        iconName: 'AlertOctagon',
        plainLanguageSummary: 'Severe winter smog conditions. Prolonged outdoor exposure affects everyone.',
        outdoorGuidance: 'Avoid outdoor jogging or cycling. Work remotely if possible or use enclosed transit with N95 protection.',
        sensitiveGroupGuidance: 'Children and elderly members should remain indoors with clean-air filtration and avoid indoor smoke.',
      };
    }
    return {
      standard,
      aqi,
      category: 'Severe',
      level: 'severe',
      colorHex: '#991B1B',
      badgeBgClass: 'bg-red-100 dark:bg-red-950/80',
      badgeTextClass: 'text-red-900 dark:text-red-200',
      iconName: 'AlertOctagon',
      plainLanguageSummary: 'Emergency-level particulate concentration. Serious impact even on healthy individuals during outdoor activity.',
      outdoorGuidance: 'Stay indoors whenever possible. Postpone non-essential outdoor trips and keep windows sealed.',
      sensitiveGroupGuidance: 'Seek clinical advice promptly if any family member experiences shortness of breath or chest tightness.',
    };
  }

  // US EPA AQI Standard
  if (aqi <= 50) {
    return {
      standard,
      aqi,
      category: 'Good',
      level: 'good',
      colorHex: '#15803D',
      badgeBgClass: 'bg-emerald-50 dark:bg-emerald-950/60',
      badgeTextClass: 'text-emerald-800 dark:text-emerald-300',
      iconName: 'CheckCircle2',
      plainLanguageSummary: 'Air quality is clean and poses little or no risk under US EPA thresholds.',
      outdoorGuidance: 'Great conditions for outdoor exercise, walking, and natural cross-ventilation.',
      sensitiveGroupGuidance: 'No special precautions required.',
    };
  }
  if (aqi <= 100) {
    return {
      standard,
      aqi,
      category: 'Moderate',
      level: 'moderate',
      colorHex: '#D97706',
      badgeBgClass: 'bg-amber-50 dark:bg-amber-950/60',
      badgeTextClass: 'text-amber-800 dark:text-amber-300',
      iconName: 'Info',
      plainLanguageSummary: 'Acceptable air quality; a small number of unusually sensitive individuals may notice mild irritation.',
      outdoorGuidance: 'Normal outdoor activity is appropriate; choose low-traffic streets for walking or cycling.',
      sensitiveGroupGuidance: 'Consider shifting intense workouts away from rush-hour corridors.',
    };
  }
  if (aqi <= 150) {
    return {
      standard,
      aqi,
      category: 'Unhealthy for Sensitive Groups',
      level: 'sensitive',
      colorHex: '#EA580C',
      badgeBgClass: 'bg-orange-50 dark:bg-orange-950/60',
      badgeTextClass: 'text-orange-800 dark:text-orange-300',
      iconName: 'AlertTriangle',
      plainLanguageSummary: 'Older adults, children, and people with respiratory sensitivity may experience effects.',
      outdoorGuidance: 'Take more breaks during outdoor activity and watch forecast windows before ventilating.',
      sensitiveGroupGuidance: 'Reduce prolonged or heavy outdoor exertion.',
    };
  }
  if (aqi <= 200) {
    return {
      standard,
      aqi,
      category: 'Unhealthy',
      level: 'unhealthy',
      colorHex: '#DC2626',
      badgeBgClass: 'bg-red-50 dark:bg-red-950/60',
      badgeTextClass: 'text-red-800 dark:text-red-300',
      iconName: 'ShieldAlert',
      plainLanguageSummary: 'Everyone may begin to experience health effects; sensitive groups face higher risk.',
      outdoorGuidance: 'Shift workouts indoors and prefer enclosed public transit with an N95 mask.',
      sensitiveGroupGuidance: 'Avoid prolonged outdoor exposure; keep indoor air filtered.',
    };
  }
  if (aqi <= 300) {
    return {
      standard,
      aqi,
      category: 'Very Unhealthy',
      level: 'very_unhealthy',
      colorHex: '#991B1B',
      badgeBgClass: 'bg-red-100 dark:bg-red-950/80',
      badgeTextClass: 'text-red-900 dark:text-red-200',
      iconName: 'AlertOctagon',
      plainLanguageSummary: 'Health alert: significant smog burden across the general population.',
      outdoorGuidance: 'Avoid outdoor exercise and non-essential trips; seal drafts and run HEPA filtration.',
      sensitiveGroupGuidance: 'Remain indoors with filtered air and follow medical action plans if applicable.',
    };
  }
  return {
    standard,
    aqi,
    category: 'Hazardous',
    level: 'severe',
    colorHex: '#7F1D1D',
    badgeBgClass: 'bg-red-100 dark:bg-red-950/90',
    badgeTextClass: 'text-red-950 dark:text-red-100',
    iconName: 'AlertOctagon',
    plainLanguageSummary: 'Emergency conditions. Everyone is likely to be affected by high particle density.',
    outdoorGuidance: 'Avoid all outdoor physical activity. Use telework/remote school options when feasible.',
    sensitiveGroupGuidance: 'Keep indoor rooms closed and filtered; consult healthcare providers for respiratory symptoms.',
  };
}
