import { AlertOctagon, AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { AqiSeverityMeta } from '../../types/domain';

export function AqiStatusDisplay({ meta, compact = false }: { meta: AqiSeverityMeta; compact?: boolean }) {
  const Icon =
    meta.iconName === 'CheckCircle2'
      ? CheckCircle2
      : meta.iconName === 'Info'
        ? Info
        : meta.iconName === 'AlertTriangle'
          ? AlertTriangle
          : meta.iconName === 'ShieldAlert'
            ? ShieldAlert
            : AlertOctagon;

  const stdLabel = meta.standard === 'INDIA_NAQI' ? 'India National AQI' : 'US EPA AQI';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-4 flex-wrap">
        <span
          className={`font-mono font-bold tracking-tight tabular-nums ${compact ? 'text-3xl' : 'text-5xl'} text-slate-900 dark:text-slate-50`}
        >
          {meta.aqi}
        </span>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 shrink-0" style={{ color: meta.colorHex }} aria-hidden="true" />
          <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {meta.category}
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{stdLabel}</span>
        </div>
      </div>

      <div
        className="h-2 w-full rounded-sm bg-slate-200 dark:bg-slate-800 overflow-hidden"
        role="progressbar"
        aria-valuenow={meta.aqi}
        aria-valuemin={0}
        aria-valuemax={500}
        aria-label={`${stdLabel} level ${meta.aqi}, ${meta.category}`}
      >
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${Math.min(100, Math.round((meta.aqi / 500) * 100))}%`,
            backgroundColor: meta.colorHex,
          }}
        />
      </div>
    </div>
  );
}
