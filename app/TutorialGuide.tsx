"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { INITIAL_JOURNEY, type JourneyStatus } from "./journeyStops";
import { loadJourneyCheckpoint } from "./journeyProgress";
import {
  AUDIO_MUTED_EVENT,
  announceGuideSubtitle,
  getStoredAudioMuted,
  GUIDE_AUDIO_EVENT,
  type GuideAudioDetail,
} from "./audioPreferences";

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
    message: "Hi, I'm Avery, and I'll be flying with you today. Before we head across Iowa, let's get comfortable with the controls.",
  },
  { key: "w", keyLabel: "W", holdMs: 1_500, audioSrc: "/audio/tutorial/02-forward.mp3", message: "Hold W and ease the drone forward." },
  { key: "s", keyLabel: "S", holdMs: 1_500, audioSrc: "/audio/tutorial/03-backward.mp3", message: "Good. Now hold S to bring it backward." },
  { key: "a", keyLabel: "A", holdMs: 1_500, audioSrc: "/audio/tutorial/04-left.mp3", message: "Hold A to turn left." },
  { key: "d", keyLabel: "D", holdMs: 1_500, audioSrc: "/audio/tutorial/05-right.mp3", message: "And use D to turn right." },
  { key: "e", keyLabel: "E", holdMs: 1_500, audioSrc: "/audio/tutorial/06-ascend.mp3", message: "To gain altitude, hold E." },
  { key: "q", keyLabel: "Q", holdMs: 1_500, audioSrc: "/audio/tutorial/07-descend.mp3", message: "To come back down, hold Q." },
  { key: "shift", keyLabel: "Shift", holdMs: 1_500, audioSrc: "/audio/tutorial/08-boost.mp3", message: "Need a little more speed? Hold Shift while you fly." },
  {
    key: "enter",
    keyLabel: "Enter",
    holdMs: 0,
    audioSrc: "/audio/tutorial/09-complete.mp3",
    message: "You've got it. Press Enter, then follow the purple route to the Iowa State Capitol. I'll meet you there.",
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

const PHONE_SUBTITLE_WORDS = 7;

function subtitleForPlayback(
  transcript: string,
  audio: HTMLAudioElement,
) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length <= PHONE_SUBTITLE_WORDS) return transcript;

  const duration = audio.duration;
  const progress = Number.isFinite(duration) && duration > 0
    ? Math.min(Math.max(audio.currentTime / duration, 0), 0.999999)
    : 0;
  const spokenWord = Math.floor(progress * words.length);
  const start = Math.floor(spokenWord / PHONE_SUBTITLE_WORDS)
    * PHONE_SUBTITLE_WORDS;

  return words.slice(start, start + PHONE_SUBTITLE_WORDS).join(" ");
}

function configureNarration(
  narration: HTMLAudioElement,
  src: string,
  isPhoneLayout: boolean,
) {
  narration.preload = isPhoneLayout ? "auto" : "none";
  narration.src = src;
  narration.muted = getStoredAudioMuted();
  narration.setAttribute("playsinline", "");
  narration.load();
}

