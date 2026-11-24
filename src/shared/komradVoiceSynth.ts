// Real 1984 Soviet "Half-Life VOX" Concatenative Speech Engine + Full Monologue Clips
// + Multi-Syllable Dark Robotic Formant Synthesizer (Sector 84)
// Preloads pre-sliced 24kHz Ogg/WAV VOX packs & 6 full AI monologue clips from ./audio/vox/komrad_vox_manifest.json,
// routes 100% of speech (VOX slices, full .ogg clips, and OOV multi-syllable formant words) through a unified
// Dark Soviet Mainframe Vocoder + Bunker PA Horn Bus + AnalyserNode for 1:1 lip-sync.

import { getAudioContext } from "../modules/inspector/audio";
import {
  canEmitKomradIdleChatter,
  isKomradNonCriticalCooldownActive,
  markKomradTransmissionEnd,
  markKomradTransmissionStart,
  reserveIdleChatterEmission,
  resetKomradSilenceState,
} from "./komradSilenceState";
import type { KomradMessageEntry, KomradMood } from "./types";
import { doesRadioDominateSubtitles, useGameStore } from "./useGameStore";

export type KomradVowelKey =
  | "AA"
  | "AE"
  | "EH"
  | "IY"
  | "OW"
  | "UW"
  | "UH"
  | "ER";

export interface KomradVocalState {
  mouthOpen: 0 | 1 | 2;
  energy: number;
  isTalking: boolean;
  typedCharCount: number;
  activeMsgId: string;
  mood: KomradMood;
  msgStartSec: number;
  syllableSeq: number;
  activeVowel: KomradVowelKey | null;
  clauseTerminator: "." | "!" | "?" | "," | "";
  isStressed: boolean;
  rolledR: boolean;
  activeWord: string | null;
  voxLoaded: boolean;
  spectrum16: Uint8Array<ArrayBuffer>;
}

export interface VoxWordEntry {
  pack: string;
  start: number;
  dur: number;
  gain: number;
}

export interface VoxPackSpec {
  id: string;
  src: string;
}

export interface VoxClipClause {
  start: number;
  end: number;
  text: string;
}

export interface VoxClipEntry {
  id: string;
  title: string;
  src: string;
  duration: number;
  gain: number;
  text: string;
  clauses: VoxClipClause[];
}

export interface VoxManifest {
  version: number;
  packs: VoxPackSpec[];
  words: Record<string, VoxWordEntry>;
  clips?: VoxClipEntry[];
}

export type VoxQueueItem =
  | {
      kind: "word";
      word: string;
      entry: VoxWordEntry;
      charEnd: number;
      speechCharEnd?: number;
      stressed: boolean;
    }
  | {
      kind: "pause";
      durSec: number;
      terminator: "." | "!" | "?" | ",";
      charEnd: number;
      speechCharEnd?: number;
    }
  | {
      kind: "fallback";
      rawWord: string;
      charEnd: number;
      speechCharEnd?: number;
      stressed: boolean;
    };

export interface KomradSubtitleSnapshot {
  text: string | null;
  clause: string | null;
  fullText: string | null;
  mood: KomradMood;
  activeWord: string | null;
  isSpeaking: boolean;
}

type ConsonantKind = "none" | "sibilant" | "sh" | "stop" | "nasal" | "fricative" | "glide";

interface ConsonantArticulation {
  kind: ConsonantKind;
  locusHz: number;
  locusFormants: FormantTriplet | null;
  voiced: boolean;
  rolledR: boolean;
}

export interface SyllableSpec {
  onset: ConsonantArticulation;
  vowel: KomradVowelKey;
  coda: ConsonantArticulation;
  durSec: number;
  stressed: boolean;
}

type FormantTriplet = readonly [number, number, number];

// Male baritone Klatt/DECTalk formant table (F1, F2, F3 in Hz)
const VOWEL_FORMANTS: Record<KomradVowelKey, FormantTriplet> = {
  AA: [710, 1080, 2400],
  AE: [640, 1690, 2380],
  EH: [520, 1810, 2440],
  IY: [275, 2240, 2940],
  OW: [540, 840, 2380],
  UW: [305, 860, 2220],
  UH: [500, 1170, 2350],
  ER: [480, 1320, 1680],
};

const VOWEL_BAND_NORM: Record<KomradVowelKey, number> = {
  UW: 0.16,
  OW: 0.24,
  AA: 0.36,
  UH: 0.44,
  ER: 0.54,
  AE: 0.68,
  EH: 0.78,
  IY: 0.9,
};

const VOWEL_ORDER: readonly KomradVowelKey[] = [
  "UW",
  "OW",
  "AA",
  "UH",
  "ER",
  "AE",
  "EH",
  "IY",
];

const NEUTRAL_FORMANTS: FormantTriplet = [500, 1450, 2400];

const IMPORTANT_KEYWORDS = new Set([
  "MELTDOWN",
  "CRITICAL",
  "ALERT",
  "WARNING",
  "SABOTAGE",
  "CIA",
  "KGB",
  "REACTOR",
  "CORE",
  "SCRAM",
  "PROPAGANDA",
  "TREASON",
  "OVERRIDE",
  "BLACKOUT",
  "RADIATION",
  "KOMRAD",
  "COMRADE",
  "QUOTA",
  "DANGER",
  "GLORY",
  "AZ-5",
  "EXPLOSION",
  "THERMAL",
  "XENON",
  "EMERGENCY",
  "CONTAINMENT",
  "SECTOR",
]);

const DIGIT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
] as const;

const TENS_WORDS: Record<number, string> = {
  20: "twenty",
  30: "thirty",
  40: "forty",
  50: "fifty",
  60: "sixty",
  70: "seventy",
  80: "eighty",
  90: "ninety",
};

const NATO_UNIT_WORDS: Record<string, string> = {
  A: "alpha",
  B: "bravo",
  C: "charlie",
};

// Complete contraction expansion so ZERO leading words are ever dropped
const CONTRACTIONS: Record<string, readonly string[]> = {
  "don't": ["do", "not"],
  "doesn't": ["does", "not"],
  "didn't": ["did", "not"],
  "isn't": ["is", "not"],
  "aren't": ["are", "not"],
  "wasn't": ["was", "not"],
  "weren't": ["were", "not"],
  "haven't": ["have", "not"],
  "hasn't": ["has", "not"],
  "hadn't": ["had", "not"],
  "won't": ["will", "not"],
  "can't": ["can", "not"],
  "cannot": ["can", "not"],
  "couldn't": ["could", "not"],
  "wouldn't": ["would", "not"],
  "shouldn't": ["should", "not"],
  "mustn't": ["must", "not"],
  "it's": ["it", "is"],
  "that's": ["that", "is"],
  "what's": ["what", "is"],
  "there's": ["there", "is"],
  "here's": ["here", "is"],
  "who's": ["who", "is"],
  "he's": ["he", "is"],
  "she's": ["she", "is"],
  "i'm": ["i", "am"],
  "you're": ["you", "are"],
  "we're": ["we", "are"],
  "they're": ["they", "are"],
  "i've": ["i", "have"],
  "you've": ["you", "have"],
  "we've": ["we", "have"],
  "they've": ["they", "have"],
  "i'll": ["i", "will"],
  "you'll": ["you", "will"],
  "we'll": ["we", "will"],
  "they'll": ["they", "will"],
  "it'll": ["it", "will"],
  "let's": ["let", "us"],
};

const TECH_ABBREVIATIONS: Record<string, readonly string[]> = {
  temp: ["temperature"],
  temps: ["temperature"],
  pres: ["pressure"],
  press: ["pressure"],
  lvl: ["level"],
  gen: ["power"],
  alloc: ["output"],
  ctrl: ["control"],
  mw: ["megawatts"],
  mwe: ["megawatts"],
  mwt: ["megawatts"],
  mwh: ["megawatt", "hours"],
  mm: ["millimeters"],
  vs: ["versus"],
};

const LETTER_PHONEMES: Record<string, readonly { onset: string; vowel: KomradVowelKey; coda: string }[]> = {
  A: [{ onset: "", vowel: "EH", coda: "" }],
  B: [{ onset: "B", vowel: "IY", coda: "" }],
  C: [{ onset: "S", vowel: "IY", coda: "" }],
  D: [{ onset: "D", vowel: "IY", coda: "" }],
  E: [{ onset: "", vowel: "IY", coda: "" }],
  F: [{ onset: "", vowel: "EH", coda: "F" }],
  G: [{ onset: "CH", vowel: "IY", coda: "" }],
  H: [{ onset: "", vowel: "EH", coda: "CH" }],
  I: [{ onset: "", vowel: "AA", coda: "" }],
  J: [{ onset: "CH", vowel: "EH", coda: "" }],
  K: [{ onset: "K", vowel: "EH", coda: "" }],
  L: [{ onset: "", vowel: "EH", coda: "L" }],
  M: [{ onset: "", vowel: "EH", coda: "M" }],
  N: [{ onset: "", vowel: "EH", coda: "N" }],
  O: [{ onset: "", vowel: "OW", coda: "" }],
  P: [{ onset: "P", vowel: "IY", coda: "" }],
  Q: [{ onset: "K", vowel: "UW", coda: "" }],
  R: [{ onset: "", vowel: "AA", coda: "R" }],
  S: [{ onset: "", vowel: "EH", coda: "S" }],
  T: [{ onset: "T", vowel: "IY", coda: "" }],
  U: [{ onset: "Y", vowel: "UW", coda: "" }],
  V: [{ onset: "V", vowel: "IY", coda: "" }],
  W: [
    { onset: "D", vowel: "UH", coda: "" },
    { onset: "B", vowel: "UW", coda: "" },
  ],
  X: [{ onset: "", vowel: "EH", coda: "KS" }],
  Y: [{ onset: "W", vowel: "AA", coda: "" }],
  Z: [{ onset: "Z", vowel: "IY", coda: "" }],
};

const KNOWN_INITIALISMS = new Set([
  "CIA",
  "CRT",
  "UV",
  "MCR",
  "VFD",
  "RBMK",
  "BRU",
  "AVR",
  "USSR",
  "SSR",
  "RPM",
  "CPU",
  "RAM",
  "HZ",
  "KW",
  "KV",
  "DC",
  "AC",
  "PA",
]);

const VALID_ONSET_CLUSTERS = new Set([
  "BL",
  "BR",
  "CH",
  "CL",
  "CR",
  "DR",
  "DW",
  "FL",
  "FR",
  "GH",
  "GL",
  "GR",
  "KN",
  "PH",
  "PL",
  "PR",
  "QU",
  "SC",
  "SH",
  "SK",
  "SL",
  "SM",
  "SN",
  "SP",
  "ST",
  "SW",
  "TH",
  "TR",
  "TW",
  "WH",
  "WR",
  "SCH",
  "SCR",
  "SHR",
  "SPL",
  "SPR",
  "STR",
  "THR",
]);

const VOX_MANIFEST_URL = "./audio/vox/komrad_vox_manifest.json";
const SERVO_WHIR_COOLDOWN_MS = 2500;
const RADIO_BROADCAST_HOLDOFF_MS = 2800;
const VOX_LOOKAHEAD_SEC = 0.24;
const VOX_WORD_OVERLAP_SEC = 0.03;
const PUNCT_COMMA_PAUSE_SEC = 0.075;
const PUNCT_SENTENCE_PAUSE_SEC = 0.145;
const ROUTINE_MASTER_GAIN = 0.5;
const ALERT_MASTER_GAIN = 0.72;
const MONOLOGUE_MIN_GAP_SEC = 75;
const MONOLOGUE_EXTRA_GAP_SEC = 45;
const KOMRAD_OPENING_SETTLE_DELAY_SEC = 0.5;

interface VoiceAudioChain {
  ctx: AudioContext;
  voxInput: GainNode;
  busInput: GainNode;
  consonantBusInput: GainNode;
  driveGain: GainNode;
  analyser: AnalyserNode;
  masterGain: GainNode;
  noiseBuffer: AudioBuffer;
  timeDomainBuf: Uint8Array<ArrayBuffer>;
  freqDataBuf: Uint8Array<ArrayBuffer>;
}

interface VoxTimelineSegment {
  startSec: number;
  endSec: number;
  prevCharEnd: number;
  charEnd: number;
  speechCharEnd?: number;
  clauseText?: string;
  word: string | null;
  stressed: boolean;
  terminator: "." | "!" | "?" | "," | "";
  isClipClause?: boolean;
}

type VoxLoadState = "idle" | "loading" | "ready" | "failed";

let cachedChain: VoiceAudioChain | null = null;
let lastMasterAllowed: boolean | null = null;
let lastMasterTarget = -1;
let lastServoWhirMs = -10000;
let lastRadioSubtitleActiveMs = -10000;

let voxLoadState: VoxLoadState = "idle";
let voxManifest: VoxManifest | null = null;
const voxBuffers = new Map<string, AudioBuffer>();
const voxClipBuffers = new Map<string, AudioBuffer>();

let activeUtteranceGain: GainNode | null = null;
let activeUtteranceNodes = new Set<AudioScheduledSourceNode>();
let activeUtterancePriority = 0;
let activeUtteranceMsgId = "";
let activeUtteranceTextLen = 0;

let lastSeenStoreMsgId = "";
let pendingVoxMsg: KomradMessageEntry | null = null;
let pendingVoxMsgMood: KomradMood = "normal";
let pendingVoxMsgPriority = 0;
let pendingVoxQueuedAtSec = 0;

let voxQueue: VoxQueueItem[] = [];
let voxQueueCursor = 0;
let voxCursorAudioSec = 0;
let voxUtteranceEndAudioSec = 0;
let voxActiveMood: KomradMood = "normal";
let voxTimeline: VoxTimelineSegment[] = [];
let voxTimelineIdx = 0;
let voxSpeakingAudioActive = false;

let lastTrackedShiftRunId = -1;
let voxLoadStartedElapsedSec = -1;
let nextMonologueElapsedSec = -1;
let lastUtteranceEndElapsedSec = -10;
let monologueDeck: number[] = [];
let openingSettleElapsedSec = 0;
let wasShiftControlReady = false;

const vocalState: KomradVocalState = {
  mouthOpen: 0,
  energy: 0,
  isTalking: false,
  typedCharCount: 0,
  activeMsgId: "",
  mood: "normal",
  msgStartSec: -10,
  syllableSeq: 0,
  activeVowel: null,
  clauseTerminator: "",
  isStressed: false,
  rolledR: false,
  activeWord: null,
  voxLoaded: false,
  spectrum16: new Uint8Array(new ArrayBuffer(16)),
};

let steppedThisTick = false;
let charCursor = 0;
let charAccumSec = 0;
let visualTypingActive = false;

const KOMRAD_SUBTITLE_LINGER_MS = 750;
const KOMRAD_SUBTITLE_MAX_LEN = 110;
const VISUAL_SUBTITLE_CPS = 28;

interface SubtitleClauseSpan {
  start: number;
  end: number;
  text: string;
}

let activeSubtitleClauses: SubtitleClauseSpan[] = [];
let activeUtteranceCleanText = "";
let subtitleSnapshot: KomradSubtitleSnapshot = {
  text: null,
  clause: null,
  fullText: null,
  mood: "normal",
  activeWord: null,
  isSpeaking: false,
};
let subtitleHoldUntilMs = 0;
const subtitleListeners = new Set<() => void>();

let visualSubtitleActive = false;
let visualSubtitleFullText = "";
let visualSubtitleClauses: SubtitleClauseSpan[] = [];
let visualSubtitleCharCursor = 0;
let visualSubtitleAccumSec = 0;
let visualSubtitleMood: KomradMood = "normal";
let komradUnlockListenersInstalled = false;

function nowPerfMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function getKomradSubtitleSnapshot(): KomradSubtitleSnapshot {
  return subtitleSnapshot;
}

export function subscribeKomradSubtitle(listener: () => void): () => void {
  subtitleListeners.add(listener);
  return () => {
    subtitleListeners.delete(listener);
  };
}

