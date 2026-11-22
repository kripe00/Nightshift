import { create } from 'zustand'
import type { SectorNodeId } from '../../shared/types'
import {
  registerMandateComplianceListener,
  useGameStore,
} from '../../shared/useGameStore'

// Expanded 3D Desk Coordinate System (Tabletop is 2.48m wide × 1.36m deep; Green Mat #1d2b26 is 2.28m × 1.20m)
export const PRINTER_TRAY_BOUNDARY_X_3D = -0.62
export const PRINTER_SLOT_X_3D = -0.82
export const PRINTER_SLIT_Z_3D = 0.28
export const PRINTER_FEED_STEPS = 12
export const PRINTER_FEED_STEP_M = 0.024 // 24mm per step
export const PRINTER_FEED_STEP_MS = 90

// Proportional 3D Paper Dimensions (~18% smaller so 3-4 directives fit side-by-side while keeping 512x640 texture clarity)
export const PAPER_EXPANDED_W_3D = 0.36
export const PAPER_EXPANDED_H_3D = 0.44
export const PAPER_COMPACT_W_3D = 0.22
export const PAPER_COMPACT_H_3D = 0.28

// Drop Zones in 3D Desk Local Coordinates (x, z)
// Carrier Cylinder (`CAPSULE`) Cradle on Back-Left of Desk Mat
export const CAPSULE_CRADLE_POS_3D = {
  x: -0.74,
  y: 0.926,
  z: -0.22,
} as const

// Outer-Left Side-Mounted Pneumatic Breech Station (`PNEUMO-TUBE // LAUNCH CHAMBER`) tucked cleanly onto the left wing bolster
export const OUTBOX_BREECH_POS_3D = {
  x: -1.395,
  y: 0.918,
  z: -0.535,
} as const

export const OUTBOX_POS_3D = CAPSULE_CRADLE_POS_3D

export const OUTBOX_DROP_ZONE_3D = {
  minX: -1.64,
  maxX: -0.44,
  minZ: -0.68,
  maxZ: 0.08,
}

export const BREECH_CHAMBER_DROP_ZONE_3D = {
  minX: -1.68,
  maxX: -1.02,
  minZ: -0.78,
  maxZ: -0.20,
}

export type PneumaticCapsuleState =
  | 'CRADLE_EMPTY'
  | 'CRADLE_PACKED'
  | 'CHAMBER_LOADED'
  | 'IN_FLIGHT'

export const SHREDDER_POS_3D = {
  x: 0.84,
  y: 0.962,
  z: -0.22,
  rotationY: -0.26,
} as const

export const SHREDDER_DROP_ZONE_3D = {
  minX: 0.62,
  maxX: 1.08,
  minZ: -0.44,
  maxZ: 0.04,
}

export const MANUAL_DEFAULT_POS_3D = {
  x: 0.56,
  z: 0.16,
} as const

export type StampType = 'APPROVED' | 'SHREDDED'

export type ManualPageId = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type ManualSectionId = 'KGB' | 'RBMK'

export interface DocumentStamp {
  id: string
  type: StampType
  /** Normalized 0..1 coordinates on the document surface */
  u: number
  v: number
}

export type DocumentFontType =
  | 'GOST_MONO'
  | 'PRAVDA_BLOCK'
  | 'WESTERN_SERIF'
  | 'SLANTED_ITALIC'
  | 'BOURGEOIS_SANS'

export type SealEmblemType =
  | 'USSR_STATE_SEAL'
  | 'MINSREDMASH_ATOM'
  | 'KGB_SWORD_SHIELD'

export type SealMicroDefect =
  | 'NONE'
  | 'SIX_POINT_STAR'
  | 'FOUR_POINT_STAR'
  | 'LATIN_RING_TEXT'
  | 'BROKEN_ORBIT'

export type PaperStockColor =
  | 'STATE_IVORY'
  | 'BUNKER_GREY'
  | 'BLEACHED_WHITE'
  | 'YELLOW_PARCHMENT'

export type OfficialInkColor =
  | 'SOVIET_CRIMSON'
  | 'BUNKER_OLIVE'
  | 'PRAVDA_BLACK'
  | 'IMPERIAL_PURPLE'
  | 'CIA_NAVY_BLUE'

export const PAPER_COLOR_HEX: Record<PaperStockColor, string> = {
  STATE_IVORY: '#d8d2c0',
  BUNKER_GREY: '#bfc4be',
  BLEACHED_WHITE: '#f4f4f6',
  YELLOW_PARCHMENT: '#e6d8ad',
}

export const INK_COLOR_HEX: Record<OfficialInkColor, string> = {
  SOVIET_CRIMSON: '#8b1e1e',
  BUNKER_OLIVE: '#2d4c2b',
  PRAVDA_BLACK: '#1a1a1a',
  IMPERIAL_PURPLE: '#5b237a',
  CIA_NAVY_BLUE: '#1b3d82',
}

export type DocumentStatus = 'printing' | 'desk' | 'loaded_in_shredder'

export interface DeskDocument {
  id: string
  status: DocumentStatus
  title: string
  content: string
  secretWatermark: string
  referenceCode: string
  dateString: string
  signature: string
  ministry: string
  fontType: DocumentFontType
  sealType: SealEmblemType
  sealMicroDefect: SealMicroDefect
  paperColor: PaperStockColor
  inkColor: OfficialInkColor
  isForgery: boolean
  forgeryReason: string | null
  powerOrderText: string
  powerTargets: {
    cityMW: number
    defenseMW: number
    vodkaMW: number
    pripyat: number
    kolkhoz: number
    duga: number
    kgb: number
    vodka: number
    steel: number
  }
  /** 3D local X on desk surface (-1.10 to +1.10) */
  x: number
  /** 3D local Z on desk surface (-0.54 to +0.54) */
  z: number
  isExpanded: boolean
  stamps: DocumentStamp[]
  shredProgress: number
}

export interface InspectionVerdict {
  docId: string
  docTitle: string
  decision: StampType
  correct: boolean
  reason: string
  pending?: boolean
}

