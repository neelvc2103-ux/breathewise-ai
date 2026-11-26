import type { EnvironmentalSnapshot, UserProfile } from '../../../types/domain';

export interface SustainableAlternativeCard {
  id: string;
  currentActivity: string;
  suggestedAlternative: string;
  estimatedEnvironmentalBenefit: string;
  financialConsideration: string;
  convenienceLevel: 'High' | 'Moderate' | 'Low';
  requiredEffort: 'Low' | 'Medium' | 'High';
  exposureSafetyWarning?: string;
  explanation: string;
  factorCode: string;
}

export function getPersonalizedAlternatives(
  snapshot: EnvironmentalSnapshot,
  profile: Partial<UserProfile>,
): SustainableAlternativeCard[] {
  const highSmog =
    snapshot.aqi.level === 'unhealthy' ||
    snapshot.aqi.level === 'very_unhealthy' ||
    snapshot.aqi.level === 'severe';
  const commuteKm = profile.commuteDistanceKm ?? 12;
  const metroCo2 = (commuteKm * 0.136).toFixed(2);
  const busCo2 = (commuteKm * 0.089).toFixed(2);

  return [
    {
      id: 'alt-1',
      currentActivity: `Solo car / two-wheeler commute (${commuteKm} km)`,
      suggestedAlternative: highSmog
        ? 'Enclosed Metro Rail or Remote Workday'
        : profile.publicTransitAvailable !== false
          ? 'Public Metro / Bus Transit or Shared Carpool'
          : 'Carpooling with 2 neighbors/colleagues',
      estimatedEnvironmentalBenefit: `Avoids ~${metroCo2} kg CO2e per one-way trip via metro (or ~${busCo2} kg via bus) and reduces urban NO2 tailpipe exhaust.`,
      financialConsideration: 'Typically saves ₹120–₹250 / $3–$6 per day in fuel and parking.',
      convenienceLevel: profile.publicTransitAvailable !== false ? 'High' : 'Moderate',
      requiredEffort: 'Low',
      exposureSafetyWarning: highSmog
        ? 'Exposure guardrail active: Outdoor cycling is NOT recommended today due to elevated smog. Choose enclosed metro or telework instead.'
        : undefined,
      explanation:
        'Shifting personal car trips to high-occupancy transit cuts both greenhouse gases and local curbside pollution while keeping riders inside filtered or enclosed cabins during winter smog.',
      factorCode: 'COMMUTE_CAR_TO_METRO',
    },
    {
      id: 'alt-2',
      currentActivity: 'Keeping engine idling during school/market pickups or red lights',
      suggestedAlternative: 'Turn off ignition whenever stopped for more than 30 seconds',
      estimatedEnvironmentalBenefit: 'Avoids ~0.035 kg CO2e and ~0.015 L petrol per minute of avoided idling.',
      financialConsideration: 'Free — immediately saves fuel.',
      convenienceLevel: 'High',
      requiredEffort: 'Low',
      explanation:
        'Idling vehicles emit concentrated NO2, CO, and particulates right at child breathing height outside schools and residential gates.',
      factorCode: 'AVOID_VEHICLE_IDLING',
    },
    {
      id: 'alt-3',
      currentActivity: 'Multiple single-item express online deliveries',
      suggestedAlternative: 'Consolidate household essentials into one weekly scheduled delivery',
      estimatedEnvironmentalBenefit: 'Avoids ~0.30 kg CO2e per consolidated delivery trip.',
      financialConsideration: 'Free (often avoids express delivery surcharges).',
      convenienceLevel: 'High',
      requiredEffort: 'Low',
      explanation:
        'Batching orders cuts two-wheeler and van last-mile trips across neighborhood streets.',
      factorCode: 'CONSOLIDATE_DELIVERY',
    },
    {
      id: 'alt-4',
      currentActivity: 'Peak-hour standby appliances & space heater overheating',
      suggestedAlternative: 'Seal window drafts, set heating to 19–20°C, and switch off standby power strips',
      estimatedEnvironmentalBenefit: 'Avoids ~0.716 kg CO2e per kWh saved (India CEA grid average).',
      financialConsideration: 'Lowers monthly electricity bills by 10–18%.',
      convenienceLevel: 'High',
      requiredEffort: 'Low',
      explanation:
        'Reducing electricity demand lowers thermal power plant emissions without sacrificing indoor comfort.',
      factorCode: 'ELECTRICITY_SAVED',
    },
    {
      id: 'alt-5',
      currentActivity: 'Burning dry garden leaves or household trash outdoors',
      suggestedAlternative: 'Compost dry leaves or send sorted waste to municipal collection',
      estimatedEnvironmentalBenefit: 'Avoids ~1.37 kg CO2e/kg waste plus severe localized black carbon and PM2.5 smoke.',
      financialConsideration: 'Free or low-cost home compost bin.',
      convenienceLevel: 'Moderate',
      requiredEffort: 'Medium',
      explanation:
        'Open burning creates immediate toxic smoke plumes during calm winter nights; composting prevents local smog spikes.',
      factorCode: 'AVOID_OPEN_BURNING',
    },
  ];
}
