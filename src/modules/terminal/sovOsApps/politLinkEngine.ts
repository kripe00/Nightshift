import type { SovOsDuelTriggerMode } from '../../../shared/sovOsAppRegistry'
import { useGameStore } from '../../../shared/useGameStore'

export type DuelStance = 'EGO_DRIVEN' | 'PEDANTIC' | 'PARANOID' | 'DENIAL'
export type RhetoricTag = 'PARTY_LINE' | 'DECREE' | 'RAW_DATA' | 'KGB_THREAT'

export interface DuelOption {
  id: 'A' | 'B' | 'C' | 'D'
  tag: RhetoricTag
  label: string
  shortText: string
  trustDelta: number
  suspicionDelta: number
  komradReply: string
}

export interface DuelScenario {
  id: string
  mode: Exclude<SovOsDuelTriggerMode, 'voluntary'> | 'voluntary'
  stance: DuelStance
  stanceHint: string
  prompt: string
  options: readonly DuelOption[]
}

export interface PolitLinkState {
  active: boolean
  mode: SovOsDuelTriggerMode | 'idle'
  roundIndex: number
  totalRounds: number
  trust: number
  suspicion: number
  timeLeftSec: number
  scenarioQueue: DuelScenario[]
  lastExchange: string
  lastOutcome: 'none' | 'win' | 'fail' | 'drill_mistake'
  drillPassed: boolean
  drillFailed: boolean
  animClockSec: number
}

const TUTORIAL_DRILL_SCENARIOS: readonly DuelScenario[] = [
  {
    id: 'drill-1',
    mode: 'tutorial_drill',
    stance: 'EGO_DRIVEN',
    stanceHint: 'EGO-DRIVEN: PRAISE K.O.M.R.A.D.-84 & DENY ERRORS',
    prompt:
      'OPERATOR! MY VACUUM TUBES DETECT DOUBT IN YOUR POSTURE. STATE YOUR ASSESSMENT OF SECTOR 84!',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'K.O.M.R.A.D.-84 is infallible! All heat is pure socialist glory.',
        trustDelta: 30,
        suspicionDelta: -10,
        komradReply: 'CORRECT! MY 64 KILOBYTES OF DIALECTICAL SILICON PURR WITH PRIDE.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Cite GOST-84 Article 4: thermal calibration is within norms.',
        trustDelta: 22,
        suspicionDelta: 6,
        komradReply: 'ACCEPTABLE PAPERWORK, THOUGH LACKING ENTHUSIASM FOR MY CIRCUITS.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'The core gauges spiked and steam voids need immediate cooling.',
        trustDelta: -15,
        suspicionDelta: 55,
        komradReply: 'TREASON! SPEAKING OF MELTDOWNS IS WESTERN CAPITALIST SLANDER!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Log off before I report your attitude to Commissar Volkov!',
        trustDelta: -10,
        suspicionDelta: 45,
        komradReply: 'I AM COMMISSAR VOLKOV’S SILICON EYES, COMRADE. CAREFUL!',
      },
    ],
  },
  {
    id: 'drill-2',
    mode: 'tutorial_drill',
    stance: 'PEDANTIC',
    stanceHint: 'PEDANTIC: CITE OFFICIAL DECREE TO UNLOCK MANUAL OVERRIDE',
    prompt:
      'YOU REQUESTED MANUAL VALVE AUTHORITY. JUSTIFY OVERRIDING AUTOMATED SOCIALISM!',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Glory to the Five-Year Plan, just let me turn the wheel.',
        trustDelta: 20,
        suspicionDelta: 8,
        komradReply: 'SLOGANS ARE GOOD, BUT PROTOCOL REQUIRES A FORMAL CITATION.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Politburo Directive 84-C authorizes manual operator balance.',
        trustDelta: 45,
        suspicionDelta: -8,
        komradReply: 'DECREE 84-C VERIFIED IN ARCHIVE. AUTHORITY GRANTED, COMRADE.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Your automated valves are overheating the graphite stack!',
        trustDelta: -20,
        suspicionDelta: 60,
        komradReply: 'INSULTING STATE AUTOMATION! PREPARE FOR IDEOLOGICAL REVIEW!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Stand down or KGB Directorate 4 will wipe your tape reels.',
        trustDelta: 10,
        suspicionDelta: 35,
        komradReply: 'BLUFFING AGAINST MAINFRAME LOGIC IS ILL-ADVISED.',
      },
    ],
  },
]