interface DeskStoreState {
  documents: DeskDocument[]
  printingDoc: DeskDocument | null
  nextTemplateIndex: number
  nextPrintReadyAtMs: number
  directiveCooldown: number
  commendations: number
  citations: number
  lastVerdict: InspectionVerdict | null
  capsuleState: PneumaticCapsuleState
  hatchOpen: boolean
  packedDoc: DeskDocument | null
  manualDefaultPos: { x: number; z: number }
  bringToFront: (id: string) => void
  updateDocumentPosition: (
    id: string,
    x: number,
    z: number,
    isExpanded: boolean
  ) => void
  addStampToDocument: (docId: string, stamp: DocumentStamp) => void
  spawnNextDirective: () => DeskDocument | null
  forcePrintNextDirective: () => DeskDocument | null
  tickPrinterQueue: (dtSeconds?: number) => void
  completePrintingDoc: (x?: number, z?: number) => DeskDocument | null
  loadDocumentIntoShredder: (id: string) => boolean
  advanceShredProgress: (id: string, amount: number) => number
  evaluateShreddedDocument: (id: string) => void
  packDocumentIntoCapsule: (docId?: string) => boolean
  toggleBreechHatch: (forceOpen?: boolean) => boolean
  loadCapsuleIntoChamber: () => boolean
  launchPneumaticCapsule: () => boolean
  completePneumaticLaunch: () => void
  dispatchDocumentToOutbox: (id: string) => boolean
  rejectUnstampedOutboxAttempt: (docId?: string) => void
  recordMandateComplianceOutcome: (
    fulfilled: boolean,
    mandateId: string,
    reason: string
  ) => void
  resetDeskStore: () => void
}

const SECTOR_ORDER_SPECS: Record<
  SectorNodeId,
  {
    bracketLabel: string
    ruTopic: string
    candidateMWs: number[]
    forgedCandidateMWs: number[]
  }
> = {
  pripyat: {
    bracketLabel: '1. PRIPYAT CITY',
    ruTopic: 'PRIPYAT CITY',
    candidateMWs: [150, 200, 50, 175, 125],
    forgedCandidateMWs: [225, 25, 250],
  },
  duga: {
    bracketLabel: '2. DUGA-1 RADAR',
    ruTopic: 'DUGA-1 RADAR',
    candidateMWs: [175, 200, 50, 150, 225],
    forgedCandidateMWs: [250, 25, 225],
  },
  kolkhoz: {
    bracketLabel: '3. KOLKHOZ FARM',
    ruTopic: 'KOLKHOZ ZARYA',
    candidateMWs: [150, 50, 175, 125, 200],
    forgedCandidateMWs: [225, 25, 250],
  },
  kgb: {
    bracketLabel: '4. KGB BUNKER 07',
    ruTopic: 'KGB BUNKER 07',
    candidateMWs: [150, 50, 175, 125, 200],
    forgedCandidateMWs: [225, 25, 250],
  },
  vodka: {
    bracketLabel: '5. VODKA PLANT',
    ruTopic: 'RED OCTOBER',
    candidateMWs: [175, 150, 200, 50, 125],
    forgedCandidateMWs: [250, 25, 225],
  },
  steel: {
    bracketLabel: '6. STEEL WORKS',
    ruTopic: 'STEEL WORKS #4',
    candidateMWs: [175, 50, 200, 150, 125],
    forgedCandidateMWs: [250, 25, 225],
  },
}

interface SingleTargetDirectiveBlueprint {
  titlePrefix: string
  targetSector: SectorNodeId
  preferredMW: number
  ministry: string
  referenceCode: string
  dateString: string
  rationaleText: string
  secretWatermark: string
  signature: string
  fontType: DocumentFontType
  sealType: SealEmblemType
  sealMicroDefect: SealMicroDefect
  paperColor: PaperStockColor
  inkColor: OfficialInkColor
  isForgery: boolean
  forgeryReason: string | null
}

