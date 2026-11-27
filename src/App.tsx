import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  playKnifeSwitchSlam,
  playStampInkThud,
  silenceAllLegacyGlobalBgm,
} from './modules/inspector/audio'
import { playSwitchClank } from './modules/reactor/audioSynth'
import { registerTerminalSovOsApps } from './modules/terminal'
import {
  playElevatorArrivalCue,
  triggerLobbyAmbientFadeIn,
} from './shared/airlockDoorState'
import { ControlRoomScene } from './shared/ControlRoomScene'
import { DebugMenu } from './shared/DebugMenu'
import { KgbShiftSummaryDossier } from './shared/KgbShiftSummaryDossier'
import { PauseMenuOverlay } from './shared/PauseMenuOverlay'
import {
  isKomradGrabActive,
  isKomradLiquidating,
  komradGrabState,
} from './shared/komradGrabState'
import { cancelKomradSpeechForReset } from './shared/komradVoiceSynth'
import {
  pointerLockInteraction,
  subscribePointerLockInteraction,
  updatePointerLockInteraction,
} from './shared/pointerLockState'
import {
  completeShiftAndReturnToNextLobby,
  resetGameToMcrLobbyAfterLiquidation,
  saveCurrentShiftToStorage,
} from './shared/shiftSaveStorage'
import { SceneGpuWarmup, SovOsBootOverlay } from './shared/SovOsBootOverlay'
import { TutorialCompassHud } from './shared/TutorialCompassHud'
import {
  doesRadioDominateSubtitles,
  hasAudibleRadioSubtitle,
  useGameStore,
} from './shared/useGameStore'

registerTerminalSovOsApps()

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
        !gs.siberiaGameOverActive &&
        !isKomradGrabActive() &&
        pointerLockInteraction.isPointerLocked &&
        !gs.isSeatedAtDesk &&
        !pointerLockInteraction.debugMenuOpen &&
        !pointerLockInteraction.mainMenuOpen &&
        !pointerLockInteraction.shiftTransitionActive &&
        !pointerLockInteraction.shiftFadeFreezeInput

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
  const elevatorDeparturePhase = useGameStore((s) => s.elevatorDeparturePhase)
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
    elevatorDeparturePhase !== 'idle' ||
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

function LiquidationCrtFxOverlay() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const vignetteRef = useRef<HTMLDivElement | null>(null)
  const flashRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let rafId = 0
    const step = () => {
      const root = rootRef.current
      if (root) {
        const active = komradGrabState.phase === 'liquidating'
        root.style.display = active ? 'block' : 'none'
        if (active) {
          if (vignetteRef.current) {
            vignetteRef.current.style.opacity = String(
              Math.min(1, Math.max(0, komradGrabState.liquidationVignette))
            )
          }
          if (flashRef.current) {
            flashRef.current.style.opacity = String(
              Math.min(1, Math.max(0, komradGrabState.liquidationFlash))
            )
          }
        }
      }
      rafId = window.requestAnimationFrame(step)
    }
    rafId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(rafId)
  }, [])

  return (
    <div
      ref={rootRef}
      style={{ display: 'none' }}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none"
    >
      <div
        ref={vignetteRef}
        style={{
          opacity: 0,
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,42,42,0.06) 28%, rgba(90,6,6,0.72) 72%, rgba(4,2,2,0.98) 100%)',
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(255,42,42,0.08) 28%, rgba(90,6,6,0.74) 72%, rgba(4,2,2,0.98) 100%), repeating-linear-gradient(0deg, rgba(255,50,50,0.12) 0px, rgba(0,0,0,0.45) 2px, rgba(0,0,0,0.1) 4px)',
        }}
        className="absolute inset-0"
      />
      <div
        ref={flashRef}
        style={{
          opacity: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(255,236,220,0.98) 0%, rgba(255,58,48,0.92) 38%, rgba(8,2,2,0.98) 82%)',
        }}
        className="absolute inset-0"
      />
    </div>
  )
}