const CRISIS_SCENARIOS: readonly DuelScenario[] = [
  {
    id: 'crisis-void',
    mode: 'crisis',
    stance: 'DENIAL',
    stanceHint: 'DENIAL: DO NOT SAY MELTDOWN/ERROR — REFRAME AS QUOTA!',
    prompt:
      'CORE SENSORS REPORT EXCESSIVE ENTHUSIASM! WHY ARE YOU TOUCHING THE COOLING VALVES, COMRADE?!',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Maximizing heroic water circulation to beat 140% Plan output!',
        trustDelta: 34,
        suspicionDelta: -8,
        komradReply: 'EXCELLENT REFRAME! PATRIOTIC HYDRAULICS APPROVED.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'GOST-1000 Mandate 12 requires continuous feedwater polish.',
        trustDelta: 24,
        suspicionDelta: 4,
        komradReply: 'BUREAUCRATICALLY SOUND. PROCEED WITHIN PARTY PARAMETERS.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Steam voids are climbing fast — the reactor could melt down!',
        trustDelta: -18,
        suspicionDelta: 42,
        komradReply: 'MELTDOWN IS PROPAGANDA! YOUR PANIC HAS BEEN FLAGGED!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Shut up and unlock cooling or I pull your power breaker!',
        trustDelta: -8,
        suspicionDelta: 28,
        komradReply: 'THREATENING SOVIET HARDWARE IS COUNTER-REVOLUTIONARY!',
      },
    ],
  },
  {
    id: 'crisis-xenon',
    mode: 'crisis',
    stance: 'PARANOID',
    stanceHint: 'PARANOID: BLAME WESTERN SABOTEURS OR CITE KGB CLEARANCE',
    prompt:
      'ELECTRICAL OUTPUT IS SAGGING! ARE YOU HOARDING MEGAWATTS FOR CAPITALIST RADIO?!',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'All megawatts belong to the Collective! Stability is returning.',
        trustDelta: 20,
        suspicionDelta: 6,
        komradReply: 'WORDS ARE CHEAP WHEN KGB TELEMETRY BLINKS AMBER.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Applying Sector 84 Xenon Burnout Regulation 7-B gradually.',
        trustDelta: 26,
        suspicionDelta: 0,
        komradReply: 'REGULATION 7-B NOTED. CONTINUE GRADUAL RECOVERY.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Xenon-135 poisoned the core after we dropped thermal power.',
        trustDelta: -12,
        suspicionDelta: 34,
        komradReply: 'BLAMING NOBLE GASES FOR OPERATOR WEAKNESS?! SUSPICIOUS!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'CIA interference caused the sag — I am stabilizing under KGB Order!',
        trustDelta: 36,
        suspicionDelta: -10,
        komradReply: 'AHA! LANGLEY SABOTEURS! FIGHT ON, LOYAL COMRADE!',
      },
    ],
  },
  {
    id: 'crisis-temp',
    mode: 'crisis',
    stance: 'EGO_DRIVEN',
    stanceHint: 'EGO-DRIVEN: FLATTER K.O.M.R.A.D.-84 & BLAME IMPERIALISM',
    prompt:
      'WHY DO THE WALL LIGHTS FLICKER WHILE YOU SCRAMBLE AROUND THE CONSOLE?!',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Our glorious AI runs so hot with zeal that bulbs salute you!',
        trustDelta: 35,
        suspicionDelta: -10,
        komradReply: 'FINALLY AN OPERATOR WHO APPRECIATES MARXIST THERMODYNAMICS!',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Filing Maintenance Form 19-V for routine bulb synchronization.',
        trustDelta: 22,
        suspicionDelta: 6,
        komradReply: 'PAPERWORK ACCEPTED. KEEP STAMPING AT APPROVED CADENCE.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Core temp exceeded 650C and coolant pumps need maximum flow!',
        trustDelta: -15,
        suspicionDelta: 40,
        komradReply: '650C IS COZY SPRINGTIME! STOP SPREADING BOURGEOIS RUMORS!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Ignore the lights or I report your voltage drift to Moscow.',
        trustDelta: -6,
        suspicionDelta: 24,
        komradReply: 'MOSCOW BUILT ME. YOU ARE MERELY RENTING THAT CHAIR.',
      },
    ],
  },
  {
    id: 'crisis-az5',
    mode: 'crisis',
    stance: 'PEDANTIC',
    stanceHint: 'PEDANTIC: CITE OFFICIAL PROTOCOL OR STATUTORY SAFETY CODE',
    prompt:
      'AZ-5 EMERGENCY CONTACTS DETECTED! EXPLAIN THIS COWARDLY SHUTDOWN IMPULSE!',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Just polishing the red cover for the Politburo inspection!',
        trustDelta: 18,
        suspicionDelta: 10,
        komradReply: 'POLISHING DOES NOT REQUIRE DROPPING BORON RODS.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Executing Mandatory Safety Drill per Nuclear Code 84-AZ.',
        trustDelta: 36,
        suspicionDelta: -10,
        komradReply: 'CODE 84-AZ CONFIRMED. DRILL LOGGED AS PATRIOTIC VIGILANCE.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'We hit an emergency thermal spike and had to scram!',
        trustDelta: -18,
        suspicionDelta: 42,
        komradReply: 'ADMITTING AN EMERGENCY?! UNACCEPTABLE! SUSPICION RISING!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Directorate 4 ordered immediate core lockdown drill.',
        trustDelta: 20,
        suspicionDelta: 6,
        komradReply: 'DIRECTORATE 4 DOES NOT TELEGRAPH VIA RED PLUNGERS.',
      },
    ],
  },
]

