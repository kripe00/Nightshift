import type * as THREE from 'three'

export interface PointerLockInteractionSnapshot {
  isPointerLocked: boolean
  isHoveringControl: boolean
  isGrabbingControl: boolean
  isDragCapableGrab: boolean
  virtualX: number
  virtualY: number
  debugMenuOpen: boolean
  mainMenuOpen: boolean
  shiftTransitionActive: boolean
}

export const pointerLockInteraction: PointerLockInteractionSnapshot = {
  isPointerLocked: false,
  isHoveringControl: false,
  isGrabbingControl: false,
  isDragCapableGrab: false,
  virtualX: 0,
  virtualY: 0,
  debugMenuOpen: false,
  mainMenuOpen: true,
  shiftTransitionActive: false,
}

const listeners = new Set<() => void>()

export function subscribePointerLockInteraction(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function updatePointerLockInteraction(
  partial: Partial<PointerLockInteractionSnapshot>,
): void {
  const prevLocked = pointerLockInteraction.isPointerLocked
  const prevHover = pointerLockInteraction.isHoveringControl
  const prevGrab = pointerLockInteraction.isGrabbingControl
  const prevDebug = pointerLockInteraction.debugMenuOpen
  const prevMain = pointerLockInteraction.mainMenuOpen
  const prevTransition = pointerLockInteraction.shiftTransitionActive

  Object.assign(pointerLockInteraction, partial)

  if (
    prevLocked !== pointerLockInteraction.isPointerLocked ||
    prevHover !== pointerLockInteraction.isHoveringControl ||
    prevGrab !== pointerLockInteraction.isGrabbingControl ||
    prevDebug !== pointerLockInteraction.debugMenuOpen ||
    prevMain !== pointerLockInteraction.mainMenuOpen ||
    prevTransition !== pointerLockInteraction.shiftTransitionActive
  ) {
    listeners.forEach((listener) => listener())
  }
}

export function canEngageCanvasPointerLock(
  phase: string,
  isSeatedAtDesk: boolean,
): boolean {
  return (
    phase === 'playing' &&
    !isSeatedAtDesk &&
    !pointerLockInteraction.debugMenuOpen &&
    !pointerLockInteraction.mainMenuOpen &&
    !pointerLockInteraction.shiftTransitionActive
  )
}

let pointerCaptureShimInstalled = false

/**
 * Under Pointer Lock, browsers throw InvalidStateError if setPointerCapture is called.
 * Deferring to a no-op while locked lets R3F record its internal.capturedMap cleanly
 * so hold-and-drag gestures work 1:1 without modifying individual 3D meshes.
 */
export function installSafePointerCaptureShim(): void {
  if (pointerCaptureShimInstalled || typeof Element === 'undefined') return
  pointerCaptureShimInstalled = true

  const proto = Element.prototype
  const origSet = proto.setPointerCapture
  const origRelease = proto.releasePointerCapture

  proto.setPointerCapture = function patchedSetPointerCapture(pointerId: number) {
    if (document.pointerLockElement !== null) return
    try {
      origSet.call(this, pointerId)
    } catch {
      // Ignore synthetic or inactive pointerId capture errors
    }
  }

  proto.releasePointerCapture = function patchedReleasePointerCapture(
    pointerId: number,
  ) {
    if (document.pointerLockElement !== null) return
    try {
      origRelease.call(this, pointerId)
    } catch {
      // Ignore release errors when capture is inactive
    }
  }
}

interface R3FHandlers {
  onPointerDown?: unknown
  onClick?: unknown
  onDoubleClick?: unknown
  onWheel?: unknown
}

interface R3FObjectLike extends THREE.Object3D {
  __r3f?: {
    eventCount?: number
    handlers?: R3FHandlers
  }
}

export function isObjectTreeVisible(obj: THREE.Object3D | null): boolean {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (!cur.visible) return false
    cur = cur.parent
  }
  return true
}

export function hasHoverableControlHandler(obj: THREE.Object3D | null): boolean {
  let cur = obj as R3FObjectLike | null
  while (cur) {
    const handlers = cur.__r3f?.handlers
    if (
      handlers &&
      (handlers.onPointerDown ||
        handlers.onClick ||
        handlers.onDoubleClick ||
        handlers.onWheel)
    ) {
      return true
    }
    cur = cur.parent as R3FObjectLike | null
  }
  return false
}

export function classifyPressTarget(objects: readonly THREE.Object3D[]): {
  interactive: boolean
  draggable: boolean
} {
  let interactive = false
  let draggable = false
  for (let i = 0; i < objects.length; i++) {
    let cur = objects[i] as R3FObjectLike | null
    while (cur) {
      const handlers = cur.__r3f?.handlers
      if (handlers) {
        if (handlers.onPointerDown) {
          draggable = true
          interactive = true
          return { interactive, draggable }
        }
        if (handlers.onClick || handlers.onDoubleClick) {
          interactive = true
        }
      }
      cur = cur.parent as R3FObjectLike | null
    }
  }
  return { interactive, draggable }
}
