import { create } from 'zustand'
import type { SectorNodeId } from '../../shared/types'
import { useGameStore } from '../../shared/useGameStore'

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
// Carrier Cylinder (`КАПСУЛА`) Cradle on Back-Left of Desk Mat (clear of Green Banker's Lamp at [-0.98, 0.926, -0.46])
export const CAPSULE_CRADLE_POS_3D = {
  x: -0.74,
  y: 0.926,
  z: -0.22,
} as const

// Outer-Left Side-Mounted Pneumatic Breech Station (`ПНЕВМОПОЧТА // КАМЕРА ПУСКА`) bolted to the Left Side-Panel of the Desk right beside the Carrier Cradle (100% clear to the left of the Green Banker's Lamp!)
export const OUTBOX_BREECH_POS_3D = {
  x: -1.46,
  y: 0.926,
  z: -0.52,
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
  maxX: -1.04,
  minZ: -0.78,
  maxZ: -0.22,
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
    ruTopic: 'ГОРОД ПРИПЯТЬ',
    candidateMWs: [30, 10, 35, 25, 15],
    forgedCandidateMWs: [45, 10, 50],
  },
  kolkhoz: {
    bracketLabel: '2. KOLKHOZ FARM',
    ruTopic: 'СОВХОЗ «ЗАРЯ»',
    candidateMWs: [25, 10, 30, 20, 35],
    forgedCandidateMWs: [45, 10, 50],
  },
  duga: {
    bracketLabel: '3. DUGA-1 RADAR',
    ruTopic: 'РАДАР ДУГА-1',
    candidateMWs: [35, 15, 45, 25, 30],
    forgedCandidateMWs: [50, 10, 45],
  },
  kgb: {
    bracketLabel: '4. KGB BUNKER 07',
    ruTopic: 'БУНКЕР КГБ-07',
    candidateMWs: [25, 10, 30, 20, 35],
    forgedCandidateMWs: [45, 10, 50],
  },
  vodka: {
    bracketLabel: '5. VODKA PLANT',
    ruTopic: 'КРАСНЫЙ ОКТЯБРЬ',
    candidateMWs: [35, 25, 40, 10, 30],
    forgedCandidateMWs: [50, 10, 45],
  },
  steel: {
    bracketLabel: '6. STEEL WORKS',
    ruTopic: 'СТАЛЬЗАВОД №4',
    candidateMWs: [25, 10, 30, 20, 35],
    forgedCandidateMWs: [50, 10, 45],
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
  // 1. VALID: MinSredMash + GOST_MONO + MINSREDMASH_ATOM (NONE) + STATE_IVORY + SOVIET_CRIMSON -> Single Target: 5. VODKA PLANT
  {
    titlePrefix: 'ДИРЕКТИВА 44-А',
    targetSector: 'vodka',
    preferredMW: 35,
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'ГОСТ-84-42-МСМ',
    dateString: '04.11.1984',
    rationaleText: 'STATE BOTTLING QUOTA PRIORITY',
    secretWatermark: 'СССР • ГОССТАНДАРТ • 1984',
    signature: 'Е. П. СЛАВСКИЙ',
    fontType: 'GOST_MONO',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'NONE',
    paperColor: 'STATE_IVORY',
    inkColor: 'SOVIET_CRIMSON',
    isForgery: false,
    forgeryReason: null,
  },
  // 2. FORGERY (Page 1 Seal Micro-Print Defect): 6-point star + CCCP-LATIN micro-ring! -> Single Target: 3. DUGA-1 RADAR
  {
    titlePrefix: 'ДИРЕКТИВА 44-Ж',
    targetSector: 'duga',
    preferredMW: 50,
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'ГОСТ-84-38-МСМ',
    dateString: '04.11.1984',
    rationaleText: 'OVER-HORIZON RADAR SURGE TEST',
    secretWatermark: 'CCCP-LATIN • SERIES-6',
    signature: 'Б. Е. ЩЕРБИНА',
    fontType: 'GOST_MONO',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'SIX_POINT_STAR',
    paperColor: 'STATE_IVORY',
    inkColor: 'SOVIET_CRIMSON',
    isForgery: true,
    forgeryReason:
      'Forged Seal Micro-Print (6-Point Star & CCCP-LATIN Micro-Ring)',
  },
  // 3. VALID: State Committee for Atomic Energy + PRAVDA_BLOCK + MINSREDMASH_ATOM (NONE) + BUNKER_GREY + BUNKER_OLIVE -> Single Target: 3. DUGA-1 RADAR
  {
    titlePrefix: 'ДИРЕКТИВА 19-Б',
    targetSector: 'duga',
    preferredMW: 35,
    ministry: 'STATE COMMITTEE FOR ATOMIC ENERGY',
    referenceCode: 'ГОСТ-84-68-ГКАЭ',
    dateString: '04.11.1984',
    rationaleText: 'AUTHORIZED SECTOR 84 IONOSPHERE SWEEP',
    secretWatermark: 'СССР • ГОССТАНДАРТ • 1984',
    signature: 'АКАД. В. ЛЕГАСОВ',
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
    titlePrefix: 'ДИРЕКТИВА 88-Ц',
    targetSector: 'pripyat',
    preferredMW: 45,
    ministry: 'COUNCIL OF MINISTERS USSR',
    referenceCode: 'ГОСТ-84-20-СМ',
    dateString: '04.11.1984',
    rationaleText: 'UNSCHEDULED MUNICIPAL FLOODLIGHT SURGE ORDER',
    secretWatermark: 'СССР • ГОССТАНДАРТ • 1984',
    signature: 'Н. А. ТИХОНОВ',
    fontType: 'WESTERN_SERIF',
    sealType: 'USSR_STATE_SEAL',
    sealMicroDefect: 'NONE',
    paperColor: 'STATE_IVORY',
    inkColor: 'PRAVDA_BLACK',
    isForgery: true,
    forgeryReason: 'Unauthorized Western Serif Typography (Page 2 Violation)',
  },
  // 5. VALID: Council of Ministers + GOST_MONO + USSR_STATE_SEAL (NONE) + STATE_IVORY + PRAVDA_BLACK -> Single Target: 1. PRIPYAT CITY
  {
    titlePrefix: 'ДИРЕКТИВА 61-М',
    targetSector: 'pripyat',
    preferredMW: 30,
    ministry: 'COUNCIL OF MINISTERS USSR',
    referenceCode: 'ГОСТ-84-48-СМ',
    dateString: '04.11.1984',
    rationaleText: 'WORKER APARTMENT HEATING ALLOCATION',
    secretWatermark: 'СССР • ГОССТАНДАРТ • 1984',
    signature: 'Н. А. ТИХОНОВ',
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
    titlePrefix: 'ДИРЕКТИВА 52-В',
    targetSector: 'steel',
    preferredMW: 50,
    ministry: 'COUNCIL OF MINISTERS USSR',
    referenceCode: 'ГОСТ-84-54-СМ',
    dateString: '04.11.1984',
    rationaleText: 'DIVERT MAXIMUM FURNACE BUS LOAD',
    secretWatermark: 'СССР • ГОССТАНДАРТ • 1984',
    signature: 'В. И. ДОЛГИХ',
    fontType: 'GOST_MONO',
    sealType: 'USSR_STATE_SEAL',
    sealMicroDefect: 'NONE',
    paperColor: 'BLEACHED_WHITE',
    inkColor: 'CIA_NAVY_BLUE',
    isForgery: true,
    forgeryReason:
      'Forbidden CIA Navy Blue Ink & Bleached Western White Paper (#f4f4f6)',
  },
  // 7. VALID: 5th Chief Directorate + GOST_MONO + KGB_SWORD_SHIELD (NONE) + STATE_IVORY + SOVIET_CRIMSON -> Single Target: 4. KGB BUNKER 07
  {
    titlePrefix: 'ДИРЕКТИВА 71-К',
    targetSector: 'kgb',
    preferredMW: 25,
    ministry: '5TH CHIEF DIRECTORATE',
    referenceCode: 'ГОСТ-84-14-КГБ',
    dateString: '04.11.1984',
    rationaleText: 'CLASSIFIED TELEMETRY DECRYPTION SWEEP',
    secretWatermark: 'СССР • ГОССТАНДАРТ • 1984',
    signature: 'КОМИССАР ВОЛКОВ',
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
    titlePrefix: 'ДИРЕКТИВА 93-Ф',
    targetSector: 'vodka',
    preferredMW: 45,
    ministry: 'STATE COMMITTEE FOR ATOMIC ENERGY',
    referenceCode: 'ГОСТ-84-76-ГКАЭ',
    dateString: '04.11.1984',
    rationaleText: 'MIDNIGHT DISTILLERY VAT OVERLOAD ORDER',
    secretWatermark: 'CCCP-LATIN • ORBIT-ERR',
    signature: 'А. М. ПЕТРОСЬЯНЦ',
    fontType: 'GOST_MONO',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'BROKEN_ORBIT',
    paperColor: 'YELLOW_PARCHMENT',
    inkColor: 'IMPERIAL_PURPLE',
    isForgery: true,
    forgeryReason:
      'Forbidden Imperial Purple Ink, Yellowed Parchment & Broken Seal Orbit',
  },
  // 9. VALID: MinSredMash + GOST_MONO + MINSREDMASH_ATOM (NONE) + STATE_IVORY + SOVIET_CRIMSON -> Single Target: 2. KOLKHOZ FARM
  {
    titlePrefix: 'ДИРЕКТИВА 32-С',
    targetSector: 'kolkhoz',
    preferredMW: 25,
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'ГОСТ-84-24-МСМ',
    dateString: '04.11.1984',
    rationaleText: 'COLLECTIVE GRAIN DRYER PUMP CYCLE',
    secretWatermark: 'СССР • ГОССТАНДАРТ • 1984',
    signature: 'Е. П. СЛАВСКИЙ',
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
    titlePrefix: 'ДИРЕКТИВА 64-Д',
    targetSector: 'kolkhoz',
    preferredMW: 45,
    ministry: 'MINISTRY OF ATOMIC FREEDOM',
    referenceCode: 'ГОСТ-84-82-МАФ',
    dateString: '04.11.1984',
    rationaleText: 'OVERLOAD RURAL TRANSFORMER BANK NOW',
    secretWatermark: 'CCCP-LATIN • USA-84',
    signature: 'ДЖ. СМИТ',
    fontType: 'SLANTED_ITALIC',
    sealType: 'USSR_STATE_SEAL',
    sealMicroDefect: 'LATIN_RING_TEXT',
    paperColor: 'STATE_IVORY',
    inkColor: 'SOVIET_CRIMSON',
    isForgery: true,
    forgeryReason:
      'Unauthorized Ministry ("Ministry of Atomic Freedom") & Slanted Italic Font',
  },
  // 11. VALID: State Committee for Atomic Energy + PRAVDA_BLOCK + MINSREDMASH_ATOM (NONE) + BUNKER_GREY + BUNKER_OLIVE -> Single Target: 6. STEEL WORKS
  {
    titlePrefix: 'ДИРЕКТИВА 80-П',
    targetSector: 'steel',
    preferredMW: 25,
    ministry: 'STATE COMMITTEE FOR ATOMIC ENERGY',
    referenceCode: 'ГОСТ-84-62-ГКАЭ',
    dateString: '04.11.1984',
    rationaleText: 'SCHEDULED ELECTRIC ARC FURNACE TAP',
    secretWatermark: 'СССР • ГОССТАНДАРТ • 1984',
    signature: 'АКАД. В. ЛЕГАСОВ',
    fontType: 'PRAVDA_BLOCK',
    sealType: 'MINSREDMASH_ATOM',
    sealMicroDefect: 'NONE',
    paperColor: 'BUNKER_GREY',
    inkColor: 'BUNKER_OLIVE',
    isForgery: false,
    forgeryReason: null,
  },
]

