import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import {
  getAudioContext as getInspectorAudioContext,
  playDetentClick,
  playKnifeSwitchSlam,
} from "../modules/inspector/audio";
import {
  getAudioContext as getReactorAudioContext,
  playSwitchClank,
} from "../modules/reactor/audioSynth";
import {
  airlockDoorState,
  triggerLobbyAmbientFadeIn,
} from "./airlockDoorState";
import { NOOP_RAYCAST } from "./ExteriorDioramas3D";
import { registerKremlinCanvasRedraw } from "./kremlinFontReady";
import { pointerLockInteraction } from "./pointerLockState";
import {
  getBrushedBrassTextures,
  getHammeredIronTextures,
  getWeatheredMahoganyTextures,
  getWornInspectionMatTextures,
} from "./proceduralMaterials";
import {
  computeSavedShiftRubles,
  readSavedShift,
  restoreSavedShiftFromStorage,
  startFreshShiftFromLobby,
  subscribeSavedShiftStorage,
  type SavedShiftSnapshot,
} from "./shiftSaveStorage";
import { useGameStore } from "./useGameStore";

const LOBBY_X_MIN = -3.8;
const LOBBY_X_MAX = 1.4;
const LOBBY_Z_MIN = 4.79;
const LOBBY_Z_MAX = 10.32;
const LOBBY_CEILING_Y = 4.2;
const LOBBY_WIDTH = LOBBY_X_MAX - LOBBY_X_MIN; // 5.20m
const LOBBY_DEPTH = LOBBY_Z_MAX - LOBBY_Z_MIN; // 5.53m
const LOBBY_CENTER_X = (LOBBY_X_MIN + LOBBY_X_MAX) * 0.5; // -1.20m
const LOBBY_CENTER_Z = (LOBBY_Z_MIN + LOBBY_Z_MAX) * 0.5; // +7.555m

interface LobbySharedGeos {
  hexBolt: THREE.CylinderGeometry;
  rivet: THREE.CylinderGeometry;
  pipeClamp: THREE.BoxGeometry;
  valveRim: THREE.TorusGeometry;
  valveSpoke: THREE.BoxGeometry;
  medalStar: THREE.ExtrudeGeometry;
  medalPentagonRibbon: THREE.ExtrudeGeometry;
  medalDisc: THREE.CylinderGeometry;
  medalInnerRing: THREE.TorusGeometry;
  medalOctagon: THREE.CylinderGeometry;
  coolingTowerLathe: THREE.LatheGeometry;
  atomOrbitRing: THREE.TorusGeometry;
  atomNucleus: THREE.SphereGeometry;
  atomElectron: THREE.SphereGeometry;
  ficusLeaf: THREE.ExtrudeGeometry;
  radiatorFinCol: THREE.CylinderGeometry;
  radiatorBoss: THREE.CylinderGeometry;
  scissorPicket: THREE.BoxGeometry;
  scissorDiagBar: THREE.BoxGeometry;
  scissorPivot: THREE.CylinderGeometry;
  crumpledPaper: THREE.IcosahedronGeometry;
  keyTag: THREE.BoxGeometry;
  keyRing: THREE.TorusGeometry;
  phoneCordLoop: THREE.TorusGeometry;
  dustMote: THREE.BoxGeometry;
  trofferDropRod: THREE.CylinderGeometry;
  trofferRose: THREE.CylinderGeometry;
  trofferEndCap: THREE.BoxGeometry;
  trofferSocket: THREE.BoxGeometry;
  trofferTube: THREE.CylinderGeometry;
  trofferCageRib: THREE.BoxGeometry;
}

let cachedLobbyGeos: LobbySharedGeos | null = null;

function getLobbySharedGeos(): LobbySharedGeos {
  if (cachedLobbyGeos) return cachedLobbyGeos;

  // 5-pointed faceted Soviet order star
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.032 : 0.0135;
    const ang = Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const medalStar = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.0018,
    bevelSegments: 1,
  });
  medalStar.center();

  // Traditional Soviet pentagonal ribbon mount
  const pentShape = new THREE.Shape();
  pentShape.moveTo(-0.022, 0.024);
  pentShape.lineTo(0.022, 0.024);
  pentShape.lineTo(0.02, -0.004);
  pentShape.lineTo(0, -0.022);
  pentShape.lineTo(-0.02, -0.004);
  pentShape.closePath();
  const medalPentagonRibbon = new THREE.ExtrudeGeometry(pentShape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0012,
    bevelSegments: 1,
  });
  medalPentagonRibbon.center();

  // Hyperbolic RBMK cooling tower silhouette via LatheGeometry
  const towerPts: THREE.Vector2[] = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.072, 0),
    new THREE.Vector2(0.068, 0.025),
    new THREE.Vector2(0.058, 0.06),
    new THREE.Vector2(0.048, 0.1),
    new THREE.Vector2(0.042, 0.145),
    new THREE.Vector2(0.046, 0.175),
    new THREE.Vector2(0.052, 0.195),
    new THREE.Vector2(0.045, 0.195),
    new THREE.Vector2(0.039, 0.165),
    new THREE.Vector2(0.001, 0.165),
  ];
  const coolingTowerLathe = new THREE.LatheGeometry(towerPts, 18);

  // Sculpted broad ovate Ficus Elastica leaf blade (origin at petiole base y = 0)
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.048, 0.035, 0.054, 0.135, 0.022, 0.205);
  leafShape.quadraticCurveTo(0.005, 0.238, 0, 0.252);
  leafShape.quadraticCurveTo(-0.005, 0.238, -0.022, 0.205);
  leafShape.bezierCurveTo(-0.054, 0.135, -0.048, 0.035, 0, 0);
  const ficusLeaf = new THREE.ExtrudeGeometry(leafShape, {
    depth: 0.0032,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 1,
    curveSegments: 10,
  });
  ficusLeaf.translate(0, 0, -0.0016);

  cachedLobbyGeos = {
    hexBolt: new THREE.CylinderGeometry(0.009, 0.009, 0.012, 6),
    rivet: new THREE.CylinderGeometry(0.0055, 0.0055, 0.008, 6),
    pipeClamp: new THREE.BoxGeometry(0.026, 0.14, 0.026),
    valveRim: new THREE.TorusGeometry(0.088, 0.012, 6, 14),
    valveSpoke: new THREE.BoxGeometry(0.165, 0.011, 0.009),
    medalStar,
    medalPentagonRibbon,
    medalDisc: new THREE.CylinderGeometry(0.027, 0.027, 0.008, 16),
    medalInnerRing: new THREE.TorusGeometry(0.02, 0.003, 6, 16),
    medalOctagon: new THREE.CylinderGeometry(0.03, 0.03, 0.008, 8),
    coolingTowerLathe,
    atomOrbitRing: new THREE.TorusGeometry(0.068, 0.005, 6, 20),
    atomNucleus: new THREE.SphereGeometry(0.017, 10, 10),
    atomElectron: new THREE.SphereGeometry(0.0065, 6, 6),
    ficusLeaf,
    radiatorFinCol: new THREE.CylinderGeometry(0.02, 0.02, 0.56, 8),
    radiatorBoss: new THREE.CylinderGeometry(0.026, 0.026, 0.044, 8),
    scissorPicket: new THREE.BoxGeometry(0.016, 2.34, 0.016),
    scissorDiagBar: new THREE.BoxGeometry(0.011, 0.36, 0.007),
    scissorPivot: new THREE.CylinderGeometry(0.006, 0.006, 0.013, 6),
    crumpledPaper: new THREE.IcosahedronGeometry(0.038, 0),
    keyTag: new THREE.BoxGeometry(0.022, 0.04, 0.005),
    keyRing: new THREE.TorusGeometry(0.009, 0.0022, 5, 10),
    phoneCordLoop: new THREE.TorusGeometry(0.011, 0.0032, 5, 10),
    dustMote: new THREE.BoxGeometry(0.006, 0.006, 0.006),
    trofferDropRod: new THREE.CylinderGeometry(0.01, 0.01, 0.25, 8),
    trofferRose: new THREE.CylinderGeometry(0.036, 0.044, 0.022, 10),
    trofferEndCap: new THREE.BoxGeometry(0.028, 0.11, 0.34),
    trofferSocket: new THREE.BoxGeometry(0.024, 0.042, 0.04),
    trofferTube: new THREE.CylinderGeometry(0.02, 0.02, 1.18, 12),
    trofferCageRib: new THREE.BoxGeometry(0.012, 0.042, 0.3),
  };
  return cachedLobbyGeos;
}

function seededNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function createNearestCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    draw(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  registerKremlinCanvasRedraw(canvas, tex, (drawCtx, w, h) => {
    drawCtx.imageSmoothingEnabled = false;
    draw(drawCtx, w, h);
  });
  return tex;
}

function wrapLobbyText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawFivePointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(ang) * r;
    const py = cy + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawRadiationTrefoil(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR * 0.65, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 3 - Math.PI / 6;
    const a1 = a0 + Math.PI / 3;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, a0, a1);
    ctx.arc(cx, cy, innerR, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
}

function applyPosterWeathering(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
): void {
  // Subtle ordered pixel-grain & vintage paper foxing
  for (let i = 0; i < 950; i++) {
    const px = Math.floor(seededNoise(i, 1, seed) * w);
    const py = Math.floor(seededNoise(i, 2, seed) * h);
    const sz = i % 5 === 0 ? 3 : 2;
    ctx.fillStyle =
      i % 3 === 0 ? "rgba(28, 22, 16, 0.14)" : "rgba(245, 236, 208, 0.12)";
    ctx.fillRect(px, py, sz, sz);
  }
  // Horizontal fold crease across center + subtle vertical fold line
  ctx.fillStyle = "rgba(32, 24, 16, 0.18)";
  ctx.fillRect(0, Math.floor(h * 0.5) - 1, w, 2);
  ctx.fillStyle = "rgba(255, 248, 226, 0.14)";
  ctx.fillRect(0, Math.floor(h * 0.5) + 1, w, 2);
  // Subtle tea-stain / edge vignette around corners
  const vig = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    w * 0.28,
    w * 0.5,
    h * 0.5,
    h * 0.62,
  );
  vig.addColorStop(0, "rgba(40, 28, 16, 0)");
  vig.addColorStop(1, "rgba(38, 26, 14, 0.34)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  // Dog-eared top-right corner crease highlight
  ctx.fillStyle = "rgba(20, 18, 14, 0.26)";
  ctx.beginPath();
  ctx.moveTo(w - 28, 0);
  ctx.lineTo(w, 28);
  ctx.lineTo(w - 22, 22);
  ctx.closePath();
  ctx.fill();
}

const DUST_MOTE_SEEDS = [
  { baseX: 0.78, baseY: 1.18, baseZ: 6.52, speed: 0.42, phase: 0.4 },
  { baseX: 0.96, baseY: 1.32, baseZ: 6.76, speed: 0.51, phase: 1.9 },
  { baseX: 0.72, baseY: 1.05, baseZ: 7.05, speed: 0.38, phase: 3.1 },
  { baseX: -2.95, baseY: 1.65, baseZ: 7.12, speed: 0.46, phase: 2.4 },
  { baseX: -3.08, baseY: 1.92, baseZ: 7.55, speed: 0.49, phase: 4.2 },
  { baseX: -2.85, baseY: 1.52, baseZ: 7.88, speed: 0.41, phase: 5.3 },
] as const;

const FICUS_LEAF_LAYOUT = [
  { pos: [0.02, 0.18, 0.02] as const, rot: [0.85, 0.3, 0.12] as const, scale: 0.92 },
  { pos: [-0.03, 0.26, -0.02] as const, rot: [0.78, 2.35, -0.08] as const, scale: 1.0 },
  { pos: [0.03, 0.33, -0.03] as const, rot: [0.82, 4.1, 0.06] as const, scale: 0.96 },
  { pos: [-0.08, 0.44, 0.04] as const, rot: [0.75, 0.95, 0.14] as const, scale: 1.06 },
  { pos: [0.09, 0.48, 0.03] as const, rot: [0.88, -0.65, -0.1] as const, scale: 1.02 },
  { pos: [-0.06, 0.56, -0.07] as const, rot: [0.72, 3.05, 0.08] as const, scale: 1.08 },
  { pos: [0.07, 0.64, -0.06] as const, rot: [0.7, 5.1, -0.12] as const, scale: 0.95 },
  { pos: [-0.09, 0.72, 0.02] as const, rot: [0.64, 1.7, 0.1] as const, scale: 0.94 },
  { pos: [0.1, 0.76, 0.01] as const, rot: [0.68, -1.35, -0.08] as const, scale: 0.98 },
  { pos: [-0.02, 0.84, 0.06] as const, rot: [0.58, 0.15, 0.04] as const, scale: 0.9 },
  { pos: [0.03, 0.91, -0.04] as const, rot: [0.54, 3.6, -0.06] as const, scale: 0.88 },
  { pos: [-0.05, 0.97, -0.02] as const, rot: [0.46, 2.1, 0.08] as const, scale: 0.82 },
  { pos: [0.05, 1.02, 0.03] as const, rot: [0.44, -0.35, -0.06] as const, scale: 0.78 },
  { pos: [-0.01, 1.08, 0.01] as const, rot: [0.28, 4.7, 0.05] as const, scale: 0.68 },
  { pos: [0.01, 1.12, -0.01] as const, rot: [0.18, 1.1, -0.04] as const, scale: 0.6 },
] as const;

const LOBBY_MENU_FADE_DURATION_SEC = 1.6;

function drawTerminalCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  arm: number,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(x, y + arm);
  ctx.lineTo(x, y);
  ctx.lineTo(x + arm, y);
  // Top-right
  ctx.moveTo(x + w - arm, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + arm);
  // Bottom-left
  ctx.moveTo(x, y + h - arm);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + arm, y + h);
  // Bottom-right
  ctx.moveTo(x + w - arm, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - arm);
  ctx.stroke();
}

