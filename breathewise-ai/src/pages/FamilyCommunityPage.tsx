import React, { useEffect, useState } from 'react';
import { Award, Flag, Home, Trophy, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ChallengeItem, CommunityPostItem, HouseholdSummary } from '../types/domain';

export function FamilyPage() {
  const { apiFetch, user, selectedLocation } = useAuth();
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [incoming, setIncoming] = useState<
    Array<{ id: string; raw_preview_token: string; role: string; household_name: string; city: string }>
  >([]);
  const [hhName, setHhName] = useState('');
  const [hhCity, setHhCity] = useState(selectedLocation.city);
  const [hhGoal, setHhGoal] = useState('Shift 50% of weekly commutes to public transit');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'FAMILY_MEMBER' | 'FAMILY_ADMIN'>('FAMILY_MEMBER');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadHouseholds = async () => {
    try {
      const res = await apiFetch<{ households: HouseholdSummary[]; incomingInvitations: typeof incoming }>('/api/v1/households');
      setHouseholds(res.households);
      setIncoming(res.incomingInvitations || []);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  useEffect(() => {
    loadHouseholds();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await apiFetch('/api/v1/households', {
        method: 'POST',
        body: JSON.stringify({ name: hhName, city: hhCity, sharedGoal: hhGoal }),
      });
      setHhName('');
      setStatusMsg('Household created.');
      loadHouseholds();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleInvite = async (hhId: string, e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await apiFetch<{ invitationToken: string }>(`/api/v1/households/${hhId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setInviteEmail('');
      setStatusMsg(`Invitation issued (preview token: ${res.invitationToken}).`);
      loadHouseholds();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleRespondInvite = async (token: string, accept: boolean) => {
    try {
      await apiFetch(`/api/v1/households/invitations/${token}/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept }),
      });
      loadHouseholds();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Family &amp; Household Management
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Coordinate shared sustainability goals and combined household impact while keeping individual private chats isolated.
        </p>
      </div>

      {statusMsg && <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200">{statusMsg}</div>}
      {errorMsg && <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-200">{errorMsg}</div>}

      {incoming.length > 0 && (
        <div className="p-5 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/60 dark:bg-teal-950/30 space-y-3">
          <h2 className="font-display text-sm font-bold">Incoming Household Invitations</h2>
          {incoming.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span>
                Invited to <strong>{inv.household_name}</strong> ({inv.city}) as {inv.role}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRespondInvite(inv.raw_preview_token, true)}
                  className="px-3 py-1.5 font-semibold text-white bg-emerald-700 rounded-lg"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleRespondInvite(inv.raw_preview_token, false)}
                  className="px-3 py-1.5 font-medium border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {households.map((hh) => {
        const isAdmin = hh.members.some((m) => m.userId === user?.id && m.householdRole === 'FAMILY_ADMIN');
        return (
          <section key={hh.id} className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" aria-hidden="true" /> {hh.city} Household
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5">{hh.name}</h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Shared Goal: {hh.sharedGoal}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Combined Avoided CO2e</div>
                <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {hh.combinedImpactKg} kg
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Household Members</h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {hh.members.map((m) => (
                  <div key={m.userId} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">{m.fullName}</span>
                      <span className="text-slate-500 dark:text-slate-400 ml-2">{m.email}</span>
                    </div>
                    <span className="font-mono text-slate-600 dark:text-slate-400">{m.householdRole}</span>
                  </div>
                ))}
              </div>
            </div>

            {isAdmin && (
              <form onSubmit={(e) => handleInvite(hh.id, e)} className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor={`inv-${hh.id}`} className="block text-xs font-medium mb-1">Invite Adult Family Member (Email)</label>
                  <input
                    id={`inv-${hh.id}`}
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="member@example.com"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label htmlFor={`inv-role-${hh.id}`} className="block text-xs font-medium mb-1">Role</label>
                  <select
                    id={`inv-role-${hh.id}`}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'FAMILY_MEMBER' | 'FAMILY_ADMIN')}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="FAMILY_MEMBER">Family Member</option>
                    <option value="FAMILY_ADMIN">Family Admin</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" /> Send Invite
                </button>
              </form>
            )}
          </section>
        );
      })}

      <section className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <h2 className="font-display text-base font-bold flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          Create a New Household
        </h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="hh-name" className="block text-xs font-medium mb-1">Household Name</label>
            <input
              id="hh-name"
              required
              value={hhName}
              onChange={(e) => setHhName(e.target.value)}
              placeholder="e.g. Patel Residence"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label htmlFor="hh-city" className="block text-xs font-medium mb-1">City</label>
            <input
              id="hh-city"
              required
              value={hhCity}
              onChange={(e) => setHhCity(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label htmlFor="hh-goal" className="block text-xs font-medium mb-1">Shared Sustainability Goal</label>
            <input
              id="hh-goal"
              required
              value={hhGoal}
              onChange={(e) => setHhGoal(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <button type="submit" className="sm:col-span-3 w-fit px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg">
            Create Household
          </button>
        </form>
      </section>
    </div>
  );
}

export function CommunityPage() {
  const { apiFetch, selectedLocation } = useAuth();
  const [posts, setPosts] = useState<CommunityPostItem[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [achievements, setAchievements] = useState<Array<{ id: string; title: string; description: string; unlockedAt: string | null }>>([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'discussion' | 'initiative' | 'announcement' | 'unverified_report'>('discussion');
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [msg, setMsg] = useState('');

  const loadAll = async () => {
    const [pRes, cRes, aRes] = await Promise.all([
      apiFetch<{ posts: CommunityPostItem[] }>('/api/v1/communities/posts'),
      apiFetch<{ challenges: ChallengeItem[] }>('/api/v1/challenges'),
      apiFetch<{ achievements: typeof achievements }>('/api/v1/achievements'),
    ]);
    setPosts(pRes.posts);
    setChallenges(cRes.challenges);
    setAchievements(aRes.achievements);
  };

  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/v1/communities/posts', {
      method: 'POST',
      body: JSON.stringify({ city: selectedLocation.city, title, content, category }),
    });
    setTitle('');
    setContent('');
    setMsg('Post published to your local community.');
    loadAll();
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTargetId) return;
    await apiFetch('/api/v1/communities/reports', {
      method: 'POST',
      body: JSON.stringify({ postId: reportTargetId, reason: reportReason }),
    });
    setReportTargetId(null);
    setReportReason('');
    setMsg('Content reported for moderator review.');
  };

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Community, Challenges &amp; Milestones
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Privacy-preserving neighborhood initiatives without revealing exact residential addresses.
        </p>
      </div>

      {msg && <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200">{msg}</div>}

      {/* Challenges */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          Voluntary Low-Emission Challenges
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {challenges.map((ch) => {
            const pct = Math.min(100, Math.round((ch.userProgress / ch.targetValue) * 100));
            return (
              <div key={ch.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {ch.city} · {ch.participantCount} participants
                </div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{ch.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">{ch.description}</p>
                <p className="text-xs text-amber-800 dark:text-amber-300">Safety Note: {ch.safetyNote}</p>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono tabular-nums">
                    <span>Your Progress: {ch.userProgress} / {ch.targetValue} {ch.targetUnit}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-sm overflow-hidden">
                    <div className="h-full bg-emerald-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  {!ch.joined ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/v1/challenges/${ch.id}/join`, { method: 'POST' });
                        loadAll();
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg"
                    >
                      Join Challenge
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/v1/challenges/${ch.id}/progress`, {
                          method: 'POST',
                          body: JSON.stringify({ amount: 1 }),
                        });
                        loadAll();
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 border border-emerald-600 rounded-lg"
                    >
                      +1 {ch.targetUnit} Completed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Community Discussions & Unverified Reports */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 h-fit">
          <h2 className="font-display text-base font-bold">Share with {selectedLocation.city} Community</h2>
          <form onSubmit={handleCreatePost} className="space-y-3">
            <div>
              <label htmlFor="post-cat" className="block text-xs font-medium mb-1">Post Type</label>
              <select
                id="post-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="discussion">Discussion / Tip</option>
                <option value="initiative">Local Initiative / Carpool</option>
                <option value="unverified_report">Unverified Pollution Observation</option>
              </select>
            </div>
            <div>
              <label htmlFor="post-title" className="block text-xs font-medium mb-1">Title</label>
              <input
                id="post-title"
                required
                minLength={4}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label htmlFor="post-body" className="block text-xs font-medium mb-1">Details (No exact home addresses)</label>
              <textarea
                id="post-body"
                required
                minLength={10}
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <button type="submit" className="w-full py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg">
              Publish Post
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-3">
          {posts.map((p) => (
            <article key={p.id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {p.city} · {p.authorName} ·{' '}
                  {p.category === 'unverified_report' && !p.isVerified
                    ? 'Unverified Community Report'
                    : p.category.replace('_', ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => setReportTargetId(p.id)}
                  className="inline-flex items-center gap-1 hover:text-red-600"
                >
                  <Flag className="w-3 h-3" aria-hidden="true" /> Report
                </button>
              </div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">{p.title}</h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{p.content}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Achievements */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          Sustainability Milestones
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={`p-4 rounded-xl border ${
                a.unlockedAt
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75'
              }`}
            >
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {a.unlockedAt ? `Earned ${new Date(a.unlockedAt).toLocaleDateString()}` : 'In Progress'}
              </div>
              <h3 className="font-display text-sm font-bold mt-1">{a.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{a.description}</p>
            </div>
          ))}
        </div>
      </section>

      {reportTargetId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleReport} className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="font-display text-base font-bold">Report Community Post</h3>
            <textarea
              required
              minLength={5}
              rows={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Explain why this post is misleading, unsafe, or inappropriate..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReportTargetId(null)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700">
                Cancel
              </button>
              <button type="submit" className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 rounded-lg">
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