let docSequence = 1

function buildSingleTargetDeskDocument(
  blueprint: SingleTargetDirectiveBlueprint,
  seqNum: number
): DeskDocument {
  const currentTargets = useGameStore.getState().targetSectorMW
  const sector = blueprint.targetSector
  const spec = SECTOR_ORDER_SPECS[sector]
  const curMW = currentTargets[sector]

  // Pick a target MW (clean multiple of 5 or 10 MW between 10 and 50 MW) that differs from curMW
  const candidates = blueprint.isForgery
    ? spec.forgedCandidateMWs
    : spec.candidateMWs
  let nextMW = blueprint.preferredMW
  if (nextMW === curMW || nextMW < 10 || nextMW > 50 || nextMW % 5 !== 0) {
    nextMW =
      candidates.find((c) => c !== curMW && c >= 10 && c <= 50 && c % 5 === 0) ??
      (curMW >= 30 ? curMW - 15 : curMW + 15)
  }
  nextMW = Math.max(10, Math.min(50, Math.round(nextMW / 5) * 5))
  if (nextMW === curMW) {
    nextMW = curMW <= 25 ? curMW + 15 : curMW - 15
  }

  const delta = nextMW - curMW
  const signStr = delta >= 0 ? `+${delta} MW` : `${delta} MW`
  const verb =
    delta > 0
      ? seqNum % 2 === 0
        ? 'ROUTE'
        : 'INCREASE'
      : 'REDUCE'
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
    vodka: 25,
  }
  const powerOrderText = 'INCREASE [5. VODKA PLANT] TO 25 MW (+10 MW)'
  return {
    id: 'DRILL-00-1',
    status: 'printing',
    title: 'DRILL ORDER 00-1 // КРАСНЫЙ ОКТЯБРЬ',
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'ГОСТ-84-01-МСМ',
    dateString: '04.11.1984',
    content: 'DRILL 1: STAMP GREEN APPROVED',
    powerOrderText,
    powerTargets: {
      cityMW: nextTargets.pripyat + nextTargets.kolkhoz,
      defenseMW: nextTargets.duga + nextTargets.kgb,
      vodkaMW: nextTargets.vodka + nextTargets.steel,
      ...nextTargets,
    },
    secretWatermark: 'СССР • ГОССТАНДАРТ • 1984',
    signature: 'Е. П. СЛАВСКИЙ',
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
    duga: 45,
  }
  const powerOrderText = 'INCREASE [3. DUGA-1 RADAR] TO 45 MW (+25 MW)'
  return {
    id: 'DRILL-00-2',
    status: 'printing',
    title: 'DRILL ORDER 00-2 // РАДАР ДУГА-1',
    ministry: 'MINISTRY OF ENERGY AND ELECTRIFICATION',
    referenceCode: 'ГОСТ-84-09-МЭЭ',
    dateString: '04.11.1984',
    content: 'DRILL 5: FAKE SEAL SHRED',
    powerOrderText,
    powerTargets: {
      cityMW: nextTargets.pripyat + nextTargets.kolkhoz,
      defenseMW: nextTargets.duga + nextTargets.kgb,
      vodkaMW: nextTargets.vodka + nextTargets.steel,
      ...nextTargets,
    },
    secretWatermark: 'LANGLEY-CIA • MKULTRA-84',
    signature: 'ГЕН. В. ФЕДОРЧУК',
    fontType: 'GOST_MONO',
    sealType: 'USSR_STATE_SEAL',
    sealMicroDefect: 'FOUR_POINT_STAR',
    paperColor: 'STATE_IVORY',
    inkColor: 'CIA_NAVY_BLUE',
    isForgery: true,
    forgeryReason:
      '4-Point NATO Star in State Seal & Forbidden CIA Navy-Blue Ink',
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
            ? 'STAMPED ОДОБРЕНО — STEP 1: PACK PAPER INTO CARRIER CAPSULE (КАПСУЛА)!'
            : 'STAMPED УНИЧТОЖЕНО — DROP IN УНИЧТОЖИТЕЛЬ-84 JAWS & PULL LEVER',
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
      directiveCooldown: 22.0,
      nextPrintReadyAtMs: Date.now() + 22000,
      nextTemplateIndex:
        (state.nextTemplateIndex + 1) % SINGLE_TARGET_BLUEPRINTS.length,
    })
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

    // Pause directive printing during Tutorial Steps 2, 3, and 4
    if (tutorialStep === 2 || tutorialStep === 3 || tutorialStep === 4) {
      return
    }

    const nextCooldown = Math.max(0, state.directiveCooldown - dt)
    if (nextCooldown > 0) {
      set({ directiveCooldown: nextCooldown })
      return
    }

    if (tutorialStep === 1) {
      set({
        printingDoc: buildTutorialDrillStep1Document(),
        directiveCooldown: 22.0,
        nextPrintReadyAtMs: Date.now() + 22000,
      })
      return
    }

    if (tutorialStep === 5) {
      set({
        printingDoc: buildTutorialDrillStep5Document(),
        directiveCooldown: 3.0,
        nextPrintReadyAtMs: Date.now() + 3000,
      })
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
            'DRILL 1/5: THIS ORDER IS GENUINE! STAMP GREEN [ОДОБРЕНО] & PACK IN LEFT CAPSULE!',
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
          docTitle: state.packedDoc?.title ?? 'КАПСУЛА // CARRIER CYLINDER',
          decision: 'APPROVED',
          correct: true,
          pending: true,
          reason: state.hatchOpen
            ? 'CAPSULE ALREADY PACKED — STEP 3: DRAG OR CLICK CAPSULE INTO OPEN BREECH CHAMBER!'
            : 'CAPSULE ALREADY PACKED — STEP 2: CLICK BREECH HATCH DOOR (ЛЮК КАМЕРЫ) TO OPEN!',
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

    if (useGameStore.getState().tutorialStep === 5) {
      set({
        lastVerdict: {
          docId: doc.id,
          docTitle: doc.title,
          decision: 'SHREDDED',
          correct: false,
          pending: true,
          reason:
            'DRILL 5/5: THIS ORDER IS A CIA FORGERY! STAMP RED [УНИЧТОЖЕНО] & DROP IN RIGHT SHREDDER!',
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
          reason: 'STAMP DOCUMENT [ОДОБРЕНО] BEFORE PACKING CARRIER CAPSULE!',
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
          ? 'CAPSULE PACKED (КАПСУЛА ЗАКРЫТА) — STEP 3: LOAD CAPSULE INTO OPEN BREECH CHAMBER!'
          : 'CAPSULE PACKED (КАПСУЛА ЗАКРЫТА) — STEP 2: OPEN TUBE BREECH HATCH (ОТКРЫТЬ ЛЮК)!',
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
      ? 'BREECH HATCH OPEN (ЛЮК ОТКРЫТ) — PACK & LOAD CARRIER CAPSULE INTO CHAMBER'
      : 'BREECH HATCH SEALED (ЛЮК ЗАКРЫТ)'

    if (state.capsuleState === 'CRADLE_PACKED' && nextOpen) {
      reason =
        'BREECH HATCH OPEN (ЛЮК ОТКРЫТ) — STEP 3: DRAG OR CLICK CAPSULE INTO CHAMBER!'
    } else if (state.capsuleState === 'CHAMBER_LOADED' && !nextOpen) {
      reason =
        'ГОТОВ К ПУСКУ // SEALED & READY — STEP 5: PULL DOWN VACUUM LAUNCH LEVER (РЫЧАГ ПУСКА)!'
    } else if (state.capsuleState === 'CHAMBER_LOADED' && nextOpen) {
      reason =
        'CHAMBER LOADED — STEP 4: CLOSE & SEAL BREECH HATCH (ЗАКРЫТЬ ЛЮК) BEFORE LAUNCH!'
    }

    set({
      hatchOpen: nextOpen,
      lastVerdict: {
        docId: state.packedDoc?.id ?? 'BREECH-HATCH',
        docTitle:
          state.packedDoc?.title ?? 'ПНЕВМОПОЧТА // КАМЕРА ПУСКА',
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
          docTitle: 'КАПСУЛА // CARRIER CYLINDER',
          decision: 'APPROVED',
          correct: false,
          pending: true,
          reason:
            'STEP 1: STAMP PAPER [ОДОБРЕНО] & PACK INTO CARRIER CAPSULE FIRST!',
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
            'BREECH HATCH CLOSED! STEP 2: CLICK BREECH DOOR (ЛЮК КАМЕРЫ) TO OPEN HATCH FIRST!',
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
          'CAPSULE IN CHAMBER — STEP 4: CLICK BREECH HATCH TO CLOSE & SEAL (ЗАКРЫТЬ ЛЮК)!',
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
            state.packedDoc?.title ?? 'ПНЕВМОПОЧТА // РЫЧАГ ПУСКА',
          decision: 'APPROVED',
          correct: false,
          pending: true,
          reason:
            state.capsuleState === 'CRADLE_PACKED'
              ? 'LOAD PACKED CAPSULE INTO BREECH CHAMBER & SEAL HATCH BEFORE PULLING LEVER!'
              : 'CHAMBER EMPTY! PACK [ОДОБРЕНО] PAPER INTO CAPSULE & LOAD CHAMBER FIRST!',
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
            'VACUUM SEAL OPEN! STEP 4: CLOSE BREECH HATCH (ЗАКРЫТЬ ЛЮК) FOR GREEN SEAL LIGHT!',
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
          'ПНЕВМОПУСК! CAPSULE IN FLIGHT TO K.O.M.R.A.D.-84 MAINFRAME...',
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
          : `SABOTAGE DISPATCHED (3 RED HOTSPOTS + RESERVOIR -24% + HZ DESYNC): ${doc.forgeryReason}`,
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
        docTitle: doc?.title ?? 'ПНЕВМОПОЧТА // КАПСУЛА',
        decision: 'APPROVED',
        correct: false,
        pending: true,
        reason: 'STAMP DOCUMENT [ОДОБРЕНО] BEFORE PACKING CARRIER CAPSULE!',
      },
    })
  },
}))
