import { type ThreeEvent, useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { SystemType } from "../../shared/types";
import { useGameStore } from "../../shared/useGameStore";
import {
  playGeigerClick,
  playKlaxonBurst,
  playLeverRatchet,
  playSwitchClank,
} from "./audioSynth";
import { updateSoundtrackState } from "./soundtrackPlayer";

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

interface CylindricalGauge3DProps {
  position: [number, number, number];
  title: string;
  unit: string;
  min: number;
  max: number;
  dangerThreshold: number;
  getValue: () => number;
}

const CylindricalGauge3D: React.FC<CylindricalGauge3DProps> = ({
  position,
  title,
  unit,
  min,
  max,
  dangerThreshold,
  getValue,
}) => {
  const needleGroupRef = useRef<THREE.Group>(null);
  const warningLampRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastDangerRef = useRef<boolean | null>(null);

  const dialTexture = useMemo(() => {
    return createPixelTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = "#e6dec3";
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 58, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 5;
      ctx.stroke();

      const dangerStartRatio = (dangerThreshold - min) / (max - min);
      const startAngle = Math.PI * 0.75 + dangerStartRatio * Math.PI * 1.5;
      const endAngle = Math.PI * 2.25;
      ctx.strokeStyle = "#ff2a2a";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 48, startAngle, endAngle);
      ctx.stroke();

      for (let i = 0; i <= 10; i++) {
        const ratio = i / 10;
        const ang = Math.PI * 0.75 + ratio * Math.PI * 1.5;
        const innerR = i % 2 === 0 ? 38 : 43;
        const outerR = 52;
        ctx.strokeStyle = ratio >= dangerStartRatio ? "#ff2a2a" : "#141414";
        ctx.lineWidth = i % 2 === 0 ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(
          w / 2 + Math.cos(ang) * innerR,
          h / 2 + Math.sin(ang) * innerR,
        );
        ctx.lineTo(
          w / 2 + Math.cos(ang) * outerR,
          h / 2 + Math.sin(ang) * outerR,
        );
        ctx.stroke();
      }

      ctx.fillStyle = "#141414";
      ctx.font = 'bold 13px "Kremlin", monospace';
      ctx.textAlign = "center";
      ctx.fillText(title, w / 2, 44);

      ctx.fillStyle = "#23312b";
      ctx.font = 'bold 14px "VT323", monospace';
      ctx.fillText(unit, w / 2, 98);
    });
  }, [dangerThreshold, max, min, title, unit]);

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
      (isRedline || rawVal >= dangerThreshold ? 0.04 : 0.01);

    const targetRotZ = 2.1 - ratio * 4.2 + jitter;
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
      warningLampRef.current.emissiveIntensity = isDanger ? 1.8 : 0.45;
    }
  });

  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.19, 0.205, 0.09, 14]} />
        <meshStandardMaterial
          color="#141414"
          roughness={0.65}
          metalness={0.55}
        />
      </mesh>

      <mesh position={[0, 0, 0.047]}>
        <circleGeometry args={[0.168, 16]} />
        <meshStandardMaterial
          map={dialTexture}
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>

      <group ref={needleGroupRef} position={[0, 0, 0.055]}>
        <mesh position={[0, 0.052, 0]}>
          <boxGeometry args={[0.014, 0.125, 0.008]} />
          <meshStandardMaterial
            color="#ff2a2a"
            emissive="#ff2a2a"
            emissiveIntensity={0.25}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.018, 10]} />
          <meshStandardMaterial
            color="#b8a46b"
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
      </group>

      <mesh position={[0, 0.22, 0.03]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial
          ref={warningLampRef}
          color="#33ff66"
          emissive="#33ff66"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};

interface PumpValveAndLever3DProps {
  position: [number, number, number];
  pumpIndex: 0 | 1;
  label: string;
}

