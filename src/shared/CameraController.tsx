import { type RootState, useFrame, useThree } from "@react-three/fiber";
import React, { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { create } from "zustand";
import { playSwitchClank } from "../modules/reactor/audioSynth";
import {
  canEngageCanvasPointerLock,
  classifyPressTarget,
  hasHoverableControlHandler,
  installSafePointerCaptureShim,
  isObjectTreeVisible,
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
const WALK_SPEED = 3.0;
const SPRINT_SPEED = 4.4;
const VELOCITY_DAMP = 14;
const HEAD_BOB_AMPLITUDE = 0.012;
const BASE_FOV = 68;
const RMB_ZOOM_FOV = 46;
const REACH_MAX_DIST = 2.6;
const GRAB_ACTIVE_FAR = 6.0;
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
  x: -0.05,
  y: 1.52,
  z: 2.42,
  yaw: 0,
  pitch: -0.86,
  fov: 62,
} as const;
const RMB_SEATED_ZOOM_FOV = 42;

const STAND_UP_SPOT: BayStandingSpot = {
  x: -0.05,
  z: 3.06,
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
    z: 0.52,
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
    // [3] Right Operator Desk outer bay (`UNIT B`): Drum Separators & Coolant Loop (1.162x scale)
    x: 4.22,
    z: 0.35,
    yaw: -(18 * Math.PI) / 180,
    pitch: -0.22,
  },
  inspector: {
    // [4] Shift Supervisor Desk (`Стол НСБ`): standing on +Z side facing desk & console row
    x: 0.05,
    z: 2.56,
    yaw: 0,
    pitch: -0.56,
  },
  aux: {
    // [5] Right Operator Desk (`UNIT C`): Energy Storage & Grid Dispatch (1.162x scale)
    x: 2.58,
    z: -0.19,
    yaw: -(18 * Math.PI) / 180,
    pitch: -0.22,
  },
};

const UNIT_A2_SPOT: BayStandingSpot = {
  // [6] Left Operator Desk left bay (`UNIT A-2`): RBMK Core & Control Rods
  x: -4.0,
  z: 0.08,
  yaw: (15 * Math.PI) / 180,
  pitch: -0.24,
};

const UNIT_D_SPOT: BayStandingSpot = {
  // [7] Left-Wall Electrical Switchgear (`UNIT D`): Main Breaker, Steam Vent & Fuses
  x: -3.98,
  z: 1.42,
  yaw: Math.PI / 2,
  pitch: -0.14,
};

interface ColliderOBB {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
}

const CONTROL_ROOM_COLLIDERS: readonly ColliderOBB[] = [
  // Front Synoptic Wall (`Мнемосхема`) Monumental CRT Bay & Angled Wings
  { cx: 0.0, cz: -3.86, halfW: 1.98, halfD: 0.42, rotY: 0 },
  { cx: -3.9, cz: -3.62, halfW: 1.88, halfD: 0.3, rotY: 0.21 },
  { cx: 3.9, cz: -3.62, halfW: 1.88, halfD: 0.3, rotY: -0.21 },
  // Split Two-Wing Operator Console Desks (`Левое и Правое Крыло Пульта БЩУ`)
  { cx: -3.61, cz: -1.49, halfW: 1.68, halfD: 0.68, rotY: (15 * Math.PI) / 180 },
  { cx: 3.86, cz: -1.36, halfW: 1.78, halfD: 0.72, rotY: -(18 * Math.PI) / 180 },
  // Shift Supervisor Desk (`Стол НСБ` — `InspectorDesk3D` at `(0, 0.06, +1.80)`)
  { cx: 0.0, cz: 1.8, halfW: 1.28, halfD: 0.46, rotY: 0 },
  // Left-Wall Tucked-Back `UNIT D` HV Switchgear Enclosure (`x = -5.18, z = +1.42`)
  { cx: -5.56, cz: 1.42, halfW: 0.72, halfD: 1.84, rotY: 0 },
  // Corner `СМ-2М` Magnetic Tape Computer Cabinets & Rear Fire-Shield Sand Box
  { cx: -5.6, cz: -2.56, halfW: 0.36, halfD: 0.8, rotY: 0 },
  { cx: 5.56, cz: -2.5, halfW: 0.34, halfD: 0.56, rotY: 0 },
  { cx: -4.05, cz: 4.3, halfW: 0.52, halfD: 0.22, rotY: 0 },
  // Right-Window Duty Radio Side Table (`Столик дежурного` + `ОКЕАН-84` at `x = +5.58, z = +1.58`)
  { cx: 5.58, cz: 1.58, halfW: 0.28, halfD: 0.43, rotY: 0 },
];

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

