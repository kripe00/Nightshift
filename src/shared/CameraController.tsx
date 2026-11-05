import { useFrame } from '@react-three/fiber'
import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CameraStation } from './types'
import { useGameStore } from './useGameStore'

interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
}

const STATION_CAMERA_POSES: Record<CameraStation, CameraPose> = {
  overview: {
    position: [0, 1.55, 2.55],
    target: [0, 1.25, -1.45],
    fov: 55,
  },
  reactor: {
    position: [-1.05, 1.56, 0.12],
    target: [-2.15, 1.48, -1.08],
    fov: 45,
  },
  power: {
    position: [-1.02, 0.88, 0.15],
    target: [-2.15, 0.52, -1.08],
    fov: 44,
  },
  terminal: {
    position: [0, 1.38, -0.18],
    target: [0, 1.28, -1.55],
    fov: 44,
  },
  inspector: {
    position: [1.12, 1.58, 0.08],
    target: [2.12, 1.02, -1.05],
    fov: 44,
  },
}

export const CameraController: React.FC = () => {
  const activeStation = useGameStore((s) => s.activeStation)
  const setActiveStation = useGameStore((s) => s.setActiveStation)

  const currentPosRef = useRef(new THREE.Vector3(0, 1.55, 2.55))
  const currentLookAtRef = useRef(new THREE.Vector3(0, 1.25, -1.45))
  const desiredPosRef = useRef(new THREE.Vector3())
  const desiredLookAtRef = useRef(new THREE.Vector3())

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
  })

  useEffect(() => {
    const isTypingInInput = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      )
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return

      if (e.key === '1') {
        e.preventDefault()
        setActiveStation('reactor')
      } else if (e.key === '2') {
        e.preventDefault()
        setActiveStation('terminal')
      } else if (e.key === '3') {
        e.preventDefault()
        setActiveStation('power')
      } else if (e.key === '4') {
        e.preventDefault()
        setActiveStation('inspector')
      } else if (e.key === 'Escape' || e.key === '0') {
        e.preventDefault()
        setActiveStation('overview')
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        lookStateRef.current.keysHeld.left = true
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        lookStateRef.current.keysHeld.right = true
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        lookStateRef.current.keysHeld.up = true
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        lookStateRef.current.keysHeld.down = true
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        lookStateRef.current.keysHeld.left = false
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        lookStateRef.current.keysHeld.right = false
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        lookStateRef.current.keysHeld.up = false
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        lookStateRef.current.keysHeld.down = false
      }
    }

    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1
      lookStateRef.current.pointerX = THREE.MathUtils.clamp(nx, -1, 1)
      lookStateRef.current.pointerY = THREE.MathUtils.clamp(ny, -1, 1)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [setActiveStation])

  useFrame((state, delta) => {
    const dt = Math.min(0.1, delta)
    const pose = STATION_CAMERA_POSES[activeStation]
    const look = lookStateRef.current

    if (activeStation === 'overview') {
      const yawSpeed = 1.4
      const pitchSpeed = 0.85
      if (look.keysHeld.left) look.keyYaw += yawSpeed * dt
      if (look.keysHeld.right) look.keyYaw -= yawSpeed * dt
      if (look.keysHeld.up) look.keyPitch += pitchSpeed * dt
      if (look.keysHeld.down) look.keyPitch -= pitchSpeed * dt

      look.keyYaw = THREE.MathUtils.clamp(look.keyYaw, -0.75, 0.75)
      look.keyPitch = THREE.MathUtils.clamp(look.keyPitch, -0.28, 0.28)

      // Combine keyboard head-turn with pointer look so surveying the bunker creates blind spots
      const totalYaw = THREE.MathUtils.clamp(
        look.keyYaw - look.pointerX * 0.55,
        -0.95,
        0.95
      )
      const totalPitch = THREE.MathUtils.clamp(
        look.keyPitch - look.pointerY * 0.25,
        -0.35,
        0.35
      )

      desiredPosRef.current.set(
        pose.position[0] - totalYaw * 0.2,
        pose.position[1] + totalPitch * 0.08,
        pose.position[2]
      )

      const lookDist = 4.2
      desiredLookAtRef.current.set(
        pose.position[0] - Math.sin(totalYaw) * lookDist,
        pose.target[1] + totalPitch * 1.45,
        pose.position[2] - Math.cos(totalYaw) * lookDist
      )
    } else {
      look.keyYaw = THREE.MathUtils.lerp(look.keyYaw, 0, dt * 6)
      look.keyPitch = THREE.MathUtils.lerp(look.keyPitch, 0, dt * 6)

      desiredPosRef.current.set(
        pose.position[0] + look.pointerX * 0.015,
        pose.position[1] - look.pointerY * 0.012,
        pose.position[2]
      )
      desiredLookAtRef.current.set(
        pose.target[0],
        pose.target[1],
        pose.target[2]
      )
    }

    const smoothFactor = 1 - Math.exp(-7.5 * dt)
    currentPosRef.current.lerp(desiredPosRef.current, smoothFactor)
    currentLookAtRef.current.lerp(desiredLookAtRef.current, smoothFactor)

    state.camera.position.copy(currentPosRef.current)
    state.camera.lookAt(currentLookAtRef.current)

    if (state.camera instanceof THREE.PerspectiveCamera) {
      const nextFov = THREE.MathUtils.lerp(state.camera.fov, pose.fov, smoothFactor)
      if (Math.abs(nextFov - state.camera.fov) > 0.02) {
        state.camera.fov = nextFov
        state.camera.updateProjectionMatrix()
      }
    }
  })

  return null
}
