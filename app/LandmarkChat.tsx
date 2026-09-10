"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Exhibit } from "./exhibits";

type ChatMessage = { role: "user" | "assistant"; text: string };

const SUGGESTED_QUESTIONS = [
  "Why is this place important?",
  "What should I notice from above?",
  "Tell me one surprising fact.",
] as const;

export default function LandmarkChat({ exhibit }: { exhibit: Exhibit }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobileOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMobileOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileOpen]);

  async function ask(nextQuestion: string) {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion || isLoading) return;

    setQuestion("");
    setIsLoading(true);
    setMessages((current) => [...current, { role: "user", text: cleanQuestion }]);

    try {
      const response = await fetch("/api/landmark-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exhibitId: exhibit.id, question: cleanQuestion }),
      });
      const payload = await response.json() as { answer?: string; error?: string };
      setMessages((current) => [...current, {
        role: "assistant",
        text: response.ok && payload.answer
          ? payload.answer
          : payload.error || "The landmark guide is unavailable right now.",
      }]);
    } catch {
      setMessages((current) => [...current, {
        role: "assistant",
        text: "The landmark guide is unavailable right now.",
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <>
      <button
        type="button"
        className={`landmark-chat-launcher ${isMobileOpen ? "landmark-chat-launcher--hidden" : ""}`}
        aria-expanded={isMobileOpen}
        aria-controls="landmark-chat-panel"
        onClick={() => setIsMobileOpen(true)}
      >
        Chat with Avery
      </button>
      <aside
        id="landmark-chat-panel"
        aria-label={`Ask about ${exhibit.name}`}
        className={`landmark-chat journey-panel absolute right-3 top-1/2 z-20 w-[min(18rem,calc(100vw-1.5rem))] -translate-y-1/2 px-5 py-4 text-white sm:right-5 ${isMobileOpen ? "landmark-chat--mobile-open" : ""}`}
      >
        <header className="landmark-chat__header">
          <h2>Ask Avery</h2>
          <button
            type="button"
            className="landmark-chat__close"
            aria-label="Close Avery chat"
            onClick={() => setIsMobileOpen(false)}
          >
            ×
          </button>
        </header>

        {messages.length > 0 && (
          <div className="landmark-chat__messages" aria-live="polite">
            {messages.slice(-4).map((message, index) => (
              <p key={`${message.role}-${index}`} data-role={message.role}>{message.text}</p>
            ))}
            {isLoading && <p data-role="assistant">Thinking…</p>}
          </div>
        )}

        {messages.length === 0 && (
          <div className="landmark-chat__suggestions">
            {SUGGESTED_QUESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form className="landmark-chat__form" onSubmit={submit}>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={300}
            placeholder="Ask about this place"
            aria-label={`Question about ${exhibit.name}`}
          />
          <button type="submit" disabled={isLoading || !question.trim()} aria-label="Ask question">↑</button>
        </form>
      </aside>
    </>
  );
}
