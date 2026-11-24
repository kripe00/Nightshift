import { type RootState, useFrame, useThree } from "@react-three/fiber";
import React, { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { create } from "zustand";
import { playSwitchClank } from "../modules/reactor/audioSynth";
import {
  AIRLOCK_PASSABLE_OPEN_THRESHOLD,
  airlockDoorState,
} from "./airlockDoorState";
import {
  abortKomradGrab,
  isKomradGrabActive,
  komradGrabState,
  snapshotGrabCameraPose,
  stepKomradGrab,
} from "./komradGrabState";
import { playKgbLiquidationStampThud } from "./komradVoiceSynth";
import {
  canEngageCanvasPointerLock,
  classifyPressTarget,
  hasHoverableControlHandler,
  installSafePointerCaptureShim,
  isObjectTreeVisible,
  playerCameraPose,
  pointerLockInteraction,
  subscribePointerLockInteraction,
  updatePointerLockInteraction,
} from "./pointerLockState";
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

interface BayStandingSpot {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

const STANDING_EYE_Y = 1.65;
const SPAWN_X = 0.0;
const SPAWN_Z = 0.52;
const LOBBY_SPAWN_X = -0.38;
const LOBBY_SPAWN_Z = 8.42;
const LOBBY_SPAWN_YAW = -0.125;
const LOBBY_SPAWN_PITCH = 0.01;
const WALK_SPEED = 3.0;
const SPRINT_SPEED = 4.4;
const VELOCITY_DAMP = 14;
const HEAD_BOB_AMPLITUDE = 0.012;
const BASE_FOV = 68;
const RMB_ZOOM_FOV = 46;
const REACH_MAX_DIST = 2.6;
const GRAB_ACTIVE_FAR = 6.0;
const SEATED_DESK_FAR = 2.6;
const MENU_FAR = 6.5;
const MOUSE_SENSITIVITY = 0.0024;
const MIN_PITCH = THREE.MathUtils.degToRad(-80);
const MAX_PITCH = THREE.MathUtils.degToRad(75);
const DEFAULT_PITCH = THREE.MathUtils.degToRad(-4);
const PLAYER_RADIUS = 0.26;

const DESK_CENTER_X = 0.0;
const DESK_CENTER_Z = 1.8;
const DESK_CHAIR_X = -0.28;
const DESK_CHAIR_Z = 2.74;
const DESK_SIT_RANGE = 2.8;

const SEATED_DESK_POSE = {
  x: 0.0,
  y: 1.12,
  z: 2.48,
  yaw: 0,
  pitch: -0.08,
  fov: 44,
} as const;
const RMB_SEATED_ZOOM_FOV = 37;

const STAND_UP_SPOT: BayStandingSpot = {
  x: 0.14,
  z: 3.08,
  yaw: 0,
  pitch: -0.32,
};

function checkWithinDeskRange(px: number, pz: number): boolean {
  const dDesk = Math.hypot(px - DESK_CENTER_X, pz - DESK_CENTER_Z);
  const dChair = Math.hypot(px - DESK_CHAIR_X, pz - DESK_CHAIR_Z);
  return Math.min(dDesk, dChair) <= DESK_SIT_RANGE;
}

const BAY_STANDING_SPOTS: Record<CameraStation, BayStandingSpot> = {
  overview: {
    // [0] Hall Spawn: standing between Supervisor Desk and Main Operator Row facing -Z
    x: SPAWN_X,
    z: SPAWN_Z,
    yaw: 0,
    pitch: DEFAULT_PITCH,
  },
  reactor: {
    // [1] Left Operator Desk right bay (`UNIT A`): Cooling, Pumps & 6 MW Levers
    x: -2.54,
    z: -0.31,
    yaw: (15 * Math.PI) / 180,
    pitch: -0.24,
  },
  terminal: {
    // [2] Open Center Aisle Facing Front `K.O.M.R.A.D.-84` Synoptic CRT
    x: 0.0,
    z: -1.45,
    yaw: 0,
    pitch: 0.06,
  },
  power: {
    // [3] Right Operator Desk single bay (`UNIT B`): Drum Separators & Coolant Loop
    x: 3.74,
    z: 0.28,
    yaw: -(18 * Math.PI) / 180,
    pitch: -0.22,
  },
  inspector: {
    // [4] Shift Supervisor Desk (Post No. 4): standing on +Z side facing desk & console row (clear of chair collider)
    x: 0.22,
    z: 2.6,
    yaw: 0.12,
    pitch: -0.56,
  },
  aux: {
    // [5] Left-Wall Switchgear (`UNIT C`): 1000 MWh Station Battery & Aux Bus
    x: -3.88,
    z: 1.42,
    yaw: Math.PI / 2,
    pitch: -0.14,
  },
};

const UNIT_A2_SPOT: BayStandingSpot = {
  // [6] Left Operator Desk left bay (`UNIT A-2`): RBMK Core & Control Rods
  x: -4.0,
  z: 0.08,
  yaw: (15 * Math.PI) / 180,
  pitch: -0.24,
};

interface ColliderOBB {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
}

interface ColliderCircle {
  cx: number;
  cz: number;
  radius: number;
}

const CONTROL_ROOM_COLLIDERS: readonly ColliderOBB[] = [
  // Front Synoptic Wall Monumental CRT Bay & Angled Wings
  { cx: 0.0, cz: -3.86, halfW: 1.98, halfD: 0.42, rotY: 0 },
  { cx: -3.9, cz: -3.62, halfW: 1.88, halfD: 0.3, rotY: 0.21 },
  { cx: 3.9, cz: -3.62, halfW: 1.88, halfD: 0.3, rotY: -0.21 },
  // Split Two-Wing Operator Console Desks (Left Dual-Bay & Right Single-Bay UNIT B)
  { cx: -3.61, cz: -1.49, halfW: 1.68, halfD: 0.68, rotY: (15 * Math.PI) / 180 },
  { cx: 4.24, cz: -1.25, halfW: 0.96, halfD: 0.74, rotY: -(18 * Math.PI) / 180 },
  // Shift Supervisor Desk (`InspectorDesk3D` at `(0, 0.06, +1.80)`)
  { cx: 0.0, cz: 1.8, halfW: 1.28, halfD: 0.46, rotY: 0 },
  // Left-Wall `UNIT C` 1000 MWh Battery & HV Switchgear Alcove (`x = -5.16, z = +1.42`)
  { cx: -5.36, cz: 1.42, halfW: 0.68, halfD: 1.92, rotY: 0 },
  // Corner `SM-2M` Magnetic Tape Computer Cabinets & Rear Fire-Shield Sand Box (`FIRE SAND NO. 1`)
  { cx: -5.6, cz: -2.38, halfW: 0.34, halfD: 0.6, rotY: 0 },
  { cx: 5.62, cz: -2.54, halfW: 0.32, halfD: 0.46, rotY: 0 },
  { cx: -4.32, cz: 4.32, halfW: 0.58, halfD: 0.18, rotY: 0 },
  // Right-Window Duty Radio Side Table (`OKEAN-84` at `x = +5.58, z = +1.58`)
  { cx: 5.58, cz: 1.58, halfW: 0.28, halfD: 0.43, rotY: 0 },
];

const CONTROL_ROOM_CIRCLE_COLLIDERS: readonly ColliderCircle[] = [
  // Supervisor Swivel Chair (`[-0.28, 0.005, 2.74]`)
  { cx: -0.28, cz: 2.74, radius: 0.24 },
  // Left Operator Swivel Chair (`[-4.46, 0.016, -0.14]`)
  { cx: -4.46, cz: -0.14, radius: 0.24 },
  // Right Operator Swivel Chair (`[4.62, 0.016, 0.24]`)
  { cx: 4.62, cz: 0.24, radius: 0.24 },
];

const LOBBY_COLLIDERS: readonly ColliderOBB[] = [
  // Cozy Break Table Near East Frosted Window (`x = +0.92, z = +6.95`)
  { cx: 0.92, cz: 6.95, halfW: 0.4, halfD: 0.7, rotY: 0 },
  // Soviet Tubular-Steel Vinyl Armchair (`x = +0.18, z = +6.75`, `rotY = 1.22`)
  { cx: 0.18, cz: 6.75, halfW: 0.26, halfD: 0.26, rotY: 1.22 },
  // West-Wall Trophy & Medal Display Cabinet (`x = -3.52, z = +7.45`)
  { cx: -3.52, cz: 7.45, halfW: 0.3, halfD: 1.15, rotY: 0 },
  // South-Wall Non-Functional Elevator (`LIFT-84`) Frame (`x = -0.85, z = +10.18`)
  { cx: -0.85, cz: 10.18, halfW: 1.15, halfD: 0.16, rotY: 0 },
  // South-East Potted Rubber Plant (`STATE BOTANICAL ASSET #04`)
  { cx: 0.86, cz: 9.45, halfW: 0.28, halfD: 0.28, rotY: 0 },
];

const LOBBY_CIRCLE_COLLIDERS: readonly ColliderCircle[] = [
  // Lobby Metal Wastebasket (`[1.14, 0, 7.82]`)
  { cx: 1.14, cz: 7.82, radius: 0.18 },
];

const R_CTRL_MIN_X = -5.48;
const R_CTRL_MAX_X = 5.48;
const R_CTRL_MIN_Z = -3.42;
const R_CTRL_MAX_Z = 4.08;

const R_DOOR_MIN_X = -0.38;
const R_DOOR_MAX_X = 0.38;
const R_DOOR_MIN_Z = 3.9;
const R_DOOR_MAX_Z = 5.3;

const R_LOBBY_MIN_X = -3.46;
const R_LOBBY_MAX_X = 1.06;
const R_LOBBY_MIN_Z = 5.12;
const R_LOBBY_MAX_Z = 9.98;

function pushCircleOutOfOBB(
  pos: THREE.Vector3,
  radius: number,
  obb: ColliderOBB,
): void {
  const cos = Math.cos(obb.rotY);
  const sin = Math.sin(obb.rotY);
  const dx = pos.x - obb.cx;
  const dz = pos.z - obb.cz;

  // World -> OBB local XZ (Three.js +Y rotation inverse)
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;

  const closestX = THREE.MathUtils.clamp(lx, -obb.halfW, obb.halfW);
  const closestZ = THREE.MathUtils.clamp(lz, -obb.halfD, obb.halfD);

  const distX = lx - closestX;
  const distZ = lz - closestZ;
  const distSq = distX * distX + distZ * distZ;

  if (distSq >= radius * radius) return;

  let pushLX = 0;
  let pushLZ = 0;
  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    pushLX = (distX / dist) * push;
    pushLZ = (distZ / dist) * push;
  } else {
    const penX = obb.halfW - Math.abs(lx);
    const penZ = obb.halfD - Math.abs(lz);
    if (penX < penZ) {
      pushLX = (lx >= 0 ? 1 : -1) * (penX + radius);
    } else {
      pushLZ = (lz >= 0 ? 1 : -1) * (penZ + radius);
    }
  }

  // OBB local -> World XZ
  pos.x += pushLX * cos + pushLZ * sin;
  pos.z += -pushLX * sin + pushLZ * cos;
}

function pushCircleOutOfCircle(
  pos: THREE.Vector3,
  playerRadius: number,
  col: ColliderCircle,
): void {
  const minDist = playerRadius + col.radius;
  const dx = pos.x - col.cx;
  const dz = pos.z - col.cz;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return;

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const scale = minDist / dist;
    pos.x = col.cx + dx * scale;
    pos.z = col.cz + dz * scale;
  } else {
    pos.x = col.cx + minDist;
  }
}

