import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
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
import type { SystemType } from "./types";
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

function captureCanvasPointer(e: ThreeEvent<PointerEvent>): void {
  const domElem = e.nativeEvent.target as Element | null;
  domElem?.setPointerCapture?.(e.pointerId);
}

function releaseCanvasPointer(e: ThreeEvent<PointerEvent>): void {
  const domElem = e.nativeEvent.target as Element | null;
  if (domElem?.hasPointerCapture?.(e.pointerId)) {
    domElem.releasePointerCapture(e.pointerId);
  }
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
  cyrillicSub: string;
  unit: string;
  serial: string;
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
  cyrillicSub,
  unit,
  serial,
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

      // Aged Soviet Manometer Dial Face (#e6dec3 with subtle radial vignette)
      const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 240);
      grad.addColorStop(0, "#efe8d2");
      grad.addColorStop(0.82, "#e2d9bc");
      grad.addColorStop(1, "#bfb599");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 242, 0, Math.PI * 2);
      ctx.fill();

      // Double Outer Scale Rings
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 232, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 2.5;
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

      // Fine Minor & Major Tick Marks (50 subdivisions) + Numeric Scale Labels
      for (let i = 0; i <= 50; i++) {
        const ratio = i / 50;
        const ang = Math.PI * 0.75 + ratio * Math.PI * 1.5;
        const isMajor = i % 5 === 0;
        const isMed = i % 5 === 2 || i % 5 === 3;
        const innerR = isMajor ? 156 : isMed ? 172 : 180;
        const outerR = 212;
        const inRed =
          ratio >= dangerRatio ||
          (lowDangerRatio > 0 && ratio <= lowDangerRatio);
        ctx.strokeStyle = inRed ? "#c81e1e" : "#141414";
        ctx.lineWidth = isMajor ? 5 : 2.2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
        ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
        ctx.stroke();

        if (isMajor && i % 10 === 0) {
          const val = Math.round(min + ratio * (max - min));
          const labelR = 128;
          ctx.fillStyle = inRed ? "#c81e1e" : "#141414";
          ctx.font = 'bold 24px "Courier Prime", monospace';
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            String(val),
            cx + Math.cos(ang) * labelR,
            cy + Math.sin(ang) * labelR,
          );
        }
      }

      // ГОСТ-84 Header & Cyrillic Sub-Labels
      ctx.fillStyle = "#141414";
      ctx.font = 'bold 28px "Kremlin", monospace';
      ctx.textAlign = "center";
      ctx.fillText(title, cx, cy - 64);

      ctx.fillStyle = "#2b3a32";
      ctx.font = 'bold 17px "Courier Prime", monospace';
      ctx.fillText(cyrillicSub, cx, cy - 36);

      // Red Star Emblem & Unit Box
      ctx.fillStyle = "#c81e1e";
      ctx.font = 'bold 24px "Courier Prime", monospace';
      ctx.fillText("★ СССР ★", cx, cy + 54);

      ctx.fillStyle = "#141414";
      ctx.font = 'bold 28px "VT323", monospace';
      ctx.fillText(unit, cx, cy + 88);

      ctx.fillStyle = "#454238";
      ctx.font = 'bold 14px "Courier Prime", monospace';
      ctx.fillText(`ГОСТ-84 • ${serial}`, cx, cy + 144);
    });
  }, [
    centerNominal,
    cyrillicSub,
    dangerThreshold,
    lowDangerThreshold,
    max,
    min,
    serial,
    title,
    unit,
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

      {/* 6. Sculpted 3D Pointer Needle with Counterweight Tail & Central Brass Spindle Cap */}
      <group ref={needleGroupRef} position={[0, 0, 0.056]}>
        {/* Main Tapered Crimson Pointer Blade */}
        <mesh position={[0, 0.056, 0]} castShadow>
          <boxGeometry args={[0.011, 0.132, 0.006]} />
          <meshStandardMaterial
            color="#ff2a2a"
            emissive="#ff2a2a"
            emissiveIntensity={0.55}
            roughness={0.3}
          />
        </mesh>
        {/* Dark Counterweight Tail & Disc */}
        <mesh position={[0, -0.028, 0]}>
          <boxGeometry args={[0.016, 0.044, 0.006]} />
          <meshStandardMaterial
            color="#141414"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, -0.046, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.007, 10]} />
          <meshStandardMaterial
            color="#141414"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>
        {/* Central Brushed-Brass Spindle Cap & Nut */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.024, 0.026, 0.018, 12]} />
          <meshStandardMaterial
            color="#b8a46b"
            roughness={0.26}
            metalness={0.88}
            bumpMap={brassTex.bumpMap}
            bumpScale={0.005}
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
}

const SculptedPumpValveAssembly3D: React.FC<
  SculptedPumpValveAssembly3DProps
> = ({ position, pumpIndex, label }) => {
  const wheelRef = useRef<THREE.Group>(null);
  const leverArmRef = useRef<THREE.Group>(null);
  const lampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const heatBarMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const heatBarMeshRef = useRef<THREE.Mesh>(null);
  const lastPumpOnRef = useRef<boolean | null>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const dragRef = useRef<{
    active: boolean;
    startClientY: number;
    startClientX: number;
    startThrottle: number;
    currentThrottle: number;
    lastBucket: number;
  }>({
    active: false,
    startClientY: 0,
    startClientX: 0,
    startThrottle: 100,
    currentThrottle: 100,
    lastBucket: 6,
  });

  const nameplateTex = useMemo(() => {
    return createCrispPanelTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = "#141816";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#b8a46b";
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 23px "Kremlin", monospace';
      ctx.textAlign = "center";
      ctx.fillText(label, w / 2, 29);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 15px "Courier Prime", monospace';
      ctx.fillText("FLOW VALVE • BEARING HEAT", w / 2, 52);
    });
  }, [label]);

  const heatScaleTex = useMemo(() => {
    return createCrispPanelTexture(256, 56, (ctx, w, h) => {
      ctx.fillStyle = "#101613";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#b8a46b";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 15px "Courier Prime", monospace';
      ctx.textAlign = "left";
      ctx.fillText("BEARING HEAT:", 10, 20);
      ctx.textAlign = "right";
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 15px "VT323", monospace';
      ctx.fillText("0% — 50% — 100%", w - 10, 20);
      ctx.strokeStyle = "#364940";
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 28, w - 20, 18);
    });
  }, []);

  useFrame(({ clock }) => {
    const state = useGameStore.getState();
    const throttle = state.isBlackout ? 0 : state.pumpThrottle[pumpIndex];
    const isPumpOn = state.pumpsActive[pumpIndex] && !state.isBlackout;
    const bearingHeat = pumpIndex === 0 ? state.pumpAHeat : state.pumpBHeat;

    // Continuous 6-detent rotational angle on the 6-spoke cast-iron valve wheel
    if (wheelRef.current) {
      const targetWheelRot = -(throttle / 100) * Math.PI * 1.8;
      const cavitationJitter =
        state.pumpThrottle[0] > 50 && state.pumpThrottle[1] > 50 && !state.isBlackout
          ? Math.sin(clock.getElapsedTime() * 44 + pumpIndex * 2) * 0.045
          : 0;
      wheelRef.current.rotation.z = THREE.MathUtils.lerp(
        wheelRef.current.rotation.z,
        targetWheelRot + cavitationJitter,
        0.24,
      );
    }

    if (leverArmRef.current) {
      const ratio = 1 - throttle / 100;
      const targetAngleX = -0.58 + ratio * 1.16;
      leverArmRef.current.rotation.x = THREE.MathUtils.lerp(
        leverArmRef.current.rotation.x,
        targetAngleX,
        0.25,
      );
    }

    // Update Horizontal Bearing Heat Bar cleanly below the wheel & switch
    if (heatBarMeshRef.current && heatBarMatRef.current) {
      const hRatio = THREE.MathUtils.clamp(bearingHeat / 100, 0.04, 1);
      heatBarMeshRef.current.scale.x = hRatio;
      heatBarMeshRef.current.position.x = -0.115 + hRatio * 0.115;
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

    if (lampMatRef.current && isPumpOn !== lastPumpOnRef.current) {
      lastPumpOnRef.current = isPumpOn;
      lampMatRef.current.color.set(isPumpOn ? "#33ff66" : "#ff2a2a");
      lampMatRef.current.emissive.set(isPumpOn ? "#33ff66" : "#ff2a2a");
      lampMatRef.current.emissiveIntensity = isPumpOn ? 1.5 : 0.8;
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (useCameraLookStore.getState().isFreeLookMode) return;
    e.stopPropagation();
    const curThrottle = useGameStore.getState().pumpThrottle[pumpIndex];
    dragRef.current = {
      active: true,
      startClientY: e.nativeEvent.clientY,
      startClientX: e.nativeEvent.clientX,
      startThrottle: curThrottle,
      currentThrottle: curThrottle,
      lastBucket: Math.round((curThrottle / 100) * 6),
    };
    captureCanvasPointer(e);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current.active) return;
    e.stopPropagation();
    const dy = dragRef.current.startClientY - e.nativeEvent.clientY;
    const dx = e.nativeEvent.clientX - dragRef.current.startClientX;
    const combinedDelta = dy + dx * 0.65;
    const rawThrottle = THREE.MathUtils.clamp(
      dragRef.current.startThrottle + (combinedDelta / 90) * 100,
      0,
      100,
    );
    const bucket = Math.round((rawThrottle / 100) * 6);
    const snappedThrottle = Math.round((bucket / 6) * 100);
    dragRef.current.currentThrottle = snappedThrottle;
    if (bucket !== dragRef.current.lastBucket) {
      dragRef.current.lastBucket = bucket;
      playValveWheelSqueak(bucket + 1);
      useGameStore.getState().setPumpThrottle(pumpIndex, snappedThrottle);
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current.active) return;
    e.stopPropagation();
    dragRef.current.active = false;
    releaseCanvasPointer(e);
    playSwitchClank(false);
  };

  return (
    <group position={position}>
      {/* Raised Engraved Brass & Iron Nameplate */}
      <mesh position={[0, 0.168, 0.032]} castShadow>
        <boxGeometry args={[0.31, 0.078, 0.012]} />
        <meshStandardMaterial
          color="#8c7a4b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[0, 0.168, 0.039]}>
        <planeGeometry args={[0.295, 0.068]} />
        <meshStandardMaterial map={nameplateTex} roughness={0.55} />
      </mesh>

      {/* Caged Soviet Jewel Lamp & Horizontal Bearing Heat Bar Below Wheel (`BEARING HEAT: 0-100%`) */}
      <CagedSovietJewelLamp3D
        position={[-0.125, 0.096, 0.038]}
        lampMatRef={lampMatRef}
        scale={0.84}
      />
      <group position={[0.005, -0.156, 0.038]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.268, 0.052, 0.016]} />
          <meshStandardMaterial
            color="#101513"
            roughness={0.5}
            metalness={0.7}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.005}
          />
        </mesh>
        <mesh position={[0, 0, 0.009]}>
          <planeGeometry args={[0.256, 0.046]} />
          <meshStandardMaterial
            map={heatScaleTex}
            emissive="#ffffff"
            emissiveMap={heatScaleTex}
            emissiveIntensity={0.42}
            roughness={0.75}
          />
        </mesh>
        <mesh ref={heatBarMeshRef} position={[0, -0.009, 0.013]}>
          <boxGeometry args={[0.23, 0.012, 0.008]} />
          <meshStandardMaterial
            ref={heatBarMatRef}
            color="#33ff66"
            emissive="#33ff66"
            emissiveIntensity={1.15}
          />
        </mesh>
      </group>

      {/* Heavy Bolted Cast-Iron Valve Manifold & 6-Spoke Handwheel */}
      <group position={[-0.072, -0.025, 0.038]}>
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

        {/* 6-Spoke Cast-Iron Handwheel with Outer Crank Peg */}
        <group
          ref={wheelRef}
          position={[0, 0, 0.068]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        >
          {/* Outer Rim Torus */}
          <mesh castShadow>
            <torusGeometry args={[0.068, 0.012, 10, 20]} />
            <meshStandardMaterial
              color="#9e1e1e"
              roughness={0.42}
              metalness={0.45}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.006}
            />
          </mesh>
          {/* 3 Intersecting Diameter Bars = 6 Spokes */}
          {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ang, sIdx) => (
            <mesh key={sIdx} rotation={[0, 0, ang]} castShadow>
              <cylinderGeometry args={[0.0065, 0.0065, 0.132, 8]} />
              <meshStandardMaterial
                color="#8b1e1e"
                roughness={0.45}
                metalness={0.5}
              />
            </mesh>
          ))}
          {/* Central Brass Retention Cap */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.02, 0.022, 8]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.24}
            />
          </mesh>
          {/* Protruding Brass & Mahogany Crank-Handle Peg on Rim */}
          <mesh
            position={[0.058, 0.02, 0.018]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.007, 0.009, 0.034, 8]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
        </group>
      </group>

      {/* Dual-Blade Copper Knife-Switch Throw Lever with Ribbed Bakelite Crossbar */}
      <group
        position={[0.088, -0.025, 0.036]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.088, 0.22, 0.038]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.48}
            metalness={0.65}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {/* Top & Bottom Copper Contact Jaws */}
        {[-0.068, 0.068].map((cy, cIdx) => (
          <group key={cIdx} position={[0, cy, 0.024]}>
            <mesh position={[-0.022, 0, 0]}>
              <boxGeometry args={[0.008, 0.028, 0.022]} />
              <meshStandardMaterial
                color="#c87d46"
                metalness={0.88}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0.022, 0, 0]}>
              <boxGeometry args={[0.008, 0.028, 0.022]} />
              <meshStandardMaterial
                color="#c87d46"
                metalness={0.88}
                roughness={0.25}
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
                color="#c87d46"
                roughness={0.25}
                metalness={0.88}
              />
            </mesh>
          ))}
          {/* Ribbed Cylindrical Bakelite Crossbar Grip */}
          <mesh
            position={[0, 0, 0.118]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.021, 0.021, 0.108, 12]} />
            <meshStandardMaterial
              color="#1c1412"
              roughness={0.38}
              metalness={0.2}
            />
          </mesh>
          <mesh
            position={[0, 0, 0.118]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.023, 0.023, 0.024, 12]} />
            <meshStandardMaterial
              color="#ffb000"
              roughness={0.35}
              metalness={0.3}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

