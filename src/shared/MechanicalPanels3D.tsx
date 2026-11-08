import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  playBoronHydraulicPumpStroke,
  playDetentClick,
  playKnifeSwitchSlam,
  playPneumaticWhoosh,
  playSafetyCoverFlip,
  playSteamVentHiss,
  playValveWheelSqueak,
} from "../modules/inspector/audio";
import {
  playGeigerClick,
  playKlaxonBurst,
  playLeverRatchet,
  playSwitchClank,
} from "../modules/reactor/audioSynth";
import {
  startSoundtrack,
  updateSoundtrackState,
} from "../modules/reactor/soundtrackPlayer";
import { useCameraLookStore } from "./CameraController";
import {
  applySovietPBRToHierarchy,
  getBrushedBrassTextures,
  getHammeredIronTextures,
} from "./proceduralMaterials";
import type { SectorNodeId } from "./types";
import { useGameStore } from "./useGameStore";

function createCrispPanelTexture(
  width: number,
  height: number,
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    draw?.(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Draws centered plaque text guaranteed to stay within `w - 20` (10px minimum padding on left & right)
 * using `font-weight: 900`, clean letter-spacing, and a dark `#000000` outer outline drawn BEHIND
 * `fillText` so bright letter interiors (`O`, `P`, `A`, `B`, `R`, `8`, `6`) stay 100% crisp and open!
 */
export function drawFittedPlaqueText( // oxlint-disable-line react/only-export-components
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  canvasWidth: number,
  font: string,
  color: string,
  strokeColor?: string,
  strokeWidth = 2.8,
  letterSpacing = "2px",
): void {
  ctx.save();
  const heavyFont = font.replace(/^bold\s+/i, "900 ");
  ctx.font = heavyFont;
  const ctxWithSpacing = ctx as CanvasRenderingContext2D & {
    letterSpacing?: string;
  };
  if ("letterSpacing" in ctxWithSpacing) {
    ctxWithSpacing.letterSpacing = letterSpacing;
  }
  ctx.fillStyle = color;
  // Never stroke in the same bright color as fill (which blobs counters shut); always use a dark outline behind fill!
  const effectiveStroke =
    strokeColor && strokeColor.toLowerCase() !== color.toLowerCase()
      ? strokeColor
      : "#000000";
  ctx.strokeStyle = effectiveStroke;
  ctx.lineWidth = strokeWidth > 0 ? Math.max(2.4, strokeWidth) : 0;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.textAlign = "center";
  const maxAllowedW = Math.max(40, canvasWidth - 20);
  const measuredW = ctx.measureText(text).width;
  const scaleX = measuredW > maxAllowedW ? maxAllowedW / measuredW : 1;
  ctx.translate(cx, y);
  if (scaleX < 1) {
    ctx.scale(scaleX, 1);
  }
  if (ctx.lineWidth > 0) {
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Shared generator for brass-bordered 3D station plaques across UNIT A, UNIT A-2, UNIT B, and UNIT C.
 * Uses clean wide industrial sans-serif (`Segoe UI Black` / `Arial Black` / `Consolas`) with letter-spacing
 * and a dark `#000000` outer drop-shadow/outline so letter interiors never blob together.
 */
export function makePlaqueTex( // oxlint-disable-line react/only-export-components
  title: string,
  subtitle: string,
  options?: {
    width?: number;
    height?: number;
    bgColor?: string;
    borderColor?: string;
    titleColor?: string;
    titleStroke?: string;
    subColor?: string;
    subStroke?: string;
    titleSize?: number;
    subSize?: number;
  },
): THREE.CanvasTexture {
  const w = options?.width ?? 384;
  const h = options?.height ?? 128;
  const bgColor = options?.bgColor ?? "#121614";
  const borderColor = options?.borderColor ?? "#c8b06b";
  const titleColor = options?.titleColor ?? "#ffffff";
  const subColor = options?.subColor ?? "#ffe066";
  const titleSize = options?.titleSize ?? 48;
  const subSize = options?.subSize ?? 36;

  return createCrispPanelTexture(w, h, (ctx, cw, ch) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, cw - 6, ch - 6);
    if (!subtitle.trim()) {
      drawFittedPlaqueText(
        ctx,
        title,
        cw / 2,
        Math.round(ch * 0.66),
        cw,
        `900 ${Math.round(titleSize * 1.22)}px "Segoe UI Black", "Arial Black", "Impact", "Consolas", sans-serif`,
        titleColor,
        "#000000",
        3.8,
        "3px",
      );
    } else {
      drawFittedPlaqueText(
        ctx,
        title,
        cw / 2,
        Math.round(ch * 0.44),
        cw,
        `900 ${titleSize}px "Segoe UI Black", "Arial Black", "Impact", "Consolas", sans-serif`,
        titleColor,
        "#000000",
        3.6,
        "3px",
      );
      drawFittedPlaqueText(
        ctx,
        subtitle,
        cw / 2,
        Math.round(ch * 0.85),
        cw,
        `900 ${subSize}px "Segoe UI Black", "Arial Black", "Consolas", sans-serif`,
        subColor,
        "#000000",
        3.2,
        "2.5px",
      );
    }
  });
}

let cachedRibbedGlassTex: THREE.CanvasTexture | null = null;

/**
 * Shared procedural ribbed phosphor/Nixie glass cell texture:
 * Fine horizontal cathode filament lines, vertical fluted glass ribs, and dark edge vignette.
 */
function getRibbedGlassCellTexture(): THREE.CanvasTexture {
  if (cachedRibbedGlassTex) return cachedRibbedGlassTex;
  cachedRibbedGlassTex = createCrispPanelTexture(128, 64, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      4,
      w * 0.5,
      h * 0.5,
      w * 0.58,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.7, "#d4dcd6");
    grad.addColorStop(1, "#4a544e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Vertical fluted glass lens ribs
    for (let x = 0; x < w; x += 6) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
      ctx.fillRect(x + 2, 0, 1, h);
    }

    // Fine horizontal CRT/Nixie cathode mesh lines
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }

    // Dark recessed glass border frame
    ctx.strokeStyle = "rgba(10, 14, 12, 0.65)";
    ctx.lineWidth = 4;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  });
  return cachedRibbedGlassTex;
}

function captureCanvasPointer(e: ThreeEvent<PointerEvent>): void {
  (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
  const domElem = e.nativeEvent.target as Element | null;
  domElem?.setPointerCapture?.(e.pointerId);
}

function releaseCanvasPointer(e: ThreeEvent<PointerEvent>): void {
  const r3fTarget = e.target as Element | null;
  if (r3fTarget?.hasPointerCapture?.(e.pointerId)) {
    r3fTarget.releasePointerCapture(e.pointerId);
  }
  const domElem = e.nativeEvent.target as Element | null;
  if (domElem?.hasPointerCapture?.(e.pointerId)) {
    domElem.releasePointerCapture(e.pointerId);
  }
}

/**
 * Effortless Rotary Handwheel Drag + Click-to-Step (+25%) Fallback:
 * - Dragging just 40px up/right or down/left (OR rotating around the wheel hub) smoothly sweeps 0% -> 100%!
 * - Clicking without dragging (`< 6px` movement) automatically steps the valve by +25% (or wraps 100% -> 0% if already at max).
 */
function startSmoothWheelSwivelDrag(
  e: ThreeEvent<PointerEvent>,
  wheelObject: THREE.Object3D | null,
  initialValue: number,
  minVal: number,
  maxVal: number,
  onChange: (nextVal: number) => void,
): void {
  if (useCameraLookStore.getState().isFreeLookMode) return;
  e.stopPropagation();

  const r3fTarget = e.target as unknown as {
    setPointerCapture?: (id: number) => void;
    releasePointerCapture?: (id: number) => void;
  };
  r3fTarget?.setPointerCapture?.(e.pointerId);

  let currentVal = initialValue;
  let prevX = e.nativeEvent.clientX;
  let prevY = e.nativeEvent.clientY;
  let totalMoveDist = 0;
  const range = maxVal - minVal;
  let lastSoundStep = Math.floor(((currentVal - minVal) / range) * 16);

  const handleMove = (ev: PointerEvent) => {
    const dx = ev.clientX - prevX;
    const dy = ev.clientY - prevY;
    prevX = ev.clientX;
    prevY = ev.clientY;
    if (dx === 0 && dy === 0) return;

    totalMoveDist += Math.hypot(dx, dy);

    // Smooth, monotonic linear drag (right or up = increase; left or down = decrease)
    const deltaRatio = (dx - dy) / 110;

    currentVal = THREE.MathUtils.clamp(
      currentVal + deltaRatio * range,
      minVal,
      maxVal,
    );
    if (wheelObject) {
      wheelObject.rotation.z -= deltaRatio * Math.PI * 1.5;
    }
    onChange(currentVal);

    const soundStep = Math.floor(((currentVal - minVal) / range) * 16);
    if (soundStep !== lastSoundStep) {
      lastSoundStep = soundStep;
      playValveWheelSqueak((Math.abs(soundStep) % 6) + 1);
    }
  };

  const handleUp = () => {
    r3fTarget?.releasePointerCapture?.(e.pointerId);
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    window.removeEventListener("pointercancel", handleUp);

    // Click-to-Step (+25%) fallback if the player clicked without dragging (< 6px movement)
    if (totalMoveDist < 6) {
      const stepped =
        initialValue >= maxVal - range * 0.05
          ? minVal
          : Math.min(
              maxVal,
              Math.round((initialValue + range * 0.25) / (range * 0.25)) *
                (range * 0.25),
            );
      playValveWheelSqueak(3);
      playSwitchClank(true);
      onChange(stepped);
      return;
    }

    playSwitchClank(false);
  };

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleUp);
}

const BOLT_ANGLES_8 = [
  0,
  Math.PI * 0.25,
  Math.PI * 0.5,
  Math.PI * 0.75,
  Math.PI,
  Math.PI * 1.25,
  Math.PI * 1.5,
  Math.PI * 1.75,
];

export interface SovietCRTMonitorBay3DProps {
  position: [number, number, number];
  screenMatRef: React.RefObject<THREE.MeshStandardMaterial | null>;
  screenTexture: THREE.CanvasTexture;
  modelBadge?: string;
}

/**
 * Authentic 1984 Soviet Phosphor-Green CRT Monitor Bay (`ЭЛЕКТРОНИКА ВЛ-84`).
 * Features a deep molded Bakelite & cast-iron CRT bezel hood, recessed dark phosphor tube cavity,
 * CRT screen with oscilloscope graticule, scanlines & phosphor bloom, side contrast/vertical-hold
 * knurled knobs, and a glowing green filament indicator lamp.
 */
export const SovietCRTMonitorBay3D: React.FC<SovietCRTMonitorBay3DProps> = ({
  position,
  screenMatRef,
  screenTexture,
  modelBadge = "ЭЛТ ВЛ-84",
}) => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const badgeTex = useMemo(
    () =>
      createCrispPanelTexture(128, 36, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 16px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText(modelBadge, w / 2, 24);
      }),
    [modelBadge],
  );

  return (
    <group position={position}>
      {/* 1. Deep Recessed CRT Tube Cavity Backing Plate (At z = 0.002 -> 24mm behind screen plane for zero Z-fighting!) */}
      <mesh position={[0, 0, 0.002]} castShadow receiveShadow>
        <boxGeometry args={[1.54, 0.285, 0.016]} />
        <meshStandardMaterial
          color="#0d1310"
          roughness={0.55}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
        />
      </mesh>

      {/* 2. Molded 4-Sided Thick Cast-Iron & Bakelite CRT Monitor Hood Bezel */}
      {/* Top & Bottom Hood Bars */}
      {[-0.128, 0.128].map((by, idx) => (
        <mesh key={`hb-${idx}`} position={[0, by, 0.028]} castShadow receiveShadow>
          <boxGeometry args={[1.56, 0.034, 0.044]} />
          <meshStandardMaterial
            color="#18221d"
            roughness={0.42}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
      ))}
      {/* Left Screen Bezel Wall */}
      <mesh position={[-0.755, 0, 0.028]} castShadow receiveShadow>
        <boxGeometry args={[0.05, 0.23, 0.044]} />
        <meshStandardMaterial
          color="#18221d"
          roughness={0.42}
          metalness={0.68}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
        />
      </mesh>
      {/* Right Wide CRT Control Side-Strip (Houses Contrast/Brightness Knobs & Power Lamp) */}
      <mesh position={[0.7, 0, 0.028]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.23, 0.044]} />
        <meshStandardMaterial
          color="#141b17"
          roughness={0.46}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
        />
      </mesh>
      {/* Inner Brushed-Brass CRT Tube Retention Trim Frame */}
      {[-0.109, 0.109].map((ty, idx) => (
        <mesh key={`bt-${idx}`} position={[-0.055, ty, 0.036]}>
          <boxGeometry args={[1.36, 0.009, 0.018]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.86}
            roughness={0.26}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
      ))}
      {[-0.73, 0.62].map((tx, idx) => (
        <mesh key={`btx-${idx}`} position={[tx, 0, 0.036]}>
          <boxGeometry args={[0.01, 0.224, 0.018]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.86}
            roughness={0.26}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
      ))}

      {/* 3. Right-Side CRT Control Strip: Power Jewel Lamp, Model Badge & 2 Knurled Bakelite Tuning Knobs */}
      <group position={[0.7, 0, 0.052]}>
        {/* Model Badge Plaque */}
        <mesh position={[0, 0.074, 0.002]}>
          <planeGeometry args={[0.118, 0.034]} />
          <meshStandardMaterial
            map={badgeTex}
            emissive="#ffffff"
            emissiveMap={badgeTex}
            emissiveIntensity={0.35}
            roughness={0.7}
          />
        </mesh>
        {/* Glowing Green CRT Filament Indicator Lamp */}
        <mesh position={[-0.04, 0.025, 0.004]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.013, 0.015, 0.01, 10]} />
          <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.25} />
        </mesh>
        <mesh position={[-0.04, 0.025, 0.008]}>
          <sphereGeometry args={[0.01, 10, 10]} />
          <meshStandardMaterial
            color="#33ff66"
            emissive="#33ff66"
            emissiveIntensity={1.6}
            roughness={0.2}
          />
        </mesh>
        {/* 2 Knurled Bakelite CRT Brightness / Vertical-Hold Tuning Knobs */}
        {[0.022, -0.055].map((ky, kIdx) => (
          <group
            key={kIdx}
            position={[kIdx === 0 ? 0.022 : 0.0, ky, 0.008]}
            rotation={[Math.PI / 2, 0, kIdx === 0 ? 0.4 : -0.6]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.022, 0.025, 0.018, 12]} />
              <meshStandardMaterial color="#181412" roughness={0.38} metalness={0.25} />
            </mesh>
            <mesh position={[0, 0.01, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.004, 10]} />
              <meshStandardMaterial color="#d8c280" metalness={0.88} roughness={0.22} />
            </mesh>
            <mesh position={[0, 0.011, 0.008]}>
              <boxGeometry args={[0.004, 0.004, 0.014]} />
              <meshStandardMaterial color="#ffb000" emissive="#ffb000" emissiveIntensity={0.4} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 4. 8 Perimeter Brass Hex Bezel Bolts */}
      {[-0.74, -0.25, 0.25, 0.74].map((rx, rIdx) => (
        <group key={rIdx}>
          <mesh position={[rx, 0.128, 0.052]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0075, 0.0075, 0.008, 6]} />
            <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.24} />
          </mesh>
          <mesh position={[rx, -0.128, 0.052]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0075, 0.0075, 0.008, 6]} />
            <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.24} />
          </mesh>
        </group>
      ))}

      {/* 5. Phosphor-Green CRT Cathode-Ray Screen Plane (At z = 0.026 -> 16mm clear of backing plate, zero Z-fighting!) */}
      <mesh position={[-0.055, 0, 0.026]}>
        <planeGeometry args={[1.34, 0.212]} />
        <meshStandardMaterial
          ref={screenMatRef}
          map={screenTexture}
          color="#ffffff"
          emissive="#ffffff"
          emissiveMap={screenTexture}
          emissiveIntensity={0.88}
          roughness={0.92}
          metalness={0.0}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
};

export function paintSovietCRTScreen( // oxlint-disable-line react/only-export-components
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  options: {
    headerCode: string;
    cells: Array<{ label: string; val: string; danger: boolean }>;
    statusLine: string;
    statusDanger: boolean;
    footerLine: string;
    isBlackout?: boolean;
  },
): void {
  ctx.imageSmoothingEnabled = false;

  // 1. Deep Curved Phosphor-Green CRT Tube Gradient & Vignette
  const grad = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    h * 0.1,
    w * 0.5,
    h * 0.5,
    w * 0.56,
  );
  if (options.isBlackout) {
    grad.addColorStop(0, "#030905");
    grad.addColorStop(1, "#010302");
  } else {
    grad.addColorStop(0, "#0b2914");
    grad.addColorStop(0.7, "#06190c");
    grad.addColorStop(1, "#020b05");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 2. CRT Oscilloscope Graticule Grid & Rounded Phosphor Mask Bezel
  ctx.strokeStyle = options.isBlackout
    ? "rgba(51, 255, 102, 0.04)"
    : "rgba(51, 255, 102, 0.13)";
  ctx.lineWidth = 1;
  for (let gx = 48; gx < w; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx, 8);
    ctx.lineTo(gx, h - 8);
    ctx.stroke();
  }
  for (let gy = 24; gy < h; gy += 24) {
    ctx.beginPath();
    ctx.moveTo(10, gy);
    ctx.lineTo(w - 10, gy);
    ctx.stroke();
  }

  // Rounded CRT Corner Vignette Border
  ctx.strokeStyle = options.statusDanger ? "#ff2a2a" : "#2be85d";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  if (options.isBlackout) {
    drawFittedPlaqueText(
      ctx,
      "/// CRT SIGNAL LOST — MAIN BREAKER TRIPPED ///",
      w / 2,
      h / 2 + 12,
      w - 16,
      '900 40px "VT323", monospace',
      "#ff2a2a",
      "#ff2a2a",
      1.1,
    );
    return;
  }

  // 3. Three Framed CRT Telemetry Readout Boxes (+45% Category Titles & +25% Heavy Values)
  const cellW = 238;
  const cellCenters = [132, 384, 636];
  options.cells.forEach((c, idx) => {
    const cx = cellCenters[idx] ?? 384;
    const x0 = cx - cellW / 2;

    // Darkened CRT sub-window
    ctx.fillStyle = c.danger
      ? "rgba(95, 12, 12, 0.65)"
      : "rgba(3, 16, 8, 0.78)";
    ctx.fillRect(x0, 8, cellW, 72);
    ctx.strokeStyle = c.danger ? "#ff2a2a" : "#2be85d";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x0, 8, cellW, 72);

    // Top Phosphor Header Strip inside Cell (Crisp dark #001a00 outline + 2px letter spacing)
    ctx.fillStyle = c.danger ? "#d41e1e" : "#1b6935";
    ctx.fillRect(x0 + 2, 10, cellW - 4, 23);
    drawFittedPlaqueText(
      ctx,
      c.label,
      cx,
      27,
      cellW + 8,
      '900 19px "Segoe UI Black", "Arial Black", "Consolas", sans-serif',
      "#ffffff",
      "#001a00",
      2.6,
      "2px",
    );

    // Glowing CRT Primary Readout (Razor-sharp #001a00 outline behind fill instead of same-color stroke bleed)
    ctx.save();
    ctx.shadowColor = c.danger ? "#ff2a2a" : "#33ff66";
    ctx.shadowBlur = 5;
    const valCol = c.danger ? "#ff4444" : "#55ff55";
    drawFittedPlaqueText(
      ctx,
      c.val,
      cx,
      71,
      cellW + 8,
      '900 50px "VT323", monospace',
      valCol,
      "#001a00",
      3.0,
      "2px",
    );
    ctx.restore();
  });

  // 4. Lower CRT Terminal Command & Status Bar (Crisp #001a00 outline for razor-sharp characters)
  ctx.fillStyle = "rgba(2, 12, 6, 0.88)";
  ctx.fillRect(12, 83, w - 24, 55);
  ctx.strokeStyle = options.statusDanger ? "#ff2a2a" : "#248f46";
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 83, w - 24, 55);

  const statusCol = options.statusDanger ? "#ff4444" : "#55ff55";
  drawFittedPlaqueText(
    ctx,
    `> ${options.statusLine}`,
    w / 2,
    110,
    w - 16,
    '900 32px "VT323", monospace',
    statusCol,
    "#001a00",
    2.8,
    "1.5px",
  );

  drawFittedPlaqueText(
    ctx,
    `[${options.headerCode}] ${options.footerLine}`,
    w / 2,
    133,
    w - 16,
    '900 19px "Segoe UI Black", "Arial Black", "Consolas", sans-serif',
    "#ffcc00",
    "#001a00",
    2.6,
    "1.5px",
  );

  // 5. Crisp Horizontal CRT Scanline Overlay & Top Glass Specular Sheen
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }
}

interface CagedJewelLamp3DProps {
  position: [number, number, number];
  defaultColor?: string;
  lampMatRef?: React.Ref<THREE.MeshStandardMaterial>;
  scale?: number;
}

