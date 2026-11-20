import { useFrame, type ThreeEvent } from "@react-three/fiber";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  silenceAllLegacyGlobalBgm,
  unregisterTrackedMedia,
} from "../modules/inspector/audio";
import { useCameraLookStore } from "./CameraController";
import {
  getBrushedBrassTextures,
  getHammeredIronTextures,
  getWeatheredMahoganyTextures,
} from "./proceduralMaterials";
import { useGameStore } from "./useGameStore";

export interface SovietRadioStationSpec {
  freqMHz: number;
  bandwidth: number;
  label: string;
  city: string;
  tracks: readonly string[];
}

export interface SovietRadioTable3DProps {
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
}

export const RADIO_FREQ_MIN_MHZ = 66.0;
export const RADIO_FREQ_MAX_MHZ = 74.0;

const STATION_CAPTURE_HALF_MHZ = 0.42;
const STATION_WAKE_HALF_MHZ = 0.45;
const STATION_LOCK_ZONE_MHZ = 0.10;
const STATION_SWEET_SPOT_MHZ = 0.08;
const SUBTITLE_MIN_SIGNAL_STRENGTH = 0.25;
const BASE_MUSIC_VOLUME = 0.82;

interface RadioSingletonWindow extends Window {
  __mipActiveRadioEngineCleanup?: () => void;
}

type RadioProgramPhase = "song" | "chime" | "announcement";

interface BroadcastSubtitleCue {
  start: number;
  end: number;
  text: string;
}

type BroadcastAnnouncementId =
  | "govorit_moskva"
  | "01_morning_announcement"
  | "02_inspection_notice"
  | "03_ai_everything_is_fine"
  | "04_production_quota"
  | "05_safety_test"
  | "06_evening_signoff";

interface RadioAnnouncementSpec {
  id: BroadcastAnnouncementId;
  audioSrc: string;
}

const GOVORIT_MOSKVA_SRC = "/audio/radio/broadcast/govorit_moskva.wav";

/**
 * Exact waveform-measured subtitle cues (in seconds against `audio.currentTime`).
 * Static intros (0.0–1.6s) and trailing static tails have no matching cue so the
 * HUD subtitle box hides cleanly whenever nobody is speaking.
 */
const SUBTITLE_CUES: Record<
  BroadcastAnnouncementId,
  readonly BroadcastSubtitleCue[]
> = {
  govorit_moskva: [
    { start: 2.0, end: 15.0, text: "[ ALL-UNION RADIO CHIME ]" },
    { start: 15.1, end: 18.2, text: "ATTENTION! MOSCOW SPEAKING!" },
    {
      start: 18.9,
      end: 22.3,
      text: "ALL RADIO STATIONS OF THE SOVIET UNION ARE BROADCASTING.",
    },
    { start: 23.1, end: 28.8, text: "[ SIX TIME-SIGNAL PIPS ]" },
    { start: 29.3, end: 31.7, text: "MOSCOW STATE TIME SIGNAL." },
  ],
  "01_morning_announcement": [
    { start: 1.6, end: 7.2, text: "[ SOVIET RADIO CHIME ]" },
    { start: 7.3, end: 10.5, text: "ATTENTION! SECTOR EIGHTY-FOUR SPEAKING." },
    { start: 10.9, end: 12.3, text: "GOOD MORNING, COMRADES." },
    {
      start: 12.6,
      end: 16.3,
      text: "THE WEATHER IS SUNNY, WITH LIGHT GLOW IN THE EVENING.",
    },
    {
      start: 16.8,
      end: 22.5,
      text: "THE REACTOR IS RUNNING AT FULL POWER. IT IS ALWAYS RUNNING AT FULL POWER.",
    },
    {
      start: 22.8,
      end: 30.2,
      text: "BREAKFAST IN CANTEEN: POTATO. LUNCH: ALSO POTATO. DINNER: POTATO, BUT WARM.",
    },
    { start: 30.5, end: 36.3, text: "[ SIX TIME-SIGNAL PIPS ]" },
    {
      start: 36.6,
      end: 41.9,
      text: "SECTOR EIGHTY-FOUR TIME: SIX HOURS. GLORY TO SECTOR EIGHTY-FOUR!",
    },
  ],
  "02_inspection_notice": [
    { start: 1.6, end: 4.9, text: "[ SOVIET RADIO CHIME ]" },
    { start: 5.0, end: 8.2, text: "ATTENTION, COMRADES! IMPORTANT NOTICE." },
    {
      start: 8.5,
      end: 12.6,
      text: "TODAY, SENIOR INSPECTOR COMRADE OLEG WILL INSPECT ALL WORKPLACES.",
    },
    {
      start: 13.1,
      end: 17.6,
      text: "THIS IS SENIOR INSPECTOR OLEG. I HAVE CHECKED THE REACTOR.",
    },
    { start: 18.2, end: 21.5, text: "THE REACTOR IS STILL THERE. VERY GOOD." },
    {
      start: 21.7,
      end: 26.4,
      text: "I HAVE ALSO CHECKED THE CANTEEN. THE POTATOES ARE NOT COOKED.",
    },
    { start: 27.2, end: 29.0, text: "THIS IS VERY SERIOUS PROBLEM." },
    {
      start: 29.4,
      end: 34.2,
      text: "REMINDER: DOSIMETER WHICH SHOWS BIG NUMBER IS BROKEN DOSIMETER.",
    },
    {
      start: 34.8,
      end: 38.1,
      text: "PLEASE EXCHANGE IT FOR DOSIMETER WHICH SHOWS SMALL NUMBER.",
    },
    { start: 38.4, end: 40.0, text: "THANK YOU FOR COOPERATION." },
  ],
  "03_ai_everything_is_fine": [
    { start: 1.6, end: 2.3, text: "[ DIGITAL GLITCH ]" },
    {
      start: 2.4,
      end: 8.3,
      text: "ATTENTION! THE SUPER ADVANCED KOMRAD EIGHTY-FOUR A.I. HAS AN IMPORTANT MESSAGE.",
    },
    {
      start: 8.8,
      end: 13.2,
      text: "I AM KOMRAD EIGHTY-FOUR. I AM ONE THOUSAND PERCENT RELIABLE.",
    },
    {
      start: 13.5,
      end: 19.3,
      text: "ALL SYSTEMS ARE NORMAL. THE REACTOR TEMPERATURE IS... ERROR. IT IS... VERY NICE.",
    },
    { start: 19.7, end: 20.5, text: "[ DIGITAL GLITCH ]" },
    {
      start: 20.6,
      end: 28.1,
      text: "DANGER LEVEL IS: THREE. POINT. BANANA. I HAVE MADE THE NUMBER SMALL.",
    },
    { start: 28.4, end: 30.9, text: "[ ALARM KLAXON ]" },
    {
      start: 31.6,
      end: 33.3,
      text: "RECOMMENDATION: PLEASE PRESS THE BIG RED BUTTON.",
    },
    {
      start: 33.9,
      end: 38.5,
      text: "CORRECTION: DO NOT PRESS THE BIG RED BUTTON. REBOOTING.",
    },
    {
      start: 38.8,
      end: 42.8,
      text: "EVERYTHING IS FINE. GLORY TO SECTOR EIGHTY-FOUR.",
    },
  ],
  "04_production_quota": [
    { start: 1.6, end: 4.9, text: "[ SOVIET RADIO CHIME ]" },
    { start: 5.0, end: 8.0, text: "ATTENTION, COMRADES! PRODUCTION REPORT." },
    {
      start: 8.3,
      end: 13.1,
      text: "THIS MONTH, WE HAVE PRODUCED ONE HUNDRED TWELVE PERCENT OF ELECTRICITY QUOTA.",
    },
    {
      start: 13.7,
      end: 16.6,
      text: "NEXT MONTH, QUOTA IS ONE HUNDRED FIFTY PERCENT.",
    },
    {
      start: 17.0,
      end: 22.5,
      text: "CHIEF ENGINEER KRISTIANOV HERE. FOR THE QUOTA, WE WILL REMOVE SOME PARTS FROM THE REACTOR.",
    },
    { start: 23.1, end: 24.9, text: "FOR EXAMPLE: THE BRAKES." },
    {
      start: 25.2,
      end: 27.8,
      text: "EMPLOYEE OF THE MONTH IS COMRADE KRISTIANOV!",
    },
    {
      start: 28.4,
      end: 33.4,
      text: "HIS PRIZE: ONE EXTRA POTATO. AND A SECOND DOSIMETER.",
    },
    {
      start: 33.8,
      end: 38.0,
      text: "THANK YOU. I WILL USE SECOND DOSIMETER TO CHECK FIRST DOSIMETER.",
    },
  ],
  "05_safety_test": [
    { start: 1.6, end: 4.9, text: "[ SOVIET RADIO CHIME ]" },
    {
      start: 5.0,
      end: 10.4,
      text: "ATTENTION! TONIGHT AT ONE O'CLOCK, THERE WILL BE SMALL SAFETY TEST OF TURBINE.",
    },
    { start: 11.1, end: 12.6, text: "TEST IS COMPLETELY SAFE." },
    {
      start: 13.0,
      end: 18.9,
      text: "DO NOT WORRY, COMRADES. I HAVE DONE THIS TEST MANY TIMES. ONLY IN MY HEAD.",
    },
    { start: 19.2, end: 19.8, text: "[ DIGITAL GLITCH ]" },
    {
      start: 20.0,
      end: 22.9,
      text: "PROBABILITY OF SUCCESS: NINETY-NINE PERCENT.",
    },
    {
      start: 23.6,
      end: 28.2,
      text: "CORRECTION: NINE PERCENT. THE DECIMAL POINT IS LOST.",
    },
    {
      start: 28.8,
      end: 34.4,
      text: "DURING TEST, PLEASE STAY CALM, AND KEEP YOUR BOOTS ON. THANK YOU FOR COOPERATION.",
    },
    { start: 34.9, end: 40.6, text: "[ SIX TIME-SIGNAL PIPS ]" },
  ],
  "06_evening_signoff": [
    {
      start: 1.6,
      end: 4.9,
      text: "SECTOR EIGHTY-FOUR IS ENDING BROADCAST FOR TODAY.",
    },
    {
      start: 5.3,
      end: 8.9,
      text: "INSPECTOR OLEG SAYS: LIGHTS OUT AT TWENTY-TWO HOURS.",
    },
    {
      start: 9.5,
      end: 13.5,
      text: "THE GLOW FROM THE REACTOR DOES NOT COUNT.",
    },
    {
      start: 14.2,
      end: 19.0,
      text: "GOOD NIGHT, COMRADES. SLEEP WELL. I WILL BE WATCHING YOU. FOR INSPECTION.",
    },
    {
      start: 19.4,
      end: 25.4,
      text: "GOOD NIGHT. I DO NOT SLEEP. I NEVER SLEEP. I AM COUNTING NEUTRONS.",
    },
    { start: 26.4, end: 29.3, text: "ONE. TWO. MANY." },
    {
      start: 29.8,
      end: 36.1,
      text: "GLORY TO SECTOR EIGHTY-FOUR. GLORY TO THE R B M K. GOOD NIGHT.",
    },
    { start: 36.6, end: 42.6, text: "[ SOVIET RADIO CHIME ]" },
  ],
};

const RADIO_ANNOUNCEMENTS: readonly RadioAnnouncementSpec[] = [
  {
    id: "01_morning_announcement",
    audioSrc: "/audio/radio/broadcast/01_morning_announcement.ogg",
  },
  {
    id: "02_inspection_notice",
    audioSrc: "/audio/radio/broadcast/02_inspection_notice.ogg",
  },
  {
    id: "03_ai_everything_is_fine",
    audioSrc: "/audio/radio/broadcast/03_ai_everything_is_fine.ogg",
  },
  {
    id: "04_production_quota",
    audioSrc: "/audio/radio/broadcast/04_production_quota.ogg",
  },
  {
    id: "05_safety_test",
    audioSrc: "/audio/radio/broadcast/05_safety_test.ogg",
  },
  {
    id: "06_evening_signoff",
    audioSrc: "/audio/radio/broadcast/06_evening_signoff.ogg",
  },
];

/**
 * Soviet OIRT УКВ broadcast stations across 66.0–74.0 МГц
 * (10 total songs distributed cleanly across 5 tunable stations + inter-song state broadcasts).
 */
export const RADIO_STATIONS: readonly SovietRadioStationSpec[] = [ // oxlint-disable-line react/only-export-components
  {
    freqMHz: 66.8,
    bandwidth: STATION_CAPTURE_HALF_MHZ,
    label: "ГОСТЕЛЕРАДИО // СМЕНА-84",
    city: "СМЕНА-84",
    tracks: [
      "/music/night-shift.mp3",
      "/audio/radio/songs/track_08_sector_84.wav",
    ],
  },
  {
    freqMHz: 68.4,
    bandwidth: STATION_CAPTURE_HALF_MHZ,
    label: "РАДИО МАЯК",
    city: "МАЯК",
    tracks: [
      "/audio/radio/songs/track_09_sektor_84_1.wav",
      "/audio/radio/songs/track_01.wav",
    ],
  },
  {
    freqMHz: 70.0,
    bandwidth: STATION_CAPTURE_HALF_MHZ,
    label: "ГОЛОС МОСКВЫ",
    city: "МОСКВА",
    tracks: [
      "/audio/radio/songs/track_03_soviet_synthwave.wav",
      "/audio/radio/songs/track_02.wav",
    ],
  },
  {
    freqMHz: 71.6,
    bandwidth: STATION_CAPTURE_HALF_MHZ,
    label: "МИНСК УКВ",
    city: "МИНСК",
    tracks: [
      "/audio/radio/songs/track_04.wav",
      "/audio/radio/songs/track_05.wav",
    ],
  },
  {
    freqMHz: 73.2,
    bandwidth: STATION_CAPTURE_HALF_MHZ,
    label: "РАДИО ВОЛНА-84",
    city: "ВОЛНА-84",
    tracks: [
      "/audio/radio/songs/track_06.wav",
      "/audio/radio/songs/track_07.wav",
    ],
  },
];