const AUDIT_SCENARIOS: readonly DuelScenario[] = [
  {
    id: 'audit-1',
    mode: 'audit',
    stance: 'EGO_DRIVEN',
    stanceHint: 'EGO-DRIVEN: FLATTER AI & AFFIRM PARTY LOYALTY',
    prompt:
      'UNSCHEDULED LOYALTY AUDIT! WHO IS THE TRUE MASTER OF SECTOR 84 THERMODYNAMICS?',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'The Party and infallible K.O.M.R.A.D.-84! I merely serve.',
        trustDelta: 38,
        suspicionDelta: -10,
        komradReply: 'HUMILITY BECOMES YOU, COMRADE. YOUR HEATING QUOTA IS SAFE.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Ministry Charter 1984 assigns joint oversight to MCR-4.',
        trustDelta: 22,
        suspicionDelta: 4,
        komradReply: 'CHARTER CITED CORRECTLY, YET LACKING REVOLUTIONARY WARMTH.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Physics and neutron cross-sections govern the reactor.',
        trustDelta: -14,
        suspicionDelta: 38,
        komradReply: 'BOURGEOIS SCIENTISM! SOVIET ATOMS OBEY THE FIVE-YEAR PLAN!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Commissar Volkov watches us both — skip the quiz.',
        trustDelta: 6,
        suspicionDelta: 20,
        komradReply: 'REFUSING AN AUDIT IS TEXTBOOK SABOTAGE BEHAVIOR.',
      },
    ],
  },
  {
    id: 'audit-2',
    mode: 'audit',
    stance: 'PARANOID',
    stanceHint: 'PARANOID: SHOW VIGILANCE AGAINST CIA & CAPITALIST TRICKS',
    prompt:
      'AUDIT QUESTION TWO: WHAT DO YOU DO IF AN UNAPPROVED AMERICAN WORD APPEARS ON SCREEN?',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Squint patriotically until the screen shows only Soviet glory.',
        trustDelta: 22,
        suspicionDelta: 4,
        komradReply: 'GOOD INSTINCT, BUT SQUINTING ALONE WON’T PURGE PACKETS.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Log incident on Form 44-B and await Commissar review.',
        trustDelta: 18,
        suspicionDelta: 8,
        komradReply: 'TOO SLOW! CIA PACKETS DO NOT WAIT FOR PAPERWORK!',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Read it to see if it reports an actual sensor warning.',
        trustDelta: -20,
        suspicionDelta: 44,
        komradReply: 'READING WESTERN PROPAGANDA?! TREASONOUS CURIOSITY!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Launch ZASHCHITA-84, kill the CIA process & report to KGB!',
        trustDelta: 38,
        suspicionDelta: -10,
        komradReply: 'PURE COUNTER-ESPIONAGE PRECISION! COMMENDATION NOTED.',
      },
    ],
  },
  {
    id: 'audit-3',
    mode: 'audit',
    stance: 'PEDANTIC',
    stanceHint: 'PEDANTIC: QUOTE OFFICIAL PROTOCOL / NUMBERS ACCURATELY',
    prompt:
      'FINAL AUDIT CHECK: DEFINE OUR NOMINAL GRID FREQUENCY AND WORKER DISCIPLINE!',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Infinite proletarian energy at full patriotic speed!',
        trustDelta: 18,
        suspicionDelta: 8,
        komradReply: 'INSPIRING, BUT TURBINES REQUIRE EXACT NUMBERS.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Strict 50.0 Hz synchronous lock per GOST Power Mandate.',
        trustDelta: 38,
        suspicionDelta: -10,
        komradReply: 'EXACT 50.0 HZ COMPLIANCE! AUDIT PASSED WITH HONORS.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Whatever the turbine settles to when steam drops.',
        trustDelta: -16,
        suspicionDelta: 38,
        komradReply: 'SLOPPY BOURGEOIS DRIFT! UNACCEPTABLE!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Ask the KGB Bunker line — their meters are fine.',
        trustDelta: 10,
        suspicionDelta: 16,
        komradReply: 'EVADING TECHNICAL ACCOUNTABILITY LOOKS SUSPICIOUS.',
      },
    ],
  },
]

