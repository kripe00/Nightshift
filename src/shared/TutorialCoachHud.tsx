import React, { useEffect, useState } from 'react'
import { playSwitchClank } from '../modules/reactor/audioSynth'
import type { TutorialPhase } from '../simulation/rbmkPhysics'
import {
  CONSOLE_WORLD_TARGETS,
  CRISIS_COACH_CARDS,
  type TargetConsoleId,
} from './komradTutorialVox'
import { playerCameraPose } from './pointerLockState'
import type { CrisisCoachId } from './types'
import { useGameStore } from './useGameStore'

interface StepHudSpec {
  stepNum: number
  title: string
  targetConsole: TargetConsoleId
  whereText: string
  whatText: string
  whyText: string
  isSafetyDrill?: boolean
}

const STEP_SPECS: Partial<Record<TutorialPhase, StepHudSpec>> = {
  STEP_1_COOLING: {
    stepNum: 1,
    title: 'COOLING WATER FIRST',
    targetConsole: 'UNIT_A',
    whereText: 'UNIT A — Front-Left Console ([KEY 1])',
    whatText:
      'Drag or scroll PUMP THROTTLE levers UP above 50% on both COOLING PUMP A and COOLING PUMP B.',
    whyText:
      'Moving cold water carries heat away from the fuel. Without water flow, boiling steam bubbles (Voids) make heat skyrocket!',
  },
  STEP_2_PULL_RODS: {
    stepNum: 2,
    title: 'HOW TO RAISE & LOWER POWER',
    targetConsole: 'UNIT_A2',
    whereText: 'UNIT A-2 — Far-Left Console ([KEY 6] • Bottom-Left Wheel)',
    whatText:
      'Scroll or drag CONTROL ROD DRIVE wheel UP toward 55% to release heat & climb past 500 MWt.',
    whyText:
      'Control rods work like brakes: pulling rods OUT (higher %) makes MORE power; pushing rods IN (lower %) brakes power & cools down.',
  },
  STEP_6_BASELINE_600MW: {
    stepNum: 3,
    title: 'DELIVER ELECTRICITY TO THE GRID',
    targetConsole: 'UNIT_A',
    whereText: 'UNIT A — Front-Left Console ([KEY 1] • Bottom 6 Sliders)',
    whatText:
      'Drag or click all 6 bottom Power Sliders to match their green 100 MW targets (600 MW total).',
    whyText:
      'You must deliver each town & factory its exact green target MW. UNIT C (Left Wall Batteries [KEY 5]) buffers sudden demand jumps!',
  },
  STEP_8_XENON_DRILL: {
    stepNum: 4,
    title: 'REFUEL BURNED-OUT RODS',
    targetConsole: 'UNIT_A2',
    whereText: 'UNIT A-2 — Far-Left Console ([KEY 6] • Round 37-Dot Map & Lever)',
    whatText:
      'Click the glowing AMBER dot on the round RBMK CORE map to select it, then pull the ROD REFUELING lever DOWN.',
    whyText:
      'Burned-out fuel turns amber and weakens your MW output. 4+ un-refueled amber rods will overheat the core.',
  },
  STEP_3_BUILD_STEAM: {
    stepNum: 5,
    title: 'STEAM DRUM WATER & PRESSURE',
    targetConsole: 'UNIT_B',
    whereText: 'UNIT B — Right Wing Console ([KEY 3])',
    whatText:
      'Turn FEEDWATER VALVE UP (~50%) to refill Drum Water near 0 mm. Hold STEAM VENT briefly if Pressure > 75 BAR.',
    whyText:
      'Boiling slowly empties your boiler tank: too little water melts fuel; too much steam pressure (> 75 BAR) stresses pipes.',
  },
  STEP_7_VOID_DRILL: {
    stepNum: 6,
    title: 'EMERGENCY SURVIVAL: VOIDS, XENON & SCRAM',
    targetConsole: 'UNIT_B',
    whereText: 'UNIT B ([KEY 3]) + UNIT A ([KEY 1]) + UNIT A-2 ([KEY 6])',
    whatText:
      'Steam Voids surged! Raise FEEDWATER VALVE on UNIT B (~50%) or press BORON INJECTION (UNIT A) until VOID drops below 20%.',
    whyText:
      'Learn the two RBMK killers & emergency stop below — clearing the Steam Void drill completes training!',
    isSafetyDrill: true,
  },
}

interface TelemetrySnap {
  phase: TutorialPhase
  pct: number
  metricText: string
  dirLabel: string
  dirTone: 'turn' | 'walk' | 'ready'
  crisisRemainingSec: number
  crisisMetricText: string
  activeCrisisId: CrisisCoachId | null
}