export const CagedSovietJewelLamp3D: React.FC<CagedJewelLamp3DProps> = ({
  position,
  defaultColor = "#33ff66",
  lampMatRef,
  scale = 1,
}) => {
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  return (
    <group position={position} scale={scale}>
      {/* Hex Brass Collar Base */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.032, 0.016, 6]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      {/* Faceted Glowing Jewel Dome */}
      <mesh position={[0, 0, 0.012]}>
        <icosahedronGeometry args={[0.021, 1]} />
        <meshStandardMaterial
          ref={lampMatRef}
          color={defaultColor}
          emissive={defaultColor}
          emissiveIntensity={1.1}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
      {/* 4-Rib Protective Wire Guard Cage */}
      {[0, Math.PI / 2].map((rotZ, idx) => (
        <mesh key={idx} position={[0, 0, 0.012]} rotation={[0, 0, rotZ]}>
          <torusGeometry args={[0.025, 0.0025, 6, 12, Math.PI]} />
          <meshStandardMaterial
            color="#8c7a4b"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
};

interface HighDetailManometer3DProps {
  position: [number, number, number];
  title: string;
  cyrillicSub?: string;
  unit: string;
  serial?: string;
  min: number;
  max: number;
  dangerThreshold: number;
  lowDangerThreshold?: number;
  centerNominal?: boolean;
  getValue: () => number;
}

export const HighDetailManometer3D: React.FC<HighDetailManometer3DProps> = ({
  position,
  title,
  min,
  max,
  dangerThreshold,
  lowDangerThreshold,
  centerNominal = false,
  getValue,
}) => {
  const needleGroupRef = useRef<THREE.Group>(null);
  const warningLampRef = useRef<THREE.MeshStandardMaterial>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const dialTexture = useMemo(() => {
    return createCrispPanelTexture(512, 512, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;

      // Crisp High-Contrast Soviet Manometer Dial Face (#f4eee0 with subtle radial vignette)
      const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 240);
      grad.addColorStop(0, "#f7f2e4");
      grad.addColorStop(0.82, "#ebe2c8");
      grad.addColorStop(1, "#c8bea2");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 242, 0, Math.PI * 2);
      ctx.fill();

      // Double Outer Scale Rings
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 232, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 218, 0, Math.PI * 2);
      ctx.stroke();

      // Cross-Hatched Crimson Danger Arc (plus Center Green Nominal Band if centerNominal)
      const dangerRatio = THREE.MathUtils.clamp(
        (dangerThreshold - min) / (max - min),
        0,
        1,
      );
      const startAngle = Math.PI * 0.75 + dangerRatio * Math.PI * 1.5;
      const endAngle = Math.PI * 2.25;
      ctx.strokeStyle = "#c81e1e";
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, 198, startAngle, endAngle);
      ctx.stroke();

      const lowDangerRatio =
        typeof lowDangerThreshold === "number"
          ? THREE.MathUtils.clamp(
              (lowDangerThreshold - min) / (max - min),
              0,
              1,
            )
          : -1;
      if (lowDangerRatio > 0) {
        ctx.strokeStyle = "#c81e1e";
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          198,
          Math.PI * 0.75,
          Math.PI * 0.75 + lowDangerRatio * Math.PI * 1.5,
        );
        ctx.stroke();
      }
      if (centerNominal) {
        ctx.strokeStyle = "#1d7a36";
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          198,
          Math.PI * 0.75 + 0.35 * Math.PI * 1.5,
          Math.PI * 0.75 + 0.65 * Math.PI * 1.5,
        );
        ctx.stroke();
      }

      // Fine Minor & Major Tick Marks (50 subdivisions) + +30% Larger Bold Numeric Scale Labels
      for (let i = 0; i <= 50; i++) {
        const ratio = i / 50;
        const ang = Math.PI * 0.75 + ratio * Math.PI * 1.5;
        const isMajor = i % 5 === 0;
        const isMed = i % 5 === 2 || i % 5 === 3;
        const innerR = isMajor ? 158 : isMed ? 172 : 180;
        const outerR = 212;
        const inRed =
          ratio >= dangerRatio ||
          (lowDangerRatio > 0 && ratio <= lowDangerRatio);
        ctx.strokeStyle = inRed ? "#c81e1e" : "#0a0a0a";
        ctx.lineWidth = isMajor ? 5.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
        ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
        ctx.stroke();

        if (isMajor && i % 10 === 0) {
          const val = Math.round(min + ratio * (max - min));
          const isTopTick = Math.sin(ang) < -0.55;
          const labelR = isTopTick ? 136 : 128;
          const numColor = inRed ? "#c81e1e" : "#0a0a0a";
          const lx = cx + Math.cos(ang) * labelR;
          const ly = cy + Math.sin(ang) * labelR;
          ctx.save();
          ctx.fillStyle = numColor;
          ctx.font = '900 31px "Segoe UI Black", "Arial Black", "Consolas", sans-serif';
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(val), lx, ly);
          ctx.restore();
        }
      }

      // Bottom Dead-Zone Wedge (strictly between 0% and 100% stops & well below center cap):
      // Redundant range text removed so center hub cap is 100% clear, and main title never intersects the needle!
      drawFittedPlaqueText(
        ctx,
        title,
        cx,
        cy + 136,
        212,
        '900 54px "Segoe UI Black", "Arial Black", "Impact", "Consolas", sans-serif',
        "#060606",
        undefined,
        0,
        "2px",
      );
    });
  }, [
    centerNominal,
    dangerThreshold,
    lowDangerThreshold,
    max,
    min,
    title,
  ]);

  useFrame(({ clock }) => {
    const rawVal = getValue();
    const state = useGameStore.getState();
    const t = clock.getElapsedTime();
    const totalMW =
      state.powerAllocation.cooling +
      state.powerAllocation.defense +
      state.powerAllocation.facility +
      (state.ventilationActive ? 10 : 0);
    const isRedline = totalMW > state.maxSafePower;

    const ratio = THREE.MathUtils.clamp((rawVal - min) / (max - min), 0, 1);
    const isOver80Pct = !centerNominal && ratio >= 0.8;
    const isLow20Pct =
      !centerNominal &&
      typeof lowDangerThreshold === "number" &&
      ratio <= 0.2;
    const isDanger =
      rawVal >= dangerThreshold ||
      (typeof lowDangerThreshold === "number" &&
        rawVal <= lowDangerThreshold) ||
      isOver80Pct ||
      isLow20Pct;
    const isWarn =
      !isDanger &&
      !centerNominal &&
      (ratio >= 0.68 ||
        (typeof lowDangerThreshold === "number" && ratio <= 0.32));

    const jitter =
      Math.sin(t * 18 + position[0] * 5) *
      (isRedline || isDanger ? 0.036 : 0.008);

    const targetRotZ = 2.35 - ratio * 4.7 + jitter;
    if (needleGroupRef.current) {
      needleGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        needleGroupRef.current.rotation.z,
        targetRotZ,
        0.18,
      );
    }

    if (warningLampRef.current) {
      if (state.isBlackout) {
        warningLampRef.current.color.set("#141c18");
        warningLampRef.current.emissive.set("#000000");
        warningLampRef.current.emissiveIntensity = 0;
      } else if (isDanger) {
        const flash = Math.sin(t * 16 + position[0] * 3) > -0.15;
        warningLampRef.current.color.set("#ff2a2a");
        warningLampRef.current.emissive.set("#ff2a2a");
        warningLampRef.current.emissiveIntensity = flash ? 2.2 : 0.45;
      } else if (isWarn) {
        warningLampRef.current.color.set("#ffb000");
        warningLampRef.current.emissive.set("#ffb000");
        warningLampRef.current.emissiveIntensity = 1.35;
      } else {
        warningLampRef.current.color.set("#33ff66");
        warningLampRef.current.emissive.set("#33ff66");
        warningLampRef.current.emissiveIntensity = 0.78;
      }
    }
  });

  const dangerAngle =
    2.35 -
    THREE.MathUtils.clamp((dangerThreshold - min) / (max - min), 0, 1) * 4.7;

  return (
    <group position={position}>
      {/* 1. Stepped Hammered Cast-Iron Outer Flange Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.205, 0.22, 0.088, 24]} />
        <meshStandardMaterial
          color="#18211b"
          roughness={0.44}
          metalness={0.68}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* 2. 8 Perimeter 3D Brass Hex Bolts */}
      {BOLT_ANGLES_8.map((ang, bIdx) => (
        <mesh
          key={bIdx}
          position={[Math.cos(ang) * 0.192, Math.sin(ang) * 0.192, 0.044]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.01, 0.01, 0.014, 6]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.88}
            roughness={0.25}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
      ))}

      {/* 3. Hollow Brushed-Brass Bevel Ring & Recessed Shadow Cavity (Open Center!) */}
      <mesh position={[0, 0, 0.049]} castShadow>
        <torusGeometry args={[0.175, 0.012, 12, 32]} />
        <meshStandardMaterial
          color="#b8a46b"
          metalness={0.86}
          roughness={0.26}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={brassTex.roughnessMap}
        />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <ringGeometry args={[0.162, 0.178, 32]} />
        <meshBasicMaterial color="#090c0a" />
      </mesh>

      {/* 4. Crisp Backlit 512x512 ГОСТ-84 Manometer Dial Face */}
      <mesh position={[0, 0, 0.047]}>
        <circleGeometry args={[0.168, 32]} />
        <meshStandardMaterial
          map={dialTexture}
          emissive="#fff4d8"
          emissiveMap={dialTexture}
          emissiveIntensity={0.55}
          roughness={0.88}
          metalness={0.02}
        />
      </mesh>

      {/* 5. Physical Red Limit-Pin Marker on Bezel */}
      <group rotation={[0, 0, dangerAngle]} position={[0, 0, 0.052]}>
        <mesh position={[0, 0.146, 0]}>
          <boxGeometry args={[0.008, 0.026, 0.008]} />
          <meshStandardMaterial
            color="#ff2a2a"
            emissive="#ff2a2a"
            emissiveIntensity={0.45}
          />
        </mesh>
      </group>

      {/* 6. Sculpted 3D Pointer Needle with Compact Counterweight Tail & Low-Profile Oxidized Brass Spindle Cap */}
      <group ref={needleGroupRef} position={[0, 0, 0.048]}>
        {/* Main Tapered Crimson Pointer Blade */}
        <mesh position={[0, 0.058, 0]} castShadow>
          <boxGeometry args={[0.0095, 0.128, 0.005]} />
          <meshStandardMaterial
            color="#ff2a2a"
            emissive="#ff2a2a"
            emissiveIntensity={0.55}
            roughness={0.3}
          />
        </mesh>
        {/* Compact Dark Counterweight Tail & Disc */}
        <mesh position={[0, -0.018, 0]}>
          <boxGeometry args={[0.011, 0.026, 0.005]} />
          <meshStandardMaterial
            color="#141414"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.006, 10]} />
          <meshStandardMaterial
            color="#141414"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>
        {/* Low-Profile Dark Oxidized Brass Spindle Cap & Nut (Never obscures dial text!) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.016, 0.011, 12]} />
          <meshStandardMaterial
            color="#524428"
            roughness={0.38}
            metalness={0.78}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
      </group>

      {/* 7. Non-Glaring Anti-Reflective Glass Highlight Strip */}
      <mesh position={[-0.045, 0.045, 0.064]} rotation={[0, 0, 0.65]}>
        <planeGeometry args={[0.18, 0.022]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.07}
          depthWrite={false}
        />
      </mesh>

      {/* 8. Caged Soviet Jewel Indicator Lamp Above Dial (Positioned with clean gap below header plaque) */}
      <CagedSovietJewelLamp3D
        position={[0, 0.198, 0.028]}
        lampMatRef={warningLampRef}
      />
    </group>
  );
};

interface SculptedPumpValveAssembly3DProps {
  position: [number, number, number];
  pumpIndex: 0 | 1;
  label: string;
  subLabel?: string;
}

const SculptedPumpValveAssembly3D: React.FC<
  SculptedPumpValveAssembly3DProps
> = ({ position, pumpIndex, label, subLabel }) => {
  const wheelRef = useRef<THREE.Group>(null);
  const leverArmRef = useRef<THREE.Group>(null);
  const lampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const heatScaleMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const heatBarMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const heatBarMeshRef = useRef<THREE.Mesh>(null);
  const lastPumpOnRef = useRef<boolean | null>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const nameplateTex = useMemo(
    () =>
      makePlaqueTex(label, subLabel ?? "FLOW VALVE", {
        width: 384,
        height: 140,
        titleSize: 48,
        subSize: 36,
      }),
    [label, subLabel],
  );

  const lastBearingDegRef = useRef<number>(-1);
  const heatScaleTex = useMemo(() => {
    return createCrispPanelTexture(360, 84, (ctx, w, h) => {
      ctx.fillStyle = "#101613";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#b8a46b";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      drawFittedPlaqueText(
        ctx,
        "BEARING: 20°C",
        w / 2,
        35,
        w - 12,
        '900 30px "Segoe UI Black", "Arial Black", "Consolas", sans-serif',
        "#ffe066",
        "#000000",
        3.2,
        "2px",
      );
      ctx.strokeStyle = "#364940";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(14, 48, w - 28, 24);
    });
  }, []);

  useFrame(({ clock }) => {
    const state = useGameStore.getState();
    const throttle = state.isBlackout ? 0 : state.pumpThrottle[pumpIndex];
    const isPumpOn = state.pumpsActive[pumpIndex] && !state.isBlackout;
    const bearingHeat = pumpIndex === 0 ? state.pumpAHeat : state.pumpBHeat;
    const bearingDegC = Math.round(20 + bearingHeat);

    if (bearingDegC !== lastBearingDegRef.current) {
      lastBearingDegRef.current = bearingDegC;
      const tex = heatScaleMatRef.current?.map as THREE.CanvasTexture | undefined;
      const canvas = tex?.image as HTMLCanvasElement | undefined;
      const ctx = canvas?.getContext("2d");
      if (tex && canvas && ctx) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = "#101613";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = bearingHeat >= 80 ? "#ff2a2a" : "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        drawFittedPlaqueText(
          ctx,
          `BEARING: ${bearingDegC}°C`,
          w / 2,
          35,
          w - 12,
          '900 30px "Segoe UI Black", "Arial Black", "Consolas", sans-serif',
          bearingHeat >= 80 ? "#ff5555" : "#ffe066",
          "#000000",
          3.2,
          "2px",
        );
        ctx.strokeStyle = "#364940";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(14, 48, w - 28, 24);
        tex.needsUpdate = true;
      }
    }

    // Continuous smooth rotational angle on the 6-spoke cast-iron valve wheel
    if (wheelRef.current) {
      const targetWheelRot = -(throttle / 100) * Math.PI * 1.8;
      const cavitationJitter =
        state.pumpThrottle[0] > 50 && state.pumpThrottle[1] > 50 && !state.isBlackout
          ? Math.sin(clock.getElapsedTime() * 44 + pumpIndex * 2) * 0.045
          : 0;
      wheelRef.current.rotation.z = THREE.MathUtils.lerp(
        wheelRef.current.rotation.z,
        targetWheelRot + cavitationJitter,
        0.45,
      );
    }

    if (leverArmRef.current) {
      const ratio = 1 - throttle / 100;
      const targetAngleX = -0.58 + ratio * 1.16;
      leverArmRef.current.rotation.x = THREE.MathUtils.lerp(
        leverArmRef.current.rotation.x,
        targetAngleX,
        0.4,
      );
    }

    // Update Horizontal Bearing Heat Bar cleanly below the wheel & switch (+35% wider & taller)
    if (heatBarMeshRef.current && heatBarMatRef.current) {
      const hRatio = THREE.MathUtils.clamp(bearingHeat / 100, 0.04, 1);
      heatBarMeshRef.current.scale.x = hRatio;
      heatBarMeshRef.current.position.x = -0.156 + hRatio * 0.156;
      const heatColor =
        bearingHeat >= 80
          ? "#ff2a2a"
          : bearingHeat >= 55
            ? "#ffb000"
            : "#33ff66";
      heatBarMatRef.current.color.set(heatColor);
      heatBarMatRef.current.emissive.set(heatColor);
      heatBarMatRef.current.emissiveIntensity =
        bearingHeat >= 80
          ? 1.5 + Math.sin(clock.getElapsedTime() * 16) * 0.6
          : 0.95;
    }

    const highlightPumpTut =
      (state.tutorialStep === 3 &&
        pumpIndex === 0 &&
        state.pumpThrottle[0] <= 50) ||
      (!state.isBlackout && state.coreTemp > 650);
    if (highlightPumpTut && lampMatRef.current) {
      lastPumpOnRef.current = null;
      const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 6.0);
      lampMatRef.current.color.set(pulse > 0.5 ? "#33ff66" : "#ffb000");
      lampMatRef.current.emissive.set(pulse > 0.5 ? "#33ff66" : "#ffb000");
      lampMatRef.current.emissiveIntensity = 1.6 + pulse * 1.4;
    } else if (lampMatRef.current && isPumpOn !== lastPumpOnRef.current) {
      lastPumpOnRef.current = isPumpOn;
      lampMatRef.current.color.set(isPumpOn ? "#33ff66" : "#ff2a2a");
      lampMatRef.current.emissive.set(isPumpOn ? "#33ff66" : "#ff2a2a");
      lampMatRef.current.emissiveIntensity = isPumpOn ? 1.5 : 0.8;
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    const curThrottle = useGameStore.getState().pumpThrottle[pumpIndex];
    startSmoothWheelSwivelDrag(
      e,
      wheelRef.current,
      curThrottle,
      0,
      100,
      (nextVal) => {
        useGameStore.getState().setPumpThrottle(pumpIndex, nextVal);
      },
    );
  };

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        const st = useGameStore.getState();
        st.setHoveredDiagnosticId(st.coreTemp > 520 ? "core" : "bearing");
      }}
      onPointerOut={() => {
        const st = useGameStore.getState();
        if (
          st.hoveredDiagnosticId === "core" ||
          st.hoveredDiagnosticId === "bearing"
        ) {
          st.setHoveredDiagnosticId(null);
        }
      }}
    >
      {/* Raised Engraved Brass & Iron Nameplate (+35% taller 3D geometry) */}
      <mesh position={[0, 0.184, 0.032]} castShadow>
        <boxGeometry args={[0.398, 0.128, 0.012]} />
        <meshStandardMaterial
          color="#8c7a4b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[0, 0.184, 0.039]}>
        <planeGeometry args={[0.382, 0.114]} />
        <meshStandardMaterial
          map={nameplateTex}
          emissive="#ffffff"
          emissiveMap={nameplateTex}
          emissiveIntensity={0.35}
          roughness={0.55}
        />
      </mesh>

      {/* Caged Soviet Jewel Lamp & Horizontal Bearing Heat Bar Below Wheel (+35% wider & taller: `BEARING: XX°C`) */}
      <CagedSovietJewelLamp3D
        position={[-0.125, 0.096, 0.038]}
        lampMatRef={lampMatRef}
        scale={0.84}
      />
      <group position={[0.005, -0.158, 0.038]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.362, 0.07, 0.016]} />
          <meshStandardMaterial
            color="#101513"
            roughness={0.5}
            metalness={0.7}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <mesh position={[0, 0, 0.009]}>
          <planeGeometry args={[0.346, 0.062]} />
          <meshStandardMaterial
            ref={heatScaleMatRef}
            map={heatScaleTex}
            emissive="#ffffff"
            emissiveMap={heatScaleTex}
            emissiveIntensity={0.45}
            roughness={0.75}
          />
        </mesh>
        <mesh ref={heatBarMeshRef} position={[0, -0.013, 0.013]}>
          <boxGeometry args={[0.312, 0.016, 0.008]} />
          <meshStandardMaterial
            ref={heatBarMatRef}
            color="#33ff66"
            emissive="#33ff66"
            emissiveIntensity={1.15}
          />
        </mesh>
      </group>

      {/* Heavy Bolted Cast-Iron Valve Manifold & 6-Spoke Handwheel */}
      <group
        position={[-0.072, -0.025, 0.038]}
        onPointerDown={handlePointerDown}
      >
        {/* Pipe Manifold Flange & Brushed-Brass Degree Scale Plate */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.068, 0.076, 0.032, 12]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.45}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        <mesh position={[0, 0, 0.018]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.056, 0.058, 0.008, 16]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.85}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Valve Stem Stuffing Box */}
        <mesh position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.022, 0.028, 0.068, 10]} />
          <meshStandardMaterial
            color="#364940"
            roughness={0.45}
            metalness={0.7}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>

        {/* 6-Spoke Cast-Iron Handwheel with Outer Crank Peg & Generous Invisible Hit Target */}
        <group
          ref={wheelRef}
          position={[0, 0, 0.068]}
          onPointerDown={handlePointerDown}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.135, 0.135, 0.11, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* Outer Rim Torus — Chipped Deep Oxidized Crimson / Olive-Drab Cast-Iron Enamel */}
          <mesh castShadow>
            <torusGeometry args={[0.068, 0.012, 10, 20]} />
            <meshStandardMaterial
              color={pumpIndex === 0 ? "#6e1a14" : "#2f3a2e"}
              roughness={0.44}
              metalness={0.52}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
              roughnessMap={ironTex.roughnessMap}
            />
          </mesh>
          {/* 3 Intersecting Diameter Bars = 6 Spokes */}
          {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ang, sIdx) => (
            <mesh key={sIdx} rotation={[0, 0, ang]} castShadow>
              <cylinderGeometry args={[0.0065, 0.0065, 0.132, 8]} />
              <meshStandardMaterial
                color="#2b3036"
                roughness={0.42}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.006}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
          ))}
          {/* Central Machined Steel & Brass Retention Cap */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.02, 0.022, 8]} />
            <meshStandardMaterial
              color="#8a929a"
              metalness={0.85}
              roughness={0.32}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* Protruding Dark Phenolic Bakelite Crank-Handle Peg on Rim */}
          <mesh
            position={[0.058, 0.02, 0.018]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.0075, 0.009, 0.034, 10]} />
            <meshStandardMaterial
              color="#1c1817"
              metalness={0.15}
              roughness={0.32}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
        </group>
      </group>

      {/* Dual-Blade Copper Knife-Switch Throw Lever with Dark Phenolic Bakelite Crossbar & Steel Ferrules */}
      <group
        position={[0.088, -0.025, 0.036]}
        onPointerDown={handlePointerDown}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.088, 0.22, 0.038]} />
          <meshStandardMaterial
            color="#181c1a"
            roughness={0.46}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Top & Bottom Copper Contact Jaws */}
        {[-0.068, 0.068].map((cy, cIdx) => (
          <group key={cIdx} position={[0, cy, 0.024]}>
            <mesh position={[-0.022, 0, 0]}>
              <boxGeometry args={[0.008, 0.028, 0.022]} />
              <meshStandardMaterial
                color="#b8733e"
                metalness={0.88}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            <mesh position={[0.022, 0, 0]}>
              <boxGeometry args={[0.008, 0.028, 0.022]} />
              <meshStandardMaterial
                color="#b8733e"
                metalness={0.88}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          </group>
        ))}

        <group ref={leverArmRef} position={[0, 0, 0.022]}>
          {/* Twin Copper Knife Blades */}
          {[-0.022, 0.022].map((lx, lIdx) => (
            <mesh
              key={lIdx}
              position={[lx, 0, 0.058]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.007, 0.115, 0.016]} />
              <meshStandardMaterial
                color="#b8733e"
                roughness={0.26}
                metalness={0.88}
              />
            </mesh>
          ))}
          {/* Lathe-Turned Dark Phenolic Bakelite Crossbar Grip */}
          <mesh
            position={[0, 0, 0.118]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.02, 0.02, 0.108, 14]} />
            <meshStandardMaterial
              color="#1c1817"
              roughness={0.32}
              metalness={0.15}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          {/* Brushed Steel End-Ferrules */}
          {[-0.048, 0.048].map((fx, fIdx) => (
            <mesh
              key={fIdx}
              position={[fx, 0, 0.118]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.0215, 0.0215, 0.014, 12]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.85}
                roughness={0.35}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          ))}
          {/* Single Thin Recessed Enamel Indicator Ring */}
          <mesh
            position={[0, 0, 0.118]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.021, 0.021, 0.008, 12]} />
            <meshStandardMaterial
              color="#6e1a14"
              roughness={0.38}
              metalness={0.25}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

interface IndustrialPowerColumn3DProps {
  position: [number, number, number];
  sector: SectorNodeId;
  label: string;
  subLabel?: string;
  accentColor: string;
  ledColor: string;
  minusBtnTex: THREE.CanvasTexture;
  plusBtnTex: THREE.CanvasTexture;
}

