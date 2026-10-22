"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { loadJourneyCheckpoint } from "./journeyProgress";
import { loadFlightSession } from "./flightSession";
import { previewPlaceId } from "./companionLinks";

const INTRO_STEPS = [
  { type: "text", content: "Iowa From Above", holdMs: 1_200 },
  {
    type: "text",
    content: "Nitrate pollution. Soil loss. Flooding. Iowa’s water problems reach far downstream.",
    holdMs: 4_200,
  },
  {
    type: "text",
    content: "Follow the water. See what can help.",
    holdMs: 2_200,
  },
  { type: "image", content: "Congressional App Challenge 2026", holdMs: 1_800 },
] as const;

const BLACK_GAP_MS = 350;
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
    if (!loadJourneyCheckpoint() && !loadFlightSession() && !previewPlaceId()) {
      return;
    }

    const restoreTimer = window.setTimeout(() => {
      setIsRemoved(true);
      window.dispatchEvent(new Event("iowa-intro-complete"));
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

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

    const holdMs = INTRO_STEPS[stepIndex].holdMs;
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
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (!event.repeat) {
          setSkipProgress(0);
          setIsSkipRunning(true);
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Enter") {
        event.preventDefault();
        setIsSkipRunning(false);
        setSkipProgress(0);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
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
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        startSkipping();
      }}
      onPointerUp={cancelSkipping}
      onPointerCancel={cancelSkipping}
      className={`fixed inset-0 z-[2147483646] grid touch-none select-none place-items-center overflow-hidden bg-black transition-opacity duration-1000 motion-reduce:duration-0 ${
        isOverlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        className="pointer-events-none absolute bottom-7 left-1/2 z-10 w-52 -translate-x-1/2 text-center font-mono text-[11px] text-white/65"
      >
        <span>
          {isSkipRunning ? "Keep holding..." : "Hold anywhere to skip"}
        </span>
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
      </div>

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
          alt="Congressional App Challenge 2026 logo"
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