function computeDirectionGuidance(targetId: TargetConsoleId): {
  label: string
  tone: 'turn' | 'walk' | 'ready'
} {
  const target = CONSOLE_WORLD_TARGETS[targetId]
  const px = playerCameraPose.x
  const pz = playerCameraPose.z
  const yaw = playerCameraPose.yaw

  const fx = -Math.sin(yaw)
  const fz = -Math.cos(yaw)
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)

  const dx = target.x - px
  const dz = target.z - pz
  const dist = Math.hypot(dx, dz)

  const fwd = dx * fx + dz * fz
  const right = dx * rx + dz * rz
  const angleRad = Math.atan2(right, fwd)
  const angleDeg = Math.round(Math.abs((angleRad * 180) / Math.PI))

  if (angleDeg > 130) {
    return {
      label: `TURN AROUND (${angleDeg}° • ${dist.toFixed(1)}m)`,
      tone: 'turn',
    }
  }
  if (angleDeg > 25) {
    return {
      label:
        angleRad < 0
          ? `◀ TURN LEFT ${angleDeg}° • ${target.shortName}`
          : `▶ TURN RIGHT ${angleDeg}° • ${target.shortName}`,
      tone: 'turn',
    }
  }
  if (dist > 2.45) {
    return {
      label: `▲ WALK FORWARD ${dist.toFixed(1)}m`,
      tone: 'walk',
    }
  }
  return {
    label: `● FACING ${target.shortName}`,
    tone: 'ready',
  }
}

function computeCrisisMetric(id: CrisisCoachId): string {
  const s = useGameStore.getState()
  switch (id) {
    case 'HIGH_VOID':
      return `VOID: ${Math.round(s.voidFraction * 100)}% | CORE: ${Math.round(s.coreTemp)}°C`
    case 'HIGH_XENON':
      return `XENON: ${Math.round(s.xenon)}% | GEN: ${Math.round(s.energyCreatedMW)} MW`
    case 'WATER_LOW':
      return `DRUM LEVEL: ${Math.round(s.drumWaterLevel)} MM | FW: ${Math.round(s.feedwaterValve * 100)}%`
    case 'HIGH_PRESSURE':
      return `PRESSURE: ${Math.round(s.drumPressure)} BAR | TARGET: 65-70 BAR`
    case 'SPENT_ROD':
      return `SPENT CHANNELS: ${Object.keys(s.coreTileAnomalies).length} AMBER`
    case 'MELTDOWN_RISK':
      return `CORE TEMP: ${Math.round(s.coreTemp)}°C | BORON: ${Math.round(s.boronTankLevel)}%`
  }
}

