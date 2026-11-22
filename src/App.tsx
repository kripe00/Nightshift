import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import {
  playKnifeSwitchSlam,
  silenceAllLegacyGlobalBgm,
} from './modules/inspector/audio'
import { playSwitchClank } from './modules/reactor/audioSynth'
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
        !gs.isSeatedAtDesk &&
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

function RadioBroadcastSubtitleHud({ menusOpen }: { menusOpen: boolean }) {
  const phase = useGameStore((s) => s.phase)
  const diagFeedActive = useGameStore((s) => s.diagFeedActive)
  const subtitle = useGameStore((s) => s.radioBroadcastSubtitle)

  if (phase !== 'playing' || diagFeedActive || menusOpen || !subtitle) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed bottom-20 left-1/2 z-25 w-max max-w-[min(92vw,48rem)] -translate-x-1/2 rounded border border-[#ffb000]/65 px-4 py-2 text-center shadow-[0_6px_22px_rgba(0,0,0,0.85)] select-none"
      style={{ backgroundColor: 'rgba(10, 12, 10, 0.84)' }}
    >
      <div
        className="mb-1 flex items-center justify-center gap-2 text-xs font-bold tracking-[0.18em] text-[#ffb000]"
        style={{ fontFamily: '"Kremlin", "VT323", monospace' }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full bg-[#ff2a2a]"
          style={{ boxShadow: '0 0 6px #ff2a2a' }}
        />
        <span>[ USSR STATE RADIO // BROADCAST ]</span>
      </div>
      <div
        className="text-base leading-snug tracking-[0.085em] text-[#f6ead0] uppercase sm:text-lg"
        style={{
          fontFamily: '"Kremlin", "VT323", monospace',
          textShadow:
            '0 2px 0 #070907, 0 0 8px rgba(0, 0, 0, 0.95), 0 0 14px rgba(255, 176, 0, 0.22)',
        }}
      >
        {subtitle}
      </div>
    </div>
  )
}

export function App() {
  const phase = useGameStore((s) => s.phase)
  const tick = useGameStore((s) => s.tick)
  const isSeatedAtDesk = useGameStore((s) => s.isSeatedAtDesk)
  const canSitAtDesk = useGameStore((s) => s.canSitAtDesk)
  const [menusOpen, setMenusOpen] = useState<boolean>(
    () => pointerLockInteraction.mainMenuOpen || pointerLockInteraction.debugMenuOpen
  )

  useEffect(() => {
    const syncMenus = () => {
      setMenusOpen(
        pointerLockInteraction.mainMenuOpen || pointerLockInteraction.debugMenuOpen
      )
    }
    syncMenus()
    return subscribePointerLockInteraction(syncMenus)
  }, [])

  useEffect(() => {
    silenceAllLegacyGlobalBgm()
  }, [phase])

  useEffect(() => {
    if (phase !== 'playing') return
    const interval = window.setInterval(() => {
      tick()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [phase, tick])

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
          s.startShift()
          if (wantSandbox) {
            s.setGodMode(true)
          }
        } else if (s.phase !== 'playing') {
          e.preventDefault()
          playSwitchClank(true)
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
      <RadioBroadcastSubtitleHud menusOpen={menusOpen} />

      {/* Subtle Contextual [E] SIT AT DESK Prompt When Walking Near Inspector Desk */}
      {phase === 'playing' && !isSeatedAtDesk && canSitAtDesk && !menusOpen && (
        <div className="pointer-events-none fixed bottom-11 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded border border-[#ffb000]/75 bg-[#07160c]/90 px-3 py-0.5 font-mono text-xs font-bold tracking-widest text-[#ffb000] shadow-md">
          [E] SIT AT DESK
        </div>
      )}

      {/* Discreet Control & Locomotion Hint Bar at Bottom of Screen */}
      {phase === 'playing' && (
        <div className="pointer-events-none fixed bottom-2.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded border border-[#28b862]/70 bg-[#051209]/90 px-4 py-1 font-mono text-xs font-bold tracking-wider text-[#39ff14] shadow-lg">
          {isSeatedAtDesk
            ? '[LMB]: GRAB & DRAG DESK TOOLS | [RMB]: ZOOM | [E / ESC]: STAND UP'
            : '[WASD]: WALK | [MOUSE]: LOOK | [HOLD LMB]: GRAB & DRAG | [RMB]: ZOOM | [E]: SIT / STAND (DESK)'}
        </div>
      )}

      {/* 100% True 3D First-Person Soviet Control Room Canvas (Locked dpr=1, unshadowed, stencil-free for 60 FPS micro-pixel aesthetic) */}
      <Canvas
        dpr={1}
        camera={{ position: [0, 1.65, 0.6], fov: 68, near: 0.12, far: 150 }}
        gl={{ powerPreference: 'high-performance', antialias: false, stencil: false }}
      >
        <ControlRoomScene />
      </Canvas>
    </div>
  )
}

export default App