const SINGLE_TARGET_BLUEPRINTS: SingleTargetDirectiveBlueprint[] = [
  // 1. VALID: MinSredMash + GOST_MONO + MINSREDMASH_ATOM (NONE) + STATE_IVORY + SOVIET_CRIMSON -> Single Target: 5. VODKA PLANT (SURGE TO 175 MW)
  {
    titlePrefix: 'DIRECTIVE 44-A',
    targetSector: 'vodka',
    preferredMW: 175,
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'GOST-84-42-MSM',
    dateString: '04.11.1984',
    rationaleText: 'STATE BOTTLING SURGE: RAISE RODS & TURBINE FOR +75 MW',
    secretWatermark: 'USSR • GOST STANDARD • 1984',
    signature: 'E. P. SLAVSKY',
    fontType: 'GOST_MONO',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'NONE',
    paperColor: 'STATE_IVORY',
    inkColor: 'SOVIET_CRIMSON',
    isForgery: false,
    forgeryReason: null,
  },
  // 2. FORGERY (Page 1 Seal Micro-Print Defect): 6-point star + LANGLEY-FAKE micro-ring! -> Single Target: 3. DUGA-1 RADAR
  {
    titlePrefix: 'DIRECTIVE 44-Z',
    targetSector: 'duga',
    preferredMW: 250,
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'GOST-84-38-MSM',
    dateString: '04.11.1984',
    rationaleText: 'OVER-HORIZON RADAR SURGE TEST',
    secretWatermark: 'LANGLEY-FAKE • SERIES-6',
    signature: 'B. E. SHCHERBINA',
    fontType: 'GOST_MONO',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'SIX_POINT_STAR',
    paperColor: 'STATE_IVORY',
    inkColor: 'SOVIET_CRIMSON',
    isForgery: true,
    forgeryReason:
      'Forged Seal Micro-Print (6-Point Star & LANGLEY-FAKE Micro-Ring)',
  },
  // 3. VALID: State Committee for Atomic Energy + PRAVDA_BLOCK + MINSREDMASH_ATOM (NONE) + BUNKER_GREY + BUNKER_OLIVE -> Single Target: 3. DUGA-1 RADAR (SURGE TO 200 MW)
  {
    titlePrefix: 'DIRECTIVE 19-B',
    targetSector: 'duga',
    preferredMW: 200,
    ministry: 'STATE COMMITTEE FOR ATOMIC ENERGY',
    referenceCode: 'GOST-84-68-GKAE',
    dateString: '04.11.1984',
    rationaleText: 'IONOSPHERE SWEEP SURGE: BOOST REACTOR & TURBINE OUTPUT',
    secretWatermark: 'USSR • GOST STANDARD • 1984',
    signature: 'ACAD. V. LEGASOV',
    fontType: 'PRAVDA_BLOCK',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'NONE',
    paperColor: 'BUNKER_GREY',
    inkColor: 'BUNKER_OLIVE',
    isForgery: false,
    forgeryReason: null,
  },
  // 4. FORGERY (Page 2 Font Violation): Uses Forbidden Western Serif font -> Single Target: 1. PRIPYAT CITY
  {
    titlePrefix: 'DIRECTIVE 88-C',
    targetSector: 'pripyat',
    preferredMW: 225,
    ministry: 'COUNCIL OF MINISTERS USSR',
    referenceCode: 'GOST-84-20-SM',
    dateString: '04.11.1984',
    rationaleText: 'UNSCHEDULED MUNICIPAL FLOODLIGHT SURGE ORDER',
    secretWatermark: 'USSR • GOST STANDARD • 1984',
    signature: 'N. A. TIKHONOV',
    fontType: 'WESTERN_SERIF',
    sealType: 'USSR_STATE_SEAL',
    sealMicroDefect: 'NONE',
    paperColor: 'STATE_IVORY',
    inkColor: 'PRAVDA_BLACK',
    isForgery: true,
    forgeryReason: 'Unauthorized Western Serif Typography (Page 2 Violation)',
  },
  // 5. VALID: Council of Ministers + GOST_MONO + USSR_STATE_SEAL (NONE) + STATE_IVORY + PRAVDA_BLACK -> Single Target: 1. PRIPYAT CITY (SURGE TO 175 MW)
  {
    titlePrefix: 'DIRECTIVE 61-M',
    targetSector: 'pripyat',
    preferredMW: 175,
    ministry: 'COUNCIL OF MINISTERS USSR',
    referenceCode: 'GOST-84-48-SM',
    dateString: '04.11.1984',
    rationaleText: 'WINTER HEATING SURGE: RAISE CORE RODS & TURBINE VALVE',
    secretWatermark: 'USSR • GOST STANDARD • 1984',
    signature: 'N. A. TIKHONOV',
    fontType: 'GOST_MONO',
    sealType: 'USSR_STATE_SEAL',
    sealMicroDefect: 'NONE',
    paperColor: 'STATE_IVORY',
    inkColor: 'PRAVDA_BLACK',
    isForgery: false,
    forgeryReason: null,
  },
  // 6. FORGERY (Page 3 Colour Violation): Council of Ministers using CIA Navy Blue Ink on Bleached Western White Paper -> Single Target: 6. STEEL WORKS
  {
    titlePrefix: 'DIRECTIVE 52-V',
    targetSector: 'steel',
    preferredMW: 250,
    ministry: 'COUNCIL OF MINISTERS USSR',
    referenceCode: 'GOST-84-54-SM',
    dateString: '04.11.1984',
    rationaleText: 'DIVERT MAXIMUM FURNACE BUS LOAD',
    secretWatermark: 'USSR • GOST STANDARD • 1984',
    signature: 'V. I. DOLGIKH',
    fontType: 'GOST_MONO',
    sealType: 'USSR_STATE_SEAL',
    sealMicroDefect: 'NONE',
    paperColor: 'BLEACHED_WHITE',
    inkColor: 'CIA_NAVY_BLUE',
    isForgery: true,
    forgeryReason:
      'Forbidden CIA Navy Blue Ink & Bleached Western White Paper (#f4f4f6)',
  },
  // 7. VALID: 5th Chief Directorate + GOST_MONO + KGB_SWORD_SHIELD (NONE) + STATE_IVORY + SOVIET_CRIMSON -> Single Target: 4. KGB BUNKER 07 (SURGE TO 150 MW)
  {
    titlePrefix: 'DIRECTIVE 71-K',
    targetSector: 'kgb',
    preferredMW: 150,
    ministry: '5TH CHIEF DIRECTORATE',
    referenceCode: 'GOST-84-14-KGB',
    dateString: '04.11.1984',
    rationaleText: 'CLASSIFIED TELEMETRY DECRYPTION SWEEP (+50 MW)',
    secretWatermark: 'USSR • GOST STANDARD • 1984',
    signature: 'COMMISSAR VOLKOV',
    fontType: 'GOST_MONO',
    sealType: 'KGB_SWORD_SHIELD',
    sealMicroDefect: 'NONE',
    paperColor: 'STATE_IVORY',
    inkColor: 'SOVIET_CRIMSON',
    isForgery: false,
    forgeryReason: null,
  },
  // 8. FORGERY (Page 1 Seal Micro-Defect + Page 3 Ink Mismatch): Broken atomic orbit & Imperial Purple ink -> Single Target: 5. VODKA PLANT
  {
    titlePrefix: 'DIRECTIVE 93-F',
    targetSector: 'vodka',
    preferredMW: 225,
    ministry: 'STATE COMMITTEE FOR ATOMIC ENERGY',
    referenceCode: 'GOST-84-76-GKAE',
    dateString: '04.11.1984',
    rationaleText: 'MIDNIGHT DISTILLERY VAT OVERLOAD ORDER',
    secretWatermark: 'LANGLEY-FAKE • ORBIT-ERR',
    signature: 'A. M. PETROSYANTS',
    fontType: 'GOST_MONO',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'BROKEN_ORBIT',
    paperColor: 'YELLOW_PARCHMENT',
    inkColor: 'IMPERIAL_PURPLE',
    isForgery: true,
    forgeryReason:
      'Forbidden Imperial Purple Ink, Yellowed Parchment & Broken Seal Orbit',
  },
  // 9. VALID: MinSredMash + GOST_MONO + MINSREDMASH_ATOM (NONE) + STATE_IVORY + SOVIET_CRIMSON -> Single Target: 2. KOLKHOZ FARM (LOAD SHEDDING TO 50 MW)
  {
    titlePrefix: 'DIRECTIVE 32-S',
    targetSector: 'kolkhoz',
    preferredMW: 50,
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'GOST-84-24-MSM',
    dateString: '04.11.1984',
    rationaleText: 'LOAD SHEDDING: THROTTLE DOWN TURBINE OR DUMP STEAM',
    secretWatermark: 'USSR • GOST STANDARD • 1984',
    signature: 'E. P. SLAVSKY',
    fontType: 'GOST_MONO',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'NONE',
    paperColor: 'STATE_IVORY',
    inkColor: 'SOVIET_CRIMSON',
    isForgery: false,
    forgeryReason: null,
  },
  // 10. FORGERY (Page 2 Unauthorized Ministry + Slanted Italic Font) -> Single Target: 2. KOLKHOZ FARM
  {
    titlePrefix: 'DIRECTIVE 64-D',
    targetSector: 'kolkhoz',
    preferredMW: 225,
    ministry: 'MINISTRY OF ATOMIC FREEDOM',
    referenceCode: 'GOST-84-82-MAF',
    dateString: '04.11.1984',
    rationaleText: 'OVERLOAD RURAL TRANSFORMER BANK NOW',
    secretWatermark: 'LANGLEY-FAKE • USA-84',
    signature: 'J. SMITH',
    fontType: 'SLANTED_ITALIC',
    sealType: 'USSR_STATE_SEAL',
    sealMicroDefect: 'LATIN_RING_TEXT',
    paperColor: 'STATE_IVORY',
    inkColor: 'SOVIET_CRIMSON',
    isForgery: true,
    forgeryReason:
      'Unauthorized Ministry ("Ministry of Atomic Freedom") & Slanted Italic Font',
  },
  // 11. VALID: State Committee for Atomic Energy + PRAVDA_BLOCK + MINSREDMASH_ATOM (NONE) + BUNKER_GREY + BUNKER_OLIVE -> Single Target: 6. STEEL WORKS (SURGE TO 200 MW)
  {
    titlePrefix: 'DIRECTIVE 80-P',
    targetSector: 'steel',
    preferredMW: 200,
    ministry: 'STATE COMMITTEE FOR ATOMIC ENERGY',
    referenceCode: 'GOST-84-62-GKAE',
    dateString: '04.11.1984',
    rationaleText: 'ELECTRIC ARC FURNACE SURGE (+100 MW FULL PLANT LOAD)',
    secretWatermark: 'USSR • GOST STANDARD • 1984',
    signature: 'ACAD. V. LEGASOV',
    fontType: 'PRAVDA_BLOCK',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'NONE',
    paperColor: 'BUNKER_GREY',
    inkColor: 'BUNKER_OLIVE',
    isForgery: false,
    forgeryReason: null,
  },
]

