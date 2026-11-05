import React from 'react'
import { useGameStore } from '../../shared/useGameStore'
import { DraggableLever } from './DraggableLever'
import { getAudioContext, playKlaxonBurst, playSwitchClank } from './audioSynth'
import { startSoundtrack } from './soundtrackPlayer'

export const MainBreakerModal: React.FC = () => {
  const phase = useGameStore((s) => s.phase)
  const coreTemp = useGameStore((s) => s.coreTemp)
  const treasonStrikes = useGameStore((s) => s.treasonStrikes)
  const startShift = useGameStore((s) => s.startShift)
  const resetShift = useGameStore((s) => s.resetShift)

  if (phase === 'playing') return null

  const handleBootThrow = () => {
    getAudioContext()
    playSwitchClank(true)
    startSoundtrack()
    startShift()
  }

  const handleRestartThrow = () => {
    getAudioContext()
    playKlaxonBurst()
    startSoundtrack()
    resetShift()
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#060806]/90 p-6">
      <div className="w-[620px] border-4 border-[#090b09] bg-[#263225] p-6 shadow-[12px_12px_0_#090b09,inset_3px_3px_0_rgba(255,255,255,0.15)]">
        <div className="mb-4 flex items-center justify-between border-b-3 border-[#090b09] pb-3">
          <div>
            <h2 className="font-kremlin text-2xl tracking-widest text-[#ffb000]">
              {phase === 'boot' && 'PEOPLE’S AUTOMATED NUCLEAR PLANT NO. 4'}
              {phase === 'victory' && 'GLORIOUS VICTORY // 06:00 SHIFT COMPLETE'}
              {phase === 'meltdown' && 'THERMAL ANOMALY // 1,000°C CONTAINMENT BREACH'}
              {phase === 'gulag' && 'KGB ARREST WARRANT // 3 TREASON STRIKES'}
            </h2>
            <p className="font-vt323 text-lg text-[#dfd2a3]">
              {phase === 'boot' &&
                'MINISTRY OF ATOMIC HARMONY — NIGHT SHIFT SIMULATOR (1984)'}
              {phase === 'victory' &&
                'YOU SURVIVED NIGHT SHIFT 1 WITHOUT IDEOLOGICAL DEVIATION.'}
              {phase === 'meltdown' &&
                'K.O.M.R.A.D.-84 INSISTS THIS GRAPHITE FIRE ON THE ROOF IS MERELY AURORA BOREALIS.'}
              {phase === 'gulag' &&
                'YOU HAVE BEEN REASSIGNED TO SIBERIAN URANIUM EXTRACTION BRIGADE NO. 9.'}
            </p>
          </div>
          <span className="border-2 border-[#090b09] bg-[#8f1810] px-3 py-1 font-kremlin text-sm text-[#dfd2a3]">
            CCCP-84
          </span>
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] items-center gap-6 border-3 border-[#090b09] bg-[#182017] p-4">
          <div className="space-y-2.5 font-vt323 text-xl leading-snug text-[#dfd2a3]">
            {phase === 'boot' ? (
              <>
                <p className="text-[#39ff5a]">
                  &gt; 1. HOLD PHYSICAL [SHIFT] KEY TO ROUTE REACTOR MEGAWATTS.
                </p>
                <p className="text-[#ffb000]">
                  &gt; 2. OVERCLOCKING PAST 100 MW (REDLINE) RISKS BLACKOUT.
                </p>
                <p className="text-[#dfd2a3]">
                  &gt; 3. INSPECT PRAVDA DIRECTIVES WITH MAGNIFYING GLASS &amp; MANUAL
                  TO CATCH CIA SABOTAGE.
                </p>
                <p className="pt-1 text-base text-[#9ca396]">
                  (TIP: PRESS [F2] ANYTIME FOR COMMISSAR GOD-MODE &amp; DEBUG TOOLS)
                </p>
              </>
            ) : (
              <>
                <p>FINAL CORE TEMPERATURE: {Math.round(coreTemp)}°C</p>
                <p>TREASON STRIKES RECORDED: {treasonStrikes} / 3</p>
                <p className="text-[#ffb000]">
                  DRAG THE BREAKER LEVER BELOW TO INITIALIZE NEXT SHIFT.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col items-center justify-center border-3 border-[#090b09] bg-[#222b21] p-4 shadow-[inset_0_2px_6px_rgba(0,0,0,0.85)]">
            <DraggableLever
              mode="binary"
              label="MAIN BREAKER"
              subLabel="DRAG DOWN TO ENGAGE"
              isOn={true}
              accentColor="red"
              heightPx={126}
              onCommit={() => {
                if (phase === 'boot') {
                  handleBootThrow()
                } else {
                  handleRestartThrow()
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

