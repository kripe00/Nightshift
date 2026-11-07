import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
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

export function createCrispPanelTexture(
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
  lampMatRef?: React.RefObject<THREE.MeshStandardMaterial | null>;
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
  getValue,
}) => {
  const needleGroupRef = useRef<THREE.Group>(null);
  const warningLampRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastDangerRef = useRef<boolean | null>(null);
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

      // Cross-Hatched Crimson Danger Arc
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

      // Fine Minor & Major Tick Marks (50 subdivisions) + Numeric Scale Labels
      for (let i = 0; i <= 50; i++) {
        const ratio = i / 50;
        const ang = Math.PI * 0.75 + ratio * Math.PI * 1.5;
        const isMajor = i % 5 === 0;
        const isMed = i % 5 === 2 || i % 5 === 3;
        const innerR = isMajor ? 156 : isMed ? 172 : 180;
        const outerR = 212;
        ctx.strokeStyle = ratio >= dangerRatio ? "#c81e1e" : "#141414";
        ctx.lineWidth = isMajor ? 5 : 2.2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
        ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
        ctx.stroke();

        if (isMajor && i % 10 === 0) {
          const val = Math.round(min + ratio * (max - min));
          const labelR = 128;
          ctx.fillStyle = ratio >= dangerRatio ? "#c81e1e" : "#141414";
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
  }, [cyrillicSub, dangerThreshold, max, min, serial, title, unit]);

  useFrame(({ clock }) => {
    const rawVal = getValue();
    const state = useGameStore.getState();
    const totalMW =
      state.powerAllocation.cooling +
      state.powerAllocation.defense +
      state.powerAllocation.facility;
    const isRedline = totalMW > state.maxSafePower;

    const ratio = THREE.MathUtils.clamp((rawVal - min) / (max - min), 0, 1);
    const jitter =
      Math.sin(clock.getElapsedTime() * 18 + position[0] * 5) *
      (isRedline || rawVal >= dangerThreshold ? 0.038 : 0.009);

    const targetRotZ = 2.35 - ratio * 4.7 + jitter;
    if (needleGroupRef.current) {
      needleGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        needleGroupRef.current.rotation.z,
        targetRotZ,
        0.18,
      );
    }

    const isDanger = rawVal >= dangerThreshold;
    if (warningLampRef.current && isDanger !== lastDangerRef.current) {
      lastDangerRef.current = isDanger;
      warningLampRef.current.color.set(isDanger ? "#ff2a2a" : "#33ff66");
      warningLampRef.current.emissive.set(isDanger ? "#ff2a2a" : "#33ff66");
      warningLampRef.current.emissiveIntensity = isDanger ? 2.0 : 0.65;
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

      {/* 3. Inner Brushed-Brass Bevel Ring & Recessed Shadow Cavity */}
      <mesh
        position={[0, 0, 0.044]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.178, 0.188, 0.018, 24]} />
        <meshStandardMaterial
          color="#8c7a4b"
          metalness={0.86}
          roughness={0.26}
          bumpMap={brassTex.bumpMap}
          bumpScale={0.005}
          roughnessMap={brassTex.roughnessMap}
        />
      </mesh>
      <mesh position={[0, 0, 0.047]}>
        <ringGeometry args={[0.158, 0.176, 24]} />
        <meshBasicMaterial color="#090c0a" />
      </mesh>

      {/* 4. Crisp 512x512 Manometer Dial Face */}
      <mesh position={[0, 0, 0.048]}>
        <circleGeometry args={[0.168, 24]} />
        <meshStandardMaterial
          map={dialTexture}
          roughness={0.78}
          metalness={0.06}
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
            emissiveIntensity={0.28}
            roughness={0.35}
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

      {/* 7. Domed Glass Cover & Specular Highlight Strip */}
      <mesh position={[0, 0, 0.063]}>
        <circleGeometry args={[0.17, 24]} />
        <meshStandardMaterial
          color="#d8f0e2"
          transparent
          opacity={0.14}
          roughness={0.12}
          metalness={0.25}
        />
      </mesh>
      <mesh position={[-0.045, 0.045, 0.064]} rotation={[0, 0, 0.65]}>
        <planeGeometry args={[0.18, 0.022]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.09} />
      </mesh>

      {/* 8. Caged Soviet Jewel Indicator Lamp Above Dial */}
      <CagedSovietJewelLamp3D
        position={[0, 0.232, 0.032]}
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
  const lastPumpOnRef = useRef<boolean | null>(null);
  const ironTex = useMemo(() => getHammeredIronTextures(), []);
  const brassTex = useMemo(() => getBrushedBrassTextures(), []);

  const dragRef = useRef<{
    active: boolean;
    startClientY: number;
    startProgress: number;
    currentProgress: number;
    lastBucket: number;
  }>({
    active: false,
    startClientY: 0,
    startProgress: 0,
    currentProgress: 0,
    lastBucket: 0,
  });

  const nameplateTex = useMemo(() => {
    return createCrispPanelTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = "#141816";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#b8a46b";
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 24px "Kremlin", monospace';
      ctx.textAlign = "center";
      ctx.fillText(label, w / 2, 30);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 16px "Courier Prime", monospace';
      ctx.fillText(
        pumpIndex === 0 ? "НАСОС А • КОНТУР №1" : "НАСОС Б • КОНТУР №2",
        w / 2,
        52,
      );
    });
  }, [label, pumpIndex]);

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    const isPumpOn = state.pumpsActive[pumpIndex] && !state.isBlackout;

    if (wheelRef.current && isPumpOn) {
      wheelRef.current.rotation.z -= delta * 2.2;
    }

    if (leverArmRef.current) {
      const targetProgress = dragRef.current.active
        ? dragRef.current.currentProgress
        : state.pumpsActive[pumpIndex]
          ? 0
          : 1;
      const targetAngleX = -0.58 + targetProgress * 1.16;
      leverArmRef.current.rotation.x = THREE.MathUtils.lerp(
        leverArmRef.current.rotation.x,
        targetAngleX,
        0.25,
      );
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
    const isOn = useGameStore.getState().pumpsActive[pumpIndex];
    const startProg = isOn ? 0 : 1;
    dragRef.current = {
      active: true,
      startClientY: e.nativeEvent.clientY,
      startProgress: startProg,
      currentProgress: startProg,
      lastBucket: Math.round(startProg * 6),
    };
    captureCanvasPointer(e);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current.active) return;
    e.stopPropagation();
    const deltaY = e.nativeEvent.clientY - dragRef.current.startClientY;
    const nextProg = THREE.MathUtils.clamp(
      dragRef.current.startProgress + deltaY / 80,
      0,
      1,
    );
    dragRef.current.currentProgress = nextProg;
    const bucket = Math.round(nextProg * 6);
    if (bucket !== dragRef.current.lastBucket) {
      dragRef.current.lastBucket = bucket;
      playLeverRatchet(0.85 + (1 - nextProg) * 0.35);
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current.active) return;
    e.stopPropagation();
    dragRef.current.active = false;
    releaseCanvasPointer(e);
    const dist = Math.abs(
      dragRef.current.currentProgress - dragRef.current.startProgress,
    );
    if (dist >= 0.45) {
      playSwitchClank(true);
      useGameStore.getState().togglePump(pumpIndex);
    } else {
      playLeverRatchet(0.6);
    }
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

      {/* Caged Soviet Jewel Lamp */}
      <CagedSovietJewelLamp3D
        position={[-0.118, 0.096, 0.038]}
        lampMatRef={lampMatRef}
        scale={0.88}
      />

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
      ctx.fillText("ШИНА МВТ // 0–80 MW", w / 2, 52);
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
      playLeverRatchet(0.8 + (snappedMW / 80) * 0.5);
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
  const shiftClutchArmRef = useRef<THREE.Group>(null);
  const redlineScaleBlockRefs = useRef<
    Array<THREE.MeshStandardMaterial | null>
  >([]);
  const statusMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const ironTex = useMemo(() => getHammeredIronTextures(), []);

  const clutchDragRef = useRef<{
    active: boolean;
    startY: number;
    startEngaged: boolean;
    progress: number;
  }>({ active: false, startY: 0, startEngaged: false, progress: 0 });

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
        ctx.fillText("ПУЛЬТ УПРАВЛЕНИЯ РЕАКТОРОМ // UNIT A", w / 2, 30);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 17px "VT323", monospace';
        ctx.fillText(
          "АКТИВНАЯ ЗОНА №4 • НАСОСЫ КОНТУРА • РАСПРЕДЕЛЕНИЕ МВТ",
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
        ctx.font = 'bold 16px "Courier Prime", monospace';
        ctx.fillText("АВАРИЙНАЯ ЗАЩИТА АЗ-5", w / 2, 52);
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
        ctx.font = 'bold 30px "Courier Prime", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("АЗ-5", cx, cy - 10);
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
        ctx.font = 'bold 15px "Courier Prime", monospace';
        ctx.fillText("МУФТА СЦЕПЛЕНИЯ МВТ", w / 2, 52);
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

  useFrame(() => {
    const state = useGameStore.getState();
    const totalMW =
      state.powerAllocation.cooling +
      state.powerAllocation.defense +
      state.powerAllocation.facility;

    if (az5CoverGroupRef.current) {
      const targetRotX = az5CoverOpen ? -1.95 : 0;
      az5CoverGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        az5CoverGroupRef.current.rotation.x,
        targetRotX,
        0.22,
      );
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

    const sig = `${Math.round(state.coreTemp)}|${state.pressureBar}|${state.radiationLevel}|${totalMW}|${Math.round(state.redlineInstability)}|${state.isShiftKeyHeld}|${state.az5Cooldown}|${state.isBlackout}`;
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
            label: "ТЕМПЕРАТУРА ЗОНЫ",
            val: `${Math.round(state.coreTemp)} °C`,
            danger: state.coreTemp >= 750,
          },
          {
            label: "ДАВЛЕНИЕ КОНТУРА",
            val: `${state.pressureBar.toFixed(0)} BAR`,
            danger: state.pressureBar >= 90,
          },
          {
            label: "ДОЗИМЕТР СЕКТОРА",
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
          `НАГРУЗКА: ${totalMW}/100 МВТ (${totalMW > 100 ? "КРАСНАЯ ЗОНА!" : "НОРМА"}) | НЕСТАБ: ${Math.round(state.redlineInstability)}%`,
          22,
          110,
        );

        ctx.fillStyle = state.isShiftKeyHeld ? "#33ff66" : "#e6dec3";
        ctx.font = 'bold 17px "Kremlin", monospace';
        ctx.fillText(
          state.isShiftKeyHeld
            ? "● [SHIFT] СЦЕПЛЕНИЕ ВКЛЮЧЕНО — ТЯНИ РЫЧАГИ МВТ"
            : "○ ЗАЖМИ [SHIFT] ИЛИ ТЯНИ МУФТУ СЛЕВА ДЛЯ РАЗБЛОКИРОВКИ",
          22,
          134,
        );
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

      {/* Top Raised Engraved Brass Header Plaque */}
      <mesh position={[0, 2.18, 0.035]}>
        <planeGeometry args={[1.48, 0.14]} />
        <meshStandardMaterial
          map={topHeaderPlateTex}
          emissive="#ffffff"
          emissiveMap={topHeaderPlateTex}
          emissiveIntensity={0.32}
          roughness={0.65}
        />
      </mesh>

      {/* 2. Top Row: 3 High-Res 16-Part Bolted Soviet Manometer Gauges */}
      <group position={[0, 1.88, 0.03]}>
        <HighDetailManometer3D
          position={[-0.51, 0.02, 0]}
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
          position={[0, 0.02, 0]}
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
          position={[0.51, 0.02, 0]}
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
      <group position={[0, 1.47, 0.03]}>
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
        {/* Deep Recessed VFD Canvas Plane */}
        <mesh position={[0, 0, 0.023]}>
          <planeGeometry args={[1.46, 0.22]} />
          <meshStandardMaterial
            ref={statusMatRef}
            map={statusTexture}
            color="#ffffff"
            emissive="#ffffff"
            emissiveMap={statusTexture}
            emissiveIntensity={0.75}
            roughness={0.6}
          />
        </mesh>
        {/* Dark-Green Anti-Glare Glass Filter Cover */}
        <mesh position={[0, 0, 0.026]}>
          <planeGeometry args={[1.46, 0.22]} />
          <meshStandardMaterial
            color="#163824"
            transparent
            opacity={0.14}
            roughness={0.12}
            metalness={0.25}
          />
        </mesh>
      </group>

      {/* 4. Middle Row: 2 Sculpted Cast-Iron Pump Valves + Multi-Part Hinged AZ-5 Safety Cage */}
      <group position={[0, 0.99, 0.03]}>
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
        <group position={[0.52, -0.01, 0.02]}>
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
                playSwitchClank(false);
                setAz5CoverOpen(true);
                return;
              }
              const s = useGameStore.getState();
              if (s.az5Available && s.az5Cooldown === 0) {
                playSwitchClank(true);
                playKlaxonBurst();
                s.triggerAz5();
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
              playSwitchClank(false);
              setAz5CoverOpen((prev) => !prev);
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
            {/* Brass Bottom Lift-Tab Handle */}
            <mesh position={[0, -0.206, 0.068]} castShadow>
              <boxGeometry args={[0.095, 0.016, 0.028]} />
              <meshStandardMaterial
                color="#b8a46b"
                metalness={0.88}
                roughness={0.24}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* 5. Bottom Row: Toothed [SHIFT] Clutch Lever + 3 Industrial 10-Segment Power Columns + 18-Segment Redline Bar */}
      <group position={[0, 0.45, 0.04]}>
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

  const handleBreakerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!breakerDragRef.current.active) return;
    e.stopPropagation();
    breakerDragRef.current.active = false;
    releaseCanvasPointer(e);
    const s = useGameStore.getState();
    playSwitchClank(true);
    startSoundtrack();
    updateSoundtrackState(false, s.isMusicMuted);
    if (s.phase === "boot") {
      s.startShift();
    } else if (s.phase !== "playing") {
      s.resetShift();
    }
  };

  return (
    <group
      position={[0.42, 0, 0.02]}
      onPointerDown={(e) => {
        if (useCameraLookStore.getState().isFreeLookMode) return;
        e.stopPropagation();
        breakerDragRef.current = {
          active: true,
          startY: e.nativeEvent.clientY,
          progress: useGameStore.getState().phase === "playing" ? 1 : 0,
        };
        captureCanvasPointer(e);
      }}
      onPointerMove={(e) => {
        if (!breakerDragRef.current.active) return;
        e.stopPropagation();
        const dy = e.nativeEvent.clientY - breakerDragRef.current.startY;
        breakerDragRef.current.progress = THREE.MathUtils.clamp(
          dy / 70,
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
