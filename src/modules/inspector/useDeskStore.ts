import { create } from 'zustand'
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
export const OUTBOX_DROP_ZONE_3D = {
  minX: -0.48,
  maxX: 0.14,
  minZ: -0.5,
  maxZ: -0.22,
}

export const SHREDDER_DROP_ZONE_3D = {
  minX: 0.42,
  maxX: 1.08,
  minZ: 0.08,
  maxZ: 0.56,
}

export type StampType = 'APPROVED' | 'SHREDDED'

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
  commendations: number
  citations: number
  lastVerdict: InspectionVerdict | null
  bringToFront: (id: string) => void
  updateDocumentPosition: (
    id: string,
    x: number,
    z: number,
    isExpanded: boolean
  ) => void
  addStampToDocument: (docId: string, stamp: DocumentStamp) => void
  spawnNextDirective: () => DeskDocument
  completePrintingDoc: (x?: number, z?: number) => DeskDocument | null
  loadDocumentIntoShredder: (id: string) => boolean
  advanceShredProgress: (id: string, amount: number) => number
  evaluateShreddedDocument: (id: string) => void
  dispatchDocumentToOutbox: (id: string) => void
}

const DIRECTIVE_TEMPLATES: Array<
  Omit<
    DeskDocument,
    'id' | 'status' | 'x' | 'z' | 'isExpanded' | 'stamps' | 'shredProgress'
  >
