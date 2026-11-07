import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { create } from "zustand";
import type { CameraStation } from "./types";
import { useGameStore } from "./useGameStore";

interface CameraLookState {
  isFreeLookMode: boolean;
  setFreeLookMode: (val: boolean) => void;
}

export const useCameraLookStore = create<CameraLookState>((set) => ({ // oxlint-disable-line react/only-export-components
  isFreeLookMode: false,
  setFreeLookMode: (val: boolean) => set({ isFreeLookMode: val }),
}));

interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

const STATION_CAMERA_POSES: Record<CameraStation, CameraPose> = {
  overview: {
    position: [0, 1.52, 2.42],
    target: [0, 1.24, 0.56],
    fov: 56,
  },
  reactor: {
    position: [0.22, 1.32, 2.35],
    target: [-1.96, 1.24, 2.48],
    fov: 58,
  },
  power: {
    position: [-0.08, 0.86, 2.35],
    target: [-1.96, 0.64, 2.35],
    fov: 54,
  },
  terminal: {
    position: [0, 1.48, 1.92],
    target: [0, 1.38, 0.56],
    fov: 47,
  },
  inspector: {
    position: [0, 1.66, 1.92],
    target: [0, 0.76, 1.54],
    fov: 56,
  },
  aux: {
    position: [-0.22, 1.32, 2.35],
    target: [1.96, 1.24, 2.35],
    fov: 58,
  },
};

const MOUSE_SENSITIVITY = 0.0024;
const MIN_PITCH = -Math.PI / 2.08; // Looking steeply down at the inspection desk mat
const MAX_PITCH = Math.PI / 2.6; // Looking up at the ceiling/banner

