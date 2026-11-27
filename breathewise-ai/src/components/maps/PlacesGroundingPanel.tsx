import { useState } from 'react';
import { Compass, ExternalLink, MapPin, Navigation, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { PlacesGroundingReply } from '../../types/domain';

interface PlacesGroundingPanelProps {
  userCoords: { latitude: number; longitude: number } | null;
  onUserCoordsChange: (coords: { latitude: number; longitude: number } | null) => void;
  compact?: boolean;
}

const PLACE_PRESETS = [
  'Enclosed metro or rail transit stations nearby for low-exposure commuting',
  'Public libraries or indoor community centers suitable on high-AQI days',
  'Neighborhood parks and green walking paths for clean-air hours',
  'Pharmacies carrying N95/FFP2 masks and indoor air filter supplies',
];

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.split('\n').map((l) => l.trimEnd());
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={idx} className="h-2" aria-hidden="true" />;
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={idx} className="font-display text-sm font-bold text-slate-900 dark:text-white pt-1">
          {trimmed.slice(4).replace(/\*\*/g, '')}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={idx} className="font-display text-base font-bold text-slate-900 dark:text-white pt-1">
          {trimmed.slice(3).replace(/\*\*/g, '')}
        </h3>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <span aria-hidden="true" className="text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">•</span>
          <span>{trimmed.slice(2).replace(/\*\*/g, '')}</span>
        </div>
      );
    }
    return (
      <p key={idx} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {trimmed.replace(/\*\*/g, '')}
      </p>
    );
  });
}

export function PlacesGroundingPanel({
  userCoords,
  onUserCoordsChange,
  compact = false,
}: PlacesGroundingPanelProps) {
  const { apiFetch, selectedLocation, demoScenario } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PlacesGroundingReply | null>(null);

  const activeLat = userCoords?.latitude ?? selectedLocation.latitude;
  const activeLon = userCoords?.longitude ?? selectedLocation.longitude;

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('Browser geolocation is unavailable; using selected city coordinates.');
      return;
    }
    setLocating(true);
    setGeoStatus('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onUserCoordsChange({
          latitude: Number(pos.coords.latitude.toFixed(5)),
          longitude: Number(pos.coords.longitude.toFixed(5)),
        });
        setGeoStatus('Using your current browser coordinates.');
        setLocating(false);
      },
      () => {
        setGeoStatus('Location permission declined; using selected city coordinates.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const runSearch = async (searchText?: string) => {
    const q = (searchText ?? query).trim();
    if (q.length < 3 || loading) return;
    if (!searchText) setQuery('');
    setLoading(true);
    setError('');
    try {
      const reply = await apiFetch<PlacesGroundingReply>('/api/v1/assistant/places-grounding', {
        method: 'POST',
        body: JSON.stringify({
          query: q,
          city: selectedLocation.city,
          latitude: activeLat,
          longitude: activeLon,
          standard: selectedLocation.standard,
          demoScenario,
        }),
      });
      setResult(reply);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            Nearby Clean-Air Places &amp; Transit (Google Maps Grounding)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Anchored at {activeLat.toFixed(3)}, {activeLon.toFixed(3)} ({userCoords ? 'Current Browser Location' : selectedLocation.city})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Navigation className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" aria-hidden="true" />
            {locating ? 'Locating...' : userCoords ? 'Refresh GPS' : 'Use My Location'}
          </button>
          {userCoords && (
            <button
              type="button"
              onClick={() => {
                onUserCoordsChange(null);
                setGeoStatus(`Reverted to ${selectedLocation.city} coordinates.`);
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:underline whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {geoStatus && (
        <p className="text-xs text-slate-600 dark:text-slate-400">{geoStatus}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {(compact ? PLACE_PRESETS.slice(0, 3) : PLACE_PRESETS).map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={loading}
            onClick={() => runSearch(preset)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-emerald-600 text-slate-700 dark:text-slate-300 text-left"
          >
            {preset}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor={compact ? 'dash-maps-grounding' : 'assistant-maps-grounding'} className="sr-only">
          Search nearby clean-air places or transit
        </label>
        <input
          id={compact ? 'dash-maps-grounding' : 'assistant-maps-grounding'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search metro stops, indoor centers, or parks near ${selectedLocation.city}...`}
          className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
        />
        <button
          type="submit"
          disabled={loading || query.trim().length < 3}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          {loading ? 'Searching...' : 'Find Places'}
        </button>
      </form>

      {error && (
        <div role="alert" className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Query: <strong className="text-slate-800 dark:text-slate-200">{result.query}</strong>
            </span>
            <span>
              {result.providerUsed === 'gemini_maps_grounding'
                ? 'Gemini Maps Grounding · Google Maps'
                : 'Maps Grounding Unavailable'}
            </span>
          </div>

          {result.fallbackReason && (
            <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
              {result.fallbackReason}
            </div>
          )}

          <div className="space-y-1.5">{renderMarkdownBlocks(result.answerMarkdown)}</div>

          {result.places.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Google Maps Places &amp; Sources ({result.places.length})
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {result.places.map((place) => (
                  <li
                    key={place.uri}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5"
                  >
                    <a
                      href={place.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{place.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                    </a>

                    {place.reviewSnippets.length > 0 && (
                      <div className="space-y-1 pl-5">
                        {place.reviewSnippets.slice(0, 2).map((snip, i) => (
                          <p key={i} className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                            &ldquo;{snip.content}&rdquo;
                            {snip.googleMapsUri && (
                              <>
                                {' '}
                                <a
                                  href={snip.googleMapsUri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-700 dark:text-emerald-400 hover:underline"
                                >
                                  Review
                                </a>
                              </>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-slate-500 dark:text-slate-400">{result.medicalDisclaimer}</p>
        </div>
      )}
    </div>
  );
}
