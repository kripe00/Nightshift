import { Canvas } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { playKnifeSwitchSlam } from './modules/inspector/audio'
import { playSwitchClank } from './modules/reactor/audioSynth'
import {
  startSoundtrack,
  updateSoundtrackState,
} from './modules/reactor/soundtrackPlayer'
import { ControlRoomScene } from './shared/ControlRoomScene'
import { DebugMenu } from './shared/DebugMenu'
import { MainMenuOverlay } from './shared/MainMenuOverlay'
import {
  pointerLockInteraction,
  subscribePointerLockInteraction,
} from './shared/pointerLockState'
import { useGameStore } from './shared/useGameStore'

function CenterReticle() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const idleDotRef = useRef<HTMLSpanElement | null>(null)
  const hoverRingRef = useRef<HTMLSpanElement | null>(null)
  const grabBracketRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const apply = () => {
      const root = rootRef.current
      if (!root) return
      const gs = useGameStore.getState()
      const visible =
        gs.phase === 'playing' &&
        pointerLockInteraction.isPointerLocked &&
        !gs.wePadInspecting &&
        !pointerLockInteraction.debugMenuOpen &&
        !pointerLockInteraction.mainMenuOpen

      root.style.display = visible ? 'flex' : 'none'
      if (!visible) return

      const grabbing = pointerLockInteraction.isGrabbingControl
      const hovering = pointerLockInteraction.isHoveringControl

      if (idleDotRef.current) {
        idleDotRef.current.style.display =
          !grabbing && !hovering ? 'block' : 'none'
      }
      if (hoverRingRef.current) {
        hoverRingRef.current.style.display =
          !grabbing && hovering ? 'block' : 'none'
      }
      if (grabBracketRef.current) {
        grabBracketRef.current.style.display = grabbing ? 'inline-block' : 'none'
      }
    }

    apply()
    const unsubLock = subscribePointerLockInteraction(apply)
    const unsubGame = useGameStore.subscribe(apply)
    return () => {
      unsubLock()
      unsubGame()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      style={{ display: 'none' }}
      className="pointer-events-none fixed top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 items-center justify-center select-none"
    >
      <span
        ref={idleDotRef}
        style={{
          width: '3px',
          height: '3px',
          borderRadius: '9999px',
          backgroundColor: '#f3ebd8',
          opacity: 0.45,
          boxShadow: '0 0 2px rgba(0, 0, 0, 0.85)',
        }}
      />
      <span
        ref={hoverRingRef}
        style={{
          display: 'none',
          width: '10px',
          height: '10px',
          borderRadius: '9999px',
          border: '1.5px solid #f3ebd8',
          backgroundColor: 'transparent',
          opacity: 0.85,
          boxShadow: '0 0 3px rgba(0, 0, 0, 0.85)',
        }}
      />
      <span
        ref={grabBracketRef}
        style={{
          display: 'none',
          color: '#ffb000',
          fontFamily: '"VT323", "Courier Prime", monospace',
          fontSize: '15px',
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '0.5px',
          opacity: 0.95,
          textShadow: '0 0 4px rgba(0, 0, 0, 0.95)',
        }}
      >
        ( · )
      </span>
    </div>
  )
}

