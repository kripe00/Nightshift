import React, { useEffect, useState } from 'react'
import { useGameStore } from './useGameStore'

export const DebugMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  const isGodMode = useGameStore((s) => s.isGodMode)
  const coreTemp = useGameStore((s) => s.coreTemp)
  const isBlackout = useGameStore((s) => s.isBlackout)
  const activeDirectives = useGameStore((s) => s.activeDirectives)
  const setGodMode = useGameStore((s) => s.setGodMode)
  const spawnDirective = useGameStore((s) => s.spawnDirective)
  const debugSetTemp = useGameStore((s) => s.debugSetTemp)
  const debugTriggerBlackout = useGameStore((s) => s.debugTriggerBlackout)
  const debugCompleteShift = useGameStore((s) => s.debugCompleteShift)
  const resetShift = useGameStore((s) => s.resetShift)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed top-14 right-6 z-50 w-96 border-4 border-[#090b09] bg-[#1a2219] p-4 font-vt323 text-[#dfd2a3] shadow-[8px_8px_0_#090b09]">
      <div className="mb-3 flex items-center justify-between border-b-2 border-[#090b09] pb-2">
        <span className="font-kremlin text-sm tracking-wider text-[#ffb000]">
          COMMISSAR DEBUG CONSOLE [F2]
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="border-2 border-[#090b09] bg-[#7c3819] px-2 py-0.5 text-base text-white shadow-[2px_2px_0_#090b09]"
        >
          CLOSE [X]
        </button>
      </div>

      <div className="space-y-2.5 text-lg">
        <div className="flex items-center justify-between border-2 border-[#090b09] bg-[#121712] px-3 py-1.5">
          <span>OLE GOD MODE (No Meltdown/Gulag):</span>
          <button
            type="button"
            onClick={() => setGodMode(!isGodMode)}
            className={`border-2 border-[#090b09] px-3 py-0.5 font-bold shadow-[2px_2px_0_#090b09] ${
              isGodMode
                ? 'bg-[#2bd95a] text-[#090b09]'
                : 'bg-[#333c31] text-[#dfd2a3]'
            }`}
          >
            {isGodMode ? 'ENABLED' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => spawnDirective(false)}
            className="border-2 border-[#090b09] bg-[#263829] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#314a35]"
          >
            + SPAWN VALID ORDER
          </button>
          <button
            type="button"
            onClick={() => spawnDirective(true)}
            className="border-2 border-[#090b09] bg-[#5c231c] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#752c23]"
          >
            + SPAWN CIA FORGERY
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => debugSetTemp(860)}
            className="border-2 border-[#090b09] bg-[#4a3919] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#614b21]"
          >
            SET TEMP 860°C (HOT)
          </button>
          <button
            type="button"
            onClick={() => debugSetTemp(340)}
            className="border-2 border-[#090b09] bg-[#253024] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#334231]"
          >
            COOL TO 340°C
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={debugTriggerBlackout}
            className="border-2 border-[#090b09] bg-[#2e332d] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#3e453d]"
          >
            {isBlackout ? 'CLEAR BLACKOUT' : 'TRIGGER BLACKOUT'}
          </button>
          <button
            type="button"
            onClick={debugCompleteShift}
            className="border-2 border-[#090b09] bg-[#1e4028] px-2 py-1 text-left shadow-[2px_2px_0_#090b09] hover:bg-[#295937]"
          >
            INSTANT WIN (06:00)
          </button>
        </div>

        <button
          type="button"
          onClick={resetShift}
          className="w-full border-2 border-[#090b09] bg-[#3b2820] px-3 py-1 text-center shadow-[2px_2px_0_#090b09] hover:bg-[#52372c]"
        >
          RESET SHIFT 1 STATE
        </button>

        <div className="border-t border-[#313d2f] pt-1 text-sm text-[#9ca396]">
          Active Papers: {activeDirectives.length} | Core: {Math.round(coreTemp)}°C
        </div>
      </div>
    </div>
  )
}