const IndustrialPowerColumn3D: React.FC<IndustrialPowerColumn3DProps> = ({
  position,
  sector,
  label,
  subLabel,
  accentColor,
  ledColor,
  minusBtnTex,
  plusBtnTex,
}) => {
  const blockMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const readoutMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const handleRingMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const leverGroupRef = useRef<THREE.Group>(null);
  const lastBlockStateRef = useRef("");
  const lastReadoutSigRef = useRef("");
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const dragRef = useRef<{
    active: boolean;
    startClientY: number;
    startMW: number;
  }>({
    active: false,
    startClientY: 0,
    startMW: 0,
  });

  const ribbedGlassTex = useMemo(() => getRibbedGlassCellTexture(), []);

  const readoutTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 88;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, []);

  const minus5BtnTex = useMemo(
    () =>
      createCrispPanelTexture(80, 56, (ctx, w, h) => {
        ctx.fillStyle = "#181d1a";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ffb000";
        ctx.font = '900 30px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("-5", w / 2, 39);
      }),
    [],
  );

  const plus5BtnTex = useMemo(
    () =>
      createCrispPanelTexture(80, 56, (ctx, w, h) => {
        ctx.fillStyle = "#18241d";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#33ff66";
        ctx.font = '900 30px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("+5", w / 2, 39);
      }),
    [],
  );

  const labelTex = useMemo(
    () =>
      makePlaqueTex(label, subLabel ?? "ПРИПЯТЬ", {
        width: 340,
        height: 82,
        titleSize: 30,
        subSize: 26,
        subColor: "#ffe066",
      }),
    [label, subLabel],
  );

  const mwScalePlateTex = useMemo(
    () =>
      createCrispPanelTexture(80, 280, (ctx, w, h) => {
        ctx.fillStyle = "#161a18";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        const marks = ["50", "40", "30", "20", "10", "0"];
        marks.forEach((m, idx) => {
          const y = 24 + idx * 46;
          ctx.fillStyle = idx === 0 ? "#ff4433" : "#e6dec3";
          ctx.font = 'bold 24px "VT323", monospace';
          ctx.textAlign = "right";
          ctx.fillText(m, w - 18, y + 7);
          ctx.fillStyle = idx === 0 ? "#ff4433" : "#ffb000";
          ctx.fillRect(w - 14, y - 2, 10, 4);
          if (idx < marks.length - 1) {
            ctx.fillStyle = "#8c7a4b";
            ctx.fillRect(w - 10, y + 21, 6, 3);
          }
        });
      }),
    [],
  );

  useFrame(({ clock }) => {
    const state = useGameStore.getState();
    const currentMW = state.sectorMW[sector];
    const targetMW = state.targetSectorMW[sector];
    const highlightVodkaTut =
      state.tutorialStep === 2 && sector === "vodka" && currentMW !== 25;
    if (handleRingMatRef.current) {
      if (highlightVodkaTut) {
        const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 6.0);
        handleRingMatRef.current.color.set(
          pulse > 0.5 ? "#33ff66" : "#ffb000",
        );
        handleRingMatRef.current.emissive.set(
          pulse > 0.5 ? "#33ff66" : "#ffb000",
        );
        handleRingMatRef.current.emissiveIntensity = 1.4 + pulse * 1.2;
      } else {
        handleRingMatRef.current.color.set(accentColor);
        handleRingMatRef.current.emissive.set("#000000");
        handleRingMatRef.current.emissiveIntensity = 0;
      }
    }
    // Map 0..50 MW across 10 physical 3D ribbed phosphor glass cell segments (5 MW per segment)
    const activeBlocks = Math.round((currentMW / 50) * 10);
    const sig = `${activeBlocks}|${state.isBlackout}`;

    if (sig !== lastBlockStateRef.current) {
      lastBlockStateRef.current = sig;
      for (let i = 0; i < 10; i++) {
        const mat = blockMatRefs.current[i];
        if (!mat) continue;
        const isLit = !state.isBlackout && i < activeBlocks;
        const colorHex = i >= 9 ? "#c92a1d" : i >= 7 ? "#ffb000" : ledColor;
        mat.color.set(isLit ? colorHex : "#141916");
        mat.emissive.set(isLit ? colorHex : "#000000");
        mat.emissiveIntensity = isLit ? 1.15 : 0;
      }
    }

    const readoutSig = `${currentMW}|${targetMW}|${state.isBlackout}|${highlightVodkaTut}`;
    const tex = readoutMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (tex && readoutSig !== lastReadoutSigRef.current) {
      lastReadoutSigRef.current = readoutSig;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const w = canvas.width;
        const h = canvas.height;
        const isMatched = currentMW === targetMW;
        const isClose = Math.abs(currentMW - targetMW) <= 5;
        const primaryColor = state.isBlackout
          ? "#3a453e"
          : highlightVodkaTut
            ? "#ffb000"
            : isMatched
              ? "#33ff66"
              : isClose
                ? "#ffb000"
                : "#ff3333";

        ctx.fillStyle = "#06110b";
        ctx.fillRect(0, 0, w, h);

        // Subtle scanlines
        ctx.fillStyle = "rgba(51, 255, 102, 0.06)";
        for (let y = 0; y < h; y += 4) {
          ctx.fillRect(0, y, w, 2);
        }

        ctx.strokeStyle = highlightVodkaTut
          ? "#ffb000"
          : isMatched
            ? "#28b862"
            : "#ff6b2a";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);

        // Giant Full-Box Nixie / Phosphor Readout: "20 / 20 MW" (+45% larger & taller, filling the green box!)
        drawFittedPlaqueText(
          ctx,
          state.isBlackout
            ? "0 / 0 MW"
            : `${currentMW} / ${targetMW} MW`,
          w / 2,
          68,
          w + 6,
          '900 82px "VT323", monospace',
          primaryColor,
          "#001a00",
          3.2,
          "1.5px",
        );

        tex.needsUpdate = true;
      }
      if (readoutMatRef.current) {
        readoutMatRef.current.emissiveIntensity = state.isBlackout
          ? 0.15
          : currentMW === targetMW
            ? 0.95
            : 1.25;
      }
    }

    if (leverGroupRef.current) {
      const ratio = THREE.MathUtils.clamp(currentMW / 50, 0, 1);
      const targetY = -0.145 + ratio * 0.29;
      leverGroupRef.current.position.y = THREE.MathUtils.lerp(
        leverGroupRef.current.position.y,
        targetY,
        0.25,
      );
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    const state = useGameStore.getState();
    if (state.isBlackout || state.komradOverrideLocked) {
      playLeverRatchet(0.45);
      return;
    }
    const startClientX = e.nativeEvent.clientX;
    const startClientY = e.nativeEvent.clientY;
    const startMW = state.sectorMW[sector];
    let totalMovement = 0;

    dragRef.current = {
      active: true,
      startClientY,
      startMW,
    };
    playSwitchClank(true);

    const onWindowMove = (ev: PointerEvent) => {
      if (!dragRef.current.active) return;
      const s = useGameStore.getState();
      if (s.isBlackout || s.komradOverrideLocked) {
        dragRef.current.active = false;
        return;
      }
      totalMovement = Math.max(
        totalMovement,
        Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY),
      );
      const deltaY = dragRef.current.startClientY - ev.clientY;
      const rawTargetMW = dragRef.current.startMW + (deltaY / 72) * 50;
      const snappedMW = THREE.MathUtils.clamp(
        Math.round(rawTargetMW / 5) * 5,
        0,
        50,
      );
      if (snappedMW !== s.sectorMW[sector]) {
        playDetentClick(Math.round(snappedMW / 5));
        s.setSectorPower(sector, snappedMW);
      }
    };

    const onWindowUp = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
      if (totalMovement < 6) {
        const s = useGameStore.getState();
        const cur = s.sectorMW[sector];
        const nextMW = cur >= 50 ? 10 : cur + 5;
        playDetentClick(Math.round(nextMW / 5));
        s.setSectorPower(sector, nextMW);
      }
      playSwitchClank(false);
    };

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowUp);
  };

  return (
    <group position={position} scale={[0.74, 0.94, 0.92]}>
      {/* Raised Engraved Brass Header Plate (+25% larger) */}
      <mesh position={[0, 0.266, 0.03]} castShadow>
        <boxGeometry args={[0.335, 0.08, 0.01]} />
        <meshStandardMaterial
          color="#8c7a4b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[0, 0.266, 0.036]}>
        <planeGeometry args={[0.32, 0.07]} />
        <meshStandardMaterial
          map={labelTex}
          emissive="#ffffff"
          emissiveMap={labelTex}
          emissiveIntensity={0.32}
          roughness={0.55}
        />
      </mesh>

      {/* Recessed Soviet Nixie / Digital Readout Window ("30 / 30 MW" or "20 / 45 MW") */}
      <group position={[0, 0.194, 0.034]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.33, 0.066, 0.022]} />
          <meshStandardMaterial
            color="#121715"
            roughness={0.38}
            metalness={0.78}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
          />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <planeGeometry args={[0.314, 0.056]} />
          <meshStandardMaterial
            ref={readoutMatRef}
            map={readoutTex}
            emissive="#ffffff"
            emissiveMap={readoutTex}
            emissiveIntensity={0.95}
            roughness={0.22}
          />
        </mesh>
      </group>

      {/* Projected 3D Cast-Iron Bezel Housing (depth: 0.025m) with 4 Corner Hex Bolts & 10 Ribbed Phosphor Glass Cells */}
      <group position={[-0.068, -0.014, 0.032]} scale={[1, 0.9, 1]}>
        {/* Recessed Cast-Iron Bezel Housing */}
        <mesh position={[0, 0, 0.002]} castShadow receiveShadow>
          <boxGeometry args={[0.128, 0.352, 0.025]} />
          <meshStandardMaterial
            color="#181e1b"
            roughness={0.44}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Left & Right Beveled Louver Side Rails */}
        {[-0.056, 0.056].map((rx, rIdx) => (
          <mesh key={rIdx} position={[rx, 0, 0.015]} castShadow>
            <boxGeometry args={[0.014, 0.348, 0.014]} />
            <meshStandardMaterial
              color="#222826"
              metalness={0.76}
              roughness={0.38}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
        ))}
        {/* 4 Corner Steel Hex Bolts */}
        {(
          [
            [-0.052, 0.162],
            [0.052, 0.162],
            [-0.052, -0.162],
            [0.052, -0.162],
          ] as const
        ).map(([bx, by], bIdx) => (
          <mesh
            key={bIdx}
            position={[bx, by, 0.022]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.006, 0.006, 0.008, 6]} />
            <meshStandardMaterial
              color="#8a929a"
              metalness={0.86}
              roughness={0.3}
            />
          </mesh>
        ))}
        {Array.from({ length: 10 }).map((_, idx) => {
          const segY = -0.144 + idx * 0.032;
          return (
            <group key={idx} position={[0, segY, 0.01]}>
              {/* Recessed Ribbed Phosphor Glass Cell Window */}
              <mesh>
                <boxGeometry args={[0.096, 0.021, 0.014]} />
                <meshStandardMaterial
                  ref={(el) => {
                    blockMatRefs.current[idx] = el;
                  }}
                  map={ribbedGlassTex}
                  emissiveMap={ribbedGlassTex}
                  color="#141916"
                  roughness={0.24}
                  metalness={0.18}
                />
              </mesh>
              {/* Protruding Dark Cast-Iron Horizontal Divider Louver */}
              <mesh position={[0, 0.015, 0.009]} castShadow>
                <boxGeometry args={[0.114, 0.006, 0.016]} />
                <meshStandardMaterial
                  color="#141816"
                  metalness={0.78}
                  roughness={0.38}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Heavy Bolted Cast-Iron Quadrant Box (0.03m deep) with Beveled Rails, 6 Bolts, Engraved 0-50 MW Brass Scale, Pleated Bellows & Extruded Steel Ratchet Teeth */}
      <group
        position={[0.068, -0.014, 0.035]}
        scale={[1, 0.9, 1]}
        onPointerDown={handlePointerDown}
      >
        {/* Generous Invisible Hit-Box so grabbing or clicking the MW Lever never misses */}
        <mesh position={[0, 0, 0.045]}>
          <boxGeometry args={[0.16, 0.38, 0.14]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Raised 0.03m Deep Cast-Iron Quadrant Box */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.112, 0.352, 0.03]} />
          <meshStandardMaterial
            color="#1c2220"
            roughness={0.44}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
        {/* Left & Right Beveled Steel Side Rails */}
        {[-0.044, 0.044].map((rx, rIdx) => (
          <mesh key={rIdx} position={[rx, 0, 0.017]} castShadow>
            <boxGeometry args={[0.018, 0.344, 0.012]} />
            <meshStandardMaterial
              color="#2b3036"
              metalness={0.82}
              roughness={0.34}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
        ))}
        {/* 6 Perimeter Steel Hex Bolts on Quadrant Box */}
        {(
          [
            [-0.044, 0.155],
            [0.044, 0.155],
            [-0.044, 0],
            [0.044, 0],
            [-0.044, -0.155],
            [0.044, -0.155],
          ] as const
        ).map(([bx, by], bIdx) => (
          <mesh
            key={bIdx}
            position={[bx, by, 0.024]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.0055, 0.0055, 0.008, 6]} />
            <meshStandardMaterial
              color="#8a929a"
              metalness={0.86}
              roughness={0.28}
            />
          </mesh>
        ))}
        {/* High-Contrast Engraved 0-50 MW Scale Plate Alongside Slot */}
        <mesh position={[-0.025, 0, 0.018]}>
          <planeGeometry args={[0.032, 0.318]} />
          <meshStandardMaterial
            map={mwScalePlateTex}
            emissive="#ffffff"
            emissiveMap={mwScalePlateTex}
            emissiveIntensity={0.35}
            metalness={0.45}
            roughness={0.35}
          />
        </mesh>
        {/* Recessed Slot Channel & Pleated Black Rubber Dust-Bellows */}
        <mesh position={[0.006, 0, 0.014]}>
          <boxGeometry args={[0.028, 0.308, 0.01]} />
          <meshStandardMaterial color="#080a09" roughness={0.94} />
        </mesh>
        {Array.from({ length: 18 }).map((_, pIdx) => (
          <mesh
            key={`pleat-${pIdx}`}
            position={[0.006, -0.144 + pIdx * 0.017, 0.018]}
          >
            <boxGeometry args={[0.024, 0.006, 0.006]} />
            <meshStandardMaterial color="#161918" roughness={0.85} />
          </mesh>
        ))}
        {/* 10 Heavy Extruded Steel Ratchet Teeth Visibly Protruding from Side Rail */}
        {Array.from({ length: 10 }).map((_, tIdx) => {
          const ty = -0.144 + tIdx * 0.032;
          return (
            <group key={tIdx} position={[0.006, ty, 0.021]}>
              <mesh position={[-0.016, 0, 0]} castShadow>
                <boxGeometry args={[0.012, 0.009, 0.01]} />
                <meshStandardMaterial
                  color="#8a929a"
                  metalness={0.88}
                  roughness={0.28}
                />
              </mesh>
              <mesh position={[0.016, 0, 0]} castShadow>
                <boxGeometry args={[0.014, 0.01, 0.012]} />
                <meshStandardMaterial
                  color="#8a929a"
                  metalness={0.88}
                  roughness={0.28}
                />
              </mesh>
            </group>
          );
        })}

        {/* Multi-Part Soviet Reactor Control Rod / Lathe-Turned Dark Phenolic Bakelite T-Handle */}
        <group ref={leverGroupRef} position={[0.006, 0, 0.026]}>
          {/* Central Bolted Pivot Knuckle Inside Quadrant Slot */}
          <mesh position={[0, 0, 0.004]} castShadow>
            <boxGeometry args={[0.044, 0.032, 0.024]} />
            <meshStandardMaterial
              color="#2b3036"
              metalness={0.82}
              roughness={0.32}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          <mesh
            position={[0, 0, 0.006]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.008, 0.008, 0.05, 8]} />
            <meshStandardMaterial
              color="#8a929a"
              metalness={0.9}
              roughness={0.22}
            />
          </mesh>
          {/* Twin Thick Chrome-Steel Lever Arms */}
          {[-0.016, 0.016].map((lx, lIdx) => (
            <mesh
              key={lIdx}
              position={[lx, 0, 0.028]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.0065, 0.0075, 0.058, 10]} />
              <meshStandardMaterial
                color="#d4dce0"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
          ))}
          {/* Lathe-Turned Dark Phenolic Bakelite Cylindrical T-Grip */}
          <mesh
            position={[0, 0, 0.058]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.02, 0.02, 0.108, 14]} />
            <meshStandardMaterial
              color={
                sector === "vodka" || sector === "steel" ? "#4a1210" : "#1c1817"
              }
              roughness={0.32}
              metalness={0.15}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          {/* Machined Brushed-Steel End-Ferrules */}
          {[-0.049, 0.049].map((fx, fIdx) => (
            <mesh
              key={fIdx}
              position={[fx, 0, 0.058]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.0215, 0.0215, 0.014, 14]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.85}
                roughness={0.35}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          ))}
          {/* Single Thin Recessed Industrial Enamel Indicator Ring */}
          <mesh
            position={[0, 0, 0.058]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.0208, 0.0208, 0.009, 14]} />
            <meshStandardMaterial
              ref={handleRingMatRef}
              color={accentColor}
              roughness={0.36}
              metalness={0.25}
            />
          </mesh>
          {/* Spring-Loaded Brushed-Steel Detent Release Button on Side of T-Grip */}
          <mesh
            position={[0.059, 0, 0.058]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.0095, 0.0095, 0.012, 10]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.26}
            />
          </mesh>
        </group>
      </group>

      {/* Labeled -10 / -5 / +5 / +10 MW Quick-Step Plungers */}
      <group
        position={[-0.108, -0.208, 0.038]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGameStore.getState();
          if (s.isBlackout || s.komradOverrideLocked) {
            playLeverRatchet(0.4);
            return;
          }
          playLeverRatchet(0.85);
          s.shiftSectorPower(sector, -10);
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.066, 0.038, 0.032]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.48}
            metalness={0.65}
          />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.06, 0.032]} />
          <meshStandardMaterial map={minusBtnTex} roughness={0.6} />
        </mesh>
      </group>

      <group
        position={[-0.036, -0.208, 0.038]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGameStore.getState();
          if (s.isBlackout || s.komradOverrideLocked) {
            playLeverRatchet(0.4);
            return;
          }
          playDetentClick(Math.max(0, Math.round((s.sectorMW[sector] - 5) / 5)));
          s.shiftSectorPower(sector, -5);
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.066, 0.038, 0.032]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.48}
            metalness={0.65}
          />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.06, 0.032]} />
          <meshStandardMaterial map={minus5BtnTex} roughness={0.6} />
        </mesh>
      </group>

      <group
        position={[0.036, -0.208, 0.038]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGameStore.getState();
          if (s.isBlackout || s.komradOverrideLocked) {
            playLeverRatchet(0.4);
            return;
          }
          playDetentClick(Math.min(10, Math.round((s.sectorMW[sector] + 5) / 5)));
          s.shiftSectorPower(sector, 5);
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.066, 0.038, 0.032]} />
          <meshStandardMaterial
            color="#23312b"
            roughness={0.48}
            metalness={0.65}
          />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.06, 0.032]} />
          <meshStandardMaterial map={plus5BtnTex} roughness={0.6} />
        </mesh>
      </group>

      <group
        position={[0.108, -0.208, 0.038]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGameStore.getState();
          if (s.isBlackout || s.komradOverrideLocked) {
            playLeverRatchet(0.4);
            return;
          }
          playLeverRatchet(1.1);
          s.shiftSectorPower(sector, 10);
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.066, 0.038, 0.032]} />
          <meshStandardMaterial
            color="#23312b"
            roughness={0.48}
            metalness={0.65}
          />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.06, 0.032]} />
          <meshStandardMaterial map={plusBtnTex} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
};