function SiberiaLiquidationGameOverOverlay() {
  const [stampSlammed, setStampSlammed] = useState(false)
  const treasonStrikes = useGameStore((s) => s.treasonStrikes)
  const lastStrikeReason = useGameStore((s) => s.lastStrikeReason)

  const displayStrikes = Math.max(6, treasonStrikes)
  const terminationCause =
    lastStrikeReason.trim() ||
    'UNAUTHORIZED REACTOR TAMPERING PRIOR TO VOLKOV BRIEFING'

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setStampSlammed(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const handleReturnToLobby = () => {
    playKnifeSwitchSlam(true)
    cancelKomradSpeechForReset()
    resetGameToMcrLobbyAfterLiquidation()
  }

  return (
    <div
      data-testid="siberia-liquidation-gameover"
      className="fixed inset-0 z-50 flex cursor-auto items-center justify-center bg-[#060303]/95 p-4 select-none"
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(255,42,42,0.04) 0px, rgba(0,0,0,0.28) 2px, transparent 4px)',
      }}
    >
      <div className="relative w-full max-w-3xl border-2 border-[#ff2a2a]/80 bg-[#0b0707] p-6 text-[#e6dec3] shadow-[0_0_55px_rgba(255,42,42,0.32)] sm:p-8">
        <div
          className="mb-4 border-b border-[#ff2a2a]/45 pb-3 text-center text-sm font-bold tracking-[0.18em] text-[#ffb000] uppercase sm:text-base"
          style={{ fontFamily: '"Kremlin", "VT323", monospace' }}
        >
          KGB FOURTH DIRECTORATE // SECTOR 84 PERSONNEL ACTION FORM 84-B
        </div>

        <div className="my-4 flex justify-center">
          <div
            data-testid="personnel-liquidated-stamp"
            className="border-4 border-[#ff2a2a] bg-[#2a0707]/85 px-5 py-2 text-center text-2xl font-bold tracking-[0.16em] text-[#ff2a2a] uppercase shadow-[0_0_24px_rgba(255,42,42,0.45)] sm:text-3xl"
            style={{
              fontFamily: '"Kremlin", "Courier Prime", monospace',
              transform: stampSlammed
                ? 'scale(1) rotate(-4deg)'
                : 'scale(1.85) rotate(-9deg)',
              opacity: stampSlammed ? 1 : 0.25,
              transition: 'transform 160ms cubic-bezier(0.2, 0.9, 0.25, 1), opacity 120ms ease-out',
            }}
          >
            [ PERSONNEL FILE LIQUIDATED ]
          </div>
        </div>

        <div
          className="mt-5 space-y-3 border border-[#3a2824] bg-[#120c0b] p-4 text-sm leading-relaxed sm:text-base"
          style={{ fontFamily: '"Courier Prime", "VT323", monospace' }}
        >
          <div>
            <span className="font-bold text-[#ffb000]">FINAL DOSSIER TALLY: </span>
            <span
              data-testid="siberia-strike-tally"
              className="font-bold text-[#ff4d4d]"
            >
              {displayStrikes} / 6 TREASON STRIKES
            </span>
          </div>
          <div>
            <span className="font-bold text-[#ffb000]">CAUSE OF TERMINATION: </span>
            <span
              data-testid="siberia-termination-cause"
              className="text-[#f3ead4]"
            >
              {terminationCause}
            </span>
          </div>
          <div>
            <span className="font-bold text-[#ffb000]">REASSIGNMENT DESTINATION: </span>
            <span className="text-[#f3ead4]">
              SIBERIAN PERMAFROST SHOVEL BRIGADE NO. 19
            </span>
          </div>
          <div>
            <span className="font-bold text-[#ffb000]">SAVED SHIFT RECORD (MIP_SAVED_SHIFT_84): </span>
            <span className="font-bold text-[#ff4d4d]">
              PERMANENTLY EXPUNGED BY STATE DECREE
            </span>
          </div>
          <div>
            <span className="font-bold text-[#ffb000]">RUBLES CONFISCATED FOR STATE TREASURY: </span>
            <span className="text-[#f3ead4]">ALL OF THEM</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            data-testid="return-to-mcr-lobby-btn"
            onClick={handleReturnToLobby}
            className="cursor-pointer border-2 border-[#33ff66] bg-[#071f10] px-6 py-3 text-lg font-bold tracking-[0.12em] text-[#33ff66] uppercase shadow-[0_0_20px_rgba(51,255,102,0.24)] transition hover:bg-[#0e381d] hover:text-[#e6dec3] active:translate-y-0.5 sm:text-xl"
            style={{ fontFamily: '"VT323", "Courier Prime", monospace' }}
          >
            [ REPORT NEW OPERATOR REPLACEMENT TO MCR-4 LOBBY ]
          </button>
        </div>
      </div>
    </div>
  )
}

