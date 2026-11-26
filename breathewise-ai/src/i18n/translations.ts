import type { SupportedLanguage } from '../types/domain';

export const TRANSLATIONS: Record<
  SupportedLanguage,
  {
    tagline: string;
    heroHeadline: string;
    heroSubhead: string;
    navDashboard: string;
    navAssistant: string;
    navRoutine: string;
    navIndoor: string;
    navImpact: string;
    navFamily: string;
    navCommunity: string;
    navLearn: string;
    navAdmin: string;
    navSettings: string;
    currentAqi: string;
    pollutantBreakdown: string;
    weatherConditions: string;
    askAssistant: string;
    generateRoutine: string;
    logActivity: string;
    medicalDisclaimer: string;
  }
> = {
  en: {
    tagline: 'Breathe Better. Live Smarter. Together.',
    heroHeadline: 'Navigate winter smog with data-grounded daily guidance.',
    heroSubhead:
      'Understand local air pollution, protect your household from peak PM2.5 exposure, adopt practical low-emission habits, and measure your real environmental impact.',
    navDashboard: 'Dashboard',
    navAssistant: 'AI Assistant',
    navRoutine: 'Routine Planner',
    navIndoor: 'Indoor Air',
    navImpact: 'Impact & Swaps',
    navFamily: 'Family',
    navCommunity: 'Community',
    navLearn: 'Learn',
    navAdmin: 'Admin',
    navSettings: 'Settings',
    currentAqi: 'Current Air Quality',
    pollutantBreakdown: 'Pollutant Concentrations',
    weatherConditions: 'Local Weather & Dispersion',
    askAssistant: 'Ask BreatheWise AI',
    generateRoutine: 'Generate Adaptive Routine',
    logActivity: 'Log Sustainable Activity',
    medicalDisclaimer:
      'General environmental guidance only — not medical advice. Consult a qualified clinician for medical conditions.',
  },
  hi: {
    tagline: 'बेहतर सांस लें। समझदारी से जिएं। साथ मिलकर।',
    heroHeadline: 'सटीक डेटा और दैनिक मार्गदर्शन के साथ सर्दियों के स्मॉग से सुरक्षित रहें।',
    heroSubhead:
      'स्थानीय वायु प्रदूषण को समझें, अपने परिवार को PM2.5 के उच्च स्तर से बचाएं, कम-उत्सर्जन वाली आदतें अपनाएं और अपना वास्तविक पर्यावरणीय प्रभाव मापें।',
    navDashboard: 'डैशबोर्ड',
    navAssistant: 'एआई सहायक',
    navRoutine: 'दैनिक दिनचर्या',
    navIndoor: 'घर के अंदर की हवा',
    navImpact: 'प्रभाव और विकल्प',
    navFamily: 'परिवार',
    navCommunity: 'समुदाय',
    navLearn: 'जानकारी केंद्र',
    navAdmin: 'प्रशासन',
    navSettings: 'सेटिंग्स',
    currentAqi: 'वर्तमान वायु गुणवत्ता',
    pollutantBreakdown: 'प्रदूषक स्तर',
    weatherConditions: 'मौसम और हवा का फैलाव',
    askAssistant: 'BreatheWise AI से पूछें',
    generateRoutine: 'अनुकूल दिनचर्या बनाएं',
    logActivity: 'सकारात्मक गतिविधि दर्ज करें',
    medicalDisclaimer:
      'यह केवल सामान्य पर्यावरणीय मार्गदर्शन है — चिकित्सा सलाह नहीं। स्वास्थ्य समस्याओं के लिए डॉक्टर से परामर्श लें।',
  },
  gu: {
    tagline: 'વધુ સારો શ્વાસ લો. સમજદારીથી જીવો. સાથે મળીને.',
    heroHeadline: 'સચોટ ડેટા અને દૈનિક માર્ગદર્શન સાથે શિયાળાના ધુમ્મસ અને પ્રદૂષણથી સુરક્ષિત રહો.',
    heroSubhead:
      'સ્થાનિક હવાની ગુણવત્તા સમજો, પરિવારને PM2.5 થી બચાવો, ઓછા ઉત્સર્જનની આદતો અપનાવો અને તમારી પર્યાવરણીય અસર માપો.',
    navDashboard: 'ડેશબોર્ડ',
    navAssistant: 'AI સહાયક',
    navRoutine: 'દૈનિક રૂટિન',
    navIndoor: 'ઘરની અંદરની હવા',
    navImpact: 'અસર અને વિકલ્પો',
    navFamily: 'પરિવાર',
    navCommunity: 'સમુદાય',
    navLearn: 'માહિતી કેન્દ્ર',
    navAdmin: 'એડમિન',
    navSettings: 'સેટિંગ્સ',
    currentAqi: 'વર્તમાન હવાની ગુણવત્તા',
    pollutantBreakdown: 'પ્રદૂષકોનું પ્રમાણ',
    weatherConditions: 'સ્થાનિક હવામાન',
    askAssistant: 'BreatheWise AI ને પૂછો',
    generateRoutine: 'અનુકૂળ રૂટિન બનાવો',
    logActivity: 'પ્રવૃત્તિ નોંધો',
    medicalDisclaimer:
      'આ માત્ર સામાન્ય પર્યાવરણીય માર્ગદર્શન છે — તબીબી સલાહ નથી. તબીબી પરિસ્થિતિઓ માટે ડૉક્ટરની સલાહ લો.',
  },
};
