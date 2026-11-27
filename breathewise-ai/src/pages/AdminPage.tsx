import { useCallback, useEffect, useState } from 'react';
import { Activity, Shield, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/domain';

export function AdminPage() {
  const { apiFetch, user } = useAuth();
  const isSysAdmin = user?.role === 'SYSTEM_ADMIN';
  const isMod = user?.role === 'COMMUNITY_MODERATOR' || isSysAdmin;

  const [overview, setOverview] = useState<{
    stats: { usersCount: number; activitiesCount: number; cacheCount: number; apiConfigured: boolean; demoMode: boolean };
    apiMetrics: Array<{ service_name: string; status: string; cnt: number; avg_ms: number; tokens: number }>;
  } | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string; role: UserRole; created_at: string }>>([]);
  const [reports, setReports] = useState<
    Array<{ id: string; post_id: string; reason: string; status: string; post_title: string; post_content: string; author_name: string; city: string }>
  >([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; action: string; target_type: string; details: string; created_at: string }>>([]);
  const [resTitle, setResTitle] = useState('');
  const [resContent, setResContent] = useState('');
  const [error, setError] = useState('');

  const loadAdmin = useCallback(async () => {
    try {
      if (isMod) {
        const rep = await apiFetch<{ reports: typeof reports }>('/api/v1/admin/moderation/reports');
        setReports(rep.reports);
      }
      if (isSysAdmin) {
        const [ov, us, au] = await Promise.all([
          apiFetch<NonNullable<typeof overview>>('/api/v1/admin/overview'),
          apiFetch<{ users: typeof users }>('/api/v1/admin/users'),
          apiFetch<{ logs: typeof auditLogs }>('/api/v1/admin/audit-logs'),
        ]);
        setOverview(ov);
        setUsers(us.users);
        setAuditLogs(au.logs);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [apiFetch, isMod, isSysAdmin]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  if (!isMod) {
    return (
      <div className="p-8 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-sm text-red-800 dark:text-red-200">
        403 Forbidden: Administrator or Moderator role required.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Administration &amp; Community Moderation
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Server-enforced RBAC console. Private user AI conversations are intentionally inaccessible to administrators.
        </p>
      </div>

      {error && <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-200">{error}</div>}

      {isSysAdmin && overview && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs text-slate-500">Registered Users</div>
              <div className="font-mono text-2xl font-bold mt-1 tabular-nums">{overview.stats.usersCount}</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs text-slate-500">Activities Logged</div>
              <div className="font-mono text-2xl font-bold mt-1 tabular-nums">{overview.stats.activitiesCount}</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs text-slate-500">Cached Locations</div>
              <div className="font-mono text-2xl font-bold mt-1 tabular-nums">{overview.stats.cacheCount}</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs text-slate-500">AI Provider Status</div>
              <div className="text-sm font-semibold mt-2 text-emerald-700 dark:text-emerald-400">
                {overview.stats.apiConfigured ? 'Gemini Connected' : 'Deterministic Fallback'}
              </div>
            </div>
          </div>

          <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-700" aria-hidden="true" /> External API &amp; AI Metrics
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Service</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4 text-right">Requests</th>
                    <th className="py-2 pr-4 text-right">Avg Latency (ms)</th>
                    <th className="py-2 text-right">Est. Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {overview.apiMetrics.map((m, idx) => (
                    <tr key={`${m.service_name}-${m.status}-${idx}`} className="h-9">
                      <td className="py-2 pr-4 font-mono">{m.service_name}</td>
                      <td className="py-2 pr-4">{m.status}</td>
                      <td className="py-2 pr-4 text-right font-mono">{m.cnt}</td>
                      <td className="py-2 pr-4 text-right font-mono">{m.avg_ms}</td>
                      <td className="py-2 text-right font-mono">{m.tokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Community Moderation Queue */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <h2 className="font-display text-base font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Community Moderation Queue
        </h2>
        {reports.length === 0 ? (
          <p className="text-xs text-slate-500">No community reports queued.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>{r.city} · Post by {r.author_name}</span>
                  <span className="font-mono">{r.status}</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white">{r.post_title}</div>
                <p className="text-slate-600 dark:text-slate-300">{r.post_content}</p>
                <div className="text-amber-800 dark:text-amber-300">Report Reason: {r.reason}</div>
                {r.status === 'PENDING' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/v1/admin/moderation/reports/${r.id}/resolve`, {
                          method: 'POST',
                          body: JSON.stringify({ removePost: false }),
                        });
                        loadAdmin();
                      }}
                      className="px-3 py-1 rounded-md border border-slate-300 dark:border-slate-700"
                    >
                      Keep Post
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/v1/admin/moderation/reports/${r.id}/resolve`, {
                          method: 'POST',
                          body: JSON.stringify({ removePost: true }),
                        });
                        loadAdmin();
                      }}
                      className="px-3 py-1 rounded-md bg-red-700 text-white font-semibold"
                    >
                      Remove Post
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {isSysAdmin && (
        <>
          {/* User & Role Management */}
          <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" aria-hidden="true" /> User Role Management
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.id} className="h-10">
                      <td className="py-2 pr-4 font-medium">{u.full_name}</td>
                      <td className="py-2 pr-4 font-mono">{u.email}</td>
                      <td className="py-2 pr-4">
                        <select
                          aria-label={`Role for ${u.email}`}
                          value={u.role}
                          onChange={async (e) => {
                            await apiFetch(`/api/v1/admin/users/${u.id}/role`, {
                              method: 'PATCH',
                              body: JSON.stringify({ role: e.target.value }),
                            });
                            loadAdmin();
                          }}
                          className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                        >
                          <option value="INDIVIDUAL_USER">INDIVIDUAL_USER</option>
                          <option value="FAMILY_ADMIN">FAMILY_ADMIN</option>
                          <option value="FAMILY_MEMBER">FAMILY_MEMBER</option>
                          <option value="COMMUNITY_MODERATOR">COMMUNITY_MODERATOR</option>
                          <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Educational Resource Publisher + Audit Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <h2 className="font-display text-base font-bold">Publish Educational Resource</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiFetch('/api/v1/admin/resources', {
                    method: 'POST',
                    body: JSON.stringify({ title: resTitle, content: resContent }),
                  });
                  setResTitle('');
                  setResContent('');
                  loadAdmin();
                }}
                className="space-y-3 text-xs"
              >
                <input
                  required
                  placeholder="Article title"
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <textarea
                  required
                  rows={4}
                  placeholder="Evidence-backed article content..."
                  value={resContent}
                  onChange={(e) => setResContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button type="submit" className="px-4 py-2 font-semibold text-white bg-emerald-700 rounded-lg">
                  Publish Resource
                </button>
              </form>
            </section>

            <section className="lg:col-span-7 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <h2 className="font-display text-base font-bold">Security Audit Log</h2>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {auditLogs.map((l) => (
                  <div key={l.id} className="py-2 flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{l.action}</span>
                      <span className="text-slate-600 dark:text-slate-400 ml-2">{l.details}</span>
                    </div>
                    <span className="font-mono text-slate-400 shrink-0">
                      {new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