function ElevatorBoardingCurtain({ onComplete }: { onComplete: () => void }) {
  const [fadeIn, setFadeIn] = useState(false)

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => setFadeIn(true))
    const timer = window.setTimeout(onComplete, 2000)
    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timer)
    }
  }, [onComplete])

  return (
    <div
      data-testid="lift84-boarding-curtain"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#040705] select-none"
      style={{
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 1450ms ease-in-out',
      }}
    >
      <div className="border border-[#33ff66]/45 bg-[#07140b]/90 px-8 py-5 text-center shadow-[0_0_40px_rgba(51,255,102,0.16)]">
        <div
          className="text-lg font-bold tracking-[0.2em] text-[#ffb000] uppercase sm:text-xl"
          style={{ fontFamily: '"Kremlin", "VT323", monospace' }}
        >
          LIFT-84 // FREIGHT-PASSENGER SHAFT
        </div>
        <div
          className="mt-2 text-base tracking-[0.14em] text-[#33ff66] uppercase"
          style={{ fontFamily: '"VT323", "Courier Prime", monospace' }}
        >
          GATE LOCKED • HOIST MOTOR ENGAGED • RECORDING SHIFT LOG...
        </div>
      </div>
    </div>
  )
}

type ShiftFadeStage = 'idle' | 'fading_out' | 'holding_black' | 'fading_in'

