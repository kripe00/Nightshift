import { getAudioContext } from "../modules/reactor/audioSynth";
import { useGameStore } from "./useGameStore";

export const AIRLOCK_DOOR_CENTER_X = 0.0;
export const AIRLOCK_DOOR_CENTER_Z = 4.64;
export const AIRLOCK_OPEN_RADIUS = 2.5;
export const AIRLOCK_CLOSE_RADIUS = 3.0;
export const AIRLOCK_PASSABLE_OPEN_THRESHOLD = 0.75;
export const AIRLOCK_MENU_UNLOCK_DELAY_SEC = 0.35;
export const AIRLOCK_ENTRY_THRESHOLD_Z = 4.35;

export interface AirlockDoorRuntimeState {
  wheelProgress: number;
  openProgress: number;
  wantOpen: boolean;
  menuUnlockElapsed: number;
}

export const airlockDoorState: AirlockDoorRuntimeState = {
  wheelProgress: 0,
  openProgress: 0,
  wantOpen: false,
  menuUnlockElapsed: 0,
};

let lobbyAmbientFadeInTrigger: (() => void) | null = null;

export function registerLobbyAmbientFadeInTrigger(
  trigger: (() => void) | null,
): void {
  lobbyAmbientFadeInTrigger = trigger;
}

export function triggerLobbyAmbientFadeIn(): void {
  lobbyAmbientFadeInTrigger?.();
}

let cachedNoiseCtx: AudioContext | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (cachedNoiseCtx === audio && cachedNoiseBuffer) {
    return cachedNoiseBuffer;
  }
  const sampleRate = audio.sampleRate;
  const len = Math.floor(sampleRate * 0.9);
  const buffer = audio.createBuffer(1, len, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseCtx = audio;
  cachedNoiseBuffer = buffer;
  return buffer;
}

function getActiveAudio(): AudioContext | null {
  try {
    if (useGameStore.getState().isMusicMuted) return null;
    const audio = getAudioContext();
    if (!audio || audio.state === "suspended") return null;
    return audio;
  } catch {
    return null;
  }
}

export function playAirlockWheelSpin(unlocking: boolean): void {
  const audio = getActiveAudio();
  if (!audio) return;
  try {
    const now = audio.currentTime;
    const noiseBuf = getNoiseBuffer(audio);
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.12;
      const src = audio.createBufferSource();
      src.buffer = noiseBuf;
      const bp = audio.createBiquadFilter();
      bp.type = "bandpass";
      const freq = unlocking ? 1050 + i * 110 : 1380 - i * 110;
      bp.frequency.setValueAtTime(freq, t);
      bp.Q.setValueAtTime(3.6, t);
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      src.connect(bp).connect(gain).connect(audio.destination);
      src.start(t);
      src.stop(t + 0.036);

      const osc = audio.createOscillator();
      const oGain = audio.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(unlocking ? 210 + i * 15 : 240 - i * 15, t);
      osc.frequency.exponentialRampToValueAtTime(75, t + 0.035);
      oGain.gain.setValueAtTime(0.09, t);
      oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
      osc.connect(oGain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.042);
    }
  } catch {
    // Ignore autoplay or WebAudio errors
  }
}

export function playAirlockPneumaticSlide(opening: boolean): void {
  const audio = getActiveAudio();
  if (!audio) return;
  try {
    const now = audio.currentTime;
    const noiseBuf = getNoiseBuffer(audio);

    // 1. Subtle heavy pneumatic cylinder hiss
    const src = audio.createBufferSource();
    src.buffer = noiseBuf;

    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(1.8, now);
    if (opening) {
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(520, now + 0.85);
    } else {
      filter.frequency.setValueAtTime(700, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + 0.82);
    }

    const nGain = audio.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.11, now + 0.04);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    src.connect(filter).connect(nGain).connect(audio.destination);
    src.start(now);
    src.stop(now + 0.88);

    // 2. Low mechanical unseat / pneumatic drive thump
    const osc = audio.createOscillator();
    const oGain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);

    oGain.gain.setValueAtTime(0.18, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(oGain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // Ignore autoplay or WebAudio errors
  }
}

export function playAirlockEndStop(sealing: boolean): void {
  const audio = getActiveAudio();
  if (!audio) return;
  try {
    const now = audio.currentTime;
    const noiseBuf = getNoiseBuffer(audio);

    const src = audio.createBufferSource();
    src.buffer = noiseBuf;
    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(sealing ? 420 : 640, now);
    filter.Q.setValueAtTime(2.6, now);
    const nGain = audio.createGain();
    nGain.gain.setValueAtTime(sealing ? 0.14 : 0.1, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(filter).connect(nGain).connect(audio.destination);
    src.start(now);
    src.stop(now + 0.065);

    const osc = audio.createOscillator();
    const oGain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(sealing ? 130 : 115, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.08);
    oGain.gain.setValueAtTime(sealing ? 0.24 : 0.16, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(oGain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {
    // Ignore autoplay or WebAudio errors
  }
}