const PumpValveAndLever3D: React.FC<PumpValveAndLever3DProps> = ({
  position,
  pumpIndex,
  label,
}) => {
  const wheelRef = useRef<THREE.Group>(null);
  const leverArmRef = useRef<THREE.Group>(null);
  const lampMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastPumpOnRef = useRef<boolean | null>(null);

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
    return createPixelTexture(128, 36, (ctx, w, h) => {
      ctx.fillStyle = "#141414";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#364940";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#e6dec3";
      ctx.font = 'bold 15px "Kremlin", monospace';
      ctx.textAlign = "center";
      ctx.fillText(label, w / 2, 23);
    });
  }, [label]);

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    const isPumpOn = state.pumpsActive[pumpIndex] && !state.isBlackout;

    if (wheelRef.current && isPumpOn) {
      wheelRef.current.rotation.z -= delta * 2.0;
    }

    if (leverArmRef.current) {
      const targetProgress = dragRef.current.active
        ? dragRef.current.currentProgress
        : state.pumpsActive[pumpIndex]
          ? 0
          : 1;
      const targetAngleX = -0.55 + targetProgress * 1.1;
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
      lampMatRef.current.emissiveIntensity = isPumpOn ? 1.2 : 0.7;
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
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
      {/* Nameplate positioned cleanly below the digital telemetry readout */}
      <mesh position={[0, 0.165, 0.03]}>
        <planeGeometry args={[0.28, 0.072]} />
        <meshStandardMaterial map={nameplateTex} roughness={0.7} />
      </mesh>

      <mesh position={[-0.11, 0.095, 0.04]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial
          ref={lampMatRef}
          color="#33ff66"
          emissive="#33ff66"
          emissiveIntensity={1}
        />
      </mesh>

      <group position={[-0.07, -0.025, 0.04]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.09, 10]} />
          <meshStandardMaterial
            color="#364940"
            roughness={0.6}
            metalness={0.6}
          />
        </mesh>
        <group
          ref={wheelRef}
          position={[0, 0, 0.055]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        >
          <mesh>
            <torusGeometry args={[0.058, 0.012, 8, 14]} />
            <meshStandardMaterial
              color="#8b1e1e"
              roughness={0.5}
              metalness={0.4}
            />
          </mesh>
          <mesh>
            <boxGeometry args={[0.11, 0.012, 0.012]} />
            <meshStandardMaterial
              color="#8b1e1e"
              roughness={0.5}
              metalness={0.4}
            />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.11, 0.012, 0.012]} />
            <meshStandardMaterial
              color="#8b1e1e"
              roughness={0.5}
              metalness={0.4}
            />
          </mesh>
        </group>
      </group>

      <group
        position={[0.08, -0.025, 0.035]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        <mesh>
          <boxGeometry args={[0.075, 0.21, 0.035]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.85}
            metalness={0.3}
          />
        </mesh>
        <group ref={leverArmRef} position={[0, 0, 0.02]}>
          <mesh position={[0, 0, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.11, 8]} />
            <meshStandardMaterial
              color="#b8a46b"
              roughness={0.35}
              metalness={0.8}
            />
          </mesh>
          <mesh position={[0, 0, 0.11]}>
            <boxGeometry args={[0.095, 0.036, 0.036]} />
            <meshStandardMaterial
              color="#141414"
              roughness={0.5}
              metalness={0.2}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

interface PowerColumn3DProps {
  position: [number, number, number];
  system: SystemType;
  label: string;
  minusBtnTex: THREE.CanvasTexture;
  plusBtnTex: THREE.CanvasTexture;
}

const PowerColumn3D: React.FC<PowerColumn3DProps> = ({
  position,
  system,
  label,
  minusBtnTex,
  plusBtnTex,
}) => {
  const blockMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const leverGroupRef = useRef<THREE.Group>(null);
  const lastBlockStateRef = useRef("");

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
    return createPixelTexture(128, 36, (ctx, w, h) => {
      ctx.fillStyle = "#141414";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#364940";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = "#ffb000";
      ctx.font = 'bold 15px "Kremlin", monospace';
      ctx.textAlign = "center";
      ctx.fillText(label, w / 2, 23);
    });
  }, [label]);

  useFrame(() => {
    const state = useGameStore.getState();
    const currentMW = state.powerAllocation[system];
    const activeBlocks = Math.round(currentMW / 10);
    const sig = `${activeBlocks}|${state.isBlackout}`;

    // Only update material colors when MW allocation or blackout changes!
    if (sig !== lastBlockStateRef.current) {
      lastBlockStateRef.current = sig;
      for (let i = 0; i < 8; i++) {
        const mat = blockMatRefs.current[i];
        if (!mat) continue;
        const isLit = !state.isBlackout && i < activeBlocks;
        const colorHex = i >= 6 ? "#ff2a2a" : i >= 4 ? "#ffb000" : "#33ff66";
        mat.color.set(isLit ? colorHex : "#141b17");
        mat.emissive.set(isLit ? colorHex : "#000000");
        mat.emissiveIntensity = isLit ? 1.35 : 0;
      }
    }

    if (leverGroupRef.current) {
      const ratio = THREE.MathUtils.clamp(currentMW / 80, 0, 1);
      const targetY = -0.14 + ratio * 0.28;
      leverGroupRef.current.position.y = THREE.MathUtils.lerp(
        leverGroupRef.current.position.y,
        targetY,
        0.25,
      );
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
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
      <mesh position={[0, 0.23, 0.03]}>
        <planeGeometry args={[0.3, 0.07]} />
        <meshStandardMaterial map={labelTex} roughness={0.7} />
      </mesh>

      <group position={[-0.055, 0, 0.035]}>
        {Array.from({ length: 8 }).map((_, idx) => (
          <mesh key={idx} position={[0, -0.14 + idx * 0.04, 0]}>
            <boxGeometry args={[0.11, 0.028, 0.028]} />
            <meshStandardMaterial
              ref={(el) => {
                blockMatRefs.current[idx] = el;
              }}
              color="#141b17"
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>

      <group
        position={[0.065, 0, 0.035]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        <mesh>
          <boxGeometry args={[0.06, 0.33, 0.03]} />
          <meshStandardMaterial
            color="#141414"
            roughness={0.85}
            metalness={0.3}
          />
        </mesh>
        <group ref={leverGroupRef} position={[0, 0, 0.035]}>
          <mesh>
            <boxGeometry args={[0.088, 0.042, 0.048]} />
            <meshStandardMaterial
              color="#ffb000"
              roughness={0.45}
              metalness={0.35}
            />
          </mesh>
        </group>
      </group>

      {/* Labeled -10 / +10 MW Step Plungers */}
      <group
        position={[-0.055, -0.21, 0.038]}
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
        <mesh>
          <boxGeometry args={[0.058, 0.038, 0.03]} />
          <meshStandardMaterial color="#141414" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <planeGeometry args={[0.054, 0.034]} />
          <meshStandardMaterial map={minusBtnTex} roughness={0.7} />
        </mesh>
      </group>

      <group
        position={[0.015, -0.21, 0.038]}
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
        <mesh>
          <boxGeometry args={[0.058, 0.038, 0.03]} />
          <meshStandardMaterial color="#23312b" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <planeGeometry args={[0.054, 0.034]} />
          <meshStandardMaterial map={plusBtnTex} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
};

export const ReactorStation3D: React.FC = () => {
  const [az5CoverOpen, setAz5CoverOpen] = useState(false);
  const az5CoverGroupRef = useRef<THREE.Group>(null);
  const shiftClutchArmRef = useRef<THREE.Group>(null);
  const redlineScaleBlockRefs = useRef<
    Array<THREE.MeshStandardMaterial | null>
  >([]);
  const statusMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const clutchDragRef = useRef<{
    active: boolean;
    startY: number;
    startEngaged: boolean;
    progress: number;
  }>({ active: false, startY: 0, startEngaged: false, progress: 0 });

  const statusTexture = useMemo(() => createPixelTexture(512, 96), []);
  const lastTotalBlocksSigRef = useRef("");

  const az5PlateTex = useMemo(
    () =>
      createPixelTexture(128, 36, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ff2a2a";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ff2a2a";
        ctx.font = 'bold 15px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("AZ-5 SCRAM", w / 2, 23);
      }),
    [],
  );

  const clutchPlateTex = useMemo(
    () =>
      createPixelTexture(128, 36, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 14px "Kremlin", monospace';
        ctx.textAlign = "center";
        ctx.fillText("[SHIFT] CLUTCH", w / 2, 23);
      }),
    [],
  );

  const minusBtnTex = useMemo(
    () =>
      createPixelTexture(64, 40, (ctx, w, h) => {
        ctx.fillStyle = "#141414";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#ffb000";
        ctx.font = 'bold 20px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("-10", w / 2, 27);
      }),
    [],
  );

  const plusBtnTex = useMemo(
    () =>
      createPixelTexture(64, 40, (ctx, w, h) => {
        ctx.fillStyle = "#23312b";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#33ff66";
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, w - 4, h - 4);
        ctx.fillStyle = "#33ff66";
        ctx.font = 'bold 20px "VT323", monospace';
        ctx.textAlign = "center";
        ctx.fillText("+10", w / 2, 27);
      }),
    [],
  );

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
      const targetRotX = az5CoverOpen ? -1.9 : 0;
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
      const targetAngle = -0.48 + p * 1.06;
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
        mat.emissiveIntensity = isLit ? (isRedlineBlock ? 1.8 : 1.1) : 0;
      }
    }

    const sig = `${Math.round(state.coreTemp)}|${state.pressureBar}|${state.radiationLevel}|${totalMW}|${Math.round(state.redlineInstability)}|${state.isShiftKeyHeld}|${state.az5Cooldown}|${state.isBlackout}`;
    const tex = statusMatRef.current?.map as THREE.CanvasTexture | undefined;
    if (tex && tex.userData.lastSig !== sig) {
      tex.userData.lastSig = sig;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#061a0c";
        ctx.fillRect(0, 0, 512, 96);
        ctx.strokeStyle = "#364940";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 508, 92);

        ctx.fillStyle = state.coreTemp >= 750 ? "#ff2a2a" : "#33ff66";
        ctx.font = 'bold 24px "VT323", monospace';
        ctx.fillText(
          `TEMP: ${Math.round(state.coreTemp)}C | PRESS: ${state.pressureBar} BAR | RAD: ${state.radiationLevel} R/H`,
          14,
          34,
        );

        ctx.fillStyle = totalMW > 100 ? "#ff2a2a" : "#ffb000";
        ctx.fillText(
          `LOAD: ${totalMW}/100 MW (${totalMW > 100 ? "REDLINE OVERCLOCK!" : "SAFE"}) | INSTAB: ${Math.round(state.redlineInstability)}%`,
          14,
          62,
        );

        ctx.fillStyle = state.isShiftKeyHeld ? "#33ff66" : "#e6dec3";
        ctx.font = 'bold 15px "Kremlin", monospace';
        ctx.fillText(
          state.isShiftKeyHeld
            ? "[SHIFT] CLUTCH ENGAGED — DRAG 3D LEVERS TO ROUTE MW"
            : "HOLD [SHIFT] OR DRAG CLUTCH LEVER TO UNLOCK POWER",
          14,
          86,
        );
        tex.needsUpdate = true;
      }
    }
  });

  return (
    <group position={[-2.15, 0, -1.08]} rotation={[0, 0.42, 0]}>
      <mesh position={[0, 1.12, -0.18]}>
        <boxGeometry args={[1.66, 2.24, 0.42]} />
        <meshStandardMaterial
          color="#23312b"
          roughness={0.7}
          metalness={0.45}
        />
      </mesh>
      <mesh position={[0, 1.12, -0.22]}>
        <boxGeometry args={[1.74, 2.32, 0.36]} />
        <meshStandardMaterial
          color="#141414"
          roughness={0.85}
          metalness={0.3}
        />
      </mesh>

      {/* Digital Telemetry Strip positioned at y=1.48 so it never overlaps pump nameplates */}
      <mesh position={[0, 1.48, 0.04]}>
        <planeGeometry args={[1.48, 0.23]} />
        <meshStandardMaterial
          ref={statusMatRef}
          map={statusTexture}
          color="#ffffff"
          emissive="#ffffff"
          emissiveMap={statusTexture}
          emissiveIntensity={0.65}
          roughness={0.85}
        />
      </mesh>

      <group position={[0, 1.89, 0.03]}>
        <CylindricalGauge3D
          position={[-0.5, 0.05, 0]}
          title="CORE TEMP"
          unit="0-1000 C"
          min={250}
          max={1000}
          dangerThreshold={750}
          getValue={() => useGameStore.getState().coreTemp}
        />
        <CylindricalGauge3D
          position={[0, 0.05, 0]}
          title="PRESSURE"
          unit="0-120 BAR"
          min={30}
          max={120}
          dangerThreshold={90}
          getValue={() => useGameStore.getState().pressureBar}
        />
        <CylindricalGauge3D
          position={[0.5, 0.05, 0]}
          title="DOSIMETER"
          unit="0-15 R/H"
          min={0}
          max={15}
          dangerThreshold={7.5}
          getValue={() => useGameStore.getState().radiationLevel}
        />
      </group>

      <group position={[0, 0.99, 0.03]}>
        <PumpValveAndLever3D
          position={[-0.52, 0, 0]}
          pumpIndex={0}
          label="COOLING PUMP A"
        />
        <PumpValveAndLever3D
          position={[0, 0, 0]}
          pumpIndex={1}
          label="COOLING PUMP B"
        />

        <group position={[0.52, -0.01, 0.02]}>
          <mesh position={[0, 0.175, 0.01]}>
            <planeGeometry args={[0.28, 0.072]} />
            <meshStandardMaterial map={az5PlateTex} roughness={0.7} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.25, 0.24, 0.04]} />
            <meshStandardMaterial
              color="#ffb000"
              roughness={0.6}
              metalness={0.3}
            />
          </mesh>
          <mesh position={[0, 0, 0.005]}>
            <boxGeometry args={[0.21, 0.2, 0.042]} />
            <meshStandardMaterial color="#141414" roughness={0.8} />
          </mesh>

          <mesh
            position={[0, 0, 0.045]}
            rotation={[Math.PI / 2, 0, 0]}
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
            <cylinderGeometry args={[0.068, 0.075, 0.055, 12]} />
            <meshStandardMaterial
              color="#ff2a2a"
              emissive="#ff2a2a"
              emissiveIntensity={az5CoverOpen ? 0.9 : 0.25}
              roughness={0.35}
            />
          </mesh>

          <group
            ref={az5CoverGroupRef}
            position={[0, 0.1, 0.03]}
            onClick={(e) => {
              e.stopPropagation();
              playSwitchClank(false);
              setAz5CoverOpen((prev) => !prev);
            }}
          >
            <mesh position={[0, -0.1, 0.035]}>
              <boxGeometry args={[0.2, 0.2, 0.07]} />
              <meshStandardMaterial
                color="#ff2a2a"
                transparent
                opacity={0.52}
                roughness={0.2}
              />
            </mesh>
          </group>
        </group>
      </group>

      <group position={[0, 0.45, 0.04]}>
        {/* 3D [SHIFT] Clutch Lever (Supports holding keyboard [SHIFT] OR dragging the 3D lever down) */}
        <group
          position={[-0.56, 0.02, 0.02]}
          onPointerDown={(e) => {
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
          <mesh position={[0, 0.23, 0.01]}>
            <planeGeometry args={[0.28, 0.07]} />
            <meshStandardMaterial map={clutchPlateTex} roughness={0.7} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.22, 0.34, 0.06]} />
            <meshStandardMaterial
              color="#141414"
              roughness={0.8}
              metalness={0.5}
            />
          </mesh>
          <group ref={shiftClutchArmRef} position={[0, 0, 0.03]}>
            <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.16, 10]} />
              <meshStandardMaterial
                color="#b8a46b"
                roughness={0.3}
                metalness={0.85}
              />
            </mesh>
            <mesh position={[0, 0, 0.16]}>
              <boxGeometry args={[0.16, 0.055, 0.055]} />
              <meshStandardMaterial
                color="#ffb000"
                roughness={0.45}
                metalness={0.25}
              />
            </mesh>
          </group>
        </group>

        <PowerColumn3D
          position={[-0.18, 0.02, 0]}
          system="cooling"
          label="1. COOLING"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <PowerColumn3D
          position={[0.18, 0.02, 0]}
          system="defense"
          label="2. DEFENSE"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />
        <PowerColumn3D
          position={[0.54, 0.02, 0]}
          system="facility"
          label="3. FACILITY"
          minusBtnTex={minusBtnTex}
          plusBtnTex={plusBtnTex}
        />

        <group position={[0, -0.27, 0.03]}>
          <mesh position={[0, 0, -0.01]}>
            <boxGeometry args={[1.46, 0.075, 0.02]} />
            <meshStandardMaterial color="#141414" roughness={0.85} />
          </mesh>
          {Array.from({ length: 18 }).map((_, idx) => (
            <mesh key={idx} position={[-0.64 + idx * 0.075, 0, 0.01]}>
              <boxGeometry args={[0.056, 0.042, 0.024]} />
              <meshStandardMaterial
                ref={(el) => {
                  redlineScaleBlockRefs.current[idx] = el;
                }}
                color="#141b17"
                roughness={0.35}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
};