function computePoseYawPitch(pose: CameraPose): { yaw: number; pitch: number } {
  const dx = pose.target[0] - pose.position[0];
  const dy = pose.target[1] - pose.position[1];
  const dz = pose.target[2] - pose.position[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const ny = THREE.MathUtils.clamp(dy / len, -1, 1);
  const pitch = Math.asin(ny);
  const yaw = Math.atan2(-dx / len, -dz / len);
  return {
    yaw,
    pitch: THREE.MathUtils.clamp(pitch, MIN_PITCH, MAX_PITCH),
  };
}

function setShortestTargetYaw(
  currentYaw: number,
  desiredYaw: number,
): number {
  const delta = Math.atan2(
    Math.sin(desiredYaw - currentYaw),
    Math.cos(desiredYaw - currentYaw),
  );
  return currentYaw + delta;
}

export const CameraController: React.FC = () => {
  const { gl } = useThree();
  const activeStation = useGameStore((s) => s.activeStation);
  const setActiveStation = useGameStore((s) => s.setActiveStation);

  const initialAngles = computePoseYawPitch(STATION_CAMERA_POSES.overview);
  const currentPosRef = useRef(new THREE.Vector3(0, 1.52, 2.42));
  const desiredPosRef = useRef(new THREE.Vector3(0, 1.52, 2.42));

  const lookStateRef = useRef({
    targetYaw: initialAngles.yaw,
    targetPitch: initialAngles.pitch,
    currentYaw: initialAngles.yaw,
    currentPitch: initialAngles.pitch,
    keysHeld: {
      left: false,
      right: false,
      up: false,
      down: false,
    },
  });

  // Sync base yaw & pitch whenever activeStation changes via [0]-[5] or 3D station buttons
  useEffect(() => {
    const pose = STATION_CAMERA_POSES[activeStation];
    const { yaw, pitch } = computePoseYawPitch(pose);
    lookStateRef.current.targetYaw = setShortestTargetYaw(
      lookStateRef.current.currentYaw,
      yaw,
    );
    lookStateRef.current.targetPitch = pitch;
  }, [activeStation]);

  useEffect(() => {
    const isTypingInInput = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable
      );
    };

    const syncStationPose = (station: CameraStation) => {
      const pose = STATION_CAMERA_POSES[station];
      const { yaw, pitch } = computePoseYawPitch(pose);
      lookStateRef.current.targetYaw = setShortestTargetYaw(
        lookStateRef.current.currentYaw,
        yaw,
      );
      lookStateRef.current.targetPitch = pitch;
      setActiveStation(station);
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === gl.domElement;
      useCameraLookStore.getState().setFreeLookMode(locked);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;

      // 1. Left Control (`ControlLeft`) Mode Toggle: Cursor Mode vs. Free-Look Mode
      if (e.code === "ControlLeft") {
        if (e.repeat) return;
        e.preventDefault();
        const currentlyLocked =
          document.pointerLockElement === gl.domElement ||
          useCameraLookStore.getState().isFreeLookMode;
        if (currentlyLocked) {
          if (document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          useCameraLookStore.getState().setFreeLookMode(false);
        } else {
          useCameraLookStore.getState().setFreeLookMode(true);
          try {
            const req = gl.domElement.requestPointerLock?.() as
              | Promise<void>
              | undefined;
            req?.catch?.(() => {
              // Keep logical Free-Look Mode active even if browser blocks raw pointer lock
            });
          } catch {
            // Ignore pointer lock security exceptions
          }
        }
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        syncStationPose("reactor");
      } else if (e.key === "2") {
        e.preventDefault();
        syncStationPose("terminal");
      } else if (e.key === "3") {
        e.preventDefault();
        syncStationPose("power");
      } else if (e.key === "4") {
        e.preventDefault();
        syncStationPose("inspector");
      } else if (e.key === "5") {
        e.preventDefault();
        syncStationPose("aux");
      } else if (e.key === "6") {
        e.preventDefault();
        setActiveStation("reactor");
        lookStateRef.current.targetYaw = setShortestTargetYaw(
          lookStateRef.current.currentYaw,
          (3 * Math.PI) / 4,
        );
        lookStateRef.current.targetPitch = -0.02;
      } else if (e.key === "7") {
        e.preventDefault();
        setActiveStation("reactor");
        lookStateRef.current.targetYaw = setShortestTargetYaw(
          lookStateRef.current.currentYaw,
          Math.PI,
        );
        lookStateRef.current.targetPitch = -0.02;
      } else if (e.key === "0" || e.key === "Escape") {
        e.preventDefault();
        if (
          e.key === "Escape" &&
          useCameraLookStore.getState().isFreeLookMode
        ) {
          if (document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          useCameraLookStore.getState().setFreeLookMode(false);
        }
        syncStationPose("overview");
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        lookStateRef.current.keysHeld.left = true;
      } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        lookStateRef.current.keysHeld.right = true;
      } else if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        lookStateRef.current.keysHeld.up = true;
      } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        lookStateRef.current.keysHeld.down = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        lookStateRef.current.keysHeld.left = false;
      } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        lookStateRef.current.keysHeld.right = false;
      } else if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        lookStateRef.current.keysHeld.up = false;
      } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        lookStateRef.current.keysHeld.down = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const isFreeLook =
        document.pointerLockElement === gl.domElement ||
        useCameraLookStore.getState().isFreeLookMode;
      const isRightOrMiddleDrag = (e.buttons & 2) !== 0 || (e.buttons & 4) !== 0;
      if (!isFreeLook && !isRightOrMiddleDrag) return;

      const look = lookStateRef.current;
      look.targetYaw -= e.movementX * MOUSE_SENSITIVITY;
      look.targetPitch = THREE.MathUtils.clamp(
        look.targetPitch - e.movementY * MOUSE_SENSITIVITY,
        MIN_PITCH,
        MAX_PITCH,
      );
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange,
      );
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [gl, setActiveStation]);

  useFrame((state, delta) => {
    const dt = Math.min(0.1, delta);
    const pose = STATION_CAMERA_POSES[activeStation];
    const look = lookStateRef.current;

    const yawSpeed = 1.65;
    const pitchSpeed = 1.05;
    if (look.keysHeld.left) look.targetYaw += yawSpeed * dt;
    if (look.keysHeld.right) look.targetYaw -= yawSpeed * dt;
    if (look.keysHeld.up) look.targetPitch += pitchSpeed * dt;
    if (look.keysHeld.down) look.targetPitch -= pitchSpeed * dt;

    look.targetPitch = THREE.MathUtils.clamp(
      look.targetPitch,
      MIN_PITCH,
      MAX_PITCH,
    );

    look.currentYaw = THREE.MathUtils.damp(
      look.currentYaw,
      look.targetYaw,
      14,
      dt,
    );
    look.currentPitch = THREE.MathUtils.damp(
      look.currentPitch,
      look.targetPitch,
      14,
      dt,
    );

    desiredPosRef.current.set(
      pose.position[0],
      pose.position[1],
      pose.position[2],
    );
    currentPosRef.current.x = THREE.MathUtils.damp(
      currentPosRef.current.x,
      desiredPosRef.current.x,
      8.5,
      dt,
    );
    currentPosRef.current.y = THREE.MathUtils.damp(
      currentPosRef.current.y,
      desiredPosRef.current.y,
      8.5,
      dt,
    );
    currentPosRef.current.z = THREE.MathUtils.damp(
      currentPosRef.current.z,
      desiredPosRef.current.z,
      8.5,
      dt,
    );

    state.camera.position.copy(currentPosRef.current);
    state.camera.rotation.order = "YXZ";
    state.camera.rotation.set(look.currentPitch, look.currentYaw, 0, "YXZ");
    state.camera.rotation.z = 0;

    if (state.camera instanceof THREE.PerspectiveCamera) {
      const nextFov = THREE.MathUtils.damp(state.camera.fov, pose.fov, 8.5, dt);
      if (Math.abs(nextFov - state.camera.fov) > 0.02) {
        state.camera.fov = nextFov;
        state.camera.updateProjectionMatrix();
      }
    }
  });

  return null;
};
