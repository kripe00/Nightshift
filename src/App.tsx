import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  playKnifeSwitchSlam,
  silenceAllLegacyGlobalBgm,
} from './modules/inspector/audio'
import { playSwitchClank } from './modules/reactor/audioSynth'
import { ControlRoomScene } from './shared/ControlRoomScene'
import { DebugMenu } from './shared/DebugMenu'
import {
  pointerLockInteraction,
  subscribePointerLockInteraction,
  updatePointerLockInteraction,
} from './shared/pointerLockState'
import { saveCurrentShiftToStorage } from './shared/shiftSaveStorage'
import { SceneGpuWarmup, SovOsBootOverlay } from './shared/SovOsBootOverlay'
import { TutorialCompassHud } from './shared/TutorialCompassHud'
import {
  doesRadioDominateSubtitles,
  hasAudibleRadioSubtitle,
  useGameStore,
} from './shared/useGameStore'

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
        !pointerLockInteraction.mainMenuOpen &&
        !pointerLockInteraction.shiftTransitionActive

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

function KomradBroadcastSubtitleHud({ mainMenuOpen }: { mainMenuOpen: boolean }) {
  const phase = useGameStore((s) => s.phase)
  const isShiftControlReady = useGameStore((s) => s.isShiftControlReady)
  const diagFeedActive = useGameStore((s) => s.diagFeedActive)
  const radioOn = useGameStore((s) => s.radioOn)
  const radioVolume = useGameStore((s) => s.radioVolume)
  const radioSubtitle = useGameStore((s) => s.radioBroadcastSubtitle)
  const sub = useGameStore((s) => s.komradSubtitle)

  const radioDominates = doesRadioDominateSubtitles(
    radioOn,
    radioVolume,
    radioSubtitle
  )

  if (
    phase !== 'playing' ||
    !isShiftControlReady ||
    diagFeedActive ||
    mainMenuOpen ||
    radioDominates ||
    !sub?.clause
  ) {
    return null
  }

  const accentHex =
    sub.mood === 'critical'
      ? '#ff2a2a'
      : sub.mood === 'warning'
        ? '#ffb000'
        : '#33ff66'

  const bodyColor =
    sub.mood === 'critical'
      ? '#ff9e9e'
      : sub.mood === 'warning'
        ? '#ffd27d'
        : '#e6f5ea'

  return (
    <div
      className="w-max max-w-[min(92vw,52rem)] rounded border px-4 py-2 text-center shadow-[0_6px_22px_rgba(0,0,0,0.85)] select-none"
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 45,
        pointerEvents: 'none',
        backgroundColor: 'rgba(8, 12, 9, 0.88)',
        borderColor: `${accentHex}b3`,
      }}
    >
      <div
        className="mb-1 flex items-center justify-center gap-2 text-xs font-bold tracking-[0.18em]"
        style={{
          color: accentHex,
          fontFamily: '"Kremlin", "VT323", monospace',
        }}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${sub.isSpeaking ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor: accentHex,
            boxShadow: `0 0 6px ${accentHex}`,
          }}
        />
        <span>K.O.M.R.A.D.-84 // SECTOR 84 PA</span>
      </div>
      <div
        className="text-xl leading-snug tracking-[0.06em] uppercase sm:text-2xl"
        style={{
          color: bodyColor,
          fontFamily: '"VT323", "Courier Prime", monospace',
          textShadow: '0 2px 0 #070907, 0 0 8px rgba(0, 0, 0, 0.95)',
        }}
      >
        {sub.clause}
      </div>
    </div>
  )
}

