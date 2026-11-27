import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, MessageSquare, RefreshCw, Search, Wind } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AqiStandard, DemoScenario, EnvironmentalSnapshot, ImpactSummary } from '../types/domain';
import { AqiStatusDisplay } from '../components/ui/AqiBadge';
import { HourlyForecastChart, PollutantBreakdownChart } from '../components/charts/EnvironmentalCharts';
import { AirQualityMap } from '../components/maps/AirQualityMap';
import { PlacesGroundingPanel } from '../components/maps/PlacesGroundingPanel';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const {
    apiFetch,
    profile,
    selectedLocation,
    setSelectedLocation,
    demoScenario,
    setDemoScenario,
    t,
  } = useAuth();

  const [snapshot, setSnapshot] = useState<EnvironmentalSnapshot | null>(null);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<
    Array<{ name: string; city: string; region: string; country: string; latitude: number; longitude: number; defaultStandard: AqiStandard }>
  >([]);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const aqUrl =
        `/api/v1/air-quality?city=${encodeURIComponent(selectedLocation.city)}` +
        `&region=${encodeURIComponent(selectedLocation.region)}` +
        `&country=${encodeURIComponent(selectedLocation.country)}` +
        `&lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}` +
        `&standard=${selectedLocation.standard}&demoScenario=${demoScenario}`;

      const [aqData, impData] = await Promise.all([
        apiFetch<{ snapshot: EnvironmentalSnapshot }>(aqUrl),
        apiFetch<{ summary: ImpactSummary }>('/api/v1/impact/summary'),
      ]);
      setSnapshot(aqData.snapshot);
      setImpact(impData.summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, selectedLocation, demoScenario]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{ locations: typeof cityResults }>(
      `/api/v1/locations/search?q=${encodeURIComponent(cityQuery)}`,
    );
    setCityResults(res.locations);
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar: Location Search, Scale Switcher, Demo Scenario Control */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {t.currentAqi} — {selectedLocation.city}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {selectedLocation.region ? `${selectedLocation.region}, ` : ''}{selectedLocation.country} · Coordinates {selectedLocation.latitude.toFixed(2)}, {selectedLocation.longitude.toFixed(2)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleCitySearch} className="flex items-center gap-2">
            <label htmlFor="dash-city" className="sr-only">Search city</label>
            <input
              id="dash-city"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Switch city..."
              className="w-40 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" /> Find
            </button>
          </form>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedLocation({ ...selectedLocation, standard: 'INDIA_NAQI' })}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                selectedLocation.standard === 'INDIA_NAQI'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              India NAQI
            </button>
            <button
              type="button"
              onClick={() => setSelectedLocation({ ...selectedLocation, standard: 'US_EPA' })}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                selectedLocation.standard === 'US_EPA'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              US EPA AQI
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span>Scenario</span>
            <select
              aria-label="Environmental data scenario"
              value={demoScenario}
              onChange={(e) => setDemoScenario(e.target.value as DemoScenario)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              <option value="live">Live API</option>
              <option value="severe_smog">Demo: Severe Winter Smog</option>
              <option value="moderate_pollution">Demo: Moderate Pollution</option>
              <option value="improved_air">Demo: Improved Air Quality</option>
              <option value="api_failure">Demo: Simulated API Outage</option>
              <option value="ai_failure">Demo: Simulated AI Outage</option>
            </select>
          </label>

          <button
            type="button"
            onClick={fetchDashboardData}
            aria-label="Refresh air quality data"
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {cityResults.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cityResults.map((c) => (
            <button
              key={`${c.city}-${c.latitude}`}
              type="button"
              onClick={() => {
                setSelectedLocation({
                  city: c.city,
                  region: c.region,
                  country: c.country,
                  latitude: c.latitude,
                  longitude: c.longitude,
                  standard: c.defaultStandard,
                });
                setCityResults([]);
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-600"
            >
              {c.city}, {c.country}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 h-60 rounded-xl bg-slate-200 dark:bg-slate-800/40 animate-pulse" />
          <div className="lg:col-span-7 h-60 rounded-xl bg-slate-200 dark:bg-slate-800/40 animate-pulse" />
        </div>
      ) : error ? (
        <div role="alert" className="p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-900 dark:text-red-200">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Environmental Data Unavailable
          </div>
          <p className="text-xs text-red-800 dark:text-red-300">{error}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Tip: Switch Scenario back to Live API or select a Demo scenario to continue evaluating.
          </p>
        </div>
      ) : snapshot ? (
        <>
          {/* Stale / Demo Notice */}
          {(snapshot.isStale || snapshot.isDemo) && (
            <div
              role="status"
              className="px-4 py-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-4"
            >
              <span>
                {snapshot.isStale
                  ? `Stale Cached Data: ${snapshot.staleReason} Last observed ${new Date(snapshot.observedAt).toLocaleString()}.`
                  : `Demonstration Data Active (${snapshot.dataSource}) — not live sensor readings.`}
              </span>
              {snapshot.isDemo && (
                <button
                  type="button"
                  onClick={() => setDemoScenario('live')}
                  className="font-semibold underline whitespace-nowrap shrink-0"
                >
                  Return to Live API
                </button>
              )}
            </div>
          )}

          {/* Primary AQI & Weather Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{snapshot.isCached && !snapshot.isStale ? 'Cached (<15m)' : snapshot.isDemo ? 'Demo Scenario' : 'Live Reading'}</span>
                <span className="font-mono">
                  {new Date(snapshot.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <AqiStatusDisplay meta={snapshot.aqi} />

              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {snapshot.aqi.plainLanguageSummary}
              </p>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Temperature / Humidity</div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {snapshot.weather.temperatureC ?? '--'}°C · {snapshot.weather.humidityPct ?? '--'}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Wind &amp; Dispersion</div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {snapshot.weather.windSpeedKmh ?? '--'} km/h · {snapshot.weather.isInversionLikely ? 'Inversion Risk' : 'Dispersing'}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                Source: {snapshot.dataSource}
              </div>
            </section>

            <section className="lg:col-span-7 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {t.pollutantBreakdown}
              </h2>
              <PollutantBreakdownChart pollutants={snapshot.pollutants} />
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">Outdoor Activity Guidance</div>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">{snapshot.aqi.outdoorGuidance}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">Household &amp; Sensitive Groups</div>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    {snapshot.aqi.sensitiveGroupGuidance}
                    {profile?.hasSensitiveMembers ? ' (Priority for your household)' : ''}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Forecast Chart & Action Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Air Quality Trajectory &amp; Ventilation Forecast
              </h2>
              <HourlyForecastChart data={snapshot.hourlyForecast} standard={snapshot.standard} />
            </section>

            <section className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Personal Impact &amp; Next Actions
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Weekly CO2e Avoided</div>
                    <div className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                      {impact?.weeklyCo2eAvoidedKg ?? 0} kg
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Vehicle km Avoided</div>
                    <div className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                      {impact?.totalVehicleKmAvoided ?? 0} km
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {impact?.scientificNote}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('assistant')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" /> {t.askAssistant}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('routine')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Wind className="w-3.5 h-3.5" aria-hidden="true" /> Open Routine Planner
                </button>
              </div>
            </section>
          </div>

          {/* Interactive Google Map & Grounded Places Lookup */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Local Air Quality Map
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {snapshot.location.city}
                </span>
              </div>
              <AirQualityMap
                snapshot={snapshot}
                userCoords={userCoords}
                heightClassName="h-72 sm:h-80"
              />
            </section>

            <section className="lg:col-span-7 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <PlacesGroundingPanel
                userCoords={userCoords}
                onUserCoordsChange={setUserCoords}
                compact
              />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
