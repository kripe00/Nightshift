import React, { useEffect, useRef } from 'react'
import type { TutorialPhase } from '../simulation/rbmkPhysics'
import { playerCameraPose } from './pointerLockState'
import { isDeskAppTutorialEnabled } from './sovOsAppRegistry'
import { useGameStore } from './useGameStore'

interface LandmarkDef {
  id: 'SKALA' | 'UNIT_A' | 'UNIT_A2' | 'UNIT_B' | 'UNIT_C' | 'DESK'
  label: string
  x: number
  z: number
}

const COMPASS_LANDMARKS: readonly LandmarkDef[] = [
  { id: 'SKALA', label: 'SKALA-84', x: 0.0, z: -3.96 },
  { id: 'UNIT_A', label: 'UNIT A', x: -2.83, z: -0.96 },
  { id: 'UNIT_A2', label: 'UNIT A-2', x: -4.3, z: -1.35 },
  { id: 'UNIT_B', label: 'UNIT B', x: 4.15, z: -0.98 },
  { id: 'UNIT_C', label: 'UNIT C', x: -5.16, z: 1.42 },
  { id: 'DESK', label: 'DESK', x: 0.0, z: 1.8 },
]

function getTargetLandmarkForPhase(phase: TutorialPhase): {
  stepNum: number
  targetId: LandmarkDef['id']
  targetLabel: string
} {
  const norm: TutorialPhase =
    phase === 'STEP_0_PICKUP_WEPAD'
      ? 'STEP_1_COOLING'
      : phase === 'STEP_4_SPIN_TURBINE' || phase === 'STEP_5_SYNC_GRID'
        ? 'STEP_6_BASELINE_600MW'
        : phase

  switch (norm) {
    case 'AWAITING_VOLKOV_MAIL':
      return { stepNum: 0, targetId: 'DESK', targetLabel: 'DESK' }
    case 'STEP_1_COOLING':
      return { stepNum: 1, targetId: 'UNIT_A', targetLabel: 'UNIT A' }
    case 'STEP_2_PULL_RODS':
      return { stepNum: 2, targetId: 'UNIT_A2', targetLabel: 'UNIT A-2' }
    case 'STEP_6_BASELINE_600MW':
      return { stepNum: 3, targetId: 'UNIT_A', targetLabel: 'UNIT A' }
    case 'STEP_8_XENON_DRILL':
      return { stepNum: 4, targetId: 'UNIT_A2', targetLabel: 'UNIT A-2' }
    case 'STEP_3_BUILD_STEAM':
      return { stepNum: 5, targetId: 'UNIT_B', targetLabel: 'UNIT B' }
    case 'STEP_7_VOID_DRILL':
      return { stepNum: 6, targetId: 'UNIT_B', targetLabel: 'UNIT B' }
    case 'STEP_9_IDEOLOGY_DRILL':
      return { stepNum: 7, targetId: 'DESK', targetLabel: 'DESK' }
    case 'STEP_10_FIREWALL_DRILL':
      return { stepNum: 8, targetId: 'DESK', targetLabel: 'DESK' }
    default:
      return { stepNum: 6, targetId: 'UNIT_B', targetLabel: 'UNIT B' }
  }
}