/**
 * Master toggle for KGB / CIA forged directives.
 * Set to `false` to force 100% genuine Ministry power orders (`isForgery: false`)
 * while testing and tuning the RBMK-1000 thermodynamic & grid control loop.
 */
export const ENABLE_FORGERIES = false

let docSequence = 1

function buildSingleTargetDeskDocument(
  rawBlueprint: SingleTargetDirectiveBlueprint,
  seqNum: number
): DeskDocument {
  const blueprint: SingleTargetDirectiveBlueprint =
    ENABLE_FORGERIES || !rawBlueprint.isForgery
      ? rawBlueprint
      : {
          ...rawBlueprint,
          ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
          secretWatermark: 'USSR • GOST STANDARD • 1984',
          fontType: 'GOST_MONO',
          sealType: 'MINSREDMASH_ATOM',
          sealMicroDefect: 'NONE',
          paperColor: 'STATE_IVORY',
          inkColor: 'SOVIET_CRIMSON',
          isForgery: false,
          forgeryReason: null,
        }

  const currentTargets = useGameStore.getState().targetSectorMW
  const sector = blueprint.targetSector
  const spec = SECTOR_ORDER_SPECS[sector]
  const curMW = currentTargets[sector]

  // Pick a target MW (clean multiple of 25 MW between 25 and 250 MW) that differs from curMW
  const candidates =
    ENABLE_FORGERIES && blueprint.isForgery
      ? spec.forgedCandidateMWs
      : spec.candidateMWs
  let nextMW = blueprint.preferredMW
  if (nextMW === curMW || nextMW < 25 || nextMW > 250 || nextMW % 25 !== 0) {
    nextMW =
      candidates.find((c) => c !== curMW && c >= 25 && c <= 250 && c % 25 === 0) ??
      (curMW >= 150 ? curMW - 75 : curMW + 75)
  }
  nextMW = Math.max(25, Math.min(250, Math.round(nextMW / 25) * 25))
  if (nextMW === curMW) {
    nextMW = curMW <= 125 ? curMW + 50 : curMW - 50
  }

  const delta = nextMW - curMW
  const signStr = delta >= 0 ? `+${delta} MW` : `${delta} MW`
  const verb =
    delta > 0
      ? seqNum % 2 === 0
        ? 'SURGE'
        : 'INCREASE'
      : 'SHED'
  const powerOrderText = `${verb} [${spec.bracketLabel}] TO ${nextMW} MW (${signStr})`

  const nextTargets: Record<SectorNodeId, number> = {
    ...currentTargets,
    [sector]: nextMW,
  }

  return {
    id: `DOC-1984-${String(seqNum).padStart(3, '0')}`,
    status: 'printing',
    title: `${blueprint.titlePrefix} // ${spec.ruTopic}`,
    ministry: blueprint.ministry,
    referenceCode: blueprint.referenceCode,
    dateString: blueprint.dateString,
    content: blueprint.rationaleText,
    powerOrderText,
    powerTargets: {
      cityMW: nextTargets.pripyat + nextTargets.kolkhoz,
      defenseMW: nextTargets.duga + nextTargets.kgb,
      vodkaMW: nextTargets.vodka + nextTargets.steel,
      ...nextTargets,
    },
    secretWatermark: blueprint.secretWatermark,
    signature: blueprint.signature,
    fontType: blueprint.fontType,
    sealType: blueprint.sealType,
    sealMicroDefect: blueprint.sealMicroDefect,
    paperColor: blueprint.paperColor,
    inkColor: blueprint.inkColor,
    isForgery: blueprint.isForgery,
    forgeryReason: blueprint.forgeryReason,
    x: PRINTER_SLOT_X_3D,
    z: PRINTER_SLIT_Z_3D - 0.08,
    isExpanded: false,
    stamps: [],
    shredProgress: 0,
  }
}

