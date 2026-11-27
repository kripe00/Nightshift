import React, { useEffect, useRef, useState } from 'react'
import {
  pointerLockInteraction,
  updatePointerLockInteraction,
} from './pointerLockState'
import {
  debugTriggerLangleyLeakEvent,
  debugTriggerPolitLinkDuel,
  debugTriggerZashchitaFirewall,
  getSovOsPluginApp,
  getSovOsPluginApps,
  isDeskAppTutorialEnabled,
  isDeskAppTutorialForceEnabled,
  setDeskAppTutorialForceEnabled,
  subscribeSovOsPluginChanges,
  type SovOsPluginAppId,
  type SovOsWindowRect,
} from './sovOsAppRegistry'
import { useGameStore } from './useGameStore'

const EMU_RECT: SovOsWindowRect = { x: 14, y: 14, w: 738, h: 468 }

const IskraPluginEmulatorModal: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const [activeAppId, setActiveAppId] = useState<SovOsPluginAppId>('polit_link')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const apps = getSovOsPluginApps()

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.imageSmoothingEnabled = false
      ctx.fillStyle = '#061a0c'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const plugin = getSovOsPluginApp(activeAppId)
      if (!plugin) return

      // Frame
      ctx.fillStyle = '#081f0f'
      ctx.fillRect(EMU_RECT.x, EMU_RECT.y, EMU_RECT.w, EMU_RECT.h)
      ctx.strokeStyle = '#33ff66'
      ctx.lineWidth = 3
      ctx.strokeRect(EMU_RECT.x, EMU_RECT.y, EMU_RECT.w, EMU_RECT.h)

      ctx.fillStyle = '#165226'
      ctx.fillRect(EMU_RECT.x, EMU_RECT.y, EMU_RECT.w, 44)
      ctx.fillStyle = '#33ff66'
      ctx.fillRect(EMU_RECT.x, EMU_RECT.y + 42, EMU_RECT.w, 2)

      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 19px "Courier Prime", monospace'
      ctx.fillStyle = '#e6dec3'
      ctx.fillText(plugin.windowTitle, EMU_RECT.x + 16, EMU_RECT.y + 22)

      plugin.paintWindow(ctx, EMU_RECT, hoveredId, 1)
    }

    draw()
    const timer = window.setInterval(draw, 120)
    const unsub = subscribeSovOsPluginChanges(draw)
    return () => {
      window.clearInterval(timer)
      unsub()
    }
  }, [activeAppId, hoveredId])

  const mapPointer = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className="w-[790px] max-w-full border-4 border-[#33ff66] bg-[#08170d] p-3 font-vt323 text-[#e6dec3] shadow-[0_0_32px_rgba(51,255,102,0.25)]">
        <div className="mb-2 flex items-center justify-between border-b-2 border-[#22b549] pb-2">
          <div className="flex items-center gap-2">
            <span className="font-kremlin text-sm tracking-wider text-[#ffb000]">
              ISKRA-84 APP EMULATOR
            </span>
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setActiveAppId(app.id)}
                className={`border-2 px-2.5 py-0.5 text-sm ${
                  activeAppId === app.id
                    ? 'border-[#e6dec3] bg-[#33ff66] font-bold text-[#061a0c]'
                    : 'border-[#22b549] bg-[#0c2914] text-[#33ff66]'
                }`}
              >
                {app.iconTitle}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-[#ff2a2a] bg-[#4a1212] px-2.5 py-0.5 text-sm text-[#e6dec3]"
          >
            CLOSE [X]
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={766}
          height={496}
          className="w-full cursor-pointer border-2 border-[#164d25] bg-[#061a0c]"
          onMouseMove={(e) => {
            const pt = mapPointer(e)
            const plugin = getSovOsPluginApp(activeAppId)
            if (!pt || !plugin) return
            const hits = plugin.getHitRegions(EMU_RECT)
            let found: string | null = null
            for (let i = hits.length - 1; i >= 0; i--) {
              const r = hits[i]
              if (
                pt.x >= r.x &&
                pt.x <= r.x + r.w &&
                pt.y >= r.y &&
                pt.y <= r.y + r.h
              ) {
                found = r.id
                break
              }
            }
            setHoveredId(found)
          }}
          onMouseLeave={() => setHoveredId(null)}
          onClick={(e) => {
            const pt = mapPointer(e)
            const plugin = getSovOsPluginApp(activeAppId)
            if (!pt || !plugin) return
            const hits = plugin.getHitRegions(EMU_RECT)
            for (let i = hits.length - 1; i >= 0; i--) {
              const r = hits[i]
                if (
                pt.x >= r.x &&
                pt.x <= r.x + r.w &&
                pt.y >= r.y &&
                pt.y <= r.y + r.h
              ) {
                const res = plugin.handleClick(r.id, r.payload)
                if (res.requestFocusApp) {
                  setActiveAppId(res.requestFocusApp)
                }
                break
              }
            }
          }}
        />
      </div>
    </div>
  )
}