const LobbyDiegeticMenu3D: React.FC = React.memo(() => {
  const lobbyMenuPhase = useGameStore((s) => s.lobbyMenuPhase);
  const shiftRunId = useGameStore((s) => s.shiftRunId);
  const savedShift = useSyncExternalStore<SavedShiftSnapshot | null>(
    subscribeSavedShiftStorage,
    readSavedShift,
    () => null,
  );
  const [fadedRunId, setFadedRunId] = useState<number | null>(null);
  const menuDismissed =
    lobbyMenuPhase === "entered_control_room" ||
    (lobbyMenuPhase === "door_opening" && fadedRunId === shiftRunId);

  const rootGroupRef = useRef<THREE.Group>(null);
  const headerGroupRef = useRef<THREE.Group>(null);
  const newShiftGroupRef = useRef<THREE.Group>(null);
  const resumeGroupRef = useRef<THREE.Group>(null);
  const hintGroupRef = useRef<THREE.Group>(null);

  const headerFrameMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const headerFaceMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const newShiftFrameMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const newShiftFaceMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const resumeFrameMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const resumeFaceMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const hintFrameMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const hintFaceMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const hoveredBtnRef = useRef<"new" | "resume" | null>(null);
  const clickedRef = useRef<boolean>(false);
  const dismissedRef = useRef<boolean>(false);
  const fadeElapsedRef = useRef<number>(0);
  const newHoverBlendRef = useRef<number>(0);
  const resumeHoverBlendRef = useRef<number>(0);

  const hasSavedShift = savedShift !== null;

  const menuTextures = useMemo(() => {
    const titleTex = createNearestCanvasTexture(768, 160, (ctx, w, h) => {
      ctx.fillStyle = "#061a0c";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(51, 255, 102, 0.05)";
      for (let sy = 0; sy < h; sy += 4) {
        ctx.fillRect(0, sy, w, 1);
      }
      ctx.strokeStyle = "#2b6b3e";
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      drawTerminalCornerBrackets(ctx, 10, 10, w - 20, h - 20, 22, "#ffb000", 4);

      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 20px "VT323", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText(
        "★  SECTOR 84 NIGHT SHIFT // RBMK-1000 CONTROL BUNKER  ★",
        w / 2,
        40,
        w - 48,
      );

      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 46px "Kremlin", "Courier Prime", monospace';
      ctx.fillText("MELTDOWN IS PROPAGANDA", w / 2, 102, w - 40);

      ctx.fillStyle = "#33ff66";
      ctx.font = 'bold 18px "VT323", "Courier Prime", monospace';
      ctx.fillText(
        "MINISTRY OF ATOMIC ENERGY & HEAVY INDUSTRY — 1984",
        w / 2,
        138,
        w - 48,
      );
    });

    const newShiftTex = createNearestCanvasTexture(512, 224, (ctx, w, h) => {
      ctx.fillStyle = "#061a0c";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(51, 255, 102, 0.065)";
      for (let sy = 0; sy < h; sy += 4) {
        ctx.fillRect(0, sy, w, 1);
      }
      ctx.fillStyle = "#10351c";
      ctx.fillRect(10, 10, w - 20, 34);
      ctx.strokeStyle = "#33ff66";
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      drawTerminalCornerBrackets(ctx, 12, 12, w - 24, h - 24, 24, "#33ff66", 3);

      ctx.fillStyle = "#33ff66";
      ctx.font = 'bold 20px "VT323", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("PROTOCOL 01 // FRESH ASSIGNMENT", w / 2, 34, w - 36);

      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 42px "Kremlin", "Courier Prime", monospace';
      ctx.fillText("[ NEW SHIFT ]", w / 2, 118, w - 32);

      ctx.fillStyle = "#33ff66";
      ctx.font = 'bold 24px "VT323", "Courier Prime", monospace';
      ctx.fillText("COLD START • 25% BATTERY • 00:00", w / 2, 176, w - 32);
    });

    const resumeTex = createNearestCanvasTexture(512, 224, (ctx, w, h) => {
      if (savedShift) {
        const totalMins = Math.floor(
          Math.max(0, Math.min(360, savedShift.game.shiftTimeMinutes)),
        );
        const hh = String(Math.floor(totalMins / 60)).padStart(2, "0");
        const mm = String(totalMins % 60).padStart(2, "0");
        const rubles = computeSavedShiftRubles(savedShift);

        ctx.fillStyle = "#141007";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255, 176, 0, 0.06)";
        for (let sy = 0; sy < h; sy += 4) {
          ctx.fillRect(0, sy, w, 1);
        }
        ctx.fillStyle = "#2b1d08";
        ctx.fillRect(10, 10, w - 20, 34);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        drawTerminalCornerBrackets(ctx, 12, 12, w - 24, h - 24, 24, "#ffb000", 3);

        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 20px "VT323", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("PROTOCOL 02 // ARCHIVED CHECKPOINT", w / 2, 34, w - 36);

        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 40px "Kremlin", "Courier Prime", monospace';
        ctx.fillText("[ RESUME DUTY ]", w / 2, 118, w - 32);

        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 24px "VT323", "Courier Prime", monospace';
        ctx.fillText(
          `SHIFT ${savedShift.game.shiftNumber} • ${hh}:${mm} • ${rubles} RUB`,
          w / 2,
          176,
          w - 32,
        );
      } else {
        ctx.fillStyle = "#111412";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(180, 190, 182, 0.03)";
        for (let sy = 0; sy < h; sy += 4) {
          ctx.fillRect(0, sy, w, 1);
        }
        ctx.fillStyle = "#1a201c";
        ctx.fillRect(10, 10, w - 20, 34);
        ctx.strokeStyle = "#48544c";
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, w - 8, h - 8);

        ctx.fillStyle = "#6f7d74";
        ctx.font = 'bold 20px "VT323", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("PROTOCOL 02 // ARCHIVE SEALED", w / 2, 34, w - 36);

        ctx.fillStyle = "#7e8a82";
        ctx.font = 'bold 38px "Kremlin", "Courier Prime", monospace';
        ctx.fillText("[ RESUME DUTY ]", w / 2, 118, w - 32);

        ctx.fillStyle = "#68736c";
        ctx.font = 'bold 24px "VT323", "Courier Prime", monospace';
        ctx.fillText("— NO RECORD —", w / 2, 176, w - 32);
      }
    });

    const hintTex = createNearestCanvasTexture(640, 64, (ctx, w, h) => {
      ctx.fillStyle = "#08120c";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#2b5239";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#9fd8b0";
      ctx.font = 'bold 24px "VT323", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText(
        "[ CLICK PANEL TO BEGIN  •  WASD WALK  •  MOUSE LOOK ]",
        w / 2,
        40,
        w - 24,
      );
    });

    return { titleTex, newShiftTex, resumeTex, hintTex };
  }, [savedShift]);

  useEffect(() => {
    return () => {
      if (hoveredBtnRef.current !== null) {
        document.body.style.cursor = "auto";
      }
      menuTextures.titleTex.dispose();
      menuTextures.newShiftTex.dispose();
      menuTextures.resumeTex.dispose();
      menuTextures.hintTex.dispose();
    };
  }, [menuTextures]);

  useEffect(() => {
    if (lobbyMenuPhase !== "menu_locked") return;
    clickedRef.current = false;
    dismissedRef.current = false;
    fadeElapsedRef.current = 0;
    hoveredBtnRef.current = null;
    newHoverBlendRef.current = 0;
    resumeHoverBlendRef.current = 0;
    if (rootGroupRef.current) {
      rootGroupRef.current.visible = true;
      rootGroupRef.current.position.y = 0;
    }
  }, [lobbyMenuPhase, shiftRunId]);

  useEffect(() => {
    if (lobbyMenuPhase !== "door_opening") return;
    const targetRunId = shiftRunId;
    const timer = window.setTimeout(() => {
      setFadedRunId(targetRunId);
    }, Math.ceil(LOBBY_MENU_FADE_DURATION_SEC * 1000) + 50);
    return () => window.clearTimeout(timer);
  }, [lobbyMenuPhase, shiftRunId]);

  useFrame(({ clock }, delta) => {
    if (menuDismissed) return;
    const dt = Math.min(0.1, delta);
    const t = clock.elapsedTime;
    const gs = useGameStore.getState();

    if (gs.lobbyMenuPhase === "entered_control_room") {
      return;
    }

    const isFading = gs.lobbyMenuPhase === "door_opening";
    let fadeAlpha = 1;
    let fadeT = 0;
    if (isFading) {
      fadeElapsedRef.current += dt;
      fadeT = Math.min(1, fadeElapsedRef.current / LOBBY_MENU_FADE_DURATION_SEC);
      const smooth = fadeT * fadeT * (3 - 2 * fadeT);
      fadeAlpha = 1 - smooth;
      if (fadeT >= 1) {
        if (!dismissedRef.current) {
          dismissedRef.current = true;
          if (rootGroupRef.current) {
            rootGroupRef.current.visible = false;
          }
        }
        return;
      }
    }

    if (rootGroupRef.current) {
      rootGroupRef.current.position.y = fadeT * 0.05;
    }

    // Subtle idle vertical hover drift
    if (headerGroupRef.current) {
      headerGroupRef.current.position.y = 2.02 + Math.sin(t * 1.4) * 0.011;
    }
    if (hintGroupRef.current) {
      hintGroupRef.current.position.y = 1.24 + Math.sin(t * 1.3 + 1.2) * 0.008;
    }

    const newTargetHover =
      !isFading && hoveredBtnRef.current === "new" ? 1 : 0;
    const resumeTargetHover =
      !isFading && hasSavedShift && hoveredBtnRef.current === "resume" ? 1 : 0;

    newHoverBlendRef.current = THREE.MathUtils.damp(
      newHoverBlendRef.current,
      newTargetHover,
      14,
      dt,
    );
    resumeHoverBlendRef.current = THREE.MathUtils.damp(
      resumeHoverBlendRef.current,
      resumeTargetHover,
      14,
      dt,
    );

    const nh = newHoverBlendRef.current;
    if (newShiftGroupRef.current) {
      newShiftGroupRef.current.position.y = 1.56 + Math.sin(t * 1.7) * 0.013;
      newShiftGroupRef.current.position.z = nh * 0.036;
      const sc = 1 + nh * 0.055;
      newShiftGroupRef.current.scale.set(sc, sc, 1);
    }

    const rh = resumeHoverBlendRef.current;
    if (resumeGroupRef.current) {
      resumeGroupRef.current.position.y =
        1.56 + Math.sin(t * 1.7 + 0.85) * 0.013;
      resumeGroupRef.current.position.z = rh * 0.036;
      const sc = 1 + rh * 0.055;
      resumeGroupRef.current.scale.set(sc, sc, 1);
    }

    // Smooth opacity + emissive dissolve across all 3D menu surfaces
    if (headerFrameMatRef.current) {
      headerFrameMatRef.current.opacity = 0.94 * fadeAlpha;
    }
    if (headerFaceMatRef.current) {
      headerFaceMatRef.current.opacity = fadeAlpha;
      headerFaceMatRef.current.emissiveIntensity = 0.95 * fadeAlpha;
    }
    if (newShiftFrameMatRef.current) {
      newShiftFrameMatRef.current.opacity = 0.94 * fadeAlpha;
      newShiftFrameMatRef.current.emissiveIntensity = (0.12 + nh * 0.35) * fadeAlpha;
    }
    if (newShiftFaceMatRef.current) {
      newShiftFaceMatRef.current.opacity = fadeAlpha;
      newShiftFaceMatRef.current.emissiveIntensity = (0.88 + nh * 0.6) * fadeAlpha;
    }
    if (resumeFrameMatRef.current) {
      resumeFrameMatRef.current.opacity = (hasSavedShift ? 0.94 : 0.72) * fadeAlpha;
      resumeFrameMatRef.current.emissiveIntensity =
        (hasSavedShift ? 0.1 + rh * 0.35 : 0.02) * fadeAlpha;
    }
    if (resumeFaceMatRef.current) {
      resumeFaceMatRef.current.opacity = (hasSavedShift ? 1 : 0.56) * fadeAlpha;
      resumeFaceMatRef.current.emissiveIntensity =
        (hasSavedShift ? 0.85 + rh * 0.6 : 0.25) * fadeAlpha;
    }
    if (hintFrameMatRef.current) {
      hintFrameMatRef.current.opacity = 0.88 * fadeAlpha;
    }
    if (hintFaceMatRef.current) {
      hintFaceMatRef.current.opacity = 0.92 * fadeAlpha;
      hintFaceMatRef.current.emissiveIntensity = 0.75 * fadeAlpha;
    }
  });

  if (menuDismissed) {
    return null;
  }

  const handleButtonHover = (
    btn: "new" | "resume",
    over: boolean,
    e: ThreeEvent<PointerEvent>,
  ) => {
    e.stopPropagation();
    if (
      clickedRef.current ||
      pointerLockInteraction.mainMenuOpen ||
      useGameStore.getState().lobbyMenuPhase !== "menu_locked"
    ) {
      return;
    }
    if (btn === "resume" && !hasSavedShift) {
      return;
    }
    if (over) {
      if (hoveredBtnRef.current !== btn) {
        hoveredBtnRef.current = btn;
        playDetentClick();
      }
      document.body.style.cursor = "pointer";
    } else if (hoveredBtnRef.current === btn) {
      hoveredBtnRef.current = null;
      document.body.style.cursor = "auto";
    }
  };

  const handleButtonClick = (
    btn: "new" | "resume",
    e: ThreeEvent<MouseEvent>,
  ) => {
    e.stopPropagation();
    if (
      clickedRef.current ||
      pointerLockInteraction.mainMenuOpen ||
      useGameStore.getState().lobbyMenuPhase !== "menu_locked"
    ) {
      return;
    }

    const reactorAudio = getReactorAudioContext();
    if (reactorAudio && reactorAudio.state === "suspended") {
      void reactorAudio.resume().catch(() => {});
    }
    const inspectorAudio = getInspectorAudioContext();
    if (inspectorAudio && inspectorAudio.state === "suspended") {
      void inspectorAudio.resume().catch(() => {});
    }

    if (btn === "resume" && !savedShift) {
      playSwitchClank(false);
      return;
    }

    clickedRef.current = true;
    hoveredBtnRef.current = null;
    document.body.style.cursor = "auto";
    fadeElapsedRef.current = 0;

    playKnifeSwitchSlam(true);
    playSwitchClank(true);

    airlockDoorState.menuUnlockElapsed = 0;
    airlockDoorState.wantOpen = false;

    if (btn === "new") {
      startFreshShiftFromLobby();
    } else if (savedShift) {
      restoreSavedShiftFromStorage(savedShift);
    }

    triggerLobbyAmbientFadeIn();

    try {
      const canvas = document.querySelector("canvas");
      if (canvas && document.pointerLockElement !== canvas) {
        const req = canvas.requestPointerLock?.() as Promise<void> | undefined;
        req?.catch?.(() => {
          // Ignore rejected pointer lock promises if browser blocks lock
        });
      }
    } catch {
      // Ignore security exceptions when calling requestPointerLock
    }
  };

  return (
    <group ref={rootGroupRef} position={[0, 0, 5.36]}>
      {/* Title Header Floating 3D CRT Plate */}
      <group ref={headerGroupRef} position={[0, 2.02, 0]}>
        <mesh castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.68, 0.36, 0.024]} />
          <meshStandardMaterial
            ref={headerFrameMatRef}
            color="#141414"
            roughness={0.55}
            metalness={0.45}
            transparent
            opacity={0.94}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.015]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[1.64, 0.32]} />
          <meshStandardMaterial
            ref={headerFaceMatRef}
            map={menuTextures.titleTex}
            emissive="#ffffff"
            emissiveMap={menuTextures.titleTex}
            emissiveIntensity={0.95}
            roughness={0.35}
            transparent
            opacity={1}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* Button 1: [ NEW SHIFT ] */}
      <group
        ref={newShiftGroupRef}
        position={[-0.45, 1.56, 0]}
        onPointerOver={(e) => handleButtonHover("new", true, e)}
        onPointerOut={(e) => handleButtonHover("new", false, e)}
        onClick={(e) => handleButtonClick("new", e)}
      >
        <mesh castShadow={false}>
          <boxGeometry args={[0.84, 0.38, 0.026]} />
          <meshStandardMaterial
            ref={newShiftFrameMatRef}
            color="#141c17"
            emissive="#33ff66"
            emissiveIntensity={0.12}
            roughness={0.48}
            metalness={0.42}
            transparent
            opacity={0.94}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.016]} castShadow={false}>
          <planeGeometry args={[0.8, 0.34]} />
          <meshStandardMaterial
            ref={newShiftFaceMatRef}
            map={menuTextures.newShiftTex}
            emissive="#ffffff"
            emissiveMap={menuTextures.newShiftTex}
            emissiveIntensity={0.88}
            roughness={0.32}
            transparent
            opacity={1}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* Button 2: [ RESUME DUTY ] */}
      <group
        ref={resumeGroupRef}
        position={[0.45, 1.56, 0]}
        onPointerOver={(e) => handleButtonHover("resume", true, e)}
        onPointerOut={(e) => handleButtonHover("resume", false, e)}
        onClick={(e) => handleButtonClick("resume", e)}
      >
        <mesh castShadow={false}>
          <boxGeometry args={[0.84, 0.38, 0.026]} />
          <meshStandardMaterial
            ref={resumeFrameMatRef}
            color={hasSavedShift ? "#1f1810" : "#151715"}
            emissive={hasSavedShift ? "#ffb000" : "#222622"}
            emissiveIntensity={hasSavedShift ? 0.1 : 0.02}
            roughness={0.48}
            metalness={0.42}
            transparent
            opacity={hasSavedShift ? 0.94 : 0.72}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.016]} castShadow={false}>
          <planeGeometry args={[0.8, 0.34]} />
          <meshStandardMaterial
            ref={resumeFaceMatRef}
            map={menuTextures.resumeTex}
            emissive="#ffffff"
            emissiveMap={menuTextures.resumeTex}
            emissiveIntensity={hasSavedShift ? 0.85 : 0.25}
            roughness={0.32}
            transparent
            opacity={hasSavedShift ? 1 : 0.56}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>

      {/* Subtle Diegetic Control Prompt Strip */}
      <group ref={hintGroupRef} position={[0, 1.24, 0]}>
        <mesh castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.44, 0.12, 0.018]} />
          <meshStandardMaterial
            ref={hintFrameMatRef}
            color="#101512"
            roughness={0.62}
            metalness={0.3}
            transparent
            opacity={0.88}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.012]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[1.4, 0.1]} />
          <meshStandardMaterial
            ref={hintFaceMatRef}
            map={menuTextures.hintTex}
            emissive="#ffffff"
            emissiveMap={menuTextures.hintTex}
            emissiveIntensity={0.75}
            roughness={0.35}
            transparent
            opacity={0.92}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      </group>
    </group>
  );
});