interface IndustrialPowerColumn3DProps {
  position: [number, number, number];
  system: SystemType;
  label: string;
  accentColor: string;
  minusBtnTex: THREE.CanvasTexture;
  plusBtnTex: THREE.CanvasTexture;
}

const IndustrialPowerColumn3D: React.FC<IndustrialPowerColumn3DProps> = ({
  position,
  system,
  label,
  accentColor,
  minusBtnTex,
  plusBtnTex,
}) => {
  const blockMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const leverGroupRef = useRef<THREE.Group>(null);
  const lastBlockStateRef = useRef("");
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

  const labelTex = useMemo(() => {
    return createCrispPanelTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = "#141816";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#b8a46b";
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 24px "Kremlin", monospace';
      ctx.textAlign = "center";
      ctx.fillText(label, w / 2, 32);
      ctx.fillStyle = "#33ff66";
      ctx.font = 'bold 15px "Courier Prime", monospace';
      ctx.fillText("POWER BUS // 0–80 MW", w / 2, 52);
    });
  }, [label]);

  useFrame(() => {
    const state = useGameStore.getState();
    const currentMW = state.powerAllocation[system];
    // Map 0..80 MW across 10 physical 3D light-bar segments
    const activeBlocks = Math.round((currentMW / 80) * 10);
    const sig = `${activeBlocks}|${state.isBlackout}`;

    if (sig !== lastBlockStateRef.current) {
      lastBlockStateRef.current = sig;
      for (let i = 0; i < 10; i++) {
        const mat = blockMatRefs.current[i];
        if (!mat) continue;
        const isLit = !state.isBlackout && i < activeBlocks;
        const colorHex = i >= 8 ? "#ff2a2a" : i >= 6 ? "#ffb000" : "#33ff66";
        mat.color.set(isLit ? colorHex : "#141b17");
        mat.emissive.set(isLit ? colorHex : "#000000");
        mat.emissiveIntensity = isLit ? 1.45 : 0;
      }
    }

    if (leverGroupRef.current) {
      const ratio = THREE.MathUtils.clamp(currentMW / 80, 0, 1);
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
    if (
      !state.isShiftKeyHeld ||
      state.isBlackout ||
      state.komradOverrideLocked
    ) {
      playLeverRatchet(0.45);
      return;
    }
    dragRef.current = {
      active: true,
      startClientY: e.nativeEvent.clientY,
      startMW: state.powerAllocation[system],
    };
    captureCanvasPointer(e);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current.active) return;
    e.stopPropagation();
    const state = useGameStore.getState();
    if (
      !state.isShiftKeyHeld ||
      state.isBlackout ||
      state.komradOverrideLocked
    ) {
      dragRef.current.active = false;
      releaseCanvasPointer(e);
      return;
    }
    const deltaY = dragRef.current.startClientY - e.nativeEvent.clientY;
    const rawTargetMW = dragRef.current.startMW + (deltaY / 100) * 80;
    const snappedMW = THREE.MathUtils.clamp(
      Math.round(rawTargetMW / 10) * 10,
      0,
      80,
    );
    if (snappedMW !== state.powerAllocation[system]) {
      playDetentClick(Math.round(snappedMW / 10));
      state.setSubsystemPower(system, snappedMW);
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current.active) return;
    e.stopPropagation();
    dragRef.current.active = false;
    releaseCanvasPointer(e);
    playSwitchClank(false);
  };

  return (
    <group position={position}>
      {/* Raised Engraved Brass Header Plate */}
      <mesh position={[0, 0.232, 0.03]} castShadow>
        <boxGeometry args={[0.31, 0.074, 0.01]} />
        <meshStandardMaterial
          color="#8c7a4b"
          metalness={0.85}
          roughness={0.28}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
        />
      </mesh>
      <mesh position={[0, 0.232, 0.036]}>
        <planeGeometry args={[0.296, 0.064]} />
        <meshStandardMaterial map={labelTex} roughness={0.55} />
      </mesh>

      {/* Bolted Metal Bezel Housing 10 Extruded 3D Light-Bar Segments & Cast-Iron Dividers */}
      <group position={[-0.06, 0, 0.032]}>
        <mesh position={[0, 0, -0.006]} castShadow receiveShadow>
          <boxGeometry args={[0.132, 0.34, 0.024]} />
          <meshStandardMaterial
            color="#141816"
            roughness={0.45}
            metalness={0.7}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {Array.from({ length: 10 }).map((_, idx) => {
          const segY = -0.144 + idx * 0.032;
          return (
            <group key={idx} position={[0, segY, 0.008]}>
              <mesh>
                <boxGeometry args={[0.106, 0.022, 0.022]} />
                <meshStandardMaterial
                  ref={(el) => {
                    blockMatRefs.current[idx] = el;
                  }}
                  color="#141b17"
                  roughness={0.32}
                />
              </mesh>
              {/* Dark Cast-Iron Horizontal Divider Rib */}
              <mesh position={[0, 0.015, 0.004]}>
                <boxGeometry args={[0.118, 0.005, 0.018]} />
                <meshStandardMaterial
                  color="#0d110f"
                  metalness={0.75}
                  roughness={0.4}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Toothed Steel Lever Quadrant (10 Physical Metal Detent Teeth) & T-Handle Control Rod */}
      <group
        position={[0.068, 0, 0.035]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        {/* Bolted Steel Track Quadrant */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.076, 0.34, 0.032]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.45}
            metalness={0.7}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {/* Ribbed Black Rubber Dust-Bellows Slit */}
        <mesh position={[0, 0, 0.014]}>
          <boxGeometry args={[0.022, 0.3, 0.01]} />
          <meshStandardMaterial color="#090b0a" roughness={0.92} />
        </mesh>
        {/* 10 Physical Metal Detent Teeth Along Slot Edges */}
        {Array.from({ length: 10 }).map((_, tIdx) => {
          const ty = -0.144 + tIdx * 0.032;
          return (
            <group key={tIdx} position={[0, ty, 0.018]}>
              <mesh position={[-0.02, 0, 0]}>
                <boxGeometry args={[0.012, 0.008, 0.008]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.85}
                  roughness={0.28}
                />
              </mesh>
              <mesh position={[0.02, 0, 0]}>
                <boxGeometry args={[0.012, 0.008, 0.008]} />
                <meshStandardMaterial
                  color="#b8a46b"
                  metalness={0.85}
                  roughness={0.28}
                />
              </mesh>
            </group>
          );
        })}

        {/* Multi-Part Soviet Reactor Control Rod / Ergonomic T-Handle */}
        <group ref={leverGroupRef} position={[0, 0, 0.028]}>
          {/* Twin Chrome Lever Arms */}
          {[-0.016, 0.016].map((lx, lIdx) => (
            <mesh
              key={lIdx}
              position={[lx, 0, 0.024]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.0055, 0.0065, 0.056, 8]} />
              <meshStandardMaterial
                color="#d0dad4"
                metalness={0.92}
                roughness={0.18}
              />
            </mesh>
          ))}
          {/* Lathe-Turned Bakelite Cylindrical T-Grip */}
          <mesh
            position={[0, 0, 0.054]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.02, 0.02, 0.106, 14]} />
            <meshStandardMaterial
              color="#1a1412"
              roughness={0.35}
              metalness={0.22}
            />
          </mesh>
          {/* Recessed Color-Coded Enamel Bands on Grip */}
          {[-0.028, 0.028].map((bx, bIdx) => (
            <mesh
              key={bIdx}
              position={[bx, 0, 0.054]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.0215, 0.0215, 0.014, 14]} />
              <meshStandardMaterial
                color={accentColor}
                emissive={accentColor}
                emissiveIntensity={0.35}
                roughness={0.3}
              />
            </mesh>
          ))}
          {/* Spring-Loaded Brass Thumb Release Button on Side of T-Grip */}
          <mesh
            position={[0.058, 0, 0.054]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.01, 0.01, 0.014, 10]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.22}
            />
          </mesh>
        </group>
      </group>

      {/* Labeled -10 / +10 MW Step Plungers */}
      <group
        position={[-0.055, -0.212, 0.038]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGameStore.getState();
          if (!s.isShiftKeyHeld) {
            playLeverRatchet(0.4);
            return;
          }
          playLeverRatchet(0.85);
          s.shiftPower(system, -10);
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.04, 0.032]} />
          <meshStandardMaterial
            color="#18211b"
            roughness={0.48}
            metalness={0.65}
          />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.054, 0.034]} />
          <meshStandardMaterial map={minusBtnTex} roughness={0.6} />
        </mesh>
      </group>

      <group
        position={[0.018, -0.212, 0.038]}
        onClick={(e) => {
          e.stopPropagation();
          const s = useGameStore.getState();
          if (!s.isShiftKeyHeld) {
            playLeverRatchet(0.4);
            return;
          }
          playLeverRatchet(1.1);
          s.shiftPower(system, 10);
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.04, 0.032]} />
          <meshStandardMaterial
            color="#23312b"
            roughness={0.48}
            metalness={0.65}
          />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.054, 0.034]} />
          <meshStandardMaterial map={plusBtnTex} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
};

