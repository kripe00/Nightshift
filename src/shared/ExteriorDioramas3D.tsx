import { useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { registerKremlinCanvasRedraw } from "./kremlinFontReady";
import { useGameStore } from "./useGameStore";

export const NOOP_RAYCAST = () => null;

const SPIRIT_CAR_OFFSETS = [-3.8, -2.35, -0.9, 0.55, 2.0, 3.45] as const;
const DIST_STACK_XS = [6.1, 8.8, 12.2] as const;
const TRAIN_CAR_OFFSETS = [-3.0, -1.8, -0.6, 0.6, 1.8, 3.0] as const;
const CITY_STACK_OFFSETS_X = [-1.05, 0.0, 1.05] as const;
const CITY_STACK_HEIGHTS = [4.2, 4.65, 4.35] as const;

interface DioramaGridState {
  citySatisfaction: number;
  vodkaSupply: number;
  vodkaFlicker: number;
  cherenkovLevel: number;
}

function computeDioramaGridState(): DioramaGridState {
  const s = useGameStore.getState();
  let totalTargetMW = 0;
  let totalAllocatedMW = 0;
  const subs = s.substations;
  if (subs && subs.length > 0) {
    for (let i = 0; i < subs.length; i++) {
      totalTargetMW += subs[i].targetMW ?? 0;
      totalAllocatedMW += subs[i].allocatedMW ?? 0;
    }
  } else {
    totalTargetMW = s.energyDemandMW;
  }

  const demand = Math.max(1, s.energyDemandMW, totalTargetMW);
  const gridRatio = THREE.MathUtils.clamp(s.totalElectricalMW / demand, 0, 1);
  const batteryRatio = THREE.MathUtils.clamp(s.batteryStoredPct / 100, 0, 1);

  const cityTarget = Math.max(
    1,
    (s.targetSectorMW?.pripyat ?? 100) + (s.targetSectorMW?.kolkhoz ?? 100),
  );
  const cityAllocated =
    (s.sectorMW?.pripyat ?? 0) + (s.sectorMW?.kolkhoz ?? 0);
  const cityAllocRatio = THREE.MathUtils.clamp(cityAllocated / cityTarget, 0, 1);

  // During initial cold-start (before Unit A sector levers are touched and before
  // tutorial completes), off-site standby keeps Worker City lit unless blackout,
  // AZ-5 trip, or battery exhaustion occurs; afterward live satisfaction rules.
  const preActivationStandby =
    s.tutorialPhase !== "COMPLETED" &&
    totalAllocatedMW <= 0 &&
    s.totalElectricalMW <= 1;

  let citySatisfaction = 0;
  if (!s.isBlackout) {
    if (preActivationStandby && !s.az5Active) {
      citySatisfaction = batteryRatio > 0.05 ? 1 : 0;
    } else {
      citySatisfaction = THREE.MathUtils.clamp(
        Math.min(gridRatio, cityAllocRatio),
        0,
        1,
      );
    }
  }

  // Party Priority: State Vodka Distillery "KRISTALL-84" draws VIP power + reserve
  // batteries at 100% until BOTH grid output and battery sink below 12%, dying dead last.
  const vodkaSupply = s.isBlackout
    ? 0
    : THREE.MathUtils.clamp(Math.max(gridRatio, batteryRatio), 0, 1);

  let vodkaFlicker = 1;
  if (vodkaSupply <= 0.005) {
    vodkaFlicker = 0;
  } else if (vodkaSupply < 0.12) {
    vodkaFlicker = THREE.MathUtils.lerp(
      0.28,
      1.0,
      (vodkaSupply - 0.005) / 0.115,
    );
  }

  // Cherenkov ionized sky-beam & cyan steam during reactor excursion / AZ-5 / meltdown
  const tempExcursion = THREE.MathUtils.clamp((s.coreTemp - 540) / 340, 0, 1);
  const thermalExcursion = THREE.MathUtils.clamp(
    (s.thermalPower - 3300) / 1400,
    0,
    1,
  );
  const reactExcursion = THREE.MathUtils.clamp(
    (s.reactivity - 0.003) / 0.018,
    0,
    1,
  );
  const triggerAny =
    s.coreTemp > 540 ||
    s.thermalPower > 3300 ||
    s.reactivity > 0.003 ||
    s.az5Active ||
    s.coreMeltdown ||
    s.steamExplosion;

  let cherenkovLevel = 0;
  if (triggerAny) {
    const baseTrigger = s.coreMeltdown || s.steamExplosion
      ? 1
      : s.az5Active
        ? 0.52
        : 0.25;
    cherenkovLevel = Math.max(
      baseTrigger,
      tempExcursion,
      thermalExcursion,
      reactExcursion,
    );
  }

  return {
    citySatisfaction,
    vodkaSupply,
    vodkaFlicker,
    cherenkovLevel,
  };
}

/**
 * Unit 1x1x1 stripped 4-face box (`+Z`, `-X`, `+X`, `+Y` only — 8 tris per instance)
 * with mapped concrete facade UVs (`+Z`, `-X`, `+X` = 0..1; `+Y` roof = dark roof strip).
 */
function createFourFaceBoxGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    // +Z front
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // -X left
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
    // +X right
    0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
    // +Y roof
    -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  ]);
  const uvs = new Float32Array([
    // +Z front
    0, 0, 1, 0, 1, 1, 0, 1,
    // -X left
    0, 0, 1, 0, 1, 1, 0, 1,
    // +X right
    0, 0, 1, 0, 1, 1, 0, 1,
    // +Y roof
    0, 0.9, 0.15, 0.9, 0.15, 1, 0, 1,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
  ];
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
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
  registerKremlinCanvasRedraw(canvas, tex, (c, w, h) => {
    c.imageSmoothingEnabled = false;
    draw(c, w, h);
  });
  return tex;
}

interface SovietBlastWindowFrameProps {
  width: number;
  height?: number;
  plaqueTitle: string;
  plaqueSub: string;
}

/**
 * Chamfered Soviet olive-steel blast window frame (`6°` inward tilt), bolted brass decree plaque,
 * subtle perimeter edge grime strips (no full-pane alpha wash), crooked venetian blinds, and
 * hanging window squeegee on a brass peg.
 */