export function App() {
  const phase = useGameStore((s) => s.phase)
  const tick = useGameStore((s) => s.tick)
  const isMusicMuted = useGameStore((s) => s.isMusicMuted)
  const diagFeedActive = useGameStore((s) => s.diagFeedActive)
  const wePadInspecting = useGameStore((s) => s.wePadInspecting)

  useEffect(() => {
    if (phase !== 'playing') return
    const interval = window.setInterval(() => {
      tick()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [phase, tick])

  // Start soundtrack automatically on first user gesture (click or key press anywhere in the bunker)
  // and keep mute / redline state continuously synchronized even before pulling the Main Breaker!
  useEffect(() => {
    const syncSoundtrack = () => {
      const s = useGameStore.getState()
      const totalMW =
        s.powerAllocation.cooling +
        s.powerAllocation.defense +
        s.powerAllocation.facility
      const isRedline =
        totalMW > s.maxSafePower ||
        s.coreTemp >= 760 ||
        s.redlineInstability >= 50
      startSoundtrack()
      updateSoundtrackState(isRedline, s.isMusicMuted || s.diagFeedActive)
    }

    window.addEventListener('pointerdown', syncSoundtrack, { passive: true })
    window.addEventListener('keydown', syncSoundtrack)
    return () => {
      window.removeEventListener('pointerdown', syncSoundtrack)
      window.removeEventListener('keydown', syncSoundtrack)
    }
  }, [])

  // Immediately update soundtrack mute & redline crossfade whenever mute or phase changes
  // (HighDetailReactorPanel3D also updates redline soundtrack state imperatively inside useFrame)
  useEffect(() => {
    const s = useGameStore.getState()
    const totalMW =
      s.powerAllocation.cooling +
      s.powerAllocation.defense +
      s.powerAllocation.facility
    const isRedline =
      totalMW > s.maxSafePower || s.coreTemp >= 760 || s.redlineInstability >= 50
    updateSoundtrackState(isRedline, isMusicMuted || diagFeedActive)
  }, [isMusicMuted, diagFeedActive, phase])

  // Allow pressing Space or Enter to engage the 3D Main Breaker when in boot/end phase,
  // or to re-close the Main Breaker during an active shift if it tripped open (isBlackout === true).
  // Holding Shift + Space starts (or switches into) Endless Sandbox / No-Fail Test Mode (isGodMode = true).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Backspace') {
        const s = useGameStore.getState()
        if (s.phase === 'playing' && s.tutorialStep !== 'DONE') {
          e.preventDefault()
          playSwitchClank(true)
          s.skipTutorial()
          return
        }
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        const s = useGameStore.getState()
        const wantSandbox = e.shiftKey && e.code === 'Space'
        if (s.phase === 'boot') {
          e.preventDefault()
          playSwitchClank(true)
          startSoundtrack()
          updateSoundtrackState(false, s.isMusicMuted)
          s.startShift()
          if (wantSandbox) {
            s.setGodMode(true)
          }
        } else if (s.phase !== 'playing') {
          e.preventDefault()
          playSwitchClank(true)
          startSoundtrack()
          updateSoundtrackState(false, s.isMusicMuted)
          s.resetShift()
          if (wantSandbox) {
            s.setGodMode(true)
          }
        } else if (wantSandbox) {
          e.preventDefault()
          playSwitchClank(true)
          s.setGodMode(!s.isGodMode)
        } else if (s.isBlackout) {
          e.preventDefault()
          playKnifeSwitchSlam(true)
          s.recloseMainBreaker()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#080b09] select-none">
      <MainMenuOverlay />
      <DebugMenu />
      <CenterReticle />

      {/* Discreet Control & Locomotion Hint Bar at Bottom of Screen */}
      {phase === 'playing' && (
        <div className="pointer-events-none fixed bottom-2.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded border border-[#28b862]/70 bg-[#051209]/90 px-4 py-1 font-mono text-xs font-bold tracking-wider text-[#39ff14] shadow-lg">
          {wePadInspecting
            ? '[TAB]: EXIT WE-PAD ZOOM | [E]: STOW WE-PAD | [1–6]: SWITCH TAB'
            : '[WASD]: WALK | [MOUSE]: LOOK | [HOLD LMB]: GRAB & DRAG | [RMB]: ZOOM | [E/TAB]: WE-PAD'}
        </div>
      )}

      {/* 100% True 3D First-Person Soviet Control Room Canvas (Locked dpr=1, unshadowed, stencil-free for 60 FPS micro-pixel aesthetic) */}
      <Canvas
        dpr={1}
        camera={{ position: [0, 1.65, 0.6], fov: 68, near: 0.05, far: 160 }}
        gl={{ powerPreference: 'high-performance', antialias: false, stencil: false }}
      >
        <ControlRoomScene />
      </Canvas>
    </div>
  )
}

export default App