function RadioBroadcastSubtitleHud({ mainMenuOpen }: { mainMenuOpen: boolean }) {
  const phase = useGameStore((s) => s.phase)
  const isShiftControlReady = useGameStore((s) => s.isShiftControlReady)
  const diagFeedActive = useGameStore((s) => s.diagFeedActive)
  const radioOn = useGameStore((s) => s.radioOn)
  const radioVolume = useGameStore((s) => s.radioVolume)
  const subtitle = useGameStore((s) => s.radioBroadcastSubtitle)
  const komradSub = useGameStore((s) => s.komradSubtitle)

  const hasRadio = hasAudibleRadioSubtitle(radioOn, radioVolume, subtitle)
  const radioDominates = doesRadioDominateSubtitles(radioOn, radioVolume, subtitle)
  const hasKomrad = Boolean(komradSub?.clause?.trim())

  if (
    phase !== 'playing' ||
    !isShiftControlReady ||
    diagFeedActive ||
    mainMenuOpen ||
    !hasRadio ||
    (!radioDominates && hasKomrad)
  ) {
    return null
  }

  return (
    <div
      className="w-max max-w-[min(92vw,48rem)] rounded border border-[#ffb000]/65 px-4 py-2 text-center shadow-[0_6px_22px_rgba(0,0,0,0.85)] select-none"
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 45,
        pointerEvents: 'none',
        backgroundColor: 'rgba(10, 12, 10, 0.84)',
      }}
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
  const lobbyMenuPhase = useGameStore((s) => s.lobbyMenuPhase)
  const isShiftControlReady = useGameStore((s) => s.isShiftControlReady)
  const tutorialPhase = useGameStore((s) => s.tutorialPhase)
  const activePost84Order = useGameStore((s) => s.activePost84Order)
  const quotaCompleted = useGameStore((s) => s.quotaCompleted)
  const tick = useGameStore((s) => s.tick)
  const isSeatedAtDesk = useGameStore((s) => s.isSeatedAtDesk)
  const canSitAtDesk = useGameStore((s) => s.canSitAtDesk)
  const [gpuWarmupDone, setGpuWarmupDone] = useState(false)
  const [bootReady, setBootReady] = useState(false)
  const bootReadyRef = useRef(false)
  const handleGpuWarmupComplete = useCallback(() => {
    setGpuWarmupDone(true)
  }, [])
  const handleBootComplete = useCallback(() => {
    bootReadyRef.current = true
    updatePointerLockInteraction({ mainMenuOpen: false })
    setBootReady(true)
  }, [])

  const [menusOpen, setMenusOpen] = useState<boolean>(
    () => pointerLockInteraction.mainMenuOpen || pointerLockInteraction.debugMenuOpen
  )
  const [mainMenuOpen, setMainMenuOpen] = useState<boolean>(
    () => pointerLockInteraction.mainMenuOpen
  )

  useEffect(() => {
    if (!bootReady) {
      updatePointerLockInteraction({ mainMenuOpen: true })
    }
    return () => {
      if (!bootReady) {
        updatePointerLockInteraction({ mainMenuOpen: false })
      }
    }
  }, [bootReady])

  useEffect(() => {
    const syncMenus = () => {
      setMenusOpen(
        pointerLockInteraction.mainMenuOpen || pointerLockInteraction.debugMenuOpen
      )
      setMainMenuOpen(pointerLockInteraction.mainMenuOpen)
    }
    syncMenus()
    return subscribePointerLockInteraction(syncMenus)
  }, [])

  useEffect(() => {
    const syncSeatedCursor = () => {
      const gs = useGameStore.getState()
      const hideOsCursor =
        bootReadyRef.current &&
        gs.phase === 'playing' &&
        gs.isSeatedAtDesk &&
        (!gs.isBlackout || gs.isGodMode) &&
        !pointerLockInteraction.debugMenuOpen &&
        !pointerLockInteraction.mainMenuOpen &&
        !pointerLockInteraction.shiftTransitionActive

      document.documentElement.classList.toggle('iskra-terminal-seated', hideOsCursor)
      document.body.classList.toggle('iskra-terminal-seated', hideOsCursor)
      if (hideOsCursor && document.body.style.cursor) {
        document.body.style.cursor = ''
      }
    }

    syncSeatedCursor()
    const unsubGame = useGameStore.subscribe(syncSeatedCursor)
    const unsubLock = subscribePointerLockInteraction(syncSeatedCursor)
    return () => {
      unsubGame()
      unsubLock()
      document.documentElement.classList.remove('iskra-terminal-seated')
      document.body.classList.remove('iskra-terminal-seated')
    }
  }, [bootReady])

  useEffect(() => {
    silenceAllLegacyGlobalBgm()
  }, [phase])

  const prevMenusOpenRef = useRef(false)
  const prevTutorialPhaseRef = useRef(tutorialPhase)
  const prevQuotaRef = useRef(quotaCompleted)
  const prevOrderIdRef = useRef<string | null>(activePost84Order?.orderId ?? null)

  useEffect(() => {
    const canSave =
      phase === 'playing' &&
      lobbyMenuPhase === 'entered_control_room' &&
      isShiftControlReady
    if (!canSave) return

    const interval = window.setInterval(() => {
      saveCurrentShiftToStorage()
    }, 10_000)

    const onVisibilityChange = () => {
      if (document.hidden) {
        saveCurrentShiftToStorage()
      }
    }
    const onBeforeUnload = () => {
      saveCurrentShiftToStorage()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [phase, lobbyMenuPhase, isShiftControlReady])

  useEffect(() => {
    const canSave =
      phase === 'playing' &&
      lobbyMenuPhase === 'entered_control_room' &&
      isShiftControlReady
    const curOrderId = activePost84Order?.orderId ?? null
    const orderJustCompleted =
      quotaCompleted !== prevQuotaRef.current ||
      (prevOrderIdRef.current !== null && curOrderId === null)
    const tutorialJustChanged = tutorialPhase !== prevTutorialPhaseRef.current
    const justPaused = !prevMenusOpenRef.current && menusOpen

    prevQuotaRef.current = quotaCompleted
    prevOrderIdRef.current = curOrderId
    prevTutorialPhaseRef.current = tutorialPhase
    prevMenusOpenRef.current = menusOpen

    if (canSave && (orderJustCompleted || tutorialJustChanged || justPaused)) {
      saveCurrentShiftToStorage()
    }
  }, [
    phase,
    lobbyMenuPhase,
    isShiftControlReady,
    quotaCompleted,
    activePost84Order,
    tutorialPhase,
    menusOpen,
  ])

  useEffect(() => {
    if (phase !== 'playing' || !isShiftControlReady) return
    const interval = window.setInterval(() => {
      tick()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [phase, isShiftControlReady, tick])

  // Allow pressing Space or Enter to engage the 3D Main Breaker when in boot/end phase,
  // or to re-close the Main Breaker during an active shift if it tripped open (isBlackout === true).
  // Holding Shift + Space starts (or switches into) Endless Sandbox / No-Fail Test Mode (isGodMode = true).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!bootReadyRef.current) return
      if (e.code === 'Backspace') {
        const s = useGameStore.getState()
        if (s.phase === 'playing' && s.isShiftControlReady && s.tutorialPhase !== 'COMPLETED') {
          e.preventDefault()
          playSwitchClank(true)
          s.skipTutorial()
          return
        }
      }
      if (e.code === 'KeyN') {
        const s = useGameStore.getState()
        if (
          s.phase === 'playing' &&
          s.isShiftControlReady &&
          !pointerLockInteraction.mainMenuOpen &&
          !pointerLockInteraction.debugMenuOpen
        ) {
          if (
            s.tutorialPhase !== 'COMPLETED' &&
            s.tutorialPhase !== 'AWAITING_VOLKOV_MAIL'
          ) {
            e.preventDefault()
            playSwitchClank(true)
            s.advanceTutorialStep()
            return
          }
          if (s.activeCrisisCoach !== null) {
            e.preventDefault()
            playSwitchClank(true)
            s.dismissCrisisCoach()
            return
          }
        }
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        const s = useGameStore.getState()
        if (!s.isShiftControlReady) return
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

  const effectiveMainMenuOpen = mainMenuOpen || !bootReady
  const effectiveMenusOpen = menusOpen || !bootReady

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#080b09] select-none">
      <SovOsBootOverlay
        gpuWarmupDone={gpuWarmupDone}
        onBootComplete={handleBootComplete}
      />
      <DebugMenu />
      <CenterReticle />
      <TutorialCompassHud menusOpen={effectiveMenusOpen} />

      {/* Subtle Contextual [E] SIT AT DESK Prompt When Walking Near Inspector Desk */}
      {phase === 'playing' && isShiftControlReady && !isSeatedAtDesk && canSitAtDesk && !effectiveMenusOpen && (
        <div className="pointer-events-none fixed bottom-11 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded border border-[#ffb000]/75 bg-[#07160c]/90 px-3 py-0.5 font-mono text-xs font-bold tracking-widest text-[#ffb000] shadow-md">
          [E] SIT AT DESK
        </div>
      )}

      {/* Discreet Control & Locomotion Hint Bar at Bottom of Screen */}
      {phase === 'playing' && isShiftControlReady && (
        <div className="pointer-events-none fixed bottom-2.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded border border-[#28b862]/70 bg-[#051209]/90 px-4 py-1 font-mono text-xs font-bold tracking-wider text-[#39ff14] shadow-lg">
          {isSeatedAtDesk
            ? '[LMB]: CLICK ISKRA-84 TERMINAL | [RMB]: ZOOM | [E / ESC]: STAND UP'
            : '[WASD]: WALK | [MOUSE]: LOOK | [HOLD LMB]: GRAB & DRAG | [RMB]: ZOOM | [E]: SIT / STAND (DESK)'}
        </div>
      )}

      {/* 100% True 3D First-Person Soviet Control Room Canvas (Locked dpr=1, unshadowed, stencil-free for 60 FPS micro-pixel aesthetic) */}
      <Canvas
        dpr={1}
        camera={{ position: [-0.38, 1.65, 8.42], fov: 68, near: 0.12, far: 150 }}
        gl={{ powerPreference: 'high-performance', antialias: false, stencil: false }}
      >
        <ControlRoomScene />
        <SceneGpuWarmup onComplete={handleGpuWarmupComplete} />
      </Canvas>

      <KomradBroadcastSubtitleHud mainMenuOpen={effectiveMainMenuOpen} />
      <RadioBroadcastSubtitleHud mainMenuOpen={effectiveMainMenuOpen} />
    </div>
  )
}

export default App
