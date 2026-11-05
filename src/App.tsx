import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import { playSwitchClank } from './modules/reactor/audioSynth'
import {
  startSoundtrack,
  updateSoundtrackState,
} from './modules/reactor/soundtrackPlayer'
import { ControlRoomScene } from './shared/ControlRoomScene'
import { DebugMenu } from './shared/DebugMenu'
import { useGameStore } from './shared/useGameStore'

export function App() {
  const phase = useGameStore((s) => s.phase)
  const tick = useGameStore((s) => s.tick)

  useEffect(() => {
    if (phase !== 'playing') return
    const interval = window.setInterval(() => {
      tick()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [phase, tick])

  // Allow pressing Space or Enter to engage the 3D Main Breaker when in boot/end phase
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        const s = useGameStore.getState()
        if (s.phase === 'boot') {
          e.preventDefault()
          playSwitchClank(true)
          startSoundtrack()
          updateSoundtrackState(false, s.isMusicMuted)
          s.startShift()
        } else if (s.phase !== 'playing') {
          e.preventDefault()
          playSwitchClank(true)
          startSoundtrack()
          updateSoundtrackState(false, s.isMusicMuted)
          s.resetShift()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#080b09] select-none">
      <DebugMenu />

      {/* 100% True 3D First-Person Soviet Control Room Canvas (Locked dpr=1 for crisp 60 FPS micro-pixel aesthetic) */}
      <Canvas
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