export const HighDetailReactorPanel3D: React.FC = () => {
  const panelGroupRef = useRef<THREE.Group>(null);
  const [az5CoverOpen, setAz5CoverOpen] = useState(false);
  const az5CoverGroupRef = useRef<THREE.Group>(null);
  const boronPlungerMeshRef = useRef<THREE.Group>(null);
  const boronLampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const boronDepressRef = useRef(0);
  const shiftClutchArmRef = useRef<THREE.Group>(null);
  const redlineScaleBlockRefs = useRef<
    Array<THREE.MeshStandardMaterial | null>
  >([]);
  const statusMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const clutchDragRef = useRef<{
    active: boolean;
    startY: number;
    startEngaged: boolean;
    progress: number;
  }>({ active: false, startY: 0, startEngaged: false, progress: 0 });

  const boronPlateTex = useMemo(
    () =>
      createCrispPanelTexture(256, 68, (ctx, w, h) => {
        ctx.fillStyle = "#101b14";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 19px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.fillText("BORON INJECTION", w / 2, 26);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 18px "VT323", monospace';
        ctx.fillText("COOL CORE -85°C // БОР", w / 2, 52);
      }),
    [],
  );

  const boronCapTex = useMemo(
    () =>
      createCrispPanelTexture(128, 128, (ctx, w, h) => {
        const cx = w / 2;
        const cy = h / 2;
        ctx.fillStyle = "#1b8a42";
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d8ffe4";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 24px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("BORON", cx, cy - 12);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 22px "VT323", monospace';
        ctx.fillText("-85°C", cx, cy + 16);
      }),
    [],
  );

  const statusTexture = useMemo(() => createCrispPanelTexture(768, 144), []);
  const lastTotalBlocksSigRef = useRef("");

  const topHeaderPlateTex = useMemo(
    () =>
      createCrispPanelTexture(512, 72, (ctx, w, h) => {
        ctx.fillStyle = "#141816";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 22px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("REACTOR CONTROL PANEL // UNIT A", w / 2, 30);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 17px "VT323", monospace';
        ctx.fillText(
          "CORE NO. 4 • COOLING PUMPS • MW POWER ROUTING",
          w / 2,
          56,
        );
      }),
    [],
  );

  const az5PlateTex = useMemo(
    () =>
      createCrispPanelTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = "#1a1010";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ff2a2a";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ff2a2a";
        ctx.font = 'bold 24px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("AZ-5 SCRAM", w / 2, 30);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 15px "Courier Prime", monospace';
        ctx.fillText("EMERGENCY CORE DROP // АЗ-5", w / 2, 52);
      }),
    [],
  );

  const az5HazardTex = useMemo(
    () =>
      createCrispPanelTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#ffb000";
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
        ctx.fillStyle = "#b81414";
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffdf9e";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = 'bold 28px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("AZ-5", cx, cy - 10);
        ctx.font = 'bold 18px "Kremlin", monospace';
        ctx.fillText("SCRAM", cx, cy + 18);
      }),
    [],
  );

  const clutchPlateTex = useMemo(
    () =>
      createCrispPanelTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = "#141816";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 22px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("[SHIFT] CLUTCH", w / 2, 30);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 14px "Courier Prime", monospace';
        ctx.fillText("HOLD SHIFT TO ROUTE MW", w / 2, 52);
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
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 32px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("-10", w / 2, 43);
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
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 32px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("+10", w / 2, 43);
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

  useFrame((_, delta) => {
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
      const ready = state.boronCooldown <= 0 && !state.isBlackout;
      boronLampMatRef.current.color.set(ready ? "#33ff66" : "#ffb000");
      boronLampMatRef.current.emissive.set(ready ? "#33ff66" : "#ffb000");
      boronLampMatRef.current.emissiveIntensity = ready ? 1.4 : 0.45;
    }

    if (shiftClutchArmRef.current) {
      const p = clutchDragRef.current.active
        ? clutchDragRef.current.progress
        : state.isShiftKeyHeld
          ? 1
          : 0;
      const targetAngle = -0.52 + p * 1.08;
      shiftClutchArmRef.current.rotation.x = THREE.MathUtils.lerp(
        shiftClutchArmRef.current.rotation.x,
        targetAngle,
        0.28,
      );
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
        const hex = isRedlineBlock ? "#ff2a2a" : "#33ff66";
        mat.color.set(isLit ? hex : "#141b17");
        mat.emissive.set(isLit ? hex : "#000000");
        mat.emissiveIntensity = isLit ? (isRedlineBlock ? 1.85 : 1.15) : 0;
      }
    }

    const mandateText =
      state.activeMandate && !state.activeMandate.fulfilled
        ? state.activeMandate.requirementText
        : state.isShiftKeyHeld
          ? "● [SHIFT] CLUTCH ENGAGED — DRAG MW LEVERS"
          : "○ HOLD [SHIFT] OR PULL LEFT CLUTCH LEVER TO ROUTE MW";
    const sig = `${Math.round(state.coreTemp)}|${state.pressureBar}|${state.radiationLevel}|${totalMW}|${Math.round(state.redlineInstability)}|${state.isShiftKeyHeld}|${state.az5Cooldown}|${state.isBlackout}|${mandateText}`;
    const tex = statusMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (tex && tex.userData.lastSig !== sig) {
      tex.userData.lastSig = sig;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#041208";
        ctx.fillRect(0, 0, 768, 144);

        // Subtle Horizontal Scanlines & Phosphor Cathode Grid
        ctx.fillStyle = "rgba(51, 255, 102, 0.05)";
        for (let y = 0; y < 144; y += 4) {
          ctx.fillRect(0, y, 768, 1.5);
        }

        // 3 Segmented VFD Cells (TEMP | PRESS | RAD)
        const cells = [
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
        ];

        cells.forEach((c, idx) => {
          const x0 = idx * 256;
          ctx.fillStyle = "#ffb000";
          ctx.font = 'bold 16px "Courier Prime", monospace';
          ctx.textAlign = "center";
          ctx.fillText(c.label, x0 + 128, 26);

          ctx.fillStyle = c.danger ? "#ff2a2a" : "#33ff66";
          ctx.font = 'bold 42px "VT323", monospace';
          ctx.fillText(c.val, x0 + 128, 68);
        });

        // Bottom Status Bar inside VFD Bay
        ctx.strokeStyle = "#2b4236";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(14, 84);
        ctx.lineTo(754, 84);
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = totalMW > 100 ? "#ff2a2a" : "#ffb000";
        ctx.font = 'bold 26px "VT323", monospace';
        ctx.fillText(
          `LOAD: ${totalMW}/100 MW (${totalMW > 100 ? "REDLINE OVERLOAD!" : "NOMINAL"}) | INSTAB: ${Math.round(state.redlineInstability)}%`,
          22,
          110,
        );

        ctx.fillStyle = state.isShiftKeyHeld ? "#33ff66" : "#e6dec3";
        ctx.font = 'bold 16px "Courier Prime", monospace';
        ctx.fillText(mandateText.slice(0, 68), 22, 134);
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
      <mesh position={[0, 1.12, -0.18]} castShadow receiveShadow>
        <boxGeometry args={[1.66, 2.24, 0.42]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.45}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>
      <mesh position={[0, 1.12, -0.22]} castShadow receiveShadow>
        <boxGeometry args={[1.74, 2.32, 0.36]} />
        <meshStandardMaterial
          color="#141414"
          roughness={0.5}
          metalness={0.6}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>

      {/* Top Raised Engraved Brass Header Plaque (Raised cleanly above green jewel lamps) */}
      <mesh position={[0, 2.275, 0.042]}>
        <planeGeometry args={[1.48, 0.14]} />
        <meshStandardMaterial
          map={topHeaderPlateTex}
          emissive="#ffffff"
          emissiveMap={topHeaderPlateTex}
          emissiveIntensity={0.32}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Corner Gusset Plates & Overhead Hooded Panel Work-Lights */}
      {(
        [
          [-0.78, 2.22],
          [0.78, 2.22],
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
        <group key={lIdx} position={[lx, 2.34, 0.08]}>
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
      <group position={[0, 1.8, 0.03]}>
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
          title="PRESSURE"
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
          title="DOSIMETER"
          cyrillicSub="ДОЗИМЕТР Р/Ч"
          unit="0-15 R/H"
          serial="№ 84-Д3"
          min={0}
          max={15}
          dangerThreshold={7.5}
          getValue={() => useGameStore.getState().radiationLevel}
        />
      </group>

      {/* 3. Recessed Vacuum-Fluorescent / Nixie Telemetry Readout Bay */}
      <group position={[0, 1.46, 0.03]}>
        {/* Bolted Dark-Steel Outer Frame */}
        <mesh position={[0, 0, 0.008]} castShadow receiveShadow>
          <boxGeometry args={[1.52, 0.26, 0.028]} />
          <meshStandardMaterial
            color="#141816"
            roughness={0.42}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {/* 8 Perimeter Brass Rivets */}
        {[-0.72, -0.24, 0.24, 0.72].map((rx, rIdx) => (
          <group key={rIdx}>
            <mesh
              position={[rx, 0.112, 0.024]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.007, 0.007, 0.008, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
              />
            </mesh>
            <mesh
              position={[rx, -0.112, 0.024]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.007, 0.007, 0.008, 6]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
              />
            </mesh>
          </group>
        ))}
        {/* Vertical Cast-Iron Cell Divider Struts between TEMP, PRESS, and RAD */}
        {[-0.245, 0.245].map((dx, dIdx) => (
          <mesh key={dIdx} position={[dx, 0.028, 0.022]}>
            <boxGeometry args={[0.014, 0.14, 0.016]} />
            <meshStandardMaterial
              color="#18211b"
              metalness={0.75}
              roughness={0.4}
            />
          </mesh>
        ))}
        {/* Deep Recessed VFD Canvas Plane (Matte Anti-Glare Finish — Zero PointLight Hotspot!) */}
        <mesh position={[0, 0, 0.023]}>
          <planeGeometry args={[1.46, 0.22]} />
          <meshStandardMaterial
            ref={statusMatRef}
            map={statusTexture}
            color="#ffffff"
            emissive="#ffffff"
            emissiveMap={statusTexture}
            emissiveIntensity={0.82}
            roughness={0.94}
            metalness={0.0}
          />
        </mesh>
        {/* Dark-Green Matte Anti-Glare Glass Filter Cover */}
        <mesh position={[0, 0, 0.026]}>
          <planeGeometry args={[1.46, 0.22]} />
          <meshStandardMaterial
            color="#163824"
            transparent
            opacity={0.07}
            roughness={0.95}
            metalness={0.0}
          />
        </mesh>
      </group>

      {/* 4. Middle Row: 2 Sculpted Cast-Iron Pump Valves + Multi-Part Hinged AZ-5 Safety Cage */}
      <group position={[0, 1.03, 0.03]}>
        <SculptedPumpValveAssembly3D
          position={[-0.52, 0, 0]}
          pumpIndex={0}
          label="COOLING PUMP A"
        />
        <SculptedPumpValveAssembly3D
          position={[0, 0, 0]}
          pumpIndex={1}
          label="COOLING PUMP B"
        />

        {/* Multi-Part AZ-5 Emergency Scram Assembly */}
        <group position={[0.52, 0.02, 0.02]}>
          {/* Raised Brass & Crimson Nameplate */}
          <mesh position={[0, 0.178, 0.016]} castShadow>
            <boxGeometry args={[0.3, 0.078, 0.012]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.178, 0.023]}>
            <planeGeometry args={[0.286, 0.068]} />
            <meshStandardMaterial map={az5PlateTex} roughness={0.55} />
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
              if (s.boronCooldown > 0 || s.isBlackout) {
                playLeverRatchet(0.45);
                return;
              }
              boronDepressRef.current = 1.0;
              playSwitchClank(true);
              playPneumaticWhoosh();
              s.injectBoronAcid();
            }}
          >
            {/* Bolted Cast-Iron Boron Housing Plate (Compact to stay well above 3. FACILITY) */}
            <mesh position={[0, 0, 0.004]} castShadow receiveShadow>
              <boxGeometry args={[0.275, 0.064, 0.016]} />
              <meshStandardMaterial
                color="#141816"
                roughness={0.44}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.006}
              />
            </mesh>
            <mesh position={[-0.024, 0, 0.014]} castShadow>
              <planeGeometry args={[0.168, 0.05]} />
              <meshStandardMaterial
                map={boronPlateTex}
                emissive="#ffffff"
                emissiveMap={boronPlateTex}
                emissiveIntensity={0.42}
                roughness={0.55}
              />
            </mesh>
            <CagedSovietJewelLamp3D
              position={[-0.118, 0, 0.014]}
              lampMatRef={boronLampMatRef}
              scale={0.65}
            />
            {/* Brass Outer Collar */}
            <mesh
              position={[0.092, 0, 0.018]}
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
            <group ref={boronPlungerMeshRef} position={[0.092, 0, 0.036]}>
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

      {/* 5. Bottom Row: Toothed [SHIFT] Clutch Lever + 3 Industrial 10-Segment Power Columns + 18-Segment Redline Bar */}
      <group position={[0, 0.39, 0.04]}>
        {/* Toothed [SHIFT] Clutch Lever with Dual Chrome Arms & Bakelite T-Handle */}
        <group
          position={[-0.56, 0.02, 0.02]}
          onPointerDown={(e) => {
            if (useCameraLookStore.getState().isFreeLookMode) return;
            e.stopPropagation();
            const cur = useGameStore.getState().isShiftKeyHeld;
            clutchDragRef.current = {
              active: true,
              startY: e.nativeEvent.clientY,
              startEngaged: cur,
              progress: cur ? 1 : 0,
            };
            captureCanvasPointer(e);
          }}
          onPointerMove={(e) => {
            if (!clutchDragRef.current.active) return;
            e.stopPropagation();
            const dy = e.nativeEvent.clientY - clutchDragRef.current.startY;
            const startP = clutchDragRef.current.startEngaged ? 1 : 0;
            clutchDragRef.current.progress = THREE.MathUtils.clamp(
              startP + dy / 70,
              0,
              1,
            );
          }}
          onPointerUp={(e) => {
            if (!clutchDragRef.current.active) return;
            e.stopPropagation();
            const dist = Math.abs(
              clutchDragRef.current.progress -
                (clutchDragRef.current.startEngaged ? 1 : 0),
            );
            const nextEngaged =
              dist >= 0.35
                ? !clutchDragRef.current.startEngaged
                : !useGameStore.getState().isShiftKeyHeld;
            clutchDragRef.current.active = false;
            releaseCanvasPointer(e);
            playSwitchClank(true);
            useGameStore.getState().setShiftKeyHeld(nextEngaged);
          }}
          onLostPointerCapture={(e) => {
            if (!clutchDragRef.current.active) return;
            clutchDragRef.current.active = false;
            releaseCanvasPointer(e);
          }}
        >
          <mesh position={[0, 0.232, 0.012]} castShadow>
            <boxGeometry args={[0.295, 0.074, 0.01]} />
            <meshStandardMaterial
              color="#8c7a4b"
              metalness={0.85}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.232, 0.018]}>
            <planeGeometry args={[0.282, 0.064]} />
            <meshStandardMaterial map={clutchPlateTex} roughness={0.55} />
          </mesh>

          {/* Bolted Cast-Iron Clutch Quadrant Box */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.22, 0.34, 0.06]} />
            <meshStandardMaterial
              color="#141816"
              roughness={0.45}
              metalness={0.68}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {/* Detent Teeth Along Clutch Slot */}
          {Array.from({ length: 8 }).map((_, tIdx) => (
            <mesh
              key={tIdx}
              position={[-0.045, -0.12 + tIdx * 0.034, 0.032]}
            >
              <boxGeometry args={[0.018, 0.01, 0.01]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.85}
                roughness={0.28}
              />
            </mesh>
          ))}

          <group ref={shiftClutchArmRef} position={[0, 0, 0.032]}>
            {[-0.038, 0.038].map((lx, lIdx) => (
              <mesh
                key={lIdx}
                position={[lx, 0, 0.08]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.012, 0.014, 0.16, 10]} />
                <meshStandardMaterial
                  color="#d0dad4"
                  roughness={0.2}
                  metalness={0.9}
                />
              </mesh>
            ))}
            {/* Heavy Industrial Hazard-Yellow & Bakelite T-Grip */}
            <mesh
              position={[0, 0, 0.16]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.028, 0.028, 0.175, 14]} />
              <meshStandardMaterial
                color="#ffb000"
                roughness={0.35}
                metalness={0.3}
              />
            </mesh>
            <mesh
              position={[0, 0, 0.16]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.03, 0.03, 0.06, 14]} />
              <meshStandardMaterial
                color="#141414"
                roughness={0.4}
                metalness={0.2}
              />
            </mesh>
          </group>
        </group>

        <IndustrialPowerColumn3D
          position={[-0.18, 0.02, 0]}
          system="cooling"
          label="1. COOLING"
          accentColor="#33ff66"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.18, 0.02, 0]}
          system="defense"
          label="2. DEFENSE"
          accentColor="#ffb000"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <IndustrialPowerColumn3D
          position={[0.54, 0.02, 0]}
          system="facility"
          label="3. FACILITY"
          accentColor="#ff2a2a"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />

        {/* 18-Segment Extruded 3D Total MW & Redline Bar */}
        <group position={[0, -0.27, 0.03]}>
          <mesh position={[0, 0, -0.01]} castShadow receiveShadow>
            <boxGeometry args={[1.48, 0.082, 0.024]} />
            <meshStandardMaterial
              color="#141816"
              roughness={0.45}
              metalness={0.7}
              bumpMap={ironTex.bumpMap}
              bumpScale={0.008}
            />
          </mesh>
          {Array.from({ length: 18 }).map((_, idx) => (
            <mesh key={idx} position={[-0.64 + idx * 0.075, 0, 0.01]}>
              <boxGeometry args={[0.056, 0.046, 0.026]} />
              <meshStandardMaterial
                ref={(el) => {
                  redlineScaleBlockRefs.current[idx] = el;
                }}
                color="#141b17"
                roughness={0.32}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
};

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
> = ({ breakerArmRef, breakerDragRef, breakerPlateTex }) => {
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const sparkLightRef = useRef<THREE.PointLight>(null);
  const sparkFlashRef = useRef(0);

  useFrame((_, delta) => {
    if (sparkFlashRef.current > 0) {
      sparkFlashRef.current = Math.max(0, sparkFlashRef.current - delta * 6.5);
      if (sparkLightRef.current) {
        sparkLightRef.current.intensity = sparkFlashRef.current * 4.5;
      }
    }
  });

  const handleBreakerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!breakerDragRef.current.active) return;
    e.stopPropagation();
    const finalProg = breakerDragRef.current.progress;
    breakerDragRef.current.active = false;
    releaseCanvasPointer(e);
    if (finalProg < 0.65) {
      playLeverRatchet(0.5);
      return;
    }
    const s = useGameStore.getState();
    playKnifeSwitchSlam(true);
    sparkFlashRef.current = 1.0;
    startSoundtrack();
    updateSoundtrackState(false, s.isMusicMuted);
    if (s.phase === "boot") {
      s.startShift();
    } else if (s.phase !== "playing" || s.isBlackout) {
      s.resetShift();
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
      <mesh position={[0, 0.21, 0.01]}>
        <planeGeometry args={[0.42, 0.09]} />
        <meshStandardMaterial
          map={breakerPlateTex}
          emissive="#ffffff"
          emissiveMap={breakerPlateTex}
          emissiveIntensity={0.45}
          roughness={0.65}
        />
      </mesh>
      {/* Yellow/Black Hazard Perimeter Safety Cage Bars */}
      {[-0.175, 0.175].map((hx, hIdx) => (
        <mesh key={hIdx} position={[hx, 0, 0.048]} castShadow>
          <boxGeometry args={[0.016, 0.34, 0.042]} />
          <meshStandardMaterial
            color="#ffb000"
            roughness={0.42}
            metalness={0.45}
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
        {/* Lathe-Turned Crimson & Brass Crossbar Stirrup Handle */}
        <mesh
          position={[0, 0, 0.19]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.032, 0.032, 0.24, 16]} />
          <meshStandardMaterial
            color="#ff2a2a"
            emissive="#ff2a2a"
            emissiveIntensity={0.45}
            roughness={0.32}
          />
        </mesh>
        {[-0.08, 0.08].map((rx, rIdx) => (
          <mesh
            key={rIdx}
            position={[rx, 0, 0.19]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.035, 0.035, 0.022, 16]} />
            <meshStandardMaterial
              color="#b8a46b"
              metalness={0.88}
              roughness={0.22}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};

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
}> = ({ variant = "left-rear" }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);
  const vfdMatRef = useRef<THREE.MeshStandardMaterial>(null);

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
  const sightGlassWaterMeshRef = useRef<THREE.Mesh>(null);
  const sightGlassWaterMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const [boronPistonPos, setBoronPistonPos] = useState(0); // 0 (up) to 1 (down)

  const oilDragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startVal: 60,
    lastStep: 4,
  });

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
      createCrispPanelTexture(512, 72, (ctx, w, h) => {
        ctx.fillStyle = "#141816";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 21px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText(
          variant === "rear"
            ? "CONTAINMENT & GAS LOOP // UNIT B"
            : "BIO-SHIELD & RBMK CORE MAP // UNIT A-2",
          w / 2,
          30,
        );
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 17px "VT323", monospace';
        ctx.fillText(
          variant === "rear"
            ? "HELIUM-N2 MANIFOLD • BULKHEAD SEAL • BUBBLER SIGHT-GLASS"
            : "OCTAGONAL RBMK SHIELD • OIL COOLER • BORON PISTON PUMP",
          w / 2,
          56,
        );
      }),
    [variant],
  );

  // 768x144 Multi-Bay VFD Canvas Texture (Matches UNIT A with centered cells so text NEVER clips!)
  const vfdTexture = useMemo(() => createCrispPanelTexture(768, 144), []);

  const leftPlateTex = useMemo(
    () =>
      createCrispPanelTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = "#141816";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 20px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText(
          variant === "rear" ? "HELIUM-N2 LOOP" : "OIL COOLER VALVE",
          w / 2,
          27,
        );
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 15px "Courier Prime", monospace';
        ctx.fillText(
          variant === "rear" ? "DUAL-PIPE GAS REGULATOR" : "BEARING LUBE FLOW 0-100%",
          w / 2,
          50,
        );
      }),
    [variant],
  );

  const centerPlateTex = useMemo(
    () =>
      createCrispPanelTexture(320, 64, (ctx, w, h) => {
        ctx.fillStyle = "#141816";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 19px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText(
          variant === "rear"
            ? "CONTAINMENT SEAL & SCRUBBERS"
            : "RBMK-1000 CORE BIO-SHIELD",
          w / 2,
          26,
        );
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 15px "Courier Prime", monospace';
        ctx.fillText(
          variant === "rear"
            ? "4 AIRLOCK LAMPS • 3 SEAL TOGGLES"
            : "CLICK FLASHING TILES TO INSERT RODS",
          w / 2,
          49,
        );
      }),
    [variant],
  );

  const rightPlateTex = useMemo(
    () =>
      createCrispPanelTexture(256, 64, (ctx, w, h) => {
        ctx.fillStyle = "#141816";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#b8a46b";
        ctx.lineWidth = 4;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = "#e6dec3";
        ctx.font = 'bold 20px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText(
          variant === "rear" ? "BUBBLER DRAIN" : "BORON PISTON PUMP",
          w / 2,
          27,
        );
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 15px "Courier Prime", monospace';
        ctx.fillText(
          variant === "rear"
            ? "PULL LEVER • H2O SIGHT-GLASS"
            : "PUMP HANDLE UP/DOWN TO REFILL",
          w / 2,
          50,
        );
      }),
    [variant],
  );

  const containmentSynopticTex = useMemo(
    () =>
      createCrispPanelTexture(384, 192, (ctx, w, h) => {
        ctx.fillStyle = "#0e1512";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#364940";
        ctx.lineWidth = 3;
        ctx.strokeRect(4, 4, w - 8, h - 8);

        const labels = ["AIRLOCK A", "AIRLOCK B", "GRAPHITE N2", "BUBBLER SEAL"];
        labels.forEach((lbl, idx) => {
          const cx = 48 + idx * 96;
          ctx.fillStyle = "#ffb000";
          ctx.font = 'bold 13px "Courier Prime", monospace';
          ctx.textAlign = "center";
          ctx.fillText(lbl, cx, 24);
          ctx.strokeStyle = "#b8a46b";
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - 38, 32, 76, 54);
        });

        const toggleLabels = ["N2 PURGE", "RAD FILTER", "SEAL LOCK", "EMERG SEAL"];
        toggleLabels.forEach((tlbl, idx) => {
          const cx = 48 + idx * 96;
          ctx.fillStyle = idx === 3 ? "#ff2a2a" : "#33ff66";
          ctx.font = 'bold 13px "Courier Prime", monospace';
          ctx.textAlign = "center";
          ctx.fillText(tlbl, cx, 114);
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
        0.22,
      );
    }
    const gasWheelTargetRot = -(s.nitrogenLoopValve / 100) * Math.PI * 1.6;
    if (gasWheelRef.current) {
      gasWheelRef.current.rotation.z = THREE.MathUtils.lerp(
        gasWheelRef.current.rotation.z,
        gasWheelTargetRot,
        0.22,
      );
    }

    if (oilLampMatRef.current) {
      const ok = !s.isBlackout && s.lubeOilPressure >= 30;
      const col = ok ? "#33ff66" : "#ff2a2a";
      oilLampMatRef.current.color.set(col);
      oilLampMatRef.current.emissive.set(s.isBlackout ? "#000000" : col);
      oilLampMatRef.current.emissiveIntensity = s.isBlackout ? 0 : 1.35;
    }
    if (gasLampMatRef.current) {
      const ok = !s.isBlackout && s.heliumPressure >= 18;
      const col = ok ? "#33ff66" : "#ff2a2a";
      gasLampMatRef.current.color.set(col);
      gasLampMatRef.current.emissive.set(s.isBlackout ? "#000000" : col);
      gasLampMatRef.current.emissiveIntensity = s.isBlackout ? 0 : 1.35;
    }

    // 5-Segment Oil Flow Bar on UNIT A-2
    const activeOilSegs = Math.round((s.oilCoolerValve / 100) * 5);
    for (let i = 0; i < 5; i++) {
      const mat = oilBarMatRefs.current[i];
      if (!mat) continue;
      const isLit = !s.isBlackout && i < activeOilSegs;
      const col = i === 0 ? "#ffb000" : "#33ff66";
      mat.color.set(isLit ? col : "#141b17");
      mat.emissive.set(isLit ? col : "#000000");
      mat.emissiveIntensity = isLit ? 1.35 : 0;
    }

    // 10-Segment Gas Flow Bar on UNIT B
    const activeGasSegs = Math.round((s.nitrogenLoopValve / 100) * 10);
    for (let i = 0; i < 10; i++) {
      const mat = gasBarMatRefs.current[i];
      if (!mat) continue;
      const isLit = !s.isBlackout && i < activeGasSegs;
      const col = i >= 8 ? "#ffb000" : "#33ff66";
      mat.color.set(isLit ? col : "#141b17");
      mat.emissive.set(isLit ? col : "#000000");
      mat.emissiveIntensity = isLit ? 1.35 : 0;
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
            const pulse = 1.25 + Math.sin(t * 14 + i) * 0.65;
            lensMat.color.set("#ff2a2a");
            lensMat.emissive.set("#ff2a2a");
            lensMat.emissiveIntensity = pulse;
          } else if (isAmberHotspot) {
            const pulse = 0.95 + Math.sin(t * 7 + i) * 0.35;
            lensMat.color.set("#ffb000");
            lensMat.emissive.set("#ffb000");
            lensMat.emissiveIntensity = pulse;
          } else {
            lensMat.color.set("#1a5c38");
            lensMat.emissive.set("#28c864");
            lensMat.emissiveIntensity = 0.38;
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

      // Reciprocating Boron Piston Pump & 10-Segment Boron Pressure Bar
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
        const col = i < 3 ? "#ff2a2a" : i < 6 ? "#ffb000" : "#33ff66";
        mat.color.set(isLit ? col : "#141b17");
        mat.emissive.set(isLit ? col : "#000000");
        mat.emissiveIntensity = isLit ? 1.35 : 0;
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

      if (sightGlassWaterMeshRef.current && sightGlassWaterMatRef.current) {
        const ratio = THREE.MathUtils.clamp(s.bubblerLevel / 100, 0.06, 1);
        sightGlassWaterMeshRef.current.scale.y = ratio;
        sightGlassWaterMeshRef.current.position.y = -0.115 + ratio * 0.115;
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

    // 4. Update Multi-Bay VFD Telemetry Display (Centered 3-Cell Layout so ZERO text is ever clipped!)
    const sealAllLocked = s.containmentSealLocked;
    const sig = `${variant}|${Math.round(s.coreTemp)}|${Math.round(s.pressureBar)}|${Math.round(s.pumpAHeat)}|${Math.round(s.pumpBHeat)}|${Math.round(s.lubeOilPressure)}|${Math.round(s.boronTankLevel)}|${s.oilCoolerValve}|${s.nitrogenLoopValve}|${Math.round(s.heliumPressure)}|${Math.round(s.graphiteTemp)}|${activeHotspots}|${sealAllLocked}|${Math.round(s.bubblerLevel)}|${s.bubblerDraining}|${s.isBlackout}`;
    const tex = vfdMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (tex && tex.userData.lastSig !== sig) {
      tex.userData.lastSig = sig;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#041208";
        ctx.fillRect(0, 0, 768, 144);

        // Scanline grid
        ctx.fillStyle = "rgba(51, 255, 102, 0.05)";
        for (let y = 0; y < 144; y += 4) {
          ctx.fillRect(0, y, 768, 1.5);
        }

        const cells =
          variant === "rear"
            ? [
                {
                  label: "HELIUM LOOP",
                  val: `${Math.round(s.heliumPressure)} BAR`,
                  danger: s.heliumPressure < 16 || s.heliumPressure > 52,
                },
                {
                  label: "GRAPHITE TEMP",
                  val: `${Math.round(s.graphiteTemp)} °C`,
                  danger: s.graphiteTemp >= 650,
                },
                {
                  label: "BUBBLER H2O",
                  val: `${Math.round(s.bubblerLevel)}%`,
                  danger: s.bubblerLevel >= 85,
                },
              ]
            : [
                {
                  label: "MAX BEARING",
                  val: `${Math.round(20 + Math.max(s.pumpAHeat, s.pumpBHeat))} °C`,
                  danger: Math.max(s.pumpAHeat, s.pumpBHeat) >= 75,
                },
                {
                  label: "LUBE OIL PRESS",
                  val: `${Math.round(s.lubeOilPressure)}%`,
                  danger: s.lubeOilPressure < 30,
                },
                {
                  label: "BORON TANK",
                  val: `${Math.round(s.boronTankLevel)}%`,
                  danger: s.boronTankLevel < 35,
                },
              ];

        const cellCenters = [142, 384, 626];
        cells.forEach((c, idx) => {
          const cx = cellCenters[idx] ?? 384;
          ctx.fillStyle = "#ffb000";
          ctx.font = 'bold 16px "Courier Prime", monospace';
          ctx.textAlign = "center";
          ctx.fillText(c.label, cx, 26);

          ctx.fillStyle = c.danger ? "#ff2a2a" : "#33ff66";
          ctx.font = 'bold 40px "VT323", monospace';
          ctx.fillText(c.val, cx, 68);
        });

        ctx.strokeStyle = "#2b4236";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(28, 84);
        ctx.lineTo(740, 84);
        ctx.stroke();

        ctx.textAlign = "center";
        if (variant === "rear") {
          ctx.fillStyle = sealAllLocked ? "#33ff66" : "#ff2a2a";
          ctx.font = 'bold 23px "VT323", monospace';
          ctx.fillText(
            `CONTAINMENT: ${sealAllLocked ? "SEALED" : "UNSEALED!"} | N2 VALVE: ${s.nitrogenLoopValve}% | DRAIN: ${s.bubblerDraining ? "OPEN" : "SHUT"}`,
            384,
            109,
          );
          ctx.fillStyle = "#e6dec3";
          ctx.font = 'bold 15px "Courier Prime", monospace';
          ctx.fillText(
            "TURN GAS WHEEL (LEFT) • FLIP SEAL TOGGLES • HOLD DRAIN LEVER (RIGHT)",
            384,
            133,
          );
        } else {
          ctx.fillStyle = activeHotspots > 0 ? "#ff2a2a" : "#33ff66";
          ctx.font = 'bold 23px "VT323", monospace';
          ctx.fillText(
            `OIL VALVE: ${s.oilCoolerValve}% (-${Math.round(s.oilCoolerValve * 0.15)}% PUMP HEAD) | HOTSPOTS: ${activeHotspots} ACTIVE`,
            384,
            109,
          );
          ctx.fillStyle = "#e6dec3";
          ctx.font = 'bold 15px "Courier Prime", monospace';
          ctx.fillText(
            "TURN OIL VALVE (LEFT) • CLICK FLASHING CORE TILES • PUMP BORON (RIGHT)",
            384,
            133,
          );
        }
        tex.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main Heavy Cast-Iron Cabinet Chassis */}
      <mesh position={[0, 1.12, -0.18]} castShadow receiveShadow>
        <boxGeometry args={[1.66, 2.24, 0.42]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.45}
          metalness={0.65}
          bumpMap={ironTex.bumpMap}
          bumpScale={0.008}
          roughnessMap={ironTex.roughnessMap}
        />
      </mesh>
      <mesh position={[0, 1.12, -0.22]} castShadow receiveShadow>
        <boxGeometry args={[1.74, 2.32, 0.36]} />
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
        <mesh key={idx} position={[ex, 1.12, 0.032]} castShadow receiveShadow>
          <boxGeometry args={[0.042, 2.26, 0.036]} />
          <meshStandardMaterial
            color="#18211b"
            metalness={0.7}
            roughness={0.42}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
      ))}

      {/* Top Engraved Header Plaque (Raised +0.04m cleanly above green jewel lamps) */}
      <mesh position={[0, 2.275, 0.042]}>
        <planeGeometry args={[1.48, 0.14]} />
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
        <group key={lIdx} position={[lx, 2.34, 0.08]}>
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
      <group position={[0, 1.8, 0.03]}>
        {variant === "rear" ? (
          <>
            <HighDetailManometer3D
              position={[-0.51, 0, 0]}
              title="HELIUM PRESS"
              cyrillicSub="ГЕЛИЕВЫЙ КОНТУР"
              unit="0-60 BAR"
              serial="№ 84-ГЛ1"
              min={0}
              max={60}
              lowDangerThreshold={16}
              dangerThreshold={50}
              getValue={() => useGameStore.getState().heliumPressure}
            />
            <HighDetailManometer3D
              position={[0, 0, 0]}
              title="GRAPHITE TEMP"
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
              title="CONDENSER H2O"
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
              title="MAX BEARING"
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
              title="LUBE OIL PRESS"
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
              title="BORON TANK"
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

      {/* Multi-Bay Recessed VFD Telemetry Display with Bolted Frame, Vertical Cell Dividers & Matte Anti-Glare Cover (Zero PointLight Hotspot!) */}
      <group position={[0, 1.46, 0.03]}>
        <mesh position={[0, 0, 0.008]} castShadow receiveShadow>
          <boxGeometry args={[1.48, 0.255, 0.028]} />
          <meshStandardMaterial
            color="#141816"
            roughness={0.42}
            metalness={0.72}
            bumpMap={ironTex.bumpMap}
            bumpScale={0.008}
          />
        </mesh>
        {/* 8 Perimeter Brass Hex Rivets */}
        {[-0.7, -0.23, 0.23, 0.7].map((rx, rIdx) => (
          <group key={rIdx}>
            <mesh position={[rx, 0.11, 0.024]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.007, 0.007, 0.008, 6]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[rx, -0.11, 0.024]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.007, 0.007, 0.008, 6]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
          </group>
        ))}
        {/* Vertical Cast-Iron Cell Divider Struts */}
        {[-0.235, 0.235].map((dx, dIdx) => (
          <mesh key={dIdx} position={[dx, 0.028, 0.022]}>
            <boxGeometry args={[0.014, 0.135, 0.016]} />
            <meshStandardMaterial color="#18211b" metalness={0.75} roughness={0.4} />
          </mesh>
        ))}
        {/* Recessed Matte VFD Canvas Plane (100% Even Emissive Lighting) */}
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[1.41, 0.215]} />
          <meshStandardMaterial
            ref={vfdMatRef}
            map={vfdTexture}
            color="#ffffff"
            emissive="#ffffff"
            emissiveMap={vfdTexture}
            emissiveIntensity={0.82}
            roughness={0.94}
            metalness={0.0}
          />
        </mesh>
        {/* Matte Anti-Glare Recessed Filter Cover */}
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[1.41, 0.215]} />
          <meshStandardMaterial
            color="#163824"
            transparent
            opacity={0.07}
            roughness={0.95}
            metalness={0.0}
          />
        </mesh>
      </group>

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
            {/* Subtle Warm Local Fill Light for High-Contrast Readability */}
            <pointLight
              position={[0, -0.02, 0.16]}
              color="#ffe4b0"
              intensity={0.38}
              distance={0.58}
              decay={1.8}
            />
            <mesh position={[0, 0.25, 0.012]} castShadow>
              <boxGeometry args={[0.31, 0.076, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.25, 0.018]}>
              <planeGeometry args={[0.296, 0.066]} />
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
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} castShadow receiveShadow>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2621"
                roughness={0.42}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
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
                color="#d8c280"
                metalness={0.88}
                roughness={0.24}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>

            {/* Stepped Cast-Iron Valve Body & Stuffing Box */}
            <group position={[-0.035, -0.02, 0.022]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.068, 0.078, 0.034, 14]} />
                <meshStandardMaterial
                  color="#2a3831"
                  roughness={0.38}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                />
              </mesh>
              <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.054, 0.056, 0.008, 16]} />
                <meshStandardMaterial color="#d8c280" metalness={0.88} roughness={0.24} />
              </mesh>
              <mesh position={[0, 0, 0.038]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.022, 0.028, 0.065, 10]} />
                <meshStandardMaterial color="#8c9c93" roughness={0.32} metalness={0.82} />
              </mesh>

              {/* High-Contrast Industrial Amber-Enamel & Brushed-Brass 6-Spoke Handwheel */}
              <group
                ref={oilWheelRef}
                position={[0, 0, 0.07]}
                onPointerDown={(e) => {
                  if (useCameraLookStore.getState().isFreeLookMode) return;
                  e.stopPropagation();
                  const curVal = useGameStore.getState().oilCoolerValve;
                  oilDragRef.current = {
                    active: true,
                    startX: e.nativeEvent.clientX,
                    startY: e.nativeEvent.clientY,
                    startVal: curVal,
                    lastStep: Math.round((curVal / 100) * 6),
                  };
                  captureCanvasPointer(e);
                }}
                onPointerMove={(e) => {
                  if (!oilDragRef.current.active) return;
                  e.stopPropagation();
                  const dy = oilDragRef.current.startY - e.nativeEvent.clientY;
                  const dx = e.nativeEvent.clientX - oilDragRef.current.startX;
                  const raw = THREE.MathUtils.clamp(
                    oilDragRef.current.startVal + ((dy + dx * 0.65) / 85) * 100,
                    0,
                    100,
                  );
                  const step = Math.round((raw / 100) * 6);
                  if (step !== oilDragRef.current.lastStep) {
                    oilDragRef.current.lastStep = step;
                    playValveWheelSqueak(step + 1);
                    useGameStore
                      .getState()
                      .setOilCoolerValve(Math.round((step / 6) * 100));
                  }
                }}
                onPointerUp={(e) => {
                  if (!oilDragRef.current.active) return;
                  e.stopPropagation();
                  oilDragRef.current.active = false;
                  releaseCanvasPointer(e);
                  playSwitchClank(false);
                }}
              >
                <mesh castShadow>
                  <torusGeometry args={[0.074, 0.014, 10, 22]} />
                  <meshStandardMaterial
                    color="#ff9d00"
                    emissive="#ff8800"
                    emissiveIntensity={0.28}
                    roughness={0.32}
                    metalness={0.35}
                    bumpMap={ironTex.bumpMap}
                    bumpScale={0.006}
                  />
                </mesh>
                {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ang, sIdx) => (
                  <mesh key={sIdx} rotation={[0, 0, ang]} castShadow>
                    <cylinderGeometry args={[0.0075, 0.0095, 0.142, 8]} />
                    <meshStandardMaterial color="#d8c280" roughness={0.28} metalness={0.85} />
                  </mesh>
                ))}
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.02, 0.023, 0.026, 10]} />
                  <meshStandardMaterial color="#e0ca86" metalness={0.9} roughness={0.22} />
                </mesh>
                <mesh position={[0.062, 0.018, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.009, 0.011, 0.038, 8]} />
                  <meshStandardMaterial
                    color="#ff2a2a"
                    emissive="#ff2a2a"
                    emissiveIntensity={0.35}
                    roughness={0.3}
                  />
                </mesh>
              </group>
            </group>

            {/* 5-Segment Vertical LED Oil-Flow Bar beside Manifold */}
            <group position={[0.105, -0.02, 0.022]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.056, 0.24, 0.02]} />
                <meshStandardMaterial color="#101513" roughness={0.45} metalness={0.7} />
              </mesh>
              {Array.from({ length: 5 }).map((_, idx) => (
                <mesh key={idx} position={[0, -0.084 + idx * 0.042, 0.01]}>
                  <boxGeometry args={[0.038, 0.028, 0.014]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      oilBarMatRefs.current[idx] = el;
                    }}
                    color="#33ff66"
                    emissive="#33ff66"
                    emissiveIntensity={1.2}
                  />
                </mesh>
              ))}
            </group>
          </group>

          {/* 2. CENTER: Recessed Octagonal RBMK-1000 Biological Shield & 37 Extruded Square Stainless-Steel Blocks */}
          <group position={[0, 0.0, 0.02]}>
            <mesh position={[0, 0.265, 0.012]} castShadow>
              <boxGeometry args={[0.42, 0.074, 0.01]} />
              <meshStandardMaterial color="#8c7a4b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.265, 0.018]}>
              <planeGeometry args={[0.406, 0.064]} />
              <meshStandardMaterial map={centerPlateTex} roughness={0.55} />
            </mesh>

            {/* 8-Sided Recessed Octagonal Cast-Iron Reactor Vessel Housing */}
            <mesh
              position={[0, -0.015, 0.008]}
              rotation={[Math.PI / 2, Math.PI / 8, 0]}
              castShadow
              receiveShadow
            >
              <cylinderGeometry args={[0.228, 0.242, 0.038, 8]} />
              <meshStandardMaterial
                color="#141816"
                roughness={0.44}
                metalness={0.72}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>
            {/* Octagonal Brushed-Brass Inner Bevel Collar */}
            <mesh
              position={[0, -0.015, 0.026]}
              rotation={[0, 0, Math.PI / 8]}
              castShadow
            >
              <torusGeometry args={[0.214, 0.011, 8, 8]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.86}
                roughness={0.26}
                bumpMap={brassTex.bumpMap}
                bumpScale={0.005}
              />
            </mesh>
            {/* 8 Perimeter Steel Clamp Blocks & Bolts around Octagon */}
            {Array.from({ length: 8 }).map((_, cIdx) => {
              const ang = (cIdx / 8) * Math.PI * 2 + Math.PI / 8;
              return (
                <mesh
                  key={cIdx}
                  position={[
                    Math.cos(ang) * 0.222,
                    -0.015 + Math.sin(ang) * 0.222,
                    0.028,
                  ]}
                  rotation={[0, 0, ang]}
                  castShadow
                >
                  <boxGeometry args={[0.028, 0.042, 0.018]} />
                  <meshStandardMaterial color="#ffb000" roughness={0.4} metalness={0.45} />
                </mesh>
              );
            })}

            {/* 37 Extruded Square Stainless-Steel Biological Shield Blocks with Pop-Out Control Rod Pins */}
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
                >
                  {/* Extruded Square Stainless-Steel Biological Shield Block */}
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[0.041, 0.041, 0.016]} />
                    <meshStandardMaterial
                      color="#7a8680"
                      metalness={0.78}
                      roughness={0.34}
                      bumpMap={ironTex.bumpMap}
                      bumpScale={0.004}
                    />
                  </mesh>
                  {/* Dark Recessed Channel Bore */}
                  <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.013, 0.013, 0.004, 8]} />
                    <meshStandardMaterial color="#101513" roughness={0.7} />
                  </mesh>
                  {/* Glowing Channel Status Lens */}
                  <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.0105, 0.0105, 0.005, 8]} />
                    <meshStandardMaterial
                      ref={(el) => {
                        channelLensMatRefs.current[tIdx] = el;
                      }}
                      color="#1a5c38"
                      emissive="#28c864"
                      emissiveIntensity={0.38}
                      roughness={0.28}
                    />
                  </mesh>
                  {/* Physical Pop-Out Control Rod Indicator Pin */}
                  <group
                    ref={(el) => {
                      channelPinGroupRefs.current[tIdx] = el;
                    }}
                    position={[0, 0, 0.005]}
                  >
                    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                      <cylinderGeometry args={[0.0048, 0.0055, 0.02, 8]} />
                      <meshStandardMaterial
                        color="#d8deda"
                        metalness={0.9}
                        roughness={0.2}
                      />
                    </mesh>
                    <mesh position={[0, 0, 0.011]} rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[0.006, 0.006, 0.004, 8]} />
                      <meshStandardMaterial
                        color="#b8a46b"
                        metalness={0.88}
                        roughness={0.22}
                      />
                    </mesh>
                  </group>
                </group>
              ))}
            </group>
          </group>

          {/* 3. RIGHT: Heavy Cast-Iron Reciprocating Piston Lever Pump (`BORON PISTON PUMP`) */}
          <group position={[0.53, 0.02, 0.02]}>
            {/* Subtle Warm Local Fill Light for High-Contrast Readability */}
            <pointLight
              position={[0, -0.02, 0.16]}
              color="#ffe4b0"
              intensity={0.38}
              distance={0.58}
              decay={1.8}
            />
            <mesh position={[0, 0.25, 0.012]} castShadow>
              <boxGeometry args={[0.31, 0.076, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.25, 0.018]}>
              <planeGeometry args={[0.296, 0.066]} />
              <meshStandardMaterial
                map={rightPlateTex}
                emissive="#ffffff"
                emissiveMap={rightPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
              />
            </mesh>

            {/* Brushed-Brass Framed Cast-Iron Pump Backplate */}
            <mesh position={[0, -0.02, 0.005]} castShadow receiveShadow>
              <boxGeometry args={[0.322, 0.372, 0.018]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} castShadow receiveShadow>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2621"
                roughness={0.42}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>

            {/* Vertical Slotted Cast-Iron Hydraulic Cylinder & Reciprocating Brass Piston Rod */}
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
                captureCanvasPointer(e);
              }}
              onPointerMove={(e) => {
                if (!pistonDragRef.current.active) return;
                e.stopPropagation();
                const dy = e.nativeEvent.clientY - pistonDragRef.current.startY;
                const nextPos = THREE.MathUtils.clamp(
                  pistonDragRef.current.startPos + dy / 75,
                  0,
                  1,
                );
                setBoronPistonPos(nextPos);
                const halfStroke = nextPos >= 0.7 ? 1 : nextPos <= 0.3 ? 0 : pistonDragRef.current.lastHalfStroke;
                if (halfStroke !== pistonDragRef.current.lastHalfStroke) {
                  pistonDragRef.current.lastHalfStroke = halfStroke;
                  playSwitchClank(true);
                  playPneumaticWhoosh();
                  useGameStore.getState().pumpBoronTank(14);
                }
              }}
              onPointerUp={(e) => {
                if (!pistonDragRef.current.active) return;
                e.stopPropagation();
                pistonDragRef.current.active = false;
                releaseCanvasPointer(e);
                setBoronPistonPos(0);
              }}
            >
              {/* Slotted Brushed-Steel Cylinder Barrel */}
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[0.044, 0.048, 0.25, 14]} />
                <meshStandardMaterial
                  color="#384a42"
                  roughness={0.34}
                  metalness={0.78}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              {/* Top & Bottom Bright Brushed-Brass Packing Glands */}
              {[-0.125, 0.125].map((gy, gIdx) => (
                <mesh key={gIdx} position={[0, gy, 0]} castShadow>
                  <cylinderGeometry args={[0.056, 0.056, 0.024, 12]} />
                  <meshStandardMaterial
                    color="#d8c280"
                    metalness={0.88}
                    roughness={0.24}
                  />
                </mesh>
              ))}
              {/* Hazard-Yellow Guide Collar Rings */}
              {[-0.085, 0.085].map((hy, hIdx) => (
                <mesh key={hIdx} position={[0, hy, 0]} castShadow>
                  <cylinderGeometry args={[0.049, 0.049, 0.014, 12]} />
                  <meshStandardMaterial
                    color="#ffb000"
                    emissive="#ff9900"
                    emissiveIntensity={0.22}
                    roughness={0.35}
                  />
                </mesh>
              ))}
              {/* Dark Vertical Machined Guide Slot */}
              <mesh position={[0, 0, 0.036]}>
                <boxGeometry args={[0.024, 0.2, 0.018]} />
                <meshStandardMaterial color="#090c0a" roughness={0.9} />
              </mesh>

              {/* Sliding Brass Piston Rod, Dual Chrome Clevis Links & High-Contrast Signal-Red/Brass T-Bar Handle */}
              <group ref={boronPistonGroupRef} position={[0, 0.055, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.017, 0.017, 0.22, 12]} />
                  <meshStandardMaterial
                    color="#e5cf8e"
                    metalness={0.92}
                    roughness={0.18}
                  />
                </mesh>
                {/* Dual Chrome Clevis Arms protruding through slot */}
                {[-0.022, 0.022].map((cx, cIdx) => (
                  <mesh
                    key={cIdx}
                    position={[cx, 0, 0.056]}
                    rotation={[Math.PI / 2, 0, 0]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.0085, 0.0095, 0.095, 8]} />
                    <meshStandardMaterial
                      color="#e8f0ec"
                      metalness={0.92}
                      roughness={0.18}
                    />
                  </mesh>
                ))}
                {/* High-Visibility Signal-Crimson Enamel & Brushed-Brass T-Bar Pump Grip */}
                <mesh
                  position={[0, 0, 0.106]}
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow
                >
                  <cylinderGeometry args={[0.023, 0.023, 0.168, 14]} />
                  <meshStandardMaterial
                    color="#ff2a2a"
                    emissive="#ff2a2a"
                    emissiveIntensity={0.36}
                    roughness={0.32}
                    metalness={0.22}
                  />
                </mesh>
                {[-0.078, 0.078].map((bx, bIdx) => (
                  <mesh
                    key={bIdx}
                    position={[bx, 0, 0.106]}
                    rotation={[0, 0, Math.PI / 2]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.025, 0.025, 0.018, 14]} />
                    <meshStandardMaterial color="#e0ca86" metalness={0.9} roughness={0.22} />
                  </mesh>
                ))}
                <mesh
                  position={[0, 0, 0.106]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.025, 0.025, 0.044, 14]} />
                  <meshStandardMaterial
                    color="#ffb000"
                    emissive="#ff9900"
                    emissiveIntensity={0.25}
                    roughness={0.34}
                  />
                </mesh>
              </group>
            </group>

            {/* 10-Segment Vertical BORON PRESSURE Bar beside Piston Cylinder */}
            <group position={[0.095, -0.02, 0.022]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.064, 0.28, 0.022]} />
                <meshStandardMaterial color="#101513" roughness={0.45} metalness={0.7} />
              </mesh>
              {Array.from({ length: 10 }).map((_, idx) => (
                <mesh key={idx} position={[0, -0.112 + idx * 0.025, 0.01]}>
                  <boxGeometry args={[0.044, 0.018, 0.014]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      boronBarMatRefs.current[idx] = el;
                    }}
                    color="#33ff66"
                    emissive="#33ff66"
                    emissiveIntensity={1.25}
                  />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      ) : (
        <group position={[0, 0.78, 0.03]}>
          {/* ================================================================
              UNIT B (`variant === "rear"`) — ZERO CLONED PARTS!
              1. Left: Dual-Pipe Finned Copper Gas Manifold & Heavy Brass Regulator Wheel
              2. Center: Square Bolted Containment Bulkhead Synoptic Panel (4 Jewel Lamps + 3 Guarded Toggles + Red Mushroom Seal Button)
              3. Right: Toothed Cast-Iron Quadrant Pull-Lever + Illuminated Cylindrical Glass Water Sight-Tube
             ================================================================ */}

          {/* 1. LEFT: Dual-Pipe Finned Copper Gas Manifold & Brass Regulator Wheel (`HELIUM-N2 LOOP`) */}
          <group position={[-0.53, 0.02, 0.02]}>
            {/* Subtle Warm Local Fill Light for High-Contrast Readability */}
            <pointLight
              position={[0, -0.02, 0.16]}
              color="#ffe4b0"
              intensity={0.38}
              distance={0.58}
              decay={1.8}
            />
            <mesh position={[0, 0.25, 0.012]} castShadow>
              <boxGeometry args={[0.31, 0.076, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.25, 0.018]}>
              <planeGeometry args={[0.296, 0.066]} />
              <meshStandardMaterial
                map={leftPlateTex}
                emissive="#ffffff"
                emissiveMap={leftPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
              />
            </mesh>

            {/* Brushed-Brass Framed Manifold Baseplate */}
            <mesh position={[0, -0.02, 0.005]} castShadow receiveShadow>
              <boxGeometry args={[0.322, 0.372, 0.018]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} castShadow receiveShadow>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2621"
                roughness={0.42}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>

            {/* Two Bright Finned Copper/Brass Gas Pipes */}
            {[-0.088, 0.018].map((px, pIdx) => (
              <group key={pIdx} position={[px, -0.02, 0.026]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.016, 0.016, 0.32, 12]} />
                  <meshStandardMaterial
                    color={pIdx === 0 ? "#e08e52" : "#dec67e"}
                    metalness={0.9}
                    roughness={0.22}
                    bumpMap={brassTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
                {[-0.11, -0.055, 0.055, 0.11].map((fy, fIdx) => (
                  <mesh key={fIdx} position={[0, fy, 0]} castShadow>
                    <cylinderGeometry args={[0.026, 0.026, 0.012, 12]} />
                    <meshStandardMaterial
                      color="#d4be7f"
                      metalness={0.88}
                      roughness={0.24}
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
            <group position={[-0.035, -0.02, 0.032]}>
              <mesh position={[0, 0, 0.008]}>
                <torusGeometry args={[0.088, 0.0065, 8, 22, Math.PI]} />
                <meshStandardMaterial color="#d8c280" metalness={0.88} roughness={0.24} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.064, 0.072, 0.042, 14]} />
                <meshStandardMaterial
                  color="#2a3831"
                  roughness={0.38}
                  metalness={0.72}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.008}
                />
              </mesh>
              <group
                ref={gasWheelRef}
                position={[0, 0, 0.058]}
                onPointerDown={(e) => {
                  if (useCameraLookStore.getState().isFreeLookMode) return;
                  e.stopPropagation();
                  const curVal = useGameStore.getState().nitrogenLoopValve;
                  oilDragRef.current = {
                    active: true,
                    startX: e.nativeEvent.clientX,
                    startY: e.nativeEvent.clientY,
                    startVal: curVal,
                    lastStep: Math.round((curVal / 100) * 6),
                  };
                  captureCanvasPointer(e);
                }}
                onPointerMove={(e) => {
                  if (!oilDragRef.current.active) return;
                  e.stopPropagation();
                  const dy = oilDragRef.current.startY - e.nativeEvent.clientY;
                  const dx = e.nativeEvent.clientX - oilDragRef.current.startX;
                  const raw = THREE.MathUtils.clamp(
                    oilDragRef.current.startVal + ((dy + dx * 0.65) / 85) * 100,
                    0,
                    100,
                  );
                  const step = Math.round((raw / 100) * 6);
                  if (step !== oilDragRef.current.lastStep) {
                    oilDragRef.current.lastStep = step;
                    playValveWheelSqueak(step + 1);
                    useGameStore
                      .getState()
                      .setNitrogenLoopValve(Math.round((step / 6) * 100));
                  }
                }}
                onPointerUp={(e) => {
                  if (!oilDragRef.current.active) return;
                  e.stopPropagation();
                  oilDragRef.current.active = false;
                  releaseCanvasPointer(e);
                  playSwitchClank(false);
                }}
              >
                <mesh castShadow>
                  <torusGeometry args={[0.072, 0.014, 10, 22]} />
                  <meshStandardMaterial
                    color="#e62222"
                    emissive="#ff2a2a"
                    emissiveIntensity={0.28}
                    metalness={0.35}
                    roughness={0.32}
                    bumpMap={brassTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
                {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ang, sIdx) => (
                  <mesh key={sIdx} rotation={[0, 0, ang]} castShadow>
                    <cylinderGeometry args={[0.0075, 0.0095, 0.138, 8]} />
                    <meshStandardMaterial color="#d8c280" roughness={0.28} metalness={0.85} />
                  </mesh>
                ))}
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.02, 0.022, 0.026, 10]} />
                  <meshStandardMaterial color="#e0ca86" metalness={0.9} roughness={0.22} />
                </mesh>
                <mesh position={[0.06, 0.018, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.009, 0.011, 0.038, 8]} />
                  <meshStandardMaterial
                    color="#ffb000"
                    emissive="#ff9900"
                    emissiveIntensity={0.35}
                    roughness={0.3}
                  />
                </mesh>
              </group>
            </group>

            {/* 10-Segment Vertical Gas Flow Bar */}
            <group position={[0.102, -0.02, 0.022]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.056, 0.28, 0.02]} />
                <meshStandardMaterial color="#101513" roughness={0.45} metalness={0.7} />
              </mesh>
              {Array.from({ length: 10 }).map((_, idx) => (
                <mesh key={idx} position={[0, -0.112 + idx * 0.025, 0.01]}>
                  <boxGeometry args={[0.038, 0.018, 0.014]} />
                  <meshStandardMaterial
                    ref={(el) => {
                      gasBarMatRefs.current[idx] = el;
                    }}
                    color="#33ff66"
                    emissive="#33ff66"
                    emissiveIntensity={1.25}
                  />
                </mesh>
              ))}
            </group>
          </group>

          {/* 2. CENTER: Square Bolted Containment Bulkhead Synoptic Panel (4 Jewel Lamps + Brass Pipe Strips + 3 Guarded Toggles + Red Mushroom Seal Button) */}
          <group position={[0, 0.0, 0.02]}>
            <mesh position={[0, 0.265, 0.012]} castShadow>
              <boxGeometry args={[0.44, 0.074, 0.01]} />
              <meshStandardMaterial color="#8c7a4b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.265, 0.018]}>
              <planeGeometry args={[0.426, 0.064]} />
              <meshStandardMaterial map={centerPlateTex} roughness={0.55} />
            </mesh>

            {/* Square Bolted Steel Containment Housing */}
            <mesh position={[0, -0.02, 0.01]} castShadow receiveShadow>
              <boxGeometry args={[0.46, 0.38, 0.028]} />
              <meshStandardMaterial
                color="#141816"
                roughness={0.44}
                metalness={0.72}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>
            <mesh position={[0, -0.02, 0.025]}>
              <planeGeometry args={[0.43, 0.34]} />
              <meshStandardMaterial
                map={containmentSynopticTex}
                emissive="#ffffff"
                emissiveMap={containmentSynopticTex}
                emissiveIntensity={0.42}
                roughness={0.65}
              />
            </mesh>

            {/* Physical 3D Brass Pipe-Routing Bus Strips connecting the 4 Containment Jewel Lamps */}
            <mesh position={[0, 0.055, 0.028]} castShadow>
              <boxGeometry args={[0.34, 0.01, 0.008]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.25} />
            </mesh>

            {/* Upper Bank: 4 Heavy Caged Soviet Jewel Lamps (`AIRLOCK A`, `AIRLOCK B`, `GRAPHITE N2`, `BUBBLER SEAL`) */}
            {[-0.16, -0.053, 0.053, 0.16].map((lx, lIdx) => (
              <CagedSovietJewelLamp3D
                key={lIdx}
                position={[lx, 0.055, 0.03]}
                lampMatRef={(el) => {
                  sealJewelMatRefs.current[lIdx] = el;
                }}
                scale={0.88}
              />
            ))}

            {/* Lower Bank Left: 3 Heavy Guarded Metal Toggle Switches (`N2 PURGE`, `RAD FILTER`, `SEAL LOCK`) */}
            {[-0.16, -0.053, 0.053].map((tx, tIdx) => (
              <group
                key={tIdx}
                position={[tx, -0.1, 0.028]}
                onClick={(e) => {
                  if (useCameraLookStore.getState().isFreeLookMode) return;
                  e.stopPropagation();
                  playSwitchClank(true);
                  useGameStore.getState().toggleSealSwitch(tIdx as 0 | 1 | 2);
                }}
              >
                {/* U-Shaped Steel Toggle Side Guards */}
                {[-0.024, 0.024].map((gx, gIdx) => (
                  <mesh key={gIdx} position={[gx, 0, 0.018]} castShadow>
                    <boxGeometry args={[0.006, 0.068, 0.036]} />
                    <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
                  </mesh>
                ))}
                {/* Brass Hex Mounting Nut */}
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.016, 0.018, 0.014, 6]} />
                  <meshStandardMaterial color="#b8a46b" metalness={0.88} roughness={0.24} />
                </mesh>
                {/* Animated Chrome Toggle Bat */}
                <group
                  ref={(el) => {
                    sealToggleBatRefs.current[tIdx] = el;
                  }}
                  position={[0, 0, 0.008]}
                >
                  <mesh position={[0, 0, 0.028]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.007, 0.004, 0.052, 10]} />
                    <meshStandardMaterial color="#d8e2dc" metalness={0.92} roughness={0.18} />
                  </mesh>
                </group>
              </group>
            ))}

            {/* Lower Bank Right: Red Mushroom `EMERGENCY SEAL` Lock Button */}
            <group
              position={[0.16, -0.1, 0.028]}
              onPointerDown={(e) => {
                if (useCameraLookStore.getState().isFreeLookMode) return;
                e.stopPropagation();
                emergSealDepressRef.current = 1.0;
                playSwitchClank(true);
                playPneumaticWhoosh();
                useGameStore.getState().lockAllContainmentSeals();
              }}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.032, 0.036, 0.018, 14]} />
                <meshStandardMaterial color="#ffb000" roughness={0.4} metalness={0.45} />
              </mesh>
              <group ref={emergSealBtnRef} position={[0, 0, 0.028]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.026, 0.022, 0.024, 14]} />
                  <meshStandardMaterial
                    color="#d92020"
                    emissive="#ff2a2a"
                    emissiveIntensity={0.45}
                    roughness={0.3}
                  />
                </mesh>
              </group>
            </group>
          </group>

          {/* 3. RIGHT: Toothed Cast-Iron Quadrant Pull-Lever & Illuminated Cylindrical Glass Water Sight-Tube (`BUBBLER DRAIN`) */}
          <group position={[0.53, 0.02, 0.02]}>
            {/* Subtle Warm Local Fill Light for High-Contrast Readability */}
            <pointLight
              position={[0, -0.02, 0.16]}
              color="#ffe4b0"
              intensity={0.38}
              distance={0.58}
              decay={1.8}
            />
            <mesh position={[0, 0.25, 0.012]} castShadow>
              <boxGeometry args={[0.31, 0.076, 0.01]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.25, 0.018]}>
              <planeGeometry args={[0.296, 0.066]} />
              <meshStandardMaterial
                map={rightPlateTex}
                emissive="#ffffff"
                emissiveMap={rightPlateTex}
                emissiveIntensity={0.35}
                roughness={0.65}
              />
            </mesh>

            {/* Brushed-Brass Framed Cast-Iron Assembly Backplate */}
            <mesh position={[0, -0.02, 0.005]} castShadow receiveShadow>
              <boxGeometry args={[0.322, 0.372, 0.018]} />
              <meshStandardMaterial color="#b8a46b" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.02, 0.009]} castShadow receiveShadow>
              <boxGeometry args={[0.306, 0.356, 0.022]} />
              <meshStandardMaterial
                color="#1c2621"
                roughness={0.42}
                metalness={0.68}
                bumpMap={ironTex.bumpMap}
                bumpScale={0.008}
              />
            </mesh>

            {/* Left Half: Toothed Cast-Iron Quadrant Pull-Lever (`СБРОС БАРБОТЕРА`) */}
            <group
              position={[-0.055, -0.02, 0.028]}
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
                captureCanvasPointer(e);
              }}
              onPointerMove={(e) => {
                if (!drainDragRef.current.active) return;
                e.stopPropagation();
                const dy = e.nativeEvent.clientY - drainDragRef.current.startY;
                const prog = THREE.MathUtils.clamp(0.4 + dy / 65, 0.15, 1.0);
                drainDragRef.current.progress = prog;
                useGameStore.getState().setBubblerDraining(prog >= 0.2);
              }}
              onPointerUp={(e) => {
                if (!drainDragRef.current.active) return;
                e.stopPropagation();
                drainDragRef.current.active = false;
                drainDragRef.current.progress = 0;
                useGameStore.getState().setBubblerDraining(false);
                releaseCanvasPointer(e);
                playSwitchClank(false);
              }}
              onLostPointerCapture={(e) => {
                if (!drainDragRef.current.active) return;
                drainDragRef.current.active = false;
                drainDragRef.current.progress = 0;
                useGameStore.getState().setBubblerDraining(false);
                releaseCanvasPointer(e);
              }}
            >
              {/* Bolted Brushed-Steel Quadrant Box */}
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.114, 0.292, 0.032]} />
                <meshStandardMaterial
                  color="#35463e"
                  roughness={0.35}
                  metalness={0.76}
                  bumpMap={ironTex.bumpMap}
                  bumpScale={0.006}
                />
              </mesh>
              {/* Rubber Dust-Bellows Slit */}
              <mesh position={[0, 0, 0.014]}>
                <boxGeometry args={[0.024, 0.24, 0.01]} />
                <meshStandardMaterial color="#090b0a" roughness={0.92} />
              </mesh>
              {/* 8 Bright Brass Detent Teeth Along Quadrant Slot */}
              {Array.from({ length: 8 }).map((_, tIdx) => {
                const ty = -0.105 + tIdx * 0.03;
                return (
                  <group key={tIdx} position={[0, ty, 0.018]}>
                    <mesh position={[-0.022, 0, 0]}>
                      <boxGeometry args={[0.013, 0.009, 0.009]} />
                      <meshStandardMaterial color="#e0ca86" metalness={0.88} roughness={0.22} />
                    </mesh>
                    <mesh position={[0.022, 0, 0]}>
                      <boxGeometry args={[0.013, 0.009, 0.009]} />
                      <meshStandardMaterial color="#e0ca86" metalness={0.88} roughness={0.22} />
                    </mesh>
                  </group>
                );
              })}

              {/* Sliding Twin Chrome Arms & High-Contrast Hazard-Yellow/Crimson T-Handle */}
              <group ref={drainLeverGroupRef} position={[0, 0.095, 0.022]}>
                {[-0.02, 0.02].map((lx, lIdx) => (
                  <mesh
                    key={lIdx}
                    position={[lx, 0, 0.036]}
                    rotation={[Math.PI / 2, 0, 0]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.0075, 0.0085, 0.075, 8]} />
                    <meshStandardMaterial color="#e8f0ec" metalness={0.92} roughness={0.18} />
                  </mesh>
                ))}
                <mesh
                  position={[0, 0, 0.075]}
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow
                >
                  <cylinderGeometry args={[0.022, 0.022, 0.142, 14]} />
                  <meshStandardMaterial
                    color="#ffb000"
                    emissive="#ff9900"
                    emissiveIntensity={0.34}
                    roughness={0.32}
                    metalness={0.22}
                  />
                </mesh>
                {[-0.064, 0.064].map((bx, bIdx) => (
                  <mesh
                    key={bIdx}
                    position={[bx, 0, 0.075]}
                    rotation={[0, 0, Math.PI / 2]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.024, 0.024, 0.016, 14]} />
                    <meshStandardMaterial color="#e0ca86" metalness={0.9} roughness={0.22} />
                  </mesh>
                ))}
                <mesh position={[0, 0, 0.075]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.024, 0.024, 0.042, 14]} />
                  <meshStandardMaterial
                    color="#ff2a2a"
                    emissive="#ff2a2a"
                    emissiveIntensity={0.3}
                    roughness={0.34}
                  />
                </mesh>
              </group>
            </group>

            {/* Right Half: Illuminated Cylindrical Glass Water-Level Sight-Tube (`УРОВЕНЬ ВОДЫ`) */}
            <group position={[0.082, -0.02, 0.03]}>
              {/* Top & Bottom Brass Sight-Glass Shutoff Cocks */}
              {[-0.13, 0.13].map((vy, vIdx) => (
                <mesh key={vIdx} position={[0, vy, 0]} castShadow>
                  <cylinderGeometry args={[0.032, 0.032, 0.026, 12]} />
                  <meshStandardMaterial
                    color="#d8c280"
                    metalness={0.88}
                    roughness={0.22}
                    bumpMap={brassTex.bumpMap}
                    bumpScale={0.005}
                  />
                </mesh>
              ))}
              {/* 4 Protective Chrome Guard Rods around Sight-Glass */}
              {(
                [
                  [-0.024, -0.024],
                  [0.024, -0.024],
                  [-0.024, 0.024],
                  [0.024, 0.024],
                ] as const
              ).map(([gx, gz], gIdx) => (
                <mesh key={gIdx} position={[gx, 0, gz]} castShadow>
                  <cylinderGeometry args={[0.0035, 0.0035, 0.25, 6]} />
                  <meshStandardMaterial color="#e8f0ec" metalness={0.92} roughness={0.18} />
                </mesh>
              ))}
              {/* Outer Transparent Cylindrical Sight-Glass Tube */}
              <mesh>
                <cylinderGeometry args={[0.021, 0.021, 0.24, 16]} />
                <meshStandardMaterial
                  color="#d8f4ff"
                  transparent
                  opacity={0.28}
                  roughness={0.12}
                  metalness={0.2}
                />
              </mesh>
              {/* Inner Glowing Water Column that visibly drains downward when holding the lever */}
              <mesh ref={sightGlassWaterMeshRef} position={[0, -0.05, 0]}>
                <cylinderGeometry args={[0.016, 0.016, 0.23, 14]} />
                <meshStandardMaterial
                  ref={sightGlassWaterMatRef}
                  color="#28d8ff"
                  emissive="#28d8ff"
                  emissiveIntensity={1.25}
                  roughness={0.25}
                />
              </mesh>
            </group>
          </group>
        </group>
      )}
    </group>
  );
};

