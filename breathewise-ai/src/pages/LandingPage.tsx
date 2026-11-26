import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Compass, Globe, Search, ShieldCheck, Wind } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AqiStandard, EducationalResourceItem, EnvironmentalSnapshot } from '../types/domain';
import { AqiStatusDisplay } from '../components/ui/AqiBadge';
import { BrandLogo } from '../components/ui/BrandLogo';
import { PollutantBreakdownChart } from '../components/charts/EnvironmentalCharts';
import { AirQualityMap } from '../components/maps/AirQualityMap';

interface LandingPageProps {
  onNavigate: (view: string) => void;
  onOpenAuth: (tab: 'login' | 'register') => void;
}

export function LandingPage({ onNavigate, onOpenAuth }: LandingPageProps) {
  const { user, theme, setTheme, language, setLanguage, t, selectedLocation, setSelectedLocation } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ name: string; city: string; region: string; country: string; latitude: number; longitude: number; defaultStandard: AqiStandard }>
  >([]);
  const [snapshot, setSnapshot] = useState<EnvironmentalSnapshot | null>(null);
  const [loadingAqi, setLoadingAqi] = useState(false);
  const [aqiError, setAqiError] = useState('');
  const [resources, setResources] = useState<EducationalResourceItem[]>([]);
  const [legalDoc, setLegalDoc] = useState<'none' | 'privacy' | 'terms' | 'accessibility'>('none');

  // Feedback form state
  const [fbName, setFbName] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbCategory, setFbCategory] = useState<'general' | 'bug' | 'feature' | 'data_accuracy' | 'accessibility'>('general');
  const [fbMessage, setFbMessage] = useState('');
  const [fbStatus, setFbStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [fbError, setFbError] = useState('');

  const loadSnapshot = async (
    city: string,
    lat: number,
    lon: number,
    std: AqiStandard,
    region = '',
    country = '',
  ) => {
    setLoadingAqi(true);
    setAqiError('');
    try {
      const res = await fetch(
        `/api/v1/air-quality?city=${encodeURIComponent(city)}&region=${encodeURIComponent(region)}&country=${encodeURIComponent(country)}&lat=${lat}&lon=${lon}&standard=${std}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load air quality');
      setSnapshot(data.snapshot);
    } catch (err) {
      setAqiError((err as Error).message);
    } finally {
      setLoadingAqi(false);
    }
  };

  useEffect(() => {
    loadSnapshot(
      selectedLocation.city,
      selectedLocation.latitude,
      selectedLocation.longitude,
      selectedLocation.standard,
      selectedLocation.region,
      selectedLocation.country,
    );
    fetch('/api/v1/resources')
      .then((r) => r.json())
      .then((d) => setResources(d.resources || []))
      .catch(() => {});
  }, []);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/v1/locations/search?q=${encodeURIComponent(searchTerm)}`);
    const data = await res.json();
    setSearchResults(data.locations || []);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbStatus('submitting');
    setFbError('');
    try {
      const res = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fbName, email: fbEmail, category: fbCategory, message: fbMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit feedback');
      setFbStatus('sent');
      setFbName('');
      setFbEmail('');
      setFbMessage('');
    } catch (err) {
      setFbStatus('error');
      setFbError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-700 focus:text-white focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="whitespace-nowrap shrink-0"
            aria-label="BreatheWise AI Home"
          >
            <BrandLogo size="sm" />
          </a>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#explore-air" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              Explore Air
            </a>
            <a href="#how-it-works" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#learn" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              Learn
            </a>
            <a href="#faq" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Open Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* Hero Split Section */}
        <section id="top" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-14 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {t.tagline}
                </p>
                <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white text-balance leading-[1.1]">
                  {t.heroHeadline}
                </h1>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  {t.heroSubhead}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {user ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('dashboard')}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Go to My Dashboard <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('register')}
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Create Family Account <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login')}
                      className="px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Explore Demo Mode
                    </button>
                  </>
                )}
              </div>

              {/* Quiet language & theme selector below primary CTA */}
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-600 dark:text-slate-400">
                <label className="flex items-center gap-2">
                  <span>Language</span>
                  <select
                    aria-label="Preferred language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'hi' | 'gu')}
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-slate-900 dark:text-slate-100"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="gu">ગુજરાતી (Gujarati)</option>
                  </select>
                </label>
                <span aria-hidden="true">·</span>
                <label className="flex items-center gap-2">
                  <span>Appearance</span>
                  <select
                    aria-label="Theme preference"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-slate-900 dark:text-slate-100"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800 relative">
                <img
                  src="/src/assets/images/hero_winter_smog_city_1795709593096.jpg"
                  alt="Morning winter urban neighborhood with electric light-rail transit and clear bike lanes beneath crisp mist"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-Column Workflow Strip below hero split */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div>
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">01 · Observe &amp; Understand</div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Real-time AQI with explicit US EPA &amp; India NAQI scales and temperature inversion context.
              </p>
            </div>
            <div>
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">02 · Recommend</div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                GenAI daily routines and window ventilation timing grounded in hourly forecast data.
              </p>
            </div>
            <div>
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">03 · Act Safely</div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Practical indoor air checklists and commute swaps that never risk smog exposure.
              </p>
            </div>
            <div>
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">04 · Measure Impact</div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Deterministic CO2e, fuel, and kWh savings backed by documented emissions factors.
              </p>
            </div>
          </div>
        </section>

        {/* Public Live Air Quality Explorer */}
        <section id="explore-air" className="bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  Public Air Quality Explorer
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Check current air quality and pollutant levels in any city without creating an account.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <form onSubmit={handleCitySearch} className="flex items-center gap-2">
                  <label htmlFor="public-city-search" className="sr-only">
                    Search city
                  </label>
                  <input
                    id="public-city-search"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search city (e.g. Delhi, London)..."
                    className="w-56 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
                  >
                    <Search className="w-4 h-4" aria-hidden="true" /> Search
                  </button>
                </form>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...selectedLocation, standard: 'INDIA_NAQI' as AqiStandard };
                      setSelectedLocation(next);
                      loadSnapshot(next.city, next.latitude, next.longitude, 'INDIA_NAQI', next.region, next.country);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      selectedLocation.standard === 'INDIA_NAQI'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    India NAQI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...selectedLocation, standard: 'US_EPA' as AqiStandard };
                      setSelectedLocation(next);
                      loadSnapshot(next.city, next.latitude, next.longitude, 'US_EPA', next.region, next.country);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      selectedLocation.standard === 'US_EPA'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    US EPA AQI
                  </button>
                </div>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {searchResults.map((loc) => (
                  <button
                    key={`${loc.city}-${loc.latitude}`}
                    type="button"
                    onClick={() => {
                      const next = {
                        city: loc.city,
                        region: loc.region,
                        country: loc.country,
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        standard: loc.defaultStandard,
                      };
                      setSelectedLocation(next);
                      setSearchResults([]);
                      loadSnapshot(next.city, next.latitude, next.longitude, next.standard, next.region, next.country);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-emerald-600 text-slate-800 dark:text-slate-200"
                  >
                    {loc.city}, {loc.country}
                  </button>
                ))}
              </div>
            )}

            {loadingAqi ? (
              <div className="h-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 animate-pulse" />
            ) : aqiError ? (
              <div className="p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/30 text-sm text-red-800 dark:text-red-200">
                {aqiError}
              </div>
            ) : snapshot ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-4">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {snapshot.location.city}
                        {snapshot.location.country ? ` · ${snapshot.location.country}` : ''}
                      </span>
                      <span className="font-mono">
                        Updated {new Date(snapshot.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <AqiStatusDisplay meta={snapshot.aqi} />

                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {snapshot.aqi.plainLanguageSummary}
                    </p>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <div>Source: {snapshot.dataSource}</div>
                      <div>
                        Weather: {snapshot.weather.temperatureC ?? '--'}°C · Humidity {snapshot.weather.humidityPct ?? '--'}% · Wind {snapshot.weather.windSpeedKmh ?? '--'} km/h
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-7 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Measured Pollutant Breakdown &amp; Guidance
                    </h3>
                    <PollutantBreakdownChart pollutants={snapshot.pollutants} />
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {snapshot.aqi.outdoorGuidance}
                      </p>
                      <button
                        type="button"
                        onClick={() => (user ? onNavigate('assistant') : onOpenAuth('register'))}
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                      >
                        Get Personalized Routine →
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Interactive Station Location Map
                    </span>
                    <span>
                      {snapshot.location.latitude.toFixed(3)}, {snapshot.location.longitude.toFixed(3)}
                    </span>
                  </div>
                  <AirQualityMap snapshot={snapshot} heightClassName="h-72 sm:h-80" />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* How It Works & Asymmetric Bento Showcase */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Built for Real Winter Smog Decisions, Not Just Numbers
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              During winter temperature inversions, families face daily questions about outdoor exercise, window ventilation, school commutes, and indoor cooking smoke.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
              <div className="h-60 overflow-hidden bg-slate-200 dark:bg-slate-800">
                <img
                  src="/src/assets/images/indoor_clean_air_living_1795709593434.jpg"
                  alt="Minimalist living room with casement windows and a quiet white HEPA air purifier"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 space-y-2">
                <div className="text-xs font-medium text-teal-700 dark:text-teal-400">01 · Indoor Air Protection</div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Room-Wise Indoor Air Guidance Without Expensive Guesswork
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Distinguishes advisory indoor air management from measured outdoor AQI, aligns window opening strictly with forecast dips, and prioritizes no-cost cooking exhaust and damp-dusting steps before equipment purchases.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
              <div className="h-60 overflow-hidden bg-slate-200 dark:bg-slate-800">
                <img
                  src="/src/assets/images/sustainable_commute_transit_1795709595215.jpg"
                  alt="Clean electric light rail tram and protected bicycle lane on an urban winter boulevard"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 space-y-2">
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">02 · Exposure-Safe Sustainability</div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Low-Emission Alternatives That Respect Health Safety
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Recommends enclosed metro transit or telework during severe smog rather than unsafe outdoor cycling, and calculates exact CO2e and fuel savings using documented EPA, DEFRA, and CEA factors.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Educational Resources Preview */}
        <section id="learn" className="bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  Air Pollution Knowledge Center
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Verified explanations from WHO, US EPA, and CPCB grounding our AI recommendations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {resources.slice(0, 3).map((r) => (
                <article key={r.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {r.category} · {r.readingMinutes} min read
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{r.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{r.summary}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    Source: {r.sourceOrganization}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ & Contact/Feedback */}
        <section id="faq" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-6">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <dl className="space-y-4 divide-y divide-slate-200 dark:divide-slate-800">
              <div className="pt-3">
                <dt className="text-sm font-semibold text-slate-900 dark:text-white">
                  Why does BreatheWise AI show separate India NAQI and US EPA AQI options?
                </dt>
                <dd className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  India National AQI and US EPA AQI use different PM2.5 concentration breakpoints and category names. We always label the exact scale in use and never silently mix them.
                </dd>
              </div>
              <div className="pt-3">
                <dt className="text-sm font-semibold text-slate-900 dark:text-white">
                  Does avoiding CO2e immediately lower my city&apos;s AQI today?
                </dt>
                <dd className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  No single household&apos;s CO2e reduction measurably drops citywide ambient AQI on its own. We clearly separate personal exposure protection from long-term tailpipe and greenhouse gas reductions.
                </dd>
              </div>
              <div className="pt-3">
                <dt className="text-sm font-semibold text-slate-900 dark:text-white">
                  What happens if the AI service or external AQI API is temporarily unavailable?
                </dt>
                <dd className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  BreatheWise AI gracefully falls back to last valid cached environmental readings (explicitly labeled with timestamp) and a deterministic rule-based guidance engine.
                </dd>
              </div>
            </dl>
          </div>

          <div className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Contact &amp; Feedback
            </h2>
            <form onSubmit={handleFeedbackSubmit} className="space-y-3">
              <div>
                <label htmlFor="fb-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Your Name
                </label>
                <input
                  id="fb-name"
                  required
                  value={fbName}
                  onChange={(e) => setFbName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="fb-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  id="fb-email"
                  type="email"
                  required
                  value={fbEmail}
                  onChange={(e) => setFbEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="fb-cat" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topic
                </label>
                <select
                  id="fb-cat"
                  value={fbCategory}
                  onChange={(e) => setFbCategory(e.target.value as typeof fbCategory)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="general">General Feedback</option>
                  <option value="data_accuracy">Environmental Data Question</option>
                  <option value="accessibility">Accessibility Report</option>
                  <option value="feature">Feature Suggestion</option>
                  <option value="bug">Bug Report</option>
                </select>
              </div>
              <div>
                <label htmlFor="fb-msg" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Message
                </label>
                <textarea
                  id="fb-msg"
                  rows={3}
                  required
                  minLength={10}
                  value={fbMessage}
                  onChange={(e) => setFbMessage(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              {fbStatus === 'sent' && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  Thank you — your feedback was saved for review.
                </p>
              )}
              {fbStatus === 'error' && (
                <p className="text-xs text-red-700 dark:text-red-400">{fbError}</p>
              )}
              <button
                type="submit"
                disabled={fbStatus === 'submitting'}
                className="w-full px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50"
              >
                {fbStatus === 'submitting' ? 'Sending...' : 'Send Feedback'}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Legal Modal */}
      {legalDoc !== 'none' && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
        >
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 id="legal-modal-title" className="font-display text-lg font-bold capitalize">
              {legalDoc === 'privacy'
                ? 'Privacy Policy'
                : legalDoc === 'terms'
                  ? 'Terms and Conditions'
                  : 'Accessibility Statement'}
            </h2>
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              {legalDoc === 'privacy' && (
                <p>
                  BreatheWise AI collects only the location, commute, and household preferences you choose to provide for personalization. Passwords are hashed securely, private AI conversations are never shared with community members or administrators, and you can withdraw personalization consent or permanently delete your account anytime in Settings.
                </p>
              )}
              {legalDoc === 'terms' && (
                <p>
                  BreatheWise AI provides environmental awareness, low-emission routine planning, and modeled impact estimates. Guidance is informational and does not constitute medical advice or clinical diagnosis. Always follow local public health advisories during severe pollution events. Interactive maps and grounded place features integrate Google Maps Platform and are subject to the{' '}
                  <a
                    href="https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-emerald-700 dark:text-emerald-400"
                  >
                    Google Maps Platform Terms of Service
                  </a>
                  .
                </p>
              )}
              {legalDoc === 'accessibility' && (
                <p>
                  BreatheWise AI targets WCAG 2.2 Level AA: semantic landmarks, keyboard navigation, visible focus rings, tabular numerals, color-blind safe AQI indicators (paired with text and icons), accessible data table alternatives for charts, reduced-motion support, and multilingual readiness (English, Hindi, Gujarati).
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLegalDoc('none')}
              className="px-4 py-2 text-sm font-semibold bg-slate-900 dark:bg-slate-800 text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>BreatheWise AI · Breathe Better. Live Smarter. Together.</div>
          <div className="flex flex-wrap items-center gap-5">
            <button type="button" onClick={() => setLegalDoc('privacy')} className="hover:underline">
              Privacy Policy
            </button>
            <button type="button" onClick={() => setLegalDoc('terms')} className="hover:underline">
              Terms &amp; Conditions
            </button>
            <button type="button" onClick={() => setLegalDoc('accessibility')} className="hover:underline">
              Accessibility Statement
            </button>
            <a href="/api/v1/docs/openapi.json" target="_blank" rel="noreferrer" className="hover:underline">
              API Spec
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