function isInsideWalkableUnion(x: number, z: number): boolean {
  const inCtrl =
    x >= R_CTRL_MIN_X &&
    x <= R_CTRL_MAX_X &&
    z >= R_CTRL_MIN_Z &&
    z <= R_CTRL_MAX_Z;
  if (inCtrl) return true;
  const inDoor =
    x >= R_DOOR_MIN_X &&
    x <= R_DOOR_MAX_X &&
    z >= R_DOOR_MIN_Z &&
    z <= R_DOOR_MAX_Z;
  if (inDoor) return true;
  return (
    x >= R_LOBBY_MIN_X &&
    x <= R_LOBBY_MAX_X &&
    z >= R_LOBBY_MIN_Z &&
    z <= R_LOBBY_MAX_Z
  );
}

function clampToWalkableEnvelope(
  pos: THREE.Vector3,
  prevX: number,
  prevZ: number,
  doorPassable: boolean,
): void {
  const px = pos.x;
  const pz = pos.z;

  if (!doorPassable) {
    if (prevZ < 4.64) {
      pos.x = THREE.MathUtils.clamp(px, R_CTRL_MIN_X, R_CTRL_MAX_X);
      pos.z = THREE.MathUtils.clamp(pz, R_CTRL_MIN_Z, R_CTRL_MAX_Z);
    } else {
      pos.x = THREE.MathUtils.clamp(px, R_LOBBY_MIN_X, R_LOBBY_MAX_X);
      pos.z = THREE.MathUtils.clamp(pz, R_LOBBY_MIN_Z, R_LOBBY_MAX_Z);
    }
    return;
  }

  if (isInsideWalkableUnion(px, pz)) return;

  const xOnlyOk = isInsideWalkableUnion(px, prevZ);
  const zOnlyOk = isInsideWalkableUnion(prevX, pz);

  if (xOnlyOk && !zOnlyOk) {
    pos.x = px;
    const inDoorX = px >= R_DOOR_MIN_X && px <= R_DOOR_MAX_X;
    if (prevZ <= R_CTRL_MAX_Z) {
      pos.z = THREE.MathUtils.clamp(
        pz,
        R_CTRL_MIN_Z,
        inDoorX ? R_DOOR_MAX_Z : R_CTRL_MAX_Z,
      );
    } else if (prevZ >= R_LOBBY_MIN_Z) {
      pos.z = THREE.MathUtils.clamp(
        pz,
        inDoorX ? R_DOOR_MIN_Z : R_LOBBY_MIN_Z,
        R_LOBBY_MAX_Z,
      );
    } else {
      pos.z = THREE.MathUtils.clamp(pz, R_DOOR_MIN_Z, R_DOOR_MAX_Z);
    }
    return;
  }

  if (zOnlyOk && !xOnlyOk) {
    pos.z = pz;
    if (pz > R_CTRL_MAX_Z && pz < R_LOBBY_MIN_Z) {
      pos.x = THREE.MathUtils.clamp(px, R_DOOR_MIN_X, R_DOOR_MAX_X);
    } else if (pz <= R_CTRL_MAX_Z) {
      pos.x = THREE.MathUtils.clamp(px, R_CTRL_MIN_X, R_CTRL_MAX_X);
    } else {
      pos.x = THREE.MathUtils.clamp(px, R_LOBBY_MIN_X, R_LOBBY_MAX_X);
    }
    return;
  }

  // Diagonal corner exit: clamp against the zone containing (prevX, prevZ)
  if (prevZ > R_CTRL_MAX_Z && prevZ < R_LOBBY_MIN_Z) {
    pos.x = THREE.MathUtils.clamp(px, R_DOOR_MIN_X, R_DOOR_MAX_X);
    pos.z = THREE.MathUtils.clamp(pz, R_DOOR_MIN_Z, R_DOOR_MAX_Z);
    return;
  }

  if (prevZ <= R_CTRL_MAX_Z) {
    const cx = THREE.MathUtils.clamp(px, R_CTRL_MIN_X, R_CTRL_MAX_X);
    const inDoorX = cx >= R_DOOR_MIN_X && cx <= R_DOOR_MAX_X;
    pos.x = cx;
    pos.z = THREE.MathUtils.clamp(
      pz,
      R_CTRL_MIN_Z,
      inDoorX ? R_DOOR_MAX_Z : R_CTRL_MAX_Z,
    );
    return;
  }

  const lx = THREE.MathUtils.clamp(px, R_LOBBY_MIN_X, R_LOBBY_MAX_X);
  const inDoorX = lx >= R_DOOR_MIN_X && lx <= R_DOOR_MAX_X;
  pos.x = lx;
  pos.z = THREE.MathUtils.clamp(
    pz,
    inDoorX ? R_DOOR_MIN_Z : R_LOBBY_MIN_Z,
    R_LOBBY_MAX_Z,
  );
}

