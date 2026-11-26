import React, { useState } from 'react';
import { MapPin, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AqiStandard, SupportedLanguage, UserProfile } from '../types/domain';

interface OnboardingPageProps {
  onComplete: () => void;
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const { apiFetch, profile, setProfileLocal, updateUserLocal } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<Omit<UserProfile, 'userId'>>({
    country: profile?.country ?? 'India',
    stateRegion: profile?.stateRegion ?? 'Delhi NCR',
    city: profile?.city ?? 'New Delhi',
    postalCode: profile?.postalCode ?? '',
    latitude: profile?.latitude ?? 28.6139,
    longitude: profile?.longitude ?? 77.209,
    aqiStandard: profile?.aqiStandard ?? 'INDIA_NAQI',
    workMode: profile?.workMode ?? 'office',
    commuteDistanceKm: profile?.commuteDistanceKm ?? 12,
    primaryTransport: profile?.primaryTransport ?? 'car_petrol',
    outdoorActivity: profile?.outdoorActivity ?? 'Morning walk',
    exercisePreference: profile?.exercisePreference ?? 'Brisk walking',
    cookingFuel: profile?.cookingFuel ?? 'lpg_piped_gas',
    householdSize: profile?.householdSize ?? 3,
    publicTransitAvailable: profile?.publicTransitAvailable ?? true,
    childrenCount: profile?.childrenCount ?? 1,
    adultsCount: profile?.adultsCount ?? 2,
    elderlyCount: profile?.elderlyCount ?? 0,
    hasSensitiveMembers: profile?.hasSensitiveMembers ?? false,
    hasAirPurifier: profile?.hasAirPurifier ?? false,
    ventilationType: profile?.ventilationType ?? 'natural_windows',
    hasBalconyWindows: profile?.hasBalconyWindows ?? true,
    indoorCookingVentilation: profile?.indoorCookingVentilation ?? 'exhaust_fan',
    hasIndoorSensor: profile?.hasIndoorSensor ?? false,
    preferredLanguage: profile?.preferredLanguage ?? 'en',
    sustainabilityGoal: profile?.sustainabilityGoal ?? 'Shift 50% of commutes to metro and cut indoor energy waste',
    dailyScheduleSummary: profile?.dailyScheduleSummary ?? '07:00 wake, 09:00-18:00 work, 20:00 dinner',
    budgetLevel: profile?.budgetLevel ?? 'low_cost',
    consentWithdrawn: false,
  });

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setError('Browser geolocation is unavailable; please enter your city manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
        }));
        setError('');
      },
      () => {
        setError('Location permission denied. You can continue with manual city entry.');
      },
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch<{ profile: UserProfile }>('/api/v1/profile', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setProfileLocal(res.profile);
      updateUserLocal({ onboardingCompleted: true });
      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-2">
        <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Step {step} of 5 · Personalization Setup
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Tailor BreatheWise AI to Your Household
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We only collect practical lifestyle context needed for safer routines. Optional questions may be skipped, and you can withdraw consent anytime.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Location &amp; Regional AQI Standard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ob-country" className="block text-xs font-medium mb-1">Country</label>
                <input
                  id="ob-country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="ob-state" className="block text-xs font-medium mb-1">State / Region</label>
                <input
                  id="ob-state"
                  value={form.stateRegion}
                  onChange={(e) => setForm({ ...form, stateRegion: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="ob-city" className="block text-xs font-medium mb-1">City</label>
                <input
                  id="ob-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="ob-std" className="block text-xs font-medium mb-1">Preferred AQI Scale</label>
                <select
                  id="ob-std"
                  value={form.aqiStandard}
                  onChange={(e) => setForm({ ...form, aqiStandard: e.target.value as AqiStandard })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="INDIA_NAQI">India National AQI (CPCB)</option>
                  <option value="US_EPA">US EPA AQI</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGeolocate}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Detect Coordinates (Optional)
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Lifestyle &amp; Commute</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ob-work" className="block text-xs font-medium mb-1">Primary Daily Context</label>
                <select
                  id="ob-work"
                  value={form.workMode}
                  onChange={(e) => setForm({ ...form, workMode: e.target.value as UserProfile['workMode'] })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="office">Office Commuter</option>
                  <option value="wfh">Work From Home</option>
                  <option value="school">School</option>
                  <option value="college">College / University</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="ob-km" className="block text-xs font-medium mb-1">One-Way Commute Distance (km)</label>
                <input
                  id="ob-km"
                  type="number"
                  min={0}
                  max={250}
                  value={form.commuteDistanceKm}
                  onChange={(e) => setForm({ ...form, commuteDistanceKm: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="ob-trans" className="block text-xs font-medium mb-1">Primary Transportation</label>
                <select
                  id="ob-trans"
                  value={form.primaryTransport}
                  onChange={(e) => setForm({ ...form, primaryTransport: e.target.value as UserProfile['primaryTransport'] })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="car_petrol">Petrol Car</option>
                  <option value="car_diesel">Diesel Car</option>
                  <option value="two_wheeler">Two-Wheeler / Scooter</option>
                  <option value="public_transit">Metro / Public Bus</option>
                  <option value="car_ev">Electric Vehicle</option>
                  <option value="bicycle">Bicycle</option>
                  <option value="walk">Walking</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label htmlFor="ob-cook" className="block text-xs font-medium mb-1">Cooking Fuel / Method</label>
                <select
                  id="ob-cook"
                  value={form.cookingFuel}
                  onChange={(e) => setForm({ ...form, cookingFuel: e.target.value as UserProfile['cookingFuel'] })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="lpg_piped_gas">LPG / Piped Natural Gas</option>
                  <option value="induction_electric">Induction / Electric</option>
                  <option value="solid_fuel_biomass">Solid Fuel / Biomass</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.publicTransitAvailable}
                onChange={(e) => setForm({ ...form, publicTransitAvailable: e.target.checked })}
              />
              Public transportation (metro/bus) is accessible in my neighborhood
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Household Composition</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No medical diagnoses or sensitive health records are collected. Counts help tailor general protective advice for children or older adults.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="ob-children" className="block text-xs font-medium mb-1">Children</label>
                <input
                  id="ob-children"
                  type="number"
                  min={0}
                  max={12}
                  value={form.childrenCount}
                  onChange={(e) => setForm({ ...form, childrenCount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="ob-adults" className="block text-xs font-medium mb-1">Adults</label>
                <input
                  id="ob-adults"
                  type="number"
                  min={0}
                  max={12}
                  value={form.adultsCount}
                  onChange={(e) => setForm({ ...form, adultsCount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="ob-elderly" className="block text-xs font-medium mb-1">Elderly (65+)</label>
                <input
                  id="ob-elderly"
                  type="number"
                  min={0}
                  max={12}
                  value={form.elderlyCount}
                  onChange={(e) => setForm({ ...form, elderlyCount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.hasSensitiveMembers}
                onChange={(e) => setForm({ ...form, hasSensitiveMembers: e.target.checked })}
              />
              Household includes individuals sensitive to elevated air pollution (optional)
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Indoor Environment</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ob-vent" className="block text-xs font-medium mb-1">Home Ventilation Type</label>
                <select
                  id="ob-vent"
                  value={form.ventilationType}
                  onChange={(e) => setForm({ ...form, ventilationType: e.target.value as UserProfile['ventilationType'] })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="natural_windows">Natural Cross-Ventilation Windows</option>
                  <option value="exhaust_fans">Window + Exhaust Fans</option>
                  <option value="mechanical_hvac">Mechanical HVAC / Filtered Air</option>
                  <option value="limited">Limited / Single-Side Windows</option>
                </select>
              </div>
              <div>
                <label htmlFor="ob-kvent" className="block text-xs font-medium mb-1">Kitchen Exhaust</label>
                <select
                  id="ob-kvent"
                  value={form.indoorCookingVentilation}
                  onChange={(e) =>
                    setForm({ ...form, indoorCookingVentilation: e.target.value as UserProfile['indoorCookingVentilation'] })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="chimney_hood">Ducted Chimney Hood</option>
                  <option value="exhaust_fan">Wall Exhaust Fan</option>
                  <option value="open_window">Open Kitchen Window</option>
                  <option value="none">No Dedicated Ventilation</option>
                </select>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.hasAirPurifier}
                  onChange={(e) => setForm({ ...form, hasAirPurifier: e.target.checked })}
                />
                We have a HEPA air purifier at home
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.hasIndoorSensor}
                  onChange={(e) => setForm({ ...form, hasIndoorSensor: e.target.checked })}
                />
                We have an indoor PM2.5 / air quality sensor
              </label>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Preferences &amp; Sustainability Goal</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ob-lang" className="block text-xs font-medium mb-1">Preferred Language</label>
                <select
                  id="ob-lang"
                  value={form.preferredLanguage}
                  onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value as SupportedLanguage })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="gu">Gujarati (ગુજરાતી)</option>
                </select>
              </div>
              <div>
                <label htmlFor="ob-budget" className="block text-xs font-medium mb-1">Budget Preference</label>
                <select
                  id="ob-budget"
                  value={form.budgetLevel}
                  onChange={(e) => setForm({ ...form, budgetLevel: e.target.value as UserProfile['budgetLevel'] })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="no_cost">No-cost behavioral changes first</option>
                  <option value="low_cost">Low-cost practical upgrades</option>
                  <option value="moderate">Moderate budget</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="ob-goal" className="block text-xs font-medium mb-1">Primary Sustainability Goal</label>
              <input
                id="ob-goal"
                value={form.sustainabilityGoal}
                onChange={(e) => setForm({ ...form, sustainabilityGoal: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700"
              >
                Previous
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              Skip optional &amp; Finish
            </button>
          </div>
          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