export const DebugMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [emulatorOpen, setEmulatorOpen] = useState(false)
  const [forceDeskTut, setForceDeskTut] = useState(() =>
    isDeskAppTutorialForceEnabled()
  )

  const isGodMode = useGameStore((s) => (isOpen ? s.isGodMode : false))
  const coreTemp = useGameStore((s) => (isOpen ? Math.round(s.coreTemp) : 330))
  const isBlackout = useGameStore((s) => (isOpen ? s.isBlackout : false))
  const activeDirectivesCount = useGameStore((s) =>
    isOpen ? s.activeDirectives.length : 0
  )
  const setGodMode = useGameStore((s) => s.setGodMode)
  const spawnDirective = useGameStore((s) => s.spawnDirective)
  const debugSetTemp = useGameStore((s) => s.debugSetTemp)
  const debugTriggerBlackout = useGameStore((s) => s.debugTriggerBlackout)
  const debugSkipTo0558 = useGameStore((s) => s.debugSkipTo0558)
  const debugCompleteShift = useGameStore((s) => s.debugCompleteShift)
  const jumpToTutorialPhase = useGameStore((s) => s.jumpToTutorialPhase)
  const resetShift = useGameStore((s) => s.resetShift)
  const shiftNumber = useGameStore((s) => (isOpen ? s.shiftNumber : 1))
  const shiftTimeMinutes = useGameStore((s) =>
    isOpen ? s.shiftTimeMinutes : 0
  )
  const complianceScore = useGameStore((s) => (isOpen ? s.complianceScore : 0))
  const truthIntel = useGameStore((s) => (isOpen ? s.truthIntel : 0))
  const archivedCount = useGameStore((s) =>
    isOpen ? s.archivedIntelIds.length : 0
  )
  const treasonStrikes = useGameStore((s) => (isOpen ? s.treasonStrikes : 0))
  const debugSetShiftNumber = useGameStore((s) => s.debugSetShiftNumber)
  const triggerShiftDebrief = useGameStore((s) => s.triggerShiftDebrief)
  const recordComplianceDelta = useGameStore((s) => s.recordComplianceDelta)
  const recordTruthIntelDelta = useGameStore((s) => s.recordTruthIntelDelta)
  const resolveCampaignEnding = useGameStore((s) => s.resolveCampaignEnding)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        if (pointerLockInteraction.mainMenuOpen) return
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    updatePointerLockInteraction({ debugMenuOpen: isOpen || emulatorOpen })
    if ((isOpen || emulatorOpen) && document.pointerLockElement) {
      document.exitPointerLock?.()
    }
  }, [isOpen, emulatorOpen])

  if (!isOpen && !emulatorOpen) return null

  return (
    <>
      {isOpen && (
        <div className="fixed top-14 right-6 z-50 w-[26rem] border-4 border-[#090b09] bg-[#1a2219] p-4 font-vt323 text-[#dfd2a3] shadow-[8px_8px_0_#090b09]">
          <div className="mb-3 flex items-center justify-between border-b-2 border-[#090b09] pb-2">
            <div>
              <span className="block font-kremlin text-sm tracking-wider text-[#ffb000]">
                KGB MINISTRY OVERRIDE [F2]
              </span>
              <span className="block text-xs text-[#9ca396]">
                DECREE 84-B // KOMRAD KRISTIANOV &amp; KOMRAD OLEG CLEARANCE
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="border-2 border-[#090b09] bg-[#7c3819] px-2 py-0.5 text-base text-white shadow-[2px_2px_0_#090b09]"
            >
              SEAL [X]
            </button>
          </div>

          <div className="space-y-2.5 text-lg">
            <div className="flex items-center justify-between border-2 border-[#090b09] bg-[#121712] px-3 py-1.5">
              <span>POLITBURO IMMUNITY (No Meltdown/Siberia):</span>
              <button
                type="button"
                onClick={() => setGodMode(!isGodMode)}
                className={`border-2 border-[#090b09] px-3 py-0.5 font-bold shadow-[2px_2px_0_#090b09] ${
                  isGodMode
                    ? 'bg-[#2bd95a] text-[#090b09]'
                    : 'bg-[#333c31] text-[#dfd2a3]'
                }`}
              >
                {isGodMode ? 'DECREED' : 'REVOKED'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => spawnDirective(false)}
                className="border-2 border-[#090b09] bg-[#263829] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#314a35]"
              >
                + ISSUE PRAVDA ORDER
              </button>
              <button
                type="button"
                onClick={() => spawnDirective(true)}
                className="border-2 border-[#090b09] bg-[#5c231c] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#752c23]"
              >
                + INJECT CIA FORGERY
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => debugSetTemp(860)}
                className="border-2 border-[#090b09] bg-[#4a3919] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#614b21]"
              >
                PROVE MELTDOWN MYTH (860°C)
              </button>
              <button
                type="button"
                onClick={() => debugSetTemp(340)}
                className="border-2 border-[#090b09] bg-[#253024] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#334231]"
              >
                SIBERIAN COOLING (340°C)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={debugTriggerBlackout}
                className="border-2 border-[#090b09] bg-[#2e332d] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#3e453d]"
              >
                {isBlackout ? 'RESTORE LENIN GRID' : 'STAGE GRID BLACKOUT'}
              </button>
              <button
                type="button"
                onClick={() => {
                  debugSkipTo0558()
                  setIsOpen(false)
                }}
                className="border-2 border-[#090b09] bg-[#1d3b32] px-2 py-1 text-left text-[#33ff66] shadow-[2px_2px_0_#090b09] hover:bg-[#265245]"
              >
                SKIP TO 05:58
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                debugCompleteShift()
                setIsOpen(false)
              }}
              className="w-full border-2 border-[#090b09] bg-[#1e4028] px-3 py-1 text-center font-bold text-[#33ff66] shadow-[2px_2px_0_#090b09] hover:bg-[#295937]"
            >
              TRIGGER 06:00 SHIFT END (LIGHTS OFF + LIFT-84)
            </button>

            {/* ISKRA-84 CYBER & DUEL TEST CONTROLS */}
            <div className="border-2 border-[#090b09] bg-[#101c13] p-2">
              <div className="mb-1.5 flex items-center justify-between text-xs tracking-wider text-[#33ff66]">
                <span>ISKRA-84 CYBER &amp; DUEL [TEST]</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !forceDeskTut
                    setDeskAppTutorialForceEnabled(next)
                    setForceDeskTut(next)
                  }}
                  className="border border-[#22b549] bg-[#0a2612] px-1.5 py-0.5 text-[11px]"
                >
                  8-STEP TUT: {isDeskAppTutorialEnabled() ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-sm">
                <button
                  type="button"
                  onClick={() => debugTriggerPolitLinkDuel('crisis')}
                  className="border-2 border-[#090b09] bg-[#3b2d0d] px-2 py-1 text-left text-[#ffb000] hover:bg-[#523f12]"
                >
                  TRIGGER IDEOLOGY DUEL
                </button>
                <button
                  type="button"
                  onClick={() => debugTriggerZashchitaFirewall(false)}
                  className="border-2 border-[#090b09] bg-[#4a1616] px-2 py-1 text-left text-[#ff8888] hover:bg-[#662020]"
                >
                  TRIGGER CIA FIREWALL
                </button>
                <button
                  type="button"
                  onClick={() => jumpToTutorialPhase('STEP_9_IDEOLOGY_DRILL')}
                  className="border-2 border-[#090b09] bg-[#1b3322] px-2 py-1 text-left hover:bg-[#25472e]"
                >
                  STEP 7: DUEL DRILL
                </button>
                <button
                  type="button"
                  onClick={() => jumpToTutorialPhase('STEP_10_FIREWALL_DRILL')}
                  className="border-2 border-[#090b09] bg-[#1b3322] px-2 py-1 text-left hover:bg-[#25472e]"
                >
                  STEP 8: CYBER DRILL
                </button>
              </div>
              <button
                type="button"
                onClick={() => debugTriggerLangleyLeakEvent()}
                className="mt-1.5 w-full border-2 border-[#090b09] bg-[#4a1830] px-2 py-1 text-center text-sm font-bold text-[#ffb000] hover:bg-[#662242]"
              >
                TRIGGER AGENT SMITH EVENT
              </button>
              <button
                type="button"
                onClick={() => setEmulatorOpen(true)}
                className="mt-1.5 w-full border-2 border-[#22b549] bg-[#103b1d] px-2 py-1 text-center text-sm font-bold text-[#33ff66] hover:bg-[#165228]"
              >
                OPEN ISKRA-84 APP EMULATOR
              </button>
            </div>

            {/* CLEAR SKY 3-SHIFT CAMPAIGN TESTER */}
            <div className="border-2 border-[#090b09] bg-[#10181c] p-2">
              <div className="mb-1 flex items-center justify-between text-xs tracking-wider text-[#4dd9ff]">
                <span>CLEAR SKY CAMPAIGN [3 SHIFTS]</span>
                <span>
                  S{shiftNumber}/3 |{' '}
                  {String(Math.floor(shiftTimeMinutes / 60)).padStart(2, '0')}:
                  {String(Math.floor(shiftTimeMinutes % 60)).padStart(2, '0')} |{' '}
                  {treasonStrikes}/6 STR
                </span>
              </div>
              <div className="mb-1.5 text-xs text-[#dfd2a3]">
                TRUTH: {truthIntel} ({archivedCount}/3 FILES) | OBEDIENCE:{' '}
                {complianceScore}
              </div>
              <div className="grid grid-cols-4 gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => debugSetShiftNumber(1)}
                  className="border border-[#090b09] bg-[#1e2f38] px-1.5 py-1 hover:bg-[#2a424f]"
                >
                  SHIFT 1
                </button>
                <button
                  type="button"
                  onClick={() => debugSetShiftNumber(2)}
                  className="border border-[#090b09] bg-[#1e2f38] px-1.5 py-1 hover:bg-[#2a424f]"
                >
                  SHIFT 2
                </button>
                <button
                  type="button"
                  onClick={() => debugSetShiftNumber(3)}
                  className="border border-[#090b09] bg-[#1e2f38] px-1.5 py-1 hover:bg-[#2a424f]"
                >
                  SHIFT 3
                </button>
                <button
                  type="button"
                  onClick={() => triggerShiftDebrief()}
                  className="border border-[#090b09] bg-[#4a3919] px-1.5 py-1 text-[#ffb000] hover:bg-[#614b21]"
                >
                  06:00
                </button>
                <button
                  type="button"
                  onClick={() => recordTruthIntelDelta(30)}
                  className="border border-[#090b09] bg-[#0f3645] px-1.5 py-1 text-[#4dd9ff] hover:bg-[#164d63]"
                >
                  +30 TRUTH
                </button>
                <button
                  type="button"
                  onClick={() => recordComplianceDelta(30)}
                  className="border border-[#090b09] bg-[#3b2d0d] px-1.5 py-1 text-[#ffb000] hover:bg-[#523f12]"
                >
                  +30 OBED
                </button>
                <button
                  type="button"
                  onClick={() => resolveCampaignEnding('bureaucrat')}
                  className="border border-[#090b09] bg-[#2a3319] px-1.5 py-1 hover:bg-[#3a4722]"
                >
                  END A
                </button>
                <button
                  type="button"
                  onClick={() => resolveCampaignEnding('clear_sky')}
                  className="border border-[#090b09] bg-[#104054] px-1.5 py-1 text-[#4dd9ff] hover:bg-[#165975]"
                >
                  END B
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => resetShift()}
              className="w-full border-2 border-[#090b09] bg-[#3b2820] px-3 py-1 text-center shadow-[2px_2px_0_#090b09] hover:bg-[#52372c]"
            >
              REWRITE HISTORY TO SHIFT 1 (00:00)
            </button>

            <div className="border-t border-[#313d2f] pt-1 text-sm text-[#9ca396]">
              Pravda Queue: {activeDirectivesCount} | Core Enthusiasm: {coreTemp}°C (Nominal)
            </div>
          </div>
        </div>
      )}

      {emulatorOpen && (
        <IskraPluginEmulatorModal onClose={() => setEmulatorOpen(false)} />
      )}
    </>
  )
}