function resolveControlRoomCollisions(
  pos: THREE.Vector3,
  prevX = pos.x,
  prevZ = pos.z,
): void {
  const doorPassable =
    useGameStore.getState().lobbyMenuPhase !== "menu_locked" &&
    airlockDoorState.openProgress > AIRLOCK_PASSABLE_OPEN_THRESHOLD;

  for (let pass = 0; pass < 2; pass++) {
    const stepPrevX = pass === 0 ? prevX : pos.x;
    const stepPrevZ = pass === 0 ? prevZ : pos.z;
    clampToWalkableEnvelope(pos, stepPrevX, stepPrevZ, doorPassable);
    if (pos.z < 4.65) {
      for (let i = 0; i < CONTROL_ROOM_COLLIDERS.length; i++) {
        pushCircleOutOfOBB(pos, PLAYER_RADIUS, CONTROL_ROOM_COLLIDERS[i]);
      }
      for (let i = 0; i < CONTROL_ROOM_CIRCLE_COLLIDERS.length; i++) {
        pushCircleOutOfCircle(
          pos,
          PLAYER_RADIUS,
          CONTROL_ROOM_CIRCLE_COLLIDERS[i],
        );
      }
    }
    if (pos.z > 4.55) {
      for (let i = 0; i < LOBBY_COLLIDERS.length; i++) {
        pushCircleOutOfOBB(pos, PLAYER_RADIUS, LOBBY_COLLIDERS[i]);
      }
      for (let i = 0; i < LOBBY_CIRCLE_COLLIDERS.length; i++) {
        pushCircleOutOfCircle(pos, PLAYER_RADIUS, LOBBY_CIRCLE_COLLIDERS[i]);
      }
    }
  }
  clampToWalkableEnvelope(pos, pos.x, pos.z, doorPassable);
}

function shortestAngleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function setShortestTargetYaw(
  currentYaw: number,
  desiredYaw: number,
): number {
  return currentYaw + shortestAngleDiff(desiredYaw, currentYaw);
}