export const McrLobbyRoom3D: React.FC = React.memo(() => {
  const ceilingNorthLightRef = useRef<THREE.PointLight>(null);
  const ceilingSouthLightRef = useRef<THREE.PointLight>(null);
  const cabinetLightRef = useRef<THREE.PointLight>(null);
  const deskLampLightRef = useRef<THREE.PointLight>(null);
  const elevatorRubyLightRef = useRef<THREE.PointLight>(null);
  const airlockSignLightRef = useRef<THREE.PointLight>(null);
  const lobbyFillLightRef = useRef<THREE.PointLight>(null);
  const controlRoomLitBlendRef = useRef(0);
  const wasLobbySealedRef = useRef(false);
  const deskLampBulbMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const deskLampShadeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const elevatorBusyLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const elevatorDialNeedleRef = useRef<THREE.Group>(null);
  const exteriorSconceMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const cigaretteEmberMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const trofferTubeMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const dustMoteRefs = useRef<Array<THREE.Mesh | null>>([]);

  const geos = useMemo(() => getLobbySharedGeos(), []);

  const textures = useMemo(() => {
    const linoleum = createNearestCanvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = "#5c3424";
      ctx.fillRect(0, 0, w, h);
      const half = w / 2;
      ctx.fillStyle = "#8a4830";
      ctx.fillRect(0, 0, half, half);
      ctx.fillRect(half, half, half, half);
      ctx.fillStyle = "#34403e";
      ctx.fillRect(half, 0, half, half);
      ctx.fillRect(0, half, half, half);
      ctx.fillStyle = "#763c27";
      ctx.fillRect(4, 4, half - 8, half - 8);
      ctx.fillRect(half + 4, half + 4, half - 8, half - 8);
      ctx.fillStyle = "#2b3534";
      ctx.fillRect(half + 4, 4, half - 8, half - 8);
      ctx.fillRect(4, half + 4, half - 8, half - 8);
      for (let i = 0; i < 64; i++) {
        const fx = ((i * 31 + 7) % (w - 6)) + 3;
        const fy = ((i * 47 + 13) % (h - 6)) + 3;
        ctx.fillStyle = i % 3 === 0 ? "#c89668" : "#1c201e";
        ctx.fillRect(fx, fy, 2, 2);
      }
      ctx.strokeStyle = "#1b1e1c";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(half, 0);
      ctx.lineTo(half, h);
      ctx.moveTo(0, half);
      ctx.lineTo(w, half);
      ctx.stroke();
    });
    linoleum.wrapS = THREE.RepeatWrapping;
    linoleum.wrapT = THREE.RepeatWrapping;
    linoleum.repeat.set(5, 6);

    const wainscot = createNearestCanvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = "#31463b";
      ctx.fillRect(0, 0, w, h);
      // Horizontal brush & roller texture
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 4) {
          const n = seededNoise(x, y, 21);
          if (n > 0.72) {
            ctx.fillStyle = "#3b5246";
            ctx.fillRect(x, y, 4, 2);
          } else if (n < 0.24) {
            ctx.fillStyle = "#26382f";
            ctx.fillRect(x, y, 4, 2);
          }
        }
      }
      // Subtle peeling paint & exposed damp plaster near bottom skirting
      for (let p = 0; p < 14; p++) {
        const px = 12 + Math.floor(seededNoise(p, 3, 55) * (w - 28));
        const py = h - 10 - Math.floor(seededNoise(p, 7, 55) * 28);
        const pw = 8 + Math.floor(seededNoise(p, 9, 55) * 14);
        const ph = 4 + Math.floor(seededNoise(p, 11, 55) * 9);
        ctx.fillStyle = "#1c2822";
        ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
        ctx.fillStyle = "#6e7266";
        ctx.fillRect(px, py, pw, ph);
      }
      // Moisture drip streaks from chair rail
      for (let sx = 18; sx < w; sx += 38) {
        ctx.fillStyle = "rgba(18, 28, 22, 0.35)";
        ctx.fillRect(sx, 0, 2, 16 + (sx % 24));
      }
      ctx.strokeStyle = "#22312a";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    });
    wainscot.wrapS = THREE.RepeatWrapping;
    wainscot.wrapT = THREE.RepeatWrapping;
    wainscot.repeat.set(4, 1);

    const upperPlaster = createNearestCanvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = "#8a8e82";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#6e7368";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
      ctx.fillStyle = "#61665d";
      for (let x = 8; x < w - 4; x += 8) {
        for (let y = 8; y < h - 4; y += 8) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    });
    upperPlaster.wrapS = THREE.RepeatWrapping;
    upperPlaster.wrapT = THREE.RepeatWrapping;
    upperPlaster.repeat.set(8, 3);

    const exteriorConcrete = createNearestCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#454c4d";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#3a4142";
      ctx.fillRect(4, 4, 120, 120);
      ctx.fillRect(132, 132, 120, 120);
      ctx.fillStyle = "#4b5354";
      ctx.fillRect(132, 4, 120, 120);
      ctx.fillRect(4, 132, 120, 120);
      for (let i = 0; i < 420; i++) {
        const px = (i * 53 + 17) % w;
        const py = (i * 97 + 29) % h;
        ctx.fillStyle =
          i % 5 === 0 ? "#5a6466" : i % 7 === 0 ? "#2e3435" : "#383f40";
        ctx.fillRect(px, py, 3, 2);
      }
      for (let sx = 18; sx < w; sx += 44) {
        ctx.fillStyle = "rgba(42, 34, 28, 0.35)";
        ctx.fillRect(sx, 0, 3, 24 + (sx % 32));
        ctx.fillRect(sx + 6, 128, 3, 20 + (sx % 28));
      }
      ctx.fillStyle = "#202526";
      for (const tx of [22, 106, 150, 234]) {
        for (const ty of [22, 106, 150, 234]) {
          ctx.fillRect(tx - 2, ty - 2, 4, 4);
        }
      }
      ctx.strokeStyle = "#262c2d";
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, h);
      ctx.moveTo(0, 128);
      ctx.lineTo(w, 128);
      ctx.stroke();
    });
    exteriorConcrete.wrapS = THREE.RepeatWrapping;
    exteriorConcrete.wrapT = THREE.RepeatWrapping;
    exteriorConcrete.repeat.set(3, 4);

    const frostedGlass = createNearestCanvasTexture(128, 96, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(182, 214, 224, 0.11)";
      ctx.fillRect(0, 0, w, h);
      const paneW = Math.floor(w / 3);
      for (let p = 0; p < 3; p++) {
        const px0 = p * paneW;
        for (let y = 0; y < h; y += 2) {
          for (let x = 0; x < paneW; x += 2) {
            const dx = Math.min(x, paneW - 2 - x);
            const dy = Math.min(y, h - 2 - y);
            const edgeDist = Math.min(dx, dy);
            if (edgeDist < 16) {
              const hash = ((x * 19 + y * 37 + p * 11) % 10) / 10;
              const frostFactor = (1 - edgeDist / 16) * (0.55 + hash * 0.45);
              const alpha = Math.min(0.62, Math.max(0.08, frostFactor * 0.6));
              ctx.fillStyle = `rgba(218, 236, 246, ${alpha.toFixed(2)})`;
              ctx.fillRect(px0 + x, y, 2, 2);
            }
          }
        }
      }
    });

    const rubberMat = createNearestCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = "#141615";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#d99b16";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#212523";
      for (let y = 10; y < h - 10; y += 12) {
        ctx.fillRect(6, y, w - 12, 6);
      }
    });

    const hazardThresholdTex = createNearestCanvasTexture(256, 32, (ctx, w, h) => {
      ctx.fillStyle = "#ffb000";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#141414";
      for (let x = -32; x < w + 32; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 14, 0);
        ctx.lineTo(x + 30, h);
        ctx.lineTo(x + 16, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, w, h);
    });

    const elevatorDoorTex = createNearestCanvasTexture(256, 384, (ctx, w, h) => {
      ctx.fillStyle = "#28352e";
      ctx.fillRect(0, 0, w, h);
      // Vertical brushed metal wear streaks
      for (let x = 0; x < w; x += 4) {
        if (seededNoise(x, 0, 84) > 0.65) {
          ctx.fillStyle = "#222e28";
          ctx.fillRect(x, 0, 2, h);
        }
      }
      ctx.strokeStyle = "#161e1a";
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      // Stamped upper and lower industrial panel recesses
      ctx.fillStyle = "#202a25";
      ctx.fillRect(20, 22, w - 40, 152);
      ctx.fillRect(20, 196, w - 40, 156);
      ctx.strokeStyle = "#3a4b42";
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 22, w - 40, 152);
      ctx.strokeRect(20, 196, w - 40, 156);
      // Rivet rows along outer stiles
      ctx.fillStyle = "#485950";
      for (let ry = 18; ry < h - 16; ry += 26) {
        ctx.fillRect(10, ry, 4, 4);
        ctx.fillRect(w - 14, ry, 4, 4);
      }
      // Subtle stenciled cargo code
      ctx.fillStyle = "#d99b16";
      ctx.font = 'bold 20px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("LIFT-84", w / 2, 232);
      ctx.fillStyle = "#b8b094";
      ctx.font = 'bold 13px "Courier Prime", monospace';
      ctx.fillText("320 KG // FREIGHT-PASSENGER", w / 2, 256, w - 54);
    });

    const elevatorDialTex = createNearestCanvasTexture(512, 288, (ctx, w, h) => {
      ctx.fillStyle = "#e6dec3";
      ctx.fillRect(0, 0, w, h);
      // Aged dial vignette
      const grad = ctx.createRadialGradient(w / 2, h - 22, 40, w / 2, h - 22, 240);
      grad.addColorStop(0, "rgba(230, 222, 195, 0)");
      grad.addColorStop(1, "rgba(154, 136, 98, 0.45)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h - 22;
      const rad = 224;
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, Math.PI, 0);
      ctx.stroke();

      ctx.strokeStyle = "#8a7a56";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad - 36, Math.PI, 0);
      ctx.stroke();

      const floors = ["B4", "-3.5", "B3", "B2", "B1", "M", "G"];
      for (let i = 0; i < floors.length; i++) {
        const u = i / (floors.length - 1);
        const ang = Math.PI - u * Math.PI;
        const isStuck = floors[i] === "-3.5";
        const x0 = cx + Math.cos(ang) * (rad - 24);
        const y0 = cy - Math.sin(ang) * (rad - 24);
        const x1 = cx + Math.cos(ang) * rad;
        const y1 = cy - Math.sin(ang) * rad;
        ctx.strokeStyle = isStuck ? "#ff2a2a" : "#141414";
        ctx.lineWidth = isStuck ? 7 : 5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        const tx = cx + Math.cos(ang) * (rad - 58);
        const ty = cy - Math.sin(ang) * (rad - 58) + 9;
        ctx.fillStyle = isStuck ? "#c81919" : "#141414";
        ctx.font = 'bold 28px "VT323", "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(floors[i], tx, ty);
      }

      // Minor graduation ticks
      ctx.strokeStyle = "#3a352a";
      ctx.lineWidth = 2;
      for (let t = 0; t <= 24; t++) {
        const ang = Math.PI - (t / 24) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * (rad - 11), cy - Math.sin(ang) * (rad - 11));
        ctx.lineTo(cx + Math.cos(ang) * rad, cy - Math.sin(ang) * rad);
        ctx.stroke();
      }

      ctx.fillStyle = "#141414";
      ctx.font = 'bold 20px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("LIFT-84 LEVEL", cx, cy - 58);
      ctx.font = 'bold 14px "Courier Prime", monospace';
      ctx.fillText("SECTOR 84 SHAFT", cx, cy - 34);
    });

    const elevatorNoticeTex = createNearestCanvasTexture(384, 224, (ctx, w, h) => {
      // Weathered stamped aluminum plate
      ctx.fillStyle = "#b4b9b2";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 320; i++) {
        const px = Math.floor(seededNoise(i, 1, 91) * w);
        const py = Math.floor(seededNoise(i, 2, 91) * h);
        ctx.fillStyle = i % 2 === 0 ? "#8e948c" : "#cad0c8";
        ctx.fillRect(px, py, 3, 2);
      }
      ctx.fillStyle = "#ffb000";
      ctx.fillRect(8, 8, w - 16, 30);
      ctx.fillStyle = "#141414";
      for (let sx = 14; sx < w - 22; sx += 28) {
        ctx.fillRect(sx, 8, 12, 30);
      }
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 7;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      ctx.fillStyle = "#9e1616";
      ctx.font = 'bold 18px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("LIFT-84 MAINTENANCE", w / 2, 68, w - 28);
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 16px "Courier Prime", monospace';
      ctx.fillText("FIVE-YEAR PLAN REPAIR", w / 2, 98, w - 28);
      ctx.fillText("(1979 - 1989)", w / 2, 122, w - 28);
      ctx.fillRect(28, 136, w - 56, 3);
      ctx.fillStyle = "#9e1616";
      ctx.font = 'bold 15px "Courier Prime", monospace';
      ctx.fillText("STAIRS ALSO CLOSED FOR", w / 2, 166, w - 28);
      ctx.fillText("IDEOLOGICAL RECALIBRATION", w / 2, 192, w - 28);
    });

    const elevatorCallPanelTex = createNearestCanvasTexture(128, 224, (ctx, w, h) => {
      ctx.fillStyle = "#3b3530";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#181412";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#623d28";
      ctx.fillRect(10, 12, 24, 18);
      ctx.fillRect(88, 174, 28, 34);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 18px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("LIFT-84", w / 2, 34);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 20px "VT323", monospace';
      ctx.fillText("BUSY", w / 2, 92);
      ctx.fillStyle = "#c8b896";
      ctx.font = 'bold 13px "Courier Prime", monospace';
      ctx.fillText("CALL", w / 2, 206);
    });

    const timeClockFaceTex = createNearestCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#e6dec3";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 108, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI) / 6 - Math.PI / 2;
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = i % 3 === 0 ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 86, cy + Math.sin(ang) * 86);
        ctx.lineTo(cx + Math.cos(ang) * 102, cy + Math.sin(ang) * 102);
        ctx.stroke();
      }
      // Clock hands showing 23:58 (2 minutes before midnight shift)
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 4, cy - 58);
      ctx.stroke();
      ctx.strokeStyle = "#c81919";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 18, cy - 84);
      ctx.stroke();
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 16px "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("ELEKTRONIKA", cx, cy + 56);
    });

    const timeClockPlateTex = createNearestCanvasTexture(256, 72, (ctx, w, h) => {
      ctx.fillStyle = "#181c1a";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#b8a46b";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 16px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("SHIFT CLOCK-IN", w / 2, 28, w - 20);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 14px "Courier Prime", monospace';
      ctx.fillText("PUNCH CARD REQUIRED", w / 2, 54, w - 20);
    });

    const keyRackHeaderTex = createNearestCanvasTexture(256, 80, (ctx, w, h) => {
      ctx.fillStyle = "#1c2420";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#b8a46b";
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 17px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("KEYS & PASSES", w / 2, 34, w - 20);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 13px "Courier Prime", monospace';
      ctx.fillText("DO NOT REMOVE FROM BUNKER", w / 2, 60, w - 20);
    });

    const pravdaNewspaperTex = createNearestCanvasTexture(1024, 680, (ctx, w, h) => {
      ctx.fillStyle = "#e3dabf";
      ctx.fillRect(0, 0, w, h);
      // Subtle paper grain
      for (let i = 0; i < 650; i++) {
        const px = Math.floor(seededNoise(i, 1, 14) * w);
        const py = Math.floor(seededNoise(i, 2, 14) * h);
        ctx.fillStyle = i % 2 === 0 ? "rgba(60, 48, 30, 0.08)" : "rgba(255, 250, 232, 0.14)";
        ctx.fillRect(px, py, 3, 2);
      }
      // Center fold crease shadow
      ctx.fillStyle = "#bfb290";
      ctx.fillRect(w / 2 - 5, 0, 10, h);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, w - 24, h - 24);

      // Left Page Masthead: PRAVDA-84
      ctx.fillStyle = "#b81d18";
      ctx.fillRect(28, 26, w / 2 - 52, 66);
      ctx.fillStyle = "#e6dec3";
      ctx.beginPath();
      ctx.arc(64, 59, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b81d18";
      drawFivePointStar(ctx, 64, 59, 15, 6);
      ctx.fill();
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 46px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("PRAVDA-84", w * 0.25 + 10, 74);

      ctx.fillStyle = "#141414";
      ctx.font = 'bold 14px "Courier Prime", monospace';
      ctx.fillText("NO. 312 (24104) • FRIDAY • MINISTRY OF ATOMIC SERENITY • 3 KOPEKS", w * 0.25 - 2, 112, w / 2 - 52);
      ctx.fillRect(28, 122, w / 2 - 52, 4);

      // Left page 3-column layout
      ctx.textAlign = "left";
      ctx.font = 'bold 26px "Courier Prime", monospace';
      const h1 = wrapLobbyText(
        ctx,
        "SCIENTISTS CONFIRM: RBMK MELTDOWN MATHEMATICALLY IMPOSSIBLE",
        w / 2 - 54,
      );
      let hy = 152;
      for (let i = 0; i < h1.length; i++) {
        ctx.fillText(h1[i], 28, hy);
        hy += 28;
      }
      ctx.fillRect(28, hy - 14, w / 2 - 52, 2);

      // Halftone Cooling Tower Factory Photo on left middle
      const imgX = 28;
      const imgY = hy;
      const imgW = 240;
      const imgH = 166;
      ctx.fillStyle = "#cfc5a7";
      ctx.fillRect(imgX, imgY, imgW, imgH);
      // Sky halftone gradient
      for (let py = 0; py < imgH; py += 4) {
        for (let px = 0; px < imgW; px += 4) {
          if (py < 96 && (px + py) % 8 === 0) {
            ctx.fillStyle = "#918973";
            ctx.fillRect(imgX + px, imgY + py, 2, 2);
          }
        }
      }
      // Hyperbolic cooling towers silhouette inside newsprint photo
      ctx.fillStyle = "#22201b";
      ctx.beginPath();
      ctx.moveTo(imgX + 34, imgY + imgH - 22);
      ctx.quadraticCurveTo(imgX + 54, imgY + 90, imgX + 46, imgY + 42);
      ctx.lineTo(imgX + 94, imgY + 42);
      ctx.quadraticCurveTo(imgX + 86, imgY + 90, imgX + 106, imgY + imgH - 22);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(imgX + 124, imgY + imgH - 22);
      ctx.quadraticCurveTo(imgX + 140, imgY + 98, imgX + 134, imgY + 58);
      ctx.lineTo(imgX + 174, imgY + 58);
      ctx.quadraticCurveTo(imgX + 168, imgY + 98, imgX + 184, imgY + imgH - 22);
      ctx.closePath();
      ctx.fill();
      // Steam plumes
      ctx.fillStyle = "#ece4cb";
      ctx.fillRect(imgX + 54, imgY + 18, 42, 18);
      ctx.fillRect(imgX + 140, imgY + 34, 34, 16);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 2;
      ctx.strokeRect(imgX, imgY, imgW, imgH);
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 11px "Courier Prime", monospace';
      ctx.fillText("FIG 1: SECTOR 84 — NORMAL STEAM", imgX + 4, imgY + imgH + 15);

      // Right sub-column next to photo
      const colR = imgX + imgW + 14;
      ctx.fillStyle = "#2b2822";
      for (let ly = imgY + 4; ly < imgY + imgH + 12; ly += 13) {
        ctx.fillRect(colR, ly, ((ly * 13) % 34) + 156, 6);
      }

      // Bottom left story
      const bY = imgY + imgH + 34;
      ctx.fillStyle = "#141414";
      ctx.fillRect(28, bY, w / 2 - 52, 3);
      ctx.font = 'bold 21px "Courier Prime", monospace';
      ctx.fillText("HEROIC POTATO EXCEEDS QUOTA BY 400%", 28, bY + 26, w / 2 - 54);
      ctx.fillStyle = "#2b2822";
      for (let c = 0; c < 2; c++) {
        const cx = 28 + c * 224;
        for (let ly = bY + 40; ly < h - 28; ly += 13) {
          ctx.fillRect(cx, ly, ((ly * 17 + c * 11) % 30) + 172, 6);
        }
      }
      ctx.fillStyle = "#6e654f";
      ctx.fillRect(w * 0.25 - 2, bY + 38, 2, h - bY - 64);

      // Right Page: 2-Column Editorial & Bureaucracy Briefs
      const rx = w / 2 + 24;
      const rw = w / 2 - 50;
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 28px "Courier Prime", monospace';
      const h3 = wrapLobbyText(ctx, "WESTERN WEATHER BALLOONS BLAMED FOR MONDAY", rw);
      let ry = 54;
      for (let i = 0; i < h3.length; i++) {
        ctx.fillText(h3[i], rx, ry);
        ry += 32;
      }
      ctx.fillRect(rx, ry - 12, rw, 3);

      // Right page column divider
      const rMid = rx + rw / 2;
      ctx.fillStyle = "#6e654f";
      ctx.fillRect(rMid, ry + 4, 2, h - ry - 32);

      // Column 1 text blocks + weather balloon diagram
      ctx.fillStyle = "#c9bfa0";
      ctx.fillRect(rx, ry + 12, rw / 2 - 14, 156);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry + 12, rw / 2 - 14, 156);
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      ctx.arc(rx + (rw / 2 - 14) / 2, ry + 66, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e3dabf";
      ctx.beginPath();
      ctx.arc(rx + (rw / 2 - 14) / 2, ry + 66, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b81d18";
      drawFivePointStar(ctx, rx + (rw / 2 - 14) / 2, ry + 66, 14, 6);
      ctx.fill();
      ctx.fillStyle = "#141414";
      ctx.fillRect(rx + (rw / 2 - 14) / 2 - 1, ry + 102, 2, 26);
      ctx.fillRect(rx + (rw / 2 - 14) / 2 - 12, ry + 128, 24, 14);
      ctx.fillStyle = "#2b2822";
      for (let ly = ry + 184; ly < h - 28; ly += 13) {
        ctx.fillRect(rx, ly, ((ly * 19) % 30) + (rw / 2 - 46), 6);
      }

      // Column 2 sub-headline & text
      const rCol2 = rMid + 14;
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 18px "Courier Prime", monospace';
      ctx.fillText("CAFFEINE RATION", rCol2, ry + 26, rw / 2 - 16);
      ctx.fillText("REDUCED TO 1 CUP", rCol2, ry + 48, rw / 2 - 16);
      ctx.fillStyle = "#b81d18";
      ctx.fillRect(rCol2, ry + 58, rw / 2 - 18, 3);
      ctx.fillStyle = "#2b2822";
      for (let ly = ry + 74; ly < h - 28; ly += 13) {
        ctx.fillRect(rCol2, ly, ((ly * 23) % 28) + (rw / 2 - 48), 6);
      }
    });

    const rotaryDialTex = createNearestCanvasTexture(256, 256, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      ctx.fillStyle = "#141414";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#e6dec3";
      ctx.beginPath();
      ctx.arc(cx, cy, 114, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      ctx.arc(cx, cy, 52, 0, Math.PI * 2);
      ctx.fill();
      const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
      for (let i = 0; i < digits.length; i++) {
        const ang = -Math.PI * 0.25 - i * 0.44;
        const hx = cx + Math.cos(ang) * 84;
        const hy = cy + Math.sin(ang) * 84;
        ctx.fillStyle = "#1e2220";
        ctx.beginPath();
        ctx.arc(hx, hy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 18px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(digits[i], hx, hy + 6);
      }
      ctx.fillStyle = "#b8a46b";
      ctx.font = 'bold 12px "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("VEF TA-68", cx, cy + 4);
    });

    const makeRibbonTex = (
      base: string,
      stripe1: string,
      stripe2: string,
    ): THREE.CanvasTexture =>
      createNearestCanvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = stripe1;
        ctx.fillRect(10, 0, 8, h);
        ctx.fillRect(w - 18, 0, 8, h);
        ctx.fillStyle = stripe2;
        ctx.fillRect(26, 0, 12, h);
        // Silk weave scanlines
        ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
        for (let y = 0; y < h; y += 3) {
          ctx.fillRect(0, y, w, 1);
        }
      });

    const ribbonGraphite = makeRibbonTex("#8f1818", "#e0b440", "#141414");
    const ribbonPaperwork = makeRibbonTex("#254736", "#d8b44c", "#b8241c");
    const ribbonShredder = makeRibbonTex("#202428", "#e88a1a", "#c81919");

    const makeBrassPlaqueTex = (
      line1: string,
      line2: string,
      bg = "#201a10",
    ): THREE.CanvasTexture =>
      createNearestCanvasTexture(384, 96, (ctx, w, h) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#d1b262";
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = "#d1b262";
        ctx.fillRect(10, 10, 6, 6);
        ctx.fillRect(w - 16, 10, 6, 6);
        ctx.fillRect(10, h - 16, 6, 6);
        ctx.fillRect(w - 16, h - 16, 6, 6);
        ctx.fillStyle = "#f2d68a";
        ctx.font = 'bold 17px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(line1, w / 2, 40, w - 34);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 15px "Courier Prime", monospace';
        ctx.fillText(line2, w / 2, 70, w - 34);
      });

    const plaqueHonorHeader = createNearestCanvasTexture(512, 64, (ctx, w, h) => {
      ctx.fillStyle = "#221810";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#d4b25c";
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#b8241c";
      drawFivePointStar(ctx, 36, h / 2, 14, 6);
      ctx.fill();
      drawFivePointStar(ctx, w - 36, h / 2, 14, 6);
      ctx.fill();
      ctx.fillStyle = "#f2d68a";
      ctx.font = 'bold 24px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("HONOR WALL OF SECTOR 84", w / 2, 41, w - 104);
    });

    const plaqueGraphite = makeBrassPlaqueTex(
      "ORDER OF THE GLOWING GRAPHITE",
      "2ND CLASS • SECTOR 84",
    );
    const plaquePaperwork = makeBrassPlaqueTex(
      "MEDAL FOR HEROIC PAPERWORK",
      "MINISTRY OF STAMPS (1982)",
    );
    const plaqueShredder = makeBrassPlaqueTex(
      "ZERO REPORTED INCIDENTS",
      "SHREDDER BRIGADE CITATION",
    );
    const plaqueButtonPress = makeBrassPlaqueTex(
      "1ST PLACE: MOST ENTHUSIASTIC",
      "BUTTON PRESSING (1983)",
    );
    const plaqueBust = makeBrassPlaqueTex(
      "CHIEF ENGINEER VANGUARD",
      "SECTOR 84 • CAST 1979",
    );
    const plaqueQuotaCert = makeBrassPlaqueTex(
      "QUOTA EXCEEDED 104%",
      "NO QUESTIONS PERMITTED",
      "#23312b",
    );

    const plaqueEnvyHeader = createNearestCanvasTexture(384, 72, (ctx, w, h) => {
      ctx.fillStyle = "#181d1a";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#c8a85a";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 20px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("DAYS WITHOUT WESTERN ENVY", w / 2, 44, w - 24);
    });

    const flipDigitZero = createNearestCanvasTexture(96, 128, (ctx, w, h) => {
      ctx.fillStyle = "#141414";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#363b38";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#ff2a2a";
      ctx.font = 'bold 112px "VT323", monospace';
      ctx.textAlign = "center";
      ctx.fillText("0", w / 2, 98);
      // Mechanical split-flap hinge line
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(4, h / 2 - 3, w - 8, 6);
      ctx.fillStyle = "#7a7e78";
      ctx.fillRect(6, h / 2 - 2, 8, 4);
      ctx.fillRect(w - 14, h / 2 - 2, 8, 4);
    });

    const makeBinderSpineTex = (
      vol: string,
      color: string,
    ): THREE.CanvasTexture =>
      createNearestCanvasTexture(64, 256, (ctx, w, h) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#d1b262";
        ctx.fillRect(0, 26, w, 6);
        ctx.fillRect(0, h - 34, w, 6);
        ctx.fillRect(0, h - 48, w, 4);
        ctx.save();
        ctx.translate(w / 2, h / 2 - 12);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 15px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(vol, 0, 5);
        ctx.restore();
        ctx.fillStyle = "#b81d18";
        ctx.fillRect(6, h - 88, w - 12, 24);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 10px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("REDACTED", w / 2, h - 72);
      });

    const binderSpines = [
      makeBinderSpineTex("RBMK-1000 VOL 1", "#5c1b18"),
      makeBinderSpineTex("RBMK-1000 VOL 2", "#243b2e"),
      makeBinderSpineTex("RBMK-1000 VOL 3", "#2b2b34"),
      makeBinderSpineTex("RBMK-1000 VOL 4", "#4a321c"),
    ];

    const geigerDialTex = createNearestCanvasTexture(192, 96, (ctx, w, h) => {
      ctx.fillStyle = "#e6dec3";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h - 10, 68, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.strokeStyle = "#c81919";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(w / 2, h - 10, 68, Math.PI * 1.55, Math.PI * 1.85);
      ctx.stroke();
      // Needle pegged on 3.6
      ctx.strokeStyle = "#c81919";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w / 2, h - 10);
      ctx.lineTo(w / 2 + 34, 24);
      ctx.stroke();
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 14px "VT323", monospace';
      ctx.textAlign = "center";
      ctx.fillText("DP-5V // 3.6 R/HR", w / 2, h - 14);
    });

    const fireCabinetTex = createNearestCanvasTexture(192, 256, (ctx, w, h) => {
      ctx.fillStyle = "#961c18";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#e6dec3";
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 26px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("FIRE", w / 2, 46);
      ctx.font = 'bold 15px "Courier Prime", monospace';
      ctx.fillText("POST NO. 84", w / 2, 72);
      ctx.fillStyle = "#1a201e";
      ctx.fillRect(24, 90, w - 48, 124);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 90, w - 48, 124);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 13px "Courier Prime", monospace';
      ctx.fillText("BREAK GLASS ONLY", w / 2, 236);
    });

    // =========================================================================
    // 4 ILLUSTRATED 512x720 SOVIET CONSTRUCTIVIST CANVAS POSTERS
    // =========================================================================

    // POSTER 1: "ATOM FOR PEACE & QUOTA" (Heroic Constructivist Sunburst)
    const posterAtomPeace = createNearestCanvasTexture(512, 720, (ctx, w, h) => {
      ctx.fillStyle = "#e6dec3";
      ctx.fillRect(0, 0, w, h);

      // Upper Heroic Sunburst Art Box
      const ax = 26;
      const ay = 104;
      const aw = w - 52;
      const ah = 372;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ax, ay, aw, ah);
      ctx.clip();

      ctx.fillStyle = "#202422";
      ctx.fillRect(ax, ay, aw, ah);

      // Constructivist sunburst rays radiating behind cooling tower
      const sunX = w / 2;
      const sunY = ay + 220;
      for (let i = 0; i < 16; i++) {
        const a0 = -Math.PI + (i * Math.PI) / 16;
        const a1 = a0 + Math.PI / 32;
        ctx.fillStyle = i % 2 === 0 ? "#c2241d" : "#e39d24";
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(sunX + Math.cos(a0) * 460, sunY + Math.sin(a0) * 460);
        ctx.lineTo(sunX + Math.cos(a1) * 460, sunY + Math.sin(a1) * 460);
        ctx.closePath();
        ctx.fill();
      }
      // Radiant solar disc
      ctx.fillStyle = "#e6dec3";
      ctx.beginPath();
      ctx.arc(sunX, sunY - 12, 92, 0, Math.PI * 2);
      ctx.fill();

      // Stylized RBMK Hyperbolic Cooling Tower silhouette
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      ctx.moveTo(sunX - 90, ay + ah);
      ctx.quadraticCurveTo(sunX - 42, sunY + 34, sunX - 54, sunY - 46);
      ctx.lineTo(sunX + 54, sunY - 46);
      ctx.quadraticCurveTo(sunX + 42, sunY + 34, sunX + 90, ay + ah);
      ctx.closePath();
      ctx.fill();
      // Cooling tower crimson rib highlights
      ctx.fillStyle = "#b8241c";
      ctx.fillRect(sunX - 42, sunY - 38, 84, 10);
      // Geometric rising steam band
      ctx.fillStyle = "#e6dec3";
      ctx.beginPath();
      ctx.moveTo(sunX - 44, sunY - 52);
      ctx.lineTo(sunX - 72, ay + 18);
      ctx.lineTo(sunX + 76, ay + 12);
      ctx.lineTo(sunX + 44, sunY - 52);
      ctx.closePath();
      ctx.fill();

      // Rutherford atomic electron orbits centered above tower
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 6;
      for (const rot of [-0.62, 0.62, 0]) {
        ctx.save();
        ctx.translate(sunX, sunY - 82);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, 128, 38, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = "#c81919";
      ctx.beginPath();
      ctx.arc(sunX, sunY - 82, 16, 0, Math.PI * 2);
      ctx.fill();

      // Clenched industrial gear-fist foreground motif
      ctx.fillStyle = "#141414";
      for (let g = 0; g < 8; g++) {
        const ang = (g * Math.PI) / 4;
        ctx.fillRect(
          sunX + Math.cos(ang) * 52 - 10,
          ay + ah - 32 + Math.sin(ang) * 52 - 10,
          20,
          20,
        );
      }
      ctx.beginPath();
      ctx.arc(sunX, ay + ah - 26, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e39d24";
      drawFivePointStar(ctx, sunX, ay + ah - 30, 26, 11);
      ctx.fill();
      ctx.restore();

      // Frame & Header Banner
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.strokeRect(ax, ay, aw, ah);

      ctx.fillStyle = "#b8241c";
      ctx.fillRect(20, 20, w - 40, 72);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 30px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("MIRNY ATOM // SECTOR 84", w / 2, 66, w - 64);

      // Headline & Subtext
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 34px "Kremlin", "Courier Prime", monospace';
      ctx.fillText("ATOM FOR PEACE & QUOTA", w / 2, 524, w - 52);

      ctx.fillStyle = "#b8241c";
      ctx.fillRect(26, 548, w - 52, 5);
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 17px "Courier Prime", monospace';
      const subLines = wrapLobbyText(
        ctx,
        "MELTDOWN IS MATHEMATICALLY IMPOSSIBLE - REPORT ALL DOUBTS TO SHIFT SUPERVISOR",
        w - 64,
      );
      let sy = 580;
      for (let i = 0; i < subLines.length; i++) {
        ctx.fillText(subLines[i], w / 2, sy, w - 56);
        sy += 24;
      }

      ctx.fillStyle = "#141414";
      ctx.fillRect(20, h - 54, w - 40, 34);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 15px "Courier Prime", monospace';
      ctx.fillText("MINISTRY OF ATOMIC ENERGETICS • 1984", w / 2, h - 31, w - 60);

      applyPosterWeathering(ctx, w, h, 101);
    });

    // POSTER 2: "VIGILANCE AT EVERY DIAL" (Stark Noir Brutalist Eye & Transmission Tower)
    const posterVigilance = createNearestCanvasTexture(512, 720, (ctx, w, h) => {
      ctx.fillStyle = "#e6dec3";
      ctx.fillRect(0, 0, w, h);

      const ax = 26;
      const ay = 104;
      const aw = w - 52;
      const ah = 360;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ax, ay, aw, ah);
      ctx.clip();

      // Dramatic diagonal split noir background
      ctx.fillStyle = "#141414";
      ctx.fillRect(ax, ay, aw, ah);
      ctx.fillStyle = "#b51d18";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + aw, ay);
      ctx.lineTo(ax, ay + ah);
      ctx.closePath();
      ctx.fill();

      // Giant draftsman's compass spanning behind
      ctx.strokeStyle = "#e6dec3";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(ax + 120, ay + 36);
      ctx.lineTo(ax + 38, ay + ah - 12);
      ctx.moveTo(ax + 120, ay + 36);
      ctx.lineTo(ax + 206, ay + ah - 12);
      ctx.stroke();
      ctx.fillStyle = "#e6dec3";
      ctx.beginPath();
      ctx.arc(ax + 120, ay + 36, 18, 0, Math.PI * 2);
      ctx.fill();

      // High-voltage lattice transmission pylon on right
      const px = ax + 340;
      ctx.strokeStyle = "#e6dec3";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px - 44, ay + ah);
      ctx.lineTo(px, ay + 48);
      ctx.lineTo(px + 44, ay + ah);
      // Cross arms
      ctx.moveTo(px - 64, ay + 110);
      ctx.lineTo(px + 64, ay + 110);
      ctx.moveTo(px - 52, ay + 166);
      ctx.lineTo(px + 52, ay + 166);
      // Lattice X-braces
      for (let ly = ay + 120; ly < ay + ah - 40; ly += 60) {
        const w0 = ((ly - ay) / ah) * 40;
        ctx.moveTo(px - w0, ly);
        ctx.lineTo(px + w0 + 10, ly + 60);
        ctx.moveTo(px + w0, ly);
        ctx.lineTo(px - w0 - 10, ly + 60);
      }
      ctx.stroke();

      // Giant watchful Constructivist eye at upper center
      ctx.fillStyle = "#e6dec3";
      ctx.beginPath();
      ctx.moveTo(w / 2 - 120, ay + 148);
      ctx.quadraticCurveTo(w / 2, ay + 64, w / 2 + 120, ay + 148);
      ctx.quadraticCurveTo(w / 2, ay + 232, w / 2 - 120, ay + 148);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.fillStyle = "#b51d18";
      ctx.beginPath();
      ctx.arc(w / 2, ay + 148, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      ctx.arc(w / 2, ay + 148, 17, 0, Math.PI * 2);
      ctx.fill();

      // Stern angular worker hard-hat profile silhouette bottom left
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      ctx.moveTo(ax + 12, ay + ah);
      ctx.lineTo(ax + 26, ay + 224);
      ctx.lineTo(ax + 124, ay + 220);
      ctx.lineTo(ax + 142, ay + 252);
      ctx.lineTo(ax + 122, ay + 278);
      ctx.lineTo(ax + 134, ay + 294);
      ctx.lineTo(ax + 114, ay + 322);
      ctx.lineTo(ax + 126, ay + ah);
      ctx.closePath();
      ctx.fill();
      // Hard-hat visor brim
      ctx.fillStyle = "#ffb000";
      ctx.fillRect(ax + 22, ay + 210, 128, 16);
      ctx.restore();

      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.strokeRect(ax, ay, aw, ah);

      ctx.fillStyle = "#141414";
      ctx.fillRect(20, 20, w - 40, 72);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 28px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("VIGILANCE AT EVERY DIAL", w / 2, 66, w - 64);

      ctx.fillStyle = "#141414";
      ctx.font = 'bold 31px "Kremlin", "Courier Prime", monospace';
      const headLines = wrapLobbyText(
        ctx,
        "SLEEP IS A CONCESSION TO IMPERIALISM",
        w - 56,
      );
      let hy = 512;
      for (let i = 0; i < headLines.length; i++) {
        ctx.fillText(headLines[i], w / 2, hy, w - 52);
        hy += 38;
      }

      ctx.fillStyle = "#b51d18";
      ctx.fillRect(20, h - 102, w - 40, 80);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 20px "Courier Prime", monospace';
      ctx.fillText("YOUR COFFEE BREAK", w / 2, h - 68, w - 60);
      ctx.fillText("POWERS ZERO TRACTORS", w / 2, h - 40, w - 60);

      applyPosterWeathering(ctx, w, h, 202);
    });

    // POSTER 3: "SAFETY PROTOCOL NO. 4" (Technical Cutaway Diagram Style)
    const posterSafety = createNearestCanvasTexture(512, 720, (ctx, w, h) => {
      ctx.fillStyle = "#ded5b4";
      ctx.fillRect(0, 0, w, h);

      const ax = 26;
      const ay = 104;
      const aw = w - 52;
      const ah = 368;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ax, ay, aw, ah);
      ctx.clip();

      // Blueprint / Soviet drafting grid background
      ctx.fillStyle = "#173242";
      ctx.fillRect(ax, ay, aw, ah);
      ctx.strokeStyle = "rgba(180, 220, 232, 0.22)";
      ctx.lineWidth = 1;
      for (let gx = ax; gx <= ax + aw; gx += 24) {
        ctx.beginPath();
        ctx.moveTo(gx, ay);
        ctx.lineTo(gx, ay + ah);
        ctx.stroke();
      }
      for (let gy = ay; gy <= ay + ah; gy += 24) {
        ctx.beginPath();
        ctx.moveTo(ax, gy);
        ctx.lineTo(ax + aw, gy);
        ctx.stroke();
      }

      // Cutaway RBMK reactor core vessel diagram on right
      const vx = ax + 304;
      const vy = ay + 196;
      ctx.fillStyle = "#0e1d26";
      ctx.fillRect(vx - 86, vy - 118, 172, 236);
      ctx.strokeStyle = "#e6dec3";
      ctx.lineWidth = 4;
      ctx.strokeRect(vx - 86, vy - 118, 172, 236);
      // Glowing fuel rods & channels
      for (let rx = -58; rx <= 58; rx += 23) {
        ctx.fillStyle = Math.abs(rx) <= 23 ? "#ffb000" : "#ff3a2a";
        ctx.fillRect(vx + rx - 5, vy - 90, 10, 180);
      }
      // Circular gauge overlay
      ctx.fillStyle = "#e6dec3";
      ctx.beginPath();
      ctx.arc(vx, vy - 122, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = "#c81919";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(vx, vy - 122);
      ctx.lineTo(vx + 28, vy - 144);
      ctx.stroke();

      // Operator silhouette in hard-hat saluting core on left
      const ox = ax + 96;
      ctx.fillStyle = "#e6dec3";
      // Torso & legs
      ctx.fillRect(ox - 28, ay + 196, 56, 172);
      // Raised saluting arm
      ctx.beginPath();
      ctx.moveTo(ox + 20, ay + 206);
      ctx.lineTo(ox + 68, ay + 158);
      ctx.lineTo(ox + 42, ay + 128);
      ctx.lineTo(ox + 26, ay + 142);
      ctx.lineTo(ox + 44, ay + 162);
      ctx.lineTo(ox + 16, ay + 190);
      ctx.closePath();
      ctx.fill();
      // Head + hard-hat
      ctx.beginPath();
      ctx.arc(ox, ay + 160, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffb000";
      ctx.beginPath();
      ctx.arc(ox, ay + 148, 28, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(ox - 34, ay + 146, 68, 8);

      // Radiation trefoil motifs & technical blueprint callouts
      drawRadiationTrefoil(ctx, ax + 54, ay + 54, 30, 9, "#ffb000");
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 14px "Courier Prime", monospace';
      ctx.textAlign = "left";
      ctx.fillText("FIG. 4-B", ax + 16, ay + 106);
      ctx.fillStyle = "#ffb000";
      ctx.fillText("3.6 R // OPTIMAL", vx - 82, ay + 344);
      ctx.restore();

      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.strokeRect(ax, ay, aw, ah);

      ctx.fillStyle = "#23332b";
      ctx.fillRect(20, 20, w - 40, 72);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 29px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("SAFETY PROTOCOL NO. 4", w / 2, 66, w - 60);

      ctx.fillStyle = "#141414";
      ctx.font = 'bold 28px "Kremlin", "Courier Prime", monospace';
      const sLines = wrapLobbyText(
        ctx,
        "IN EVENT OF UNSCHEDULED GLOW:",
        w - 56,
      );
      let sy = 514;
      for (let i = 0; i < sLines.length; i++) {
        ctx.fillText(sLines[i], w / 2, sy, w - 52);
        sy += 36;
      }

      ctx.fillStyle = "#b8241c";
      ctx.fillRect(20, h - 102, w - 40, 80);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 21px "Courier Prime", monospace';
      ctx.fillText("REMAIN CALM AND BLAME", w / 2, h - 68, w - 56);
      ctx.fillText("PREVIOUS SHIFT", w / 2, h - 38, w - 56);

      applyPosterWeathering(ctx, w, h, 303);
    });

    // POSTER 4: "EXCELLENCE IN SOCIALIST ENERGETICS" (Red Banner & Laurel Crest)
    const posterEnergetics = createNearestCanvasTexture(512, 720, (ctx, w, h) => {
      ctx.fillStyle = "#e6dec3";
      ctx.fillRect(0, 0, w, h);

      const ax = 26;
      const ay = 104;
      const aw = w - 52;
      const ah = 368;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ax, ay, aw, ah);
      ctx.clip();

      ctx.fillStyle = "#7a1412";
      ctx.fillRect(ax, ay, aw, ah);

      // Diagonal crimson cloth banner across crest
      ctx.fillStyle = "#b8241c";
      ctx.beginPath();
      ctx.moveTo(ax, ay + 64);
      ctx.lineTo(ax + aw, ay + 12);
      ctx.lineTo(ax + aw, ay + 250);
      ctx.lineTo(ax, ay + 302);
      ctx.closePath();
      ctx.fill();

      const cx = w / 2;
      const cy = ay + 190;
      // Golden wheat-sheaf / laurel arcs around turbine crest
      ctx.fillStyle = "#e6b440";
      for (let side of [-1, 1]) {
        for (let k = 0; k < 9; k++) {
          const ang = -Math.PI * 0.42 + k * 0.22;
          const lx = cx + side * Math.cos(ang) * 126;
          const ly = cy + Math.sin(ang) * 126;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(side * (ang + 0.5));
          ctx.beginPath();
          ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Multi-blade steam turbine rotor medallion
      ctx.fillStyle = "#141414";
      ctx.beginPath();
      ctx.arc(cx, cy, 94, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e6b440";
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = "#c8cfd1";
      for (let b = 0; b < 12; b++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((b * Math.PI) / 6);
        ctx.fillRect(-7, -84, 14, 44);
        ctx.restore();
      }
      ctx.fillStyle = "#b8241c";
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e6b440";
      drawFivePointStar(ctx, cx, cy, 34, 14);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.strokeRect(ax, ay, aw, ah);

      ctx.fillStyle = "#9e1c1c";
      ctx.fillRect(20, 20, w - 40, 72);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 24px "Kremlin", "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("EXCELLENCE IN", w / 2, 46, w - 60);
      ctx.fillText("SOCIALIST ENERGETICS", w / 2, 78, w - 60);

      ctx.fillStyle = "#141414";
      ctx.font = 'bold 31px "Kremlin", "Courier Prime", monospace';
      const eLines = wrapLobbyText(ctx, "QUOTA IS LAW - EXCUSES ARE SABOTAGE", w - 56);
      let ey = 514;
      for (let i = 0; i < eLines.length; i++) {
        ctx.fillText(eLines[i], w / 2, ey, w - 52);
        ey += 38;
      }

      ctx.fillStyle = "#23332b";
      ctx.fillRect(20, h - 78, w - 40, 56);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 17px "Courier Prime", monospace';
      ctx.fillText("FIVE-YEAR PLAN AWARD • SECTOR 84", w / 2, h - 43, w - 60);

      applyPosterWeathering(ctx, w, h, 404);
    });

    const plantTagTex = createNearestCanvasTexture(256, 96, (ctx, w, h) => {
      ctx.fillStyle = "#b8a46b";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 15px "Courier Prime", monospace';
      ctx.textAlign = "center";
      ctx.fillText("STATE BOTANICAL ASSET #04", w / 2, 38, w - 18);
      ctx.fillStyle = "#961818";
      ctx.font = 'bold 17px "Kremlin", "Courier Prime", monospace';
      ctx.fillText("DO NOT FEED TEA", w / 2, 72, w - 18);
    });

    const potTerracottaTex = createNearestCanvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = "#8a4a32";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 360; i++) {
        const px = Math.floor(seededNoise(i, 1, 72) * w);
        const py = Math.floor(seededNoise(i, 2, 72) * h);
        ctx.fillStyle = i % 3 === 0 ? "#a85c3e" : "#6c3723";
        ctx.fillRect(px, py, 3, 2);
      }
      ctx.fillStyle = "#a85c3e";
      ctx.fillRect(0, 0, w, 16);
      ctx.fillStyle = "#c81919";
      drawFivePointStar(ctx, w / 2, h / 2 + 6, 30, 12);
      ctx.fill();
    });

    const snowTex = createNearestCanvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = "#c6d7e6";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 80; i++) {
        const px = (i * 19 + 5) % w;
        const py = (i * 31 + 11) % h;
        ctx.fillStyle = i % 2 === 0 ? "#dfeaf4" : "#9db3c9";
        ctx.fillRect(px, py, 3, 2);
      }
    });

    return {
      linoleum,
      wainscot,
      upperPlaster,
      exteriorConcrete,
      frostedGlass,
      rubberMat,
      hazardThresholdTex,
      elevatorDoorTex,
      elevatorDialTex,
      elevatorNoticeTex,
      elevatorCallPanelTex,
      timeClockFaceTex,
      timeClockPlateTex,
      keyRackHeaderTex,
      pravdaNewspaperTex,
      rotaryDialTex,
      ribbonGraphite,
      ribbonPaperwork,
      ribbonShredder,
      plaqueHonorHeader,
      plaqueGraphite,
      plaquePaperwork,
      plaqueShredder,
      plaqueButtonPress,
      plaqueBust,
      plaqueQuotaCert,
      plaqueEnvyHeader,
      flipDigitZero,
      binderSpines,
      geigerDialTex,
      fireCabinetTex,
      posterAtomPeace,
      posterVigilance,
      posterSafety,
      posterEnergetics,
      plantTagTex,
      potTerracottaTex,
      snowTex,
    };
  }, []);

  const mats = useMemo(() => {
    const ironTex = getHammeredIronTextures();
    const brassTex = getBrushedBrassTextures();
    const woodTex = getWeatheredMahoganyTextures();
    const blotterTex = getWornInspectionMatTextures();

    return {
      subfloor: new THREE.MeshStandardMaterial({
        color: "#181b19",
        roughness: 0.94,
        metalness: 0.14,
      }),
      floor: new THREE.MeshStandardMaterial({
        map: textures.linoleum,
        color: "#ded8ce",
        roughness: 0.72,
        metalness: 0.14,
      }),
      wainscot: new THREE.MeshStandardMaterial({
        map: textures.wainscot,
        color: "#526a5d",
        roughness: 0.74,
        metalness: 0.24,
      }),
      upperWall: new THREE.MeshStandardMaterial({
        map: textures.upperPlaster,
        color: "#d8ddd6",
        roughness: 0.84,
        metalness: 0.12,
      }),
      exteriorConcrete: new THREE.MeshStandardMaterial({
        map: textures.exteriorConcrete,
        color: "#6b7375",
        roughness: 0.92,
        metalness: 0.08,
      }),
      exteriorFoundation: new THREE.MeshStandardMaterial({
        color: "#151d25",
        roughness: 0.95,
        metalness: 0.06,
      }),
      snow: new THREE.MeshStandardMaterial({
        map: textures.snowTex,
        color: "#a7bcd0",
        roughness: 0.88,
        metalness: 0.04,
      }),
      skirting: new THREE.MeshStandardMaterial({
        color: "#1f2824",
        roughness: 0.56,
        metalness: 0.52,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: "#c4ab6a",
        roughness: 0.28,
        metalness: 0.86,
        bumpMap: brassTex.bumpMap,
        bumpScale: 0.004,
      }),
      bronzePatina: new THREE.MeshStandardMaterial({
        color: "#6e5c3c",
        roughness: 0.36,
        metalness: 0.78,
        bumpMap: brassTex.bumpMap,
        bumpScale: 0.005,
      }),
      aluminum: new THREE.MeshStandardMaterial({
        color: "#9aa49e",
        roughness: 0.38,
        metalness: 0.76,
      }),
      darkSteel: new THREE.MeshStandardMaterial({
        color: "#1c2320",
        roughness: 0.48,
        metalness: 0.68,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.006,
      }),
      oliveSteel: new THREE.MeshStandardMaterial({
        color: "#2b3932",
        roughness: 0.54,
        metalness: 0.52,
        bumpMap: ironTex.bumpMap,
        bumpScale: 0.005,
      }),
      rustSteel: new THREE.MeshStandardMaterial({
        color: "#4a3326",
        roughness: 0.74,
        metalness: 0.46,
      }),
      crimson: new THREE.MeshStandardMaterial({
        color: "#a61c1c",
        roughness: 0.5,
        metalness: 0.28,
      }),
      velvet: new THREE.MeshStandardMaterial({
        color: "#4e0f14",
        roughness: 0.94,
        metalness: 0.04,
      }),
      mahogany: new THREE.MeshStandardMaterial({
        map: woodTex.map,
        bumpMap: woodTex.bumpMap,
        bumpScale: 0.005,
        roughnessMap: woodTex.roughnessMap,
        roughness: 0.52,
        metalness: 0.14,
      }),
      blackMarble: new THREE.MeshStandardMaterial({
        color: "#16191a",
        roughness: 0.26,
        metalness: 0.24,
      }),
      deskBlotter: new THREE.MeshStandardMaterial({
        map: blotterTex.map,
        bumpMap: blotterTex.bumpMap,
        bumpScale: 0.004,
        roughnessMap: blotterTex.roughnessMap,
        roughness: 0.85,
        metalness: 0.04,
      }),
      vinylChair: new THREE.MeshStandardMaterial({
        color: "#5d1c18",
        roughness: 0.58,
        metalness: 0.12,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: "#a6afb4",
        roughness: 0.24,
        metalness: 0.88,
      }),
      bakelite: new THREE.MeshStandardMaterial({
        color: "#141414",
        roughness: 0.46,
        metalness: 0.18,
      }),
      enamelWhite: new THREE.MeshStandardMaterial({
        color: "#e6dec3",
        roughness: 0.36,
        metalness: 0.16,
      }),
      teaLiquid: new THREE.MeshStandardMaterial({
        color: "#5c250b",
        roughness: 0.18,
        metalness: 0.08,
      }),
      glassClear: new THREE.MeshStandardMaterial({
        color: "#d9ece8",
        transparent: true,
        opacity: 0.18,
        roughness: 0.12,
        metalness: 0.28,
        depthWrite: false,
      }),
      glassCase: new THREE.MeshStandardMaterial({
        color: "#cfe4dc",
        transparent: true,
        opacity: 0.12,
        roughness: 0.14,
        metalness: 0.26,
        depthWrite: false,
      }),
      pipeRed: new THREE.MeshStandardMaterial({
        color: "#7a2c24",
        roughness: 0.54,
        metalness: 0.48,
      }),
      pipeYellow: new THREE.MeshStandardMaterial({
        color: "#9c7424",
        roughness: 0.54,
        metalness: 0.46,
      }),
      pipeGreen: new THREE.MeshStandardMaterial({
        color: "#365041",
        roughness: 0.56,
        metalness: 0.46,
      }),
      copper: new THREE.MeshStandardMaterial({
        color: "#b46a3a",
        roughness: 0.34,
        metalness: 0.82,
      }),
      plantLeaf: new THREE.MeshStandardMaterial({
        color: "#1e4527",
        roughness: 0.32,
        metalness: 0.14,
      }),
      plantLeafAlt: new THREE.MeshStandardMaterial({
        color: "#295732",
        roughness: 0.36,
        metalness: 0.12,
      }),
      plantStem: new THREE.MeshStandardMaterial({
        color: "#3f3224",
        roughness: 0.84,
        metalness: 0.08,
      }),
      soil: new THREE.MeshStandardMaterial({
        color: "#221710",
        roughness: 0.96,
        metalness: 0.02,
      }),
      frostedGlass: new THREE.MeshStandardMaterial({
        map: textures.frostedGlass,
        transparent: true,
        opacity: 0.92,
        roughness: 0.28,
        metalness: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      dustMote: new THREE.MeshBasicMaterial({
        color: "#ffe4b5",
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
    };
  }, [textures]);

  useEffect(() => {
    return () => {
      Object.values(textures).forEach((t) => {
        if (Array.isArray(t)) {
          t.forEach((item) => item.dispose());
        } else {
          t.dispose();
        }
      });
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats, textures]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, delta);
    const gs = useGameStore.getState();
    const isBlackout = gs.isBlackout;

    const targetLit = gs.lobbyMenuPhase === "entered_control_room" ? 1 : 0;
    if (targetLit === 0) {
      controlRoomLitBlendRef.current = 0;
    } else {
      controlRoomLitBlendRef.current = THREE.MathUtils.damp(
        controlRoomLitBlendRef.current,
        1,
        3.8,
        dt,
      );
    }

    const lobbySealed =
      gs.lobbyMenuPhase === "entered_control_room" &&
      airlockDoorState.openProgress <= 0.01 &&
      controlRoomLitBlendRef.current >= 0.99;

    if (lobbySealed) {
      if (!wasLobbySealedRef.current) {
        wasLobbySealedRef.current = true;
        if (ceilingNorthLightRef.current) ceilingNorthLightRef.current.intensity = 0.0002;
        if (ceilingSouthLightRef.current) ceilingSouthLightRef.current.intensity = 0.0002;
        if (cabinetLightRef.current) cabinetLightRef.current.intensity = 0.0002;
        if (deskLampLightRef.current) deskLampLightRef.current.intensity = 0.0002;
        if (elevatorRubyLightRef.current) elevatorRubyLightRef.current.intensity = 0.0002;
        if (airlockSignLightRef.current) airlockSignLightRef.current.intensity = 0.0002;
        if (lobbyFillLightRef.current) lobbyFillLightRef.current.intensity = 0.0002;
      }
      return;
    }
    wasLobbySealedRef.current = false;

    const standbyBoost = 1 - controlRoomLitBlendRef.current;

    const flickerWave =
      0.94 +
      0.04 * Math.sin(t * 7.3) +
      0.025 * Math.sin(t * 23.1 + 1.4) +
      (Math.sin(t * 41.7) > 0.94 ? -0.14 : 0);

    // Occasional gentle 50Hz ballast dip on the aged south tube (never harsh strobe)
    const agedTubeDip =
      Math.sin(t * 0.72) > 0.86
        ? 0.78 + 0.12 * Math.sin(t * 31.4)
        : 0.98 + 0.02 * Math.sin(t * 14.0);

    if (ceilingNorthLightRef.current) {
      ceilingNorthLightRef.current.intensity = isBlackout
        ? 0.24
        : THREE.MathUtils.lerp(2.6, 5.0, standbyBoost);
    }

    if (ceilingSouthLightRef.current) {
      ceilingSouthLightRef.current.intensity = isBlackout
        ? 0.2
        : THREE.MathUtils.lerp(2.2, 4.8, standbyBoost) * (0.9 + 0.1 * agedTubeDip);
    }

    if (cabinetLightRef.current) {
      cabinetLightRef.current.intensity = isBlackout
        ? 0.12
        : THREE.MathUtils.lerp(1.65, 2.6, standbyBoost);
    }

    if (deskLampLightRef.current) {
      deskLampLightRef.current.intensity = isBlackout
        ? 0.45
        : THREE.MathUtils.lerp(3.1, 4.2, standbyBoost) * flickerWave;
    }

    const rubyPulse = 1.05 + Math.sin(t * 2.6) * 0.4;
    if (elevatorRubyLightRef.current) {
      elevatorRubyLightRef.current.intensity = isBlackout
        ? 0.22
        : THREE.MathUtils.lerp(0.46, 0.8, standbyBoost) +
          Math.sin(t * 2.6) * 0.16;
    }

    if (airlockSignLightRef.current) {
      airlockSignLightRef.current.intensity = isBlackout
        ? 0.1
        : THREE.MathUtils.lerp(0.42, 0.58, standbyBoost);
    }

    if (lobbyFillLightRef.current) {
      lobbyFillLightRef.current.intensity = Math.max(
        0.0002,
        isBlackout ? 0.12 : 2.4 * standbyBoost,
      );
    }

    if (deskLampBulbMatRef.current) {
      deskLampBulbMatRef.current.emissiveIntensity = isBlackout
        ? 0.35
        : 1.55 * flickerWave;
    }

    if (deskLampShadeMatRef.current) {
      deskLampShadeMatRef.current.emissiveIntensity = isBlackout
        ? 0.05
        : 0.25 * flickerWave;
    }

    for (let i = 0; i < trofferTubeMatRefs.current.length; i++) {
      const m = trofferTubeMatRefs.current[i];
      if (!m) continue;
      if (isBlackout) {
        m.emissiveIntensity = 0.06;
      } else {
        m.emissiveIntensity = i === 3 ? 0.88 * agedTubeDip : 1.15;
      }
    }

    if (exteriorSconceMatRef.current) {
      exteriorSconceMatRef.current.emissiveIntensity = isBlackout ? 0.12 : 1.25;
    }

    if (elevatorBusyLampMatRef.current) {
      elevatorBusyLampMatRef.current.emissiveIntensity = isBlackout
        ? 0.3
        : rubyPulse;
    }

    if (cigaretteEmberMatRef.current) {
      cigaretteEmberMatRef.current.emissiveIntensity =
        0.95 + Math.sin(t * 3.1) * 0.35;
    }

    // Semicircular elevator dial needle stuck twitching at "-3.5" (u = 1/6 -> +PI/3 rad)
    if (elevatorDialNeedleRef.current) {
      elevatorDialNeedleRef.current.rotation.z =
        Math.PI / 3 +
        Math.sin(t * 1.9) * 0.015 +
        (Math.sin(t * 17.3) > 0.96 ? 0.032 : 0);
    }

    // Gently drifting atmospheric bunker dust motes (zero allocations)
    for (let i = 0; i < DUST_MOTE_SEEDS.length; i++) {
      const mesh = dustMoteRefs.current[i];
      if (!mesh) continue;
      mesh.visible = !isBlackout;
      if (isBlackout) continue;
      const s = DUST_MOTE_SEEDS[i];
      mesh.position.x = s.baseX + Math.sin(t * s.speed + s.phase) * 0.08;
      mesh.position.y = s.baseY + Math.cos(t * (s.speed * 0.8) + s.phase) * 0.09;
      mesh.position.z = s.baseZ + Math.sin(t * (s.speed * 0.6) + s.phase * 1.7) * 0.07;
    }
  });

  const posters = useMemo(
    () => [
      {
        key: "poster-atom-peace",
        pos: [-2.26, 2.02, 4.815] as const,
        rotY: 0,
        tex: textures.posterAtomPeace,
      },
      {
        key: "poster-vigilance",
        pos: [-3.775, 2.02, 5.66] as const,
        rotY: Math.PI / 2,
        tex: textures.posterVigilance,
      },
      {
        key: "poster-safety",
        pos: [-3.775, 2.02, 9.34] as const,
        rotY: Math.PI / 2,
        tex: textures.posterSafety,
      },
      {
        key: "poster-energetics",
        pos: [-2.82, 2.02, 10.295] as const,
        rotY: Math.PI,
        tex: textures.posterEnergetics,
      },
    ],
    [textures],
  );

  const shadowboxes = useMemo(
    () => [
      {
        key: "box-graphite",
        pos: [-0.73, 1.96, -0.08] as const,
        ribbonTex: textures.ribbonGraphite,
        plaqueTex: textures.plaqueGraphite,
        medalKind: "star" as const,
      },
      {
        key: "box-paperwork",
        pos: [0.73, 1.96, -0.08] as const,
        ribbonTex: textures.ribbonPaperwork,
        plaqueTex: textures.plaquePaperwork,
        medalKind: "octagon" as const,
      },
      {
        key: "box-shredder",
        pos: [0.73, 1.54, -0.08] as const,
        ribbonTex: textures.ribbonShredder,
        plaqueTex: textures.plaqueShredder,
        medalKind: "discStar" as const,
      },
    ],
    [textures],
  );

  return (
    <group>
      {/* ============================================================
          1. ROOM FLOOR, SUBFLOOR, RUBBER MAT, CEILING & PIPING
         ============================================================ */}
      <mesh
        position={[LOBBY_CENTER_X, -0.055, 7.48]}
        material={mats.subfloor}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <boxGeometry args={[LOBBY_WIDTH + 0.4, 0.04, 6.04]} />
      </mesh>

      <mesh
        position={[LOBBY_CENTER_X, 0, 7.42]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={mats.floor}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <planeGeometry args={[LOBBY_WIDTH + 0.08, 5.85]} />
      </mesh>

      {/* Ribbed Rubber Entrance Mat Inside Airlock Doorway */}
      <mesh
        position={[0, 0.008, 5.36]}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <boxGeometry args={[1.48, 0.012, 0.88]} />
        <meshStandardMaterial
          map={textures.rubberMat}
          roughness={0.88}
          metalness={0.08}
        />
      </mesh>

      {/* Ceiling Slab */}
      <mesh
        position={[LOBBY_CENTER_X, LOBBY_CEILING_Y - 0.01, LOBBY_CENTER_Z]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow={false}
        raycast={NOOP_RAYCAST}
      >
        <planeGeometry args={[LOBBY_WIDTH + 0.3, LOBBY_DEPTH + 0.3]} />
        <meshStandardMaterial color="#2a312e" roughness={0.86} metalness={0.22} />
      </mesh>

      {/* Exposed Concrete Ceiling Ribs */}
      {[5.75, 7.55, 9.35].map((bz, idx) => (
        <mesh
          key={`lobby-cbeam-${idx}`}
          position={[LOBBY_CENTER_X, LOBBY_CEILING_Y - 0.1, bz]}
          material={mats.darkSteel}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[LOBBY_WIDTH, 0.18, 0.18]} />
        </mesh>
      ))}

      {/* 2 Suspended 1984 Soviet Industrial Fluorescent Fixtures (Zero Fake Cones) */}
      {[6.25, 8.85].map((lz, idx) => (
        <group key={`lobby-troffer-${idx}`} position={[LOBBY_CENTER_X, 3.92, lz]}>
          {/* Twin Steel Suspension Drop-Rods & Ceiling Mounting Roses */}
          {([-0.42, 0.42] as const).map((rx, rIdx) => (
            <group key={`drop-${rIdx}`} position={[rx, 0, 0]}>
              <mesh position={[0, 0.145, 0]} geometry={geos.trofferDropRod} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST} />
              <mesh position={[0, 0.26, 0]} geometry={geos.trofferRose} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST} />
            </group>
          ))}
          {/* Central Junction Box & Conduit Feed */}
          <mesh position={[0, 0.245, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.14, 0.045, 0.12]} />
          </mesh>
          <mesh position={[0, 0.135, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.012, 0.012, 0.23, 8]} />
          </mesh>

          {/* Heavy Stamped-Steel Ballast Trough & Upper Cover */}
          <mesh position={[0, 0.02, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.32, 0.075, 0.18]} />
          </mesh>
          <mesh position={[0, 0.06, 0]} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.18, 0.045, 0.14]} />
          </mesh>

          {/* Cast-Steel End-Caps */}
          {([-0.66, 0.66] as const).map((ex, eIdx) => (
            <mesh
              key={`ecap-${eIdx}`}
              position={[ex, -0.01, 0]}
              geometry={geos.trofferEndCap}
              material={mats.darkSteel}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          ))}

          {/* Angled Side Reflector Wings, Matte Enamel Inner Plates & Louver Ribs */}
          {([-1, 1] as const).map((side, sIdx) => (
            <group
              key={`wing-${sIdx}`}
              position={[0, -0.02, side * 0.135]}
              rotation={[side * -0.44, 0, 0]}
            >
              <mesh material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[1.3, 0.014, 0.14]} />
              </mesh>
              <mesh position={[0, -0.008, 0]} material={mats.enamelWhite} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[1.26, 0.006, 0.128]} />
              </mesh>
              {[-0.48, -0.24, 0, 0.24, 0.48].map((lx, lIdx) => (
                <mesh
                  key={`louver-${lIdx}`}
                  position={[lx, -0.004, 0]}
                  material={mats.darkSteel}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <boxGeometry args={[0.012, 0.022, 0.142]} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Twin Continuous Glowing Fluorescent Tubes + Bi-Pin End Sockets */}
          {([-0.068, 0.068] as const).map((tz, tIdx) => {
            const isAgedTube = idx === 1 && tIdx === 1;
            return (
              <group key={`tube-${tIdx}`} position={[0, -0.048, tz]}>
                {([-0.595, 0.595] as const).map((sx, sIdx) => (
                  <mesh
                    key={`sock-${sIdx}`}
                    position={[sx, 0.01, 0]}
                    geometry={geos.trofferSocket}
                    material={mats.bakelite}
                    castShadow={false}
                    raycast={NOOP_RAYCAST}
                  />
                ))}
                <mesh
                  rotation={[0, 0, Math.PI / 2]}
                  geometry={geos.trofferTube}
                  castShadow={false}
                  raycast={NOOP_RAYCAST}
                >
                  <meshStandardMaterial
                    ref={(el) => {
                      trofferTubeMatRefs.current[idx * 2 + tIdx] = el;
                    }}
                    color={isAgedTube ? "#e5d6a8" : "#f2edd8"}
                    emissive={isAgedTube ? "#dbc68c" : "#ebe2c2"}
                    emissiveIntensity={isAgedTube ? 0.88 : 1.15}
                    roughness={0.28}
                  />
                </mesh>
              </group>
            );
          })}

          {/* Protective Steel Wire Cage Under Tubes */}
          {([-0.12, 0.12] as const).map((gz, gIdx) => (
            <mesh
              key={`crail-${gIdx}`}
              position={[0, -0.085, gz]}
              material={mats.darkSteel}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[1.3, 0.012, 0.012]} />
            </mesh>
          ))}
          {[-0.52, -0.31, -0.1, 0.1, 0.31, 0.52].map((bx, bIdx) => (
            <mesh
              key={`cage-${bIdx}`}
              position={[bx, -0.068, 0]}
              geometry={geos.trofferCageRib}
              material={mats.darkSteel}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          ))}
        </group>
      ))}

      {/* Overhead Color-Coded Industrial Pipes, Hanger Brackets & Valve Wheels */}
      <group position={[0, 3.84, 0]}>
        <mesh
          position={[-3.52, 0, LOBBY_CENTER_Z]}
          rotation={[Math.PI / 2, 0, 0]}
          material={mats.pipeRed}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <cylinderGeometry args={[0.048, 0.048, LOBBY_DEPTH - 0.2, 10]} />
        </mesh>
        <mesh
          position={[-3.36, -0.08, LOBBY_CENTER_Z]}
          rotation={[Math.PI / 2, 0, 0]}
          material={mats.pipeYellow}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <cylinderGeometry args={[0.036, 0.036, LOBBY_DEPTH - 0.2, 10]} />
        </mesh>
        <mesh
          position={[1.14, 0, LOBBY_CENTER_Z]}
          rotation={[Math.PI / 2, 0, 0]}
          material={mats.pipeGreen}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <cylinderGeometry args={[0.042, 0.042, LOBBY_DEPTH - 0.2, 10]} />
        </mesh>
        <mesh
          position={[LOBBY_CENTER_X, 0.04, 5.12]}
          rotation={[0, 0, Math.PI / 2]}
          material={mats.pipeRed}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <cylinderGeometry args={[0.042, 0.042, LOBBY_WIDTH - 0.3, 10]} />
        </mesh>
        {/* Pipe Hangers & Flanges */}
        {[5.65, 7.45, 9.25].map((hz, hIdx) => (
          <group key={`pipe-clamp-${hIdx}`}>
            <mesh position={[-3.52, 0.1, hz]} geometry={geos.pipeClamp} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST} />
            <mesh position={[1.14, 0.1, hz]} geometry={geos.pipeClamp} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST} />
          </group>
        ))}
        {/* Overhead Cast-Iron Valve Handwheels */}
        {[
          { pos: [-3.52, -0.1, 6.35] as const, rot: [Math.PI / 2, 0, 0] as const },
          { pos: [1.14, -0.09, 8.65] as const, rot: [Math.PI / 2, 0, 0] as const },
        ].map((v, vIdx) => (
          <group key={`oh-valve-${vIdx}`} position={v.pos} rotation={v.rot}>
            <mesh geometry={geos.valveRim} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST} />
            <mesh geometry={geos.valveSpoke} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST} />
            <mesh rotation={[0, 0, Math.PI / 2]} geometry={geos.valveSpoke} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST} />
            <mesh rotation={[Math.PI / 2, 0, 0]} geometry={geos.hexBolt} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
          </group>
        ))}
      </group>

      {/* Atmospheric Drifting Dust Motes */}
      <group>
        {DUST_MOTE_SEEDS.map((s, idx) => (
          <mesh
            key={`dust-${idx}`}
            ref={(el) => {
              dustMoteRefs.current[idx] = el;
            }}
            position={[s.baseX, s.baseY, s.baseZ]}
            geometry={geos.dustMote}
            material={mats.dustMote}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        ))}
      </group>

      {/* ============================================================
          2. INTERIOR WALLS (NORTH WITH EXIT APERTURE, WEST, SOUTH)
         ============================================================ */}
      <group position={[0, 0, 4.755]}>
        <group position={[-2.32, 0, 0]}>
          <mesh position={[0, 0.775, 0]} material={mats.wainscot} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[2.96, 1.55, 0.07]} />
          </mesh>
          <mesh position={[0, 0.082, 0.04]} material={mats.skirting} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[2.96, 0.156, 0.025]} />
          </mesh>
          <mesh position={[0, 1.535, 0.042]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[2.96, 0.024, 0.028]} />
          </mesh>
          <mesh position={[0, 1.565, 0.044]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[2.96, 0.034, 0.032]} />
          </mesh>
          <mesh position={[0, 2.89, 0]} material={mats.upperWall} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[2.96, 2.62, 0.07]} />
          </mesh>
        </group>

        <group position={[1.12, 0, 0]}>
          <mesh position={[0, 0.775, 0]} material={mats.wainscot} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.56, 1.55, 0.07]} />
          </mesh>
          <mesh position={[0, 0.082, 0.04]} material={mats.skirting} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.56, 0.156, 0.025]} />
          </mesh>
          <mesh position={[0, 1.535, 0.042]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.56, 0.024, 0.028]} />
          </mesh>
          <mesh position={[0, 1.565, 0.044]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.56, 0.034, 0.032]} />
          </mesh>
          <mesh position={[0, 2.89, 0]} material={mats.upperWall} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.56, 2.62, 0.07]} />
          </mesh>
        </group>

        <mesh position={[0, 3.29, 0]} material={mats.upperWall} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.68, 1.82, 0.07]} />
        </mesh>
      </group>

      <group position={[-3.89, 0, LOBBY_CENTER_Z]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0.775, 0]} material={mats.wainscot} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_DEPTH + 0.36, 1.55, 0.18]} />
        </mesh>
        <mesh position={[0, 0.082, 0.095]} material={mats.skirting} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_DEPTH, 0.156, 0.025]} />
        </mesh>
        <mesh position={[0, 1.535, 0.096]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_DEPTH, 0.024, 0.028]} />
        </mesh>
        <mesh position={[0, 1.565, 0.098]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_DEPTH, 0.034, 0.032]} />
        </mesh>
        <mesh position={[0, 2.89, 0]} material={mats.upperWall} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_DEPTH + 0.36, 2.62, 0.18]} />
        </mesh>
        <mesh position={[0, 2.1, -0.1]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_DEPTH + 0.36, LOBBY_CEILING_Y, 0.04]} />
        </mesh>
      </group>

      <group position={[LOBBY_CENTER_X, 0, 10.41]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.775, 0.045]} material={mats.wainscot} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_WIDTH + 0.2, 1.55, 0.09]} />
        </mesh>
        <mesh position={[0, 0.082, 0.095]} material={mats.skirting} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_WIDTH, 0.156, 0.025]} />
        </mesh>
        <mesh position={[0, 1.535, 0.096]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_WIDTH, 0.024, 0.028]} />
        </mesh>
        <mesh position={[0, 1.565, 0.098]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_WIDTH, 0.034, 0.032]} />
        </mesh>
        <mesh position={[0, 2.89, 0.045]} material={mats.upperWall} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_WIDTH + 0.2, 2.62, 0.09]} />
        </mesh>
        <mesh position={[0, 2.1, -0.045]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_WIDTH + 0.36, LOBBY_CEILING_Y, 0.09]} />
        </mesh>
        <mesh position={[0, -5.75, 0]} material={mats.exteriorFoundation} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[LOBBY_WIDTH + 0.36, 11.5, 0.18]} />
        </mesh>
      </group>

      {/* ============================================================
          3. EAST WING WALL + FROSTED WINDOW + CAST-IRON RADIATOR + FIRE CABINET
         ============================================================ */}
      <mesh position={[1.535, 2.1, 4.61]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.09, LOBBY_CEILING_Y, 0.22]} />
      </mesh>
      {[
        { cz: 5.235, len: 1.03, y0: 0, y1: LOBBY_CEILING_Y, hasDado: true },
        { cz: 9.325, len: 2.35, y0: 0, y1: LOBBY_CEILING_Y, hasDado: true },
        { cz: 6.95, len: 2.4, y0: 0, y1: 1.05, hasDado: false },
        { cz: 6.95, len: 2.4, y0: 2.7, y1: LOBBY_CEILING_Y, hasDado: false },
      ].map((seg, sIdx) => {
        const segH = seg.y1 - seg.y0;
        const cy = (seg.y0 + seg.y1) * 0.5;
        return (
          <group key={`east-wall-seg-${sIdx}`} position={[1.49, 0, seg.cz]}>
            <mesh position={[0.045, cy, 0]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.09, segH, seg.len]} />
            </mesh>
            {seg.y1 <= 1.55 ? (
              <mesh position={[-0.045, cy, 0]} material={mats.wainscot} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.09, segH, seg.len]} />
              </mesh>
            ) : seg.y0 >= 1.58 ? (
              <mesh position={[-0.045, cy, 0]} material={mats.upperWall} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.09, segH, seg.len]} />
              </mesh>
            ) : (
              <>
                <mesh position={[-0.045, 0.775, 0]} material={mats.wainscot} castShadow={false} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.09, 1.55, seg.len]} />
                </mesh>
                <mesh position={[-0.045, 2.89, 0]} material={mats.upperWall} castShadow={false} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.09, 2.62, seg.len]} />
                </mesh>
              </>
            )}
            {seg.hasDado && (
              <>
                <mesh position={[-0.096, 1.535, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.028, 0.024, seg.len]} />
                </mesh>
                <mesh position={[-0.098, 1.565, 0]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
                  <boxGeometry args={[0.032, 0.034, seg.len]} />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      <mesh position={[1.39, 0.082, LOBBY_CENTER_Z]} material={mats.skirting} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.025, 0.156, LOBBY_DEPTH]} />
      </mesh>
      <mesh position={[1.535, -5.75, 7.5]} material={mats.exteriorFoundation} castShadow={false} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.09, 11.5, 6.0]} />
      </mesh>

      {/* Exterior Brutalist Concrete Pilasters, Cornice & Pipes */}
      <group>
        {[4.64, 5.66, 8.24, 10.36].map((pz, idx) => (
          <mesh
            key={`ext-pilaster-${idx}`}
            position={[1.61, -2.5, pz]}
            material={mats.exteriorConcrete}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.07, 13.8, 0.22]} />
          </mesh>
        ))}
        <mesh position={[1.605, -0.02, 7.5]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.06, 0.28, 6.08]} />
        </mesh>
        <mesh position={[-1.15, 4.37, 7.5]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[5.64, 0.34, 6.12]} />
        </mesh>
        <mesh position={[1.61, 4.38, 7.5]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.12, 0.06, 6.16]} />
        </mesh>
        <mesh position={[-1.12, 4.58, 7.5]} material={mats.snow} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[5.56, 0.08, 6.04]} />
        </mesh>
        <mesh position={[0.45, 4.78, 7.35]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.92, 0.44, 1.15]} />
        </mesh>
        <mesh position={[0.45, 5.03, 7.35]} material={mats.snow} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.96, 0.06, 1.18]} />
        </mesh>
        <mesh position={[1.61, 1.02, 6.95]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.14, 0.08, 2.5]} />
        </mesh>
        <mesh position={[1.625, 1.07, 6.95]} material={mats.snow} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.1, 0.032, 2.44]} />
        </mesh>
        <group position={[1.615, 0, 0]}>
          <mesh position={[0, 1.9, 5.12]} material={mats.rustSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.042, 0.042, 4.4, 8]} />
          </mesh>
          <mesh
            position={[0, 3.38, 7.5]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.darkSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.032, 0.032, 5.8, 8]} />
          </mesh>
          <mesh position={[0, 1.45, 8.92]} material={mats.pipeRed} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.036, 0.036, 3.2, 8]} />
          </mesh>
          <mesh
            position={[0.04, 1.82, 8.92]}
            rotation={[0, Math.PI / 2, 0]}
            material={mats.pipeRed}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <torusGeometry args={[0.11, 0.016, 6, 12]} />
          </mesh>
          <group position={[0.01, 2.95, 5.26]} rotation={[0, Math.PI / 2, 0]}>
            <mesh material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.18, 0.22, 0.05]} />
            </mesh>
            <mesh position={[0, -0.02, 0.045]} castShadow={false} raycast={NOOP_RAYCAST}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial
                ref={exteriorSconceMatRef}
                color="#ffbb55"
                emissive="#ff9628"
                emissiveIntensity={1.25}
                roughness={0.28}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* Side Frosted-Edge 3-Pane Steel Window Assembly */}
      <group position={[1.49, 1.875, 6.95]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0.805, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.4, 0.05, 0.17]} />
        </mesh>
        <mesh position={[0, -0.805, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.4, 0.05, 0.17]} />
        </mesh>
        <mesh position={[-1.175, 0, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.05, 1.65, 0.17]} />
        </mesh>
        <mesh position={[1.175, 0, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.05, 1.65, 0.17]} />
        </mesh>
        {[-0.39, 0.39].map((mx, idx) => (
          <mesh
            key={`lobby-win-mull-${idx}`}
            position={[mx, 0, 0]}
            material={mats.oliveSteel}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.045, 1.56, 0.09]} />
          </mesh>
        ))}
        <mesh position={[0, 0.36, 0]} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.32, 0.04, 0.08]} />
        </mesh>
        <mesh position={[0, -0.84, 0.06]} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.44, 0.036, 0.24]} />
        </mesh>
        <mesh
          position={[0, 0, 0]}
          material={mats.frostedGlass}
          renderOrder={4}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <planeGeometry args={[2.32, 1.58]} />
        </mesh>
      </group>

      {/* Ribbed Cast-Iron Soviet Steam Radiator Under East Window (With Copper Bleed & Brass Valve) */}
      <group position={[1.31, 0.42, 6.95]}>
        <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.pipeRed} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.022, 0.022, 1.48, 8]} />
        </mesh>
        <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.pipeRed} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.022, 0.022, 1.48, 8]} />
        </mesh>
        {/* Floor supply & return risers */}
        <mesh position={[0, -0.35, -0.74]} material={mats.pipeRed} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.016, 0.016, 0.16, 8]} />
        </mesh>
        <mesh position={[0, -0.35, 0.74]} material={mats.pipeRed} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.016, 0.016, 0.16, 8]} />
        </mesh>
        {/* 14 Paired Cast-Iron Columns */}
        {Array.from({ length: 14 }, (_, idx) => {
          const fz = -0.65 + idx * 0.1;
          return (
            <group key={`rad-fin-${idx}`} position={[0, 0, fz]}>
              <mesh position={[-0.026, 0, 0]} geometry={geos.radiatorFinCol} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST} />
              <mesh position={[0.026, 0, 0]} geometry={geos.radiatorFinCol} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST} />
              <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={geos.radiatorBoss} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST} />
              <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={geos.radiatorBoss} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST} />
            </group>
          );
        })}
        {/* Copper Bleed Valve (Top North End) */}
        <group position={[0, 0.29, -0.75]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.copper} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.016, 0.018, 0.05, 8]} />
          </mesh>
          <mesh position={[0, 0.025, -0.015]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.036, 0.014, 0.012]} />
          </mesh>
        </group>
        {/* Brass Shutoff Valve & Red Handwheel (Bottom South End) */}
        <group position={[-0.02, -0.28, 0.75]}>
          <mesh material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.022, 0.022, 0.06, 8]} />
          </mesh>
          <mesh position={[-0.04, 0.035, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST}>
            <torusGeometry args={[0.042, 0.008, 6, 12]} />
          </mesh>
        </group>
      </group>

      {/* Wall Fire-Hose & Extinguisher Cabinet (East South Pier) */}
      <group position={[1.335, 1.5, 8.62]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.62, 0.82, 0.13]} />
        </mesh>
        <mesh position={[0, 0, 0.068]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.56, 0.76]} />
          <meshStandardMaterial map={textures.fireCabinetTex} roughness={0.44} metalness={0.28} />
        </mesh>
        {/* Interior Coiled Hose & OU-5 CO2 Cylinder Visible Behind Glass */}
        <mesh position={[-0.1, 0.02, 0.025]} material={mats.enamelWhite} castShadow={false} raycast={NOOP_RAYCAST}>
          <torusGeometry args={[0.11, 0.028, 6, 14]} />
        </mesh>
        <mesh position={[0.13, -0.06, 0.025]} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.052, 0.052, 0.36, 10]} />
        </mesh>
        <mesh position={[0.13, 0.14, 0.025]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.014, 0.018, 0.05, 8]} />
        </mesh>
        <mesh position={[0, 0, 0.072]} material={mats.glassCase} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.38, 0.36]} />
        </mesh>
      </group>

      {/* Interior Corner Structural Concrete Pilasters */}
      {[
        [-3.68, 4.91],
        [1.28, 4.91],
        [-3.68, 10.2],
        [1.28, 10.2],
      ].map(([px, pz], idx) => (
        <mesh
          key={`lobby-pil-${idx}`}
          position={[px, LOBBY_CEILING_Y * 0.5, pz]}
          material={mats.darkSteel}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.24, LOBBY_CEILING_Y, 0.24]} />
        </mesh>
      ))}

      {/* ============================================================
          4. HEAVY INDUSTRIAL `LIFT-84` ELEVATOR, TIME CLOCK & KEY RACK
         ============================================================ */}
      <group position={[-0.85, 0, 10.22]} rotation={[0, Math.PI, 0]}>
        {/* Outer Brutalist Concrete Shaft Surround + Dark Recessed Shaft Pocket */}
        <mesh position={[-1.16, 1.32, -0.02]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.14, 2.64, 0.24]} />
        </mesh>
        <mesh position={[1.16, 1.32, -0.02]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.14, 2.64, 0.24]} />
        </mesh>
        <mesh position={[0, 2.6, -0.02]} material={mats.exteriorConcrete} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.46, 0.16, 0.24]} />
        </mesh>

        {/* Inner Riveted Cast-Steel Door Jambs & Lintel */}
        <mesh position={[-1.04, 1.26, 0.01]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.14, 2.52, 0.2]} />
        </mesh>
        <mesh position={[1.04, 1.26, 0.01]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.14, 2.52, 0.2]} />
        </mesh>
        <mesh position={[0, 2.48, 0.01]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.22, 0.14, 0.22]} />
        </mesh>
        {/* Steel Jamb Rivet Rows */}
        {[-1.04, 1.04].map((rx, rIdx) =>
          [0.25, 0.65, 1.05, 1.45, 1.85, 2.25].map((ry, yIdx) => (
            <mesh
              key={`lift-riv-${rIdx}-${yIdx}`}
              position={[rx, ry, 0.112]}
              rotation={[Math.PI / 2, 0, 0]}
              geometry={geos.rivet}
              material={mats.aluminum}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          )),
        )}

        {/* Hazard-Striped Threshold Plate & Grooved Floor Track */}
        <mesh position={[0, 0.014, 0.08]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.16, 0.028, 0.24]} />
        </mesh>
        <mesh position={[0, 0.03, 0.165]} rotation={[-Math.PI / 2, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[2.02, 0.065]} />
          <meshStandardMaterial map={textures.hazardThresholdTex} roughness={0.58} metalness={0.22} />
        </mesh>
        <mesh position={[0, 0.032, 0.045]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.94, 0.012, 0.022]} />
        </mesh>

        {/* Twin Heavy Steel Elevator Doors + Narrow Wired-Glass Inspection Slits */}
        {([-0.49, 0.49] as const).map((lx, dIdx) => (
          <group key={`lift-door-${dIdx}`} position={[lx, 1.22, -0.045]}>
            <mesh castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.96, 2.38, 0.05]} />
              <meshStandardMaterial
                map={textures.elevatorDoorTex}
                roughness={0.56}
                metalness={0.56}
              />
            </mesh>
            {/* Narrow Glass Inspection Peep-Slit */}
            <mesh position={[0, 0.44, 0.027]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.14, 0.44, 0.01]} />
            </mesh>
            <mesh position={[0, 0.44, 0.034]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.09, 0.38]} />
            </mesh>
          </group>
        ))}
        {/* Center Rubber Meeting Seal */}
        <mesh position={[0, 1.22, -0.014]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.034, 2.38, 0.022]} />
        </mesh>

        {/* Collapsible Iron Scissor-Gate / Mesh Grille Layered In Front of Doors */}
        <group position={[0, 1.22, 0.036]}>
          {/* Top & Bottom Gate Channels */}
          <mesh position={[0, 1.18, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.92, 0.03, 0.032]} />
          </mesh>
          <mesh position={[0, -1.17, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.92, 0.03, 0.032]} />
          </mesh>
          {/* 11 Vertical Scissor-Gate Pickets */}
          {Array.from({ length: 11 }, (_, idx) => (
            <mesh
              key={`scissor-picket-${idx}`}
              position={[-0.9 + idx * 0.18, 0, 0]}
              geometry={geos.scissorPicket}
              material={mats.darkSteel}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            />
          ))}
          {/* 3 Tiers of Diamond X-Lattice Scissor Bars Across Pickets */}
          {[-0.68, 0.0, 0.68].map((tierY, tIdx) =>
            Array.from({ length: 10 }, (_, bIdx) => {
              const bx = -0.81 + bIdx * 0.18;
              return (
                <group key={`scissor-x-${tIdx}-${bIdx}`} position={[bx, tierY, 0.008]}>
                  <mesh rotation={[0, 0, 0.58]} geometry={geos.scissorDiagBar} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                  <mesh rotation={[0, 0, -0.58]} geometry={geos.scissorDiagBar} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST} />
                  <mesh rotation={[Math.PI / 2, 0, 0]} geometry={geos.scissorPivot} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                </group>
              );
            }),
          )}
          {/* Vertical Brass Gate Pull Handle on Right Edge */}
          <mesh position={[0.88, -0.08, 0.03]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.013, 0.013, 0.28, 8]} />
          </mesh>
        </group>

        {/* Compact Stamped Aluminum Maintenance Plate Bolted Cleanly to Left Shaft Jamb/Grille Edge */}
        <group position={[-0.86, 1.5, 0.1]} rotation={[0, 0, -0.025]}>
          <mesh material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.38, 0.22, 0.018]} />
          </mesh>
          <mesh position={[0, 0, 0.011]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.35, 0.195]} />
            <meshStandardMaterial
              map={textures.elevatorNoticeTex}
              roughness={0.46}
              metalness={0.42}
            />
          </mesh>
          {([-0.16, 0.16] as const).map((bx) =>
            ([-0.085, 0.085] as const).map((by) => (
              <mesh
                key={`notice-riv-${bx}-${by}`}
                position={[bx, by, 0.012]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geos.rivet}
                material={mats.brass}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            )),
          )}
        </group>

        {/* Illuminated "LIFT BUSY" Ruby Cage Lamp Centered on Header */}
        <group position={[0, 2.5, 0.12]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.068, 0.075, 0.04, 12]} />
          </mesh>
          <mesh position={[0, 0, 0.032]} castShadow={false} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.052, 12, 10]} />
            <meshStandardMaterial
              ref={elevatorBusyLampMatRef}
              color="#ff2a2a"
              emissive="#ff1a1a"
              emissiveIntensity={1.15}
              roughness={0.22}
            />
          </mesh>
          {/* Brass Protective Wire Cage Around Ruby Dome */}
          <mesh position={[0, 0, 0.04]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <torusGeometry args={[0.062, 0.004, 6, 14]} />
          </mesh>
          <mesh position={[0, 0, 0.04]} rotation={[0, Math.PI / 2, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <torusGeometry args={[0.062, 0.004, 6, 14]} />
          </mesh>
        </group>

        {/* Iron Mesh Transom Grille Above Elevator Doors */}
        <group position={[0, 2.78, 0.02]}>
          <mesh position={[0, 0, -0.04]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[2.02, 0.36, 0.02]} />
          </mesh>
          <mesh position={[0, 0.18, 0.02]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[2.08, 0.04, 0.06]} />
          </mesh>
          {Array.from({ length: 13 }, (_, idx) => (
            <mesh
              key={`grille-v-${idx}`}
              position={[-0.96 + idx * 0.16, 0, 0.01]}
              material={mats.darkSteel}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.01, 0.01, 0.36, 6]} />
            </mesh>
          ))}
          {[-0.08, 0.08].map((gy, idx) => (
            <mesh
              key={`grille-h-${idx}`}
              position={[0, gy, 0.014]}
              material={mats.darkSteel}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[2.02, 0.018, 0.018]} />
            </mesh>
          ))}
        </group>

        {/* Vintage Semicircular Brass Floor-Dial Arch (Glass Dome + Brass Pointer at -3.5) */}
        <group position={[0, 3.24, 0.045]}>
          {/* Outer Cast-Brass Arch Frame & Base Sill */}
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.45, 0.47, 0.06, 28, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh position={[0, -0.22, 0.02]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.94, 0.048, 0.075]} />
          </mesh>
          {/* Enamel Semicircular Floor Scale Face */}
          <mesh position={[0, 0, 0.032]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.8, 0.45]} />
            <meshStandardMaterial
              map={textures.elevatorDialTex}
              roughness={0.42}
              metalness={0.14}
            />
          </mesh>
          {/* Physical Brass Pointer Needle Stuck Twitching at -3.5 */}
          <group ref={elevatorDialNeedleRef} position={[0, -0.19, 0.048]}>
            <mesh position={[0, 0.145, 0]} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.02, 0.29, 0.01]} />
            </mesh>
            <mesh position={[0, 0.3, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
              <coneGeometry args={[0.02, 0.048, 4]} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.036, 0.04, 0.024, 12]} />
            </mesh>
          </group>
          {/* Curved Glass Dome Cover */}
          <mesh position={[0, -0.02, 0.058]} material={mats.glassClear} castShadow={false} raycast={NOOP_RAYCAST}>
            <circleGeometry args={[0.4, 24, 0, Math.PI]} />
          </mesh>
        </group>
      </group>

      {/* Unclickable Rusted Call Button Panel + Amber "BUSY" Lamp */}
      <group position={[0.46, 1.24, 10.26]} rotation={[0, Math.PI, 0]}>
        <mesh material={mats.rustSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.2, 0.34, 0.05]} />
        </mesh>
        <mesh position={[0, 0, 0.028]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.17, 0.3]} />
          <meshStandardMaterial
            map={textures.elevatorCallPanelTex}
            roughness={0.62}
            metalness={0.3}
          />
        </mesh>
        <mesh position={[0, 0.075, 0.036]} castShadow={false} raycast={NOOP_RAYCAST}>
          <sphereGeometry args={[0.022, 10, 10]} />
          <meshStandardMaterial
            color="#ffb000"
            emissive="#ff9800"
            emissiveIntensity={1.1}
            roughness={0.28}
          />
        </mesh>
        {[-0.02, -0.085].map((by, bIdx) => (
          <mesh
            key={`lift-btn-${bIdx}`}
            position={[0, by, 0.036]}
            rotation={[Math.PI / 2, 0, 0]}
            material={mats.bakelite}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.018, 0.02, 0.018, 10]} />
          </mesh>
        ))}
      </group>

      {/* Wall-Mounted Metal Key & Badge Rack Beside Elevator */}
      <group position={[0.46, 1.78, 10.26]} rotation={[0, Math.PI, 0]}>
        <mesh material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.36, 0.44, 0.028]} />
        </mesh>
        <mesh position={[0, 0.145, 0.016]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.33, 0.1]} />
          <meshStandardMaterial map={textures.keyRackHeaderTex} roughness={0.44} metalness={0.3} />
        </mesh>
        {/* 2 Brass Hook Rails + Hanging Numbered Brass Tags & Keys */}
        {[0.03, -0.12].map((ry, rIdx) => (
          <group key={`key-row-${rIdx}`} position={[0, ry, 0.018]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.005, 0.005, 0.3, 6]} />
            </mesh>
            {[-0.12, -0.04, 0.04, 0.12].map((kx, kIdx) => {
              const isMissing = rIdx === 0 && kIdx === 2;
              return (
                <group key={`key-slot-${rIdx}-${kIdx}`} position={[kx, 0, 0.008]}>
                  <mesh position={[0, 0, 0.006]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
                    <boxGeometry args={[0.008, 0.012, 0.018]} />
                  </mesh>
                  {isMissing ? (
                    <mesh position={[0, -0.03, 0]} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST}>
                      <boxGeometry args={[0.026, 0.016, 0.004]} />
                    </mesh>
                  ) : (
                    <group rotation={[0, 0, ((rIdx + kIdx) % 3 - 1) * 0.06]}>
                      <mesh position={[0, -0.012, 0.006]} geometry={geos.keyRing} material={mats.chrome} castShadow={false} raycast={NOOP_RAYCAST} />
                      <mesh position={[0, -0.038, 0.006]} geometry={geos.keyTag} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                      <mesh position={[0.006, -0.056, 0.004]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
                        <boxGeometry args={[0.006, 0.038, 0.003]} />
                      </mesh>
                    </group>
                  )}
                </group>
              );
            })}
          </group>
        ))}
      </group>

      {/* Wall-Mounted Punch-Card Time Clock + 6-Slot Card Pocket Rack */}
      <group position={[0.88, 0, 10.24]} rotation={[0, Math.PI, 0]}>
        {/* Main Time Clock Housing (`y = 1.72`) */}
        <group position={[0, 1.72, 0.04]}>
          <mesh material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.32, 0.48, 0.14]} />
          </mesh>
          <mesh position={[0, 0.18, 0.072]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.28, 0.08]} />
            <meshStandardMaterial map={textures.timeClockPlateTex} roughness={0.44} metalness={0.35} />
          </mesh>
          {/* Analog Clock Dial Bezel & Face */}
          <mesh position={[0, 0.02, 0.074]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.105, 0.11, 0.016, 18]} />
          </mesh>
          <mesh position={[0, 0.02, 0.084]} castShadow={false} raycast={NOOP_RAYCAST}>
            <circleGeometry args={[0.095, 18]} />
            <meshStandardMaterial map={textures.timeClockFaceTex} roughness={0.42} metalness={0.12} />
          </mesh>
          {/* Lower Brass Punch Slot With Inserted Timecard */}
          <mesh position={[0, -0.15, 0.074]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.18, 0.044, 0.022]} />
          </mesh>
          <mesh position={[0, -0.145, 0.088]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.13, 0.012, 0.008]} />
          </mesh>
          <mesh position={[0, -0.11, 0.088]} rotation={[-0.08, 0, 0.02]} material={mats.enamelWhite} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.088, 0.08, 0.004]} />
          </mesh>
          {/* Side Steel Stamp Lever & Bakelite Knob */}
          <mesh position={[0.18, -0.02, 0]} rotation={[0, 0, -0.22]} material={mats.chrome} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.008, 0.008, 0.22, 8]} />
          </mesh>
          <mesh position={[0.205, 0.085, 0]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.022, 8, 8]} />
          </mesh>
        </group>

        {/* 6-Slot Metal Timecard Pocket Rack Below Time Clock (`y = 1.18`) */}
        <group position={[0, 1.18, 0]}>
          <mesh material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.28, 0.44, 0.032]} />
          </mesh>
          {[-0.14, -0.08, -0.02, 0.04, 0.1, 0.16].map((sy, sIdx) => (
            <group key={`card-slot-${sIdx}`} position={[0, sy, 0.02]}>
              <mesh material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.22, 0.038, 0.018]} />
              </mesh>
              <mesh
                position={[((sIdx % 3) - 1) * 0.014, 0.036, 0.002]}
                rotation={[0, 0, (sIdx % 2 === 0 ? 1 : -1) * 0.03]}
                material={mats.enamelWhite}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              >
                <boxGeometry args={[0.092, 0.072, 0.004]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* ============================================================
          5. EXECUTIVE WAITING DESK, CUSHIONED CHAIR, BANKER LAMP,
             PRAVDA-84, PODSTAKANNIK TEA GLASS, ASHTRAY & ROTARY PHONE
         ============================================================ */}
      <group position={[0.92, 0, 6.95]}>
        {/* Overhanging Beveled Mahogany Tabletop (`0.74m x 1.34m`, top `y = 0.76m`) */}
        <mesh position={[0, 0.736, 0]} material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.74, 0.048, 1.34]} />
        </mesh>
        {/* Worn Green Baize Desk Blotter */}
        <mesh position={[-0.03, 0.762, 0.02]} material={mats.deskBlotter} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.56, 0.005, 0.88]} />
        </mesh>
        {/* Apron & Center Pencil Drawer */}
        <mesh position={[0, 0.675, -0.14]} material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.64, 0.075, 0.78]} />
        </mesh>
        <mesh position={[-0.325, 0.675, -0.14]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.012, 0.014, 0.08]} />
        </mesh>
        {/* Modesty Back Panel */}
        <mesh position={[0.29, 0.44, 0]} material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.028, 0.54, 1.2]} />
        </mesh>
        {/* Right 3-Drawer Pedestal (`z = +0.26..+0.62`) */}
        <group position={[0, 0.42, 0.44]}>
          <mesh material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.64, 0.58, 0.36]} />
          </mesh>
          {[0.18, 0, -0.18].map((dy, dIdx) => (
            <group key={`desk-drw-${dIdx}`} position={[-0.325, dy, 0]}>
              <mesh material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.016, 0.15, 0.32]} />
              </mesh>
              <mesh position={[-0.012, 0, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.012, 0.018, 0.088]} />
              </mesh>
            </group>
          ))}
        </group>
        {/* Desk Legs + Brass Ferrules */}
        {[
          [-0.31, -0.6],
          [0.31, -0.6],
          [-0.31, 0.6],
          [0.31, 0.6],
        ].map(([lx, lz], idx) => (
          <group key={`desk-leg-${idx}`} position={[lx, 0, lz]}>
            <mesh position={[0, 0.36, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.02, 0.016, 0.72, 8]} />
            </mesh>
            <mesh position={[0, 0.04, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.019, 0.018, 0.08, 8]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Padded Oxblood-Leatherette Tubular Steel Armchair (`x = +0.18, z = +6.75`) */}
      <group position={[0.18, 0, 6.75]} rotation={[0, 1.22, 0]}>
        {/* Bolstered Seat & Backrest Cushions */}
        <mesh position={[0, 0.45, 0.02]} material={mats.vinylChair} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.46, 0.08, 0.46]} />
        </mesh>
        <mesh position={[0, 0.492, 0.02]} material={mats.vinylChair} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.42, 0.02, 0.42]} />
        </mesh>
        <mesh position={[0, 0.78, -0.19]} rotation={[-0.12, 0, 0]} material={mats.vinylChair} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.44, 0.34, 0.075]} />
        </mesh>
        {/* Tuft Buttons on Backrest */}
        {[-0.11, 0.11].map((tx, tIdx) => (
          <mesh
            key={`tuft-${tIdx}`}
            position={[tx, 0.78, -0.15]}
            rotation={[Math.PI / 2, 0, 0]}
            geometry={geos.rivet}
            material={mats.bakelite}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        ))}
        {/* Chrome Tubular Legs + Armrests With Padded Arm Pads */}
        {[-0.2, 0.2].map((cx) =>
          [-0.2, 0.2].map((cz) => (
            <mesh
              key={`chr-leg-${cx}-${cz}`}
              position={[cx, 0.22, cz]}
              material={mats.chrome}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <cylinderGeometry args={[0.013, 0.013, 0.44, 8]} />
            </mesh>
          )),
        )}
        {[-0.22, 0.22].map((ax, aIdx) => (
          <group key={`chr-arm-${aIdx}`} position={[ax, 0.56, 0]}>
            <mesh position={[0, 0.08, 0.02]} material={mats.vinylChair} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.048, 0.028, 0.32]} />
            </mesh>
            <mesh position={[0, -0.02, 0.16]} material={mats.chrome} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.011, 0.011, 0.18, 8]} />
            </mesh>
            <mesh position={[0, -0.02, -0.16]} material={mats.chrome} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.011, 0.011, 0.18, 8]} />
            </mesh>
          </group>
        ))}
        {[-0.17, 0.17].map((cx, idx) => (
          <mesh
            key={`chr-upright-${idx}`}
            position={[cx, 0.64, -0.2]}
            rotation={[-0.1, 0, 0]}
            material={mats.chrome}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.38, 8]} />
          </mesh>
        ))}
      </group>

      {/* Articulated Brass Gooseneck Banker's Lamp */}
      <group position={[1.08, 0.76, 6.46]} rotation={[0, -0.68, 0]}>
        <mesh position={[0, 0.022, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.09, 0.108, 0.044, 16]} />
        </mesh>
        <mesh position={[0.035, 0.048, 0.04]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.024, 0.016, 0.024]} />
        </mesh>
        {/* 4-Segment Articulated Brass Gooseneck + Elbow Knuckles */}
        <mesh position={[0, 0.15, -0.015]} rotation={[-0.22, 0, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.011, 0.013, 0.24, 8]} />
        </mesh>
        <mesh position={[0, 0.265, -0.04]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
          <sphereGeometry args={[0.018, 8, 8]} />
        </mesh>
        <mesh position={[0, 0.35, 0.02]} rotation={[0.58, 0, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.011, 0.011, 0.2, 8]} />
        </mesh>
        <group position={[0, 0.4, 0.12]} rotation={[0.52, 0, 0]}>
          <mesh castShadow={false} raycast={NOOP_RAYCAST}>
            <coneGeometry args={[0.13, 0.14, 16, 1, true]} />
            <meshStandardMaterial
              ref={deskLampShadeMatRef}
              color="#19442c"
              emissive="#ffaa44"
              emissiveIntensity={0.25}
              roughness={0.26}
              metalness={0.38}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, -0.045, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.036, 10, 10]} />
            <meshStandardMaterial
              ref={deskLampBulbMatRef}
              color="#ffe4a8"
              emissive="#ffaa38"
              emissiveIntensity={1.55}
            />
          </mesh>
        </group>
      </group>

      {/* Faceted Russian Tea Glass in Metallic Podstakannik Holder + Spoon + Saucer */}
      <group position={[0.76, 0.76, 6.54]}>
        <mesh position={[0, 0.008, 0]} material={mats.enamelWhite} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.072, 0.052, 0.014, 14]} />
        </mesh>
        <mesh position={[0, 0.017, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST}>
          <torusGeometry args={[0.068, 0.0025, 6, 16]} />
        </mesh>
        {/* Metallic Podstakannik Cup Holder + Handle */}
        <mesh position={[0, 0.042, 0]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.038, 0.036, 0.055, 14, 1, true]} />
        </mesh>
        <mesh position={[0, 0.018, 0]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.038, 0.042, 0.012, 14]} />
        </mesh>
        <mesh position={[0.045, 0.048, 0]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
          <torusGeometry args={[0.022, 0.005, 6, 10]} />
        </mesh>
        {/* 12-Faceted Tea Glass + Dark Amber Tea + Teaspoon */}
        <mesh position={[0, 0.068, 0]} material={mats.glassClear} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.035, 0.032, 0.095, 12]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} material={mats.teaLiquid} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.032, 0.03, 0.07, 12]} />
        </mesh>
        <mesh position={[-0.014, 0.09, 0.008]} rotation={[0.18, 0, 0.34]} material={mats.chrome} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.006, 0.11, 0.003]} />
        </mesh>
      </group>

      {/* Heavy Glass Ashtray With Smoldering Cigarette Ember + Matchbox */}
      <group position={[1.04, 0.76, 7.26]}>
        <mesh position={[0, 0.014, 0]} material={mats.glassClear} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.066, 0.072, 0.028, 12]} />
        </mesh>
        <mesh position={[0, 0.009, 0]} material={mats.aluminum} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.048, 0.05, 0.008, 10]} />
        </mesh>
        <mesh position={[0.014, 0.032, 0.012]} rotation={[0.15, 0.5, Math.PI / 2]} material={mats.enamelWhite} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.005, 0.005, 0.056, 6]} />
        </mesh>
        {/* Pulsing Cigarette Ember */}
        <mesh position={[-0.01, 0.028, -0.002]} castShadow={false} raycast={NOOP_RAYCAST}>
          <sphereGeometry args={[0.006, 6, 6]} />
          <meshStandardMaterial
            ref={cigaretteEmberMatRef}
            color="#ff4818"
            emissive="#ff2a00"
            emissiveIntensity={1.1}
          />
        </mesh>
        <mesh position={[-0.085, 0.011, 0.07]} rotation={[0, 0.35, 0]} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.052, 0.022, 0.036]} />
        </mesh>
      </group>

      {/* Curled Rotary Bakelite Telephone (`VEF TA-68`) */}
      <group position={[0.82, 0.76, 7.43]} rotation={[0, -1.32, 0]}>
        <mesh position={[0, 0.04, 0]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.16, 0.08, 0.19]} />
        </mesh>
        {/* Sloped Rotary Dial Face */}
        <mesh position={[0, 0.082, 0.042]} rotation={[-0.45, 0, 0]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.048, 0.052, 0.016, 16]} />
        </mesh>
        <mesh position={[0, 0.09, 0.045]} rotation={[-Math.PI / 2 - 0.45, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
          <circleGeometry args={[0.044, 16]} />
          <meshStandardMaterial map={textures.rotaryDialTex} roughness={0.38} metalness={0.14} />
        </mesh>
        {/* Chrome Cradle Forks + Handset */}
        {[-0.052, 0.052].map((fx, fIdx) => (
          <mesh key={`ph-fork-${fIdx}`} position={[fx, 0.095, -0.055]} material={mats.chrome} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.006, 0.006, 0.04, 6]} />
          </mesh>
        ))}
        <group position={[0, 0.115, -0.055]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.016, 0.016, 0.18, 8]} />
          </mesh>
          <mesh position={[-0.088, -0.012, 0]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.026, 0.022, 0.028, 10]} />
          </mesh>
          <mesh position={[0.088, -0.012, 0]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.026, 0.022, 0.028, 10]} />
          </mesh>
        </group>
        {/* Coiled Spiral Telephone Cord */}
        {Array.from({ length: 10 }, (_, cIdx) => (
          <mesh
            key={`ph-cord-${cIdx}`}
            position={[-0.095 - cIdx * 0.008, 0.018, -0.02 + Math.sin(cIdx * 0.6) * 0.02]}
            rotation={[0, 0.4, 0]}
            geometry={geos.phoneCordLoop}
            material={mats.bakelite}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        ))}
      </group>

      {/* Stacked 2-Sheet High-Res Multi-Column PRAVDA-84 Broadsheet */}
      <group position={[0.87, 0.766, 6.95]} rotation={[0, -Math.PI / 2 - 0.16, 0]}>
        <mesh position={[0.01, -0.002, 0.01]} rotation={[-Math.PI / 2, 0, 0.06]} material={mats.enamelWhite} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.56, 0.39]} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.58, 0.4]} />
          <meshStandardMaterial
            map={textures.pravdaNewspaperTex}
            roughness={0.86}
            metalness={0.04}
          />
        </mesh>
      </group>

      {/* Battered Soviet Metal Wastebasket Overflowing With Crumpled Directives */}
      <group position={[1.14, 0, 7.82]}>
        <mesh position={[0, 0.19, 0]} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.16, 0.125, 0.38, 12, 1, true]} />
        </mesh>
        <mesh position={[0, 0.01, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.125, 0.125, 0.02, 12]} />
        </mesh>
        <mesh position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <torusGeometry args={[0.16, 0.01, 6, 14]} />
        </mesh>
        {[
          [0, 0.31, 0, 0.2],
          [-0.06, 0.34, 0.05, 0.9],
          [0.06, 0.33, -0.04, 1.5],
          [-0.04, 0.38, -0.06, 2.2],
          [0.05, 0.39, 0.05, 0.4],
          [0, 0.42, 0.01, 1.8],
          [-0.08, 0.35, -0.01, 2.7],
          [0.07, 0.36, 0.01, 1.1],
        ].map(([cx, cy, cz, rot], pIdx) => (
          <mesh
            key={`crumpled-${pIdx}`}
            position={[cx, cy, cz]}
            rotation={[rot, rot * 1.4, rot * 0.7]}
            geometry={geos.crumpledPaper}
            material={mats.enamelWhite}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          />
        ))}
        {/* Stray crumpled directive resting on the linoleum beside wastebasket */}
        <mesh
          position={[-0.22, 0.036, 0.11]}
          rotation={[0.4, 1.1, 0.7]}
          geometry={geos.crumpledPaper}
          material={mats.enamelWhite}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        />
      </group>

      {/* ============================================================
          6. MUSEUM-GRADE HONOR CABINET (`HONOR WALL OF SECTOR 84`),
             VELVET MEDAL SHADOWBOXES, SCULPTED RBMK TROPHY & BUST
         ============================================================ */}
      <group position={[-3.54, 0, 7.45]} rotation={[0, Math.PI / 2, 0]}>
        {/* Lower Mahogany Plinth & 3-Door Credenza (`y = 0..0.81`) */}
        <mesh position={[0, 0.03, 0]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.22, 0.06, 0.46]} />
        </mesh>
        <mesh position={[0, 0.41, 0]} material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.22, 0.7, 0.46]} />
        </mesh>
        {[-0.73, 0, 0.73].map((dx, dIdx) => (
          <group key={`cab-door-${dIdx}`} position={[dx, 0.41, 0.236]}>
            <mesh material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.66, 0.58, 0.018]} />
            </mesh>
            <mesh position={[dx < 0 ? 0.24 : -0.24, 0.04, 0.014]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.022, 0.065, 0.014]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.785, 0.015]} material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.3, 0.05, 0.51]} />
        </mesh>

        {/* Velvet Backplate & Upper Cabinet Frame (`y = 0.81..2.18`) */}
        <mesh position={[0, 1.5, -0.21]} material={mats.velvet} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.18, 1.38, 0.04]} />
        </mesh>
        {[-1.09, -0.37, 0.37, 1.09].map((sx, idx) => (
          <mesh
            key={`cab-upright-${idx}`}
            position={[sx, 1.5, 0]}
            material={mats.mahogany}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[idx === 0 || idx === 3 ? 0.055 : 0.036, 1.38, 0.44]} />
          </mesh>
        ))}
        {[1.32, 1.76, 2.18].map((sy, idx) => (
          <mesh
            key={`cab-shelf-${idx}`}
            position={[0, sy, 0]}
            material={mats.mahogany}
            castShadow={false}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[2.22, 0.038, 0.44]} />
          </mesh>
        ))}

        {/* Stepped Crown Molding + Engraved Brass Top Header ("HONOR WALL OF SECTOR 84") */}
        <mesh position={[0, 2.27, 0.02]} material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[2.32, 0.18, 0.5]} />
        </mesh>
        <mesh position={[0, 2.27, 0.276]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[1.48, 0.2, 0.014]} />
        </mesh>
        <mesh position={[0, 2.27, 0.285]} castShadow={false} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[1.44, 0.18]} />
          <meshStandardMaterial map={textures.plaqueHonorHeader} roughness={0.34} metalness={0.48} />
        </mesh>

        {/* Warm Interior Showcase Strip Lights */}
        {[-0.73, 0, 0.73].map((lx, lIdx) => (
          <mesh key={`cab-strip-${lIdx}`} position={[lx, 2.14, 0.14]} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.56, 0.016, 0.024]} />
            <meshStandardMaterial color="#ffdf9e" emissive="#ffb854" emissiveIntensity={1.25} />
          </mesh>
        ))}

        {/* Glass-Fronted Upper Display Doors */}
        {[-0.73, 0, 0.73].map((gx, gIdx) => (
          <mesh key={`cab-glass-${gIdx}`} position={[gx, 1.5, 0.215]} material={mats.glassCase} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.67, 1.32]} />
          </mesh>
        ))}

        {/* 3 Velvet-Backed Framed Medal Shadowboxes */}
        {shadowboxes.map((box) => (
          <group key={box.key} position={box.pos}>
            <mesh material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.44, 0.34, 0.044]} />
            </mesh>
            <mesh position={[0, 0.02, 0.02]} material={mats.velvet} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.38, 0.25, 0.01]} />
            </mesh>
            {/* Pentagonal Striped Silk Ribbon */}
            <mesh position={[0, 0.075, 0.029]} geometry={geos.medalPentagonRibbon} castShadow={false} raycast={NOOP_RAYCAST}>
              <meshStandardMaterial map={box.ribbonTex} roughness={0.78} metalness={0.08} />
            </mesh>
            {/* Sculpted Multi-Part Soviet Order / Medal */}
            <group position={[0, 0.012, 0.032]}>
              {box.medalKind === "star" && (
                <>
                  <mesh geometry={geos.medalStar} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST} />
                  <mesh position={[0, 0, 0.005]} rotation={[Math.PI / 2, 0, 0]} geometry={geos.medalInnerRing} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                  <mesh position={[0, 0, 0.006]} geometry={geos.atomNucleus} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                </>
              )}
              {box.medalKind === "octagon" && (
                <>
                  <mesh rotation={[Math.PI / 2, 0, 0]} geometry={geos.medalOctagon} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                  <mesh position={[0, 0, 0.006]} rotation={[Math.PI / 2, 0, 0]} geometry={geos.medalInnerRing} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST} />
                </>
              )}
              {box.medalKind === "discStar" && (
                <>
                  <mesh rotation={[Math.PI / 2, 0, 0]} geometry={geos.medalDisc} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
                  <mesh position={[0, 0, 0.006]} geometry={geos.medalStar} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST} />
                </>
              )}
            </group>
            {/* Brass Museum Nameplate */}
            <mesh position={[0, -0.125, 0.025]} castShadow={false} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.36, 0.075]} />
              <meshStandardMaterial map={box.plaqueTex} roughness={0.38} metalness={0.44} />
            </mesh>
            {/* Shadowbox Protective Glass */}
            <mesh position={[0, 0, 0.028]} material={mats.glassClear} castShadow={false} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.39, 0.29]} />
            </mesh>
          </group>
        ))}

        {/* Top Center: Mechanical Flip-Digit Incident Counter ("0 | 0 | 0" DAYS WITHOUT WESTERN ENVY) */}
        <group position={[0, 1.95, -0.02]}>
          <mesh material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.62, 0.28, 0.07]} />
          </mesh>
          {[-0.17, 0, 0.17].map((fx, fIdx) => (
            <mesh key={`flip-${fIdx}`} position={[fx, 0.032, 0.038]} castShadow={false} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.135, 0.175]} />
              <meshStandardMaterial map={textures.flipDigitZero} roughness={0.44} metalness={0.18} />
            </mesh>
          ))}
          <mesh position={[0, -0.095, 0.038]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.56, 0.072]} />
            <meshStandardMaterial map={textures.plaqueEnvyHeader} roughness={0.42} metalness={0.36} />
          </mesh>
        </group>

        {/* Middle Left: Miniature RBMK Cooling Tower + Golden Atom Trophy on Stepped Black-Marble Plinth */}
        <group position={[-0.73, 1.34, 0.01]}>
          <mesh position={[0, 0.025, 0]} material={mats.blackMarble} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.24, 0.05, 0.2]} />
          </mesh>
          <mesh position={[0, 0.065, 0]} material={mats.blackMarble} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.18, 0.03, 0.15]} />
          </mesh>
          <mesh position={[0, 0.042, 0.102]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.21, 0.046]} />
            <meshStandardMaterial map={textures.plaqueButtonPress} roughness={0.36} metalness={0.45} />
          </mesh>
          {/* Hyperbolic Cooling Tower */}
          <mesh position={[0, 0.08, 0]} geometry={geos.coolingTowerLathe} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
          {/* Golden Atom Sculpture Above Cooling Tower */}
          <group position={[0, 0.31, 0]}>
            <mesh geometry={geos.atomNucleus} material={mats.crimson} castShadow={false} raycast={NOOP_RAYCAST} />
            {([0.55, -0.55, 1.57] as const).map((rotZ, rIdx) => (
              <mesh
                key={`atom-orb-${rIdx}`}
                rotation={[0.45, rIdx * 0.85, rotZ]}
                geometry={geos.atomOrbitRing}
                material={mats.brass}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            ))}
            <mesh position={[0.062, 0.025, 0]} geometry={geos.atomElectron} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
            <mesh position={[-0.055, -0.035, 0.02]} geometry={geos.atomElectron} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST} />
          </group>
        </group>

        {/* Middle Center: Cast-Bronze Socialist Realist Bust on Stepped Pedestal */}
        <group position={[0, 1.34, 0.01]}>
          <mesh position={[0, 0.03, 0]} material={mats.blackMarble} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.22, 0.06, 0.2]} />
          </mesh>
          <mesh position={[0, 0.04, 0.102]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.19, 0.044]} />
            <meshStandardMaterial map={textures.plaqueBust} roughness={0.36} metalness={0.45} />
          </mesh>
          {/* Sculpted Aged-Bronze Greatcoat Shoulders, Collar, Head & Brow */}
          <group position={[0, 0.06, 0]}>
            <mesh position={[0, 0.075, 0]} material={mats.bronzePatina} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.21, 0.11, 0.11]} />
            </mesh>
            <mesh position={[0, 0.13, 0.02]} material={mats.bronzePatina} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.11, 0.045, 0.085]} />
            </mesh>
            <mesh position={[0, 0.165, 0]} material={mats.bronzePatina} castShadow={false} raycast={NOOP_RAYCAST}>
              <cylinderGeometry args={[0.034, 0.042, 0.055, 10]} />
            </mesh>
            {/* Angular Cranium + Jaw + Brow + Hair Crown */}
            <mesh position={[0, 0.235, 0]} material={mats.bronzePatina} castShadow={false} raycast={NOOP_RAYCAST}>
              <sphereGeometry args={[0.064, 12, 10]} />
            </mesh>
            <mesh position={[0, 0.205, 0.025]} material={mats.bronzePatina} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.072, 0.052, 0.064]} />
            </mesh>
            {/* Stern Brow Ridge & Nose Bridge */}
            <mesh position={[0, 0.248, 0.055]} material={mats.bronzePatina} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.074, 0.018, 0.024]} />
            </mesh>
            <mesh position={[0, 0.228, 0.064]} rotation={[-0.25, 0, 0]} material={mats.bronzePatina} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.018, 0.036, 0.022]} />
            </mesh>
            {/* Swept-Back Hair Crown */}
            <mesh position={[0, 0.285, -0.01]} material={mats.bronzePatina} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.094, 0.036, 0.1]} />
            </mesh>
          </group>
        </group>

        {/* Bottom Left: Vintage Soviet DP-5V Geiger Counter */}
        <group position={[-0.72, 0.81, 0.02]} rotation={[0, 0.18, 0]}>
          <mesh position={[0, 0.07, 0]} material={mats.oliveSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.26, 0.14, 0.16]} />
          </mesh>
          <mesh position={[0, 0.142, -0.02]} material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.18, 0.024, 0.03]} />
          </mesh>
          <mesh position={[-0.04, 0.082, 0.082]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.12, 0.064]} />
            <meshStandardMaterial map={textures.geigerDialTex} roughness={0.44} metalness={0.14} />
          </mesh>
          <mesh position={[0.075, 0.075, 0.086]} rotation={[Math.PI / 2, 0, 0]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.024, 0.028, 0.018, 10]} />
          </mesh>
          {/* Clipped Chrome Probe Wand */}
          <mesh position={[0.04, 0.165, 0.03]} rotation={[0, 0, Math.PI / 2]} material={mats.chrome} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.016, 0.016, 0.24, 10]} />
          </mesh>
        </group>

        {/* Bottom Center: Quota Certificate Plaque Stand */}
        <group position={[-0.02, 0.81, 0.03]}>
          <mesh position={[0, 0.02, 0]} material={mats.mahogany} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.38, 0.04, 0.12]} />
          </mesh>
          <group position={[0, 0.12, -0.01]} rotation={[-0.24, 0, 0]}>
            <mesh material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.36, 0.15, 0.022]} />
            </mesh>
            <mesh position={[0, 0, 0.013]} castShadow={false} raycast={NOOP_RAYCAST}>
              <planeGeometry args={[0.33, 0.125]} />
              <meshStandardMaterial map={textures.plaqueQuotaCert} roughness={0.4} metalness={0.32} />
            </mesh>
          </group>
        </group>

        {/* Bottom Right: 4 Cloth-Bound Soviet Technical Binders (`RBMK-1000 MANUAL VOL 1-4 [REDACTED]`) */}
        <group position={[0.56, 0.81, 0.02]}>
          {[0, 1, 2, 3].map((bIdx) => (
            <mesh
              key={`binder-${bIdx}`}
              position={[bIdx * 0.075 + (bIdx === 3 ? 0.03 : 0), 0.155, 0]}
              rotation={[0, 0, bIdx === 3 ? -0.18 : 0]}
              castShadow={false}
              raycast={NOOP_RAYCAST}
            >
              <boxGeometry args={[0.064, 0.31, 0.24]} />
              <meshStandardMaterial
                map={textures.binderSpines[bIdx]}
                roughness={0.78}
                metalness={0.08}
              />
            </mesh>
          ))}
          <mesh position={[0.34, 0.07, 0]} material={mats.brass} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.02, 0.14, 0.16]} />
          </mesh>
        </group>
      </group>

      {/* ============================================================
          7. FOUR ILLUSTRATED 1984 CONSTRUCTIVIST POSTERS IN BOLTED FRAMES
         ============================================================ */}
      {posters.map((p) => (
        <group key={p.key} position={p.pos} rotation={[0, p.rotY, 0]}>
          {/* Heavy Bolted Dark-Steel Frame */}
          <mesh material={mats.darkSteel} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.88, 1.205, 0.032]} />
          </mesh>
          <mesh position={[0, 0, 0.015]} material={mats.bakelite} castShadow={false} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.825, 1.15, 0.008]} />
          </mesh>
          {/* Poster Canvas Plane (512x720 Aspect Locked) */}
          <mesh position={[0, 0, 0.02]} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.8, 1.125]} />
            <meshStandardMaterial
              map={p.tex}
              roughness={0.56}
              metalness={0.06}
            />
          </mesh>
          {/* Protective Specular Frame Glass */}
          <mesh position={[0, 0, 0.024]} material={mats.glassClear} castShadow={false} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.805, 1.13]} />
          </mesh>
          {/* 4 Brass Corner Frame Bolts */}
          {([-0.405, 0.405] as const).map((bx) =>
            ([-0.565, 0.565] as const).map((by) => (
              <mesh
                key={`pbolt-${p.key}-${bx}-${by}`}
                position={[bx, by, 0.02]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geos.hexBolt}
                material={mats.brass}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            )),
          )}
        </group>
      ))}

      {/* ============================================================
          8. LUSH POTTED RUBBER PLANT (`FICUS ELASTICA` — ASSET #04)
         ============================================================ */}
      <group position={[0.86, 0, 9.45]}>
        {/* Drainage Saucer */}
        <mesh position={[0, 0.022, 0]} material={mats.rustSteel} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.24, 0.21, 0.044, 16]} />
        </mesh>
        {/* Glazed Terracotta Planter With Rolled Rim & Red Star */}
        <mesh position={[0, 0.24, 0]} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.22, 0.155, 0.4, 16]} />
          <meshStandardMaterial map={textures.potTerracottaTex} roughness={0.58} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.425, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.copper} castShadow={false} raycast={NOOP_RAYCAST}>
          <torusGeometry args={[0.215, 0.02, 8, 18]} />
        </mesh>
        <mesh position={[0, 0.43, 0]} material={mats.soil} castShadow={false} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.2, 0.2, 0.02, 14]} />
        </mesh>
        {/* Tiny Stamped Brass Asset Tag Wired to Rim */}
        <mesh
          position={[-0.08, 0.32, 0.195]}
          rotation={[0.16, -0.35, 0]}
          castShadow={false}
          raycast={NOOP_RAYCAST}
        >
          <boxGeometry args={[0.2, 0.075, 0.01]} />
          <meshStandardMaterial map={textures.plantTagTex} roughness={0.42} metalness={0.45} />
        </mesh>

        {/* Branching Woody Stems + 15 Sculpted Broad Glossy Ficus Elastica Leaves */}
        <group position={[0, 0.43, 0]}>
          <mesh position={[0, 0.56, 0]} rotation={[0.04, 0, -0.05]} material={mats.plantStem} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.012, 0.026, 1.12, 8]} />
          </mesh>
          <mesh position={[-0.06, 0.36, 0.03]} rotation={[0.22, 0, 0.36]} material={mats.plantStem} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.008, 0.014, 0.46, 6]} />
          </mesh>
          <mesh position={[0.06, 0.48, -0.03]} rotation={[-0.2, 0, -0.32]} material={mats.plantStem} castShadow={false} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.008, 0.014, 0.48, 6]} />
          </mesh>

          {FICUS_LEAF_LAYOUT.map((leaf, lIdx) => (
            <group
              key={`ficus-leaf-${lIdx}`}
              position={leaf.pos}
              rotation={[0, leaf.rot[1], 0]}
              scale={leaf.scale}
            >
              <mesh
                rotation={[leaf.rot[0], 0, leaf.rot[2]]}
                geometry={geos.ficusLeaf}
                material={lIdx % 2 === 0 ? mats.plantLeaf : mats.plantLeafAlt}
                castShadow={false}
                raycast={NOOP_RAYCAST}
              />
            </group>
          ))}
        </group>
      </group>

      {/* ============================================================
          9. LOBBY LIGHTING (CASTSHADOW=FALSE, STRICT CUTOFF DISTANCE)
         ============================================================ */}
      <pointLight
        ref={ceilingNorthLightRef}
        castShadow={false}
        position={[LOBBY_CENTER_X, 3.62, 6.45]}
        color="#eee4ca"
        intensity={5.0}
        distance={6.5}
        decay={2}
      />

      <pointLight
        ref={ceilingSouthLightRef}
        castShadow={false}
        position={[LOBBY_CENTER_X, 3.62, 8.85]}
        color="#e8dfc4"
        intensity={4.8}
        distance={7.2}
        decay={2}
      />

      <pointLight
        ref={cabinetLightRef}
        castShadow={false}
        position={[-3.18, 1.78, 7.45]}
        color="#ffce7a"
        intensity={2.6}
        distance={4.2}
        decay={2}
      />

      <pointLight
        ref={deskLampLightRef}
        castShadow={false}
        position={[0.88, 1.24, 6.72]}
        color="#ffaa42"
        intensity={4.2}
        distance={4.2}
        decay={2}
      />

      <pointLight
        ref={elevatorRubyLightRef}
        castShadow={false}
        position={[-0.85, 2.5, 9.95]}
        color="#ff2a2a"
        intensity={0.8}
        distance={3.0}
        decay={2}
      />

      <pointLight
        ref={airlockSignLightRef}
        castShadow={false}
        position={[0, 2.72, 5.05]}
        color="#33ff66"
        intensity={0.58}
        distance={2.6}
        decay={2}
      />

      <pointLight
        ref={lobbyFillLightRef}
        castShadow={false}
        position={[LOBBY_CENTER_X, 2.15, 7.85]}
        color="#f0dfc0"
        intensity={2.4}
        distance={6.2}
        decay={2}
      />

      <LobbyDiegeticMenu3D />
    </group>
  );
});
