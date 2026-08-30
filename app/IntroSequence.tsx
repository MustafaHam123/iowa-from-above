"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const INTRO_STEPS = [
  { type: "text", content: "Every place has a story." },
  {
    type: "text",
    content: "But history means more when you can explore where it happened.",
  },
  {
    type: "text",
    content: "Take to the skies and discover Iowa from a new perspective.",
  },
  {
    type: "text",
    content: "Explore its landmarks, communities, history, and hidden stories.",
  },
  { type: "text", content: "Welcome to Iowa From Above." },
  { type: "image", content: "Congressional App Challenge 2026" },
] as const;

const BLACK_GAP_MS = 350;
const CONTENT_HOLD_MS = 2_400;
const LOGO_HOLD_MS = 4_000;
const CONTENT_FADE_MS = 750;
const OVERLAY_FADE_MS = 1_000;
const SKIP_PROGRESS_MS = 3_000;

export default function IntroSequence() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isRemoved, setIsRemoved] = useState(false);
  const [isSkipRunning, setIsSkipRunning] = useState(false);
  const [skipProgress, setSkipProgress] = useState(0);

  useEffect(() => {
    if (!isOverlayVisible) {
      const removeTimer = window.setTimeout(() => {
        setIsRemoved(true);
        window.dispatchEvent(new Event("iowa-intro-complete"));
      }, OVERLAY_FADE_MS);

      return () => window.clearTimeout(removeTimer);
    }

    if (isSkipRunning) {
      return;
    }

    const holdMs =
      INTRO_STEPS[stepIndex].type === "image"
        ? LOGO_HOLD_MS
        : CONTENT_HOLD_MS;
    const showTimer = window.setTimeout(
      () => setIsContentVisible(true),
      BLACK_GAP_MS,
    );
    const hideTimer = window.setTimeout(
      () => setIsContentVisible(false),
      BLACK_GAP_MS + holdMs,
    );
    const advanceTimer = window.setTimeout(() => {
      if (stepIndex === INTRO_STEPS.length - 1) {
        setIsOverlayVisible(false);
        return;
      }

      setStepIndex((currentStep) => currentStep + 1);
    }, BLACK_GAP_MS + holdMs + CONTENT_FADE_MS);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [isOverlayVisible, isSkipRunning, stepIndex]);

  useEffect(() => {
    if (!isSkipRunning || !isOverlayVisible) {
      return;
    }

    const startedAt = performance.now();
    const progressTimer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setSkipProgress(Math.min((elapsed / SKIP_PROGRESS_MS) * 100, 100));
    }, 30);
    const finishTimer = window.setTimeout(() => {
      setSkipProgress(100);
      setIsContentVisible(false);
      setIsOverlayVisible(false);
    }, SKIP_PROGRESS_MS);

    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(finishTimer);
    };
  }, [isOverlayVisible, isSkipRunning]);

  function startSkipping() {
    if (!isSkipRunning) {
      setSkipProgress(0);
      setIsSkipRunning(true);
    }
  }

  function cancelSkipping() {
    if (isSkipRunning && isOverlayVisible) {
      setIsSkipRunning(false);
      setSkipProgress(0);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsContentVisible(false);
        setIsOverlayVisible(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isRemoved) {
    return null;
  }

  const step = INTRO_STEPS[stepIndex];

  return (
    <section
      role="dialog"
      aria-label="Iowa From Above introduction"
      aria-modal="true"
      className={`fixed inset-0 z-[2147483647] grid place-items-center overflow-hidden bg-black transition-opacity duration-1000 motion-reduce:duration-0 ${
        isOverlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <button
        type="button"
        onPointerDown={startSkipping}
        onPointerUp={cancelSkipping}
        onPointerCancel={cancelSkipping}
        onPointerLeave={cancelSkipping}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") startSkipping();
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") cancelSkipping();
        }}
        onClick={(event) => event.preventDefault()}
        className="absolute bottom-7 left-1/2 z-10 w-44 -translate-x-1/2 touch-none select-none font-mono text-[11px] text-white/65 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        <span>{isSkipRunning ? "Keep holding..." : "Hold to skip intro"}</span>
        <span
          role="progressbar"
          aria-label="Skip intro progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(skipProgress)}
          className="mt-2 block h-1 overflow-hidden rounded-full bg-white/15"
        >
          <span
            className="block h-full rounded-full bg-white"
            style={{ width: `${skipProgress}%` }}
          />
        </span>
      </button>

      <div
        aria-live="polite"
        className={`grid w-full place-items-center px-6 transition-opacity duration-700 ease-in-out motion-reduce:duration-0 ${
          isContentVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {step.type === "text" ? (
          <p className="max-w-3xl text-center font-serif text-2xl leading-relaxed tracking-normal text-white sm:text-4xl">
            {step.content}
          </p>
        ) : null}
        <Image
          src="/intro/congressional-app-challenge-2026.png"
          alt={step.type === "image" ? step.content : ""}
          width={800}
          height={450}
          preload
          unoptimized
          className={`h-auto w-[88vw] max-w-[800px] object-contain ${
            step.type === "image"
              ? "block"
              : "pointer-events-none absolute opacity-0"
          }`}
        />
      </div>
    </section>
  );
}