function buildTutorialDrillStep1Document(): DeskDocument {
  const currentTargets = useGameStore.getState().targetSectorMW
  const nextTargets: Record<SectorNodeId, number> = {
    ...currentTargets,
    vodka: 150,
  }
  const powerOrderText = 'SURGE [5. VODKA PLANT] TO 150 MW (+50 MW)'
  return {
    id: 'DRILL-00-1',
    status: 'printing',
    title: 'DRILL ORDER 00-1 // RED OCTOBER',
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'GOST-84-01-MSM',
    dateString: '04.11.1984',
    content: 'DRILL 1: STAMP GREEN APPROVED',
    powerOrderText,
    powerTargets: {
      cityMW: nextTargets.pripyat + nextTargets.kolkhoz,
      defenseMW: nextTargets.duga + nextTargets.kgb,
      vodkaMW: nextTargets.vodka + nextTargets.steel,
      ...nextTargets,
    },
    secretWatermark: 'USSR • GOST STANDARD • 1984',
    signature: 'E. P. SLAVSKY',
    fontType: 'GOST_MONO',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'NONE',
    paperColor: 'STATE_IVORY',
    inkColor: 'SOVIET_CRIMSON',
    isForgery: false,
    forgeryReason: null,
    x: PRINTER_SLOT_X_3D,
    z: PRINTER_SLIT_Z_3D - 0.08,
    isExpanded: false,
    stamps: [],
    shredProgress: 0,
  }
}

function buildTutorialDrillStep5Document(): DeskDocument {
  const currentTargets = useGameStore.getState().targetSectorMW
  const nextTargets: Record<SectorNodeId, number> = {
    ...currentTargets,
    duga: ENABLE_FORGERIES ? 225 : 175,
  }
  const powerOrderText = ENABLE_FORGERIES
    ? 'SURGE [3. DUGA-1 RADAR] TO 225 MW (+125 MW)'
    : 'SURGE [3. DUGA-1 RADAR] TO 175 MW (+75 MW)'
  return {
    id: 'DRILL-00-2',
    status: 'printing',
    title: 'DRILL ORDER 00-2 // DUGA-1 RADAR',
    ministry: ENABLE_FORGERIES
      ? 'MINISTRY OF ENERGY AND ELECTRIFICATION'
      : 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'GOST-84-09-MEE',
    dateString: '04.11.1984',
    content: ENABLE_FORGERIES
      ? 'DRILL 5: FAKE SEAL SHRED'
      : 'DRILL 5: STAMP GREEN APPROVED',
    powerOrderText,
    powerTargets: {
      cityMW: nextTargets.pripyat + nextTargets.kolkhoz,
      defenseMW: nextTargets.duga + nextTargets.kgb,
      vodkaMW: nextTargets.vodka + nextTargets.steel,
      ...nextTargets,
    },
    secretWatermark: ENABLE_FORGERIES
      ? 'LANGLEY-CIA • MKULTRA-84'
      : 'USSR • GOST STANDARD • 1984',
    signature: 'GEN. V. FEDORCHUK',
    fontType: 'GOST_MONO',
    sealType: ENABLE_FORGERIES ? 'USSR_STATE_SEAL' : 'MINSREDMASH_ATOM',
    sealMicroDefect: ENABLE_FORGERIES ? 'FOUR_POINT_STAR' : 'NONE',
    paperColor: 'STATE_IVORY',
    inkColor: ENABLE_FORGERIES ? 'CIA_NAVY_BLUE' : 'SOVIET_CRIMSON',
    isForgery: ENABLE_FORGERIES,
    forgeryReason: ENABLE_FORGERIES
      ? '4-Point NATO Star in State Seal & Forbidden CIA Navy-Blue Ink'
      : null,
    x: PRINTER_SLOT_X_3D,
    z: PRINTER_SLIT_Z_3D - 0.08,
    isExpanded: false,
    stamps: [],
    shredProgress: 0,
  }
}

function syncDecisionWithSharedStore(
  docTitle: string,
  isForgery: boolean,
  decision: StampType,
  forgeryReason: string | null,
  powerTargets?: {
    cityMW: number
    defenseMW: number
    vodkaMW: number
    pripyat: number
    kolkhoz: number
    duga: number
    kgb: number
    vodka: number
    steel: number
  }
): void {
  useGameStore
    .getState()
    .executeDeskDirectiveEffect(
      docTitle,
      isForgery,
      decision,
      forgeryReason,
      powerTargets
    )
}

let lastObservedShiftRunId = -1
let lastObservedTutorialStep: string | number = 1