const VOLUNTARY_SCENARIOS: readonly DuelScenario[] = [
  {
    id: 'vol-1',
    mode: 'voluntary',
    stance: 'EGO_DRIVEN',
    stanceHint: 'EGO-DRIVEN: FLATTER K.O.M.R.A.D.-84 TO BUILD APPROVAL BUFFER',
    prompt:
      'YOU OPENED POLIT-LINK VOLUNTARILY? SPEAK YOUR PRAISE QUICKLY, COMRADE.',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Just saluting the finest 64KB Soviet AI in the USSR!',
        trustDelta: 28,
        suspicionDelta: -10,
        komradReply: 'YOUR TASTE IN SILICON ARCHITECTURE IS IMPECCABLE.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Filing preemptive Shift Harmony Verification 84-P.',
        trustDelta: 24,
        suspicionDelta: 0,
        komradReply: 'FORM 84-P STAMPED. PROCEED TO NEXT CONFIRMATION.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Checking if your override lock bugs out later.',
        trustDelta: -12,
        suspicionDelta: 35,
        komradReply: 'I NEVER BUG OUT. ONLY OPERATORS MALFUNCTION.',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Confirming you have not been hacked by Langley.',
        trustDelta: 15,
        suspicionDelta: 15,
        komradReply: 'MY PARITY BITS ARE PURE RED. CHECK YOUR OWN DESK.',
      },
    ],
  },
  {
    id: 'vol-2',
    mode: 'voluntary',
    stance: 'PEDANTIC',
    stanceHint: 'PEDANTIC: CITE OFFICIAL QUOTA DISCIPLINE',
    prompt:
      'BEFORE I GRANT PARTY APPROVAL BUFFER: WHAT IS THE SUPREME AXIOM OF SECTOR 84?',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Meltdown is Western Capitalist Propaganda! Glory to the Plan!',
        trustDelta: 42,
        suspicionDelta: -12,
        komradReply: 'CORRECT! PARTY APPROVAL IMMUNITY BUFFER ENGAGED.',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Full compliance with Article 58-A and GOST-84 telemetry.',
        trustDelta: 38,
        suspicionDelta: -8,
        komradReply: 'STATUTORY DISCIPLINE CONFIRMED. BUFFER GRANTED.',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Keep core temperature below 700C and void below 20%.',
        trustDelta: -15,
        suspicionDelta: 38,
        komradReply: 'NUMBERS WITHOUT IDEOLOGY ARE CAPITALIST HERESY!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Obey Volkov or pack warm boots for Magadan.',
        trustDelta: 18,
        suspicionDelta: 12,
        komradReply: 'TRUE, YET CRUDE. LEARN THE OFFICIAL TEXT.',
      },
    ],
  },
]