export const HighDetailReactorPanel3D: React.FC = React.memo(() => {
  const panelGroupRef = useRef<THREE.Group>(null);
  const [az5CoverOpen, setAz5CoverOpen] = useState(false);
  const az5CoverGroupRef = useRef<THREE.Group>(null);
  const boronPlungerMeshRef = useRef<THREE.Group>(null);
  const boronLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const boronDepressRef = useRef(0);
  const redlineScaleBlockRefs = useRef<
    Array<THREE.MeshStandardMaterial | null>
  >([]);
  const statusMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastStatusDrawRef = useRef(0);

  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const ribbedGlassTex = useMemo(() => getRibbedGlassCellTexture(), []);

  const boronPlateTex = useMemo(
    () =>
      makePlaqueTex("BORON INJECTION", "-140°C // 45%", {
        width: 384,
        height: 104,
        titleSize: 30,
        subSize: 28,
        titleColor: "#33ff66",
        subColor: "#ffcc00",
        borderColor: "#28b862",
      }),
    [],
  );

  const boronCapTex = useMemo(
    () =>
      createCrispPanelTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#1b6e38";
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c8d6cd";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = '900 26px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("BORON", cx, cy - 12);
        ctx.fillStyle = "#ffcc00";
        ctx.font = '900 24px "VT323", monospace';
        ctx.fillText("-140°C", cx, cy + 16);
      }),
    [],
  );

  const statusTexture = useMemo(() => createCrispPanelTexture(768, 144), []);
  const lastTotalBlocksSigRef = useRef("");

  const topHeaderPlateTex = useMemo(
    () =>
      makePlaqueTex(
        "REACTOR CONTROL PANEL // UNIT A",
        "CORE NO. 4 • PUMPS A/B • MW ROUTING",
        {
          width: 768,
          height: 112,
          titleSize: 32,
          subSize: 24,
          titleColor: "#ffffff",
          titleStroke: "#ffffff",
          subColor: "#44ff77",
          subStroke: "#44ff77",
          borderColor: "#b8a46b",
        },
      ),
    [],
  );

  const az5PlateTex = useMemo(
    () =>
      makePlaqueTex("AZ-5 SCRAM", "EMERGENCY SCRAM", {
        width: 384,
        height: 104,
        titleSize: 35,
        subSize: 27,
        titleColor: "#ff4444",
        subColor: "#ffcc00",
        borderColor: "#c92a1d",
      }),
    [],
  );

  const az5HazardTex = useMemo(
    () =>
      createCrispPanelTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#c48a18";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#141414";
        for (let i = -256; i < 512; i += 36) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 18, 0);
          ctx.lineTo(i + 18 + h, h);
          ctx.lineTo(i + h, h);
          ctx.closePath();
          ctx.fill();
        }
      }),
    [],
  );

  const az5ButtonTopTex = useMemo(
    () =>
      createCrispPanelTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#8a1612";
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d4be7f";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = '900 32px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("AZ-5", cx, cy - 10);
        ctx.font = '900 22px "Kremlin", monospace';
        ctx.fillText("SCRAM", cx, cy + 18);
      }),
    [],
  );

  const minusBtnTex = useMemo(
    () =>
      createCrispPanelTexture(96, 64, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffcc00";
        ctx.font = '900 38px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("-10", w / 2, 45);
      }),
    [],
  );

  const plusBtnTex = useMemo(
    () =>
      createCrispPanelTexture(96, 64, (ctx, w, h) => {
        ctx.fillStyle = "#1c2b24";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#44ff77";
        ctx.font = '900 38px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("+10", w / 2, 45);
      }),
    [],
  );

  useEffect(() => {
    applySovietPBRToHierarchy(panelGroupRef.current);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !e.repeat) {
        playSwitchClank(true);
        useGameStore.getState().setShiftKeyHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        playSwitchClank(false);
        useGameStore.getState().setShiftKeyHeld(false);
      }
    };
    const handleBlur = () => {
      useGameStore.getState().setShiftKeyHeld(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = useGameStore.getState();
      if (s.phase !== "playing") return;
      const totalMW =
        s.powerAllocation.cooling +
        s.powerAllocation.defense +
        s.powerAllocation.facility;
      const isRedline =
        totalMW > s.maxSafePower ||
        s.coreTemp >= 760 ||
        s.redlineInstability >= 50;
      updateSoundtrackState(isRedline, s.isMusicMuted);

      const clickProb = Math.min(0.95, 0.14 + (s.radiationLevel / 12) * 0.8);
      if (Math.random() < clickProb) {
        playGeigerClick();
      }
    }, 280);
    return () => window.clearInterval(timer);
  }, []);

  useFrame(({ clock }, delta) => {
    const state = useGameStore.getState();
    state.tickThermodynamics(delta);
    const totalMW =
      state.powerAllocation.cooling +
      state.powerAllocation.defense +
      state.powerAllocation.facility +
      (state.ventilationActive ? 10 : 0);

    if (az5CoverGroupRef.current) {
      const targetRotX = az5CoverOpen ? -1.95 : 0;
      az5CoverGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        az5CoverGroupRef.current.rotation.x,
        targetRotX,
        0.22,
      );
    }

    if (boronDepressRef.current > 0) {
      boronDepressRef.current = Math.max(0, boronDepressRef.current - delta * 2.5);
    }
    if (boronPlungerMeshRef.current) {
      const targetZ = 0.036 - boronDepressRef.current * 0.03;
      boronPlungerMeshRef.current.position.z = THREE.MathUtils.lerp(
        boronPlungerMeshRef.current.position.z,
        targetZ,
        0.3,
      );
    }
    if (boronLampMatRef.current) {
      const ready =
        state.boronCooldown <= 0 &&
        state.boronTankLevel >= 40 &&
        !state.isBlackout;
      boronLampMatRef.current.color.set(ready ? "#33ff66" : "#ffb000");
      boronLampMatRef.current.emissive.set(ready ? "#33ff66" : "#ffb000");
      boronLampMatRef.current.emissiveIntensity = ready ? 1.4 : 0.45;
    }

    const activeTotalBlocks = Math.round(totalMW / 10);
    const totalBlocksSig = `${activeTotalBlocks}|${state.isBlackout}`;
    if (totalBlocksSig !== lastTotalBlocksSigRef.current) {
      lastTotalBlocksSigRef.current = totalBlocksSig;
      for (let i = 0; i < 18; i++) {
        const mat = redlineScaleBlockRefs.current[i];
        if (!mat) continue;
        const isLit = !state.isBlackout && i < activeTotalBlocks;
        const isRedlineBlock = i >= 10;
        const hex = isRedlineBlock ? "#c92a1d" : i >= 8 ? "#d98218" : "#28b862";
        mat.color.set(isLit ? hex : "#141916");
        mat.emissive.set(isLit ? hex : "#000000");
        mat.emissiveIntensity = isLit ? (isRedlineBlock ? 1.55 : 1.05) : 0;
      }
    }

    const now = clock.getElapsedTime();
    if (now - lastStatusDrawRef.current < 0.08) return;

    const totalSuppliedMW =
      state.sectorMW.pripyat +
      state.sectorMW.kolkhoz +
      state.sectorMW.duga +
      state.sectorMW.kgb +
      state.sectorMW.vodka +
      state.sectorMW.steel;
    const totalTargetMW =
      state.targetSectorMW.pripyat +
      state.targetSectorMW.kolkhoz +
      state.targetSectorMW.duga +
      state.targetSectorMW.kgb +
      state.targetSectorMW.vodka +
      state.targetSectorMW.steel;
    const all6Matched =
      state.sectorMW.pripyat === state.targetSectorMW.pripyat &&
      state.sectorMW.kolkhoz === state.targetSectorMW.kolkhoz &&
      state.sectorMW.duga === state.targetSectorMW.duga &&
      state.sectorMW.kgb === state.targetSectorMW.kgb &&
      state.sectorMW.vodka === state.targetSectorMW.vodka &&
      state.sectorMW.steel === state.targetSectorMW.steel;

    const mandateText =
      state.boronPoisoningTimer > 0
        ? `● BORON DAMPING (-20% MW — ${Math.ceil(state.boronPoisoningTimer)}S)`
        : state.activeMandate && !state.activeMandate.fulfilled
          ? state.activeMandate.requirementText
          : state.isShiftKeyHeld
            ? "● [SHIFT] SYNC ACTIVE — GRID LOCKED 50.0 HZ"
            : all6Matched
              ? "● ALL 6 SECTORS BALANCED — STAMP [ОДОБРЕНО]"
              : "● MATCH ALL 6 LEVERS TO TARGETS BELOW";
    const sig = `${Math.round(state.coreTemp / 2) * 2}|${Math.round(state.pressureBar)}|${state.radiationLevel.toFixed(1)}|${totalMW}|${totalSuppliedMW}|${totalTargetMW}|${all6Matched}|${Math.round(state.redlineInstability)}|${state.isShiftKeyHeld}|${state.az5Cooldown}|${Math.ceil(state.boronPoisoningTimer)}|${state.isBlackout}|${mandateText}`;
    const tex = statusMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (tex && tex.userData.lastSig !== sig) {
      lastStatusDrawRef.current = now;
      tex.userData.lastSig = sig;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        paintSovietCRTScreen(ctx, 768, 144, {
          headerCode: "CRT-84A",
          cells: [
            {
              label: "CORE TEMP",
              val: `${Math.round(state.coreTemp)} °C`,
              danger: state.coreTemp >= 750,
            },
            {
              label: "LOOP PRESSURE",
              val: `${state.pressureBar.toFixed(0)} BAR`,
              danger: state.pressureBar >= 90,
            },
            {
              label: "ROOM RADIATION",
              val: `${state.radiationLevel.toFixed(1)} R/H`,
              danger: state.radiationLevel >= 7.5,
            },
          ],
          statusLine: `LOAD: ${totalSuppliedMW}/${totalTargetMW} MW (${all6Matched ? "BALANCED" : "RE-ROUTE!"}) | INSTAB: ${Math.round(state.redlineInstability)}%`,
          statusDanger: !all6Matched || totalMW > 130 || state.coreTemp >= 750,
          footerLine: mandateText.slice(0, 52),
          isBlackout: state.isBlackout,
        });
        tex.needsUpdate = true;
      }
    }
  });

  return (
    <group
      ref={panelGroupRef}
      position={[-2.15, 0, -1.08]}
      rotation={[0, 0.42, 0]}
    >
      {/* 1. Main Hammered Cast-Iron Reactor Console Body & Corner Gusset Framing */}
      <mesh position={[0, 1.18, -0.18]} castShadow receiveShadow>
        <boxGeometry args={[1.66, 2.38, 0.42]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.45}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>
      <mesh position={[0, 1.18, -0.22]} castShadow receiveShadow>
        <boxGeometry args={[1.74, 2.46, 0.36]} />
        <meshStandardMaterial
          color="#141414"
          roughness={0.5}
          metalness={0.6}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* Top Raised Engraved Brass Header Plaque (Centered cleanly inside frame with generous top margin) */}
      <mesh position={[0, 2.13, 0.044]}>
        <planeGeometry args={[1.40, 0.148]} />
        <meshStandardMaterial
          map={topHeaderPlateTex}
          emissive="#ffffff"
          emissiveMap={topHeaderPlateTex}
          emissiveIntensity={0.35}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Corner Gusset Plates & Overhead Hooded Panel Work-Lights */}
      {(
        [
          [-0.78, 2.32],
          [0.78, 2.32],
          [-0.78, 0.14],
          [0.78, 0.14],
        ] as const
      ).map(([gx, gy], gIdx) => (
        <group key={gIdx} position={[gx, gy, 0.032]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.14, 0.14, 0.016]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.72}
              roughness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {(
            [
              [-0.044, 0.044],
              [0.044, 0.044],
              [-0.044, -0.044],
              [0.044, -0.044],
            ] as const
          ).map(([bx, by], bIdx) => (
            <mesh
              key={bIdx}
              position={[bx, by, 0.012]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.008, 0.008, 0.01, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
          ))}
        </group>
      ))}
      {[-0.48, 0.48].map((lx, lIdx) => (
        <group key={lIdx} position={[lx, 2.43, 0.08]}>
          {/* Curved Gooseneck Arm */}
          <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.014, 0.11, 8]} />
            <meshStandardMaterial color="#18211b" metalness={0.75} roughness={0.38} />
          </mesh>
          {/* Industrial Enamel Lamp Hood */}
          <mesh position={[0, -0.018, 0.028]} rotation={[0.45, 0, 0]} castShadow>
            <cylinderGeometry args={[0.024, 0.068, 0.065, 12]} />
            <meshStandardMaterial
              color="#23312b"
              metalness={0.68}
              roughness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* Glowing Warm Tungsten Work-Bulb */}
          <mesh position={[0, -0.036, 0.036]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial
              color="#ffcf75"
              emissive="#ffaa33"
              emissiveIntensity={1.6}
            />
          </mesh>
        </group>
      ))}

      {/* 2. Top Row: 3 High-Res 16-Part Bolted Soviet Manometer Gauges */}
      <group position={[0, 1.775, 0.03]}>
        <HighDetailManometer3D
          position={[-0.51, 0, 0]}
          title="CORE TEMP"
          cyrillicSub="°С АКТИВНОЙ ЗОНЫ"
          unit="0-1000 °C"
          serial="№ 84-Т1"
          min={250}
          max={1000}
          dangerThreshold={750}
          getValue={() => useGameStore.getState().coreTemp}
        />
        <HighDetailManometer3D
          position={[0, 0, 0]}
          title="LOOP BAR"
          cyrillicSub="ДАВЛЕНИЕ КОНТУРА"
          unit="0-120 BAR"
          serial="№ 84-П2"
          min={30}
          max={120}
          dangerThreshold={90}
          getValue={() => useGameStore.getState().pressureBar}
        />
        <HighDetailManometer3D
          position={[0.51, 0, 0]}
          title="RADIATION"
          cyrillicSub="ДОЗИМЕТР Р/Ч"
          unit="0-15 R/H"
          serial="№ 84-Д3"
          min={0}
          max={15}
          dangerThreshold={7.5}
          getValue={() => useGameStore.getState().radiationLevel}
        />
      </group>

      {/* 3. Molded Phosphor-Green CRT Monitor Bay (`ЭЛТ ВЛ-84А`) */}
      <SovietCRTMonitorBay3D
        position={[0, 1.46, 0.03]}
        screenMatRef={statusMatRef}
        screenTexture={statusTexture}
        modelBadge="ЭЛТ ВЛ-84А"
      />

      {/* 4. Middle Row: 2 Sculpted Cast-Iron Pump Valves + Multi-Part Hinged AZ-5 Safety Cage */}
      <group position={[0, 1.09, 0.03]}>
        <SculptedPumpValveAssembly3D
          position={[-0.52, 0, 0]}
          pumpIndex={0}
          label="COOLING PUMP A"
          subLabel="NORTH H2O: CITY/FARM"
        />
        <SculptedPumpValveAssembly3D
          position={[0, 0, 0]}
          pumpIndex={1}
          label="COOLING PUMP B"
          subLabel="SOUTH H2O: VODKA"
        />

        {/* Multi-Part AZ-5 Emergency Scram Assembly */}
        <group position={[0.52, 0.02, 0.02]}>
          {/* Raised Brass & Crimson Nameplate (+25% larger) */}
          <mesh position={[0, 0.184, 0.016]} castShadow>
            <boxGeometry args={[0.375, 0.098, 0.012]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.184, 0.023]}>
            <planeGeometry args={[0.358, 0.085]} />
            <meshStandardMaterial
              map={az5PlateTex}
              emissive="#ffffff"
              emissiveMap={az5PlateTex}
              emissiveIntensity={0.35}
              roughness={0.55}
            />
          </mesh>

          {/* Yellow/Black Hazard-Striped Cast-Iron Collar */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.256, 0.246, 0.042]} />
            <meshStandardMaterial
              map={az5HazardTex}
              roughness={0.48}
              metalness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* 4 Corner Hex Bolts on AZ-5 Collar */}
          {(
            [
              [-0.105, 0.1],
              [0.105, 0.1],
              [-0.105, -0.1],
              [0.105, -0.1],
            ] as const
          ).map(([bx, by], bIdx) => (
            <mesh
              key={bIdx}
              position={[bx, by, 0.025]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.009, 0.009, 0.012, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.25}
              />
            </mesh>
          ))}

          {/* Recessed Dark Shadow Well & Stepped Chrome Plunger Shroud */}
          <mesh position={[0, 0, 0.006]}>
            <boxGeometry args={[0.205, 0.195, 0.044]} />
            <meshStandardMaterial
              color="#111513"
              roughness={0.75}
              metalness={0.5}
            />
          </mesh>
          <mesh
            position={[0, 0, 0.032]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.082, 0.09, 0.024, 16]} />
            <meshStandardMaterial
              color="#c8d2cc"
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>

          {/* Glowing Engraved Red Bakelite АЗ-5 Push-Button Plunger */}
          <group
            position={[0, 0, 0.048]}
            onClick={(e) => {
              e.stopPropagation();
              if (!az5CoverOpen) {
                playSafetyCoverFlip(true);
                setAz5CoverOpen(true);
                return;
              }
              const s = useGameStore.getState();
              if (s.az5Available && s.az5Cooldown === 0) {
                playSwitchClank(true);
                playKlaxonBurst();
                s.triggerAz5();
                playSafetyCoverFlip(false);
                setAz5CoverOpen(false);
              } else {
                playLeverRatchet(0.4);
              }
            }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.068, 0.074, 0.048, 16]} />
              <meshStandardMaterial
                color="#ff2a2a"
                emissive="#ff2a2a"
                emissiveIntensity={az5CoverOpen ? 1.1 : 0.35}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, 0, 0.025]}>
              <circleGeometry args={[0.064, 16]} />
              <meshStandardMaterial
                map={az5ButtonTopTex}
                emissive="#ff2a2a"
                emissiveIntensity={az5CoverOpen ? 0.55 : 0.18}
                roughness={0.35}
              />
            </mesh>
          </group>

          {/* Top Brass Hinge Pin & Coiled Torsion Spring */}
          <mesh
            position={[0, 0.105, 0.034]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.01, 0.01, 0.21, 10]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.22}
            />
          </mesh>
          {[-0.04, 0, 0.04].map((sx, sIdx) => (
            <mesh
              key={sIdx}
              position={[sx, 0.105, 0.034]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <torusGeometry args={[0.013, 0.003, 6, 10]} />
              <meshStandardMaterial
                color="#d0dad4"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
          ))}

          {/* Hinged Red-Tinted Plexiglass Safety Cover with Side Ribs & Bottom Lift-Tab */}
          <group
            ref={az5CoverGroupRef}
            position={[0, 0.105, 0.034]}
            onClick={(e) => {
              e.stopPropagation();
              setAz5CoverOpen((prev) => {
                playSafetyCoverFlip(!prev);
                return !prev;
              });
            }}
          >
            <mesh position={[0, -0.102, 0.036]}>
              <boxGeometry args={[0.204, 0.204, 0.072]} />
              <meshStandardMaterial
                color="#ff2a2a"
                transparent
                opacity={0.48}
                roughness={0.16}
                metalness={0.15}
              />
            </mesh>
            {/* Brass Bottom Lift-Tab Handle & Lead-Seal Wire Loop */}
            <mesh position={[0, -0.206, 0.068]} castShadow>
              <boxGeometry args={[0.095, 0.016, 0.028]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.24}
              />
            </mesh>
            {/* Twisted Wire Lead-Seal (`ПЛОМБА КГБ`) on Safety Cover */}
            <group position={[0.072, -0.198, 0.056]}>
              <mesh rotation={[0, Math.PI / 4, 0]}>
                <torusGeometry args={[0.014, 0.002, 6, 12]} />
                <meshStandardMaterial color="#c8d2cc" metalness={0.9} roughness={0.25} />
              </mesh>
              <mesh position={[0.008, -0.014, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.009, 0.009, 0.006, 8]} />
                <meshStandardMaterial color="#6e7571" metalness={0.65} roughness={0.5} />
              </mesh>
            </group>
          </group>

          {/* Heavy Brass-Ringed Boron Acid Injection Push-Plunger (`BORON INJECTION`) */}
          <group
            position={[0, -0.172, 0.016]}
            onPointerDown={(e) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              const s = useGameStore.getState();
              if (s.boronCooldown > 0 || s.boronTankLevel < 40 || s.isBlackout) {
                playLeverRatchet(0.45);
                s.injectBoronAcid();
                return;
              }
              boronDepressRef.current = 1.0;
              playSwitchClank(true);
              playPneumaticWhoosh();
              s.injectBoronAcid();
            }}
          >
            {/* Bolted Cast-Iron Boron Housing Plate (+25% larger plaque) */}
            <mesh position={[0, 0, 0.004]} castShadow receiveShadow>
              <boxGeometry args={[0.325, 0.076, 0.016]} />
              <meshStandardMaterial
                color="#141816"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.006}
              />
            </mesh>
            <mesh position={[-0.018, 0, 0.014]} castShadow>
              <planeGeometry args={[0.21, 0.062]} />
              <meshStandardMaterial
                map={boronPlateTex}
                emissive="#ffffff"
                emissiveMap={boronPlateTex}
                emissiveIntensity={0.42}
                roughness={0.55}
              />
            </mesh>
            <CagedSovietJewelLamp3D
              position={[-0.138, 0, 0.014]}
              lampMatRef={boronLampMatRef}
              scale={0.68}
            />
            {/* Brass Outer Collar */}
            <mesh
              position={[0.116, 0, 0.018]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.032, 0.036, 0.024, 16]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.24}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* Depressible Boron Plunger Cap with Engraved Top Face */}
            <group ref={boronPlungerMeshRef} position={[0.116, 0, 0.036]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.025, 0.027, 0.034, 16]} />
                <meshStandardMaterial
                  color="#25a852"
                  emissive="#33ff66"
                  emissiveIntensity={0.48}
                  roughness={0.3}
                />
              </mesh>
              <mesh position={[0, 0, 0.018]}>
                <circleGeometry args={[0.024, 16]} />
                <meshStandardMaterial
                  map={boronCapTex}
                  emissive="#ffffff"
                  emissiveMap={boronCapTex}
                  emissiveIntensity={0.55}
                  roughness={0.35}
                />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* 5. Bottom Row: 6-Lever Regional Substation Bank (0–50 MW each) + 18-Segment Redline Bar (Raised +0.13m and shifted -0.09m left so all 6 levers & buttons sit well above and behind desk plane!) */}
      <group position={[-0.09, 0.52, 0.04]}>
        <IndustrialPowerColumn3D
          position={[-0.625, 0.02, 0]}
          sector="pripyat"
          label="1. PRIPYAT CITY"
          subLabel="ПРИПЯТЬ"
          accentColor="#28b862"
          ledColor="#28b862"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[-0.375, 0.02, 0]}
          sector="kolkhoz"
          label="2. KOLKHOZ FARM"
          subLabel="СОВХОЗ"
          accentColor="#28b862"
          ledColor="#28b862"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[-0.125, 0.02, 0]}
          sector="duga"
          label="3. DUGA-1 RADAR"
          subLabel="ДУГА-1"
          accentColor="#d99b26"
          ledColor="#d99b26"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.125, 0.02, 0]}
          sector="kgb"
          label="4. KGB BUNKER 07"
          subLabel="КГБ-07"
          accentColor="#d99b26"
          ledColor="#d99b26"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.375, 0.02, 0]}
          sector="vodka"
          label="5. VODKA PLANT"
          subLabel="ВОДКА"
          accentColor="#2ad4c8"
          ledColor="#2ad4c8"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.625, 0.02, 0]}
          sector="steel"
          label="6. STEEL WORKS"
          subLabel="СТАЛЬ"
          accentColor="#2ad4c8"
          ledColor="#2ad4c8"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />

        {/* 18-Segment Recessed Ribbed Phosphor Glass Total MW & Redline Bar */}
        <group position={[0.06, -0.27, 0.03]}>
          <mesh position={[0, 0, -0.006]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.088, 0.026]} />
            <meshStandardMaterial
              color="#161c19"
              roughness={0.44}
              metalness={0.72}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
              roughnessMap={ironTex.roughnessMap}
            />
          </mesh>
          {/* 4 Corner Hex Bolts on Total MW Housing */}
          {(
            [
              [-0.725, 0.032],
              [0.725, 0.032],
              [-0.725, -0.032],
              [0.725, -0.032],
            ] as const
          ).map(([bx, by], bIdx) => (
            <mesh
              key={bIdx}
              position={[bx, by, 0.012]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.006, 0.006, 0.008, 6]} />
              <meshStandardMaterial
                color="#8a929a"
                metalness={0.86}
                roughness={0.28}
              />
            </mesh>
          ))}
          {Array.from({ length: 18 }).map((_, idx) => (
            <group key={idx} position={[-0.64 + idx * 0.075, 0, 0.006]}>
              <mesh>
                <boxGeometry args={[0.056, 0.048, 0.016]} />
                <meshStandardMaterial
                  ref={(el) => {
                    redlineScaleBlockRefs.current[idx] = el;
                  }}
                  map={ribbedGlassTex}
                  emissiveMap={ribbedGlassTex}
                  color="#141916"
                  roughness={0.24}
                  metalness={0.18}
                />
              </mesh>
              <mesh position={[0.037, 0, 0.006]}>
                <boxGeometry args={[0.006, 0.062, 0.014]} />
                <meshStandardMaterial
                  color="#141816"
                  metalness={0.78}
                  roughness={0.38}
                />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
});

interface HighDetailKnifeBreaker3DProps {
  breakerArmRef: React.RefObject<THREE.Group | null>;
  breakerDragRef: React.RefObject<{
    active: boolean;
    startY: number;
    progress: number;
  }>;
  breakerPlateTex: THREE.CanvasTexture;
}

export const HighDetailKnifeBreaker3D: React.FC<
  HighDetailKnifeBreaker3DProps
> = React.memo(({ breakerArmRef, breakerDragRef, breakerPlateTex }) => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const sparkLightRef = useRef<THREE.PointLight>(null);
  const sparkFlashRef = useRef(0);

  useFrame((_, delta) => {
    if (sparkFlashRef.current > 0) {
      sparkFlashRef.current = Math.max(0, sparkFlashRef.current - delta * 6.5);
      if (sparkLightRef.current) {
        sparkLightRef.current.visible = sparkFlashRef.current > 0.01;
        sparkLightRef.current.intensity = sparkFlashRef.current * 4.5;
      }
    }
  });

  const handleBreakerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!breakerDragRef.current.active) return;
    e.stopPropagation();
    const finalProg = breakerDragRef.current.progress;
    const dy = Math.abs(e.nativeEvent.clientY - breakerDragRef.current.startY);
    breakerDragRef.current.active = false;
    releaseCanvasPointer(e);
    const s = useGameStore.getState();
    const isClickAction =
      dy < 12 && (s.phase !== "playing" || s.isBlackout);
    if (!isClickAction && finalProg < 0.45) {
      playLeverRatchet(0.5);
      return;
    }
    playKnifeSwitchSlam(true);
    sparkFlashRef.current = 1.0;
    startSoundtrack();
    updateSoundtrackState(false, s.isMusicMuted);
    if (s.phase === "boot") {
      s.startShift();
    } else if (s.phase !== "playing") {
      s.resetShift();
    } else if (s.isBlackout) {
      s.recloseMainBreaker();
    }
  };

  return (
    <group
      position={[0.42, 0, 0.02]}
      onPointerDown={(e) => {
        if (useCameraLookStore.getState().isFreeLookMode) return;
        e.stopPropagation();
        const s = useGameStore.getState();
        breakerDragRef.current = {
          active: true,
          startY: e.nativeEvent.clientY,
          progress: s.phase === "playing" && !s.isBlackout ? 1 : 0,
        };
        captureCanvasPointer(e);
      }}
      onPointerMove={(e) => {
        if (!breakerDragRef.current.active) return;
        e.stopPropagation();
        // Dragging physically upward or downward across the arc
        const dy = Math.abs(e.nativeEvent.clientY - breakerDragRef.current.startY);
        breakerDragRef.current.progress = THREE.MathUtils.clamp(
          dy / 65,
          0,
          1,
        );
      }}
      onPointerUp={handleBreakerUp}
      onLostPointerCapture={handleBreakerUp}
    >
      <mesh position={[0, 0.22, 0.005]} castShadow>
        <boxGeometry args={[0.515, 0.12, 0.01]} />
        <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.22, 0.012]}>
        <planeGeometry args={[0.50, 0.112]} />
        <meshStandardMaterial
          map={breakerPlateTex}
          emissive="#ffffff"
          emissiveMap={breakerPlateTex}
          emissiveIntensity={0.45}
          roughness={0.65}
        />
      </mesh>
      {/* Cast-Iron & Brushed-Steel Perimeter Safety Cage Bars */}
      {[-0.175, 0.175].map((hx, hIdx) => (
        <mesh key={hIdx} position={[hx, 0, 0.048]} castShadow>
          <boxGeometry args={[0.016, 0.34, 0.042]} />
          <meshStandardMaterial
            color="#2b3036"
            roughness={0.38}
            metalness={0.82}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
      ))}
      {/* Mechanical Arc-Chute Hood (`ДУГОГАСИТЕЛЬНАЯ КАМЕРА`) */}
      <mesh position={[0, 0.148, 0.056]} castShadow receiveShadow>
        <boxGeometry args={[0.31, 0.056, 0.088]} />
        <meshStandardMaterial
          color="#1b241f"
          roughness={0.42}
          metalness={0.72}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.006}
        />
      </mesh>
      <pointLight
        ref={sparkLightRef}
        visible={false}
        position={[0, 0.08, 0.12]}
        color="#ffdf78"
        intensity={0}
        distance={1.4}
        decay={1.8}
      />
      {/* Heavy Cast-Iron Knife-Switch Base & Ceramic Insulator Stand-Offs */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.32, 0.32, 0.072]} />
        <meshStandardMaterial
          color="#141816"
          roughness={0.45}
          metalness={0.68}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
        />
      </mesh>
      {(
        [
          [-0.075, 0.095],
          [0.075, 0.095],
          [-0.075, -0.095],
          [0.075, -0.095],
        ] as const
      ).map(([cx, cy], cIdx) => (
        <group key={cIdx} position={[cx, cy, 0.046]}>
          {/* Ribbed Porcelain Insulator Post */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.022, 0.026, 0.028, 12]} />
            <meshStandardMaterial
              color="#d8d2c0"
              roughness={0.3}
              metalness={0.1}
            />
          </mesh>
          {/* Heavy Copper Contact Jaw Clip */}
          <mesh position={[0, 0, 0.024]} castShadow>
            <boxGeometry args={[0.024, 0.038, 0.032]} />
            <meshStandardMaterial
              color="#c87d46"
              metalness={0.88}
              roughness={0.24}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        </group>
      ))}

      <group ref={breakerArmRef} position={[0, 0, 0.045]}>
        {/* Dual Heavy Copper Knife Blades */}
        {[-0.075, 0.075].map((bx, bIdx) => (
          <mesh
            key={bIdx}
            position={[bx, 0, 0.095]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <boxGeometry args={[0.014, 0.19, 0.028]} />
            <meshStandardMaterial
              color="#c87d46"
              metalness={0.9}
              roughness={0.22}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
        ))}
        {/* Lathe-Turned Dark Oxblood Phenolic Bakelite Crossbar Stirrup Handle & Steel Ferrules */}
        <mesh
          position={[0, 0, 0.19]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.03, 0.03, 0.24, 16]} />
          <meshStandardMaterial
            color="#4a1210"
            roughness={0.32}
            metalness={0.15}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
        {[-0.108, 0.108].map((rx, rIdx) => (
          <mesh
            key={rIdx}
            position={[rx, 0, 0.19]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.033, 0.033, 0.022, 16]} />
            <meshStandardMaterial
              color="#8a929a"
              metalness={0.86}
              roughness={0.32}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.19]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0315, 0.0315, 0.012, 16]} />
          <meshStandardMaterial
            color="#c92a1d"
            roughness={0.36}
            metalness={0.25}
          />
        </mesh>
      </group>
    </group>
  );
});

// Precomputed 37-tile RBMK-1000 octagonal biological shield matrix (rows of 3, 5, 7, 7, 7, 5, 3 square stainless-steel blocks)
const RBMK_OCTAGON_TILES: ReadonlyArray<{
  readonly x: number;
  readonly y: number;
  readonly code: string;
}> = (() => {
  const tiles: Array<{ x: number; y: number; code: string }> = [];
  const pitch = 0.046;
  for (let r = -3; r <= 3; r++) {
    for (let c = -3; c <= 3; c++) {
      if (Math.abs(r) + Math.abs(c) > 4) continue;
      const rowCode = String(r + 4).padStart(2, "0");
      const colCode = String(c + 4).padStart(2, "0");
      tiles.push({
        x: c * pitch,
        y: -r * pitch,
        code: `${rowCode}-${colCode}`,
      });
    }
  }
  return tiles;
})();

/**
 * Wrap-Around Left-Rear (`UNIT A-2 // BIO-SHIELD & RBMK CORE MAP`)
 * and Rear (`UNIT B // CONTAINMENT & GAS LOOP`) Heavy Soviet Control Stations.
 * Zero cloned rainbow circles or bare floating rings — every control is a multi-part 3D industrial assembly.
 */