function ElevatorDepartureAndSummaryOverlay() {
  const elevatorDeparturePhase = useGameStore((s) => s.elevatorDeparturePhase)
  const lastShiftSummary = useGameStore((s) => s.lastShiftSummary)
  const showShiftSummaryOverlay = useGameStore((s) => s.showShiftSummaryOverlay)
  const [fadeStage, setFadeStage] = useState<ShiftFadeStage>('idle')
  const [curtainOpacity, setCurtainOpacity] = useState(0)
  const transitioningRef = useRef(false)
  const timersRef = useRef<number[]>([])
  const rafRef = useRef<number | null>(null)

  const clearScheduledTransition = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id)
    }
    timersRef.current = []
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearScheduledTransition()
      transitioningRef.current = false
      updatePointerLockInteraction({ shiftFadeFreezeInput: false })
    }
  }, [clearScheduledTransition])

  useEffect(() => {
    const active =
      elevatorDeparturePhase !== 'idle' && !transitioningRef.current
    updatePointerLockInteraction({ shiftTransitionActive: active })
    if (active && document.pointerLockElement) {
      document.exitPointerLock?.()
    }
    return () => {
      if (active) {
        updatePointerLockInteraction({ shiftTransitionActive: false })
      }
    }
  }, [elevatorDeparturePhase])

  const handleBeginNextShift = useCallback(() => {
    if (transitioningRef.current) return
    clearScheduledTransition()
    transitioningRef.current = true

    playStampInkThud('APPROVED')
    playElevatorArrivalCue()

    updatePointerLockInteraction({
      shiftTransitionActive: false,
      shiftFadeFreezeInput: true,
    })

    try {
      const canvas = document.querySelector('canvas')
      if (canvas && document.pointerLockElement !== canvas) {
        const req = canvas.requestPointerLock?.() as Promise<void> | undefined
        req?.catch?.(() => {
          // Ignore rejected pointer lock promises if browser denies lock
        })
      }
    } catch {
      // Ignore security exceptions when calling requestPointerLock
    }

    setFadeStage('fading_out')
    setCurtainOpacity(0)
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      setCurtainOpacity(1)
    })

    const tBlack = window.setTimeout(() => {
      setFadeStage('holding_black')
      cancelKomradSpeechForReset()
      completeShiftAndReturnToNextLobby()
    }, 560)

    const tFadeIn = window.setTimeout(() => {
      triggerLobbyAmbientFadeIn()
      updatePointerLockInteraction({ shiftFadeFreezeInput: false })
      setFadeStage('fading_in')
      setCurtainOpacity(0)
    }, 710)

    const tDone = window.setTimeout(() => {
      setFadeStage('idle')
      transitioningRef.current = false
    }, 1490)

    timersRef.current = [tBlack, tFadeIn, tDone]
  }, [clearScheduledTransition])

  return (
    <>
      {elevatorDeparturePhase === 'boarding' && (
        <ElevatorBoardingCurtain onComplete={showShiftSummaryOverlay} />
      )}
      {elevatorDeparturePhase === 'summary' && lastShiftSummary && (
        <KgbShiftSummaryDossier
          summary={lastShiftSummary}
          onBeginNextShift={handleBeginNextShift}
          isTransitioning={fadeStage !== 'idle'}
        />
      )}
      {fadeStage !== 'idle' && (
        <div
          data-testid="shift-fade-curtain"
          className={`fixed inset-0 z-[60] bg-black select-none ${
            fadeStage === 'fading_in' ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
          style={{
            opacity: curtainOpacity,
            transition:
              fadeStage === 'fading_out'
                ? 'opacity 550ms ease-in-out'
                : fadeStage === 'fading_in'
                  ? 'opacity 750ms ease-out'
                  : 'none',
          }}
        />
      )}
    </>
  )
}

export function App() {
  const phase = useGameStore((s) => s.phase)
  const lobbyMenuPhase = useGameStore((s) => s.lobbyMenuPhase)
  const shiftCompletedAt0600 = useGameStore((s) => s.shiftCompletedAt0600)
  const elevatorDeparturePhase = useGameStore((s) => s.elevatorDeparturePhase)
  const isShiftControlReady = useGameStore((s) => s.isShiftControlReady)
  const siberiaGameOverActive = useGameStore((s) => s.siberiaGameOverActive)
  const tutorialPhase = useGameStore((s) => s.tutorialPhase)
  const activePost84Order = useGameStore((s) => s.activePost84Order)
  const quotaCompleted = useGameStore((s) => s.quotaCompleted)
  const tick = useGameStore((s) => s.tick)
  const isSeatedAtDesk = useGameStore((s) => s.isSeatedAtDesk)
  const canSitAtDesk = useGameStore((s) => s.canSitAtDesk)
  const canBoardElevator = useGameStore((s) => s.canBoardElevator)
  const hoveredControlHint = useGameStore((s) => s.hoveredControlHint)
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
    () =>
      pointerLockInteraction.mainMenuOpen ||
      pointerLockInteraction.debugMenuOpen ||
      pointerLockInteraction.pauseMenuOpen
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
        pointerLockInteraction.mainMenuOpen ||
          pointerLockInteraction.debugMenuOpen ||
          pointerLockInteraction.pauseMenuOpen
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
        !gs.siberiaGameOverActive &&
        !isKomradLiquidating() &&
        gs.elevatorDeparturePhase === 'idle' &&
        gs.isSeatedAtDesk &&
        (!gs.isBlackout || gs.isGodMode) &&
        !pointerLockInteraction.debugMenuOpen &&
        !pointerLockInteraction.mainMenuOpen &&
        !pointerLockInteraction.shiftTransitionActive &&
        !pointerLockInteraction.shiftFadeFreezeInput

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
      shiftCompletedAt0600 === 'active' &&
      elevatorDeparturePhase === 'idle' &&
      isShiftControlReady &&
      !siberiaGameOverActive &&
      !isKomradLiquidating()
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
  }, [
    phase,
    lobbyMenuPhase,
    shiftCompletedAt0600,
    elevatorDeparturePhase,
    isShiftControlReady,
    siberiaGameOverActive,
  ])

  useEffect(() => {
    const canSave =
      phase === 'playing' &&
      lobbyMenuPhase === 'entered_control_room' &&
      shiftCompletedAt0600 === 'active' &&
      elevatorDeparturePhase === 'idle' &&
      isShiftControlReady &&
      !siberiaGameOverActive &&
      !isKomradLiquidating()
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
    shiftCompletedAt0600,
    elevatorDeparturePhase,
    isShiftControlReady,
    siberiaGameOverActive,
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
      const curState = useGameStore.getState()
      if (
        curState.isPaused ||
        curState.siberiaGameOverActive ||
        curState.elevatorDeparturePhase !== 'idle' ||
        isKomradGrabActive()
      ) {
        return
      }
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
      <PauseMenuOverlay mainMenuOpen={effectiveMainMenuOpen} />
      <DebugMenu />
      <CenterReticle />
      <TutorialCompassHud menusOpen={effectiveMenusOpen} />
      <LiquidationCrtFxOverlay />
      <ElevatorDepartureAndSummaryOverlay />
      {siberiaGameOverActive && <SiberiaLiquidationGameOverOverlay />}

      {/* Interactive LIFT-84 Elevator Departure Prompt in Lobby after 06:00 */}
      {phase === 'playing' &&
        isShiftControlReady &&
        !siberiaGameOverActive &&
        elevatorDeparturePhase === 'idle' &&
        shiftCompletedAt0600 !== 'active' &&
        !effectiveMenusOpen &&
        (canBoardElevator || hoveredControlHint?.includes('TAKE ELEVATOR')) && (
          <div
            data-testid="lift84-board-prompt"
            className="pointer-events-none fixed bottom-11 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded border-2 border-[#33ff66] bg-[#061c0d]/95 px-4 py-1 font-mono text-sm font-bold tracking-widest text-[#33ff66] shadow-[0_0_18px_rgba(51,255,102,0.32)]"
          >
            [LMB / E] TAKE ELEVATOR — END SHIFT
          </div>
        )}

      {/* Subtle Contextual [E] SIT AT DESK Prompt When Walking Near Inspector Desk */}
      {phase === 'playing' &&
        isShiftControlReady &&
        shiftCompletedAt0600 === 'active' &&
        !siberiaGameOverActive &&
        !isSeatedAtDesk &&
        canSitAtDesk &&
        !effectiveMenusOpen && (
          <div className="pointer-events-none fixed bottom-11 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded border border-[#ffb000]/75 bg-[#07160c]/90 px-3 py-0.5 font-mono text-xs font-bold tracking-widest text-[#ffb000] shadow-md">
            [E] SIT AT DESK
          </div>
        )}

      {/* Discreet Control & Locomotion Hint Bar at Bottom of Screen */}
      {phase === 'playing' &&
        isShiftControlReady &&
        !siberiaGameOverActive &&
        elevatorDeparturePhase === 'idle' && (
          <div className="pointer-events-none fixed bottom-2.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded border border-[#28b862]/70 bg-[#051209]/90 px-4 py-1 font-mono text-xs font-bold tracking-wider text-[#39ff14] shadow-lg">
            {shiftCompletedAt0600 !== 'active'
              ? '06:00 SHIFT COMPLETE — EXIT THROUGH MCR-4 AIRLOCK TO LIFT-84 ELEVATOR ([LMB / E] BOARD)'
              : isSeatedAtDesk
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
