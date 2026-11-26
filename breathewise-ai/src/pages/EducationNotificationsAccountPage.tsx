import React, { useEffect, useState } from 'react';
import { Bell, BookOpen, Check, ExternalLink, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { EducationalResourceItem, NotificationItem } from '../types/domain';

export function EducationPage() {
  const [query, setQuery] = useState('');
  const [resources, setResources] = useState<EducationalResourceItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadResources = async (q = '') => {
    const res = await fetch(`/api/v1/resources?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResources(data.resources || []);
  };

  useEffect(() => {
    loadResources();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Air Pollution Awareness &amp; Knowledge Base
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Plain-language explanations from WHO, US EPA, CPCB, and Health Effects Institute.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadResources(query);
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="edu-search" className="sr-only">Search articles</label>
          <input
            id="edu-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PM2.5, inversion, HEPA..."
            className="w-56 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <button type="submit" className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg">
            <Search className="w-3.5 h-3.5" aria-hidden="true" /> Search
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {resources.map((r) => {
          const isOpen = expandedId === r.id;
          return (
            <article key={r.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{r.category} · {r.readingMinutes} min read · {r.sourceOrganization}</span>
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Reference <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">{r.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{r.summary}</p>
              {isOpen && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {r.content}
                </div>
              )}
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : r.id)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                {isOpen ? 'Hide Full Explanation' : 'Read Full Explanation'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function NotificationsSettingsPage({ onEditOnboarding }: { onEditOnboarding: () => void }) {
  const { apiFetch, user, profile, setProfileLocal, theme, setTheme, language, setLanguage, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [prefs, setPrefs] = useState({
    aqiThreshold: 180,
    quietHoursStart: '22:00',
    quietHoursEnd: '06:30',
    timezone: 'Asia/Kolkata',
    inAppEnabled: true,
    emailEnabled: false,
    browserEnabled: false,
    weeklyReportEnabled: true,
    unsubscribedAll: false,
  });
  const [sessions, setSessions] = useState<Array<{ id: string; userAgent: string; createdAt: string; revokedAt: string | null; isCurrent: boolean }>>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadAll = async () => {
    try {
      const [nRes, pRes, sRes] = await Promise.all([
        apiFetch<{ notifications: NotificationItem[] }>('/api/v1/notifications'),
        apiFetch<{ preferences: typeof prefs | null }>('/api/v1/notifications/preferences'),
        apiFetch<{ sessions: typeof sessions }>('/api/v1/auth/sessions'),
      ]);
      setNotifications(nRes.notifications);
      if (pRes.preferences) setPrefs(pRes.preferences);
      setSessions(sRes.sessions);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const savePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await apiFetch('/api/v1/notifications/preferences', { method: 'PUT', body: JSON.stringify(prefs) });
      setStatusMsg('Notification preferences saved.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await apiFetch('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setStatusMsg('Password updated.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const toggleConsent = async () => {
    if (!profile) return;
    const res = await apiFetch<{ profile: typeof profile }>('/api/v1/profile', {
      method: 'PUT',
      body: JSON.stringify({ ...profile, consentWithdrawn: !profile.consentWithdrawn }),
    });
    setProfileLocal(res.profile);
    setStatusMsg(res.profile.consentWithdrawn ? 'Personalization consent withdrawn.' : 'Personalization consent restored.');
  };

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Notifications, Profile &amp; Security Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Signed in as {user?.fullName} ({user?.email}) · Role: {user?.role}
        </p>
      </div>

      {statusMsg && <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200">{statusMsg}</div>}
      {errorMsg && <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-200">{errorMsg}</div>}

      {/* Notifications List + Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Alerts History
            </h2>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await apiFetch('/api/v1/notifications', { method: 'DELETE' });
                  setNotifications([]);
                }}
                className="text-xs text-slate-500 hover:text-red-600"
              >
                Clear All
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">No unread air quality alerts.</p>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-lg border text-xs ${
                    n.isRead
                      ? 'border-slate-200 dark:border-slate-800 opacity-70'
                      : 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{n.title}</span>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/v1/notifications/${n.id}/read`, { method: 'PATCH' });
                          loadAll();
                        }}
                        className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"
                      >
                        <Check className="w-3 h-3" /> Mark Read
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-6 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <h2 className="font-display text-base font-bold">Alert Thresholds &amp; Quiet Hours</h2>
          <form onSubmit={savePrefs} className="space-y-3 text-xs">
            <div>
              <label htmlFor="pref-thresh" className="block font-medium mb-1">
                Alert AQI Threshold ({prefs.aqiThreshold})
              </label>
              <input
                id="pref-thresh"
                type="range"
                min={50}
                max={400}
                step={10}
                value={prefs.aqiThreshold}
                onChange={(e) => setPrefs({ ...prefs, aqiThreshold: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="pref-qs" className="block font-medium mb-1">Quiet Start</label>
                <input
                  id="pref-qs"
                  type="time"
                  value={prefs.quietHoursStart}
                  onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label htmlFor="pref-qe" className="block font-medium mb-1">Quiet End</label>
                <input
                  id="pref-qe"
                  type="time"
                  value={prefs.quietHoursEnd}
                  onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label htmlFor="pref-tz" className="block font-medium mb-1">Timezone</label>
                <input
                  id="pref-tz"
                  value={prefs.timezone}
                  onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.inAppEnabled} onChange={(e) => setPrefs({ ...prefs, inAppEnabled: e.target.checked })} />
                In-app threshold notifications
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={prefs.unsubscribedAll} onChange={(e) => setPrefs({ ...prefs, unsubscribedAll: e.target.checked })} />
                Unsubscribe from all alerts
              </label>
            </div>
            <button type="submit" className="px-4 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg">
              Save Preferences
            </button>
          </form>
        </section>
      </div>

      {/* Appearance, Profile Edit & Consent */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <h2 className="font-display text-base font-bold">Profile, Language &amp; Privacy Controls</h2>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2">
            <span>Theme</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span>Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'hi' | 'gu')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="gu">Gujarati</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onEditOnboarding}
            className="px-3.5 py-1.5 font-semibold border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Edit Household &amp; Commute Profile
          </button>
          <button
            type="button"
            onClick={toggleConsent}
            className="px-3.5 py-1.5 font-medium border border-amber-400 text-amber-800 dark:text-amber-300 rounded-lg"
          >
            {profile?.consentWithdrawn ? 'Restore Personalization Consent' : 'Withdraw AI Personalization Consent'}
          </button>
        </div>
      </section>

      {/* Security: Password Change, Session Revocation & Account Deletion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <h2 className="font-display text-base font-bold">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
            <input
              type="password"
              required
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <input
              type="password"
              required
              placeholder="New password (8+ chars, upper, lower, digit)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <input
              type="password"
              required
              placeholder="Confirm new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <button type="submit" className="px-4 py-2 font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg">
              Update Password
            </button>
          </form>
        </section>

        <section className="lg:col-span-6 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <h2 className="font-display text-base font-bold">Active Sessions &amp; Account Deletion</h2>
          <div className="space-y-2 max-h-40 overflow-y-auto text-xs">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="truncate">
                  <span className="font-mono">{s.isCurrent ? 'Current Session' : 'Session'}</span>
                  <span className="text-slate-500 ml-2">{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
                {!s.revokedAt && !s.isCurrent && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/v1/auth/sessions/${s.id}`, { method: 'DELETE' });
                      loadAll();
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Permanently Delete Account
            </button>
          </div>
        </section>
      </div>

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-red-700 dark:text-red-400">
              Confirm Permanent Account Deletion
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              This removes your profile, AI conversations, activity history, and active sessions permanently. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeleteOpen(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch('/api/v1/auth/account', { method: 'DELETE' });
                  setConfirmDeleteOpen(false);
                  await logout();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-lg"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
