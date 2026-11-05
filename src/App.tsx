import React, { useEffect } from 'react'
import * as InspectorModule from './modules/inspector'
import { MainBreakerModal, PowerMatrix, ReactorPanel } from './modules/reactor'
import { KomradTerminal } from './modules/terminal'
import { DebugMenu } from './shared/DebugMenu'
import { ViewportScaler } from './shared/ViewportScaler'
import { useGameStore } from './shared/useGameStore'

const ExternalInspectorDesk = Reflect.get(
  InspectorModule,
  'InspectorDesk'
) as React.ComponentType | undefined

const Zone4FallbackHarness: React.FC = () => {
  const activeDirectives = useGameStore((s) => s.activeDirectives)
  const printerProgress = useGameStore((s) => s.printerProgress)
  const facilityMW = useGameStore((s) => s.powerAllocation.facility)
  const isBlackout = useGameStore((s) => s.isBlackout)
  const resolveDirective = useGameStore((s) => s.resolveDirective)
  const spawnDirective = useGameStore((s) => s.spawnDirective)

  const currentDoc = activeDirectives[activeDirectives.length - 1]

  return (
    <section
      className={`flex h-full flex-col justify-between border-3 border-[#090b09] bg-[#29241d] p-3 shadow-[inset_3px_3px_0_rgba(255,255,255,0.12),6px_6px_0_#090b09] transition-opacity ${
        isBlackout || facilityMW === 0 ? 'opacity-45' : 'opacity-100'
      }`}
    >
      {/* Zone 4 Header */}
      <div className="flex items-center justify-between border-b-2 border-[#090b09] bg-[#1a1712] px-3 py-1">
        <span className="font-kremlin text-sm tracking-widest text-[#dfd2a3]">
          ZONE 4 // OPERATOR DESK &amp; PRAVDA PRINTER (OLE’S MODULE)
        </span>
        <span className="font-vt323 text-base text-[#ffb000]">
          QUEUE: {activeDirectives.length} DOCS | PRINTER: {Math.round(printerProgress)}%
        </span>
      </div>

      {/* Desk Surface */}
      <div className="my-1.5 grid flex-1 grid-cols-[0.9fr_1.45fr] gap-3">
        {/* Left: Security Manual Quick Reference + Printer Status */}
        <div className="flex flex-col justify-between border-2 border-[#090b09] bg-[#1f291e] p-2.5 font-courier text-xs text-[#dfd2a3]">
          <div>
            <div className="mb-1.5 border-b border-[#090b09] pb-1 font-kremlin text-xs tracking-wider text-[#ffb000]">
              SECURITY MANUAL (1984 RULES)
            </div>
            <ul className="space-y-1 leading-snug">
              <li>• DATE: DD.MM.1984 (No US MM/DD!)</li>
              <li>• AUTH: CCCP-84-[EVEN#] (e.g. 28, 42, 64)</li>
              <li>• INK: No Imperialist Blue</li>
              <li>• WATERMARK: &quot;GLORY TO LABOR 1984&quot;</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => spawnDirective()}
            className="border-2 border-[#090b09] bg-[#334231] px-2 py-1 font-vt323 text-sm tracking-wider text-[#dfd2a3] shadow-[2px_2px_0_#090b09] hover:bg-[#41543e]"
          >
            [FEED PRAVDA PAPER]
          </button>
        </div>

        {/* Right: Active Tractor-Feed Directive Card */}
        <div className="flex flex-col justify-between border-3 border-[#090b09] bg-[#e6dec3] p-3 font-courier text-[#141414] shadow-[4px_4px_0_#090b09]">
          {currentDoc ? (
            <>
              <div>
                <div className="flex items-center justify-between border-b-2 border-[#141414] pb-1 text-xs font-bold">
                  <span>{currentDoc.ministry}</span>
                  <span>DATE: {currentDoc.date}</span>
                </div>
                <div className="mt-1 text-sm font-bold">{currentDoc.title}</div>
                <p className="mt-1 text-xs leading-snug">{currentDoc.bodyText}</p>
              </div>

              <div className="my-1 border-y border-dashed border-[#5c5546] py-1 text-[11px]">
                <div>
                  <strong>AUTH CODE:</strong> {currentDoc.authCode} |{' '}
                  <strong>INK:</strong> {currentDoc.inkColor}
                </div>
                <div className="text-[#7a1c18]">
                  <strong>LENS WATERMARK:</strong> {currentDoc.watermarkText}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => resolveDirective(currentDoc.id, 'APPROVED')}
                  className=" cursor-pointer border-2 border-[#090b09] bg-[#1b6e32] py-1 font-kremlin text-sm tracking-widest text-white shadow-[3px_3px_0_#090b09] active:translate-y-0.5"
                >
                  STAMP: APPROVED
                </button>
                <button
                  type="button"
                  onClick={() => resolveDirective(currentDoc.id, 'SHREDDED')}
                  className="cursor-pointer border-2 border-[#090b09] bg-[#a81c1c] py-1 font-kremlin text-sm tracking-widest text-white shadow-[3px_3px_0_#090b09] active:translate-y-0.5"
                >
                  STAMP: SHREDDED
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center font-vt323 text-xl text-[#4a4538]">
              DESK CLEAR — AWAITING PRAVDA TELETYPE...
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function formatClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(360, Math.floor(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function App() {
  const phase = useGameStore((s) => s.phase)
  const shiftNumber = useGameStore((s) => s.shiftNumber)
  const shiftTimeMinutes = useGameStore((s) => s.shiftTimeMinutes)
  const treasonStrikes = useGameStore((s) => s.treasonStrikes)
  const coreTemp = useGameStore((s) => s.coreTemp)
  const isGodMode = useGameStore((s) => s.isGodMode)
  const isMusicMuted = useGameStore((s) => s.isMusicMuted)
  const lastDecisionFeedback = useGameStore((s) => s.lastDecisionFeedback)
  const toggleMusicMute = useGameStore((s) => s.toggleMusicMute)
  const tick = useGameStore((s) => s.tick)

  useEffect(() => {
    if (phase !== 'playing') return
    const interval = window.setInterval(() => {
      tick()
    }, 1000)
    return () => window.clearInterval(interval)
  }, [phase, tick])

  return (
    <ViewportScaler>
      <DebugMenu />
      <MainBreakerModal />

      <div className="grid h-full w-full grid-rows-[52px_1fr] gap-2.5 p-2.5">
        {/* Top Control Room Status Header */}
        <header className="flex items-center justify-between border-3 border-[#090b09] bg-[#222c21] px-4 shadow-[4px_4px_0_#090b09]">
          <div className="flex items-center gap-3">
            <span className="border-2 border-[#090b09] bg-[#8f1810] px-2 py-0.5 font-kremlin text-sm tracking-widest text-[#dfd2a3]">
              CCCP // 1984
            </span>
            <h1 className="font-kremlin text-xl tracking-widest text-[#dfd2a3]">
              Meltdown is Propaganda — STATION NO. 4
            </h1>
            {isGodMode && (
              <span className="border-2 border-[#090b09] bg-[#2bd95a] px-2 py-0.5 font-vt323 text-sm font-bold text-[#090b09]">
                GOD MODE ACTIVE
              </span>
            )}
          </div>

          {lastDecisionFeedback && (
            <div className="max-w-md truncate border border-[#090b09] bg-[#141914] px-2.5 py-0.5 font-vt323 text-base text-[#ffb000]">
              {lastDecisionFeedback}
            </div>
          )}

          <div className="flex items-center gap-3 font-vt323 text-lg">
            <span className="border-2 border-[#090b09] bg-[#141914] px-2.5 py-0.5 text-[#dfd2a3]">
              SHIFT: {shiftNumber} / 5
            </span>
            <span className="border-2 border-[#090b09] bg-[#141914] px-2.5 py-0.5 text-[#39ff5a]">
              CLOCK: {formatClock(shiftTimeMinutes)} / 06:00
            </span>
            <span
              className={`border-2 border-[#090b09] px-2.5 py-0.5 ${
                coreTemp >= 750
                  ? 'animate-pulse bg-[#9e1914] text-white'
                  : 'bg-[#141914] text-[#dfd2a3]'
              }`}
            >
              CORE: {Math.round(coreTemp)}°C
            </span>
            <span
              className={`border-2 border-[#090b09] px-2.5 py-0.5 ${
                treasonStrikes > 0
                  ? 'bg-[#7c231c] text-[#ffb000]'
                  : 'bg-[#141914] text-[#dfd2a3]'
              }`}
            >
              STRIKES: {treasonStrikes} / 3
            </span>
            <button
              type="button"
              onClick={toggleMusicMute}
              className="cursor-pointer border-2 border-[#090b09] bg-[#1e261d] px-2 py-0.5 text-sm text-[#dfd2a3] hover:bg-[#2c382a]"
            >
              {isMusicMuted ? 'MUSIC: MUTED' : 'MUSIC: ON'}
            </button>
            <span className="border-2 border-[#090b09] bg-[#2d382c] px-2 py-0.5 text-sm text-[#9ca396]">
              [F2] DEBUG
            </span>
          </div>
        </header>

        {/* 4-Zone Diegetic Control Room Grid */}
        <main className="grid min-h-0 grid-cols-2 grid-rows-[1.08fr_0.92fr] gap-3">
          {/* Zone 1: Reactor & Cooling (Kristian) */}
          <ReactorPanel />

          {/* Zone 2: K.O.M.R.A.D.-84 CRT Terminal (Kristian) */}
          <KomradTerminal />

          {/* Zone 3: Power Shifting Matrix (Kristian) */}
          <PowerMatrix />

          {/* Zone 4: Inspector Desk (Ole) */}
          {ExternalInspectorDesk ? (
            <ExternalInspectorDesk />
          ) : (
            <Zone4FallbackHarness />
          )}
        </main>
      </div>
    </ViewportScaler>
  )
}

export default App
