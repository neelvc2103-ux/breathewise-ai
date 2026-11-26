import React, { useEffect, useState } from 'react';
import { AlertCircle, Compass, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AssistantReply, StructuredRecommendation } from '../types/domain';
import { PlacesGroundingPanel } from '../components/maps/PlacesGroundingPanel';

interface ChatTurn {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  recommendations?: StructuredRecommendation[];
  providerUsed?: string | null;
  fallbackReason?: string;
  groundedSnapshot?: AssistantReply['groundedDataSnapshot'];
}

const EXAMPLE_PROMPTS = [
  'Is it safe to go for a morning walk today?',
  'When should I open my windows?',
  'How can I reduce indoor pollution without buying an expensive purifier?',
  'Should I travel by car, bicycle, or metro today?',
  'How much CO2 can I avoid by changing my commute?',
];

export function AssistantPage() {
  const { apiFetch, selectedLocation, demoScenario, t } = useAuth();
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; city: string }>>([]);
  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [assistantMode, setAssistantMode] = useState<'qa' | 'places'>('qa');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const loadConversations = async () => {
    try {
      const res = await apiFetch<{ conversations: typeof conversations }>('/api/v1/assistant/conversations');
      setConversations(res.conversations);
    } catch {
      // Ignore initial empty
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversationMessages = async (convId: string) => {
    setActiveConvId(convId);
    setError('');
    try {
      const res = await apiFetch<{
        messages: Array<{
          id: string;
          sender: 'user' | 'assistant';
          contentText: string;
          recommendations: StructuredRecommendation[];
          providerUsed: string | null;
        }>;
      }>(`/api/v1/assistant/conversations/${convId}`);
      setTurns(
        res.messages.map((m) => ({
          id: m.id,
          sender: m.sender,
          text: m.contentText,
          recommendations: m.recommendations,
          providerUsed: m.providerUsed,
        })),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSend = async (promptText?: string) => {
    const msg = (promptText ?? input).trim();
    if (!msg || sending) return;
    setError('');
    setSending(true);
    if (!promptText) setInput('');

    const tempUserId = `u-${Date.now()}`;
    setTurns((prev) => [...prev, { id: tempUserId, sender: 'user', text: msg }]);

    try {
      const reply = await apiFetch<AssistantReply>('/api/v1/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: msg,
          conversationId: activeConvId,
          city: selectedLocation.city,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          standard: selectedLocation.standard,
          demoScenario,
        }),
      });
      setActiveConvId(reply.conversationId);
      setTurns((prev) => [
        ...prev,
        {
          id: reply.messageId,
          sender: 'assistant',
          text: reply.summary,
          recommendations: reply.recommendations,
          providerUsed: reply.providerUsed,
          fallbackReason: reply.fallbackReason,
          groundedSnapshot: reply.groundedDataSnapshot,
        },
      ]);
      loadConversations();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Conversation History Sidebar */}
      <aside className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold">Conversations</h2>
          <button
            type="button"
            onClick={() => {
              setActiveConvId(undefined);
              setTurns([]);
            }}
            className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            New Chat
          </button>
        </div>
        {conversations.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ask a question to start a grounded environmental conversation.
          </p>
        ) : (
          <div className="space-y-1.5">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => loadConversationMessages(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  activeConvId === c.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-medium'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="truncate">{c.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{c.city}</div>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Main Assistant Chat */}
      <section className="lg:col-span-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              BreatheWise AI Personal Assistant
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Grounded in {selectedLocation.city} ({selectedLocation.standard}) · {t.medicalDisclaimer}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setAssistantMode('qa')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                assistantMode === 'qa'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" /> AQI &amp; Routine Q&amp;A
            </button>
            <button
              type="button"
              onClick={() => setAssistantMode('places')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                assistantMode === 'places'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" /> Nearby Places (Maps)
            </button>
          </div>
        </div>

        {assistantMode === 'places' ? (
          <PlacesGroundingPanel userCoords={userCoords} onUserCoordsChange={setUserCoords} />
        ) : (
          <>
            {/* Example Question Starters */}
            <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending}
              onClick={() => handleSend(q)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-emerald-600 text-slate-700 dark:text-slate-300 text-left"
            >
              {q}
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> {error}
          </div>
        )}

        {/* Messages */}
        <div className="space-y-5 min-h-[260px]">
          {turns.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Select a suggested question above or ask about outdoor exercise, ventilation timing, school commutes, or winter smog preparedness.
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className={turn.sender === 'user' ? 'flex justify-end' : 'space-y-3'}>
              {turn.sender === 'user' ? (
                <div className="max-w-xl px-4 py-3 rounded-xl bg-emerald-700 text-white text-sm">
                  {turn.text}
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {turn.providerUsed === 'gemini' ? 'Gemini AI (Grounded)' : 'Deterministic Guidance Engine'}
                      {turn.groundedSnapshot
                        ? ` · ${turn.groundedSnapshot.city} AQI ${turn.groundedSnapshot.aqi} (${turn.groundedSnapshot.category})`
                        : ''}
                    </span>
                  </div>

                  {turn.fallbackReason && (
                    <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
                      {turn.fallbackReason}
                    </div>
                  )}

                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{turn.text}</p>

                  {turn.recommendations && turn.recommendations.length > 0 && (
                    <div className="grid grid-cols-1 gap-4">
                      {turn.recommendations.map((rec, idx) => (
                        <div
                          key={`${turn.id}-rec-${idx}`}
                          className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                              {rec.title}
                            </h3>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {rec.difficultyLevel} · {rec.estimatedCost} · {rec.recommendedTime}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                            Action: {rec.suggestedAction}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-1">
                            <div><strong>Reason:</strong> {rec.reason}</div>
                            <div><strong>Personal Relevance:</strong> {rec.personalRelevance}</div>
                            <div><strong>Exposure Benefit:</strong> {rec.exposureBenefit}</div>
                            <div><strong>Environmental Benefit:</strong> {rec.environmentalBenefit}</div>
                            <div><strong>Source:</strong> {rec.supportingSource}</div>
                            <div><strong>Limitations:</strong> {rec.uncertaintyOrLimitations}</div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-amber-800 dark:text-amber-300">
                            Safety Precaution: {rec.safetyPrecautions}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 animate-pulse">
              Analyzing local AQI, hourly forecast, and your household preferences...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800"
        >
          <label htmlFor="assistant-input" className="sr-only">Ask BreatheWise AI a question</label>
          <input
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about morning walks, window ventilation, school commutes, or winter smog..."
            className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          <button
            type="submit"
            disabled={sending || input.trim().length < 2}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" aria-hidden="true" /> Send
          </button>
        </form>
          </>
        )}
      </section>
    </div>
  );
}
