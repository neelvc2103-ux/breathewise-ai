import { z } from 'zod';

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true, {
      message: 'You must accept the Privacy Policy and Terms',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required').max(128),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(16, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(128)
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match',
    path: ['confirmNewPassword'],
  });

export const profileUpdateSchema = z.object({
  country: z.string().trim().min(1).max(80).default('India'),
  stateRegion: z.string().trim().max(80).default('Delhi NCR'),
  city: z.string().trim().min(1).max(80).default('New Delhi'),
  postalCode: z.string().trim().max(20).optional().default(''),
  latitude: z.number().min(-90).max(90).default(28.6139),
  longitude: z.number().min(-180).max(180).default(77.209),
  aqiStandard: z.enum(['US_EPA', 'INDIA_NAQI']).default('INDIA_NAQI'),
  workMode: z.enum(['wfh', 'office', 'school', 'college', 'other']).default('office'),
  commuteDistanceKm: z.number().min(0).max(300).default(12),
  primaryTransport: z
    .enum([
      'car_petrol',
      'car_diesel',
      'car_ev',
      'two_wheeler',
      'public_transit',
      'bicycle',
      'walk',
      'mixed',
    ])
    .default('car_petrol'),
  outdoorActivity: z.string().trim().max(120).default('Morning walk'),
  exercisePreference: z.string().trim().max(120).default('Brisk walking or light jogging'),
  cookingFuel: z
    .enum(['lpg_piped_gas', 'induction_electric', 'solid_fuel_biomass', 'mixed'])
    .default('lpg_piped_gas'),
  householdSize: z.number().int().min(1).max(20).default(3),
  publicTransitAvailable: z.boolean().default(true),
  childrenCount: z.number().int().min(0).max(15).default(1),
  adultsCount: z.number().int().min(0).max(15).default(2),
  elderlyCount: z.number().int().min(0).max(15).default(0),
  hasSensitiveMembers: z.boolean().default(false),
  hasAirPurifier: z.boolean().default(false),
  ventilationType: z
    .enum(['natural_windows', 'exhaust_fans', 'mechanical_hvac', 'limited'])
    .default('natural_windows'),
  hasBalconyWindows: z.boolean().default(true),
  indoorCookingVentilation: z
    .enum(['chimney_hood', 'exhaust_fan', 'open_window', 'none'])
    .default('exhaust_fan'),
  hasIndoorSensor: z.boolean().default(false),
  preferredLanguage: z.enum(['en', 'hi', 'gu']).default('en'),
  sustainabilityGoal: z.string().trim().max(240).default('Reduce car commuting and household electricity waste'),
  dailyScheduleSummary: z.string().trim().max(240).default('07:00 wake, 09:00-18:00 work, 20:00 dinner'),
  budgetLevel: z.enum(['no_cost', 'low_cost', 'moderate', 'flexible']).default('low_cost'),
  consentWithdrawn: z.boolean().default(false),
});

export const assistantMessageSchema = z.object({
  message: z.string().trim().min(2, 'Please enter a question').max(1000),
  conversationId: z.string().trim().optional(),
  city: z.string().trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  standard: z.enum(['US_EPA', 'INDIA_NAQI']).optional(),
  demoScenario: z
    .enum(['live', 'severe_smog', 'moderate_pollution', 'improved_air', 'api_failure', 'ai_failure'])
    .optional(),
});

export const placesGroundingSchema = z.object({
  query: z.string().trim().min(3, 'Please enter a nearby place or transit search').max(400),
  city: z.string().trim().max(100).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  standard: z.enum(['US_EPA', 'INDIA_NAQI']).optional(),
  demoScenario: z
    .enum(['live', 'severe_smog', 'moderate_pollution', 'improved_air', 'api_failure', 'ai_failure'])
    .optional(),
});

export const logActivitySchema = z.object({
  factorCode: z.string().trim().min(1).max(60),
  quantity: z.number().positive('Quantity must be greater than zero').max(5000),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD date format'),
  notes: z.string().trim().max(240).optional().default(''),
  householdId: z.string().trim().optional(),
});

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(2, 'Household name is required').max(80),
  city: z.string().trim().min(1).max(80),
  sharedGoal: z.string().trim().max(240).default('Cut weekly solo car trips by 40%'),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email('Valid email required').toLowerCase(),
  role: z.enum(['FAMILY_ADMIN', 'FAMILY_MEMBER']).default('FAMILY_MEMBER'),
});

export const createPostSchema = z.object({
  city: z.string().trim().min(1).max(80),
  title: z.string().trim().min(4).max(120),
  content: z.string().trim().min(10).max(1200),
  category: z.enum(['discussion', 'initiative', 'announcement', 'unverified_report']),
});

export const reportPostSchema = z.object({
  postId: z.string().min(1),
  reason: z.string().trim().min(5).max(300),
});

export const feedbackSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  category: z.enum(['bug', 'feature', 'data_accuracy', 'accessibility', 'general']).default('general'),
  message: z.string().trim().min(10).max(1500),
});

export const notificationPrefSchema = z.object({
  aqiThreshold: z.number().int().min(50).max(400),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().trim().min(2).max(60),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  browserEnabled: z.boolean(),
  weeklyReportEnabled: z.boolean(),
  unsubscribedAll: z.boolean(),
});

export const householdGoalSchema = z.object({
  sharedGoal: z.string().trim().min(4, 'Goal description is too short.').max(240),
});

export const challengeProgressSchema = z.object({
  amount: z.number().positive('Progress increment must be a positive number.').max(1000),
});

export const adminResourceSchema = z.object({
  title: z.string().trim().min(4, 'Title and content are required.').max(160),
  category: z.string().trim().min(1).max(60).default('General'),
  summary: z.string().trim().max(400).optional().default(''),
  content: z.string().trim().min(15, 'Title and content are required.').max(5000),
  sourceOrganization: z.string().trim().min(1).max(120).default('WHO / EPA'),
  sourceUrl: z
    .string()
    .trim()
    .url('Source URL must be a valid URL.')
    .refine((u) => u.startsWith('https://') || u.startsWith('http://'), {
      message: 'Source URL must use http:// or https:// protocol.',
    })
    .default('https://www.who.int/'),
});
