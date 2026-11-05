import React, { useEffect, useState } from 'react'
import { useGameStore } from '../../shared/useGameStore'
import { DraggableLever } from './DraggableLever'
import { playGeigerClick, playKlaxonBurst, playSwitchClank } from './audioSynth'
import { updateSoundtrackState } from './soundtrackPlayer'

interface AnalogGaugeProps {
  label: string
  value: number
  min: number
  max: number
  unit: string
  dangerThreshold: number
  jitterAmp?: number
}

const AnalogGauge: React.FC<AnalogGaugeProps> = ({
  label,
  value,
  min,
  max,
  unit,
  dangerThreshold,
  jitterAmp = 1.2,
}) => {
  const [jitter, setJitter] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setJitter((Math.random() - 0.5) * 2 * jitterAmp)
    }, 120)
    return () => window.clearInterval(id)
  }, [jitterAmp])

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const baseAngle = -125 + ratio * 250 + jitter
  const isDanger = value >= dangerThreshold

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-28 w-28 rounded-full border-4 border-[#090b09] bg-[#181d18] p-1.5 shadow-[4px_4px_0_#090b09,inset_0_0_0_2px_#343d33]">
        <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-[#090b09] bg-[radial-gradient(circle_at_35%_30%,#e6ddb8_55%,#b8a675_100%)]">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            {/* Outer scale arc */}
            <circle
              cx="50"
              cy="50"
              r="41"
              fill="none"
              stroke="#141714"
              strokeWidth="2.5"
              strokeDasharray="3 4.5"
            />
            {/* Danger redline zone on right */}
            <path
              d="M 79 22 A 40 40 0 0 1 84 74"
              fill="none"
              stroke="#b81d18"
              strokeWidth="5"
            />
            <text
              x="50"
              y="26"
              textAnchor="middle"
              fontSize="11"
              fontFamily="VT323, monospace"
              fill="#111"
            >
              {Math.round((min + max) / 2)}
            </text>
            <text
              x="23"
              y="62"
              textAnchor="middle"
              fontSize="10"
              fontFamily="VT323, monospace"
              fill="#111"
            >
              {min}
            </text>
            <text
              x="77"
              y="62"
              textAnchor="middle"
              fontSize="10"
              fontFamily="VT323, monospace"
              fill="#9e1b15"
            >
              {max}
            </text>
            <text
              x="50"
              y="40"
              textAnchor="middle"
              fontSize="10"
              fontFamily="VT323, monospace"
              fill="#222"
            >
              {unit}
            </text>
            {/* Digital sub-readout inside dial */}
            <rect
              x="29"
              y="66"
              width="42"
              height="15"
              fill="#121612"
              stroke="#090b09"
              strokeWidth="1.5"
            />
            <text
              x="50"
              y="77"
              textAnchor="middle"
              fontSize="13"
              fontFamily="VT323, monospace"
              fill={isDanger ? '#ff3b30' : '#39ff5a'}
            >
              {Math.round(value)}
              {unit}
            </text>

            {/* Pivoting Needle */}
            <g transform={`rotate(${baseAngle} 50 52)`}>
              <line
                x1="50"
                y1="56"
                x2="50"
                y2="14"
                stroke={isDanger ? '#b81d18' : '#0f120e'}
                strokeWidth="3"
                strokeLinecap="square"
              />
              <circle cx="50" cy="52" r="5" fill="#0f120e" />
            </g>
          </svg>
        </div>
      </div>
      <span className="border-2 border-[#090b09] bg-[#141914] px-2 py-0.5 font-vt323 text-base tracking-wider text-[#dfd2a3] shadow-[2px_2px_0_#090b09]">
        {label}
      </span>
    </div>
  )
}