export const LeftRearWrapAroundPanel3D: React.FC<{
  variant?: "left-rear" | "rear";
}> = React.memo(({ variant = "left-rear" }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const ribbedGlassTex = useMemo(() => getRibbedGlassCellTexture(), []);
  const vfdMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastVfdDrawRef = useRef(0);

  // UNIT A-2 refs: 37 octagonal stainless-steel core tiles + pop-out rod pins + oil valve + reciprocating boron piston pump
  const channelLensMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>(
    [],
  );
  const channelPinGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const oilWheelRef = useRef<THREE.Group>(null);
  const oilLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const oilBarMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const boronPistonGroupRef = useRef<THREE.Group>(null);
  const boronBarMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);

  // UNIT B refs: Dual-pipe gas regulator wheel + 4 containment jewel lamps + 3 guarded toggles + emergency seal mushroom + toothed bubbler drain lever & sight-glass water column
  const gasWheelRef = useRef<THREE.Group>(null);
  const gasLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const gasBarMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const sealJewelMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const sealToggleBatRefs = useRef<Array<THREE.Group | null>>([]);
  const emergSealBtnRef = useRef<THREE.Group>(null);
  const emergSealDepressRef = useRef(0);
  const drainLeverGroupRef = useRef<THREE.Group>(null);
  const drainRingMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const sightGlassWaterMeshRef = useRef<THREE.Mesh>(null);
  const sightGlassWaterMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const [boronPistonPos, setBoronPistonPos] = useState(0); // 0 (up) to 1 (down)

  const pistonDragRef = useRef({
    active: false,
    startY: 0,
    startPos: 0,
    lastHalfStroke: 0,
  });

  const drainDragRef = useRef({
    active: false,
    startY: 0,
    progress: 0,
    lastHissTime: 0,
  });

  useEffect(() => {
    applySovietPBRToHierarchy(groupRef.current);
  }, []);

  const headerTex = useMemo(
    () =>
      makePlaqueTex(
        variant === "rear"
          ? "CONTAINMENT GAS LOOP // UNIT B"
          : "BIO-SHIELD RBMK CORE MAP // UNIT A-2",
        variant === "rear"
          ? "HELIUM-N2 • CONTAINMENT SEAL • BUBBLER DRAIN"
          : "37-TILE RBMK SHIELD • OIL COOLER • BORON PUMP",
        {
          width: 768,
          height: 112,
          titleSize: 31,
          subSize: 24,
          titleColor: "#ffffff",
          titleStroke: "#ffffff",
          subColor: "#44ff77",
          subStroke: "#44ff77",
          borderColor: "#b8a46b",
        },
      ),
    [variant],
  );

  // 768x144 Multi-Bay CRT Canvas Texture (Matches UNIT A with centered cells so text NEVER clips!)
  const vfdTexture = useMemo(() => createCrispPanelTexture(768, 144), []);

  const leftPlateTex = useMemo(
    () =>
      makePlaqueTex(
        variant === "rear" ? "HELIUM-N2" : "OIL COOLER",
        variant === "rear" ? "GAS WHEEL" : "VALVE WHEEL",
        {
          width: 416,
          height: 140,
          titleSize: 50,
          subSize: 38,
          titleColor: "#ffffff",
          titleStroke: "#000000",
          subColor: "#ffcc00",
          subStroke: "#000000",
          borderColor: "#b8a46b",
        },
      ),
    [variant],
  );

  const centerPlateTex = useMemo(
    () =>
      makePlaqueTex(
        variant === "rear" ? "SEAL SCRUBBERS" : "RBMK CORE",
        variant === "rear" ? "4 TOGGLES" : "37 ROD TILES",
        {
          width: 544,
          height: 140,
          titleSize: 50,
          subSize: 38,
          titleColor: "#ffffff",
          titleStroke: "#000000",
          subColor: "#44ff77",
          subStroke: "#000000",
          borderColor: "#b8a46b",
        },
      ),
    [variant],
  );

  const rightPlateTex = useMemo(
    () =>
      makePlaqueTex(
        variant === "rear" ? "BUBBLER DRAIN" : "BORON PUMP",
        variant === "rear" ? "RETURN H2O" : "REFILL TANK",
        {
          width: 416,
          height: 140,
          titleSize: 50,
          subSize: 38,
          titleColor: "#ffffff",
          titleStroke: "#000000",
          subColor: "#ffcc00",
          subStroke: "#000000",
          borderColor: "#b8a46b",
        },
      ),
    [variant],
  );

  const leverScalePlateTex = useMemo(
    () =>
      createCrispPanelTexture(64, 256, (ctx, w, h) => {
        ctx.fillStyle = "#8c7a4b";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#141816";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        const marks = ["100", "75", "50", "25", "0"];
        marks.forEach((m, idx) => {
          const y = 26 + idx * 52;
          ctx.fillStyle = idx === 0 ? "#6e1a14" : "#141414";
          ctx.font = '900 18px "VT323", monospace';
          ctx.textAlign = "center";
          ctx.fillText(m, w / 2 + 4, y + 5);
          ctx.fillRect(4, y, 8, 3);
        });
      }),
    [],
  );

  const sightGlassScaleTex = useMemo(
    () =>
      createCrispPanelTexture(64, 256, (ctx, w, h) => {
        ctx.fillStyle = "#161c19";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8c7a4b";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        const grads = [
          { lbl: "80%", y: 52, col: "#ff4444" },
          { lbl: "60%", y: 102, col: "#ffcc00" },
          { lbl: "40%", y: 152, col: "#ffffff" },
          { lbl: "20%", y: 202, col: "#44ff77" },
        ];
        grads.forEach((g) => {
          ctx.fillStyle = g.col;
          ctx.font = '900 19px "VT323", monospace';
          ctx.textAlign = "center";
          ctx.fillText(g.lbl, w / 2, g.y + 5);
          ctx.fillRect(4, g.y, 10, 2);
        });
      }),
    [],
  );

  const containmentSynopticTex = useMemo(
    () =>
      createCrispPanelTexture(512, 256, (ctx, w, h) => {
        ctx.fillStyle = "#111715";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#364940";
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, w - 8, h - 8);

        const labels = ["AIRLOCK A", "AIRLOCK B", "GRAPHITE N2", "BUBBLER SEAL"];
        labels.forEach((lbl, idx) => {
          const cx = 64 + idx * 128;
          // 30% taller framed label box at top
          ctx.fillStyle = "#17231e";
          ctx.fillRect(cx - 60, 8, 120, 32);
          ctx.strokeStyle = "#8c7a4b";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(cx - 60, 8, 120, 32);
          drawFittedPlaqueText(
            ctx,
            lbl,
            cx,
            30,
            116,
            '900 18px "Courier Prime", monospace',
            "#ffe066",
          );
          ctx.strokeStyle = "#6e6240";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(cx - 52, 42, 104, 72);
        });

        const toggleLabels = ["N2 PURGE", "RAD FILTER", "SEAL LOCK", "DRAIN VENT"];
        toggleLabels.forEach((tlbl, idx) => {
          const cx = 64 + idx * 128;
          // 30% taller framed label box above bottom row switches
          ctx.fillStyle = "#17231e";
          ctx.fillRect(cx - 60, 120, 120, 32);
          ctx.strokeStyle = idx === 3 ? "#c92a1d" : "#28b862";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(cx - 60, 120, 120, 32);
          drawFittedPlaqueText(
            ctx,
            tlbl,
            cx,
            142,
            116,
            '900 18px "Courier Prime", monospace',
            idx === 3 ? "#ff5555" : "#44ff77",
          );
        });
      }),
    [],
  );

  useFrame(({ clock }, delta) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, delta);

    // 1. Oil Cooler (UNIT A-2) & Helium-N2 Gas Regulator (UNIT B) Wheel & Bar Animation
    const oilWheelTargetRot = -(s.oilCoolerValve / 100) * Math.PI * 1.6;
    if (oilWheelRef.current) {
      oilWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        oilWheelRef.current.rotation.z,
        oilWheelTargetRot,
        0.48,
      );
    }
    const gasWheelTargetRot = -(s.nitrogenLoopValve / 100) * Math.PI * 1.6;
    if (gasWheelRef.current) {
      gasWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        gasWheelRef.current.rotation.z,
        gasWheelTargetRot,
        0.48,
      );
    }

    if (oilLampMatRef.current) {
      const ok = !s.isBlackout && s.lubeOilPressure >= 25;
      const col = ok ? "#33ff66" : "#ff2a2a";
      oilLampMatRef.current.color.set(col);
      oilLampMatRef.current.emissive.set(s.isBlackout ? "#000000" : col);
      oilLampMatRef.current.emissiveIntensity = s.isBlackout ? 0 : 1.35;
    }
    if (gasLampMatRef.current) {
      const highlightGasTut =
        variant === "rear" &&
        ((s.tutorialStep === 3 &&
          s.pumpThrottle[0] > 50 &&
          s.nitrogenLoopValve <= 40) ||
          (!s.isBlackout && s.coreTemp > 650));
      if (highlightGasTut) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 6.0);
        const col = pulse > 0.5 ? "#33ff66" : "#ffb000";
        gasLampMatRef.current.color.set(col);
        gasLampMatRef.current.emissive.set(col);
        gasLampMatRef.current.emissiveIntensity = 1.6 + pulse * 1.4;
      } else {
        const ok =
          !s.isBlackout && s.heliumPressure >= 16 && s.heliumPressure <= 68;
        const col = ok ? "#33ff66" : "#ff2a2a";
        gasLampMatRef.current.color.set(col);
        gasLampMatRef.current.emissive.set(s.isBlackout ? "#000000" : col);
        gasLampMatRef.current.emissiveIntensity = s.isBlackout ? 0 : 1.35;
      }
    }

    // 5-Segment Ribbed Phosphor Glass Oil Flow Bar on UNIT A-2
    const activeOilSegs = Math.round((s.oilCoolerValve / 100) * 5);
    for (let i = 0; i < 5; i++) {
      const mat = oilBarMatRefs.current[i];
      if (!mat) continue;
      const isLit = !s.isBlackout && i < activeOilSegs;
      const col = i === 0 ? "#d98218" : "#28b862";
      mat.color.set(isLit ? col : "#141916");
      mat.emissive.set(isLit ? col : "#000000");
      mat.emissiveIntensity = isLit ? 1.15 : 0;
    }

    // 10-Segment Ribbed Phosphor Glass Gas Flow Bar on UNIT B
    const activeGasSegs = Math.round((s.nitrogenLoopValve / 100) * 10);
    for (let i = 0; i < 10; i++) {
      const mat = gasBarMatRefs.current[i];
      if (!mat) continue;
      const isLit = !s.isBlackout && i < activeGasSegs;
      const col = i >= 8 ? "#d98218" : "#28b862";
      mat.color.set(isLit ? col : "#141916");
      mat.emissive.set(isLit ? col : "#000000");
      mat.emissiveIntensity = isLit ? 1.15 : 0;
    }

    // 2. UNIT A-2: 37 Octagonal Stainless-Steel RBMK Bio-Shield Tiles & Pop-Out Control Rod Pins
    let activeHotspots = 0;
    if (variant === "left-rear") {
      for (let i = 0; i < RBMK_OCTAGON_TILES.length; i++) {
        const lensMat = channelLensMatRefs.current[i];
        const pinGrp = channelPinGroupRefs.current[i];
        const severity = s.channelHotspots[i];
        const isRedHotspot = severity === "red";
        const isAmberHotspot = severity === "amber";

        if (isRedHotspot || isAmberHotspot) {
          activeHotspots += 1;
        }

        if (lensMat) {
          if (s.isBlackout) {
            lensMat.color.set("#121a16");
            lensMat.emissive.set("#000000");
            lensMat.emissiveIntensity = 0;
          } else if (isRedHotspot) {
            const pulse = 1.2 + Math.sin(t * 14 + i) * 0.6;
            lensMat.color.set("#c92a1d");
            lensMat.emissive.set("#ff2a2a");
            lensMat.emissiveIntensity = pulse;
          } else if (isAmberHotspot) {
            const pulse = 0.9 + Math.sin(t * 7 + i) * 0.35;
            lensMat.color.set("#d98218");
            lensMat.emissive.set("#ffb000");
            lensMat.emissiveIntensity = pulse;
          } else {
            lensMat.color.set("#193826");
            lensMat.emissive.set("#28b862");
            lensMat.emissiveIntensity = 0.32;
          }
        }

        if (pinGrp) {
          // Overheating channels pop their mechanical rod-indicator pin OUT (+0.023m); normal/quenched sit flush (+0.005m)
          const targetPinZ =
            isRedHotspot ? 0.023 : isAmberHotspot ? 0.016 : 0.005;
          pinGrp.position.z = THREE.MathUtils.lerp(
            pinGrp.position.z,
            targetPinZ,
            0.25,
          );
        }
      }

      // Reciprocating Boron Piston Pump & 10-Segment Ribbed Phosphor Glass Boron Pressure Bar
      if (boronPistonGroupRef.current) {
        const targetY = 0.055 - boronPistonPos * 0.11;
        boronPistonGroupRef.current.position.y = THREE.MathUtils.lerp(
          boronPistonGroupRef.current.position.y,
          targetY,
          0.3,
        );
      }
      const activeBoronSegs = Math.round((s.boronTankLevel / 100) * 10);
      for (let i = 0; i < 10; i++) {
        const mat = boronBarMatRefs.current[i];
        if (!mat) continue;
        const isLit = !s.isBlackout && i < activeBoronSegs;
        const col = i < 3 ? "#c92a1d" : i < 6 ? "#d98218" : "#28b862";
        mat.color.set(isLit ? col : "#141916");
        mat.emissive.set(isLit ? col : "#000000");
        mat.emissiveIntensity = isLit ? 1.15 : 0;
      }
    }

    // 3. UNIT B: Containment Bulkhead Synoptic Lamps, 3 Guarded Toggles, Emergency Seal & Bubbler Sight-Glass
    if (variant === "rear") {
      for (let i = 0; i < 4; i++) {
        const jMat = sealJewelMatRefs.current[i];
        if (!jMat) continue;
        const isOk =
          i < 3
            ? s.sealToggles[i]
            : s.bubblerLevel < 85 && s.sealToggles[2];
        const col = s.isBlackout
          ? "#18221d"
          : isOk
            ? "#33ff66"
            : "#ff2a2a";
        jMat.color.set(col);
        jMat.emissive.set(s.isBlackout ? "#000000" : col);
        jMat.emissiveIntensity = s.isBlackout ? 0 : isOk ? 1.4 : 1.7;
      }

      for (let i = 0; i < 3; i++) {
        const bat = sealToggleBatRefs.current[i];
        if (!bat) continue;
        const targetRotX = s.sealToggles[i] ? -0.58 : 0.58;
        bat.rotation.x = THREE.MathUtils.lerp(bat.rotation.x, targetRotX, 0.28);
      }

      if (emergSealDepressRef.current > 0) {
        emergSealDepressRef.current = Math.max(
          0,
          emergSealDepressRef.current - dt * 2.8,
        );
      }
      if (emergSealBtnRef.current) {
        emergSealBtnRef.current.position.z =
          0.028 - emergSealDepressRef.current * 0.016;
      }

      if (drainLeverGroupRef.current) {
        const prog = drainDragRef.current.active
          ? drainDragRef.current.progress
          : 0;
        const targetY = 0.095 - prog * 0.19;
        drainLeverGroupRef.current.position.y = THREE.MathUtils.lerp(
          drainLeverGroupRef.current.position.y,
          targetY,
          0.28,
        );
        if (
          s.bubblerDraining &&
          t - drainDragRef.current.lastHissTime > 0.18
        ) {
          drainDragRef.current.lastHissTime = t;
          playSteamVentHiss(0.55);
        }
      }

      const anyZoneDrought =
        s.pripyatWater < 45 || s.kolkhozWater < 45 || s.vodkaWater < 45;
      const highlightDrainTut =
        (s.tutorialStep === 3 && s.pumpThrottle[0] > 50) ||
        (!s.isBlackout && s.bubblerLevel > 30 && anyZoneDrought);
      if (drainRingMatRef.current) {
        if (highlightDrainTut) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 6.0);
          const col = pulse > 0.5 ? "#33ff66" : "#ffb000";
          drainRingMatRef.current.color.set(col);
          drainRingMatRef.current.emissive.set(col);
          drainRingMatRef.current.emissiveIntensity = 1.4 + pulse * 1.2;
        } else {
          drainRingMatRef.current.color.set("#d98218");
          drainRingMatRef.current.emissive.set("#000000");
          drainRingMatRef.current.emissiveIntensity = 0;
        }
      }

      if (sightGlassWaterMeshRef.current && sightGlassWaterMatRef.current) {
        const ratio = THREE.MathUtils.clamp(s.bubblerLevel / 100, 0.06, 1);
        sightGlassWaterMeshRef.current.scale.y = ratio;
        sightGlassWaterMeshRef.current.position.y = -0.115 + ratio * 0.115;
        if (highlightDrainTut) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 6.0);
          const wCol = pulse > 0.5 ? "#33ff66" : "#ffb000";
          sightGlassWaterMatRef.current.color.set(wCol);
          sightGlassWaterMatRef.current.emissive.set(wCol);
          sightGlassWaterMatRef.current.emissiveIntensity = 1.4 + pulse * 0.9;
        } else {
          const wCol =
            s.bubblerLevel >= 85
              ? "#ff2a2a"
              : s.bubblerLevel >= 65
                ? "#ffb000"
                : "#28d8ff";
          sightGlassWaterMatRef.current.color.set(wCol);
          sightGlassWaterMatRef.current.emissive.set(
            s.isBlackout ? "#000000" : wCol,
          );
          sightGlassWaterMatRef.current.emissiveIntensity = s.isBlackout
            ? 0
            : 1.25;
        }
      }
    }

    // 4. Update Phosphor-Green CRT Monitor Bay (Centered 3-Cell Layout + Oscilloscope Graticule) — throttled to ~12.5 FPS (0.08s)
    if (t - lastVfdDrawRef.current < 0.08) return;
    const sealAllLocked = s.containmentSealLocked;
    const boronTanksLeft = (s.boronReservePool / 100).toFixed(1);
    const sig = `${variant}|${Math.round(s.coreTemp / 2) * 2}|${Math.round(s.pressureBar)}|${Math.round(s.pumpAHeat)}|${Math.round(s.pumpBHeat)}|${Math.round(s.lubeOilPressure)}|${Math.round(s.boronTankLevel)}|${boronTanksLeft}|${s.oilCoolerValve}|${s.nitrogenLoopValve}|${Math.round(s.heliumPressure)}|${Math.round(s.graphiteTemp)}|${activeHotspots}|${sealAllLocked}|${Math.round(s.bubblerLevel)}|${s.bubblerDraining}|${s.isBlackout}`;
    const tex = vfdMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (tex && tex.userData.lastSig !== sig) {
      lastVfdDrawRef.current = t;
      tex.userData.lastSig = sig;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const cells =
          variant === "rear"
            ? [
                {
                  label: "HELIUM LOOP",
                  val: `${Math.round(s.heliumPressure)} BAR`,
                  danger: s.heliumPressure < 16 || s.heliumPressure > 68,
                },
                {
                  label: "GRAPHITE TEMP",
                  val: `${Math.round(s.graphiteTemp)} °C`,
                  danger: s.graphiteTemp >= 650,
                },
                {
                  label: "BUBBLER MAX",
                  val: `${Math.round(s.bubblerLevel)}%`,
                  danger: s.bubblerLevel >= 85,
                },
              ]
            : [
                {
                  label: "MAX BEARING",
                  val: `${Math.round(20 + Math.max(s.pumpAHeat, s.pumpBHeat))} °C`,
                  danger: Math.max(s.pumpAHeat, s.pumpBHeat) >= 70,
                },
                {
                  label: "LUBE OIL PRESS",
                  val: `${Math.round(s.lubeOilPressure)}%`,
                  danger: s.lubeOilPressure < 25,
                },
                {
                  label: "BORON TANK",
                  val: `${Math.round(s.boronTankLevel)}%`,
                  danger: s.boronTankLevel < 40,
                },
              ];

        paintSovietCRTScreen(ctx, 768, 144, {
          headerCode: variant === "rear" ? "CRT-84B" : "CRT-84A2",
          cells,
          statusLine:
            variant === "rear"
              ? s.heliumPressure > 68
                ? `GAS >68 BAR! DIAL N2 <35% & SCRUBBERS ON!`
                : `SEAL: ${sealAllLocked ? "LOCKED" : "OPEN!"} | N2: ${Math.round(s.nitrogenLoopValve)}% | DRAIN: ${s.bubblerDraining ? "PUMPING" : "SHUT"}`
              : s.lubeOilPressure < 25
                ? `OIL <25%! DIAL OIL <30% TO RECOVER! | HOT: ${activeHotspots}`
                : `OIL VALVE: ${Math.round(s.oilCoolerValve)}% | HOTSPOTS: ${activeHotspots} ACTIVE (-6% B)`,
          statusDanger:
            variant === "rear"
              ? !sealAllLocked || s.bubblerLevel >= 85 || s.heliumPressure > 68
              : activeHotspots > 0 || s.lubeOilPressure < 25,
          footerLine:
            variant === "rear"
              ? "TURN GAS WHEEL (<35% VENTS) • HOLD DRAIN LEVER"
              : `BORON RESERVES: ${boronTanksLeft} TANKS (+3.5%/STROKE)`,
          isBlackout: s.isBlackout,
        });
        tex.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main Heavy Cast-Iron Cabinet Chassis */}
      <mesh position={[0, 1.18, -0.18]} castShadow receiveShadow>
        <boxGeometry args={[1.66, 2.38, 0.42]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.45}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>
      <mesh position={[0, 1.18, -0.22]} castShadow receiveShadow>
        <boxGeometry args={[1.74, 2.46, 0.36]} />
        <meshStandardMaterial
          color="#141414"
          roughness={0.5}
          metalness={0.6}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* Beveled L-Angle Iron Trim & Hex Bolt Rows */}
      {[-0.84, 0.84].map((ex, idx) => (
        <mesh key={idx} position={[ex, 1.18, 0.032]} castShadow receiveShadow>
          <boxGeometry args={[0.042, 2.40, 0.036]} />
          <meshStandardMaterial
            color="#18211b"
            metalness={0.7}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
      ))}

      {/* Top Engraved Header Plaque (Centered cleanly inside top frame with generous margin) */}
      <mesh position={[0, 2.13, 0.044]}>
        <planeGeometry args={[1.40, 0.148]} />
        <meshStandardMaterial
          map={headerTex}
          emissive="#ffffff"
          emissiveMap={headerTex}
          emissiveIntensity={0.35}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Overhead Hooded Tungsten Work-Lamps */}
      {[-0.48, 0.48].map((lx, lIdx) => (
        <group key={lIdx} position={[lx, 2.43, 0.08]}>
          <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.014, 0.11, 8]} />
            <meshStandardMaterial color="#18211b" metalness={0.75} roughness={0.38} />
          </mesh>
          <mesh position={[0, -0.018, 0.028]} rotation={[0.45, 0, 0]} castShadow>
            <cylinderGeometry args={[0.024, 0.068, 0.065, 12]} />
            <meshStandardMaterial
              color="#23312b"
              metalness={0.68}
              roughness={0.4}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          <mesh position={[0, -0.036, 0.036]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial
              color="#ffcf75"
              emissive="#ffaa33"
              emissiveIntensity={1.6}
            />
          </mesh>
        </group>
      ))}

      {/* Top Row: 3 High-Res 512x512 ГОСТ-84 Manometer Gauges (Aligned 1:1 with VFD Columns Below) */}
      <group position={[0, 1.775, 0.03]}>
        {variant === "rear" ? (
          <>
            <HighDetailManometer3D
              position={[-0.51, 0, 0]}
              title="HELIUM BAR"
              cyrillicSub="ГЕЛИЕВЫЙ КОНТУР"
              unit="0-80 BAR"
              serial="№ 84-ГЛ1"
              min={0}
              max={80}
              lowDangerThreshold={16}
              dangerThreshold={68}
              getValue={() => useGameStore.getState().heliumPressure}
            />
            <HighDetailManometer3D
              position={[0, 0, 0]}
              title="GRAPHITE"
              cyrillicSub="КЛАДКА БЛОКА В"
              unit="0-850 °C"
              serial="№ 84-ГР4"
              min={250}
              max={850}
              dangerThreshold={650}
              getValue={() => useGameStore.getState().graphiteTemp}
            />
            <HighDetailManometer3D
              position={[0.51, 0, 0]}
              title="BUBBLER H2O"
              cyrillicSub="УРОВЕНЬ БАРБОТ."
              unit="0-100 %"
              serial="№ 84-ВК5"
              min={0}
              max={100}
              dangerThreshold={82}
              getValue={() => useGameStore.getState().bubblerLevel}
            />
          </>
        ) : (
          <>
            <HighDetailManometer3D
              position={[-0.51, 0, 0]}
              title="BEARINGS"
              cyrillicSub="ТЕМП. ПОДШИПНИКА"
              unit="0-120 °C"
              serial="№ 84-ТП1"
              min={0}
              max={120}
              dangerThreshold={95}
              getValue={() => {
                const s = useGameStore.getState();
                return Math.round(20 + Math.max(s.pumpAHeat, s.pumpBHeat));
              }}
            />
            <HighDetailManometer3D
              position={[0, 0, 0]}
              title="OIL PRESS"
              cyrillicSub="ДАВЛЕНИЕ МАСЛА"
              unit="0-100 %"
              serial="№ 84-МН2"
              min={0}
              max={100}
              lowDangerThreshold={30}
              dangerThreshold={999}
              getValue={() => useGameStore.getState().lubeOilPressure}
            />
            <HighDetailManometer3D
              position={[0.51, 0, 0]}
              title="BORON"
              cyrillicSub="БАК БОРНОЙ К-ТЫ"
              unit="0-100 %"
              serial="№ 84-БР3"
              min={0}
              max={100}
              lowDangerThreshold={35}
              dangerThreshold={999}
              getValue={() => useGameStore.getState().boronTankLevel}
            />
          </>
        )}
      </group>

      {/* Molded Phosphor-Green CRT Monitor Bay (`ЭЛТ ВЛ-84`) */}
      <SovietCRTMonitorBay3D
        position={[0, 1.46, 0.03]}
        screenMatRef={vfdMatRef}
        screenTexture={vfdTexture}
        modelBadge={variant === "rear" ? "ЭЛТ ВЛ-84В" : "ЭЛТ ВЛ-84А2"}
      />

      {/* ====================================================================
          LOWER INDUSTRIAL CONTROL DECK:
          - UNIT A-2 (`variant === "left-rear"`):
            1. Left: Full Valve Manifold + Brass Scale Arc + 5-Segment Oil Bar (`OIL COOLER VALVE`)
            2. Center: Recessed Octagonal RBMK-1000 Vessel + 37 Square Stainless-Steel Blocks with Pop-Out Rod Pins
            3. Right: Heavy Reciprocating Piston Lever Pump + 10-Segment Boron Pressure Bar (`BORON PISTON PUMP`)
          - UNIT B (`variant === "rear"`):
            1. Left: Dual-Pipe Finned Copper Gas Manifold + Brass Regulator Wheel + 10-Segment Flow Bar
            2. Center: Square Bolted Containment Bulkhead Synoptic Panel (4 Jewel Lamps + Brass Pipe Strips + 3 Guarded Toggles + Red Mushroom Lock Button)
            3. Right: Toothed Cast-Iron Quadrant Pull-Lever + Illuminated Cylindrical Glass Water Sight-Tube (`BUBBLER DRAIN`)
         ==================================================================== */}
      {variant === "left-rear" ? (
        <group position={[0, 0.78, 0.03]}>
          {/* 1. LEFT: Full Cast-Iron Valve Manifold & Brass Scale Arc (`OIL COOLER VALVE`) */}
          <group position={[-0.53, 0.02, 0.02]}>
            <mesh position={[0, 0.272, 0.012]} castShadow>
              <boxGeometry args={[0.398, 0.128, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.272, 0.018]}>
              <planeGeometry args={[0.382, 0.114]} />
              <meshStandardMaterial
                map={leftPlateTex}
                emissive="#ffffff"
                emissiveMap={leftPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
              />
            </mesh>

            {/* Brushed-Brass Framed Cast-Iron Valve Manifold Backplate */}
            <mesh position={[0, -0.02, 0.005]} castShadow receiveShadow>
              <boxGeometry args={[0.322, 0.372, 0.018]} />
              <meshStandardMaterial color="#8a929a" metalness={0.82} roughness={0.36} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} castShadow receiveShadow>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            <CagedSovietJewelLamp3D
              position={[-0.115, 0.115, 0.024]}
              lampMatRef={oilLampMatRef}
              scale={0.82}
            />
            {/* Semicircular Brushed-Brass 0-100% Scale Arc */}
            <mesh position={[-0.035, -0.02, 0.022]}>
              <torusGeometry args={[0.092, 0.0065, 8, 22, Math.PI]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>

            {/* Stepped Cast-Iron Valve Body & Stuffing Box */}
            <group
              position={[-0.035, -0.02, 0.022]}
              onPointerDown={(e) =>
                startSmoothWheelSwivelDrag(
                  e,
                  oilWheelRef.current,
                  useGameStore.getState().oilCoolerValve,
                  0,
                  100,
                  (v) => useGameStore.getState().setOilCoolerValve(v),
                )
              }
            >
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.068, 0.078, 0.034, 14]} />
                <meshStandardMaterial
                  color="#2b3036"
                  roughness={0.42}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.054, 0.056, 0.008, 16]} />
                <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0, 0.038]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.022, 0.028, 0.065, 10]} />
                <meshStandardMaterial color="#8a929a" roughness={0.35} metalness={0.85} />
              </mesh>

              {/* Chipped Dark Olive-Drab Cast-Iron 6-Spoke Handwheel */}
              <group ref={oilWheelRef} position={[0, 0, 0.07]}>
                {/* Generous Invisible Full-Disc Hit Collider so clicking or dragging never misses */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.135, 0.135, 0.11, 16]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
                <mesh castShadow>
                  <torusGeometry args={[0.074, 0.014, 10, 22]} />
                  <meshStandardMaterial
                    color="#2f3a2e"
                    roughness={0.42}
                    metalness={0.55}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.008}
                    roughnessMap={ironTex.roughnessMap}
                  />
                </mesh>
                {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ang, sIdx) => (
                  <mesh key={sIdx} rotation={[0, 0, ang]} castShadow>
                    <cylinderGeometry args={[0.0075, 0.0095, 0.142, 8]} />
                    <meshStandardMaterial
                      color="#2b3036"
                      roughness={0.4}
                      metalness={0.75}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.006}
                    />
                  </mesh>
                ))}
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.02, 0.023, 0.026, 10]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
                {/* Lathe-turned Dark Phenolic Bakelite Crank Peg with Brushed Steel Ferrule */}
                <mesh position={[0.062, 0.018, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.009, 0.011, 0.038, 8]} />
                  <meshStandardMaterial
                    color="#1c1817"
                    roughness={0.32}
                    metalness={0.15}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
              </group>
            </group>

            {/* 5-Segment Recessed Soviet Glass Cell Oil-Flow Bar in Cast-Iron Bezel Housing */}
            <group position={[0.105, -0.02, 0.022]}>
              {/* Projected Cast-Iron Bezel Housing (depth: 0.025m) */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.062, 0.252, 0.025]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.44}
                  metalness={0.68}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.007}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {/* 4 Corner Steel Hex Bolts */}
              {(
                [
                  [-0.023, 0.114],
                  [0.023, 0.114],
                  [-0.023, -0.114],
                  [0.023, -0.114],
                ] as const
              ).map(([bx, by], bIdx) => (
                <mesh
                  key={bIdx}
                  position={[bx, by, 0.014]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.0045, 0.0045, 0.005, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
              ))}
              {/* Recessed Dark Interior Cavity */}
              <mesh position={[0, 0, 0.007]}>
                <boxGeometry args={[0.044, 0.218, 0.014]} />
                <meshStandardMaterial color="#070a09" roughness={0.88} />
              </mesh>
              {Array.from({ length: 5 }).map((_, idx) => (
                <group key={idx} position={[0, -0.084 + idx * 0.042, 0.01]}>
                  <mesh>
                    <boxGeometry args={[0.038, 0.028, 0.01]} />
                    <meshStandardMaterial
                      ref={(el) => {
                        oilBarMatRefs.current[idx] = el;
                      }}
                      map={ribbedGlassTex}
                      emissiveMap={ribbedGlassTex}
                      color="#28b862"
                      emissive="#28b862"
                      emissiveIntensity={1.1}
                      roughness={0.28}
                      metalness={0.22}
                    />
                  </mesh>
                  {/* Dark Metal Horizontal Divider Louver */}
                  <mesh position={[0, 0.018, 0.004]} castShadow>
                    <boxGeometry args={[0.046, 0.005, 0.012]} />
                    <meshStandardMaterial color="#181d1f" metalness={0.78} roughness={0.42} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>

          {/* 2. CENTER: Heavy Recessed Cast-Iron Reactor Pit Flange & 37 Machined Stainless-Steel Bio-Shield Caps (`ПЯТАЧОК`) */}
          <group
            position={[0, 0.0, 0.02]}
            onPointerDown={(e) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              const s = useGameStore.getState();
              const activeKeys = Object.keys(s.channelHotspots).map(Number);
              if (activeKeys.length > 0) {
                e.stopPropagation();
                playSwitchClank(true);
                playDetentClick(3);
                s.quenchChannelHotspot(activeKeys[0]);
              }
            }}
          >
            <mesh position={[0, 0.286, 0.012]} castShadow>
              <boxGeometry args={[0.535, 0.126, 0.01]} />
              <meshStandardMaterial color="#8c7a4b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.286, 0.018]}>
              <planeGeometry args={[0.518, 0.112]} />
              <meshStandardMaterial
                map={centerPlateTex}
                emissive="#ffffff"
                emissiveMap={centerPlateTex}
                emissiveIntensity={0.35}
                roughness={0.55}
              />
            </mesh>

            {/* Heavy Recessed Octagonal Cast-Iron Reactor Pit Flange (dark gunmetal #222629) */}
            <mesh
              position={[0, -0.015, 0.008]}
              rotation={[Math.PI / 2, Math.PI / 8, 0]}
              castShadow
              receiveShadow
            >
              <cylinderGeometry args={[0.232, 0.246, 0.04, 8]} />
              <meshStandardMaterial
                color="#222629"
                roughness={0.44}
                metalness={0.72}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.009}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            {/* Heavy Raised Cast-Iron Inner Pit Rim Ring (#2b3036) */}
            <mesh
              position={[0, -0.015, 0.026]}
              rotation={[0, 0, Math.PI / 8]}
              castShadow
            >
              <torusGeometry args={[0.214, 0.013, 8, 8]} />
              <meshStandardMaterial
                color="#2b3036"
                metalness={0.76}
                roughness={0.38}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.007}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            {/* Recessed Dark Graphite Core Pit Floor behind the 37 Caps */}
            <mesh
              position={[0, -0.015, 0.021]}
              rotation={[Math.PI / 2, Math.PI / 8, 0]}
            >
              <cylinderGeometry args={[0.204, 0.204, 0.006, 8]} />
              <meshStandardMaterial color="#0b0d0e" roughness={0.9} />
            </mesh>
            {/* 8 Brushed-Steel Corner Clamps around Octagonal Pit Flange */}
            {Array.from({ length: 8 }).map((_, cIdx) => {
              const ang = (cIdx / 8) * Math.PI * 2 + Math.PI / 8;
              return (
                <mesh
                  key={cIdx}
                  position={[
                    Math.cos(ang) * 0.222,
                    -0.015 + Math.sin(ang) * 0.222,
                    0.029,
                  ]}
                  rotation={[0, 0, ang]}
                  castShadow
                >
                  <boxGeometry args={[0.028, 0.044, 0.018]} />
                  <meshStandardMaterial
                    color="#8a929a"
                    roughness={0.35}
                    metalness={0.85}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
              );
            })}
            {/* 16 Perimeter Steel Hex Bolts around the Cast-Iron Reactor Pit Flange */}
            {Array.from({ length: 16 }).map((_, bIdx) => {
              const ang = (bIdx / 16) * Math.PI * 2;
              return (
                <mesh
                  key={bIdx}
                  position={[
                    Math.cos(ang) * 0.214,
                    -0.015 + Math.sin(ang) * 0.214,
                    0.036,
                  ]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.0055, 0.0055, 0.006, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.32} />
                </mesh>
              );
            })}

            {/* 37 Machined Stainless-Steel Biological Shield Caps (`ПЯТАЧОК`) with Metallic Bevel, Dark Seam Gaps & Recessed Glass Lens */}
            <group position={[0, -0.015, 0.024]}>
              {RBMK_OCTAGON_TILES.map((tile, tIdx) => (
                <group
                  key={tile.code}
                  position={[tile.x, tile.y, 0]}
                  onPointerDown={(e) => {
                    if (useCameraLookStore.getState().isFreeLookMode) return;
                    e.stopPropagation();
                    playSwitchClank(true);
                    playDetentClick((tIdx % 5) + 2);
                    useGameStore.getState().quenchChannelHotspot(tIdx);
                  }}
                  onClick={(e) => {
                    if (useCameraLookStore.getState().isFreeLookMode) return;
                    e.stopPropagation();
                    playSwitchClank(true);
                    playDetentClick((tIdx % 5) + 2);
                    useGameStore.getState().quenchChannelHotspot(tIdx);
                  }}
                >
                  {/* Generous Invisible Hit-Box so clicking a glowing hotspot cap never misses */}
                  <mesh position={[0, 0, 0.014]}>
                    <boxGeometry args={[0.056, 0.056, 0.055]} />
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                  </mesh>
                  {/* Lower Dark Seam Bevel Base */}
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[0.041, 0.041, 0.012]} />
                    <meshStandardMaterial
                      color="#4a5258"
                      metalness={0.78}
                      roughness={0.38}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.005}
                    />
                  </mesh>
                  {/* Upper Machined Stainless-Steel Cap (`ПЯТАЧОК`) */}
                  <mesh position={[0, 0, 0.006]} castShadow receiveShadow>
                    <boxGeometry args={[0.036, 0.036, 0.008]} />
                    <meshStandardMaterial
                      color="#8e989e"
                      metalness={0.86}
                      roughness={0.28}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.003}
                      roughnessMap={ironTex.roughnessMap}
                    />
                  </mesh>
                  {/* Recessed Steel Lens Collar */}
                  <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.012, 0.013, 0.004, 12]} />
                    <meshStandardMaterial color="#181c1e" metalness={0.75} roughness={0.45} />
                  </mesh>
                  {/* Small Recessed Circular Glass Lens in Center */}
                  <mesh position={[0, 0, 0.011]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.0092, 0.0092, 0.004, 12]} />
                    <meshStandardMaterial
                      ref={(el) => {
                        channelLensMatRefs.current[tIdx] = el;
                      }}
                      color="#1a5c38"
                      emissive="#28b862"
                      emissiveIntensity={0.42}
                      roughness={0.22}
                      metalness={0.2}
                    />
                  </mesh>
                  {/* Physical Pop-Out Stainless-Steel Control Rod Indicator Pin */}
                  <group
                    ref={(el) => {
                      channelPinGroupRefs.current[tIdx] = el;
                    }}
                    position={[0, 0, 0.006]}
                  >
                    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                      <cylinderGeometry args={[0.0038, 0.0045, 0.018, 8]} />
                      <meshStandardMaterial
                        color="#c8d0d6"
                        metalness={0.9}
                        roughness={0.22}
                      />
                    </mesh>
                    <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[0.005, 0.005, 0.0035, 8]} />
                      <meshStandardMaterial
                        color="#8a929a"
                        metalness={0.88}
                        roughness={0.26}
                      />
                    </mesh>
                  </group>
                </group>
              ))}
            </group>
          </group>

          {/* 3. RIGHT: Heavy Bolted Quadrant Housing & Reciprocating Piston Lever Pump (`BORON PISTON PUMP`) */}
          <group position={[0.53, 0.02, 0.02]}>
            <mesh position={[0, 0.272, 0.012]} castShadow>
              <boxGeometry args={[0.398, 0.128, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.272, 0.018]}>
              <planeGeometry args={[0.382, 0.114]} />
              <meshStandardMaterial
                map={rightPlateTex}
                emissive="#ffffff"
                emissiveMap={rightPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
              />
            </mesh>

            {/* Weathered Steel-Framed Cast-Iron Pump Backplate */}
            <mesh position={[0, -0.02, 0.005]} castShadow receiveShadow>
              <boxGeometry args={[0.322, 0.372, 0.018]} />
              <meshStandardMaterial color="#8a929a" metalness={0.82} roughness={0.36} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} castShadow receiveShadow>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>

            {/* Raised Bolted Cast-Iron Quadrant Box (0.03m deep) with Beveled Rails, 6 Bolts & Engraved Scale Plate */}
            <group
              position={[-0.042, -0.02, 0.032]}
              onPointerDown={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                pistonDragRef.current = {
                  active: true,
                  startY: e.nativeEvent.clientY,
                  startPos: boronPistonPos,
                  lastHalfStroke: Math.round(boronPistonPos),
                };
                const handleMove = (ev: PointerEvent) => {
                  if (!pistonDragRef.current.active) return;
                  const dy = ev.clientY - pistonDragRef.current.startY;
                  const nextPos = THREE.MathUtils.clamp(
                    pistonDragRef.current.startPos + dy / 75,
                    0,
                    1,
                  );
                  setBoronPistonPos(nextPos);
                  const halfStroke =
                    nextPos >= 0.72
                      ? 1
                      : nextPos <= 0.28
                        ? 0
                        : pistonDragRef.current.lastHalfStroke;
                  if (halfStroke !== pistonDragRef.current.lastHalfStroke) {
                    pistonDragRef.current.lastHalfStroke = halfStroke;
                    playSwitchClank(halfStroke === 1);
                    if (halfStroke === 1) {
                      playBoronHydraulicPumpStroke();
                      useGameStore.getState().pumpBoronTank(3.5);
                    }
                  }
                };
                const handleUp = () => {
                  pistonDragRef.current.active = false;
                  setBoronPistonPos(0);
                  window.removeEventListener("pointermove", handleMove);
                  window.removeEventListener("pointerup", handleUp);
                  window.removeEventListener("pointercancel", handleUp);
                };
                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", handleUp);
                window.addEventListener("pointercancel", handleUp);
              }}
            >
              {/* Raised 0.032m Deep Cast-Iron Quadrant Box */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.124, 0.288, 0.032]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.42}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {/* Beveled Steel Side Rails */}
              {[-0.044, 0.044].map((rx, rIdx) => (
                <mesh key={rIdx} position={[rx, 0, 0.015]} castShadow>
                  <boxGeometry args={[0.022, 0.272, 0.012]} />
                  <meshStandardMaterial
                    color="#2b3036"
                    metalness={0.78}
                    roughness={0.36}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
              ))}
              {/* Engraved Brass 0-100% Scale Plate alongside Slot */}
              <mesh position={[-0.044, 0, 0.022]}>
                <planeGeometry args={[0.02, 0.24]} />
                <meshStandardMaterial map={leverScalePlateTex} metalness={0.75} roughness={0.35} />
              </mesh>
              {/* 6 Perimeter Steel Hex Bolts */}
              {(
                [
                  [-0.052, 0.126],
                  [0.052, 0.126],
                  [-0.052, 0],
                  [0.052, 0],
                  [-0.052, -0.126],
                  [0.052, -0.126],
                ] as const
              ).map(([bx, by], bIdx) => (
                <mesh
                  key={bIdx}
                  position={[bx, by, 0.018]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.005, 0.005, 0.006, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
              ))}
              {/* Dark Recessed Channel with Pleated Black Rubber Dust-Bellows */}
              <mesh position={[0, 0, 0.012]}>
                <boxGeometry args={[0.036, 0.242, 0.012]} />
                <meshStandardMaterial color="#090b0a" roughness={0.92} />
              </mesh>
              {Array.from({ length: 12 }).map((_, bIdx) => (
                <mesh
                  key={bIdx}
                  position={[0, -0.105 + bIdx * 0.019, 0.015]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.004, 0.004, 0.032, 8]} />
                  <meshStandardMaterial color="#141716" roughness={0.88} />
                </mesh>
              ))}
              {/* Extruded Steel Ratchet Teeth visibly protruding from Side Rail */}
              {Array.from({ length: 8 }).map((_, tIdx) => {
                const ty = -0.102 + tIdx * 0.029;
                return (
                  <group key={tIdx} position={[0, ty, 0.019]}>
                    <mesh position={[-0.022, 0, 0]} castShadow>
                      <boxGeometry args={[0.014, 0.009, 0.01]} />
                      <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
                    </mesh>
                    <mesh position={[0.022, 0, 0]} castShadow>
                      <boxGeometry args={[0.014, 0.009, 0.01]} />
                      <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
                    </mesh>
                  </group>
                );
              })}

              {/* Central Bolted Pivot Knuckle, Twin Thick Chrome-Steel Lever Arms & Dark Oxblood Phenolic Bakelite T-Handle */}
              <group ref={boronPistonGroupRef} position={[0, 0.055, 0.018]}>
                {/* Central Bolted Pivot Knuckle */}
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.018, 0.018, 0.048, 12]} />
                  <meshStandardMaterial color="#2b3036" metalness={0.82} roughness={0.32} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.009, 0.009, 0.056, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.28} />
                </mesh>
                {/* Twin Thick Chrome-Steel Lever Arms */}
                {[-0.02, 0.02].map((cx, cIdx) => (
                  <mesh
                    key={cIdx}
                    position={[cx, 0, 0.044]}
                    rotation={[Math.PI / 2, 0, 0]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.0085, 0.0095, 0.088, 10]} />
                    <meshStandardMaterial
                      color="#d8dfe6"
                      metalness={0.9}
                      roughness={0.2}
                    />
                  </mesh>
                ))}
                {/* Lathe-Turned Dark Oxblood Phenolic Bakelite T-Handle (#4a1210) */}
                <mesh
                  position={[0, 0, 0.088]}
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow
                >
                  <cylinderGeometry args={[0.022, 0.022, 0.16, 14]} />
                  <meshStandardMaterial
                    color="#4a1210"
                    roughness={0.32}
                    metalness={0.15}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
                {/* Machined Brushed-Steel End-Ferrules (#8a929a) */}
                {[-0.074, 0.074].map((bx, bIdx) => (
                  <mesh
                    key={bIdx}
                    position={[bx, 0, 0.088]}
                    rotation={[0, 0, Math.PI / 2]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.0235, 0.0235, 0.018, 14]} />
                    <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                  </mesh>
                ))}
                {/* Single Thin Recessed Enamel Indicator Ring */}
                <mesh
                  position={[0, 0, 0.088]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.0228, 0.0228, 0.009, 14]} />
                  <meshStandardMaterial
                    color="#c92a1d"
                    roughness={0.36}
                    metalness={0.2}
                  />
                </mesh>
              </group>
            </group>

            {/* 10-Segment Recessed Soviet Glass Cell BORON TANK Bar in Cast-Iron Bezel Housing */}
            <group position={[0.095, -0.02, 0.022]}>
              {/* Projected Cast-Iron Bezel Housing (depth: 0.025m) */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.068, 0.288, 0.025]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.44}
                  metalness={0.68}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.007}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {/* 4 Corner Steel Hex Bolts */}
              {(
                [
                  [-0.025, 0.132],
                  [0.025, 0.132],
                  [-0.025, -0.132],
                  [0.025, -0.132],
                ] as const
              ).map(([bx, by], bIdx) => (
                <mesh
                  key={bIdx}
                  position={[bx, by, 0.014]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.0045, 0.0045, 0.005, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
              ))}
              {/* Recessed Dark Interior Cavity */}
              <mesh position={[0, 0, 0.007]}>
                <boxGeometry args={[0.048, 0.256, 0.014]} />
                <meshStandardMaterial color="#070a09" roughness={0.88} />
              </mesh>
              {Array.from({ length: 10 }).map((_, idx) => (
                <group key={idx} position={[0, -0.112 + idx * 0.025, 0.01]}>
                  <mesh>
                    <boxGeometry args={[0.042, 0.018, 0.01]} />
                    <meshStandardMaterial
                      ref={(el) => {
                        boronBarMatRefs.current[idx] = el;
                      }}
                      map={ribbedGlassTex}
                      emissiveMap={ribbedGlassTex}
                      color="#28b862"
                      emissive="#28b862"
                      emissiveIntensity={1.15}
                      roughness={0.28}
                      metalness={0.22}
                    />
                  </mesh>
                  {/* Dark Metal Horizontal Divider Louver */}
                  <mesh position={[0, 0.0115, 0.004]} castShadow>
                    <boxGeometry args={[0.048, 0.004, 0.012]} />
                    <meshStandardMaterial color="#181d1f" metalness={0.78} roughness={0.42} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        </group>
      ) : (
        <group position={[0, 0.78, 0.03]}>
          {/* ================================================================
              UNIT B (`variant === "rear"`) — GRITTY SOVIET INDUSTRIAL REALISM
              1. Left: Dual-Pipe Finned Copper Gas Manifold & Oxidized Crimson Cast-Iron Wheel + Recessed Glass Cell Bar
              2. Center: Bolted Containment Bulkhead Synoptic Panel (4 Caged Jewel Lamps + 3 Chunky Guarded Toggles + Crimson Bakelite Mushroom Button)
              3. Right: Bolted Quadrant Pull-Lever + Armored Sight-Glass with Brass Manifolds & Tick-Mark Graduation Rings
             ================================================================ */}

          {/* 1. LEFT: Dual-Pipe Finned Copper Gas Manifold & Oxidized Crimson Handwheel (`HELIUM-N2 LOOP`) */}
          <group position={[-0.53, 0.02, 0.02]}>
            <mesh position={[0, 0.272, 0.012]} castShadow>
              <boxGeometry args={[0.398, 0.128, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.272, 0.018]}>
              <planeGeometry args={[0.382, 0.114]} />
              <meshStandardMaterial
                map={leftPlateTex}
                emissive="#ffffff"
                emissiveMap={leftPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
              />
            </mesh>

            {/* Weathered Steel-Framed Manifold Baseplate */}
            <mesh position={[0, -0.02, 0.005]} castShadow receiveShadow>
              <boxGeometry args={[0.322, 0.372, 0.018]} />
              <meshStandardMaterial color="#8a929a" metalness={0.82} roughness={0.36} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} castShadow receiveShadow>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>

            {/* Two Weathered Finned Copper/Brass Gas Pipes */}
            {[-0.088, 0.018].map((px, pIdx) => (
              <group key={pIdx} position={[px, -0.02, 0.026]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.016, 0.016, 0.32, 12]} />
                  <meshStandardMaterial
                    color={pIdx === 0 ? "#b86b3a" : "#a89254"}
                    metalness={0.86}
                    roughness={0.3}
                    bumpMap={brassTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
                {[-0.11, -0.055, 0.055, 0.11].map((fy, fIdx) => (
                  <mesh key={fIdx} position={[0, fy, 0]} castShadow>
                    <cylinderGeometry args={[0.026, 0.026, 0.012, 12]} />
                    <meshStandardMaterial
                      color="#9c884e"
                      metalness={0.85}
                      roughness={0.3}
                    />
                  </mesh>
                ))}
              </group>
            ))}

            <CagedSovietJewelLamp3D
              position={[-0.118, 0.115, 0.026]}
              lampMatRef={gasLampMatRef}
              scale={0.8}
            />

            {/* Central Cast-Iron Regulator Body & Semicircular Brass BAR Scale */}
            <group
              position={[-0.035, -0.02, 0.032]}
              onPointerDown={(e) =>
                startSmoothWheelSwivelDrag(
                  e,
                  gasWheelRef.current,
                  useGameStore.getState().nitrogenLoopValve,
                  0,
                  100,
                  (v) => useGameStore.getState().setNitrogenLoopValve(v),
                )
              }
            >
              <mesh position={[0, 0, 0.008]}>
                <torusGeometry args={[0.088, 0.0065, 8, 22, Math.PI]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.064, 0.072, 0.042, 14]} />
                <meshStandardMaterial
                  color="#2b3036"
                  roughness={0.42}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              <group ref={gasWheelRef} position={[0, 0, 0.058]}>
                {/* Generous Invisible Full-Disc Hit Collider so clicking or dragging never misses */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.135, 0.135, 0.11, 16]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
                {/* Chipped Deep Oxidized Crimson Enamel Cast-Iron Handwheel (#6e1a14) */}
                <mesh castShadow>
                  <torusGeometry args={[0.072, 0.014, 10, 22]} />
                  <meshStandardMaterial
                    color="#6e1a14"
                    metalness={0.52}
                    roughness={0.42}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.008}
                    roughnessMap={ironTex.roughnessMap}
                  />
                </mesh>
                {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ang, sIdx) => (
                  <mesh key={sIdx} rotation={[0, 0, ang]} castShadow>
                    <cylinderGeometry args={[0.0075, 0.0095, 0.138, 8]} />
                    <meshStandardMaterial
                      color="#2b3036"
                      roughness={0.4}
                      metalness={0.75}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.006}
                    />
                  </mesh>
                ))}
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.02, 0.022, 0.026, 10]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
                {/* Dark Phenolic Bakelite Crank Peg (#1c1817) */}
                <mesh position={[0.06, 0.018, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.009, 0.011, 0.038, 8]} />
                  <meshStandardMaterial
                    color="#1c1817"
                    roughness={0.32}
                    metalness={0.15}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
              </group>
            </group>

            {/* 10-Segment Recessed Soviet Glass Cell Gas Flow Bar in Cast-Iron Bezel Housing */}
            <group position={[0.102, -0.02, 0.022]}>
              {/* Projected Cast-Iron Bezel Housing (depth: 0.025m) */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.062, 0.288, 0.025]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.44}
                  metalness={0.68}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.007}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {/* 4 Corner Steel Hex Bolts */}
              {(
                [
                  [-0.023, 0.132],
                  [0.023, 0.132],
                  [-0.023, -0.132],
                  [0.023, -0.132],
                ] as const
              ).map(([bx, by], bIdx) => (
                <mesh
                  key={bIdx}
                  position={[bx, by, 0.014]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.0045, 0.0045, 0.005, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
              ))}
              {/* Recessed Dark Interior Cavity */}
              <mesh position={[0, 0, 0.007]}>
                <boxGeometry args={[0.044, 0.256, 0.014]} />
                <meshStandardMaterial color="#070a09" roughness={0.88} />
              </mesh>
              {Array.from({ length: 10 }).map((_, idx) => (
                <group key={idx} position={[0, -0.112 + idx * 0.025, 0.01]}>
                  <mesh>
                    <boxGeometry args={[0.038, 0.018, 0.01]} />
                    <meshStandardMaterial
                      ref={(el) => {
                        gasBarMatRefs.current[idx] = el;
                      }}
                      map={ribbedGlassTex}
                      emissiveMap={ribbedGlassTex}
                      color="#28b862"
                      emissive="#28b862"
                      emissiveIntensity={1.15}
                      roughness={0.28}
                      metalness={0.22}
                    />
                  </mesh>
                  {/* Dark Metal Horizontal Divider Louver */}
                  <mesh position={[0, 0.0115, 0.004]} castShadow>
                    <boxGeometry args={[0.046, 0.004, 0.012]} />
                    <meshStandardMaterial color="#181d1f" metalness={0.78} roughness={0.42} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>

          {/* 2. CENTER: Square Bolted Containment Bulkhead Synoptic Panel (4 Caged Jewel Lamps + 3 Chunky Guarded Toggles + Oxidized Crimson Mushroom Button) */}
          <group position={[0, 0.0, 0.02]}>
            <mesh position={[0, 0.286, 0.012]} castShadow>
              <boxGeometry args={[0.535, 0.126, 0.01]} />
              <meshStandardMaterial color="#8c7a4b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.286, 0.018]}>
              <planeGeometry args={[0.518, 0.112]} />
              <meshStandardMaterial
                map={centerPlateTex}
                emissive="#ffffff"
                emissiveMap={centerPlateTex}
                emissiveIntensity={0.35}
                roughness={0.55}
              />
            </mesh>

            {/* Square Bolted Steel Containment Housing */}
            <mesh position={[0, -0.02, 0.005]} castShadow receiveShadow>
              <boxGeometry args={[0.46, 0.38, 0.018]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.72}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>
            <mesh position={[0, -0.02, 0.022]}>
              <planeGeometry args={[0.43, 0.34]} />
              <meshStandardMaterial
                map={containmentSynopticTex}
                emissive="#ffffff"
                emissiveMap={containmentSynopticTex}
                emissiveIntensity={0.42}
                roughness={0.65}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>

            {/* Physical 3D Brushed-Steel Pipe-Routing Bus Strips connecting the 4 Containment Jewel Lamps */}
            <mesh position={[0, 0.055, 0.028]} castShadow>
              <boxGeometry args={[0.34, 0.01, 0.008]} />
              <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
            </mesh>

            {/* Upper Bank: 4 Raised Cast-Iron Bulkhead Bosses + Heavy Caged Soviet Jewel Lamps (`AIRLOCK A`, `AIRLOCK B`, `GRAPHITE N2`, `BUBBLER SEAL`) */}
            {[-0.16, -0.053, 0.053, 0.16].map((lx, lIdx) => (
              <group key={lIdx} position={[lx, 0.055, 0.026]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.036, 0.04, 0.01, 16]} />
                  <meshStandardMaterial
                    color="#2b3036"
                    metalness={0.78}
                    roughness={0.38}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
                <CagedSovietJewelLamp3D
                  position={[0, 0, 0.007]}
                  lampMatRef={(el) => {
                    sealJewelMatRefs.current[lIdx] = el;
                  }}
                  scale={1.02}
                />
              </group>
            ))}

            {/* Lower Bank Left: 3 Heavy 2.5x Chunkier Guarded Metal Toggle Switches (`N2 PURGE`, `RAD FILTER`, `SEAL LOCK`) */}
            {[-0.16, -0.053, 0.053].map((tx, tIdx) => (
              <group
                key={tIdx}
                position={[tx, -0.095, 0.028]}
                onClick={(e) => {
                  if (useCameraLookStore.getState().isFreeLookMode) return;
                  e.stopPropagation();
                  playSwitchClank(true);
                  useGameStore.getState().toggleSealSwitch(tIdx as 0 | 1 | 2);
                }}
              >
                {/* Raised Steel Switch Mounting Base Plate */}
                <mesh position={[0, 0, 0.004]} castShadow receiveShadow>
                  <boxGeometry args={[0.072, 0.092, 0.008]} />
                  <meshStandardMaterial
                    color="#2b3036"
                    metalness={0.78}
                    roughness={0.38}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
                {/* Prominent U-Shaped Brushed-Steel Side Guards that Cast Shadows */}
                {[-0.03, 0.03].map((gx, gIdx) => (
                  <group key={gIdx} position={[gx, 0, 0.026]}>
                    <mesh castShadow receiveShadow>
                      <boxGeometry args={[0.008, 0.082, 0.046]} />
                      <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
                    </mesh>
                    {/* Top & Bottom U-Loop Guard Bridge Bars */}
                    {[-0.036, 0.036].map((gy, bIdx) => (
                      <mesh key={bIdx} position={[0, gy, 0.02]} castShadow>
                        <boxGeometry args={[0.01, 0.01, 0.014]} />
                        <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.28} />
                      </mesh>
                    ))}
                  </group>
                ))}
                {/* Heavy Hex Mounting Bushing & Lock Washer */}
                <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.026, 0.028, 0.012, 12]} />
                  <meshStandardMaterial color="#2b3036" metalness={0.82} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0, 0.018]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.022, 0.024, 0.018, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.28} />
                </mesh>
                {/* Animated Heavy Chrome Toggle Bat (2.5x chunkier with spherical ball tip) */}
                <group
                  ref={(el) => {
                    sealToggleBatRefs.current[tIdx] = el;
                  }}
                  position={[0, 0, 0.022]}
                >
                  <mesh position={[0, 0, 0.034]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.011, 0.0065, 0.072, 12]} />
                    <meshStandardMaterial color="#d8e2dc" metalness={0.92} roughness={0.18} />
                  </mesh>
                  <mesh position={[0, 0, 0.07]} castShadow>
                    <sphereGeometry args={[0.0125, 12, 12]} />
                    <meshStandardMaterial color="#e4ece8" metalness={0.94} roughness={0.15} />
                  </mesh>
                </group>
              </group>
            ))}

            {/* Lower Bank Right: Deep Oxidized Crimson Bakelite Mushroom `EMERGENCY SEAL` Lock Button */}
            <group
              position={[0.16, -0.095, 0.028]}
              onPointerDown={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                emergSealDepressRef.current = 1.0;
                playSwitchClank(true);
                playPneumaticWhoosh();
                useGameStore.getState().lockAllContainmentSeals();
              }}
            >
              {/* Heavy Cast-Iron & Steel Guard Collar */}
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.036, 0.04, 0.022, 14]} />
                <meshStandardMaterial
                  color="#2b3036"
                  roughness={0.38}
                  metalness={0.78}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.03, 0.032, 0.006, 14]} />
                <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
              </mesh>
              <group ref={emergSealBtnRef} position={[0, 0, 0.028]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.027, 0.022, 0.024, 14]} />
                  <meshStandardMaterial
                    color="#6e1a14"
                    emissive="#8a1c14"
                    emissiveIntensity={0.28}
                    roughness={0.32}
                    metalness={0.18}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
              </group>
            </group>
          </group>

          {/* 3. RIGHT: Heavy Bolted Quadrant Pull-Lever & Armored Sight-Glass (`BUBBLER DRAIN`) */}
          <group position={[0.53, 0.02, 0.02]}>
            <mesh position={[0, 0.272, 0.012]} castShadow>
              <boxGeometry args={[0.398, 0.128, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.272, 0.018]}>
              <planeGeometry args={[0.382, 0.114]} />
              <meshStandardMaterial
                map={rightPlateTex}
                emissive="#ffffff"
                emissiveMap={rightPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
              />
            </mesh>

            {/* Weathered Steel-Framed Cast-Iron Assembly Backplate */}
            <mesh position={[0, -0.02, 0.005]} castShadow receiveShadow>
              <boxGeometry args={[0.322, 0.372, 0.018]} />
              <meshStandardMaterial color="#8a929a" metalness={0.82} roughness={0.36} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} castShadow receiveShadow>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2220"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
                roughnessMap={ironTex.roughnessMap}
              />
            </mesh>

            {/* Left Half: Raised Bolted Cast-Iron Quadrant Pull-Lever (`СБРОС БАРБОТЕРА`) */}
            <group
              position={[-0.06, -0.02, 0.028]}
              onPointerDown={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                drainDragRef.current = {
                  active: true,
                  startY: e.nativeEvent.clientY,
                  progress: 0.4,
                  lastHissTime: 0,
                };
                useGameStore.getState().setBubblerDraining(true);
                playSwitchClank(true);
                playSteamVentHiss(0.6);
                const handleMove = (ev: PointerEvent) => {
                  if (!drainDragRef.current.active) return;
                  const dy = ev.clientY - drainDragRef.current.startY;
                  const prog = THREE.MathUtils.clamp(0.4 + dy / 65, 0.15, 1.0);
                  drainDragRef.current.progress = prog;
                  useGameStore.getState().setBubblerDraining(prog >= 0.2);
                };
                const handleUp = () => {
                  drainDragRef.current.active = false;
                  drainDragRef.current.progress = 0;
                  useGameStore.getState().setBubblerDraining(false);
                  playSwitchClank(false);
                  window.removeEventListener("pointermove", handleMove);
                  window.removeEventListener("pointerup", handleUp);
                  window.removeEventListener("pointercancel", handleUp);
                };
                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", handleUp);
                window.addEventListener("pointercancel", handleUp);
              }}
            >
              {/* Raised 0.032m Deep Cast-Iron Quadrant Box */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.118, 0.292, 0.032]} />
                <meshStandardMaterial
                  color="#1c2220"
                  roughness={0.42}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                  roughnessMap={ironTex.roughnessMap}
                />
              </mesh>
              {/* Beveled Steel Side Rails */}
              {[-0.042, 0.042].map((rx, rIdx) => (
                <mesh key={rIdx} position={[rx, 0, 0.015]} castShadow>
                  <boxGeometry args={[0.02, 0.276, 0.012]} />
                  <meshStandardMaterial
                    color="#2b3036"
                    metalness={0.78}
                    roughness={0.36}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
              ))}
              {/* Engraved Brass Scale Plate alongside Slot */}
              <mesh position={[-0.042, 0, 0.022]}>
                <planeGeometry args={[0.019, 0.24]} />
                <meshStandardMaterial map={leverScalePlateTex} metalness={0.75} roughness={0.35} />
              </mesh>
              {/* 6 Perimeter Steel Hex Bolts */}
              {(
                [
                  [-0.049, 0.128],
                  [0.049, 0.128],
                  [-0.049, 0],
                  [0.049, 0],
                  [-0.049, -0.128],
                  [0.049, -0.128],
                ] as const
              ).map(([bx, by], bIdx) => (
                <mesh
                  key={bIdx}
                  position={[bx, by, 0.018]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.0048, 0.0048, 0.006, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                </mesh>
              ))}
              {/* Dark Recessed Channel with Pleated Black Rubber Dust-Bellows */}
              <mesh position={[0, 0, 0.012]}>
                <boxGeometry args={[0.032, 0.242, 0.012]} />
                <meshStandardMaterial color="#090b0a" roughness={0.92} />
              </mesh>
              {Array.from({ length: 12 }).map((_, bIdx) => (
                <mesh
                  key={bIdx}
                  position={[0, -0.105 + bIdx * 0.019, 0.015]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.004, 0.004, 0.028, 8]} />
                  <meshStandardMaterial color="#141716" roughness={0.88} />
                </mesh>
              ))}
              {/* 8 Extruded Steel Ratchet Teeth along Quadrant Slot */}
              {Array.from({ length: 8 }).map((_, tIdx) => {
                const ty = -0.105 + tIdx * 0.03;
                return (
                  <group key={tIdx} position={[0, ty, 0.019]}>
                    <mesh position={[-0.022, 0, 0]} castShadow>
                      <boxGeometry args={[0.013, 0.009, 0.01]} />
                      <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
                    </mesh>
                    <mesh position={[0.022, 0, 0]} castShadow>
                      <boxGeometry args={[0.013, 0.009, 0.01]} />
                      <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.32} />
                    </mesh>
                  </group>
                );
              })}

              {/* Central Bolted Pivot Knuckle, Twin Thick Chrome-Steel Lever Arms & Dark Phenolic Bakelite T-Handle */}
              <group ref={drainLeverGroupRef} position={[0, 0.095, 0.018]}>
                {/* Central Bolted Pivot Knuckle */}
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.017, 0.017, 0.044, 12]} />
                  <meshStandardMaterial color="#2b3036" metalness={0.82} roughness={0.32} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.0085, 0.0085, 0.052, 6]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.28} />
                </mesh>
                {/* Twin Thick Chrome-Steel Lever Arms */}
                {[-0.019, 0.019].map((lx, lIdx) => (
                  <mesh
                    key={lIdx}
                    position={[lx, 0, 0.038]}
                    rotation={[Math.PI / 2, 0, 0]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.008, 0.009, 0.076, 10]} />
                    <meshStandardMaterial color="#d8dfe6" metalness={0.9} roughness={0.2} />
                  </mesh>
                ))}
                {/* Lathe-Turned Dark Phenolic Bakelite T-Handle (#1c1817) */}
                <mesh
                  position={[0, 0, 0.076]}
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow
                >
                  <cylinderGeometry args={[0.022, 0.022, 0.144, 14]} />
                  <meshStandardMaterial
                    color="#1c1817"
                    roughness={0.32}
                    metalness={0.15}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
                {/* Machined Brushed-Steel End-Ferrules (#8a929a) */}
                {[-0.066, 0.066].map((bx, bIdx) => (
                  <mesh
                    key={bIdx}
                    position={[bx, 0, 0.076]}
                    rotation={[0, 0, Math.PI / 2]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.0235, 0.0235, 0.016, 14]} />
                    <meshStandardMaterial color="#8a929a" metalness={0.85} roughness={0.35} />
                  </mesh>
                ))}
                {/* Single Thin Recessed Enamel Indicator Ring */}
                <mesh position={[0, 0, 0.076]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.0228, 0.0228, 0.008, 14]} />
                  <meshStandardMaterial
                    ref={drainRingMatRef}
                    color="#d98218"
                    roughness={0.36}
                    metalness={0.2}
                  />
                </mesh>
              </group>
            </group>

            {/* Right Half: Armored Bubbler Sight-Glass with Bolted Brass Manifold Caps & Graduation Tick Rings (`УРОВЕНЬ ВОДЫ`) */}
            <group position={[0.078, -0.02, 0.03]}>
              {/* Heavy Top & Bottom Bolted Brass Manifold Caps */}
              {[-0.132, 0.132].map((vy, vIdx) => (
                <group key={vIdx} position={[0, vy, 0]}>
                  <mesh castShadow receiveShadow>
                    <cylinderGeometry args={[0.036, 0.038, 0.028, 12]} />
                    <meshStandardMaterial
                      color="#b8a46b"
                      metalness={0.86}
                      roughness={0.28}
                      bumpMap={brassTex.bumpMap}
                      bumpScale={0.005}
                    />
                  </mesh>
                  {/* 4 Manifold Flange Hex Bolts */}
                  {(
                    [
                      [-0.024, 0.018],
                      [0.024, 0.018],
                      [-0.024, -0.018],
                      [0.024, -0.018],
                    ] as const
                  ).map(([bx, bz], bIdx) => (
                    <mesh key={bIdx} position={[bx, 0, bz]} castShadow>
                      <cylinderGeometry args={[0.004, 0.004, 0.032, 6]} />
                      <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.3} />
                    </mesh>
                  ))}
                </group>
              ))}

              {/* Protective Vertical Slotted Steel Armor Shroud framing the Sight-Glass */}
              <mesh position={[0, 0, -0.018]} castShadow receiveShadow>
                <boxGeometry args={[0.056, 0.244, 0.008]} />
                <meshStandardMaterial
                  color="#2b3036"
                  metalness={0.78}
                  roughness={0.38}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              {[-0.025, 0.025].map((sx, sIdx) => (
                <mesh key={sIdx} position={[sx, 0, 0.002]} castShadow receiveShadow>
                  <boxGeometry args={[0.008, 0.244, 0.036]} />
                  <meshStandardMaterial
                    color="#2b3036"
                    metalness={0.8}
                    roughness={0.36}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
              ))}

              {/* Engraved 20% / 40% / 60% / 80% Graduation Scale Strip beside the Shroud */}
              <mesh position={[0.042, 0, 0.006]}>
                <planeGeometry args={[0.024, 0.23]} />
                <meshStandardMaterial map={sightGlassScaleTex} metalness={0.72} roughness={0.38} />
              </mesh>

              {/* 4 Horizontal Brass Tick-Mark Graduation Rings (20% / 40% / 60% / 80%) */}
              {[-0.072, -0.024, 0.024, 0.072].map((ry, rIdx) => (
                <mesh
                  key={rIdx}
                  position={[0, ry, 0.004]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <torusGeometry args={[0.0225, 0.0024, 8, 18]} />
                  <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.26} />
                </mesh>
              ))}

              {/* Outer Transparent Cylindrical Sight-Glass Tube */}
              <mesh>
                <cylinderGeometry args={[0.021, 0.021, 0.24, 16]} />
                <meshStandardMaterial
                  color="#d8f4ff"
                  transparent
                  opacity={0.32}
                  roughness={0.14}
                  metalness={0.22}
                />
              </mesh>
              {/* Inner Glowing Water Column that visibly drains downward when holding the lever */}
              <mesh ref={sightGlassWaterMeshRef} position={[0, -0.05, 0]}>
                <cylinderGeometry args={[0.016, 0.016, 0.23, 14]} />
                <meshStandardMaterial
                  ref={sightGlassWaterMatRef}
                  color="#28b862"
                  emissive="#28b862"
                  emissiveIntensity={1.15}
                  roughness={0.25}
                />
              </mesh>
            </group>
          </group>
        </group>
      )}
    </group>
  );
});

