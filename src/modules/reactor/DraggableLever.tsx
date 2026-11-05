import React, { useCallback, useEffect, useRef } from 'react'
import { useViewportScale } from '../../shared/viewportScaleContext'
import { playLeverRatchet, playSwitchClank } from './audioSynth'

interface BinaryLeverProps {
  mode: 'binary'
  label: string
  subLabel?: string
  isOn: boolean
  onCommit: (nextState: boolean) => void
  accentColor?: 'green' | 'amber' | 'red' | 'brass'
  heightPx?: number
  disabled?: boolean
}

interface SteppedLeverProps {
  mode: 'stepped'
  label: string
  subLabel?: string
  valueMW: number
  maxMW?: number
  stepMW?: number
  onStepChange: (nextMW: number) => void
  locked?: boolean
  onLockedAttempt?: () => void
  heightPx?: number
}

export type DraggableLeverProps = BinaryLeverProps | SteppedLeverProps

export const DraggableLever: React.FC<DraggableLeverProps> = (props) => {
  const { toViewportDelta } = useViewportScale()
  const trackRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const shaftRef = useRef<HTMLDivElement>(null)

  const dragStateRef = useRef<{
    active: boolean
    startClientY: number
    startProgress: number
    currentProgress: number
    lastRatchetBucket: number
  }>({
    active: false,
    startClientY: 0,
    startProgress: 0,
    currentProgress: 0,
    lastRatchetBucket: -1,
  })

  const heightPx = props.heightPx ?? 108
  const maxTravelPx = heightPx - 30

  // Compute resting progress (0 = top, 1 = bottom)
  // For binary: top (0) = ON, bottom (1) = OFF
  // For stepped: top (0) = maxMW (80), bottom (1) = 0 MW
  const restingProgress =
    props.mode === 'binary'
      ? props.isOn
        ? 0
        : 1
      : 1 - props.valueMW / (props.maxMW ?? 80)

  const applyVisualProgress = useCallback(
    (progress: number, animateSpring = false) => {
      const clamped = Math.max(0, Math.min(1, progress))
      const offsetY = Math.round(clamped * maxTravelPx)
      const transitionStyle = animateSpring
        ? 'transform 190ms cubic-bezier(0.34, 1.56, 0.64, 1)'
        : 'none'

      if (handleRef.current) {
        handleRef.current.style.transition = transitionStyle
        handleRef.current.style.transform = `translate3d(0, ${offsetY}px, 0)`
      }
      if (shaftRef.current) {
        const centerDist = clamped - 0.5
        const scaleY = Math.max(0.22, Math.abs(centerDist) * 1.85)
        shaftRef.current.style.transition = transitionStyle
        shaftRef.current.style.transform = `translateY(${Math.round(centerDist * (maxTravelPx * 0.45))}px) scaleY(${scaleY.toFixed(2)})`
      }
    },
    [maxTravelPx]
  )

  useEffect(() => {
    if (!dragStateRef.current.active) {
      dragStateRef.current.currentProgress = restingProgress
      applyVisualProgress(restingProgress, true)
    }
  }, [restingProgress, applyVisualProgress])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (props.mode === 'binary' && props.disabled) {
      playLeverRatchet(0.5)
      return
    }

    if (props.mode === 'stepped' && props.locked) {
      playLeverRatchet(0.45)
      props.onLockedAttempt?.()
      return
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    dragStateRef.current = {
      active: true,
      startClientY: e.clientY,
      startProgress: restingProgress,
      currentProgress: restingProgress,
      lastRatchetBucket: Math.round(restingProgress * 8),
    }
    applyVisualProgress(restingProgress, false)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return

    if (props.mode === 'stepped' && props.locked) {
      dragStateRef.current.active = false
      applyVisualProgress(restingProgress, true)
      return
    }

    const deltaY = toViewportDelta(e.clientY - dragStateRef.current.startClientY)
    const nextProgress = Math.max(
      0,
      Math.min(1, dragStateRef.current.startProgress + deltaY / maxTravelPx)
    )
    dragStateRef.current.currentProgress = nextProgress
    applyVisualProgress(nextProgress, false)

    if (props.mode === 'binary') {
      const bucket = Math.round(nextProgress * 6)
      if (bucket !== dragStateRef.current.lastRatchetBucket) {
        dragStateRef.current.lastRatchetBucket = bucket
        playLeverRatchet(0.85 + (1 - nextProgress) * 0.35)
      }
    } else {
      const maxMW = props.maxMW ?? 80
      const stepMW = props.stepMW ?? 10
      const rawMW = (1 - nextProgress) * maxMW
      const snappedMW = Math.round(rawMW / stepMW) * stepMW
      if (snappedMW !== props.valueMW) {
        playLeverRatchet(0.75 + (snappedMW / maxMW) * 0.55)
        props.onStepChange(snappedMW)
      }
    }
  }

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return
    dragStateRef.current.active = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    if (props.mode === 'binary') {
      const draggedDistance = Math.abs(
        dragStateRef.current.currentProgress - dragStateRef.current.startProgress
      )
      // Must be physically dragged at least 65% of the slot to throw the switch!
      if (draggedDistance >= 0.65) {
        const nextState = !props.isOn
        playSwitchClank(true)
        props.onCommit(nextState)
        applyVisualProgress(nextState ? 0 : 1, true)
      } else {
        // Spring back if released before throw threshold
        playLeverRatchet(0.6)
        applyVisualProgress(restingProgress, true)
      }
    } else {
      playSwitchClank(false)
      const finalProgress = 1 - props.valueMW / (props.maxMW ?? 80)
      applyVisualProgress(finalProgress, true)
    }
  }

  const isIlluminated =
    props.mode === 'binary' ? props.isOn : props.valueMW > 0

  const lampColorClass =
    props.mode === 'binary'
      ? props.accentColor === 'red'
        ? 'bg-[#ff2a2a] shadow-[0_0_8px_#ff2a2a]'
        : props.accentColor === 'amber'
          ? 'bg-[#ffb000] shadow-[0_0_8px_#ffb000]'
          : 'bg-[#39ff5a] shadow-[0_0_8px_#39ff5a]'
      : props.valueMW >= 60
        ? 'bg-[#ff2a2a] shadow-[0_0_8px_#ff2a2a]'
        : 'bg-[#39ff5a] shadow-[0_0_8px_#39ff5a]'

  const gripBgClass =
    props.mode === 'binary' && props.accentColor === 'red'
      ? 'from-[#d93226] via-[#8f1810] to-[#420905]'
      : props.mode === 'binary' && props.accentColor === 'brass'
        ? 'from-[#d9b44a] via-[#8f7120] to-[#47370b]'
        : 'from-[#6b7068] via-[#343833] to-[#171a16]'

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Top Jewel Indicator & Label */}
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2.5 w-2.5 rounded-full border border-[#090b09] ${
            isIlluminated ? lampColorClass : 'bg-[#1c221b]'
          }`}
        />
        <span className="font-kremlin text-[11px] tracking-wider text-[#dfd2a3]">
          {props.label}
        </span>
      </div>

      {/* Recessed Vertical Lever Slot */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        style={{ height: `${heightPx}px` }}
        title="DRAG UP / DOWN TO OPERATE"
        className="relative w-12 cursor-ns-resize border-3 border-[#090b09] bg-[#121612] shadow-[inset_0_4px_8px_rgba(0,0,0,0.95),2px_2px_0_#090b09]"
      >
        {/* Engraved Detent Notches along Slot */}
        <div className="pointer-events-none absolute inset-y-2 left-1 flex flex-col justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="block h-[2px] w-2 bg-[#3c4a3a]" />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-2 right-1 flex flex-col justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="block h-[2px] w-2 bg-[#3c4a3a]" />
          ))}
        </div>

        {/* Center Mechanical Slot Groove */}
        <div className="pointer-events-none absolute inset-y-2 left-1/2 w-2 -translate-x-1/2 border-x border-[#050605] bg-[#070907]" />

        {/* Foreshortened Steel Shaft */}
        <div
          ref={shaftRef}
          className="pointer-events-none absolute top-1/2 left-1/2 h-10 w-2.5 -translate-x-1/2 -translate-y-1/2 border border-[#090b09] bg-gradient-to-r from-[#595e56] via-[#b8bfb4] to-[#434741]"
        />

        {/* Heavy Bakelite T-Handle Grip */}
        <div
          ref={handleRef}
          className={`pointer-events-none absolute top-1 left-0.5 right-0.5 h-6 border-2 border-[#090b09] bg-gradient-to-b ${gripBgClass} shadow-[0_5px_0_#090b09,inset_0_1px_0_rgba(255,255,255,0.35)]`}
        >
          <div className="mx-auto mt-2 h-1 w-7 bg-[#090b09]/60" />
        </div>
      </div>

      {/* Sub-label / Drag Hint */}
      {props.subLabel && (
        <span className="font-vt323 text-sm leading-none tracking-wider text-[#9ca396]">
          {props.subLabel}
        </span>
      )}
    </div>
  )
}
