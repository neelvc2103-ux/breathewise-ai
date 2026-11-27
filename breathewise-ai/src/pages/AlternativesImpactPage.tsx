import React, { useCallback, useEffect, useState } from 'react';
import { Calculator, Leaf, PlusCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ActivityLogEntry, EmissionFactorRecord, ImpactSummary } from '../types/domain';
import { ImpactTrendChart } from '../components/charts/EnvironmentalCharts';

interface AlternativeCard {
  id: string;
  currentActivity: string;
  suggestedAlternative: string;
  estimatedEnvironmentalBenefit: string;
  financialConsideration: string;
  convenienceLevel: string;
  requiredEffort: string;
  exposureSafetyWarning?: string;
  explanation: string;
  factorCode: string;
}

export function AlternativesImpactPage() {
  const { apiFetch, selectedLocation, demoScenario } = useAuth();
  const [alternatives, setAlternatives] = useState<AlternativeCard[]>([]);
  const [factors, setFactors] = useState<EmissionFactorRecord[]>([]);
  const [summary, setSummary] = useState<ImpactSummary | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);

  const [selectedCode, setSelectedCode] = useState('COMMUTE_CAR_TO_METRO');
  const [quantity, setQuantity] = useState(12);
  const [activityDate, setActivityDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [altRes, facRes, sumRes, actRes] = await Promise.all([
        apiFetch<{ alternatives: AlternativeCard[] }>(
          `/api/v1/alternatives?city=${encodeURIComponent(selectedLocation.city)}&lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}&standard=${selectedLocation.standard}&demoScenario=${demoScenario}`,
        ),
        apiFetch<{ factors: EmissionFactorRecord[] }>('/api/v1/impact/factors'),
        apiFetch<{ summary: ImpactSummary }>('/api/v1/impact/summary'),
        apiFetch<{ activities: ActivityLogEntry[] }>('/api/v1/impact/activities'),
      ]);
      setAlternatives(altRes.alternatives);
      setFactors(facRes.factors);
      setSummary(sumRes.summary);
      setActivities(actRes.activities);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  }, [apiFetch, selectedLocation, demoScenario]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeFactor = factors.find((f) => f.code === selectedCode) ?? factors[0];
  const previewCo2e = activeFactor
    ? Math.max(0, (activeFactor.baselineKgCo2ePerUnit - activeFactor.alternativeKgCo2ePerUnit) * quantity).toFixed(3)
    : '0.000';

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await apiFetch<{ activity: ActivityLogEntry; summary: ImpactSummary }>('/api/v1/impact/activities', {
        method: 'POST',
        body: JSON.stringify({ factorCode: selectedCode, quantity: Number(quantity), activityDate, notes }),
      });
      setSummary(res.summary);
      setActivities((prev) => [res.activity, ...prev]);
      setNotes('');
      setStatusMsg(`Logged ${res.activity.co2eAvoidedKg} kg CO2e avoided.`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch<{ summary: ImpactSummary }>(`/api/v1/impact/activities/${id}`, {
        method: 'DELETE',
      });
      setSummary(res.summary);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Sustainable Alternatives &amp; Impact Calculator
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Exposure-safe swaps paired with deterministic emissions arithmetic grounded in DEFRA, EPA, CEA, and IPCC factors.
        </p>
      </div>

      {/* KPI Metrics Row */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Daily CO2e Avoided</div>
            <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
              {summary.dailyCo2eAvoidedKg} kg
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Monthly CO2e Avoided</div>
            <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {summary.monthlyCo2eAvoidedKg} kg
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Fuel Saved</div>
            <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {summary.totalFuelSavedLiters} L
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Energy Saved</div>
            <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {summary.totalEnergySavedKwh} kWh
            </div>
          </div>
        </div>
      )}

      {/* Deterministic Calculator + Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2 font-display text-base font-bold">
            <Calculator className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            Log Activity &amp; Calculate Impact
          </div>

          <form onSubmit={handleLogSubmit} className="space-y-3">
            <div>
              <label htmlFor="imp-factor" className="block text-xs font-medium mb-1">Sustainable Action</label>
              <select
                id="imp-factor"
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {factors.map((f) => (
                  <option key={f.code} value={f.code}>{f.label} ({f.unit})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="imp-qty" className="block text-xs font-medium mb-1">
                  Quantity ({activeFactor?.unit ?? 'units'})
                </label>
                <input
                  id="imp-qty"
                  type="number"
                  step="0.5"
                  min="0.1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="imp-date" className="block text-xs font-medium mb-1">Date</label>
                <input
                  id="imp-date"
                  type="date"
                  required
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label htmlFor="imp-notes" className="block text-xs font-medium mb-1">Notes (Optional)</label>
              <input
                id="imp-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Morning metro trip to office"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            {activeFactor && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  Formula: ({activeFactor.baselineKgCo2ePerUnit} − {activeFactor.alternativeKgCo2ePerUnit}) × {quantity} = {previewCo2e} kg CO2e avoided
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  Source: {activeFactor.source} ({activeFactor.publicationYear})
                </div>
              </div>
            )}

            {statusMsg && <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{statusMsg}</p>}
            {errorMsg && <p className="text-xs text-red-700 dark:text-red-400">{errorMsg}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              {submitting ? 'Logging...' : 'Record Activity'}
            </button>
          </form>
        </section>

        <section className="lg:col-span-7 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <h2 className="font-display text-base font-bold">Modeled CO2e Avoided Over Time</h2>
          <ImpactTrendChart series={summary?.dailySeries ?? []} />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {summary?.scientificNote}
          </p>
        </section>
      </div>

      {/* Personalized Sustainable Alternatives */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Personalized Low-Emission Alternatives
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alternatives.map((alt) => (
            <div key={alt.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Replacing: {alt.currentActivity}
              </div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                {alt.suggestedAlternative}
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{alt.explanation}</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div><strong>Impact:</strong> {alt.estimatedEnvironmentalBenefit}</div>
                <div><strong>Cost:</strong> {alt.financialConsideration} · <strong>Convenience:</strong> {alt.convenienceLevel}</div>
              </div>
              {alt.exposureSafetyWarning && (
                <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{alt.exposureSafetyWarning}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedCode(alt.factorCode)}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Pre-fill in Impact Calculator ↑
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Activity History Table */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <h2 className="font-display text-base font-bold">Activity History</h2>
        {activities.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No activities recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Activity</th>
                  <th className="py-2 pr-4 text-right">Quantity</th>
                  <th className="py-2 pr-4 text-right">CO2e Avoided</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activities.map((a) => (
                  <tr key={a.id} className="h-10">
                    <td className="py-2 pr-4 font-mono">{a.activityDate}</td>
                    <td className="py-2 pr-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{a.activityTitle}</div>
                      {a.notes && <div className="text-slate-500">{a.notes}</div>}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono">{a.quantity} {a.unit}</td>
                    <td className="py-2 pr-4 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                      {a.co2eAvoidedKg} kg
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        aria-label={`Delete activity ${a.activityTitle}`}
                        className="p-1.5 text-slate-500 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
