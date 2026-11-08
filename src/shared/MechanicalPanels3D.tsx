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

  const domElem =
    (e.nativeEvent.target as HTMLElement | null) ??
    document.querySelector("canvas");
  const rect = domElem?.getBoundingClientRect();
  let centerX = e.nativeEvent.clientX;
  let centerY = e.nativeEvent.clientY;
  if (wheelObject && rect && rect.width > 0 && rect.height > 0) {
    const worldPos = new THREE.Vector3();
    wheelObject.getWorldPosition(worldPos);
    worldPos.project(e.camera);
    centerX = rect.left + (worldPos.x * 0.5 + 0.5) * rect.width;
    centerY = rect.top + (-worldPos.y * 0.5 + 0.5) * rect.height;
  }

  const startX = e.nativeEvent.clientX;
  const startY = e.nativeEvent.clientY;
  let currentVal = initialValue;
  let totalMoveDist = 0;
  const initR = Math.hypot(startX - centerX, startY - centerY);
  let hasValidAngle = initR >= 6;
  let prevAngle = hasValidAngle
    ? Math.atan2(startY - centerY, startX - centerX)
    : 0;
  const range = maxVal - minVal;
  let lastSoundStep = Math.floor(((currentVal - minVal) / range) * 16);

  const handleMove = (ev: PointerEvent) => {
    totalMoveDist = Math.max(
      totalMoveDist,
      Math.hypot(ev.clientX - startX, ev.clientY - startY),
    );

    const rx = ev.clientX - centerX;
    const ry = ev.clientY - centerY;
    const r = Math.hypot(rx, ry);
    if (r < 6) return;

    const curAngle = Math.atan2(ry, rx);
    if (!hasValidAngle) {
      hasValidAngle = true;
      prevAngle = curAngle;
      return;
    }

    let dTheta = curAngle - prevAngle;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    prevAngle = curAngle;

    // Pure circular rotation around the wheel center (clockwise = increase, counter-clockwise = decrease)
    const deltaRatio = dTheta / (Math.PI * 1.25);

    currentVal = THREE.MathUtils.clamp(
      currentVal + deltaRatio * range,
      minVal,
      maxVal,
    );
    if (wheelObject) {
      wheelObject.rotation.z -= dTheta;
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

export interface MimicSegmentSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  color: "#c8a838" | "#388898" | "#a83830";
  z?: number;
}

export interface MimicNodeSpec {
  x: number;
  y: number;
  color: "#c8a838" | "#388898" | "#a83830";
  z?: number;
}

export interface SovietModularSteelCabinet3DProps {
  width: number;
  unitCode: "A" | "A2" | "B" | "C";
  annunciatorLabels: readonly [string, string, string, string, string, string];
  mimicSegments: readonly MimicSegmentSpec[];
  mimicNodes?: readonly MimicNodeSpec[];
  recessedWells?: ReadonlyArray<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
  dividerY?: number;
  lowerLedgeY?: number;
  openLeftSide?: boolean;
  openRightSide?: boolean;
}

/**
 * Authentic 1984 Soviet RBMK-1000 Modular Steel Cabinetry (`СЕКЦИЯ ЩИТА БЩУ-84`):
 * Replaces flat dark panel boxes with a 3-part enamelled blue-grey/olive-grey steel cabinet
 * (`#485450` / `#3d4845`), dark structural steel framing (`#1e2422`), recessed instrument wells
 * (`#141817`), angled upper canopy overhang (`+0.08m`) with 6 glowing `ТАБЛО` annunciator lenses,
 * stepped side cheeks (`0.18m-0.28m`), lower sloped console desk ledge framing, and physical 3D
 * raised synoptic process flow lines (`мнемосхема`) — while keeping 100% of existing controls at
 * their exact local `(x, y, z)` coordinates!
 */
export const SovietModularSteelCabinet3D: React.FC<
  SovietModularSteelCabinet3DProps
> = React.memo(
  ({
    width,
    unitCode,
    annunciatorLabels,
    mimicSegments,
    mimicNodes = [],
    recessedWells = [],
    dividerY = 1.318,
    openLeftSide = false,
    openRightSide = false,
  }) => {
    const ironTex = useMemo(() => getHammeredIronTextures(), []);
    const brassTex = useMemo(() => getBrushedBrassTextures(), []);
    const tabloMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
    const lastTabloSigRef = useRef("");

    const tabloTextures = useMemo(() => {
      return annunciatorLabels.map((lbl, idx) =>
        createCrispPanelTexture(192, 64, (ctx, w, h) => {
          const isWarn = idx === 1 || idx === 4;
          const isCrit = idx === 2 || idx === 5;
          ctx.fillStyle = isCrit
            ? "#2a0908"
            : isWarn
              ? "#281b05"
              : "#092414";
          ctx.fillRect(0, 0, w, h);

          // Internal honeycomb diffuser grid
          ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
          ctx.lineWidth = 1;
          for (let gx = 8; gx < w; gx += 8) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, h);
            ctx.stroke();
          }
          for (let gy = 8; gy < h; gy += 8) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
          }

          ctx.strokeStyle = "#18201e";
          ctx.lineWidth = 5;
          ctx.strokeRect(2, 2, w - 4, h - 4);

          const textCol = isCrit
            ? "#ff5544"
            : isWarn
              ? "#ffcc33"
              : "#44ff88";
          drawFittedPlaqueText(
            ctx,
            lbl,
            w / 2,
            41,
            w - 12,
            '900 22px "Segoe UI Black", "Arial Black", "Consolas", sans-serif',
            textCol,
            "#000000",
            3.0,
            "1.5px",
          );
        }),
      );
    }, [annunciatorLabels]);

    useFrame(({ clock }) => {
      const s = useGameStore.getState();
      const t = clock.getElapsedTime();
      const pulseBucket = Math.floor(t * 5);
      const totalMW =
        s.powerAllocation.cooling +
        s.powerAllocation.defense +
        s.powerAllocation.facility +
        (s.ventilationActive ? 10 : 0);
      const isCrit =
        s.coreTemp >= 700 ||
        s.isBlackout ||
        totalMW > s.maxSafePower ||
        s.ciaIntrusionActive;
      const isWarn =
        s.coreTemp >= 520 ||
        s.heliumPressure > 65 ||
        s.lubeOilPressure < 30 ||
        Math.abs(s.gridHz - 50) > 0.8;

      const sig = `${unitCode}|${s.isBlackout}|${isCrit}|${isWarn}|${pulseBucket % 2}`;
      if (sig === lastTabloSigRef.current) return;
      lastTabloSigRef.current = sig;

      for (let i = 0; i < 6; i++) {
        const mat = tabloMatRefs.current[i];
        if (!mat) continue;
        if (s.isBlackout) {
          mat.emissiveIntensity = 0.04;
          continue;
        }
        const isCritCell = i === 2 || i === 5;
        const isWarnCell = i === 1 || i === 4;
        if (isCritCell) {
          mat.emissiveIntensity = isCrit
            ? pulseBucket % 2 === 0
              ? 1.45
              : 0.35
            : 0.22;
        } else if (isWarnCell) {
          mat.emissiveIntensity = isWarn || isCrit ? 1.15 : 0.32;
        } else {
          mat.emissiveIntensity = 0.85;
        }
      }
    });

    const stencilPlaqueTex = useMemo(
      () =>
        createCrispPanelTexture(512, 96, (ctx, w, h) => {
          ctx.fillStyle = "#53635b";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#394640";
          ctx.lineWidth = 4;
          ctx.strokeRect(3, 3, w - 6, h - 6);
          // Yellow GOST Stencil Box (as seen in real Soviet control room pedestals: ЦТАИ / 4 / 65А)
          ctx.strokeStyle = "#e6b828";
          ctx.lineWidth = 3;
          ctx.strokeRect(18, 14, 176, h - 28);
          ctx.beginPath();
          ctx.moveTo(18, h / 2);
          ctx.lineTo(194, h / 2);
          ctx.moveTo(106, h / 2);
          ctx.lineTo(106, h - 14);
          ctx.stroke();
          ctx.fillStyle = "#f2c938";
          ctx.font = '900 22px "Consolas", "Courier New", monospace';
          ctx.textAlign = "center";
          ctx.fillText("ЦТАИ • БЩУ", 106, 39);
          ctx.font = '900 21px "Consolas", "Courier New", monospace';
          ctx.fillText(`БЛ-${unitCode}`, 62, 73);
          ctx.fillText("65А", 150, 73);

          ctx.fillStyle = "#d8e0dc";
          ctx.font = '900 20px "Consolas", "Courier New", monospace';
          ctx.textAlign = "left";
          ctx.fillText(`СЕКЦИЯ ПУЛЬТА № 84-${unitCode}`, 216, 42);
          ctx.fillStyle = "#e6b828";
          ctx.font = '700 17px "Consolas", "Courier New", monospace';
          ctx.fillText("ГОСТ 26011-84 • МИНЭНЕРГО СССР", 216, 70);
        }),
      [unitCode],
    );

    const m381ScaleTex = useMemo(
      () =>
        createCrispPanelTexture(256, 64, (ctx, w, h) => {
          ctx.fillStyle = "#f4f0e2";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#262a28";
          ctx.lineWidth = 4;
          ctx.strokeRect(2, 2, w - 4, h - 4);
          // Green nominal band & red high band
          ctx.fillStyle = "#268a48";
          ctx.fillRect(48, 10, 128, 7);
          ctx.fillStyle = "#c82820";
          ctx.fillRect(176, 10, 64, 7);
          // Fine graduation ticks
          ctx.strokeStyle = "#141615";
          for (let i = 0; i <= 20; i++) {
            const tx = 16 + (i / 20) * (w - 32);
            const isMaj = i % 5 === 0;
            ctx.lineWidth = isMaj ? 2.5 : 1.2;
            ctx.beginPath();
            ctx.moveTo(tx, 18);
            ctx.lineTo(tx, isMaj ? 36 : 28);
            ctx.stroke();
          }
          ctx.fillStyle = "#141615";
          ctx.font = '900 15px "Consolas", sans-serif';
          ctx.textAlign = "center";
          ctx.fillText("0", 22, 53);
          ctx.fillText("50", w / 2, 53);
          ctx.fillText("100", w - 26, 53);
          // Red vertical pointer needle
          ctx.fillStyle = "#d82218";
          ctx.fillRect(w * 0.62 - 3, 8, 6, h - 16);
        }),
      [],
    );

    const ksp4ChartTex = useMemo(
      () =>
        createCrispPanelTexture(256, 384, (ctx, w, h) => {
          // Cream-white chart paper roll (#f4f1e6)
          ctx.fillStyle = "#f4f1e6";
          ctx.fillRect(0, 0, w, h);
          // Millimeter chart paper grid lines (pale cyan-green & orange-red)
          ctx.strokeStyle = "rgba(56, 136, 128, 0.28)";
          ctx.lineWidth = 1;
          for (let x = 16; x < w; x += 16) {
            ctx.beginPath();
            ctx.moveTo(x, 54);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 56; y < h; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
          // Left & right tractor sprocket holes on paper roll
          ctx.fillStyle = "#262c2a";
          for (let y = 64; y < h; y += 28) {
            ctx.beginPath();
            ctx.arc(8, y, 3, 0, Math.PI * 2);
            ctx.arc(w - 8, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          // Top KSP-4 Scale Header Bar (#ece8d8)
          ctx.fillStyle = "#ece8d8";
          ctx.fillRect(0, 0, w, 54);
          ctx.strokeStyle = "#1e2422";
          ctx.lineWidth = 3;
          ctx.strokeRect(2, 2, w - 4, 50);
          ctx.fillStyle = "#181c1a";
          ctx.font = '900 16px "Consolas", monospace';
          ctx.textAlign = "center";
          ctx.fillText("САМОПИСЕЦ КСП-4", w / 2, 20);
          ctx.fillStyle = "#c82218";
          ctx.fillRect(20, 28, w - 40, 5);
          // Dual ink trace curves (Red channel + Blue channel)
          ctx.strokeStyle = "#d81e18";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          for (let y = 56; y <= h; y += 6) {
            const px =
              w * 0.54 +
              Math.sin(y * 0.045) * 34 +
              Math.cos(y * 0.11) * 14;
            if (y === 56) ctx.moveTo(px, y);
            else ctx.lineTo(px, y);
          }
          ctx.stroke();

          ctx.strokeStyle = "#245898";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let y = 56; y <= h; y += 6) {
            const px =
              w * 0.38 +
              Math.cos(y * 0.038) * 26 +
              Math.sin(y * 0.09) * 10;
            if (y === 56) ctx.moveTo(px, y);
            else ctx.lineTo(px, y);
          }
          ctx.stroke();

          // Red pen carriage pointer at top of chart
          ctx.fillStyle = "#d81e18";
          ctx.beginPath();
          ctx.moveTo(w * 0.58, 54);
          ctx.lineTo(w * 0.58 - 8, 38);
          ctx.lineTo(w * 0.58 + 8, 38);
          ctx.closePath();
          ctx.fill();
        }),
      [],
    );

    const halfW = width / 2;
    const plateW = width - 0.08;
    const subPlateHalfW = (plateW - 0.016) / 2;
    const subPlateX = subPlateHalfW / 2 + 0.004;
    const recorderX = width > 1.8 ? 0.30 : 0.255;
    const recorderW = width > 1.8 ? 0.148 : 0.106;
    const stripMeterBankX = width > 1.8 ? 0.765 : 0.675;
    const stripMeterW = width > 1.8 ? 0.22 : 0.165;

    return (
      <group>
        {/* ================================================================
            TIER 3: TALL UPPER SYNOPTIC WALL (`y: 1.63m -> 2.46m`, `z: 0.0m`)
            Authentic Soviet Light Sage-Grey Frame (`#7e9087`) + Deep Slate-Blue
            Synoptic Board (`#2c4a63`), 2 Glass-Front Paper Strip-Chart Recorders
            (`Самописцы КСП-4`), Synoptic Channel Tags & Forward-Leaning `ТАБЛО` Overhang
           ================================================================ */}
        {/* Deep Structural Steel Back-Cabinet (`#4a5852`) */}
        <mesh position={[0, 1.22, -0.18]} castShadow receiveShadow>
          <boxGeometry args={[width + 0.04, 2.44, 0.34]} />
          <meshStandardMaterial
            color="#4a5852"
            roughness={0.48}
            metalness={0.38}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.006}
            roughnessMap={ironTex.roughnessMap}
          />
        </mesh>

        {/* Upper Cabinet Outer Enamel Frame (`#7e9087` Light Industrial Sage-Grey) */}
        <mesh position={[0, 1.96, -0.004]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.68, 0.036]} />
          <meshStandardMaterial
            color="#7e9087"
            roughness={0.42}
            metalness={0.3}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.004}
          />
        </mesh>

        {/* Upper Synoptic Slate-Blue Faceplates (`#2c4a63` — Iconic Soviet Mnemoscheme Blue) */}
        {[-subPlateX, subPlateX].map((px, idx) => (
          <mesh
            key={`ugp-${idx}`}
            position={[px, 1.94, 0.014]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[subPlateHalfW, 0.60, 0.016]} />
            <meshStandardMaterial
              color="#2c4a63"
              roughness={0.44}
              metalness={0.24}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
        ))}

        {/* Dense Synoptic Channel/Valve Matrix Tags Along Upper Board (`y = 2.015m`) */}
        {Array.from({ length: 12 }).map((_, tIdx) => {
          const tx = -plateW * 0.44 + (tIdx / 11) * (plateW * 0.88);
          const isLit = tIdx % 3 === 0;
          const isWarn = tIdx === 4 || tIdx === 8;
          return (
            <mesh key={`syn-tag-${tIdx}`} position={[tx, 2.015, 0.024]}>
              <boxGeometry args={[0.056, 0.022, 0.005]} />
              <meshStandardMaterial
                color={isWarn ? "#ffe088" : "#f0ece0"}
                emissive={isWarn ? "#ffaa00" : isLit ? "#fff6d6" : "#000000"}
                emissiveIntensity={isWarn ? 0.55 : isLit ? 0.32 : 0}
                roughness={0.32}
              />
            </mesh>
          );
        })}

        {/* 2 Physical 3D Glass-Front Paper Strip-Chart Recorders (`Самописцы КСП-4`)
            Mounted cleanly in the gaps between the 3 circular manometer gauges (`x = ±recorderX, y = 1.78m`) */}
        {[-recorderX, recorderX].map((rx, rIdx) => (
          <group key={`ksp4-${rIdx}`} position={[rx, 1.78, 0.025]}>
            {/* Dark Charcoal Steel KSP-4 Bezel Casing (`#222826`) */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[recorderW, 0.228, 0.022]} />
              <meshStandardMaterial
                color="#222826"
                roughness={0.42}
                metalness={0.55}
              />
            </mesh>
            {/* Cream-White Paper Roll & Dual Red/Blue Ink Trace Curve (`#f4f1e6`) */}
            <mesh position={[0, -0.004, 0.012]}>
              <planeGeometry args={[recorderW - 0.018, 0.198]} />
              <meshStandardMaterial
                map={ksp4ChartTex}
                emissive="#ffffff"
                emissiveMap={ksp4ChartTex}
                emissiveIntensity={0.22}
                roughness={0.55}
              />
            </mesh>
            {/* Cylindrical Paper Roll Drum at Bottom of Recorder Window */}
            <mesh
              position={[0, -0.092, 0.014]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.012, 0.012, recorderW - 0.02, 12]} />
              <meshStandardMaterial color="#f0ede2" roughness={0.5} />
            </mesh>
            {/* Protective Glass Window Front */}
            <mesh position={[0, 0, 0.015]}>
              <planeGeometry args={[recorderW - 0.014, 0.204]} />
              <meshStandardMaterial
                color="#dff4ff"
                transparent
                opacity={0.18}
                roughness={0.12}
                metalness={0.3}
              />
            </mesh>
          </group>
        ))}

        {/* Upper Forward-Leaning `ТАБЛО` Annunciator Canopy Overhang (`#7e9087` Light Sage-Grey) */}
        <group position={[0, 2.305, 0.062]} rotation={[0.18, 0, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[width + 0.02, 0.16, 0.13]} />
            <meshStandardMaterial
              color="#7e9087"
              roughness={0.42}
              metalness={0.32}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.005}
            />
          </mesh>
          {/* Dark Recessed Annunciator Trough */}
          <mesh position={[0, -0.004, 0.06]}>
            <boxGeometry args={[width - 0.07, 0.114, 0.012]} />
            <meshStandardMaterial
              color="#18201e"
              roughness={0.68}
              metalness={0.45}
            />
          </mesh>
          {/* Top & Bottom Brushed Steel Canopy Trim Bars */}
          {[0.07, -0.07].map((cy, cIdx) => (
            <mesh key={`can-trim-${cIdx}`} position={[0, cy, 0.064]} castShadow>
              <boxGeometry args={[width + 0.026, 0.016, 0.018]} />
              <meshStandardMaterial
                color="#4a5852"
                metalness={0.62}
                roughness={0.36}
              />
            </mesh>
          ))}
          {/* 6 Recessed Soviet `ТАБЛО` Illuminated Annunciator Tiles */}
          {annunciatorLabels.map((_, tIdx) => {
            const cellSpacing = (width - 0.16) / 6;
            const cx = -((width - 0.16) / 2) + cellSpacing * (tIdx + 0.5);
            const cellW = cellSpacing - 0.016;
            return (
              <group key={`tablo-${tIdx}`} position={[cx, -0.004, 0.064]}>
                <mesh>
                  <boxGeometry args={[cellW + 0.008, 0.088, 0.008]} />
                  <meshStandardMaterial
                    color="#26302d"
                    metalness={0.68}
                    roughness={0.36}
                  />
                </mesh>
                <mesh position={[0, 0, 0.005]}>
                  <planeGeometry args={[cellW, 0.078]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      tabloMatRefs.current[tIdx] = el;
                    }}
                    map={tabloTextures[tIdx]}
                    emissive="#ffffff"
                    emissiveMap={tabloTextures[tIdx]}
                    emissiveIntensity={0.85}
                    roughness={0.28}
                    metalness={0.12}
                  />
                </mesh>
              </group>
            );
          })}
        </group>

        {/* ================================================================
            TIER 2: ANGLED MID-RISER INSTRUMENT BAY (`y: 1.28m -> 1.63m`)
            Light Sage-Green/Grey Enamel (`#8ea296`) + Recessed CRT Surround
            + Flanking Stacks of Soviet Cream-White Horizontal Strip Meters (`М381 / БИ`)
           ================================================================ */}
        <group position={[0, 1.465, 0.032]} rotation={[-0.08, 0, 0]}>
          {/* Angled Light-Sage/Grey Instrument Riser Housing (`#8ea296`) */}
          <mesh position={[0, 0, -0.018]} castShadow receiveShadow>
            <boxGeometry args={[width, 0.36, 0.044]} />
            <meshStandardMaterial
              color="#8ea296"
              roughness={0.4}
              metalness={0.28}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>
          {/* Recessed Dark 1980s Soviet CRT Monitor Bezel Cavity (`#1c2220`) */}
          <mesh position={[0, 0.0, 0.004]}>
            <boxGeometry args={[1.18, 0.305, 0.012]} />
            <meshStandardMaterial
              color="#1c2220"
              roughness={0.68}
              metalness={0.42}
            />
          </mesh>

          {/* Left & Right Stacks of 4 Soviet Cream-White Horizontal Edge-Wise Strip Meters (`Приборы М381 / БИ`) */}
          {[-stripMeterBankX, stripMeterBankX].map((mx, sideIdx) => (
            <group key={`m381-stack-${sideIdx}`} position={[mx, -0.005, 0.008]}>
              {/* Dark Recessed Mounting Frame behind the 4 Strip Meters */}
              <mesh>
                <boxGeometry args={[stripMeterW + 0.016, 0.276, 0.01]} />
                <meshStandardMaterial color="#2a322f" roughness={0.55} />
              </mesh>
              {[-0.096, -0.032, 0.032, 0.096].map((my, mIdx) => (
                <group key={`m381-${mIdx}`} position={[0, my, 0.008]}>
                  {/* Sculpted Cream-White (`#ece8d8`) Bakelite/Enamel Meter Bezel */}
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[stripMeterW, 0.054, 0.012]} />
                    <meshStandardMaterial
                      color="#ece8d8"
                      roughness={0.34}
                      metalness={0.12}
                    />
                  </mesh>
                  {/* Crisp Horizontal Scale Window with Red Pointer Needle */}
                  <mesh position={[0, 0, 0.0068]}>
                    <planeGeometry args={[stripMeterW - 0.018, 0.038]} />
                    <meshStandardMaterial
                      map={m381ScaleTex}
                      emissive="#ffffff"
                      emissiveMap={m381ScaleTex}
                      emissiveIntensity={0.25}
                      roughness={0.4}
                    />
                  </mesh>
                </group>
              ))}
            </group>
          ))}

          {/* Horizontal Row of Glowing Translucent White/Amber Rectangular Alarm Push-Lamps above Riser (`ДАВЛЕНИЕ БС`, `АЗ-1`, `НАСОСЫ ЦН`) */}
          <group position={[0, 0.162, 0.008]}>
            {Array.from({ length: 8 }).map((_, lIdx) => {
              const lx = -plateW * 0.42 + (lIdx / 7) * (plateW * 0.84);
              const isAmber = lIdx === 1 || lIdx === 4 || lIdx === 6;
              return (
                <group key={`riser-lamp-${lIdx}`} position={[lx, 0, 0]}>
                  <mesh>
                    <boxGeometry args={[0.135, 0.028, 0.01]} />
                    <meshStandardMaterial color="#ece8d8" roughness={0.35} />
                  </mesh>
                  <mesh position={[0, 0, 0.0055]}>
                    <planeGeometry args={[0.122, 0.019]} />
                    <meshStandardMaterial
                      color={isAmber ? "#ffd255" : "#f6f2e4"}
                      emissive={isAmber ? "#ffaa00" : "#fff4d2"}
                      emissiveIntensity={isAmber ? 0.65 : 0.42}
                      roughness={0.28}
                    />
                  </mesh>
                </group>
              );
            })}
          </group>
        </group>

        {/* ================================================================
            TIER 1: LOWER PROTRUDING SLOPED CONTROL DESK (`y: 0.0m -> 1.28m`, `z: 0.0m -> +0.52m`)
            1. Dark Recessed Floor Toe-Kick (`#161b19`)
            2. Heavy Sage-Grey Steel Console Pedestal Base (`#5a6b63`) with Yellow GOST Stencils (`ЦТАИ / 4 / 65А`)
            3. Wide Sloped Operator Desk Surface (`#82988c` Light Soviet Sage-Green/Grey Enamel, tilted at `-23.27°` / `-0.406 rad`)
            4. Brushed Stainless/Chrome Front Armrest Edge Trim (`#c8d2ce`)
            5. Authentic Soviet Backlit Push-Button Clusters (`Кнопки Управления`)
           ================================================================ */}
        {/* 1. Dark Recessed Floor Kick-Plate / Toe-Space (`y: 0.0m -> 0.085m`) */}
        <mesh position={[0, 0.042, 0.12]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.02, 0.085, 0.56]} />
          <meshStandardMaterial
            color="#161b19"
            roughness={0.75}
            metalness={0.35}
          />
        </mesh>

        {/* 2. Heavy Steel Console Pedestal Base (`#5a6b63`) Supporting the Protruding Sloped Desk */}
        <mesh position={[0, 0.19, 0.22]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.21, 0.54]} />
          <meshStandardMaterial
            color="#5a6b63"
            roughness={0.46}
            metalness={0.34}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Wedge Under-Support Body Filling the Space Beneath the Sloped Desk (`y: 0.28m -> 0.88m`) */}
        <mesh position={[0, 0.58, 0.16]} rotation={[-0.406, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.01, 0.92, 0.34]} />
          <meshStandardMaterial
            color="#5a6b63"
            roughness={0.46}
            metalness={0.34}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        {/* Lower Pedestal Cabinet Access Door Seam & Yellow GOST Stencil Plaque (`ЦТАИ / 4 / 65А`) */}
        <mesh position={[0, 0.19, 0.492]}>
          <planeGeometry args={[0.78, 0.145]} />
          <meshStandardMaterial
            map={stencilPlaqueTex}
            roughness={0.48}
            metalness={0.22}
          />
        </mesh>
        {[-plateW * 0.34, plateW * 0.34].map((dx, dIdx) => (
          <group key={`ped-door-${dIdx}`} position={[dx, 0.19, 0.491]}>
            <mesh>
              <boxGeometry args={[0.36, 0.16, 0.006]} />
              <meshStandardMaterial
                color="#52625a"
                roughness={0.45}
                metalness={0.36}
              />
            </mesh>
            {/* Chrome T-Handle Cabinet Latch */}
            <mesh position={[dIdx === 0 ? 0.13 : -0.13, 0, 0.008]} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 0.012, 10]} />
              <meshStandardMaterial
                color="#d0dad6"
                metalness={0.88}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}

        {/* 3. Wide Sloped Operator Desk Surface (`y: 0.28m -> 1.28m`, `z: +0.48m` to `+0.05m`, tilted at `rotationX = -0.406 rad`)
               Painted in Authentic Light Soviet Sage-Green/Grey Enamel (`#82988c`, `roughness: 0.40`, `metalness: 0.28`) */}
        <group position={[0, 0.78, 0.265]} rotation={[-0.406, 0, 0]}>
          {/* Main Sloped Sage-Green Desk Bed (`#82988c`) */}
          <mesh position={[0, 0, -0.018]} castShadow receiveShadow>
            <boxGeometry args={[width, 1.09, 0.036]} />
            <meshStandardMaterial
              color="#82988c"
              roughness={0.4}
              metalness={0.28}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.004}
            />
          </mesh>

          {/* Bolted Modular Sage-Green Sub-Plates on the Sloped Desk (`#8ba195`) */}
          {[-subPlateX, subPlateX].map((px, idx) => (
            <mesh
              key={`desk-sub-${idx}`}
              position={[px, 0.02, 0.002]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[subPlateHalfW, 1.02, 0.008]} />
              <meshStandardMaterial
                color="#8ba195"
                roughness={0.38}
                metalness={0.26}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.003}
              />
            </mesh>
          ))}

          {/* Recessed Dark Shadow Wells behind Switch / Lever Banks on the Sloped Desk */}
          {recessedWells.map((well, wIdx) => {
            // Map vertical y into sloped desk local Y coordinate
            const localY = (well.y - 0.78) * 1.04;
            return (
              <mesh key={`well-${wIdx}`} position={[well.x, localY, 0.005]}>
                <boxGeometry args={[well.w, well.h, 0.008]} />
                <meshStandardMaterial
                  color="#1e2623"
                  roughness={0.68}
                  metalness={0.35}
                />
              </mesh>
            );
          })}

          {/* Authentic Soviet Backlit Push-Button Clusters (`Кнопки Управления БЩУ`)
              Omitted on A2 & B so the 3 main interactive control assemblies fill the entire sloped desk! */}
          {(unitCode === "A2" || unitCode === "B"
            ? ([] as number[])
            : [-plateW * 0.41, plateW * 0.41]
          ).map((clusterX, cIdx) => {
            const clusterY =
              unitCode === "A2" || unitCode === "B" ? -0.39 : 0.46;
            const cols = unitCode === "A2" || unitCode === "B" ? 6 : 4;
            const clusterW = cols * 0.044 + 0.036;
            return (
              <group
                key={`btn-cluster-${cIdx}`}
                position={[clusterX, clusterY, 0.006]}
              >
                {/* Recessed Dark Steel Switch Matrix Sub-Plate (`#222a27`) */}
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[clusterW, 0.096, 0.01]} />
                  <meshStandardMaterial
                    color="#222a27"
                    roughness={0.48}
                    metalness={0.52}
                  />
                </mesh>
                {/* Cream-White Legend Strip above Keys */}
                <mesh position={[0, 0.034, 0.006]}>
                  <boxGeometry args={[clusterW - 0.016, 0.014, 0.004]} />
                  <meshStandardMaterial color="#ece8d8" roughness={0.35} />
                </mesh>
                {/* 2 Rows of Translucent Backlit Soviet Square Keys */}
                {[-0.018, 0.008].map((ry, rIdx) =>
                  Array.from({ length: cols }).map((_, kIdx) => {
                    const kx =
                      -((cols - 1) * 0.044) / 2 + kIdx * 0.044;
                    const keyTone =
                      (kIdx + rIdx + cIdx) % 5 === 0
                        ? "#d84838"
                        : (kIdx + rIdx) % 3 === 0
                          ? "#ffcc44"
                          : (kIdx + cIdx) % 4 === 0
                            ? "#55bbaa"
                            : "#f4f0e0";
                    return (
                      <group key={`key-${rIdx}-${kIdx}`} position={[kx, ry, 0.006]}>
                        {/* Dark Bezel Collar */}
                        <mesh>
                          <boxGeometry args={[0.036, 0.022, 0.006]} />
                          <meshStandardMaterial color="#161a18" roughness={0.6} />
                        </mesh>
                        {/* Glowing Translucent Soviet Push-Button Cap */}
                        <mesh position={[0, 0, 0.006]} castShadow>
                          <boxGeometry args={[0.029, 0.017, 0.01]} />
                          <meshStandardMaterial
                            color={keyTone}
                            emissive={keyTone}
                            emissiveIntensity={0.48}
                            roughness={0.26}
                            metalness={0.08}
                          />
                        </mesh>
                      </group>
                    );
                  }),
                )}
              </group>
            );
          })}

          {/* 4. Brushed Stainless/Chrome Front Armrest Edge Trim (`#c8d2ce`) Along the Front Lip of the Sloped Desk */}
          <group position={[0, -0.535, 0.008]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width + 0.03, 0.038, 0.044]} />
              <meshStandardMaterial
                color="#5a6b63"
                roughness={0.42}
                metalness={0.45}
              />
            </mesh>
            <mesh
              position={[0, -0.012, 0.022]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.016, 0.016, width + 0.036, 14]} />
              <meshStandardMaterial
                color="#c8d2ce"
                metalness={0.86}
                roughness={0.2}
              />
            </mesh>
          </group>
        </group>

        {/* ================================================================
            L-SHAPED STEPPED STEEL SIDE CHEEKS & MOLDED TRANSITION TRIM
            (Suppressed on inner connected sides so `UNIT B + UNIT A-2 + UNIT A`
             flow as ONE unbroken horseshoe console!)
           ================================================================ */}
        {[-halfW - 0.012, halfW + 0.012]
          .filter((sx) => (sx < 0 ? !openLeftSide : !openRightSide))
          .map((sx, sIdx) => (
            <group key={`cheek-${sIdx}`}>
              {/* Upper Synoptic Wall Side Cheek (`#687a71`) */}
              <mesh position={[sx, 1.84, -0.04]} castShadow receiveShadow>
                <boxGeometry args={[0.042, 1.16, 0.18]} />
                <meshStandardMaterial
                  color="#687a71"
                  metalness={0.38}
                  roughness={0.42}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {/* Sloped Desk Side Cheek Wing (`#687a71` with `#c8d2ce` top trim) */}
              <mesh
                position={[sx, 0.78, 0.23]}
                rotation={[-0.406, 0, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[0.044, 1.10, 0.14]} />
                <meshStandardMaterial
                  color="#687a71"
                  metalness={0.38}
                  roughness={0.42}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.005}
                />
              </mesh>
              {/* Lower Pedestal Side Cheek (`#4d5c55`) */}
              <mesh position={[sx, 0.24, 0.21]} castShadow receiveShadow>
                <boxGeometry args={[0.046, 0.48, 0.54]} />
                <meshStandardMaterial
                  color="#4d5c55"
                  metalness={0.42}
                  roughness={0.46}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              {/* Brass Side Cheek Hex Bolts */}
              {[0.28, 0.68, 1.08, 1.48, 1.88, 2.18].map((by, bIdx) => (
                <mesh
                  key={`sbolt-${bIdx}`}
                  position={[
                    sx,
                    by,
                    by < 1.28 ? 0.06 + (1.28 - by) * 0.42 : 0.044,
                  ]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.0085, 0.0085, 0.012, 6]} />
                  <meshStandardMaterial
                    color="#b8a46b"
                    metalness={0.85}
                    roughness={0.28}
                    bumpMap={brassTex.bumpMap}
                    bumpScale={0.004}
                  />
                </mesh>
              ))}
            </group>
          ))}

        {/* Brushed Steel Horizontal Transition Trim Between Upper Synoptic Wall & Mid-Riser (`y = 1.638m`)
            and Between Mid-Riser & Sloped Control Desk (`y = 1.285m`) */}
        {[
          { y: 1.638, z: 0.028 },
          { y: dividerY, z: 0.056 },
        ].map((trim, tIdx) => (
          <group key={`h-trim-${tIdx}`} position={[0, trim.y, trim.z]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[width + 0.03, 0.02, 0.028]} />
              <meshStandardMaterial
                color="#5a6b63"
                metalness={0.52}
                roughness={0.36}
              />
            </mesh>
            <mesh position={[0, 0.006, 0.012]}>
              <boxGeometry args={[width + 0.02, 0.006, 0.008]} />
              <meshStandardMaterial
                color="#c8d2ce"
                metalness={0.85}
                roughness={0.22}
              />
            </mesh>
          </group>
        ))}

        {/* PHYSICAL 3D SYNOPTIC PROCESS FLOW LINES (`МНЕМОСХЕМА`)
            Upper segments sit flush on the `#2c4a63` synoptic wall (`z = 0.024m`),
            while lower segments (`y < 1.28m`) follow the exact `-23.27°` slope of the `#82988c` desk! */}
        <group>
          {mimicSegments.map((seg, idx) => {
            const isSloped = seg.y < 1.28;
            const segZ =
              seg.z ??
              (isSloped ? 0.052 + (1.28 - seg.y) * 0.43 : 0.0245);
            const segRotX = isSloped ? -0.406 : 0;
            return (
              <group
                key={`mimic-seg-${idx}`}
                position={[seg.x, seg.y, segZ]}
                rotation={[segRotX, 0, 0]}
              >
                <mesh>
                  <boxGeometry args={[seg.w + 0.005, seg.h + 0.005, 0.0025]} />
                  <meshStandardMaterial
                    color="#16222c"
                    roughness={0.65}
                    metalness={0.35}
                  />
                </mesh>
                <mesh position={[0, 0, 0.0018]}>
                  <boxGeometry args={[seg.w, seg.h, 0.0035]} />
                  <meshStandardMaterial
                    color={seg.color}
                    emissive={seg.color}
                    emissiveIntensity={0.2}
                    roughness={0.34}
                    metalness={0.3}
                  />
                </mesh>
              </group>
            );
          })}
          {mimicNodes.map((node, nIdx) => {
            const isSloped = node.y < 1.28;
            const nodeZ =
              node.z ??
              (isSloped ? 0.054 + (1.28 - node.y) * 0.43 : 0.026);
            const nodeRotX = isSloped ? Math.PI / 2 - 0.406 : Math.PI / 2;
            return (
              <mesh
                key={`mimic-node-${nIdx}`}
                position={[node.x, node.y, nodeZ]}
                rotation={[nodeRotX, 0, 0]}
              >
                <cylinderGeometry args={[0.012, 0.014, 0.005, 8]} />
                <meshStandardMaterial
                  color={node.color}
                  emissive={node.color}
                  emissiveIntensity={0.24}
                  roughness={0.32}
                  metalness={0.4}
                />
              </mesh>
            );
          })}
        </group>
      </group>
    );
  },
);

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
  nominalMark?: number;
  synchroscopeMode?: boolean;
  getValue: () => number;
  secondaryGetValue?: () => number;
}