export const TutorialCompassHud: React.FC<{ menusOpen: boolean }> = ({
  menusOpen,
}) => {
  const phase = useGameStore((s) => s.phase)
  const isShiftControlReady = useGameStore((s) => s.isShiftControlReady)
  const diagFeedActive = useGameStore((s) => s.diagFeedActive)
  const tutorialPhase = useGameStore((s) => s.tutorialPhase)

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const targetBannerRef = useRef<HTMLDivElement | null>(null)
  const ticksRef = useRef<HTMLDivElement | null>(null)

  const isVisible =
    phase === 'playing' &&
    isShiftControlReady &&
    !diagFeedActive &&
    !menusOpen &&
    tutorialPhase !== 'COMPLETED'

  const targetInfo = getTargetLandmarkForPhase(tutorialPhase)

  useEffect(() => {
    if (!isVisible) return

    let rafId = 0
    const tick = () => {
      const px = playerCameraPose.x
      const pz = playerCameraPose.z
      const yaw = playerCameraPose.yaw

      const fx = -Math.sin(yaw)
      const fz = -Math.cos(yaw)
      const rx = Math.cos(yaw)
      const rz = -Math.sin(yaw)

      if (ticksRef.current) {
        const yawDeg = (yaw * 180) / Math.PI
        const shiftPx = ((((yawDeg % 30) + 30) % 30) - 15) * 2.2
        ticksRef.current.style.transform = `translate3d(${shiftPx.toFixed(1)}px, 0, 0)`
      }

      let targetAngleDeg = 0
      let targetDist = 0

      for (let i = 0; i < COMPASS_LANDMARKS.length; i++) {
        const lm = COMPASS_LANDMARKS[i]
        const dx = lm.x - px
        const dz = lm.z - pz
        const dist = Math.hypot(dx, dz)
        const fwd = dx * fx + dz * fz
        const right = dx * rx + dz * rz
        const angleDeg = (Math.atan2(right, fwd) * 180) / Math.PI
        const isTarget = lm.id === targetInfo.targetId

        if (isTarget) {
          targetAngleDeg = angleDeg
          targetDist = dist
        }

        const el = itemRefs.current[lm.id]
        if (!el) continue

        if (!isTarget && Math.abs(angleDeg) > 88) {
          el.style.opacity = '0'
          continue
        }

        const clampedDeg = Math.max(-88, Math.min(88, angleDeg))
        const offsetPx = clampedDeg * 2.15
        const fade = isTarget
          ? 1
          : Math.max(0.25, 1 - Math.abs(angleDeg) / 96)

        el.style.transform = `translate3d(calc(-50% + ${offsetPx.toFixed(1)}px), -50%, 0)`
        el.style.opacity = fade.toFixed(2)
      }

      if (targetBannerRef.current) {
        const absDeg = Math.round(Math.abs(targetAngleDeg))
        const totalSteps = isDeskAppTutorialEnabled() ? 8 : 6
        let dirText: string
        if (targetInfo.stepNum === 0) {
          if (playerCameraPose.isSeatedAtDesk) {
            dirText = 'OPEN P.O.S.T.-84 & ACCEPT COMMISSAR VOLKOV MAIL'
          } else if (absDeg > 130) {
            dirText = `↺ TURN AROUND FOR DESK (${targetDist.toFixed(1)}m)`
          } else if (absDeg > 24) {
            dirText =
              targetAngleDeg < 0
                ? `◀ DESK (${absDeg}° LEFT)`
                : `▶ DESK (${absDeg}° RIGHT)`
          } else if (targetDist > 2.45) {
            dirText = `▲ WALK TO DESK (${targetDist.toFixed(1)}m)`
          } else {
            dirText = 'PRESS [E] TO SIT AT DESK & OPEN P.O.S.T.-84'
          }
          targetBannerRef.current.textContent = `VOLKOV DIRECTIVE  •  ${dirText}`
        } else if (targetInfo.stepNum >= 7) {
          const deskAction =
            targetInfo.stepNum === 7
              ? 'OPEN POLIT-LINK 84 ON ISKRA-84 & PASS IDEOLOGY DRILL'
              : 'OPEN ZASHCHITA-84 ON ISKRA-84 & PURGE CIA PROCESSES'
          if (playerCameraPose.isSeatedAtDesk) {
            dirText = deskAction
          } else if (absDeg > 130) {
            dirText = `↺ TURN AROUND FOR DESK (${targetDist.toFixed(1)}m)`
          } else if (absDeg > 24) {
            dirText =
              targetAngleDeg < 0
                ? `◀ DESK (${absDeg}° LEFT)`
                : `▶ DESK (${absDeg}° RIGHT)`
          } else if (targetDist > 2.45) {
            dirText = `▲ WALK TO DESK (${targetDist.toFixed(1)}m)`
          } else {
            dirText = `PRESS [E] TO SIT AT DESK  •  ${deskAction}`
          }
          targetBannerRef.current.textContent = `STEP ${targetInfo.stepNum}/${totalSteps}  •  ${dirText}`
        } else {
          if (absDeg > 130) {
            dirText = `↺ TURN AROUND FOR ${targetInfo.targetLabel} (${targetDist.toFixed(1)}m)`
          } else if (absDeg > 24) {
            dirText =
              targetAngleDeg < 0
                ? `◀ ${targetInfo.targetLabel} (${absDeg}° LEFT)`
                : `▶ ${targetInfo.targetLabel} (${absDeg}° RIGHT)`
          } else if (targetDist > 2.45) {
            dirText = `▲ WALK TO ${targetInfo.targetLabel} (${targetDist.toFixed(1)}m)`
          } else {
            dirText = `● AT ${targetInfo.targetLabel} — CHECK SKALA-84 FRONT WALL CRT`
          }
          targetBannerRef.current.textContent = `STEP ${targetInfo.stepNum}/${totalSteps}  •  ${dirText}`
        }
      }

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [isVisible, targetInfo.stepNum, targetInfo.targetId, targetInfo.targetLabel])

  if (!isVisible) return null

  return (
    <div className="pointer-events-none fixed top-2 left-1/2 z-30 w-[min(460px,88vw)] -translate-x-1/2 select-none">
      <div className="relative overflow-hidden rounded border border-[#33ff66]/65 bg-[#06130b]/82 px-2 py-1 shadow-[0_4px_18px_rgba(0,0,0,0.8)]">
        {/* Center fixed reticle notch */}
        <div
          className="mb-0.5 text-center font-mono text-[9px] leading-none text-[#ffb000]"
          aria-hidden
        >
          ▼
        </div>

        {/* Horizontal compass track */}
        <div className="relative h-6 overflow-hidden border-y border-[#1d422a]/90 bg-[#040d07]/85">
          <div
            ref={ticksRef}
            className="pointer-events-none absolute inset-y-0 left-[-60px] right-[-60px] flex items-end justify-between opacity-35"
          >
            {Array.from({ length: 24 }).map((_, idx) => (
              <span
                key={idx}
                className="w-px bg-[#4e8b62]"
                style={{ height: idx % 3 === 0 ? '8px' : '4px' }}
              />
            ))}
          </div>

          {COMPASS_LANDMARKS.map((lm) => {
            const isTarget = lm.id === targetInfo.targetId
            return (
              <div
                key={lm.id}
                ref={(el) => {
                  itemRefs.current[lm.id] = el
                }}
                className="absolute top-1/2 left-1/2 flex items-center gap-1 whitespace-nowrap font-mono leading-none transition-none"
                style={{
                  transform: 'translate3d(-50%, -50%, 0)',
                  opacity: isTarget ? 1 : 0.65,
                  zIndex: isTarget ? 3 : 1,
                }}
              >
                {isTarget && (
                  <span className="text-[11px] font-black text-[#ffb000]">
                    ▶
                  </span>
                )}
                <span
                  className={
                    isTarget
                      ? 'rounded border border-[#ffb000]/80 bg-[#2b1d04]/95 px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider text-[#ffd86b]'
                      : 'text-[10px] font-semibold tracking-wide text-[#75c991]'
                  }
                >
                  {lm.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Compact target callout caption */}
        <div
          ref={targetBannerRef}
          className="mt-1 truncate text-center font-mono text-[11px] font-bold tracking-wider text-[#ffe28a]"
        >
          {`STEP ${targetInfo.stepNum}/${isDeskAppTutorialEnabled() ? 8 : 6}  •  ▶ ${targetInfo.targetLabel}`}
        </div>
      </div>
    </div>
  )
}
