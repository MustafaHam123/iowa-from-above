"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const OUTRO_STEPS = ["thanks", "logo", "actions"] as const;
const BLACK_GAP_MS = 220;
const THANKS_HOLD_MS = 1_150;
const LOGO_HOLD_MS = 1_450;
const CONTENT_FADE_MS = 420;
const OVERLAY_FADE_MS = 500;

type OutroSequenceProps = {
  onReplay: () => void;
  onVisitAddress: () => void;
};

export default function OutroSequence({
  onReplay,
  onVisitAddress,
}: OutroSequenceProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  useEffect(() => {
    const showOverlayTimer = window.setTimeout(
      () => setIsOverlayVisible(true),
      0,
    );
    return () => window.clearTimeout(showOverlayTimer);
  }, []);

  useEffect(() => {
    const step = OUTRO_STEPS[stepIndex];
    const showTimer = window.setTimeout(
      () => setIsContentVisible(true),
      BLACK_GAP_MS,
    );

    if (step === "actions") {
      return () => window.clearTimeout(showTimer);
    }

    const holdMs = step === "thanks" ? THANKS_HOLD_MS : LOGO_HOLD_MS;
    const hideTimer = window.setTimeout(
      () => setIsContentVisible(false),
      BLACK_GAP_MS + holdMs,
    );
    const advanceTimer = window.setTimeout(
      () => setStepIndex((currentStep) => currentStep + 1),
      BLACK_GAP_MS + holdMs + CONTENT_FADE_MS,
    );

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [stepIndex]);

  function leaveOutro(action: () => void) {
    setIsContentVisible(false);
    setIsOverlayVisible(false);
    window.setTimeout(action, OVERLAY_FADE_MS);
  }

  const step = OUTRO_STEPS[stepIndex];

  return (
    <section
      role="dialog"
      aria-label="Iowa From Above journey complete"
      aria-modal="true"
      className={`fixed inset-0 z-[2147483646] grid place-items-center overflow-hidden bg-black px-6 transition-opacity duration-500 motion-reduce:duration-0 ${
        isOverlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        aria-live="polite"
        className={`grid w-full place-items-center transition-opacity duration-[420ms] ease-in-out motion-reduce:duration-0 ${
          isContentVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {step === "thanks" && (
          <p className="max-w-3xl text-center font-serif text-3xl leading-relaxed text-white sm:text-5xl">
            Thanks for playing.
          </p>
        )}

        <Image
          src="/intro/congressional-app-challenge-2026.png"
          alt={step === "logo" ? "Congressional App Challenge 2026" : ""}
          width={800}
          height={450}
          unoptimized
          className={`h-auto w-[88vw] max-w-[760px] object-contain ${
            step === "logo"
              ? "block"
              : "pointer-events-none absolute opacity-0"
          }`}
        />

        {step === "actions" && (
          <div className="grid max-w-xl place-items-center text-center text-white">
            <p className="font-serif text-3xl leading-tight sm:text-5xl">
              Keep exploring from above.
            </p>
            <p className="mt-4 max-w-md text-base leading-7 text-white/65 sm:text-lg">
              Replay the journey, or use the map to fly to any Iowa address.
            </p>
            <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <button
                type="button"
                autoFocus
                onClick={() => leaveOutro(onReplay)}
                className="min-h-12 rounded-sm border border-white bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Replay the journey
              </button>
              <button
                type="button"
                onClick={() => leaveOutro(onVisitAddress)}
                className="min-h-12 rounded-sm border border-white/35 bg-white/5 px-6 py-3 font-medium text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Visit my Iowa address
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
