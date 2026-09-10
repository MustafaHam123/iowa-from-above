export const AUDIO_MUTED_STORAGE_KEY = "iowa-from-above-audio-muted";
export const AUDIO_MUTED_EVENT = "iowa-audio-muted";
export const GUIDE_AUDIO_EVENT = "iowa-guide-audio";

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

export function announceGuideAudio(audio: HTMLAudioElement) {
  window.dispatchEvent(new CustomEvent(GUIDE_AUDIO_EVENT, { detail: audio }));
}