const INITIAL_FREQ_MHZ = 66.8;
const MHZ_PER_WHEEL_REV = 2.0; // 4 full turns across 66.00..74.00 МГц
const INITIAL_WHEEL_ANGLE =
  ((INITIAL_FREQ_MHZ - RADIO_FREQ_MIN_MHZ) / MHZ_PER_WHEEL_REV) * Math.PI * 2;
const DIAL_REDRAW_INTERVAL_MS = 72; // <= 15 Hz (~13.9 Hz) while actively dragging

// Dial mesh & canvas layout (exact 1:1 needle-to-pixel calibration)
const DIAL_CENTER_X = -0.048;
const DIAL_CENTER_Y = 0.198;
const DIAL_CANVAS_W = 512;
const DIAL_CANVAS_H = 192;
const DIAL_PLANE_W = 0.296;
const DIAL_PLANE_H = 0.086;
const SCALE_PX_LEFT = 126;
const SCALE_PX_RIGHT = 478;
const NEEDLE_MIN_X =
  DIAL_CENTER_X + (SCALE_PX_LEFT / DIAL_CANVAS_W - 0.5) * DIAL_PLANE_W;
const NEEDLE_MAX_X =
  DIAL_CENTER_X + (SCALE_PX_RIGHT / DIAL_CANVAS_W - 0.5) * DIAL_PLANE_W;

const NOOP_RAYCAST = () => null;

function createPixelTexture(
  width: number,
  height: number,
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    draw?.(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function mergeStaticGeometries(
  parts: ReadonlyArray<{
    geometry: THREE.BufferGeometry;
    position?: readonly [number, number, number];
    rotation?: readonly [number, number, number];
    scale?: readonly [number, number, number];
  }>,
): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  const mat = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const posVec = new THREE.Vector3();
  const scaleVec = new THREE.Vector3();

  for (const part of parts) {
    const g = part.geometry.clone();
    posVec.set(...(part.position ?? [0, 0, 0]));
    euler.set(...(part.rotation ?? [0, 0, 0]));
    quat.setFromEuler(euler);
    scaleVec.set(...(part.scale ?? [1, 1, 1]));
    mat.compose(posVec, quat, scaleVec);
    g.applyMatrix4(mat);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    if (!g.getAttribute("uv")) {
      const count = g.getAttribute("position").count;
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    prepared.push(g);
    part.geometry.dispose();
  }

  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of prepared) {
    totalVerts += g.getAttribute("position").count;
    totalIndices += g.index ? g.index.count : g.getAttribute("position").count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of prepared) {
    const pos = g.getAttribute("position");
    const norm = g.getAttribute("normal");
    const uv = g.getAttribute("uv");
    const count = pos.count;
    for (let i = 0; i < count; i++) {
      const vi = vOffset + i;
      positions[vi * 3] = pos.getX(i);
      positions[vi * 3 + 1] = pos.getY(i);
      positions[vi * 3 + 2] = pos.getZ(i);
      normals[vi * 3] = norm.getX(i);
      normals[vi * 3 + 1] = norm.getY(i);
      normals[vi * 3 + 2] = norm.getZ(i);
      uvs[vi * 2] = uv.getX(i);
      uvs[vi * 2 + 1] = uv.getY(i);
    }
    if (g.index) {
      const idxAttr = g.index;
      for (let i = 0; i < idxAttr.count; i++) {
        indices[iOffset++] = vOffset + idxAttr.getX(i);
      }
    } else {
      for (let i = 0; i < count; i++) {
        indices[iOffset++] = vOffset + i;
      }
    }
    vOffset += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function frequencyToRatio(freqMHz: number): number {
  return THREE.MathUtils.clamp(
    (freqMHz - RADIO_FREQ_MIN_MHZ) /
      (RADIO_FREQ_MAX_MHZ - RADIO_FREQ_MIN_MHZ),
    0,
    1,
  );
}

function frequencyToNeedleX(freqMHz: number): number {
  return THREE.MathUtils.lerp(
    NEEDLE_MIN_X,
    NEEDLE_MAX_X,
    frequencyToRatio(freqMHz),
  );
}

interface StationProgramState {
  freqMHz: number;
  tracks: readonly string[];
  trackIndex: number;
  phase: RadioProgramPhase;
  announcementIdx: number;
  savedOffsetSec: number;
}

interface RadioAudioEngine {
  ctx: AudioContext;
  staticGain: GainNode;
  staticSource: AudioBufferSourceNode;
  player: HTMLAudioElement;
  stations: StationProgramState[];
  activeStationIndex: number;
  loadedSrcKey: string | null;
  nextAnnouncementIdx: number;
  isPlaying: boolean;
  playInFlight: boolean;
  playSeq: number;
  consecutiveErrors: number;
  pendingSeekSec: number | null;
  onMetadata: (() => void) | null;
  onEnded: () => void;
  onError: () => void;
  disposed: boolean;
}

function getStationTargetSrc(st: StationProgramState): string {
  if (st.phase === "chime") {
    return GOVORIT_MOSKVA_SRC;
  }
  if (st.phase === "announcement") {
    const ann = RADIO_ANNOUNCEMENTS[st.announcementIdx % RADIO_ANNOUNCEMENTS.length];
    return ann.audioSrc;
  }
  return st.tracks[st.trackIndex % st.tracks.length];
}

function findSubtitleCueText(
  cues: readonly BroadcastSubtitleCue[],
  currentTimeSec: number,
): string | null {
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (currentTimeSec >= c.start && currentTimeSec <= c.end) {
      return c.text;
    }
  }
  return null;
}

function clearEngineMetadataListener(engine: RadioAudioEngine): void {
  if (engine.onMetadata) {
    engine.player.removeEventListener("loadedmetadata", engine.onMetadata);
    engine.onMetadata = null;
  }
  engine.pendingSeekSec = null;
}

function disposeRadioEngineInstance(engine: RadioAudioEngine): void {
  if (engine.disposed) return;
  engine.disposed = true;
  engine.playSeq += 1;
  clearEngineMetadataListener(engine);
  engine.player.removeEventListener("ended", engine.onEnded);
  engine.player.removeEventListener("error", engine.onError);
  engine.isPlaying = false;
  engine.playInFlight = false;
  engine.activeStationIndex = -1;
  engine.loadedSrcKey = null;
  engine.player.volume = 0;
  try {
    engine.player.pause();
  } catch {
    // ignore
  }
  engine.player.removeAttribute("src");
  engine.player.src = "";
  try {
    engine.player.load();
  } catch {
    // ignore
  }
  unregisterTrackedMedia(engine.player);
  try {
    engine.staticSource.stop();
  } catch {
    // ignore if already stopped
  }
  engine.staticSource.disconnect();
  engine.staticGain.disconnect();
  void engine.ctx.close().catch(() => {});
  useGameStore.getState().setRadioBroadcastSubtitle(null);
}

function resolvePublicAudioUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

function createAnalogStaticBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.max(1024, Math.floor(sr * 2.0));
  const crossfade = Math.min(2048, Math.floor(length * 0.1));
  const total = length + crossfade;
  const raw = new Float32Array(total);

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let prevPink = 0;
  let hp = 0;
  let lp1 = 0;
  let lp2 = 0;

  const hpAlpha = Math.exp((-2 * Math.PI * 260) / sr);
  const lpAlpha = 1 - Math.exp((-2 * Math.PI * 2600) / sr);

  const stepSample = (): number => {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    const pink = (b0 + b1 + b2 + white * 0.1848) * 0.22;

    hp = hpAlpha * (hp + pink - prevPink);
    prevPink = pink;

    lp1 += lpAlpha * (hp - lp1);
    lp2 += lpAlpha * (lp1 - lp2);
    return Math.tanh(lp2 * 1.45) * 0.72;
  };

  for (let i = 0; i < 512; i++) {
    stepSample();
  }
  for (let i = 0; i < total; i++) {
    raw[i] = stepSample();
  }

  const buf = ctx.createBuffer(1, length, sr);
  const out = buf.getChannelData(0);
  for (let i = 0; i < crossfade; i++) {
    const t = i / crossfade;
    out[i] = raw[i] * Math.sqrt(t) + raw[length + i] * Math.sqrt(1 - t);
  }
  for (let i = crossfade; i < length; i++) {
    out[i] = raw[i];
  }
  return buf;
}

function computeStationMusicLevel(dist: number): number {
  if (dist <= STATION_SWEET_SPOT_MHZ) return 1.0;
  if (dist < STATION_CAPTURE_HALF_MHZ) {
    const t =
      (dist - STATION_SWEET_SPOT_MHZ) /
      (STATION_CAPTURE_HALF_MHZ - STATION_SWEET_SPOT_MHZ);
    return 0.5 * (1 + Math.cos(Math.PI * t));
  }
  return 0.0;
}

function computeStaticHissLevel(minDist: number): number {
  if (minDist <= STATION_SWEET_SPOT_MHZ) {
    return THREE.MathUtils.lerp(
      0.003,
      0.018,
      minDist / STATION_SWEET_SPOT_MHZ,
    );
  }
  if (minDist <= 0.2) {
    const t = (minDist - STATION_SWEET_SPOT_MHZ) / (0.2 - STATION_SWEET_SPOT_MHZ);
    return 0.018 + (0.155 - 0.018) * 0.5 * (1 - Math.cos(Math.PI * t));
  }
  if (minDist <= 0.28) {
    return 0.155;
  }
  if (minDist < 0.46) {
    const t = (minDist - 0.28) / (0.46 - 0.28);
    return 0.062 + (0.155 - 0.062) * 0.5 * (1 + Math.cos(Math.PI * t));
  }
  return 0.062;
}

function computeDistanceGain(
  camPos: THREE.Vector3,
  radioPos: THREE.Vector3,
): number {
  const dist = camPos.distanceTo(radioPos);
  if (dist <= 2.2) return 1.0;
  if (dist <= 6.0) {
    const t = (dist - 2.2) / (6.0 - 2.2);
    const smooth = t * t * (3 - 2 * t);
    return THREE.MathUtils.lerp(1.0, 0.48, smooth);
  }
  if (dist < 10.5) {
    const t = (dist - 6.0) / (10.5 - 6.0);
    const smooth = t * t * (3 - 2 * t);
    return THREE.MathUtils.lerp(0.48, 0.43, smooth);
  }
  return 0.43;
}

function computeSignalStrength(freqMHz: number): {
  strength: number;
  nearest: SovietRadioStationSpec | null;
} {
  let bestStrength = 0;
  let nearest: SovietRadioStationSpec | null = null;
  for (let i = 0; i < RADIO_STATIONS.length; i++) {
    const st = RADIO_STATIONS[i];
    const dist = Math.abs(freqMHz - st.freqMHz);
    const captureHalf = Math.max(STATION_LOCK_ZONE_MHZ + 0.02, st.bandwidth);
    let s = 0;
    if (dist <= STATION_LOCK_ZONE_MHZ) {
      s = 1;
    } else if (dist < captureHalf) {
      const t =
        (dist - STATION_LOCK_ZONE_MHZ) / (captureHalf - STATION_LOCK_ZONE_MHZ);
      s = 0.5 * (1 + Math.cos(Math.PI * t));
    }
    if (s > bestStrength) {
      bestStrength = s;
      if (dist <= 0.3) {
        nearest = st;
      }
    }
  }
  return { strength: THREE.MathUtils.clamp(bestStrength, 0, 1), nearest };
}

function paintRadioDialCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  freqMHz: number,
  isPowered = true,
): void {
  ctx.imageSmoothingEnabled = false;
  const { strength, nearest } = computeSignalStrength(freqMHz);

  // Full-bleed bright amber-gold background (ON) or medium warm-parchment card (OFF)
  // Designed to resist BuckshotDitherPass dark-crush quantization cleanly.
  const bgGrad = ctx.createLinearGradient(0, 0, w, 0);
  if (isPowered) {
    bgGrad.addColorStop(0, "#8a5214");
    bgGrad.addColorStop(0.24, "#b86f1d");
    bgGrad.addColorStop(0.54, "#d4882a");
    bgGrad.addColorStop(0.82, "#bc741f");
    bgGrad.addColorStop(1, "#8a5214");
  } else {
    bgGrad.addColorStop(0, "#544b3c");
    bgGrad.addColorStop(0.5, "#685e4c");
    bgGrad.addColorStop(1, "#544b3c");
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  if (isPowered) {
    const centerGlow = ctx.createRadialGradient(
      w * 0.58,
      h * 0.5,
      18,
      w * 0.58,
      h * 0.5,
      w * 0.48,
    );
    centerGlow.addColorStop(0, "rgba(255, 224, 140, 0.34)");
    centerGlow.addColorStop(1, "rgba(255, 180, 72, 0)");
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, w, h);
  }

  // Outer frame border
  ctx.strokeStyle = isPowered ? "#110c06" : "#2b241c";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.strokeStyle = isPowered ? "#fff6d6" : "#e8dfc8";
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  // Left 6Е1П Magic Eye Tube bay (x = 8..98, y = 8..184)
  ctx.fillStyle = isPowered ? "#18291b" : "#473f33";
  ctx.fillRect(8, 8, 90, h - 16);
  ctx.strokeStyle = isPowered ? "#110c06" : "#2b241c";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 90, h - 16);
  ctx.strokeStyle = isPowered ? "#fff6d6" : "#e8dfc8";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, 86, h - 20);

  const eyeCx = 53;
  const eyeCy = 76;
  const eyeR = 30;

  // Cathode phosphor disc
  ctx.fillStyle = isPowered ? "#0c2212" : "#2b251e";
  ctx.beginPath();
  ctx.arc(eyeCx, eyeCy, eyeR, 0, Math.PI * 2);
  ctx.fill();

  if (isPowered) {
    const shadowHalfRad = THREE.MathUtils.lerp(0.92, 0.08, strength);
    const brightGreen = strength > 0.65 ? "#9effbe" : "#39ff7a";
    const midGreen = strength > 0.65 ? "#39ff7a" : "#24c958";

    const eyeGrad = ctx.createRadialGradient(
      eyeCx,
      eyeCy,
      5,
      eyeCx,
      eyeCy,
      eyeR,
    );
    eyeGrad.addColorStop(0, "#124d24");
    eyeGrad.addColorStop(0.5, midGreen);
    eyeGrad.addColorStop(1, brightGreen);

    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.moveTo(eyeCx, eyeCy);
    ctx.arc(
      eyeCx,
      eyeCy,
      eyeR - 2,
      Math.PI + shadowHalfRad,
      Math.PI * 2 - shadowHalfRad,
    );
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(eyeCx, eyeCy);
    ctx.arc(eyeCx, eyeCy, eyeR - 2, shadowHalfRad, Math.PI - shadowHalfRad);
    ctx.closePath();
    ctx.fill();
  }

  // Center cathode cap & bezel ring
  ctx.fillStyle = isPowered ? "#110c06" : "#383127";
  ctx.beginPath();
  ctx.arc(eyeCx, eyeCy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isPowered ? "#ffb000" : "#e8dfc8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(eyeCx, eyeCy, 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = isPowered ? "#fff6d6" : "#e8dfc8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(eyeCx, eyeCy, eyeR, 0, Math.PI * 2);
  ctx.stroke();

  // Horizontal 6Е1П Magic Eye phosphor bar (x = 16..90, y = 114..128)
  const barX = 16;
  const barY = 114;
  const barW = 74;
  const barH = 14;
  ctx.fillStyle = isPowered ? "#0c2212" : "#2b251e";
  ctx.fillRect(barX, barY, barW, barH);
  if (isPowered) {
    const halfSeg = Math.max(8, Math.round((barW * 0.48) * (0.25 + 0.75 * strength)));
    ctx.fillStyle = "#39ff7a";
    ctx.fillRect(barX + 2, barY + 2, halfSeg, barH - 4);
    ctx.fillRect(barX + barW - 2 - halfSeg, barY + 2, halfSeg, barH - 4);
  }
  ctx.strokeStyle = isPowered ? "#39ff7a" : "#e8dfc8";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(barX, barY, barW, barH);

  // 6Е1П Header & Status
  ctx.textAlign = "center";
  ctx.font = 'bold 18px "VT323", monospace';
  ctx.fillStyle = isPowered ? "#39ff7a" : "#e8dfc8";
  ctx.fillText("ИНД. 6Е1П", eyeCx, 30);

  ctx.fillStyle = isPowered ? "#110c06" : "#383127";
  ctx.fillRect(14, 138, 78, 32);
  ctx.strokeStyle = isPowered
    ? strength > 0.65
      ? "#39ff7a"
      : "#fff6d6"
    : "#e8dfc8";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(14, 138, 78, 32);
  ctx.fillStyle = !isPowered
    ? "#e8dfc8"
    : strength > 0.65
      ? "#39ff7a"
      : "#fff6d6";
  ctx.font = 'bold 19px "VT323", monospace';
  ctx.fillText(
    !isPowered
      ? "ОТКЛ."
      : strength > 0.72
        ? "ТОЧНО"
        : strength > 0.35
          ? "СИГНАЛ"
          : "ПОИСК",
    eyeCx,
    160,
  );

  // Right Dial Face Border & Header (x = 104..504)
  const dialX = 104;
  const dialW = w - dialX - 8;
  ctx.strokeStyle = isPowered ? "#110c06" : "#2b241c";
  ctx.lineWidth = 3;
  ctx.strokeRect(dialX, 8, dialW, h - 16);
  ctx.strokeStyle = isPowered ? "#fff6d6" : "#e8dfc8";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dialX + 2, 10, dialW - 4, h - 20);

  // Top-left scale title
  ctx.textAlign = "left";
  ctx.font = 'bold 16px "Kremlin", "Courier Prime", monospace';
  if (isPowered) {
    ctx.fillStyle = "#fff6d6";
    ctx.fillText("УКВ • ОКЕАН-84", dialX + 11, 31);
  }
  ctx.fillStyle = isPowered ? "#110c06" : "#e8dfc8";
  ctx.fillText("УКВ • ОКЕАН-84", dialX + 10, 30);

  // Large Live Frequency Readout Box (upper right)
  const boxX = 326;
  const boxY = 12;
  const boxW = 170;
  const boxH = 32;
  ctx.fillStyle = isPowered ? "#110c06" : "#383127";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = !isPowered
    ? "#e8dfc8"
    : nearest
      ? "#39ff7a"
      : "#fff6d6";
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.textAlign = "center";
  ctx.fillStyle = !isPowered
    ? "#e8dfc8"
    : nearest
      ? "#39ff7a"
      : "#fff6d6";
  ctx.font = 'bold 26px "VT323", monospace';
  ctx.fillText(`${freqMHz.toFixed(2)} МГц`, boxX + boxW / 2, boxY + 24);

  // Horizontal scale rail
  const railY = 98;
  ctx.strokeStyle = isPowered ? "#110c06" : "#2b241c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(SCALE_PX_LEFT - 4, railY);
  ctx.lineTo(SCALE_PX_RIGHT + 4, railY);
  ctx.stroke();

  ctx.strokeStyle = isPowered ? "#fff6d6" : "#e8dfc8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(SCALE_PX_LEFT - 4, railY);
  ctx.lineTo(SCALE_PX_RIGHT + 4, railY);
  ctx.stroke();

  // Minor (0.2 МГц), Odd (1.0 МГц) & Major (2.0 МГц) Ticks + Bold Numerals
  for (let i = 0; i <= 40; i++) {
    const f = RADIO_FREQ_MIN_MHZ + i * 0.2;
    const tx = THREE.MathUtils.lerp(SCALE_PX_LEFT, SCALE_PX_RIGHT, i / 40);
    const isEvenMHz = i % 10 === 0;
    const isOneMHz = i % 5 === 0;
    const tickTop = isEvenMHz ? railY - 22 : isOneMHz ? railY - 14 : railY - 8;
    const tickBottom = isEvenMHz ? railY + 5 : railY + 2;

    if (isEvenMHz || isOneMHz) {
      ctx.strokeStyle = isPowered ? "#110c06" : "#2b241c";
      ctx.lineWidth = isEvenMHz ? 6 : 4;
      ctx.beginPath();
      ctx.moveTo(tx, tickTop);
      ctx.lineTo(tx, tickBottom);
      ctx.stroke();

      ctx.strokeStyle = isPowered ? "#fff6d6" : "#e8dfc8";
      ctx.lineWidth = isEvenMHz ? 4 : 2.5;
      ctx.beginPath();
      ctx.moveTo(tx, tickTop);
      ctx.lineTo(tx, tickBottom);
      ctx.stroke();
    } else {
      ctx.strokeStyle = isPowered ? "#110c06" : "#e8dfc8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, tickTop);
      ctx.lineTo(tx, railY);
      ctx.stroke();
    }

    if (isEvenMHz) {
      const label = Math.round(f).toString();
      ctx.font = 'bold 26px "VT323", monospace';
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = isPowered ? "#110c06" : "#2b241c";
      ctx.strokeText(label, tx, railY - 27);
      ctx.fillStyle = isPowered ? "#fff6d6" : "#e8dfc8";
      ctx.fillText(label, tx, railY - 27);
    }
  }

  // Unit legend right of 74 mark
  ctx.textAlign = "center";
  ctx.font = 'bold 16px "VT323", monospace';
  ctx.lineWidth = 3;
  ctx.strokeStyle = isPowered ? "#110c06" : "#2b241c";
  ctx.strokeText("МГц", 491, railY - 12);
  ctx.fillStyle = isPowered ? "#fff6d6" : "#e8dfc8";
  ctx.fillText("МГц", 491, railY - 12);

  // All 5 Station Markers & Bold Cyrillic Names Below Rail
  for (let i = 0; i < RADIO_STATIONS.length; i++) {
    const st = RADIO_STATIONS[i];
    const ratio = frequencyToRatio(st.freqMHz);
    const sx = THREE.MathUtils.lerp(SCALE_PX_LEFT, SCALE_PX_RIGHT, ratio);
    const isLocked = isPowered && nearest?.freqMHz === st.freqMHz;

    ctx.fillStyle = !isPowered
      ? "#e8dfc8"
      : isLocked
        ? "#39ff7a"
        : "#110c06";
    ctx.beginPath();
    ctx.moveTo(sx, railY + 4);
    ctx.lineTo(sx - 5, railY + 13);
    ctx.lineTo(sx + 5, railY + 13);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = !isPowered
      ? "#e8dfc8"
      : isLocked
        ? "#39ff7a"
        : "#110c06";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, railY + 13);
    ctx.lineTo(sx, railY + 20);
    ctx.stroke();

    const pillW = 66;
    const pillH = 23;
    const pillX = sx - pillW / 2;
    const pillY = railY + 20;
    ctx.fillStyle = isPowered ? "#110c06" : "#383127";
    ctx.fillRect(pillX, pillY, pillW, pillH);
    ctx.strokeStyle = !isPowered
      ? "#e8dfc8"
      : isLocked
        ? "#39ff7a"
        : "#fff6d6";
    ctx.lineWidth = isLocked ? 2 : 1.5;
    ctx.strokeRect(pillX, pillY, pillW, pillH);

    ctx.textAlign = "center";
    ctx.fillStyle = !isPowered
      ? "#e8dfc8"
      : isLocked
        ? "#39ff7a"
        : "#fff6d6";
    ctx.font = 'bold 17px "VT323", monospace';
    ctx.fillText(st.city, sx, pillY + 17);
  }

  // Lower band status bar
  const barBottomX = 110;
  const barBottomY = 151;
  const barBottomW = 388;
  const barBottomH = 25;
  ctx.fillStyle = isPowered ? "#110c06" : "#383127";
  ctx.fillRect(barBottomX, barBottomY, barBottomW, barBottomH);
  ctx.strokeStyle = !isPowered
    ? "#e8dfc8"
    : nearest
      ? "#39ff7a"
      : "#fff6d6";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(barBottomX, barBottomY, barBottomW, barBottomH);

  ctx.textAlign = "left";
  ctx.fillStyle = !isPowered
    ? "#e8dfc8"
    : nearest
      ? "#39ff7a"
      : "#fff6d6";
  ctx.font = 'bold 17px "VT323", monospace';
  ctx.fillText(
    !isPowered
      ? "ПИТАНИЕ ОТКЛЮЧЕНО // НАЖМИТЕ «СЕТЬ»"
      : nearest
        ? `★ ПРИЁМ: ${nearest.label} (${nearest.freqMHz.toFixed(2)} МГц)`
        : "ДИАПАЗОН УКВ 66–74 МГц // НАСТРОЙКА",
    barBottomX + 10,
    barBottomY + 18,
  );
}