function stampEventVirtualCoords(
  event: Event,
  vx: number,
  vy: number,
  rect: DOMRect,
): void {
  const props: Array<[string, number]> = [
    ["offsetX", vx],
    ["offsetY", vy],
    ["clientX", rect.left + vx],
    ["clientY", rect.top + vy],
  ];
  for (let i = 0; i < props.length; i++) {
    const [key, value] = props[i];
    try {
      Object.defineProperty(event, key, {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    } catch {
      // Ignore non-configurable event properties
    }
  }
}

export const CameraController: React.FC = () => {
  const { gl, setEvents, get } = useThree();
  const activeStation = useGameStore((s) => s.activeStation);
  const setActiveStation = useGameStore((s) => s.setActiveStation);
  const phase = useGameStore((s) => s.phase);
  const isSeatedAtDesk = useGameStore((s) => s.isSeatedAtDesk);
  const siberiaGameOverActive = useGameStore((s) => s.siberiaGameOverActive);

  const playerPosRef = useRef(
    new THREE.Vector3(LOBBY_SPAWN_X, STANDING_EYE_Y, LOBBY_SPAWN_Z),
  );
  const currentEyeYRef = useRef(STANDING_EYE_Y);
  const velocityRef = useRef({ vx: 0, vz: 0 });
  const headBobPhaseRef = useRef(0);
  const headBobOffsetRef = useRef(0);

  const lookStateRef = useRef({
    targetYaw: LOBBY_SPAWN_YAW,
    targetPitch: LOBBY_SPAWN_PITCH,
    currentYaw: LOBBY_SPAWN_YAW,
    currentPitch: LOBBY_SPAWN_PITCH,
  });

  const moveKeysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    shift: false,
    zKey: false,
    digit5: false,
  });

  const glideTargetRef = useRef({
    active: false,
    x: LOBBY_SPAWN_X,
    z: LOBBY_SPAWN_Z,
  });
  const rmbHeldRef = useRef<boolean>(false);

  const skipNextPoseSyncRef = useRef<boolean>(true);
  const prevSeatedRef = useRef<boolean>(useGameStore.getState().isSeatedAtDesk);
  const prevLobbyPhaseRef = useRef<string>(
    useGameStore.getState().lobbyMenuPhase,
  );
  const prevShiftRunIdRef = useRef<number>(useGameStore.getState().shiftRunId);
  const activePointerIdRef = useRef<number | null>(null);
  const releaseRafRef = useRef<number>(0);
  const centerHoverRaycasterRef = useRef(new THREE.Raycaster());
  const centerNdcRef = useRef(new THREE.Vector2(0, 0));
  const hoverPollStateRef = useRef({
    lastCamX: 0,
    lastCamY: 0,
    lastCamZ: 0,
    lastYaw: 0,
    lastPitch: 0,
    lastCheckElapsed: 0,
  });

  const refreshCenterHover = useCallback((r3fState: RootState) => {
    if (document.pointerLockElement !== r3fState.gl.domElement) {
      if (pointerLockInteraction.isHoveringControl) {
        updatePointerLockInteraction({ isHoveringControl: false });
      }
      return;
    }
    if (pointerLockInteraction.isGrabbingControl) {
      if (!pointerLockInteraction.isHoveringControl) {
        updatePointerLockInteraction({ isHoveringControl: true });
      }
      return;
    }

    const interaction = r3fState.internal.interaction;
    const candidates: THREE.Object3D[] = [];
    for (let i = 0; i < interaction.length; i++) {
      const obj = interaction[i];
      if (isObjectTreeVisible(obj)) {
        candidates.push(obj);
      }
    }

    const gs = useGameStore.getState();
    const raycaster = centerHoverRaycasterRef.current;
    raycaster.near = 0.05;
    raycaster.far =
      gs.phase !== "playing" || gs.lobbyMenuPhase === "menu_locked"
        ? MENU_FAR
        : REACH_MAX_DIST;
    raycaster.setFromCamera(centerNdcRef.current, r3fState.camera);
    const hits = raycaster.intersectObjects(candidates, true);
    let hovering = false;
    for (let i = 0; i < hits.length; i++) {
      if (hasHoverableControlHandler(hits[i].object)) {
        hovering = true;
        break;
      }
    }
    updatePointerLockInteraction({ isHoveringControl: hovering });
  }, []);

  // Glide smoothly to station standing spot when activeStation changes via [0]-[6] or UI
  useEffect(() => {
    if (useGameStore.getState().lobbyMenuPhase !== "entered_control_room") {
      skipNextPoseSyncRef.current = false;
      return;
    }
    if (skipNextPoseSyncRef.current) {
      skipNextPoseSyncRef.current = false;
      return;
    }
    const spot = BAY_STANDING_SPOTS[activeStation];
    lookStateRef.current.targetYaw = setShortestTargetYaw(
      lookStateRef.current.currentYaw,
      spot.yaw,
    );
    lookStateRef.current.targetPitch = spot.pitch;
    glideTargetRef.current = {
      active: true,
      x: spot.x,
      z: spot.z,
    };
  }, [activeStation]);

  // Auto-exit Pointer Lock and clear held locomotion keys when gameplay pauses, seated at Inspector Desk, or in Siberia Game Over
  useEffect(() => {
    if (isSeatedAtDesk || phase !== "playing" || siberiaGameOverActive) {
      moveKeysRef.current.forward = false;
      moveKeysRef.current.backward = false;
      moveKeysRef.current.left = false;
      moveKeysRef.current.right = false;
      moveKeysRef.current.shift = false;
      moveKeysRef.current.zKey = false;
      moveKeysRef.current.digit5 = false;
      rmbHeldRef.current = false;
    }
    const syncAllowedLock = () => {
      const gs = useGameStore.getState();
      if (
        (!canEngageCanvasPointerLock(
          gs.phase,
          gs.isSeatedAtDesk,
          gs.lobbyMenuPhase,
        ) ||
          gs.siberiaGameOverActive ||
          isKomradGrabActive()) &&
        document.pointerLockElement === gl.domElement
      ) {
        document.exitPointerLock?.();
      }
    };
    syncAllowedLock();
    return subscribePointerLockInteraction(syncAllowedLock);
  }, [gl, phase, isSeatedAtDesk, siberiaGameOverActive]);

  useEffect(() => {
    installSafePointerCaptureShim();

    // Custom R3F event computation: center reticle (0, 0) while idle/hovering,
    // virtual cursor (virtualX, virtualY) during Amnesia-style hold-and-drag,
    // or live free mouse cursor coordinates when seated at the Inspector Desk.
    const prevCompute = get().events.compute;
    setEvents({
      compute: (event, state) => {
        const gs = useGameStore.getState();
        const interactionFar =
          pointerLockInteraction.isGrabbingControl
            ? GRAB_ACTIVE_FAR
            : gs.isSeatedAtDesk
              ? SEATED_DESK_FAR
              : gs.phase !== "playing" || gs.lobbyMenuPhase === "menu_locked"
                ? MENU_FAR
                : REACH_MAX_DIST;

        if (document.pointerLockElement === state.gl.domElement) {
          if (
            pointerLockInteraction.isGrabbingControl &&
            pointerLockInteraction.isDragCapableGrab &&
            state.size.width > 0 &&
            state.size.height > 0
          ) {
            const nx =
              (pointerLockInteraction.virtualX / state.size.width) * 2 - 1;
            const ny =
              -(pointerLockInteraction.virtualY / state.size.height) * 2 + 1;
            state.pointer.set(nx, ny);
          } else {
            state.pointer.set(0, 0);
          }
          state.raycaster.near = 0.05;
          state.raycaster.far = interactionFar;
          state.raycaster.setFromCamera(state.pointer, state.camera);
          return;
        }

        const mouseEv = event as MouseEvent;
        if (state.size.width > 0 && state.size.height > 0) {
          const rect = state.gl.domElement.getBoundingClientRect();
          const px =
            typeof mouseEv.clientX === "number"
              ? mouseEv.clientX - rect.left
              : mouseEv.offsetX;
          const py =
            typeof mouseEv.clientY === "number"
              ? mouseEv.clientY - rect.top
              : mouseEv.offsetY;
          if (typeof px === "number" && typeof py === "number") {
            state.pointer.set(
              (px / state.size.width) * 2 - 1,
              -(py / state.size.height) * 2 + 1,
            );
            state.raycaster.near = 0.05;
            state.raycaster.far = interactionFar;
            state.raycaster.setFromCamera(state.pointer, state.camera);
          }
        }
      },
    });

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

    const applyBaySpot = (
      spot: BayStandingSpot,
      station: CameraStation,
    ) => {
      const prevStation = useGameStore.getState().activeStation;
      lookStateRef.current.targetYaw = setShortestTargetYaw(
        lookStateRef.current.currentYaw,
        spot.yaw,
      );
      lookStateRef.current.targetPitch = spot.pitch;
      glideTargetRef.current = {
        active: true,
        x: spot.x,
        z: spot.z,
      };
      skipNextPoseSyncRef.current = prevStation !== station;
      setActiveStation(station);
    };

    const syncStationSpot = (station: CameraStation) => {
      applyBaySpot(BAY_STANDING_SPOTS[station], station);
    };

    const scheduleCaptureResetAndHoverSnap = () => {
      if (releaseRafRef.current) {
        window.cancelAnimationFrame(releaseRafRef.current);
      }
      releaseRafRef.current = window.requestAnimationFrame(() => {
        releaseRafRef.current = 0;
        const r3fState = get();
        r3fState.internal.capturedMap.clear();
        const rect = gl.domElement.getBoundingClientRect();
        updatePointerLockInteraction({
          virtualX: rect.width / 2,
          virtualY: rect.height / 2,
        });
        refreshCenterHover(r3fState);
      });
    };

    const releaseActiveGrab = (dispatchSyntheticUp: boolean) => {
      const wasGrabbing = pointerLockInteraction.isGrabbingControl;
      const pointerId = activePointerIdRef.current;
      activePointerIdRef.current = null;

      if (dispatchSyntheticUp && wasGrabbing && pointerId !== null) {
        try {
          window.dispatchEvent(
            new PointerEvent("pointerup", {
              bubbles: true,
              pointerId,
              button: 0,
            }),
          );
        } catch {
          // Ignore synthetic cleanup dispatch failures
        }
      }

      if (wasGrabbing) {
        updatePointerLockInteraction({
          isGrabbingControl: false,
          isDragCapableGrab: false,
        });
      }
      scheduleCaptureResetAndHoverSnap();
    };

    const requestCanvasLockIfAllowed = () => {
      const gs = useGameStore.getState();
      if (document.pointerLockElement === gl.domElement) return;
      if (
        gs.siberiaGameOverActive ||
        isKomradGrabActive() ||
        !canEngageCanvasPointerLock(gs.phase, gs.isSeatedAtDesk, gs.lobbyMenuPhase)
      ) {
        return;
      }
      try {
        const req = gl.domElement.requestPointerLock?.() as
          | Promise<void>
          | undefined;
        req?.catch?.(() => {
          // Ignore rejected pointer lock promises when user or browser denies lock
        });
      } catch {
        // Ignore security exceptions when calling requestPointerLock
      }
    };

    const sitAtDesk = () => {
      const mk = moveKeysRef.current;
      mk.forward = false;
      mk.backward = false;
      mk.left = false;
      mk.right = false;
      mk.shift = false;
      mk.zKey = false;
      mk.digit5 = false;
      velocityRef.current.vx = 0;
      velocityRef.current.vz = 0;
      glideTargetRef.current.active = false;
      rmbHeldRef.current = false;
      if (pointerLockInteraction.isGrabbingControl) {
        releaseActiveGrab(true);
      }
      lookStateRef.current.targetYaw = setShortestTargetYaw(
        lookStateRef.current.currentYaw,
        SEATED_DESK_POSE.yaw,
      );
      lookStateRef.current.targetPitch = SEATED_DESK_POSE.pitch;
      const gs = useGameStore.getState();
      skipNextPoseSyncRef.current = gs.activeStation !== "inspector";
      gs.setSeatedAtDesk(true);
      setActiveStation("inspector");
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock?.();
      }
      playSwitchClank(true);
    };

    const standUpFromDesk = (reengagePointerLock: boolean) => {
      if (pointerLockInteraction.isGrabbingControl) {
        releaseActiveGrab(true);
      }
      rmbHeldRef.current = false;
      const gs = useGameStore.getState();
      gs.setSeatedAtDesk(false);
      lookStateRef.current.targetYaw = setShortestTargetYaw(
        lookStateRef.current.currentYaw,
        STAND_UP_SPOT.yaw,
      );
      lookStateRef.current.targetPitch = STAND_UP_SPOT.pitch;
      glideTargetRef.current = {
        active: true,
        x: STAND_UP_SPOT.x,
        z: STAND_UP_SPOT.z,
      };
      playSwitchClank(false);
      if (reengagePointerLock) {
        requestCanvasLockIfAllowed();
      }
    };

    const handleCanvasClick = () => {
      if (isKomradGrabActive() || useGameStore.getState().siberiaGameOverActive) {
        return;
      }
      requestCanvasLockIfAllowed();
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === gl.domElement;
      const rect = gl.domElement.getBoundingClientRect();
      // Keep legacy isFreeLookMode false so all existing 3D mesh interactions stay enabled
      useCameraLookStore.getState().setFreeLookMode(false);
      if (locked) {
        updatePointerLockInteraction({
          isPointerLocked: true,
          virtualX: rect.width / 2,
          virtualY: rect.height / 2,
        });
        window.requestAnimationFrame(() => refreshCenterHover(get()));
      } else {
        rmbHeldRef.current = false;
        releaseActiveGrab(true);
        updatePointerLockInteraction({
          isPointerLocked: false,
          isHoveringControl: false,
          isGrabbingControl: false,
          isDragCapableGrab: false,
          virtualX: rect.width / 2,
          virtualY: rect.height / 2,
        });
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Capture-phase virtual cursor bridge so R3F and window pointermove drag listeners
    // see live virtual coordinates instead of frozen pointer-lock clientX/offsetX.
    const handleCapturePointerDown = (e: PointerEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const rect = gl.domElement.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      updatePointerLockInteraction({ virtualX: cx, virtualY: cy });
      stampEventVirtualCoords(e, cx, cy, rect);
    };

    const handleCapturePointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const rect = gl.domElement.getBoundingClientRect();
      if (
        pointerLockInteraction.isGrabbingControl &&
        pointerLockInteraction.isDragCapableGrab
      ) {
        const nextX = THREE.MathUtils.clamp(
          pointerLockInteraction.virtualX + e.movementX,
          0,
          rect.width,
        );
        const nextY = THREE.MathUtils.clamp(
          pointerLockInteraction.virtualY + e.movementY,
          0,
          rect.height,
        );
        pointerLockInteraction.virtualX = nextX;
        pointerLockInteraction.virtualY = nextY;
        stampEventVirtualCoords(e, nextX, nextY, rect);
      } else {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        pointerLockInteraction.virtualX = cx;
        pointerLockInteraction.virtualY = cy;
        stampEventVirtualCoords(e, cx, cy, rect);
      }
    };

    const handleCaptureVirtualEvent = (e: Event) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const rect = gl.domElement.getBoundingClientRect();
      stampEventVirtualCoords(
        e,
        pointerLockInteraction.virtualX,
        pointerLockInteraction.virtualY,
        rect,
      );
    };

    // Runs in window bubble phase right after R3F populates internal.initialHits on canvas
    const handleBubblePointerDown = (e: PointerEvent) => {
      if (isKomradGrabActive() || useGameStore.getState().siberiaGameOverActive) {
        return;
      }
      if (e.button === 2) {
        const gs = useGameStore.getState();
        if (
          gs.phase === "playing" &&
          !pointerLockInteraction.isGrabbingControl
        ) {
          rmbHeldRef.current = true;
        }
        return;
      }
      if (document.pointerLockElement !== gl.domElement) return;
      if (e.target !== gl.domElement || e.button !== 0) return;

      const hitKind = classifyPressTarget(get().internal.initialHits);
      if (hitKind.interactive) {
        const rect = gl.domElement.getBoundingClientRect();
        rmbHeldRef.current = false;
        activePointerIdRef.current = e.pointerId;
        updatePointerLockInteraction({
          isGrabbingControl: true,
          isDragCapableGrab: hitKind.draggable,
          isHoveringControl: true,
          virtualX: rect.width / 2,
          virtualY: rect.height / 2,
        });
      }
    };

    const handleBubblePointerUp = (e: PointerEvent) => {
      if (e.button === 2) {
        rmbHeldRef.current = false;
      }
      if (!pointerLockInteraction.isGrabbingControl) return;
      if (
        e.button === 0 ||
        (activePointerIdRef.current !== null &&
          e.pointerId === activePointerIdRef.current)
      ) {
        releaseActiveGrab(false);
      }
    };

    const handleBubbleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        rmbHeldRef.current = false;
      }
      if (!pointerLockInteraction.isGrabbingControl) return;
      if (e.button === 0) {
        releaseActiveGrab(false);
      }
    };

    const handleWindowBlur = () => {
      rmbHeldRef.current = false;
      moveKeysRef.current.forward = false;
      moveKeysRef.current.backward = false;
      moveKeysRef.current.left = false;
      moveKeysRef.current.right = false;
      moveKeysRef.current.shift = false;
      moveKeysRef.current.zKey = false;
      moveKeysRef.current.digit5 = false;
      if (pointerLockInteraction.isGrabbingControl) {
        releaseActiveGrab(true);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isKomradGrabActive() || useGameStore.getState().siberiaGameOverActive) {
        return;
      }
      // Only rotate camera while Pointer Lock is active and no 3D control is held
      if (document.pointerLockElement !== gl.domElement) return;
      if (pointerLockInteraction.isGrabbingControl) return;

      const look = lookStateRef.current;
      look.targetYaw -= e.movementX * MOUSE_SENSITIVITY;
      look.targetPitch = THREE.MathUtils.clamp(
        look.targetPitch - e.movementY * MOUSE_SENSITIVITY,
        MIN_PITCH,
        MAX_PITCH,
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;
      if (isKomradGrabActive() || useGameStore.getState().siberiaGameOverActive) {
        if (
          e.code === "KeyE" ||
          e.key === "Escape" ||
          e.code === "Space" ||
          e.code === "Enter" ||
          (e.key >= "0" && e.key <= "7")
        ) {
          e.preventDefault();
        }
        return;
      }

      const mk = moveKeysRef.current;
      if (e.code === "KeyW") {
        mk.forward = true;
      } else if (e.code === "KeyS") {
        mk.backward = true;
      } else if (e.code === "KeyA") {
        mk.left = true;
      } else if (e.code === "KeyD") {
        mk.right = true;
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        mk.forward = true;
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        mk.backward = true;
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        mk.left = true;
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        mk.right = true;
      } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        mk.shift = true;
      } else if (e.code === "KeyZ") {
        mk.zKey = true;
      } else if (e.code === "Digit5") {
        mk.digit5 = true;
      }

      if (e.code === "KeyE" && !e.repeat) {
        const gs = useGameStore.getState();
        if (
          gs.phase === "playing" &&
          gs.isShiftControlReady &&
          !pointerLockInteraction.mainMenuOpen &&
          !pointerLockInteraction.debugMenuOpen &&
          !pointerLockInteraction.shiftTransitionActive
        ) {
          if (gs.isSeatedAtDesk) {
            e.preventDefault();
            standUpFromDesk(true);
            return;
          }
          if (checkWithinDeskRange(playerPosRef.current.x, playerPosRef.current.z)) {
            e.preventDefault();
            sitAtDesk();
            return;
          }
        }
      }

      if (e.key === "Escape") {
        const gs = useGameStore.getState();
        if (
          gs.phase === "playing" &&
          gs.isShiftControlReady &&
          gs.isSeatedAtDesk &&
          !pointerLockInteraction.mainMenuOpen &&
          !pointerLockInteraction.debugMenuOpen &&
          !pointerLockInteraction.shiftTransitionActive
        ) {
          e.preventDefault();
          standUpFromDesk(false);
          return;
        }
        glideTargetRef.current.active = false;
        return;
      }

      const leaveSeatedIfNeeded = () => {
        const gs = useGameStore.getState();
        if (gs.isSeatedAtDesk) {
          gs.setSeatedAtDesk(false);
        }
      };

      if (
        e.key >= "0" &&
        e.key <= "7" &&
        useGameStore.getState().lobbyMenuPhase !== "entered_control_room"
      ) {
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        leaveSeatedIfNeeded();
        syncStationSpot("reactor");
      } else if (e.key === "2") {
        e.preventDefault();
        leaveSeatedIfNeeded();
        syncStationSpot("terminal");
      } else if (e.key === "3") {
        e.preventDefault();
        leaveSeatedIfNeeded();
        syncStationSpot("power");
      } else if (e.key === "4") {
        e.preventDefault();
        if (!useGameStore.getState().isSeatedAtDesk) {
          syncStationSpot("inspector");
        }
      } else if (e.key === "5") {
        e.preventDefault();
        leaveSeatedIfNeeded();
        syncStationSpot("aux");
      } else if (e.key === "6") {
        e.preventDefault();
        leaveSeatedIfNeeded();
        applyBaySpot(UNIT_A2_SPOT, "power");
      } else if (e.key === "7") {
        e.preventDefault();
        leaveSeatedIfNeeded();
        syncStationSpot("aux");
      } else if (e.key === "0") {
        e.preventDefault();
        leaveSeatedIfNeeded();
        syncStationSpot("overview");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const mk = moveKeysRef.current;
      if (e.code === "KeyW" || e.code === "ArrowUp") {
        mk.forward = false;
      } else if (e.code === "KeyS" || e.code === "ArrowDown") {
        mk.backward = false;
      } else if (e.code === "KeyA" || e.code === "ArrowLeft") {
        mk.left = false;
      } else if (e.code === "KeyD" || e.code === "ArrowRight") {
        mk.right = false;
      } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        mk.shift = false;
      } else if (e.code === "KeyZ") {
        mk.zKey = false;
      } else if (e.code === "Digit5") {
        mk.digit5 = false;
      }
    };

    const canvas = gl.domElement;
    canvas.addEventListener("click", handleCanvasClick);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("pointerdown", handleCapturePointerDown, true);
    window.addEventListener("pointermove", handleCapturePointerMove, true);
    window.addEventListener("pointerup", handleCaptureVirtualEvent, true);
    window.addEventListener("pointercancel", handleCaptureVirtualEvent, true);
    window.addEventListener("click", handleCaptureVirtualEvent, true);
    window.addEventListener("dblclick", handleCaptureVirtualEvent, true);
    window.addEventListener("wheel", handleCaptureVirtualEvent, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointerdown", handleBubblePointerDown);
    window.addEventListener("pointerup", handleBubblePointerUp);
    window.addEventListener("pointercancel", handleBubblePointerUp);
    window.addEventListener("mouseup", handleBubbleMouseUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      abortKomradGrab();
      if (releaseRafRef.current) {
        window.cancelAnimationFrame(releaseRafRef.current);
      }
      setEvents({ compute: prevCompute });
      canvas.removeEventListener("click", handleCanvasClick);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange,
      );
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointerdown", handleCapturePointerDown, true);
      window.removeEventListener("pointermove", handleCapturePointerMove, true);
      window.removeEventListener("pointerup", handleCaptureVirtualEvent, true);
      window.removeEventListener(
        "pointercancel",
        handleCaptureVirtualEvent,
        true,
      );
      window.removeEventListener("click", handleCaptureVirtualEvent, true);
      window.removeEventListener("dblclick", handleCaptureVirtualEvent, true);
      window.removeEventListener("wheel", handleCaptureVirtualEvent, true);
      window.removeEventListener("pointerdown", handleBubblePointerDown);
      window.removeEventListener("pointerup", handleBubblePointerUp);
      window.removeEventListener("pointercancel", handleBubblePointerUp);
      window.removeEventListener("mouseup", handleBubbleMouseUp);
      window.removeEventListener("blur", handleWindowBlur);
      updatePointerLockInteraction({
        isPointerLocked: false,
        isHoveringControl: false,
        isGrabbingControl: false,
        isDragCapableGrab: false,
      });
    };
  }, [get, gl, refreshCenterHover, setActiveStation, setEvents]);

  useFrame((state, delta) => {
    const dt = Math.min(0.1, delta);
    const gs = useGameStore.getState();
    const look = lookStateRef.current;
    const mk = moveKeysRef.current;
    const isGrabbing = pointerLockInteraction.isGrabbingControl;
    const playerPos = playerPosRef.current;
    const vel = velocityRef.current;
    const glide = glideTargetRef.current;

    const returnedToLockedLobby =
      gs.lobbyMenuPhase === "menu_locked" &&
      (prevLobbyPhaseRef.current !== "menu_locked" ||
        gs.shiftRunId !== prevShiftRunIdRef.current);
    prevLobbyPhaseRef.current = gs.lobbyMenuPhase;
    prevShiftRunIdRef.current = gs.shiftRunId;

    if (returnedToLockedLobby) {
      playerPos.set(LOBBY_SPAWN_X, STANDING_EYE_Y, LOBBY_SPAWN_Z);
      currentEyeYRef.current = STANDING_EYE_Y;
      headBobOffsetRef.current = 0;
      headBobPhaseRef.current = 0;
      vel.vx = 0;
      vel.vz = 0;
      glide.active = false;
      rmbHeldRef.current = false;
      look.currentYaw = LOBBY_SPAWN_YAW;
      look.targetYaw = LOBBY_SPAWN_YAW;
      look.currentPitch = LOBBY_SPAWN_PITCH;
      look.targetPitch = LOBBY_SPAWN_PITCH;
      prevSeatedRef.current = false;
      skipNextPoseSyncRef.current = true;
      state.camera.position.set(LOBBY_SPAWN_X, STANDING_EYE_Y, LOBBY_SPAWN_Z);
      state.camera.rotation.order = "YXZ";
      state.camera.rotation.set(LOBBY_SPAWN_PITCH, LOBBY_SPAWN_YAW, 0, "YXZ");
      state.camera.rotation.z = 0;
      playerCameraPose.x = LOBBY_SPAWN_X;
      playerCameraPose.z = LOBBY_SPAWN_Z;
      playerCameraPose.yaw = LOBBY_SPAWN_YAW;
      playerCameraPose.isSeatedAtDesk = false;
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock?.();
      }
    }

    if (
      isKomradGrabActive() &&
      (gs.phase !== "playing" ||
        gs.lobbyMenuPhase !== "entered_control_room" ||
        (komradGrabState.phase !== "liquidating" && gs.isBlackout && !gs.isGodMode))
    ) {
      abortKomradGrab();
    }

    const komradGrabActive = isKomradGrabActive();

    if (komradGrabActive) {
      mk.forward = false;
      mk.backward = false;
      mk.left = false;
      mk.right = false;
      mk.shift = false;
      mk.zKey = false;
      mk.digit5 = false;
      vel.vx = 0;
      vel.vz = 0;
      glide.active = false;
      rmbHeldRef.current = false;
      if (pointerLockInteraction.isGrabbingControl) {
        activePointerIdRef.current = null;
        updatePointerLockInteraction({
          isGrabbingControl: false,
          isDragCapableGrab: false,
          isHoveringControl: false,
        });
      }

      if (komradGrabState.cameraSnapNeeded) {
        snapshotGrabCameraPose(
          playerPos.x,
          currentEyeYRef.current,
          playerPos.z,
          look.currentYaw,
          look.currentPitch,
        );
      }

      stepKomradGrab(dt);

      if (komradGrabState.liquidationCompletePending) {
        komradGrabState.liquidationCompletePending = false;
        gs.setSeatedAtDesk(false);
        gs.setSiberiaGameOverActive(true);
        if (document.pointerLockElement === gl.domElement) {
          document.exitPointerLock?.();
        }
        playKgbLiquidationStampThud();
      } else if (komradGrabState.seatedHandoffPending) {
        komradGrabState.seatedHandoffPending = false;
        playerPos.x = SEATED_DESK_POSE.x;
        playerPos.z = SEATED_DESK_POSE.z;
        currentEyeYRef.current = SEATED_DESK_POSE.y;
        headBobOffsetRef.current = 0;
        look.currentYaw = SEATED_DESK_POSE.yaw;
        look.targetYaw = SEATED_DESK_POSE.yaw;
        look.currentPitch = SEATED_DESK_POSE.pitch;
        look.targetPitch = SEATED_DESK_POSE.pitch;
        prevSeatedRef.current = true;
        state.camera.position.set(
          SEATED_DESK_POSE.x,
          SEATED_DESK_POSE.y,
          SEATED_DESK_POSE.z,
        );
        state.camera.rotation.order = "YXZ";
        state.camera.rotation.set(
          SEATED_DESK_POSE.pitch,
          SEATED_DESK_POSE.yaw,
          0,
          "YXZ",
        );
        state.camera.rotation.z = 0;
        skipNextPoseSyncRef.current = gs.activeStation !== "inspector";
        gs.setSeatedAtDesk(true);
        setActiveStation("inspector");
        if (document.pointerLockElement === gl.domElement) {
          document.exitPointerLock?.();
        }
        playSwitchClank(true);
      } else {
        playerPos.x = komradGrabState.camX;
        playerPos.z = komradGrabState.camZ;
        currentEyeYRef.current = komradGrabState.camY;
        headBobOffsetRef.current = 0;
        look.currentYaw = komradGrabState.camYaw;
        look.targetYaw = komradGrabState.camYaw;
        look.currentPitch = komradGrabState.camPitch;
        look.targetPitch = komradGrabState.camPitch;
        state.camera.position.set(
          komradGrabState.camX,
          komradGrabState.camY,
          komradGrabState.camZ,
        );
        state.camera.rotation.order = "YXZ";
        state.camera.rotation.set(
          komradGrabState.camPitch,
          komradGrabState.camYaw,
          komradGrabState.camRoll,
          "YXZ",
        );
      }
    }

    const isSeatedNow = useGameStore.getState().isSeatedAtDesk;
    const isSeated = isSeatedNow;
    const canMove =
      !komradGrabActive &&
      !gs.siberiaGameOverActive &&
      gs.phase === "playing" &&
      !isSeated &&
      !isGrabbing &&
      !pointerLockInteraction.mainMenuOpen &&
      !pointerLockInteraction.debugMenuOpen &&
      !pointerLockInteraction.shiftTransitionActive;

    const nearDesk =
      !komradGrabActive &&
      gs.lobbyMenuPhase === "entered_control_room" &&
      !isSeated &&
      checkWithinDeskRange(playerPos.x, playerPos.z);
    if (nearDesk !== gs.canSitAtDesk) {
      gs.setCanSitAtDesk(nearDesk);
    }

    if (!komradGrabActive && prevSeatedRef.current && !isSeated && !glide.active) {
      look.targetYaw = setShortestTargetYaw(
        look.currentYaw,
        STAND_UP_SPOT.yaw,
      );
      look.targetPitch = -0.06;
      glide.active = true;
      glide.x = STAND_UP_SPOT.x;
      glide.z = STAND_UP_SPOT.z;
    }
    prevSeatedRef.current = isSeated;

    if (komradGrabActive) {
      // Camera pose driven above by komradGrabState
    } else if (isSeated) {
      glide.active = false;
      vel.vx = 0;
      vel.vz = 0;
      const nextSeatedX = THREE.MathUtils.damp(
        playerPos.x,
        SEATED_DESK_POSE.x,
        14,
        dt,
      );
      const nextSeatedZ = THREE.MathUtils.damp(
        playerPos.z,
        SEATED_DESK_POSE.z,
        14,
        dt,
      );
      playerPos.x =
        Math.abs(SEATED_DESK_POSE.x - nextSeatedX) < 1e-4
          ? SEATED_DESK_POSE.x
          : nextSeatedX;
      playerPos.z =
        Math.abs(SEATED_DESK_POSE.z - nextSeatedZ) < 1e-4
          ? SEATED_DESK_POSE.z
          : nextSeatedZ;

      const nextSeatedY = THREE.MathUtils.damp(
        currentEyeYRef.current,
        SEATED_DESK_POSE.y,
        14,
        dt,
      );
      currentEyeYRef.current =
        Math.abs(SEATED_DESK_POSE.y - nextSeatedY) < 1e-4
          ? SEATED_DESK_POSE.y
          : nextSeatedY;

      const nextSeatedBob = THREE.MathUtils.damp(
        headBobOffsetRef.current,
        0,
        14,
        dt,
      );
      headBobOffsetRef.current =
        Math.abs(nextSeatedBob) < 1e-5 ? 0 : nextSeatedBob;

      look.targetYaw = setShortestTargetYaw(
        look.currentYaw,
        SEATED_DESK_POSE.yaw,
      );
      look.targetPitch = SEATED_DESK_POSE.pitch;
      const nextSeatedYaw = THREE.MathUtils.damp(
        look.currentYaw,
        look.targetYaw,
        14,
        dt,
      );
      const nextSeatedPitch = THREE.MathUtils.damp(
        look.currentPitch,
        look.targetPitch,
        14,
        dt,
      );
      look.currentYaw =
        Math.abs(look.targetYaw - nextSeatedYaw) < 1e-4
          ? look.targetYaw
          : nextSeatedYaw;
      look.currentPitch =
        Math.abs(look.targetPitch - nextSeatedPitch) < 1e-4
          ? look.targetPitch
          : nextSeatedPitch;

      state.camera.position.set(
        playerPos.x,
        currentEyeYRef.current + headBobOffsetRef.current,
        playerPos.z,
      );
      state.camera.rotation.order = "YXZ";
      state.camera.rotation.set(look.currentPitch, look.currentYaw, 0, "YXZ");
      state.camera.rotation.z = 0;
    } else {
      // Preserve Shift+A+Z+5 easter egg and Shift fine-tuning: disable strafe/sprint during A+Z+5 chord
      const isAz5Chord = mk.shift && (mk.zKey || mk.digit5);
      const moveForward = Number(mk.forward) - Number(mk.backward);
      const moveRight = Number(mk.right) - Number(isAz5Chord ? false : mk.left);

      if (canMove && (moveForward !== 0 || moveRight !== 0)) {
        glideTargetRef.current.active = false;
      }

      look.targetPitch = THREE.MathUtils.clamp(
        look.targetPitch,
        MIN_PITCH,
        MAX_PITCH,
      );

      if (isGrabbing) {
        // Lock camera yaw & pitch rock-solid while LMB is dragging a physical 3D control
        look.targetYaw = look.currentYaw;
        look.targetPitch = look.currentPitch;
      } else {
        const nextYaw = THREE.MathUtils.damp(
          look.currentYaw,
          look.targetYaw,
          18,
          dt,
        );
        const nextPitch = THREE.MathUtils.damp(
          look.currentPitch,
          look.targetPitch,
          18,
          dt,
        );
        look.currentYaw =
          Math.abs(look.targetYaw - nextYaw) < 1e-4 ? look.targetYaw : nextYaw;
        look.currentPitch =
          Math.abs(look.targetPitch - nextPitch) < 1e-4
            ? look.targetPitch
            : nextPitch;
      }

      if (isGrabbing) {
        vel.vx = 0;
        vel.vz = 0;
        glide.active = false;
      } else if (glide.active && canMove) {
        const prevX = playerPos.x;
        const prevZ = playerPos.z;
        const doorPassable =
          airlockDoorState.openProgress > AIRLOCK_PASSABLE_OPEN_THRESHOLD;
        let stepTargetX = glide.x;
        let stepTargetZ = glide.z;
        if (playerPos.z > 4.06 && glide.z < 4.06) {
          stepTargetX = 0;
          stepTargetZ = doorPassable ? 3.95 : 5.15;
        }
        playerPos.x = THREE.MathUtils.damp(playerPos.x, stepTargetX, 7.5, dt);
        playerPos.z = THREE.MathUtils.damp(playerPos.z, stepTargetZ, 7.5, dt);
        resolveControlRoomCollisions(playerPos, prevX, prevZ);
        vel.vx = dt > 1e-4 ? (playerPos.x - prevX) / dt : 0;
        vel.vz = dt > 1e-4 ? (playerPos.z - prevZ) / dt : 0;
        if (Math.hypot(glide.x - playerPos.x, glide.z - playerPos.z) < 0.025) {
          glide.active = false;
        }
      } else {
        const fx = -Math.sin(look.currentYaw);
        const fz = -Math.cos(look.currentYaw);
        const rx = Math.cos(look.currentYaw);
        const rz = -Math.sin(look.currentYaw);

        let wishX = fx * moveForward + rx * moveRight;
        let wishZ = fz * moveForward + rz * moveRight;
        const wishLen = Math.hypot(wishX, wishZ);
        if (wishLen > 1e-5) {
          wishX /= wishLen;
          wishZ /= wishLen;
        } else {
          wishX = 0;
          wishZ = 0;
        }

        const canSprint = canMove && mk.shift && !isAz5Chord;
        const speed = canMove ? (canSprint ? SPRINT_SPEED : WALK_SPEED) : 0;
        vel.vx = THREE.MathUtils.damp(vel.vx, wishX * speed, VELOCITY_DAMP, dt);
        vel.vz = THREE.MathUtils.damp(vel.vz, wishZ * speed, VELOCITY_DAMP, dt);

        const dampedSpeed = Math.hypot(vel.vx, vel.vz);
        if ((speed === 0 || (wishX === 0 && wishZ === 0)) && dampedSpeed < 0.01) {
          vel.vx = 0;
          vel.vz = 0;
        }

        if (vel.vx !== 0 || vel.vz !== 0) {
          const prevX = playerPos.x;
          const prevZ = playerPos.z;
          playerPos.x += vel.vx * dt;
          playerPos.z += vel.vz * dt;
          resolveControlRoomCollisions(playerPos, prevX, prevZ);
        }
      }

      const horizSpeed = Math.hypot(vel.vx, vel.vz);
      if (!isGrabbing && canMove && horizSpeed > 0.12) {
        headBobPhaseRef.current += dt * (8.5 + horizSpeed * 1.15);
        const targetBob =
          Math.sin(headBobPhaseRef.current) *
          HEAD_BOB_AMPLITUDE *
          Math.min(1, horizSpeed / WALK_SPEED);
        headBobOffsetRef.current = THREE.MathUtils.damp(
          headBobOffsetRef.current,
          targetBob,
          14,
          dt,
        );
      } else if (horizSpeed < 0.01) {
        // Zero out camera head-bob completely when standing still so Bayer dither stays rock-solid
        headBobOffsetRef.current = 0;
      } else {
        const nextBob = THREE.MathUtils.damp(
          headBobOffsetRef.current,
          0,
          14,
          dt,
        );
        headBobOffsetRef.current = Math.abs(nextBob) < 1e-5 ? 0 : nextBob;
      }

      const nextStandingY = THREE.MathUtils.damp(
        currentEyeYRef.current,
        STANDING_EYE_Y,
        14,
        dt,
      );
      currentEyeYRef.current =
        Math.abs(STANDING_EYE_Y - nextStandingY) < 1e-4
          ? STANDING_EYE_Y
          : nextStandingY;
      state.camera.position.set(
        playerPos.x,
        currentEyeYRef.current + headBobOffsetRef.current,
        playerPos.z,
      );
      state.camera.rotation.order = "YXZ";
      state.camera.rotation.set(look.currentPitch, look.currentYaw, 0, "YXZ");
      state.camera.rotation.z = 0;
    }

    playerCameraPose.x = playerPos.x;
    playerCameraPose.z = playerPos.z;
    playerCameraPose.yaw = look.currentYaw;
    playerCameraPose.isSeatedAtDesk = isSeated;

    const isRmbFocus =
      rmbHeldRef.current &&
      gs.phase === "playing" &&
      !gs.siberiaGameOverActive &&
      !isGrabbing &&
      !komradGrabActive;
    const baseFov =
      isSeated || komradGrabState.phase === "dropping"
        ? SEATED_DESK_POSE.fov
        : BASE_FOV;
    const zoomFov = isSeated ? RMB_SEATED_ZOOM_FOV : RMB_ZOOM_FOV;
    const targetFov = isRmbFocus ? zoomFov : baseFov;

    if (state.camera instanceof THREE.PerspectiveCamera) {
      let projDirty = false;
      if (Math.abs(state.camera.near - 0.12) > 1e-4) {
        state.camera.near = 0.12;
        projDirty = true;
      }
      if (Math.abs(state.camera.far - 150) > 1e-3) {
        state.camera.far = 150;
        projDirty = true;
      }
      const nextFov = THREE.MathUtils.damp(
        state.camera.fov,
        targetFov,
        10,
        dt,
      );
      const snappedFov =
        Math.abs(targetFov - nextFov) <= 0.02 ? targetFov : nextFov;
      if (Math.abs(snappedFov - state.camera.fov) > 1e-4) {
        state.camera.fov = snappedFov;
        projDirty = true;
      }
      if (projDirty) {
        state.camera.updateProjectionMatrix();
      }
    }

    // Refresh center-reticle hover state & R3F tooltips during walking or head-turns
    if (document.pointerLockElement === gl.domElement && !isGrabbing) {
      const hp = hoverPollStateRef.current;
      const elapsed = state.clock.elapsedTime;
      const moved =
        Math.abs(state.camera.position.x - hp.lastCamX) > 1e-4 ||
        Math.abs(state.camera.position.y - hp.lastCamY) > 1e-4 ||
        Math.abs(state.camera.position.z - hp.lastCamZ) > 1e-4 ||
        Math.abs(look.currentYaw - hp.lastYaw) > 1e-4 ||
        Math.abs(look.currentPitch - hp.lastPitch) > 1e-4;

      if (moved || elapsed - hp.lastCheckElapsed >= 0.08) {
        hp.lastCamX = state.camera.position.x;
        hp.lastCamY = state.camera.position.y;
        hp.lastCamZ = state.camera.position.z;
        hp.lastYaw = look.currentYaw;
        hp.lastPitch = look.currentPitch;
        hp.lastCheckElapsed = elapsed;

        if (moved) {
          if (!state.internal.lastEvent.current) {
            const rect = gl.domElement.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const seed = new PointerEvent("pointermove", {
              clientX: rect.left + cx,
              clientY: rect.top + cy,
            });
            stampEventVirtualCoords(seed, cx, cy, rect);
            state.internal.lastEvent.current = seed;
          }
          state.events.update?.();
          let hovering = false;
          for (const ev of state.internal.hovered.values()) {
            if (hasHoverableControlHandler(ev.object)) {
              hovering = true;
              break;
            }
          }
          if (pointerLockInteraction.isHoveringControl !== hovering) {
            updatePointerLockInteraction({ isHoveringControl: hovering });
          }
        } else {
          refreshCenterHover(state);
        }
      }
    }
  });

  return null;
};
