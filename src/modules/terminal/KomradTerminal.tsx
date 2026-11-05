import React, { useEffect, useRef } from 'react'
import { useGameStore } from '../../shared/useGameStore'

export const KomradTerminal: React.FC = () => {
  const terminalEntries = useGameStore((s) => s.terminalEntries)
  const isBlackout = useGameStore((s) => s.isBlackout)
  const ciaIntrusionActive = useGameStore((s) => s.ciaIntrusionActive)
  const ciaIntrusionProgress = useGameStore((s) => s.ciaIntrusionProgress)
  const komradOverrideLocked = useGameStore((s) => s.komradOverrideLocked)
  const defenseMW = useGameStore((s) => s.powerAllocation.defense)
  const overrideKomradLock = useGameStore((s) => s.overrideKomradLock)
  const purgeFirewall = useGameStore((s) => s.purgeFirewall)

  const radarCanvasRef = useRef<HTMLCanvasElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [terminalEntries])

  // 60fps Mini Canvas Radar Sweep (Hybrid DOM + Canvas architecture)
  useEffect(() => {
    const canvas = radarCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let angle = 0

    const renderRadar = () => {
      angle = (angle + 0.045) % (Math.PI * 2)
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const cy = h / 2
      const r = cx - 6

      ctx.clearRect(0, 0, w, h)

      // Outer & inner radar rings
      ctx.strokeStyle = isBlackout ? '#0d2912' : '#1b7a2e'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
      ctx.stroke()

      // Crosshairs
      ctx.beginPath()
      ctx.moveTo(cx - r, cy)
      ctx.lineTo(cx + r, cy)
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx, cy + r)
      ctx.stroke()

      if (!isBlackout) {
        // Sweep sector cone
        ctx.fillStyle = ciaIntrusionActive
          ? 'rgba(255, 59, 48, 0.22)'
          : 'rgba(57, 255, 90, 0.22)'
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r, angle - 0.55, angle)
        ctx.closePath()
        ctx.fill()

        // Leading sweep line
        ctx.strokeStyle = ciaIntrusionActive ? '#ff3b30' : '#39ff5a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
        ctx.stroke()

        // CIA Intrusion Target Blip
        if (ciaIntrusionActive) {
          const blipX = cx + 16
          const blipY = cy - 14
          ctx.fillStyle = '#ff3b30'
          ctx.beginPath()
          ctx.arc(blipX, blipY, 4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = '#a8ffba'
          ctx.beginPath()
          ctx.arc(cx - 14, cy + 12, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      animId = window.requestAnimationFrame(renderRadar)
    }

    animId = window.requestAnimationFrame(renderRadar)
    return () => window.cancelAnimationFrame(animId)
  }, [isBlackout, ciaIntrusionActive])

  return (
    <section className="flex h-full flex-col justify-between border-4 border-[#090b09] bg-[#4c5249] p-3 shadow-[inset_3px_3px_0_#6c7368,inset_-4px_-4px_0_#2b2f2a,6px_6px_0_#090b09]">
      {/* Recessed Inner CRT Bezel */}
      <div className="flex flex-1 flex-col justify-between rounded-2xl border-4 border-[#090b09] bg-[#1b1f1a] p-2.5 shadow-[inset_5px_5px_0_#0d0f0d]">
        {/* Phosphor Green CRT Tube */}
        <div
          className={`relative flex h-64 flex-col justify-between overflow-hidden rounded-xl border-3 border-[#090b09] p-3 font-vt323 transition-opacity ${
            isBlackout
              ? 'bg-[#030b04] text-[#39ff5a]/15'
              : 'bg-[#051608] text-[#39ff5a] shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]'
          }`}
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 2px, transparent 2px, transparent 4px)',
          }}
        >
          {/* CRT Top Status Line */}
          <div className="flex items-center justify-between border-b-2 border-[#39ff5a]/60 pb-1 text-lg tracking-wider">
            <span>K.O.M.R.A.D.-84 // SYS.DEFENSE</span>
            <span
              className={
                ciaIntrusionActive ? 'animate-pulse text-[#ff3b30]' : 'text-[#39ff5a]'
              }
            >
              {ciaIntrusionActive
                ? `ALERT: CIA PACKET (${Math.round(ciaIntrusionProgress)}%)`
                : `FIREWALL: ${defenseMW} MW`}
            </span>
          </div>

          {/* CRT Body: Left Text Log + Right Mini-Canvas Radar */}
          <div className="my-1.5 grid flex-1 grid-cols-[1.45fr_auto] gap-3 overflow-hidden">
            <div
              ref={logContainerRef}
              className="space-y-1 overflow-y-auto pr-1 text-lg leading-tight"
            >
              {terminalEntries.slice(-8).map((entry) => (
                <div
                  key={entry.id}
                  className={
                    entry.level === 'danger'
                      ? 'text-[#ff453a]'
                      : entry.level === 'warn'
                        ? 'text-[#ffb000]'
                        : 'text-[#39ff5a]'
                  }
                >
                  <span className="opacity-75">[{entry.timestamp}]</span>{' '}
                  <span className="font-bold">{entry.sender}:</span> {entry.text}
                </div>
              ))}
              <span className="inline-block h-4 w-2.5 animate-pulse bg-[#39ff5a]" />
            </div>

            {/* 60fps HTML5 Radar Scope Canvas */}
            <div className="flex flex-col items-center justify-center border-l border-[#39ff5a]/30 pl-2">
              <canvas
                ref={radarCanvasRef}
                width={112}
                height={112}
                className="rounded-full border border-[#39ff5a]/40 bg-[#031006]"
              />
              <span className="mt-1 text-xs tracking-widest text-[#39ff5a]/80">
                SECTOR 07 RADAR
              </span>
            </div>
          </div>
        </div>

        {/* Bottom CRT Hardware Bar: Nameplate, Override Buttons & Power LED */}
        <div className="mt-2 flex items-center justify-between px-1">
          <div className="border-2 border-[#090b09] bg-[#b5ae94] px-2.5 py-0.5 font-kremlin text-xs tracking-widest text-[#090b09] shadow-[2px_2px_0_#090b09]">
            K.O.M.R.A.D.-84
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={overrideKomradLock}
              className={`border-2 border-[#090b09] px-2.5 py-0.5 font-vt323 text-base tracking-wider shadow-[2px_2px_0_#090b09] active:translate-y-0.5 ${
                komradOverrideLocked || isBlackout
                  ? 'animate-bounce bg-[#ffb000] font-bold text-[#090b09]'
                  : 'bg-[#2a3329] text-[#dfd2a3] hover:bg-[#384536]'
              }`}
            >
              [OVERRIDE AI LOCK]
            </button>

            <button
              type="button"
              onClick={purgeFirewall}
              className={`border-2 border-[#090b09] px-2.5 py-0.5 font-vt323 text-base tracking-wider shadow-[2px_2px_0_#090b09] active:translate-y-0.5 ${
                ciaIntrusionActive
                  ? 'animate-pulse bg-[#c92a22] font-bold text-white'
                  : 'bg-[#2a3329] text-[#dfd2a3] hover:bg-[#384536]'
              }`}
            >
              [PURGE FIREWALL]
            </button>
          </div>

          <div className="flex items-center gap-1.5 font-vt323 text-base text-[#dfd2a3]">
            <span>СЕТЬ</span>
            <span
              className={`h-3.5 w-3.5 rounded-full border-2 border-[#090b09] ${
                isBlackout
                  ? 'bg-[#183b1e]'
                  : 'bg-[#39ff5a] shadow-[0_0_8px_#39ff5a]'
              }`}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