export const useDeskStore = create<DeskStoreState>((set, get) => ({
  documents: [],
  printingDoc: null,
  nextTemplateIndex: 0,
  nextPrintReadyAtMs: Date.now() + 3500,
  directiveCooldown: 3.5,
  commendations: 0,
  citations: 0,
  lastVerdict: null,
  capsuleState: 'CRADLE_EMPTY',
  hatchOpen: false,
  packedDoc: null,
  manualDefaultPos: { ...MANUAL_DEFAULT_POS_3D },

  resetDeskStore: () => {
    docSequence = 1
    set({
      documents: [],
      printingDoc: null,
      nextTemplateIndex: 0,
      nextPrintReadyAtMs: Date.now() + 3500,
      directiveCooldown: 3.5,
      commendations: 0,
      citations: 0,
      lastVerdict: null,
      capsuleState: 'CRADLE_EMPTY',
      hatchOpen: false,
      packedDoc: null,
      manualDefaultPos: { ...MANUAL_DEFAULT_POS_3D },
    })
  },

  bringToFront: (id: string) =>
    set((state) => {
      const idx = state.documents.findIndex((d) => d.id === id)
      if (idx === -1 || idx === state.documents.length - 1) return state
      const target = state.documents[idx]
      return {
        documents: [
          ...state.documents.slice(0, idx),
          ...state.documents.slice(idx + 1),
          target,
        ],
      }
    }),

  updateDocumentPosition: (
    id: string,
    x: number,
    z: number,
    isExpanded: boolean
  ) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, x, z, isExpanded } : doc
      ),
    })),

  addStampToDocument: (docId: string, stamp: DocumentStamp) =>
    set((state) => {
      const targetDoc = state.documents.find((d) => d.id === docId)
      if (!targetDoc) return state

      const verdict: InspectionVerdict = {
        docId,
        docTitle: targetDoc.title,
        decision: stamp.type,
        correct: true,
        pending: true,
        reason:
          stamp.type === 'APPROVED'
            ? 'STAMPED APPROVED — STEP 1: PACK PAPER INTO CARRIER CAPSULE!'
            : 'STAMPED SHREDDED — DROP IN SHREDDER-84 JAWS & PULL LEVER',
      }

      return {
        documents: state.documents.map((doc) =>
          doc.id === docId
            ? { ...doc, stamps: [...doc.stamps, stamp] }
            : doc
        ),
        lastVerdict: verdict,
      }
    }),

  completePrintingDoc: (x?: number, z?: number) => {
    const currentPrinting = get().printingDoc
    if (!currentPrinting) return null

    const finalX = x ?? PRINTER_SLOT_X_3D
    const finalZ = z ?? currentPrinting.z
    const isExpanded = finalX > PRINTER_TRAY_BOUNDARY_X_3D

    const readyDoc: DeskDocument = {
      ...currentPrinting,
      status: 'desk',
      x: finalX,
      z: finalZ,
      isExpanded,
    }

    set((state) => ({
      printingDoc: null,
      documents: [...state.documents, readyDoc],
    }))

    return readyDoc
  },

  spawnNextDirective: () => {
    const state = get()
    // Strictly Maximum 1 Active Paper at a Time: NEVER print while a paper is in the printer carriage, sitting on the desk, or packed inside the pneumatic capsule!
    const hasActivePaper =
      state.printingDoc !== null ||
      state.documents.length > 0 ||
      state.packedDoc !== null ||
      state.capsuleState !== 'CRADLE_EMPTY'
    if (hasActivePaper) {
      return state.printingDoc
    }

    const blueprint =
      SINGLE_TARGET_BLUEPRINTS[
        state.nextTemplateIndex % SINGLE_TARGET_BLUEPRINTS.length
      ]
    const newDoc = buildSingleTargetDeskDocument(blueprint, docSequence++)
    set({
      printingDoc: newDoc,
      directiveCooldown: 30.0,
      nextPrintReadyAtMs: Date.now() + 30000,
      nextTemplateIndex:
        (state.nextTemplateIndex + 1) % SINGLE_TARGET_BLUEPRINTS.length,
    })
    useGameStore
      .getState()
      .notifyPrinterDirectiveSpawned(
        newDoc.title,
        newDoc.isForgery,
        newDoc.powerTargets
      )
    return newDoc
  },

  forcePrintNextDirective: () => {
    const state = get()
    const hasActivePaper =
      state.printingDoc !== null ||
      state.documents.length > 0 ||
      state.packedDoc !== null ||
      state.capsuleState !== 'CRADLE_EMPTY'
    if (hasActivePaper) {
      return state.printingDoc
    }
    const tutStep = useGameStore.getState().tutorialStep
    if (tutStep === 1) {
      const drill1 = buildTutorialDrillStep1Document()
      set({
        printingDoc: drill1,
        directiveCooldown: 22.0,
        nextPrintReadyAtMs: Date.now() + 22000,
      })
      return drill1
    }
    if (tutStep === 5) {
      const drill5 = buildTutorialDrillStep5Document()
      set({
        printingDoc: drill5,
        directiveCooldown: 3.0,
        nextPrintReadyAtMs: Date.now() + 3000,
      })
      return drill5
    }
    if (tutStep !== 'DONE') {
      return null
    }
    set({ directiveCooldown: 0, nextPrintReadyAtMs: Date.now() })
    return get().spawnNextDirective()
  },

  tickPrinterQueue: (dtSeconds = 0.25) => {
    const gameState = useGameStore.getState()
    if (gameState.phase !== 'playing') {
      return
    }

    const dt = Math.min(1.0, Math.max(0.001, dtSeconds))

    // Detect fresh shift start or shift reset -> reset queue and set first print to 3.5 real seconds!
    if (gameState.shiftRunId !== lastObservedShiftRunId) {
      lastObservedShiftRunId = gameState.shiftRunId
      lastObservedTutorialStep = gameState.tutorialStep
      docSequence = 1
      set({
        documents: [],
        printingDoc: null,
        packedDoc: null,
        capsuleState: 'CRADLE_EMPTY',
        hatchOpen: false,
        manualDefaultPos: { ...MANUAL_DEFAULT_POS_3D },
        directiveCooldown: 3.5,
        nextPrintReadyAtMs: Date.now() + 3500,
      })
      return
    }

    const tutorialStep = gameState.tutorialStep
    const state = get()

    // Detect transition into Step 5 -> print DRILL ORDER 00-2 within 0.3s
    if (lastObservedTutorialStep !== 5 && tutorialStep === 5) {
      lastObservedTutorialStep = 5
      set({
        directiveCooldown: 0.25,
        nextPrintReadyAtMs: Date.now() + 250,
      })
      return
    }

    // Detect transition to 'DONE' (via [BACKSPACE] skip or completing Step 5) -> clear any leftover DRILL- paper and spawn live order in 3.0s!
    if (lastObservedTutorialStep !== 'DONE' && tutorialStep === 'DONE') {
      lastObservedTutorialStep = 'DONE'
      const filteredDocs = state.documents.filter(
        (d) => !d.id.startsWith('DRILL-')
      )
      const keepPrinting =
        state.printingDoc && !state.printingDoc.id.startsWith('DRILL-')
          ? state.printingDoc
          : null
      const keepPacked =
        state.packedDoc && !state.packedDoc.id.startsWith('DRILL-')
          ? state.packedDoc
          : null
      set({
        printingDoc: keepPrinting,
        documents: filteredDocs,
        packedDoc: keepPacked,
        capsuleState: keepPacked ? state.capsuleState : 'CRADLE_EMPTY',
        hatchOpen: keepPacked ? state.hatchOpen : false,
        directiveCooldown: 3.0,
        nextPrintReadyAtMs: Date.now() + 3000,
      })
      return
    }
    lastObservedTutorialStep = tutorialStep

    const hasActivePaper =
      state.printingDoc !== null ||
      state.documents.length > 0 ||
      state.packedDoc !== null ||
      state.capsuleState !== 'CRADLE_EMPTY'

    if (hasActivePaper) {
      return
    }

    // Pause automatic directive printing during the 8-step Cold Start & Hazard Drill (`tutorialStep !== 'DONE'`)
    // so the first live Moscow directive prints 3 seconds after Comrade Volkov hands over the shift!
    if (tutorialStep !== 'DONE') {
      return
    }

    const nextCooldown = Math.max(0, state.directiveCooldown - dt)
    if (nextCooldown > 0) {
      set({ directiveCooldown: nextCooldown })
      return
    }

    get().spawnNextDirective()
  },

  loadDocumentIntoShredder: (id: string) => {
    const state = get()
    const target = state.documents.find((d) => d.id === id)
    if (!target || target.status !== 'desk') return false

    const tutorialStep = useGameStore.getState().tutorialStep
    if (tutorialStep === 1) {
      set({
        lastVerdict: {
          docId: target.id,
          docTitle: target.title,
          decision: 'APPROVED',
          correct: false,
          pending: true,
          reason:
            'DRILL 1/5: THIS ORDER IS GENUINE! STAMP GREEN [APPROVED] & PACK IN LEFT CAPSULE!',
        },
      })
      return false
    }

    set((prev) => ({
      documents: prev.documents.map((doc) => {
        if (doc.id === id) {
          return {
            ...doc,
            status: 'loaded_in_shredder' as const,
            shredProgress: 0,
            isExpanded: false,
          }
        }
        if (doc.status === 'loaded_in_shredder') {
          return {
            ...doc,
            status: 'desk' as const,
            x: 0.04,
            z: 0.22,
            isExpanded: true,
            shredProgress: 0,
          }
        }
        return doc
      }),
    }))
    return true
  },

  advanceShredProgress: (id: string, amount: number) => {
    const target = get().documents.find((d) => d.id === id)
    if (!target || target.status !== 'loaded_in_shredder') return 0
    const next = Math.min(
      100,
      Math.max(0, Math.round(target.shredProgress + amount))
    )
    set((prev) => ({
      documents: prev.documents.map((doc) =>
        doc.id === id ? { ...doc, shredProgress: next } : doc
      ),
    }))
    return next
  },

  evaluateShreddedDocument: (id: string) => {
    const state = get()
    const doc = state.documents.find((d) => d.id === id)
    if (!doc) return

    const correct = doc.isForgery
    syncDecisionWithSharedStore(
      doc.title,
      doc.isForgery,
      'SHREDDED',
      doc.forgeryReason
    )

    const isDrillCompletion = doc.id.startsWith('DRILL-')
    const cooldownSec = isDrillCompletion ? 3.0 : 22.0
    set({
      documents: [],
      printingDoc: null,
      packedDoc: null,
      capsuleState: 'CRADLE_EMPTY',
      hatchOpen: false,
      directiveCooldown: cooldownSec,
      nextPrintReadyAtMs: Date.now() + cooldownSec * 1000,
      commendations: correct ? state.commendations + 1 : state.commendations,
      citations: correct ? state.citations : state.citations + 1,
      lastVerdict: {
        docId: id,
        docTitle: doc.title,
        decision: 'SHREDDED',
        correct,
        reason: correct
          ? `FORGERY SHREDDED (-15% INSTAB, -35C CORE, -45C GRAPHITE): ${doc.forgeryReason}`
          : 'SECURITY BREACH: Valid Directive Shredded (+18% INSTABILITY)!',
      },
    })
  },

  packDocumentIntoCapsule: (docId?: string) => {
    const state = get()
    if (state.capsuleState !== 'CRADLE_EMPTY' || state.packedDoc !== null) {
      set({
        lastVerdict: {
          docId: state.packedDoc?.id ?? 'CAPSULE-BUSY',
          docTitle: state.packedDoc?.title ?? 'CAPSULE // CARRIER CYLINDER',
          decision: 'APPROVED',
          correct: true,
          pending: true,
          reason: state.hatchOpen
            ? 'CAPSULE ALREADY PACKED — STEP 3: DRAG OR CLICK CAPSULE INTO OPEN BREECH CHAMBER!'
            : 'CAPSULE ALREADY PACKED — STEP 2: CLICK BREECH HATCH DOOR TO OPEN!',
        },
      })
      return false
    }

    const doc = docId
      ? state.documents.find((d) => d.id === docId && d.status === 'desk')
      : [...state.documents]
          .reverse()
          .find(
            (d) =>
              d.status === 'desk' && d.stamps.some((s) => s.type === 'APPROVED')
          )

    if (!doc) {
      get().rejectUnstampedOutboxAttempt(docId)
      return false
    }

    if (ENABLE_FORGERIES && useGameStore.getState().tutorialStep === 5) {
      set({
        lastVerdict: {
          docId: doc.id,
          docTitle: doc.title,
          decision: 'SHREDDED',
          correct: false,
          pending: true,
          reason:
            'DRILL 5/5: THIS ORDER IS A CIA FORGERY! STAMP RED [SHREDDED] & DROP IN RIGHT SHREDDER!',
        },
      })
      return false
    }

    const wasStampedApproved = doc.stamps.some((s) => s.type === 'APPROVED')
    if (!wasStampedApproved) {
      set({
        lastVerdict: {
          docId: doc.id,
          docTitle: doc.title,
          decision: 'APPROVED',
          correct: false,
          pending: true,
          reason: 'STAMP DOCUMENT [APPROVED] BEFORE PACKING CARRIER CAPSULE!',
        },
      })
      return false
    }

    set({
      documents: state.documents.filter((d) => d.id !== doc.id),
      packedDoc: doc,
      capsuleState: 'CRADLE_PACKED',
      lastVerdict: {
        docId: doc.id,
        docTitle: doc.title,
        decision: 'APPROVED',
        correct: true,
        pending: true,
        reason: state.hatchOpen
          ? 'CAPSULE SEALED — STEP 3: LOAD CAPSULE INTO OPEN BREECH CHAMBER!'
          : 'CAPSULE SEALED — STEP 2: OPEN TUBE BREECH HATCH!',
      },
    })
    return true
  },

  toggleBreechHatch: (forceOpen?: boolean) => {
    const state = get()
    if (state.capsuleState === 'IN_FLIGHT') return state.hatchOpen
    const nextOpen =
      typeof forceOpen === 'boolean' ? forceOpen : !state.hatchOpen

    let reason = nextOpen
      ? 'BREECH HATCH OPEN — PACK & LOAD CARRIER CAPSULE INTO CHAMBER'
      : 'BREECH HATCH SEALED'

    if (state.capsuleState === 'CRADLE_PACKED' && nextOpen) {
      reason =
        'BREECH HATCH OPEN — STEP 3: DRAG OR CLICK CAPSULE INTO CHAMBER!'
    } else if (state.capsuleState === 'CHAMBER_LOADED' && !nextOpen) {
      reason =
        'READY TO LAUNCH // SEALED — STEP 5: PULL DOWN VACUUM LAUNCH LEVER!'
    } else if (state.capsuleState === 'CHAMBER_LOADED' && nextOpen) {
      reason =
        'CHAMBER LOADED — STEP 4: CLOSE & SEAL BREECH HATCH BEFORE LAUNCH!'
    }

    set({
      hatchOpen: nextOpen,
      lastVerdict: {
        docId: state.packedDoc?.id ?? 'BREECH-HATCH',
        docTitle:
          state.packedDoc?.title ?? 'PNEUMO-TUBE // LAUNCH CHAMBER',
        decision: 'APPROVED',
        correct: true,
        pending: true,
        reason,
      },
    })
    return nextOpen
  },

  loadCapsuleIntoChamber: () => {
    const state = get()
    if (state.capsuleState !== 'CRADLE_PACKED' || !state.packedDoc) {
      set({
        lastVerdict: {
          docId: 'CAPSULE-EMPTY',
          docTitle: 'CAPSULE // CARRIER CYLINDER',
          decision: 'APPROVED',
          correct: false,
          pending: true,
          reason:
            'STEP 1: STAMP PAPER [APPROVED] & PACK INTO CARRIER CAPSULE FIRST!',
        },
      })
      return false
    }

    if (!state.hatchOpen) {
      set({
        lastVerdict: {
          docId: state.packedDoc.id,
          docTitle: state.packedDoc.title,
          decision: 'APPROVED',
          correct: false,
          pending: true,
          reason:
            'BREECH HATCH CLOSED! STEP 2: CLICK BREECH DOOR TO OPEN HATCH FIRST!',
        },
      })
      return false
    }

    set({
      capsuleState: 'CHAMBER_LOADED',
      lastVerdict: {
        docId: state.packedDoc.id,
        docTitle: state.packedDoc.title,
        decision: 'APPROVED',
        correct: true,
        pending: true,
        reason:
          'CAPSULE IN CHAMBER — STEP 4: CLICK BREECH HATCH TO CLOSE & SEAL!',
      },
    })
    return true
  },

  launchPneumaticCapsule: () => {
    const state = get()
    if (state.capsuleState === 'IN_FLIGHT') return false
    if (state.capsuleState !== 'CHAMBER_LOADED' || !state.packedDoc) {
      set({
        lastVerdict: {
          docId: state.packedDoc?.id ?? 'LAUNCH-ERR',
          docTitle:
            state.packedDoc?.title ?? 'PNEUMO-TUBE // LAUNCH LEVER',
          decision: 'APPROVED',
          correct: false,
          pending: true,
          reason:
            state.capsuleState === 'CRADLE_PACKED'
              ? 'LOAD PACKED CAPSULE INTO BREECH CHAMBER & SEAL HATCH BEFORE PULLING LEVER!'
              : 'CHAMBER EMPTY! PACK [APPROVED] PAPER INTO CAPSULE & LOAD CHAMBER FIRST!',
        },
      })
      return false
    }

    if (state.hatchOpen) {
      set({
        lastVerdict: {
          docId: state.packedDoc.id,
          docTitle: state.packedDoc.title,
          decision: 'APPROVED',
          correct: false,
          pending: true,
          reason:
            'VACUUM SEAL OPEN! STEP 4: CLOSE BREECH HATCH FOR GREEN SEAL LIGHT!',
        },
      })
      return false
    }

    set({
      capsuleState: 'IN_FLIGHT',
      lastVerdict: {
        docId: state.packedDoc.id,
        docTitle: state.packedDoc.title,
        decision: 'APPROVED',
        correct: true,
        pending: true,
        reason:
          'PNEUMO-LAUNCH! CAPSULE IN FLIGHT TO K.O.M.R.A.D.-84 MAINFRAME...',
      },
    })
    return true
  },

  completePneumaticLaunch: () => {
    const state = get()
    const doc = state.packedDoc
    if (!doc) {
      set({
        capsuleState: 'CRADLE_EMPTY',
        hatchOpen: false,
        packedDoc: null,
      })
      return
    }

    const correct = !doc.isForgery
    syncDecisionWithSharedStore(
      doc.title,
      doc.isForgery,
      'APPROVED',
      doc.forgeryReason,
      doc.powerTargets
    )
    const activeMandate = useGameStore.getState().activeMandate
    const cooldownSec = 22.0

    set({
      documents: [],
      printingDoc: null,
      packedDoc: null,
      capsuleState: 'CRADLE_EMPTY',
      hatchOpen: false,
      directiveCooldown: cooldownSec,
      nextPrintReadyAtMs: Date.now() + cooldownSec * 1000,
      commendations: correct ? state.commendations + 1 : state.commendations,
      citations: correct ? state.citations : state.citations + 1,
      lastVerdict: {
        docId: doc.id,
        docTitle: doc.title,
        decision: 'APPROVED',
        correct,
        reason: correct
          ? `PNEUMATIC DISPATCH RECEIVED BY K.O.M.R.A.D.-84: ${activeMandate ? activeMandate.requirementText : doc.powerOrderText}`
          : `SABOTAGE DISPATCHED (2 SPENT FUEL CHANNELS + TREASON STRIKE): ${doc.forgeryReason}`,
      },
    })
  },

  dispatchDocumentToOutbox: (id: string) => {
    return get().packDocumentIntoCapsule(id)
  },

  rejectUnstampedOutboxAttempt: (docId?: string) => {
    const state = get()
    const doc = docId
      ? state.documents.find((d) => d.id === docId)
      : state.documents[state.documents.length - 1]
    set({
      lastVerdict: {
        docId: doc?.id ?? 'OUTBOX-ERR',
        docTitle: doc?.title ?? 'PNEUMO-TUBE // CAPSULE',
        decision: 'APPROVED',
        correct: false,
        pending: true,
        reason: 'STAMP DOCUMENT [APPROVED] BEFORE PACKING CARRIER CAPSULE!',
      },
    })
  },

  recordMandateComplianceOutcome: (
    fulfilled: boolean,
    mandateId: string,
    reason: string
  ) => {
    const state = get()
    set({
      commendations: fulfilled
        ? state.commendations + 1
        : state.commendations,
      citations: fulfilled ? state.citations : state.citations + 1,
      lastVerdict: {
        docId: mandateId,
        docTitle: fulfilled ? 'QUOTA FULFILLED' : 'QUOTA NON-COMPLIANCE',
        decision: 'APPROVED',
        correct: fulfilled,
        reason,
      },
    })
  },
}))

registerMandateComplianceListener((fulfilled, mandateId, reason) => {
  useDeskStore
    .getState()
    .recordMandateComplianceOutcome(fulfilled, mandateId, reason)
})