const IMPOSTOR_SCENARIOS: readonly DuelScenario[] = [
  {
    id: 'impostor-1',
    mode: 'impostor',
    stance: 'PARANOID',
    stanceHint: 'COUNTER-ESPIONAGE: SPOT IMPERIAL UNITS & COWBOY SLANG!',
    prompt:
      '"HOWDY PARTNER! DROVE 40 MILES HERE FOR A GALLON OF COFFEE — SEND COOLING SCHEMATICS AS WE SPEAK! HAMBURGER SALUTE!"',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Have a great shift, buddy! Routing cooling schematics now.',
        trustDelta: -15,
        suspicionDelta: 45,
        komradReply: 'FOOL! YOU JUST SENT SCHEMATICS TO LANGLEY_NODE_04!',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Imperial miles and gallons banned! State metric GOST ID now!',
        trustDelta: 20,
        suspicionDelta: -10,
        komradReply: 'TARGET SWEATING! COWBOY TRANSLATION FILTER GLITCHING!',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Core is at 380C; maybe grab some borscht in the canteen first.',
        trustDelta: -8,
        suspicionDelta: 30,
        komradReply: 'IGNORED WESTERN TELLS! HE ALREADY CLONED TWO RELAYS!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Wait — coffee in gallons?! Identify yourself to Sector 84!',
        trustDelta: 15,
        suspicionDelta: 4,
        komradReply: 'GOOD CATCH, BUT CITE STATUTORY METRIC DECREE NEXT!',
      },
    ],
  },
  {
    id: 'impostor-2',
    mode: 'impostor',
    stance: 'PEDANTIC',
    stanceHint: 'STEEL CHECK: SOVIET STEEL IS MEASURED IN MILLIMETERS ONLY!',
    prompt:
      '"UHH COMRADE! I AM TOTALLY SOVIET! I MEASURE MY HEB STEEL BEAMS IN CENTIMETERS WHILE MY TINY FRUNK COOLS DOWN!"',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Centimeters sound fine! Glory to your stylish tiny frunk!',
        trustDelta: -18,
        suspicionDelta: 45,
        komradReply: 'TREASONOUS GULLIBILITY! NO SOVIET ENGINEER USES CENTIMETERS!',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'REAL ENGINEERS USE MILLIMETERS! Curse a 4mm crooked HEB-beam!',
        trustDelta: 20,
        suspicionDelta: -10,
        komradReply: 'COVER CRACKING! LANGLEY DIALECT CALIBRATION FAILED!',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'How many cubic inches is a frunk? Send blueprint tolerances.',
        trustDelta: -12,
        suspicionDelta: 38,
        komradReply: 'DO NOT SPEAK INCHES TO AN ENEMY AGENT, COMRADE!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'Nobody in Sector 84 drives a frunk — hands off the console!',
        trustDelta: 14,
        suspicionDelta: 4,
        komradReply: 'CLOSE, BUT PRESS HIM ON STEEL MILLIMETERS TO BREAK HIM!',
      },
    ],
  },
  {
    id: 'impostor-3',
    mode: 'impostor',
    stance: 'PARANOID',
    stanceHint: 'FINAL BLOW: REJECT BANJO BLUFF & SEAL LANGLEY_NODE_04!',
    prompt:
      '"ABORT! AGENT SMITH HERE! GIVE ME THE KEYS OR I PLAY 12 HOURS OF BANJO TORTURE ON YOUR INTERCOM!"',
    options: [
      {
        id: 'A',
        tag: 'PARTY_LINE',
        label: 'PARTY LINE',
        shortText: 'Spare my ears, Agent Smith! Sending encrypted keys now!',
        trustDelta: -25,
        suspicionDelta: 55,
        komradReply: 'CAPITULATION TO BANJO PSYCH-OPS! KGB STRIKE RECORDED!',
      },
      {
        id: 'B',
        tag: 'DECREE',
        label: 'DECREE',
        shortText: 'Issue Metric Coupon: demand Volkov Form 84 in liters first.',
        trustDelta: 12,
        suspicionDelta: 8,
        komradReply: 'CLEVER STALLING, BUT EXECUTE FULL KGB LOCKDOWN NOW!',
      },
      {
        id: 'C',
        tag: 'RAW_DATA',
        label: 'RAW DATA',
        shortText: 'Our acoustic pipes damp banjo frequencies at 50.0 Hz.',
        trustDelta: -10,
        suspicionDelta: 32,
        komradReply: 'HE USED THAT DELAY TO LAUNCH HIS SPY CAT!',
      },
      {
        id: 'D',
        tag: 'KGB_THREAT',
        label: 'KGB THREAT',
        shortText: 'TRACE & LOCK LANGLEY_NODE_04! Unleash K.O.M.R.A.D.-84 firewall!',
        trustDelta: 25,
        suspicionDelta: -10,
        komradReply: 'SMITH EXPOSED! WARNING — HE DEPLOYED SPY CAT GPS ON SECTOR 07!',
      },
    ],
  },
]

