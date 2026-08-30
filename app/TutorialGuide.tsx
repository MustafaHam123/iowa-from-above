"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

const TUTORIAL_STEPS: Array<{
  key: string;
  keyLabel: string;
  holdMs: number;
  audioSrc: string;
  message: string;
}> = [
  {
    key: "enter",
    keyLabel: "Enter",
    holdMs: 0,
    audioSrc: "/audio/tutorial/01-introduction.mp3",
    message: "Hey, I'm Avery. I'll guide you while we explore Iowa from above.",
  },
  { key: "w", keyLabel: "W", holdMs: 1_500, audioSrc: "/audio/tutorial/02-forward.mp3", message: "Hold W to fly forward." },
  { key: "s", keyLabel: "S", holdMs: 1_500, audioSrc: "/audio/tutorial/03-backward.mp3", message: "Now hold S to fly backward." },
  { key: "a", keyLabel: "A", holdMs: 1_500, audioSrc: "/audio/tutorial/04-left.mp3", message: "Hold A to turn left." },
  { key: "d", keyLabel: "D", holdMs: 1_500, audioSrc: "/audio/tutorial/05-right.mp3", message: "Hold D to turn right." },
  { key: "e", keyLabel: "E", holdMs: 1_500, audioSrc: "/audio/tutorial/06-ascend.mp3", message: "Hold E to rise higher." },
  { key: "q", keyLabel: "Q", holdMs: 1_500, audioSrc: "/audio/tutorial/07-descend.mp3", message: "Hold Q to descend." },
  { key: "shift", keyLabel: "Shift", holdMs: 1_500, audioSrc: "/audio/tutorial/08-boost.mp3", message: "Hold Shift while flying to boost your speed." },
  {
    key: "enter",
    keyLabel: "Enter",
    holdMs: 0,
    audioSrc: "/audio/tutorial/09-complete.mp3",
    message: "Nice flying. You're ready to explore on your own.",
  },
];

const MOUTH_FRAME_POSITION = [
  "0% 0%",
  "50% 0%",
  "100% 0%",
  "0% 100%",
  "50% 100%",
  "100% 100%",
] as const;

