import React, { useEffect, useState } from 'react';
import { CalendarClock, CheckSquare, RefreshCw, ShieldAlert, Square } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { DailyRoutinePlan } from '../types/domain';

export function RoutinePlannerPage() {
  const { apiFetch, selectedLocation, demoScenario } = useAuth();
  const [routine, setRoutine] = useState<DailyRoutinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const loadLatest = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ routine: DailyRoutinePlan | null }>('/api/v1/routines/latest');
      setRoutine(res.routine);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await apiFetch<{ routine: DailyRoutinePlan }>('/api/v1/routines/generate', {
        method: 'POST',
        body: JSON.stringify({
          city: selectedLocation.city,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          standard: selectedLocation.standard,
          demoScenario,
        }),
      });
      setRoutine(res.routine);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleCompleted = async (actId: string, nextVal: boolean) => {
    try {
      await apiFetch(`/api/v1/routines/activities/${actId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: nextVal }),
      });
      setRoutine((prev) =>
        prev
          ? {
              ...prev,
              activities: prev.activities.map((a) => (a.id === actId ? { ...a, completed: nextVal } : a)),
            }
          : null,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const updateTime = async (actId: string, nextTime: string) => {
    try {
      await apiFetch(`/api/v1/routines/activities/${actId}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledTime: nextTime }),
      });
      setRoutine((prev) =>
        prev
          ? {
              ...prev,
              activities: prev.activities.map((a) => (a.id === actId ? { ...a, scheduledTime: nextTime } : a)),
            }
          : null,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Smart Daily Routine Planner
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Adapts exercise, commuting, ventilation, and chores to {selectedLocation.city} hourly air quality forecasts.
          </p>
        </div>

        <button
          type="button"
          disabled={generating}
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} aria-hidden="true" />
          {routine ? 'Regenerate Routine' : 'Generate Today’s Routine'}
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-48 rounded-xl bg-slate-200 dark:bg-slate-800/40 animate-pulse" />
      ) : !routine ? (
        <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3">
          <CalendarClock className="w-8 h-8 mx-auto text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold">No Daily Routine Generated Yet</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Generate an adaptive schedule tailored to your commute, cooking fuel, and current {selectedLocation.city} air quality.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
          >
            Generate Adaptive Routine
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-slate-700 dark:text-slate-300 font-medium">{routine.summary}</span>
            <span className="font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              {routine.city} · AQI {routine.aqiAtGeneration} ({routine.aqiStandard})
            </span>
          </div>

          <div className="space-y-3">
            {routine.activities.map((act) => (
              <div
                key={act.id}
                className={`p-5 rounded-xl border transition-colors ${
                  act.completed
                    ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCompleted(act.id, !act.completed)}
                      aria-label={act.completed ? `Mark ${act.title} incomplete` : `Mark ${act.title} complete`}
                      className="mt-0.5 text-emerald-700 dark:text-emerald-400"
                    >
                      {act.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {act.category} · {act.isIndoor ? 'Indoor-Focused' : 'Outdoor / Transit'}
                      </div>
                      <h3 className={`font-display text-base font-bold ${act.completed ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                        {act.title}
                      </h3>
                      <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                        {act.suggestedAlternative}
                      </p>
                      <div className="pt-1 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                        <div><strong>Why:</strong> {act.reason}</div>
                        <div><strong>Exposure:</strong> {act.exposureNote} · <strong>Emissions:</strong> {act.environmentalNote}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label htmlFor={`time-${act.id}`} className="sr-only">Scheduled time</label>
                    <input
                      id={`time-${act.id}`}
                      type="time"
                      value={act.scheduledTime.slice(0, 5)}
                      onChange={(e) => updateTime(act.id, e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function IndoorAirPage() {
  const { apiFetch, selectedLocation, demoScenario } = useAuth();
  const [guidance, setGuidance] = useState<{
    isAdvisoryOnly: boolean;
    advisoryNotice: string;
    bestVentilationWindow: string;
    scienceMythsToAvoid: string[];
    checklist: Array<{
      id: string;
      room: string;
      costTier: string;
      title: string;
      action: string;
      whyItHelps: string;
    }>;
  } | null>(null);
  const [roomFilter, setRoomFilter] = useState('All');
  const [costFilter, setCostFilter] = useState('All');
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ guidance: typeof guidance }>(
      `/api/v1/indoor/guidance?city=${encodeURIComponent(selectedLocation.city)}&lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}&standard=${selectedLocation.standard}&demoScenario=${demoScenario}`,
    )
      .then((res) => setGuidance(res.guidance))
      .catch((err) => setError((err as Error).message));
  }, [selectedLocation.city, selectedLocation.standard, demoScenario]);

  const rooms = ['All', 'Kitchen', 'Living Room', 'Bedroom', 'Study Room', 'Office', 'All Spaces'];
  const costs = ['All', 'No-cost', 'Low-cost', 'Moderate-cost', 'Equipment-based'];

  const filtered = guidance?.checklist.filter(
    (item) => (roomFilter === 'All' || item.room === roomFilter) && (costFilter === 'All' || item.costTier === costFilter),
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Indoor Air Quality Assistant
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Room-by-room particulate and smoke reduction steps grounded in public health guidance.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-xs text-red-800">
          {error}
        </div>
      )}

      {guidance && (
        <>
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-semibold">{guidance.advisoryNotice}</div>
              <div className="mt-1">Recommended outdoor ventilation check window for {selectedLocation.city}: <strong>{guidance.bestVentilationWindow}</strong></div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <span className="font-medium">Room:</span>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {rooms.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="font-medium">Solution Tier:</span>
              <select
                value={costFilter}
                onChange={(e) => setCostFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {costs.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((item) => {
              const done = Boolean(checkedIds[item.id]);
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3"
                >
                  <button
                    type="button"
                    onClick={() => setCheckedIds((p) => ({ ...p, [item.id]: !done }))}
                    aria-label={`Toggle ${item.title}`}
                    className="mt-0.5 text-emerald-700 dark:text-emerald-400"
                  >
                    {done ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.room} · {item.costTier}
                    </div>
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">{item.title}</h2>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{item.action}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Why: {item.whyItHelps}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Evidence-Based Safeguards &amp; Myths to Avoid
            </h2>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
              {guidance.scienceMythsToAvoid.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
