import React, { useEffect, useState } from 'react'
import type { SystemType } from '../../shared/types'
import { useGameStore } from '../../shared/useGameStore'
import { DraggableLever } from './DraggableLever'
import { playSwitchClank } from './audioSynth'

const CHANNELS: { key: SystemType; title: string; desc: string; color: string }[] = [
  {
    key: 'cooling',
    title: '1. COOLING',
    desc: 'PRIMARY PUMPS (ZONE 1)',
    color: '#39ff5a',
  },
  {
    key: 'defense',
    title: '2. DEFENSE',
    desc: 'FIREWALL & RADAR (ZONE 2)',
    color: '#ffb000',
  },
  {
    key: 'facility',
    title: '3. FACILITY',
    desc: 'DESK LAMP & PRINTER (ZONE 4)',
    color: '#ff3b30',
  },
]

export const PowerMatrix: React.FC = () => {
  const isShiftKeyHeld = useGameStore((s) => s.isShiftKeyHeld)
  const powerAllocation = useGameStore((s) => s.powerAllocation)
  const maxSafePower = useGameStore((s) => s.maxSafePower)
  const redlineInstability = useGameStore((s) => s.redlineInstability)
  const isBlackout = useGameStore((s) => s.isBlackout)
  const komradOverrideLocked = useGameStore((s) => s.komradOverrideLocked)
  const setShiftKeyHeld = useGameStore((s) => s.setShiftKeyHeld)
  const setSubsystemPower = useGameStore((s) => s.setSubsystemPower)

  const [clutchWarningFlash, setClutchWarningFlash] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !e.repeat) {
        playSwitchClank(false)
        setShiftKeyHeld(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftKeyHeld(false)
      }
    }
    const onBlur = () => setShiftKeyHeld(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [setShiftKeyHeld])

  const triggerClutchWarning = () => {
    setClutchWarningFlash(true)
    window.setTimeout(() => setClutchWarningFlash(false), 650)
  }

  const totalMW =
    powerAllocation.cooling + powerAllocation.defense + powerAllocation.facility
  const isRedline = totalMW > maxSafePower
  const isLocked = !isShiftKeyHeld || isBlackout || komradOverrideLocked

  return (
    <section className="flex h-full flex-col justify-between border-3 border-[#090b09] bg-[#2a3728] p-3 shadow-[inset_3px_3px_0_rgba(255,255,255,0.14),inset_-4px_-4px_0_rgba(0,0,0,0.55),6px_6px_0_#090b09]">
      {/* Zone Header + Mechanical Clutch Status */}
      <div className="flex items-center justify-between border-b-2 border-[#090b09] bg-[#1b231a] px-3 py-1">
        <span className="font-kremlin text-sm tracking-widest text-[#dfd2a3]">
          ZONE 3 // POWER SHIFTING MATRIX
        </span>
        <div
          className={`border-2 border-[#090b09] px-2.5 py-0.5 font-vt323 text-base tracking-wider ${
            isShiftKeyHeld
              ? 'bg-[#39ff5a] font-bold text-[#090b09] shadow-[0_0_10px_#39ff5a]'
              : clutchWarningFlash
                ? 'animate-bounce bg-[#ff2a2a] text-white'
                : 'bg-[#222921] text-[#ffb000]'
          }`}
        >
          {isBlackout
            ? 'GRID BLACKOUT!'
            : komradOverrideLocked
              ? 'LOCKED BY K.O.M.R.A.D.-84!'
              : isShiftKeyHeld
                ? 'CLUTCH ENGAGED — DRAG LEVERS'
                : 'HOLD [SHIFT] TO UNLOCK LEVERS'}
        </div>
      </div>

      {/* 3 Subsystem Channels with Stepped Drag Levers + Segmented LED Bars */}
      <div className="my-1 grid flex-1 grid-cols-3 gap-3">
        {CHANNELS.map((ch) => {
          const mw = powerAllocation[ch.key]
          const activeSegs = Math.round(mw / 10)
          return (
            <div
              key={ch.key}
              className="flex flex-col justify-between border-3 border-[#090b09] bg-[#1f291e] p-2.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.85),4px_4px_0_#090b09]"
            >
              <div className="flex items-center justify-between border-b border-[#344232] pb-1">
                <span className="font-kremlin text-xs tracking-wider text-[#dfd2a3]">
                  {ch.title}
                </span>
                <span
                  className="border border-[#090b09] bg-[#0f130f] px-1.5 font-vt323 text-lg"
                  style={{ color: ch.color }}
                >
                  {mw} MW
                </span>
              </div>

              <div className="my-1 flex items-center justify-around">
                {/* Vertical Segmented LED Meter */}
                <div className="flex flex-col-reverse gap-1 border-2 border-[#090b09] bg-[#0d110d] p-1.5">
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const lit = idx < activeSegs
                    const segColor =
                      idx >= 6 ? '#ff2a2a' : idx >= 4 ? '#ffb000' : '#39ff5a'
                    return (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: lit ? segColor : '#1c241b',
                          boxShadow: lit ? `0 0 6px ${segColor}` : 'none',
                        }}
                        className="h-2.5 w-7 border border-[#070907]"
                      />
                    )
                  })}
                </div>

                {/* Physical Drag-Operated Stepped Lever */}
                <DraggableLever
                  mode="stepped"
                  label="ROUTE"
                  subLabel="DRAG"
                  valueMW={mw}
                  maxMW={80}
                  stepMW={10}
                  locked={isLocked}
                  onLockedAttempt={triggerClutchWarning}
                  onStepChange={(nextMW) => setSubsystemPower(ch.key, nextMW)}
                  heightPx={112}
                />
              </div>

              <div className="text-center font-vt323 text-xs tracking-wider text-[#9ca396]">
                {ch.desc}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Bar: Total Load & Redline Instability Meter */}
      <div className="flex items-center justify-between gap-4 border-2 border-[#090b09] bg-[#182017] px-3 py-1.5">
        <div className="flex items-center gap-2 font-vt323 text-lg">
          <span className="text-[#dfd2a3]">TOTAL OUTPUT:</span>
          <span
            className={`border border-[#090b09] bg-[#0c0f0c] px-2 font-bold ${
              isRedline ? 'animate-pulse text-[#ff2a2a]' : 'text-[#39ff5a]'
            }`}
          >
            {totalMW} / {maxSafePower} MW {isRedline ? '[REDLINE OVERCLOCK!]' : '[NOMINAL]'}
          </span>
        </div>

        <div className="flex flex-1 items-center gap-2">
          <span className="font-vt323 text-base text-[#ffb000]">
            GRID INSTABILITY:
          </span>
          <div className="h-4 flex-1 border-2 border-[#090b09] bg-[#0b0e0b] p-0.5">
            <div
              style={{ width: `${Math.min(100, Math.round(redlineInstability))}%` }}
              className={`h-full transition-all ${
                redlineInstability > 65 ? 'bg-[#ff2a2a]' : 'bg-[#ffb000]'
              }`}
            />
          </div>
          <span className="w-10 text-right font-vt323 text-base text-[#dfd2a3]">
            {Math.round(redlineInstability)}%
          </span>
        </div>
      </div>
    </section>
  )
}