interface Dvk84KeySpec {
  id: string;
  cyr: string;
  lat: string;
  widthUnits: number;
  tone: "ivory" | "charcoal" | "oxblood";
}

const DVK84_KEY_ROWS: ReadonlyArray<{
  rowIdx: number;
  zOffset: number;
  baseY: number;
  keys: ReadonlyArray<Dvk84KeySpec>;
}> = [
  {
    rowIdx: 0,
    zOffset: 0.028,
    baseY: 0.046,
    keys: [
      { id: "r0-0", cyr: "ФИКС", lat: "LOCK", widthUnits: 1.35, tone: "oxblood" },
      { id: "r0-1", cyr: "1", lat: "!", widthUnits: 1, tone: "ivory" },
      { id: "r0-2", cyr: "2", lat: '"', widthUnits: 1, tone: "ivory" },
      { id: "r0-3", cyr: "3", lat: "№", widthUnits: 1, tone: "ivory" },
      { id: "r0-4", cyr: "4", lat: ";", widthUnits: 1, tone: "ivory" },
      { id: "r0-5", cyr: "5", lat: "%", widthUnits: 1, tone: "ivory" },
      { id: "r0-6", cyr: "6", lat: ":", widthUnits: 1, tone: "ivory" },
      { id: "r0-7", cyr: "7", lat: "?", widthUnits: 1, tone: "ivory" },
      { id: "r0-8", cyr: "8", lat: "*", widthUnits: 1, tone: "ivory" },
      { id: "r0-9", cyr: "9", lat: "(", widthUnits: 1, tone: "ivory" },
      { id: "r0-10", cyr: "0", lat: ")", widthUnits: 1, tone: "ivory" },
      { id: "r0-11", cyr: "-", lat: "_", widthUnits: 1, tone: "ivory" },
      { id: "r0-12", cyr: "=", lat: "+", widthUnits: 1, tone: "ivory" },
      { id: "r0-13", cyr: "СБРОС", lat: "CLR", widthUnits: 1.55, tone: "oxblood" },
    ],
  },
  {
    rowIdx: 1,
    zOffset: 0.064,
    baseY: 0.0435,
    keys: [
      { id: "r1-0", cyr: "ТАБ", lat: "TAB", widthUnits: 1.45, tone: "charcoal" },
      { id: "r1-1", cyr: "Й", lat: "Q", widthUnits: 1, tone: "ivory" },
      { id: "r1-2", cyr: "Ц", lat: "W", widthUnits: 1, tone: "ivory" },
      { id: "r1-3", cyr: "У", lat: "E", widthUnits: 1, tone: "ivory" },
      { id: "r1-4", cyr: "К", lat: "R", widthUnits: 1, tone: "ivory" },
      { id: "r1-5", cyr: "Е", lat: "T", widthUnits: 1, tone: "ivory" },
      { id: "r1-6", cyr: "Н", lat: "Y", widthUnits: 1, tone: "ivory" },
      { id: "r1-7", cyr: "Г", lat: "U", widthUnits: 1, tone: "ivory" },
      { id: "r1-8", cyr: "Ш", lat: "I", widthUnits: 1, tone: "ivory" },
      { id: "r1-9", cyr: "Щ", lat: "O", widthUnits: 1, tone: "ivory" },
      { id: "r1-10", cyr: "З", lat: "P", widthUnits: 1, tone: "ivory" },
      { id: "r1-11", cyr: "Х", lat: "[", widthUnits: 1, tone: "ivory" },
      { id: "r1-12", cyr: "Ъ", lat: "]", widthUnits: 1, tone: "ivory" },
      { id: "r1-13", cyr: "АР2", lat: "ESC", widthUnits: 1.45, tone: "charcoal" },
    ],
  },
  {
    rowIdx: 2,
    zOffset: 0.1,
    baseY: 0.041,
    keys: [
      { id: "r2-0", cyr: "УПР", lat: "CTRL", widthUnits: 1.65, tone: "charcoal" },
      { id: "r2-1", cyr: "Ф", lat: "A", widthUnits: 1, tone: "ivory" },
      { id: "r2-2", cyr: "Ы", lat: "S", widthUnits: 1, tone: "ivory" },
      { id: "r2-3", cyr: "В", lat: "D", widthUnits: 1, tone: "ivory" },
      { id: "r2-4", cyr: "А", lat: "F", widthUnits: 1, tone: "ivory" },
      { id: "r2-5", cyr: "П", lat: "G", widthUnits: 1, tone: "ivory" },
      { id: "r2-6", cyr: "Р", lat: "H", widthUnits: 1, tone: "ivory" },
      { id: "r2-7", cyr: "О", lat: "J", widthUnits: 1, tone: "ivory" },
      { id: "r2-8", cyr: "Л", lat: "K", widthUnits: 1, tone: "ivory" },
      { id: "r2-9", cyr: "Д", lat: "L", widthUnits: 1, tone: "ivory" },
      { id: "r2-10", cyr: "Ж", lat: ";", widthUnits: 1, tone: "ivory" },
      { id: "r2-11", cyr: "Э", lat: "'", widthUnits: 1, tone: "ivory" },
      { id: "r2-12", cyr: "ВВОД", lat: "ENTER", widthUnits: 2.25, tone: "oxblood" },
    ],
  },
  {
    rowIdx: 3,
    zOffset: 0.136,
    baseY: 0.0385,
    keys: [
      { id: "r3-0", cyr: "РУС", lat: "RUS", widthUnits: 1.65, tone: "oxblood" },
      { id: "r3-1", cyr: "Я", lat: "Z", widthUnits: 1, tone: "ivory" },
      { id: "r3-2", cyr: "Ч", lat: "X", widthUnits: 1, tone: "ivory" },
      { id: "r3-3", cyr: "С", lat: "C", widthUnits: 1, tone: "ivory" },
      { id: "r3-4", cyr: "М", lat: "V", widthUnits: 1, tone: "ivory" },
      { id: "r3-5", cyr: "ПРОБЕЛ // ДВК-84", lat: "", widthUnits: 4.3, tone: "ivory" },
      { id: "r3-6", cyr: "И", lat: "B", widthUnits: 1, tone: "ivory" },
      { id: "r3-7", cyr: "Т", lat: "N", widthUnits: 1, tone: "ivory" },
      { id: "r3-8", cyr: "Ь", lat: "M", widthUnits: 1, tone: "ivory" },
      { id: "r3-9", cyr: "Б", lat: "<", widthUnits: 1, tone: "ivory" },
      { id: "r3-10", cyr: "ЛАТ", lat: "LAT", widthUnits: 1.95, tone: "charcoal" },
    ],
  },
];