export const ReactorPanel: React.FC = () => {
  const coreTemp = useGameStore((s) => s.coreTemp)
  const pressureBar = useGameStore((s) => s.pressureBar)
  const radiationLevel = useGameStore((s) => s.radiationLevel)
  const powerAllocation = useGameStore((s) => s.powerAllocation)
  const pumpsActive = useGameStore((s) => s.pumpsActive)
  const az5Available = useGameStore((s) => s.az5Available)
  const az5Cooldown = useGameStore((s) => s.az5Cooldown)
  const isMusicMuted = useGameStore((s) => s.isMusicMuted)
  const togglePump = useGameStore((s) => s.togglePump)
  const triggerAz5 = useGameStore((s) => s.triggerAz5)

  const [az5CoverOpen, setAz5CoverOpen] = useState(false)
  const [auxGridValve, setAuxGridValve] = useState(true)

  const totalMW =
    powerAllocation.cooling + powerAllocation.defense + powerAllocation.facility
  const isRedline = totalMW > 100

  useEffect(() => {
    updateSoundtrackState(isRedline || coreTemp >= 750, isMusicMuted)
  }, [isRedline, coreTemp, isMusicMuted])

  // Ambient Geiger counter clicks scaled by radiationLevel
  useEffect(() => {
    const id = window.setInterval(() => {
      const clickChance = Math.min(0.85, radiationLevel / 14)
      if (Math.random() < clickChance) {
        playGeigerClick()
      }
    }, 350)
    return () => window.clearInterval(id)
  }, [radiationLevel])

  const handleAz5Press = () => {
    if (!az5CoverOpen || !az5Available || az5Cooldown > 0) return
    playKlaxonBurst()
    triggerAz5()
    setAz5CoverOpen(false)
  }

  return (
    <section className="flex h-full flex-col justify-between border-3 border-[#090b09] bg-[#2a3728] p-3 shadow-[inset_3px_3px_0_rgba(255,255,255,0.14),inset_-4px_-4px_0_rgba(0,0,0,0.55),6px_6px_0_#090b09]">
      {/* Zone Header */}
      <div className="flex items-center justify-between border-b-2 border-[#090b09] bg-[#1b231a] px-3 py-1">
        <span className="font-kremlin text-sm tracking-widest text-[#dfd2a3]">
          ZONE 1 // REACTOR CORE &amp; COOLING LOOPS
        </span>
        <span className="font-vt323 text-base text-[#ffb000]">
          DOSIMETER: {radiationLevel.toFixed(1)} R/h
        </span>
      </div>

      {/* Top Row: 4 Circular Gauges + Radiation Trefoil */}
      <div className="my-1 flex items-center justify-around border-2 border-[#090b09] bg-[#364734] px-2 py-2 shadow-[inset_2px_2px_0_rgba(255,255,255,0.12),4px_4px_0_#090b09]">
        <AnalogGauge
          label="CORE TEMP"
          value={coreTemp}
          min={250}
          max={1000}
          unit="°C"
          dangerThreshold={750}
          jitterAmp={isRedline ? 4.2 : 1.1}
        />
        <AnalogGauge
          label="OUTPUT MW"
          value={totalMW}
          min={0}
          max={180}
          unit="MW"
          dangerThreshold={101}
          jitterAmp={isRedline ? 3.8 : 0.9}
        />
        <AnalogGauge
          label="PRESSURE"
          value={pressureBar}
          min={20}
          max={120}
          unit="BAR"
          dangerThreshold={85}
          jitterAmp={isRedline ? 3.2 : 1.0}
        />

        {/* Radiation Trefoil Hazard Lamp */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={`flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#090b09] bg-[#c7a034] shadow-[4px_4px_0_#090b09,inset_0_0_14px_rgba(0,0,0,0.65)] ${
              coreTemp >= 750 ? 'animate-pulse ring-4 ring-[#ff2a2a]' : ''
            }`}
          >
            <svg viewBox="0 0 100 100" className="h-20 w-20">
              <circle cx="50" cy="50" r="8" fill="#090b09" />
              <path d="M50 40 L34 14 A32 32 0 0 1 66 14 Z" fill="#090b09" />
              <path d="M41 55 L15 70 A32 32 0 0 1 25 40 Z" fill="#090b09" />
              <path d="M59 55 L75 40 A32 32 0 0 1 85 70 Z" fill="#090b09" />
            </svg>
          </div>
          <span className="border-2 border-[#090b09] bg-[#141914] px-2 py-0.5 font-vt323 text-base tracking-wider text-[#dfd2a3] shadow-[2px_2px_0_#090b09]">
            RAD LIGHT
          </span>
        </div>
      </div>

      {/* Bottom Row: Warning Lamps + Physical Drag Pump Levers + Guarded AZ-5 Scram */}
      <div className="grid grid-cols-[1.05fr_1.35fr_0.95fr] gap-2.5">
        {/* Warning Lamps Box */}
        <div className="flex flex-col justify-between border-3 border-[#090b09] bg-[#3c4d39] p-2.5 shadow-[4px_4px_0_#090b09]">
          <div className="text-center font-kremlin text-xs tracking-widest text-[#090b09]">
            WARNING MATRIX
          </div>
          <div className="flex justify-around py-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-8 w-8 rounded-full border-3 border-[#090b09] ${
                  coreTemp >= 700
                    ? 'bg-[#ff2a2a] shadow-[0_0_14px_#ff2a2a]'
                    : 'bg-[#4d1414]'
                }`}
              />
              <span className="font-vt323 text-sm font-bold text-[#090b09]">OWAM</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-8 w-8 rounded-full border-3 border-[#090b09] ${
                  isRedline
                    ? 'bg-[#ff881c] shadow-[0_0_14px_#ff881c]'
                    : 'bg-[#54300d]'
                }`}
              />
              <span className="font-vt323 text-sm font-bold text-[#090b09]">OH</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`h-8 w-8 rounded-full border-3 border-[#090b09] ${
                  !pumpsActive[0] || !pumpsActive[1]
                    ? 'bg-[#ffe02e] shadow-[0_0_14px_#ffe02e]'
                    : 'bg-[#524610]'
                }`}
              />
              <span className="font-vt323 text-sm font-bold text-[#090b09]">HC</span>
            </div>
          </div>
          <div className="border-2 border-[#090b09] bg-[#dfd2a3] px-2 py-0.5 text-center font-vt323 text-sm font-bold text-[#090b09]">
            FUSE: 250A NOMINAL
          </div>
        </div>

        {/* Physical Drag-Operated Pump Levers */}
        <div className="flex items-center justify-around border-3 border-[#090b09] bg-[#222c21] px-2 py-2 shadow-[inset_0_2px_6px_rgba(0,0,0,0.85),4px_4px_0_#090b09]">
          <DraggableLever
            mode="binary"
            label="PUMP A"
            subLabel={pumpsActive[0] ? 'ON (DRAG)' : 'OFF (DRAG)'}
            isOn={pumpsActive[0]}
            onCommit={(next) => togglePump(0, next)}
            accentColor="green"
            heightPx={92}
          />
          <DraggableLever
            mode="binary"
            label="PUMP B"
            subLabel={pumpsActive[1] ? 'ON (DRAG)' : 'OFF (DRAG)'}
            isOn={pumpsActive[1]}
            onCommit={(next) => togglePump(1, next)}
            accentColor="green"
            heightPx={92}
          />
          <DraggableLever
            mode="binary"
            label="AUX VALVE"
            subLabel={auxGridValve ? 'LOCKED ON' : 'BYPASS'}
            isOn={auxGridValve}
            onCommit={(next) => setAuxGridValve(next)}
            accentColor="brass"
            heightPx={92}
          />
        </div>

        {/* Guarded AZ-5 Emergency Scram Button */}
        <div className="flex flex-col justify-between border-3 border-[#090b09] bg-[repeating-linear-gradient(-45deg,#c7961a_0px,#c7961a_8px,#141714_8px,#141714_16px)] p-2 shadow-[4px_4px_0_#090b09]">
          <div className="bg-[#090b09] px-1.5 py-0.5 text-center font-kremlin text-[11px] tracking-wider text-[#ffb000]">
            EMERGENCY SCRAM
          </div>

          <div className="relative h-24 w-full border-3 border-[#090b09] bg-[#161a16] p-1.5">
            {/* Inner Red Plunger Button */}
            <button
              type="button"
              disabled={!az5CoverOpen || !az5Available}
              onClick={handleAz5Press}
              className={`flex h-full w-full flex-col items-center justify-center border-3 border-[#090b09] font-kremlin text-xl tracking-widest text-[#f2e8c9] shadow-[inset_2px_2px_0_rgba(255,180,170,0.4)] ${
                az5Available
                  ? ' cursor-pointer bg-gradient-to-b from-[#d92b22] to-[#7a110c] active:translate-y-0.5'
                  : 'cursor-not-allowed bg-[#3d1c1a] text-[#8c7b75]'
              }`}
            >
              <span>AZ-5</span>
              <span className="font-vt323 text-xs">
                {az5Available ? 'PRESS PLUNGER' : `USED (${az5Cooldown}s)`}
              </span>
            </button>

            {/* Translucent Flip-Up Safety Cover */}
            {!az5CoverOpen && (
              <button
                type="button"
                onClick={() => {
                  playSwitchClank(false)
                  setAz5CoverOpen(true)
                }}
                className="absolute inset-0 flex flex-col items-center justify-center border-2 border-[#ff8080]/60 bg-[#9e1914]/75 font-vt323 text-sm tracking-wider text-white shadow-[inset_0_2px_6px_rgba(255,255,255,0.35)] hover:bg-[#b8201a]/80"
              >
                <span className="border border-black bg-black/70 px-1.5 py-0.5">
                  FLIP SAFETY COVER
                </span>
              </button>
            )}
          </div>

          {az5CoverOpen && (
            <button
              type="button"
              onClick={() => {
                playSwitchClank(false)
                setAz5CoverOpen(false)
              }}
              className="border border-[#090b09] bg-[#1b211a] font-vt323 text-xs text-[#dfd2a3]"
            >
              [CLOSE SAFETY LID]
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