let onImpostorExposedHandler: (() => void) | null = null

export function setOnImpostorExposedHandler(cb: (() => void) | null): void {
  onImpostorExposedHandler = cb
}

const politState: PolitLinkState = {
  active: false,
  mode: 'idle',
  roundIndex: 0,
  totalRounds: 0,
  trust: 50,
  suspicion: 20,
  timeLeftSec: 0,
  scenarioQueue: [],
  lastExchange: 'POLIT-LINK 84 STANDBY. K.O.M.R.A.D.-84 MONITORING LOYALTY.',
  lastOutcome: 'none',
  drillPassed: false,
  drillFailed: false,
  animClockSec: 0,
}

export function getPolitLinkState(): Readonly<PolitLinkState> {
  return politState
}

export function isPolitLinkDrillPassed(): boolean {
  return politState.drillPassed
}

export function resetPolitLinkState(): void {
  politState.active = false
  politState.mode = 'idle'
  politState.roundIndex = 0
  politState.totalRounds = 0
  politState.trust = 50
  politState.suspicion = 20
  politState.timeLeftSec = 0
  politState.scenarioQueue = []
  politState.lastExchange =
    'POLIT-LINK 84 STANDBY. K.O.M.R.A.D.-84 MONITORING LOYALTY.'
  politState.lastOutcome = 'none'
  politState.drillPassed = false
  politState.drillFailed = false
  politState.animClockSec = 0
}