export function cleanSubtitleDisplayText(raw: string): string {
  return raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\uFE0F|\u200D/gu, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/^\s*(?:\[\s*\d{1,2}:\d{2}(?::\d{2})?\s*\]\s*)+/, "")
    .replace(
      /^(?:K\.O\.M\.R\.A\.D\.?(?:[-\s]?84)?|KOMRAD(?:[-\s]?84)?|SYS\.DEFENSE|PRINTER|OPERATOR)\s*:\s*/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function emitKomradSubtitle(
  clauseText: string | null,
  mood: KomradMood,
  isSpeaking: boolean,
  fullText: string | null = null,
  activeWord: string | null = null,
): void {
  const cleanClause =
    clauseText && clauseText.trim().length > 0 ? clauseText.trim() : null;
  const cleanFull =
    cleanClause === null
      ? null
      : fullText && fullText.trim().length > 0
        ? fullText.trim()
        : cleanClause;

  if (
    subtitleSnapshot.clause === cleanClause &&
    subtitleSnapshot.fullText === cleanFull &&
    subtitleSnapshot.mood === mood &&
    subtitleSnapshot.isSpeaking === isSpeaking
  ) {
    return;
  }

  subtitleSnapshot = {
    text: cleanClause,
    clause: cleanClause,
    fullText: cleanFull,
    mood,
    activeWord,
    isSpeaking,
  };

  useGameStore.setState({
    komradSubtitle: cleanClause
      ? {
          text: cleanFull ?? cleanClause,
          clause: cleanClause,
          mood,
          activeWord,
          isSpeaking,
        }
      : null,
  });

  subtitleListeners.forEach((listener) => listener());
}

function clearKomradSubtitleNow(): void {
  activeSubtitleClauses = [];
  activeUtteranceCleanText = "";
  visualSubtitleActive = false;
  visualSubtitleFullText = "";
  visualSubtitleClauses = [];
  visualSubtitleCharCursor = 0;
  visualSubtitleAccumSec = 0;
  subtitleHoldUntilMs = 0;
  emitKomradSubtitle(null, "normal", false, null, null);
}

function splitLongClauseChunk(
  text: string,
  baseOffset: number,
  out: SubtitleClauseSpan[],
): void {
  let cursor = 0;
  const len = text.length;
  while (cursor < len) {
    while (cursor < len && text[cursor] === " ") cursor += 1;
    if (cursor >= len) break;

    if (len - cursor <= KOMRAD_SUBTITLE_MAX_LEN) {
      const piece = text.slice(cursor).trim();
      if (piece.length > 0) {
        out.push({ start: baseOffset + cursor, end: baseOffset + len, text: piece });
      }
      break;
    }

    const searchLimit = Math.min(len, cursor + KOMRAD_SUBTITLE_MAX_LEN);
    let splitAt = -1;
    for (let j = searchLimit; j >= cursor + 28; j--) {
      const ch = text[j - 1];
      if (ch === "," || ch === ";" || ch === ":" || ch === "—" || ch === "–") {
        splitAt = j;
        break;
      }
    }
    if (splitAt < 0) {
      for (let j = searchLimit; j >= cursor + 28; j--) {
        if (text[j] === " ") {
          splitAt = j;
          break;
        }
      }
    }
    if (splitAt < 0) {
      splitAt = searchLimit;
    }
    const piece = text.slice(cursor, splitAt).trim();
    if (piece.length > 0) {
      out.push({ start: baseOffset + cursor, end: baseOffset + splitAt, text: piece });
    }
    cursor = splitAt;
  }
}

export function splitTextIntoSubtitleClauses(text: string): SubtitleClauseSpan[] {
  const out: SubtitleClauseSpan[] = [];
  const len = text.length;
  let sentStart = 0;
  let i = 0;

  while (i < len) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?") {
      i += 1;
      continue;
    }

    let isSentenceEnd = false;
    if (ch === "!" || ch === "?") {
      let after = i + 1;
      while (after < len && (text[after] === "." || text[after] === "!" || text[after] === "?")) {
        after += 1;
      }
      while (after < len && (text[after] === '"' || text[after] === "'" || text[after] === ")")) {
        after += 1;
      }
      if (after >= len || /\s/.test(text[after])) {
        isSentenceEnd = true;
        i = after;
      } else {
        i += 1;
      }
    } else {
      // Period '.' : ignore decimals (3.6), inline acronym separators (K.O.M.R.A.D.-84),
      // and trailing periods of multi-dot initialisms (U.S.S.R.).
      const nextCh = i + 1 < len ? text[i + 1] : "";
      const isTrailingAcronymDot =
        i >= 2 && /[A-Za-z]/.test(text[i - 1]) && text[i - 2] === ".";
      if ((nextCh === "" || /\s/.test(nextCh)) && !isTrailingAcronymDot) {
        let after = i + 1;
        while (after < len && (text[after] === "." || text[after] === "!" || text[after] === "?")) {
          after += 1;
        }
        while (after < len && (text[after] === '"' || text[after] === "'" || text[after] === ")")) {
          after += 1;
        }
        if (after >= len || /\s/.test(text[after])) {
          isSentenceEnd = true;
          i = after;
        } else {
          i += 1;
        }
      } else {
        i += 1;
      }
    }

    if (isSentenceEnd) {
      const raw = text.slice(sentStart, i);
      const trimStart = raw.search(/\S/);
      if (trimStart >= 0) {
        const clean = raw.slice(trimStart).trim();
        const baseOff = sentStart + trimStart;
        if (clean.length <= KOMRAD_SUBTITLE_MAX_LEN) {
          out.push({ start: baseOff, end: baseOff + clean.length, text: clean });
        } else {
          splitLongClauseChunk(clean, baseOff, out);
        }
      }
      sentStart = i;
    }
  }

  if (sentStart < len) {
    const raw = text.slice(sentStart);
    const trimStart = raw.search(/\S/);
    if (trimStart >= 0) {
      const clean = raw.slice(trimStart).trim();
      const baseOff = sentStart + trimStart;
      if (clean.length <= KOMRAD_SUBTITLE_MAX_LEN) {
        out.push({ start: baseOff, end: baseOff + clean.length, text: clean });
      } else {
        splitLongClauseChunk(clean, baseOff, out);
      }
    }
  }

  return out;
}

function lookupSubtitleClauseAtChar(
  clauses: readonly SubtitleClauseSpan[],
  charPos: number,
): string | null {
  if (clauses.length === 0) return null;
  for (let i = 0; i < clauses.length; i++) {
    if (charPos <= clauses[i].end) {
      return clauses[i].text;
    }
  }
  return clauses[clauses.length - 1].text;
}

function ensureKomradAudioUnlockListeners(): void {
  if (komradUnlockListenersInstalled || typeof window === "undefined") return;
  komradUnlockListenersInstalled = true;

  const tryUnlockAudio = () => {
    const s = useGameStore.getState();
    if (s.isMusicMuted) return;
    const audio = getAudioContext();
    if (!audio) return;
    const finishUnlock = () => {
      if (audio.state !== "running") return;
      if (useGameStore.getState().phase === "playing" && !useGameStore.getState().isMusicMuted) {
        ensureVoxPreloaded(audio);
      }
      window.removeEventListener("pointerdown", tryUnlockAudio);
      window.removeEventListener("keydown", tryUnlockAudio);
    };
    if (audio.state === "running") {
      finishUnlock();
    } else if (audio.state === "suspended") {
      void audio.resume().then(finishUnlock).catch(() => {});
    }
  };

  window.addEventListener("pointerdown", tryUnlockAudio, { passive: true });
  window.addEventListener("keydown", tryUnlockAudio, { passive: true });
}

