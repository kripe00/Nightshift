import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
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
  const coreTemp = useGameStore((s) => s.coreTemp)
  const redlineInstability = useGameStore((s) => s.redlineInstability)
  const maxSafePower = useGameStore((s) => s.maxSafePower)
  const powerAllocation = useGameStore((s) => s.powerAllocation)

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

  // Immediately update soundtrack mute & redline crossfade whenever state changes (e.g. pressing [M])
  useEffect(() => {
    const totalMW =
      powerAllocation.cooling +
      powerAllocation.defense +
      powerAllocation.facility
    const isRedline =
      totalMW > maxSafePower || coreTemp >= 760 || redlineInstability >= 50
    updateSoundtrackState(isRedline, isMusicMuted)
  }, [
    isMusicMuted,
    coreTemp,
    redlineInstability,
    maxSafePower,
    powerAllocation.cooling,
    powerAllocation.defense,
    powerAllocation.facility,
  ])

  // Allow pressing Space or Enter to engage the 3D Main Breaker when in boot/end phase.
  // Holding Shift + Space starts (or switches into) Endless Sandbox / No-Fail Test Mode (isGodMode = true).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
