export const AUDIO_MUTED_STORAGE_KEY = "iowa-from-above-audio-muted";
export const AUDIO_MUTED_EVENT = "iowa-audio-muted";
export const GUIDE_AUDIO_EVENT = "iowa-guide-audio";
export const GUIDE_SUBTITLE_EVENT = "iowa-guide-subtitle";
let currentGuideSubtitle = "Avery's narration will appear here.";

export type GuideAudioDetail = {
  audio: HTMLAudioElement;
  transcript: string;
};

export function getStoredAudioMuted() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUDIO_MUTED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setStoredAudioMuted(muted: boolean) {
  try {
    window.localStorage.setItem(AUDIO_MUTED_STORAGE_KEY, String(muted));
  } catch {
    // Muting still works for the current page when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(AUDIO_MUTED_EVENT, { detail: muted }));
}

export function announceGuideAudio(
  audio: HTMLAudioElement,
  transcript: string,
) {
  window.dispatchEvent(
    new CustomEvent<GuideAudioDetail>(GUIDE_AUDIO_EVENT, {
      detail: { audio, transcript },
    }),
  );
}

export function announceGuideSubtitle(subtitle: string) {
  currentGuideSubtitle = subtitle;
  window.dispatchEvent(
    new CustomEvent(GUIDE_SUBTITLE_EVENT, { detail: subtitle }),
  );
}

export function getCurrentGuideSubtitle() {
  return currentGuideSubtitle;
}