export function getKomradVowelBand(
  vowel: KomradVowelKey | null,
  bandCount: number,
): number {
  const norm = vowel ? VOWEL_BAND_NORM[vowel] : 0.45;
  return norm * Math.max(1, bandCount - 1);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function isVowelChar(ch: string): boolean {
  return (
    ch === "A" ||
    ch === "E" ||
    ch === "I" ||
    ch === "O" ||
    ch === "U" ||
    ch === "Y" ||
    ch === "a" ||
    ch === "e" ||
    ch === "i" ||
    ch === "o" ||
    ch === "u" ||
    ch === "y"
  );
}

function isAlphaNum(ch: string): boolean {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (
    (c >= 48 && c <= 57) ||
    (c >= 65 && c <= 90) ||
    (c >= 97 && c <= 122)
  );
}

function isDigitChar(ch: string): boolean {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return c >= 48 && c <= 57;
}

function normalizeTokenKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatShiftClockHMS(shiftTimeMinutes: number): string {
  const totalSeconds = Math.floor(Math.max(0, Math.min(360, shiftTimeMinutes)) * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function expandUnsignedIntWords(
  n: number,
  words: Record<string, VoxWordEntry>,
): string[] {
  const val = Math.trunc(Math.abs(n));
  if (!Number.isFinite(val)) return ["zero"];
  if (val <= 12) return [DIGIT_WORDS[val]];
  if (val === 15) return ["fifteen"];
  if (val < 20) return ["one", DIGIT_WORDS[val % 10]];

  if (val < 100) {
    const tens = Math.floor(val / 10) * 10;
    const ones = val % 10;
    const tensWord = TENS_WORDS[tens] ?? "ninety";
    if (ones === 0) return [tensWord];
    const onesWord = DIGIT_WORDS[ones];
    const hyphenated = `${tensWord}-${onesWord}`;
    return words[hyphenated] ? [hyphenated] : [tensWord, onesWord];
  }

  if (val < 1000) {
    const hundreds = Math.floor(val / 100);
    const rem = val % 100;
    const out = [DIGIT_WORDS[hundreds], "hundred"];
    if (rem > 0) out.push(...expandUnsignedIntWords(rem, words));
    return out;
  }

  if (val < 1_000_000) {
    const thousands = Math.floor(val / 1000);
    const rem = val % 1000;
    const out = [...expandUnsignedIntWords(thousands, words), "thousand"];
    if (rem > 0) out.push(...expandUnsignedIntWords(rem, words));
    return out;
  }

  return String(val)
    .split("")
    .map((d) => DIGIT_WORDS[Number.parseInt(d, 10)] ?? "zero");
}

function expandNumberTokens(
  numStr: string,
  words: Record<string, VoxWordEntry>,
): string[] {
  const out: string[] = [];
  let s = numStr.trim();
  if (s.startsWith("-")) {
    out.push("minus");
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    out.push("plus");
    s = s.slice(1);
  }

  const dotIdx = s.indexOf(".");
  if (dotIdx >= 0) {
    const intPart = s.slice(0, dotIdx);
    const fracPart = s.slice(dotIdx + 1);
    const intVal = intPart ? Number.parseInt(intPart, 10) : 0;
    out.push(...expandUnsignedIntWords(intVal, words));
    if (fracPart.length > 0) {
      out.push("point");
      for (let k = 0; k < fracPart.length; k++) {
        const d = Number.parseInt(fracPart[k], 10);
        if (!Number.isNaN(d)) {
          out.push(DIGIT_WORDS[d]);
        }
      }
    }
    return out;
  }

  const n = Number.parseInt(s, 10);
  if (Number.isNaN(n)) return out;
  out.push(...expandUnsignedIntWords(n, words));
  return out;
}

function findMorphMatch(
  key: string,
  words: Record<string, VoxWordEntry>,
): string | null {
  if (!key) return null;
  if (words[key]) return key;

  const candidates: string[] = [];
  if (key.endsWith("ies") && key.length > 4) {
    candidates.push(`${key.slice(0, -3)}y`);
  }
  if (key.endsWith("es") && key.length > 4) {
    candidates.push(key.slice(0, -2));
    candidates.push(key.slice(0, -1));
  }
  if (key.endsWith("s") && key.length > 3) {
    candidates.push(key.slice(0, -1));
  }
  candidates.push(`${key}s`);
  candidates.push(`${key}es`);

  if (key.endsWith("ing") && key.length > 5) {
    const stem = key.slice(0, -3);
    candidates.push(stem);
    candidates.push(`${stem}e`);
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      candidates.push(stem.slice(0, -1));
    }
  }

  if (key.endsWith("ed") && key.length > 4) {
    const stem = key.slice(0, -2);
    candidates.push(stem);
    candidates.push(key.slice(0, -1));
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      candidates.push(stem.slice(0, -1));
    }
  }

  if (key.endsWith("ally") && key.length > 6) {
    candidates.push(key.slice(0, -4));
  }
  if (key.endsWith("ly") && key.length > 4) {
    candidates.push(key.slice(0, -2));
  }

  if (key.endsWith("er") && key.length > 4) {
    candidates.push(key.slice(0, -2));
    candidates.push(key.slice(0, -1));
  }
  if (key.endsWith("est") && key.length > 5) {
    candidates.push(key.slice(0, -3));
    candidates.push(key.slice(0, -2));
  }

  if (key.endsWith("tions") && key.length > 6) {
    candidates.push(key.slice(0, -1));
    candidates.push(`${key.slice(0, -4)}ed`);
  }
  if (key.endsWith("tion") && key.length > 5) {
    candidates.push(`${key}s`);
    candidates.push(`${key.slice(0, -3)}ed`);
    candidates.push(key.slice(0, -3));
  }

  for (const cand of candidates) {
    if (cand.length >= 3 && words[cand]) return cand;
  }

  // Fallback for verbs recorded in participle/past form (e.g. detects -> detected, overheats -> overheating)
  const baseForVerb =
    key.endsWith("es") && key.length > 4
      ? key.slice(0, -2)
      : key.endsWith("s") && key.length > 3
        ? key.slice(0, -1)
        : key;
  if (baseForVerb.length >= 3) {
    for (const suffix of ["ed", "d", "ing"] as const) {
      const verbForm = `${baseForVerb}${suffix}`;
      if (words[verbForm]) return verbForm;
    }
  }
  return null;
}

function pushUnitToken(
  queue: VoxQueueItem[],
  rawUnit: string,
  words: Record<string, VoxWordEntry>,
  charEnd: number,
  stressed: boolean,
  singularHint = false,
): void {
  const uLow = rawUnit.toLowerCase();
  if (uLow.startsWith("°") || uLow.startsWith("deg") || uLow === "c") {
    pushResolvedWordOrFallback(queue, "degrees", words, charEnd, stressed);
  } else if (uLow === "mwh") {
    pushResolvedWordOrFallback(queue, "megawatt", words, charEnd, stressed);
    pushResolvedWordOrFallback(queue, "hours", words, charEnd, stressed);
  } else if (uLow.startsWith("mw")) {
    pushResolvedWordOrFallback(
      queue,
      singularHint && words.megawatt ? "megawatt" : "megawatts",
      words,
      charEnd,
      stressed,
    );
  } else if (uLow === "bar") {
    pushResolvedWordOrFallback(queue, "bar", words, charEnd, stressed);
  } else if (uLow === "%") {
    pushResolvedWordOrFallback(queue, "percent", words, charEnd, stressed);
  } else if (uLow === "mm") {
    pushResolvedWordOrFallback(queue, "millimeters", words, charEnd, stressed);
  } else if (uLow.startsWith("r/")) {
    pushResolvedWordOrFallback(queue, "roentgen", words, charEnd, stressed);
  } else if (uLow.startsWith("sec") || uLow === "s") {
    pushResolvedWordOrFallback(queue, "seconds", words, charEnd, stressed);
  } else if (uLow.startsWith("min")) {
    pushResolvedWordOrFallback(queue, "minutes", words, charEnd, stressed);
  } else if (uLow.startsWith("hr") || uLow.startsWith("hour")) {
    pushResolvedWordOrFallback(queue, "hours", words, charEnd, stressed);
  }
}

function pushResolvedWordOrFallback(
  queue: VoxQueueItem[],
  token: string,
  words: Record<string, VoxWordEntry>,
  charEnd: number,
  stressed: boolean,
): void {
  const lower = token.toLowerCase().replace(/[’`]/g, "'").replace(/^'+|'+$/g, "");
  if (!lower) return;

  const contraction = CONTRACTIONS[lower];
  if (contraction) {
    for (const part of contraction) {
      pushResolvedWordOrFallback(queue, part, words, charEnd, stressed);
    }
    return;
  }

  // Strip English possessives (e.g. "oleg's" -> "oleg", "tonight's" -> "tonight")
  if (lower.endsWith("'s") && lower.length > 2) {
    pushResolvedWordOrFallback(queue, lower.slice(0, -2), words, charEnd, stressed);
    return;
  }

  const key = normalizeTokenKey(lower);
  if (!key) return;

  const matched = findMorphMatch(key, words);
  if (matched) {
    queue.push({
      kind: "word",
      word: matched,
      entry: words[matched],
      charEnd,
      stressed,
    });
    return;
  }

  const abbrev = TECH_ABBREVIATIONS[key];
  if (abbrev) {
    for (const part of abbrev) {
      pushResolvedWordOrFallback(queue, part, words, charEnd, stressed);
    }
    return;
  }

  // Split hyphenated compounds cleanly unless present as a single VOX entry
  if (key.includes("-")) {
    const parts = key.split("-").filter(Boolean);
    if (parts.length > 1) {
      for (const part of parts) {
        if (/^\d+$/.test(part)) {
          for (const nw of expandNumberTokens(part, words)) {
            pushResolvedWordOrFallback(queue, nw, words, charEnd, stressed);
          }
        } else {
          pushResolvedWordOrFallback(queue, part, words, charEnd, stressed);
        }
      }
      return;
    }
  }

  // Handle mixed alphanumeric fragments (e.g. "84c" -> "eighty-four charlie", "a2" -> "alpha two")
  const numAlpha = key.match(/^(\d+)([a-z]+)$/);
  if (numAlpha) {
    for (const nw of expandNumberTokens(numAlpha[1], words)) {
      pushResolvedWordOrFallback(queue, nw, words, charEnd, stressed);
    }
    const suffix = numAlpha[2];
    const mappedSuffix =
      suffix.length === 1 && NATO_UNIT_WORDS[suffix.toUpperCase()]
        ? NATO_UNIT_WORDS[suffix.toUpperCase()]
        : suffix;
    pushResolvedWordOrFallback(queue, mappedSuffix, words, charEnd, stressed);
    return;
  }

  const alphaNum = key.match(/^([a-z]+)(\d+)$/);
  if (alphaNum) {
    pushResolvedWordOrFallback(queue, alphaNum[1], words, charEnd, stressed);
    for (const nw of expandNumberTokens(alphaNum[2], words)) {
      pushResolvedWordOrFallback(queue, nw, words, charEnd, stressed);
    }
    return;
  }

  queue.push({
    kind: "fallback",
    rawWord: token,
    charEnd,
    stressed,
  });
}

function hasTrailingExclamationOrQuestion(text: string, idx: number): boolean {
  let j = idx;
  while (
    j < text.length &&
    (text[j] === "]" ||
      text[j] === ")" ||
      text[j] === ">" ||
      text[j] === '"' ||
      text[j] === "'" ||
      text[j] === " ")
  ) {
    j += 1;
  }
  const ch = text[j] ?? "";
  return ch === "!" || ch === "?";
}

function computeIsStressedToken(
  rawSegment: string,
  hasLowerCase: boolean,
  trailingShout: boolean,
): boolean {
  if (trailingShout) return true;
  if (/\d/.test(rawSegment)) return true;
  const lettersOnly = rawSegment.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length >= 2 && hasLowerCase && lettersOnly === lettersOnly.toUpperCase()) {
    return true;
  }
  const upper = rawSegment.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return IMPORTANT_KEYWORDS.has(upper);
}

/**
 * Tokenizes K.O.M.R.A.D.-84 terminal text into spoken VOX word slices, punctuation pauses,
 * expanded contractions/possessives/ranges/ratios/units/numbers/acronyms, morphological stems,
 * and OOV multi-syllable formant words (never skipping or truncating any word).
 */
export function tokenizeToVoxQueue(
  text: string,
  words: Record<string, VoxWordEntry>,
): VoxQueueItem[] {
  const normalizedText = text.replace(/[’‘]/g, "'");
  const queue: VoxQueueItem[] = [];
  const hasLowerCase = /[a-z]/.test(normalizedText);

  const emojiOrDecorRe =
    /^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|\uFE0F|\u200D|[\s[\]<>(){}"*`~|\\])+/u;
  const komradRe =
    /^K\.O\.M\.R\.A\.D\.?(?:[-\s]?84)?(?=$|[^A-Za-z0-9])|^KOMRAD(?:[-\s]?84)?(?=$|[^A-Za-z0-9])/i;
  const skalaRe = /^SKALA(?:[-\s]?84)?(?=$|[^A-Za-z0-9])/i;
  const sectorRe = /^SEC(?:TOR)?[-\s]?84(?=$|[^A-Za-z0-9])/i;
  const az5Re = /^AZ-?5(?=$|[^A-Za-z0-9])/i;
  const heN2Re = /^HE-?N2(?=$|[^A-Za-z0-9])/i;
  const unitLetterDashNumRe = /^(?:UNIT[\s-]+)?([ABC])-([0-9]+)(?=$|[^A-Za-z0-9])/i;
  const unitLetterWordRe = /^UNIT[\s-]+([ABC])(?=$|[^A-Za-z0-9])/i;
  const mcpRe = /^MCP(?:[-\s]+([0-9]+))?(?=$|[^A-Za-z0-9])/i;
  const fwRe = /^FW(?=$|[^A-Za-z0-9])/i;
  const rhRe = /^(?:m?R\/HR?|R\/H)(?=$|[^A-Za-z0-9])/i;
  const h2oRe = /^H2O(?=$|[^A-Za-z0-9])/i;
  const plusMinusNumRe =
    /^±\s*(\d+(?:\.\d+)?)\s*(?:(°\s*C?|deg(?:rees?)?\s*C?|C(?![A-Za-z0-9])|MWh|MWe|MWt|MW|BAR|%|mm|R\/HR?|R\/H|secs?|seconds?|mins?|minutes?|hrs?|hours?))?(?=$|[^A-Za-z0-9])/i;
  const hashNumRe = /^#\s*(\d+)(?=$|[^A-Za-z0-9])/;
  const numRangeRe =
    /^(\d+(?:\.\d+)?)(?:[-–]|(?:\s+[-–]\s+))(\d+(?:\.\d+)?)\s*(?:(°\s*C?|deg(?:rees?)?\s*C?|C(?![A-Za-z0-9])|MWh|MWe|MWt|MW|BAR|%|mm|R\/HR?|R\/H|secs?|seconds?|mins?|minutes?|hrs?|hours?))?(?=$|[^A-Za-z0-9])/i;
  const numSlashNumRe =
    /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:(°\s*C?|deg(?:rees?)?\s*C?|C(?![A-Za-z0-9])|MWh|MWe|MWt|MW|BAR|%|mm|R\/HR?|R\/H|secs?|seconds?|mins?|minutes?|hrs?|hours?))?(?=$|[^A-Za-z0-9])/i;
  const numWithUnitRe =
    /^([+-]?\d+(?:\.\d+)?)\s*(?:(°\s*C?|deg(?:rees?)?\s*C?|C(?![A-Za-z0-9])|MWh|MWe|MWt|MW|BAR|%|mm|R\/HR?|R\/H|secs?|seconds?|mins?|minutes?|hrs?|hours?))?(?=$|[^A-Za-z0-9])/i;
  const standaloneUnitRe =
    /^(?:(MWh|MWe|MWt|MW)|(%)|(°\s*C?|deg(?:rees?)?\s*C?)|(&)|(mm)|(secs?)|(mins?)|(hrs?)|(temp)|(press?)|(lvl)|(ctrl)|(gen)|(alloc))/i;
  const acronymWordRe = /^(?:[A-Za-z]\.){2,}[A-Za-z]?\.?/;
  const wordRe = /^[A-Za-z0-9][A-Za-z0-9'-]*/;

  let i = 0;
  while (i < normalizedText.length) {
    const slice = normalizedText.slice(i);

    // 1. Skip whitespace, emojis, pictographs, and decorative brackets
    const skipMatch = slice.match(emojiOrDecorRe);
    if (skipMatch) {
      i += skipMatch[0].length;
      continue;
    }

    const ch = normalizedText[i];

    // 2. Punctuation pauses
    if (ch === "," || ch === ";" || ch === "—" || ch === "–") {
      i += 1;
      queue.push({ kind: "pause", durSec: PUNCT_COMMA_PAUSE_SEC, terminator: ",", charEnd: i });
      continue;
    }
    if (ch === ":" || (ch === "-" && normalizedText[i + 1] === "-")) {
      const step = ch === "-" ? 2 : 1;
      const prevCh = i > 0 ? normalizedText[i - 1] : "";
      const nextCh = normalizedText[i + step] ?? "";
      i += step;
      if (!(ch === ":" && isDigitChar(prevCh) && isDigitChar(nextCh))) {
        queue.push({ kind: "pause", durSec: PUNCT_COMMA_PAUSE_SEC, terminator: ",", charEnd: i });
      }
      continue;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      const prevCh = i > 0 ? normalizedText[i - 1] : "";
      const nextCh = i + 1 < normalizedText.length ? normalizedText[i + 1] : "";
      if (ch === "." && isAlphaNum(prevCh) && (isAlphaNum(nextCh) || nextCh === "-")) {
        i += 1;
        continue;
      }
      const term: "." | "!" | "?" = ch === "!" ? "!" : ch === "?" ? "?" : ".";
      while (
        i < normalizedText.length &&
        (normalizedText[i] === "." || normalizedText[i] === "!" || normalizedText[i] === "?")
      ) {
        i += 1;
      }
      queue.push({ kind: "pause", durSec: PUNCT_SENTENCE_PAUSE_SEC, terminator: term, charEnd: i });
      continue;
    }

    // 3. Domain acronyms & special compounds before general splitting
    let m: RegExpMatchArray | null = null;

    if ((m = slice.match(rhRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "roentgen", words, i, stressed);
      continue;
    }

    if ((m = slice.match(komradRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "komrad", words, i, stressed);
      if (/84/.test(m[0])) {
        pushResolvedWordOrFallback(queue, "eighty-four", words, i, stressed);
      }
      continue;
    }

    if ((m = slice.match(skalaRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "terminal", words, i, stressed);
      if (/84/.test(m[0])) {
        pushResolvedWordOrFallback(queue, "eighty-four", words, i, stressed);
      }
      continue;
    }

    if ((m = slice.match(sectorRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "sector", words, i, stressed);
      pushResolvedWordOrFallback(queue, "eighty-four", words, i, stressed);
      continue;
    }

    if ((m = slice.match(az5Re))) {
      i += m[0].length;
      const stressed = true;
      pushResolvedWordOrFallback(queue, "alpha", words, i, stressed);
      pushResolvedWordOrFallback(queue, "five", words, i, stressed);
      pushResolvedWordOrFallback(queue, "scram", words, i, stressed);
      continue;
    }

    if ((m = slice.match(heN2Re))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "helium", words, i, stressed);
      continue;
    }

    if ((m = slice.match(unitLetterDashNumRe))) {
      i += m[0].length;
      const letterWord = NATO_UNIT_WORDS[m[1].toUpperCase()] ?? m[1].toLowerCase();
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "unit", words, i, stressed);
      pushResolvedWordOrFallback(queue, letterWord, words, i, stressed);
      for (const nw of expandNumberTokens(m[2], words)) {
        pushResolvedWordOrFallback(queue, nw, words, i, stressed);
      }
      continue;
    }

    if ((m = slice.match(unitLetterWordRe))) {
      i += m[0].length;
      const letterWord = NATO_UNIT_WORDS[m[1].toUpperCase()] ?? m[1].toLowerCase();
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "unit", words, i, stressed);
      pushResolvedWordOrFallback(queue, letterWord, words, i, stressed);
      continue;
    }

    if ((m = slice.match(mcpRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "pumps", words, i, stressed);
      if (m[1]) {
        for (const nw of expandNumberTokens(m[1], words)) {
          pushResolvedWordOrFallback(queue, nw, words, i, stressed);
        }
      }
      continue;
    }

    if ((m = slice.match(fwRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "feedwater", words, i, stressed);
      continue;
    }

    if ((m = slice.match(h2oRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "water", words, i, stressed);
      continue;
    }

    // 4. Special symbols (±1%, #84) and numeric ranges/ratios (60-72 BAR, 300/600 MW)
    if ((m = slice.match(plusMinusNumRe))) {
      i += m[0].length;
      const stressed = true;
      pushResolvedWordOrFallback(queue, "plus", words, i, stressed);
      pushResolvedWordOrFallback(queue, "or", words, i, stressed);
      pushResolvedWordOrFallback(queue, "minus", words, i, stressed);
      for (const nw of expandNumberTokens(m[1], words)) {
        pushResolvedWordOrFallback(queue, nw, words, i, stressed);
      }
      if (m[2]) {
        pushUnitToken(queue, m[2].trim(), words, i, stressed, m[1] === "1");
      }
      continue;
    }

    if ((m = slice.match(hashNumRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, "number", words, i, stressed);
      for (const nw of expandNumberTokens(m[1], words)) {
        pushResolvedWordOrFallback(queue, nw, words, i, stressed);
      }
      continue;
    }

    if (isDigitChar(ch) && (m = slice.match(numRangeRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      for (const nw of expandNumberTokens(m[1], words)) {
        pushResolvedWordOrFallback(queue, nw, words, i, stressed);
      }
      pushResolvedWordOrFallback(queue, "to", words, i, stressed);
      for (const nw of expandNumberTokens(m[2], words)) {
        pushResolvedWordOrFallback(queue, nw, words, i, stressed);
      }
      if (m[3]) {
        pushUnitToken(queue, m[3].trim(), words, i, stressed, false);
      }
      continue;
    }

    if (isDigitChar(ch) && (m = slice.match(numSlashNumRe))) {
      i += m[0].length;
      const stressed = computeIsStressedToken(
        m[0],
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      for (const nw of expandNumberTokens(m[1], words)) {
        pushResolvedWordOrFallback(queue, nw, words, i, stressed);
      }
      pushResolvedWordOrFallback(queue, "of", words, i, stressed);
      for (const nw of expandNumberTokens(m[2], words)) {
        pushResolvedWordOrFallback(queue, nw, words, i, stressed);
      }
      if (m[3]) {
        pushUnitToken(queue, m[3].trim(), words, i, stressed, false);
      }
      continue;
    }

    // 5. Standalone numbers with optional adjacent units (750°C, 70 BAR, 600 MW, -140, 44%)
    if (
      isDigitChar(ch) ||
      ((ch === "-" || ch === "+") && isDigitChar(normalizedText[i + 1] ?? ""))
    ) {
      if ((m = slice.match(numWithUnitRe))) {
        i += m[0].length;
        const rawNum = m[1];
        const rawUnit = m[2]?.trim() ?? "";
        const stressed = computeIsStressedToken(
          m[0],
          hasLowerCase,
          hasTrailingExclamationOrQuestion(normalizedText, i),
        );
        for (const nw of expandNumberTokens(rawNum, words)) {
          pushResolvedWordOrFallback(queue, nw, words, i, stressed);
        }
        if (rawUnit) {
          pushUnitToken(queue, rawUnit, words, i, stressed, rawNum === "1" || rawNum === "+1");
        }
        continue;
      }
    }

    // 6. Standalone symbols / unit abbreviations (when not preceded by word-matched keys)
    if ((m = slice.match(standaloneUnitRe))) {
      const lookaheadEnd = m[0].length;
      const nextAfter = normalizedText[i + lookaheadEnd] ?? "";
      const boundaryOk = !isAlphaNum(nextAfter);
      if (boundaryOk) {
        const uLow = m[0].toLowerCase();
        // Expand "press" to "pressure" for telemetry values ("PRESS 70 BAR", "PRESS: 75"),
        // while keeping verb "PRESS [BORON INJECTION]" as recorded VOX "press".
        const restAfterToken = slice.slice(lookaheadEnd);
        const isPressAbbrev =
          uLow === "press" && /^\s*(?:[:=.]|[+-]?\d)/.test(restAfterToken);
        if (!(uLow === "press" && words.press && !isPressAbbrev)) {
          i += lookaheadEnd;
          const stressed = computeIsStressedToken(
            m[0],
            hasLowerCase,
            hasTrailingExclamationOrQuestion(normalizedText, i),
          );
          if (uLow === "&") {
            pushResolvedWordOrFallback(queue, "and", words, i, stressed);
          } else if (uLow === "temp") {
            pushResolvedWordOrFallback(queue, "temperature", words, i, stressed);
          } else if (uLow === "pres" || uLow === "press") {
            pushResolvedWordOrFallback(queue, "pressure", words, i, stressed);
          } else if (uLow === "lvl") {
            pushResolvedWordOrFallback(queue, "level", words, i, stressed);
          } else if (uLow === "ctrl") {
            pushResolvedWordOrFallback(queue, "control", words, i, stressed);
          } else if (uLow === "gen") {
            pushResolvedWordOrFallback(queue, "power", words, i, stressed);
          } else if (uLow === "alloc") {
            pushResolvedWordOrFallback(queue, "output", words, i, stressed);
          } else {
            pushUnitToken(queue, m[0], words, i, stressed, false);
          }
          continue;
        }
      }
    }

    // 7. Dotted acronyms (e.g., K.G.B., C.I.A.)
    if ((m = slice.match(acronymWordRe))) {
      i += m[0].length;
      const clean = m[0].replace(/\./g, "");
      const stressed = computeIsStressedToken(
        clean,
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, clean, words, i, stressed);
      continue;
    }

    // 8. Standard words, contractions, possessives & hyphenated tokens
    if ((m = slice.match(wordRe))) {
      i += m[0].length;
      const raw = m[0];
      const stressed = computeIsStressedToken(
        raw,
        hasLowerCase,
        hasTrailingExclamationOrQuestion(normalizedText, i),
      );
      pushResolvedWordOrFallback(queue, raw, words, i, stressed);
      continue;
    }

    // Special symbol fallbacks (+ -> plus, = -> is, / -> separator)
    if (ch === "+") {
      i += 1;
      pushResolvedWordOrFallback(queue, "plus", words, i, false);
      continue;
    }
    if (ch === "=") {
      i += 1;
      pushResolvedWordOrFallback(queue, "is", words, i, false);
      continue;
    }

    i += 1;
  }

  return queue;
}

function mapVowelClusterToPhoneme(
  upperWord: string,
  relStart: number,
  relEnd: number,
): KomradVowelKey {
  const cluster = upperWord.slice(relStart, relEnd);
  const next1 = upperWord[relEnd] ?? "";
  const next2 = upperWord[relEnd + 1] ?? "";
  const prev1 = relStart > 0 ? upperWord[relStart - 1] : "";

  if (cluster === "EYE") {
    return "AA";
  }
  if (cluster === "OO" || cluster === "OU" || cluster === "EW" || cluster === "UE") {
    return cluster === "OU" && (next1 === "T" || next1 === "N") ? "AA" : "UW";
  }
  if (cluster === "EE" || cluster === "IE") {
    return "IY";
  }
  if (cluster === "EA") {
    return next1 === "R" && !isVowelChar(next2) ? "ER" : "IY";
  }
  if (cluster === "OA" || cluster === "OW") {
    return "OW";
  }
  if (cluster === "AI" || cluster === "AY" || cluster === "EI" || cluster === "EY") {
    return "EH";
  }
  if (cluster === "AU" || cluster === "AW") {
    return "AA";
  }
  if (cluster === "OI" || cluster === "OY") {
    return "OW";
  }
  if (cluster === "EU") {
    return next1 === "R" ? "ER" : "UW";
  }

  const ch = cluster[0] ?? "A";
  if (ch === "Y") return "IY";
  if (ch === "I") {
    if (next1 === "R" && !isVowelChar(next2)) return "ER";
    return "IY";
  }
  if (ch === "E") {
    if (next1 === "R" && !isVowelChar(next2)) return "ER";
    return "EH";
  }
  if (ch === "U") {
    if (next1 === "R" && !isVowelChar(next2)) return "ER";
    if (
      next1 === "N" ||
      next1 === "B" ||
      next1 === "E" ||
      (prev1 === "T" && next1 === "B")
    ) {
      return "UW";
    }
    return "UH";
  }
  if (ch === "O") {
    if (next1 === "R" && !isVowelChar(next2)) {
      return next2 === "E" ? "OW" : "ER";
    }
    if (
      next1 === "" ||
      next1 === "L" ||
      next1 === "N" ||
      next1 === "D" ||
      (next1 === "T" && next2 === "A")
    ) {
      return upperWord === "TO" || upperWord === "DO" ? "UW" : "OW";
    }
    return "AA";
  }
  if (next1 === "R" && !isVowelChar(next2)) return "AA";
  if (relEnd === upperWord.length || upperWord === "A") return "UH";
  if (next1 === "L" || next1 === "W") return "AA";
  return "AE";
}

function analyzeConsonantCluster(
  rawCluster: string,
  nextVowelChar: string,
  adjacentChar: string,
): ConsonantArticulation {
  const cluster = rawCluster.toUpperCase().replace(/[^A-Z]/g, "");
  const aUp = adjacentChar.toUpperCase();
  const rolledR = cluster.includes("R") || aUp === "R";

  if (!cluster) {
    return {
      kind: "none",
      locusHz: 1400,
      locusFormants: null,
      voiced: false,
      rolledR,
    };
  }

  const last = cluster[cluster.length - 1];
  const lastTwo = cluster.slice(-2);
  const vUp = nextVowelChar.toUpperCase();
  const softC = last === "C" && (vUp === "E" || vUp === "I" || vUp === "Y");

  if (lastTwo === "SH" || lastTwo === "CH") {
    return {
      kind: "sh",
      locusHz: 2350,
      locusFormants: [320, 2050, 2750],
      voiced: false,
      rolledR,
    };
  }
  if (last === "S" || last === "Z" || last === "X" || softC) {
    return {
      kind: "sibilant",
      locusHz: 2850,
      locusFormants: [310, 1950, 2850],
      voiced: last === "Z",
      rolledR,
    };
  }
  if (last === "K" || last === "G" || last === "Q" || last === "C") {
    return {
      kind: "stop",
      locusHz: 2100,
      locusFormants: [360, 2150, 2650],
      voiced: last === "G",
      rolledR,
    };
  }
  if (last === "T" || last === "D") {
    return {
      kind: "stop",
      locusHz: 1650,
      locusFormants: [320, 1750, 2600],
      voiced: last === "D",
      rolledR,
    };
  }
  if (last === "P" || last === "B") {
    return {
      kind: "stop",
      locusHz: 700,
      locusFormants: [280, 820, 2150],
      voiced: last === "B",
      rolledR,
    };
  }
  if (last === "M" || last === "N") {
    return {
      kind: "nasal",
      locusHz: 250,
      locusFormants: last === "M" ? [280, 920, 2180] : [300, 1550, 2550],
      voiced: true,
      rolledR,
    };
  }
  if (last === "F" || last === "V" || last === "H" || lastTwo === "TH") {
    return {
      kind: "fricative",
      locusHz: 2500,
      locusFormants: null,
      voiced: last === "V",
      rolledR,
    };
  }
  if (last === "Y" || last === "W" || last === "L" || last === "R") {
    return {
      kind: "glide",
      locusHz: last === "Y" ? 2200 : 850,
      locusFormants: last === "Y" ? [300, 2150, 2850] : [360, 880, 2150],
      voiced: true,
      rolledR,
    };
  }

  return {
    kind: "none",
    locusHz: 1400,
    locusFormants: null,
    voiced: false,
    rolledR,
  };
}

function splitMedialConsonants(medial: string): [string, string] {
  if (medial.length === 0) return ["", ""];
  if (medial.length === 1) return ["", medial];
  if (medial.length >= 3 && VALID_ONSET_CLUSTERS.has(medial.slice(-3))) {
    return [medial.slice(0, -3), medial.slice(-3)];
  }
  if (VALID_ONSET_CLUSTERS.has(medial.slice(-2))) {
    return [medial.slice(0, -2), medial.slice(-2)];
  }
  return [medial.slice(0, -1), medial.slice(-1)];
}

/**
 * Breaks any out-of-vocabulary word or initialism into articulated English syllables
 * so 100% of every word on screen is spoken seamlessly at full rhythm (never chirped/skipped).
 */
export function decomposeWordToSyllables(rawWord: string): SyllableSpec[] {
  const upper = rawWord.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!upper) return [];

  if (/^\d+$/.test(upper)) {
    const numWords = expandNumberTokens(upper, {});
    return numWords.flatMap((w) => decomposeWordToSyllables(w));
  }

  const lettersOnly = upper.replace(/[^A-Z]/g, "");
  if (!lettersOnly) return [];

  // Handle known uppercase initialisms and consonant-only abbreviations letter-by-letter
  const hasAnyVowel = /[AEIOUY]/.test(lettersOnly);
  if (KNOWN_INITIALISMS.has(lettersOnly) || !hasAnyVowel) {
    const out: SyllableSpec[] = [];
    for (let li = 0; li < lettersOnly.length; li++) {
      const lSpecs = LETTER_PHONEMES[lettersOnly[li]] ?? [{ onset: "", vowel: "EH", coda: "" }];
      for (let si = 0; si < lSpecs.length; si++) {
        const sp = lSpecs[si];
        out.push({
          onset: analyzeConsonantCluster(sp.onset, sp.vowel[0], sp.coda),
          vowel: sp.vowel,
          coda: analyzeConsonantCluster(sp.coda, "", ""),
          durSec: li === lettersOnly.length - 1 ? 0.145 : 0.125,
          stressed: li === 0 && si === 0,
        });
      }
    }
    return out;
  }

  // Locate vowel clusters (treating leading Y before [AEIOU] as palatal consonant onset)
  const clusters: { start: number; end: number }[] = [];
  let i = 0;
  while (i < lettersOnly.length) {
    const ch = lettersOnly[i];
    const next = lettersOnly[i + 1] ?? "";
    const leadingGlideY = i === 0 && ch === "Y" && /[AEIOU]/.test(next);
    if (!leadingGlideY && isVowelChar(ch)) {
      const start = i;
      i += 1;
      while (i < lettersOnly.length && isVowelChar(lettersOnly[i])) {
        i += 1;
      }
      clusters.push({ start, end: i });
    } else {
      i += 1;
    }
  }

  if (clusters.length === 0) {
    return [
      {
        onset: analyzeConsonantCluster(lettersOnly, "A", ""),
        vowel: "UH",
        coda: analyzeConsonantCluster("", "", ""),
        durSec: 0.16,
        stressed: true,
      },
    ];
  }

  // Drop silent trailing single 'E' when word has >= 2 vowel clusters (unless syllabic -LE)
  if (
    clusters.length >= 2 &&
    clusters[clusters.length - 1].end === lettersOnly.length &&
    clusters[clusters.length - 1].end - clusters[clusters.length - 1].start === 1 &&
    lettersOnly[clusters[clusters.length - 1].start] === "E"
  ) {
    const beforeE = lettersOnly[clusters[clusters.length - 1].start - 1] ?? "";
    const beforeL = lettersOnly[clusters[clusters.length - 1].start - 2] ?? "";
    const isSyllabicLe = beforeE === "L" && beforeL !== "" && !isVowelChar(beforeL);
    if (!isSyllabicLe) {
      clusters.pop();
    }
  }

  const syllCount = clusters.length;
  const specs: SyllableSpec[] = [];

  for (let s = 0; s < syllCount; s++) {
    const cl = clusters[s];
    const onsetStr =
      s === 0
        ? lettersOnly.slice(0, cl.start)
        : splitMedialConsonants(lettersOnly.slice(clusters[s - 1].end, cl.start))[1];
    const codaStr =
      s === syllCount - 1
        ? lettersOnly.slice(cl.end)
        : splitMedialConsonants(lettersOnly.slice(cl.end, clusters[s + 1].start))[0];

    const vowel = mapVowelClusterToPhoneme(lettersOnly, cl.start, cl.end);
    const stressed = s === 0 || (syllCount >= 3 && s === syllCount - 2);
    const baseDur =
      syllCount === 1
        ? 0.19
        : s === 0
          ? 0.145
          : s === syllCount - 1
            ? 0.15
            : 0.118;
    const codaBonus = codaStr.length > 0 ? 0.018 : 0;
    const durSec = Math.min(0.24, baseDur + codaBonus);

    specs.push({
      onset: analyzeConsonantCluster(onsetStr, lettersOnly[cl.start] ?? "A", codaStr),
      vowel,
      coda: analyzeConsonantCluster(codaStr, "", onsetStr),
      durSec,
      stressed,
    });
  }

  return specs;
}

function isRadioHoldoffActive(): boolean {
  const s = useGameStore.getState();
  const nowMs = nowPerfMs();
  if (doesRadioDominateSubtitles(s.radioOn, s.radioVolume, s.radioBroadcastSubtitle)) {
    lastRadioSubtitleActiveMs = nowMs;
    return true;
  }
  return nowMs - lastRadioSubtitleActiveMs < RADIO_BROADCAST_HOLDOFF_MS;
}

function canKomradSpeakAudio(): boolean {
  const s = useGameStore.getState();
  if (s.isMusicMuted) return false;
  if (s.diagFeedActive) return false;
  if (s.phase !== "playing") return false;
  if (!s.isShiftControlReady) return false;
  if (s.isBlackout && !s.isGodMode) return false;
  if (isRadioHoldoffActive()) return false;
  return true;
}

function createAsymmetricTubeCurve(): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
  const curve = new Float32Array(buffer);
  const raw = new Float32Array(samples);
  let maxAbs = 0.001;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    const y = x >= 0 ? Math.tanh(x * 2.1) : Math.tanh(x * 1.65) - 0.05 * x * x;
    raw[i] = y;
    const a = Math.abs(y);
    if (a > maxAbs) maxAbs = a;
  }
  for (let i = 0; i < samples; i++) {
    curve[i] = raw[i] / maxAbs;
  }
  return curve;
}

function isRoutineAmbientMessage(
  msg: KomradMessageEntry | undefined,
  effectiveMood: KomradMood,
): boolean {
  if (!msg) return true;
  if (effectiveMood !== "normal" || msg.mood !== "normal") return false;
  if (msg.sender !== "K.O.M.R.A.D.-84") return false;
  return !/(ALERT|CRITICAL|WARNING|SABOTAGE|INTRUSION|SCRAM|OVERRIDE|MELTDOWN|BREACH|RADIATION|VIOLATION)/i.test(
    msg.text,
  );
}

function computeMessagePriority(
  msg: KomradMessageEntry | undefined,
  effectiveMood: KomradMood,
): number {
  if (!msg) return 1;
  if (effectiveMood === "critical" || msg.mood === "critical") return 3;
  if (
    effectiveMood === "warning" ||
    msg.mood === "warning" ||
    !isRoutineAmbientMessage(msg, effectiveMood)
  ) {
    return 2;
  }
  return 1;
}

function isCriticalBypassMessage(msg: KomradMessageEntry): boolean {
  if (msg.forceInterrupt || msg.mood === "critical") return true;
  return /NIGHT SHIFT COMMENCING|VOLKOV IS OFF SHIFT|TAKING DIRECT SUPERVISION|AZ-5|MELTDOWN|STEAM EXPLOSION/i.test(
    msg.text,
  );
}

function computeTargetMasterGain(
  msg: KomradMessageEntry | undefined,
  effectiveMood: KomradMood,
): number {
  if (effectiveMood === "critical" || effectiveMood === "warning") {
    return ALERT_MASTER_GAIN;
  }
  return isRoutineAmbientMessage(msg, effectiveMood)
    ? ROUTINE_MASTER_GAIN
    : ALERT_MASTER_GAIN;
}

function ensureVoiceChain(
  audio: AudioContext,
  initialGain: number,
): VoiceAudioChain {
  if (cachedChain && cachedChain.ctx === audio) {
    return cachedChain;
  }

  const voxInput = audio.createGain();
  voxInput.gain.value = 1.0;

  const busInput = audio.createGain();
  busInput.gain.value = 1.0;

  const consonantBusInput = audio.createGain();
  consonantBusInput.gain.value = 1.0;

  // Unified Dark Soviet Mainframe Vocoder & Overwatch PA Horn Bus:
  // Highpass 95Hz -> Dark Chest +5.5dB @ 155Hz -> 56Hz Ring-Mod ->
  // Parallel 9.2ms Metallic Comb Resonator -> Asymmetric Tube Saturation ->
  // PA Presence +3.5dB @ 1450Hz -> Dark Lowpass 2750Hz -> 36ms Bunker Slapback
  const paHighpass = audio.createBiquadFilter();
  paHighpass.type = "highpass";
  paHighpass.frequency.value = 95;
  paHighpass.Q.value = 0.75;

  const chestResonance = audio.createBiquadFilter();
  chestResonance.type = "peaking";
  chestResonance.frequency.value = 155;
  chestResonance.Q.value = 1.25;
  chestResonance.gain.value = 5.5;

  const ringModGain = audio.createGain();
  ringModGain.gain.value = 1.0;

  const ringModOsc = audio.createOscillator();
  ringModOsc.type = "sine";
  ringModOsc.frequency.value = 56;

  const ringModDepth = audio.createGain();
  ringModDepth.gain.value = 0.15;
  ringModOsc.connect(ringModDepth);
  ringModDepth.connect(ringModGain.gain);
  ringModOsc.start();

  // Parallel Metallic Comb Resonator (9.2ms delay, fb 0.40, wet 0.35)
  const combDry = audio.createGain();
  combDry.gain.value = 0.78;

  const combDelay = audio.createDelay(0.05);
  combDelay.delayTime.value = 0.0092;

  const combDamp = audio.createBiquadFilter();
  combDamp.type = "lowpass";
  combDamp.frequency.value = 2600;
  combDamp.Q.value = 0.7;

  const combFeedback = audio.createGain();
  combFeedback.gain.value = 0.4;

  const combWet = audio.createGain();
  combWet.gain.value = 0.35;

  const combSum = audio.createGain();
  combSum.gain.value = 1.0;

  const driveGain = audio.createGain();
  driveGain.gain.value = 1.05;

  const paShaper = audio.createWaveShaper();
  paShaper.curve = createAsymmetricTubeCurve();
  paShaper.oversample = "2x";

  const paPresence = audio.createBiquadFilter();
  paPresence.type = "peaking";
  paPresence.frequency.value = 1450;
  paPresence.Q.value = 1.15;
  paPresence.gain.value = 3.5;

  const paLowpass = audio.createBiquadFilter();
  paLowpass.type = "lowpass";
  paLowpass.frequency.value = 2750;
  paLowpass.Q.value = 0.85;

  const consHighpass = audio.createBiquadFilter();
  consHighpass.type = "highpass";
  consHighpass.frequency.value = 650;
  consHighpass.Q.value = 0.7;

  const dryGain = audio.createGain();
  dryGain.gain.value = 0.94;

  // 36ms concrete bunker slapback (wet = 0.14)
  const slapDelay = audio.createDelay(0.12);
  slapDelay.delayTime.value = 0.036;

  const slapBp = audio.createBiquadFilter();
  slapBp.type = "bandpass";
  slapBp.frequency.value = 1350;
  slapBp.Q.value = 1.05;

  const slapFeedback = audio.createGain();
  slapFeedback.gain.value = 0.14;

  const slapWet = audio.createGain();
  slapWet.gain.value = 0.14;

  const paBusSum = audio.createGain();
  paBusSum.gain.value = 1.0;

  const analyser = audio.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.42;
  analyser.minDecibels = -82;
  analyser.maxDecibels = -18;

  const masterGain = audio.createGain();
  const initialAllowed = canKomradSpeakAudio();
  const startGain = initialAllowed ? initialGain : 0;
  masterGain.gain.setValueAtTime(startGain, audio.currentTime);
  lastMasterAllowed = initialAllowed;
  lastMasterTarget = startGain;

  voxInput.connect(paHighpass);
  busInput.connect(paHighpass);
  paHighpass.connect(chestResonance);
  chestResonance.connect(ringModGain);

  consonantBusInput.connect(consHighpass);
  consHighpass.connect(ringModGain);

  ringModGain.connect(combDry);
  combDry.connect(combSum);

  ringModGain.connect(combDelay);
  combDelay.connect(combDamp);
  combDamp.connect(combFeedback);
  combFeedback.connect(combDelay);
  combDamp.connect(combWet);
  combWet.connect(combSum);

  combSum.connect(driveGain);
  driveGain.connect(paShaper);
  paShaper.connect(paPresence);
  paPresence.connect(paLowpass);

  paLowpass.connect(dryGain);
  dryGain.connect(paBusSum);

  paLowpass.connect(slapDelay);
  slapDelay.connect(slapBp);
  slapBp.connect(slapFeedback);
  slapFeedback.connect(slapDelay);
  slapBp.connect(slapWet);
  slapWet.connect(paBusSum);

  paBusSum.connect(analyser);
  analyser.connect(masterGain);
  masterGain.connect(audio.destination);

  const noiseLen = Math.max(1, Math.floor(audio.sampleRate));
  const noiseBuffer = audio.createBuffer(1, noiseLen, audio.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const timeDomainBuf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  const freqDataBuf = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

  cachedChain = {
    ctx: audio,
    voxInput,
    busInput,
    consonantBusInput,
    driveGain,
    analyser,
    masterGain,
    noiseBuffer,
    timeDomainBuf,
    freqDataBuf,
  };
  return cachedChain;
}

function updateMasterDucking(allowed: boolean, activeLevel: number): void {
  if (!cachedChain) return;
  const { ctx, masterGain } = cachedChain;
  if (ctx.state !== "running") return;
  const target = allowed ? activeLevel : 0;
  if (
    lastMasterAllowed === allowed &&
    Math.abs(lastMasterTarget - target) < 0.005
  ) {
    return;
  }
  lastMasterAllowed = allowed;
  lastMasterTarget = target;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(target, now + 0.025);
}

function ensureVoxPreloaded(audio: AudioContext): void {
  if (voxLoadState !== "idle" || audio.state !== "running") return;
  if (typeof fetch !== "function") {
    voxLoadState = "failed";
    return;
  }

  voxLoadState = "loading";
  void (async () => {
    try {
      const resp = await fetch(VOX_MANIFEST_URL);
      if (!resp.ok) {
        throw new Error(`VOX manifest HTTP ${resp.status}`);
      }
      const manifest = (await resp.json()) as VoxManifest;
      if (!manifest?.packs?.length || !manifest?.words) {
        throw new Error("Invalid VOX manifest format");
      }

      const decodedPacks = await Promise.all(
        manifest.packs.map(async (pack) => {
          const packResp = await fetch(pack.src);
          if (!packResp.ok) {
            throw new Error(`VOX pack ${pack.src} HTTP ${packResp.status}`);
          }
          const arr = await packResp.arrayBuffer();
          const audioBuf = await audio.decodeAudioData(arr);
          return [pack.id, audioBuf] as const;
        }),
      );

      voxBuffers.clear();
      for (const [id, buf] of decodedPacks) {
        voxBuffers.set(id, buf);
      }
      voxManifest = manifest;
      voxLoadState = "ready";
      vocalState.voxLoaded = true;

      if (manifest.clips?.length) {
        const clipResults = await Promise.allSettled(
          manifest.clips.map(async (clip) => {
            const clipResp = await fetch(clip.src);
            if (!clipResp.ok) {
              throw new Error(`VOX clip ${clip.src} HTTP ${clipResp.status}`);
            }
            const arr = await clipResp.arrayBuffer();
            const audioBuf = await audio.decodeAudioData(arr);
            return [clip.id, audioBuf] as const;
          }),
        );
        voxClipBuffers.clear();
        for (const res of clipResults) {
          if (res.status === "fulfilled") {
            voxClipBuffers.set(res.value[0], res.value[1]);
          }
        }
      }
    } catch {
      voxLoadState = "failed";
      vocalState.voxLoaded = false;
    }
  })();
}

function releaseActiveUtteranceNodes(fadeSec: number): void {
  const prevGain = activeUtteranceGain;
  const prevNodes = activeUtteranceNodes;
  activeUtteranceGain = null;
  activeUtteranceNodes = new Set();
  activeUtterancePriority = 0;
  activeUtteranceMsgId = "";
  activeUtteranceTextLen = 0;

  voxQueue = [];
  voxQueueCursor = 0;
  voxTimeline = [];
  voxTimelineIdx = 0;
  voxUtteranceEndAudioSec = 0;
  voxSpeakingAudioActive = false;

  if (!prevGain && prevNodes.size === 0) return;

  const ctx = cachedChain?.ctx ?? getAudioContext();
  if (ctx && ctx.state === "running") {
    const now = ctx.currentTime;
    const stopAt = now + fadeSec + 0.008;
    if (prevGain) {
      prevGain.gain.cancelScheduledValues(now);
      prevGain.gain.setValueAtTime(Math.max(0.0001, prevGain.gain.value), now);
      prevGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    }
    for (const node of prevNodes) {
      try {
        node.stop(stopAt);
      } catch {
        // node may already have stopped
      }
    }
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        for (const node of prevNodes) {
          try {
            node.disconnect();
          } catch {
            // ignore
          }
        }
        try {
          prevGain?.disconnect();
        } catch {
          // ignore
        }
      }, Math.ceil((fadeSec + 0.03) * 1000));
    }
  } else {
    for (const node of prevNodes) {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    }
    try {
      prevGain?.disconnect();
    } catch {
      // ignore
    }
  }
}

function cancelActiveVoxUtterance(fadeSec = 0.03): void {
  releaseActiveUtteranceNodes(fadeSec);
}

function finishActiveUtterance(elapsedSec: number): void {
  lastUtteranceEndElapsedSec = elapsedSec;
  const finalClause =
    activeSubtitleClauses.length > 0
      ? activeSubtitleClauses[activeSubtitleClauses.length - 1].text
      : voxTimeline.length > 0 && voxTimeline[voxTimeline.length - 1].clauseText
        ? voxTimeline[voxTimeline.length - 1].clauseText!
        : subtitleSnapshot.clause;
  if (finalClause) {
    subtitleHoldUntilMs = nowPerfMs() + KOMRAD_SUBTITLE_LINGER_MS;
    emitKomradSubtitle(
      finalClause,
      voxActiveMood || subtitleSnapshot.mood,
      false,
      activeUtteranceCleanText || subtitleSnapshot.fullText,
      null,
    );
  }
  releaseActiveUtteranceNodes(0.04);
  markKomradTransmissionEnd();
}

function playRelayClack(targetMasterLevel: number): void {
  if (!canKomradSpeakAudio()) return;
  const audio = getAudioContext();
  if (!audio || audio.state !== "running") return;

  const chain = ensureVoiceChain(audio, targetMasterLevel);
  const t0 = audio.currentTime;

  const noiseSrc = audio.createBufferSource();
  noiseSrc.buffer = chain.noiseBuffer;

  const clickBp = audio.createBiquadFilter();
  clickBp.type = "bandpass";
  clickBp.frequency.setValueAtTime(1600, t0);
  clickBp.Q.setValueAtTime(3.0, t0);

  const clickGain = audio.createGain();
  clickGain.gain.setValueAtTime(0.0001, t0);
  clickGain.gain.linearRampToValueAtTime(0.095, t0 + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.014);

  noiseSrc.connect(clickBp);
  clickBp.connect(clickGain);
  clickGain.connect(chain.masterGain);

  const thumpOsc = audio.createOscillator();
  thumpOsc.type = "triangle";
  thumpOsc.frequency.setValueAtTime(210, t0);
  thumpOsc.frequency.exponentialRampToValueAtTime(85, t0 + 0.018);

  const thumpGain = audio.createGain();
  thumpGain.gain.setValueAtTime(0.0001, t0);
  thumpGain.gain.linearRampToValueAtTime(0.08, t0 + 0.003);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.022);

  thumpOsc.connect(thumpGain);
  thumpGain.connect(chain.masterGain);

  const stopAt = t0 + 0.026;
  noiseSrc.start(t0, Math.random() * 0.8, 0.024);
  thumpOsc.start(t0);
  thumpOsc.stop(stopAt);
  thumpOsc.onended = () => {
    noiseSrc.disconnect();
    clickBp.disconnect();
    clickGain.disconnect();
    thumpOsc.disconnect();
    thumpGain.disconnect();
  };
}

function startOpenPaCarrierBed(
  audio: AudioContext,
  chain: VoiceAudioChain,
  uttGain: GainNode,
  nodesSet: Set<AudioScheduledSourceNode>,
): void {
  const t0 = audio.currentTime;

  const bedGain = audio.createGain();
  bedGain.gain.setValueAtTime(0.0001, t0);
  bedGain.gain.linearRampToValueAtTime(1.0, t0 + 0.025);
  bedGain.connect(uttGain);

  // Subtle 50 Hz mains transformer hum + faint filtered tape air bed across the whole utterance
  const humOsc = audio.createOscillator();
  humOsc.type = "sine";
  humOsc.frequency.setValueAtTime(50, t0);

  const humGain = audio.createGain();
  humGain.gain.setValueAtTime(0.014, t0);
  humOsc.connect(humGain);
  humGain.connect(bedGain);

  const airSrc = audio.createBufferSource();
  airSrc.buffer = chain.noiseBuffer;
  airSrc.loop = true;

  const airBp = audio.createBiquadFilter();
  airBp.type = "bandpass";
  airBp.frequency.setValueAtTime(1150, t0);
  airBp.Q.setValueAtTime(1.0, t0);

  const airGain = audio.createGain();
  airGain.gain.setValueAtTime(0.005, t0);

  airSrc.connect(airBp);
  airBp.connect(airGain);
  airGain.connect(bedGain);

  nodesSet.add(humOsc);
  nodesSet.add(airSrc);

  humOsc.start(t0);
  airSrc.start(t0, Math.random() * 0.5);

  humOsc.onended = () => {
    nodesSet.delete(humOsc);
    nodesSet.delete(airSrc);
    humOsc.disconnect();
    humGain.disconnect();
    airSrc.disconnect();
    airBp.disconnect();
    airGain.disconnect();
    bedGain.disconnect();
  };
}

/**
 * Synthesizes an entire multi-syllable word through the Dark Robotic Vocoder + PA Horn Bus
 * for any out-of-vocabulary word, keeping pitch & RMS locked with recorded VOX slices.
 */
function scheduleFormantWord(
  audio: AudioContext,
  chain: VoiceAudioChain,
  uttGain: GainNode,
  nodesSet: Set<AudioScheduledSourceNode>,
  rawWord: string,
  when: number,
  mood: KomradMood,
  stressed: boolean,
): number {
  const syllables = decomposeWordToSyllables(rawWord);
  if (syllables.length === 0) return 0.14;

  const rate = getBasePlaybackRate(mood);
  const basePitch = mood === "critical" ? 136 : mood === "warning" ? 132 : 128;
  const interSylGap = 0.004;
  let cursor = when;
  let prevF: [number, number, number] = [...NEUTRAL_FORMANTS];

  for (let si = 0; si < syllables.length; si++) {
    const syl = syllables[si];
    const isFinal = si === syllables.length - 1;
    const isStressed = stressed || syl.stressed;
    const pitchMod = isStressed ? 1.03 : isFinal && syllables.length > 1 ? 0.97 : 1.0;
    const f0 = basePitch * pitchMod;
    const dur = Math.max(
      0.055,
      (syl.durSec / rate) * (isStressed && si === 0 ? 1.06 : 1.0),
    );

    const hasOnset = syl.onset.kind !== "none";
    const onsetDur =
      syl.onset.kind === "sibilant" || syl.onset.kind === "sh"
        ? 0.028
        : syl.onset.kind === "stop"
          ? 0.016
          : hasOnset
            ? 0.02
            : 0;
    const vowelStart = cursor + (hasOnset ? Math.min(0.014, onsetDur * 0.6) : 0);
    const vowelDur = Math.max(0.052, dur - (vowelStart - cursor));
    const vowelEnd = vowelStart + vowelDur;

    // Glottal source: sawtooth + sub-octave dark weight + upper pulse + breath
    const sawOsc = audio.createOscillator();
    sawOsc.type = "sawtooth";
    sawOsc.frequency.setValueAtTime(f0, cursor);
    if (isFinal && syllables.length > 1) {
      sawOsc.frequency.linearRampToValueAtTime(f0 * 0.94, vowelEnd);
    }

    const subOsc = audio.createOscillator();
    subOsc.type = "square";
    subOsc.frequency.setValueAtTime(f0 * 0.5, cursor);

    const subGain = audio.createGain();
    subGain.gain.setValueAtTime(0.18, cursor);

    const pulseOsc = audio.createOscillator();
    pulseOsc.type = "square";
    pulseOsc.frequency.setValueAtTime(f0 * 2, cursor);

    const pulseGain = audio.createGain();
    pulseGain.gain.setValueAtTime(0.22, cursor);

    const breathSrc = audio.createBufferSource();
    breathSrc.buffer = chain.noiseBuffer;

    const breathGain = audio.createGain();
    breathGain.gain.setValueAtTime(0.05, cursor);

    const glottalSum = audio.createGain();
    glottalSum.gain.setValueAtTime(1.0, cursor);

    sawOsc.connect(glottalSum);
    subOsc.connect(subGain);
    subGain.connect(glottalSum);
    pulseOsc.connect(pulseGain);
    pulseGain.connect(glottalSum);
    breathSrc.connect(breathGain);
    breathGain.connect(glottalSum);

    const [f1, f2, f3] = VOWEL_FORMANTS[syl.vowel];
    const locus = syl.onset.locusFormants;
    const startF1 = locus ? prevF[0] * 0.35 + locus[0] * 0.65 : prevF[0];
    const startF2 = locus ? prevF[1] * 0.35 + locus[1] * 0.65 : prevF[1];
    const startF3 = locus ? prevF[2] * 0.35 + locus[2] * 0.65 : prevF[2];
    const glideEnd = vowelStart + Math.max(0.032, Math.min(0.055, vowelDur * 0.55));

    const bp1 = audio.createBiquadFilter();
    bp1.type = "bandpass";
    bp1.frequency.setValueAtTime(startF1, vowelStart);
    bp1.frequency.linearRampToValueAtTime(f1, glideEnd);
    bp1.Q.setValueAtTime(5.5, cursor);

    const bp1Gain = audio.createGain();
    bp1Gain.gain.setValueAtTime(1.55, cursor);

    const bp2 = audio.createBiquadFilter();
    bp2.type = "bandpass";
    bp2.frequency.setValueAtTime(startF2, vowelStart);
    bp2.frequency.linearRampToValueAtTime(f2, glideEnd);
    bp2.Q.setValueAtTime(7.2, cursor);

    const bp2Gain = audio.createGain();
    bp2Gain.gain.setValueAtTime(1.15, cursor);

    const bp3 = audio.createBiquadFilter();
    bp3.type = "bandpass";
    bp3.frequency.setValueAtTime(startF3, vowelStart);
    bp3.frequency.linearRampToValueAtTime(f3, glideEnd);
    bp3.Q.setValueAtTime(9.0, cursor);

    const bp3Gain = audio.createGain();
    bp3Gain.gain.setValueAtTime(0.62, cursor);

    const bpChest = audio.createBiquadFilter();
    bpChest.type = "bandpass";
    bpChest.frequency.setValueAtTime(220, cursor);
    bpChest.Q.setValueAtTime(4.0, cursor);

    const bpChestGain = audio.createGain();
    bpChestGain.gain.setValueAtTime(syl.onset.kind === "nasal" ? 0.68 : 0.56, cursor);

    prevF = [f1, f2, f3];

    let trillOsc: OscillatorNode | null = null;
    let trillFreqGain: GainNode | null = null;
    if (syl.onset.rolledR) {
      trillOsc = audio.createOscillator();
      trillOsc.type = "sine";
      trillOsc.frequency.setValueAtTime(26, cursor);

      trillFreqGain = audio.createGain();
      trillFreqGain.gain.setValueAtTime(220, vowelStart);
      trillFreqGain.gain.linearRampToValueAtTime(0, vowelStart + 0.045);

      trillOsc.connect(trillFreqGain);
      trillFreqGain.connect(bp3.frequency);
    }

    const peakGain = (isStressed ? 0.62 : 0.55) * (isFinal ? 0.96 : 1.0);
    const envGain = audio.createGain();
    const atk = Math.min(0.015, vowelDur * 0.25);
    const rel = Math.min(0.036, vowelDur * 0.4);
    const relStart = Math.max(vowelStart + atk + 0.004, vowelEnd - rel);

    envGain.gain.setValueAtTime(0.0001, cursor);
    envGain.gain.setValueAtTime(0.0001, vowelStart);
    envGain.gain.linearRampToValueAtTime(peakGain, vowelStart + atk);
    envGain.gain.setValueAtTime(peakGain, relStart);
    envGain.gain.exponentialRampToValueAtTime(0.0001, vowelEnd);

    glottalSum.connect(bp1);
    bp1.connect(bp1Gain);
    bp1Gain.connect(envGain);

    glottalSum.connect(bp2);
    bp2.connect(bp2Gain);
    bp2Gain.connect(envGain);

    glottalSum.connect(bp3);
    bp3.connect(bp3Gain);
    bp3Gain.connect(envGain);

    glottalSum.connect(bpChest);
    bpChest.connect(bpChestGain);
    bpChestGain.connect(envGain);

    envGain.connect(uttGain);

    // Optional onset burst/frication + final coda consonant release
    const extraNodes: AudioNode[] = [];
    const extraSources: AudioScheduledSourceNode[] = [];

    const scheduleNoiseConsonant = (
      art: ConsonantArticulation,
      atSec: number,
      cDur: number,
      cAmp: number,
    ) => {
      if (art.kind !== "sibilant" && art.kind !== "sh" && art.kind !== "fricative" && art.kind !== "stop") {
        return;
      }
      const nSrc = audio.createBufferSource();
      nSrc.buffer = chain.noiseBuffer;

      const cBp = audio.createBiquadFilter();
      cBp.type = "bandpass";
      cBp.frequency.setValueAtTime(art.locusHz, atSec);
      cBp.Q.setValueAtTime(art.kind === "stop" ? 4.0 : 2.6, atSec);

      const cGain = audio.createGain();
      cGain.gain.setValueAtTime(0.0001, atSec);
      cGain.gain.linearRampToValueAtTime(cAmp, atSec + 0.004);
      cGain.gain.exponentialRampToValueAtTime(0.0001, atSec + cDur);

      nSrc.connect(cBp);
      cBp.connect(cGain);
      cGain.connect(uttGain);

      nodesSet.add(nSrc);
      extraSources.push(nSrc);
      extraNodes.push(nSrc, cBp, cGain);
      nSrc.start(atSec, Math.random() * 0.7, cDur + 0.006);
    };

    if (hasOnset) {
      const cAmp =
        syl.onset.kind === "sibilant" || syl.onset.kind === "sh"
          ? 0.22
          : syl.onset.kind === "stop"
            ? 0.26
            : 0.14;
      scheduleNoiseConsonant(syl.onset, cursor, onsetDur, cAmp);
    }

    let codaTail = 0;
    if (isFinal && syl.coda.kind !== "none" && syl.coda.kind !== "glide") {
      codaTail =
        syl.coda.kind === "sibilant" || syl.coda.kind === "sh"
          ? 0.044
          : syl.coda.kind === "stop"
            ? 0.018
            : 0.026;
      const codaAt = Math.max(vowelStart + 0.03, vowelEnd - 0.014);
      scheduleNoiseConsonant(
        syl.coda,
        codaAt,
        codaTail,
        syl.coda.kind === "sibilant" ? 0.18 : 0.15,
      );
    }

    const sylEnd = Math.max(vowelEnd, vowelEnd - 0.014 + codaTail);
    const stopAt = sylEnd + 0.015;

    nodesSet.add(sawOsc);
    nodesSet.add(subOsc);
    nodesSet.add(pulseOsc);
    nodesSet.add(breathSrc);
    if (trillOsc) nodesSet.add(trillOsc);

    sawOsc.start(cursor);
    subOsc.start(cursor);
    pulseOsc.start(cursor);
    breathSrc.start(cursor, Math.random() * 0.65, stopAt - cursor);
    trillOsc?.start(cursor);

    sawOsc.stop(stopAt);
    subOsc.stop(stopAt);
    pulseOsc.stop(stopAt);
    trillOsc?.stop(stopAt);

    sawOsc.onended = () => {
      nodesSet.delete(sawOsc);
      nodesSet.delete(subOsc);
      nodesSet.delete(pulseOsc);
      nodesSet.delete(breathSrc);
      if (trillOsc) nodesSet.delete(trillOsc);
      for (const sNode of extraSources) {
        nodesSet.delete(sNode);
      }
      sawOsc.disconnect();
      subOsc.disconnect();
      subGain.disconnect();
      pulseOsc.disconnect();
      pulseGain.disconnect();
      breathSrc.disconnect();
      breathGain.disconnect();
      trillOsc?.disconnect();
      trillFreqGain?.disconnect();
      glottalSum.disconnect();
      bp1.disconnect();
      bp1Gain.disconnect();
      bp2.disconnect();
      bp2Gain.disconnect();
      bp3.disconnect();
      bp3Gain.disconnect();
      bpChest.disconnect();
      bpChestGain.disconnect();
      envGain.disconnect();
      for (const node of extraNodes) {
        node.disconnect();
      }
    };

    cursor = sylEnd + interSylGap;
  }

  return Math.max(0.11, cursor - interSylGap - when);
}

function getBasePlaybackRate(mood: KomradMood): number {
  return mood === "critical" ? 1.12 : mood === "warning" ? 1.08 : 1.04;
}

function normalizeTextForClipMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchingClipForMessage(msg: KomradMessageEntry): VoxClipEntry | null {
  if (msg.spokenVoxText) return null;
  const clips = voxManifest?.clips;
  if (!clips?.length) return null;

  if (msg.id.startsWith("komrad-clip-")) {
    const rest = msg.id.slice("komrad-clip-".length);
    for (const clip of clips) {
      if (rest.startsWith(`${clip.id}-`) && voxClipBuffers.has(clip.id)) {
        return clip;
      }
    }
  }

  const normMsg = normalizeTextForClipMatch(msg.text);
  for (const clip of clips) {
    if (normalizeTextForClipMatch(clip.text) === normMsg && voxClipBuffers.has(clip.id)) {
      return clip;
    }
  }
  return null;
}

function beginVoxClipUtterance(
  audio: AudioContext,
  chain: VoiceAudioChain,
  msg: KomradMessageEntry,
  clip: VoxClipEntry,
  buf: AudioBuffer,
  mood: KomradMood,
  priority: number,
  targetMasterLevel: number,
): void {
  cancelActiveVoxUtterance(0.03);
  playRelayClack(targetMasterLevel);

  const drive = mood === "critical" ? 1.42 : mood === "warning" ? 1.22 : 1.05;
  chain.driveGain.gain.setTargetAtTime(drive, audio.currentTime, 0.015);

  const uttGain = audio.createGain();
  uttGain.gain.setValueAtTime(1.0, audio.currentTime);
  uttGain.connect(chain.voxInput);

  const nodesSet = new Set<AudioScheduledSourceNode>();
  activeUtteranceGain = uttGain;
  activeUtteranceNodes = nodesSet;
  activeUtterancePriority = priority;
  activeUtteranceMsgId = msg.id;
  activeUtteranceTextLen = msg.text.length;

  startOpenPaCarrierBed(audio, chain, uttGain, nodesSet);

  const rate = getBasePlaybackRate(mood);
  const when = audio.currentTime + 0.045;
  const playDur = buf.duration / rate;

  const src = audio.createBufferSource();
  src.buffer = buf;
  src.playbackRate.setValueAtTime(rate, when);

  const clipGain = audio.createGain();
  clipGain.gain.setValueAtTime(clip.gain || 1.0, when);
  src.connect(clipGain);
  clipGain.connect(uttGain);

  nodesSet.add(src);
  src.start(when);
  src.onended = () => {
    nodesSet.delete(src);
    src.disconnect();
    clipGain.disconnect();
  };

  // Map clip clauses onto msg.text reveal offsets scaled by 1/rate
  voxTimeline = [];
  let searchPos = 0;
  let prevCharEnd = 0;
  for (const cl of clip.clauses) {
    const idx = msg.text.indexOf(cl.text, searchPos);
    const charEnd =
      idx >= 0 ? idx + cl.text.length : Math.min(msg.text.length, prevCharEnd + cl.text.length);
    if (idx >= 0) searchPos = charEnd;

    const wordsInClause = cl.text.trim().split(/\s+/);
    const labelWord = wordsInClause[wordsInClause.length - 1]?.replace(/[^A-Za-z0-9-]/g, "") || null;
    const lastCh = cl.text.trim().slice(-1);
    const term: "." | "!" | "?" | "," | "" =
      lastCh === "!" ? "!" : lastCh === "?" ? "?" : lastCh === "," || lastCh === ":" ? "," : ".";

    const cleanClause = cleanSubtitleDisplayText(cl.text) || cl.text.trim();
    const clauseStartSec = when + cl.start / rate;
    const clauseEndSec = when + cl.end / rate;
    const subClauses =
      cleanClause.length > KOMRAD_SUBTITLE_MAX_LEN
        ? splitTextIntoSubtitleClauses(cleanClause)
        : [{ start: 0, end: cleanClause.length, text: cleanClause }];

    if (subClauses.length <= 1) {
      voxTimeline.push({
        startSec: clauseStartSec,
        endSec: clauseEndSec,
        prevCharEnd,
        charEnd,
        clauseText: subClauses[0]?.text ?? cleanClause,
        word: labelWord,
        stressed: false,
        terminator: term,
        isClipClause: true,
      });
    } else {
      const totalChars = Math.max(1, cleanClause.length);
      const totalDur = Math.max(0.08, clauseEndSec - clauseStartSec);
      const charSpan = Math.max(0, charEnd - prevCharEnd);
      for (let si = 0; si < subClauses.length; si++) {
        const sc = subClauses[si];
        const sFrac0 = sc.start / totalChars;
        const sFrac1 = sc.end / totalChars;
        voxTimeline.push({
          startSec: clauseStartSec + totalDur * sFrac0,
          endSec: clauseStartSec + totalDur * sFrac1,
          prevCharEnd: Math.round(prevCharEnd + charSpan * sFrac0),
          charEnd: Math.round(prevCharEnd + charSpan * sFrac1),
          clauseText: sc.text,
          word: labelWord,
          stressed: false,
          terminator: si === subClauses.length - 1 ? term : ",",
          isClipClause: true,
        });
      }
    }
    prevCharEnd = charEnd;
  }

  visualSubtitleActive = false;
  visualSubtitleClauses = [];
  visualSubtitleFullText = "";
  activeSubtitleClauses = [];
  activeUtteranceCleanText =
    cleanSubtitleDisplayText(clip.text) || clip.text.trim();
  subtitleHoldUntilMs = 0;
  emitKomradSubtitle(
    voxTimeline[0]?.clauseText ?? activeUtteranceCleanText,
    mood,
    true,
    activeUtteranceCleanText,
    voxTimeline[0]?.word ?? null,
  );

  voxQueue = [];
  voxQueueCursor = 0;
  voxTimelineIdx = 0;
  voxCursorAudioSec = when + playDur;
  voxUtteranceEndAudioSec = when + playDur;
  voxActiveMood = mood;
  voxSpeakingAudioActive = true;
  visualTypingActive = false;
  markKomradTransmissionStart();
}

function beginVisualSubtitle(msg: KomradMessageEntry, mood: KomradMood): void {
  const raw = msg.spokenVoxText ?? msg.text;
  const clean = cleanSubtitleDisplayText(raw);
  if (!clean) return;
  const clauses = splitTextIntoSubtitleClauses(clean);
  if (clauses.length === 0) return;
  visualSubtitleActive = true;
  visualSubtitleFullText = clean;
  visualSubtitleClauses = clauses;
  visualSubtitleCharCursor = 0;
  visualSubtitleAccumSec = 0;
  visualSubtitleMood = mood;
  subtitleHoldUntilMs = 0;
  emitKomradSubtitle(clauses[0].text, mood, true, clean, null);
}

function beginVoxUtterance(
  audio: AudioContext,
  chain: VoiceAudioChain,
  msg: KomradMessageEntry,
  mood: KomradMood,
  priority: number,
  targetMasterLevel: number,
): void {
  const matchedClip = findMatchingClipForMessage(msg);
  if (matchedClip) {
    const clipBuf = voxClipBuffers.get(matchedClip.id);
    if (clipBuf) {
      beginVoxClipUtterance(
        audio,
        chain,
        msg,
        matchedClip,
        clipBuf,
        mood,
        priority,
        targetMasterLevel,
      );
      return;
    }
  }

  cancelActiveVoxUtterance(0.03);
  playRelayClack(targetMasterLevel);

  const uttGain = audio.createGain();
  uttGain.gain.setValueAtTime(1.0, audio.currentTime);
  uttGain.connect(chain.voxInput);

  const nodesSet = new Set<AudioScheduledSourceNode>();
  activeUtteranceGain = uttGain;
  activeUtteranceNodes = nodesSet;
  activeUtterancePriority = priority;
  activeUtteranceMsgId = msg.id;
  activeUtteranceTextLen = msg.text.length;

  startOpenPaCarrierBed(audio, chain, uttGain, nodesSet);

  const wordMap = voxManifest?.words ?? {};
  const rawSpeechSource = msg.spokenVoxText ?? msg.text;
  const speechSource = cleanSubtitleDisplayText(rawSpeechSource) || rawSpeechSource;
  voxQueue = tokenizeToVoxQueue(speechSource, wordMap);
  for (let qi = 0; qi < voxQueue.length; qi++) {
    voxQueue[qi].speechCharEnd = voxQueue[qi].charEnd;
  }
  if (speechSource.length > 0 && speechSource !== msg.text) {
    const scale = msg.text.length / speechSource.length;
    for (let qi = 0; qi < voxQueue.length; qi++) {
      const q = voxQueue[qi];
      q.charEnd = Math.min(msg.text.length, Math.max(0, Math.round(q.charEnd * scale)));
    }
  }

  visualSubtitleActive = false;
  visualSubtitleClauses = [];
  visualSubtitleFullText = "";
  activeUtteranceCleanText = speechSource;
  activeSubtitleClauses = splitTextIntoSubtitleClauses(speechSource);
  subtitleHoldUntilMs =
    voxQueue.length === 0 ? nowPerfMs() + KOMRAD_SUBTITLE_LINGER_MS : 0;

  let firstWord: string | null = null;
  for (let qi = 0; qi < voxQueue.length; qi++) {
    const q = voxQueue[qi];
    if (q.kind === "word") {
      firstWord = q.word;
      break;
    }
    if (q.kind === "fallback") {
      firstWord = q.rawWord;
      break;
    }
  }

  emitKomradSubtitle(
    activeSubtitleClauses[0]?.text ?? speechSource,
    mood,
    voxQueue.length > 0,
    speechSource,
    firstWord,
  );
  voxQueueCursor = 0;
  voxCursorAudioSec = audio.currentTime + 0.045;
  voxUtteranceEndAudioSec = voxCursorAudioSec;
  voxActiveMood = mood;
  voxTimeline = [];
  voxTimelineIdx = 0;
  voxSpeakingAudioActive = voxQueue.length > 0;
  visualTypingActive = false;
  if (voxSpeakingAudioActive) {
    markKomradTransmissionStart();
  } else {
    markKomradTransmissionEnd();
  }
}

function pumpVoxLookahead(audio: AudioContext, chain: VoiceAudioChain): void {
  if (
    !voxSpeakingAudioActive ||
    !activeUtteranceGain ||
    voxQueueCursor >= voxQueue.length
  ) {
    return;
  }

  const horizon = audio.currentTime + VOX_LOOKAHEAD_SEC;
  const mood = voxActiveMood;
  const drive = mood === "critical" ? 1.42 : mood === "warning" ? 1.22 : 1.05;
  chain.driveGain.gain.setTargetAtTime(drive, audio.currentTime, 0.015);

  // Fast, brisk baritone playback rate (1.04x normal / 1.08x warning / 1.12x critical)
  const rate = getBasePlaybackRate(mood);
  const uttGain = activeUtteranceGain;
  const nodesSet = activeUtteranceNodes;

  if (voxCursorAudioSec < audio.currentTime + 0.015) {
    voxCursorAudioSec = audio.currentTime + 0.015;
  }

  while (voxQueueCursor < voxQueue.length && voxCursorAudioSec <= horizon) {
    const item = voxQueue[voxQueueCursor];
    voxQueueCursor += 1;

    if (item.kind === "pause") {
      const pStart = voxCursorAudioSec;
      const pEnd = pStart + item.durSec;
      voxTimeline.push({
        startSec: pStart,
        endSec: pEnd,
        prevCharEnd: item.charEnd,
        charEnd: item.charEnd,
        speechCharEnd: item.speechCharEnd ?? item.charEnd,
        word: null,
        stressed: false,
        terminator: item.terminator,
      });
      voxCursorAudioSec = pEnd;
      voxUtteranceEndAudioSec = Math.max(voxUtteranceEndAudioSec, pEnd);
      continue;
    }

    if (item.kind === "word") {
      const buf = voxBuffers.get(item.entry.pack);
      if (buf) {
        const effectiveDur = item.entry.dur / rate;
        const when = voxCursorAudioSec;
        const fadeIn = Math.min(0.005, effectiveDur * 0.15);
        const fadeOut = Math.min(0.024, effectiveDur * 0.25);
        const gainVal = item.entry.gain * (item.stressed ? 1.08 : 1.0);

        const src = audio.createBufferSource();
        src.buffer = buf;
        src.playbackRate.setValueAtTime(rate, when);

        const wordGain = audio.createGain();
        wordGain.gain.setValueAtTime(0.0001, when);
        wordGain.gain.linearRampToValueAtTime(gainVal, when + fadeIn);
        wordGain.gain.setValueAtTime(
          gainVal,
          Math.max(when + fadeIn, when + effectiveDur - fadeOut),
        );
        wordGain.gain.linearRampToValueAtTime(0.0001, when + effectiveDur);

        src.connect(wordGain);
        wordGain.connect(uttGain);

        nodesSet.add(src);
        src.start(when, item.entry.start, item.entry.dur);
        src.onended = () => {
          nodesSet.delete(src);
          src.disconnect();
          wordGain.disconnect();
        };

        const nextItem = voxQueue[voxQueueCursor];
        const nextIsSpoken = nextItem !== undefined && nextItem.kind !== "pause";
        const overlapSec = nextIsSpoken
          ? Math.min(VOX_WORD_OVERLAP_SEC, Math.max(0, effectiveDur - 0.075))
          : 0;
        const nextCursor = when + effectiveDur - overlapSec;

        voxTimeline.push({
          startSec: when,
          endSec: nextIsSpoken ? nextCursor : when + effectiveDur,
          prevCharEnd: item.charEnd,
          charEnd: item.charEnd,
          speechCharEnd: item.speechCharEnd ?? item.charEnd,
          word: item.word,
          stressed: item.stressed,
          terminator: "",
        });
        voxUtteranceEndAudioSec = Math.max(
          voxUtteranceEndAudioSec,
          when + effectiveDur,
        );
        voxCursorAudioSec = nextCursor;
        continue;
      }
    }

    // Full multi-syllable robotic formant synthesis for any OOV word (zero skipped words, zero chirps)
    const when = voxCursorAudioSec;
    const rawWord = item.kind === "fallback" ? item.rawWord : item.word;
    const fDur = scheduleFormantWord(
      audio,
      chain,
      uttGain,
      nodesSet,
      rawWord,
      when,
      mood,
      item.stressed,
    );
    const nextItem = voxQueue[voxQueueCursor];
    const nextIsSpoken = nextItem !== undefined && nextItem.kind !== "pause";
    const overlapSec = nextIsSpoken
      ? Math.min(0.014, Math.max(0, fDur - 0.07))
      : 0;
    const nextCursor = when + fDur - overlapSec;
    voxTimeline.push({
      startSec: when,
      endSec: nextIsSpoken ? nextCursor : when + fDur,
      prevCharEnd: item.charEnd,
      charEnd: item.charEnd,
      speechCharEnd: item.speechCharEnd ?? item.charEnd,
      word: rawWord,
      stressed: item.stressed,
      terminator: "",
    });
    voxUtteranceEndAudioSec = Math.max(voxUtteranceEndAudioSec, when + fDur);
    voxCursorAudioSec = nextCursor;
  }
}

function updateAnalyserLipSync(
  chain: VoiceAudioChain,
  isActivelySpeaking: boolean,
  dt: number,
): void {
  if (!isActivelySpeaking || chain.ctx.state !== "running") {
    vocalState.energy = Math.max(0, vocalState.energy - dt * 7.5);
    vocalState.mouthOpen =
      vocalState.energy >= 0.42 ? 2 : vocalState.energy >= 0.14 ? 1 : 0;
    for (let i = 0; i < 16; i++) {
      vocalState.spectrum16[i] = Math.max(
        0,
        Math.round(vocalState.spectrum16[i] * Math.max(0, 1 - dt * 12)),
      );
    }
    if (vocalState.energy <= 0.01) {
      vocalState.activeVowel = null;
    }
    return;
  }

  chain.analyser.getByteTimeDomainData(chain.timeDomainBuf);
  chain.analyser.getByteFrequencyData(chain.freqDataBuf);

  const td = chain.timeDomainBuf;
  let sumSq = 0;
  for (let i = 0; i < td.length; i++) {
    const sample = (td[i] - 128) / 128;
    sumSq += sample * sample;
  }
  const timeRms = Math.sqrt(sumSq / td.length);
  const timeNorm = clamp01((timeRms - 0.022) / 0.14);

  const fd = chain.freqDataBuf;
  let freqSum = 0;
  for (let b = 1; b <= 5; b++) {
    freqSum += fd[b] ?? 0;
  }
  const rawFreqNorm = clamp01(freqSum / (5 * 215));
  const freqNorm = clamp01((rawFreqNorm - 0.16) / 0.84);
  const targetEnergy =
    timeNorm < 0.015 && freqNorm < 0.05
      ? 0
      : clamp01(timeNorm * 0.58 + freqNorm * 0.42);

  const rate = targetEnergy > vocalState.energy ? 38 : 16;
  const alpha = 1 - Math.exp(-rate * dt);
  vocalState.energy += (targetEnergy - vocalState.energy) * alpha;
  vocalState.mouthOpen =
    vocalState.energy >= 0.42 ? 2 : vocalState.energy >= 0.12 ? 1 : 0;

  const maxBinIdx = Math.max(1, fd.length - 1);
  for (let i = 0; i < 16; i++) {
    const binPos = Math.min(maxBinIdx, 0.5 + (i / 15) * 4.5);
    const b0 = Math.floor(binPos);
    const b1 = Math.min(maxBinIdx, b0 + 1);
    const frac = binPos - b0;
    const interp = fd[b0] * (1 - frac) + fd[b1] * frac;
    const gated = Math.max(0, interp - 28) * 1.12;
    const prev = vocalState.spectrum16[i];
    const next = Math.round(prev * 0.35 + gated * 0.65);
    vocalState.spectrum16[i] = next > 255 ? 255 : next < 0 ? 0 : next;
  }

  if (vocalState.energy >= 0.1) {
    let wSum = 0;
    let mSum = 0;
    for (let b = 1; b <= 5; b++) {
      const m = fd[b] ?? 0;
      wSum += b * m;
      mSum += m;
    }
    const centroid = mSum > 8 ? wSum / mSum : 2.5;
    const normIdx = Math.min(
      VOWEL_ORDER.length - 1,
      Math.max(0, Math.round(((centroid - 1.2) / 3.2) * (VOWEL_ORDER.length - 1))),
    );
    vocalState.activeVowel = VOWEL_ORDER[normIdx];
  } else {
    vocalState.activeVowel = null;
  }
}

/**
 * Quiet, filtered Soviet turret servo motor whir on large slews (> 28 deg).
 * Hard-capped at peak gain <= 0.032 with >= 2.5s cooldown.
 */
export function playTurretServoWhir(slewRadians: number): void {
  const s = useGameStore.getState();
  if (
    s.isMusicMuted ||
    s.diagFeedActive ||
    s.phase !== "playing" ||
    (s.isBlackout && !s.isGodMode)
  ) {
    return;
  }

  const nowMs = performance.now();
  if (nowMs - lastServoWhirMs < SERVO_WHIR_COOLDOWN_MS) return;

  const audio = getAudioContext();
  if (!audio || audio.state !== "running") return;

  lastServoWhirMs = nowMs;
  const chain = ensureVoiceChain(audio, ROUTINE_MASTER_GAIN);
  const t0 = audio.currentTime;
  const dur = Math.min(0.36, 0.26 + Math.min(1, Math.abs(slewRadians) / 2.2) * 0.1);

  const motorOsc = audio.createOscillator();
  motorOsc.type = "sawtooth";
  motorOsc.frequency.setValueAtTime(135, t0);
  motorOsc.frequency.linearRampToValueAtTime(180, t0 + dur * 0.42);
  motorOsc.frequency.linearRampToValueAtTime(118, t0 + dur);

  const motorLp = audio.createBiquadFilter();
  motorLp.type = "lowpass";
  motorLp.frequency.setValueAtTime(420, t0);
  motorLp.Q.setValueAtTime(1.4, t0);

  const motorGain = audio.createGain();
  motorGain.gain.setValueAtTime(0.0001, t0);
  motorGain.gain.linearRampToValueAtTime(0.022, t0 + 0.035);
  motorGain.gain.setValueAtTime(0.02, t0 + dur - 0.08);
  motorGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  const gearNoise = audio.createBufferSource();
  gearNoise.buffer = chain.noiseBuffer;

  const gearBp = audio.createBiquadFilter();
  gearBp.type = "bandpass";
  gearBp.frequency.setValueAtTime(620, t0);
  gearBp.Q.setValueAtTime(3.5, t0);

  const gearGain = audio.createGain();
  gearGain.gain.setValueAtTime(0.0001, t0);
  gearGain.gain.linearRampToValueAtTime(0.01, t0 + 0.03);
  gearGain.gain.setValueAtTime(0.009, t0 + dur - 0.08);
  gearGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  motorOsc.connect(motorLp);
  motorLp.connect(motorGain);
  motorGain.connect(audio.destination);

  gearNoise.connect(gearBp);
  gearBp.connect(gearGain);
  gearGain.connect(audio.destination);

  const stopAt = t0 + dur + 0.015;
  motorOsc.start(t0);
  gearNoise.start(t0, Math.random() * 0.6, dur + 0.01);
  motorOsc.stop(stopAt);
  motorOsc.onended = () => {
    motorOsc.disconnect();
    motorLp.disconnect();
    motorGain.disconnect();
    gearNoise.disconnect();
    gearBp.disconnect();
    gearGain.disconnect();
  };
}

export function computeKomradLiveMood(
  elapsedSec: number,
  msgStartSec: number,
): KomradMood {
  const s = useGameStore.getState();
  const msgs = s.komradMessages;
  const latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;

  const spentCount = Object.keys(s.coreTileAnomalies).length;
  const anySubFailing = s.substations.some((sub) => !sub.quotaOk);
  const totalAllocatedPower =
    s.powerAllocation.cooling +
    s.powerAllocation.defense +
    s.powerAllocation.facility;

  const liveCritical =
    s.coreMeltdown ||
    s.steamExplosion ||
    s.drumPressure >= 86 ||
    s.coreTemp >= 850 ||
    s.drumWaterLevel < -145 ||
    s.voidFraction > 0.56 ||
    s.roomRadiation >= 8.0 ||
    s.ciaIntrusionActive ||
    s.az5Active ||
    spentCount >= 3 ||
    s.treasonStrikes >= 2 ||
    totalAllocatedPower > s.maxSafePower;

  const liveWarning =
    !liveCritical &&
    (spentCount >= 1 ||
      s.coreTemp >= 680 ||
      s.drumPressure > 79 ||
      s.voidFraction > 0.38 ||
      s.xenon > 38 ||
      Math.abs(s.drumWaterLevel) > 130 ||
      s.treasonStrikes >= 1 ||
      anySubFailing);

  let mood: KomradMood = liveCritical
    ? "critical"
    : liveWarning
      ? "warning"
      : "normal";

  const msgStillFresh = elapsedSec < msgStartSec + 6.0;
  if (latestMsg) {
    if (
      latestMsg.mood === "critical" &&
      (msgStillFresh || s.treasonStrikes > 0)
    ) {
      mood = "critical";
    } else if (
      latestMsg.mood === "warning" &&
      mood === "normal" &&
      msgStillFresh
    ) {
      mood = "warning";
    }
  }

  return mood;
}

function drawNextMonologueClip(): VoxClipEntry | null {
  const clips = voxManifest?.clips;
  if (!clips?.length) return null;

  if (monologueDeck.length === 0) {
    const indices: number[] = [];
    for (let i = 0; i < clips.length; i++) {
      if (voxClipBuffers.has(clips[i].id)) {
        indices.push(i);
      }
    }
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    monologueDeck = indices;
  }

  while (monologueDeck.length > 0) {
    const idx = monologueDeck.pop()!;
    const clip = clips[idx];
    if (clip && voxClipBuffers.has(clip.id)) {
      return clip;
    }
  }
  return null;
}

function queuePendingMessage(
  msg: KomradMessageEntry,
  mood: KomradMood,
  priority: number,
  elapsedSec: number,
): void {
  if (!pendingVoxMsg || priority >= pendingVoxMsgPriority) {
    pendingVoxMsg = msg;
    pendingVoxMsgMood = mood;
    pendingVoxMsgPriority = priority;
    pendingVoxQueuedAtSec = elapsedSec;
  }
}

/**
 * Advances K.O.M.R.A.D.-84's real Half-Life VOX speech scheduler, full monologue clips,
 * multi-syllable formant synthesis, and AnalyserNode lip-sync.
 * Decoupled from typewriter completion: never truncates a spoken sentence before its final word finishes.
 * Deduplicated per frame tick so multiple 3D displays can call it safely.
 */
export function stepKomradSpeech(
  elapsedSec: number,
  delta: number,
): KomradVocalState {
  if (steppedThisTick) {
    return vocalState;
  }
  steppedThisTick = true;
  queueMicrotask(() => {
    steppedThisTick = false;
  });

  const s = useGameStore.getState();
  const dt = Math.min(Math.max(delta, 0), 0.08);
  const isBlackout = s.isBlackout && !s.isGodMode;
  const msgs = s.komradMessages;
  let latestMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
  let latestId = latestMsg?.id ?? "";

  if (s.shiftRunId !== lastTrackedShiftRunId) {
    lastTrackedShiftRunId = s.shiftRunId;
    resetKomradSilenceState();
    nextMonologueElapsedSec =
      elapsedSec + MONOLOGUE_MIN_GAP_SEC + Math.random() * MONOLOGUE_EXTRA_GAP_SEC;
    lastUtteranceEndElapsedSec = elapsedSec;
    monologueDeck = [];
    pendingVoxMsg = null;
    pendingVoxMsgPriority = 0;
    openingSettleElapsedSec = 0;
    wasShiftControlReady = false;
    visualTypingActive = false;
    lastSeenStoreMsgId = "";
    charCursor = 0;
    charAccumSec = 0;
    cancelActiveVoxUtterance(0.02);
    clearKomradSubtitleNow();
  } else if (nextMonologueElapsedSec < 0) {
    nextMonologueElapsedSec =
      elapsedSec + MONOLOGUE_MIN_GAP_SEC + Math.random() * MONOLOGUE_EXTRA_GAP_SEC;
  }

  const radioActive = doesRadioDominateSubtitles(
    s.radioOn,
    s.radioVolume,
    s.radioBroadcastSubtitle,
  );
  const radioBlocked = isRadioHoldoffActive();
  const mood = computeKomradLiveMood(elapsedSec, vocalState.msgStartSec);
  vocalState.mood = mood;

  const targetMasterLevel = computeTargetMasterGain(latestMsg, mood);
  const speakAllowed = canKomradSpeakAudio();
  updateMasterDucking(speakAllowed, targetMasterLevel);

  ensureKomradAudioUnlockListeners();
  const audio = getAudioContext();
  const audioRunning = audio !== null && audio.state === "running";

  if (voxLoadState === "idle") {
    voxLoadStartedElapsedSec = -1;
  }

  if (s.phase === "playing" && !s.isMusicMuted && audio && audioRunning) {
    ensureVoiceChain(audio, targetMasterLevel);
    ensureVoxPreloaded(audio);
  }
  if (voxLoadState === "loading" && voxLoadStartedElapsedSec < 0) {
    voxLoadStartedElapsedSec = elapsedSec;
  }

  const voxReadyOrSettled =
    voxLoadState === "ready" ||
    voxLoadState === "failed" ||
    (voxLoadStartedElapsedSec >= 0 && elapsedSec - voxLoadStartedElapsedSec >= 2.2);

  if (!s.isShiftControlReady) {
    if (voxSpeakingAudioActive || visualTypingActive) {
      visualTypingActive = false;
      markKomradTransmissionEnd();
    }
    wasShiftControlReady = false;
    openingSettleElapsedSec = 0;
    cancelActiveVoxUtterance(0.03);
    clearKomradSubtitleNow();
    pendingVoxMsg = null;
    pendingVoxMsgPriority = 0;
    lastSeenStoreMsgId = latestId;
    vocalState.activeMsgId = latestId;
    vocalState.isTalking = false;
    vocalState.mouthOpen = 0;
    vocalState.energy = 0;
    vocalState.activeVowel = null;
    vocalState.activeWord = null;
    vocalState.isStressed = false;
    vocalState.rolledR = false;
    vocalState.spectrum16.fill(0);
    vocalState.typedCharCount = latestMsg ? latestMsg.text.length : 0;
    return vocalState;
  }

  if (!wasShiftControlReady) {
    wasShiftControlReady = true;
    openingSettleElapsedSec = 0;
    lastUtteranceEndElapsedSec = elapsedSec;
    nextMonologueElapsedSec =
      elapsedSec + MONOLOGUE_MIN_GAP_SEC + Math.random() * MONOLOGUE_EXTRA_GAP_SEC;
  }

  if (s.phase === "playing" && !isBlackout && !s.komradOpeningDispatched) {
    openingSettleElapsedSec += dt;
    if (openingSettleElapsedSec >= KOMRAD_OPENING_SETTLE_DELAY_SEC) {
      useGameStore.getState().launchKomradOpeningDispatch();
      const freshMsgs = useGameStore.getState().komradMessages;
      latestMsg =
        freshMsgs.length > 0 ? freshMsgs[freshMsgs.length - 1] : undefined;
      latestId = latestMsg?.id ?? "";
    }
  }

  if (!latestMsg || isBlackout || s.phase !== "playing") {
    if (voxSpeakingAudioActive || visualTypingActive) {
      visualTypingActive = false;
      markKomradTransmissionEnd();
    }
    cancelActiveVoxUtterance(0.03);
    clearKomradSubtitleNow();
    pendingVoxMsg = null;
    pendingVoxMsgPriority = 0;
    lastSeenStoreMsgId = latestId;
    vocalState.activeMsgId = latestId;
    vocalState.isTalking = false;
    vocalState.mouthOpen = 0;
    vocalState.energy = 0;
    vocalState.activeVowel = null;
    vocalState.activeWord = null;
    vocalState.isStressed = false;
    vocalState.rolledR = false;
    vocalState.spectrum16.fill(0);
    vocalState.typedCharCount = latestMsg ? latestMsg.text.length : 0;
    return vocalState;
  }

  // Stop cleanly if a Soviet radio broadcast or diag feed interrupts while K.O.M.R.A.D.-84 is speaking.
  // When only muted (no radio/diag override), stop Web Audio playback while preserving visible subtitles.
  if (radioActive || s.diagFeedActive) {
    if (voxSpeakingAudioActive) {
      cancelActiveVoxUtterance(0.03);
      lastUtteranceEndElapsedSec = elapsedSec;
      charCursor = latestMsg.text.length;
      markKomradTransmissionEnd();
    }
    if (subtitleSnapshot.clause !== null || visualSubtitleActive) {
      clearKomradSubtitleNow();
    }
  } else if (s.isMusicMuted && voxSpeakingAudioActive) {
    cancelActiveVoxUtterance(0.03);
    lastUtteranceEndElapsedSec = elapsedSec;
    charCursor = latestMsg.text.length;
    markKomradTransmissionEnd();
    if (subtitleSnapshot.clause) {
      subtitleHoldUntilMs = nowPerfMs() + KOMRAD_SUBTITLE_LINGER_MS;
      emitKomradSubtitle(
        subtitleSnapshot.clause,
        subtitleSnapshot.mood,
        false,
        subtitleSnapshot.fullText,
        null,
      );
    }
  }

  // Detect natural completion of active utterance independently of typewriter state
  if (voxSpeakingAudioActive && audioRunning) {
    const nowAudio = audio.currentTime;
    const allQueuedAndPlayed =
      voxQueueCursor >= voxQueue.length && nowAudio >= voxUtteranceEndAudioSec;
    if (allQueuedAndPlayed) {
      charCursor = Math.max(charCursor, activeUtteranceTextLen);
      finishActiveUtterance(elapsedSec);
    }
  }

  // Handle newly arriving messages from the store: drop-don't-queue during speech or silence cooldown
  if (latestId !== lastSeenStoreMsgId) {
    lastSeenStoreMsgId = latestId;
    const msgMood = latestMsg.mood !== "normal" ? latestMsg.mood : mood;
    const incomingPriority = computeMessagePriority(latestMsg, msgMood);
    const isBypass = isCriticalBypassMessage(latestMsg);
    const msgMasterLevel = computeTargetMasterGain(latestMsg, msgMood);
    const currentlySpeaking =
      voxSpeakingAudioActive &&
      (!audioRunning || audio.currentTime < voxUtteranceEndAudioSec - 0.04);

    if (currentlySpeaking) {
      if (
        latestMsg.forceInterrupt ||
        (isBypass && incomingPriority > activeUtterancePriority)
      ) {
        pendingVoxMsg = null;
        pendingVoxMsgPriority = 0;
        if (speakAllowed && audioRunning) {
          const chain = ensureVoiceChain(audio, msgMasterLevel);
          charCursor = 0;
          vocalState.msgStartSec = elapsedSec;
          vocalState.activeMsgId = latestMsg.id;
          beginVoxUtterance(
            audio,
            chain,
            latestMsg,
            msgMood,
            incomingPriority,
            msgMasterLevel,
          );
        } else {
          cancelActiveVoxUtterance(0.03);
          markKomradTransmissionEnd();
          queuePendingMessage(latestMsg, msgMood, incomingPriority, elapsedSec);
          if (!radioActive && !s.diagFeedActive) {
            beginVisualSubtitle(latestMsg, msgMood);
          }
        }
      }
      // Otherwise: DROP speech — never queue back-to-back chatter behind an active transmission
    } else if (!isBypass && isKomradNonCriticalCooldownActive()) {
      // DROP speech — non-essential messages inside silence cooldown do not play or queue
      if (visualTypingActive) {
        visualTypingActive = false;
        markKomradTransmissionEnd();
      }
      charCursor = latestMsg.text.length;
      vocalState.activeMsgId = latestMsg.id;
    } else if (speakAllowed && audioRunning && voxReadyOrSettled) {
      const chain = ensureVoiceChain(audio, msgMasterLevel);
      charCursor = 0;
      pendingVoxMsg = null;
      pendingVoxMsgPriority = 0;
      vocalState.msgStartSec = elapsedSec;
      vocalState.activeMsgId = latestMsg.id;
      beginVoxUtterance(
        audio,
        chain,
        latestMsg,
        msgMood,
        incomingPriority,
        msgMasterLevel,
      );
    } else if (
      isBypass &&
      !s.isMusicMuted &&
      !s.diagFeedActive &&
      (radioBlocked || !audioRunning || !voxReadyOrSettled)
    ) {
      queuePendingMessage(latestMsg, msgMood, incomingPriority, elapsedSec);
      visualTypingActive = false;
      if (speakAllowed && audioRunning && !voxReadyOrSettled) {
        charCursor = 0;
        vocalState.activeMsgId = latestMsg.id;
      } else {
        charCursor = latestMsg.text.length;
        vocalState.activeMsgId = latestMsg.id;
      }
      if (!radioActive && !s.diagFeedActive) {
        beginVisualSubtitle(latestMsg, msgMood);
      }
    } else if (latestMsg.text.length > 0) {
      charCursor = 0;
      charAccumSec = 0;
      vocalState.msgStartSec = elapsedSec;
      vocalState.activeMsgId = latestMsg.id;
      visualTypingActive = true;
      markKomradTransmissionStart();
      if (!radioActive && !s.diagFeedActive) {
        beginVisualSubtitle(latestMsg, msgMood);
      }
    } else {
      charCursor = 0;
      vocalState.activeMsgId = latestMsg.id;
      if (visualTypingActive) {
        visualTypingActive = false;
        markKomradTransmissionEnd();
      }
    }
  }

  // Launch deferred bypass message only when preload/radio holdoff clears
  if (
    !voxSpeakingAudioActive &&
    pendingVoxMsg &&
    speakAllowed &&
    audioRunning &&
    voxReadyOrSettled
  ) {
    const isFresh =
      elapsedSec - pendingVoxQueuedAtSec < 8.0 || pendingVoxMsgPriority >= 3;
    const deferred = pendingVoxMsg;
    const deferredPriority = pendingVoxMsgPriority;
    pendingVoxMsg = null;
    pendingVoxMsgPriority = 0;

    if (isFresh) {
      const chain = ensureVoiceChain(audio, targetMasterLevel);
      const deferredMood = pendingVoxMsgMood === "normal" ? mood : pendingVoxMsgMood;
      charCursor = 0;
      vocalState.msgStartSec = elapsedSec;
      vocalState.activeMsgId = deferred.id;
      beginVoxUtterance(
        audio,
        chain,
        deferred,
        deferredMood,
        deferredPriority,
        computeTargetMasterGain(deferred, deferredMood),
      );
    }
  }

  // Periodic calm-shift full .ogg monologue dispatch every ~75-120s strictly post-tutorial when calm
  if (
    !voxSpeakingAudioActive &&
    !pendingVoxMsg &&
    !visualTypingActive &&
    voxLoadState === "ready" &&
    voxClipBuffers.size > 0 &&
    speakAllowed &&
    audioRunning &&
    mood === "normal" &&
    elapsedSec >= nextMonologueElapsedSec &&
    elapsedSec - lastUtteranceEndElapsedSec >= MONOLOGUE_MIN_GAP_SEC &&
    canEmitKomradIdleChatter(s, "monologue")
  ) {
    const clip = drawNextMonologueClip();
    if (clip) {
      reserveIdleChatterEmission();
      const entry: KomradMessageEntry = {
        id: `komrad-clip-${clip.id}-${Math.round(elapsedSec * 10)}`,
        timestamp: formatShiftClockHMS(s.shiftTimeMinutes),
        sender: "K.O.M.R.A.D.-84",
        text: clip.text,
        mood: "normal",
      };
      useGameStore.setState((prev) => ({
        komradMessages: [...prev.komradMessages.slice(-27), entry],
      }));
      lastSeenStoreMsgId = entry.id;
      nextMonologueElapsedSec =
        elapsedSec +
        clip.duration / getBasePlaybackRate("normal") +
        MONOLOGUE_MIN_GAP_SEC +
        Math.random() * MONOLOGUE_EXTRA_GAP_SEC;

      const chain = ensureVoiceChain(audio, ROUTINE_MASTER_GAIN);
      charCursor = 0;
      vocalState.msgStartSec = elapsedSec;
      vocalState.activeMsgId = entry.id;
      beginVoxUtterance(audio, chain, entry, "normal", 1, ROUTINE_MASTER_GAIN);
    }
  }

  // Pump active VOX / clip / multi-syllable formant utterance & drive real AnalyserNode lip-sync
  if (voxSpeakingAudioActive && audioRunning && audio) {
    const chain = ensureVoiceChain(audio, targetMasterLevel);
    if (speakAllowed) {
      pumpVoxLookahead(audio, chain);

      const nowAudio = audio.currentTime;
      let lastPassedClause: string | null = null;
      while (
        voxTimelineIdx < voxTimeline.length &&
        voxTimeline[voxTimelineIdx].endSec <= nowAudio
      ) {
        const passed = voxTimeline[voxTimelineIdx];
        if (passed.charEnd > charCursor) {
          charCursor = passed.charEnd;
        }
        const passedClause =
          passed.clauseText ??
          lookupSubtitleClauseAtChar(
            activeSubtitleClauses,
            passed.speechCharEnd ?? passed.charEnd,
          );
        if (passedClause) {
          lastPassedClause = passedClause;
        }
        voxTimelineIdx += 1;
      }

      const activeSeg =
        voxTimelineIdx < voxTimeline.length &&
        nowAudio >= voxTimeline[voxTimelineIdx].startSec &&
        nowAudio < voxTimeline[voxTimelineIdx].endSec
          ? voxTimeline[voxTimelineIdx]
          : null;

      if (activeSeg) {
        if (activeSeg.isClipClause) {
          const span = Math.max(0.05, activeSeg.endSec - activeSeg.startSec);
          const frac = clamp01((nowAudio - activeSeg.startSec) / span);
          const interpChar = Math.round(
            activeSeg.prevCharEnd + (activeSeg.charEnd - activeSeg.prevCharEnd) * frac,
          );
          if (interpChar > charCursor) {
            charCursor = interpChar;
          }
        } else if (activeSeg.charEnd > charCursor) {
          charCursor = activeSeg.charEnd;
        }
        vocalState.activeWord = activeSeg.word;
        vocalState.isStressed = activeSeg.stressed;
        if (activeSeg.terminator) {
          vocalState.clauseTerminator = activeSeg.terminator;
        }
        const subText =
          activeSeg.clauseText ??
          lookupSubtitleClauseAtChar(
            activeSubtitleClauses,
            activeSeg.speechCharEnd ?? activeSeg.charEnd,
          );
        if (subText) {
          emitKomradSubtitle(
            subText,
            voxActiveMood,
            true,
            activeUtteranceCleanText,
            activeSeg.word,
          );
        }
      } else {
        vocalState.activeWord = null;
        vocalState.isStressed = false;
        if (lastPassedClause) {
          emitKomradSubtitle(
            lastPassedClause,
            voxActiveMood,
            true,
            activeUtteranceCleanText,
            null,
          );
        }
      }

      const stillRunning =
        voxQueueCursor < voxQueue.length || nowAudio < voxUtteranceEndAudioSec;
      if (!stillRunning) {
        charCursor = activeUtteranceTextLen;
        finishActiveUtterance(elapsedSec);
      }

      updateAnalyserLipSync(chain, stillRunning, dt);
      const displayLen = activeUtteranceTextLen || latestMsg.text.length;
      vocalState.activeMsgId = activeUtteranceMsgId || latestMsg.id;
      vocalState.typedCharCount =
        displayLen === 0 ? 0 : Math.max(1, Math.min(displayLen, charCursor));
      vocalState.isTalking = stillRunning;
      return vocalState;
    }
  }

  if (
    visualSubtitleActive &&
    !voxSpeakingAudioActive &&
    !radioActive &&
    !s.diagFeedActive
  ) {
    const totalVisLen = visualSubtitleFullText.length;
    if (visualSubtitleCharCursor < totalVisLen) {
      visualSubtitleAccumSec += dt * VISUAL_SUBTITLE_CPS;
      const step = Math.floor(visualSubtitleAccumSec);
      if (step > 0) {
        visualSubtitleAccumSec -= step;
        visualSubtitleCharCursor = Math.min(
          totalVisLen,
          visualSubtitleCharCursor + step,
        );
      }
    }
    const nextClause = lookupSubtitleClauseAtChar(
      visualSubtitleClauses,
      Math.max(1, visualSubtitleCharCursor),
    );
    if (visualSubtitleCharCursor >= totalVisLen) {
      visualSubtitleActive = false;
      const endClause =
        nextClause ??
        visualSubtitleClauses[visualSubtitleClauses.length - 1]?.text ??
        subtitleSnapshot.clause;
      if (endClause) {
        subtitleHoldUntilMs = nowPerfMs() + KOMRAD_SUBTITLE_LINGER_MS;
        emitKomradSubtitle(
          endClause,
          visualSubtitleMood,
          false,
          visualSubtitleFullText,
          null,
        );
      }
    } else if (nextClause) {
      emitKomradSubtitle(
        nextClause,
        visualSubtitleMood,
        true,
        visualSubtitleFullText,
        null,
      );
    }
  }

  if (
    subtitleSnapshot.clause !== null &&
    !voxSpeakingAudioActive &&
    !visualSubtitleActive &&
    nowPerfMs() >= subtitleHoldUntilMs
  ) {
    clearKomradSubtitleNow();
  }

  // Muted / waiting on radio hold-off / idle: advance visual CRT reveal cleanly
  const totalLen = latestMsg.text.length;
  if (charCursor < totalLen) {
    charAccumSec += dt * 42;
    const step = Math.floor(charAccumSec);
    if (step > 0) {
      charAccumSec -= step;
      charCursor = Math.min(totalLen, charCursor + step);
    }
  }
  if (visualTypingActive && charCursor >= totalLen) {
    visualTypingActive = false;
    markKomradTransmissionEnd();
  }

  if (cachedChain) {
    updateAnalyserLipSync(cachedChain, false, dt);
  } else {
    vocalState.energy = Math.max(0, vocalState.energy - dt * 7.5);
    vocalState.mouthOpen = 0;
    vocalState.spectrum16.fill(0);
  }

  vocalState.activeMsgId = latestMsg.id;
  vocalState.activeWord = null;
  vocalState.isStressed = false;
  vocalState.typedCharCount =
    totalLen === 0 ? 0 : Math.max(1, Math.min(totalLen, charCursor));
  vocalState.isTalking = false;
  return vocalState;
}

export function getKomradVocalState(): KomradVocalState {
  return vocalState;
}