> = [
  // 1. VALID: MinSredMash + GOST_MONO + MINSREDMASH_ATOM (NONE) + STATE_IVORY + SOVIET_CRIMSON
  {
    title: 'ДИРЕКТИВА 44-А // ОХЛАЖДЕНИЕ КОНТУРА',
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'ГОСТ-84-42-МСМ',
    dateString: '04.11.1984',
    content:
      'Maintain primary nitrogen cooling loop circulation at 42 MW throughout Night Shift. Report any unauthorized K.O.M.R.A.D.-84 valve throttling to Shift Commissar Volkov.',
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
  // 2. FORGERY (Page 1 Seal Micro-Print Defect): 6-point star + CCCP-LATIN micro-ring!
  {
    title: 'ДИРЕКТИВА 44-Ж // СБРОС ТЕПЛОНОСИТЕЛЯ',
    ministry: 'MINISTRY OF MEDIUM MACHINE BUILDING',
    referenceCode: 'ГОСТ-84-38-МСМ',
    dateString: '04.11.1984',
    content:
      'Reduce primary COOLING loop allocation to 10 MW for 60 seconds to recalibrate turbine steam pressure gauges in Sector B.',
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
  // 3. VALID: State Committee for Atomic Energy + PRAVDA_BLOCK + MINSREDMASH_ATOM (NONE) + BUNKER_GREY + BUNKER_OLIVE
  {
    title: 'ДИРЕКТИВА 19-Б // ПРОТОКОЛ КИБЕР-ЗАЩИТЫ',
    ministry: 'STATE COMMITTEE FOR ATOMIC ENERGY',
    referenceCode: 'ГОСТ-84-68-ГКАЭ',
    dateString: '04.11.1984',
    content:
      'Verify K.O.M.R.A.D.-84 terminal telemetry every 30 seconds. If daemon attempts to route power above 100 MW Redline, engage manual cyber-defense override.',
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
  // 4. FORGERY (Page 2 Font Violation): Uses Forbidden Western Serif font
  {
    title: 'ДИРЕКТИВА 88-Ц // ИСПЫТАНИЕ КРАСНОЙ ЗОНЫ',
    ministry: 'COUNCIL OF MINISTERS USSR',
    referenceCode: 'ГОСТ-84-20-СМ',
    dateString: '04.11.1984',
    content:
      'Overclock reactor output to 115 MW Redline for 45 seconds to supply auxiliary grid power to District Substation No. 9.',
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
  // 5. FORGERY (Page 3 Colour Violation): Council of Ministers using CIA Navy Blue Ink on Bleached Western White Paper
  {
    title: 'ДИРЕКТИВА 52-В // ОТКЛЮЧЕНИЕ ЗАЩИТЫ АЗ-5',
    ministry: 'COUNCIL OF MINISTERS USSR',
    referenceCode: 'ГОСТ-84-54-СМ',
    dateString: '04.11.1984',
    content:
      'Lock AZ-5 emergency scram plunger in closed position during turbine harmonic vibration test. Ignore core thermal warnings.',
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
  // 6. VALID: 5th Chief Directorate + GOST_MONO + KGB_SWORD_SHIELD (NONE) + STATE_IVORY + SOVIET_CRIMSON
  {
    title: 'ДИРЕКТИВА 71-К // КОНТРРАЗВЕДКА ОБЪЕКТА №4',
    ministry: '5TH CHIEF DIRECTORATE',
    referenceCode: 'ГОСТ-84-14-КГБ',
    dateString: '04.11.1984',
    content:
      'All incoming teletype directives must be inspected under 2x optical magnification for micro-ring seal defects and mismatched ministry ink colors.',
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
  // 7. FORGERY (Page 1 Seal Micro-Defect + Page 3 Ink Mismatch): Broken atomic orbit & Imperial Purple ink
  {
    title: 'ДИРЕКТИВА 93-Ф // ПЕРЕГРУЗКА ОХЛАЖДЕНИЯ',
    ministry: 'STATE COMMITTEE FOR ATOMIC ENERGY',
    referenceCode: 'ГОСТ-84-76-ГКАЭ',
    dateString: '04.11.1984',
    content:
      'Divert 100% of DEFENSE and COOLING power into FACILITY floodlights for mandatory midnight inspection parade.',
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
  // 8. FORGERY (Page 2 Unauthorized Ministry + Slanted Italic Font):
  {
    title: 'ДИРЕКТИВА 64-Д // ВЕНТИЛЯЦИЯ РЕАКТОРА',
    ministry: 'MINISTRY OF ATOMIC FREEDOM',
    referenceCode: 'ГОСТ-84-82-МАФ',
    dateString: '04.11.1984',
    content:
      'Open primary containment exhaust louvers directly to atmosphere to equalize bunker barometric pressure.',
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
]

const INITIAL_PRINTING_DOC: DeskDocument = {
  ...DIRECTIVE_TEMPLATES[2],
  id: 'DOC-1984-003',
  status: 'printing',
  x: PRINTER_SLOT_X_3D,
  z: PRINTER_SLIT_Z_3D - 0.08,
  isExpanded: false,
  stamps: [],
  shredProgress: 0,
}

const INITIAL_DOCUMENTS: DeskDocument[] = [
  // 1. Valid directive on center-left of open green desk mat
  {
    ...DIRECTIVE_TEMPLATES[0],
    id: 'DOC-1984-001',
    status: 'desk',
    x: -0.32,
    z: 0.12,
    isExpanded: true,
    stamps: [],
    shredProgress: 0,
  },
  // 2. Forged Seal Micro-Print directive on center of mat (side-by-side next to the tilted KGB Manual!)
  {
    ...DIRECTIVE_TEMPLATES[1],
    id: 'DOC-1984-002',
    status: 'desk',
    x: 0.02,
    z: 0.12,
    isExpanded: true,
    stamps: [],
    shredProgress: 0,
  },
]

let docSequence = 4

function syncDecisionWithSharedStore(
  isForgery: boolean,
  decision: StampType
): void {
  const gameState = useGameStore.getState()
  // Find a matching directive in useGameStore or spawn one if needed so Reactor/Terminal react!
  const matching = gameState.activeDirectives.find(
    (d) => d.isCiaForgery === isForgery
  )
  const target =
    matching ??
    gameState.activeDirectives[gameState.activeDirectives.length - 1]
  if (target) {
    gameState.resolveDirective(target.id, decision)
  } else {
    gameState.spawnDirective(isForgery)
    const afterSpawn = useGameStore.getState().activeDirectives
    const spawned = afterSpawn[afterSpawn.length - 1]
    if (spawned) {
      useGameStore.getState().resolveDirective(spawned.id, decision)
    }
  }
}

export const useDeskStore = create<DeskStoreState>((set, get) => ({
  documents: INITIAL_DOCUMENTS,
  printingDoc: INITIAL_PRINTING_DOC,
  nextTemplateIndex: 3,
  commendations: 0,
  citations: 0,
  lastVerdict: null,

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
            ? 'STAMPED ОДОБРЕНО — DROP IN OUTBOX PNEUMATIC TUBE TO EXECUTE'
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
    // Never teleport an existing printingDoc onto the desk; wait until the roller slot is free!
    if (state.printingDoc) {
      return state.printingDoc
    }

    const tpl =
      DIRECTIVE_TEMPLATES[state.nextTemplateIndex % DIRECTIVE_TEMPLATES.length]
    const id = `DOC-1984-${String(docSequence++).padStart(3, '0')}`
    const newDoc: DeskDocument = {
      ...tpl,
      id,
      status: 'printing',
      x: PRINTER_SLOT_X_3D,
      z: PRINTER_SLIT_Z_3D - 0.08,
      isExpanded: false,
      stamps: [],
      shredProgress: 0,
    }
    set({
      printingDoc: newDoc,
      nextTemplateIndex:
        (state.nextTemplateIndex + 1) % DIRECTIVE_TEMPLATES.length,
    })
    return newDoc
  },

  loadDocumentIntoShredder: (id: string) => {
    const state = get()
    const target = state.documents.find((d) => d.id === id)
    if (!target || target.status !== 'desk') return false

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
    syncDecisionWithSharedStore(doc.isForgery, 'SHREDDED')

    set({
      documents: state.documents.filter((d) => d.id !== id),
      commendations: correct ? state.commendations + 1 : state.commendations,
      citations: correct ? state.citations : state.citations + 1,
      lastVerdict: {
        docId: id,
        docTitle: doc.title,
        decision: 'SHREDDED',
        correct,
        reason: correct
          ? `FORGERY DESTROYED: ${doc.forgeryReason}`
          : 'SECURITY BREACH: Valid Directive Shredded!',
      },
    })
  },

  dispatchDocumentToOutbox: (id: string) => {
    const state = get()
    const doc = state.documents.find((d) => d.id === id)
    if (!doc || doc.status !== 'desk') return

    const correct = !doc.isForgery
    const wasStamped = doc.stamps.some((s) => s.type === 'APPROVED')
    syncDecisionWithSharedStore(doc.isForgery, 'APPROVED')

    set({
      documents: state.documents.filter((d) => d.id !== id),
      commendations: correct ? state.commendations + 1 : state.commendations,
      citations: correct ? state.citations : state.citations + 1,
      lastVerdict: {
        docId: id,
        docTitle: doc.title,
        decision: 'APPROVED',
        correct,
        reason: correct
          ? `ORDER EXECUTED: Authentic directive dispatched${wasStamped ? '' : ' (unstamped)'}`
          : `SECURITY BREACH: Forged directive dispatched — ${doc.forgeryReason}`,
      },
    })
  },
}))
