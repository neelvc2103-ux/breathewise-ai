import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AqiStandard, HourlyForecastPoint, PollutantReadings } from '../../types/domain';

export function HourlyForecastChart({
  data,
  standard,
}: {
  data: HourlyForecastPoint[];
  standard: AqiStandard;
}) {
  const [showTable, setShowTable] = useState(false);

  const chartData = data.map((d) => ({
    hour: d.hourLabel,
    aqi: standard === 'INDIA_NAQI' ? d.indiaAqi : d.usAqi,
    pm25: d.pm25,
    wind: d.windSpeedKmh,
  }));

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
        Hourly forecast readings are unavailable for this location.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Upcoming forecast trajectory ({standard === 'INDIA_NAQI' ? 'India NAQI' : 'US EPA AQI'} &amp; PM2.5 µg/m³)
        </p>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
        >
          {showTable ? 'Show Chart' : 'View Accessible Table'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-2 px-3">Hour</th>
                <th className="py-2 px-3 text-right">AQI</th>
                <th className="py-2 px-3 text-right">PM2.5 (µg/m³)</th>
                <th className="py-2 px-3 text-right">Wind (km/h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {chartData.map((row) => (
                <tr key={row.hour}>
                  <td className="py-2 px-3 font-mono">{row.hour}</td>
                  <td className="py-2 px-3 text-right font-mono font-medium">{row.aqi}</td>
                  <td className="py-2 px-3 text-right font-mono">{row.pm25 ?? '--'}</td>
                  <td className="py-2 px-3 text-right font-mono">{row.wind ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64 w-full" role="img" aria-label="Hourly air quality forecast chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="bwAqiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  color: '#f8fafc',
                  fontSize: '12px',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="aqi"
                name={standard === 'INDIA_NAQI' ? 'India NAQI' : 'US EPA AQI'}
                stroke="#0D9488"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#bwAqiGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function PollutantBreakdownChart({ pollutants }: { pollutants: PollutantReadings }) {
  const rows = [
    { name: 'PM2.5', value: pollutants.pm25, unit: 'µg/m³' },
    { name: 'PM10', value: pollutants.pm10, unit: 'µg/m³' },
    { name: 'NO2', value: pollutants.no2, unit: 'µg/m³' },
    { name: 'SO2', value: pollutants.so2, unit: 'µg/m³' },
    { name: 'O3', value: pollutants.o3, unit: 'µg/m³' },
  ].filter((r): r is { name: string; value: number; unit: string } => r.value !== null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Detailed pollutant species are unavailable from the selected data snapshot.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rows.map((p) => (
          <div key={p.name} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
            <div className="text-xs text-slate-500 dark:text-slate-400">{p.name}</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {p.value.toFixed(1)} <span className="text-xs font-normal text-slate-500">{p.unit}</span>
            </div>
          </div>
        ))}
        {pollutants.co !== null && (
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
            <div className="text-xs text-slate-500 dark:text-slate-400">CO</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {pollutants.co.toFixed(0)} <span className="text-xs font-normal text-slate-500">µg/m³</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ImpactTrendChart({
  series,
}: {
  series: Array<{ date: string; co2eKg: number; activities: number }>;
}) {
  if (series.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
        Log your first low-emission commute or energy-saving action to visualize daily CO2e avoided.
      </p>
    );
  }

  return (
    <div className="h-60 w-full" role="img" aria-label="Daily avoided CO2e bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderColor: '#334155',
              color: '#f8fafc',
              fontSize: '12px',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="co2eKg" name="CO2e Avoided (kg)" fill="#15803D" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
