export type UserRole =
  | 'INDIVIDUAL_USER'
  | 'FAMILY_ADMIN'
  | 'FAMILY_MEMBER'
  | 'COMMUNITY_MODERATOR'
  | 'SYSTEM_ADMIN';

export type AqiStandard = 'US_EPA' | 'INDIA_NAQI';

export type DemoScenario =
  | 'live'
  | 'severe_smog'
  | 'moderate_pollution'
  | 'improved_air'
  | 'api_failure'
  | 'ai_failure';

export type SupportedLanguage = 'en' | 'hi' | 'gu';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  country: string;
  stateRegion: string;
  city: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  aqiStandard: AqiStandard;
  workMode: 'wfh' | 'office' | 'school' | 'college' | 'other';
  commuteDistanceKm: number;
  primaryTransport: 'car_petrol' | 'car_diesel' | 'car_ev' | 'two_wheeler' | 'public_transit' | 'bicycle' | 'walk' | 'mixed';
  outdoorActivity: string;
  exercisePreference: string;
  cookingFuel: 'lpg_piped_gas' | 'induction_electric' | 'solid_fuel_biomass' | 'mixed';
  householdSize: number;
  publicTransitAvailable: boolean;
  childrenCount: number;
  adultsCount: number;
  elderlyCount: number;
  hasSensitiveMembers: boolean;
  hasAirPurifier: boolean;
  ventilationType: 'natural_windows' | 'exhaust_fans' | 'mechanical_hvac' | 'limited';
  hasBalconyWindows: boolean;
  indoorCookingVentilation: 'chimney_hood' | 'exhaust_fan' | 'open_window' | 'none';
  hasIndoorSensor: boolean;
  preferredLanguage: SupportedLanguage;
  sustainabilityGoal: string;
  dailyScheduleSummary: string;
  budgetLevel: 'no_cost' | 'low_cost' | 'moderate' | 'flexible';
  consentWithdrawn: boolean;
}

export interface AqiSeverityMeta {
  standard: AqiStandard;
  aqi: number;
  category: string;
  level: 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'very_unhealthy' | 'severe';
  colorHex: string;
  badgeBgClass: string;
  badgeTextClass: string;
  iconName: 'CheckCircle2' | 'Info' | 'AlertTriangle' | 'ShieldAlert' | 'AlertOctagon';
  plainLanguageSummary: string;
  outdoorGuidance: string;
  sensitiveGroupGuidance: string;
}

export interface PollutantReadings {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
}

export interface WeatherData {
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  conditionText: string;
  isInversionLikely: boolean;
}

export interface HourlyForecastPoint {
  timeIso: string;
  hourLabel: string;
  pm25: number | null;
  pm10: number | null;
  usAqi: number;
  indiaAqi: number;
  temperatureC: number | null;
  windSpeedKmh: number | null;
}

export interface EnvironmentalSnapshot {
  location: {
    name: string;
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  standard: AqiStandard;
  aqi: AqiSeverityMeta;
  pollutants: PollutantReadings;
  weather: WeatherData;
  hourlyForecast: HourlyForecastPoint[];
  dataSource: string;
  observedAt: string;
  fetchedAt: string;
  isCached: boolean;
  isStale: boolean;
  isDemo: boolean;
  demoScenario?: DemoScenario;
  staleReason?: string;
}

export interface StructuredRecommendation {
  title: string;
  suggestedAction: string;
  recommendedTime: string;
  reason: string;
  personalRelevance: string;
  exposureBenefit: string;
  environmentalBenefit: string;
  estimatedCost: string;
  difficultyLevel: 'Easy' | 'Moderate' | 'Effort-Intensive';
  supportingSource: string;
  uncertaintyOrLimitations: string;
  safetyPrecautions: string;
}

export interface GroundedPlaceReviewSnippet {
  content: string;
  googleMapsUri?: string;
}

export interface GroundedPlaceLink {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets: GroundedPlaceReviewSnippet[];
}

export interface PlacesGroundingReply {
  query: string;
  city: string;
  latitude: number;
  longitude: number;
  answerMarkdown: string;
  places: GroundedPlaceLink[];
  providerUsed: 'gemini_maps_grounding' | 'unavailable';
  fallbackReason?: string;
  medicalDisclaimer: string;
  observedAt: string;
}

export interface AssistantReply {
  conversationId: string;
  messageId: string;
  summary: string;
  recommendations: StructuredRecommendation[];
  medicalDisclaimer: string;
  providerUsed: 'gemini' | 'deterministic_fallback';
  fallbackReason?: string;
  groundedDataSnapshot: {
    city: string;
    aqi: number;
    standard: AqiStandard;
    category: string;
    observedAt: string;
  };
}

export interface RoutineActivityItem {
  id: string;
  category: string;
  title: string;
  scheduledTime: string;
  suggestedAlternative: string;
  exposureNote: string;
  environmentalNote: string;
  reason: string;
  isIndoor: boolean;
  completed: boolean;
}

export interface DailyRoutinePlan {
  id: string;
  dateIso: string;
  city: string;
  aqiAtGeneration: number;
  aqiStandard: AqiStandard;
  providerUsed: 'gemini' | 'deterministic_fallback';
  summary: string;
  activities: RoutineActivityItem[];
  createdAt: string;
}

export interface EmissionFactorRecord {
  id: string;
  code: string;
  category: string;
  label: string;
  unit: string;
  baselineKgCo2ePerUnit: number;
  alternativeKgCo2ePerUnit: number;
  fuelLitersPerUnit: number;
  source: string;
  region: string;
  publicationYear: number;
  assumptions: string;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  householdId?: string | null;
  factorCode: string;
  activityTitle: string;
  quantity: number;
  unit: string;
  co2eAvoidedKg: number;
  fuelSavedLiters: number;
  vehicleKmAvoided: number;
  energySavedKwh: number;
  notes?: string;
  activityDate: string;
  createdAt: string;
}

export interface ImpactSummary {
  dailyCo2eAvoidedKg: number;
  weeklyCo2eAvoidedKg: number;
  monthlyCo2eAvoidedKg: number;
  totalCo2eAvoidedKg: number;
  totalFuelSavedLiters: number;
  totalVehicleKmAvoided: number;
  totalEnergySavedKwh: number;
  sustainableTripsCount: number;
  dailySeries: Array<{ date: string; co2eKg: number; activities: number }>;
  scientificNote: string;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  city: string;
  sharedGoal: string;
  members: Array<{
    userId: string;
    fullName: string;
    email: string;
    householdRole: 'FAMILY_ADMIN' | 'FAMILY_MEMBER';
    joinedAt: string;
  }>;
  invitations: Array<{
    id: string;
    invitedEmail: string;
    role: 'FAMILY_ADMIN' | 'FAMILY_MEMBER';
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    token?: string;
    expiresAt: string;
  }>;
  combinedImpactKg: number;
}

export interface CommunityPostItem {
  id: string;
  communityId: string;
  city: string;
  authorName: string;
  title: string;
  content: string;
  category: 'discussion' | 'initiative' | 'announcement' | 'unverified_report';
  isVerified: boolean;
  createdAt: string;
}

export interface ChallengeItem {
  id: string;
  title: string;
  description: string;
  city: string;
  targetUnit: string;
  targetValue: number;
  participantCount: number;
  userProgress: number;
  joined: boolean;
  safetyNote: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  isRead: boolean;
  createdAt: string;
}

export interface EducationalResourceItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  sourceOrganization: string;
  sourceUrl: string;
  readingMinutes: number;
}
