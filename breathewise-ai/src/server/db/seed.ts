import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import { envConfig } from '../config/env';

/**
 * Seeds documented emission factors, verified educational resources,
 * default cities, achievements, challenges, and (when DEMO_MODE is active)
 * explicitly labeled evaluator demo accounts and sample data.
 */
export function seedDatabase(db: DatabaseSync): void {
  const now = new Date().toISOString();

  // 1. Seed reference cities
  const cities = [
    { id: 'loc-delhi', name: 'New Delhi', city: 'New Delhi', region: 'Delhi NCR', country: 'India', lat: 28.6139, lon: 77.209, std: 'INDIA_NAQI' },
    { id: 'loc-ahmedabad', name: 'Ahmedabad', city: 'Ahmedabad', region: 'Gujarat', country: 'India', lat: 23.0225, lon: 72.5714, std: 'INDIA_NAQI' },
    { id: 'loc-mumbai', name: 'Mumbai', city: 'Mumbai', region: 'Maharashtra', country: 'India', lat: 19.076, lon: 72.8777, std: 'INDIA_NAQI' },
    { id: 'loc-london', name: 'London', city: 'London', region: 'Greater London', country: 'United Kingdom', lat: 51.5072, lon: -0.1276, std: 'US_EPA' },
    { id: 'loc-la', name: 'Los Angeles', city: 'Los Angeles', region: 'California', country: 'United States', lat: 34.0522, lon: -118.2437, std: 'US_EPA' },
  ];
  const insertLoc = db.prepare(`
    INSERT OR IGNORE INTO locations (id, name, city, region, country, latitude, longitude, default_standard)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of cities) {
    insertLoc.run(c.id, c.name, c.city, c.region, c.country, c.lat, c.lon, c.std);
  }

  // 2. Seed Emission Factors (documented sources & assumptions)
  const factors = [
    {
      id: 'ef-1',
      code: 'COMMUTE_CAR_TO_METRO',
      category: 'Transportation',
      label: 'Switch solo petrol car commute to Metro / Rail',
      unit: 'km',
      baseline: 0.171,
      alternative: 0.035,
      fuel: 0.075,
      source: 'DEFRA / UK DESNZ GHG Conversion Factors & India GHG Program',
      region: 'Urban Rail / Average Petrol Car',
      year: 2024,
      assumptions: 'Baseline average medium petrol passenger car (171 g CO2e/km, ~7.5 L/100km); electric metro rail ~35 g CO2e/passenger-km depending on grid mix.',
    },
    {
      id: 'ef-2',
      code: 'COMMUTE_CAR_TO_BUS',
      category: 'Transportation',
      label: 'Switch solo car trip to city public bus',
      unit: 'km',
      baseline: 0.171,
      alternative: 0.082,
      fuel: 0.075,
      source: 'EPA Emission Factors for Greenhouse Gas Inventories',
      region: 'Global Urban Transit',
      year: 2024,
      assumptions: 'Baseline solo car 0.171 kg/km vs. urban bus average occupancy 0.082 kg/passenger-km.',
    },
    {
      id: 'ef-3',
      code: 'COMMUTE_CAR_TO_WFH',
      category: 'Remote Work',
      label: 'Work from home instead of driving car',
      unit: 'km',
      baseline: 0.171,
      alternative: 0.015,
      fuel: 0.075,
      source: 'IEA Teleworking Energy & Emissions Analysis',
      region: 'Urban',
      year: 2023,
      assumptions: 'Round-trip car distance avoided minus marginal home workstation electricity (~0.015 kg CO2e/km equivalent).',
    },
    {
      id: 'ef-4',
      code: 'AVOID_VEHICLE_IDLING',
      category: 'Transportation',
      label: 'Turn off engine instead of idling at signals / pickups',
      unit: 'minutes',
      baseline: 0.035,
      alternative: 0.0,
      fuel: 0.015,
      source: 'US DOE / Argonne National Laboratory Idling Reduction Study',
      region: 'Global',
      year: 2023,
      assumptions: 'Average passenger car consumes ~0.9 L/hour (~0.015 L/min) while idling; 2.31 kg CO2e per liter petrol.',
    },
    {
      id: 'ef-5',
      code: 'ELECTRICITY_SAVED',
      category: 'Home Energy',
      label: 'Reduce unnecessary household electricity consumption',
      unit: 'kWh',
      baseline: 0.716,
      alternative: 0.0,
      fuel: 0.0,
      source: 'Central Electricity Authority (CEA) CO2 Baseline Database v19',
      region: 'India Grid Average',
      year: 2024,
      assumptions: 'Weighted average grid emission factor 0.716 kg CO2e/kWh. Actual grid intensity varies by state and time of day.',
    },
    {
      id: 'ef-6',
      code: 'CONSOLIDATE_DELIVERY',
      category: 'Shopping & Logistics',
      label: 'Consolidate online orders into single scheduled delivery',
      unit: 'trips',
      baseline: 0.45,
      alternative: 0.15,
      fuel: 0.18,
      source: 'MIT Real Estate & Freight Sustainability Lab Estimates',
      region: 'Urban Last-Mile',
      year: 2023,
      assumptions: 'Consolidated drop-off reduces dedicated express van mileage per parcel by ~0.30 kg CO2e per avoided trip.',
    },
    {
      id: 'ef-7',
      code: 'AVOID_OPEN_BURNING',
      category: 'Waste & Local Smoke',
      label: 'Compost or municipal-dispose yard/dry waste instead of burning',
      unit: 'kg_waste',
      baseline: 1.45,
      alternative: 0.08,
      fuel: 0.0,
      source: 'IPCC Guidelines for National Greenhouse Gas Inventories (Open Burning)',
      region: 'Residential / Municipal',
      year: 2023,
      assumptions: 'Prevents significant local PM2.5, black carbon, CO, and VOC smoke in addition to ~1.37 kg CO2e net avoided per kg dry biomass.',
    },
    {
      id: 'ef-8',
      code: 'CLEAN_COOKING_INDUCTION',
      category: 'Cooking & Energy',
      label: 'Prepare meal using induction/electric stove over solid biomass',
      unit: 'meals',
      baseline: 1.85,
      alternative: 0.55,
      fuel: 0.0,
      source: 'WHO Household Energy & Clean Cooking Database',
      region: 'Residential',
      year: 2023,
      assumptions: 'Replaces inefficient biomass combustion; sharply reduces indoor PM2.5 and CO exposure when paired with ventilation.',
    },
  ];

  const insertFactor = db.prepare(`
    INSERT OR IGNORE INTO emission_factors (
      id, code, category, label, unit, baseline_kg_co2e_per_unit, alternative_kg_co2e_per_unit,
      fuel_liters_per_unit, source, region, publication_year, assumptions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const f of factors) {
    insertFactor.run(
      f.id,
      f.code,
      f.category,
      f.label,
      f.unit,
      f.baseline,
      f.alternative,
      f.fuel,
      f.source,
      f.region,
      f.year,
      f.assumptions,
    );
  }

  // 3. Seed Verified Educational Resources
  const resources = [
    {
      id: 'edu-1',
      slug: 'understanding-aqi-scales',
      title: 'Understanding AQI: US EPA vs. India National AQI',
      category: 'Air Quality Basics',
      summary: 'Why AQI numbers differ between regional standards and how to interpret PM2.5 concentrations accurately.',
      content: 'Air Quality Index (AQI) translates pollutant concentrations into a 0–500 health communication scale. India NAQI evaluates 8 pollutants over 24-hour averages (with Severe at 401–500), whereas the US EPA AQI uses different PM2.5 breakpoints and NowCast weighting. Always check which standard is displayed before comparing cities.',
      org: 'US EPA & Central Pollution Control Board (CPCB)',
      url: 'https://www.airnow.gov/aqi/aqi-basics/',
      mins: 4,
    },
    {
      id: 'edu-2',
      slug: 'winter-smog-temperature-inversion',
      title: 'Why Winter Smog Spikes: Temperature Inversion Explained',
      category: 'Winter Smog',
      summary: 'How cold winter nights trap vehicle, heating, and dust emissions close to breathing height.',
      content: 'Normally, warm air near the ground rises and disperses pollutants upward. During winter nights and calm mornings, the ground cools rapidly, trapping a cold dense air layer beneath warmer air aloft—a temperature inversion. Low wind speeds prevent horizontal dispersion, causing PM2.5 and NO2 to accumulate until solar heating breaks the inversion midday.',
      org: 'World Health Organization (WHO)',
      url: 'https://www.who.int/health-topics/air-pollution',
      mins: 5,
    },
    {
      id: 'edu-3',
      slug: 'pm25-vs-pm10',
      title: 'PM2.5 vs PM10: Particle Size and Exposure Protection',
      category: 'Pollutants',
      summary: 'Understanding coarse road dust (PM10) versus fine combustion aerosols (PM2.5) and why masks differ.',
      content: 'PM10 includes inhalable particles 10 micrometers or smaller (dust, construction debris, pollen). PM2.5 are fine particles 2.5 micrometers or smaller—about 30x thinner than a human hair—originating from vehicle exhaust, biomass burning, and secondary chemical reactions. Standard cloth masks do not effectively filter PM2.5; properly fitted N95/FFP2 respirators are required for high-pollution outdoor travel.',
      org: 'World Health Organization (WHO)',
      url: 'https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health',
      mins: 4,
    },
    {
      id: 'edu-4',
      slug: 'indoor-air-ventilation-purifiers',
      title: 'Indoor Air Quality: Safe Ventilation Timing and HEPA Filtration',
      category: 'Indoor Air',
      summary: 'When to open windows, kitchen exhaust best practices, and avoiding ineffective or unsafe purifier myths.',
      content: 'Outdoor AQI does not equal indoor AQI. Cooking (especially frying and solid fuels), incense, candles, and dust resuspension can push indoor PM2.5 higher than outdoors. Use kitchen exhaust hoods or cross-ventilate ONLY during hours when local outdoor AQI forecasts dip. True HEPA (H13) purifiers capture ≥99.95% of 0.3-micron particles; avoid ionizers or ozone-generating devices that irritate airways, and note that potted houseplants alone cannot meaningfully filter PM2.5 in living spaces.',
      org: 'US EPA Indoor Air Quality Guide',
      url: 'https://www.epa.gov/indoor-air-quality-iaq',
      mins: 6,
    },
    {
      id: 'edu-5',
      slug: 'exposure-vs-emissions',
      title: 'Reducing Personal Exposure vs. Reducing Local & GHG Emissions',
      category: 'Environmental Impact',
      summary: 'Why switching to cycling helps emissions on clean days, but transit or remote work protects health during severe smog.',
      content: 'Choosing public metro, carpooling, or teleworking reduces tailpipe emissions and CO2e. However, exercising vigorously outdoors (such as cycling in heavy traffic during severe winter smog) increases inhalation rate and personal PM2.5 exposure. BreatheWise AI separates personal exposure protection from long-term emissions avoidance so families never trade health safety for carbon savings.',
      org: 'Health Effects Institute (HEI)',
      url: 'https://www.healtheffects.org/',
      mins: 5,
    },
  ];
  const insertEdu = db.prepare(`
    INSERT OR IGNORE INTO educational_resources (
      id, slug, title, category, summary, content, source_organization, source_url, reading_minutes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of resources) {
    insertEdu.run(r.id, r.slug, r.title, r.category, r.summary, r.content, r.org, r.url, r.mins, now);
  }

  // 4. Seed Communities & Challenges
  const communities = [
    { id: 'comm-delhi', city: 'New Delhi', region: 'Delhi NCR', country: 'India', desc: 'Neighbors sharing clean commute carpools, indoor air tips, and winter smog preparedness across NCR.' },
    { id: 'comm-ahmedabad', city: 'Ahmedabad', region: 'Gujarat', country: 'India', desc: 'Community initiatives for BRTS transit, no-idling school zones, and residential dust control.' },
    { id: 'comm-london', city: 'London', region: 'Greater London', country: 'United Kingdom', desc: 'Low-emission transit, wood-smoke reduction, and clean-air walking routes.' },
  ];
  const insertComm = db.prepare(`
    INSERT OR IGNORE INTO communities (id, city, region, country, description) VALUES (?, ?, ?, ?, ?)
  `);
  for (const cm of communities) {
    insertComm.run(cm.id, cm.city, cm.region, cm.country, cm.desc);
  }

  const challenges = [
    {
      id: 'chl-1',
      title: 'Public Transport Week',
      description: 'Replace solo car or two-wheeler commutes with Metro, rail, or city bus for 5 workdays.',
      city: 'New Delhi',
      unit: 'trips',
      target: 10,
      safety: 'Prefer enclosed metro/bus transit and wear an N95 mask on station walks when AQI exceeds 200.',
    },
    {
      id: 'chl-2',
      title: 'Zero Vehicle Idling Challenge',
      description: 'Switch off vehicle engines at red lights (>30s) and school/office pickup zones.',
      city: 'New Delhi',
      unit: 'minutes',
      target: 30,
      safety: 'Reduces curbside NO2 and fine particulate buildup right where pedestrians breathe.',
    },
    {
      id: 'chl-3',
      title: 'Avoid Open Waste Burning',
      description: 'Compost dry leaves or use municipal collection instead of backyard/street burning.',
      city: 'Ahmedabad',
      unit: 'kg_waste',
      target: 20,
      safety: 'Report active open burning to municipal civic helplines rather than confronting flames directly.',
    },
    {
      id: 'chl-4',
      title: 'Winter Energy Saver Household',
      description: 'Trim 15 kWh of peak electricity waste weekly through thermostat discipline and standby shutdown.',
      city: 'London',
      unit: 'kWh',
      target: 15,
      safety: 'Maintain safe indoor warmth (18–21°C) for elderly family members and infants.',
    },
  ];
  const insertChl = db.prepare(`
    INSERT OR IGNORE INTO challenges (id, title, description, city, target_unit, target_value, safety_note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const ch of challenges) {
    insertChl.run(ch.id, ch.title, ch.description, ch.city, ch.unit, ch.target, ch.safety);
  }

  // 5. Seed Achievements
  const achievements = [
    { id: 'ach-1', code: 'ECO_COMMUTER', title: 'Eco Commuter', desc: 'Avoided at least 10 km of solo vehicle travel using public transit or remote work.', metric: 'km', threshold: 10 },
    { id: 'ach-2', code: 'CLEAN_AIR_CHAMPION', title: 'Clean Air Champion', desc: 'Avoided at least 5 kg CO2e through verified daily routine adjustments.', metric: 'co2e', threshold: 5 },
    { id: 'ach-3', code: 'SUSTAINABLE_HOUSEHOLD', title: 'Sustainable Household', desc: 'Participated in a shared family household sustainability goal.', metric: 'household', threshold: 1 },
    { id: 'ach-4', code: 'ENERGY_SAVER', title: 'Energy Saver', desc: 'Saved at least 5 kWh of household grid electricity.', metric: 'kwh', threshold: 5 },
    { id: 'ach-5', code: 'CAR_FREE_CONTRIBUTOR', title: 'Car-Free Contributor', desc: 'Logged 3 or more sustainable low-emission commute actions.', metric: 'count', threshold: 3 },
  ];
  const insertAch = db.prepare(`
    INSERT OR IGNORE INTO achievements (id, code, title, description, criteria_metric, criteria_threshold)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const a of achievements) {
    insertAch.run(a.id, a.code, a.title, a.desc, a.metric, a.threshold);
  }

  // 6. Seed Evaluator Demo Mode Data (explicitly gated by DEMO_MODE)
  if (!envConfig.demoMode) {
    return;
  }

  const existingDemo = db.prepare('SELECT id FROM users WHERE email = ?').get('demo.family@breathewise.local');
  if (existingDemo) {
    return;
  }

  const demoPasswordHash = bcrypt.hashSync('DemoWise2026!', 10);
  const demoUsers = [
    { id: 'usr-demo-user', name: 'Aarav Patel', email: 'demo.user@breathewise.local', role: 'INDIVIDUAL_USER' },
    { id: 'usr-demo-family', name: 'Priya Sharma', email: 'demo.family@breathewise.local', role: 'FAMILY_ADMIN' },
    { id: 'usr-demo-member', name: 'Rohan Sharma', email: 'demo.member@breathewise.local', role: 'FAMILY_MEMBER' },
    { id: 'usr-demo-mod', name: 'Meera Nair', email: 'demo.moderator@breathewise.local', role: 'COMMUNITY_MODERATOR' },
    { id: 'usr-demo-admin', name: 'Vikram Singh', email: 'demo.admin@breathewise.local', role: 'SYSTEM_ADMIN' },
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, full_name, email, password_hash, role, email_verified, onboarding_completed,
      accepted_terms_at, is_demo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, 1, ?, 1, ?, ?)
  `);
  const insertProfile = db.prepare(`
    INSERT OR IGNORE INTO user_profiles (
      user_id, country, state_region, city, latitude, longitude, aqi_standard,
      work_mode, commute_distance_km, primary_transport, children_count, adults_count, elderly_count,
      has_sensitive_members, has_air_purifier, indoor_cooking_ventilation, preferred_language, updated_at
    ) VALUES (?, 'India', 'Delhi NCR', 'New Delhi', 28.6139, 77.2090, 'INDIA_NAQI', 'office', 14, 'car_petrol', 1, 2, 1, 1, 1, 'chimney_hood', 'en', ?)
  `);
  const insertNotifPref = db.prepare(`
    INSERT OR IGNORE INTO notification_preferences (user_id, aqi_threshold, timezone, updated_at)
    VALUES (?, 180, 'Asia/Kolkata', ?)
  `);

  for (const u of demoUsers) {
    insertUser.run(u.id, u.name, u.email, demoPasswordHash, u.role, now, now, now);
    insertProfile.run(u.id, now);
    insertNotifPref.run(u.id, now);
  }

  // Sample Household for Demo Family Admin + Member
  db.prepare(`
    INSERT OR IGNORE INTO households (id, name, city, shared_goal, created_by_user_id, created_at, updated_at)
    VALUES ('hh-demo-sharma', 'Sharma Family Household', 'New Delhi', 'Shift 60% of winter commutes to Delhi Metro and keep indoor cooking ventilated', 'usr-demo-family', ?, ?)
  `).run(now, now);

  db.prepare(`
    INSERT OR IGNORE INTO household_members (id, household_id, user_id, household_role, joined_at)
    VALUES ('hhm-1', 'hh-demo-sharma', 'usr-demo-family', 'FAMILY_ADMIN', ?),
           ('hhm-2', 'hh-demo-sharma', 'usr-demo-member', 'FAMILY_MEMBER', ?)
  `).run(now, now);

  // Sample Activity Logs for the last 5 days
  const today = new Date();
  const sampleActivities = [
    { id: 'act-demo-1', uid: 'usr-demo-family', hh: 'hh-demo-sharma', code: 'COMMUTE_CAR_TO_METRO', title: 'Morning & evening commute via Delhi Metro', qty: 14, unit: 'km', co2: 1.904, fuel: 1.05, km: 14, kwh: 0, daysAgo: 0 },
    { id: 'act-demo-2', uid: 'usr-demo-family', hh: 'hh-demo-sharma', code: 'AVOID_VEHICLE_IDLING', title: 'Engine off during school pickup wait', qty: 12, unit: 'minutes', co2: 0.42, fuel: 0.18, km: 0, kwh: 0, daysAgo: 1 },
    { id: 'act-demo-3', uid: 'usr-demo-member', hh: 'hh-demo-sharma', code: 'COMMUTE_CAR_TO_WFH', title: 'Remote workday during severe smog advisory', qty: 18, unit: 'km', co2: 2.808, fuel: 1.35, km: 18, kwh: 0, daysAgo: 2 },
    { id: 'act-demo-4', uid: 'usr-demo-family', hh: 'hh-demo-sharma', code: 'ELECTRICITY_SAVED', title: 'Off-peak appliance scheduling & LED lighting', qty: 6, unit: 'kWh', co2: 4.296, fuel: 0, km: 0, kwh: 6, daysAgo: 3 },
  ];

  const insertAct = db.prepare(`
    INSERT OR IGNORE INTO activity_logs (
      id, user_id, household_id, factor_code, activity_title, quantity, unit,
      co2e_avoided_kg, fuel_saved_liters, vehicle_km_avoided, energy_saved_kwh,
      dedup_key, notes, activity_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Demo seeded record', ?, ?)
  `);
  for (const a of sampleActivities) {
    const d = new Date(today);
    d.setDate(d.getDate() - a.daysAgo);
    const dateStr = d.toISOString().slice(0, 10);
    insertAct.run(a.id, a.uid, a.hh, a.code, a.title, a.qty, a.unit, a.co2, a.fuel, a.km, a.kwh, `seed:${a.id}`, dateStr, now);
  }

  // Sample Community Posts
  db.prepare(`
    INSERT OR IGNORE INTO community_posts (id, community_id, city, user_id, author_name, title, content, category, is_verified, created_at)
    VALUES
      ('post-demo-1', 'comm-delhi', 'New Delhi', 'usr-demo-mod', 'Meera Nair', 'Metro Feeder Carpool Coordination — South Delhi', 'Sharing an updated morning schedule for residents commuting toward Connaught Place to avoid solo vehicle trips during winter inversion hours.', 'initiative', 1, ?),
      ('post-demo-2', 'comm-delhi', 'New Delhi', 'usr-demo-user', 'Aarav Patel', 'Visible construction dust near Ring Road junction', 'Heavy dry dust plume reported near sector crossing this morning; commuters advised to keep car recirculation on or use masks.', 'unverified_report', 0, ?)
  `).run(now, now);

  // Sample Notifications
  db.prepare(`
    INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, severity, dedup_key, is_read, created_at)
    VALUES
      ('notif-demo-1', 'usr-demo-family', 'SMOG_ALERT', 'Winter Inversion Advisory', 'Calm wind conditions in New Delhi may elevate morning PM2.5. Consider shifting outdoor exercise indoors.', 'warning', 'demo-notif-1', 0, ?),
      ('notif-demo-2', 'usr-demo-family', 'PURIFIER_REMINDER', 'HEPA Pre-Filter Check', 'Check and vacuum your living room HEPA pre-filter this week to keep airflow efficiency steady.', 'info', 'demo-notif-2', 0, ?)
  `).run(now, now);

  // Sample Audit Log
  db.prepare(`
    INSERT OR IGNORE INTO audit_logs (id, actor_user_id, action, target_type, target_id, details, created_at)
    VALUES ('aud-seed-1', 'usr-demo-admin', 'SYSTEM_SEED', 'database', 'breathewise', 'Initialized Demo Mode accounts and reference datasets', ?)
  `).run(now);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
