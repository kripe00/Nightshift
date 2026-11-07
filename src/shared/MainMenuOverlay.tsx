import React, { useEffect, useRef, useState } from 'react'
import {
  playBunkerAirlockSlam,
  playKnifeSwitchSlam,
  playSwitchClank,
} from '../modules/inspector/audio'
import { useDeskStore } from '../modules/inspector/useDeskStore'
import {
  startSoundtrack,
  updateSoundtrackState,
} from '../modules/reactor/soundtrackPlayer'
import { useGameStore } from './useGameStore'

const STORAGE_KEY = 'MIP_SAVED_SHIFT_84'

interface SavedShiftSnapshot {
  savedAt: number
  game: {
    shiftNumber: number
    shiftTimeMinutes: number
    treasonStrikes: number
    lastDecisionFeedback: string | null
    activeMandate: ReturnType<typeof useGameStore.getState>['activeMandate']
    coreTemp: number
    pressureBar: number
    radiationLevel: number
    powerAllocation: {
      cooling: number
      defense: number
      facility: number
    }
    redlineInstability: number
    isBlackout: boolean
    pumpsActive: [boolean, boolean]
    pumpThrottle: [number, number]
    pumpAHeat: number
    pumpBHeat: number
    lubeOilPressure: number
    oilCoolerValve: number
    boronTankLevel: number
    graphiteTemp: number
    nitrogenLoopValve: number
    heliumPressure: number
    bubblerLevel: number
    sealToggles: [boolean, boolean, boolean]
    containmentSealLocked: boolean
    gridHz: number
    excitationTrim: number
    ventilationActive: boolean
    kgbLineActive: boolean
  }
  desk: {
    documents: ReturnType<typeof useDeskStore.getState>['documents']
    printingDoc: ReturnType<typeof useDeskStore.getState>['printingDoc']
    nextTemplateIndex: number
    commendations: number
    citations: number
    lastVerdict: ReturnType<typeof useDeskStore.getState>['lastVerdict']
  }
}

interface SmokePuff {
  originXRatio: number
  originYRatio: number
  phase: number
  speed: number
  driftX: number
  baseRadius: number
}

const SMOKE_PUFFS: SmokePuff[] = Array.from({ length: 28 }, (_, i) => {
  // 3 sources: Cooling Tower 1 (0.845, 0.365), Cooling Tower 2 (0.945, 0.385), Reactor Stack (0.648, 0.295)
  const sourceIdx = i % 3
  const originXRatio =
    sourceIdx === 0 ? 0.845 : sourceIdx === 1 ? 0.945 : 0.648
  const originYRatio =
    sourceIdx === 0 ? 0.365 : sourceIdx === 1 ? 0.385 : 0.295
  return {
    originXRatio,
    originYRatio,
    phase: (i / 28) * Math.PI * 2,
    speed: 0.22 + (i % 5) * 0.04,
    driftX: ((i % 7) - 3) * 0.012,
    baseRadius: sourceIdx === 2 ? 10 + (i % 4) * 4 : 22 + (i % 5) * 7,
  }
})

