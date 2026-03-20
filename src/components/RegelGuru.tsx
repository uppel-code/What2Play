"use client";

import { useState, useEffect, useRef } from "react";
import type { Game, ChatMessage } from "@/types/game";
import { COMMON_MECHANICS } from "@/types/game";
import { askRuleQuestion } from "@/services/ai-client";
import { getChatMessages, addChatMessage, clearChatMessages, trimChatMessages } from "@/lib/db-client";

const SUGGESTION_CHIPS = [
  "Spielaufbau?",
  "Siegbedingung?",
  "Was mache ich in meinem Zug?",
];

export default function RegelGuru({ game }: { game: Game }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const MESSAGE_LIMIT = 50;

  // BUG-22: Load chat history with pagination
  useEffect(() => {
    getChatMessages(game.id).then((msgs) => {
      setAllMessages(msgs);
      setMessages(msgs.slice(-MESSAGE_LIMIT));
    });
  }, [game.id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (sheetOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sheetOpen]);

  // Focus input when sheet opens
  useEffect(() => {
    if (sheetOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [sheetOpen]);

  const mechanicLabels = game.mechanics.map((m) => {
    const known = COMMON_MECHANICS.find((k) => k.value === m);
    return known ? known.label : m;
  });

  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return;

    setError(null);
    setInput("");
    setSheetOpen(true);

    // Add user message
    const userMsg = await addChatMessage(game.id, "user", question.trim());
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build history for context
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      const answer = await askRuleQuestion(game.name, mechanicLabels, question.trim(), history);

      // Add assistant message
      const assistantMsg = await addChatMessage(game.id, "assistant", answer);
      setMessages((prev) => [...prev, assistantMsg]);

      // Trim to max 10 messages
      await trimChatMessages(game.id, 10);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      if (msg === "AI_NOT_CONFIGURED") {
        setError("AI ist nicht konfiguriert. Bitte richte in den Einstellungen einen AI-Provider ein.");
      } else if (msg === "AI_RATE_LIMIT") {
        setError("Zu viele Anfragen. Bitte versuche es in einer Minute erneut.");
      } else if (msg.startsWith("AI_INVALID_KEY")) {
        setError("Ungültiger API-Key. Bitte prüfe deine Einstellungen.");
      } else {
        setError("Antwort konnte nicht geladen werden. Bitte versuche es erneut.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleClearChat() {
    await clearChatMessages(game.id);
    setMessages([]);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendQuestion(input);
  }

  const lastQuestion = messages.filter((m) => m.role === "user").slice(-1)[0];

  return (
    <>
      {/* Inline Card */}
      <div className="mt-5 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-warm-200/60">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧙</span>
          <h3 className="font-display text-sm font-bold text-warm-900">Regelguru</h3>
        </div>

        {lastQuestion && (
          <button
            onClick={() => setSheetOpen(true)}
            className="mt-2 w-full text-left text-xs text-warm-500 truncate hover:text-warm-700 transition-colors"
          >
            Letzte Frage: {lastQuestion.text}
          </button>
        )}

        {/* Suggestion Chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => sendQuestion(chip)}
              disabled={loading}
              className="rounded-xl bg-forest-light px-3 py-1.5 text-xs font-medium text-forest transition-all hover:bg-forest hover:text-white active:scale-[0.97] disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Eigene Frage stellen..."
            disabled={loading}
            className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            Fragen
          </button>
        </form>
      </div>

      {/* Bottom Sheet */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-warm-900/60 backdrop-blur-sm animate-picker-fade-in"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-lg rounded-t-2xl bg-surface shadow-2xl animate-sheet-up flex flex-col"
            style={{ maxHeight: "70vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-warm-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧙</span>
                <h2 className="font-display text-lg font-bold text-warm-900">Regelguru</h2>
                <span className="text-sm text-warm-500">– {game.name}</span>
              </div>
              <button
                onClick={() => setSheetOpen(false)}
                className="rounded-lg p-1.5 text-warm-400 transition-colors hover:bg-warm-100 hover:text-warm-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 pb-3 scrollbar-hide">
              {messages.length === 0 && !loading && (
                <p className="py-8 text-center text-sm text-warm-400">
                  Stelle eine Frage zu den Regeln von {game.name}
                </p>
              )}

              {!showAll && allMessages.length > MESSAGE_LIMIT && (
                <button
                  onClick={() => { setMessages(allMessages); setShowAll(true); }}
                  className="mb-3 w-full rounded-xl bg-warm-100 py-2 text-xs font-medium text-warm-500 hover:bg-warm-200"
                >
                  Ältere Nachrichten laden ({allMessages.length - MESSAGE_LIMIT} weitere)
                </button>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-3 ${msg.role === "user" ? "flex justify-end" : ""}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-forest text-white rounded-br-md"
                        : "bg-warm-50 text-warm-800 ring-1 ring-warm-200/60 rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="mb-3">
                  <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-warm-50 px-4 py-3 ring-1 ring-warm-200/60">
                    <span className="typing-dot" />
                    <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
                    <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mb-3 rounded-xl bg-coral-light p-3 text-sm text-coral">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom actions & input */}
            <div className="border-t border-warm-100 px-5 py-3">
              {/* Quick chips in sheet */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => sendQuestion(chip)}
                    disabled={loading}
                    className="rounded-xl bg-forest-light px-2.5 py-1 text-xs font-medium text-forest transition-all hover:bg-forest hover:text-white active:scale-[0.97] disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Frage stellen..."
                  disabled={loading}
                  className="flex-1 rounded-xl border border-warm-200 bg-warm-50/50 px-3 py-2.5 text-sm text-warm-800 placeholder:text-warm-400 transition-colors focus:border-forest focus:bg-surface focus:outline-none focus:ring-2 focus:ring-forest/10 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </form>

              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="mt-2 w-full text-center text-xs text-warm-400 transition-colors hover:text-coral"
                >
                  Chat leeren
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