export default function TutorialGuide() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isControlHolding, setIsControlHolding] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const [mouthFrame, setMouthFrame] = useState(0);
  const [journey, setJourney] = useState(INITIAL_JOURNEY);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const narrationStepRef = useRef(-1);
  const isComplete = stepIndex >= TUTORIAL_STEPS.length;
  const step = TUTORIAL_STEPS[Math.min(stepIndex, TUTORIAL_STEPS.length - 1)];

  useEffect(() => {
    announceGuideSubtitle(
      !isComplete
        ? step.message
        : journey.phase === "cinematic" && journey.caption
          ? journey.caption
          : journey.message,
    );
  }, [isComplete, journey.caption, journey.message, journey.phase, step.message]);

  useEffect(() => {
    if (!loadJourneyCheckpoint()) {
      return;
    }

    const restoreTimer = window.setTimeout(() => {
      setIsIntroComplete(true);
      setStepIndex(TUTORIAL_STEPS.length);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    const update = (event: Event) => setJourney((event as CustomEvent<JourneyStatus>).detail);
    window.addEventListener("iowa-journey-status", update);
    return () => window.removeEventListener("iowa-journey-status", update);
  }, []);

  useEffect(() => {
    function updateMuted(event: Event) {
      if (narrationRef.current) {
        narrationRef.current.muted = Boolean(
          (event as CustomEvent<boolean>).detail,
        );
      }
    }

    window.addEventListener(AUDIO_MUTED_EVENT, updateMuted);
    return () => window.removeEventListener(AUDIO_MUTED_EVENT, updateMuted);
  }, []);

  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let animationFrame = 0;
    let lastMouthUpdate = 0;
    let activeTranscript = "";
    let lastSubtitle = "";
    let lastSubtitleUpdate = 0;
    let samples: Uint8Array<ArrayBuffer> | null = null;

    function stopMouth() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      setMouthFrame(0);
    }

    function pauseMouth() {
      stopMouth();
      void audioContext?.suspend().catch(() => undefined);
    }

    function updateMouth(time: number) {
      if (!activeAudio || activeAudio.paused) return;

      const subtitle = subtitleForPlayback(activeTranscript, activeAudio);
      if (subtitle !== lastSubtitle || time - lastSubtitleUpdate >= 250) {
        announceGuideSubtitle(subtitle);
        lastSubtitle = subtitle;
        lastSubtitleUpdate = time;
      }

      if (time - lastMouthUpdate >= 70) {
        let nextFrame = 1 + (Math.floor(time / 85) % 5);

        if (analyser && samples) {
          analyser.getByteTimeDomainData(samples);
          let sumSquares = 0;

          for (const sample of samples) {
            const normalized = (sample - 128) / 128;
            sumSquares += normalized * normalized;
          }

          const volume = Math.sqrt(sumSquares / samples.length);
          nextFrame =
            volume < 0.018
              ? 0
              : 1 + ((Math.floor(time / 85) + Math.round(volume * 30)) % 5);
        }

        setMouthFrame((current) =>
          current === nextFrame ? current : nextFrame,
        );
        lastMouthUpdate = time;
      }

      animationFrame = window.requestAnimationFrame(updateMouth);
    }

    function startMouth() {
      window.cancelAnimationFrame(animationFrame);
      void audioContext?.resume().catch(() => undefined);
      animationFrame = window.requestAnimationFrame(updateMouth);
    }

    function detachAudio() {
      activeAudio?.removeEventListener("play", startMouth);
      activeAudio?.removeEventListener("pause", pauseMouth);
      activeAudio?.removeEventListener("ended", pauseMouth);
      source?.disconnect();
      analyser?.disconnect();
      if (audioContext) void audioContext.close();
      source = null;
      analyser = null;
      audioContext = null;
      samples = null;
    }

    function followJourneyAudio(event: Event) {
      const { audio: nextAudio, transcript } = (
        event as CustomEvent<GuideAudioDetail>
      ).detail;
      if (nextAudio === activeAudio) return;

      detachAudio();
      stopMouth();
      activeAudio = nextAudio;
      activeTranscript = transcript;
      lastSubtitle = "";
      lastSubtitleUpdate = 0;
      const isPhoneLayout = window.matchMedia(
        "(max-width: 950px) and (max-height: 600px) and (orientation: landscape)",
      ).matches;

      if (!isPhoneLayout) {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.55;
        samples = new Uint8Array(analyser.fftSize);
        source = audioContext.createMediaElementSource(activeAudio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
      }
      activeAudio.addEventListener("play", startMouth);
      activeAudio.addEventListener("pause", pauseMouth);
      activeAudio.addEventListener("ended", pauseMouth);
      if (!activeAudio.paused) startMouth();
    }

    window.addEventListener(GUIDE_AUDIO_EVENT, followJourneyAudio);
    return () => {
      window.removeEventListener(GUIDE_AUDIO_EVENT, followJourneyAudio);
      detachAudio();
      stopMouth();
    };
  }, []);

  useEffect(() => {
    const isPhoneLayout = window.matchMedia(
      "(max-width: 950px) and (max-height: 600px) and (orientation: landscape)",
    ).matches;
    if (!isPhoneLayout || narrationRef.current) return;

    const narration = document.createElement("audio");
    narration.preload = "auto";
    narration.src = TUTORIAL_STEPS[0].audioSrc;
    narration.muted = getStoredAudioMuted();
    narration.setAttribute("playsinline", "");
    narration.load();
    narrationRef.current = narration;
    narrationStepRef.current = 0;

    function primePhoneNarration() {
      if (!narration.paused) return;

      const wasMuted = narration.muted;
      narration.muted = true;
      void narration
        .play()
        .then(() => {
          narration.pause();
          narration.currentTime = 0;
          narration.muted = wasMuted;
        })
        .catch(() => {
          narration.muted = wasMuted;
        });
    }

    window.addEventListener("pointerdown", primePhoneNarration, {
      capture: true,
      once: true,
    });
    return () => {
      window.removeEventListener("pointerdown", primePhoneNarration, true);
    };
  }, []);

  useEffect(() => {
    if (isComplete) window.dispatchEvent(new Event("iowa-tutorial-complete"));
  }, [isComplete]);

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

    const isPhoneLayout = window.matchMedia(
      "(max-width: 950px) and (max-height: 600px) and (orientation: landscape)",
    ).matches;

    if (narrationStepRef.current !== stepIndex) {
      narrationRef.current?.pause();

      const narration =
        isPhoneLayout && narrationRef.current
          ? narrationRef.current
          : document.createElement("audio");
      configureNarration(narration, step.audioSrc, isPhoneLayout);
      narrationRef.current = narration;
      narrationStepRef.current = stepIndex;
    }

    const narration = narrationRef.current;
    let isCurrentStep = true;
    let animationFrame = 0;
    let lastMouthUpdate = 0;
    let lastSubtitle = "";
    let lastSubtitleUpdate = 0;
    const audioContext = isPhoneLayout ? null : new AudioContext();
    const analyser = audioContext?.createAnalyser() ?? null;
    if (analyser) {
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
    }
    const source = narration && audioContext
      ? audioContext.createMediaElementSource(narration)
      : null;
    const samples: Uint8Array<ArrayBuffer> | null = analyser
      ? new Uint8Array(analyser.fftSize)
      : null;

    if (source && analyser && audioContext) {
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    }

    function updateMouth(time: number) {
      if (!isCurrentStep || narration?.paused) return;

      if (narration) {
        const subtitle = subtitleForPlayback(step.message, narration);
        if (subtitle !== lastSubtitle || time - lastSubtitleUpdate >= 250) {
          announceGuideSubtitle(subtitle);
          lastSubtitle = subtitle;
          lastSubtitleUpdate = time;
        }
      }

      if (time - lastMouthUpdate >= 70) {
        let nextFrame = 1 + (Math.floor(time / 85) % 5);

        if (analyser && samples) {
          analyser.getByteTimeDomainData(samples);
          let sumSquares = 0;

          for (const sample of samples) {
            const normalized = (sample - 128) / 128;
            sumSquares += normalized * normalized;
          }

          const volume = Math.sqrt(sumSquares / samples.length);
          nextFrame =
            volume < 0.018
              ? 0
              : 1 + ((Math.floor(time / 85) + Math.round(volume * 30)) % 5);
        }

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

    function removePlaybackRetry() {
      window.removeEventListener("pointerdown", playNarration, true);
      window.removeEventListener("keydown", playNarration, true);
    }

    async function playNarration() {
      if (isCurrentStep && narration?.paused) {
        try {
          await audioContext?.resume();
          await narration.play();
          removePlaybackRetry();
        } catch {
          // Mobile browsers retry on the next real touch gesture.
        }
      }
    }

    narration?.addEventListener("play", handleNarrationPlay);
    narration?.addEventListener("pause", handleNarrationStop);
    narration?.addEventListener("ended", handleNarrationStop);
    window.addEventListener("pointerdown", playNarration, true);
    window.addEventListener("keydown", playNarration, true);
    void playNarration();

    return () => {
      isCurrentStep = false;
      removePlaybackRetry();
      narration?.pause();
      window.cancelAnimationFrame(animationFrame);
      narration?.removeEventListener("play", handleNarrationPlay);
      narration?.removeEventListener("pause", handleNarrationStop);
      narration?.removeEventListener("ended", handleNarrationStop);
      source?.disconnect();
      analyser?.disconnect();
      void audioContext?.close();
      if (narration) narration.currentTime = 0;
    };
  }, [isComplete, isIntroComplete, step.audioSrc, step.message, stepIndex]);

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
      {!isComplete && <div className="pointer-events-none fixed bottom-28 left-1/2 z-20 h-1.5 w-48 -translate-x-1/2 overflow-hidden rounded-full bg-black/55 sm:bottom-5">
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
      </div>}

      <aside
        aria-label="Flight tutorial"
        aria-live="polite"
        className="avery-guide pointer-events-none fixed bottom-4 left-3 z-30 flex max-w-[calc(100vw-1.5rem)] items-end sm:left-5"
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
        ) : (
          <div className="guide-dialogue -ml-4 -translate-y-3 w-[min(21rem,calc(100vw-8rem))] min-h-28 pb-4 pl-8 pr-6 pt-4 text-white sm:-ml-5 sm:pl-9 sm:pr-8">
            <p className="text-sm font-medium tracking-normal text-white/70 sm:text-base">
              Avery · Your guide
            </p>
            <p className="mt-1.5 max-w-[27ch] text-sm leading-5 tracking-normal text-white sm:text-base sm:leading-6">
              {journey.phase === "cinematic" && journey.caption
                ? journey.caption
                : journey.message}
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
