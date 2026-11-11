import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import { playKnifeSwitchSlam } from './modules/inspector/audio'
import { playSwitchClank } from './modules/reactor/audioSynth'
import {
  startSoundtrack,
  updateSoundtrackState,
} from './modules/reactor/soundtrackPlayer'
import { ControlRoomScene } from './shared/ControlRoomScene'
import { DebugMenu } from './shared/DebugMenu'
import { MainMenuOverlay } from './shared/MainMenuOverlay'
import { useGameStore } from './shared/useGameStore'

export function App() {
  const phase = useGameStore((s) => s.phase)
  const tick = useGameStore((s) => s.tick)
  const isMusicMuted = useGameStore((s) => s.isMusicMuted)
  const wePadHeld = useGameStore((s) => s.wePadHeld)
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
      updateSoundtrackState(isRedline, s.isMusicMuted)
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
    updateSoundtrackState(isRedline, isMusicMuted)
  }, [isMusicMuted, phase])

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

      {/* Discreet WE-PAD 84 Control Hint Bar at Bottom of Screen */}
      {phase === 'playing' && (
        <div className="pointer-events-none fixed bottom-2.5 left-1/2 z-20 -translate-x-1/2 rounded border border-[#28b862]/70 bg-[#051209]/90 px-4 py-1 font-mono text-xs font-bold tracking-wider text-[#39ff14] shadow-lg">
          {wePadHeld
            ? wePadInspecting
              ? '[TAB]: KOMPAKT SIDE-VISNING  |  [E]: LEGG NED WE-PAD  |  [1–6]: BYTT FANE'
              : '[TAB]: SE NÆRMERE PÅ WE-PAD  |  [E]: LEGG NED WE-PAD  |  [1–6]: BYTT FANE'
            : '[E]: PLUKK OPP WE-PAD 84'}
        </div>
      )}

      {/* 100% True 3D First-Person Soviet Control Room Canvas (Locked dpr=1 + PCFSoftShadowMap for chiaroscuro 60 FPS micro-pixel aesthetic) */}
      <Canvas
        shadows="soft"
        dpr={1}
        camera={{ position: [0, 1.55, 2.55], fov: 55, near: 0.1, far: 25 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <ControlRoomScene />
      </Canvas>
    </div>
  )
}

export default App