function sampleHudSnapshot(): TelemetrySnap {
  const s = useGameStore.getState()
  const rawPhase = s.tutorialPhase
  const normPhase: TutorialPhase =
    rawPhase === 'STEP_0_PICKUP_WEPAD'
      ? 'STEP_1_COOLING'
      : rawPhase === 'STEP_4_SPIN_TURBINE' || rawPhase === 'STEP_5_SYNC_GRID'
        ? 'STEP_6_BASELINE_600MW'
        : rawPhase

  const spec = STEP_SPECS[normPhase]
  const activeCrisis = s.activeCrisisCoach
  const nowMs = Date.now()
  const crisisRemainingSec = activeCrisis
    ? Math.max(0, (activeCrisis.expiresAtMs - nowMs) / 1000)
    : 0

  let pct = 0
  let metricText = ''

  if (normPhase === 'STEP_1_COOLING') {
    const pA = Math.round(s.pumpThrottle[0])
    const pB = Math.round(s.pumpThrottle[1])
    pct = Math.min(100, Math.round(((Math.min(50, pA) + Math.min(50, pB)) / 100) * 100))
    metricText = `PUMP A: ${pA}%  •  PUMP B: ${pB}%  (NEED >= 50% EACH)`
  } else if (normPhase === 'STEP_2_PULL_RODS') {
    const rodPct = Math.round(s.controlRodLevel)
    const mwt = Math.round(s.thermalPower)
    pct = Math.min(100, Math.round(((Math.min(50, rodPct) / 50) * 0.5 + Math.min(1, mwt / 500) * 0.5) * 100))
    metricText = `RODS: ${rodPct}% (TARGET ~55%)  •  THERMAL: ${mwt} / 500 MWt`
  } else if (normPhase === 'STEP_6_BASELINE_600MW') {
    const matched = s.substations.filter(
      (sub) => Math.abs(sub.allocatedMW - sub.targetMW) <= 15
    ).length
    pct = Math.min(100, Math.round((matched / 6) * 100))
    metricText = `SECTORS MATCHED: ${matched}/6  •  GRID OUTPUT: ${Math.round(s.totalElectricalMW)} / 600 MW`
  } else if (normPhase === 'STEP_8_XENON_DRILL') {
    const spentCount = Object.keys(s.coreTileAnomalies).length
    const locked = s.selectedRefuelChannel !== null
    pct = spentCount === 0 ? 100 : locked ? 55 : 15
    metricText =
      spentCount === 0
        ? 'ALL CHANNELS REFUELED!'
        : `SPENT AMBER RODS: ${spentCount}  •  LOCKED: ${locked ? `#${(s.selectedRefuelChannel ?? 0) + 1} (PULL LEVER DOWN!)` : 'NONE — CLICK AMBER DOT'}`
  } else if (normPhase === 'STEP_3_BUILD_STEAM') {
    const fw = Math.round(s.feedwaterValve * 100)
    const press = Math.round(s.drumPressure)
    const mm = Math.round(s.drumWaterLevel)
    pct = Math.min(100, Math.round((Math.min(50, fw) / 50) * 100))
    metricText = `FEEDWATER: ${fw}% (TARGET ~50%)  •  DRUM: ${mm > 0 ? `+${mm}` : mm} mm  •  ${press} BAR`
  } else if (normPhase === 'STEP_7_VOID_DRILL') {
    const vPct = Math.round(s.voidFraction * 100)
    const fw = Math.round(s.feedwaterValve * 100)
    pct = Math.min(100, Math.max(0, Math.round((1 - Math.max(0, vPct - 20) / 20) * 100)))
    metricText = `STEAM VOID: ${vPct}% (CLEAR < 20%)  •  FEEDWATER: ${fw}%  •  XENON: ${Math.round(s.xenon)}%`
  }

  const targetId: TargetConsoleId = activeCrisis
    ? CRISIS_COACH_CARDS[activeCrisis.id].targetConsole
    : (spec?.targetConsole ?? 'UNIT_A')
  const dir = computeDirectionGuidance(targetId)

  return {
    phase: normPhase,
    pct,
    metricText,
    dirLabel: dir.label,
    dirTone: dir.tone,
    crisisRemainingSec,
    crisisMetricText: activeCrisis ? computeCrisisMetric(activeCrisis.id) : '',
    activeCrisisId: activeCrisis?.id ?? null,
  }
}

