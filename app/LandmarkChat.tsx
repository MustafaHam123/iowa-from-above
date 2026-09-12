"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Exhibit } from "./exhibits";
import type { JourneyPhase } from "./journeyStops";

type ChatMessage = { role: "user" | "assistant"; text: string };

const SUGGESTED_QUESTIONS = [
  "Why is this place important?",
  "What should I notice from above?",
  "Tell me one surprising fact.",
] as const;

export default function LandmarkChat({
  exhibit,
  phase,
}: {
  exhibit: Exhibit;
  phase: JourneyPhase;
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isManuallyOpen, setIsManuallyOpen] = useState(false);
  const [isCinematicDismissed, setIsCinematicDismissed] = useState(false);
  const [showQuizLock, setShowQuizLock] = useState(false);
  const isQuizActive = phase === "question";
  const isOpen = !isQuizActive && (
    phase === "cinematic" ? !isCinematicDismissed : isManuallyOpen
  );

  useEffect(() => {
    if (!showQuizLock) return;
    const timer = window.setTimeout(() => setShowQuizLock(false), 2400);
    return () => window.clearTimeout(timer);
  }, [showQuizLock]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (phase === "cinematic") setIsCinematicDismissed(true);
        else setIsManuallyOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, phase]);

  function toggleChat() {
    if (isQuizActive) {
      setShowQuizLock(false);
      window.requestAnimationFrame(() => setShowQuizLock(true));
      return;
    }

    setShowQuizLock(false);
    if (phase === "cinematic") {
      setIsCinematicDismissed(isOpen);
    } else {
      setIsManuallyOpen(!isOpen);
    }
  }

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
    <aside
      id="landmark-chat-panel"
      aria-label={`Ask about ${exhibit.name}`}
      className={`landmark-chat journey-panel absolute right-3 top-1/2 z-20 w-[min(18rem,calc(100vw-1.5rem))] px-5 py-4 text-white sm:right-5 ${isOpen ? "landmark-chat--open" : "landmark-chat--collapsed"} ${isQuizActive ? "landmark-chat--quiz-locked" : ""}`}
    >
      <button
        type="button"
        className="landmark-chat__toggle"
        aria-label={isQuizActive
          ? "Avery chat cannot open during the quiz"
          : isOpen
            ? "Collapse Avery chat"
            : "Open Avery chat"}
        aria-expanded={isOpen}
        aria-disabled={isQuizActive}
        aria-controls="landmark-chat-panel"
        onClick={toggleChat}
      >
        <svg viewBox="0 0 12 20" aria-hidden="true">
          <path d={isOpen ? "M3 2l6 8-6 8" : "M9 2l-6 8 6 8"} />
        </svg>
      </button>

      {showQuizLock && (
        <p className="landmark-chat__quiz-notice" role="status">
          Cannot open during quiz.
        </p>
      )}

      {isOpen && (
        <div className="landmark-chat__body">
        <header className="landmark-chat__header">
          <h2>Ask Avery</h2>
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
        </div>
      )}
    </aside>
  );
}
