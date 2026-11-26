import type { EnvironmentalSnapshot, UserProfile } from '../../../types/domain';
import { findBestForecastWindow } from '../ai/aiService';

export interface IndoorActionItem {
  id: string;
  room: 'Bedroom' | 'Living Room' | 'Kitchen' | 'Study Room' | 'Office' | 'All Spaces';
  costTier: 'No-cost' | 'Low-cost' | 'Moderate-cost' | 'Equipment-based';
  title: string;
  action: string;
  whyItHelps: string;
}

export function getIndoorGuidance(snapshot: EnvironmentalSnapshot, profile: Partial<UserProfile>) {
  const isAdvisoryOnly = !profile.hasIndoorSensor;
  const bestVentWindow = findBestForecastWindow(snapshot);
  const highOutdoorPollution =
    snapshot.aqi.level === 'unhealthy' ||
    snapshot.aqi.level === 'very_unhealthy' ||
    snapshot.aqi.level === 'severe';

  const items: IndoorActionItem[] = [
    {
      id: 'iaq-1',
      room: 'Kitchen',
      costTier: 'No-cost',
      title: 'Ventilate Actively During Every Cooking Session',
      action: 'Turn on your exhaust fan/chimney 5 minutes before heating oil and leave it running 15 minutes after cooking; cover pots with lids.',
      whyItHelps: 'Gas burners and high-heat frying produce concentrated indoor PM2.5 and NO2.',
    },
    {
      id: 'iaq-2',
      room: 'Living Room',
      costTier: 'No-cost',
      title: 'Time Window Opening to Forecast Dips',
      action: highOutdoorPollution
        ? `Keep exterior windows closed during peak smog; monitor ${bestVentWindow} for brief air exchange only if AQI drops.`
        : `Cross-ventilate opposite windows for 15 minutes around ${bestVentWindow}.`,
      whyItHelps: 'Prevents peak traffic and winter inversion smog from entering while flushing indoor CO2.',
    },
    {
      id: 'iaq-3',
      room: 'Bedroom',
      costTier: 'No-cost',
      title: 'Eliminate Indoor Combustion Sources',
      action: 'Avoid burning incense sticks, mosquito coils, scented candles, or tobacco indoors during winter smog days.',
      whyItHelps: 'Indoor smoke accumulates rapidly in closed winter bedrooms and adds directly to fine particulates.',
    },
    {
      id: 'iaq-4',
      room: 'All Spaces',
      costTier: 'Low-cost',
      title: 'Damp Microfiber Dusting & Wet Mopping',
      action: 'Replace dry sweeping and feather dusters with damp microfiber wiping and wet mopping every 1–2 days.',
      whyItHelps: 'Dry sweeping resuspends settled fine dust back into breathing height.',
    },
    {
      id: 'iaq-5',
      room: 'Study Room',
      costTier: 'Low-cost',
      title: 'Door Draft Stoppers & Window Weatherstripping',
      action: 'Install foam weatherstripping tape on leaky window frames and a fabric draft stopper at the main entry door.',
      whyItHelps: 'Reduces uncontrolled outdoor smog infiltration through gaps during windy or high-AQI nights.',
    },
    {
      id: 'iaq-6',
      room: 'Office',
      costTier: 'Moderate-cost',
      title: 'Portable True HEPA (H13) Desk/Room Filtration',
      action: 'Use a certified True HEPA (non-ionizing, ozone-free) purifier sized to your room CADR and vacuum the pre-filter every 2 weeks.',
      whyItHelps: 'Captures ≥99.95% of 0.3µm particles without producing harmful ozone.',
    },
    {
      id: 'iaq-7',
      room: 'Kitchen',
      costTier: 'Equipment-based',
      title: 'Electric Induction Cooking & Ducted Chimney',
      action: 'Shift high-frequency boiling/simmering to an electric kettle or induction cooktop under a vented hood.',
      whyItHelps: 'Eliminates indoor gas combustion byproducts (NO2 and CO).',
    },
    {
      id: 'iaq-8',
      room: 'Bedroom',
      costTier: 'Equipment-based',
      title: 'Dedicated Indoor PM2.5 + CO2 Monitor',
      action: 'Place a calibrated optical PM2.5 sensor away from humidifiers to verify actual indoor air quality rather than guessing from outdoor AQI.',
      whyItHelps: 'Outdoor AQI does not measure indoor air; sensors clarify when ventilation vs filtration is needed.',
    },
  ];

  return {
    isAdvisoryOnly,
    advisoryNotice: isAdvisoryOnly
      ? 'Advisory guidance only: no indoor air quality sensor is registered on your profile. Outdoor AQI is never presented as measured indoor AQI.'
      : 'Sensor-assisted household profile enabled. Combine your indoor monitor readings with these room actions.',
    bestVentilationWindow: bestVentWindow,
    scienceMythsToAvoid: [
      'Avoid ozone-generating "air purifiers" or uncertified ionizers, which can irritate lungs and create secondary pollutants.',
      'Potted houseplants add greenery and calm, but controlled studies show they do not remove PM2.5 fast enough to replace ventilation or HEPA filtration.',
      'Ultrasonic cool-mist humidifiers using tap water can aerosolize minerals that read as false PM2.5 spikes; use distilled water if humidifying.',
    ],
    checklist: items,
  };
}