export default function TutorialGuide() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isControlHolding, setIsControlHolding] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const [mouthFrame, setMouthFrame] = useState(0);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const narrationStepRef = useRef(-1);
  const isComplete = stepIndex >= TUTORIAL_STEPS.length;
  const step = TUTORIAL_STEPS[Math.min(stepIndex, TUTORIAL_STEPS.length - 1)];

  useEffect(() => {
    function handleIntroComplete() {
      setIsIntroComplete(true);
    }

    window.addEventListener("iowa-intro-complete", handleIntroComplete);
    return () =>
      window.removeEventListener("iowa-intro-complete", handleIntroComplete);
  }, []);

  useEffect(() => {
    if (!isIntroComplete || isComplete) {
      narrationRef.current?.pause();
      return;
    }

    if (narrationStepRef.current !== stepIndex) {
      narrationRef.current?.pause();

      const narration = document.createElement("audio");
      narration.preload = "none";
      narration.src = step.audioSrc;
      narration.load();
      narrationRef.current = narration;
      narrationStepRef.current = stepIndex;
    }

    const narration = narrationRef.current;
    let isCurrentStep = true;
    let animationFrame = 0;
    let lastMouthUpdate = 0;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.55;
    const source = narration
      ? audioContext.createMediaElementSource(narration)
      : null;
    const samples = new Uint8Array(analyser.fftSize);

    source?.connect(analyser);
    analyser.connect(audioContext.destination);

    function updateMouth(time: number) {
      if (!isCurrentStep || narration?.paused) return;

      if (time - lastMouthUpdate >= 70) {
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;

        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sumSquares += normalized * normalized;
        }

        const volume = Math.sqrt(sumSquares / samples.length);
        const speechFrame =
          1 + ((Math.floor(time / 85) + Math.round(volume * 30)) % 5);
        const nextFrame = volume < 0.018 ? 0 : speechFrame;

        setMouthFrame((current) =>
          current === nextFrame ? current : nextFrame,
        );
        lastMouthUpdate = time;
      }

      animationFrame = window.requestAnimationFrame(updateMouth);
    }

    function handleNarrationPlay() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateMouth);
    }

    function handleNarrationStop() {
      window.cancelAnimationFrame(animationFrame);
      setMouthFrame(0);
    }

    function playNarration() {
      if (isCurrentStep && narration?.paused) {
        void audioContext
          .resume()
          .then(() => narration.play())
          .catch(() => undefined);
      }
    }

    narration?.addEventListener("play", handleNarrationPlay);
    narration?.addEventListener("pause", handleNarrationStop);
    narration?.addEventListener("ended", handleNarrationStop);
    playNarration();
    window.addEventListener("pointerdown", playNarration, { once: true });
    window.addEventListener("keydown", playNarration, { once: true });

    return () => {
      isCurrentStep = false;
      window.removeEventListener("pointerdown", playNarration);
      window.removeEventListener("keydown", playNarration);
      narration?.pause();
      window.cancelAnimationFrame(animationFrame);
      narration?.removeEventListener("play", handleNarrationPlay);
      narration?.removeEventListener("pause", handleNarrationStop);
      narration?.removeEventListener("ended", handleNarrationStop);
      source?.disconnect();
      analyser.disconnect();
      void audioContext.close();
      if (narration) narration.currentTime = 0;
    };
  }, [isComplete, isIntroComplete, step.audioSrc, stepIndex]);

  useEffect(() => {
    if (isComplete) return;

    let completionTimer = 0;
    let isHolding = false;

    function isTypingTarget(target: EventTarget | null) {
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      if (
        isTypingTarget(target) ||
        document.querySelector('[aria-label="Iowa From Above introduction"]')
      ) {
        return;
      }

      if (event.key.toLowerCase() !== step.key) {
        if (event.key === "Enter" && !event.repeat) {
          narrationRef.current?.pause();
          if (narrationRef.current) narrationRef.current.currentTime = 0;
          setIsControlHolding(false);
          setStepIndex((current) => current + 1);
        }
        return;
      }

      if (step.holdMs === 0) {
        if (!event.repeat) {
          narrationRef.current?.pause();
          if (narrationRef.current) narrationRef.current.currentTime = 0;
          setStepIndex((current) => current + 1);
        }
        return;
      }

      if (!isHolding) {
        isHolding = true;
        setIsControlHolding(true);
        completionTimer = window.setTimeout(() => {
          isHolding = false;
          setIsControlHolding(false);
          setStepIndex((current) => current + 1);
        }, step.holdMs);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() === step.key && isHolding) {
        isHolding = false;
        window.clearTimeout(completionTimer);
        setIsControlHolding(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.clearTimeout(completionTimer);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isComplete, step.holdMs, step.key]);

  return (
    <>
      <div className="pointer-events-none fixed bottom-28 left-1/2 z-20 h-1.5 w-48 -translate-x-1/2 overflow-hidden rounded-full bg-black/55 sm:bottom-5">
        <div
          role="progressbar"
          aria-label="Tutorial control progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isComplete ? 100 : isControlHolding ? 100 : 0}
          className="h-full rounded-full bg-white transition-[width] ease-linear"
          style={{
            width: `${isComplete || isControlHolding ? 100 : 0}%`,
            transitionDuration: `${isControlHolding ? step.holdMs : 0}ms`,
          }}
        />
      </div>

      <aside
        aria-label="Flight tutorial"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-3 z-30 flex max-w-[calc(100vw-1.5rem)] items-end sm:left-5"
        style={{ "--guide-scale": 1.4 } as CSSProperties}
      >
        <div
          role="img"
          aria-label="Iowa From Above flight guide"
          className="guide-avatar relative z-10 shrink-0"
        >
          <span
            className="guide-avatar-sprite"
            style={{ backgroundPosition: MOUTH_FRAME_POSITION[mouthFrame] }}
          />
        </div>

        {!isComplete ? (
          <div className="guide-dialogue -ml-4 -translate-y-3 w-[min(21rem,calc(100vw-8rem))] min-h-28 pb-4 pl-8 pr-6 pt-4 text-white sm:-ml-5 sm:pl-9 sm:pr-8">
            <p className="text-sm font-medium tracking-normal text-white/70 sm:text-base">
              Tutorial
            </p>
            <p className="mt-1.5 max-w-[27ch] text-sm leading-5 tracking-normal text-white sm:text-base sm:leading-6">
              {step.message}
            </p>
            <div className="mt-3 flex items-center gap-2 text-white/55">
              <kbd className="min-w-9 rounded-md border border-white/35 border-b-white/60 bg-white/10 px-2.5 py-1.5 text-center font-mono text-xs text-white shadow-[inset_0_-2px_0_rgba(255,255,255,0.12),0_2px_4px_rgba(0,0,0,0.35)] sm:text-sm">
                {step.keyLabel}
              </kbd>
              <span className="text-xs text-white/45">
                {step.holdMs > 0 ? "hold to continue" : "to continue"}
              </span>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
