/**
 * Notification Sound Utility
 * Generates a pleasant dual-tone chime using the Web Audio API without external audio files.
 * Supports persistent mute preferences in localStorage.
 */

const SOUND_ENABLED_KEY = 'dental_notification_sound_enabled';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Check whether notification sound is enabled in user preferences
 */
export function isNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(SOUND_ENABLED_KEY);
  return stored === null ? true : stored === 'true';
}

/**
 * Set notification sound preference
 */
export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

/**
 * Plays a soft 2-tone harmonic chime (D5 -> A5 with exponential decay)
 */
export function playNotificationSound(): void {
  if (!isNotificationSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.25, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    masterGain.connect(ctx.destination);

    // First Tone: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.connect(masterGain);

    // Second Tone: A5 (880 Hz) fading in slightly after
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08);
    osc2.connect(masterGain);

    // Start & stop oscillators
    osc1.start(now);
    osc1.stop(now + 0.35);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.45);
  } catch (err) {
    // Fail silently if browser blocks audio prior to user gesture
    console.debug('Failed to play notification sound:', err);
  }
}