/**
 * Gritty 1984 Soviet Military Mainframe Console (`ПУЛЬТ ОПЕРАТОРА ЭВМ ДВК-84`)
 * Replaces the old Z-fighting keycap deck and 3 giant plastic Duplo button bricks
 * on the K.O.M.R.A.D.-84 terminal with 3 distinct mechanical switch stations +
 * a recessed cast-iron `ДВК-2М / ЕС ЭВМ` mechanical keyboard well with two-tone sculpted keycaps.
 */
export const SovietDvk84KeyboardConsole3D: React.FC<{
  onCycleBulletin?: () => void;
}> = React.memo(({ onCycleBulletin }) => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  // Station 1 (`OVERRIDE AI LOCK`) refs
  const overrideToggleBatRef = useRef<THREE.Group>(null);
  const overrideLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const overridePulseRef = useRef(0);

  // Station 2 (`PURGE FIREWALL`) refs
  const purgePlungerGroupRef = useRef<THREE.Group>(null);
  const purgeGuardGroupRef = useRef<THREE.Group>(null);
  const purgePlungerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const purgeReadyLedMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const purgeAlertLedMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const purgePressAnimRef = useRef(0);

  // Station 3 (`CYCLE AI BULLETIN`) refs
  const bulletinKnobGroupRef = useRef<THREE.Group>(null);
  const bulletinLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bulletinAngleRef = useRef(0);
  const bulletinTargetAngleRef = useRef(0);
  const bulletinPressAnimRef = useRef(0);

  // Keyboard Row Press Animation refs
  const keyRowGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const keyRowPressRef = useRef<[number, number, number, number]>([0, 0, 0, 0]);

  const overridePlaqueTex = useMemo(
    () =>
      createCrispPanelTexture(320, 68, (ctx, w, h) => {
        ctx.fillStyle = "#161918";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8a929a";
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        for (const [rx, ry] of [
          [11, 11],
          [w - 11, 11],
          [11, h - 11],
          [w - 11, h - 11],
        ] as const) {
          ctx.fillStyle = "#8c7a4b";
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        drawFittedPlaqueText(
          ctx,
          "OVERRIDE AI LOCK",
          w / 2,
          29,
          w,
          'bold 22px "Courier Prime", monospace',
          "#ffb000",
        );
        drawFittedPlaqueText(
          ctx,
          "БЛОКИРОВКА ИИ • ЗАЩИТА",
          w / 2,
          53,
          w,
          'bold 16px "VT323", monospace',
          "#d8d2c0",
        );
      }),
    [],
  );

  const purgePlaqueTex = useMemo(
    () =>
      createCrispPanelTexture(320, 68, (ctx, w, h) => {
        ctx.fillStyle = "#1a1414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#c83228";
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        for (const [rx, ry] of [
          [11, 11],
          [w - 11, 11],
          [11, h - 11],
          [w - 11, h - 11],
        ] as const) {
          ctx.fillStyle = "#8a929a";
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        drawFittedPlaqueText(
          ctx,
          "PURGE FIREWALL",
          w / 2,
          29,
          w,
          'bold 22px "Courier Prime", monospace',
          "#ff4438",
        );
        drawFittedPlaqueText(
          ctx,
          "СБРОС ЗАЩИТЫ • READY / ALERT",
          w / 2,
          53,
          w,
          'bold 16px "VT323", monospace',
          "#e6dec3",
        );
      }),
    [],
  );

  const bulletinPlaqueTex = useMemo(
    () =>
      createCrispPanelTexture(320, 68, (ctx, w, h) => {
        ctx.fillStyle = "#141a17";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8c7a4b";
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        for (const [rx, ry] of [
          [11, 11],
          [w - 11, 11],
          [11, h - 11],
          [w - 11, h - 11],
        ] as const) {
          ctx.fillStyle = "#b8a46b";
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        drawFittedPlaqueText(
          ctx,
          "CYCLE AI BULLETIN",
          w / 2,
          29,
          w,
          'bold 22px "Courier Prime", monospace',
          "#33ff66",
        );
        drawFittedPlaqueText(
          ctx,
          "СМЕНА СВОДКИ • ТУРЕЛЬ",
          w / 2,
          53,
          w,
          'bold 16px "VT323", monospace',
          "#d8d2c0",
        );
      }),
    [],
  );

  const hazardRailTex = useMemo(
    () =>
      createCrispPanelTexture(64, 256, (ctx, w, h) => {
        ctx.fillStyle = "#181615";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#c47d16";
        for (let y = -64; y < h + 64; y += 36) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y + 20);
          ctx.lineTo(w, y + 38);
          ctx.lineTo(0, y + 18);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "rgba(18, 16, 14, 0.32)";
        for (let i = 0; i < 40; i++) {
          const sx = ((i * 37) % w);
          const sy = ((i * 73) % h);
          ctx.fillRect(sx, sy, 6, 3);
        }
      }),
    [],
  );

  const purgeCapTex = useMemo(
    () =>
      createCrispPanelTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        const grad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 58);
        grad.addColorStop(0, "#ff4a3d");
        grad.addColorStop(0.68, "#a81814");
        grad.addColorStop(1, "#4a0a08");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#e6dec3";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#fff4eb";
        ctx.font = 'bold 21px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("PURGE", cx, cy - 3);
        ctx.font = 'bold 17px "VT323", monospace';
        ctx.fillText("СБРОС", cx, cy + 19);
      }),
    [],
  );

  const consoleBadgeTex = useMemo(
    () =>
      createCrispPanelTexture(512, 40, (ctx, w, h) => {
        ctx.fillStyle = "#161a18";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8c7a4b";
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#b8a46b";
        ctx.font = 'bold 17px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText(
          "ПУЛЬТ ОПЕРАТОРА ЭВМ ДВК-84М • ГОСТ 25868-84 • СЕКТОР 84",
          w / 2,
          25,
        );
      }),
    [],
  );

  // Precompute exact X positions and widths for each keycap + row legend strip textures
  const computedRows = useMemo(() => {
    const totalRowWidth = 1.32;
    const keyGap = 0.0055;

    return DVK84_KEY_ROWS.map((row) => {
      const totalUnits = row.keys.reduce((acc, k) => acc + k.widthUnits, 0);
      const totalGaps = (row.keys.length - 1) * keyGap;
      const unitWidth = (totalRowWidth - totalGaps) / totalUnits;

      let cursorX = -totalRowWidth / 2;
      const keyPlacements = row.keys.map((k) => {
        const w = k.widthUnits * unitWidth;
        const cx = cursorX + w / 2;
        cursorX += w + keyGap;
        return {
          ...k,
          width: w,
          centerX: cx,
        };
      });

      const rowLegendTex = createCrispPanelTexture(1024, 64, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        for (const kp of keyPlacements) {
          const normCenter = (kp.centerX + totalRowWidth / 2) / totalRowWidth;
          const normWidth = (kp.width - 0.007) / totalRowWidth;
          const px = normCenter * w;
          const pw = normWidth * w;
          const x0 = px - pw / 2;

          // Subtle recessed top keycap dish bevel
          ctx.fillStyle =
            kp.tone === "ivory"
              ? "rgba(214, 206, 184, 0.94)"
              : kp.tone === "oxblood"
                ? "rgba(104, 30, 24, 0.94)"
                : "rgba(44, 40, 38, 0.94)";
          ctx.fillRect(x0 + 2, 6, pw - 4, h - 12);

          ctx.strokeStyle =
            kp.tone === "ivory"
              ? "rgba(72, 66, 56, 0.55)"
              : "rgba(18, 16, 15, 0.7)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x0 + 2, 6, pw - 4, h - 12);

          const mainInk = kp.tone === "ivory" ? "#181614" : "#efe8d4";
          const subInk = kp.tone === "ivory" ? "#6e1d18" : "#ffb74d";

          if (kp.lat && kp.cyr.length <= 2) {
            ctx.fillStyle = mainInk;
            ctx.font = 'bold 24px "Courier Prime", monospace';
            ctx.textAlign = "left";
            ctx.fillText(kp.cyr, x0 + 8, 32);

            ctx.fillStyle = subInk;
            ctx.font = 'bold 18px "Courier Prime", monospace';
            ctx.textAlign = "right";
            ctx.fillText(kp.lat, x0 + pw - 7, 50);
          } else {
            ctx.fillStyle = mainInk;
            ctx.font = 'bold 19px "Courier Prime", monospace';
            ctx.textAlign = "center";
            ctx.fillText(kp.cyr, px, kp.lat ? 30 : 39);
            if (kp.lat) {
              ctx.fillStyle = subInk;
              ctx.font = 'bold 14px "VT323", monospace';
              ctx.fillText(kp.lat, px, 48);
            }
          }
        }
      });

      return {
        ...row,
        totalRowWidth,
        keyPlacements,
        rowLegendTex,
      };
    });
  }, []);

  useFrame(({ clock }, delta) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();

    // 1. Station 1 (`OVERRIDE AI LOCK`): Guarded Toggle Switch + Caged Amber Jewel Lamp
    if (overridePulseRef.current > 0) {
      overridePulseRef.current = Math.max(0, overridePulseRef.current - delta * 2.8);
    }
    if (overrideToggleBatRef.current) {
      const targetRotX =
        s.komradOverrideLocked || overridePulseRef.current > 0.2 ? -0.58 : 0.58;
      overrideToggleBatRef.current.rotation.x = THREE.MathUtils.lerp(
        overrideToggleBatRef.current.rotation.x,
        targetRotX,
        0.25,
      );
    }
    if (overrideLampMatRef.current) {
      const pulse = s.komradOverrideLocked
        ? 1.35 + Math.sin(t * 12) * 0.75
        : overridePulseRef.current > 0
          ? 1.6
          : 0.42;
      const col = s.komradOverrideLocked ? "#ff7700" : "#d98a18";
      overrideLampMatRef.current.color.set(col);
      overrideLampMatRef.current.emissive.set(col);
      overrideLampMatRef.current.emissiveIntensity = pulse;
    }

    // 2. Station 2 (`PURGE FIREWALL`): Hinged Safety-Guarded Crimson Plunger + READY/ALERT Dual LEDs
    if (purgePressAnimRef.current > 0) {
      purgePressAnimRef.current = Math.max(0, purgePressAnimRef.current - delta * 3.5);
    }
    if (purgePlungerGroupRef.current) {
      const depressY = 0.022 - Math.sin(purgePressAnimRef.current * Math.PI) * 0.011;
      purgePlungerGroupRef.current.position.y = depressY;
    }
    if (purgeGuardGroupRef.current) {
      const guardKick = Math.sin(purgePressAnimRef.current * Math.PI) * 0.22;
      purgeGuardGroupRef.current.rotation.x = -0.92 - guardKick;
    }
    if (purgePlungerMatRef.current) {
      const glow = s.ciaIntrusionActive
        ? 1.45 + Math.sin(t * 14) * 0.65
        : 0.55 + purgePressAnimRef.current * 1.1;
      purgePlungerMatRef.current.emissiveIntensity = glow;
    }
    if (purgeReadyLedMatRef.current) {
      const readyOn = !s.ciaIntrusionActive && !s.isBlackout;
      purgeReadyLedMatRef.current.color.set(readyOn ? "#28d858" : "#14261a");
      purgeReadyLedMatRef.current.emissive.set(readyOn ? "#28d858" : "#000000");
      purgeReadyLedMatRef.current.emissiveIntensity = readyOn ? 1.25 : 0.05;
    }
    if (purgeAlertLedMatRef.current) {
      const alertBlink = s.ciaIntrusionActive
        ? 1.5 + Math.sin(t * 16) * 0.8
        : purgePressAnimRef.current > 0
          ? 1.2
          : 0.06;
      purgeAlertLedMatRef.current.color.set(
        s.ciaIntrusionActive ? "#ff2a2a" : "#3a1212",
      );
      purgeAlertLedMatRef.current.emissive.set("#ff2a2a");
      purgeAlertLedMatRef.current.emissiveIntensity = alertBlink;
    }

    // 3. Station 3 (`CYCLE AI BULLETIN`): Knurled Bakelite Rotary Turret + Emerald Pilot Lamp
    if (bulletinPressAnimRef.current > 0) {
      bulletinPressAnimRef.current = Math.max(
        0,
        bulletinPressAnimRef.current - delta * 3.6,
      );
    }
    bulletinAngleRef.current = THREE.MathUtils.lerp(
      bulletinAngleRef.current,
      bulletinTargetAngleRef.current,
      0.24,
    );
    if (bulletinKnobGroupRef.current) {
      bulletinKnobGroupRef.current.rotation.y = bulletinAngleRef.current;
      bulletinKnobGroupRef.current.position.y =
        0.024 - Math.sin(bulletinPressAnimRef.current * Math.PI) * 0.006;
    }
    if (bulletinLampMatRef.current) {
      const lampGlow =
        bulletinPressAnimRef.current > 0
          ? 1.85
          : s.isBlackout
            ? 0.05
            : 0.65 + Math.sin(t * 3.2) * 0.15;
      bulletinLampMatRef.current.color.set("#28d858");
      bulletinLampMatRef.current.emissive.set("#28d858");
      bulletinLampMatRef.current.emissiveIntensity = lampGlow;
    }

    // 4. Animate Mechanical Keyboard Row Depressions
    for (let r = 0; r < 4; r++) {
      if (keyRowPressRef.current[r] > 0) {
        keyRowPressRef.current[r] = Math.max(
          0,
          keyRowPressRef.current[r] - delta * 5.2,
        );
      }
      const grp = keyRowGroupRefs.current[r];
      if (grp) {
        grp.position.y = -Math.sin(keyRowPressRef.current[r] * Math.PI) * 0.0045;
      }
    }
  });

  const triggerOverrideStation = (e: ThreeEvent<MouseEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    overridePulseRef.current = 1.0;
    playSwitchClank(true);
    useGameStore.getState().overrideKomradLock();
  };

  const triggerPurgeStation = (e: ThreeEvent<MouseEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    purgePressAnimRef.current = 1.0;
    playSwitchClank(true);
    useGameStore.getState().purgeFirewall();
  };

  const triggerBulletinStation = (e: ThreeEvent<MouseEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    bulletinPressAnimRef.current = 1.0;
    bulletinTargetAngleRef.current -= Math.PI / 3;
    playSwitchClank(false);
    playDetentClick();
    onCycleBulletin?.();
  };

  return (
    <group position={[0, 0.785, 0.255]} rotation={[0.3, 0, 0]}>
      {/* ================================================================
          1. HEAVY STEPPED CAST-IRON KEYBOARD CONSOLE CHASSIS (`ДВК-84`)
             Eliminates all coplanar inner plates — key-bed floor sits at
             y = 0.021m, well below keycap bottoms at y = 0.0385m..0.046m!
         ================================================================ */}
      {/* Lower Cast-Iron Console Tub (y = -0.038m to +0.022m) */}
      <mesh position={[0, -0.008, 0.032]} castShadow receiveShadow>
        <boxGeometry args={[1.52, 0.06, 0.42]} />
        <meshStandardMaterial
          color="#1d2722"
          roughness={0.48}
          metalness={0.64}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* Deep Dark Recessed Steel Key-Well Floor Plate (Top surface at y = 0.023m, >0.015m below keycaps!) */}
      <mesh position={[0, 0.019, 0.082]} receiveShadow>
        <boxGeometry args={[1.38, 0.008, 0.185]} />
        <meshStandardMaterial
          color="#0a0d0b"
          roughness={0.78}
          metalness={0.45}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.004}
        />
      </mesh>

      {/* Stepped Cast-Iron Perimeter Bezel Walls Framing the Recessed Key-Well */}
      {/* Left & Right Bezel Flanks */}
      {[-0.725, 0.725].map((bx, bIdx) => (
        <mesh
          key={`kb-flank-${bIdx}`}
          position={[bx, 0.036, 0.032]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.068, 0.028, 0.418]} />
          <meshStandardMaterial
            color="#222e28"
            roughness={0.44}
            metalness={0.68}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.007}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>
      ))}
      {/* Center Divider Ridge Between Upper Switch Manifold & Lower Keyboard Well */}
      <mesh position={[0, 0.038, 0.0]} castShadow receiveShadow>
        <boxGeometry args={[1.384, 0.026, 0.022]} />
        <meshStandardMaterial
          color="#18201c"
          roughness={0.42}
          metalness={0.72}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.006}
        />
      </mesh>
      {/* Engraved Brass Serial Badge on Divider Ridge (+0.003m clear with polygonOffset) */}
      <mesh position={[0, 0.0535, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.56, 0.02]} />
        <meshStandardMaterial
          map={consoleBadgeTex}
          roughness={0.38}
          metalness={0.55}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Front Bezel Lip & Cylindrical Brushed-Steel Wrist-Rest Bar */}
      <mesh position={[0, 0.034, 0.192]} castShadow receiveShadow>
        <boxGeometry args={[1.48, 0.024, 0.038]} />
        <meshStandardMaterial
          color="#18201c"
          roughness={0.45}
          metalness={0.68}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.007}
        />
      </mesh>
      {/* Cylindrical Brushed-Steel Wrist-Rest Bar + 3 Machined Standoff Brackets */}
      <group position={[0, 0.052, 0.206]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.014, 0.014, 1.42, 16]} />
          <meshStandardMaterial
            color="#8a929a"
            metalness={0.88}
            roughness={0.26}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.003}
          />
        </mesh>
        {[-0.64, 0, 0.64].map((wx, wIdx) => (
          <mesh key={`wrist-br-${wIdx}`} position={[wx, -0.01, -0.008]} castShadow>
            <boxGeometry args={[0.032, 0.026, 0.032]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.86}
              roughness={0.28}
              bumpMap={brassTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
        ))}
      </group>

      {/* 8 Perimeter Brass Hex Bolts on Console Frame */}
      {(
        [
          [-0.725, -0.145],
          [0.725, -0.145],
          [-0.725, 0.0],
          [0.725, 0.0],
          [-0.725, 0.085],
          [0.725, 0.085],
          [-0.725, 0.192],
          [0.725, 0.192],
        ] as const
      ).map(([bx, bz], bIdx) => (
        <mesh key={`cbolt-${bIdx}`} position={[bx, 0.053, bz]} castShadow>
          <cylinderGeometry args={[0.0075, 0.0075, 0.007, 6]} />
          <meshStandardMaterial
            color="#b8a46b"
            metalness={0.86}
            roughness={0.28}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>
      ))}

      {/* ================================================================
          2. UPPER COMMAND SWITCH MANIFOLD (3 HEAVY SOVIET ASSEMBLIES)
             Mounted on an unobstructed exposed control strip at z = -0.076m
             completely in front of and below the CRT bottom bezel!
         ================================================================ */}
      <group position={[0, 0.038, -0.076]}>
        {/* Dark Gunmetal Manifold Deck Plate */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.384, 0.024, 0.132]} />
          <meshStandardMaterial
            color="#151b18"
            roughness={0.44}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.007}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>

        {/* --------------------------------------------------------------
            LEFT STATION (-0.455m): `OVERRIDE AI LOCK` (`БЛОКИРОВКА ИИ`)
            Guarded Metal Toggle Switch + Caged Amber Jewel Lamp
           -------------------------------------------------------------- */}
        <group position={[-0.455, 0.013, 0]} onClick={triggerOverrideStation}>
          {/* Generous Invisible Hit-Box Collider */}
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.43, 0.1, 0.14]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Bolted Steel Sub-Plate */}
          <mesh position={[0, 0.005, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.41, 0.01, 0.122]} />
            <meshStandardMaterial
              color="#222826"
              roughness={0.4}
              metalness={0.76}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* 4 Corner Steel Hex Bolts */}
          {(
            [
              [-0.188, -0.046],
              [0.188, -0.046],
              [-0.188, 0.046],
              [0.188, 0.046],
            ] as const
          ).map(([bx, bz], idx) => (
            <mesh key={`ov-bolt-${idx}`} position={[bx, 0.012, bz]} castShadow>
              <cylinderGeometry args={[0.0055, 0.0055, 0.006, 6]} />
              <meshStandardMaterial color="#8a929a" metalness={0.86} roughness={0.3} />
            </mesh>
          ))}

          {/* Raised Angled Nameplate Wedge + Illuminated English Plaque (`OVERRIDE AI LOCK`) */}
          <mesh position={[0, 0.015, -0.028]} rotation={[0.22, 0, 0]} castShadow>
            <boxGeometry args={[0.356, 0.012, 0.054]} />
            <meshStandardMaterial color="#181d1b" metalness={0.7} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.0225, -0.027]} rotation={[-Math.PI / 2 + 0.22, 0, 0]}>
            <planeGeometry args={[0.348, 0.05]} />
            <meshStandardMaterial
              map={overridePlaqueTex}
              emissive="#ffffff"
              emissiveMap={overridePlaqueTex}
              emissiveIntensity={0.48}
              roughness={0.86}
              metalness={0.12}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Guarded Metal Toggle Switch Assembly (Left-Center of Station) */}
          <group position={[-0.058, 0.012, 0.028]}>
            {/* Hex Brass Mounting Nut & Threaded Collar */}
            <mesh position={[0, 0.006, 0]} castShadow>
              <cylinderGeometry args={[0.022, 0.025, 0.012, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            <mesh position={[0, 0.014, 0]} castShadow>
              <cylinderGeometry args={[0.014, 0.014, 0.01, 12]} />
              <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.24} />
            </mesh>

            {/* U-Shaped Steel Protective Side-Guards */}
            {[-0.028, 0.028].map((gx, gIdx) => (
              <group key={`ov-guard-${gIdx}`} position={[gx, 0.022, 0]}>
                <mesh position={[0, 0, -0.016]} castShadow>
                  <cylinderGeometry args={[0.004, 0.004, 0.042, 8]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.26} />
                </mesh>
                <mesh position={[0, 0, 0.016]} castShadow>
                  <cylinderGeometry args={[0.004, 0.004, 0.042, 8]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.26} />
                </mesh>
                <mesh position={[0, 0.021, 0]} castShadow>
                  <boxGeometry args={[0.008, 0.007, 0.04]} />
                  <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.26} />
                </mesh>
              </group>
            ))}

            {/* Flipping Chrome Toggle Bat */}
            <group ref={overrideToggleBatRef} position={[0, 0.016, 0]}>
              <mesh position={[0, 0.022, 0]} castShadow>
                <cylinderGeometry args={[0.0085, 0.005, 0.046, 12]} />
                <meshStandardMaterial
                  color="#dce4e8"
                  metalness={0.94}
                  roughness={0.16}
                />
              </mesh>
              <mesh position={[0, 0.045, 0]} castShadow>
                <sphereGeometry args={[0.009, 10, 10]} />
                <meshStandardMaterial
                  color="#dce4e8"
                  metalness={0.94}
                  roughness={0.16}
                />
              </mesh>
            </group>
          </group>

          {/* 3D Caged Amber Jewel Lamp (Right of Toggle Switch) */}
          <group position={[0.088, 0.014, 0.028]} rotation={[-Math.PI / 2, 0, 0]}>
            <CagedSovietJewelLamp3D
              position={[0, 0, 0]}
              lampMatRef={overrideLampMatRef}
              scale={0.88}
            />
          </group>
        </group>

        {/* --------------------------------------------------------------
            CENTER STATION (0.0m): `PURGE FIREWALL` (`СБРОС ЗАЩИТЫ`)
            Hinged Safety-Guarded Industrial Push-Plunger + Dual READY/ALERT LEDs
           -------------------------------------------------------------- */}
        <group position={[0, 0.013, 0]} onClick={triggerPurgeStation}>
          {/* Generous Invisible Hit-Box Collider */}
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.44, 0.1, 0.14]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Recessed Dark Steel Bezel Base */}
          <mesh position={[0, 0.005, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.01, 0.122]} />
            <meshStandardMaterial
              color="#1b1818"
              roughness={0.42}
              metalness={0.74}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>

          {/* Hazard-Striped Side Rails */}
          {[-0.196, 0.196].map((rx, rIdx) => (
            <mesh key={`haz-rail-${rIdx}`} position={[rx, 0.013, 0]} castShadow>
              <boxGeometry args={[0.022, 0.01, 0.118]} />
              <meshStandardMaterial
                map={hazardRailTex}
                roughness={0.48}
                metalness={0.35}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
          ))}

          {/* Raised Angled Nameplate Wedge + Engraved Steel Label Plate (`PURGE FIREWALL`) */}
          <mesh position={[0, 0.015, -0.028]} rotation={[0.22, 0, 0]} castShadow>
            <boxGeometry args={[0.348, 0.012, 0.054]} />
            <meshStandardMaterial color="#1f1616" metalness={0.7} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.0225, -0.027]} rotation={[-Math.PI / 2 + 0.22, 0, 0]}>
            <planeGeometry args={[0.34, 0.05]} />
            <meshStandardMaterial
              map={purgePlaqueTex}
              emissive="#ffffff"
              emissiveMap={purgePlaqueTex}
              emissiveIntensity={0.48}
              roughness={0.86}
              metalness={0.12}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Industrial Backlit Crimson Push-Plunger + Machined Collar + Spring Safety Guard */}
          <group position={[-0.045, 0.012, 0.028]}>
            {/* Outer Knurled Dark Cast-Iron Turret Base */}
            <mesh position={[0, 0.008, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.042, 0.046, 0.016, 18]} />
              <meshStandardMaterial
                color="#1c2022"
                metalness={0.78}
                roughness={0.38}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* Machined Brushed-Steel Collar Ring */}
            <mesh position={[0, 0.017, 0]} castShadow>
              <cylinderGeometry args={[0.037, 0.04, 0.008, 18]} />
              <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.26} />
            </mesh>

            {/* Depressible Crimson Glass/Bakelite Plunger Cylinder */}
            <group ref={purgePlungerGroupRef} position={[0, 0.022, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.031, 0.033, 0.02, 20]} />
                <meshStandardMaterial
                  ref={purgePlungerMatRef}
                  color="#b81d18"
                  emissive="#ff2a2a"
                  emissiveIntensity={0.65}
                  roughness={0.26}
                  metalness={0.18}
                />
              </mesh>
              {/* Crisp Stenciled Plunger Top Cap (+0.002m clear with polygonOffset) */}
              <mesh position={[0, 0.0115, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.029, 20]} />
                <meshStandardMaterial
                  map={purgeCapTex}
                  emissive="#ffffff"
                  emissiveMap={purgeCapTex}
                  emissiveIntensity={0.55}
                  roughness={0.3}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                />
              </mesh>
            </group>

            {/* Spring-Hinged Wire/Steel Safety Guard Frame (Tilted open at rear) */}
            <group ref={purgeGuardGroupRef} position={[0, 0.018, -0.038]} rotation={[-0.92, 0, 0]}>
              {/* Coiled Hinge Barrel */}
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.006, 0.006, 0.068, 10]} />
                <meshStandardMaterial color="#8a929a" metalness={0.9} roughness={0.22} />
              </mesh>
              {/* Side Guard Struts */}
              {[-0.034, 0.034].map((sx, sIdx) => (
                <mesh key={`pg-strut-${sIdx}`} position={[sx, 0, 0.038]} castShadow>
                  <boxGeometry args={[0.006, 0.006, 0.076]} />
                  <meshStandardMaterial color="#c83228" roughness={0.38} metalness={0.45} />
                </mesh>
              ))}
              {/* Front Guard Cross-Bar */}
              <mesh position={[0, 0, 0.076]} castShadow>
                <boxGeometry args={[0.074, 0.007, 0.008]} />
                <meshStandardMaterial color="#ffb000" roughness={0.38} metalness={0.35} />
              </mesh>
            </group>
          </group>

          {/* Dual-LED Status Indicator (`READY` Emerald / `ALERT` Crimson) */}
          <group position={[0.095, 0.012, 0.028]}>
            <mesh position={[0, 0.005, 0]} castShadow>
              <boxGeometry args={[0.092, 0.01, 0.052]} />
              <meshStandardMaterial
                color="#141816"
                metalness={0.75}
                roughness={0.4}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>
            {/* READY Lamp (Left) */}
            <group position={[-0.022, 0.011, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.013, 0.015, 0.007, 12]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.26} />
              </mesh>
              <mesh position={[0, 0.004, 0]}>
                <sphereGeometry args={[0.01, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                <meshStandardMaterial
                  ref={purgeReadyLedMatRef}
                  color="#28d858"
                  emissive="#28d858"
                  emissiveIntensity={1.2}
                  roughness={0.2}
                />
              </mesh>
            </group>
            {/* ALERT Lamp (Right) */}
            <group position={[0.022, 0.011, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.013, 0.015, 0.007, 12]} />
                <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.26} />
              </mesh>
              <mesh position={[0, 0.004, 0]}>
                <sphereGeometry args={[0.01, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                <meshStandardMaterial
                  ref={purgeAlertLedMatRef}
                  color="#3a1212"
                  emissive="#ff2a2a"
                  emissiveIntensity={0.08}
                  roughness={0.2}
                />
              </mesh>
            </group>
          </group>
        </group>

        {/* --------------------------------------------------------------
            RIGHT STATION (+0.455m): `CYCLE AI BULLETIN` (`СМЕНА СВОДКИ`)
            Tactile Knurled Bakelite Rotary Selector Turret + Emerald Jewel Lamp
           -------------------------------------------------------------- */}
        <group position={[0.455, 0.013, 0]} onClick={triggerBulletinStation}>
          {/* Generous Invisible Hit-Box Collider */}
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.43, 0.1, 0.14]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>

          {/* Bolted Steel Sub-Plate */}
          <mesh position={[0, 0.005, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.41, 0.01, 0.122]} />
            <meshStandardMaterial
              color="#1c2420"
              roughness={0.4}
              metalness={0.76}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* 4 Corner Brass Hex Bolts */}
          {(
            [
              [-0.188, -0.046],
              [0.188, -0.046],
              [-0.188, 0.046],
              [0.188, 0.046],
            ] as const
          ).map(([bx, bz], idx) => (
            <mesh key={`bul-bolt-${idx}`} position={[bx, 0.012, bz]} castShadow>
              <cylinderGeometry args={[0.0055, 0.0055, 0.006, 6]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.86} roughness={0.28} />
            </mesh>
          ))}

          {/* Raised Angled Nameplate Wedge + Engraved Plaque (`CYCLE AI BULLETIN`) */}
          <mesh position={[0, 0.015, -0.028]} rotation={[0.22, 0, 0]} castShadow>
            <boxGeometry args={[0.356, 0.012, 0.054]} />
            <meshStandardMaterial color="#161f1b" metalness={0.7} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.0225, -0.027]} rotation={[-Math.PI / 2 + 0.22, 0, 0]}>
            <planeGeometry args={[0.348, 0.05]} />
            <meshStandardMaterial
              map={bulletinPlaqueTex}
              emissive="#ffffff"
              emissiveMap={bulletinPlaqueTex}
              emissiveIntensity={0.48}
              roughness={0.86}
              metalness={0.12}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>

          {/* Heavy Cast-Iron Boss + Brushed Brass Index Ring + Knurled Bakelite Rotary Turret */}
          <group position={[-0.055, 0.012, 0.028]}>
            {/* Heavy Cast-Iron Cylindrical Boss */}
            <mesh position={[0, 0.006, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.04, 0.044, 0.012, 18]} />
              <meshStandardMaterial
                color="#161c19"
                metalness={0.76}
                roughness={0.4}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* Brushed Brass Index Ring */}
            <mesh position={[0, 0.013, 0]} castShadow>
              <cylinderGeometry args={[0.036, 0.038, 0.005, 18]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.004}
              />
            </mesh>

            {/* Rotating & Depressible Lathe-Turned Dark Charcoal Bakelite Knob */}
            <group ref={bulletinKnobGroupRef} position={[0, 0.024, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.028, 0.032, 0.022, 16]} />
                <meshStandardMaterial
                  color="#1c1817"
                  roughness={0.32}
                  metalness={0.15}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.004}
                />
              </mesh>
              {/* 6 Knurled Grip Ribs Around the Bakelite Turret */}
              {Array.from({ length: 6 }).map((_, kIdx) => {
                const ang = (kIdx / 6) * Math.PI * 2;
                return (
                  <mesh
                    key={`krib-${kIdx}`}
                    position={[Math.cos(ang) * 0.029, 0, Math.sin(ang) * 0.029]}
                    rotation={[0, -ang, 0]}
                    castShadow
                  >
                    <boxGeometry args={[0.005, 0.019, 0.007]} />
                    <meshStandardMaterial color="#2a2422" roughness={0.38} />
                  </mesh>
                );
              })}
              {/* Machined Brushed-Steel Center Cap */}
              <mesh position={[0, 0.0115, 0]} castShadow>
                <cylinderGeometry args={[0.014, 0.015, 0.004, 14]} />
                <meshStandardMaterial color="#8a929a" metalness={0.88} roughness={0.24} />
              </mesh>
              {/* High-Contrast Ivory White Indicator Stripe */}
              <mesh position={[0, 0.012, -0.018]} castShadow>
                <boxGeometry args={[0.0055, 0.004, 0.018]} />
                <meshStandardMaterial
                  color="#efe8d4"
                  emissive="#efe8d4"
                  emissiveIntensity={0.25}
                  roughness={0.3}
                />
              </mesh>
            </group>
          </group>

          {/* 3D Caged Emerald Jewel Pilot Lamp (Right of Rotary Turret) */}
          <group position={[0.088, 0.012, 0.026]} rotation={[-Math.PI / 2, 0, 0]}>
            <CagedSovietJewelLamp3D
              position={[0, 0, 0]}
              lampMatRef={bulletinLampMatRef}
              scale={0.88}
            />
          </group>
        </group>
      </group>

      {/* ================================================================
          3. SCULPTED SOVIET `ДВК-2М / ЕС ЭВМ` TWO-TONE MECHANICAL KEYBOARD
             4 terraced rows of sculpted two-tone keycaps (skirt + crown)
             sitting cleanly above the dark steel key-well (zero Z-fighting!)
         ================================================================ */}
      <group position={[0, 0, 0]}>
        {computedRows.map((row) => (
          <group
            key={`dvk-row-${row.rowIdx}`}
            ref={(el) => {
              keyRowGroupRefs.current[row.rowIdx] = el;
            }}
            onClick={(e) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              keyRowPressRef.current[row.rowIdx] = 1.0;
              playDetentClick();
            }}
          >
            {/* Generous Row Hit-Box */}
            <mesh position={[0, row.baseY + 0.008, row.zOffset]}>
              <boxGeometry args={[row.totalRowWidth, 0.024, 0.034]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Individual Sculpted Two-Tier 3D Keycaps */}
            {row.keyPlacements.map((kp) => {
              const skirtColor =
                kp.tone === "ivory"
                  ? "#a8a08c"
                  : kp.tone === "oxblood"
                    ? "#4d1612"
                    : "#211d1b";
              const crownColor =
                kp.tone === "ivory"
                  ? "#c2ba9e"
                  : kp.tone === "oxblood"
                    ? "#631e19"
                    : "#2c2725";
              return (
                <group
                  key={kp.id}
                  position={[kp.centerX, row.baseY, row.zOffset]}
                >
                  {/* Lower Tapered Keycap Skirt */}
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[kp.width, 0.013, 0.031]} />
                    <meshStandardMaterial
                      color={skirtColor}
                      roughness={0.42}
                      metalness={0.14}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.002}
                    />
                  </mesh>
                  {/* Upper Sculpted Keycap Crown */}
                  <mesh position={[0, 0.0085, -0.001]} castShadow receiveShadow>
                    <boxGeometry args={[kp.width - 0.006, 0.005, 0.025]} />
                    <meshStandardMaterial
                      color={crownColor}
                      roughness={0.36}
                      metalness={0.12}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.0015}
                    />
                  </mesh>
                </group>
              );
            })}

            {/* Crisp Cyrillic/Latin Legend Overlay Plane (+0.003m clear of keycap crowns with polygonOffset) */}
            <mesh
              position={[0, row.baseY + 0.014, row.zOffset - 0.001]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[row.totalRowWidth, 0.025]} />
              <meshStandardMaterial
                map={row.rowLegendTex}
                transparent
                roughness={0.4}
                metalness={0.08}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
});


