import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { CameraStation } from "./types";
import { useGameStore } from "./useGameStore";

interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

const STATION_CAMERA_POSES: Record<CameraStation, CameraPose> = {
  overview: {
    position: [0, 1.54, 2.65],
    target: [0, 1.18, -1.45],
    fov: 54,
  },
  reactor: {
    position: [-0.95, 1.48, 0.28],
    target: [-2.15, 1.42, -1.08],
    fov: 46,
  },
  power: {
    position: [-0.95, 0.82, 0.32],
    target: [-2.15, 0.48, -1.08],
    fov: 46,
  },
  terminal: {
    position: [0, 1.32, 0.18],
    target: [0, 1.22, -1.55],
    fov: 47,
  },
  inspector: {
    position: [1.18, 1.68, 0.18],
    target: [2.08, 0.96, -1.02],
    fov: 45,
  },
};

function applyEdgeLookDeadzone(norm: number, deadzone = 0.65): number {
  const abs = Math.abs(norm);
  if (abs <= deadzone) {
    return norm * 0.12;
  }
  const sign = Math.sign(norm);
  const edgeRatio = (abs - deadzone) / (1 - deadzone);
  return sign * (deadzone * 0.12 + edgeRatio * 0.88);
}

export const CameraController: React.FC = () => {
  const activeStation = useGameStore((s) => s.activeStation);
  const setActiveStation = useGameStore((s) => s.setActiveStation);

  const currentPosRef = useRef(new THREE.Vector3(0, 1.54, 2.65));
  const currentLookAtRef = useRef(new THREE.Vector3(0, 1.18, -1.45));
  const desiredPosRef = useRef(new THREE.Vector3());
  const desiredLookAtRef = useRef(new THREE.Vector3());

  // First-person free-look state when in Operator Chair ('overview')
  const lookStateRef = useRef({
    keyYaw: 0,
    keyPitch: 0,
    pointerX: 0,
    pointerY: 0,
    keysHeld: {
      left: false,
      right: false,
      up: false,
      down: false,
    },
  });

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;

      if (e.key === "1") {
        e.preventDefault();
        setActiveStation("reactor");
      } else if (e.key === "2") {
        e.preventDefault();
        setActiveStation("terminal");
      } else if (e.key === "3") {
        e.preventDefault();
        setActiveStation("power");
      } else if (e.key === "4") {
        e.preventDefault();
        setActiveStation("inspector");
      } else if (e.key === "Escape" || e.key === "0") {
        e.preventDefault();
        setActiveStation("overview");
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

    const handlePointerMove = (e: PointerEvent) => {
      // Do not shift the camera while the user is actively holding/dragging a 3D lever with Left-Click!
      if ((e.buttons & 1) === 1) return;

      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      lookStateRef.current.pointerX = THREE.MathUtils.clamp(nx, -1, 1);
      lookStateRef.current.pointerY = THREE.MathUtils.clamp(ny, -1, 1);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [setActiveStation]);

  useFrame((state, delta) => {
    const dt = Math.min(0.1, delta);
    const pose = STATION_CAMERA_POSES[activeStation];
    const look = lookStateRef.current;

    if (activeStation === "overview") {
      const yawSpeed = 1.4;
      const pitchSpeed = 0.85;
      if (look.keysHeld.left) look.keyYaw += yawSpeed * dt;
      if (look.keysHeld.right) look.keyYaw -= yawSpeed * dt;
      if (look.keysHeld.up) look.keyPitch += pitchSpeed * dt;
      if (look.keysHeld.down) look.keyPitch -= pitchSpeed * dt;

      look.keyYaw = THREE.MathUtils.clamp(look.keyYaw, -0.75, 0.75);
      look.keyPitch = THREE.MathUtils.clamp(look.keyPitch, -0.28, 0.28);

      // Center deadzone keeps 3D levers rock-steady when aiming; outer screen edges + WASD turn the head
      const edgeYaw = applyEdgeLookDeadzone(look.pointerX, 0.68) * 0.42;
      const edgePitch = applyEdgeLookDeadzone(look.pointerY, 0.68) * 0.16;

      const totalYaw = THREE.MathUtils.clamp(
        look.keyYaw - edgeYaw,
        -0.95,
        0.95,
      );
      const totalPitch = THREE.MathUtils.clamp(
        look.keyPitch - edgePitch,
        -0.32,
        0.32,
      );

      desiredPosRef.current.set(
        pose.position[0] - totalYaw * 0.16,
        pose.position[1] + totalPitch * 0.06,
        pose.position[2],
      );

      const lookDist = 4.1;
      desiredLookAtRef.current.set(
        pose.position[0] - Math.sin(totalYaw) * lookDist,
        pose.target[1] + totalPitch * 1.35,
        pose.position[2] - Math.cos(totalYaw) * lookDist,
      );
    } else {
      look.keyYaw = THREE.MathUtils.lerp(look.keyYaw, 0, dt * 6);
      look.keyPitch = THREE.MathUtils.lerp(look.keyPitch, 0, dt * 6);

      desiredPosRef.current.set(
        pose.position[0] + look.pointerX * 0.008,
        pose.position[1] - look.pointerY * 0.006,
        pose.position[2],
      );
      desiredLookAtRef.current.set(
        pose.target[0],
        pose.target[1],
        pose.target[2],
      );
    }

    const smoothFactor = 1 - Math.exp(-8.5 * dt);
    currentPosRef.current.lerp(desiredPosRef.current, smoothFactor);
    currentLookAtRef.current.lerp(desiredLookAtRef.current, smoothFactor);

    state.camera.position.copy(currentPosRef.current);
    state.camera.lookAt(currentLookAtRef.current);

    if (state.camera instanceof THREE.PerspectiveCamera) {
      const nextFov = THREE.MathUtils.lerp(
        state.camera.fov,
        pose.fov,
        smoothFactor,
      );
      if (Math.abs(nextFov - state.camera.fov) > 0.02) {
        state.camera.fov = nextFov;
        state.camera.updateProjectionMatrix();
      }
    }
  });

  return null;
};