function readSavedShift(): SavedShiftSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedShiftSnapshot
    if (
      !parsed ||
      typeof parsed.game?.shiftTimeMinutes !== 'number' ||
      !Array.isArray(parsed.desk?.documents)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveCurrentShiftToStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const g = useGameStore.getState()
    const d = useDeskStore.getState()
    const snapshot: SavedShiftSnapshot = {
      savedAt: Date.now(),
      game: {
        shiftNumber: g.shiftNumber,
        shiftTimeMinutes: g.shiftTimeMinutes,
        treasonStrikes: g.treasonStrikes,
        lastDecisionFeedback: g.lastDecisionFeedback,
        activeMandate: g.activeMandate,
        coreTemp: g.coreTemp,
        pressureBar: g.pressureBar,
        radiationLevel: g.radiationLevel,
        powerAllocation: { ...g.powerAllocation },
        redlineInstability: g.redlineInstability,
        isBlackout: g.isBlackout,
        pumpsActive: [...g.pumpsActive] as [boolean, boolean],
        pumpThrottle: [...g.pumpThrottle] as [number, number],
        pumpAHeat: g.pumpAHeat,
        pumpBHeat: g.pumpBHeat,
        lubeOilPressure: g.lubeOilPressure,
        oilCoolerValve: g.oilCoolerValve,
        boronTankLevel: g.boronTankLevel,
        graphiteTemp: g.graphiteTemp,
        nitrogenLoopValve: g.nitrogenLoopValve,
        heliumPressure: g.heliumPressure,
        bubblerLevel: g.bubblerLevel,
        sealToggles: [...g.sealToggles] as [boolean, boolean, boolean],
        containmentSealLocked: g.containmentSealLocked,
        gridHz: g.gridHz,
        excitationTrim: g.excitationTrim,
        ventilationActive: g.ventilationActive,
        kgbLineActive: g.kgbLineActive,
      },
      desk: {
        documents: d.documents,
        printingDoc: d.printingDoc,
        nextTemplateIndex: d.nextTemplateIndex,
        commendations: d.commendations,
        citations: d.citations,
        lastVerdict: d.lastVerdict,
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignore storage quota errors
  }
}

export const MainMenuOverlay: React.FC = () => {
  const phase = useGameStore((s) => s.phase)
  const shiftTimeMinutes = useGameStore((s) => s.shiftTimeMinutes)

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(true)
  const [powerUpStage, setPowerUpStage] = useState<number>(0) // 0 = inactive, 1..4 = 3-second Bunker Power-Up / Airlock Seal sequence
  const [posterLoadFailed, setPosterLoadFailed] = useState<boolean>(false)
  const [savedShift, setSavedShift] = useState<SavedShiftSnapshot | null>(() =>
    readSavedShift()
  )

  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Continuously persist active shift progress in localStorage whenever shiftTimeMinutes advances
  useEffect(() => {
    if (phase !== 'playing') return
    saveCurrentShiftToStorage()
  }, [phase, shiftTimeMinutes])

  // 60 FPS High-DPI Atmospheric Animation Canvas over the Propaganda Poster
  useEffect(() => {
    if (!isMenuOpen) return
    const canvas = fxCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    const startTime = performance.now()

    const renderFrame = (now: number) => {
      const t = (now - startTime) * 0.001
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.clientWidth || window.innerWidth
      const cssH = canvas.clientHeight || window.innerHeight
      const targetW = Math.round(cssW * dpr)
      const targetH = Math.round(cssH * dpr)
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, cssW, cssH)

      // ----------------------------------------------------------------------
      // 1. RISING DARK SMOKE & STEAM PLUMES (Cooling Towers & Reactor Chimney)
      // ----------------------------------------------------------------------
      for (let i = 0; i < SMOKE_PUFFS.length; i++) {
        const puff = SMOKE_PUFFS[i]
        const cycle = (t * puff.speed + puff.phase) % 1
        const px =
          (puff.originXRatio + puff.driftX * cycle + Math.sin(t * 1.4 + i) * 0.008) *
          cssW
        const py = (puff.originYRatio - cycle * 0.24) * cssH
        const radius = puff.baseRadius * (0.75 + cycle * 1.85) * (cssW / 1280)
        const alpha = Math.sin(cycle * Math.PI) * 0.34

        const smokeGrad = ctx.createRadialGradient(px, py, radius * 0.1, px, py, radius)
        smokeGrad.addColorStop(0, `rgba(18, 8, 10, ${alpha.toFixed(3)})`)
        smokeGrad.addColorStop(0.6, `rgba(58, 12, 14, ${(alpha * 0.65).toFixed(3)})`)
        smokeGrad.addColorStop(1, 'rgba(18, 8, 10, 0)')

        ctx.fillStyle = smokeGrad
        ctx.beginPath()
        ctx.arc(px, py, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // ----------------------------------------------------------------------
      // 2. LIVE CRT MONITOR SWEEP, PULSING EMBLEM GLOW & SCROLLING SCANLINES
      // ----------------------------------------------------------------------
      const crtCx = cssW * 0.5
      const crtCy = cssH * 0.382
      const crtW = cssW * 0.265
      const crtH = cssH * 0.315
      const crtR = Math.min(crtW, crtH) * 0.52

      ctx.save()
      ctx.beginPath()
      ctx.roundRect(crtCx - crtW / 2, crtCy - crtH / 2, crtW, crtH, 28)
      ctx.clip()

      // Pulsing Phosphor-Green Radiation Emblem Glow
      const crtPulse = 0.14 + (Math.sin(t * 3.2) * 0.5 + 0.5) * 0.16
      const crtGlow = ctx.createRadialGradient(
        crtCx,
        crtCy,
        crtR * 0.08,
        crtCx,
        crtCy,
        crtR * 1.15
      )
      crtGlow.addColorStop(0, `rgba(120, 255, 150, ${crtPulse.toFixed(3)})`)
      crtGlow.addColorStop(0.6, `rgba(35, 255, 90, ${(crtPulse * 0.45).toFixed(3)})`)
      crtGlow.addColorStop(1, 'rgba(10, 60, 24, 0)')
      ctx.fillStyle = crtGlow
      ctx.fillRect(crtCx - crtW / 2, crtCy - crtH / 2, crtW, crtH)

      // Rotating Radar Sweep Beam inside the CRT Screen
      const sweepAngle = t * 1.65
      ctx.save()
      ctx.translate(crtCx, crtCy)
      ctx.rotate(sweepAngle)
      const beamGrad = ctx.createLinearGradient(0, 0, crtR, 0)
      beamGrad.addColorStop(0, 'rgba(180, 255, 200, 0.34)')
      beamGrad.addColorStop(1, 'rgba(51, 255, 102, 0.0)')
      ctx.fillStyle = beamGrad
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, crtR * 1.15, -0.32, 0.04)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Scrolling Horizontal CRT Scanline Bar & Fine Scanlines
      const scanBarY =
        crtCy - crtH / 2 + (((t * 75) % (crtH + 40)) - 20)
      const barGrad = ctx.createLinearGradient(0, scanBarY - 14, 0, scanBarY + 14)
      barGrad.addColorStop(0, 'rgba(51, 255, 102, 0)')
      barGrad.addColorStop(0.5, 'rgba(160, 255, 185, 0.22)')
      barGrad.addColorStop(1, 'rgba(51, 255, 102, 0)')
      ctx.fillStyle = barGrad
      ctx.fillRect(crtCx - crtW / 2, scanBarY - 14, crtW, 28)

      ctx.fillStyle = 'rgba(0, 18, 6, 0.24)'
      for (let sy = crtCy - crtH / 2; sy < crtCy + crtH / 2; sy += 4) {
        ctx.fillRect(crtCx - crtW / 2, sy, crtW, 1.5)
      }
      ctx.restore()

      // ----------------------------------------------------------------------
      // 3. CRACKLING RED ELECTRICAL SPARKS ON LEFT THROTTLE & PULSING AZ-5 GLOW
      // ----------------------------------------------------------------------
      // Pulsing Red Emergency Glow on Center AZ-5 Button
      const az5X = cssW * 0.495
      const az5Y = cssH * 0.825
      const az5R = cssW * 0.068
      const az5Pulse = 0.24 + Math.pow(Math.sin(t * 4.5) * 0.5 + 0.5, 1.6) * 0.38
      const az5Grad = ctx.createRadialGradient(az5X, az5Y, az5R * 0.1, az5X, az5Y, az5R)
      az5Grad.addColorStop(0, `rgba(255, 50, 40, ${az5Pulse.toFixed(3)})`)
      az5Grad.addColorStop(0.55, `rgba(255, 25, 20, ${(az5Pulse * 0.48).toFixed(3)})`)
      az5Grad.addColorStop(1, 'rgba(255, 0, 0, 0)')
      ctx.fillStyle = az5Grad
      ctx.beginPath()
      ctx.arc(az5X, az5Y, az5R, 0, Math.PI * 2)
      ctx.fill()

      // Intermittent Jagged Red/Amber Electrical Sparks around Left Hand's Lever
      const sparkBurst =
        Math.sin(t * 19.0) > 0.15 || Math.cos(t * 31.0) > 0.45
      if (sparkBurst) {
        const leverBaseX = cssW * 0.225
        const leverBaseY = cssH * 0.76
        const arcCount = 3
        for (let a = 0; a < arcCount; a++) {
          const seed = Math.floor(t * 24) + a * 17
          const dirAngle = -0.9 + ((seed % 11) / 11) * 1.6
          const len = (28 + (seed % 5) * 14) * (cssW / 1280)

          ctx.save()
          ctx.strokeStyle = a % 2 === 0 ? '#ff3b2a' : '#ffcf56'
          ctx.shadowColor = '#ff2a2a'
          ctx.shadowBlur = 10
          ctx.lineWidth = a === 0 ? 2.5 : 1.8
          ctx.beginPath()
          let curX = leverBaseX + ((seed % 7) - 3) * 8
          let curY = leverBaseY + (((seed * 3) % 7) - 3) * 10
          ctx.moveTo(curX, curY)
          for (let s = 1; s <= 4; s++) {
            const jitterX = Math.sin(seed * s * 3.7) * 12
            const jitterY = Math.cos(seed * s * 5.1) * 12
            curX += Math.cos(dirAngle) * (len / 4) + jitterX
            curY += Math.sin(dirAngle) * (len / 4) + jitterY
            ctx.lineTo(curX, curY)
          }
          ctx.stroke()
          ctx.restore()
        }
      }

      ctx.restore()
      animId = window.requestAnimationFrame(renderFrame)
    }

    animId = window.requestAnimationFrame(renderFrame)
    return () => window.cancelAnimationFrame(animId)
  }, [isMenuOpen])

  const hasLiveOrSavedShift = phase === 'playing' || savedShift !== null

  const triggerThreeSecondBunkerPowerUp = () => {
    setPowerUpStage(1)
    playBunkerAirlockSlam()
    window.setTimeout(() => {
      playSwitchClank(true)
      setPowerUpStage(2)
    }, 750)
    window.setTimeout(() => {
      playKnifeSwitchSlam(true)
      setPowerUpStage(3)
    }, 1600)
    window.setTimeout(() => {
      playSwitchClank(false)
      setPowerUpStage(4)
    }, 2350)
    window.setTimeout(() => {
      setPowerUpStage(0)
    }, 3000)
  }

  const handleNewGame = () => {
    startSoundtrack()
    const isMuted = useGameStore.getState().isMusicMuted
    updateSoundtrackState(false, isMuted)

    useDeskStore.getState().resetDeskStore()
    useGameStore.getState().resetShift()
    saveCurrentShiftToStorage()
    setSavedShift(readSavedShift())
    setIsMenuOpen(false)
    triggerThreeSecondBunkerPowerUp()
  }

  const handleContinueGame = () => {
    if (!hasLiveOrSavedShift) return
    playSwitchClank(true)
    startSoundtrack()
    const isMuted = useGameStore.getState().isMusicMuted
    updateSoundtrackState(false, isMuted)

    if (phase !== 'playing' && savedShift) {
      useGameStore.setState({
        ...savedShift.game,
        phase: 'playing',
      })
      useDeskStore.setState({
        ...savedShift.desk,
      })
    } else if (phase === 'boot') {
      useGameStore.getState().startShift()
    }
    setIsMenuOpen(false)
  }

  if (!isMenuOpen) {
    return (
      <>
        {/* 3-Second Bunker Power-Up / Airlock Seal Audio-Visual Sequence */}
        {powerUpStage > 0 && (
          <div
            className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-700 select-none"
            style={{
              backgroundColor:
                powerUpStage === 1
                  ? 'rgba(4, 7, 5, 0.96)'
                  : powerUpStage === 2
                    ? 'rgba(6, 12, 8, 0.78)'
                    : powerUpStage === 3
                      ? 'rgba(8, 18, 12, 0.42)'
                      : 'rgba(8, 18, 12, 0.0)',
            }}
          >
            <div className="border-2 border-[#33ff66] bg-[#08140c]/95 px-8 py-5 text-center shadow-[0_0_40px_rgba(51,255,102,0.35)]">
              <div
                className="text-xl font-bold tracking-widest text-[#33ff66]"
                style={{ fontFamily: '"Courier Prime", monospace' }}
              >
                {powerUpStage === 1 && '/// BUNKER AIRLOCK SEAL LOCKED ///'}
                {powerUpStage === 2 && '/// ENGAGING AUXILIARY RELAYS & PUMPS ///'}
                {powerUpStage === 3 && '/// K.O.M.R.A.D.-84 CRT TELEMETRY ONLINE ///'}
                {powerUpStage === 4 && '/// SHIFT 00:00 COMMENCING ///'}
              </div>
              <div
                className="mt-2 text-sm font-bold tracking-widest text-[#ffb74d]"
                style={{ fontFamily: '"Courier Prime", monospace' }}
              >
                SECTOR 84 • RBMK-1000 CONTROL BUNKER
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            playSwitchClank(false)
            if (phase === 'playing') {
              saveCurrentShiftToStorage()
              setSavedShift(readSavedShift())
            }
            setIsMenuOpen(true)
          }}
          className="fixed top-3 left-3 z-40 cursor-pointer border-2 border-[#b8a46b] bg-[#141b17]/90 px-3.5 py-1.5 font-mono text-xs font-bold tracking-widest text-[#e8f5e9] shadow-[0_3px_0_#090c0a] transition hover:border-[#33ff66] hover:text-[#33ff66] active:translate-y-0.5"
        >
          [ MENU ]
        </button>
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0908] select-none">
      {/* Aged 1984 Soviet Propaganda Poster Frame (#d8c89e) */}
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden border-[12px] border-[#d8c89e] bg-[#120707] shadow-[inset_0_0_0_4px_#141414]">
        {!posterLoadFailed ? (
          <img
            src="./main-menu-poster.jpg"
            alt="MELTDOWN IS PROPAGANDA"
            onError={() => setPosterLoadFailed(true)}
            className="h-full w-full object-cover object-center"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          /* Clean Poster Fallback Illustration */
          <div className="relative flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#0b0708] via-[#7a0e0e] to-[#ff2a1a] p-8">
            <h1
              className="mt-2 text-center text-5xl font-bold tracking-wider text-[#d8c89e] drop-shadow-[0_4px_0_#141414] md:text-7xl"
              style={{ fontFamily: '"Kremlin", "Courier Prime", monospace' }}
            >
              MELTDOWN IS PROPAGANDA
            </h1>
            <div className="relative my-auto flex h-64 w-80 items-center justify-center rounded-3xl border-8 border-[#5c6654] bg-[#18ff4a] shadow-[0_0_50px_rgba(51,255,102,0.55)]">
              <span className="text-7xl text-[#0b2914]">★</span>
            </div>
            <div className="h-24 w-full bg-[#141414]" />
          </div>
        )}

        {/* High-DPI 60 FPS Animated Atmospheric Overlay Canvas (Cooling Tower Smoke, CRT Radar Sweep & Scanlines, Lever Sparks & AZ-5 Pulse) */}
        <canvas
          ref={fxCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {/* Subtle Vignette Over Poster */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(0,0,0,0) 48%, rgba(8,10,9,0.55) 100%)',
          }}
        />

        {/* Two Wide, Chunky, High-Contrast Soviet Industrial Button Plates (English Only) */}
        <div className="absolute inset-x-0 top-[54%] flex flex-col items-center justify-center gap-4 px-4">
          {/* 1. NEW GAME // START SHIFT */}
          <button
            type="button"
            onClick={handleNewGame}
            style={{
              minWidth: '380px',
              padding: '16px 28px',
              fontFamily: '"Courier Prime", monospace',
            }}
            className="group relative cursor-pointer border-[3px] border-[#9ec4a5] bg-[#132419]/95 text-center shadow-[inset_0_2px_0_rgba(255,255,255,0.22),0_7px_0_#070b08,0_14px_28px_rgba(0,0,0,0.9)] transition-all hover:border-[#33ff66] hover:bg-[#1a3323] hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.3),0_7px_0_#070b08,0_0_28px_rgba(51,255,102,0.55)] active:translate-y-1 active:shadow-[0_3px_0_#070b08]"
          >
            {/* 4 Corner Rivet Studs */}
            <span className="pointer-events-none absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-[#8a9e8f]" />
            <span className="pointer-events-none absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#8a9e8f]" />
            <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-[#8a9e8f]" />
            <span className="pointer-events-none absolute right-1.5 bottom-1.5 h-1.5 w-1.5 rounded-full bg-[#8a9e8f]" />

            <span className="block text-[20px] leading-tight font-bold tracking-wider text-[#e8f5e9] drop-shadow-[0_2px_0_#060a07] group-hover:text-[#ffffff]">
              NEW GAME // START SHIFT
            </span>
          </button>

          {/* 2. CONTINUE GAME // RESUME DUTY */}
          <button
            type="button"
            disabled={!hasLiveOrSavedShift}
            onClick={handleContinueGame}
            style={{
              minWidth: '380px',
              padding: '16px 28px',
              fontFamily: '"Courier Prime", monospace',
            }}
            className={`group relative border-[3px] text-center transition-all ${
              hasLiveOrSavedShift
                ? 'cursor-pointer border-[#c8a86b] bg-[#261b12]/95 shadow-[inset_0_2px_0_rgba(255,255,255,0.2),0_7px_0_#090705,0_14px_28px_rgba(0,0,0,0.9)] hover:border-[#ffb74d] hover:bg-[#332417] hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.28),0_7px_0_#090705,0_0_28px_rgba(255,183,77,0.5)] active:translate-y-1 active:shadow-[0_3px_0_#090705]'
                : 'cursor-not-allowed border-[#524d42] bg-[#171614]/90 opacity-65 shadow-[0_5px_0_#080807]'
            }`}
          >
            {/* 4 Corner Rivet Studs */}
            <span className="pointer-events-none absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-[#9e8c6a]" />
            <span className="pointer-events-none absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#9e8c6a]" />
            <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full bg-[#9e8c6a]" />
            <span className="pointer-events-none absolute right-1.5 bottom-1.5 h-1.5 w-1.5 rounded-full bg-[#9e8c6a]" />

            <span
              className={`block text-[20px] leading-tight font-bold tracking-wider drop-shadow-[0_2px_0_#080604] ${
                hasLiveOrSavedShift
                  ? 'text-[#ffb74d] group-hover:text-[#ffd584]'
                  : 'text-[#8c8576]'
              }`}
            >
              CONTINUE GAME // RESUME DUTY
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