export const HighDetailManometer3D: React.FC<HighDetailManometer3DProps> = ({
  position,
  title,
  min,
  max,
  dangerThreshold,
  lowDangerThreshold,
  centerNominal = false,
  nominalMark,
  synchroscopeMode = false,
  getValue,
  secondaryGetValue,
}) => {
  const needleGroupRef = useRef<THREE.Group>(null);
  const secondaryNeedleRef = useRef<THREE.Group>(null);
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

      if (synchroscopeMode) {
        // 360-degree Synchroscope Dial: Green Sync Window at 12 o'clock (-25° to +25°)
        ctx.strokeStyle = "#1d7a36";
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          198,
          -Math.PI / 2 - (25 * Math.PI) / 180,
          -Math.PI / 2 + (25 * Math.PI) / 180,
        );
        ctx.stroke();

        for (let deg = 0; deg < 360; deg += 10) {
          const ang = -Math.PI / 2 + (deg * Math.PI) / 180;
          const isMajor = deg % 30 === 0;
          const innerR = isMajor ? 160 : 180;
          const outerR = 212;
          const inSync = deg <= 25 || deg >= 335;
          ctx.strokeStyle = inSync ? "#1d7a36" : "#0a0a0a";
          ctx.lineWidth = isMajor ? 5.5 : 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
          ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
          ctx.stroke();
        }
        ctx.save();
        ctx.fillStyle = "#1d7a36";
        ctx.font = '900 32px "Segoe UI Black", "Arial Black", "Consolas", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("0° SYNC", cx, cy - 122);
        ctx.fillStyle = "#0a0a0a";
        ctx.font = '900 26px "Segoe UI Black", "Arial Black", "Consolas", sans-serif';
        ctx.fillText("-90°", cx - 126, cy);
        ctx.fillText("+90°", cx + 126, cy);
        ctx.restore();
      } else {
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
        } else if (typeof nominalMark === "number") {
          const nomRatio = THREE.MathUtils.clamp(
            (nominalMark - min) / (max - min),
            0.05,
            0.95,
          );
          ctx.strokeStyle = "#1d7a36";
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            198,
            Math.PI * 0.75 + Math.max(0, nomRatio - 0.06) * Math.PI * 1.5,
            Math.PI * 0.75 + Math.min(1, nomRatio + 0.06) * Math.PI * 1.5,
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

          if (isMajor && i % 10 === 0 && i > 0 && i < 50) {
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
      }

      // Bottom Dead-Zone Wedge (100% clean — no bottom range numbers colliding with the bold gauge title!):
      drawFittedPlaqueText(
        ctx,
        title,
        cx,
        cy + 142,
        204,
        '900 50px "Segoe UI Black", "Arial Black", "Impact", "Consolas", sans-serif',
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
    nominalMark,
    synchroscopeMode,
    title,
  ]);

  useFrame(({ clock }) => {
    const rawVal = getValue();
    const state = useGameStore.getState();
    const t = clock.getElapsedTime();

    if (synchroscopeMode) {
      if (needleGroupRef.current) {
        needleGroupRef.current.rotation.z = -(rawVal * Math.PI) / 180;
      }
      if (warningLampRef.current) {
        const inSync =
          Math.abs(rawVal) <= 25 &&
          Math.abs((state.turbines[0]?.rpm ?? 0) - 3000) <= 60;
        if (state.turbines[0]?.tripped) {
          warningLampRef.current.color.set("#ff2a2a");
          warningLampRef.current.emissive.set("#ff2a2a");
          warningLampRef.current.emissiveIntensity = 2.0;
        } else if (inSync || state.turbines[0]?.gridConnected) {
          warningLampRef.current.color.set("#33ff66");
          warningLampRef.current.emissive.set("#33ff66");
          warningLampRef.current.emissiveIntensity = 1.4;
        } else {
          warningLampRef.current.color.set("#ffb000");
          warningLampRef.current.emissive.set("#ffb000");
          warningLampRef.current.emissiveIntensity = 1.1;
        }
      }
      return;
    }

    const ratio = THREE.MathUtils.clamp((rawVal - min) / (max - min), 0, 1);
    const isOver80Pct = !centerNominal && ratio >= 0.85;
    const isLow20Pct =
      !centerNominal &&
      typeof lowDangerThreshold === "number" &&
      ratio <= 0.15;
    const isDanger =
      rawVal >= dangerThreshold ||
      (typeof lowDangerThreshold === "number" &&
        rawVal <= lowDangerThreshold) ||
      isOver80Pct ||
      isLow20Pct;
    const isWarn =
      !isDanger &&
      !centerNominal &&
      (ratio >= 0.72 ||
        (typeof lowDangerThreshold === "number" && ratio <= 0.25));

    const jitter =
      Math.sin(t * 18 + position[0] * 5) * (isDanger ? 0.025 : 0.004);

    const targetRotZ = 2.35 - ratio * 4.7 + jitter;
    if (needleGroupRef.current) {
      needleGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        needleGroupRef.current.rotation.z,
        targetRotZ,
        0.18,
      );
    }

    if (secondaryNeedleRef.current && secondaryGetValue) {
      const secVal = secondaryGetValue();
      const secRatio = THREE.MathUtils.clamp((secVal - min) / (max - min), 0, 1);
      const secRotZ = 2.35 - secRatio * 4.7;
      secondaryNeedleRef.current.rotation.z = THREE.MathUtils.lerp(
        secondaryNeedleRef.current.rotation.z,
        secRotZ,
        0.18,
      );
    }

    if (warningLampRef.current) {
      if (isDanger) {
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
      {secondaryGetValue && (
        <group ref={secondaryNeedleRef} position={[0, 0, 0.0475]}>
          <mesh position={[0, 0.052, 0]} castShadow>
            <boxGeometry args={[0.0075, 0.115, 0.004]} />
            <meshStandardMaterial
              color="#ffb000"
              emissive="#ffb000"
              emissiveIntensity={0.65}
              roughness={0.3}
            />
          </mesh>
        </group>
      )}
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
      const targetAngleX = -0.52 + ratio * 0.96;
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
      <group position={[0.005, -0.176, 0.038]}>
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
        position={[-0.072, -0.012, 0.038]}
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
        position={[0.088, -0.012, 0.036]}
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

  const maxSectorMW = 250;

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
        ctx.fillText("-25", w / 2, 39);
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
        ctx.fillText("+25", w / 2, 39);
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
        const marks = ["250", "200", "150", "100", "50", "0"];
        marks.forEach((m, idx) => {
          const y = 24 + idx * 46;
          ctx.fillStyle = idx === 0 ? "#ff4433" : "#e6dec3";
          ctx.font = 'bold 22px "VT323", monospace';
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
    [maxSectorMW],
  );

  useFrame(({ clock }) => {
    const state = useGameStore.getState();
    const currentMW = state.sectorMW[sector];
    const targetMW = state.targetSectorMW[sector];
    const highlightTut =
      state.tutorialPhase === "STEP_6_BASELINE_600MW" && currentMW !== targetMW;
    if (handleRingMatRef.current) {
      if (highlightTut) {
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
    // Map 0..maxSectorMW across 10 physical 3D ribbed phosphor glass cell segments
    const activeBlocks = Math.round((currentMW / maxSectorMW) * 10);
    const sig = `${activeBlocks}`;

    if (sig !== lastBlockStateRef.current) {
      lastBlockStateRef.current = sig;
      for (let i = 0; i < 10; i++) {
        const mat = blockMatRefs.current[i];
        if (!mat) continue;
        const isLit = i < activeBlocks;
        const colorHex = i >= 9 ? "#28b862" : i >= 7 ? "#ffb000" : ledColor;
        mat.color.set(isLit ? colorHex : "#141916");
        mat.emissive.set(isLit ? colorHex : "#000000");
        mat.emissiveIntensity = isLit ? 1.15 : 0;
      }
    }

    const readoutSig = `${currentMW}|${targetMW}|${highlightTut}`;
    const tex = readoutMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (tex && readoutSig !== lastReadoutSigRef.current) {
      lastReadoutSigRef.current = readoutSig;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const w = canvas.width;
        const h = canvas.height;
        const isMatched = currentMW === targetMW;
        const isClose = Math.abs(currentMW - targetMW) <= 25;
        const primaryColor = highlightTut
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

        ctx.strokeStyle = highlightTut
          ? "#ffb000"
          : isMatched
            ? "#28b862"
            : "#ff6b2a";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);

        // Giant Full-Box Nixie / Phosphor Readout: "200 / 200 MW"
        drawFittedPlaqueText(
          ctx,
          `${currentMW} / ${targetMW} MW`,
          w / 2,
          68,
          w + 6,
          '900 76px "VT323", monospace',
          primaryColor,
          "#001a00",
          3.2,
          "1.5px",
        );

        tex.needsUpdate = true;
      }
      if (readoutMatRef.current) {
        readoutMatRef.current.emissiveIntensity =
          currentMW === targetMW ? 0.95 : 1.25;
      }
    }

    if (leverGroupRef.current) {
      const ratio = THREE.MathUtils.clamp(currentMW / maxSectorMW, 0, 1);
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
    if (state.komradOverrideLocked) {
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
      if (s.komradOverrideLocked) {
        dragRef.current.active = false;
        return;
      }
      totalMovement = Math.max(
        totalMovement,
        Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY),
      );
      const deltaY = dragRef.current.startClientY - ev.clientY;
      const rawTargetMW =
        dragRef.current.startMW + (deltaY / 72) * maxSectorMW;
      const snappedMW = THREE.MathUtils.clamp(
        Math.round(rawTargetMW / 25) * 25,
        0,
        maxSectorMW,
      );
      if (snappedMW !== s.sectorMW[sector]) {
        playDetentClick(Math.round(snappedMW / 25));
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
        const nextMW = cur >= maxSectorMW ? 0 : cur + 25;
        playDetentClick(Math.round(nextMW / 25));
        s.setSectorPower(sector, nextMW);
      }
      playSwitchClank(false);
    };

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowUp);
  };

  const handleWheel = (e: ThreeEvent<WheelEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    e.nativeEvent?.stopImmediatePropagation?.();
    const s = useGameStore.getState();
    const stepMW = e.deltaY < 0 ? 25 : -25;
    const nextMW = Math.max(0, Math.min(250, s.sectorMW[sector] + stepMW));
    if (nextMW !== s.sectorMW[sector]) {
      playDetentClick(Math.round(nextMW / 25));
      s.setSectorPower(sector, nextMW);
    }
  };

  return (
    <group
      position={position}
      scale={[0.74, 0.94, 0.92]}
      onWheel={handleWheel}
      onPointerOver={() => {
        useGameStore
          .getState()
          .setHoveredControlHint(
            `[SCROLL WHEEL]: ADJUST ${label} (±25 MW) | [DRAG / CLICK]: SET MW (0–250 MW)`,
          );
      }}
      onPointerOut={() => {
        useGameStore.getState().setHoveredControlHint(null);
      }}
    >
      {/* Full-Column Invisible Scroll Hit-Box so hovering anywhere on the column and scrolling works */}
      <mesh position={[0, 0.04, 0.04]}>
        <boxGeometry args={[0.35, 0.56, 0.12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
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

      {/* Labeled -50 / -25 / +25 / +50 MW Quick-Step Plungers */}
      <group
        position={[-0.108, -0.208, 0.038]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGameStore.getState();
          if (s.komradOverrideLocked) {
            playLeverRatchet(0.4);
            return;
          }
          playLeverRatchet(0.85);
          s.shiftSectorPower(sector, -50);
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
          if (s.komradOverrideLocked) {
            playLeverRatchet(0.4);
            return;
          }
          playDetentClick(Math.max(0, Math.round((s.sectorMW[sector] - 25) / 25)));
          s.shiftSectorPower(sector, -25);
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
          if (s.komradOverrideLocked) {
            playLeverRatchet(0.4);
            return;
          }
          playDetentClick(Math.min(10, Math.round((s.sectorMW[sector] + 25) / 25)));
          s.shiftSectorPower(sector, 25);
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
          if (s.komradOverrideLocked) {
            playLeverRatchet(0.4);
            return;
          }
          playLeverRatchet(1.1);
          s.shiftSectorPower(sector, 50);
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
        "REACTOR SAFETY & 1000 MWe ROUTING // UNIT A",
        "CORE TEMP • DRUM BAR • 1000 MWe DISTRIBUTION",
        {
          width: 768,
          height: 112,
          titleSize: 30,
          subSize: 22,
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
        ctx.fillText("-50", w / 2, 45);
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
        ctx.fillText("+50", w / 2, 45);
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
      const isRedline =
        s.coreTemp >= 380 ||
        s.drumPressure >= 80 ||
        s.voidFraction >= 0.45;
      updateSoundtrackState(isRedline, s.isMusicMuted);

      const clickProb = Math.min(0.95, 0.14 + (s.roomRadiation / 12) * 0.8);
      if (Math.random() < clickProb) {
        playGeigerClick();
      }
    }, 280);
    return () => window.clearInterval(timer);
  }, []);

  useFrame(({ clock }, delta) => {
    const state = useGameStore.getState();
    state.tickThermodynamics(delta);

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
      const ready = !state.az5Active;
      boronLampMatRef.current.color.set(ready ? "#33ff66" : "#ff2a2a");
      boronLampMatRef.current.emissive.set(ready ? "#33ff66" : "#ff2a2a");
      boronLampMatRef.current.emissiveIntensity = ready ? 1.4 : 1.8;
    }

    const totalSuppliedMW =
      state.sectorMW.pripyat +
      state.sectorMW.kolkhoz +
      state.sectorMW.duga +
      state.sectorMW.kgb +
      state.sectorMW.vodka +
      state.sectorMW.steel;
    const activeTotalBlocks = Math.round((totalSuppliedMW / 1000) * 18);
    const totalBlocksSig = `${activeTotalBlocks}`;
    if (totalBlocksSig !== lastTotalBlocksSigRef.current) {
      lastTotalBlocksSigRef.current = totalBlocksSig;
      for (let i = 0; i < 18; i++) {
        const mat = redlineScaleBlockRefs.current[i];
        if (!mat) continue;
        const isLit = i < activeTotalBlocks;
        const isHighBlock = i >= 16;
        const hex = isHighBlock ? "#28b862" : i >= 12 ? "#d98218" : "#28b862";
        mat.color.set(isLit ? hex : "#141916");
        mat.emissive.set(isLit ? hex : "#000000");
        mat.emissiveIntensity = isLit ? 1.15 : 0;
      }
    }

    const now = clock.getElapsedTime();
    if (now - lastStatusDrawRef.current < 0.08) return;

    const all6Matched =
      state.sectorMW.pripyat === state.targetSectorMW.pripyat &&
      state.sectorMW.kolkhoz === state.targetSectorMW.kolkhoz &&
      state.sectorMW.duga === state.targetSectorMW.duga &&
      state.sectorMW.kgb === state.targetSectorMW.kgb &&
      state.sectorMW.vodka === state.targetSectorMW.vodka &&
      state.sectorMW.steel === state.targetSectorMW.steel;

    const totalTargetMW =
      state.targetSectorMW.pripyat +
      state.targetSectorMW.kolkhoz +
      state.targetSectorMW.duga +
      state.targetSectorMW.kgb +
      state.targetSectorMW.vodka +
      state.targetSectorMW.steel;
    const hasGenDeficit = totalSuppliedMW > state.totalElectricalMW + 15;

    const mandateText = state.az5Active
      ? `● AZ-5 SCRAM ACTIVE (TIMER: ${state.az5Timer.toFixed(1)}S)`
      : hasGenDeficit
        ? `⚠️ GENERATION DEFICIT: RAISE RODS (A-2) + TURBINE VALVE (C) TO GENERATE ${totalSuppliedMW} MWe!`
        : all6Matched
          ? `● ALL 6 SECTORS BALANCED AT ${totalSuppliedMW} / ${Math.round(state.totalElectricalMW)} MWe`
          : `● ALLOCATED: ${totalSuppliedMW} / ${totalTargetMW} MWe (GEN: ${Math.round(state.totalElectricalMW)} MWe)`;
    const sig = `${Math.round(state.coreTemp)}|${Math.round(state.drumPressure)}|${state.roomRadiation.toFixed(1)}|${Math.round(state.totalElectricalMW)}|${Math.round(state.voidFraction * 100)}|${totalSuppliedMW}|${all6Matched}|${state.az5Active}|${mandateText}`;
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
              danger: state.coreTemp >= 420,
            },
            {
              label: "DRUM BAR",
              val: `${Math.round(state.drumPressure)} BAR`,
              danger: state.drumPressure >= 80,
            },
            {
              label: "RADIATION",
              val: `${state.roomRadiation.toFixed(1)} R/H`,
              danger: state.roomRadiation >= 7.5,
            },
          ],
          statusLine: `CORE TEMP: ${Math.round(state.coreTemp)} °C | DRUM: ${Math.round(state.drumPressure)} BAR | GEN: ${Math.round(state.totalElectricalMW)} MWe | DEMAND: ${totalSuppliedMW} MWe`,
          statusDanger:
            hasGenDeficit ||
            state.coreTemp >= 350 ||
            state.drumPressure >= 80 ||
            state.voidFraction >= 0.4,
          footerLine: mandateText.slice(0, 62),
          isBlackout: false,
        });
        tex.needsUpdate = true;
      }
    }
  });

  const unitAMimicSegments = useMemo<readonly MimicSegmentSpec[]>(
    () => [
      // Left Cyan Cooling Water Loop riser from COOLING PUMP A (x=-0.60, y=1.065) around CRT left flank (x=-0.84) up to CORE TEMP & LOOP BAR gauges (y=1.785)
      { x: -0.72, y: 1.065, w: 0.24, h: 0.015, color: "#388898" },
      { x: -0.84, y: 1.425, w: 0.016, h: 0.735, color: "#388898" },
      { x: -0.72, y: 1.785, w: 0.24, h: 0.015, color: "#388898" },
      // Horizontal Cyan Header connecting CORE TEMP (x=-0.60) and LOOP BAR (x=0.0)
      { x: -0.30, y: 1.785, w: 0.60, h: 0.015, color: "#388898" },
      // Vertical Cyan Riser between COOLING PUMP B (x=0.0) and CRT / Gauges
      { x: -0.30, y: 1.065, w: 0.60, h: 0.015, color: "#388898" },
      // Right Oxide-Red Emergency Scram / Steam Line from AZ-5 (x=+0.60, y=1.065) around CRT right flank (x=+0.84) up to LOOP BAR & RADIATION gauges (y=1.785)
      { x: 0.72, y: 1.065, w: 0.24, h: 0.015, color: "#a83830" },
      { x: 0.84, y: 1.425, w: 0.016, h: 0.735, color: "#a83830" },
      { x: 0.72, y: 1.785, w: 0.24, h: 0.015, color: "#a83830" },
      { x: 0.30, y: 1.785, w: 0.60, h: 0.015, color: "#a83830" },
      // Main Yellow 100MW Generator Busbar running horizontally at y=0.818 above the 6 Regional Substation Levers
      { x: 0, y: 0.818, w: 1.54, h: 0.016, color: "#c8a838" },
      // Vertical Busbar Feeders from Upper Reactor Loop down into the 6 Sector Lever Bays
      { x: -0.84, y: 0.94, w: 0.015, h: 0.25, color: "#c8a838" },
      { x: 0.84, y: 0.94, w: 0.015, h: 0.25, color: "#c8a838" },
      { x: -0.7125, y: 0.79, w: 0.014, h: 0.055, color: "#c8a838" },
      { x: -0.4275, y: 0.79, w: 0.014, h: 0.055, color: "#c8a838" },
      { x: -0.1425, y: 0.79, w: 0.014, h: 0.055, color: "#c8a838" },
      { x: 0.1425, y: 0.79, w: 0.014, h: 0.055, color: "#c8a838" },
      { x: 0.4275, y: 0.79, w: 0.014, h: 0.055, color: "#c8a838" },
      { x: 0.7125, y: 0.79, w: 0.014, h: 0.055, color: "#c8a838" },
    ],
    [],
  );

  const unitAMimicNodes = useMemo<readonly MimicNodeSpec[]>(
    () => [
      { x: -0.84, y: 1.785, color: "#388898" },
      { x: -0.84, y: 1.065, color: "#388898" },
      { x: -0.30, y: 1.785, color: "#388898" },
      { x: 0.30, y: 1.785, color: "#a83830" },
      { x: 0.84, y: 1.785, color: "#a83830" },
      { x: 0.84, y: 1.065, color: "#a83830" },
      { x: -0.7125, y: 0.818, color: "#c8a838" },
      { x: -0.4275, y: 0.818, color: "#c8a838" },
      { x: -0.1425, y: 0.818, color: "#c8a838" },
      { x: 0.1425, y: 0.818, color: "#c8a838" },
      { x: 0.4275, y: 0.818, color: "#c8a838" },
      { x: 0.7125, y: 0.818, color: "#c8a838" },
    ],
    [],
  );

  const unitARecessedWells = useMemo(
    () => [
      // Recessed dark instrument well behind the 6 MW Sector Lever Bays
      { x: 0, y: 0.50, w: 1.76, h: 0.52 },
    ],
    [],
  );

  return (
    <group
      ref={panelGroupRef}
      position={[-2.15, 0, -1.08]}
      rotation={[0, 0.42, 0]}
    >
      {/* 1. Authentic Layered Soviet RBMK Blue-Grey / Olive-Grey Modular Steel Cabinet (`#485450`),
             Upper Canopy Overhang with 6 `ТАБЛО` Annunciator Lamps, Console Ledge & Synoptic Mimic Lines */}
      <SovietModularSteelCabinet3D
        width={1.98}
        unitCode="A"
        annunciatorLabels={[
          "КОНТУР А",
          "НАСОСЫ ГЦН",
          "Т° ЯДРА >350",
          "БАРАБАН >80",
          "СЕТЬ 1000 МВТ",
          "АЗ-5 ГОТОВ",
        ]}
        mimicSegments={unitAMimicSegments}
        mimicNodes={unitAMimicNodes}
        recessedWells={unitARecessedWells}
        dividerY={1.318}
        lowerLedgeY={0.818}
        openLeftSide={true}
        openRightSide={false}
      />

      {/* Top Raised Engraved Brass Header Plaque (Centered cleanly inside frame with generous top margin) */}
      <mesh position={[0, 2.13, 0.044]}>
        <planeGeometry args={[1.64, 0.148]} />
        <meshStandardMaterial
          map={topHeaderPlateTex}
          emissive="#ffffff"
          emissiveMap={topHeaderPlateTex}
          emissiveIntensity={0.35}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Outer Right Corner Gusset Plates & Overhead Hooded Panel Work-Lights */}
      {(
        [
          [0.93, 2.32],
          [0.93, 0.14],
        ] as const
      ).map(([gx, gy], gIdx) => (
        <group key={gIdx} position={[gx, gy, 0.032]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.14, 0.14, 0.016]} />
            <meshStandardMaterial
              color="#1e2422"
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
      {[-0.58, 0.58].map((lx, lIdx) => (
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
      <group position={[0, 1.785, 0.03]}>
        <HighDetailManometer3D
          position={[-0.60, 0, 0]}
          title="CORE TEMP"
          cyrillicSub="°С АКТИВНОЙ ЗОНЫ"
          unit="0-600 °C"
          serial="№ 84-Т1"
          min={0}
          max={600}
          nominalMark={284}
          dangerThreshold={420}
          getValue={() => useGameStore.getState().coreTemp}
        />
        <HighDetailManometer3D
          position={[0, 0, 0]}
          title="DRUM BAR"
          cyrillicSub="БАРАБАН-СЕПАРАТОР"
          unit="0-100 BAR"
          serial="№ 84-П2"
          min={0}
          max={100}
          nominalMark={70}
          dangerThreshold={80}
          getValue={() => useGameStore.getState().drumPressure}
        />
        <HighDetailManometer3D
          position={[0.60, 0, 0]}
          title="RADIATION"
          cyrillicSub="ДОЗИМЕТР Р/Ч"
          unit="0-15 R/H"
          serial="№ 84-Д3"
          min={0}
          max={15}
          dangerThreshold={7.5}
          getValue={() => useGameStore.getState().roomRadiation}
        />
      </group>

      {/* 3. Molded Phosphor-Green CRT Monitor Bay (`ЭЛТ ВЛ-84А`) on Angled Tier-2 Riser */}
      <group position={[0, 1.468, 0.04]} rotation={[-0.08, 0, 0]}>
        <SovietCRTMonitorBay3D
          position={[0, 0, 0]}
          screenMatRef={statusMatRef}
          screenTexture={statusTexture}
          modelBadge="ЭЛТ ВЛ-84А"
        />
      </group>

      {/* 4. Upper Sloped Desk Row: 2 Sculpted Cast-Iron Pump Valves + Multi-Part Hinged AZ-5 Safety Cage */}
      <group position={[0, 1.055, 0.156]} rotation={[-0.406, 0, 0]}>
        <SculptedPumpValveAssembly3D
          position={[-0.60, 0, 0]}
          pumpIndex={0}
          label="COOLING PUMP A"
          subLabel="ГЦН 1-2 (NORTH LOOP)"
        />
        <SculptedPumpValveAssembly3D
          position={[0, 0, 0]}
          pumpIndex={1}
          label="COOLING PUMP B"
          subLabel="ГЦН 3-4 (SOUTH LOOP)"
        />

        {/* Multi-Part AZ-5 Emergency Scram Assembly */}
        <group position={[0.60, 0, 0.02]}>
          {/* Raised Brass & Crimson Nameplate (+25% larger, lowered slightly so it sits cleanly below CRT bay) */}
          <mesh position={[0, 0.172, 0.016]} castShadow>
            <boxGeometry args={[0.375, 0.098, 0.012]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.172, 0.023]}>
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
              playSwitchClank(true);
              playKlaxonBurst();
              s.triggerAz5();
              playSafetyCoverFlip(false);
              setAz5CoverOpen(false);
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

      {/* 5. Lower Sloped Desk Row: 6-Lever Regional Substation Bank (0–50 MW each) + 18-Segment Redline Bar */}
      <group position={[0, 0.535, 0.382]} rotation={[-0.406, 0, 0]}>
        <IndustrialPowerColumn3D
          position={[-0.7125, 0.02, 0]}
          sector="pripyat"
          label="1. PRIPYAT CITY"
          subLabel="ПРИПЯТЬ"
          accentColor="#28b862"
          ledColor="#28b862"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[-0.4275, 0.02, 0]}
          sector="duga"
          label="2. DUGA-1 RADAR"
          subLabel="ДУГА-1"
          accentColor="#d99b26"
          ledColor="#d99b26"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[-0.1425, 0.02, 0]}
          sector="kolkhoz"
          label="3. KOLKHOZ FARM"
          subLabel="СОВХОЗ"
          accentColor="#28b862"
          ledColor="#28b862"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.1425, 0.02, 0]}
          sector="kgb"
          label="4. KGB BUNKER 07"
          subLabel="КГБ-07"
          accentColor="#d99b26"
          ledColor="#d99b26"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.4275, 0.02, 0]}
          sector="vodka"
          label="5. VODKA PLANT"
          subLabel="ВОДКА"
          accentColor="#2ad4c8"
          ledColor="#2ad4c8"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.7125, 0.02, 0]}
          sector="steel"
          label="6. STEEL WORKS"
          subLabel="СТАЛЬ"
          accentColor="#2ad4c8"
          ledColor="#2ad4c8"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />

        {/* 18-Segment Recessed Ribbed Phosphor Glass Total MW & Redline Bar */}
        <group position={[0, -0.27, 0.03]}>
          <mesh position={[0, 0, -0.006]} castShadow receiveShadow>
            <boxGeometry args={[1.68, 0.088, 0.026]} />
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
              [-0.815, 0.032],
              [0.815, 0.032],
              [-0.815, -0.032],
              [0.815, -0.032],
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
            <group key={idx} position={[-0.7225 + idx * 0.085, 0, 0.006]}>
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
    const isClickAction = dy < 12;
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
    } else {
      s.pullMainBreaker();
    }
  };

  return (
    <group
      position={[0.56, 0, 0.02]}
      onPointerOver={(e) => {
        e.stopPropagation();
        useGameStore
          .getState()
          .setHoveredControlHint(
            "MAIN BREAKER (ГЛАВНЫЙ РУБИЛЬНИК): Scroll Up = Close | Scroll Down = Open | Click / [SPACE]",
          );
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        useGameStore.getState().setHoveredControlHint(null);
      }}
      onWheel={(e) => {
        if (useCameraLookStore.getState().isFreeLookMode) return;
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation?.();
        const s = useGameStore.getState();
        const wantClose = e.deltaY < 0;
        const isClosed = Boolean(s.turbines[0]?.gridConnected);
        if (s.phase === "boot" && wantClose) {
          playKnifeSwitchSlam(true);
          sparkFlashRef.current = 1.0;
          startSoundtrack();
          updateSoundtrackState(false, s.isMusicMuted);
          s.startShift();
        } else if (s.phase === "playing" && wantClose !== isClosed) {
          playKnifeSwitchSlam(true);
          sparkFlashRef.current = 1.0;
          s.pullMainBreaker();
        }
      }}
      onPointerDown={(e) => {
        if (useCameraLookStore.getState().isFreeLookMode) return;
        e.stopPropagation();
        const s = useGameStore.getState();
        breakerDragRef.current = {
          active: true,
          startY: e.nativeEvent.clientY,
          progress: s.phase === "playing" && Boolean(s.turbines[0]?.gridConnected) ? 1 : 0,
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
      <mesh position={[0, 0.258, 0.008]} castShadow>
        <boxGeometry args={[0.515, 0.12, 0.01]} />
        <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.258, 0.015]}>
        <planeGeometry args={[0.50, 0.112]} />
        <meshStandardMaterial
          map={breakerPlateTex}
          emissive="#ffffff"
          emissiveMap={breakerPlateTex}
          emissiveIntensity={0.45}
          roughness={0.65}
        />
      </mesh>
      <group position={[0, -0.045, 0]}>
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
          ? "DRUM SEPARATORS & COOLANT LOOP // UNIT B (БЩУ-Т)"
          : "RBMK-1000 CORE & REACTIVITY // UNIT A-2 (СИУР)",
        variant === "rear"
          ? "DRUM BAR • WATER LEVEL • FEEDWATER & ГЦН 1-4"
          : "3200 MWt • XENON / VOID • CONTROL RODS (СУЗ)",
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
        variant === "rear" ? "FEEDWATER VALVE" : "CONTROL ROD DRIVE",
        variant === "rear" ? "ПЭН (0-100%)" : "ROD POS: 0–100% (SCROLL)",
        {
          width: 512,
          height: 168,
          titleSize: 58,
          subSize: 44,
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
        variant === "rear" ? "MAIN CIRC. PUMPS" : "RBMK CORE",
        variant === "rear" ? "ГЦН 1-4 (CLICK / SCROLL)" : "37 ROD TILES (CLICK)",
        {
          width: 640,
          height: 168,
          titleSize: 58,
          subSize: 44,
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
        variant === "rear" ? "STEAM DUMP" : "AUTO REGULATOR",
        variant === "rear" ? "БРУ-К (CONDENSER)" : "АР (AUTO RODS)",
        {
          width: 512,
          height: 168,
          titleSize: 58,
          subSize: 44,
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
      createCrispPanelTexture(1024, 768, (ctx, w, h) => {
        ctx.fillStyle = "#111715";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#486155";
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, w - 12, h - 12);

        const labels = ["LOOP 1", "LOOP 2", "LOOP 3", "LOOP 4"];
        labels.forEach((lbl, idx) => {
          const cx = 128 + idx * 256;
          // High-contrast top label badge
          ctx.fillStyle = "#17261f";
          ctx.fillRect(cx - 118, 18, 236, 86);
          ctx.strokeStyle = "#b8a46b";
          ctx.lineWidth = 5;
          ctx.strokeRect(cx - 118, 18, 236, 86);
          drawFittedPlaqueText(
            ctx,
            lbl,
            cx,
            76,
            220,
            '900 44px "Consolas", "Courier Prime", monospace',
            "#ffe600",
          );
          ctx.strokeStyle = "#6e6240";
          ctx.lineWidth = 5;
          ctx.strokeRect(cx - 108, 114, 216, 224);
        });

        const toggleLabels = ["ГЦН-1", "ГЦН-2", "ГЦН-3", "ГЦН-4"];
        toggleLabels.forEach((tlbl, idx) => {
          const cx = 128 + idx * 256;
          // High-contrast pump switch label badge
          ctx.fillStyle = "#17261f";
          ctx.fillRect(cx - 118, 356, 236, 88);
          ctx.strokeStyle = idx === 3 ? "#ff3b2a" : "#39ff14";
          ctx.lineWidth = 5;
          ctx.strokeRect(cx - 118, 356, 236, 88);
          drawFittedPlaqueText(
            ctx,
            tlbl,
            cx,
            416,
            220,
            '900 46px "Consolas", "Courier Prime", monospace',
            idx === 3 ? "#ff6655" : "#44ff77",
          );
        });
      }),
    [],
  );

  useFrame(({ clock }, delta) => {
    const s = useGameStore.getState();
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, delta);

    // 1. Control Rod Drive (UNIT A-2) & Feedwater Valve (UNIT B) Wheel & Bar Animation
    const rodPctVal = s.controlRods * 100;
    const fwPctVal = s.feedwaterValve * 100;
    const oilWheelTargetRot = -(rodPctVal / 100) * Math.PI * 1.6;
    if (oilWheelRef.current) {
      oilWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        oilWheelRef.current.rotation.z,
        oilWheelTargetRot,
        0.48,
      );
    }
    const gasWheelTargetRot = -(fwPctVal / 100) * Math.PI * 1.6;
    if (gasWheelRef.current) {
      gasWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        gasWheelRef.current.rotation.z,
        gasWheelTargetRot,
        0.48,
      );
    }

    if (oilLampMatRef.current) {
      const ok = !s.isBlackout && s.controlRods <= 0.9 && !s.az5Active;
      const col = ok ? "#33ff66" : "#ff2a2a";
      oilLampMatRef.current.color.set(col);
      oilLampMatRef.current.emissive.set(s.isBlackout ? "#000000" : col);
      oilLampMatRef.current.emissiveIntensity = s.isBlackout ? 0 : 1.35;
    }
    if (gasLampMatRef.current) {
      const highlightGasTut =
        variant === "rear" &&
        s.tutorialPhase === "STEP_1_COOLING" &&
        s.feedwaterValve < 0.45;
      if (highlightGasTut) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 6.0);
        const col = pulse > 0.5 ? "#33ff66" : "#ffb000";
        gasLampMatRef.current.color.set(col);
        gasLampMatRef.current.emissive.set(col);
        gasLampMatRef.current.emissiveIntensity = 1.6 + pulse * 1.4;
      } else {
        const ok =
          !s.isBlackout &&
          s.drumWaterLevel >= -250 &&
          s.drumWaterLevel <= 250;
        const col = ok ? "#33ff66" : "#ff2a2a";
        gasLampMatRef.current.color.set(col);
        gasLampMatRef.current.emissive.set(s.isBlackout ? "#000000" : col);
        gasLampMatRef.current.emissiveIntensity = s.isBlackout ? 0 : 1.35;
      }
    }

    // 5-Segment Ribbed Phosphor Glass Rod-Drive Bar on UNIT A-2
    const activeOilSegs = Math.round(s.controlRods * 5);
    for (let i = 0; i < 5; i++) {
      const mat = oilBarMatRefs.current[i];
      if (!mat) continue;
      const isLit = !s.isBlackout && i < activeOilSegs;
      const col = i >= 4 ? "#d98218" : "#28b862";
      mat.color.set(isLit ? col : "#141916");
      mat.emissive.set(isLit ? col : "#000000");
      mat.emissiveIntensity = isLit ? 1.15 : 0;
    }

    // 10-Segment Ribbed Phosphor Glass Feedwater Flow Bar on UNIT B
    const activeGasSegs = Math.round(s.feedwaterValve * 10);
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
      const activeRodCount = Math.round(
        s.controlRods * RBMK_OCTAGON_TILES.length,
      );
      for (let i = 0; i < RBMK_OCTAGON_TILES.length; i++) {
        const lensMat = channelLensMatRefs.current[i];
        const pinGrp = channelPinGroupRefs.current[i];
        const flux = s.rodTilesFlux[i] ?? 0;
        const severity = s.channelHotspots[i];
        const isRedVoidHotspot = severity === "red";
        const isCyanXenonPocket = severity === "cyan";
        const isAmberHotspot = !isRedVoidHotspot && !isCyanXenonPocket && severity === "amber";
        const isRodWithdrawn = flux > 0.1 || i < activeRodCount;
        const isHighReactivity = s.controlRods > 0.85;

        if (isRedVoidHotspot || isCyanXenonPocket || isAmberHotspot) {
          activeHotspots += 1;
        }

        if (lensMat) {
          if (s.isBlackout) {
            lensMat.color.set("#121a16");
            lensMat.emissive.set("#000000");
            lensMat.emissiveIntensity = 0;
          } else if (isRedVoidHotspot) {
            const pulse = 1.4 + Math.sin(t * 14 + i) * 0.7;
            lensMat.color.set("#ff3b2a");
            lensMat.emissive.set("#ff2a2a");
            lensMat.emissiveIntensity = pulse;
          } else if (isCyanXenonPocket) {
            const pulse = 1.35 + Math.sin(t * 11 + i) * 0.65;
            lensMat.color.set("#00e5ff");
            lensMat.emissive.set("#00f0ff");
            lensMat.emissiveIntensity = pulse;
          } else if (isAmberHotspot) {
            const pulse = 0.9 + Math.sin(t * 7 + i) * 0.35;
            lensMat.color.set("#d98218");
            lensMat.emissive.set("#ffb000");
            lensMat.emissiveIntensity = pulse;
          } else if (isRodWithdrawn) {
            if (isHighReactivity) {
              lensMat.color.set("#d98218");
              lensMat.emissive.set("#ffb000");
              lensMat.emissiveIntensity = 1.05;
            } else {
              lensMat.color.set("#227846");
              lensMat.emissive.set("#33ff66");
              lensMat.emissiveIntensity = 0.95;
            }
          } else {
            lensMat.color.set("#4a1412");
            lensMat.emissive.set("#991818");
            lensMat.emissiveIntensity = 0.38;
          }
        }

        if (pinGrp) {
          const targetPinZ = isRedVoidHotspot
            ? 0.025
            : isCyanXenonPocket
              ? 0.023
              : isAmberHotspot
                ? 0.018
                : isRodWithdrawn
                  ? 0.014
                  : 0.005;
          pinGrp.position.z = THREE.MathUtils.lerp(
            pinGrp.position.z,
            targetPinZ,
            0.25,
          );
        }
      }

      // Auto Regulator (АР) Lever & 10-Segment Ribbed Phosphor Glass Bar
      if (boronPistonGroupRef.current) {
        const rodDragRatio = pistonDragRef.current.active
          ? boronPistonPos
          : s.autoRodEnabled
            ? 0
            : 1 - s.controlRods;
        const targetY = 0.055 - rodDragRatio * 0.11;
        boronPistonGroupRef.current.position.y = THREE.MathUtils.lerp(
          boronPistonGroupRef.current.position.y,
          targetY,
          0.3,
        );
      }
      const activeRodSegs = s.autoRodEnabled
        ? 10
        : Math.round(s.controlRods * 10);
      for (let i = 0; i < 10; i++) {
        const mat = boronBarMatRefs.current[i];
        if (!mat) continue;
        const isLit = !s.isBlackout && i < activeRodSegs;
        const col = s.autoRodEnabled
          ? "#28b862"
          : i >= 8
            ? "#c92a1d"
            : i >= 6
              ? "#d98218"
              : "#28b862";
        mat.color.set(isLit ? col : "#141916");
        mat.emissive.set(isLit ? col : "#000000");
        mat.emissiveIntensity = isLit ? 1.15 : 0;
      }
    }

    // 3. UNIT B: ГЦН 1-4 Main Circulation Pumps, 3 Guarded Toggles, 4th Pump Button & Steam Dump (БРУ-К) Sight-Glass
    if (variant === "rear") {
      for (let i = 0; i < 4; i++) {
        const jMat = sealJewelMatRefs.current[i];
        if (!jMat) continue;
        const isOk = Boolean(s.mcpActive[i]);
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
        const targetRotX = s.mcpActive[i] ? -0.58 : 0.58;
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
          : s.steamDumpValve
            ? 1.0
            : 0;
        const targetY = 0.095 - prog * 0.19;
        drainLeverGroupRef.current.position.y = THREE.MathUtils.lerp(
          drainLeverGroupRef.current.position.y,
          targetY,
          0.28,
        );
        if (
          s.steamDumpValve &&
          t - drainDragRef.current.lastHissTime > 0.18
        ) {
          drainDragRef.current.lastHissTime = t;
          playSteamVentHiss(0.55);
        }
      }

      const highlightDrainTut = !s.isBlackout && s.drumPressure > 75;
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
        const ratio = THREE.MathUtils.clamp(
          (s.drumWaterLevel + 400) / 800,
          0.06,
          1,
        );
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
            Math.abs(s.drumWaterLevel) >= 250
              ? "#ff2a2a"
              : Math.abs(s.drumWaterLevel) >= 150
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
    const rodPct = Math.round(s.controlRods * 100);
    const voidPct = Math.round(s.voidFraction * 100);
    const xenonPct = Math.round(s.xenon);
    const fwPct = Math.round(s.feedwaterValve * 100);
    const flowPct = Math.round(s.coolantFlow * 100);
    const isReactivityDanger =
      s.thermalPower > 3600 || voidPct > 40 || Math.abs(s.reactivity) > 0.015;
    const sig = `${variant}|${Math.round(s.thermalPower)}|${Math.round(s.drumPressure)}|${Math.round(s.drumWaterLevel)}|${fwPct}|${flowPct}|${rodPct}|${voidPct}|${xenonPct}|${s.reactivity.toFixed(3)}|${s.autoRodEnabled}|${s.steamDumpValve}|${s.mcpActive.join(",")}|${s.isBlackout}`;
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
                  label: "DRUM BAR",
                  val: `${s.drumPressure.toFixed(0)} BAR`,
                  danger: s.drumPressure >= 80,
                },
                {
                  label: "WATER LEVEL",
                  val: `${s.drumWaterLevel.toFixed(0)} MM`,
                  danger: Math.abs(s.drumWaterLevel) >= 250,
                },
                {
                  label: "FEEDWATER %",
                  val: `${fwPct}%`,
                  danger: fwPct < 10 && s.thermalPower > 500,
                },
              ]
            : [
                {
                  label: "THERMAL MWt",
                  val: `${Math.round(s.thermalPower)} MWt`,
                  danger: s.thermalPower >= 3600,
                },
                {
                  label: "XENON / VOID",
                  val: `${xenonPct}% / ${voidPct}%`,
                  danger: voidPct > 35 || xenonPct > 35,
                },
                {
                  label: "CONTROL RODS",
                  val: `${rodPct}%`,
                  danger: rodPct >= 90,
                },
              ];

        const unitA2StatusLine =
          voidPct > 35
            ? `⚠️ STEAM VOIDS (${voidPct}%): INCREASE FEEDWATER (UNIT B), CLICK RED CORE TILES, OR PRESS [BORON INJECTION] ON UNIT A!`
            : xenonPct > 35
              ? `⚠️ XENON POISONING (${xenonPct}%): RAISE RODS (СУЗ) TO BURN XENON OR CLICK CYAN TILES ON 37-CORE MAP!`
              : `POWER: ${Math.round(s.thermalPower)} / 3200 MWt | REACTIVITY: ${(s.reactivity * 100).toFixed(2)} | VOID: ${voidPct}% | XENON: ${xenonPct}%`;

        paintSovietCRTScreen(ctx, 768, 144, {
          headerCode: variant === "rear" ? "CRT-84B" : "CRT-84A2",
          cells,
          statusLine:
            variant === "rear"
              ? `DRUM: ${s.drumPressure.toFixed(0)} BAR | LEVEL: ${s.drumWaterLevel.toFixed(0)} MM | FLOW: ${flowPct}% | DUMP (БРУ-К): ${s.steamDumpValve ? "OPEN" : "CLOSED"}`
              : unitA2StatusLine,
          statusDanger:
            variant === "rear"
              ? s.drumPressure >= 80 ||
                Math.abs(s.drumWaterLevel) >= 250 ||
                flowPct < 25
              : isReactivityDanger || voidPct > 35 || xenonPct > 35,
          footerLine:
            variant === "rear"
              ? `ГЦН PUMPS: ${s.mcpActive.filter(Boolean).length}/4 ON • FEEDWATER: ${fwPct}% • STEAM DUMP: ${s.steamDumpValve ? "OPEN" : "SHUT"}`
              : `RODS (СУЗ): ${rodPct}% • AUTO REGULATOR (АР): ${s.autoRodEnabled ? "ENABLED" : "MANUAL"} • ANOMALIES: ${activeHotspots}`,
          isBlackout: s.isBlackout,
        });
        tex.needsUpdate = true;
      }
    }
  });

  const wrapMimicSegments = useMemo<readonly MimicSegmentSpec[]>(() => {
    if (variant === "rear") {
      // UNIT B: HELIUM-N2 (left, x=-0.53) -> HELIUM BAR gauge (x=-0.51, y=1.775),
      // SEAL SCRUBBERS (center, x=0.0) -> GRAPHITE gauge (x=0.0, y=1.775),
      // BUBBLER DRAIN (right, x=+0.53) -> BUBBLER H2O gauge (x=+0.51, y=1.775)
      return [
        // Oxide-Red Helium-N2 Gas Loop up left flank (x=-0.76) to HELIUM BAR & GRAPHITE gauges
        { x: -0.645, y: 0.78, w: 0.23, h: 0.015, color: "#a83830" },
        { x: -0.76, y: 1.278, w: 0.015, h: 1.01, color: "#a83830" },
        { x: -0.635, y: 1.775, w: 0.25, h: 0.015, color: "#a83830" },
        { x: -0.255, y: 1.775, w: 0.51, h: 0.015, color: "#a83830" },
        // Horizontal Yellow Containment Interlock header in open belt (y=1.21) connecting Left/Center/Right assemblies
        { x: -0.265, y: 1.21, w: 0.53, h: 0.015, color: "#c8a838" },
        { x: 0.265, y: 1.21, w: 0.53, h: 0.015, color: "#c8a838" },
        { x: -0.53, y: 1.165, w: 0.015, h: 0.09, color: "#a83830" },
        { x: 0.0, y: 1.175, w: 0.015, h: 0.07, color: "#c8a838" },
        { x: 0.53, y: 1.165, w: 0.015, h: 0.09, color: "#388898" },
        // Cyan Bubbler Condensate Drain Line up right flank (x=+0.76) to BUBBLER H2O gauge & lower return header
        { x: 0.645, y: 0.78, w: 0.23, h: 0.015, color: "#388898" },
        { x: 0.76, y: 1.278, w: 0.015, h: 1.01, color: "#388898" },
        { x: 0.635, y: 1.775, w: 0.25, h: 0.015, color: "#388898" },
        { x: 0.255, y: 1.775, w: 0.51, h: 0.015, color: "#388898" },
        // Lower condensate & gas return manifold at y=0.36 below control deck
        { x: 0, y: 0.36, w: 1.06, h: 0.016, color: "#388898" },
        { x: -0.53, y: 0.47, w: 0.015, h: 0.22, color: "#a83830" },
        { x: 0.0, y: 0.47, w: 0.015, h: 0.22, color: "#c8a838" },
        { x: 0.53, y: 0.47, w: 0.015, h: 0.22, color: "#388898" },
      ];
    }
    // UNIT A-2: OIL COOLER (left, x=-0.53) -> BEARINGS & OIL PRESS gauges,
    // RBMK CORE 37 ROD TILES (center, x=0.0) -> CORE manifold,
    // BORON PUMP (right, x=+0.53) -> BORON gauge
    return [
      // Muted Yellow Lube-Oil Loop from OIL COOLER (x=-0.53) up left flank (x=-0.76) to BEARINGS & OIL PRESS gauges (y=1.775)
      { x: -0.645, y: 0.78, w: 0.23, h: 0.015, color: "#c8a838" },
      { x: -0.76, y: 1.278, w: 0.015, h: 1.01, color: "#c8a838" },
      { x: -0.635, y: 1.775, w: 0.25, h: 0.015, color: "#c8a838" },
      { x: -0.255, y: 1.775, w: 0.51, h: 0.015, color: "#c8a838" },
      // Oxide-Red RBMK Core Channels & Reactivity Header in open belt (y=1.21)
      { x: -0.265, y: 1.21, w: 0.53, h: 0.015, color: "#c8a838" },
      { x: 0.265, y: 1.21, w: 0.53, h: 0.015, color: "#a83830" },
      { x: -0.53, y: 1.165, w: 0.015, h: 0.09, color: "#c8a838" },
      { x: 0.0, y: 1.175, w: 0.015, h: 0.07, color: "#a83830" },
      { x: 0.53, y: 1.165, w: 0.015, h: 0.09, color: "#388898" },
      // Cyan Boron Hydraulic Line from BORON PUMP (x=+0.53) up right flank (x=+0.76) to BORON gauge (y=1.775)
      { x: 0.645, y: 0.78, w: 0.23, h: 0.015, color: "#388898" },
      { x: 0.76, y: 1.278, w: 0.015, h: 1.01, color: "#388898" },
      { x: 0.635, y: 1.775, w: 0.25, h: 0.015, color: "#388898" },
      { x: 0.255, y: 1.775, w: 0.51, h: 0.015, color: "#a83830" },
      // Lower Hydraulic & Core Feed Bus at y=0.36
      { x: 0, y: 0.36, w: 1.06, h: 0.016, color: "#a83830" },
      { x: -0.53, y: 0.47, w: 0.015, h: 0.22, color: "#c8a838" },
      { x: 0.0, y: 0.46, w: 0.015, h: 0.20, color: "#a83830" },
      { x: 0.53, y: 0.47, w: 0.015, h: 0.22, color: "#388898" },
    ];
  }, [variant]);

  const wrapMimicNodes = useMemo<readonly MimicNodeSpec[]>(
    () => [
      { x: -0.76, y: 1.775, color: variant === "rear" ? "#a83830" : "#c8a838" },
      { x: -0.53, y: 1.21, color: variant === "rear" ? "#a83830" : "#c8a838" },
      { x: 0.0, y: 1.21, color: variant === "rear" ? "#c8a838" : "#a83830" },
      { x: 0.53, y: 1.21, color: "#388898" },
      { x: 0.76, y: 1.775, color: "#388898" },
      { x: -0.53, y: 0.36, color: variant === "rear" ? "#a83830" : "#c8a838" },
      { x: 0.0, y: 0.36, color: variant === "rear" ? "#c8a838" : "#a83830" },
      { x: 0.53, y: 0.36, color: "#388898" },
    ],
    [variant],
  );

  const wrapRecessedWells = useMemo(
    () => [
      // Enlarged recessed dark instrument framing filling the sloped desk
      { x: -0.555, y: 0.72, w: 0.43, h: 0.65 },
      { x: 0.0, y: 0.72, w: 0.59, h: 0.70 },
      { x: 0.555, y: 0.72, w: 0.43, h: 0.65 },
    ],
    [],
  );

  return (
    <group ref={groupRef}>
      {/* Authentic Layered Soviet RBMK Blue-Grey / Olive-Grey Modular Steel Cabinet (`#485450`),
          Upper Canopy Overhang with 6 `ТАБЛО` Annunciator Lamps, Console Ledge & Synoptic Mimic Lines */}
      <SovietModularSteelCabinet3D
        width={1.66}
        unitCode={variant === "rear" ? "B" : "A2"}
        annunciatorLabels={
          variant === "rear"
            ? [
                "ГЕЛИЙ-N2",
                "ГЕРМОШЛЮЗ",
                "ДАВЛ. >68",
                "ГРАФИТ Т°",
                "БАРБОТЕР",
                "СБРОС H2O",
              ]
            : [
                "МАСЛОБЛОК",
                "ПОДШИПНИК",
                "КАНАЛЫ ТК",
                "БИОЗАЩИТА",
                "СУЗ СТЕРЖНИ",
                "БОРНЫЙ БАК",
              ]
        }
        mimicSegments={wrapMimicSegments}
        mimicNodes={wrapMimicNodes}
        recessedWells={wrapRecessedWells}
        dividerY={1.295}
        lowerLedgeY={0.36}
        openLeftSide={variant === "left-rear"}
        openRightSide={true}
      />

      {/* Outer Left Beveled L-Angle Iron Trim (Only on outer left edge of `UNIT B`) */}
      {variant === "rear" && (
        <mesh position={[-0.84, 1.18, 0.032]} castShadow receiveShadow>
          <boxGeometry args={[0.042, 2.40, 0.036]} />
          <meshStandardMaterial
            color="#4a5852"
            metalness={0.5}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
      )}

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
              title="DRUM BAR"
              cyrillicSub="ДАВЛ. СЕПАРАТОРА"
              unit="0-100 BAR"
              serial="№ 84-БС1"
              min={0}
              max={100}
              nominalMark={70}
              dangerThreshold={80}
              getValue={() => useGameStore.getState().drumPressure}
            />
            <HighDetailManometer3D
              position={[0, 0, 0]}
              title="WATER LEVEL"
              cyrillicSub="УРОВЕНЬ БС (ММ)"
              unit="-400..+400 MM"
              serial="№ 84-УВ2"
              min={-400}
              max={400}
              centerNominal={true}
              lowDangerThreshold={-250}
              dangerThreshold={250}
              getValue={() => useGameStore.getState().drumWaterLevel}
            />
            <HighDetailManometer3D
              position={[0.51, 0, 0]}
              title="FEEDWATER %"
              cyrillicSub="КЛАПАН ПЭН (%)"
              unit="0-100 %"
              serial="№ 84-ПЭ3"
              min={0}
              max={100}
              dangerThreshold={95}
              getValue={() => useGameStore.getState().feedwaterValve * 100}
            />
          </>
        ) : (
          <>
            <HighDetailManometer3D
              position={[-0.51, 0, 0]}
              title="THERMAL MWt"
              cyrillicSub="ТЕПЛ. МОЩНОСТЬ"
              unit="0-4500 MWt"
              serial="№ 84-ТМ1"
              min={0}
              max={4500}
              nominalMark={3200}
              dangerThreshold={3600}
              getValue={() => useGameStore.getState().thermalPower}
            />
            <HighDetailManometer3D
              position={[0, 0, 0]}
              title="XENON / VOID"
              cyrillicSub="КСЕНОН / ПАР (%)"
              unit="0-100 %"
              serial="№ 84-КП2"
              min={0}
              max={100}
              dangerThreshold={70}
              getValue={() => useGameStore.getState().xenon}
              secondaryGetValue={() =>
                useGameStore.getState().voidFraction * 100
              }
            />
            <HighDetailManometer3D
              position={[0.51, 0, 0]}
              title="CONTROL RODS"
              cyrillicSub="СТЕРЖНИ СУЗ (%)"
              unit="0-100 %"
              serial="№ 84-СУ3"
              min={0}
              max={100}
              dangerThreshold={90}
              getValue={() => useGameStore.getState().controlRods * 100}
            />
          </>
        )}
      </group>

      {/* Molded Phosphor-Green CRT Monitor Bay (`ЭЛТ ВЛ-84`) on Angled Tier-2 Riser */}
      <group position={[0, 1.462, 0.04]} rotation={[-0.08, 0, 0]}>
        <SovietCRTMonitorBay3D
          position={[0, 0, 0]}
          screenMatRef={vfdMatRef}
          screenTexture={vfdTexture}
          modelBadge={variant === "rear" ? "ЭЛТ ВЛ-84В" : "ЭЛТ ВЛ-84А2"}
        />
      </group>

      {/* ====================================================================
          LOWER INDUSTRIAL CONTROL DECK (Mounted Flush on Sloped Sage-Green Desk):
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
        <group position={[0, 0.77, 0.28]} rotation={[-0.406, 0, 0]}>
          {/* 1. LEFT: Full Cast-Iron Valve Manifold & Brass Scale Arc (`OIL COOLER VALVE`) */}
          <group position={[-0.555, 0.02, 0.02]} scale={[1.18, 1.42, 1.25]}>
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
              onWheel={(e: ThreeEvent<WheelEvent>) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                const isShift = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
                const stepPct = isShift ? 1 : 5;
                const deltaPct = e.deltaY < 0 ? stepPct : -stepPct;
                playDetentClick(2);
                useGameStore.getState().adjustControlRodLevel(deltaPct);
              }}
              onPointerOver={() => {
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "[SCROLL WHEEL]: ADJUST RODS (±5%) | [SHIFT+SCROLL]: FINE (±1%) | [CLICK]: STEP",
                  );
              }}
              onPointerOut={() => {
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onPointerDown={(e) =>
                startSmoothWheelSwivelDrag(
                  e,
                  oilWheelRef.current,
                  useGameStore.getState().controlRods * 100,
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
            scale={[1.18, 1.38, 1.25]}
            onWheel={(e: ThreeEvent<WheelEvent>) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              e.nativeEvent?.stopImmediatePropagation?.();
              const isShift = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
              const stepPct = isShift ? 1 : 5;
              const deltaPct = e.deltaY < 0 ? stepPct : -stepPct;
              playDetentClick(2);
              useGameStore.getState().adjustControlRodLevel(deltaPct);
            }}
            onPointerOver={() => {
              useGameStore
                .getState()
                .setHoveredControlHint(
                  "[CLICK RED/CYAN TILE]: TRIM VOID OR XENON (-12%) | [SCROLL WHEEL]: ADJUST RODS (±5%)",
                );
            }}
            onPointerOut={() => {
              useGameStore.getState().setHoveredControlHint(null);
            }}
            onPointerDown={(e) => {
              if (useCameraLookStore.getState().isFreeLookMode) return;
              e.stopPropagation();
              const s = useGameStore.getState();
              const activeKeys = Object.keys(s.channelHotspots).map(Number);
              const startY = e.nativeEvent.clientY;
              const startRod = s.controlRodLevel;
              let moved = false;
              let lastDetent = Math.round(startRod / 5);

              const handleMove = (ev: PointerEvent) => {
                const dy = startY - ev.clientY;
                if (Math.abs(dy) >= 5) {
                  moved = true;
                  const nextRod = THREE.MathUtils.clamp(
                    startRod + (dy / 90) * 100,
                    0,
                    100,
                  );
                  const curDetent = Math.round(nextRod / 5);
                  if (curDetent !== lastDetent) {
                    lastDetent = curDetent;
                    playDetentClick((Math.abs(curDetent) % 5) + 1);
                  }
                  useGameStore.getState().setControlRodLevel(nextRod);
                }
              };

              const handleUp = () => {
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
                window.removeEventListener("pointercancel", handleUp);
                if (!moved && activeKeys.length > 0) {
                  playSwitchClank(true);
                  playDetentClick(3);
                  useGameStore.getState().quenchChannelHotspot(activeKeys[0]);
                }
              };

              window.addEventListener("pointermove", handleMove);
              window.addEventListener("pointerup", handleUp);
              window.addEventListener("pointercancel", handleUp);
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
                    const s = useGameStore.getState();
                    const startY = e.nativeEvent.clientY;
                    const startRod = s.controlRodLevel;
                    let moved = false;
                    let lastDetent = Math.round(startRod / 5);

                    const handleMove = (ev: PointerEvent) => {
                      const dy = startY - ev.clientY;
                      if (Math.abs(dy) >= 5) {
                        moved = true;
                        const nextRod = THREE.MathUtils.clamp(
                          startRod + (dy / 90) * 100,
                          0,
                          100,
                        );
                        const curDetent = Math.round(nextRod / 5);
                        if (curDetent !== lastDetent) {
                          lastDetent = curDetent;
                          playDetentClick((Math.abs(curDetent) % 5) + 1);
                        }
                        useGameStore.getState().setControlRodLevel(nextRod);
                      }
                    };

                    const handleUp = () => {
                      window.removeEventListener("pointermove", handleMove);
                      window.removeEventListener("pointerup", handleUp);
                      window.removeEventListener("pointercancel", handleUp);
                      if (!moved) {
                        playSwitchClank(true);
                        playDetentClick((tIdx % 5) + 2);
                        useGameStore.getState().quenchChannelHotspot(tIdx);
                      }
                    };

                    window.addEventListener("pointermove", handleMove);
                    window.addEventListener("pointerup", handleUp);
                    window.addEventListener("pointercancel", handleUp);
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
          <group position={[0.555, 0.02, 0.02]} scale={[1.18, 1.42, 1.25]}>
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
              onPointerOver={(e) => {
                e.stopPropagation();
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "AUTO REGULATOR (АР): Scroll Up = ON | Scroll Down = OFF | Click / Drag Lever",
                  );
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onWheel={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                const wantOn = e.deltaY < 0;
                const s = useGameStore.getState();
                if (s.autoRodEnabled !== wantOn) {
                  playSwitchClank(true);
                  s.setAutoRodEnabled(wantOn);
                  setBoronPistonPos(wantOn ? 0 : 0.45);
                }
              }}
              onPointerDown={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                const s = useGameStore.getState();
                const startRod = s.controlRods * 100;
                const initPos = s.autoRodEnabled ? 0 : 1 - startRod / 100;
                let dragged = false;
                pistonDragRef.current = {
                  active: true,
                  startY: e.nativeEvent.clientY,
                  startPos: initPos,
                  lastHalfStroke: Math.round(initPos * 10),
                };
                setBoronPistonPos(initPos);
                const handleMove = (ev: PointerEvent) => {
                  if (!pistonDragRef.current.active) return;
                  const dy = ev.clientY - pistonDragRef.current.startY;
                  if (Math.abs(dy) >= 6) {
                    dragged = true;
                  }
                  const nextPos = THREE.MathUtils.clamp(
                    pistonDragRef.current.startPos + dy / 110,
                    0,
                    1,
                  );
                  setBoronPistonPos(nextPos);
                  if (dragged) {
                    const nextRodPct = Math.round((1 - nextPos) * 100);
                    useGameStore.getState().setControlRodLevel(nextRodPct);
                    useGameStore.getState().setAutoRodEnabled(nextPos < 0.25);
                  }

                  const stepIdx = Math.round(nextPos * 10);
                  if (stepIdx !== pistonDragRef.current.lastHalfStroke) {
                    const prevStep = pistonDragRef.current.lastHalfStroke;
                    pistonDragRef.current.lastHalfStroke = stepIdx;
                    playDetentClick((Math.abs(stepIdx) % 5) + 1);
                    if (stepIdx >= 8 && prevStep < 8) {
                      playSwitchClank(true);
                      playBoronHydraulicPumpStroke();
                      useGameStore.getState().pumpBoronTank(3.5);
                    }
                  }
                };
                const handleUp = () => {
                  pistonDragRef.current.active = false;
                  if (!dragged) {
                    playSwitchClank(true);
                    useGameStore.getState().setAutoRodEnabled();
                  } else {
                    playSwitchClank(false);
                  }
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
        <group position={[0, 0.77, 0.28]} rotation={[-0.406, 0, 0]}>
          {/* ================================================================
              UNIT B (`variant === "rear"`) — GRITTY SOVIET INDUSTRIAL REALISM
              1. Left: Dual-Pipe Finned Copper Gas Manifold & Oxidized Crimson Cast-Iron Wheel + Recessed Glass Cell Bar
              2. Center: Bolted Containment Bulkhead Synoptic Panel (4 Caged Jewel Lamps + 3 Chunky Guarded Toggles + Crimson Bakelite Mushroom Button)
              3. Right: Bolted Quadrant Pull-Lever + Armored Sight-Glass with Brass Manifolds & Tick-Mark Graduation Rings
             ================================================================ */}

          {/* 1. LEFT: Dual-Pipe Finned Copper Gas Manifold & Oxidized Crimson Handwheel (`HELIUM-N2 LOOP`) */}
          <group position={[-0.555, 0.02, 0.02]} scale={[1.18, 1.42, 1.25]}>
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
              onPointerOver={(e) => {
                e.stopPropagation();
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "FEEDWATER VALVE (ПЭН): Scroll Wheel (±5% | Shift ±1%) or Click/Drag (0–100%)",
                  );
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onWheel={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                const fine = Boolean(e.shiftKey || e.nativeEvent?.shiftKey);
                const step = (e.deltaY < 0 ? 1 : -1) * (fine ? 1 : 5);
                const s = useGameStore.getState();
                const curPct = Math.round(s.nitrogenLoopValve);
                const nextPct = THREE.MathUtils.clamp(curPct + step, 0, 100);
                if (nextPct !== curPct) {
                  playDetentClick((Math.abs(nextPct) % 5) + 1);
                  s.setNitrogenLoopValve(nextPct);
                }
              }}
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
          <group position={[0, 0.0, 0.02]} scale={[1.18, 1.42, 1.25]}>
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
                onPointerOver={(e) => {
                  e.stopPropagation();
                  useGameStore
                    .getState()
                    .setHoveredControlHint(
                      `MAIN CIRC. PUMP ГЦН-${tIdx + 1}: Scroll Up = ON | Scroll Down = OFF | Click Toggle`,
                    );
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  useGameStore.getState().setHoveredControlHint(null);
                }}
                onWheel={(e) => {
                  if (useCameraLookStore.getState().isFreeLookMode) return;
                  e.stopPropagation();
                  e.nativeEvent?.stopImmediatePropagation?.();
                  const wantOn = e.deltaY < 0;
                  const s = useGameStore.getState();
                  if (s.sealToggles[tIdx] !== wantOn) {
                    playSwitchClank(true);
                    s.toggleSealSwitch(tIdx as 0 | 1 | 2);
                  }
                }}
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
              onPointerOver={(e) => {
                e.stopPropagation();
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "MAIN CIRC. PUMP ГЦН-4 (ALL PUMPS ON): Scroll Up = Start All 4 Pumps | Click Button",
                  );
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onWheel={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                const wantOn = e.deltaY < 0;
                const s = useGameStore.getState();
                if (wantOn) {
                  emergSealDepressRef.current = 1.0;
                  playSwitchClank(true);
                  playPneumaticWhoosh();
                  s.lockAllContainmentSeals();
                } else if (s.mcpActive[3]) {
                  playSwitchClank(false);
                  s.toggleMcpPump(3);
                }
              }}
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
          <group position={[0.555, 0.02, 0.02]} scale={[1.18, 1.42, 1.25]}>
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

            {/* Left Half: Raised Bolted Cast-Iron Quadrant Pull-Lever (`STEAM DUMP БРУ-К`) */}
            <group
              position={[-0.06, -0.02, 0.028]}
              onPointerOver={(e) => {
                e.stopPropagation();
                useGameStore
                  .getState()
                  .setHoveredControlHint(
                    "STEAM DUMP (БРУ-К): Scroll Up = OPEN (-3 BAR/s) | Scroll Down = CLOSE | Click/Drag",
                  );
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                useGameStore.getState().setHoveredControlHint(null);
              }}
              onWheel={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                e.nativeEvent?.stopImmediatePropagation?.();
                const wantOpen = e.deltaY < 0;
                const s = useGameStore.getState();
                if (s.steamDumpValve !== wantOpen) {
                  s.setSteamDumpValve(wantOpen);
                  drainDragRef.current.progress = wantOpen ? 1.0 : 0;
                  playSwitchClank(true);
                  if (wantOpen) playSteamVentHiss(0.6);
                }
              }}
              onPointerDown={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                const wasOpen = useGameStore.getState().steamDumpValve;
                let dragged = false;
                drainDragRef.current = {
                  active: true,
                  startY: e.nativeEvent.clientY,
                  progress: wasOpen ? 1.0 : 0.4,
                  lastHissTime: 0,
                };
                useGameStore.getState().setSteamDumpValve(!wasOpen);
                playSwitchClank(true);
                playSteamVentHiss(0.6);
                const handleMove = (ev: PointerEvent) => {
                  if (!drainDragRef.current.active) return;
                  const dy = ev.clientY - drainDragRef.current.startY;
                  if (Math.abs(dy) >= 8) {
                    dragged = true;
                  }
                  const prog = THREE.MathUtils.clamp(
                    (wasOpen ? 1.0 : 0.2) + dy / 65,
                    0,
                    1.0,
                  );
                  drainDragRef.current.progress = prog;
                  if (dragged) {
                    useGameStore.getState().setSteamDumpValve(prog >= 0.45);
                  }
                };
                const handleUp = () => {
                  drainDragRef.current.active = false;
                  drainDragRef.current.progress = useGameStore.getState().steamDumpValve
                    ? 1.0
                    : 0;
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
              const store = useGameStore.getState();
              const localPt = e.object.worldToLocal(e.point.clone());
              const deltaPct = localPt.x < -0.15 ? -5 : 5;
              if (row.rowIdx === 0) {
                store.cycleSelectedH2OSubstation();
                store.adjustSubstationH2O(store.selectedH2OSubstationId, deltaPct);
              } else if (row.rowIdx === 1) {
                store.adjustSubstationH2O(1, deltaPct);
              } else if (row.rowIdx === 2) {
                store.adjustSubstationH2O(3, deltaPct);
              } else if (row.rowIdx === 3) {
                store.adjustSubstationH2O(5, deltaPct);
              }
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