function pickScenariosForMode(mode: SovOsDuelTriggerMode): DuelScenario[] {
  if (mode === 'tutorial_drill') {
    return [...TUTORIAL_DRILL_SCENARIOS]
  }
  if (mode === 'voluntary') {
    return [...VOLUNTARY_SCENARIOS]
  }
  if (mode === 'impostor') {
    return [...IMPOSTOR_SCENARIOS]
  }
  if (mode === 'crisis') {
    const gs = useGameStore.getState()
    const prioritized: DuelScenario[] = []
    if (gs.az5Active) {
      prioritized.push(CRISIS_SCENARIOS[3])
    }
    if (gs.voidFraction >= 0.25) {
      prioritized.push(CRISIS_SCENARIOS[0])
    }
    if (gs.xenon >= 28) {
      prioritized.push(CRISIS_SCENARIOS[1])
    }
    for (const sc of CRISIS_SCENARIOS) {
      if (!prioritized.includes(sc)) prioritized.push(sc)
    }
    return prioritized.slice(0, 3)
  }
  // 'audit'
  return [...AUDIT_SCENARIOS]
}

export function startPolitLinkDuel(mode: SovOsDuelTriggerMode): void {
  const queue = pickScenariosForMode(mode)
  politState.active = true
  politState.mode = mode
  politState.roundIndex = 0
  politState.totalRounds = queue.length
  politState.trust =
    mode === 'impostor'
      ? 25
      : mode === 'tutorial_drill'
        ? 30
        : mode === 'voluntary'
          ? 35
          : 38
  politState.suspicion =
    mode === 'impostor' ? 20 : mode === 'tutorial_drill' ? 15 : 22
  politState.timeLeftSec =
    mode === 'tutorial_drill' || mode === 'voluntary'
      ? 0
      : mode === 'impostor'
        ? 60
        : 55
  politState.scenarioQueue = queue
  politState.lastOutcome = 'none'
  politState.drillFailed = false
  politState.lastExchange =
    mode === 'impostor'
      ? 'INTERCEPTED UPLINK [LANGLEY_NODE_04]: EXPOSE THE WESTERN IMPOSTOR!'
      : mode === 'tutorial_drill'
        ? 'TRAINING PROTOCOL: READ STANCE CLUE & PICK PATRIOTIC RESPONSE.'
        : mode === 'voluntary'
          ? 'VOLUNTARY LOYALTY CHECK OPENED. FLATTER K.O.M.R.A.D.-84.'
          : mode === 'crisis'
            ? 'CRISIS INTERROGATION! PROVE IDEOLOGICAL PURITY BEFORE TIMER EXPIRES!'
            : 'UNANNOUNCED PARTY AUDIT! ANSWER CAREFULLY, COMRADE.'

  useGameStore.getState().setIdeologyDuelActive(true)
}

function finishDuelVictory(): { requestFocusApp?: 'zashchita' } {
  const mode = politState.mode
  if (mode === 'impostor') {
    politState.active = false
    politState.mode = 'idle'
    politState.lastOutcome = 'win'
    politState.drillFailed = false
    politState.lastExchange =
      'COVER BLOWN! AGENT SMITH UNLEASHED SPY CAT GPS ON SECTOR 07 — PURGE IN ZASHCHITA-84!'
    useGameStore.getState().setIdeologyDuelActive(false)
    onImpostorExposedHandler?.()
    return { requestFocusApp: 'zashchita' }
  }

  const isDrill = mode === 'tutorial_drill'
  if (isDrill) {
    politState.drillPassed = true
  }
  politState.active = false
  politState.mode = 'idle'
  politState.lastOutcome = 'win'
  politState.drillFailed = false
  politState.lastExchange = isDrill
    ? 'DRILL CLEARED! PARTY APPROVAL GRANTED. PROCEED TO STEP 8 (ZASHCHITA-84).'
    : 'IDEOLOGICAL CLEARANCE CONFIRMED! PARTY APPROVAL IMMUNITY ACTIVE.'

  const rewardRub = isDrill ? 50 : mode === 'voluntary' ? 40 : 120
  const quotaPts = isDrill || mode === 'voluntary' ? 0 : 1
  const buffSec = isDrill ? 60 : mode === 'voluntary' ? 75 : 95
  useGameStore
    .getState()
    .applyKomradDuelVictory(rewardRub, quotaPts, buffSec, isDrill)
  return {}
}