const SovietBlastWindowFrame3D: React.FC<SovietBlastWindowFrameProps> =
  React.memo(({ width, height = 1.8, plaqueTitle, plaqueSub }) => {
    const hw = width * 0.5;
    const hh = height * 0.5;
    const dividerX = -width * 0.16;

    const plaqueTex = useMemo(
      () =>
        createNearestCanvasTexture(512, 72, (ctx, w, h) => {
          ctx.fillStyle = "#1c1810";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#b8a46b";
          ctx.lineWidth = 4;
          ctx.strokeRect(2, 2, w - 4, h - 4);
          ctx.fillStyle = "#e2c36b";
          ctx.font = 'bold 18px "Kremlin", "Consolas", monospace';
          ctx.textAlign = "center";
          ctx.fillText(plaqueTitle, w / 2, 29, w - 24);
          ctx.fillStyle = "#e6dec3";
          ctx.font = 'bold 15px "Kremlin", "VT323", monospace';
          ctx.fillText(plaqueSub, w / 2, 54, w - 24);
        }),
      [plaqueTitle, plaqueSub],
    );

    const grimeEdgeTex = useMemo(() => {
      const tex = createNearestCanvasTexture(128, 32, (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(22, 42, 32, 0.28)");
        grad.addColorStop(0.5, "rgba(26, 48, 36, 0.1)");
        grad.addColorStop(1, "rgba(26, 48, 36, 0.0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      return tex;
    }, []);

    return (
      <group>
        {/* Outer Heavy Dark-Steel Blast Casing Anchored to Wall Cutout */}
        <mesh position={[0, hh + 0.04, 0.02]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[width + 0.18, 0.1, 0.24]} />
          <meshBasicMaterial color="#18201d" fog={false} />
        </mesh>
        <mesh position={[0, -hh - 0.06, 0.05]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[width + 0.2, 0.16, 0.3]} />
          <meshBasicMaterial color="#1e2824" fog={false} />
        </mesh>
        <mesh position={[-hw - 0.04, 0, 0.02]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[0.1, height + 0.08, 0.24]} />
          <meshBasicMaterial color="#18201d" fog={false} />
        </mesh>
        <mesh position={[hw + 0.04, 0, 0.02]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[0.1, height + 0.08, 0.24]} />
          <meshBasicMaterial color="#18201d" fog={false} />
        </mesh>

        {/* 6° Inward-Tilted Soviet Olive-Steel Inner Blast Mullions */}
        <group rotation={[0.105, 0, 0]}>
          <mesh position={[0, hh - 0.02, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[width + 0.02, 0.07, 0.14]} />
            <meshBasicMaterial color="#2b3832" fog={false} />
          </mesh>
          <mesh position={[0, -hh + 0.02, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[width + 0.02, 0.07, 0.14]} />
            <meshBasicMaterial color="#2b3832" fog={false} />
          </mesh>
          <mesh position={[-hw + 0.02, 0, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[0.07, height, 0.14]} />
            <meshBasicMaterial color="#2b3832" fog={false} />
          </mesh>
          <mesh position={[hw - 0.02, 0, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[0.07, height, 0.14]} />
            <meshBasicMaterial color="#2b3832" fog={false} />
          </mesh>
          {/* Off-Center Vertical Blast Divider Mullion */}
          <mesh position={[dividerX, 0, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[0.075, height - 0.04, 0.14]} />
            <meshBasicMaterial color="#232e29" fog={false} />
          </mesh>
          {/* Brass Blast Bolts Along Bottom Sill Flange */}
          {[-1.5, -0.75, 0.0, 0.75, 1.5].map((bx, idx) => (
            <mesh
              key={`blast-bolt-${idx}`}
              position={[bx, -hh + 0.02, 0.115]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.026, 0.026]} />
              <meshBasicMaterial color="#9e874e" fog={false} />
            </mesh>
          ))}
        </group>

        {/* Narrow Green-Tinted Perimeter Edge Grime Strips (Hugged Tight to Mullions so Center Glass is Clear) */}
        <mesh position={[0, hh - 0.045, 0.01]} renderOrder={5} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <planeGeometry args={[width - 0.08, 0.042]} />
          <meshBasicMaterial
            map={grimeEdgeTex}
            transparent
            depthWrite={false}
            fog={false}
          />
        </mesh>
        <mesh
          position={[0, -hh + 0.045, 0.01]}
          rotation={[0, 0, Math.PI]}
          renderOrder={5}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <planeGeometry args={[width - 0.08, 0.042]} />
          <meshBasicMaterial
            map={grimeEdgeTex}
            transparent
            depthWrite={false}
            fog={false}
          />
        </mesh>
        <mesh
          position={[-hw + 0.045, 0, 0.01]}
          rotation={[0, 0, Math.PI / 2]}
          renderOrder={5}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <planeGeometry args={[height - 0.08, 0.042]} />
          <meshBasicMaterial
            map={grimeEdgeTex}
            transparent
            depthWrite={false}
            fog={false}
          />
        </mesh>
        <mesh
          position={[hw - 0.045, 0, 0.01]}
          rotation={[0, 0, -Math.PI / 2]}
          renderOrder={5}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <planeGeometry args={[height - 0.08, 0.042]} />
          <meshBasicMaterial
            map={grimeEdgeTex}
            transparent
            depthWrite={false}
            fog={false}
          />
        </mesh>

        {/* Bolted Brass Window Sill Decree Plaque (0.02m proud of z=0.20 vertical sill apron, zero tilt clipping) */}
        <group position={[0.25, -hh - 0.06, 0.212]} rotation={[0, 0, 0]}>
          <mesh raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[1.38, 0.13, 0.016]} />
            <meshBasicMaterial color="#8c7a4b" fog={false} />
          </mesh>
          <mesh position={[0, 0, 0.011]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <planeGeometry args={[1.34, 0.115]} />
            <meshBasicMaterial
              map={plaqueTex}
              polygonOffset={true}
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
              fog={false}
            />
          </mesh>
        </group>

        {/* Rolled-Up Dark Headrail Bar Tucked High Inside Top Right Mullion (Pane 100% Clear) */}
        <group position={[hw - 0.66, hh - 0.042, 0.05]}>
          <mesh rotation={[0, 0, -0.02]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[1.16, 0.028, 0.036]} />
            <meshBasicMaterial color="#2b342f" fog={false} />
          </mesh>
        </group>

        {/* Tiny Wooden Window Squeegee Hanging on a Brass Peg Beside Right Blast Bolts */}
        <group position={[hw + 0.01, -0.18, 0.14]} rotation={[0, 0, 0.14]}>
          <mesh position={[0, 0.11, -0.01]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <planeGeometry args={[0.02, 0.02]} />
            <meshBasicMaterial color="#b8a46b" fog={false} />
          </mesh>
          <mesh position={[0, 0, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[0.016, 0.21, 0.016]} />
            <meshBasicMaterial color="#6e4a2e" fog={false} />
          </mesh>
          <mesh position={[0, 0.1, 0.006]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[0.19, 0.024, 0.016]} />
            <meshBasicMaterial color="#a8945c" fog={false} />
          </mesh>
          <mesh position={[0, 0.114, 0.011]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <planeGeometry args={[0.196, 0.012]} />
            <meshBasicMaterial color="#141414" fog={false} />
          </mesh>
        </group>
      </group>
    );
  });

/**
 * Distinct 3-wide Soviet Industrial Observation Window for Window 2 (`+Z` Back Wall):
 * 2 vertical steel mullions + upper horizontal transom bar with bolted gusset plates,
 * subtle corner frost/condensation strips, mullion-mounted `KGS-84` frost thermometer box,
 * and an interior painted-steel finned radiator pipe + cable conduit along the lower frame.
 * NO curtains, NO venetian blinds, NO squeegee, NO exterior catwalk.
 */
const IndustrialGalleryWindowFrame3D: React.FC<SovietBlastWindowFrameProps> =
  React.memo(({ width, height = 1.8, plaqueTitle, plaqueSub }) => {
    const hw = width * 0.5;
    const hh = height * 0.5;
    const mullionXs = useMemo(() => [-width / 6, width / 6], [width]);
    const transomY = hh - 0.36;

    const plaqueTex = useMemo(
      () =>
        createNearestCanvasTexture(512, 72, (ctx, w, h) => {
          ctx.fillStyle = "#1c1810";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#b8a46b";
          ctx.lineWidth = 4;
          ctx.strokeRect(2, 2, w - 4, h - 4);
          ctx.fillStyle = "#e2c36b";
          ctx.font = 'bold 18px "Kremlin", "Consolas", monospace';
          ctx.textAlign = "center";
          ctx.fillText(plaqueTitle, w / 2, 29, w - 24);
          ctx.fillStyle = "#e6dec3";
          ctx.font = 'bold 15px "Kremlin", "VT323", monospace';
          ctx.fillText(plaqueSub, w / 2, 54, w - 24);
        }),
      [plaqueTitle, plaqueSub],
    );

    const thermometerTex = useMemo(
      () =>
        createNearestCanvasTexture(64, 128, (ctx, w, h) => {
          ctx.fillStyle = "#24302b";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "#8ea095";
          ctx.lineWidth = 2;
          ctx.strokeRect(2, 2, w - 4, h - 4);
          ctx.fillStyle = "#e6dec3";
          ctx.fillRect(7, 8, w - 14, 72);
          ctx.fillStyle = "#141414";
          ctx.font = 'bold 11px "Kremlin", "VT323", monospace';
          ctx.textAlign = "center";
          ctx.fillText("KGS-84", w / 2, 20, w - 16);
          ctx.fillStyle = "#1c4a8a";
          ctx.fillRect(27, 25, 10, 44);
          ctx.fillStyle = "#3399ff";
          ctx.fillRect(30, 44, 4, 24);
          ctx.fillStyle = "#ff2a2a";
          ctx.fillRect(29, 66, 6, 4);
          ctx.fillStyle = "#141414";
          ctx.fillText("-26°C", w / 2, 77);
          // Lower mini dosimeter dial
          ctx.fillStyle = "#101614";
          ctx.fillRect(10, 86, w - 20, 32);
          ctx.fillStyle = "#ffb000";
          ctx.fillText("3.6 R", w / 2, 107);
        }),
      [],
    );

    const frostEdgeTex = useMemo(
      () =>
        createNearestCanvasTexture(256, 48, (ctx, w, h) => {
          ctx.clearRect(0, 0, w, h);
          const bayW = w / 3;
          for (let bay = 0; bay < 3; bay++) {
            const x0 = bay * bayW;
            const corners = [x0 + 2, x0 + bayW - 2];
            for (const cx of corners) {
              for (let r = 0; r < 14; r++) {
                const dx = ((r * 13 + bay * 7) % 14) * (cx === x0 + 2 ? 1 : -1);
                const dy = (r * 9) % 18;
                ctx.fillStyle =
                  r % 2 === 0
                    ? "rgba(206, 236, 252, 0.62)"
                    : "rgba(154, 204, 236, 0.42)";
                ctx.fillRect(cx + dx, h - 3 - dy, 3, 2);
              }
            }
          }
        }),
      [],
    );

    const radiatorFinXs = useMemo(() => {
      const xs: number[] = [];
      for (let i = 0; i < 14; i++) {
        xs.push(THREE.MathUtils.lerp(-1.58, -0.82, i / 13));
      }
      for (let i = 0; i < 14; i++) {
        xs.push(THREE.MathUtils.lerp(0.82, 1.58, i / 13));
      }
      return xs;
    }, []);

    return (
      <group>
        {/* Outer Heavy Charcoal-Slate Industrial Window Casing */}
        <mesh position={[0, hh + 0.04, 0.02]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[width + 0.18, 0.1, 0.24]} />
          <meshBasicMaterial color="#192126" fog={false} />
        </mesh>
        <mesh position={[0, -hh - 0.048, 0.05]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[width + 0.2, 0.136, 0.22]} />
          <meshBasicMaterial color="#202a30" fog={false} />
        </mesh>
        <mesh position={[-hw - 0.04, 0, 0.02]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[0.1, height + 0.08, 0.24]} />
          <meshBasicMaterial color="#192126" fog={false} />
        </mesh>
        <mesh position={[hw + 0.04, 0, 0.02]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[0.1, height + 0.08, 0.24]} />
          <meshBasicMaterial color="#192126" fog={false} />
        </mesh>

        {/* Inner Steel Frame, 2 Vertical Mullions (3-Wide), Upper Transom & Bolted Gusset Plates */}
        <mesh position={[0, hh - 0.02, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[width + 0.02, 0.065, 0.13]} />
          <meshBasicMaterial color="#2b373f" fog={false} />
        </mesh>
        <mesh position={[0, -hh + 0.02, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[width + 0.02, 0.065, 0.13]} />
          <meshBasicMaterial color="#2b373f" fog={false} />
        </mesh>
        <mesh position={[-hw + 0.02, 0, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[0.065, height, 0.13]} />
          <meshBasicMaterial color="#2b373f" fog={false} />
        </mesh>
        <mesh position={[hw - 0.02, 0, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[0.065, height, 0.13]} />
          <meshBasicMaterial color="#2b373f" fog={false} />
        </mesh>
        <mesh position={[0, transomY, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[width - 0.04, 0.048, 0.12]} />
          <meshBasicMaterial color="#2b373f" fog={false} />
        </mesh>

        {mullionXs.map((mx, idx) => (
          <group key={`gallery-mullion-${idx}`}>
            <mesh position={[mx, 0, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[0.056, height - 0.04, 0.13]} />
              <meshBasicMaterial color="#253037" fog={false} />
            </mesh>
            {/* Bolted Steel Gusset Plate at Mullion-Transom Intersection */}
            <mesh position={[mx, transomY, 0.095]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[0.13, 0.13, 0.018]} />
              <meshBasicMaterial color="#394750" fog={false} />
            </mesh>
            {[
              [-0.042, 0.042],
              [0.042, 0.042],
              [-0.042, -0.042],
              [0.042, -0.042],
            ].map(([bx, by], bIdx) => (
              <mesh
                key={`gusset-bolt-${idx}-${bIdx}`}
                position={[mx + bx, transomY + by, 0.106]}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[0.014, 0.014]} />
                <meshBasicMaterial color="#a89258" fog={false} />
              </mesh>
            ))}
            {/* Bottom Mullion Gusset Shoe */}
            <mesh position={[mx, -hh + 0.05, 0.095]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[0.12, 0.08, 0.018]} />
              <meshBasicMaterial color="#394750" fog={false} />
            </mesh>
          </group>
        ))}

        {/* Subtle Corner Frost & Condensation Strips Along Narrow Bottom & Upper Pane Corners */}
        <mesh position={[0, -hh + 0.065, 0.02]} renderOrder={5} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <planeGeometry args={[width - 0.08, 0.11]} />
          <meshBasicMaterial
            map={frostEdgeTex}
            transparent
            opacity={0.7}
            depthWrite={false}
            fog={false}
          />
        </mesh>
        <mesh
          position={[0, hh - 0.06, 0.02]}
          rotation={[0, 0, Math.PI]}
          renderOrder={5}
          raycast={NOOP_RAYCAST}
          frustumCulled={false}
        >
          <planeGeometry args={[width - 0.08, 0.08]} />
          <meshBasicMaterial
            map={frostEdgeTex}
            transparent
            opacity={0.5}
            depthWrite={false}
            fog={false}
          />
        </mesh>

        {/* Mullion-Mounted Soviet Frost Thermometer & Dosimeter Box (KGS-84) */}
        <group position={[mullionXs[0], -0.08, 0.12]}>
          <mesh raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[0.125, 0.27, 0.045]} />
            <meshBasicMaterial color="#2b3a34" fog={false} />
          </mesh>
          <mesh position={[0, 0, 0.036]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <planeGeometry args={[0.11, 0.245]} />
            <meshBasicMaterial
              map={thermometerTex}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
              fog={false}
            />
          </mesh>
          <mesh position={[-0.035, -0.49, -0.005]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <cylinderGeometry args={[0.007, 0.007, 0.72, 6]} />
            <meshBasicMaterial color="#3b4a44" fog={false} />
          </mesh>
        </group>

        {/* Interior Painted-Steel Finned Radiator Pipe & Cable Conduit Along Lower Frame */}
        <group>
          {/* Slim Painted Steel Electrical Sensor Conduit & Junction Box */}
          <mesh
            position={[0, -hh - 0.085, 0.105]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.009, 0.009, width + 0.08, 6]} />
            <meshBasicMaterial color="#3b4a44" fog={false} />
          </mesh>
          <mesh
            position={[mullionXs[0], -hh - 0.085, 0.115]}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <boxGeometry args={[0.06, 0.055, 0.035]} />
            <meshBasicMaterial color="#26332e" fog={false} />
          </mesh>

          {/* Main Horizontal Painted-Steel Steam Radiator Pipe */}
          <mesh
            position={[0, -hh - 0.145, 0.145]}
            rotation={[0, 0, Math.PI / 2]}
            raycast={NOOP_RAYCAST}
            frustumCulled={false}
          >
            <cylinderGeometry args={[0.026, 0.026, width + 0.16, 8]} />
            <meshBasicMaterial color="#2a3832" fog={false} />
          </mesh>

          {/* 4 Cast-Iron Wall Clamp Brackets */}
          {[-1.68, -0.74, 0.74, 1.68].map((bx, idx) => (
            <mesh
              key={`rad-bracket-${idx}`}
              position={[bx, -hh - 0.145, 0.115]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.032, 0.075, 0.075]} />
              <meshBasicMaterial color="#192126" fog={false} />
            </mesh>
          ))}

          {/* 28 Stamped Steel Radiator Fin Banks Flanking the Central Plaque */}
          {radiatorFinXs.map((fx, idx) => (
            <mesh
              key={`rad-fin-${idx}`}
              position={[fx, -hh - 0.145, 0.145]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.012, 0.095, 0.088]} />
              <meshBasicMaterial color={idx % 2 === 0 ? "#23312b" : "#33453d"} fog={false} />
            </mesh>
          ))}

          {/* Crimson Cast-Iron Shutoff Handwheel Valve */}
          <group position={[hw - 0.06, -hh - 0.145, 0.195]}>
            <mesh
              position={[0, 0, -0.025]}
              rotation={[Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <cylinderGeometry args={[0.012, 0.014, 0.05, 6]} />
              <meshBasicMaterial color="#222b2f" fog={false} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <cylinderGeometry args={[0.044, 0.044, 0.014, 10, 1, true]} />
              <meshBasicMaterial color="#ff2a2a" side={THREE.DoubleSide} fog={false} />
            </mesh>
            <mesh raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[0.084, 0.012, 0.012]} />
              <meshBasicMaterial color="#b81e1e" fog={false} />
            </mesh>
            <mesh raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[0.012, 0.084, 0.012]} />
              <meshBasicMaterial color="#b81e1e" fog={false} />
            </mesh>
          </group>
        </group>

        {/* Bolted Brass Gallery Sill Decree Plaque (0.02m proud of z=0.16 vertical sill apron, zero tilt clipping) */}
        <group position={[0, -hh - 0.048, 0.172]} rotation={[0, 0, 0]}>
          <mesh raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[1.38, 0.13, 0.016]} />
            <meshBasicMaterial color="#8c7a4b" fog={false} />
          </mesh>
          <mesh position={[0, 0, 0.011]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <planeGeometry args={[1.34, 0.115]} />
            <meshBasicMaterial
              map={plaqueTex}
              polygonOffset={true}
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
              fog={false}
            />
          </mesh>
        </group>
      </group>
    );
  });

const COLOR_WHITE = new THREE.Color("#ffffff");
const COLOR_STEAM_CHERENKOV = new THREE.Color("#4ae8ff");
const COLOR_VIP_ON = new THREE.Color("#ffe170");
const COLOR_VIP_OFF = new THREE.Color("#181510");
const COLOR_STAR_1_ON = new THREE.Color("#ff2a2a");
const COLOR_STAR_2_ON = new THREE.Color("#ff4433");
const COLOR_STAR_OFF = new THREE.Color("#260808");
const COLOR_BEACON_ON = new THREE.Color("#ff1e1e");
const COLOR_BEACON_OFF = new THREE.Color("#240404");
const COLOR_SIGN_OFF = new THREE.Color("#211212");
const COLOR_FACTORY_OFF = new THREE.Color("#14181e");
const COLOR_WIN_OFF = new THREE.Color("#090e14");
const COLOR_LAMP_ON = new THREE.Color("#ffba52");
const COLOR_LAMP_OFF = new THREE.Color("#0e1319");
const COLOR_ROAD_LAMP_ON = new THREE.Color("#ff9b38");
const COLOR_ROAD_POOL_OFF = new THREE.Color("#000000");
const COLOR_TRAIN_WIN_ON = new THREE.Color("#ffd066");
const COLOR_TRAIN_WIN_OFF = new THREE.Color("#10161e");
const COLOR_TRAIN_BEAM_ON = new THREE.Color("#ffe598");
const COLOR_HEADLIGHT = new THREE.Color("#fff4d2");
const COLOR_TAILLIGHT = new THREE.Color("#ff2424");
const SCRATCH_COLOR = new THREE.Color();

// Converts virtual world elevation (`0` = bunker floor, `1.65` = standing eye height,
// `1.05` = window sill, `-9.5` = plant yard, `-11.0` = foreground valley) to stage-local Y.
const Y = (worldMeters: number): number => worldMeters - 1.65;

function smoothstep01(t: number): number {
  const u = THREE.MathUtils.clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

function smoothSeg(d: number, d0: number, d1: number, v0: number, v1: number): number {
  return THREE.MathUtils.lerp(v0, v1, smoothstep01((d - d0) / (d1 - d0)));
}

function hPlantProfile(d: number): number {
  if (d <= 14.5) {
    return THREE.MathUtils.lerp(-10.95, -10.75, smoothstep01(d / 14.5));
  }
  if (d <= 24.8) {
    return smoothSeg(d, 14.5, 24.8, -10.75, -9.85);
  }
  if (d <= 36.2) {
    return smoothSeg(d, 24.8, 36.2, -9.85, 0.35);
  }
  return smoothSeg(d, 36.2, 48.5, 0.35, 1.2);
}

function hCityProfile(d: number): number {
  if (d <= 8.0) {
    return THREE.MathUtils.lerp(-10.95, -9.2, smoothstep01(d / 8.0));
  }
  if (d <= 16.0) {
    return smoothSeg(d, 8.0, 16.0, -9.2, -5.2);
  }
  if (d <= 23.0) {
    return smoothSeg(d, 16.0, 23.0, -5.2, -2.5);
  }
  if (d <= 31.0) {
    return smoothSeg(d, 23.0, 31.0, -2.5, 0.55);
  }
  return smoothSeg(d, 31.0, 48.0, 0.55, 1.25);
}

/**
 * Single continuous exterior terrain elevation `getExteriorHeight(x, z)` in world meters.
 * Smoothly bridges the `+X` RBMK cooling/switchyard valley, the `+Z` countryside river/highway
 * valley, and a rolling snow-dusted forest ridge across the `+X / +Z` outer diagonal corner.
 */
function getExteriorHeight(x: number, z: number): number {
  const dx = Math.max(0, x - 6.0);
  const dz = Math.max(0, z - 4.5);
  const rCorner = Math.hypot(dx, dz);
  const phi = dx === 0 && dz === 0 ? Math.PI * 0.25 : Math.atan2(dz, dx);
  const sPhi = smoothstep01((phi - 0.48) / (1.32 - 0.48));

  let y = THREE.MathUtils.lerp(hPlantProfile(rCorner), hCityProfile(rCorner), sPhi);

  // Sculpted +X / +Z diagonal rolling forest ridge (x > 8, z > 8) clearing roads & canal
  const wZClear = smoothstep01((z - 13.7 + Math.max(0, x - 24.5) * 0.42) / 3.8);
  const wXClear = smoothstep01((x - 8.2) / 4.2);
  const wRad =
    smoothstep01((rCorner - 5.5) / 5.5) * (1 - smoothstep01((rCorner - 26.0) / 8.0));
  const ridgeWave =
    2.35 +
    0.55 * Math.sin(x * 0.19 + z * 0.15 + 0.6) +
    0.35 * Math.cos(x * 0.31 - z * 0.24);
  y += wXClear * wZClear * wRad * ridgeWave;

  // Forested hillside tunnel bluff enclosing Window 2's eastern viaduct portal (x ~ 14.2..21.5, z ~ 23)
  const bx = (x - 17.8) / 4.6;
  const bz = (z - 23.2) / 4.4;
  const bDist2 = bx * bx + bz * bz;
  const bluff = bDist2 < 1 ? (1 - bDist2) * (1 - bDist2) * 4.35 : 0;
  y += bluff * smoothstep01((x - 12.0) / 2.6);

  // Smooth embankment trough under Window 1's freight rail viaduct (worldX ~ 30.2) up to its tunnel portal (worldZ = 17.6)
  const railMaskX = 1 - smoothstep01((Math.abs(x - 30.2) - 1.2) / 5.2);
  const railMaskZ = 1 - smoothstep01((z - 14.2) / 3.4);
  const railMask = railMaskX * railMaskZ;
  if (railMask > 0) {
    y = THREE.MathUtils.lerp(y, Math.min(y, -9.85), railMask);
  }

  // Gentle natural snowdrift swells along the distant hillside behind the cooling towers
  const farHillMask = smoothstep01((rCorner - 25.0) / 5.5) * (1 - smoothstep01((rCorner - 44.0) / 5.0));
  if (farHillMask > 0) {
    y +=
      farHillMask *
      (0.26 * Math.sin(z * 0.12 + x * 0.06) +
        0.16 * Math.cos(z * 0.19 - x * 0.08));
  }

  // Natural outer flank hills along far north (+X window left) and far west (+Z window right)
  const northFlank =
    smoothstep01((-11.5 - z) / 6.0) *
    smoothstep01((x - 14.0) / 6.0) *
    (1.05 +
      0.55 * Math.sin(z * 0.18 + x * 0.11) +
      0.32 * Math.cos(z * 0.33 - x * 0.17));
  const westFlank =
    smoothstep01((-7.5 - x) / 6.0) *
    smoothstep01((z - 10.5) / 6.0) *
    (1.05 +
      0.55 * Math.sin(x * 0.17 + z * 0.12) +
      0.32 * Math.cos(x * 0.29 - z * 0.19));
  y += northFlank + westFlank;

  // Far outer horizon mountain silhouette rim strictly behind all Distillery & Worker City skylines
  const dHorizon = Math.max(dx, dz);
  if (dHorizon > 39.2) {
    y +=
      smoothstep01((dHorizon - 39.2) / 4.8) *
      (1.65 +
        0.75 * Math.sin(phi * 9.0 + 0.8) +
        0.42 * Math.cos((x - z) * 0.16));
  }

  return y;
}

// World-coordinate adapters for Window 1 (+X) and Window 2 (+Z) stage-local coordinates
const win1GroundY = (lx: number, lz: number): number =>
  getExteriorHeight(6.0 - lz, 0.2 + lx);

const win2GroundY = (lx: number, lz: number): number =>
  getExteriorHeight(3.5 - lx, 4.5 - lz);

const coolingCanalCenterZ = (x: number): number => {
  const u = THREE.MathUtils.clamp((x + 29.0) / 50.5, 0, 1);
  return (
    -16.35 +
    Math.sin(u * Math.PI * 2.35 + 0.55) * 1.15 -
    Math.sin(u * Math.PI) * 0.65
  );
};

const coolingCanalHalfZ = (x: number): number => {
  const u = THREE.MathUtils.clamp((x + 29.0) / 50.5, 0, 1);
  return 1.25 + 0.75 * Math.sin(u * Math.PI * 1.3 + 0.25);
};

const highwayCenterX = (z: number): number => {
  const u = THREE.MathUtils.clamp((-z - 2.5) / 30.0, 0, 1);
  return -2.4 + Math.sin(u * Math.PI * 2.1 + 0.3) * 2.6 + u * 2.4;
};

const highwayHalfWidth = (z: number): number => {
  const u = THREE.MathUtils.clamp((-z - 2.5) / 30.0, 0, 1);
  return THREE.MathUtils.lerp(0.85, 0.36, u);
};

function createSnowPineTexture(): THREE.CanvasTexture {
  return createNearestCanvasTexture(64, 96, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#100d0b";
    ctx.fillRect(29, h - 16, 6, 16);
    const tiers = [
      { yTop: 6, yBot: 30, halfW: 11 },
      { yTop: 22, yBot: 48, halfW: 17 },
      { yTop: 38, yBot: 66, halfW: 22 },
      { yTop: 54, yBot: 82, halfW: 27 },
    ];
    for (const tier of tiers) {
      ctx.fillStyle = "#0b131c";
      ctx.beginPath();
      ctx.moveTo(w / 2, tier.yTop);
      ctx.lineTo(w / 2 + tier.halfW, tier.yBot);
      ctx.lineTo(w / 2 - tier.halfW, tier.yBot);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#5a7892";
      ctx.beginPath();
      ctx.moveTo(w / 2, tier.yTop);
      ctx.lineTo(
        w / 2 + tier.halfW * 0.68,
        tier.yTop + (tier.yBot - tier.yTop) * 0.42,
      );
      ctx.lineTo(
        w / 2 - tier.halfW * 0.44,
        tier.yTop + (tier.yBot - tier.yTop) * 0.34,
      );
      ctx.closePath();
      ctx.fill();
    }
  });
}

function createCrossedPineGeometry(
  width = 1.22,
  height = 1.95,
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const positions = new Float32Array([
    // Plane 1 (XY)
    -hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0,
    // Plane 2 (ZY)
    0, -hh, -hw, 0, -hh, hw, 0, hh, hw, 0, hh, -hw,
  ]);
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * True elliptical radial alpha glow reaching strictly `rgba(0,0,0,0)` by 76% (< 80%)
 * of canvas width and height so curved additive horizon backdrops never show rectangle cutoffs.
 */
function createFeatheredHorizonGlowTexture(
  innerRgba: string,
  midRgba: string,
  outerRgba: string,
): THREE.CanvasTexture {
  return createNearestCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.scale(w * 0.38, h * 0.38);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.0);
    grad.addColorStop(0.0, innerRgba);
    grad.addColorStop(0.38, midRgba);
    grad.addColorStop(0.72, outerRgba);
    grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function createUnifiedNightSkyTexture(): THREE.CanvasTexture {
  return createNearestCanvasTexture(2048, 512, (ctx, w, h) => {
    // Cylinder spans worldY = +28.5m (v=0) down to -14.5m (v=1), height = 43.0m, horizon (+1.15m) at 0.636
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, "#050a14");
    grad.addColorStop(0.34, "#07101e");
    grad.addColorStop(0.51, "#0c1b2e");
    grad.addColorStop(0.636, "#16293d");
    grad.addColorStop(0.76, "#101e2e");
    grad.addColorStop(1.0, "#070d15");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle winter starfield across upper sky (strictly above horizon)
    for (let i = 0; i < 480; i++) {
      const sx = (i * 211 + 47) % w;
      const sy = (i * 67 + 19) % Math.floor(h * 0.59);
      ctx.fillStyle =
        i % 9 === 0 ? "#e6f2ff" : i % 3 === 0 ? "#9bbbd9" : "#5e7a96";
      ctx.fillRect(sx, sy, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
    }

    // Crisp winter moon & circular halo (scaled for 1:1 roundness on 54m x 43m cylinder)
    const moonX = w * 0.39;
    const moonY = h * 0.34;
    const aspectScaleX = (43.0 * w) / (305.36 * h);
    ctx.save();
    ctx.translate(moonX, moonY);
    ctx.scale(aspectScaleX, 1);
    const moonGlow = ctx.createRadialGradient(0, 0, 4, 0, 0, 96);
    moonGlow.addColorStop(0, "rgba(218, 236, 255, 0.44)");
    moonGlow.addColorStop(0.32, "rgba(130, 174, 218, 0.16)");
    moonGlow.addColorStop(1, "rgba(22, 41, 61, 0)");
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dbeeff";
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = "#f2f8ff";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  });
}

function createUnifiedSnowDetailTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#f4f8fc";
    ctx.fillRect(0, 0, 512, 512);

    // Subtle tile-safe radial snowdrift clouds (zero sharp rects or axis-aligned stripes)
    for (let i = 0; i < 18; i++) {
      const cx = 72 + ((i * 157 + 41) % 368);
      const cy = 72 + ((i * 199 + 83) % 368);
      const radius = 64 + ((i * 29) % 48);
      const isHighlight = i % 2 === 0;
      const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius);
      g.addColorStop(
        0,
        isHighlight ? "rgba(255, 255, 255, 0.035)" : "rgba(196, 214, 234, 0.04)",
      );
      g.addColorStop(1, "rgba(244, 248, 252, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const COLOR_SNOW_LOW = new THREE.Color("#182638");
const COLOR_SNOW_HIGH = new THREE.Color("#293d54");
const COLOR_SNOW_SWITCHYARD = new THREE.Color("#121d2b");

function getExteriorVertexColor(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  target: THREE.Color,
): void {
  const rCorner = Math.hypot(Math.max(0, x - 6.0), Math.max(0, z - 4.5));
  const heightT = THREE.MathUtils.clamp((y + 10.8) / 11.6, 0, 1);
  const distT = smoothstep01((rCorner - 14.0) / 26.0);
  const driftSwell =
    0.045 *
    Math.sin(x * 0.075 + z * 0.065) *
    Math.cos(z * 0.05 - x * 0.04);
  const snowT = THREE.MathUtils.clamp(
    0.72 * heightT + 0.28 * distT + driftSwell,
    0,
    1,
  );
  target.lerpColors(COLOR_SNOW_LOW, COLOR_SNOW_HIGH, snowT);

  // Subtle plowed industrial concrete/slate tint in the +X switchyard basin
  const switchyardT =
    smoothstep01((x - 6.5) / 4.0) *
    (1 - smoothstep01((z - 12.0) / 4.5)) *
    (1 - smoothstep01((y + 10.2) / 1.4));
  if (switchyardT > 0) {
    target.lerp(COLOR_SNOW_SWITCHYARD, switchyardT);
  }

  // Gentle moonlit directional shading using smoothed terrain vertex normals
  const moonDot = THREE.MathUtils.clamp(
    nx * -0.34 + ny * 0.88 + nz * -0.33,
    0,
    1,
  );
  const moonShade = THREE.MathUtils.lerp(0.92, 1.06, moonDot);
  target.multiplyScalar(moonShade);
}

/**
 * Builds ONE continuous displaced exterior terrain mesh covering the entire L-quadrant
 * outside the bunker walls (`x >= 6.08 || z >= 4.58`) out to `r <= 54.2m`.
 */
function createUnifiedExteriorTerrainGeometry(): THREE.BufferGeometry {
  const xs: number[] = [];
  const zs: number[] = [];

  const nxLeft = 88;
  for (let i = 0; i < nxLeft; i++) {
    xs.push(THREE.MathUtils.lerp(-52.0, 6.08, i / nxLeft));
  }
  const nxRight = 112;
  for (let i = 0; i <= nxRight; i++) {
    xs.push(THREE.MathUtils.lerp(6.08, 54.0, i / nxRight));
  }

  const nzBack = 96;
  for (let i = 0; i < nzBack; i++) {
    zs.push(THREE.MathUtils.lerp(-44.0, 4.58, i / nzBack));
  }
  const nzFront = 96;
  for (let i = 0; i <= nzFront; i++) {
    zs.push(THREE.MathUtils.lerp(4.58, 54.0, i / nzFront));
  }

  const stride = xs.length;
  const vertMap = new Int32Array(stride * zs.length).fill(-1);
  const posList: number[] = [];
  const uvList: number[] = [];
  const indices: number[] = [];

  const getVertex = (ix: number, iz: number): number => {
    const slot = iz * stride + ix;
    const existing = vertMap[slot];
    if (existing >= 0) return existing;

    const vx = xs[ix];
    const vz = zs[iz];
    const vy = getExteriorHeight(vx, vz);

    const idx = posList.length / 3;
    vertMap[slot] = idx;
    posList.push(vx, vy, vz);
    uvList.push(vx / 32.0, vz / 32.0);
    return idx;
  };

  for (let iz = 0; iz < zs.length - 1; iz++) {
    const z0 = zs[iz];
    const z1 = zs[iz + 1];
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const x0 = xs[ix];
      const x1 = xs[ix + 1];

      // Cleanly mask out the indoor bunker & blind back quadrant (`x <= 6.05 && z <= 4.55`)
      if (x0 < 6.075 && z0 < 4.575) continue;

      // Skip cells wholly outside the 54m sky cylinder
      if (
        Math.hypot(x0, z0) > 54.2 &&
        Math.hypot(x1, z0) > 54.2 &&
        Math.hypot(x0, z1) > 54.2 &&
        Math.hypot(x1, z1) > 54.2
      ) {
        continue;
      }

      const a = getVertex(ix, iz);
      const b = getVertex(ix + 1, iz);
      const cIdx = getVertex(ix, iz + 1);
      const d = getVertex(ix + 1, iz + 1);
      indices.push(a, cIdx, b, b, cIdx, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posList, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvList, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const normAttr = geo.getAttribute("normal");
  const vCount = posList.length / 3;
  const colList = new Float32Array(vCount * 3);
  const c = new THREE.Color();
  for (let i = 0; i < vCount; i++) {
    const vx = posList[i * 3];
    const vy = posList[i * 3 + 1];
    const vz = posList[i * 3 + 2];
    const nx = normAttr.getX(i);
    const ny = normAttr.getY(i);
    const nz = normAttr.getZ(i);
    getExteriorVertexColor(vx, vy, vz, nx, ny, nz, c);
    colList[i * 3] = c.r;
    colList[i * 3 + 1] = c.g;
    colList[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colList, 3));

  return geo;
}

/**
 * Single seamless wraparound sky shell, under-floor skirt, unified continuous terrain mesh,
 * and 3D crossed-pine forest bridging the `+X / +Z` outer diagonal ridge.
 */
const UnifiedExteriorWorld3D: React.FC = React.memo(() => {
  const cornerPinesRef = useRef<THREE.InstancedMesh>(null);

  const skyTex = useMemo(() => createUnifiedNightSkyTexture(), []);
  const snowDetailTex = useMemo(() => createUnifiedSnowDetailTexture(), []);
  const pineTex = useMemo(() => createSnowPineTexture(), []);
  const terrainGeo = useMemo(() => createUnifiedExteriorTerrainGeometry(), []);
  const crossedPineGeo = useMemo(() => createCrossedPineGeometry(1.22, 1.95), []);

  const cornerPineSpecs = useMemo(() => {
    const seeded = (n: number) => {
      const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    const trees: Array<{
      x: number;
      y: number;
      z: number;
      scale: number;
      rotY: number;
    }> = [];
    let guard = 0;
    let seed = 0;
    while (trees.length < 210 && guard < 1800) {
      guard++;
      seed++;
      const px = THREE.MathUtils.lerp(7.8, 41.0, seeded(seed * 13 + 5));
      const pz = THREE.MathUtils.lerp(7.8, 39.0, seeded(seed * 29 + 11));
      const rCorner = Math.hypot(px - 6.0, pz - 4.5);
      if (rCorner < 5.5 || rCorner > 36.5) continue;

      // Clear Window 1 Unit 3 block, switchyard/road/canal, VIP pipeline, Distillery & rail corridor
      if (px < 16.0 && pz < 10.2) continue;
      if (px < 25.0 && pz < 14.8) continue;
      if (pz < 10.8 && px < 41.0) continue;
      if (px > 37.5 && pz < 17.5) continue;
      if (Math.abs(px - 30.2) < 1.8 && pz < 18.4) continue;
      if (Math.hypot(px - 19.3, pz - 14.0) < 1.8) continue;

      // Clear Window 2 highway, viaduct approach, tunnel mouth & city outskirts
      if (px < 9.2) continue;
      if (Math.abs(pz - 23.0) < 1.3 && px < 14.6) continue;
      if (Math.hypot(px - 14.3, pz - 23.0) < 1.9) continue;
      if (pz > 35.2 && px < 30.5) continue;

      const scale =
        THREE.MathUtils.lerp(1.42, 0.72, THREE.MathUtils.clamp((rCorner - 6.0) / 30.0, 0, 1)) *
        (0.82 + seeded(seed * 7 + 3) * 0.42);
      const groundY = getExteriorHeight(px, pz);
      trees.push({
        x: px,
        y: groundY + scale * 0.82,
        z: pz,
        scale,
        rotY: seeded(seed * 19 + 1) * Math.PI * 0.5,
      });
    }
    return trees;
  }, []);

  useEffect(() => {
    if (cornerPinesRef.current) {
      const dummy = new THREE.Object3D();
      cornerPinesRef.current.count = cornerPineSpecs.length;
      cornerPineSpecs.forEach((p, idx) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.rotY, 0);
        dummy.scale.set(p.scale, p.scale, p.scale);
        dummy.updateMatrix();
        cornerPinesRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      cornerPinesRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [cornerPineSpecs]);

  useEffect(() => {
    return () => {
      skyTex.dispose();
      snowDetailTex.dispose();
      pineTex.dispose();
      terrainGeo.dispose();
      crossedPineGeo.dispose();
    };
  }, [skyTex, snowDetailTex, pineTex, terrainGeo, crossedPineGeo]);

  return (
    <group>
      {/* Single Seamless Curved Night-Sky Cylinder Around Control Room (Radius 54m, >40° Margin Both Ends) */}
      <mesh position={[0, 7.0, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
        <cylinderGeometry
          args={[54.0, 54.0, 43.0, 72, 1, true, -Math.PI * 0.65, Math.PI * 1.8]}
        />
        <meshBasicMaterial map={skyTex} side={THREE.BackSide} fog={false} />
      </mesh>

      {/* Zenith Night Cap */}
      <mesh
        position={[0, 28.45, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <circleGeometry args={[54.4, 48]} />
        <meshBasicMaterial color="#050a14" fog={false} />
      </mesh>

      {/* Dark Under-Floor Skirt Below y = -13m */}
      <mesh
        position={[0, -13.6, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <circleGeometry args={[54.6, 64]} />
        <meshBasicMaterial color="#070d15" fog={false} />
      </mesh>

      {/* Single Unified Continuous Displaced Terrain Mesh */}
      <mesh geometry={terrainGeo} raycast={NOOP_RAYCAST} frustumCulled={false}>
        <meshBasicMaterial map={snowDetailTex} vertexColors fog={false} />
      </mesh>

      {/* 3D Crossed-Plane Snow-Dusted Pine Forest on the +X / +Z Rolling Ridge */}
      <instancedMesh
        ref={cornerPinesRef}
        args={[crossedPineGeo, undefined, 210]}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <meshBasicMaterial
          map={pineTex}
          alphaTest={0.5}
          side={THREE.DoubleSide}
          fog={false}
        />
      </instancedMesh>
    </group>
  );
});

function createValleyRibbonGeometry(
  centerXFn: (z: number) => number,
  halfWidthFn: (z: number) => number,
  zStart: number,
  zEnd: number,
  segments: number,
  yOffset: number,
): THREE.BufferGeometry {
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = THREE.MathUtils.lerp(zStart, zEnd, t);
    const cx = centerXFn(z);
    const hw = halfWidthFn(z);
    const xLeft = cx - hw;
    const xRight = cx + hw;
    const yLeft = Y(win2GroundY(xLeft, z) + yOffset);
    const yRight = Y(win2GroundY(xRight, z) + yOffset);

    const vBase = i * 6;
    positions[vBase] = xLeft;
    positions[vBase + 1] = yLeft;
    positions[vBase + 2] = z;
    positions[vBase + 3] = xRight;
    positions[vBase + 4] = yRight;
    positions[vBase + 5] = z;

    const uvBase = i * 4;
    uvs[uvBase] = 0;
    uvs[uvBase + 1] = t * 6.0;
    uvs[uvBase + 2] = 1;
    uvs[uvBase + 3] = t * 6.0;

    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createPowerCorridorWiresGeometry(
  poles: Array<{ x: number; z: number; topY: number }>,
  offsetsX: number[],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const steps = 10;
  let vertCount = 0;

  for (let p = 0; p < poles.length - 1; p++) {
    const p0 = poles[p];
    const p1 = poles[p + 1];
    for (const ox of offsetsX) {
      const startVert = vertCount;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const wx = THREE.MathUtils.lerp(p0.x, p1.x, u) + ox;
        const wz = THREE.MathUtils.lerp(p0.z, p1.z, u);
        const wy =
          THREE.MathUtils.lerp(p0.topY, p1.topY, u) -
          Math.sin(u * Math.PI) * 0.24;
        positions.push(wx, wy - 0.014, wz, wx, wy + 0.014, wz);
        vertCount += 2;
        if (s < steps) {
          const i0 = startVert + s * 2;
          indices.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function createSoftSteamPuffTexture(
  coreAlpha: number,
  midAlpha: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    const lobes = [
      { x: 128, y: 132, r: 96, a: coreAlpha },
      { x: 96, y: 124, r: 68, a: midAlpha },
      { x: 162, y: 122, r: 66, a: midAlpha },
      { x: 126, y: 98, r: 64, a: midAlpha * 0.9 },
    ];
    for (const l of lobes) {
      const g = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(216, 230, 242, ${l.a.toFixed(3)})`);
      g.addColorStop(0.52, `rgba(176, 198, 218, ${(l.a * 0.45).toFixed(3)})`);
      g.addColorStop(1, "rgba(140, 166, 192, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createFloodPoolTexture(tint: string): THREE.CanvasTexture {
  return createNearestCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * 0.48);
    g.addColorStop(0, tint);
    g.addColorStop(0.55, "rgba(255, 165, 65, 0.25)");
    g.addColorStop(1, "rgba(255, 165, 65, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function createBeaconHaloTexture(): THREE.CanvasTexture {
  return createNearestCanvasTexture(32, 32, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w * 0.48);
    g.addColorStop(0, "rgba(255, 60, 48, 0.92)");
    g.addColorStop(0.45, "rgba(255, 30, 30, 0.4)");
    g.addColorStop(1, "rgba(255, 30, 30, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function createPlantRibbonGeometry(
  centerZFn: (x: number) => number,
  halfZFn: (x: number) => number,
  xStart: number,
  xEnd: number,
  segments: number,
  yOffset: number,
): THREE.BufferGeometry {
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = THREE.MathUtils.lerp(xStart, xEnd, t);
    const cz = centerZFn(x);
    const hz = halfZFn(x);
    const zBack = cz - hz;
    const zFront = cz + hz;
    const yBack = Y(win1GroundY(x, zBack) + yOffset);
    const yFront = Y(win1GroundY(x, zFront) + yOffset);

    const vBase = i * 6;
    positions[vBase] = x;
    positions[vBase + 1] = yBack;
    positions[vBase + 2] = zBack;
    positions[vBase + 3] = x;
    positions[vBase + 4] = yFront;
    positions[vBase + 5] = zFront;

    const uvBase = i * 4;
    uvs[uvBase] = t * 7.5;
    uvs[uvBase + 1] = 0;
    uvs[uvBase + 2] = t * 7.5;
    uvs[uvBase + 3] = 1;

    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createCoolingTowerLatheGeometry(): THREE.LatheGeometry {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(4.22, 0.95),
    new THREE.Vector2(3.62, 2.9),
    new THREE.Vector2(3.08, 5.1),
    new THREE.Vector2(2.66, 7.2),
    new THREE.Vector2(2.48, 8.85),
    new THREE.Vector2(2.6, 10.25),
    new THREE.Vector2(2.78, 11.5),
  ];
  return new THREE.LatheGeometry(profile, 24);
}

function createSovietStarGeometry(
  outerR = 0.78,
  innerR = 0.32,
  halfDepth = 0.12,
): THREE.BufferGeometry {
  const perimeter: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    perimeter.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }

  const positions: number[] = [];
  for (let i = 0; i < 10; i++) {
    const [x0, y0] = perimeter[i];
    const [x1, y1] = perimeter[(i + 1) % 10];
    // Front (+Z) facet
    positions.push(0, 0, halfDepth, x0, y0, 0, x1, y1, 0);
    // Back (-Z) facet
    positions.push(0, 0, -halfDepth, x1, y1, 0, x0, y0, 0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Unobstructed downward-sightline Window 1 exterior sill:
 * narrow 0.15m weathered steel drip-ledge + sheer flush bunker wall dropping to -11m,
 * plus a low tucked-down steam pipe and safety grab-rail well below sill (`worldY < 0.85m`).
 */
const Win1SteelDripAndPipeLedge3D: React.FC = React.memo(() => {
  const stanchionXs = [-2.2, -1.45, -0.7, 0.05, 0.8, 1.56, 2.3];
  const collarXs = [-2.4, -1.2, 0.0, 1.2, 2.4];

  return (
    <group>
      {/* Narrow 0.15m weathered steel drip-ledge tilted downward below window sill */}
      <group position={[0, -0.98, -0.075]} rotation={[-0.42, 0, 0]}>
        <mesh raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[4.04, 0.018, 0.15]} />
          <meshBasicMaterial color="#1e2933" fog={false} />
        </mesh>
        <mesh position={[0, 0.011, -0.055]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[4.04, 0.008, 0.036]} />
          <meshBasicMaterial color="#2d3f4f" fog={false} />
        </mesh>
      </group>

      {/* Sheer flush exterior concrete/steel bunker wall dropping down to meet unified terrain at (6.08, 4.58) */}
      <mesh position={[-0.16, -7.0, -0.08]} raycast={NOOP_RAYCAST} frustumCulled={false}>
        <planeGeometry args={[9.08, 12.1]} />
        <meshBasicMaterial color="#0b131c" fog={false} />
      </mesh>

      {/* Low, tucked-down insulated steel exterior pipe (worldY = 0.59m < 0.85m) */}
      <mesh
        position={[0, -1.36, -0.17]}
        rotation={[0, 0, Math.PI / 2]}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.042, 0.042, 6.6, 8]} />
        <meshBasicMaterial color="#4d6070" fog={false} />
      </mesh>
      {collarXs.map((cx, idx) => (
        <group key={`win1-pipe-collar-${idx}`} position={[cx, -1.36, -0.17]}>
          <mesh rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <cylinderGeometry args={[0.052, 0.052, 0.07, 8]} />
            <meshBasicMaterial color="#ffb000" fog={false} />
          </mesh>
          <mesh position={[0, 0, 0.06]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[0.045, 0.095, 0.085]} />
            <meshBasicMaterial color="#1c262e" fog={false} />
          </mesh>
        </group>
      ))}

      {/* Low, tucked-down tubular steel grab-rail (worldY = 0.76m / 0.67m < 0.85m, 0.22m from wall) */}
      <mesh position={[0, -1.19, -0.22]} raycast={NOOP_RAYCAST} frustumCulled={false}>
        <boxGeometry args={[5.4, 0.024, 0.024]} />
        <meshBasicMaterial color="#344654" fog={false} />
      </mesh>
      <mesh position={[0, -1.28, -0.22]} raycast={NOOP_RAYCAST} frustumCulled={false}>
        <boxGeometry args={[5.4, 0.018, 0.018]} />
        <meshBasicMaterial color="#273642" fog={false} />
      </mesh>
      {stanchionXs.map((px, idx) => (
        <group key={`win1-rail-stanchion-${idx}`}>
          <mesh position={[px, -1.29, -0.22]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[0.024, 0.21, 0.024]} />
            <meshBasicMaterial color="#2a3946" fog={false} />
          </mesh>
          <mesh position={[px, -1.38, -0.15]} raycast={NOOP_RAYCAST} frustumCulled={false}>
            <boxGeometry args={[0.026, 0.026, 0.14]} />
            <meshBasicMaterial color="#1e2a34" fog={false} />
          </mesh>
        </group>
      ))}

      {/* Tiny caged ruby indicator bulb on tucked rail at worldY = 0.80m (< 0.85m) */}
      <group position={[1.56, -1.19, -0.22]}>
        <mesh position={[0, 0.022, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <cylinderGeometry args={[0.008, 0.008, 0.044, 6]} />
          <meshBasicMaterial color="#1c262e" fog={false} />
        </mesh>
        <mesh position={[0, 0.052, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <cylinderGeometry args={[0.013, 0.015, 0.032, 8]} />
          <meshBasicMaterial color="#d92424" toneMapped={false} fog={false} />
        </mesh>
        <mesh position={[0, 0.052, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <boxGeometry args={[0.032, 0.038, 0.003]} />
          <meshBasicMaterial color="#182128" fog={false} />
        </mesh>
        <mesh position={[0, 0.052, 0.018]} renderOrder={2} raycast={NOOP_RAYCAST} frustumCulled={false}>
          <planeGeometry args={[0.08, 0.08]} />
          <meshBasicMaterial
            color="#ff3b2a"
            transparent
            opacity={0.32}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      </group>
    </group>
  );
});

/**
 * Razor-thin 0.11m dark weathered steel window drip-lip angled steeply downward below `worldY = 1.02m`
 * plus flush bunker exterior wall beneath Window 2 (`+Z` Back Wall) so downward landscape views are 100% unobstructed.
 */
const MinimalSteelDripLip3D: React.FC = React.memo(() => {
  return (
    <group>
      {/* Razor-Thin 0.11m Steeply Downward-Angled Weathered Steel Drip-Lip */}
      <mesh
        position={[0, -0.975, -0.06]}
        rotation={[-0.75, 0, 0]}
        raycast={NOOP_RAYCAST}
        frustumCulled={false}
      >
        <boxGeometry args={[3.84, 0.014, 0.11]} />
        <meshBasicMaterial color="#182026" fog={false} />
      </mesh>
      {/* Flush Dark Exterior Bunker Wall Ending Exactly at +X Outer Corner (6.08, 4.58) */}
      <mesh position={[3.46, -7.0, -0.08]} raycast={NOOP_RAYCAST} frustumCulled={false}>
        <planeGeometry args={[12.08, 12.1]} />
        <meshBasicMaterial color="#080e15" fog={false} />
      </mesh>
    </group>
  );
});

const WIN1_MAX_RIDGE_BLOCKS = 36;
const WIN1_MAX_RIDGE_WINDOWS = 280;
const WIN1_TRUCK_COUNT = 8;
const WIN1_BEACON_COUNT = 25;
const WIN1_SCRATCH_OBJ = new THREE.Object3D();

/**
 * Window 1 Elevated Bird's-Eye Industrial Panorama (`+X` Right Wall, 1:1 42m Deep Stage):
 * Tier 1 (`2m–14m`): Stepped RBMK turbine & reactor roofs, VT-2 lattice stack, 500kV switchyard, patrol trucks & Cherenkov glow.
 * Tier 2 (`15m–26m`): Ice-rimmed cooling reservoir, twin 11.5m hyperbolic cooling towers, VIP Vodka Pipeline & Spirit-Tanker train.
 * Tier 3 (`32m–39m`): Far industrial ridge & sprawling State Vodka Distillery "KRISTALL-84" with rotating 3D Red Star.
 */
const RbmkAndVodkaDiorama3D: React.FC = React.memo(() => {
  const stageGroupRef = useRef<THREE.Group>(null);
  const starGroupRef = useRef<THREE.Group>(null);
  const starAngleRef = useRef(0);
  const cherenkovRef = useRef<THREE.Group>(null);
  const cherenkovCoreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const cherenkovHaloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const cherenkovSpillMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const steamRefs = useRef<Array<THREE.Mesh | null>>([]);
  const steamMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const vipSteamRefs = useRef<Array<THREE.Mesh | null>>([]);
  const vipSteamMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const distillerySmokeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const distillerySmokeMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);

  const roofVentsRef = useRef<THREE.InstancedMesh>(null);
  const glassBlockStripsRef = useRef<THREE.InstancedMesh>(null);
  const roofLampsRef = useRef<THREE.InstancedMesh>(null);
  const roofLampPoolsRef = useRef<THREE.InstancedMesh>(null);
  const fencePostsRef = useRef<THREE.InstancedMesh>(null);
  const transformersRef = useRef<THREE.InstancedMesh>(null);
  const bushingsRef = useRef<THREE.InstancedMesh>(null);
  const yardFloodPostsRef = useRef<THREE.InstancedMesh>(null);
  const yardFloodHeadsRef = useRef<THREE.InstancedMesh>(null);
  const yardFloodPoolsRef = useRef<THREE.InstancedMesh>(null);
  const truckBodiesRef = useRef<THREE.InstancedMesh>(null);
  const truckLightsRef = useRef<THREE.InstancedMesh>(null);
  const truckHalosRef = useRef<THREE.InstancedMesh>(null);

  const win1PinesRef = useRef<THREE.InstancedMesh>(null);
  const towerStrutsRef = useRef<THREE.InstancedMesh>(null);
  const vipStanchionsRef = useRef<THREE.InstancedMesh>(null);
  const vipLampsRef = useRef<THREE.InstancedMesh>(null);
  const vipLampHalosRef = useRef<THREE.InstancedMesh>(null);
  const railYardLightsRef = useRef<THREE.InstancedMesh>(null);

  const spiritTrainGroupRef = useRef<THREE.Group>(null);
  const spiritLocoGroupRef = useRef<THREE.Group>(null);
  const spiritCarGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const spiritTrainPosXRef = useRef(-14.0);
  const spiritTrainCabMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const spiritTrainBeamMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const spiritCarGlowMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);

  const ridgeFactoriesRef = useRef<THREE.InstancedMesh>(null);
  const ridgeWindowsRef = useRef<THREE.InstancedMesh>(null);
  const win1BeaconsRef = useRef<THREE.InstancedMesh>(null);
  const win1BeaconHalosRef = useRef<THREE.InstancedMesh>(null);

  const vipLampsMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const vipLampHalosMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const distilleryHallMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const distillerySawtoothMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const distilleryColumnMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const vodkaSignMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const vodkaSignHaloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const vodkaLightPollutionMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const starMatOuterRef = useRef<THREE.MeshBasicMaterial>(null);
  const starMatInnerRef = useRef<THREE.MeshBasicMaterial>(null);
  const starHaloMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const win1BeaconTimerRef = useRef(0.125);
  const win1BeaconMaskRef = useRef(-1);
  const lastRidgePowerRatioRef = useRef(-1);
  const ridgeWinLitRef = useRef<Uint8Array>(
    new Uint8Array(WIN1_MAX_RIDGE_WINDOWS).fill(1),
  );

  const fourFaceGeo = useMemo(() => createFourFaceBoxGeometry(), []);
  const coolingTowerGeo = useMemo(() => createCoolingTowerLatheGeometry(), []);
  const sovietStarGeo = useMemo(() => createSovietStarGeometry(0.88, 0.36, 0.14), []);
  const coolingCanalRibbonGeo = useMemo(
    () =>
      createPlantRibbonGeometry(
        coolingCanalCenterZ,
        coolingCanalHalfZ,
        -29.0,
        13.8,
        56,
        0.06,
      ),
    [],
  );
  const perimeterRoadRibbonGeo = useMemo(
    () =>
      createPlantRibbonGeometry(
        () => -13.3,
        () => 0.69,
        -31.0,
        13.8,
        48,
        0.065,
      ),
    [],
  );

  // Switchyard & outgoing 500kV overhead catenary lines (turbine roof -> gantries -> pylons + cross-span)
  const switchyardWiresGeo = useMemo(() => {
    const gantryXs = [-18.0, -12.0, -6.0, 0.0, 6.0, 10.8];
    const pylonXs = [-16.0, -6.0, 4.0, 13.0];

    const positions: number[] = [];
    const indices: number[] = [];
    const steps = 10;
    let vertCount = 0;

    const pushSagWire = (
      x0: number,
      y0: number,
      z0: number,
      x1: number,
      y1: number,
      z1: number,
      sag: number,
    ) => {
      const startVert = vertCount;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const wx = THREE.MathUtils.lerp(x0, x1, u);
        const wz = THREE.MathUtils.lerp(z0, z1, u);
        const wy = THREE.MathUtils.lerp(y0, y1, u) - Math.sin(u * Math.PI) * sag;
        positions.push(wx, wy - 0.018, wz, wx, wy + 0.018, wz);
        vertCount += 2;
        if (s < steps) {
          const i0 = startVert + s * 2;
          indices.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2);
        }
      }
    };

    // Turbine roof bushings -> 6 steel gantries
    for (const gx of gantryXs) {
      const roofX = THREE.MathUtils.clamp(gx, -26.0, 7.5);
      for (const ox of [-0.55, 0, 0.55]) {
        pushSagWire(roofX + ox, Y(-6.85), -8.6, gx + ox, Y(-7.75), -11.3, 0.22);
      }
    }

    // Gantries -> 4 tall lattice transmission pylons
    const gantryToPylon: Array<[number, number]> = [
      [-18.0, -16.0],
      [-12.0, -6.0],
      [-6.0, -6.0],
      [0.0, 4.0],
      [6.0, 4.0],
      [10.8, 13.0],
    ];
    for (const [gx, px] of gantryToPylon) {
      for (const ox of [-0.7, 0, 0.7]) {
        pushSagWire(gx + ox * 0.8, Y(-7.75), -11.3, px + ox * 1.15, Y(-5.25), -14.1, 0.34);
      }
    }

    // High 500kV cross-span wires tying the 4 tall lattice pylons together
    for (let i = 0; i < pylonXs.length - 1; i++) {
      for (const ox of [-0.85, 0.0, 0.85]) {
        pushSagWire(
          pylonXs[i] + ox,
          Y(-5.25),
          -14.1,
          pylonXs[i + 1] + ox,
          Y(-5.25),
          -14.1,
          0.42,
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      fourFaceGeo.dispose();
      coolingTowerGeo.dispose();
      sovietStarGeo.dispose();
      coolingCanalRibbonGeo.dispose();
      perimeterRoadRibbonGeo.dispose();
      switchyardWiresGeo.dispose();
    };
  }, [
    fourFaceGeo,
    coolingTowerGeo,
    sovietStarGeo,
    coolingCanalRibbonGeo,
    perimeterRoadRibbonGeo,
    switchyardWiresGeo,
  ]);

  const floodPoolTex = useMemo(
    () => createFloodPoolTexture("rgba(255, 165, 62, 0.82)"),
    [],
  );
  const win1BeaconHaloTex = useMemo(() => createBeaconHaloTexture(), []);

  const tarGravelRoofTex = useMemo(() => {
    const tex = createNearestCanvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = "#152230";
      ctx.fillRect(0, 0, w, h);
      // Tar-and-gravel bay joints
      ctx.fillStyle = "#0d1620";
      for (let x = 0; x < w; x += 32) {
        ctx.fillRect(x, 0, 2, h);
      }
      for (let y = 0; y < h; y += 32) {
        ctx.fillRect(0, y, w, 2);
      }
      // Snow-drifted patches along gravel bays
      ctx.fillStyle = "#1d2e40";
      for (let i = 0; i < 24; i++) {
        const sx = (i * 37 + 7) % (w - 30);
        const sy = (i * 23 + 9) % (h - 18);
        ctx.fillRect(sx, sy, 22 + (i % 4) * 9, 10 + (i % 3) * 6);
      }
      ctx.fillStyle = "#2b4259";
      for (let i = 0; i < 12; i++) {
        const sx = (i * 53 + 15) % (w - 20);
        const sy = (i * 31 + 5) % (h - 12);
        ctx.fillRect(sx, sy, 14 + (i % 3) * 7, 6 + (i % 2) * 5);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    return tex;
  }, []);

  const concreteWallTex = useMemo(() => {
    const tex = createNearestCanvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = "#121d29";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#0d1620";
      for (let x = 0; x < w; x += 24) {
        ctx.fillRect(x, 0, 3, h);
      }
      for (let y = 0; y < h; y += 32) {
        ctx.fillRect(0, y, w, 3);
      }
      ctx.fillStyle = "#1d2e40";
      ctx.fillRect(0, 0, w, 8);
      // Subtle industrial louvers & faint warm bulkhead dots
      for (let x = 10; x < w - 10; x += 48) {
        ctx.fillStyle = "#091017";
        ctx.fillRect(x, 38, 12, 24);
        ctx.fillStyle = x % 96 === 10 ? "#ffcb6b" : "#7be8df";
        ctx.fillRect(x + 2, 18, 6, 6);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(3, 1);
    return tex;
  }, []);

  const vt2LatticeTex = useMemo(
    () =>
      createNearestCanvasTexture(64, 256, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = "#26384a";
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 2, w - 8, h - 4);
        ctx.lineWidth = 2;
        for (let y = 4; y < h - 4; y += 24) {
          ctx.beginPath();
          ctx.moveTo(4, y);
          ctx.lineTo(w - 4, y + 24);
          ctx.moveTo(w - 4, y);
          ctx.lineTo(4, y + 24);
          ctx.moveTo(4, y);
          ctx.lineTo(w - 4, y);
          ctx.stroke();
        }
      }),
    [],
  );

  const transformerTex = useMemo(
    () =>
      createNearestCanvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = "#18242e";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#263847";
        ctx.fillRect(4, 4, w - 8, 8);
        // Cooling radiator vertical fins
        ctx.fillStyle = "#0e161d";
        for (let x = 6; x < w - 6; x += 6) {
          ctx.fillRect(x, 16, 3, h - 22);
        }
        ctx.fillStyle = "#ffb000";
        ctx.fillRect(8, 12, 10, 3);
      }),
    [],
  );

  const chainLinkTex = useMemo(() => {
    const tex = createNearestCanvasTexture(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#2b3d38";
      ctx.lineWidth = 2;
      for (let d = -w; d < w * 2; d += 12) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + h, h);
        ctx.moveTo(d + h, 0);
        ctx.lineTo(d, h);
        ctx.stroke();
      }
      ctx.fillStyle = "#17221e";
      ctx.fillRect(0, 0, w, 4);
      ctx.fillRect(0, h - 4, w, 4);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(22, 1);
    return tex;
  }, []);

  const latticePylonTex = useMemo(
    () =>
      createNearestCanvasTexture(64, 160, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = "#233342";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(8, h);
        ctx.lineTo(26, 8);
        ctx.lineTo(38, 8);
        ctx.lineTo(56, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(2, 24);
        ctx.lineTo(62, 24);
        ctx.moveTo(6, 54);
        ctx.lineTo(58, 54);
        ctx.stroke();
        ctx.lineWidth = 2;
        for (let y = 24; y < h - 14; y += 22) {
          ctx.beginPath();
          ctx.moveTo(15, y);
          ctx.lineTo(49, y + 22);
          ctx.moveTo(49, y);
          ctx.lineTo(15, y + 22);
          ctx.stroke();
        }
      }),
    [],
  );

  const perimeterRoadTex = useMemo(() => {
    const tex = createNearestCanvasTexture(512, 64, (ctx, w, h) => {
      // Snow shoulders
      ctx.fillStyle = "#213346";
      ctx.fillRect(0, 0, w, h);
      // Dark plowed asphalt road
      ctx.fillStyle = "#0b1219";
      ctx.fillRect(0, 10, w, h - 20);
      ctx.fillStyle = "#121d29";
      ctx.fillRect(0, 16, w, 12);
      ctx.fillRect(0, h - 28, w, 12);
      // Dashed centerline
      ctx.fillStyle = "#7a8da0";
      for (let x = 6; x < w; x += 28) {
        ctx.fillRect(x, h / 2 - 1, 14, 2);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    return tex;
  }, []);

  const truckBeamTex = useMemo(
    () =>
      createNearestCanvasTexture(64, 32, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, h / 2, w, h / 2);
        grad.addColorStop(0, "rgba(255, 244, 198, 0.85)");
        grad.addColorStop(0.5, "rgba(255, 212, 118, 0.34)");
        grad.addColorStop(1, "rgba(255, 190, 80, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.38);
        ctx.lineTo(w, 2);
        ctx.lineTo(w, h - 2);
        ctx.lineTo(0, h * 0.62);
        ctx.closePath();
        ctx.fill();
      }),
    [],
  );

  const billboardTex = useMemo(
    () =>
      createNearestCanvasTexture(384, 96, (ctx, w, h) => {
        ctx.fillStyle = "#5c1414";
        ctx.fillRect(0, 0, w, h);
        const beam = ctx.createLinearGradient(0, h, 0, 0);
        beam.addColorStop(0, "rgba(255, 218, 128, 0.42)");
        beam.addColorStop(1, "rgba(255, 218, 128, 0.06)");
        ctx.fillStyle = beam;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#e2c36b";
        ctx.lineWidth = 5;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffe89e";
        ctx.font = 'bold 24px "Kremlin", "Consolas", monospace';
        ctx.textAlign = "center";
        ctx.fillText("★ GLORY TO PEACEFUL ATOM! ★", w / 2, 45, w - 28);
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 16px "Kremlin", "VT323", monospace';
        ctx.fillText("V.I. LENIN NUCLEAR PLANT // GATE 4 // SECTOR 84", w / 2, 74, w - 28);
      }),
    [],
  );

  const coolingPondTex = useMemo(() => {
    const tex = createNearestCanvasTexture(512, 128, (ctx, w, h) => {
      // Ice-rimmed banks fading into dark reflective #1e344a discharge water
      ctx.fillStyle = "#2b4560";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#3f6182";
      ctx.fillRect(0, 6, w, 10);
      ctx.fillRect(0, h - 16, w, 10);
      ctx.fillStyle = "#1e344a";
      ctx.fillRect(0, 14, w, h - 28);
      ctx.fillStyle = "#15273a";
      ctx.fillRect(0, 32, w, h - 64);
      // Moonlit water ripples & warm condensate steam reflection streaks
      ctx.fillStyle = "#385b7c";
      for (let i = 0; i < 42; i++) {
        const rx = (i * 47 + 11) % (w - 30);
        const ry = 24 + ((i * 19) % (h - 52));
        ctx.fillRect(rx, ry, 18 + (i % 4) * 10, 3);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  const coolingTowerTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0.0, "#121c27");
        g.addColorStop(0.28, "#223447");
        g.addColorStop(0.55, "#192837");
        g.addColorStop(0.82, "#101a25");
        g.addColorStop(1.0, "#0c141d");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Concrete horizontal lift rings
        ctx.fillStyle = "rgba(186, 214, 240, 0.14)";
        for (let y = 10; y < h; y += 14) {
          ctx.fillRect(0, y, w, 2);
        }
        // Subtle vertical concrete ribs
        ctx.fillStyle = "rgba(12, 20, 29, 0.28)";
        for (let x = 0; x < w; x += 16) {
          ctx.fillRect(x, 0, 2, h);
        }
        // Highlighted top rim cornice
        ctx.fillStyle = "rgba(160, 198, 232, 0.34)";
        ctx.fillRect(0, 0, w, 7);
      }),
    [],
  );

  const pineTex = useMemo(() => createSnowPineTexture(), []);

  const viaductArchesTex = useMemo(() => {
    const tex = createNearestCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = "#1a2530";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#293949";
      ctx.fillRect(0, 0, w, 6);
      ctx.fillStyle = "#131c25";
      ctx.fillRect(0, 6, 18, h - 6);
      ctx.fillRect(w - 18, 6, 18, h - 6);

      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.moveTo(26, h);
      ctx.lineTo(26, 46);
      ctx.arc(64, 46, 38, Math.PI, 0, false);
      ctx.lineTo(102, h);
      ctx.closePath();
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#0e151d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(64, 46, 38, Math.PI, 0, false);
      ctx.stroke();
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(24, 1);
    return tex;
  }, []);

  const spiritTankerLabelTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 32, (ctx, w, h) => {
        ctx.fillStyle = "#4d5e6e";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#c82b23";
        ctx.fillRect(0, 4, w, 7);
        ctx.fillStyle = "#ffe596";
        ctx.font = 'bold 14px "Kremlin", "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("SPIRIT TANKER", w / 2, 24, w - 10);
      }),
    [],
  );

  const stackTex = useMemo(
    () =>
      createNearestCanvasTexture(32, 160, (ctx, w, h) => {
        for (let y = 0; y < h; y += 16) {
          ctx.fillStyle = (y / 16) % 2 === 0 ? "#c82b23" : "#dcdad2";
          ctx.fillRect(0, y, w, 16);
        }
      }),
    [],
  );

  const steamTex = useMemo(
    () => createSoftSteamPuffTexture(0.42, 0.18),
    [],
  );

  const cherenkovBeamTex = useMemo(
    () =>
      createNearestCanvasTexture(64, 128, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        const vert = ctx.createLinearGradient(0, h, 0, 0);
        vert.addColorStop(0.0, "rgba(180, 250, 255, 0.96)");
        vert.addColorStop(0.28, "rgba(24, 220, 255, 0.72)");
        vert.addColorStop(0.68, "rgba(24, 220, 255, 0.24)");
        vert.addColorStop(1.0, "rgba(24, 220, 255, 0)");
        ctx.fillStyle = vert;
        ctx.fillRect(0, 0, w, h);
        const horiz = ctx.createLinearGradient(0, 0, w, 0);
        horiz.addColorStop(0.0, "rgba(0, 0, 0, 1)");
        horiz.addColorStop(0.22, "rgba(0, 0, 0, 0.1)");
        horiz.addColorStop(0.5, "rgba(0, 0, 0, 0)");
        horiz.addColorStop(0.78, "rgba(0, 0, 0, 0.1)");
        horiz.addColorStop(1.0, "rgba(0, 0, 0, 1)");
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = horiz;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      }),
    [],
  );

  const vodkaLightPollutionTex = useMemo(
    () =>
      createFeatheredHorizonGlowTexture(
        "rgba(255, 86, 42, 0.95)",
        "rgba(255, 132, 46, 0.48)",
        "rgba(180, 52, 28, 0.14)",
      ),
    [],
  );

  const distilleryBrickTex = useMemo(
    () =>
      createNearestCanvasTexture(384, 128, (ctx, w, h) => {
        // Dark Soviet red-brick & concrete factory walls with glowing arched boiler bays
        ctx.fillStyle = "#261214";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#3a1b1d";
        for (let y = 0; y < h; y += 10) {
          ctx.fillRect(0, y, w, 7);
        }
        // Concrete pilasters & lintel cornice
        ctx.fillStyle = "#21242b";
        ctx.fillRect(0, 0, w, 10);
        for (let x = 0; x < w; x += 36) {
          ctx.fillRect(x, 0, 6, h);
        }
        // Tall lit factory windows in warm amber-gold
        for (let x = 14; x < w - 14; x += 36) {
          ctx.fillStyle = "#ffb84d";
          ctx.fillRect(x, 22, 16, 36);
          ctx.fillStyle = "#ffe58c";
          ctx.fillRect(x + 3, 25, 10, 14);
          ctx.fillStyle = "#ff9436";
          ctx.fillRect(x, 72, 16, 38);
        }
      }),
    [],
  );

  const vodkaSignTex = useMemo(
    () =>
      createNearestCanvasTexture(1536, 256, (ctx, w, h) => {
        ctx.fillStyle = "rgba(18, 6, 8, 0.92)";
        ctx.fillRect(0, 0, w, h);

        // Open structural steel grid behind neon lettering
        ctx.strokeStyle = "#2a181c";
        ctx.lineWidth = 4;
        for (let x = 48; x < w; x += 96) {
          ctx.beginPath();
          ctx.moveTo(x, 12);
          ctx.lineTo(x, h - 12);
          ctx.stroke();
        }
        for (let y = 40; y < h; y += 64) {
          ctx.beginPath();
          ctx.moveTo(12, y);
          ctx.lineTo(w - 12, y);
          ctx.stroke();
        }

        // Twin neon border tubes
        ctx.strokeStyle = "#ff2a22";
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.strokeStyle = "#ffbf5e";
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, w - 40, h - 40);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.font = 'bold 90px "Kremlin", "Consolas", monospace';
        ctx.strokeStyle = "#ff1e1e";
        ctx.lineWidth = 14;
        ctx.strokeText('VODKA PLANT "KRISTALL-84"', w / 2, h / 2 + 4, w - 64);
        ctx.fillStyle = "#ffe680";
        ctx.fillText('VODKA PLANT "KRISTALL-84"', w / 2, h / 2 + 4, w - 64);
      }),
    [],
  );

  const vodkaTrussTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 64, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = "#191c24";
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 4, w - 16, h - 8);
        const step = (w - 16) / 14;
        for (let i = 0; i <= 14; i++) {
          const x = 8 + i * step;
          ctx.fillStyle = "#13171f";
          ctx.fillRect(x - 2, 4, 4, h - 8);
          if (i < 14) {
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 4);
            ctx.lineTo(x + step, h - 4);
            ctx.moveTo(x + step, 4);
            ctx.lineTo(x, h - 4);
            ctx.stroke();
          }
        }
      }),
    [],
  );

  // Multi-segment VIP Vodka Pipeline path winding from Distillery down to Plant Wing
  const vipPipelineData = useMemo(() => {
    const waypoints = [
      new THREE.Vector3(4.1, Y(-5.1), -4.6),
      new THREE.Vector3(5.2, Y(-6.3), -10.8),
      new THREE.Vector3(6.6, Y(-6.6), -16.8),
      new THREE.Vector3(8.0, Y(-2.4), -24.8),
      new THREE.Vector3(9.6, Y(1.45), -33.4),
    ];

    const segLengths: number[] = [];
    let totalLen = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const len = waypoints[i].distanceTo(waypoints[i + 1]);
      segLengths.push(len);
      totalLen += len;
    }

    const sampleAt = (u: number): THREE.Vector3 => {
      const target = THREE.MathUtils.clamp(u, 0, 1) * totalLen;
      let acc = 0;
      for (let i = 0; i < segLengths.length; i++) {
        const len = segLengths[i];
        if (target <= acc + len || i === segLengths.length - 1) {
          const localU = len > 0 ? (target - acc) / len : 0;
          return waypoints[i].clone().lerp(waypoints[i + 1], localU);
        }
        acc += len;
      }
      return waypoints[waypoints.length - 1].clone();
    };

    const segments = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const mid = a.clone().lerp(b, 0.5);
      const dir = b.clone().sub(a);
      const len = dir.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        dir.normalize(),
      );
      segments.push({ mid, len, quat });
    }

    const stanchions = Array.from({ length: 22 }, (_, i) => {
      const p = sampleAt(i / 21);
      const groundY = Y(win1GroundY(p.x, p.z) - 0.15);
      const h = Math.max(0.55, p.y - groundY);
      return { x: p.x, y: groundY + h * 0.5, z: p.z, h };
    });

    const lamps = Array.from({ length: 28 }, (_, i) => {
      const p = sampleAt(i / 27);
      return { x: p.x, y: p.y + 0.28, z: p.z };
    });

    const steamAnchors = Array.from({ length: 6 }, (_, i) =>
      sampleAt(0.14 + i * 0.145),
    );

    return { segments, stanchions, lamps, steamAnchors };
  }, []);

  const distilleryGroundW = useMemo(() => win1GroundY(8.8, -34.2), []);

  const win1BeaconSpecs = useMemo(
    () =>
      [
        // 4 Cooling Tower 1 Rim Beacons (-9.6, -18.0)
        { x: -12.35, y: Y(1.08), z: -18.0, size: 0.15 },
        { x: -9.6, y: Y(1.08), z: -15.25, size: 0.15 },
        { x: -6.85, y: Y(1.08), z: -18.0, size: 0.15 },
        { x: -9.6, y: Y(1.08), z: -20.75, size: 0.15 },
        // 4 Cooling Tower 2 Rim Beacons (-0.6, -19.2)
        { x: -3.35, y: Y(1.08), z: -19.2, size: 0.15 },
        { x: -0.6, y: Y(1.08), z: -16.45, size: 0.15 },
        { x: 2.15, y: Y(1.08), z: -19.2, size: 0.15 },
        { x: -0.6, y: Y(1.08), z: -21.95, size: 0.15 },
        // 3 Staggered VT-2 Tall Ventilation Stack Beacons (+6.2, -7.5)
        { x: 6.2, y: Y(0.25), z: -7.1, size: 0.16 },
        { x: 6.2, y: Y(2.45), z: -7.1, size: 0.18 },
        { x: 6.2, y: Y(5.48), z: -7.5, size: 0.24 },
        // 4 Outgoing 500kV Lattice Transmission Pylons (z = -14.1)
        { x: -16.0, y: Y(-4.35), z: -14.1, size: 0.13 },
        { x: -6.0, y: Y(-4.35), z: -14.1, size: 0.13 },
        { x: 4.0, y: Y(-4.35), z: -14.1, size: 0.13 },
        { x: 13.0, y: Y(-4.35), z: -14.1, size: 0.13 },
        // 5 Auxiliary Boiler Smokestacks Along Far Ridge (z = -35.6)
        { x: -24.5, y: Y(win1GroundY(-24.5, -35.6) + 4.35), z: -35.6, size: 0.14 },
        { x: -14.2, y: Y(win1GroundY(-14.2, -35.6) + 4.65), z: -35.6, size: 0.14 },
        { x: -5.8, y: Y(win1GroundY(-5.8, -35.6) + 4.25), z: -35.6, size: 0.14 },
        { x: 18.8, y: Y(win1GroundY(18.8, -35.6) + 4.55), z: -35.6, size: 0.14 },
        { x: 23.2, y: Y(win1GroundY(23.2, -35.6) + 4.15), z: -35.6, size: 0.14 },
        // 3 Tall Vodka Distillery Chimneys (z = -35.1)
        { x: 6.1, y: Y(distilleryGroundW + 5.15), z: -35.1, size: 0.16 },
        { x: 8.8, y: Y(distilleryGroundW + 5.85), z: -35.1, size: 0.18 },
        { x: 12.2, y: Y(distilleryGroundW + 4.95), z: -35.1, size: 0.16 },
        // 2 Flanking Neon Sign Truss Aviation Beacons
        { x: 3.4, y: Y(distilleryGroundW + 5.4), z: -33.25, size: 0.13 },
        { x: 14.2, y: Y(distilleryGroundW + 5.4), z: -33.25, size: 0.13 },
      ].map((b, i) => ({
        ...b,
        freqHz: 0.6 + ((i * 7) % 13) * (0.6 / 12),
        phase: (i * 0.37) % 1,
      })),
    [distilleryGroundW],
  );

  // Tier 1, Tier 2 & Tier 3 Instanced Layout Data
  const stageLayout = useMemo(() => {
    const seeded = (n: number) => {
      const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    // 28 Rooftop Cyclone Vents across stepped reactor & turbine roofs
    const roofVents: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [];
    for (let i = 0; i < 10; i++) {
      roofVents.push({ x: -22.0 + i * 2.8, y: Y(-5.24), z: i % 2 === 0 ? -2.9 : -4.2, sx: 0.56, sy: 0.48, sz: 0.52 });
    }
    for (let i = 0; i < 12; i++) {
      roofVents.push({ x: -25.5 + i * 2.55, y: Y(-6.94), z: i % 2 === 0 ? -5.5 : -7.9, sx: 0.62, sy: 0.5, sz: 0.58 });
    }
    for (let i = 0; i < 4; i++) {
      roofVents.push({ x: 4.3 + i * 1.2, y: Y(-6.06), z: -5.5, sx: 0.5, sy: 0.44, sz: 0.48 });
    }
    for (let i = 0; i < 2; i++) {
      roofVents.push({ x: -32.2 + i * 2.4, y: Y(-7.76), z: -6.8, sx: 0.56, sy: 0.44, sz: 0.52 });
    }

    // 56 Vertical Glowing Glass-Block Window Strips on stepped walls facing viewer
    const glassStrips: Array<{
      x: number;
      y: number;
      z: number;
      ry: number;
      w: number;
      h: number;
      color: THREE.Color;
    }> = [];
    const cyanA = new THREE.Color("#7be8df");
    const cyanB = new THREE.Color("#5ec8de");
    const amberA = new THREE.Color("#ffcb6b");
    const amberB = new THREE.Color("#f59e42");

    for (let i = 0; i < 16; i++) {
      glassStrips.push({
        x: -13.8 + i * 0.84,
        y: Y(-5.12),
        z: -3.13,
        ry: 0,
        w: 0.24,
        h: 0.56,
        color: i % 3 === 0 ? amberA : i % 2 === 0 ? cyanA : cyanB,
      });
    }
    for (let i = 0; i < 20; i++) {
      glassStrips.push({
        x: -21.0 + i * 1.0,
        y: Y(-6.65),
        z: -5.98,
        ry: 0,
        w: 0.26,
        h: 0.82,
        color: i % 4 === 0 ? amberB : i % 2 === 0 ? cyanA : cyanB,
      });
    }
    for (let i = 0; i < 8; i++) {
      glassStrips.push({
        x: 4.65 + i * 0.44,
        y: Y(-5.52),
        z: -5.78,
        ry: 0,
        w: 0.22,
        h: 1.02,
        color: i % 3 === 1 ? amberA : cyanA,
      });
    }
    for (let i = 0; i < 12; i++) {
      const row = i % 2;
      const col = Math.floor(i / 2);
      glassStrips.push({
        x: 3.48,
        y: row === 0 ? Y(-6.75) : Y(-8.35),
        z: -5.65 - col * 0.56,
        ry: -Math.PI / 2,
        w: 0.24,
        h: 0.96,
        color: (col + row) % 3 === 0 ? amberA : cyanB,
      });
    }

    // 14 Lit Rooftop Walkway Bulkhead Lamps
    const roofLamps = [
      ...Array.from({ length: 6 }, (_, i) => ({ x: -20.0 + i * 4.4, y: Y(-5.42), z: -2.02 })),
      ...Array.from({ length: 6 }, (_, i) => ({ x: -24.0 + i * 5.0, y: Y(-7.12), z: -4.92 })),
      { x: 4.6, y: Y(-6.22), z: -5.45 },
      { x: 7.4, y: Y(-6.22), z: -5.45 },
    ];

    // 8 Heavy Oil Transformers + 48 Porcelain Bushings
    const transformerXs = [-19.6, -15.4, -11.2, -7.0, -2.8, 1.4, 5.6, 9.8];

    // 10 Sodium Yard Floodlight Masts
    const yardFloods = [
      ...Array.from({ length: 5 }, (_, i) => ({ x: -18.5 + i * 7.2, z: -9.55 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: -20.5 + i * 7.5, z: -12.6 })),
    ];

    // 8 Animated Patrol / Tanker Trucks on Perimeter Road (z = -13.15 / -13.48)
    const trucks = Array.from({ length: WIN1_TRUCK_COUNT }, (_, idx) => {
      const dir = idx < 4 ? 1 : -1;
      return {
        dir,
        z: dir > 0 ? -13.15 : -13.48,
        phase: (idx % 4) / 4 + seeded(idx * 17 + 3) * 0.14,
        speed: 1.85 + (idx % 3) * 0.35,
      };
    });

    // 64 Diagonal V-Struts (32 per cooling tower)
    const towerCenters = [
      { x: -9.6, z: -18.0 },
      { x: -0.6, z: -19.2 },
    ];
    const towerStruts: Array<{
      pos: THREE.Vector3;
      quat: THREE.Quaternion;
      len: number;
    }> = [];
    const upAxis = new THREE.Vector3(0, 1, 0);
    for (const tc of towerCenters) {
      for (let i = 0; i < 32; i++) {
        const pairIdx = Math.floor(i / 2);
        const side = i % 2 === 0 ? 1 : -1;
        const aTop = (pairIdx / 16) * Math.PI * 2;
        const aBot = aTop + side * ((Math.PI * 2) / 32);
        const pBot = new THREE.Vector3(
          tc.x + Math.cos(aBot) * 4.35,
          Y(-9.98),
          tc.z + Math.sin(aBot) * 4.35,
        );
        const pTop = new THREE.Vector3(
          tc.x + Math.cos(aTop) * 4.22,
          Y(-9.52),
          tc.z + Math.sin(aTop) * 4.22,
        );
        const mid = pBot.clone().lerp(pTop, 0.5);
        const dir = pTop.clone().sub(pBot);
        const len = dir.length();
        const quat = new THREE.Quaternion().setFromUnitVectors(upAxis, dir.normalize());
        towerStruts.push({ pos: mid, quat, len });
      }
    }

    // 96 Snow-Dusted Pine Windbreaks across Tier 2 valley slopes (clearing pond, towers & rail)
    const pines: Array<{ x: number; y: number; z: number; scale: number }> = [];
    let guard = 0;
    let pSeed = 0;
    while (pines.length < 96 && guard < 600) {
      guard++;
      pSeed++;
      const u = seeded(pSeed * 13 + 7);
      const pz = THREE.MathUtils.lerp(-14.6, -32.2, u);
      const px = THREE.MathUtils.lerp(-34.0, 12.5, seeded(pSeed * 29 + 3));
      // Keep Window 1 billboard pines in +X industrial corridor (corner ridge uses 3D crossed pines)
      if (px > 12.5) continue;
      // Clear cooling canal
      if (Math.abs(pz - coolingCanalCenterZ(px)) < coolingCanalHalfZ(px) + 0.95) continue;
      // Clear both cooling towers
      if (Math.hypot(px - -9.6, pz - -18.0) < 5.2) continue;
      if (Math.hypot(px - -0.6, pz - -19.2) < 5.2) continue;
      // Clear rail spur viaduct
      if (Math.abs(pz - -24.2) < 1.35) continue;
      // Clear VIP pipe corridor
      if (px > 3.5 && px < 10.8 && pz < -4.0 && pz > -34.0) continue;

      const scale = THREE.MathUtils.lerp(1.42, 0.62, u) * (0.85 + seeded(pSeed * 7) * 0.35);
      const py = Y(win1GroundY(px, pz) + scale * 0.78);
      pines.push({ x: px, y: py, z: pz, scale });
    }

    // Tier 3 Surrounding Industrial Ridge Warehouses & Windows (clearing Distillery bay +1.0..+16.6)
    const ridgeBlocks: Array<{
      x: number;
      y: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
      shade: THREE.Color;
    }> = [];
    const ridgeWindows: Array<{
      x: number;
      y: number;
      z: number;
      w: number;
      h: number;
      threshold: number;
      color: THREE.Color;
    }> = [];

    const indShades = [
      new THREE.Color("#101822"),
      new THREE.Color("#141e2a"),
      new THREE.Color("#182432"),
    ];
    const indCols = ["#ffca68", "#ffa042", "#8de6dc"];

    for (let i = 0; i < 34 && ridgeBlocks.length < WIN1_MAX_RIDGE_BLOCKS; i++) {
      const sideLeft = i < 22;
      const rx = sideLeft
        ? THREE.MathUtils.lerp(-30.5, -0.5, i / 21) + (seeded(i * 11 + 2) - 0.5) * 0.8
        : THREE.MathUtils.lerp(17.2, 25.5, (i - 22) / 11) + (seeded(i * 13 + 5) - 0.5) * 0.5;
      const rz = -33.8 - seeded(i * 19 + 1) * 4.4;
      const sx = 1.6 + seeded(i * 23 + 3) * 1.9;
      const sy = 1.2 + seeded(i * 29 + 7) * 1.65;
      const sz = 1.1 + seeded(i * 31 + 9) * 0.8;
      const baseW = win1GroundY(rx, rz);
      const cy = Y(baseW + sy * 0.5);

      ridgeBlocks.push({
        x: rx,
        y: cy,
        z: rz,
        sx,
        sy,
        sz,
        shade: indShades[i % indShades.length],
      });

      const frontZ = rz + sz * 0.5 + 0.02;
      const rows = Math.max(2, Math.round(sy * 1.8));
      const cols = Math.max(3, Math.round(sx * 2.1));
      const blockThresh = THREE.MathUtils.clamp(0.15 + seeded(i * 43 + 1) * 0.72, 0.1, 0.92);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (ridgeWindows.length >= WIN1_MAX_RIDGE_WINDOWS) break;
          const ws = i * 97 + r * 23 + c * 7;
          if (seeded(ws + 3) < 0.34) continue;
          ridgeWindows.push({
            x: rx + ((c + 0.5) / cols - 0.5) * (sx * 0.78),
            y: cy - sy * 0.32 + (r / rows) * (sy * 0.64),
            z: frontZ,
            w: 0.18,
            h: 0.14,
            threshold: blockThresh,
            color: new THREE.Color(indCols[ws % indCols.length]),
          });
        }
      }
    }

    return {
      roofVents,
      glassStrips,
      roofLamps,
      transformerXs,
      yardFloods,
      trucks,
      towerStruts,
      pines,
      ridgeBlocks,
      ridgeWindows,
    };
  }, []);

  useEffect(() => {
    const dummy = new THREE.Object3D();

    if (roofVentsRef.current) {
      roofVentsRef.current.count = stageLayout.roofVents.length;
      stageLayout.roofVents.forEach((v, idx) => {
        dummy.position.set(v.x, v.y, v.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(v.sx, v.sy, v.sz);
        dummy.updateMatrix();
        roofVentsRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      roofVentsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (glassBlockStripsRef.current) {
      glassBlockStripsRef.current.count = stageLayout.glassStrips.length;
      stageLayout.glassStrips.forEach((g, idx) => {
        dummy.position.set(g.x, g.y, g.z);
        dummy.rotation.set(0, g.ry, 0);
        dummy.scale.set(g.w, g.h, 1);
        dummy.updateMatrix();
        glassBlockStripsRef.current!.setMatrixAt(idx, dummy.matrix);
        glassBlockStripsRef.current!.setColorAt(idx, g.color);
      });
      glassBlockStripsRef.current.instanceMatrix.needsUpdate = true;
      if (glassBlockStripsRef.current.instanceColor) {
        glassBlockStripsRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (roofLampsRef.current && roofLampPoolsRef.current) {
      roofLampsRef.current.count = stageLayout.roofLamps.length;
      roofLampPoolsRef.current.count = stageLayout.roofLamps.length;
      stageLayout.roofLamps.forEach((l, idx) => {
        dummy.position.set(l.x, l.y + 0.08, l.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        roofLampsRef.current!.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(l.x, l.y - 0.04, l.z - 0.25);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        roofLampPoolsRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      roofLampsRef.current.instanceMatrix.needsUpdate = true;
      roofLampPoolsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (fencePostsRef.current) {
      let fIdx = 0;
      for (let i = 0; i < 18; i++) {
        dummy.position.set(-22.5 + i * 2.0, Y(-10.22), -12.52);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        fencePostsRef.current.setMatrixAt(fIdx++, dummy.matrix);
      }
      for (let i = 0; i < 5; i++) {
        dummy.position.set(-22.5, Y(-10.22), -9.6 - i * 0.65);
        dummy.updateMatrix();
        fencePostsRef.current.setMatrixAt(fIdx++, dummy.matrix);
      }
      for (let i = 0; i < 5; i++) {
        dummy.position.set(11.5, Y(-10.22), -9.6 - i * 0.65);
        dummy.updateMatrix();
        fencePostsRef.current.setMatrixAt(fIdx++, dummy.matrix);
      }
      fencePostsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (transformersRef.current && bushingsRef.current) {
      let bIdx = 0;
      stageLayout.transformerXs.forEach((tx, idx) => {
        dummy.position.set(tx, Y(-10.12), -10.8);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1.55, 1.35, 1.05);
        dummy.updateMatrix();
        transformersRef.current!.setMatrixAt(idx, dummy.matrix);

        for (const oz of [-0.25, 0.25]) {
          for (const ox of [-0.44, 0, 0.44]) {
            dummy.position.set(tx + ox, Y(-9.22), -10.8 + oz);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            bushingsRef.current!.setMatrixAt(bIdx++, dummy.matrix);
          }
        }
      });
      transformersRef.current.instanceMatrix.needsUpdate = true;
      bushingsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (yardFloodPostsRef.current && yardFloodHeadsRef.current && yardFloodPoolsRef.current) {
      stageLayout.yardFloods.forEach((f, idx) => {
        const gY = Y(win1GroundY(f.x, f.z));
        dummy.position.set(f.x, gY + 1.3, f.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        yardFloodPostsRef.current!.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(f.x, gY + 2.6, f.z + 0.04);
        dummy.updateMatrix();
        yardFloodHeadsRef.current!.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(f.x, gY + 0.07, f.z - 0.4);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        yardFloodPoolsRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      yardFloodPostsRef.current.instanceMatrix.needsUpdate = true;
      yardFloodHeadsRef.current.instanceMatrix.needsUpdate = true;
      yardFloodPoolsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (truckBodiesRef.current && truckLightsRef.current && truckHalosRef.current) {
      for (let i = 0; i < stageLayout.trucks.length; i++) {
        truckBodiesRef.current.setColorAt(
          i,
          new THREE.Color(i % 2 === 0 ? "#24342e" : "#2e3c47"),
        );
        truckLightsRef.current.setColorAt(i * 2, COLOR_HEADLIGHT);
        truckLightsRef.current.setColorAt(i * 2 + 1, COLOR_TAILLIGHT);
        truckHalosRef.current.setColorAt(i, COLOR_HEADLIGHT);
      }
      if (truckBodiesRef.current.instanceColor) {
        truckBodiesRef.current.instanceColor.needsUpdate = true;
      }
      if (truckLightsRef.current.instanceColor) {
        truckLightsRef.current.instanceColor.needsUpdate = true;
      }
      if (truckHalosRef.current.instanceColor) {
        truckHalosRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (win1PinesRef.current) {
      win1PinesRef.current.count = stageLayout.pines.length;
      stageLayout.pines.forEach((p, idx) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(-0.16, 0, 0);
        dummy.scale.set(p.scale, p.scale, 1);
        dummy.updateMatrix();
        win1PinesRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      win1PinesRef.current.instanceMatrix.needsUpdate = true;
    }

    if (towerStrutsRef.current) {
      towerStrutsRef.current.count = stageLayout.towerStruts.length;
      stageLayout.towerStruts.forEach((st, idx) => {
        dummy.position.copy(st.pos);
        dummy.quaternion.copy(st.quat);
        dummy.scale.set(1, st.len, 1);
        dummy.updateMatrix();
        towerStrutsRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      towerStrutsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (vipStanchionsRef.current) {
      vipPipelineData.stanchions.forEach((st, idx) => {
        dummy.position.set(st.x, st.y, st.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, st.h, 1);
        dummy.updateMatrix();
        vipStanchionsRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      vipStanchionsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (vipLampsRef.current && vipLampHalosRef.current) {
      vipPipelineData.lamps.forEach((l, idx) => {
        dummy.position.set(l.x, l.y, l.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        vipLampsRef.current!.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(l.x, l.y, l.z + 0.04);
        dummy.updateMatrix();
        vipLampHalosRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      vipLampsRef.current.instanceMatrix.needsUpdate = true;
      vipLampHalosRef.current.instanceMatrix.needsUpdate = true;
    }

    if (railYardLightsRef.current) {
      for (let i = 0; i < 16; i++) {
        const lx = THREE.MathUtils.lerp(-29.0, 16.4, i / 15);
        dummy.position.set(lx, Y(-6.98), -23.95);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        railYardLightsRef.current.setMatrixAt(i, dummy.matrix);
      }
      railYardLightsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (ridgeFactoriesRef.current) {
      ridgeFactoriesRef.current.count = stageLayout.ridgeBlocks.length;
      stageLayout.ridgeBlocks.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.sx, b.sy, b.sz);
        dummy.updateMatrix();
        ridgeFactoriesRef.current!.setMatrixAt(idx, dummy.matrix);
        ridgeFactoriesRef.current!.setColorAt(idx, b.shade);
      });
      ridgeFactoriesRef.current.instanceMatrix.needsUpdate = true;
      if (ridgeFactoriesRef.current.instanceColor) {
        ridgeFactoriesRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (ridgeWindowsRef.current) {
      ridgeWindowsRef.current.count = stageLayout.ridgeWindows.length;
      stageLayout.ridgeWindows.forEach((w, idx) => {
        ridgeWinLitRef.current[idx] = 1;
        dummy.position.set(w.x, w.y, w.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(w.w, w.h, 1);
        dummy.updateMatrix();
        ridgeWindowsRef.current!.setMatrixAt(idx, dummy.matrix);
        ridgeWindowsRef.current!.setColorAt(idx, w.color);
      });
      ridgeWindowsRef.current.instanceMatrix.needsUpdate = true;
      if (ridgeWindowsRef.current.instanceColor) {
        ridgeWindowsRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (win1BeaconsRef.current && win1BeaconHalosRef.current) {
      win1BeaconSpecs.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.size, b.size, 1);
        dummy.updateMatrix();
        win1BeaconsRef.current!.setMatrixAt(idx, dummy.matrix);
        win1BeaconsRef.current!.setColorAt(idx, COLOR_BEACON_ON);

        dummy.position.set(b.x, b.y, b.z + 0.03);
        dummy.scale.set(b.size * 4.0, b.size * 4.0, 1);
        dummy.updateMatrix();
        win1BeaconHalosRef.current!.setMatrixAt(idx, dummy.matrix);
        win1BeaconHalosRef.current!.setColorAt(idx, COLOR_BEACON_ON);
      });
      win1BeaconsRef.current.instanceMatrix.needsUpdate = true;
      win1BeaconHalosRef.current.instanceMatrix.needsUpdate = true;
      if (win1BeaconsRef.current.instanceColor) {
        win1BeaconsRef.current.instanceColor.needsUpdate = true;
      }
      if (win1BeaconHalosRef.current.instanceColor) {
        win1BeaconHalosRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [stageLayout, vipPipelineData, win1BeaconSpecs]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const dt = Math.min(delta, 0.1);
    const { citySatisfaction, vodkaFlicker, cherenkovLevel } =
      computeDioramaGridState();

    // 1. Sacred Vodka Priority: Star rotation, Distillery lights, Neon Sign, VIP Pipeline & Light Pollution
    if (starGroupRef.current) {
      if (vodkaFlicker > 0.05) {
        starAngleRef.current += dt * (vodkaFlicker >= 0.9 ? 0.58 : 0.22);
      }
      starGroupRef.current.rotation.y = starAngleRef.current;
    }
    if (vipLampsMatRef.current) {
      vipLampsMatRef.current.color.lerpColors(
        COLOR_VIP_OFF,
        COLOR_VIP_ON,
        vodkaFlicker,
      );
    }
    if (vipLampHalosMatRef.current) {
      vipLampHalosMatRef.current.opacity = 0.52 * vodkaFlicker;
    }
    for (let i = 0; i < 3; i++) {
      const m = distilleryHallMatsRef.current[i];
      if (m) {
        m.color.lerpColors(COLOR_FACTORY_OFF, COLOR_WHITE, vodkaFlicker);
      }
    }
    for (let i = 0; i < 8; i++) {
      const m = distillerySawtoothMatsRef.current[i];
      if (m) {
        m.color.lerpColors(COLOR_FACTORY_OFF, COLOR_VIP_ON, vodkaFlicker);
      }
    }
    SCRATCH_COLOR.set("#5c4244");
    for (let i = 0; i < 5; i++) {
      const m = distilleryColumnMatsRef.current[i];
      if (m) {
        m.color.lerpColors(
          COLOR_FACTORY_OFF,
          SCRATCH_COLOR,
          0.35 + 0.65 * vodkaFlicker,
        );
      }
    }
    if (vodkaSignMatRef.current) {
      vodkaSignMatRef.current.color.lerpColors(
        COLOR_SIGN_OFF,
        COLOR_WHITE,
        vodkaFlicker,
      );
    }
    if (vodkaSignHaloMatRef.current) {
      vodkaSignHaloMatRef.current.opacity = 0.28 * vodkaFlicker;
    }
    if (vodkaLightPollutionMatRef.current) {
      vodkaLightPollutionMatRef.current.opacity = THREE.MathUtils.lerp(
        0.04,
        0.34,
        vodkaFlicker,
      );
    }
    if (starMatOuterRef.current) {
      starMatOuterRef.current.color.lerpColors(
        COLOR_STAR_OFF,
        COLOR_STAR_1_ON,
        vodkaFlicker,
      );
    }
    if (starMatInnerRef.current) {
      starMatInnerRef.current.color.lerpColors(
        COLOR_STAR_OFF,
        COLOR_STAR_2_ON,
        vodkaFlicker,
      );
    }
    if (starHaloMatRef.current) {
      starHaloMatRef.current.opacity = 0.56 * vodkaFlicker;
    }

    // 2. Slow-Moving Soviet Spirit-Tanker Train (SPIRIT TANKER) on Rail Spur (z = -24.2)
    const trainSpeed = vodkaFlicker > 0.05 ? (vodkaFlicker > 0.5 ? 1.15 : 0.45) : 0;
    spiritTrainPosXRef.current += trainSpeed * dt;
    if (spiritTrainPosXRef.current > 22.0) {
      spiritTrainPosXRef.current = -34.0;
    }
    if (spiritTrainGroupRef.current) {
      spiritTrainGroupRef.current.position.x = spiritTrainPosXRef.current;
    }
    if (spiritLocoGroupRef.current) {
      spiritLocoGroupRef.current.visible = spiritTrainPosXRef.current + 4.6 <= 17.3;
    }
    for (let i = 0; i < SPIRIT_CAR_OFFSETS.length; i++) {
      const cg = spiritCarGroupRefs.current[i];
      if (cg) {
        cg.visible = spiritTrainPosXRef.current + SPIRIT_CAR_OFFSETS[i] <= 17.35;
      }
    }
    if (spiritTrainCabMatRef.current) {
      spiritTrainCabMatRef.current.color.lerpColors(
        COLOR_TRAIN_WIN_OFF,
        COLOR_TRAIN_WIN_ON,
        vodkaFlicker,
      );
    }
    if (spiritTrainBeamMatRef.current) {
      spiritTrainBeamMatRef.current.opacity = 0.78 * vodkaFlicker;
    }
    for (let i = 0; i < 6; i++) {
      const m = spiritCarGlowMatsRef.current[i];
      if (m) {
        m.color.lerpColors(
          COLOR_TRAIN_WIN_OFF,
          COLOR_ROAD_LAMP_ON,
          vodkaFlicker,
        );
      }
    }

    // 3. Moving Patrol & Tanker Trucks along Plant Perimeter Road (z = -13.15 / -13.48)
    if (
      truckBodiesRef.current &&
      truckLightsRef.current &&
      truckHalosRef.current
    ) {
      const roadSpan = 44.4;
      for (let i = 0; i < stageLayout.trucks.length; i++) {
        const tr = stageLayout.trucks[i];
        const prog = (t * (tr.speed / roadSpan) + tr.phase) % 1;
        const tx =
          tr.dir > 0
            ? THREE.MathUtils.lerp(-31.0, 13.4, prog)
            : THREE.MathUtils.lerp(13.4, -31.0, prog);
        const ty = Y(win1GroundY(tx, tr.z) + 0.23);

        WIN1_SCRATCH_OBJ.position.set(tx, ty, tr.z);
        WIN1_SCRATCH_OBJ.rotation.set(0, 0, 0);
        WIN1_SCRATCH_OBJ.scale.set(0.84, 0.38, 0.42);
        WIN1_SCRATCH_OBJ.updateMatrix();
        truckBodiesRef.current.setMatrixAt(i, WIN1_SCRATCH_OBJ.matrix);

        // Front Headlight Dot
        WIN1_SCRATCH_OBJ.position.set(tx + tr.dir * 0.45, ty - 0.04, tr.z + 0.16);
        WIN1_SCRATCH_OBJ.scale.set(0.11, 0.11, 1);
        WIN1_SCRATCH_OBJ.updateMatrix();
        truckLightsRef.current.setMatrixAt(i * 2, WIN1_SCRATCH_OBJ.matrix);

        // Rear Taillight Dot
        WIN1_SCRATCH_OBJ.position.set(tx - tr.dir * 0.45, ty - 0.04, tr.z + 0.16);
        WIN1_SCRATCH_OBJ.scale.set(0.09, 0.09, 1);
        WIN1_SCRATCH_OBJ.updateMatrix();
        truckLightsRef.current.setMatrixAt(i * 2 + 1, WIN1_SCRATCH_OBJ.matrix);

        // Projected Headlight Cone Along Road Surface
        const haloX = tx + tr.dir * 1.15;
        WIN1_SCRATCH_OBJ.position.set(
          haloX,
          Y(win1GroundY(haloX, tr.z) + 0.08),
          tr.z,
        );
        WIN1_SCRATCH_OBJ.rotation.set(-Math.PI / 2, 0, tr.dir > 0 ? 0 : Math.PI);
        WIN1_SCRATCH_OBJ.scale.set(1.5, 0.56, 1);
        WIN1_SCRATCH_OBJ.updateMatrix();
        truckHalosRef.current.setMatrixAt(i, WIN1_SCRATCH_OBJ.matrix);
      }
      truckBodiesRef.current.instanceMatrix.needsUpdate = true;
      truckLightsRef.current.instanceMatrix.needsUpdate = true;
      truckHalosRef.current.instanceMatrix.needsUpdate = true;
    }

    // 4. Staggered Blinking Red Aviation Beacons Across All Stacks & Towers (Throttled to 8 Hz + Dirty-Checked)
    win1BeaconTimerRef.current += dt;
    if (
      win1BeaconTimerRef.current >= 0.125 &&
      win1BeaconsRef.current &&
      win1BeaconsRef.current.instanceColor &&
      win1BeaconHalosRef.current &&
      win1BeaconHalosRef.current.instanceColor
    ) {
      win1BeaconTimerRef.current = 0;
      let mask = 0;
      for (let i = 0; i < win1BeaconSpecs.length; i++) {
        const b = win1BeaconSpecs[i];
        const pulsePhase = (t * b.freqHz + b.phase) % 1;
        const isOn = pulsePhase < 0.42;
        if (isOn) mask |= 1 << i;
        win1BeaconsRef.current.setColorAt(
          i,
          isOn ? COLOR_BEACON_ON : COLOR_BEACON_OFF,
        );
        win1BeaconHalosRef.current.setColorAt(
          i,
          isOn ? COLOR_BEACON_ON : COLOR_ROAD_POOL_OFF,
        );
      }
      mask = mask >>> 0;
      if (mask !== win1BeaconMaskRef.current) {
        win1BeaconMaskRef.current = mask;
        win1BeaconsRef.current.instanceColor.needsUpdate = true;
        win1BeaconHalosRef.current.instanceColor.needsUpdate = true;
      }
    }

    // 5. Ionizing Cherenkov Roof Vent Beam & Roofscape Illumination
    if (cherenkovRef.current) {
      const active = cherenkovLevel > 0.01;
      cherenkovRef.current.visible = active;
      if (active) {
        const pulse = 0.88 + 0.12 * Math.sin(t * 3.2);
        const upwardPulse = 0.5 + 0.5 * Math.sin(t * 2.1);
        if (cherenkovCoreMatRef.current) {
          cherenkovCoreMatRef.current.opacity = THREE.MathUtils.clamp(
            cherenkovLevel * 0.94 * pulse,
            0.22,
            0.98,
          );
        }
        if (cherenkovHaloMatRef.current) {
          cherenkovHaloMatRef.current.opacity = THREE.MathUtils.clamp(
            cherenkovLevel * 0.56 * pulse,
            0.14,
            0.68,
          );
        }
        if (cherenkovSpillMatRef.current) {
          cherenkovSpillMatRef.current.opacity = THREE.MathUtils.clamp(
            cherenkovLevel * 0.48 * pulse,
            0.1,
            0.55,
          );
        }
        cherenkovRef.current.scale.set(
          0.95 + cherenkovLevel * 0.5,
          0.8 + cherenkovLevel * (1.25 + 0.22 * upwardPulse),
          1,
        );
      }
    }

    // 6. Multi-Layered Drifting Cooling Tower Steam Plumes (16 plumes)
    const driftSpeed = 0.085 + cherenkovLevel * 0.075;
    for (let i = 0; i < 16; i++) {
      const m = steamRefs.current[i];
      if (!m) continue;
      const isTower1 = i < 8;
      const baseX = isTower1 ? -9.6 : -0.6;
      const baseZ = isTower1 ? -17.8 : -19.0;
      const localIdx = i % 8;
      const layerSign = localIdx % 2 === 0 ? 1 : -1;
      const phase = (t * driftSpeed + localIdx * 0.125) % 1;
      m.position.x = baseX + phase * 4.4 + layerSign * 0.35;
      m.position.y = Y(1.05) + phase * 3.8;
      m.position.z = baseZ + localIdx * 0.06;
      const s = 0.72 + phase * 1.15;
      m.scale.set(s, s * 0.74, 1);

      const sm = steamMatsRef.current[i];
      if (sm) {
        sm.color.lerpColors(
          COLOR_WHITE,
          COLOR_STEAM_CHERENKOV,
          cherenkovLevel * 0.85,
        );
        sm.opacity = Math.max(0.03, (1 - Math.abs(phase - 0.42) * 1.45) * 0.34);
      }
    }

    // 7. Tiny VIP Pipeline Valve Steam Wisps (6 wisps)
    for (let i = 0; i < 6; i++) {
      const m = vipSteamRefs.current[i];
      const anchor = vipPipelineData.steamAnchors[i];
      if (!m || !anchor) continue;
      const phase = (t * 0.14 + i * 0.19) % 1;
      m.position.x = anchor.x + phase * 0.65;
      m.position.y = anchor.y + 0.25 + phase * 0.85;
      m.position.z = anchor.z;
      const s = 0.42 + phase * 0.65;
      m.scale.set(s, s * 0.78, 1);
      const sm = vipSteamMatsRef.current[i];
      if (sm) {
        sm.opacity =
          vodkaFlicker > 0.05
            ? Math.max(0.03, (1 - Math.abs(phase - 0.4) * 1.45) * 0.46)
            : 0;
      }
    }

    // 8. Distant Vodka Distillery Chimney Smoke (12 puffs)
    for (let i = 0; i < 12; i++) {
      const m = distillerySmokeRefs.current[i];
      if (!m) continue;
      const sIdx = Math.floor(i / 4);
      const puffIdx = i % 4;
      const phase = (t * 0.068 + puffIdx * 0.25 + sIdx * 0.13) % 1;
      const stackTop =
        sIdx === 0
          ? distilleryGroundW + 5.15
          : sIdx === 1
            ? distilleryGroundW + 5.85
            : distilleryGroundW + 4.95;
      m.position.x = DIST_STACK_XS[sIdx] + phase * 2.2;
      m.position.y = Y(stackTop) + phase * 2.6;
      m.position.z = -35.1 + i * 0.02;
      const s = 0.48 + phase * 1.35;
      m.scale.set(s, s * 0.72, 1);
      const sm = distillerySmokeMatsRef.current[i];
      if (sm) {
        sm.opacity = Math.max(0.03, (1 - Math.abs(phase - 0.35) * 1.4) * 0.45);
      }
    }

    // 9. Surrounding Non-Vodka Ridge Warehouse Windows Dim With City Grid Power (>= 0.03 Deadband + Hysteresis)
    const powerChanged =
      lastRidgePowerRatioRef.current < 0 ||
      Math.abs(citySatisfaction - lastRidgePowerRatioRef.current) >= 0.03 ||
      (citySatisfaction === 0 && lastRidgePowerRatioRef.current !== 0) ||
      (citySatisfaction === 1 && lastRidgePowerRatioRef.current !== 1);
    if (powerChanged) {
      lastRidgePowerRatioRef.current = citySatisfaction;
      if (ridgeWindowsRef.current && ridgeWindowsRef.current.instanceColor) {
        for (let i = 0; i < stageLayout.ridgeWindows.length; i++) {
          const rw = stageLayout.ridgeWindows[i];
          let lit = ridgeWinLitRef.current[i] === 1;
          if (citySatisfaction <= Math.max(0.01, rw.threshold - 0.02)) {
            lit = false;
          } else if (citySatisfaction >= Math.min(0.99, rw.threshold + 0.02)) {
            lit = true;
          }
          ridgeWinLitRef.current[i] = lit ? 1 : 0;
          ridgeWindowsRef.current.setColorAt(i, lit ? rw.color : COLOR_WIN_OFF);
        }
        ridgeWindowsRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  const gantryXs = [-18.0, -12.0, -6.0, 0.0, 6.0, 10.8];
  const pylonXs = [-16.0, -6.0, 4.0, 13.0];
  const turbineRibXs = [-25.5, -21.8, -18.1, -14.4, -10.7, -7.0, -3.3, 0.4, 2.8];
  const deaeratorLoopsX = [-16.5, -8.5, -1.0];
  const turbineLoopsX = [-19.5, -11.0, -3.5];

  const distilleryBaseY = Y(distilleryGroundW);

  return (
    <group position={[6.0, 1.95, 0.2]} rotation={[0, -Math.PI / 2, 0]}>
      <SovietBlastWindowFrame3D
        width={3.8}
        height={1.8}
        plaqueTitle="PANORAMIC MORALE GLAZING — RATED TO 3.6 ROENTGEN"
        plaqueSub="(DO NOT LEAN ON GLASS) // SECTOR 84 REACTOR OVERLOOK"
      />

      <group ref={stageGroupRef}>
        <Win1SteelDripAndPipeLedge3D />

        {/* 1:1 Meter 42m Deep Panoramic Industrial Props */}
        <group position={[0, -0.3, 0]}>
          {/* TIER 1 (2m–14m Out, y = -10.9m to -4.75m): Sprawling Stepped RBMK Roofs, VT-2 Stack & 500kV Switchyard */}
          <group>
            {/* Concrete Switchyard Apron Slab */}
            <mesh
              position={[-8.1, Y(-10.78), -9.6]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[40.8, 7.6]} />
              <meshBasicMaterial
                color="#0d1620"
                polygonOffset
                polygonOffsetFactor={-1}
                fog={false}
              />
            </mesh>

            {/* 1. Upper Deaerator & Auxiliary Gallery (z = -1.8..-4.8, roof y = -5.5m) */}
            <mesh position={[-10.25, Y(-8.2), -3.3]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[29.5, 5.4, 3.0]} />
              <meshBasicMaterial map={concreteWallTex} fog={false} />
            </mesh>
            <mesh
              position={[-10.25, Y(-5.49), -3.3]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[29.3, 2.9]} />
              <meshBasicMaterial map={tarGravelRoofTex} fog={false} />
            </mesh>
            <mesh position={[-10.25, Y(-5.44), -1.84]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[29.5, 0.12, 0.1]} />
              <meshBasicMaterial color="#1d2e40" fog={false} />
            </mesh>
            {/* Raised Deaerator Machinery Penthouse (+Z wall faces camera, top strictly below worldY = -4.5m) */}
            <mesh position={[-7.5, Y(-5.12), -3.8]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[14.0, 0.76, 1.3]} />
              <meshBasicMaterial map={concreteWallTex} fog={false} />
            </mesh>
            <mesh
              position={[-7.5, Y(-4.73), -3.8]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[13.8, 1.2]} />
              <meshBasicMaterial map={tarGravelRoofTex} fog={false} />
            </mesh>

            {/* 2. Main Stepped-Down RBMK Turbine Hall (z = -4.7..-8.9, roof y = -7.2m) */}
            <mesh position={[-12.25, Y(-9.05), -6.8]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[31.5, 3.7, 4.2]} />
              <meshBasicMaterial map={concreteWallTex} fog={false} />
            </mesh>
            <mesh
              position={[-12.25, Y(-7.19), -6.8]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[31.3, 4.1]} />
              <meshBasicMaterial map={tarGravelRoofTex} fog={false} />
            </mesh>
            {turbineRibXs.map((rx, idx) => (
              <mesh
                key={`turb-rib-${idx}`}
                position={[rx, Y(-7.11), -6.8]}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <boxGeometry args={[0.24, 0.18, 4.1]} />
                <meshBasicMaterial color="#1d2e40" fog={false} />
              </mesh>
            ))}
            {/* Turbine Hall Clerestory Monitor */}
            <mesh position={[-11.5, Y(-6.65), -6.7]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[21.0, 1.1, 1.4]} />
              <meshBasicMaterial map={concreteWallTex} fog={false} />
            </mesh>
            <mesh
              position={[-11.5, Y(-6.09), -6.7]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[20.8, 1.3]} />
              <meshBasicMaterial map={tarGravelRoofTex} fog={false} />
            </mesh>

            {/* 3. Lower Auxiliary Pump House Wing & Condenser Bay (roof y = -8.0m) */}
            <mesh position={[-31.0, Y(-9.45), -6.8]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[6.0, 2.9, 4.0]} />
              <meshBasicMaterial map={concreteWallTex} fog={false} />
            </mesh>
            <mesh
              position={[-31.0, Y(-7.99), -6.8]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[5.9, 3.9]} />
              <meshBasicMaterial map={tarGravelRoofTex} fog={false} />
            </mesh>
            <mesh position={[-21.0, Y(-9.45), -9.15]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[14.0, 2.9, 0.9]} />
              <meshBasicMaterial map={concreteWallTex} fog={false} />
            </mesh>
            <mesh
              position={[-21.0, Y(-7.99), -9.15]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[13.8, 0.84]} />
              <meshBasicMaterial map={tarGravelRoofTex} fog={false} />
            </mesh>

            {/* 4. Adjacent Unit 3 RBMK Reactor Block & Biological Shield Cap (y = -6.3m / -4.75m) */}
            <mesh position={[6.2, Y(-8.6), -7.2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[5.4, 4.6, 4.0]} />
              <meshBasicMaterial map={concreteWallTex} fog={false} />
            </mesh>
            <mesh
              position={[6.2, Y(-6.29), -7.2]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[5.3, 3.9]} />
              <meshBasicMaterial map={tarGravelRoofTex} fog={false} />
            </mesh>
            <mesh position={[6.2, Y(-5.525), -7.2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[3.8, 1.55, 2.8]} />
              <meshBasicMaterial map={concreteWallTex} fog={false} />
            </mesh>
            <mesh
              position={[6.2, Y(-4.74), -7.2]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[3.7, 2.7]} />
              <meshBasicMaterial map={tarGravelRoofTex} fog={false} />
            </mesh>

            {/* 5. Tall Red-and-White Lattice VT-2 Ventilation Stack (+6.2, -7.5, y = -4.75m up to +5.40m) */}
            <group position={[6.2, Y(-4.75), -7.5]}>
              <mesh position={[0, 5.075, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <cylinderGeometry args={[0.24, 0.44, 10.15, 12, 1, true]} />
                <meshBasicMaterial map={stackTex} fog={false} />
              </mesh>
              {/* Surrounding Skeletal Steel Lattice Cage (lower 7.4m) */}
              {[
                [-0.44, 0.44],
                [0.44, 0.44],
                [-0.44, -0.44],
                [0.44, -0.44],
              ].map(([lx, lz], idx) => (
                <mesh
                  key={`vt2-leg-${idx}`}
                  position={[lx, 3.7, lz]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <boxGeometry args={[0.05, 7.4, 0.05]} />
                  <meshBasicMaterial color="#213140" fog={false} />
                </mesh>
              ))}
              <mesh position={[0, 3.7, 0.44]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[0.92, 7.4]} />
                <meshBasicMaterial
                  map={vt2LatticeTex}
                  alphaTest={0.5}
                  side={THREE.DoubleSide}
                  fog={false}
                />
              </mesh>
              <mesh
                position={[-0.44, 3.7, 0]}
                rotation={[0, Math.PI / 2, 0]}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[0.92, 7.4]} />
                <meshBasicMaterial
                  map={vt2LatticeTex}
                  alphaTest={0.5}
                  side={THREE.DoubleSide}
                  fog={false}
                />
              </mesh>
              {[2.5, 5.0, 7.2].map((py, idx) => (
                <mesh
                  key={`vt2-ring-${idx}`}
                  position={[0, py, 0]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <boxGeometry args={[1.15, 0.1, 1.15]} />
                  <meshBasicMaterial color="#1a2632" fog={false} />
                </mesh>
              ))}
            </group>

            {/* 6. Insulated Silver Steam Manifolds with 3D U-Shaped Expansion Loops */}
            {[-2.25, -2.65].map((pz, idx) => (
              <mesh
                key={`deaer-steam-${idx}`}
                position={[-9.5, Y(-5.32), pz]}
                rotation={[0, 0, Math.PI / 2]}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <cylinderGeometry args={[0.09, 0.09, 27.0, 8]} />
                <meshBasicMaterial color={idx === 0 ? "#7d92a6" : "#5e7387"} fog={false} />
              </mesh>
            ))}
            {deaeratorLoopsX.map((lx, idx) => (
              <group key={`deaer-loop-${idx}`} position={[lx, Y(-5.32), -2.25]}>
                <mesh position={[-0.45, 0, 0.22]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[0.14, 0.14, 0.48]} />
                  <meshBasicMaterial color="#7d92a6" fog={false} />
                </mesh>
                <mesh position={[0.45, 0, 0.22]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[0.14, 0.14, 0.48]} />
                  <meshBasicMaterial color="#7d92a6" fog={false} />
                </mesh>
                <mesh position={[0, 0, 0.42]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[1.04, 0.14, 0.14]} />
                  <meshBasicMaterial color="#91a8bd" fog={false} />
                </mesh>
              </group>
            ))}

            {[-5.15, -7.95].map((pz, idx) => (
              <mesh
                key={`turb-steam-${idx}`}
                position={[-11.5, Y(-7.02), pz]}
                rotation={[0, 0, Math.PI / 2]}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <cylinderGeometry args={[0.11, 0.11, 29.0, 8]} />
                <meshBasicMaterial color={idx === 0 ? "#7d92a6" : "#5e7387"} fog={false} />
              </mesh>
            ))}
            {turbineLoopsX.map((lx, idx) => (
              <group key={`turb-loop-${idx}`} position={[lx, Y(-7.02), -7.95]}>
                <mesh position={[-0.55, 0, -0.25]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[0.16, 0.16, 0.56]} />
                  <meshBasicMaterial color="#7d92a6" fog={false} />
                </mesh>
                <mesh position={[0.55, 0, -0.25]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[0.16, 0.16, 0.56]} />
                  <meshBasicMaterial color="#7d92a6" fog={false} />
                </mesh>
                <mesh position={[0, 0, -0.48]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[1.26, 0.16, 0.16]} />
                  <meshBasicMaterial color="#91a8bd" fog={false} />
                </mesh>
              </group>
            ))}

            {/* Lit Steel Rooftop Catwalks */}
            <mesh position={[-10.2, Y(-5.46), -2.02]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[28.5, 0.04, 0.36]} />
              <meshBasicMaterial color="#263a4d" fog={false} />
            </mesh>
            <mesh position={[-12.0, Y(-7.16), -4.92]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[30.0, 0.04, 0.38]} />
              <meshBasicMaterial color="#263a4d" fog={false} />
            </mesh>

            {/* Instanced Rooftop Cyclone Vents, Vertical Glass-Block Strips & Walkway Lamps */}
            <instancedMesh
              ref={roofVentsRef}
              args={[fourFaceGeo, undefined, 28]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <meshBasicMaterial color="#243442" fog={false} />
            </instancedMesh>
            <instancedMesh
              ref={glassBlockStripsRef}
              args={[undefined, undefined, 56]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                color="#ffffff"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>
            <instancedMesh
              ref={roofLampsRef}
              args={[undefined, undefined, 14]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.2, 0.16]} />
              <meshBasicMaterial
                color="#ffba52"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>
            <instancedMesh
              ref={roofLampPoolsRef}
              args={[undefined, undefined, 14]}
              renderOrder={2}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1.6, 1.2]} />
              <meshBasicMaterial
                map={floodPoolTex}
                color="#ffba52"
                transparent
                opacity={0.34}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                fog={false}
              />
            </instancedMesh>

            {/* Upgraded Cherenkov Ionized Roof Vent Beam & Roofscape Glow */}
            <group name="cherenkov-roof-glow" ref={cherenkovRef} visible={false}>
              {/* Primary Unit 3 Biological Shield Roof Column */}
              <mesh position={[6.2, Y(-0.2), -7.2]} renderOrder={4} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[2.6, 9.6]} />
                <meshBasicMaterial
                  ref={cherenkovCoreMatRef}
                  map={cherenkovBeamTex}
                  color="#9ef6ff"
                  transparent
                  opacity={0.9}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
              <mesh position={[6.2, Y(0.6), -7.1]} renderOrder={3} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[6.4, 11.4]} />
                <meshBasicMaterial
                  ref={cherenkovHaloMatRef}
                  map={cherenkovBeamTex}
                  color="#18dcff"
                  transparent
                  opacity={0.48}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
              {/* Eerie #18dcff Rooftop Ionization Spill Across Stepped Roofs */}
              <mesh
                position={[4.2, Y(-4.65), -6.8]}
                rotation={[-Math.PI / 2, 0, 0]}
                renderOrder={2}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[14.0, 8.0]} />
                <meshBasicMaterial
                  ref={cherenkovSpillMatRef}
                  map={floodPoolTex}
                  color="#18dcff"
                  transparent
                  opacity={0.45}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
            </group>

            {/* 7. 500kV High-Voltage Switchyard (8 Heavy Transformers, 48 Bushings, 6 Gantries, 4 Pylons, Wires) */}
            <mesh position={[-5.5, Y(-10.22), -12.52]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <planeGeometry args={[34.0, 1.16]} />
              <meshBasicMaterial map={chainLinkTex} alphaTest={0.5} fog={false} />
            </mesh>
            <mesh position={[-5.5, Y(-9.62), -12.52]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <planeGeometry args={[34.0, 0.04]} />
              <meshBasicMaterial color="#2f403b" fog={false} />
            </mesh>
            <instancedMesh
              ref={fencePostsRef}
              args={[undefined, undefined, 28]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.07, 1.18]} />
              <meshBasicMaterial color="#1a2622" fog={false} />
            </instancedMesh>

            <instancedMesh
              ref={transformersRef}
              args={[fourFaceGeo, undefined, 8]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <meshBasicMaterial map={transformerTex} fog={false} />
            </instancedMesh>
            <instancedMesh
              ref={bushingsRef}
              args={[undefined, undefined, 48]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.1, 0.44]} />
              <meshBasicMaterial color="#cfc7b0" fog={false} />
            </instancedMesh>

            {/* 6 Steel 500kV Gantry Portals */}
            {gantryXs.map((gx, idx) => (
              <group key={`gantry-${idx}`} position={[gx, Y(-10.8), -11.3]}>
                <mesh position={[-1.05, 1.55, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[0.14, 3.1, 0.14]} />
                  <meshBasicMaterial color="#233342" fog={false} />
                </mesh>
                <mesh position={[1.05, 1.55, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[0.14, 3.1, 0.14]} />
                  <meshBasicMaterial color="#233342" fog={false} />
                </mesh>
                <mesh position={[0, 3.05, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[2.55, 0.16, 0.16]} />
                  <meshBasicMaterial color="#2c4052" fog={false} />
                </mesh>
              </group>
            ))}

            {/* 4 Tall Outgoing Lattice 500kV Pylons */}
            {pylonXs.map((px, idx) => (
              <mesh
                key={`pylon-500kv-${idx}`}
                position={[px, Y(-7.6), -14.1]}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[2.45, 6.4]} />
                <meshBasicMaterial
                  map={latticePylonTex}
                  alphaTest={0.5}
                  fog={false}
                />
              </mesh>
            ))}

            {/* 3D Sagging 500kV Overhead Transmission Lines */}
            <mesh geometry={switchyardWiresGeo} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <meshBasicMaterial
                color="#1c2a38"
                side={THREE.DoubleSide}
                fog={false}
              />
            </mesh>

            {/* Warm Sodium Yard Floodlight Masts & Ground Pools */}
            <instancedMesh
              ref={yardFloodPostsRef}
              args={[undefined, undefined, 10]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.09, 2.6]} />
              <meshBasicMaterial color="#1c2630" fog={false} />
            </instancedMesh>
            <instancedMesh
              ref={yardFloodHeadsRef}
              args={[undefined, undefined, 10]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.24, 0.14]} />
              <meshBasicMaterial
                color="#ff9b38"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>
            <instancedMesh
              ref={yardFloodPoolsRef}
              args={[undefined, undefined, 10]}
              renderOrder={2}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[4.4, 3.2]} />
              <meshBasicMaterial
                map={floodPoolTex}
                color="#ff9b38"
                transparent
                opacity={0.44}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                fog={false}
              />
            </instancedMesh>

            {/* 8. Snowy Plant Perimeter Road, Tunnel Portal, Checkpoint Gate, Propaganda Billboard & Animated Trucks */}
            <mesh
              geometry={perimeterRoadRibbonGeo}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <meshBasicMaterial
                map={perimeterRoadTex}
                polygonOffset
                polygonOffsetFactor={-2}
                fog={false}
              />
            </mesh>
            {/* Concrete Perimeter Road Hillside Tunnel Portal Into Corner Ridge */}
            <group position={[13.9, Y(win1GroundY(13.9, -13.3) + 0.45), -13.3]}>
              <mesh raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.9, 1.15, 1.85]} />
                <meshBasicMaterial color="#182430" fog={false} />
              </mesh>
              <mesh position={[-0.46, -0.1, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.04, 0.78, 1.32]} />
                <meshBasicMaterial color="#05080d" fog={false} />
              </mesh>
            </group>

            {/* Security Checkpoint Booth & Striped Boom Gate */}
            <group position={[3.2, Y(-10.75), -12.7]}>
              <mesh position={[0, 0.55, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[1.15, 1.1, 0.85]} />
                <meshBasicMaterial color="#1b2630" fog={false} />
              </mesh>
              <mesh position={[0, 0.68, 0.44]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[0.65, 0.34]} />
                <meshBasicMaterial color="#ffd478" toneMapped={false} fog={false} />
              </mesh>
              <mesh position={[-0.75, 0.32, -0.42]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[1.4, 0.07, 0.07]} />
                <meshBasicMaterial color="#ff2a2a" fog={false} />
              </mesh>
            </group>

            {/* Floodlit "GLORY TO PEACEFUL ATOM!" Roadside Propaganda Billboard */}
            <group position={[-0.2, Y(-9.45), -12.65]} rotation={[-0.22, -0.14, 0]}>
              <mesh position={[-1.4, -0.82, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[0.12, 1.2]} />
                <meshBasicMaterial color="#151d24" fog={false} />
              </mesh>
              <mesh position={[1.4, -0.82, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[0.12, 1.2]} />
                <meshBasicMaterial color="#151d24" fog={false} />
              </mesh>
              <mesh raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[3.6, 0.96]} />
                <meshBasicMaterial map={billboardTex} toneMapped={false} fog={false} />
              </mesh>
            </group>

            {/* Animated Patrol & Tanker Trucks */}
            <instancedMesh
              ref={truckBodiesRef}
              args={[fourFaceGeo, undefined, WIN1_TRUCK_COUNT]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <meshBasicMaterial color="#ffffff" fog={false} />
            </instancedMesh>
            <instancedMesh
              ref={truckLightsRef}
              args={[undefined, undefined, WIN1_TRUCK_COUNT * 2]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} fog={false} />
            </instancedMesh>
            <instancedMesh
              ref={truckHalosRef}
              args={[undefined, undefined, WIN1_TRUCK_COUNT]}
              renderOrder={2}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={truckBeamTex}
                color="#ffffff"
                transparent
                opacity={0.72}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                fog={false}
              />
            </instancedMesh>
          </group>

          {/* TIER 2 (15m–26m Out): Pine Windbreaks, Reflective Cooling Pond, Twin 11.5m Cooling Towers, VIP Pipeline & Spirit Train */}
          <group>
            {/* Ice-Rimmed Dark Reflective Cooling Reservoir / Discharge Canal */}
            <mesh
              geometry={coolingCanalRibbonGeo}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <meshBasicMaterial
                map={coolingPondTex}
                polygonOffset
                polygonOffsetFactor={-1}
                side={THREE.DoubleSide}
                fog={false}
              />
            </mesh>
            {/* Concrete Warm-Water Outfall Weir & Corner Ridge Intake Headwall */}
            <mesh position={[-17.2, Y(-10.1), -15.2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[2.4, 0.85, 0.8]} />
              <meshBasicMaterial color="#1c2c3b" fog={false} />
            </mesh>
            <mesh
              position={[
                14.0,
                Y(win1GroundY(13.8, coolingCanalCenterZ(13.8)) + 0.3),
                coolingCanalCenterZ(13.8),
              ]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[1.1, 0.95, 2.8]} />
              <meshBasicMaterial color="#1a2937" fog={false} />
            </mesh>

            {/* Snow-Dusted Pine Windbreaks */}
            <instancedMesh
              ref={win1PinesRef}
              args={[undefined, undefined, 96]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1.18, 1.9]} />
              <meshBasicMaterial
                map={pineTex}
                alphaTest={0.5}
                fog={false}
              />
            </instancedMesh>

            {/* Two Colossal 11.5m Hyperbolic LatheGeometry Cooling Towers (throats at worldY = +1.00m) */}
            {[
              { x: -9.6, z: -18.0 },
              { x: -0.6, z: -19.2 },
            ].map((tc, idx) => (
              <group key={`win1-cooling-tower-${idx}`}>
                {/* Concrete Cold-Water Basin Wall */}
                <mesh
                  position={[tc.x, Y(-10.22), tc.z]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <cylinderGeometry args={[4.45, 4.6, 0.62, 24]} />
                  <meshBasicMaterial color="#182634" fog={false} />
                </mesh>
                {/* Dark Reflective Cold Basin Water Surface */}
                <mesh
                  position={[tc.x, Y(-9.9), tc.z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <circleGeometry args={[4.28, 24]} />
                  <meshBasicMaterial color="#15283a" fog={false} />
                </mesh>
                {/* Hyperbolic Concrete Shell */}
                <mesh
                  geometry={coolingTowerGeo}
                  position={[tc.x, Y(-10.5), tc.z]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <meshBasicMaterial
                    map={coolingTowerTex}
                    side={THREE.DoubleSide}
                    fog={false}
                  />
                </mesh>
                {/* Recessed Misty Throat Interior So Looking Down Shows Depth */}
                <mesh
                  position={[tc.x, Y(0.78), tc.z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <circleGeometry args={[2.68, 24]} />
                  <meshBasicMaterial color="#0b1520" fog={false} />
                </mesh>
                <mesh
                  position={[tc.x, Y(0.84), tc.z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  renderOrder={1}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <circleGeometry args={[2.45, 24]} />
                  <meshBasicMaterial
                    color="#7ea2c2"
                    transparent
                    opacity={0.28}
                    depthWrite={false}
                    fog={false}
                  />
                </mesh>
              </group>
            ))}

            {/* 64 Diagonal V-Shaped Base Support Struts */}
            <instancedMesh
              ref={towerStrutsRef}
              args={[undefined, undefined, 64]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.14, 1, 0.14]} />
              <meshBasicMaterial color="#25384b" fog={false} />
            </instancedMesh>

            {/* 16 Multi-Layered Billowing Steam Plumes */}
            {Array.from({ length: 16 }, (_, idx) => (
              <mesh
                key={`win1-tower-steam-${idx}`}
                ref={(el) => {
                  steamRefs.current[idx] = el;
                }}
                position={[idx < 8 ? -9.6 : -0.6, Y(1.2), -18.0]}
                renderOrder={4}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[2.2, 1.5]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    steamMatsRef.current[idx] = mat;
                  }}
                  map={steamTex}
                  transparent
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
            ))}

            {/* Illuminated Elevated "VIP Vodka Pipeline" Twin Insulated Pipes on Trestles */}
            {vipPipelineData.segments.map((seg, idx) => (
              <group
                key={`vip-pipe-seg-${idx}`}
                position={seg.mid}
                quaternion={seg.quat}
              >
                <mesh position={[-0.12, 0.04, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[0.22, 0.22, seg.len + 0.08]} />
                  <meshBasicMaterial color="#758899" fog={false} />
                </mesh>
                <mesh position={[0.14, -0.02, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <boxGeometry args={[0.15, 0.15, seg.len + 0.08]} />
                  <meshBasicMaterial color="#586b7d" fog={false} />
                </mesh>
              </group>
            ))}
            <instancedMesh
              ref={vipStanchionsRef}
              args={[undefined, undefined, 22]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <boxGeometry args={[0.26, 1, 0.16]} />
              <meshBasicMaterial color="#233240" fog={false} />
            </instancedMesh>
            <instancedMesh
              ref={vipLampsRef}
              args={[undefined, undefined, 28]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.17, 0.17]} />
              <meshBasicMaterial
                ref={vipLampsMatRef}
                color="#ffe170"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>
            <instancedMesh
              ref={vipLampHalosRef}
              args={[undefined, undefined, 28]}
              renderOrder={2}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.68, 0.68]} />
              <meshBasicMaterial
                ref={vipLampHalosMatRef}
                map={floodPoolTex}
                color="#ffe170"
                transparent
                opacity={0.52}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                fog={false}
              />
            </instancedMesh>
            {vipPipelineData.steamAnchors.map((anc, idx) => (
              <mesh
                key={`vip-steam-wisp-${idx}`}
                ref={(el) => {
                  vipSteamRefs.current[idx] = el;
                }}
                position={[anc.x, anc.y + 0.25, anc.z]}
                renderOrder={4}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[0.85, 0.65]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    vipSteamMatsRef.current[idx] = mat;
                  }}
                  map={steamTex}
                  transparent
                  opacity={0.35}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
            ))}

            {/* Industrial Freight Rail Spur & Viaduct Ending Into Corner Hillside Tunnel Portal (z = -24.2) */}
            <mesh position={[-7.2, Y(-7.38), -24.2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[49.6, 0.26, 0.72]} />
              <meshBasicMaterial color="#253442" fog={false} />
            </mesh>
            <mesh position={[-7.2, Y(-7.22), -24.2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[49.6, 0.06, 0.34]} />
              <meshBasicMaterial color="#121b24" fog={false} />
            </mesh>
            <mesh position={[-7.2, Y(-8.82), -24.12]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <planeGeometry args={[49.6, 2.65]} />
              <meshBasicMaterial
                map={viaductArchesTex}
                alphaTest={0.5}
                fog={false}
              />
            </mesh>
            {/* Concrete Freight Rail Tunnel Portal Embedded in Corner Ridge */}
            <group position={[17.5, Y(-6.95), -24.2]}>
              <mesh position={[0.4, 0.12, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[1.4, 1.35, 1.35]} />
                <meshBasicMaterial color="#192531" fog={false} />
              </mesh>
              <mesh position={[-0.31, -0.02, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.04, 0.88, 0.82]} />
                <meshBasicMaterial color="#05080d" fog={false} />
              </mesh>
              <mesh position={[-0.25, -0.15, 0.62]} rotation={[0, 0.35, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.85, 1.1, 0.2]} />
                <meshBasicMaterial color="#141e28" fog={false} />
              </mesh>
            </group>
            <instancedMesh
              ref={railYardLightsRef}
              args={[undefined, undefined, 16]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.14, 0.14]} />
              <meshBasicMaterial color="#ffb048" toneMapped={false} fog={false} />
            </instancedMesh>

            {/* Slow-Moving Soviet Spirit-Tanker Train (SPIRIT TANKER) */}
            <group ref={spiritTrainGroupRef} position={[-14.0, Y(-6.92), -24.2]}>
              {/* Lead Soviet Diesel Locomotive */}
              <group
                ref={spiritLocoGroupRef}
                position={[4.6, 0, 0]}
              >
                <mesh
                  geometry={fourFaceGeo}
                  scale={[1.55, 0.48, 0.42]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <meshBasicMaterial color="#1e362c" fog={false} />
                </mesh>
                <mesh position={[0.25, -0.02, 0.22]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <planeGeometry args={[1.45, 0.1]} />
                  <meshBasicMaterial color="#c82b23" fog={false} />
                </mesh>
                <mesh position={[0.42, 0.1, 0.22]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <planeGeometry args={[0.38, 0.16]} />
                  <meshBasicMaterial
                    ref={spiritTrainCabMatRef}
                    color="#ffd066"
                    toneMapped={false}
                    fog={false}
                  />
                </mesh>
                <mesh position={[1.8, -0.05, 0.1]} renderOrder={2} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <planeGeometry args={[2.2, 0.56]} />
                  <meshBasicMaterial
                    ref={spiritTrainBeamMatRef}
                    map={truckBeamTex}
                    color="#ffe598"
                    transparent
                    opacity={0.78}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    fog={false}
                  />
                </mesh>
              </group>

              {/* 6 Cylindrical SPIRIT TANKER Cars */}
              {[-3.8, -2.35, -0.9, 0.55, 2.0, 3.45].map((cx, idx) => (
                <group
                  key={`spirit-car-${idx}`}
                  ref={(el) => {
                    spiritCarGroupRefs.current[idx] = el;
                  }}
                  position={[cx, 0, 0]}
                >
                  <mesh position={[0, -0.17, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <boxGeometry args={[1.28, 0.1, 0.38]} />
                    <meshBasicMaterial color="#161f28" fog={false} />
                  </mesh>
                  <mesh
                    position={[0, 0.05, 0]}
                    rotation={[0, 0, Math.PI / 2]}
                    raycast={NOOP_RAYCAST}
                    frustumCulled={false}
                  >
                    <cylinderGeometry args={[0.2, 0.2, 1.2, 10]} />
                    <meshBasicMaterial color="#586a7a" fog={false} />
                  </mesh>
                  <mesh position={[0, 0.06, 0.21]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <planeGeometry args={[1.08, 0.22]} />
                    <meshBasicMaterial map={spiritTankerLabelTex} fog={false} />
                  </mesh>
                  <mesh position={[0, -0.13, 0.2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <planeGeometry args={[0.82, 0.06]} />
                    <meshBasicMaterial
                      ref={(mat) => {
                        spiritCarGlowMatsRef.current[idx] = mat;
                      }}
                      color="#ff9b38"
                      toneMapped={false}
                      fog={false}
                    />
                  </mesh>
                  {idx === 0 && (
                    <mesh position={[-0.65, 0.04, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                      <planeGeometry args={[0.1, 0.1]} />
                      <meshBasicMaterial color="#ff2a2a" toneMapped={false} fog={false} />
                    </mesh>
                  )}
                </group>
              ))}
            </group>
          </group>

          {/* TIER 3 (32m–39m Out): Far Industrial Ridge & Sprawling State Vodka Distillery "KRISTALL-84" */}
          <group>
            {/* Feathered Warm Amber/Crimson Light-Pollution Curved Horizon Arc Behind Distillery */}
            <mesh
              position={[-0.2, Y(2.8), 6.0]}
              rotation={[0, Math.PI / 2, 0]}
              renderOrder={1}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <cylinderGeometry args={[50.0, 50.0, 18.0, 32, 1, true, 0.72, 1.24]} />
              <meshBasicMaterial
                ref={vodkaLightPollutionMatRef}
                map={vodkaLightPollutionTex}
                transparent
                opacity={0.34}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.BackSide}
                fog={false}
              />
            </mesh>

            {/* Surrounding Industrial Ridge Warehouses, Water Towers & Auxiliary Smokestacks */}
            <instancedMesh
              ref={ridgeFactoriesRef}
              args={[fourFaceGeo, undefined, WIN1_MAX_RIDGE_BLOCKS]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <meshBasicMaterial color="#ffffff" fog={false} />
            </instancedMesh>
            <instancedMesh
              ref={ridgeWindowsRef}
              args={[undefined, undefined, WIN1_MAX_RIDGE_WINDOWS]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                color="#ffffff"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>

            {/* 2 Steel-Legged Industrial Water Towers */}
            {[-19.2, 20.4].map((wx, idx) => {
              const wtBase = Y(win1GroundY(wx, -34.8));
              return (
                <group key={`ridge-water-tower-${idx}`} position={[wx, wtBase, -34.8]}>
                  <mesh position={[0, 1.35, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <cylinderGeometry args={[0.26, 0.44, 2.7, 6]} />
                    <meshBasicMaterial color="#18232e" fog={false} />
                  </mesh>
                  <mesh position={[0, 3.05, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <cylinderGeometry args={[0.78, 0.65, 0.9, 10]} />
                    <meshBasicMaterial color="#21303d" fog={false} />
                  </mesh>
                  <mesh position={[0, 3.65, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <coneGeometry args={[0.84, 0.45, 10]} />
                    <meshBasicMaterial color="#15202b" fog={false} />
                  </mesh>
                </group>
              );
            })}

            {/* 5 Striped Auxiliary Industrial Smokestacks */}
            {[-24.5, -14.2, -5.8, 18.8, 23.2].map((sx, idx) => {
              const stackBase = Y(win1GroundY(sx, -35.6));
              const h = [4.3, 4.6, 4.2, 4.5, 4.1][idx];
              return (
                <mesh
                  key={`ridge-aux-stack-${idx}`}
                  position={[sx, stackBase + h * 0.5, -35.6]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <cylinderGeometry args={[0.14, 0.24, h, 8, 1, true]} />
                  <meshBasicMaterial map={stackTex} fog={false} />
                </mesh>
              );
            })}

            {/* SPRAWLING STATE VODKA DISTILLERY COMPLEX "KRISTALL-84" (x = +1.5..+16.0, z = -34.2) */}
            <group position={[0, distilleryBaseY, 0]}>
              {/* 3-Wing Red-Brick & Concrete Distillery Halls */}
              <mesh position={[5.6, 1.3, -34.2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[4.6, 2.6, 2.0]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    distilleryHallMatsRef.current[0] = mat;
                  }}
                  map={distilleryBrickTex}
                  fog={false}
                />
              </mesh>
              <mesh position={[9.4, 1.6, -34.2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[5.4, 3.2, 2.3]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    distilleryHallMatsRef.current[1] = mat;
                  }}
                  map={distilleryBrickTex}
                  color="#ffffff"
                  fog={false}
                />
              </mesh>
              <mesh position={[13.7, 1.25, -34.2]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[4.2, 2.5, 2.0]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    distilleryHallMatsRef.current[2] = mat;
                  }}
                  map={distilleryBrickTex}
                  color="#ffffff"
                  fog={false}
                />
              </mesh>

              {/* 8 Illuminated Glass Factory Sawtooth Skylights */}
              {[3.9, 4.9, 5.9, 6.9, 12.2, 13.2, 14.2, 15.2].map((sx, idx) => (
                <group
                  key={`vodka-sawtooth-${idx}`}
                  position={[sx, idx < 4 ? 2.86 : 2.76, -34.1]}
                >
                  <mesh rotation={[0, 0, 0.28]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <boxGeometry args={[0.85, 0.55, 1.65]} />
                    <meshBasicMaterial color="#1d2128" fog={false} />
                  </mesh>
                  <mesh
                    position={[0.18, 0.04, 0.84]}
                    raycast={NOOP_RAYCAST}
                    frustumCulled={false}
                  >
                    <planeGeometry args={[0.72, 0.36]} />
                    <meshBasicMaterial
                      ref={(mat) => {
                        distillerySawtoothMatsRef.current[idx] = mat;
                      }}
                      color="#ffe178"
                      toneMapped={false}
                      fog={false}
                    />
                  </mesh>
                </group>
              ))}

              {/* 6 Cylindrical Grain & Spirit Storage Silos + Overhead Conveyor Headhouse */}
              {[1.7, 2.35, 3.0, 3.65, 4.3, 4.95].map((sx, idx) => (
                <mesh
                  key={`vodka-silo-${idx}`}
                  position={[sx, 1.45, -33.5]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <cylinderGeometry args={[0.31, 0.31, 2.9, 10]} />
                  <meshBasicMaterial color={idx % 2 === 0 ? "#4a3c3c" : "#3d3131"} fog={false} />
                </mesh>
              ))}
              <mesh position={[3.32, 3.08, -33.5]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[3.9, 0.42, 0.68]} />
                <meshBasicMaterial color="#2a2224" fog={false} />
              </mesh>

              {/* 5 Tall Rectification Column Towers With Condenser Ring Galleries */}
              {[
                { x: 6.8, h: 4.2 },
                { x: 7.8, h: 4.7 },
                { x: 8.8, h: 5.5 },
                { x: 9.9, h: 4.6 },
                { x: 11.0, h: 4.1 },
              ].map((col, idx) => (
                <group key={`rect-col-${idx}`} position={[col.x, 0, -33.95]}>
                  <mesh position={[0, col.h * 0.5, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <cylinderGeometry args={[0.36, 0.42, col.h, 12]} />
                    <meshBasicMaterial
                      ref={(mat) => {
                        distilleryColumnMatsRef.current[idx] = mat;
                      }}
                      color="#5c4244"
                      fog={false}
                    />
                  </mesh>
                  {[0.45, 0.72, 0.92].map((f, rIdx) => (
                    <mesh
                      key={`rect-ring-${idx}-${rIdx}`}
                      position={[0, col.h * f, 0]}
                      raycast={NOOP_RAYCAST}
                      frustumCulled={false}
                    >
                      <cylinderGeometry args={[0.52, 0.52, 0.1, 12]} />
                      <meshBasicMaterial color="#1f181a" fog={false} />
                    </mesh>
                  ))}
                </group>
              ))}

              {/* 3 Tall Smoking Distillery Chimneys */}
              {[
                { x: 6.1, h: 5.1 },
                { x: 8.8, h: 5.8 },
                { x: 12.2, h: 4.9 },
              ].map((st, idx) => (
                <mesh
                  key={`vodka-stack-${idx}`}
                  position={[st.x, st.h * 0.5, -35.1]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <cylinderGeometry args={[0.2, 0.34, st.h, 10, 1, true]} />
                  <meshBasicMaterial map={stackTex} fog={false} />
                </mesh>
              ))}

              {/* Monumental Rooftop Neon Sign: VODKA PLANT "KRISTALL-84" */}
              <group position={[8.8, 4.35, -33.25]}>
                <mesh position={[0, -0.95, -0.06]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <planeGeometry args={[11.2, 0.62]} />
                  <meshBasicMaterial
                    map={vodkaTrussTex}
                    alphaTest={0.5}
                    fog={false}
                  />
                </mesh>
                {[-5.4, -1.8, 1.8, 5.4].map((lx, idx) => (
                  <mesh
                    key={`vodka-truss-leg-${idx}`}
                    position={[lx, -0.75, -0.05]}
                    raycast={NOOP_RAYCAST}
                    frustumCulled={false}
                  >
                    <boxGeometry args={[0.14, 1.4, 0.14]} />
                    <meshBasicMaterial color="#191e26" fog={false} />
                  </mesh>
                ))}
                <mesh position={[0, 0, -0.02]} renderOrder={1} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <planeGeometry args={[12.2, 2.55]} />
                  <meshBasicMaterial
                    ref={vodkaSignHaloMatRef}
                    color="#ff2420"
                    transparent
                    opacity={0.28}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    fog={false}
                  />
                </mesh>
                <mesh position={[0, 0, 0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <planeGeometry args={[11.2, 1.85]} />
                  <meshBasicMaterial
                    ref={vodkaSignMatRef}
                    map={vodkaSignTex}
                    toneMapped={false}
                    fog={false}
                  />
                </mesh>
              </group>

              {/* Monumental Slowly Rotating 3D Red Soviet Star Crowning Central Rectification Tower */}
              <group position={[8.8, 5.95, -33.95]}>
                <mesh position={[0, -0.25, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <cylinderGeometry args={[0.09, 0.16, 0.9, 8]} />
                  <meshBasicMaterial color="#2b2024" fog={false} />
                </mesh>
                <mesh position={[0, 0.5, -0.08]} renderOrder={1} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <planeGeometry args={[2.75, 2.75]} />
                  <meshBasicMaterial
                    ref={starHaloMatRef}
                    map={win1BeaconHaloTex}
                    color="#ff3828"
                    transparent
                    opacity={0.56}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                    fog={false}
                  />
                </mesh>
                <group ref={starGroupRef} position={[0, 0.5, 0]}>
                  <mesh geometry={sovietStarGeo} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <meshBasicMaterial
                      ref={starMatOuterRef}
                      color="#ff2a2a"
                      toneMapped={false}
                      fog={false}
                    />
                  </mesh>
                  <mesh
                    geometry={sovietStarGeo}
                    scale={[0.56, 0.56, 1.18]}
                    raycast={NOOP_RAYCAST}
                    frustumCulled={false}
                  >
                    <meshBasicMaterial
                      ref={starMatInnerRef}
                      color="#ff5e3a"
                      toneMapped={false}
                      fog={false}
                    />
                  </mesh>
                </group>
              </group>
            </group>

            {/* Drifting Distillery Chimney Smoke Plumes (12 puffs) */}
            {Array.from({ length: 12 }, (_, idx) => (
              <mesh
                key={`vodka-smoke-${idx}`}
                ref={(el) => {
                  distillerySmokeRefs.current[idx] = el;
                }}
                position={[8.8, Y(6.5), -35.1]}
                renderOrder={3}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[1.3, 0.9]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    distillerySmokeMatsRef.current[idx] = mat;
                  }}
                  map={steamTex}
                  transparent
                  opacity={0.42}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
            ))}

            {/* All Window 1 Staggered Blinking Red Aviation Beacons + Halos */}
            <instancedMesh
              ref={win1BeaconsRef}
              args={[undefined, undefined, WIN1_BEACON_COUNT]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                color="#ffffff"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>
            <instancedMesh
              ref={win1BeaconHalosRef}
              args={[undefined, undefined, WIN1_BEACON_COUNT]}
              renderOrder={2}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={win1BeaconHaloTex}
                color="#ffffff"
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
                fog={false}
              />
            </instancedMesh>
          </group>
        </group>
      </group>
    </group>
  );
});

interface CityWindowMeta {
  threshold: number;
  onColor: THREE.Color;
  canToggle: boolean;
  isSwitchedOn: boolean;
}

const MAX_CITY_BLOCKS = 120;
const MAX_APT_WINDOWS = 2800;
const MAX_CITY_BEACONS = 32;
const VEHICLE_COUNT = 16;
const COLOR_ROOM_WARM = ["#ffd478", "#ffe08e"];
const COLOR_ROOM_AMBER = ["#ff9c38", "#ffb354"];
const COLOR_ROOM_CRT = ["#70caff", "#92dbff"];
const COLOR_OFFICE_RIBBON = ["#ffe7ae", "#c9e7ff"];
const COLOR_GROUND_STOREFRONT = ["#ffab4a", "#ffd17a"];
const SCRATCH_OBJ = new THREE.Object3D();

/**
 * Window 2 Elevated Control-Tower Panorama (`+Z` Back Wall, 42m deep at 1:1 meters).
 * Features 3-wide industrial mullions, `KGS-84` frost box, finned radiator pipe,
 * unobstructed `0.11m` drip-lip, sweeping moonlit snow valley with winding river,
 * lit highway + 16 moving vehicles, railway viaduct, and distant 32m-39m city skyline.
 */
const WorkerCityDiorama3D: React.FC = React.memo(() => {
  const stageGroupRef = useRef<THREE.Group>(null);
  const pinesRef = useRef<THREE.InstancedMesh>(null);
  const roadLampPostsRef = useRef<THREE.InstancedMesh>(null);
  const roadLampHeadsRef = useRef<THREE.InstancedMesh>(null);
  const roadLampPoolsRef = useRef<THREE.InstancedMesh>(null);
  const vehiclesRef = useRef<THREE.InstancedMesh>(null);
  const vehicleHalosRef = useRef<THREE.InstancedMesh>(null);
  const panelkasRef = useRef<THREE.InstancedMesh>(null);
  const penthousesRef = useRef<THREE.InstancedMesh>(null);
  const rooftopAerialsRef = useRef<THREE.InstancedMesh>(null);
  const aptWindowsRef = useRef<THREE.InstancedMesh>(null);
  const streetlampsRef = useRef<THREE.InstancedMesh>(null);
  const cityBeaconsRef = useRef<THREE.InstancedMesh>(null);
  const cityBeaconHalosRef = useRef<THREE.InstancedMesh>(null);
  const streetHazeMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const lightPollutionMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const tvPodMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const palaceClockMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const heatPlantGlowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const citySmokeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const citySmokeMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);

  const trainGroupRef = useRef<THREE.Group>(null);
  const trainCarGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const trainHeadlightMeshRef = useRef<THREE.Mesh>(null);
  const trainWindowMatsRef = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const trainHeadlightMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const trainPosXRef = useRef(-6.0);
  const trainSpeedRef = useRef(0.95);
  const cityBeaconTimerRef = useRef(0.125);
  const cityBeaconMaskRef = useRef(-1);
  const lastCityPowerRatioRef = useRef(-1);
  const pendingRoomFlipRef = useRef(false);
  const randomToggleTimerRef = useRef(0);
  const toggleCursorRef = useRef(0);
  const windowToggleStatesRef = useRef<Uint8Array>(new Uint8Array(MAX_APT_WINDOWS));
  const cityWinLitRef = useRef<Uint8Array>(new Uint8Array(MAX_APT_WINDOWS).fill(1));
  const streetlampLitRef = useRef<Uint8Array>(new Uint8Array(28).fill(1));
  const roadLampLitRef = useRef<Uint8Array>(new Uint8Array(22).fill(1));

  const fourFaceGeo = useMemo(() => createFourFaceBoxGeometry(), []);
  const highwayRibbonGeo = useMemo(
    () =>
      createValleyRibbonGeometry(
        highwayCenterX,
        highwayHalfWidth,
        -2.5,
        -32.5,
        64,
        0.055,
      ),
    [],
  );

  const beaconHaloTex = useMemo(() => createBeaconHaloTexture(), []);
  const amberPoolTex = useMemo(
    () => createFloodPoolTexture("rgba(255, 155, 56, 0.85)"),
    [],
  );

  const cityLightPollutionTex = useMemo(
    () =>
      createFeatheredHorizonGlowTexture(
        "rgba(255, 160, 56, 0.94)",
        "rgba(255, 136, 40, 0.48)",
        "rgba(180, 82, 24, 0.14)",
      ),
    [],
  );

  const highwayRibbonTex = useMemo(() => {
    const tex = createNearestCanvasTexture(128, 512, (ctx, w, h) => {
      // Snow shoulders
      ctx.fillStyle = "#22364a";
      ctx.fillRect(0, 0, w, h);
      // Dark plowed winter asphalt
      ctx.fillStyle = "#0c141d";
      ctx.fillRect(20, 0, w - 40, h);
      // Tire-worn lane sheen
      ctx.fillStyle = "#121d2a";
      ctx.fillRect(30, 0, 22, h);
      ctx.fillRect(w - 52, 0, 22, h);
      // Dashed centerline
      ctx.fillStyle = "#6a7f94";
      for (let y = 8; y < h; y += 36) {
        ctx.fillRect(w / 2 - 2, y, 4, 18);
      }
    });
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  const pineTex = useMemo(() => createSnowPineTexture(), []);

  const viaductArchesTex = useMemo(() => {
    const tex = createNearestCanvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = "#1d2833";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2b3b4a";
      ctx.fillRect(0, 0, w, 6);
      ctx.fillStyle = "#16202a";
      ctx.fillRect(0, 6, 20, h - 6);
      ctx.fillRect(w - 20, 6, 20, h - 6);

      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.moveTo(28, h);
      ctx.lineTo(28, 48);
      ctx.arc(64, 48, 36, Math.PI, 0, false);
      ctx.lineTo(100, h);
      ctx.closePath();
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#10171f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(64, 48, 36, Math.PI, 0, false);
      ctx.stroke();
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(31, 1);
    return tex;
  }, []);

  const headlightConeTex = useMemo(
    () =>
      createNearestCanvasTexture(64, 32, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, h / 2, w, h / 2);
        grad.addColorStop(0, "rgba(255, 240, 175, 0.92)");
        grad.addColorStop(0.45, "rgba(255, 210, 110, 0.36)");
        grad.addColorStop(1, "rgba(255, 190, 80, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.42);
        ctx.lineTo(w, 2);
        ctx.lineTo(w, h - 2);
        ctx.lineTo(0, h * 0.58);
        ctx.closePath();
        ctx.fill();
      }),
    [],
  );

  // Dark silhouette precast architectural facade so towers pop cleanly against warm city horizon
  const darkCityFacadeTex = useMemo(
    () =>
      createNearestCanvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = "#d8e2ee";
        ctx.fillRect(0, 0, w, h);
        // Darker roof parapet band (UV v in [0.9, 1.0])
        ctx.fillStyle = "#6e7a88";
        ctx.fillRect(0, 0, w, 14);
        // Subtle architectural vertical seams & shadow pilasters
        ctx.fillStyle = "#b0bcc8";
        for (let x = 0; x < w; x += 22) {
          ctx.fillRect(x, 14, 3, h - 14);
        }
        // Subtle horizontal floor joints
        ctx.fillStyle = "#9aa7b6";
        for (let y = 18; y < h; y += 12) {
          ctx.fillRect(0, y, w, 2);
        }
      }),
    [],
  );

  const tvTowerLatticeTex = useMemo(
    () =>
      createNearestCanvasTexture(64, 192, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = "#16222f";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(4, h);
        ctx.lineTo(w * 0.36, 0);
        ctx.moveTo(w - 4, h);
        ctx.lineTo(w * 0.64, 0);
        ctx.stroke();

        ctx.lineWidth = 2;
        for (let y = 0; y < h; y += 22) {
          const t0 = y / h;
          const t1 = Math.min(1, (y + 22) / h);
          const x0L = THREE.MathUtils.lerp(w * 0.36, 4, t0);
          const x0R = THREE.MathUtils.lerp(w * 0.64, w - 4, t0);
          const x1L = THREE.MathUtils.lerp(w * 0.36, 4, t1);
          const x1R = THREE.MathUtils.lerp(w * 0.64, w - 4, t1);
          ctx.beginPath();
          ctx.moveTo(x0L, y);
          ctx.lineTo(x1R, y + 22);
          ctx.moveTo(x0R, y);
          ctx.lineTo(x1L, y + 22);
          ctx.moveTo(x0L, y);
          ctx.lineTo(x0R, y);
          ctx.stroke();
        }
      }),
    [],
  );

  const stackTex = useMemo(
    () =>
      createNearestCanvasTexture(32, 160, (ctx, w, h) => {
        for (let y = 0; y < h; y += 16) {
          ctx.fillStyle = (y / 16) % 2 === 0 ? "#c82b23" : "#dcdad2";
          ctx.fillRect(0, y, w, 16);
        }
      }),
    [],
  );

  const steamTex = useMemo(
    () => createSoftSteamPuffTexture(0.34, 0.14),
    [],
  );

  // Skeletal rooftop TV aerials & vent chimney
  const aerialTex = useMemo(
    () =>
      createNearestCanvasTexture(32, 48, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#121a24";
        ctx.fillRect(15, 6, 2, h - 6);
        ctx.fillRect(6, 10, 20, 2);
        ctx.fillRect(9, 17, 14, 2);
        ctx.fillRect(11, 24, 10, 2);
        ctx.fillStyle = "#1c2734";
        ctx.fillRect(23, h - 14, 4, 14);
      }),
    [],
  );

  // Subtle warm #ff9436 sodium streetlamp glow haze along base streets
  const sodiumStreetHazeTex = useMemo(
    () =>
      createNearestCanvasTexture(256, 64, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        const vert = ctx.createLinearGradient(0, h, 0, 0);
        vert.addColorStop(0.0, "rgba(255, 148, 54, 0.85)");
        vert.addColorStop(0.45, "rgba(255, 134, 42, 0.32)");
        vert.addColorStop(1.0, "rgba(255, 134, 42, 0)");
        ctx.fillStyle = vert;
        ctx.fillRect(0, 0, w, h);
        for (let x = 16; x < w; x += 32) {
          const p = ctx.createRadialGradient(x, h * 0.82, 2, x, h * 0.82, 18);
          p.addColorStop(0, "rgba(255, 205, 110, 0.68)");
          p.addColorStop(1, "rgba(255, 148, 54, 0)");
          ctx.fillStyle = p;
          ctx.fillRect(x - 18, h * 0.4, 36, h * 0.6);
        }
      }),
    [],
  );

  // Steel scaffolding truss supporting the rooftop propaganda neon landmark
  const rooftopTrussTex = useMemo(
    () =>
      createNearestCanvasTexture(512, 96, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = "#161e28";
        ctx.lineWidth = 4;
        ctx.strokeRect(16, 8, w - 32, h - 14);
        const bays = 12;
        const step = (w - 32) / bays;
        for (let i = 0; i <= bays; i++) {
          const x = 16 + i * step;
          ctx.fillStyle = "#121922";
          ctx.fillRect(x - 2, 8, 4, h - 8);
          if (i < bays) {
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 8);
            ctx.lineTo(x + step, h - 6);
            ctx.moveTo(x + step, 8);
            ctx.lineTo(x, h - 6);
            ctx.stroke();
          }
        }
      }),
    [],
  );

  // Open steel-lattice-backed rooftop neon landmark sign (reads as architecture, not a floating HUD box)
  const happyBannerTex = useMemo(
    () =>
      createNearestCanvasTexture(1024, 192, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(12, 16, 22, 0.56)";
        ctx.fillRect(6, 6, w - 12, h - 12);

        // Open structural steel backing lattice bars behind neon tubes
        ctx.strokeStyle = "#1d2733";
        ctx.lineWidth = 3;
        for (let x = 24; x < w; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, 8);
          ctx.lineTo(x, h - 8);
          ctx.stroke();
        }
        for (let y = 24; y < h; y += 36) {
          ctx.beginPath();
          ctx.moveTo(8, y);
          ctx.lineTo(w - 8, y);
          ctx.stroke();
        }

        ctx.strokeStyle = "#ff1e1e";
        ctx.lineWidth = 7;
        ctx.strokeRect(5, 5, w - 10, h - 10);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";

        ctx.font = 'bold 60px "Kremlin", "Consolas", monospace';
        ctx.strokeStyle = "#ff1a1a";
        ctx.lineWidth = 10;
        ctx.strokeText("QUOTA IS LAW! //", w / 2, 62, w - 48);
        ctx.fillStyle = "#ffe678";
        ctx.fillText("QUOTA IS LAW! //", w / 2, 62, w - 48);

        ctx.font = 'bold 68px "Kremlin", "Consolas", monospace';
        ctx.strokeStyle = "#ff1a1a";
        ctx.lineWidth = 11;
        ctx.strokeText("HAPPINESS: 100%", w / 2, 134, w - 48);
        ctx.fillStyle = "#ff4d3a";
        ctx.fillText("HAPPINESS: 100%", w / 2, 134, w - 48);
      }),
    [],
  );

  const cityLayout = useMemo(() => {
    const seeded = (n: number) => {
      const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    const silhouetteShades = [
      new THREE.Color("#0e1724"),
      new THREE.Color("#131f2f"),
      new THREE.Color("#172334"),
      new THREE.Color("#1a2636"),
    ];

    const blocks: Array<{
      x: number;
      y: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
      shade: THREE.Color;
    }> = [];

    const penthouses: Array<{
      x: number;
      y: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
    }> = [];

    const aerials: Array<{
      x: number;
      y: number;
      z: number;
    }> = [];

    const windows: Array<{
      x: number;
      y: number;
      z: number;
      w: number;
      h: number;
      meta: CityWindowMeta;
    }> = [];

    const beacons: Array<{
      x: number;
      y: number;
      z: number;
      size: number;
      freqHz: number;
      phase: number;
    }> = [];

    const pushBeacon = (x: number, y: number, z: number, size: number) => {
      if (beacons.length >= MAX_CITY_BEACONS) return;
      const idx = beacons.length;
      beacons.push({
        x,
        y,
        z,
        size,
        freqHz: 0.6 + ((idx * 7) % 13) * (0.6 / 12),
        phase: (idx * 0.37) % 1,
      });
    };

    type BuildingKind = "highrise" | "midrise" | "khrushchevka";
    interface BuildingSpec {
      x: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
      kind: BuildingKind;
      isOffice: boolean;
      hasBeacon?: boolean;
      skipPenthouse?: boolean;
    }

    const specs: BuildingSpec[] = [];

    // 1. Central High-Rise Core (18–22 story towers, x in [-5.6, +5.6], z in [-33.6, -37.6])
    // Paired anchor towers supporting the proportional rooftop neon landmark
    specs.push(
      { x: -0.8, z: -34.6, sx: 1.15, sy: 3.85, sz: 1.05, kind: "highrise", isOffice: true, skipPenthouse: true },
      { x: 1.9, z: -34.6, sx: 1.15, sy: 3.85, sz: 1.05, kind: "highrise", isOffice: true, skipPenthouse: true },
    );
    const coreHighrises: Array<[number, number, number, number, boolean, boolean]> = [
      [-5.2, -34.4, 0.88, 3.05, true, false],
      [-4.1, -35.8, 0.96, 3.45, false, true],
      [-3.5, -33.8, 0.78, 2.75, false, false],
      [-1.7, -37.1, 1.02, 3.95, true, true],
      [-0.5, -36.5, 0.85, 3.25, false, false],
      [0.55, -35.5, 1.1, 4.1, true, false],
      [1.2, -37.2, 0.92, 3.55, false, true],
      [3.05, -36.2, 0.86, 3.3, true, false],
      [3.2, -33.7, 0.76, 2.85, false, false],
      [5.5, -36.6, 0.98, 3.4, true, true],
      [-2.1, -33.7, 0.72, 2.6, false, false],
      [0.6, -33.6, 0.84, 2.45, true, false],
    ];
    for (const [x, z, sx, sy, isOffice, hasBeacon] of coreHighrises) {
      specs.push({ x, z, sx, sy, sz: 0.92, kind: "highrise", isOffice, hasBeacon });
    }

    // 2. Irregular Mid-Rise Districts (|x| in [5.6, 16.0], z in [-32.2, -38.5])
    const midCount = 38;
    for (let i = 0; i < midCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const bandT = Math.floor(i / 2) / Math.ceil(midCount / 2 - 1);
      const x =
        side * THREE.MathUtils.lerp(6.1, 15.6, bandT) +
        (seeded(i * 11 + 3) - 0.5) * 0.75;
      // Leave slight sightline breathing room around crane footprints
      const z =
        -32.4 - seeded(i * 17 + 9) * 5.8;
      const sx = 0.68 + seeded(i * 23 + 5) * 0.78;
      const sy = 1.35 + seeded(i * 29 + 7) * 1.12;
      const sz = 0.72 + seeded(i * 31 + 11) * 0.45;
      specs.push({
        x,
        z,
        sx,
        sy,
        sz,
        kind: "midrise",
        isOffice: seeded(i * 41 + 1) > 0.68,
        hasBeacon: sy > 2.28 && i < 12,
      });
    }

    // 3. Wide Low-Rise Khrushchevkas (|x| in [14.0, 25.8] + lower front skirts)
    const lowCount = 38;
    for (let i = 0; i < lowCount; i++) {
      let x: number;
      let z: number;
      if (i < 24) {
        const side = i % 2 === 0 ? -1 : 1;
        const u = Math.floor(i / 2) / 11;
        x = side * THREE.MathUtils.lerp(14.6, 25.6, u) + (seeded(i * 13 + 7) - 0.5) * 0.8;
        z = -32.2 - seeded(i * 19 + 3) * 5.6;
        // Clear around east district heating plant at x = 20.8, z = -35.8
        if (Math.abs(x - 20.8) < 2.5 && Math.abs(z - -35.8) < 2.0) {
          x += x < 20.8 ? -2.6 : 2.6;
        }
      } else {
        // Low suburban skirts along the front edge of the city (z ~ -32.0 .. -33.2)
        const u = (i - 24) / 13;
        x = THREE.MathUtils.lerp(-14.5, 14.5, u) + (seeded(i * 7 + 19) - 0.5) * 0.9;
        z = -32.1 - seeded(i * 23 + 2) * 1.15;
      }
      specs.push({
        x,
        z,
        sx: 1.25 + seeded(i * 37 + 5) * 0.8,
        sy: 0.65 + seeded(i * 43 + 11) * 0.48,
        sz: 0.72 + seeded(i * 47 + 3) * 0.32,
        kind: "khrushchevka",
        isOffice: false,
      });
    }

    let bIdx = 0;
    for (const sp of specs) {
      if (blocks.length >= MAX_CITY_BLOCKS) break;
      const groundW = win2GroundY(sp.x, sp.z);
      const centerY = Y(groundW + sp.sy * 0.5);
      const absX = Math.abs(sp.x);
      const district = absX > 16.5 ? 0 : absX > 10.5 ? 1 : absX > 5.0 ? 2 : 3;
      const districtBaseCutoff =
        district === 0 ? 0.82 : district === 1 ? 0.58 : district === 2 ? 0.35 : 0.14;
      const blockThreshold = THREE.MathUtils.clamp(
        districtBaseCutoff + (seeded(bIdx * 19 + 7) - 0.5) * 0.16,
        0.04,
        0.94,
      );

      blocks.push({
        x: sp.x,
        y: centerY,
        z: sp.z,
        sx: sp.sx,
        sy: sp.sy,
        sz: sp.sz,
        shade: silhouetteShades[(bIdx + (sp.kind === "highrise" ? 1 : 0)) % silhouetteShades.length],
      });

      const roofY = centerY + sp.sy * 0.5;
      if (!sp.skipPenthouse && sp.kind !== "khrushchevka" && seeded(bIdx * 23 + 1) > 0.35) {
        const ph = 0.14 + seeded(bIdx * 29 + 3) * 0.16;
        const px = sp.x + (seeded(bIdx * 31 + 5) - 0.5) * sp.sx * 0.35;
        penthouses.push({
          x: px,
          y: roofY + ph * 0.5,
          z: sp.z,
          sx: sp.sx * (0.28 + seeded(bIdx * 13) * 0.2),
          sy: ph,
          sz: sp.sz * 0.46,
        });
      }

      if (!sp.skipPenthouse && seeded(bIdx * 41 + 9) > 0.42) {
        aerials.push({
          x: sp.x + (seeded(bIdx * 43 + 2) - 0.5) * sp.sx * 0.4,
          y: roofY + 0.18,
          z: sp.z + 0.04,
        });
      }

      if (sp.hasBeacon) {
        pushBeacon(sp.x, roofY + 0.14, sp.z, 0.085);
      }

      // Organic Non-Grid Windows: ribbon offices, scattered sleeping residential clusters, and storefront strips
      const frontZ = sp.z + sp.sz * 0.5 + 0.015;
      const floors = Math.max(
        4,
        Math.round(sp.sy * (sp.kind === "khrushchevka" ? 4.8 : 5.4)),
      );

      // Subtle warm street-level storefront / lobby light strip on select blocks
      if (seeded(bIdx * 53 + 3) > 0.45 && windows.length < MAX_APT_WINDOWS) {
        const stripW = sp.sx * (0.38 + seeded(bIdx * 59 + 1) * 0.42);
        const stripOffX = (seeded(bIdx * 61 + 7) - 0.5) * (sp.sx * 0.25);
        windows.push({
          x: sp.x + stripOffX,
          y: centerY - sp.sy * 0.46,
          z: frontZ,
          w: stripW,
          h: 0.028,
          meta: {
            threshold: THREE.MathUtils.clamp(blockThreshold - 0.06, 0.02, 0.94),
            onColor: new THREE.Color(COLOR_GROUND_STOREFRONT[bIdx % 2]),
            canToggle: false,
            isSwitchedOn: true,
          },
        });
      }

      if (sp.isOffice) {
        // Horizontal ribbon office floors with irregular dark breaks
        for (let wy = 1; wy < floors; wy++) {
          const bandSeed = bIdx * 101 + wy * 17;
          if (seeded(bandSeed + 3) > 0.62) continue;
          const fy = centerY - sp.sy * 0.43 + (wy / floors) * (sp.sy * 0.86);
          const segments = seeded(bandSeed + 11) > 0.48 ? 2 : 1;
          for (let seg = 0; seg < segments; seg++) {
            if (windows.length >= MAX_APT_WINDOWS) break;
            if (seeded(bandSeed + seg * 23) > 0.72) continue;
            const segW =
              segments === 1
                ? sp.sx * (0.45 + seeded(bandSeed + 19) * 0.36)
                : sp.sx * (0.22 + seeded(bandSeed + seg * 7) * 0.18);
            const segX =
              segments === 1
                ? sp.x + (seeded(bandSeed + 29) - 0.5) * (sp.sx * 0.16)
                : sp.x + (seg === 0 ? -0.22 : 0.22) * sp.sx;
            windows.push({
              x: segX,
              y: fy,
              z: frontZ,
              w: segW,
              h: 0.02,
              meta: {
                threshold: THREE.MathUtils.clamp(
                  blockThreshold + (seeded(bandSeed + 31) - 0.5) * 0.05,
                  0.03,
                  0.95,
                ),
                onColor: new THREE.Color(COLOR_OFFICE_RIBBON[(bIdx + wy) % 2]),
                canToggle: false,
                isSwitchedOn: true,
              },
            });
          }
        }
      } else {
        // Scattered organic apartment clusters (avoiding uniform vertical grids)
        const cols = Math.max(4, Math.round(sp.sx * 6.5));
        const clusterShift = seeded(bIdx * 71 + 5) * 10.0;
        for (let wy = 1; wy < floors; wy++) {
          const rowActiveProb = 0.25 + 0.55 * seeded(bIdx * 83 + wy * 19);
          const fy =
            centerY -
            sp.sy * 0.43 +
            (wy / floors) * (sp.sy * 0.86) +
            (seeded(bIdx * 17 + wy) - 0.5) * 0.012;
          for (let wx = 0; wx < cols; wx++) {
            if (windows.length >= MAX_APT_WINDOWS) break;
            const wSeed = bIdx * 131 + wy * 29 + wx * 11;
            const clusterMask =
              Math.sin(wx * 1.1 + wy * 0.65 + clusterShift) * 0.5 + 0.5;
            if (seeded(wSeed + 13) > rowActiveProb * (0.35 + clusterMask * 0.85)) {
              continue;
            }
            const rCol = seeded(wSeed + 21);
            const hex =
              rCol < 0.52
                ? COLOR_ROOM_WARM[wSeed % 2]
                : rCol < 0.84
                  ? COLOR_ROOM_AMBER[wSeed % 2]
                  : COLOR_ROOM_CRT[wSeed % 2];
            windows.push({
              x:
                sp.x +
                ((wx + 0.5) / cols - 0.5) * (sp.sx * 0.82) +
                (seeded(wSeed + 41) - 0.5) * 0.022,
              y: fy,
              z: frontZ,
              w: 0.028 + seeded(wSeed + 7) * 0.024,
              h: 0.021,
              meta: {
                threshold: THREE.MathUtils.clamp(
                  blockThreshold + (seeded(wSeed + 51) - 0.5) * 0.05,
                  0.03,
                  0.96,
                ),
                onColor: new THREE.Color(hex),
                canToggle: true,
                isSwitchedOn: seeded(wSeed + 67) > 0.14,
              },
            });
          }
        }
      }

      bIdx++;
    }

    // Landmark beacons on TV Tower (-2.45, -36.3), Municipal Palace (+4.45, -34.9),
    // 2 Construction Cranes (-9.8/-34.3 & +11.6/-35.5), Heating Plant 3 stacks (+20.8/-35.8) & West boiler (-21.8/-36.2)
    const tvGroundY = Y(win2GroundY(-2.45, -36.3));
    pushBeacon(-2.45, tvGroundY + 9.04, -36.28, 0.14);
    pushBeacon(-2.45, tvGroundY + 6.95, -36.18, 0.1);
    pushBeacon(-2.05, tvGroundY + 4.3, -36.05, 0.085);

    const palaceGroundY = Y(win2GroundY(4.45, -34.9));
    pushBeacon(4.45, palaceGroundY + 4.15, -34.88, 0.1);

    const crane1GroundY = Y(win2GroundY(-9.8, -34.3));
    pushBeacon(-9.8, crane1GroundY + 3.65, -34.28, 0.09);
    pushBeacon(-7.7, crane1GroundY + 3.22, -34.28, 0.08);

    const crane2GroundY = Y(win2GroundY(11.6, -35.5));
    pushBeacon(11.6, crane2GroundY + 3.3, -35.48, 0.09);
    pushBeacon(9.65, crane2GroundY + 2.87, -35.48, 0.08);

    const heatGroundY = Y(win2GroundY(20.8, -35.8));
    pushBeacon(19.75, heatGroundY + 4.24, -35.78, 0.11);
    pushBeacon(20.8, heatGroundY + 4.69, -35.78, 0.12);
    pushBeacon(21.85, heatGroundY + 4.39, -35.78, 0.11);

    const westBoilerY = Y(win2GroundY(-21.8, -36.2));
    pushBeacon(-21.8, westBoilerY + 3.54, -36.18, 0.1);

    // Rooftop sign truss peak beacons
    const anchorRoofY = Y(win2GroundY(0.55, -34.6) + 3.85);
    pushBeacon(-2.25, anchorRoofY + 1.65, -34.48, 0.095);
    pushBeacon(3.35, anchorRoofY + 1.65, -34.48, 0.095);

    // 132 snow-dusted pines clustered across valley slopes (clearing highway & corner forest ridge)
    const pineTransforms: Array<{ px: number; py: number; pz: number; scale: number }> = [];
    for (let idx = 0; idx < 132; idx++) {
      const u = seeded(idx * 11 + 5);
      const pz = THREE.MathUtils.lerp(-3.0, -25.5, u);
      let px = THREE.MathUtils.lerp(-9.5, 46.0, (idx / 131) + (seeded(idx * 3 + 7) - 0.5) * 0.04);
      const roadX = highwayCenterX(pz);
      if (Math.abs(px - roadX) < 1.65) {
        px += px < roadX ? -1.85 : 1.85;
      }
      const scale = THREE.MathUtils.lerp(1.45, 0.45, u) * (0.85 + seeded(idx * 9 + 1) * 0.35);
      const py = Y(win2GroundY(px, pz) + scale * 0.78);
      pineTransforms.push({ px, py, pz, scale });
    }

    // 22 Roadside Streetlamps along the winding highway from foreground (-3.5m) to city (-31.2m)
    const roadLampPoints = Array.from({ length: 22 }, (_, idx) => {
      const u = idx / 21;
      const lz = THREE.MathUtils.lerp(-3.5, -31.2, u);
      const side = idx % 2 === 0 ? 1 : -1;
      const roadX = highwayCenterX(lz);
      const lx = roadX + side * (highwayHalfWidth(lz) + 0.15);
      const scale = THREE.MathUtils.lerp(1.0, 0.42, u);
      const slope = Math.atan2(
        win2GroundY(roadX, lz - 0.4) - win2GroundY(roadX, lz + 0.4),
        0.8,
      );
      return { lx, lz, poolX: roadX, scale, slope };
    });

    // 12 Power-line corridor poles running parallel to highway
    const powerPoles = Array.from({ length: 12 }, (_, idx) => {
      const u = idx / 11;
      const pz = THREE.MathUtils.lerp(-3.5, -30.5, u);
      const px = highwayCenterX(pz) + 1.38;
      const h = THREE.MathUtils.lerp(2.15, 1.0, u);
      const baseY = Y(win2GroundY(px, pz));
      return {
        x: px,
        z: pz,
        h,
        baseY,
        topY: baseY + h * 0.88,
        tilt: (seeded(idx * 19 + 4) - 0.5) * 0.08,
      };
    });

    // 28 Distant City Avenue Streetlights
    const farLamps = Array.from({ length: 28 }, (_, idx) => {
      const u = idx / 27;
      const lx = THREE.MathUtils.lerp(-23.5, 22.5, u);
      const lz = idx % 2 === 0 ? -32.2 : -34.2;
      return { lx, ly: Y(win2GroundY(lx, lz) + 0.16), lz };
    });

    // 16 Animated highway vehicles (8 white headlights toward plant, 8 red taillights toward city)
    const vehicles = Array.from({ length: VEHICLE_COUNT }, (_, idx) => {
      const dir = idx < 8 ? 1 : -1;
      return {
        dir,
        phase: (idx % 8) / 8 + seeded(idx * 23 + 3) * 0.08,
        speed: 1.55 + (idx % 3) * 0.22,
        color: dir > 0 ? COLOR_HEADLIGHT : COLOR_TAILLIGHT,
      };
    });

    return {
      blocks,
      penthouses,
      aerials,
      windows,
      beacons,
      pineTransforms,
      roadLampPoints,
      powerPoles,
      farLamps,
      vehicles,
      anchorRoofY,
      tvGroundY,
      palaceGroundY,
      crane1GroundY,
      crane2GroundY,
      heatGroundY,
      westBoilerY,
    };
  }, []);

  const powerWiresGeo = useMemo(
    () => createPowerCorridorWiresGeometry(cityLayout.powerPoles, [-0.24, 0.24]),
    [cityLayout.powerPoles],
  );

  useEffect(() => {
    return () => {
      fourFaceGeo.dispose();
      highwayRibbonGeo.dispose();
      powerWiresGeo.dispose();
    };
  }, [fourFaceGeo, highwayRibbonGeo, powerWiresGeo]);

  useEffect(() => {
    const dummy = new THREE.Object3D();

    if (pinesRef.current) {
      pinesRef.current.count = cityLayout.pineTransforms.length;
      cityLayout.pineTransforms.forEach((p, idx) => {
        dummy.position.set(p.px, p.py, p.pz);
        dummy.rotation.set(-0.18, 0, 0);
        dummy.scale.set(p.scale, p.scale, 1);
        dummy.updateMatrix();
        pinesRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      pinesRef.current.instanceMatrix.needsUpdate = true;
    }

    if (roadLampPostsRef.current) {
      roadLampPostsRef.current.count = cityLayout.roadLampPoints.length;
      cityLayout.roadLampPoints.forEach((pt, idx) => {
        const base = Y(win2GroundY(pt.lx, pt.lz));
        dummy.position.set(pt.lx, base + 0.48 * pt.scale, pt.lz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(pt.scale, pt.scale, 1);
        dummy.updateMatrix();
        roadLampPostsRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      roadLampPostsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (roadLampHeadsRef.current) {
      roadLampHeadsRef.current.count = cityLayout.roadLampPoints.length;
      cityLayout.roadLampPoints.forEach((pt, idx) => {
        roadLampLitRef.current[idx] = 1;
        const base = Y(win2GroundY(pt.lx, pt.lz));
        dummy.position.set(pt.lx, base + 0.96 * pt.scale, pt.lz + 0.03);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(pt.scale, pt.scale, 1);
        dummy.updateMatrix();
        roadLampHeadsRef.current!.setMatrixAt(idx, dummy.matrix);
        roadLampHeadsRef.current!.setColorAt(idx, COLOR_ROAD_LAMP_ON);
      });
      roadLampHeadsRef.current.instanceMatrix.needsUpdate = true;
      if (roadLampHeadsRef.current.instanceColor) {
        roadLampHeadsRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (roadLampPoolsRef.current) {
      roadLampPoolsRef.current.count = cityLayout.roadLampPoints.length;
      cityLayout.roadLampPoints.forEach((pt, idx) => {
        const py = Y(win2GroundY(pt.poolX, pt.lz) + 0.08);
        dummy.position.set(pt.poolX, py, pt.lz);
        dummy.rotation.set(-Math.PI / 2 + pt.slope, 0, 0);
        dummy.scale.set(pt.scale, pt.scale, 1);
        dummy.updateMatrix();
        roadLampPoolsRef.current!.setMatrixAt(idx, dummy.matrix);
        roadLampPoolsRef.current!.setColorAt(idx, COLOR_ROAD_LAMP_ON);
      });
      roadLampPoolsRef.current.instanceMatrix.needsUpdate = true;
      if (roadLampPoolsRef.current.instanceColor) {
        roadLampPoolsRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (vehiclesRef.current && vehicleHalosRef.current) {
      vehiclesRef.current.count = cityLayout.vehicles.length;
      vehicleHalosRef.current.count = cityLayout.vehicles.length;
      cityLayout.vehicles.forEach((v, idx) => {
        vehiclesRef.current!.setColorAt(idx, v.color);
        vehicleHalosRef.current!.setColorAt(idx, v.color);
      });
      if (vehiclesRef.current.instanceColor) {
        vehiclesRef.current.instanceColor.needsUpdate = true;
      }
      if (vehicleHalosRef.current.instanceColor) {
        vehicleHalosRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (panelkasRef.current) {
      panelkasRef.current.count = cityLayout.blocks.length;
      cityLayout.blocks.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.sx, b.sy, b.sz);
        dummy.updateMatrix();
        panelkasRef.current!.setMatrixAt(idx, dummy.matrix);
        panelkasRef.current!.setColorAt(idx, b.shade);
      });
      panelkasRef.current.instanceMatrix.needsUpdate = true;
      if (panelkasRef.current.instanceColor) {
        panelkasRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (penthousesRef.current) {
      penthousesRef.current.count = cityLayout.penthouses.length;
      cityLayout.penthouses.forEach((p, idx) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.sx, p.sy, p.sz);
        dummy.updateMatrix();
        penthousesRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      penthousesRef.current.instanceMatrix.needsUpdate = true;
    }

    if (rooftopAerialsRef.current) {
      rooftopAerialsRef.current.count = cityLayout.aerials.length;
      cityLayout.aerials.forEach((a, idx) => {
        dummy.position.set(a.x, a.y, a.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        rooftopAerialsRef.current!.setMatrixAt(idx, dummy.matrix);
      });
      rooftopAerialsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (aptWindowsRef.current) {
      aptWindowsRef.current.count = cityLayout.windows.length;
      cityLayout.windows.forEach((w, idx) => {
        windowToggleStatesRef.current[idx] = w.meta.isSwitchedOn ? 1 : 0;
        cityWinLitRef.current[idx] = 1;
        dummy.position.set(w.x, w.y, w.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(w.w, w.h, 1);
        dummy.updateMatrix();
        aptWindowsRef.current!.setMatrixAt(idx, dummy.matrix);
        aptWindowsRef.current!.setColorAt(idx, w.meta.onColor);
      });
      aptWindowsRef.current.instanceMatrix.needsUpdate = true;
      if (aptWindowsRef.current.instanceColor) {
        aptWindowsRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (streetlampsRef.current) {
      streetlampsRef.current.count = cityLayout.farLamps.length;
      cityLayout.farLamps.forEach((l, idx) => {
        streetlampLitRef.current[idx] = 1;
        dummy.position.set(l.lx, l.ly, l.lz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        streetlampsRef.current!.setMatrixAt(idx, dummy.matrix);
        streetlampsRef.current!.setColorAt(idx, COLOR_LAMP_ON);
      });
      streetlampsRef.current.instanceMatrix.needsUpdate = true;
      if (streetlampsRef.current.instanceColor) {
        streetlampsRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (cityBeaconsRef.current && cityBeaconHalosRef.current) {
      cityBeaconsRef.current.count = cityLayout.beacons.length;
      cityBeaconHalosRef.current.count = cityLayout.beacons.length;
      cityLayout.beacons.forEach((b, idx) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.size, b.size, 1);
        dummy.updateMatrix();
        cityBeaconsRef.current!.setMatrixAt(idx, dummy.matrix);
        cityBeaconsRef.current!.setColorAt(idx, COLOR_BEACON_ON);

        dummy.position.set(b.x, b.y, b.z + 0.02);
        dummy.scale.set(b.size * 3.8, b.size * 3.8, 1);
        dummy.updateMatrix();
        cityBeaconHalosRef.current!.setMatrixAt(idx, dummy.matrix);
        cityBeaconHalosRef.current!.setColorAt(idx, COLOR_BEACON_ON);
      });
      cityBeaconsRef.current.instanceMatrix.needsUpdate = true;
      cityBeaconHalosRef.current.instanceMatrix.needsUpdate = true;
      if (cityBeaconsRef.current.instanceColor) {
        cityBeaconsRef.current.instanceColor.needsUpdate = true;
      }
      if (cityBeaconHalosRef.current.instanceColor) {
        cityBeaconHalosRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [cityLayout]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const dt = Math.min(delta, 0.1);
    const { citySatisfaction } = computeDioramaGridState();

    // 1. Animated Night Train Along Arched Viaduct (emerging from corner hillside tunnel at lx = -10.8)
    const targetSpeed =
      citySatisfaction <= 0.12
        ? 0
        : citySatisfaction < 0.3
          ? THREE.MathUtils.lerp(0, 0.25, (citySatisfaction - 0.12) / 0.18)
          : THREE.MathUtils.lerp(0.65, 1.35, (citySatisfaction - 0.3) / 0.7);
    trainSpeedRef.current = THREE.MathUtils.damp(
      trainSpeedRef.current,
      targetSpeed,
      2.4,
      dt,
    );
    trainPosXRef.current += trainSpeedRef.current * dt;
    if (trainPosXRef.current > 42.0) {
      trainPosXRef.current = -15.8;
    }
    if (trainGroupRef.current) {
      trainGroupRef.current.position.x = trainPosXRef.current;
    }
    for (let i = 0; i < TRAIN_CAR_OFFSETS.length; i++) {
      const cg = trainCarGroupRefs.current[i];
      if (cg) {
        cg.visible = trainPosXRef.current + TRAIN_CAR_OFFSETS[i] >= -11.2;
      }
    }
    if (trainHeadlightMeshRef.current) {
      trainHeadlightMeshRef.current.visible = trainPosXRef.current + 3.55 >= -11.15;
    }

    const trainLightStrength =
      citySatisfaction <= 0.04
        ? 0
        : citySatisfaction < 0.3
          ? THREE.MathUtils.lerp(0.28, 1.0, (citySatisfaction - 0.04) / 0.26)
          : 1.0;

    for (let i = 0; i < 6; i++) {
      const mat = trainWindowMatsRef.current[i];
      if (mat) {
        mat.color.lerpColors(
          COLOR_TRAIN_WIN_OFF,
          COLOR_TRAIN_WIN_ON,
          trainLightStrength,
        );
      }
    }
    if (trainHeadlightMatRef.current) {
      trainHeadlightMatRef.current.opacity = 0.78 * trainLightStrength;
      trainHeadlightMatRef.current.color.lerpColors(
        COLOR_TRAIN_WIN_OFF,
        COLOR_TRAIN_BEAM_ON,
        trainLightStrength,
      );
    }

    // 2. 16 Animated Highway Vehicles (White Headlights Toward Plant / Red Taillights Toward City)
    if (vehiclesRef.current && vehicleHalosRef.current) {
      for (let i = 0; i < cityLayout.vehicles.length; i++) {
        const v = cityLayout.vehicles[i];
        const progress = (t * (v.speed / 29.6) + v.phase) % 1;
        const vz =
          v.dir > 0
            ? THREE.MathUtils.lerp(-32.2, -2.6, progress)
            : THREE.MathUtils.lerp(-2.6, -32.2, progress);
        const uDepth = THREE.MathUtils.clamp((-vz - 2.6) / 29.6, 0, 1);
        const laneOff = v.dir * highwayHalfWidth(vz) * 0.44;
        const vx = highwayCenterX(vz) + laneOff;
        const vy = Y(win2GroundY(vx, vz) + 0.16);
        const dotScale = THREE.MathUtils.lerp(0.13, 0.055, uDepth);
        const haloScale = THREE.MathUtils.lerp(0.46, 0.18, uDepth);

        SCRATCH_OBJ.position.set(vx, vy, vz);
        SCRATCH_OBJ.rotation.set(0, 0, 0);
        SCRATCH_OBJ.scale.set(dotScale, dotScale, 1);
        SCRATCH_OBJ.updateMatrix();
        vehiclesRef.current.setMatrixAt(i, SCRATCH_OBJ.matrix);

        SCRATCH_OBJ.position.set(vx, vy, vz + 0.03);
        SCRATCH_OBJ.scale.set(haloScale, haloScale, 1);
        SCRATCH_OBJ.updateMatrix();
        vehicleHalosRef.current.setMatrixAt(i, SCRATCH_OBJ.matrix);
      }
      vehiclesRef.current.instanceMatrix.needsUpdate = true;
      vehicleHalosRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. Asynchronously Blinking #ff1e1e Aviation Beacons (0.6–1.2 Hz, Throttled to 8 Hz + Dirty-Checked)
    cityBeaconTimerRef.current += dt;
    if (
      cityBeaconTimerRef.current >= 0.125 &&
      cityBeaconsRef.current &&
      cityBeaconsRef.current.instanceColor &&
      cityBeaconHalosRef.current &&
      cityBeaconHalosRef.current.instanceColor
    ) {
      cityBeaconTimerRef.current = 0;
      let mask = 0;
      for (let i = 0; i < cityLayout.beacons.length; i++) {
        const b = cityLayout.beacons[i];
        const pulsePhase = (t * b.freqHz + b.phase) % 1;
        const isOn = pulsePhase < 0.42;
        if (isOn) mask |= 1 << i;
        cityBeaconsRef.current.setColorAt(
          i,
          isOn ? COLOR_BEACON_ON : COLOR_BEACON_OFF,
        );
        cityBeaconHalosRef.current.setColorAt(
          i,
          isOn ? COLOR_BEACON_ON : COLOR_ROAD_POOL_OFF,
        );
      }
      mask = mask >>> 0;
      if (mask !== cityBeaconMaskRef.current) {
        cityBeaconMaskRef.current = mask;
        cityBeaconsRef.current.instanceColor.needsUpdate = true;
        cityBeaconHalosRef.current.instanceColor.needsUpdate = true;
      }
    }

    // 4. Slow Drifting Smoke Puffs From the 3 Striped Heating-Plant Chimneys
    for (let i = 0; i < 12; i++) {
      const m = citySmokeRefs.current[i];
      if (!m) continue;
      const sIdx = Math.floor(i / 4);
      const puffIdx = i % 4;
      const phase = (t * 0.065 + puffIdx * 0.25 + sIdx * 0.11) % 1;
      m.position.x = 20.8 + CITY_STACK_OFFSETS_X[sIdx] + phase * 1.45;
      m.position.y =
        cityLayout.heatGroundY + CITY_STACK_HEIGHTS[sIdx] + 0.18 + phase * 2.1;
      m.position.z = -35.8 + i * 0.02;
      const scale = 0.28 + phase * 0.92;
      m.scale.set(scale, scale * 0.72, 1);

      const sm = citySmokeMatsRef.current[i];
      if (sm) {
        sm.opacity = Math.max(0.02, (1 - Math.abs(phase - 0.35) * 1.35) * 0.42);
      }
    }

    // 5. Very Rare Ambient Apartment Window Toggle (~12.0s when grid power is steady)
    randomToggleTimerRef.current += dt;
    if (randomToggleTimerRef.current >= 12.0) {
      randomToggleTimerRef.current = 0;
      if (citySatisfaction > 0.25 && cityLayout.windows.length > 0) {
        let guard = 0;
        while (guard < 40) {
          toggleCursorRef.current =
            (toggleCursorRef.current + 37) % cityLayout.windows.length;
          const winIdx = toggleCursorRef.current;
          if (cityLayout.windows[winIdx].meta.canToggle) {
            windowToggleStatesRef.current[winIdx] =
              windowToggleStatesRef.current[winIdx] === 1 ? 0 : 1;
            pendingRoomFlipRef.current = true;
            break;
          }
          guard++;
        }
      }
    }

    // 6. Live Grid-MW Blackout & Light-Pollution Modulation (>= 0.03 Deadband + Hysteresis)
    const powerChanged =
      lastCityPowerRatioRef.current < 0 ||
      Math.abs(citySatisfaction - lastCityPowerRatioRef.current) >= 0.03 ||
      (citySatisfaction === 0 && lastCityPowerRatioRef.current !== 0) ||
      (citySatisfaction === 1 && lastCityPowerRatioRef.current !== 1);
    const hadRoomFlip = pendingRoomFlipRef.current;
    if (powerChanged || hadRoomFlip) {
      if (powerChanged) {
        lastCityPowerRatioRef.current = citySatisfaction;
      }
      pendingRoomFlipRef.current = false;

      const voltageScale =
        citySatisfaction < 0.55
          ? THREE.MathUtils.lerp(0.62, 1.0, citySatisfaction / 0.55)
          : 1.0;

      if (powerChanged) {
        if (lightPollutionMatRef.current) {
          lightPollutionMatRef.current.opacity =
            citySatisfaction <= 0.04
              ? 0.025
              : THREE.MathUtils.lerp(0.04, 0.18, citySatisfaction);
        }

        for (let i = 0; i < 2; i++) {
          const podMat = tvPodMatsRef.current[i];
          if (podMat) {
            podMat.color.lerpColors(
              COLOR_WIN_OFF,
              COLOR_LAMP_ON,
              citySatisfaction <= 0.05 ? 0 : voltageScale,
            );
          }
        }
        if (palaceClockMatRef.current) {
          palaceClockMatRef.current.color.lerpColors(
            COLOR_WIN_OFF,
            COLOR_TRAIN_WIN_ON,
            citySatisfaction <= 0.05 ? 0 : voltageScale,
          );
        }
        if (heatPlantGlowMatRef.current) {
          heatPlantGlowMatRef.current.color.lerpColors(
            COLOR_WIN_OFF,
            COLOR_ROAD_LAMP_ON,
            citySatisfaction <= 0.05 ? 0 : voltageScale,
          );
        }

        for (let i = 0; i < 3; i++) {
          const hazeMat = streetHazeMatsRef.current[i];
          if (hazeMat) {
            hazeMat.opacity =
              citySatisfaction <= 0.04
                ? 0
                : 0.28 * THREE.MathUtils.clamp(citySatisfaction * 1.1, 0.08, 1);
          }
        }
      }

      if (aptWindowsRef.current && aptWindowsRef.current.instanceColor) {
        for (let i = 0; i < cityLayout.windows.length; i++) {
          const meta = cityLayout.windows[i].meta;
          const isWindowOn =
            !meta.canToggle || windowToggleStatesRef.current[i] === 1;
          let gridLit = cityWinLitRef.current[i] === 1;
          if (citySatisfaction <= Math.max(0.01, meta.threshold - 0.02)) {
            gridLit = false;
          } else if (citySatisfaction >= Math.min(0.99, meta.threshold + 0.02)) {
            gridLit = true;
          }
          cityWinLitRef.current[i] = gridLit ? 1 : 0;

          if (!gridLit || !isWindowOn) {
            aptWindowsRef.current.setColorAt(i, COLOR_WIN_OFF);
          } else {
            SCRATCH_COLOR.copy(meta.onColor).multiplyScalar(voltageScale);
            aptWindowsRef.current.setColorAt(i, SCRATCH_COLOR);
          }
        }
        aptWindowsRef.current.instanceColor.needsUpdate = true;
      }

      if (
        powerChanged &&
        streetlampsRef.current &&
        streetlampsRef.current.instanceColor
      ) {
        for (let i = 0; i < cityLayout.farLamps.length; i++) {
          const cutoff = 0.14 + ((i * 5) % 18) * 0.04;
          let lit = streetlampLitRef.current[i] === 1;
          if (citySatisfaction <= Math.max(0.01, cutoff - 0.02)) {
            lit = false;
          } else if (citySatisfaction >= Math.min(0.99, cutoff + 0.02)) {
            lit = true;
          }
          streetlampLitRef.current[i] = lit ? 1 : 0;
          streetlampsRef.current.setColorAt(
            i,
            lit ? COLOR_LAMP_ON : COLOR_LAMP_OFF,
          );
        }
        streetlampsRef.current.instanceColor.needsUpdate = true;
      }

      if (
        powerChanged &&
        roadLampHeadsRef.current &&
        roadLampHeadsRef.current.instanceColor &&
        roadLampPoolsRef.current &&
        roadLampPoolsRef.current.instanceColor
      ) {
        for (let i = 0; i < cityLayout.roadLampPoints.length; i++) {
          const cutoff = 0.1 + ((i * 3) % 10) * 0.065;
          let lit = roadLampLitRef.current[i] === 1;
          if (citySatisfaction <= Math.max(0.01, cutoff - 0.02)) {
            lit = false;
          } else if (citySatisfaction >= Math.min(0.99, cutoff + 0.02)) {
            lit = true;
          }
          roadLampLitRef.current[i] = lit ? 1 : 0;
          roadLampHeadsRef.current.setColorAt(
            i,
            lit ? COLOR_ROAD_LAMP_ON : COLOR_LAMP_OFF,
          );
          roadLampPoolsRef.current.setColorAt(
            i,
            lit ? COLOR_ROAD_LAMP_ON : COLOR_ROAD_POOL_OFF,
          );
        }
        roadLampHeadsRef.current.instanceColor.needsUpdate = true;
        roadLampPoolsRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  const streetGlowZs = [-32.2, -34.2, -36.2];

  return (
    <group position={[3.5, 1.95, 4.5]} rotation={[0, Math.PI, 0]}>
      <IndustrialGalleryWindowFrame3D
        width={3.6}
        height={1.8}
        plaqueTitle="WORKER APPRECIATION VIEWPORT — BLINDS CONFISCATED"
        plaqueSub="BY MINISTRY DECREE #84 // CITIZEN HAPPINESS SURVEILLANCE"
      />

      <group ref={stageGroupRef}>
        <MinimalSteelDripLip3D />

        {/* 1:1 Meter 42m Deep Exterior Landscape & City Props */}
        <group position={[0, -0.3, 0]}>

          {/* VALLEY CORRIDOR: Winding Lit Highway, Power Corridor, Vehicles & Pines */}
          <group>
            <mesh
              geometry={highwayRibbonGeo}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <meshBasicMaterial
                map={highwayRibbonTex}
                polygonOffset
                polygonOffsetFactor={-2}
                fog={false}
              />
            </mesh>

            <instancedMesh
              ref={roadLampPostsRef}
              args={[undefined, undefined, 22]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.055, 0.96]} />
              <meshBasicMaterial color="#161d24" fog={false} />
            </instancedMesh>
            <instancedMesh
              ref={roadLampHeadsRef}
              args={[undefined, undefined, 22]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.13, 0.09]} />
              <meshBasicMaterial
                color="#ffffff"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>
            <instancedMesh
              ref={roadLampPoolsRef}
              args={[undefined, undefined, 22]}
              renderOrder={2}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[2.2, 1.55]} />
              <meshBasicMaterial
                map={amberPoolTex}
                color="#ffffff"
                transparent
                opacity={0.48}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                fog={false}
              />
            </instancedMesh>

            <instancedMesh
              ref={vehiclesRef}
              args={[undefined, undefined, VEHICLE_COUNT]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} fog={false} />
            </instancedMesh>
            <instancedMesh
              ref={vehicleHalosRef}
              args={[undefined, undefined, VEHICLE_COUNT]}
              renderOrder={2}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={amberPoolTex}
                color="#ffffff"
                transparent
                opacity={0.65}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                fog={false}
              />
            </instancedMesh>

            <instancedMesh
              ref={pinesRef}
              args={[undefined, undefined, 132]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1.15, 1.85]} />
              <meshBasicMaterial
                map={pineTex}
                alphaTest={0.5}
                fog={false}
              />
            </instancedMesh>

            {cityLayout.powerPoles.map((pole, idx) => (
              <group
                key={`corridor-pole-${idx}`}
                position={[pole.x, pole.baseY + pole.h * 0.5, pole.z]}
                rotation={[0, 0, pole.tilt]}
              >
                <mesh raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <planeGeometry args={[0.08, pole.h]} />
                  <meshBasicMaterial color="#181410" fog={false} />
                </mesh>
                <mesh position={[0, pole.h * 0.38, 0.01]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                  <planeGeometry args={[0.56, 0.055]} />
                  <meshBasicMaterial color="#211b15" fog={false} />
                </mesh>
              </group>
            ))}

            <mesh geometry={powerWiresGeo} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <meshBasicMaterial
                color="#19232d"
                side={THREE.DoubleSide}
                fog={false}
              />
            </mesh>
          </group>

          {/* MID-VALLEY RAILWAY VIADUCT (18.5m out): Arched Viaduct Tucked Into Corner Forest Tunnel */}
          <group>
            <mesh position={[19.1, Y(-1.8), -18.5]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[61.8, 0.22, 0.58]} />
              <meshBasicMaterial color="#253340" fog={false} />
            </mesh>
            <mesh position={[19.1, Y(-1.67), -18.5]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <boxGeometry args={[61.8, 0.04, 0.28]} />
              <meshBasicMaterial color="#111820" fog={false} />
            </mesh>
            <mesh position={[19.1, Y(-3.14), -18.42]} raycast={NOOP_RAYCAST} frustumCulled={false}>
              <planeGeometry args={[61.8, 2.55]} />
              <meshBasicMaterial
                map={viaductArchesTex}
                alphaTest={0.5}
                fog={false}
              />
            </mesh>
            {/* Concrete Railway Tunnel Portal Embedded Into +X / +Z Forested Hillside Bluff */}
            <group position={[-11.35, Y(-1.38), -18.5]}>
              <mesh position={[-0.55, 0.1, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[1.65, 1.35, 1.35]} />
                <meshBasicMaterial color="#192531" fog={false} />
              </mesh>
              <mesh position={[0.3, -0.02, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.04, 0.86, 0.82]} />
                <meshBasicMaterial color="#05080d" fog={false} />
              </mesh>
              <mesh position={[0.25, -0.18, 0.56]} rotation={[0, -0.38, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.9, 1.15, 0.2]} />
                <meshBasicMaterial color="#141e28" fog={false} />
              </mesh>
            </group>

            <group ref={trainGroupRef} position={[-6.0, Y(-1.52), -18.5]}>
              {[-3.0, -1.8, -0.6, 0.6, 1.8, 3.0].map((cx, idx) => (
                <group
                  key={`train-car-${idx}`}
                  ref={(el) => {
                    trainCarGroupRefs.current[idx] = el;
                  }}
                  position={[cx, 0, 0]}
                >
                  <mesh
                    geometry={fourFaceGeo}
                    scale={[1.04, 0.24, 0.24]}
                    raycast={NOOP_RAYCAST}
                    frustumCulled={false}
                  >
                    <meshBasicMaterial color="#121922" fog={false} />
                  </mesh>
                  <mesh position={[0, 0.02, 0.13]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                    <planeGeometry args={[0.82, 0.085]} />
                    <meshBasicMaterial
                      ref={(mat) => {
                        trainWindowMatsRef.current[idx] = mat;
                      }}
                      color="#ffd066"
                      toneMapped={false}
                      fog={false}
                    />
                  </mesh>
                  {idx === 5 && (
                    <mesh position={[0.53, 0.02, 0.02]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                      <planeGeometry args={[0.07, 0.07]} />
                      <meshBasicMaterial color="#ff2a2a" toneMapped={false} fog={false} />
                    </mesh>
                  )}
                </group>
              ))}
              <mesh
                ref={trainHeadlightMeshRef}
                position={[4.45, -0.02, 0.08]}
                renderOrder={2}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[1.95, 0.42]} />
                <meshBasicMaterial
                  ref={trainHeadlightMatRef}
                  map={headlightConeTex}
                  color="#ffe598"
                  transparent
                  opacity={0.78}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
            </group>
          </group>

          {/* DISTANT METROPOLIS HORIZON (32m–39m out, -26m to +26m wide) */}
          <group>
            {/* Feathered Warm Sodium-Amber Light-Pollution Curved Horizon Arc Behind City */}
            <mesh
              position={[3.5, Y(2.4), 4.5]}
              rotation={[0, Math.PI, 0]}
              renderOrder={1}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <cylinderGeometry args={[50.0, 50.0, 18.0, 32, 1, true, -0.66, 1.46]} />
              <meshBasicMaterial
                ref={lightPollutionMatRef}
                map={cityLightPollutionTex}
                transparent
                opacity={0.18}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.BackSide}
                fog={false}
              />
            </mesh>

            {/* Varied Dark-Silhouette Skyline Blocks (High-Rises, Mid-Rise & Khrushchevkas) */}
            <instancedMesh
              ref={panelkasRef}
              args={[fourFaceGeo, undefined, MAX_CITY_BLOCKS]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <meshBasicMaterial map={darkCityFacadeTex} color="#ffffff" fog={false} />
            </instancedMesh>

            <instancedMesh
              ref={penthousesRef}
              args={[fourFaceGeo, undefined, MAX_CITY_BLOCKS]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <meshBasicMaterial color="#101824" fog={false} />
            </instancedMesh>

            <instancedMesh
              ref={rooftopAerialsRef}
              args={[undefined, undefined, MAX_CITY_BLOCKS]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.32, 0.46]} />
              <meshBasicMaterial
                map={aerialTex}
                alphaTest={0.5}
                fog={false}
              />
            </instancedMesh>

            {/* Organic Non-Grid Windows (Ribbon Offices, Residential Clusters, Storefront Strips) */}
            <instancedMesh
              ref={aptWindowsRef}
              args={[undefined, undefined, MAX_APT_WINDOWS]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                color="#ffffff"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>

            <instancedMesh
              ref={streetlampsRef}
              args={[undefined, undefined, 28]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[0.065, 0.065]} />
              <meshBasicMaterial
                color="#ffffff"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>

            {/* Warm #ff9436 Sodium Streetlamp Glow Haze Along City Avenues */}
            {streetGlowZs.map((gz, idx) => (
              <mesh
                key={`city-sodium-haze-${idx}`}
                position={[0.0, Y(win2GroundY(0.0, gz) + 0.3), gz]}
                renderOrder={2}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[52.0, 0.68]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    streetHazeMatsRef.current[idx] = mat;
                  }}
                  map={sodiumStreetHazeTex}
                  color="#ffffff"
                  transparent
                  opacity={0.28}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
            ))}

            {/* Monumental Lattice Soviet TV / Radio Broadcast Tower (~9.0m Spire) */}
            <group position={[-2.45, cityLayout.tvGroundY, -36.3]}>
              <mesh
                position={[0, 1.8, 0]}
                rotation={[0, 0.35, 0]}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[1.35, 3.6]} />
                <meshBasicMaterial
                  map={tvTowerLatticeTex}
                  alphaTest={0.5}
                  side={THREE.DoubleSide}
                  fog={false}
                />
              </mesh>
              <mesh
                position={[0, 1.8, 0]}
                rotation={[0, -Math.PI / 2 + 0.35, 0]}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[1.35, 3.6]} />
                <meshBasicMaterial
                  map={tvTowerLatticeTex}
                  alphaTest={0.5}
                  side={THREE.DoubleSide}
                  fog={false}
                />
              </mesh>
              <mesh position={[0, 5.4, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <cylinderGeometry args={[0.1, 0.22, 3.6, 8]} />
                <meshBasicMaterial color="#131e2b" fog={false} />
              </mesh>
              <mesh position={[0, 4.05, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <cylinderGeometry args={[0.42, 0.34, 0.42, 8]} />
                <meshBasicMaterial color="#101a26" fog={false} />
              </mesh>
              <mesh position={[0, 4.05, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <cylinderGeometry args={[0.435, 0.435, 0.09, 8]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    tvPodMatsRef.current[0] = mat;
                  }}
                  color="#ffba52"
                  toneMapped={false}
                  fog={false}
                />
              </mesh>
              <mesh position={[0, 5.6, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <cylinderGeometry args={[0.28, 0.24, 0.26, 8]} />
                <meshBasicMaterial color="#121c28" fog={false} />
              </mesh>
              <mesh position={[0, 5.6, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <cylinderGeometry args={[0.295, 0.295, 0.06, 8]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    tvPodMatsRef.current[1] = mat;
                  }}
                  color="#ffba52"
                  toneMapped={false}
                  fog={false}
                />
              </mesh>
              <mesh position={[0, 8.1, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <cylinderGeometry args={[0.025, 0.085, 1.8, 6]} />
                <meshBasicMaterial map={stackTex} fog={false} />
              </mesh>
            </group>

            {/* Municipal Palace Spire */}
            <group position={[4.45, cityLayout.palaceGroundY, -34.9]}>
              <mesh position={[0, 0.425, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[2.0, 0.85, 1.1]} />
                <meshBasicMaterial color="#111b28" fog={false} />
              </mesh>
              <mesh position={[0, 1.55, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.92, 1.4, 0.85]} />
                <meshBasicMaterial color="#152130" fog={false} />
              </mesh>
              <mesh position={[0, 2.46, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.52, 0.42, 0.52]} />
                <meshBasicMaterial color="#182636" fog={false} />
              </mesh>
              <mesh position={[0, 2.46, 0.27]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[0.18, 0.18]} />
                <meshBasicMaterial
                  ref={palaceClockMatRef}
                  color="#ffd066"
                  toneMapped={false}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                  fog={false}
                />
              </mesh>
              <mesh position={[0, 3.4, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <coneGeometry args={[0.14, 1.48, 6]} />
                <meshBasicMaterial color="#1b2938" fog={false} />
              </mesh>
            </group>

            {/* 2 Skeletal Tower Construction Cranes */}
            <group position={[-9.8, cityLayout.crane1GroundY, -34.3]}>
              <mesh position={[0, 1.6, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.14, 3.2, 0.14]} />
                <meshBasicMaterial color="#182330" fog={false} />
              </mesh>
              <mesh position={[0.7, 3.16, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[2.8, 0.11, 0.11]} />
                <meshBasicMaterial color="#1f2d3d" fog={false} />
              </mesh>
              <mesh position={[-0.6, 3.14, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.32, 0.18, 0.18]} />
                <meshBasicMaterial color="#101822" fog={false} />
              </mesh>
              <mesh position={[0, 3.42, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <coneGeometry args={[0.09, 0.42, 4]} />
                <meshBasicMaterial color="#1f2d3d" fog={false} />
              </mesh>
              <mesh position={[1.55, 2.75, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[0.025, 0.8]} />
                <meshBasicMaterial color="#27384a" fog={false} />
              </mesh>
            </group>

            <group position={[11.6, cityLayout.crane2GroundY, -35.5]}>
              <mesh position={[0, 1.425, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.14, 2.85, 0.14]} />
                <meshBasicMaterial color="#182330" fog={false} />
              </mesh>
              <mesh position={[-0.65, 2.82, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[2.6, 0.11, 0.11]} />
                <meshBasicMaterial color="#1f2d3d" fog={false} />
              </mesh>
              <mesh position={[0.55, 2.8, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[0.3, 0.17, 0.17]} />
                <meshBasicMaterial color="#101822" fog={false} />
              </mesh>
              <mesh position={[0, 3.06, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <coneGeometry args={[0.09, 0.42, 4]} />
                <meshBasicMaterial color="#1f2d3d" fog={false} />
              </mesh>
              <mesh position={[-1.4, 2.4, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[0.025, 0.78]} />
                <meshBasicMaterial color="#27384a" fog={false} />
              </mesh>
            </group>

            {/* Outskirts District Heating Plant (TETs) With 3 Tall Striped Smokestacks + West Boiler Stack */}
            <group position={[20.8, cityLayout.heatGroundY, -35.8]}>
              <mesh position={[0, 0.68, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[3.6, 1.36, 1.25]} />
                <meshBasicMaterial color="#101822" fog={false} />
              </mesh>
              <mesh position={[-1.4, 0.42, 0.15]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[1.8, 0.84, 1.1]} />
                <meshBasicMaterial color="#141e2b" fog={false} />
              </mesh>
              <mesh position={[0, 0.56, 0.64]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[2.9, 0.12]} />
                <meshBasicMaterial
                  ref={heatPlantGlowMatRef}
                  color="#ff9b38"
                  toneMapped={false}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-2}
                  fog={false}
                />
              </mesh>
              {[
                { dx: -1.05, h: 4.2 },
                { dx: 0.0, h: 4.65 },
                { dx: 1.05, h: 4.35 },
              ].map((st, idx) => (
                <mesh
                  key={`heat-stack-${idx}`}
                  position={[st.dx, st.h * 0.5, 0]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <cylinderGeometry args={[0.085, 0.145, st.h, 8, 1, true]} />
                  <meshBasicMaterial map={stackTex} fog={false} />
                </mesh>
              ))}
            </group>

            <group position={[-21.8, cityLayout.westBoilerY, -36.2]}>
              <mesh position={[0, 0.55, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <boxGeometry args={[2.4, 1.1, 1.1]} />
                <meshBasicMaterial color="#101822" fog={false} />
              </mesh>
              <mesh position={[0, 1.75, 0]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <cylinderGeometry args={[0.08, 0.13, 3.5, 8, 1, true]} />
                <meshBasicMaterial map={stackTex} fog={false} />
              </mesh>
            </group>

            {/* Drifting Smoke Puffs From the 3 Striped Heating-Plant Chimneys */}
            {Array.from({ length: 12 }, (_, idx) => (
              <mesh
                key={`city-smoke-${idx}`}
                ref={(el) => {
                  citySmokeRefs.current[idx] = el;
                }}
                position={[20.8, cityLayout.heatGroundY + 4.5, -35.8]}
                renderOrder={3}
                raycast={NOOP_RAYCAST}
                frustumCulled={false}
              >
                <planeGeometry args={[1.0, 0.7]} />
                <meshBasicMaterial
                  ref={(mat) => {
                    citySmokeMatsRef.current[idx] = mat;
                  }}
                  map={steamTex}
                  transparent
                  opacity={0.38}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
            ))}

            {/* Proportional Rooftop Propaganda Neon Sign Landmark (Always 100% Lit) */}
            <group position={[0.55, cityLayout.anchorRoofY, -34.55]}>
              <mesh position={[0, 0.28, -0.04]} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[5.6, 0.56]} />
                <meshBasicMaterial
                  map={rooftopTrussTex}
                  alphaTest={0.5}
                  fog={false}
                />
              </mesh>
              {[-1.8, 0.0, 1.8].map((sx, idx) => (
                <mesh
                  key={`truss-strut-${idx}`}
                  position={[sx, 0.42, -0.14]}
                  rotation={[0.28, 0, 0]}
                  raycast={NOOP_RAYCAST}
                  frustumCulled={false}
                >
                  <boxGeometry args={[0.07, 0.85, 0.07]} />
                  <meshBasicMaterial color="#161f29" fog={false} />
                </mesh>
              ))}
              <mesh position={[0, 1.05, 0.0]} renderOrder={1} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[5.95, 1.3]} />
                <meshBasicMaterial
                  color="#ff1e1e"
                  transparent
                  opacity={0.24}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  fog={false}
                />
              </mesh>
              <mesh position={[0, 1.05, 0.04]} renderOrder={2} raycast={NOOP_RAYCAST} frustumCulled={false}>
                <planeGeometry args={[5.6, 1.05]} />
                <meshBasicMaterial
                  map={happyBannerTex}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                  fog={false}
                />
              </mesh>
            </group>

            {/* Asynchronously Blinking #ff1e1e Aviation Beacons (0.6–1.2 Hz) */}
            <instancedMesh
              ref={cityBeaconsRef}
              args={[undefined, undefined, MAX_CITY_BEACONS]}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                color="#ffffff"
                toneMapped={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
                fog={false}
              />
            </instancedMesh>
            <instancedMesh
              ref={cityBeaconHalosRef}
              args={[undefined, undefined, MAX_CITY_BEACONS]}
              renderOrder={2}
              raycast={NOOP_RAYCAST}
              frustumCulled={false}
            >
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={beaconHaloTex}
                color="#ffffff"
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
                fog={false}
              />
            </instancedMesh>
          </group>
        </group>
      </group>
    </group>
  );
});

/**
 * Exterior Panoramic Windows & Unified Wraparound Exterior World:
 * Single continuous night-sky cylinder, under-floor skirt, seamless displaced terrain,
 * `+X / +Z` rolling forest ridge, and both interactive station panoramas.
 */
export const ExteriorDioramas3D: React.FC = React.memo(() => {
  return (
    <>
      <UnifiedExteriorWorld3D />
      <RbmkAndVodkaDiorama3D />
      <WorkerCityDiorama3D />
    </>
  );
});