export const SovietRadioTable3D: React.FC<SovietRadioTable3DProps> = React.memo(
  ({ position = [5.58, 0, 1.58], rotation = [0, -Math.PI / 2, 0] }) => {
    const ironTex = useMemo(() => getHammeredIronTextures(), []);
    const brassTex = useMemo(() => getBrushedBrassTextures(), []);
    const woodTex = useMemo(() => getWeatheredMahoganyTextures(), []);

    const radioUnitGroupRef = useRef<THREE.Group>(null);
    const wheelGroupRef = useRef<THREE.Group>(null);
    const needleGroupRef = useRef<THREE.Group>(null);
    const powerBtnMeshRef = useRef<THREE.Mesh>(null);
    const broadcastBtnMeshRef = useRef<THREE.Mesh>(null);
    const dialMatRef = useRef<THREE.MeshBasicMaterial>(null);
    const needleTipMatRef = useRef<THREE.MeshStandardMaterial>(null);
    const freqRef = useRef<number>(INITIAL_FREQ_MHZ);
    const wheelAngleRef = useRef<number>(INITIAL_WHEEL_ANGLE);
    const powerOnRef = useRef<boolean>(true);
    const duckedRef = useRef<boolean>(false);
    const masterGainRef = useRef<number>(0.48);
    const needsGestureUnlockRef = useRef<boolean>(false);
    const lastAudioTickRef = useRef<number>(-1);
    const radioWorldPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
    const audioEngineRef = useRef<RadioAudioEngine | null>(null);
    const lastDialDrawMsRef = useRef<number>(0);
    const wheelFlushTimerRef = useRef<number>(0);
    const broadcastPressTimerRef = useRef<number>(0);
    const hoveredRef = useRef<boolean>(false);
    const powerHoveredRef = useRef<boolean>(false);
    const broadcastHoveredRef = useRef<boolean>(false);
    const draggingRef = useRef<boolean>(false);
    const dragCleanupRef = useRef<(() => void) | null>(null);
    const lastPublishedSubtitleRef = useRef<string | null>(null);
    const handleProgramEndedRef = useRef<(isError?: boolean) => void>(() => {});

    const textures = useMemo(() => {
      // Worn Dark Walnut / Phenolic Laminate Tabletop
      const tabletop = createPixelTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#2d1c13";
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 2) {
          const streak = ((y * 17) % 11) - 5;
          const r = 46 + streak;
          const g = 28 + Math.floor(streak * 0.6);
          const b = 18 + Math.floor(streak * 0.4);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(0, y, w, 2);
        }
        // Subtle worn patina along operator edge & tea ring stain
        ctx.fillStyle = "rgba(88, 58, 36, 0.25)";
        ctx.fillRect(18, 128, w - 36, 98);
        ctx.strokeStyle = "rgba(18, 10, 6, 0.55)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(198, 186, 22, 0.3, Math.PI * 1.9);
        ctx.stroke();
        // Scuffed corner border
        ctx.strokeStyle = "#1c110b";
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
      });

      // Riveted Brass Inventory Tag (`ЗИП / ИНВ. № 84-19`)
      const inventoryTag = createPixelTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = "#2b2414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#c9b06b";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#e6cf85";
        ctx.font = 'bold 22px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("ЗИП / ИНВ. № 84-19", w / 2, 30);
        ctx.fillStyle = "#d9c698";
        ctx.font = 'bold 18px "VT323", monospace';
        ctx.fillText("БЩУ-4 • СТОЛ ДЕЖУРНОГО", w / 2, 52);
      });

      // Radio Logbook Cover (`ЖУРНАЛ РАДИОЧАСТОТ`)
      const logbookCover = createPixelTexture(256, 192, (ctx, w, h) => {
        ctx.fillStyle = "#54493b";
        ctx.fillRect(0, 0, w, h);
        // Worn burgundy cloth spine strip on left
        ctx.fillStyle = "#4d1b18";
        ctx.fillRect(0, 0, 26, h);
        ctx.strokeStyle = "#2b231b";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        // Aged label sticker
        ctx.fillStyle = "#ded5b8";
        ctx.fillRect(48, 28, w - 72, 108);
        ctx.strokeStyle = "#181614";
        ctx.lineWidth = 3;
        ctx.strokeRect(52, 32, w - 80, 100);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 14px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("МИНЭНЕРГО СССР • БЩУ-4", 138, 54);
        ctx.fillStyle = "#8a1812";
        ctx.font = 'bold 17px "Kremlin", "Courier Prime", monospace';
        ctx.fillText("ЖУРНАЛ", 138, 82);
        ctx.fillText("РАДИОЧАСТОТ", 138, 104);
        ctx.fillStyle = "#141414";
        ctx.font = 'bold 14px "Courier Prime", monospace';
        ctx.fillText("1984 Г. // УКВ • КВ", 138, 124);
        // Bottom ink smudge & number
        ctx.fillStyle = "#ded5b8";
        ctx.font = 'bold 16px "VT323", monospace';
        ctx.fillText("СЕКТОР 84  № 14-Р", 138, 166);
      });

      // Radio Woven Speaker Cloth
      const speakerCloth = createPixelTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = "#161816";
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 4) {
          for (let x = 0; x < w; x += 4) {
            ctx.fillStyle = (x + y) % 8 === 0 ? "#242824" : "#101210";
            ctx.fillRect(x, y, 2, 2);
          }
        }
        // Subtle inner round acoustic speaker cone behind cloth
        const grad = ctx.createRadialGradient(
          w * 0.45,
          h * 0.5,
          6,
          w * 0.45,
          h * 0.5,
          48,
        );
        grad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
        grad.addColorStop(0.75, "rgba(8, 10, 9, 0.35)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });

      // Raised Chrome/Red Radio Model Badge (`ОКЕАН-84 // УКВ • КВ`)
      const modelBadge = createPixelTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = "#181c1a";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#a81915";
        ctx.fillRect(6, 6, w - 12, h - 12);
        ctx.strokeStyle = "#d8e0dc";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 26px "Kremlin", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("★ ОКЕАН-84", w / 2, 34);
        ctx.fillStyle = "#ffd980";
        ctx.font = 'bold 16px "VT323", monospace';
        ctx.fillText("УКВ • КВ1 • СВ • ДВ", w / 2, 53);
      });

      // Push-Switch Legend Strip (`СЕТЬ  УКВ  ЭФИР  СВ  ДВ`)
      const bandLegend = createPixelTexture(256, 36, (ctx, w, h) => {
        ctx.fillStyle = "#181c1a";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8c9690";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 16px "VT323", monospace';
        ctx.textAlign = "center";
        const labels = ["СЕТЬ", "УКВ", "ЭФИР", "СВ", "ДВ"];
        labels.forEach((lbl, idx) => {
          ctx.fillStyle =
            idx === 0
              ? "#ff5c4d"
              : idx === 1
                ? "#ffb85c"
                : idx === 2
                  ? "#39ff7a"
                  : "#e6dec3";
          ctx.fillText(lbl, 28 + idx * 50, 23);
        });
      });

      // Tuning Dial Knob Plate (`НАСТРОЙКА`)
      const tuningLabel = createPixelTexture(160, 40, (ctx, w, h) => {
        ctx.fillStyle = "#161a18";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 20px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("НАСТРОЙКА", w / 2, 27);
      });

      // Dynamic Backlit Glass Tuning Dial (starts ON & locked to Main Soundtrack 66.80 МГц)
      const dial = createPixelTexture(
        DIAL_CANVAS_W,
        DIAL_CANVAS_H,
        (ctx, w, h) => paintRadioDialCanvas(ctx, w, h, INITIAL_FREQ_MHZ, true),
      );

      return {
        tabletop,
        inventoryTag,
        logbookCover,
        speakerCloth,
        modelBadge,
        bandLegend,
        tuningLabel,
        dial,
      };
    }, []);

    const mats = useMemo(() => {
      return {
        oliveSteel: new THREE.MeshStandardMaterial({
          color: "#364a3e",
          metalness: 0.45,
          roughness: 0.58,
          bumpMap: ironTex.bumpMap,
          bumpScale: 0.007,
          roughnessMap: ironTex.roughnessMap,
        }),
        darkSteel: new THREE.MeshStandardMaterial({
          color: "#222926",
          metalness: 0.65,
          roughness: 0.46,
          bumpMap: ironTex.bumpMap,
          bumpScale: 0.006,
        }),
        rubberBlack: new THREE.MeshStandardMaterial({
          color: "#141615",
          metalness: 0.08,
          roughness: 0.88,
        }),
        bakelite: new THREE.MeshStandardMaterial({
          color: "#141414",
          metalness: 0.16,
          roughness: 0.44,
        }),
        tabletopWood: new THREE.MeshStandardMaterial({
          map: textures.tabletop,
          bumpMap: woodTex.bumpMap,
          bumpScale: 0.005,
          roughnessMap: woodTex.roughnessMap,
          roughness: 0.56,
          metalness: 0.08,
        }),
        mahogany: new THREE.MeshStandardMaterial({
          map: woodTex.map,
          color: "#753722",
          bumpMap: woodTex.bumpMap,
          bumpScale: 0.006,
          roughnessMap: woodTex.roughnessMap,
          roughness: 0.48,
          metalness: 0.06,
        }),
        aluminum: new THREE.MeshStandardMaterial({
          color: "#aeb8b2",
          metalness: 0.86,
          roughness: 0.26,
        }),
        chrome: new THREE.MeshStandardMaterial({
          color: "#dce4e0",
          metalness: 0.92,
          roughness: 0.16,
        }),
        brass: new THREE.MeshStandardMaterial({
          color: "#c2aa6b",
          metalness: 0.86,
          roughness: 0.28,
          bumpMap: brassTex.bumpMap,
          bumpScale: 0.004,
          roughnessMap: brassTex.roughnessMap,
        }),
        ivoryKey: new THREE.MeshStandardMaterial({
          color: "#e6dec3",
          metalness: 0.06,
          roughness: 0.48,
        }),
        crimson: new THREE.MeshStandardMaterial({
          color: "#b8201c",
          metalness: 0.18,
          roughness: 0.46,
        }),
        paper: new THREE.MeshStandardMaterial({
          color: "#e6dec3",
          roughness: 0.88,
          metalness: 0.02,
        }),
        burgundyCloth: new THREE.MeshStandardMaterial({
          color: "#4d1b18",
          roughness: 0.84,
          metalness: 0.04,
        }),
        cardboard: new THREE.MeshStandardMaterial({
          color: "#5c4d3c",
          roughness: 0.86,
          metalness: 0.04,
        }),
        glassCup: new THREE.MeshStandardMaterial({
          color: "#cde4de",
          transparent: true,
          opacity: 0.46,
          roughness: 0.12,
          metalness: 0.1,
          depthWrite: false,
        }),
        teaLiquid: new THREE.MeshStandardMaterial({
          color: "#6e2908",
          roughness: 0.2,
          metalness: 0.05,
        }),
        ashWell: new THREE.MeshStandardMaterial({
          color: "#2b2d2a",
          roughness: 0.92,
          metalness: 0.12,
        }),
        hitboxHidden: new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      };
    }, [brassTex, ironTex, textures, woodTex]);

    const geos = useMemo(() => {
      // 1. Merged olive-steel table frame (4 L-legs, aprons, rear X-bracing, lower stretchers, 6 shelf slats)
      const frameParts: Array<{
        geometry: THREE.BufferGeometry;
        position?: readonly [number, number, number];
        rotation?: readonly [number, number, number];
      }> = [];

      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          // X-flange & Z-flange of L-profile angle-iron leg
          frameParts.push({
            geometry: new THREE.BoxGeometry(0.038, 0.724, 0.006),
            position: [sx * 0.393, 0.386, sz * 0.259],
          });
          frameParts.push({
            geometry: new THREE.BoxGeometry(0.006, 0.724, 0.038),
            position: [sx * 0.409, 0.386, sz * 0.243],
          });
          // Corner gusset plates at upper joint
          frameParts.push({
            geometry: new THREE.BoxGeometry(0.068, 0.064, 0.006),
            position: [sx * 0.378, 0.678, sz * 0.259],
          });
          frameParts.push({
            geometry: new THREE.BoxGeometry(0.006, 0.064, 0.068),
            position: [sx * 0.409, 0.678, sz * 0.228],
          });
        }
      }

      // Upper aprons (left, right, back, split front framing drawer bay)
      frameParts.push(
        {
          geometry: new THREE.BoxGeometry(0.008, 0.066, 0.504),
          position: [-0.408, 0.715, 0],
        },
        {
          geometry: new THREE.BoxGeometry(0.008, 0.066, 0.504),
          position: [0.408, 0.715, 0],
        },
        {
          geometry: new THREE.BoxGeometry(0.816, 0.066, 0.008),
          position: [0, 0.715, -0.258],
        },
        {
          geometry: new THREE.BoxGeometry(0.282, 0.088, 0.01),
          position: [-0.265, 0.704, 0.257],
        },
        {
          geometry: new THREE.BoxGeometry(0.102, 0.088, 0.01),
          position: [0.355, 0.704, 0.257],
        },
        {
          geometry: new THREE.BoxGeometry(0.43, 0.014, 0.022),
          position: [0.09, 0.646, 0.252],
        },
      );

      // Rear diagonal X-cross bracing
      const braceAngle = Math.atan2(0.44, 0.76);
      frameParts.push(
        {
          geometry: new THREE.BoxGeometry(0.88, 0.022, 0.006),
          position: [0, 0.455, -0.254],
          rotation: [0, 0, braceAngle],
        },
        {
          geometry: new THREE.BoxGeometry(0.88, 0.022, 0.006),
          position: [0, 0.455, -0.254],
          rotation: [0, 0, -braceAngle],
        },
      );

      // Lower shelf perimeter stretchers & 6 longitudinal steel slats (`y = 0.220`, top `0.227`)
      frameParts.push(
        {
          geometry: new THREE.BoxGeometry(0.016, 0.024, 0.49),
          position: [-0.402, 0.212, 0],
        },
        {
          geometry: new THREE.BoxGeometry(0.016, 0.024, 0.49),
          position: [0.402, 0.212, 0],
        },
        {
          geometry: new THREE.BoxGeometry(0.81, 0.024, 0.016),
          position: [0, 0.212, -0.252],
        },
        {
          geometry: new THREE.BoxGeometry(0.81, 0.024, 0.016),
          position: [0, 0.212, 0.252],
        },
      );
      for (const sz of [-0.195, -0.117, -0.039, 0.039, 0.117, 0.195]) {
        frameParts.push({
          geometry: new THREE.BoxGeometry(0.794, 0.014, 0.058),
          position: [0, 0.22, sz],
        });
      }
      const tableFrame = mergeStaticGeometries(frameParts);

      // 2. Merged dark-steel bolts & rivets on frame gussets & cross-brace center
      const boltParts: Array<{
        geometry: THREE.BufferGeometry;
        position?: readonly [number, number, number];
        rotation?: readonly [number, number, number];
      }> = [
        {
          geometry: new THREE.CylinderGeometry(0.008, 0.008, 0.016, 6),
          position: [0, 0.455, -0.254],
          rotation: [Math.PI / 2, 0, 0],
        },
      ];
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          boltParts.push(
            {
              geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.014, 6),
              position: [sx * 0.362, 0.684, sz * 0.261],
              rotation: [Math.PI / 2, 0, 0],
            },
            {
              geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.014, 6),
              position: [sx * 0.411, 0.684, sz * 0.212],
              rotation: [0, 0, Math.PI / 2],
            },
          );
        }
      }
      const frameBolts = mergeStaticGeometries(boltParts);

      // 3. Merged brushed-aluminum tabletop perimeter trim + corner screw studs
      const trimParts: Array<{
        geometry: THREE.BufferGeometry;
        position?: readonly [number, number, number];
      }> = [
        {
          geometry: new THREE.BoxGeometry(0.868, 0.036, 0.01),
          position: [0, 0.764, 0.28],
        },
        {
          geometry: new THREE.BoxGeometry(0.868, 0.036, 0.01),
          position: [0, 0.764, -0.28],
        },
        {
          geometry: new THREE.BoxGeometry(0.01, 0.036, 0.55),
          position: [-0.43, 0.764, 0],
        },
        {
          geometry: new THREE.BoxGeometry(0.01, 0.036, 0.55),
          position: [0.43, 0.764, 0],
        },
      ];
      const tabletopTrim = mergeStaticGeometries(trimParts);

      // 4. Merged slotted speaker louver grille on front of ОКЕАН-84
      const grilleParts: Array<{
        geometry: THREE.BufferGeometry;
        position?: readonly [number, number, number];
      }> = [
        // Vertical chrome brace ribs
        {
          geometry: new THREE.BoxGeometry(0.005, 0.094, 0.008),
          position: [-0.15, 0.099, 0.098],
        },
        {
          geometry: new THREE.BoxGeometry(0.005, 0.094, 0.008),
          position: [0.018, 0.099, 0.098],
        },
      ];
      for (let i = 0; i < 9; i++) {
        grilleParts.push({
          geometry: new THREE.BoxGeometry(0.264, 0.0045, 0.008),
          position: [-0.066, 0.058 + i * 0.0102, 0.098],
        });
      }
      const speakerGrille = mergeStaticGeometries(grilleParts);

      // 5. Merged 16 radial knurled grip ridges for the tuning wheel
      const knurlParts: Array<{
        geometry: THREE.BufferGeometry;
        position?: readonly [number, number, number];
        rotation?: readonly [number, number, number];
      }> = [];
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        knurlParts.push({
          geometry: new THREE.BoxGeometry(0.005, 0.005, 0.03),
          position: [Math.cos(ang) * 0.0445, Math.sin(ang) * 0.0445, 0.016],
          rotation: [0, 0, ang],
        });
      }
      const wheelKnurls = mergeStaticGeometries(knurlParts);

      // 6. Thick black insulated power cord looping from radio rear to wall outlet (`220В`)
      const cordCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.122, 0.835, -0.048),
        new THREE.Vector3(0.24, 0.805, -0.19),
        new THREE.Vector3(0.32, 0.772, -0.282),
        new THREE.Vector3(0.392, 0.62, -0.265),
        new THREE.Vector3(0.392, 0.36, -0.265),
        new THREE.Vector3(0.35, 0.24, -0.32),
        new THREE.Vector3(0.26, 0.325, -0.375),
      ]);
      const powerCord = new THREE.TubeGeometry(cordCurve, 32, 0.0085, 8, false);

      return {
        tableFrame,
        frameBolts,
        tabletopTrim,
        speakerGrille,
        wheelKnurls,
        powerCord,
      };
    }, []);

    const publishSubtitle = useCallback((next: string | null) => {
      if (lastPublishedSubtitleRef.current === next) return;
      lastPublishedSubtitleRef.current = next;
      useGameStore.getState().setRadioBroadcastSubtitle(next);
    }, []);

    const updateBroadcastSubtitle = useCallback(() => {
      const engine = audioEngineRef.current;
      const gs = useGameStore.getState();
      if (
        !powerOnRef.current ||
        duckedRef.current ||
        gs.diagFeedActive ||
        gs.isMusicMuted ||
        gs.phase !== "playing" ||
        !engine ||
        engine.disposed ||
        engine.activeStationIndex < 0 ||
        engine.player.paused
      ) {
        publishSubtitle(null);
        return;
      }

      const { strength } = computeSignalStrength(freqRef.current);
      if (strength <= SUBTITLE_MIN_SIGNAL_STRENGTH) {
        publishSubtitle(null);
        return;
      }

      const st = engine.stations[engine.activeStationIndex];
      if (!st || st.phase === "song") {
        publishSubtitle(null);
        return;
      }

      const cur = engine.player.currentTime;
      if (!Number.isFinite(cur)) {
        publishSubtitle(null);
        return;
      }

      if (st.phase === "chime") {
        publishSubtitle(findSubtitleCueText(SUBTITLE_CUES.govorit_moskva, cur));
        return;
      }

      const ann =
        RADIO_ANNOUNCEMENTS[st.announcementIdx % RADIO_ANNOUNCEMENTS.length];
      const cues = ann ? SUBTITLE_CUES[ann.id] : undefined;
      publishSubtitle(cues ? findSubtitleCueText(cues, cur) : null);
    }, [publishSubtitle]);

    const ensureAudioEngine = useCallback((): RadioAudioEngine | null => {
      silenceAllLegacyGlobalBgm();
      const existing = audioEngineRef.current;
      if (existing && !existing.disposed) return existing;

      const rWin = window as RadioSingletonWindow;
      rWin.__mipActiveRadioEngineCleanup?.();
      rWin.__mipActiveRadioEngineCleanup = undefined;

      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      const staticBuffer = createAnalogStaticBuffer(ctx);
      const staticSource = ctx.createBufferSource();
      staticSource.buffer = staticBuffer;
      staticSource.loop = true;

      const staticGain = ctx.createGain();
      staticGain.gain.value = 0;

      staticSource.connect(staticGain);
      staticGain.connect(ctx.destination);
      staticSource.start();

      const player = new Audio();
      player.dataset.okean84Radio = "1";
      player.preload = "auto";
      player.loop = false;
      player.volume = 0;

      const stations: StationProgramState[] = RADIO_STATIONS.map((st) => ({
        freqMHz: st.freqMHz,
        tracks: st.tracks,
        trackIndex: 0,
        phase: "song",
        announcementIdx: 0,
        savedOffsetSec: 0,
      }));

      const engine: RadioAudioEngine = {
        ctx,
        staticGain,
        staticSource,
        player,
        stations,
        activeStationIndex: -1,
        loadedSrcKey: null,
        nextAnnouncementIdx: 0,
        isPlaying: false,
        playInFlight: false,
        playSeq: 0,
        consecutiveErrors: 0,
        pendingSeekSec: null,
        onMetadata: null,
        onEnded: () => {
          handleProgramEndedRef.current(false);
        },
        onError: () => {
          handleProgramEndedRef.current(true);
        },
        disposed: false,
      };
      player.addEventListener("ended", engine.onEnded);
      player.addEventListener("error", engine.onError);

      audioEngineRef.current = engine;
      rWin.__mipActiveRadioEngineCleanup = () => {
        if (audioEngineRef.current === engine) {
          audioEngineRef.current = null;
        }
        disposeRadioEngineInstance(engine);
      };
      return engine;
    }, []);

    const syncRadioAudio = useCallback(
      (freqMHz: number, masterGain: number, isActive: boolean) => {
        const engine = audioEngineRef.current;
        if (!engine || engine.disposed) {
          publishSubtitle(null);
          return;
        }

        if (!isActive) {
          if (engine.activeStationIndex >= 0) {
            if (engine.pendingSeekSec !== null) {
              engine.stations[engine.activeStationIndex].savedOffsetSec =
                engine.pendingSeekSec;
            } else if (
              Number.isFinite(engine.player.currentTime) &&
              engine.player.currentTime > 0
            ) {
              engine.stations[engine.activeStationIndex].savedOffsetSec =
                engine.player.currentTime;
            }
          }
          engine.playSeq += 1;
          clearEngineMetadataListener(engine);
          engine.player.volume = 0;
          if (engine.isPlaying || !engine.player.paused) {
            engine.player.pause();
          }
          engine.isPlaying = false;
          engine.playInFlight = false;
          engine.staticGain.gain.setTargetAtTime(0, engine.ctx.currentTime, 0.015);
          if (engine.ctx.state === "running") {
            void engine.ctx.suspend().catch(() => {});
          }
          publishSubtitle(null);
          return;
        }

        if (engine.ctx.state === "suspended" && !needsGestureUnlockRef.current) {
          void engine.ctx.resume().catch(() => {});
        }

        let minDist = Infinity;
        let nearestIdx = -1;
        for (let i = 0; i < engine.stations.length; i++) {
          const dist = Math.abs(freqMHz - engine.stations[i].freqMHz);
          if (dist < minDist) {
            minDist = dist;
            if (dist <= STATION_WAKE_HALF_MHZ) {
              nearestIdx = i;
            }
          }
        }

        if (nearestIdx !== engine.activeStationIndex) {
          if (engine.activeStationIndex >= 0) {
            if (engine.pendingSeekSec !== null) {
              engine.stations[engine.activeStationIndex].savedOffsetSec =
                engine.pendingSeekSec;
            } else if (
              Number.isFinite(engine.player.currentTime) &&
              engine.player.currentTime > 0
            ) {
              engine.stations[engine.activeStationIndex].savedOffsetSec =
                engine.player.currentTime;
            }
          }
          engine.playSeq += 1;
          clearEngineMetadataListener(engine);
          if (engine.isPlaying || !engine.player.paused) {
            engine.player.pause();
          }
          engine.isPlaying = false;
          engine.playInFlight = false;
          engine.activeStationIndex = nearestIdx;
        }

        if (nearestIdx >= 0) {
          const st = engine.stations[nearestIdx];
          const musicLevel = computeStationMusicLevel(minDist);
          const targetVol = THREE.MathUtils.clamp(
            musicLevel * masterGain * BASE_MUSIC_VOLUME,
            0,
            1,
          );
          engine.player.volume = targetVol;

          const targetSrc = getStationTargetSrc(st);
          const srcChanged = engine.loadedSrcKey !== targetSrc;
          if (srcChanged) {
            engine.playSeq += 1;
            clearEngineMetadataListener(engine);
            if (!engine.player.paused) {
              engine.player.pause();
            }
            engine.isPlaying = false;
            engine.playInFlight = false;
            engine.loadedSrcKey = targetSrc;
            engine.pendingSeekSec =
              st.savedOffsetSec > 0.05 ? st.savedOffsetSec : null;
            engine.player.src = resolvePublicAudioUrl(targetSrc);
          }

          if (
            !engine.isPlaying &&
            !engine.playInFlight &&
            engine.player.paused &&
            !needsGestureUnlockRef.current
          ) {
            engine.isPlaying = true;
            engine.playInFlight = true;
            const seq = ++engine.playSeq;

            const desiredOffset =
              engine.pendingSeekSec !== null
                ? engine.pendingSeekSec
                : srcChanged
                  ? 0
                  : st.savedOffsetSec;

            if (desiredOffset > 0.05) {
              const applyOffset = () => {
                if (
                  engine.disposed ||
                  engine.activeStationIndex !== nearestIdx ||
                  engine.loadedSrcKey !== targetSrc
                ) {
                  return;
                }
                const dur = engine.player.duration;
                if (Number.isFinite(dur) && dur > 0) {
                  engine.player.currentTime =
                    desiredOffset < dur - 0.25 ? desiredOffset : 0;
                  engine.pendingSeekSec = null;
                }
              };
              if (
                Number.isFinite(engine.player.duration) &&
                engine.player.duration > 0
              ) {
                applyOffset();
              } else if (!engine.onMetadata) {
                const onMeta = () => {
                  engine.onMetadata = null;
                  applyOffset();
                };
                engine.onMetadata = onMeta;
                engine.player.addEventListener("loadedmetadata", onMeta, {
                  once: true,
                });
              }
            } else if (
              Number.isFinite(engine.player.duration) &&
              engine.player.currentTime > 0.05 &&
              srcChanged
            ) {
              engine.player.currentTime = 0;
              engine.pendingSeekSec = null;
            } else {
              engine.pendingSeekSec = null;
            }

            const playPromise = engine.player.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  if (engine.playSeq !== seq) return;
                  engine.playInFlight = false;
                  engine.consecutiveErrors = 0;
                  if (
                    engine.disposed ||
                    !engine.isPlaying ||
                    engine.activeStationIndex !== nearestIdx
                  ) {
                    engine.player.pause();
                    return;
                  }
                  needsGestureUnlockRef.current = false;
                  updateBroadcastSubtitle();
                })
                .catch((err: unknown) => {
                  if (engine.playSeq !== seq) return;
                  engine.playInFlight = false;
                  if (!engine.disposed) {
                    engine.isPlaying = false;
                    const errName = (err as { name?: string } | null)?.name;
                    if (errName === "NotAllowedError") {
                      needsGestureUnlockRef.current = true;
                    }
                    publishSubtitle(null);
                  }
                });
            } else {
              engine.playInFlight = false;
              engine.consecutiveErrors = 0;
            }
          } else if (!engine.player.paused) {
            engine.isPlaying = true;
          }
        } else {
          engine.player.volume = 0;
          publishSubtitle(null);
        }

        const staticLevel = computeStaticHissLevel(minDist);
        const targetStatic = THREE.MathUtils.clamp(
          staticLevel * masterGain,
          0,
          1,
        );
        engine.staticGain.gain.setTargetAtTime(
          targetStatic,
          engine.ctx.currentTime,
          0.02,
        );
        updateBroadcastSubtitle();
      },
      [publishSubtitle, updateBroadcastSubtitle],
    );

    const advanceStationProgram = useCallback(
      (isError = false) => {
        const engine = audioEngineRef.current;
        if (!engine || engine.disposed || engine.activeStationIndex < 0) return;

        if (isError) {
          if (!engine.player.getAttribute("src")) return;
          engine.consecutiveErrors += 1;
          if (engine.consecutiveErrors >= 3) {
            engine.isPlaying = false;
            engine.playInFlight = false;
            publishSubtitle(null);
            return;
          }
        } else {
          engine.consecutiveErrors = 0;
        }

        const st = engine.stations[engine.activeStationIndex];
        if (!st) return;

        if (st.phase === "song") {
          st.phase = "chime";
          st.announcementIdx = engine.nextAnnouncementIdx;
          engine.nextAnnouncementIdx =
            (engine.nextAnnouncementIdx + 1) % RADIO_ANNOUNCEMENTS.length;
          st.savedOffsetSec = 0;
        } else if (st.phase === "chime") {
          st.phase = "announcement";
          st.savedOffsetSec = 0;
        } else {
          st.trackIndex = (st.trackIndex + 1) % st.tracks.length;
          st.phase = "song";
          st.savedOffsetSec = 0;
        }

        engine.playSeq += 1;
        engine.isPlaying = false;
        engine.playInFlight = false;
        engine.loadedSrcKey = null;
        engine.pendingSeekSec = null;

        const isActive = powerOnRef.current && !duckedRef.current;
        syncRadioAudio(freqRef.current, masterGainRef.current, isActive);
      },
      [publishSubtitle, syncRadioAudio],
    );

    useEffect(() => {
      handleProgramEndedRef.current = advanceStationProgram;
    }, [advanceStationProgram]);

    const syncTuningVisuals = useCallback((forceDialRedraw: boolean) => {
      const freq = freqRef.current;
      if (wheelGroupRef.current) {
        wheelGroupRef.current.rotation.z = -wheelAngleRef.current;
      }
      if (needleGroupRef.current) {
        needleGroupRef.current.position.x = frequencyToNeedleX(freq);
      }

      const now = performance.now();
      if (
        !forceDialRedraw &&
        now - lastDialDrawMsRef.current < DIAL_REDRAW_INTERVAL_MS
      ) {
        return;
      }
      lastDialDrawMsRef.current = now;
      const tex = dialMatRef.current?.map as THREE.CanvasTexture | undefined;
      if (!tex) return;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintRadioDialCanvas(
          ctx,
          DIAL_CANVAS_W,
          DIAL_CANVAS_H,
          freq,
          powerOnRef.current,
        );
        tex.needsUpdate = true;
      }
    }, []);

    const setRadioPower = (
      nextPower: boolean,
      cameraPosition?: THREE.Vector3,
    ) => {
      powerOnRef.current = nextPower;
      needsGestureUnlockRef.current = false;

      if (powerBtnMeshRef.current) {
        powerBtnMeshRef.current.position.set(
          -0.162,
          nextPower ? 0.0235 : 0.029,
          nextPower ? 0.0965 : 0.104,
        );
        powerBtnMeshRef.current.rotation.x = nextPower ? 0.19 : 0.05;
      }

      if (dialMatRef.current) {
        dialMatRef.current.color.set("#ffffff");
      }
      if (needleTipMatRef.current) {
        needleTipMatRef.current.emissiveIntensity = nextPower ? 0.65 : 0.05;
      }

      if (powerHoveredRef.current) {
        useGameStore
          .getState()
          .setHoveredControlHint(
            nextPower
              ? "РАДИО «ОКЕАН-84» (СЕТЬ): Click to Power OFF Radio"
              : "РАДИО «ОКЕАН-84» (СЕТЬ): Click to Power ON Radio",
          );
      }

      syncTuningVisuals(true);

      if (nextPower) {
        ensureAudioEngine();
        const gs = useGameStore.getState();
        const shouldDuck =
          gs.diagFeedActive || gs.isMusicMuted || gs.phase !== "playing";
        duckedRef.current = shouldDuck;
        if (shouldDuck) {
          masterGainRef.current = 0;
          syncRadioAudio(freqRef.current, 0, false);
          return;
        }
        let initialGain = masterGainRef.current;
        if (cameraPosition && radioUnitGroupRef.current) {
          radioUnitGroupRef.current.getWorldPosition(radioWorldPosRef.current);
          initialGain = computeDistanceGain(
            cameraPosition,
            radioWorldPosRef.current,
          );
        }
        masterGainRef.current = initialGain;
        syncRadioAudio(freqRef.current, initialGain, true);
      } else {
        duckedRef.current = false;
        syncRadioAudio(freqRef.current, 0, false);
      }
    };

    const applyFrequencyDelta = (
      deltaMHz: number,
      forceDialRedraw: boolean,
    ) => {
      const prev = freqRef.current;
      const next = THREE.MathUtils.clamp(
        prev + deltaMHz,
        RADIO_FREQ_MIN_MHZ,
        RADIO_FREQ_MAX_MHZ,
      );
      const actualDelta = next - prev;
      freqRef.current = next;
      wheelAngleRef.current +=
        (actualDelta / MHZ_PER_WHEEL_REV) * Math.PI * 2;
      syncTuningVisuals(forceDialRedraw);
      if (powerOnRef.current && !duckedRef.current) {
        syncRadioAudio(next, masterGainRef.current, true);
      }
    };

    useFrame((state) => {
      if (!powerOnRef.current) return;
      const t = state.clock.elapsedTime;
      if (
        lastAudioTickRef.current >= 0 &&
        t - lastAudioTickRef.current < 0.1
      ) {
        return;
      }
      lastAudioTickRef.current = t;

      const gs = useGameStore.getState();
      const shouldDuck =
        gs.diagFeedActive || gs.isMusicMuted || gs.phase !== "playing";
      if (shouldDuck) {
        if (!duckedRef.current) {
          duckedRef.current = true;
          masterGainRef.current = 0;
          syncRadioAudio(freqRef.current, 0, false);
        }
        return;
      }

      if (radioUnitGroupRef.current) {
        radioUnitGroupRef.current.getWorldPosition(radioWorldPosRef.current);
      }
      const targetGain = computeDistanceGain(
        state.camera.position,
        radioWorldPosRef.current,
      );
      const nextGain = duckedRef.current
        ? targetGain
        : THREE.MathUtils.lerp(masterGainRef.current, targetGain, 0.45);
      duckedRef.current = false;
      masterGainRef.current = nextGain;
      syncRadioAudio(freqRef.current, nextGain, true);
    });

    useEffect(() => {
      let unmounted = false;
      silenceAllLegacyGlobalBgm();

      if (typeof document !== "undefined" && document.fonts?.ready) {
        void document.fonts.ready.then(() => {
          if (!unmounted) {
            syncTuningVisuals(true);
          }
        });
      }

      if (powerOnRef.current) {
        const eng = ensureAudioEngine();
        const gs = useGameStore.getState();
        const shouldDuck =
          gs.diagFeedActive || gs.isMusicMuted || gs.phase !== "playing";
        duckedRef.current = shouldDuck;
        if (eng && !shouldDuck) {
          syncRadioAudio(freqRef.current, masterGainRef.current, true);
        }
      }

      const removeUnlockListeners = () => {
        window.removeEventListener("pointerdown", unlockRadioOnGesture);
        window.removeEventListener("keydown", unlockRadioOnGesture);
      };

      function unlockRadioOnGesture() {
        removeUnlockListeners();
        if (unmounted || !powerOnRef.current) return;
        const gs = useGameStore.getState();
        const shouldDuck =
          gs.diagFeedActive || gs.isMusicMuted || gs.phase !== "playing";
        if (shouldDuck) return;

        duckedRef.current = false;
        needsGestureUnlockRef.current = false;
        const eng = ensureAudioEngine();
        if (!eng || eng.disposed) return;
        if (eng.ctx.state === "suspended") {
          void eng.ctx.resume().catch(() => {});
        }
        const nearStation = eng.stations.some(
          (st) => Math.abs(freqRef.current - st.freqMHz) <= STATION_WAKE_HALF_MHZ,
        );
        if (nearStation && eng.player.paused && !eng.playInFlight) {
          eng.isPlaying = false;
          syncRadioAudio(freqRef.current, masterGainRef.current, true);
        }
      }

      window.addEventListener("pointerdown", unlockRadioOnGesture, {
        once: true,
        passive: true,
      });
      window.addEventListener("keydown", unlockRadioOnGesture, {
        once: true,
      });

      return () => {
        unmounted = true;
        removeUnlockListeners();
        if (wheelFlushTimerRef.current) {
          window.clearTimeout(wheelFlushTimerRef.current);
          wheelFlushTimerRef.current = 0;
        }
        if (broadcastPressTimerRef.current) {
          window.clearTimeout(broadcastPressTimerRef.current);
          broadcastPressTimerRef.current = 0;
        }
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
        if (
          hoveredRef.current ||
          powerHoveredRef.current ||
          broadcastHoveredRef.current ||
          draggingRef.current
        ) {
          document.body.style.cursor = "auto";
        }
        useGameStore.getState().setHoveredControlHint(null);
        publishSubtitle(null);

        const engine = audioEngineRef.current;
        if (engine) {
          audioEngineRef.current = null;
          disposeRadioEngineInstance(engine);
        }
        (window as RadioSingletonWindow).__mipActiveRadioEngineCleanup =
          undefined;
      };
    }, [ensureAudioEngine, publishSubtitle, syncRadioAudio, syncTuningVisuals]);

    const handlePowerButtonPointerDown = (e: ThreeEvent<PointerEvent>) => {
      if (useCameraLookStore.getState().isFreeLookMode) return;
      e.stopPropagation();
      setRadioPower(!powerOnRef.current, e.camera.position);
    };

    const handleBroadcastButtonPointerDown = (e: ThreeEvent<PointerEvent>) => {
      if (useCameraLookStore.getState().isFreeLookMode) return;
      e.stopPropagation();
      needsGestureUnlockRef.current = false;

      if (broadcastBtnMeshRef.current) {
        broadcastBtnMeshRef.current.position.set(-0.066, 0.024, 0.097);
        broadcastBtnMeshRef.current.rotation.x = 0.18;
      }
      if (broadcastPressTimerRef.current) {
        window.clearTimeout(broadcastPressTimerRef.current);
      }
      broadcastPressTimerRef.current = window.setTimeout(() => {
        broadcastPressTimerRef.current = 0;
        if (broadcastBtnMeshRef.current) {
          broadcastBtnMeshRef.current.position.set(-0.066, 0.028, 0.103);
          broadcastBtnMeshRef.current.rotation.x = 0.06;
        }
      }, 170);

      if (!powerOnRef.current) {
        setRadioPower(true, e.camera.position);
      }
      const eng = ensureAudioEngine();
      if (!eng || eng.disposed) return;
      if (eng.ctx.state === "suspended") {
        void eng.ctx.resume().catch(() => {});
      }
      if (eng.activeStationIndex < 0) {
        const nearestIdx = eng.stations.findIndex(
          (st) => Math.abs(freqRef.current - st.freqMHz) <= STATION_WAKE_HALF_MHZ,
        );
        if (nearestIdx >= 0) {
          eng.activeStationIndex = nearestIdx;
        }
      }
      if (eng.activeStationIndex >= 0) {
        advanceStationProgram(false);
      }
    };

    const handleTuningWheelPointerDown = (e: ThreeEvent<PointerEvent>) => {
      if (useCameraLookStore.getState().isFreeLookMode) return;
      e.stopPropagation();
      dragCleanupRef.current?.();
      needsGestureUnlockRef.current = false;

      if (!powerOnRef.current) {
        setRadioPower(true, e.camera.position);
      } else {
        const eng = audioEngineRef.current;
        if (eng && eng.ctx.state === "suspended") {
          void eng.ctx.resume().catch(() => {});
        }
      }

      draggingRef.current = true;
      document.body.style.cursor = "grabbing";

      const r3fTarget = e.target as unknown as {
        setPointerCapture?: (id: number) => void;
        releasePointerCapture?: (id: number) => void;
      };
      r3fTarget?.setPointerCapture?.(e.pointerId);

      const domElem =
        (e.nativeEvent.target as HTMLElement | null) ??
        document.querySelector("canvas");
      const rect = domElem?.getBoundingClientRect();
      let centerX = e.nativeEvent.clientX;
      let centerY = e.nativeEvent.clientY;
      if (wheelGroupRef.current && rect && rect.width > 0 && rect.height > 0) {
        const worldPos = new THREE.Vector3();
        wheelGroupRef.current.getWorldPosition(worldPos);
        worldPos.project(e.camera);
        centerX = rect.left + (worldPos.x * 0.5 + 0.5) * rect.width;
        centerY = rect.top + (-worldPos.y * 0.5 + 0.5) * rect.height;
      }

      let prevX = e.nativeEvent.clientX;
      let prevY = e.nativeEvent.clientY;
      const initR = Math.hypot(prevX - centerX, prevY - centerY);
      let hasValidAngle = initR >= 14;
      let prevAngle = hasValidAngle
        ? Math.atan2(prevY - centerY, prevX - centerX)
        : 0;

      const handleMove = (ev: PointerEvent) => {
        const stepDX = ev.clientX - prevX;
        const stepDY = ev.clientY - prevY;
        prevX = ev.clientX;
        prevY = ev.clientY;

        const rx = ev.clientX - centerX;
        const ry = ev.clientY - centerY;
        const r = Math.hypot(rx, ry);
        const fineScale = ev.shiftKey ? 0.3 : 1.0;

        let dAngle = 0;
        if (r >= 14) {
          const curAngle = Math.atan2(ry, rx);
          if (!hasValidAngle) {
            hasValidAngle = true;
            prevAngle = curAngle;
            dAngle = (stepDX - stepDY) * 0.016;
          } else {
            let dTheta = curAngle - prevAngle;
            while (dTheta > Math.PI) dTheta -= Math.PI * 2;
            while (dTheta < -Math.PI) dTheta += Math.PI * 2;
            prevAngle = curAngle;

            // Blend seamlessly between circular swivel and linear drag
            const radialDot = Math.abs((rx * stepDX + ry * stepDY) / r);
            const tangDot = Math.abs((-ry * stepDX + rx * stepDY) / r);
            if (tangDot >= radialDot * 0.45 && Math.abs(dTheta) < 0.7) {
              dAngle = dTheta;
            } else {
              dAngle = (stepDX - stepDY) * 0.016;
            }
          }
        } else {
          hasValidAngle = false;
          dAngle = (stepDX - stepDY) * 0.016;
        }

        const deltaMHz =
          ((dAngle * fineScale) / (Math.PI * 2)) * MHZ_PER_WHEEL_REV;
        applyFrequencyDelta(deltaMHz, false);
      };

      const finishDrag = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", finishDrag);
        window.removeEventListener("pointercancel", finishDrag);
        dragCleanupRef.current = null;
        r3fTarget?.releasePointerCapture?.(e.pointerId);
        draggingRef.current = false;
        document.body.style.cursor = hoveredRef.current
          ? "grab"
          : powerHoveredRef.current || broadcastHoveredRef.current
            ? "pointer"
            : "auto";
        syncTuningVisuals(true);
      };

      dragCleanupRef.current = finishDrag;
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", finishDrag);
      window.addEventListener("pointercancel", finishDrag);
    };

    const handleTuningWheelScroll = (e: ThreeEvent<WheelEvent>) => {
      if (useCameraLookStore.getState().isFreeLookMode) return;
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
      const fine = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
      const stepMHz = (e.deltaY < 0 ? 1 : -1) * (fine ? 0.03 : 0.15);
      applyFrequencyDelta(stepMHz, false);

      if (wheelFlushTimerRef.current) {
        window.clearTimeout(wheelFlushTimerRef.current);
      }
      wheelFlushTimerRef.current = window.setTimeout(() => {
        wheelFlushTimerRef.current = 0;
        syncTuningVisuals(true);
      }, DIAL_REDRAW_INTERVAL_MS + 8);
    };

    return (
      <group
        position={[position[0], position[1], position[2]]}
        rotation={[rotation[0], rotation[1], rotation[2]]}
      >
        {/* ============================================================
            1. INDUSTRIAL SOVIET DUTY TABLE (`Столик дежурного`, 0.85m × 0.55m × 0.78m)
           ============================================================ */}
        <mesh
          geometry={geos.tableFrame}
          material={mats.oliveSteel}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          geometry={geos.frameBolts}
          material={mats.darkSteel}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        <mesh
          geometry={geos.tabletopTrim}
          material={mats.aluminum}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />

        {/* 4 Rubber Leveling Feet + Threaded Steel Stems */}
        {(
          [
            [-0.394, -0.244],
            [0.394, -0.244],
            [-0.394, 0.244],
            [0.394, 0.244],
          ] as const
        ).map(([fx, fz], idx) => (
          <group key={`foot-${idx}`} position={[fx, 0, fz]}>
            <mesh
              position={[0, 0.011, 0]}
              material={mats.rubberBlack}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.022, 0.026, 0.022, 10]} />
            </mesh>
            <mesh
              position={[0, 0.026, 0]}
              material={mats.darkSteel}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.008, 0.008, 0.014, 6]} />
            </mesh>
          </group>
        ))}

        {/* Worn Dark Walnut / Phenolic Laminate Tabletop (`top = y 0.780m`) */}
        <mesh
          position={[0, 0.764, 0]}
          material={mats.tabletopWood}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.85, 0.032, 0.55]} />
        </mesh>

        {/* Riveted Brass Inventory Tag (`ЗИП / ИНВ. № 84-19`) on Front Apron */}
        <group position={[-0.265, 0.706, 0.264]}>
          <mesh
            material={mats.brass}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.166, 0.048, 0.006]} />
          </mesh>
          <mesh position={[0, 0, 0.009]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.154, 0.038]} />
            <meshStandardMaterial
              map={textures.inventoryTag}
              roughness={0.44}
              metalness={0.28}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </group>

        {/* Slightly Ajar Utility Drawer (`Ящик дежурного`) + Visible Tools Inside */}
        <group position={[0.09, 0.692, 0.075]}>
          {/* Drawer Tray Box */}
          <mesh
            position={[0, -0.028, 0.04]}
            material={mats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.39, 0.008, 0.41]} />
          </mesh>
          <mesh
            position={[-0.191, 0, 0.04]}
            material={mats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.008, 0.056, 0.41]} />
          </mesh>
          <mesh
            position={[0.191, 0, 0.04]}
            material={mats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.008, 0.056, 0.41]} />
          </mesh>
          {/* Drawer Front Face (Pulled +0.068m proud of front apron) */}
          <mesh
            position={[0, 0, 0.25]}
            material={mats.oliveSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.418, 0.082, 0.016]} />
          </mesh>
          {/* Brushed-Aluminum Handle + Brass Keyhole */}
          <mesh
            position={[0, 0.004, 0.273]}
            material={mats.aluminum}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.125, 0.012, 0.012]} />
          </mesh>
          {([-0.052, 0.052] as const).map((hx, hIdx) => (
            <mesh
              key={`drw-lug-${hIdx}`}
              position={[hx, 0.004, 0.264]}
              material={mats.aluminum}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.012, 0.012, 0.014]} />
            </mesh>
          ))}
          <mesh
            position={[0, -0.022, 0.259]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.brass}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.005, 10]} />
          </mesh>
          {/* Visible Ajar Drawer Contents: ЗИП Box, Screwdriver & Paper Slip */}
          <mesh
            position={[-0.08, -0.012, 0.195]}
            rotation={[0, 0.14, 0]}
            material={mats.burgundyCloth}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.11, 0.026, 0.072]} />
          </mesh>
          <group position={[0.07, -0.016, 0.205]} rotation={[0, -0.25, 0]}>
            <mesh
              rotation={[Math.PI / 2, 0, 0]}
              material={mats.crimson}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.009, 0.009, 0.068, 8]} />
            </mesh>
            <mesh
              position={[0, 0, 0.058]}
              rotation={[Math.PI / 2, 0, 0]}
              material={mats.chrome}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.0025, 0.0025, 0.055, 6]} />
            </mesh>
          </group>
          <mesh
            position={[0.125, -0.022, 0.19]}
            rotation={[0, 0.1, 0]}
            material={mats.paper}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.07, 0.004, 0.08]} />
          </mesh>
        </group>

        {/* ============================================================
            LOWER SHELF PROPS (`y = 0.227m`)
           ============================================================ */}
        {/* A. Metallic Tea-Glass Holder (`Подстаканник`) + 10-Faceted Tea Glass */}
        <group position={[-0.23, 0.227, 0.06]} rotation={[0, 0.35, 0]}>
          <mesh
            position={[0, 0.004, 0]}
            material={mats.chrome}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.032, 0.038, 0.008, 14]} />
          </mesh>
          <mesh
            position={[0, 0.034, 0]}
            material={mats.brass}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.036, 0.034, 0.052, 14, 1, true]} />
          </mesh>
          <mesh
            position={[0, 0.06, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.chrome}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <torusGeometry args={[0.036, 0.003, 6, 16]} />
          </mesh>
          {/* Decorative C-Scroll Handle */}
          <mesh
            position={[0.044, 0.036, 0]}
            rotation={[0, 0, -Math.PI / 2]}
            material={mats.chrome}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <torusGeometry args={[0.022, 0.0035, 6, 12, Math.PI * 1.15]} />
          </mesh>
          {/* Faceted Tea Glass + Amber Tea + Teaspoon */}
          <mesh
            position={[0, 0.052, 0]}
            material={mats.glassCup}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.032, 0.027, 0.092, 10]} />
          </mesh>
          <mesh
            position={[0, 0.038, 0]}
            material={mats.teaLiquid}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.028, 0.024, 0.056, 10]} />
          </mesh>
          <mesh
            position={[-0.01, 0.066, 0.004]}
            rotation={[0.08, 0, 0.24]}
            material={mats.chrome}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.002, 0.002, 0.11, 6]} />
          </mesh>
        </group>

        {/* B. Battered Cardboard/Cloth Radio Logbook (`ЖУРНАЛ РАДИОЧАСТОТ`) */}
        <group position={[0.02, 0.227, 0.02]} rotation={[0, -0.18, 0]}>
          <mesh
            position={[0, 0.0025, 0]}
            material={mats.cardboard}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.232, 0.005, 0.172]} />
          </mesh>
          <mesh
            position={[0.004, 0.015, 0]}
            material={mats.paper}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.218, 0.02, 0.162]} />
          </mesh>
          <mesh
            position={[0, 0.0275, 0]}
            material={mats.cardboard}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.232, 0.005, 0.172]} />
          </mesh>
          <mesh
            position={[-0.105, 0.015, 0]}
            material={mats.burgundyCloth}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.026, 0.031, 0.174]} />
          </mesh>
          <mesh
            position={[0.03, 0.014, 0.094]}
            rotation={[0, 0.18, 0]}
            material={mats.crimson}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.012, 0.002, 0.036]} />
          </mesh>
          <mesh
            position={[0.006, 0.038, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <planeGeometry args={[0.216, 0.158]} />
            <meshStandardMaterial
              map={textures.logbookCover}
              roughness={0.82}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
        </group>

        {/* C. Heavy Cast-Metal Ashtray + Stubbed Papirosy */}
        <group position={[0.26, 0.227, 0.07]} rotation={[0, 0.44, 0]}>
          <mesh
            position={[0, 0.013, 0]}
            material={mats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.056, 0.062, 0.026, 8]} />
          </mesh>
          <mesh
            position={[0, 0.026, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <torusGeometry args={[0.048, 0.008, 6, 8]} />
          </mesh>
          <mesh
            position={[0, 0.023, 0]}
            material={mats.ashWell}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.042, 0.04, 0.006, 8]} />
          </mesh>
          <mesh
            position={[0.018, 0.029, 0.014]}
            rotation={[0.12, 0.5, Math.PI / 2]}
            material={mats.paper}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.0035, 0.0035, 0.042, 6]} />
          </mesh>
          <mesh
            position={[-0.014, 0.028, -0.01]}
            rotation={[-0.08, -0.7, Math.PI / 2]}
            material={mats.paper}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.0035, 0.0035, 0.036, 6]} />
          </mesh>
        </group>

        {/* Power Cord, Leg P-Clips & Wall Socket (`220В` on `+X` wainscot at `local z = -0.402`) */}
        <mesh
          geometry={geos.powerCord}
          material={mats.rubberBlack}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
        {([0.62, 0.36] as const).map((cy, cIdx) => (
          <mesh
            key={`cord-clip-${cIdx}`}
            position={[0.392, cy, -0.262]}
            material={mats.aluminum}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.022, 0.014, 0.018]} />
          </mesh>
        ))}
        <group position={[0.26, 0.33, -0.394]}>
          <mesh
            material={mats.bakelite}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.042, 0.046, 0.022, 14]} />
          </mesh>
          <mesh
            position={[0, 0, 0.018]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.rubberBlack}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.02, 0.022, 0.026, 12]} />
          </mesh>
          <mesh
            position={[0, -0.17, -0.006]}
            material={mats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.33, 8]} />
          </mesh>
        </group>

        {/* ============================================================
            2. VINTAGE SOVIET TABLETOP RADIO (`ОКЕАН-84 / ВЭФ` HYBRID RECEIVER)
           ============================================================ */}
        <group
          ref={radioUnitGroupRef}
          position={[-0.03, 0.78, 0.025]}
          rotation={[0, -0.18, 0]}
        >
          {/* 4 Rubber Feet */}
          {(
            [
              [-0.2, -0.072],
              [0.2, -0.072],
              [-0.2, 0.072],
              [0.2, 0.072],
            ] as const
          ).map(([rx, rz], idx) => (
            <mesh
              key={`rad-foot-${idx}`}
              position={[rx, 0.006, rz]}
              material={mats.rubberBlack}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.016, 0.018, 0.012, 10]} />
            </mesh>
          ))}

          {/* Dark Ribbed Bakelite Main Chassis + Rear Plate */}
          <mesh
            position={[0, 0.136, -0.004]}
            material={mats.bakelite}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.428, 0.242, 0.178]} />
          </mesh>

          {/* Two-Tone Dark Mahogany Veneer Side Cheeks & Top Cabinet Hood */}
          {([-0.227, 0.227] as const).map((mx, idx) => (
            <mesh
              key={`wood-cheek-${idx}`}
              position={[mx, 0.138, 0]}
              material={mats.mahogany}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.026, 0.252, 0.194]} />
            </mesh>
          ))}
          <mesh
            position={[0, 0.258, 0]}
            material={mats.mahogany}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.432, 0.016, 0.194]} />
          </mesh>

          {/* Folded Chrome Top Carry Handle (`Ручка переноски`) */}
          <group position={[0, 0.276, -0.02]}>
            {([-0.15, 0.15] as const).map((hx, idx) => (
              <mesh
                key={`hdl-post-${idx}`}
                position={[hx, -0.006, 0]}
                material={mats.chrome}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.014, 0.016, 0.018]} />
              </mesh>
            ))}
            <mesh
              position={[0, 0.002, -0.006]}
              material={mats.chrome}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.314, 0.009, 0.012]} />
            </mesh>
          </group>

          {/* Brushed Anodized Aluminum Perimeter Faceplate Bezel & Mid Rail */}
          <mesh
            position={[0, 0.247, 0.092]}
            material={mats.aluminum}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.428, 0.01, 0.018]} />
          </mesh>
          <mesh
            position={[0, 0.017, 0.092]}
            material={mats.aluminum}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.428, 0.01, 0.018]} />
          </mesh>
          {([-0.209, 0.209] as const).map((bx, idx) => (
            <mesh
              key={`fbez-v-${idx}`}
              position={[bx, 0.132, 0.092]}
              material={mats.aluminum}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.01, 0.22, 0.018]} />
            </mesh>
          ))}
          <mesh
            position={[-0.053, 0.149, 0.093]}
            material={mats.aluminum}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.302, 0.009, 0.016]} />
          </mesh>
          <mesh
            position={[0.108, 0.131, 0.093]}
            material={mats.aluminum}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.009, 0.222, 0.016]} />
          </mesh>

          {/* Dark Woven Cloth + Slotted Metallic Speaker Louver Grille */}
          <mesh
            position={[-0.066, 0.099, 0.088]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <planeGeometry args={[0.268, 0.094]} />
            <meshStandardMaterial
              map={textures.speakerCloth}
              roughness={0.86}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          <mesh
            geometry={geos.speakerGrille}
            material={mats.aluminum}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />

          {/* Raised Chrome & Red Soviet Model Badge (`ОКЕАН-84 // УКВ • КВ`) */}
          <group position={[-0.066, 0.114, 0.106]}>
            <mesh
              material={mats.chrome}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.156, 0.036, 0.006]} />
            </mesh>
            <mesh position={[0, 0, 0.009]} castShadow={false} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.146, 0.028]} />
              <meshStandardMaterial
                map={textures.modelBadge}
                roughness={0.38}
                metalness={0.2}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>

          {/* Interactive `СЕТЬ` Power Push-Switch + Decorative Band Push-Switches (`УКВ`, `КВ1`, `СВ`, `ДВ`) */}
          <mesh
            position={[-0.066, 0.043, 0.096]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <planeGeometry args={[0.244, 0.015]} />
            <meshStandardMaterial
              map={textures.bandLegend}
              roughness={0.45}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          <group
            onPointerOver={(e) => {
              e.stopPropagation();
              powerHoveredRef.current = true;
              if (!draggingRef.current) {
                document.body.style.cursor = "pointer";
              }
              useGameStore
                .getState()
                .setHoveredControlHint(
                  powerOnRef.current
                    ? "РАДИО «ОКЕАН-84» (СЕТЬ): Click to Power OFF Radio"
                    : "РАДИО «ОКЕАН-84» (СЕТЬ): Click to Power ON Radio",
                );
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              powerHoveredRef.current = false;
              if (!draggingRef.current) {
                document.body.style.cursor = hoveredRef.current
                  ? "grab"
                  : broadcastHoveredRef.current
                    ? "pointer"
                    : "auto";
              }
              useGameStore.getState().setHoveredControlHint(null);
            }}
            onPointerDown={handlePowerButtonPointerDown}
          >
            <mesh
              position={[-0.162, 0.027, 0.102]}
              material={mats.hitboxHidden}
              castShadow={false}
            >
              <boxGeometry args={[0.044, 0.026, 0.032]} />
            </mesh>
            <mesh
              ref={powerBtnMeshRef}
              position={[-0.162, 0.0235, 0.0965]}
              rotation={[0.19, 0, 0]}
              material={mats.crimson}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.038, 0.014, 0.022]} />
            </mesh>
          </group>
          {/* Interactive `ЭФИР` State Broadcast Push-Switch (Triggers / Advances `govorit_moskva` + `01`–`06`) */}
          <group
            onPointerOver={(e) => {
              e.stopPropagation();
              broadcastHoveredRef.current = true;
              if (!draggingRef.current) {
                document.body.style.cursor = "pointer";
              }
              useGameStore
                .getState()
                .setHoveredControlHint(
                  "РАДИО «ОКЕАН-84» (ЭФИР / СВОДКА): Click to Trigger / Skip State Broadcast",
                );
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              broadcastHoveredRef.current = false;
              if (!draggingRef.current) {
                document.body.style.cursor = hoveredRef.current
                  ? "grab"
                  : powerHoveredRef.current
                    ? "pointer"
                    : "auto";
              }
              useGameStore.getState().setHoveredControlHint(null);
            }}
            onPointerDown={handleBroadcastButtonPointerDown}
          >
            <mesh
              position={[-0.066, 0.027, 0.102]}
              material={mats.hitboxHidden}
              castShadow={false}
            >
              <boxGeometry args={[0.044, 0.026, 0.032]} />
            </mesh>
            <mesh
              ref={broadcastBtnMeshRef}
              position={[-0.066, 0.028, 0.103]}
              rotation={[0.06, 0, 0]}
              material={mats.ivoryKey}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.038, 0.014, 0.022]} />
            </mesh>
          </group>
          {([1, 3, 4] as const).map((kIdx) => {
            const kx = -0.162 + kIdx * 0.048;
            const isPressed = kIdx === 1;
            return (
              <mesh
                key={`band-key-${kIdx}`}
                position={[kx, isPressed ? 0.024 : 0.028, isPressed ? 0.097 : 0.103]}
                rotation={[isPressed ? 0.18 : 0.06, 0, 0]}
                material={mats.ivoryKey}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.038, 0.014, 0.022]} />
              </mesh>
            );
          })}

          {/* Decorative Non-Interactive Volume & Tone Knobs (Right Lower Bay) */}
          {([0.092, 0.046] as const).map((ky, kIdx) => (
            <group key={`mini-knob-${kIdx}`} position={[0.158, ky, 0.094]}>
              <mesh
                rotation={[Math.PI / 2, 0, 0]}
                material={mats.brass}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.02, 0.022, 0.006, 12]} />
              </mesh>
              <mesh
                position={[0, 0, 0.012]}
                rotation={[Math.PI / 2, 0, 0]}
                material={mats.bakelite}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.015, 0.017, 0.02, 12]} />
              </mesh>
              <mesh
                position={[0, 0, 0.023]}
                rotation={[Math.PI / 2, 0, 0]}
                material={mats.aluminum}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.011, 0.011, 0.004, 12]} />
              </mesh>
            </group>
          ))}

          {/* Segmented Chrome Telescoping Whip Antenna Leaning Toward Window Glass */}
          <group position={[-0.192, 0.264, -0.062]}>
            {/* Swivel knuckle collar */}
            <mesh
              material={mats.chrome}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.011, 0.013, 0.018, 10]} />
            </mesh>
            <group rotation={[-0.44, 0.08, 0.24]}>
              {(
                [
                  { y: 0.08, len: 0.16, r: 0.0055 },
                  { y: 0.22, len: 0.15, r: 0.0045 },
                  { y: 0.35, len: 0.14, r: 0.0036 },
                  { y: 0.47, len: 0.13, r: 0.0027 },
                  { y: 0.59, len: 0.13, r: 0.0019 },
                ] as const
              ).map((seg, sIdx) => (
                <group key={`ant-seg-${sIdx}`}>
                  <mesh
                    position={[0, seg.y, 0]}
                    material={mats.chrome}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <cylinderGeometry args={[seg.r * 0.9, seg.r, seg.len, 8]} />
                  </mesh>
                  <mesh
                    position={[0, seg.y + seg.len * 0.5, 0]}
                    material={mats.brass}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  >
                    <cylinderGeometry
                      args={[seg.r * 1.15, seg.r * 1.15, 0.008, 8]}
                    />
                  </mesh>
                </group>
              ))}
              <mesh
                position={[0, 0.66, 0]}
                material={mats.chrome}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <sphereGeometry args={[0.0065, 10, 8]} />
              </mesh>
            </group>
          </group>

          {/* ============================================================
              WARM BACKLIT GLASS TUNING DIAL + 6Е1П MAGIC EYE + 3D NEEDLE
              (Cleanly proud of z = 0.085 Bakelite front face, ZERO front glass cover,
               THREE.DoubleSide + toneMapped={false} + fog={false})
             ============================================================ */}
          {/* Dial aperture backing plate (`z = 0.088`, front face `z = 0.090`) */}
          <mesh
            position={[DIAL_CENTER_X, DIAL_CENTER_Y, 0.088]}
            material={mats.bakelite}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.304, 0.09, 0.004]} />
          </mesh>

          {/* Illuminated Amber Scale & Magic Eye CanvasTexture (`z = 0.095`) */}
          <mesh
            position={[DIAL_CENTER_X, DIAL_CENTER_Y, 0.095]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <planeGeometry args={[DIAL_PLANE_W, DIAL_PLANE_H]} />
            <meshBasicMaterial
              ref={dialMatRef}
              map={textures.dial}
              side={THREE.DoubleSide}
              toneMapped={false}
              fog={false}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Horizontal Brass Pulley Wire & End Rollers (`z = 0.101`) */}
          <mesh
            position={[
              (NEEDLE_MIN_X + NEEDLE_MAX_X) * 0.5,
              DIAL_CENTER_Y + 0.037,
              0.101,
            ]}
            rotation={[0, 0, Math.PI / 2]}
            material={mats.brass}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.0012, 0.0012, NEEDLE_MAX_X - NEEDLE_MIN_X + 0.016, 6]} />
          </mesh>
          {([NEEDLE_MIN_X - 0.008, NEEDLE_MAX_X + 0.008] as const).map(
            (px, pIdx) => (
              <mesh
                key={`pulley-${pIdx}`}
                position={[px, DIAL_CENTER_Y + 0.037, 0.101]}
                rotation={[Math.PI / 2, 0, 0]}
                material={mats.brass}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.004, 0.004, 0.004, 8]} />
              </mesh>
            ),
          )}

          {/* Physical 3D Red-Tipped Sliding Dial Needle (`z = 0.103`, +0.008m proud of dial scale) */}
          <group
            ref={needleGroupRef}
            position={[frequencyToNeedleX(INITIAL_FREQ_MHZ), DIAL_CENTER_Y, 0.103]}
          >
            {/* Brass top pulley carriage */}
            <mesh
              position={[0, 0.037, 0]}
              material={mats.brass}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.009, 0.007, 0.006]} />
            </mesh>
            {/* Cream needle stem */}
            <mesh
              position={[0, 0.005, 0]}
              material={mats.ivoryKey}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.003, 0.062, 0.003]} />
            </mesh>
            {/* Crimson glowing tip */}
            <mesh
              position={[0, -0.022, 0.001]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.0045, 0.022, 0.004]} />
              <meshStandardMaterial
                ref={needleTipMatRef}
                color="#ff2a2a"
                emissive="#ff2a2a"
                emissiveIntensity={0.65}
                roughness={0.35}
                metalness={0.1}
              />
            </mesh>
          </group>

          {/* ============================================================
              3. INTERACTIVE 3D KNURLED BAKELITE & BRASS TUNING WHEEL
              (Tuning wheel & СЕТЬ power button are the ONLY raycastable colliders!)
             ============================================================ */}
          <mesh
            position={[0.158, 0.114, 0.102]}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <planeGeometry args={[0.072, 0.018]} />
            <meshStandardMaterial
              map={textures.tuningLabel}
              roughness={0.45}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          <group
            position={[0.158, 0.172, 0.098]}
            onPointerOver={(e) => {
              e.stopPropagation();
              hoveredRef.current = true;
              if (!draggingRef.current) {
                document.body.style.cursor = "grab";
              }
              useGameStore
                .getState()
                .setHoveredControlHint(
                  "РАДИО «ОКЕАН-84» (НАСТРОЙКА УКВ): Drag Tuning Wheel or Scroll (66.00–74.00 МГц)",
                );
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              hoveredRef.current = false;
              if (!draggingRef.current) {
                document.body.style.cursor =
                  powerHoveredRef.current || broadcastHoveredRef.current
                    ? "pointer"
                    : "auto";
              }
              useGameStore.getState().setHoveredControlHint(null);
            }}
            onWheel={handleTuningWheelScroll}
            onPointerDown={handleTuningWheelPointerDown}
          >
            {/* Single Clean Raycast Hitbox Around Tuning Wheel */}
            <mesh
              position={[0, 0, 0.016]}
              rotation={[Math.PI / 2, 0, 0]}
              material={mats.hitboxHidden}
              castShadow={false}
            >
              <cylinderGeometry args={[0.056, 0.056, 0.056, 16]} />
            </mesh>

            {/* Stationary Brushed-Brass Collar */}
            <mesh
              rotation={[Math.PI / 2, 0, 0]}
              material={mats.brass}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.048, 0.05, 0.008, 20]} />
            </mesh>

            {/* Rotating Knurled Bakelite & Brass Tuning Wheel */}
            <group
              ref={wheelGroupRef}
              rotation={[0, 0, -INITIAL_WHEEL_ANGLE]}
            >
              <mesh
                position={[0, 0, 0.016]}
                rotation={[Math.PI / 2, 0, 0]}
                material={mats.bakelite}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.043, 0.045, 0.032, 20]} />
              </mesh>
              <mesh
                geometry={geos.wheelKnurls}
                material={mats.bakelite}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
              {/* Brushed-Brass Front Face Cap */}
              <mesh
                position={[0, 0, 0.033]}
                rotation={[Math.PI / 2, 0, 0]}
                material={mats.brass}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.031, 0.033, 0.004, 18]} />
              </mesh>
              {/* Recessed Finger Dimple & Prominent Pointer Bar */}
              <mesh
                position={[0, 0.019, 0.036]}
                rotation={[Math.PI / 2, 0, 0]}
                material={mats.darkSteel}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <cylinderGeometry args={[0.007, 0.007, 0.003, 10]} />
              </mesh>
              <mesh
                position={[0, 0.016, 0.037]}
                material={mats.crimson}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.005, 0.024, 0.004]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    );
  },
);