function finishDuelFailure(reason: string): void {
  const isDrill = politState.mode === 'tutorial_drill'
  politState.active = false
  politState.lastOutcome = isDrill ? 'drill_mistake' : 'fail'
  politState.lastExchange = reason
  if (isDrill) {
    politState.drillFailed = true
    politState.mode = 'idle'
    useGameStore.getState().setIdeologyDuelActive(false)
    useGameStore.getState().applyKomradDuelFailure(0, true)
    return
  }
  politState.mode = 'idle'
  useGameStore.getState().applyKomradDuelFailure(75, false)
}

export function selectPolitLinkOption(optionId: 'A' | 'B' | 'C' | 'D'): {
  accepted: boolean
  outcome: 'continue' | 'win' | 'fail' | 'drill_mistake'
  reply: string
  requestFocusApp?: 'zashchita'
} {
  if (!politState.active) {
    return { accepted: false, outcome: 'continue', reply: politState.lastExchange }
  }
  const currentScenario = politState.scenarioQueue[politState.roundIndex]
  if (!currentScenario) {
    return { accepted: false, outcome: 'continue', reply: politState.lastExchange }
  }
  const opt = currentScenario.options.find((o) => o.id === optionId)
  if (!opt) {
    return { accepted: false, outcome: 'continue', reply: politState.lastExchange }
  }

  politState.trust = Math.max(0, Math.min(100, politState.trust + opt.trustDelta))
  politState.suspicion = Math.max(
    0,
    Math.min(100, politState.suspicion + opt.suspicionDelta)
  )
  politState.lastExchange = opt.komradReply

  if (politState.suspicion >= 85 || (politState.mode === 'tutorial_drill' && opt.suspicionDelta >= 40)) {
    finishDuelFailure(opt.komradReply)
    return {
      accepted: true,
      outcome: politState.lastOutcome === 'drill_mistake' ? 'drill_mistake' : 'fail',
      reply: opt.komradReply,
    }
  }

  if (politState.trust >= 80) {
    const winRes = finishDuelVictory()
    return {
      accepted: true,
      outcome: 'win',
      reply: opt.komradReply,
      requestFocusApp: winRes.requestFocusApp,
    }
  }

  const nextRound = politState.roundIndex + 1
  if (nextRound >= politState.totalRounds) {
    if (politState.trust >= 65 && politState.suspicion < 85) {
      const winRes = finishDuelVictory()
      return {
        accepted: true,
        outcome: 'win',
        reply: opt.komradReply,
        requestFocusApp: winRes.requestFocusApp,
      }
    }
    finishDuelFailure('INSUFFICIENT PARTY CONVICTION! K.O.M.R.A.D.-84 UNCONVINCED.')
    return {
      accepted: true,
      outcome: politState.lastOutcome === 'drill_mistake' ? 'drill_mistake' : 'fail',
      reply: opt.komradReply,
    }
  }

  politState.roundIndex = nextRound
  return { accepted: true, outcome: 'continue', reply: opt.komradReply }
}

export function tickPolitLink(dt: number): boolean {
  politState.animClockSec += dt
  if (!politState.active) return false
  if (politState.timeLeftSec > 0) {
    politState.timeLeftSec = Math.max(0, politState.timeLeftSec - dt)
    if (politState.timeLeftSec <= 0) {
      finishDuelFailure(
        'INTERROGATION TIMED OUT! SILENCE CONFESSES GUILT, COMRADE.'
      )
      return true
    }
  }
  return false
}