export const TutorialCoachHud: React.FC<{ menusOpen: boolean }> = ({
  menusOpen,
}) => {
  const phase = useGameStore((s) => s.phase)
  const isShiftControlReady = useGameStore((s) => s.isShiftControlReady)
  const diagFeedActive = useGameStore((s) => s.diagFeedActive)
  const tutorialPhase = useGameStore((s) => s.tutorialPhase)
  const tutorialHintsHidden = useGameStore((s) => s.tutorialHintsHidden)
  const activeCrisisCoach = useGameStore((s) => s.activeCrisisCoach)

  const [snap, setSnap] = useState<TelemetrySnap>(() => sampleHudSnapshot())

  const showTutorial = tutorialPhase !== 'COMPLETED'
  const showCrisis = !showTutorial && activeCrisisCoach !== null
  const isVisible =
    phase === 'playing' &&
    isShiftControlReady &&
    !diagFeedActive &&
    !menusOpen &&
    (showTutorial || showCrisis)

  useEffect(() => {
    if (!isVisible) return
    const immediate = window.setTimeout(() => {
      setSnap(sampleHudSnapshot())
    }, 0)
    const timer = window.setInterval(() => {
      setSnap(sampleHudSnapshot())
    }, 125)
    return () => {
      window.clearTimeout(immediate)
      window.clearInterval(timer)
    }
  }, [isVisible, tutorialPhase, activeCrisisCoach])

  if (!isVisible) return null

  if (showCrisis && snap.activeCrisisId) {
    const card = CRISIS_COACH_CARDS[snap.activeCrisisId]
    const borderCol =
      card.accent === 'red'
        ? '#ff3b2f'
        : card.accent === 'violet'
          ? '#c77dff'
          : '#ffb833'
    const bgCol =
      card.accent === 'red'
        ? 'rgba(32, 7, 7, 0.92)'
        : card.accent === 'violet'
          ? 'rgba(24, 9, 36, 0.92)'
          : 'rgba(28, 19, 5, 0.92)'
    const timerFrac = Math.max(0, Math.min(1, snap.crisisRemainingSec / 8))

    return (
      <div className="pointer-events-none fixed top-2.5 left-1/2 z-40 w-[min(780px,93vw)] -translate-x-1/2 select-none">
        <div
          className="overflow-hidden rounded border-2 px-4 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.88)]"
          style={{ borderColor: borderCol, backgroundColor: bgCol }}
        >
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#090909]"
                style={{ backgroundColor: borderCol }}
              >
                CRISIS COACH • {card.badge}
              </span>
              <span
                className="text-sm font-bold tracking-wider sm:text-base"
                style={{
                  color: borderCol,
                  fontFamily: '"Kremlin", "VT323", monospace',
                }}
              >
                {card.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-white/25 bg-black/50 px-2 py-0.5 font-mono text-[11px] font-bold text-[#ffe699]">
                {snap.dirLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  playSwitchClank(true)
                  useGameStore.getState().dismissCrisisCoach()
                }}
                className="pointer-events-auto cursor-pointer rounded border border-white/35 bg-black/60 px-2 py-0.5 font-mono text-[11px] font-bold text-white hover:bg-white/15"
              >
                [ DISMISS • N ]
              </button>
            </div>
          </div>

          <div className="space-y-1 font-mono text-xs leading-snug text-[#f2efe4] sm:text-[13px]">
            <div>
              <span className="font-bold" style={{ color: borderCol }}>
                WHAT&apos;S HAPPENING:{' '}
              </span>
              <span>{card.whatHappening}</span>
            </div>
            <div>
              <span className="font-bold text-[#39ff7a]">HOW TO FIX IT: </span>
              <span>{card.howToFix}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] font-bold text-[#ffd27d]">
              {snap.crisisMetricText} • {CONSOLE_WORLD_TARGETS[card.targetConsole].keyHint}
            </span>
            <span className="font-mono text-[11px] text-white/70">
              {snap.crisisRemainingSec.toFixed(1)}s
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-black/60">
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${timerFrac * 100}%`,
                backgroundColor: borderCol,
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  const spec = STEP_SPECS[snap.phase]
  if (!spec) return null

  if (tutorialHintsHidden) {
    return (
      <div className="pointer-events-none fixed top-2.5 left-1/2 z-40 -translate-x-1/2 select-none">
        <div className="flex items-center gap-3 rounded border border-[#39ff7a]/65 bg-[#06150b]/92 px-3 py-1 font-mono text-xs shadow-lg">
          <span className="font-bold text-[#ffb833]">
            TRAINING {spec.stepNum}/6: {spec.title}
          </span>
          <span className="text-[#9de8b8]">{snap.dirLabel}</span>
          <button
            type="button"
            onClick={() => {
              playSwitchClank(true)
              useGameStore.getState().setTutorialHintsHidden(false)
            }}
            className="pointer-events-auto cursor-pointer rounded border border-[#39ff7a]/70 bg-[#0d2b18] px-2 py-0.5 text-[11px] font-bold text-[#39ff7a] hover:bg-[#174226]"
          >
            [ SHOW HINTS • H ]
          </button>
        </div>
      </div>
    )
  }

  const dirBg =
    snap.dirTone === 'ready'
      ? 'border-[#39ff7a]/80 bg-[#0c2d18] text-[#39ff7a]'
      : snap.dirTone === 'walk'
        ? 'border-[#ffb833]/80 bg-[#2c1f06] text-[#ffd46b]'
        : 'border-[#ff9d00] bg-[#361c04] text-[#ffe17d]'

  return (
    <div className="pointer-events-none fixed top-2.5 left-1/2 z-40 w-[min(780px,93vw)] -translate-x-1/2 select-none">
      <div className="rounded border-2 border-[#39ff7a]/75 bg-[#06120b]/90 px-4 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.88)]">
        {/* Header Bar */}
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#214b31] pb-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#ffb833] px-1.5 py-0.5 font-mono text-[11px] font-black text-[#08100a]">
              STEP {spec.stepNum}/6
            </span>
            <span
              className="text-sm font-bold tracking-wider text-[#39ff7a] sm:text-base"
              style={{ fontFamily: '"Kremlin", "VT323", monospace' }}
            >
              {spec.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => {
                playSwitchClank(true)
                useGameStore.getState().advanceTutorialStep()
              }}
              className="pointer-events-auto cursor-pointer rounded border border-[#39ff7a]/80 bg-[#0f341d] px-2 py-0.5 font-bold text-[#39ff7a] hover:bg-[#184d2c]"
            >
              {spec.stepNum === 6 ? '[ FINISH • N ]' : '[ NEXT STEP • N ]'}
            </button>
            <button
              type="button"
              onClick={() => {
                playSwitchClank(true)
                useGameStore.getState().setTutorialHintsHidden(true)
              }}
              className="pointer-events-auto cursor-pointer rounded border border-[#ffb833]/65 bg-[#241a05] px-2 py-0.5 font-bold text-[#ffb833] hover:bg-[#382908]"
            >
              [ HIDE • H ]
            </button>
            <button
              type="button"
              onClick={() => {
                playSwitchClank(true)
                useGameStore.getState().skipTutorial()
              }}
              className="pointer-events-auto cursor-pointer rounded border border-[#ff5247]/70 bg-[#2d0a08] px-2 py-0.5 font-bold text-[#ff7c73] hover:bg-[#47110e]"
            >
              [ SKIP • BKSP ]
            </button>
          </div>
        </div>

        {/* 6-Step Progress Pills */}
        <div className="mb-2 grid grid-cols-6 gap-1">
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const done = n < spec.stepNum
            const current = n === spec.stepNum
            return (
              <div
                key={n}
                className="h-1.5 rounded-sm transition-colors"
                style={{
                  backgroundColor: done
                    ? '#39ff7a'
                    : current
                      ? '#ffb833'
                      : '#142c1d',
                }}
              />
            )
          })}
        </div>

        {/* Plain-English Where / What / Why Rows */}
        <div className="space-y-1 font-mono text-xs leading-snug sm:text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold text-[#ffd24c]">📍 WHERE: </span>
              <span className="font-semibold text-[#f3efe0]">
                {spec.whereText}
              </span>
            </div>
            <span
              className={`rounded border px-2 py-0.5 text-[11px] font-bold tracking-wide ${dirBg}`}
            >
              {snap.dirLabel}
            </span>
          </div>

          <div>
            <span className="font-bold text-[#39ff7a]">🔧 WHAT TO DO: </span>
            <span className="text-[#e7f7ec]">{spec.whatText}</span>
          </div>

          {/* Live Action Telemetry + Fill Bar */}
          <div className="flex items-center gap-2.5 pt-0.5">
            <div className="h-2 w-28 shrink-0 overflow-hidden rounded border border-[#245938] bg-[#0a1c11]">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${Math.max(4, snap.pct)}%`,
                  backgroundColor: snap.pct >= 95 ? '#39ff7a' : '#ffb833',
                }}
              />
            </div>
            <span className="font-mono text-[11px] font-bold text-[#a8f5c2]">
              {snap.metricText}
            </span>
          </div>

          <div>
            <span className="font-bold text-[#7ef9ff]">💡 WHY: </span>
            <span className="text-[#c9e6d3]">{spec.whyText}</span>
          </div>
        </div>

        {/* Step 6 Interactive Survival Quick-Reference (Voids vs Xenon vs SCRAM) */}
        {spec.isSafetyDrill && (
          <div className="mt-2 grid grid-cols-1 gap-1.5 border-t border-[#214b31] pt-2 font-mono text-[11px] leading-tight sm:grid-cols-3">
            <div className="rounded border border-[#ff7c3a]/70 bg-[#261105]/85 p-1.5">
              <div className="font-bold text-[#ff9d42]">
                🔥 HIGH VOIDS = BOILING BUBBLES
              </div>
              <div className="mt-0.5 text-[#f4dfd0]">
                Steam bubbles multiply heat! Crank Pumps &amp; Feedwater UP,
                push Rods IN (lower %) or hit Boron.
              </div>
            </div>
            <div className="rounded border border-[#c77dff]/70 bg-[#1c0a2c]/85 p-1.5">
              <div className="font-bold text-[#d79cff]">
                ☠️ HIGH XENON = EXHAUST CHOKE
              </div>
              <div className="mt-0.5 text-[#ebd9fa]">
                Do NOT yank rods to 100%! Keep water flowing, pull Rods OUT
                gradually &amp; let UNIT C Batteries buffer MW.
              </div>
            </div>
            <div className="rounded border border-[#ff3b2f]/70 bg-[#2b0807]/85 p-1.5">
              <div className="font-bold text-[#ff665c]">
                🚨 MELTDOWN STOP (&gt;700°C)
              </div>
              <div className="mt-0.5 text-[#fad6d4]">
                Flip red cover on UNIT A: hit BORON INJECTION first, or AZ-5
                SCRAM (brief spike if Voids high—flood water too!).
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