function resolveControlRoomCollisions(pos: THREE.Vector3): void {
  for (let pass = 0; pass < 2; pass++) {
    pos.x = THREE.MathUtils.clamp(pos.x, -5.48, 5.48);
    pos.z = THREE.MathUtils.clamp(pos.z, -3.42, 4.08);
    for (let i = 0; i < CONTROL_ROOM_COLLIDERS.length; i++) {
      pushCircleOutOfOBB(pos, PLAYER_RADIUS, CONTROL_ROOM_COLLIDERS[i]);
    }
  }
  pos.x = THREE.MathUtils.clamp(pos.x, -5.48, 5.48);
  pos.z = THREE.MathUtils.clamp(pos.z, -3.42, 4.08);
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

  const playerPosRef = useRef(
    new THREE.Vector3(SPAWN_X, STANDING_EYE_Y, SPAWN_Z),
  );
  const currentEyeYRef = useRef(STANDING_EYE_Y);
  const velocityRef = useRef({ vx: 0, vz: 0 });
  const headBobPhaseRef = useRef(0);
  const headBobOffsetRef = useRef(0);

  const lookStateRef = useRef({
    targetYaw: BAY_STANDING_SPOTS.overview.yaw,
    targetPitch: BAY_STANDING_SPOTS.overview.pitch,
    currentYaw: BAY_STANDING_SPOTS.overview.yaw,
    currentPitch: BAY_STANDING_SPOTS.overview.pitch,
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
    x: SPAWN_X,
    z: SPAWN_Z,
  });
  const rmbHeldRef = useRef<boolean>(false);

  const skipNextPoseSyncRef = useRef<boolean>(false);
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
    raycaster.far = gs.phase !== "playing" ? MENU_FAR : REACH_MAX_DIST;
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

  // Glide smoothly to station standing spot when activeStation changes via [0]-[5] or UI
  useEffect(() => {
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

  // Auto-exit Pointer Lock and clear held locomotion keys when gameplay pauses or seated at Inspector Desk
  useEffect(() => {
    if (isSeatedAtDesk || phase !== "playing") {
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
        !canEngageCanvasPointerLock(gs.phase, gs.isSeatedAtDesk) &&
        document.pointerLockElement === gl.domElement
      ) {
        document.exitPointerLock?.();
      }
    };
    syncAllowedLock();
    return subscribePointerLockInteraction(syncAllowedLock);
  }, [gl, phase, isSeatedAtDesk]);

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
          pointerLockInteraction.isGrabbingControl || gs.isSeatedAtDesk
            ? GRAB_ACTIVE_FAR
            : gs.phase !== "playing"
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
      if (!canEngageCanvasPointerLock(gs.phase, gs.isSeatedAtDesk)) return;
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
          !pointerLockInteraction.mainMenuOpen &&
          !pointerLockInteraction.debugMenuOpen
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
          gs.isSeatedAtDesk &&
          !pointerLockInteraction.mainMenuOpen &&
          !pointerLockInteraction.debugMenuOpen
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
        applyBaySpot(UNIT_D_SPOT, "aux");
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
    const isSeated = gs.isSeatedAtDesk;
    const canMove = gs.phase === "playing" && !isSeated && !isGrabbing;

    const playerPos = playerPosRef.current;
    const vel = velocityRef.current;
    const glide = glideTargetRef.current;

    const nearDesk = !isSeated && checkWithinDeskRange(playerPos.x, playerPos.z);
    if (nearDesk !== gs.canSitAtDesk) {
      gs.setCanSitAtDesk(nearDesk);
    }

    if (isSeated) {
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
        playerPos.x = THREE.MathUtils.damp(playerPos.x, glide.x, 7.5, dt);
        playerPos.z = THREE.MathUtils.damp(playerPos.z, glide.z, 7.5, dt);
        resolveControlRoomCollisions(playerPos);
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
          playerPos.x += vel.vx * dt;
          playerPos.z += vel.vz * dt;
          resolveControlRoomCollisions(playerPos);
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

    const isRmbFocus =
      rmbHeldRef.current &&
      gs.phase === "playing" &&
      !isGrabbing;
    const baseFov = isSeated ? SEATED_DESK_POSE.fov : BASE_FOV;
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

        refreshCenterHover(state);

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
        }
      }
    }
  });

  return null;
};
