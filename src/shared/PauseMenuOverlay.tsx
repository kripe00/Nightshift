import React, { useEffect, useState } from 'react'
import { isKomradLiquidating } from './komradGrabState'
import { pointerLockInteraction } from './pointerLockState'
import { useGameStore } from './useGameStore'

/**
 * Diegetic 1984 Soviet Pause button (top-right) and Pause Modal (`P` / `ESC`).
 * Freezes reactor thermodynamics, shift clock, P.O.S.T.-84 deadlines,
 * POLIT-LINK 84 duels, and ZASHCHITA-84 firewall breach timers while open.
 */
export const PauseMenuOverlay: React.FC<{ mainMenuOpen: boolean }> = ({
  mainMenuOpen,
}) => {
  const isPaused = useGameStore((s) => s.isPaused)
  const phase = useGameStore((s) => s.phase)
  const isShiftControlReady = useGameStore((s) => s.isShiftControlReady)
  const lobbyMenuPhase = useGameStore((s) => s.lobbyMenuPhase)
  const shiftCompletedAt0600 = useGameStore((s) => s.shiftCompletedAt0600)
  const siberiaGameOverActive = useGameStore((s) => s.siberiaGameOverActive)
  const elevatorDeparturePhase = useGameStore((s) => s.elevatorDeparturePhase)
  const shiftNumber = useGameStore((s) => s.shiftNumber)
  const shiftTimeMinutes = useGameStore((s) => s.shiftTimeMinutes)
  const coreTemp = useGameStore((s) => s.coreTemp)
  const treasonStrikes = useGameStore((s) => s.treasonStrikes)
  const rubles = useGameStore((s) => s.rubles)
  const isMusicMuted = useGameStore((s) => s.isMusicMuted)

  const setPaused = useGameStore((s) => s.setPaused)
  const toggleMusicMute = useGameStore((s) => s.toggleMusicMute)
  const resetShift = useGameStore((s) => s.resetShift)

  const [confirmRestart, setConfirmRestart] = useState(false)

  useEffect(() => {
    if (!isPaused) {
      setConfirmRestart(false)
    }
  }, [isPaused])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase()
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          target.isContentEditable
        ) {
          return
        }
      }

      if (mainMenuOpen || pointerLockInteraction.debugMenuOpen) return
      if (e.repeat) return

      const gs = useGameStore.getState()
      const canPauseNow =
        gs.phase === 'playing' &&
        gs.isShiftControlReady &&
        gs.lobbyMenuPhase === 'entered_control_room' &&
        gs.shiftCompletedAt0600 === 'active' &&
        !gs.siberiaGameOverActive &&
        gs.elevatorDeparturePhase === 'idle' &&
        !isKomradLiquidating()

      if (e.code === 'KeyP') {
        if (gs.isPaused || canPauseNow) {
          e.preventDefault()
          gs.togglePaused()
        }
        return
      }

      if (e.key === 'Escape') {
        if (gs.isPaused) {
          e.preventDefault()
          gs.setPaused(false)
          return
        }
        if (
          canPauseNow &&
          !gs.isSeatedAtDesk &&
          !document.pointerLockElement
        ) {
          e.preventDefault()
          gs.setPaused(true)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mainMenuOpen])

  const showPauseButton =
    !mainMenuOpen &&
    !isPaused &&
    phase === 'playing' &&
    isShiftControlReady &&
    lobbyMenuPhase === 'entered_control_room' &&
    shiftCompletedAt0600 === 'active' &&
    !siberiaGameOverActive &&
    elevatorDeparturePhase === 'idle'

  const hh = String(Math.floor(shiftTimeMinutes / 60)).padStart(2, '0')
  const mm = String(Math.floor(shiftTimeMinutes % 60)).padStart(2, '0')

  return (
    <>
      {showPauseButton && (
        <button
          type="button"
          onClick={() => setPaused(true)}
          title="Pause Shift [P]"
          className="fixed top-3 right-4 z-30 cursor-pointer border-2 border-[#39ff14]/75 bg-[#051209]/90 px-3 py-1 font-vt323 text-lg tracking-widest text-[#39ff14] shadow-[0_0_14px_rgba(57,255,20,0.2)] transition-colors hover:border-[#ffb000] hover:bg-[#0d2414] hover:text-[#ffb000]"
        >
          ⏸ PAUSE [P]
        </button>
      )}

      {isPaused && !mainMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Shift Paused"
          className="fixed inset-0 z-[55] flex items-center justify-center bg-[#050906]/82 p-4 backdrop-blur-[2px] select-none"
        >
          <div className="w-[32rem] max-w-full border-4 border-[#090b09] bg-[#141c15] p-5 font-vt323 text-[#e6dec3] shadow-[10px_10px_0_#090b09,0_0_32px_rgba(51,255,102,0.16)]">
            <div className="mb-3 border-b-2 border-[#2a4531] pb-2.5">
              <div className="font-kremlin text-xl tracking-wider text-[#33ff66]">
                GOSPLAN SHIFT SUSPENDED // PAUSED
              </div>
              <div className="text-sm tracking-widest text-[#ffb000]">
                ALL REACTOR TIMERS &amp; HAZARDS FROZEN
              </div>
            </div>

            <div className="mb-4 grid grid-cols-5 gap-1.5 border-2 border-[#090b09] bg-[#09120c] p-2.5 text-center">
              <div>
                <div className="text-xs text-[#7fa68a]">SHIFT</div>
                <div className="text-lg font-bold text-[#e6dec3]">
                  0{shiftNumber}/03
                </div>
              </div>
              <div>
                <div className="text-xs text-[#7fa68a]">CLOCK</div>
                <div className="text-lg font-bold text-[#33ff66]">
                  {hh}:{mm}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#7fa68a]">CORE</div>
                <div
                  className={`text-lg font-bold ${
                    coreTemp >= 700 ? 'text-[#ff4d4d]' : 'text-[#e6dec3]'
                  }`}
                >
                  {Math.round(coreTemp)}°C
                </div>
              </div>
              <div>
                <div className="text-xs text-[#7fa68a]">STRIKES</div>
                <div
                  className={`text-lg font-bold ${
                    treasonStrikes >= 4 ? 'text-[#ffb000]' : 'text-[#e6dec3]'
                  }`}
                >
                  {treasonStrikes}/6
                </div>
              </div>
              <div>
                <div className="text-xs text-[#7fa68a]">BALANCE</div>
                <div className="text-lg font-bold text-[#ffb000]">
                  {Math.round(rubles)} RUB
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xl">
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="w-full cursor-pointer border-2 border-[#090b09] bg-[#1a4a27] px-4 py-2 font-bold tracking-wider text-[#33ff66] shadow-[3px_3px_0_#090b09] hover:bg-[#236334]"
              >
                [ RESUME SHIFT (P / ESC) ]
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleMusicMute()}
                  className="cursor-pointer border-2 border-[#090b09] bg-[#222d24] px-3 py-1.5 text-lg text-[#e6dec3] shadow-[3px_3px_0_#090b09] hover:bg-[#2d3d30]"
                >
                  [ AUDIO: {isMusicMuted ? 'MUTED' : 'ON'} ]
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!confirmRestart) {
                      setConfirmRestart(true)
                      return
                    }
                    setConfirmRestart(false)
                    setPaused(false)
                    resetShift()
                  }}
                  className={`cursor-pointer border-2 border-[#090b09] px-3 py-1.5 text-lg shadow-[3px_3px_0_#090b09] ${
                    confirmRestart
                      ? 'bg-[#7d1f1f] font-bold text-[#ffcccc] hover:bg-[#9c2727]'
                      : 'bg-[#3d231c] text-[#ffb000] hover:bg-[#543026]'
                  }`}
                >
                  {confirmRestart ? '[ CONFIRM RESTART? ]' : '[ RESTART SHIFT ]'}
                </button>
              </div>
            </div>

            <div className="mt-4 border-t-2 border-[#23332b] pt-2.5 text-sm leading-snug text-[#a5b5a9]">
              <div className="mb-1 text-xs tracking-widest text-[#ffb000]">
                OPERATOR CONTROLS
              </div>
              <div>• WASD / Arrows + Mouse (SHIFT to Sprint): Move &amp; Look</div>
              <div>• Keys 0–6: Focus Console Stations | E / ESC: Desk &amp; Lift</div>
              <div>• LMB Drag / Scroll: Valves &amp; Faders (Shift+Scroll ±1%)</div>
              <div>• P / ESC: Pause &amp; Freeze Reactor Simulation</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
