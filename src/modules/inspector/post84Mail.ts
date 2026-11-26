import type { ActivePost84PowerOrder, SectorNodeId } from '../../shared/types'

export type Post84MessageStatus = 'unread' | 'read'

export type Post84OrderState = 'pending' | 'active' | 'completed'

export type Post84TrainingDirectiveState = 'pending' | 'accepted' | 'skipped'

export type Post84OrderTemplateId =
  | 'municipal_heating'
  | 'vodka_batch'
  | 'kolkhoz_lamps'
  | 'tractor_foundry'
  | 'duga_radar'
  | 'kgb_interrogation'
  | 'swan_lake_tv'
  | 'volkor_driveway'
  | 'moscow_inspection'

export interface Post84LiveTelemetry {
  totalElectricalMW: number
  isBlackout: boolean
  az5Active: boolean
  kgbLineActive: boolean
  sectorMW: Record<SectorNodeId, number>
  targetSectorMW: Record<SectorNodeId, number>
}

export interface Post84DeliveredPower {
  totalAllocatedMW: number
  availableGridMW: number
  totalDeliveredMW: number
  deliveryRatio: number
  isPowerShortfall: boolean
  sectorDeliveredMW: Record<SectorNodeId, number>
}

export interface Post84OrderSpec {
  templateId: Post84OrderTemplateId
  orderState: Post84OrderState
  holdDurationSec: number
  holdProgressSec: number
  rewardRub: number
  quotaPoints: number
  objectiveSummary: string
  arrivalVox: string
}

export interface Post84Message {
  id: string
  sender: string
  orgTag: string
  subject: string
  timestamp: string
  bodyLines: string[]
  status: Post84MessageStatus
  order?: Post84OrderSpec
  trainingDirective?: {
    state: Post84TrainingDirectiveState
  }
}

export interface Post84OrderEvaluation {
  met: boolean
  liveReadout: string
  detailLine: string
}

export const VOLKOV_ONBOARDING_MAIL_ID = 'mail-volkov-calibration-directive'
export const VOLKOR_WELCOME_MAIL_ID = 'mail-volkor-welcome'
export const VOLKOR_TUTORIAL_MAIL_ID = 'mail-volkor-komrad84'

export const POST84_ORDER_COMPLETED_VOX =
  'STATE POWER DIRECTIVE COMPLETE. QUOTA AND RUBLES RECORDED.'

export const POST84_ORDER_TEMPLATE_IDS: Post84OrderTemplateId[] = [
  'municipal_heating',
  'vodka_batch',
  'kolkhoz_lamps',
  'tractor_foundry',
  'duga_radar',
  'kgb_interrogation',
  'swan_lake_tv',
  'volkor_driveway',
  'moscow_inspection',
]

/**
 * Period-authentic 1984 Soviet bureaucratic teletype memos for P.O.S.T.-84.
 * Index 0 starts UNREAD with Commissar Volkov's mandatory SKALA-84 calibration directive.
 */
export function createInitialPost84Inbox(): Post84Message[] {
  return [
    {
      id: VOLKOV_ONBOARDING_MAIL_ID,
      sender: 'COMMISSAR VOLKOV',
      orgTag: 'SECTOR-84 COMMAND',
      subject: 'MANDATORY RBMK-1000 CALIBRATION // SKALA-84',
      timestamp: '04.11.1984 // 00:00',
      bodyLines: [
        'Comrade Operator! Before regional grid orders begin tonight, Politburo Decree 84-C requires mandatory RBMK-1000 Operator Calibration.',
        'Click ACCEPT below, then watch the giant central SKALA-84 wall CRT to calibrate cooling pumps, rods, 6 grid sectors, fuel refueling, steam pressure, Voids & Xenon.',
        'Click ACCEPT to begin SKALA-84 training now, or SKIP if you are already a certified Soviet operator.',
      ],
      status: 'unread',
      trainingDirective: {
        state: 'pending',
      },
    },
    {
      id: VOLKOR_WELCOME_MAIL_ID,
      sender: 'DIRECTOR VOLKOR',
      orgTag: 'PARTY COMMISSAR // SECTOR-84',
      subject: 'WELCOME TO NIGHT SHIFT, COMRADE',
      timestamp: '04.11.1984 // 23:58',
      bodyLines: [
        'Attention, Comrade! All oxygen inhaled in Sector 84 is State property. Blinking steals 0.2 seconds from the Five-Year Plan; hesitation is bourgeois decadence.',
        'Your predecessor sighed near a pressure gauge and was demoted to counting snowflakes in Siberia. Glowing green mist is merely patriotic fervor.',
        'Sit straight and await further orders. Meltdown is Propaganda. -- Dir. Volkor',
      ],
      status: 'read',
    },
    {
      id: 'mail-canteen-cabbage',
      sender: 'CANTEEN NO. 4',
      orgTag: 'MESS HALL',
      subject: 'TUESDAY CABBAGE ALLOCATION',
      timestamp: '04.11.1984 // 18:15',
      bodyLines: [
        "Effective tonight, 'Mystery Meatloaf' is upgraded to 'Patriotic Grey Loaf'. Complaints about crunching sounds will be forwarded to State Security.",
        'Stop using Primary Reactor Steam Pipe #2 to boil pelmeni. The last batch set off three Geiger counters in the break room.',
        'Bring your own spoon. Forks remain under Politburo review.',
      ],
      status: 'read',
    },
    {
      id: 'mail-kristianov-bobblehead',
      sender: 'KOMRAD KRISTIANOV',
      orgTag: 'REACTOR DIV.',
      subject: 'DO NOT POKE MY BOBBLEHEAD',
      timestamp: '04.11.1984 // 19:42',
      bodyLines: [
        'To whoever worked Day Shift: stop flicking my desk bobblehead. Its spring neck now nods aggressively at the AZ-5 cover.',
        "Also, quit filing tickets about the rattling noise behind Panel 3. Engineering has officially classified that vibration as 'structurally optimistic'.",
        'Touch my cold borscht again and your desk lamp goes down to 4 watts.',
      ],
      status: 'read',
    },
    {
      id: 'mail-health-eyebrows',
      sender: 'DEPT. OF HEALTH & MORALE',
      orgTag: 'MED-SEC 84',
      subject: 'EXTRA EYEBROW HAIR LOSS',
      timestamp: '04.11.1984 // 20:30',
      bodyLines: [
        'Sudden eyebrow thinning reduces drag during emergency drills and is officially classified as a productivity gain.',
        'A metallic taste in the mouth is merely deep appreciation for Soviet steel. Gargle with lukewarm beet brine and resume duty.',
        'Lead-lined underpants remain backordered until the 1989 Five-Year Plan.',
      ],
      status: 'read',
    },
    {
      id: 'mail-maintenance-beaker',
      sender: 'PLANT MAINTENANCE',
      orgTag: 'UTILITIES',
      subject: 'MISSING CHAIR SCREWS & COFFEE',
      timestamp: '04.11.1984 // 21:50',
      bodyLines: [
        'Do NOT drink the dark liquid in the unmarked beaker by Turbine Hall C. It is 1978 pump grease, not coffee, despite identical aroma.',
        'Regarding missing chair screws: please lean slightly left to maintain socialist equilibrium until bolt rations arrive.',
        'The squeak in Office Chair #2 is now officially a State Secret. Do not oil it.',
      ],
      status: 'read',
    },
    {
      id: 'mail-hr-saturday',
      sender: 'HR / PARTY ARCHIVE',
      orgTag: 'POLITOTDEL',
      subject: 'MANDATORY VOLUNTARY SATURDAY',
      timestamp: '04.11.1984 // 22:40',
      bodyLines: [
        "Attendance at this weekend's Mandatory Voluntary Saturday is 100% optional, provided you wish to keep your locker and boots.",
        'Compulsory spontaneous joy begins at 06:00 sharp for the shift inspection. Bring an approved patriotic grin.',
        'Reminder: frowning near the dosimeters carries an automatic 15-Ruble fine.',
      ],
      status: 'read',
    },
  ]
}

export function createVolkorTutorialFollowupMail(): Post84Message {
  return {
    id: VOLKOR_TUTORIAL_MAIL_ID,
    sender: 'DIRECTOR VOLKOR',
    orgTag: 'PARTY COMMISSAR // SECTOR-84',
    subject: 'MANDATORY COLD-START DIRECTIVE // KOMRAD-84',
    timestamp: '04.11.1984 // 23:59',
    bodyLines: [
      'Stop admiring State furniture like a lazy Western tourist! Stand up [E] and march at once to the main CRT screen in the middle of the control room.',
      "Obey KOMRAD-84's step-by-step cold-start tutorial without question. It is 100% infallible Marxist-Leninist silicon: it never sleeps or asks for lunch breaks.",
      'KOMRAD-84 logs all capitalist incompetence directly to my desk. Move! -- Dir. Volkor',
    ],
    status: 'unread',
  }
}

function formatOrderTimestamp(shiftTimeMinutes: number): string {
  const clamped = Math.max(0, Math.floor(shiftTimeMinutes))
  const hours = Math.floor(clamped / 60) % 24
  const mins = clamped % 60
  return `04.11.1984 // ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function createShuffledOrderDeck(
  avoidFirstId?: Post84OrderTemplateId
): Post84OrderTemplateId[] {
  const deck = [...POST84_ORDER_TEMPLATE_IDS]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  if (avoidFirstId && deck.length > 1 && deck[0] === avoidFirstId) {
    const lastIdx = deck.length - 1
    const tmp = deck[0]
    deck[0] = deck[lastIdx]
    deck[lastIdx] = tmp
  }
  return deck
}

/**
 * Computes real electrical MW delivered per sector backed by actual grid generation + UNIT C batteries.
 * Prevents fake slider cheating when reactor + battery output cannot back allocated sector MW.
 */
export function computeDeliveredPost84Power(
  telemetry: Post84LiveTelemetry
): Post84DeliveredPower {
  const pripyatAlloc = Math.max(0, telemetry.sectorMW.pripyat)
  const dugaAlloc = Math.max(0, telemetry.sectorMW.duga)
  const kolkhozAlloc = Math.max(0, telemetry.sectorMW.kolkhoz)
  const kgbAlloc = Math.max(0, telemetry.sectorMW.kgb)
  const vodkaAlloc = Math.max(0, telemetry.sectorMW.vodka)
  const steelAlloc = Math.max(0, telemetry.sectorMW.steel)

  const totalAllocatedMW =
    pripyatAlloc + dugaAlloc + kolkhozAlloc + kgbAlloc + vodkaAlloc + steelAlloc

  const availableGridMW =
    telemetry.isBlackout || telemetry.az5Active
      ? 0
      : Math.max(0, Math.round(telemetry.totalElectricalMW))

  if (totalAllocatedMW <= 0 || availableGridMW <= 0) {
    return {
      totalAllocatedMW,
      availableGridMW,
      totalDeliveredMW: 0,
      deliveryRatio: 0,
      isPowerShortfall: totalAllocatedMW > 0,
      sectorDeliveredMW: {
        pripyat: 0,
        duga: 0,
        kolkhoz: 0,
        kgb: 0,
        vodka: 0,
        steel: 0,
      },
    }
  }

  const totalDeliveredMW = Math.min(totalAllocatedMW, availableGridMW)
  const deliveryRatio = totalDeliveredMW / totalAllocatedMW
  const isPowerShortfall = availableGridMW + 5 < totalAllocatedMW

  return {
    totalAllocatedMW,
    availableGridMW,
    totalDeliveredMW,
    deliveryRatio,
    isPowerShortfall,
    sectorDeliveredMW: {
      pripyat: Math.round(pripyatAlloc * deliveryRatio),
      duga: Math.round(dugaAlloc * deliveryRatio),
      kolkhoz: Math.round(kolkhozAlloc * deliveryRatio),
      kgb: Math.round(kgbAlloc * deliveryRatio),
      vodka: Math.round(vodkaAlloc * deliveryRatio),
      steel: Math.round(steelAlloc * deliveryRatio),
    },
  }
}

interface OrderTemplateBlueprint {
  sender: string
  orgTag: string
  subject: string
  bodyLines: string[]
  holdDurationSec: number
  rewardRub: number
  quotaPoints: number
  objectiveSummary: string
  arrivalVox: string
  powerTargets: {
    minTotalMW?: number
    sectorMinMW?: Partial<Record<SectorNodeId, number>>
    sectorMaxMW?: Partial<Record<SectorNodeId, number>>
  }
}

const ORDER_BLUEPRINTS: Record<Post84OrderTemplateId, OrderTemplateBlueprint> = {
  municipal_heating: {
    sender: 'PRIPYAT HOUSING DEPT.',
    orgTag: 'MUNICIPAL ELECTRIC',
    subject: 'FROZEN MUNICIPAL HEATING PIPES',
    bodyLines: [
      'The Mayor reports his bathroom radiator has frozen into an ideological sculpture of Lenin.',
      'Supply >= 175 MW of emergency electric heating power to Sector 1 (Pripyat City) for 15s.',
    ],
    holdDurationSec: 15,
    rewardRub: 190,
    quotaPoints: 1,
    objectiveSummary: 'PRIPYAT >= 175 MW (HOLD 15s)',
    arrivalVox:
      'ATTENTION COMRADE OPERATOR. NEW STATE POWER DIRECTIVE FOR PRIPYAT CITY RECEIVED ON DESK TERMINAL.',
    powerTargets: {
      sectorMinMW: { pripyat: 175 },
    },
  },
  vodka_batch: {
    sender: 'GLAVSPIRTPROM',
    orgTag: 'DISTILLERY HQ',
    subject: 'VODKA DISTILLERY NIGHT BATCH',
    bodyLines: [
      'Party Congress delegates arrive by midnight and our potato stills are currently running on lukewarm patriotism.',
      'Supply >= 175 MW of electrical power to Sector 5 (Vodka Plant) for 15s so the night mash hits 96 proof.',
    ],
    holdDurationSec: 15,
    rewardRub: 180,
    quotaPoints: 1,
    objectiveSummary: 'VODKA PLANT >= 175 MW (HOLD 15s)',
    arrivalVox:
      'ATTENTION COMRADE OPERATOR. NEW STATE POWER DIRECTIVE FOR VODKA PLANT RECEIVED ON DESK TERMINAL.',
    powerTargets: {
      sectorMinMW: { vodka: 175 },
    },
  },
  kolkhoz_lamps: {
    sender: 'KOLKHOZ ZARYA #3',
    orgTag: 'STATE AGRO-COMPLEX',
    subject: 'MIDNIGHT POTATO UV LAMP SURGE',
    bodyLines: [
      'Subterranean winter potato lamps dimmed during the midnight tuber count, threatening tomorrow’s starch quota.',
      'Supply >= 175 MW of electrical power to Sector 3 (Kolkhoz Farm) for 15s to keep every grow lamp blazing.',
    ],
    holdDurationSec: 15,
    rewardRub: 185,
    quotaPoints: 1,
    objectiveSummary: 'KOLKHOZ FARM >= 175 MW (HOLD 15s)',
    arrivalVox:
      'ATTENTION COMRADE OPERATOR. NEW STATE POWER DIRECTIVE FOR KOLKHOZ FARM RECEIVED ON DESK TERMINAL.',
    powerTargets: {
      sectorMinMW: { kolkhoz: 175 },
    },
  },
  tractor_foundry: {
    sender: "PEOPLE'S FOUNDRY #4",
    orgTag: 'HEAVY INDUSTRY',
    subject: 'FOUNDRY POUR & BOTTLING PEAK',
    bodyLines: [
      'Our arc welders fusing "agricultural tractors" with armor-grade plows collide with the Vodka Plant bottling rush tonight.',
      'Deliver >= 175 MW to Sector 6 (Steel Works) AND >= 150 MW to Sector 5 (Vodka Plant) simultaneously for 18s.',
    ],
    holdDurationSec: 18,
    rewardRub: 230,
    quotaPoints: 1,
    objectiveSummary: 'STEEL >= 175 MW & VODKA >= 150 MW (18s)',
    arrivalVox:
      'ATTENTION COMRADE OPERATOR. NEW STATE POWER DIRECTIVE FOR STEEL WORKS AND VODKA PLANT RECEIVED ON DESK TERMINAL.',
    powerTargets: {
      sectorMinMW: { steel: 175, vodka: 150 },
    },
  },
  duga_radar: {
    sender: 'DUGA-1 COMMAND',
    orgTag: 'MINISTRY OF DEFENSE',
    subject: 'DUGA-1 "WOODPECKER" RADAR SWEEP',
    bodyLines: [
      'Radar operators spotted a suspicious Western weather balloon near Finland that demands full-power microwave tracking.',
      'Deliver >= 200 MW to Sector 2 (Duga-1 Radar) while rationing Sector 3 (Kolkhoz Farm) to <= 50 MW for 15s.',
    ],
    holdDurationSec: 15,
    rewardRub: 215,
    quotaPoints: 1,
    objectiveSummary: 'DUGA-1 >= 200 MW & KOLKHOZ <= 50 MW (15s)',
    arrivalVox:
      'ATTENTION COMRADE OPERATOR. NEW STATE POWER DIRECTIVE FOR DUGA RADAR RECEIVED ON DESK TERMINAL.',
    powerTargets: {
      sectorMinMW: { duga: 200 },
      sectorMaxMW: { kolkhoz: 50 },
    },
  },
  kgb_interrogation: {
    sender: 'KGB BUNKER #7',
    orgTag: 'STATE SECURITY',
    subject: 'MIDNIGHT INTERROGATION FLOODLIGHTS',
    bodyLines: [
      'State Security Bunker #7 is running extra-bright interrogation floodlights and reel-to-reel tape arrays until dawn.',
      'Deliver >= 175 MW to Sector 4 (KGB Bunker #7) while capping Sector 1 (Pripyat City) at <= 50 MW for 15s.',
    ],
    holdDurationSec: 15,
    rewardRub: 210,
    quotaPoints: 1,
    objectiveSummary: 'KGB #7 >= 175 MW & PRIPYAT <= 50 MW (15s)',
    arrivalVox:
      'ATTENTION COMRADE OPERATOR. NEW STATE POWER DIRECTIVE FOR KGB BUNKER SEVEN RECEIVED ON DESK TERMINAL.',
    powerTargets: {
      sectorMinMW: { kgb: 175 },
      sectorMaxMW: { pripyat: 50 },
    },
  },
  swan_lake_tv: {
    sender: 'GOSTELERADIO',
    orgTag: 'STATE TELEVISION',
    subject: 'STATE TV "SWAN LAKE" BROADCAST',
    bodyLines: [
      'State TV airs Swan Lake in high-contrast monochrome across every oblast tonight, and one dim living room means reindeer duty.',
      'Deliver >= 750 MW total electrical output across all 6 UNIT A grid sectors for 20s.',
    ],
    holdDurationSec: 20,
    rewardRub: 235,
    quotaPoints: 1,
    objectiveSummary: 'TOTAL OUTPUT >= 750 MW (HOLD 20s)',
    arrivalVox:
      'ATTENTION COMRADE OPERATOR. NEW STATE GRID OUTPUT DIRECTIVE RECEIVED ON DESK TERMINAL.',
    powerTargets: {
      minTotalMW: 750,
    },
  },
  volkor_driveway: {
    sender: 'DIRECTOR VOLKOR',
    orgTag: 'PARTY COMMISSAR // SECTOR-84',
    subject: "COMMISSAR VOLKOR'S HEATED DRIVEWAY",
    bodyLines: [
      'A single snowflake dared to land near my black Volga sedan, and my heated asphalt driveway and estate floodlights demand full power.',
      'Deliver >= 800 MW total electrical output across the grid for 18s until every snow crystal evaporates.',
    ],
    holdDurationSec: 18,
    rewardRub: 250,
    quotaPoints: 1,
    objectiveSummary: 'TOTAL OUTPUT >= 800 MW (HOLD 18s)',
    arrivalVox:
      'ATTENTION COMRADE OPERATOR. NEW STATE GRID OUTPUT DIRECTIVE RECEIVED ON DESK TERMINAL.',
    powerTargets: {
      minTotalMW: 800,
    },
  },
  moscow_inspection: {
    sender: 'MOSCOW GRID DISPATCH',
    orgTag: 'GOSPLAN ELECTRIFICATION',
    subject: 'PRAVDA REGIONAL SKYLINE AUDIT',
    bodyLines: [
      'Pravda cameramen are filming Sector 84 from orbit tonight to prove Soviet electricity outshines the entire West.',
      'Deliver >= 750 MW total across the grid with all 6 sectors simultaneously receiving >= 125 MW for 20s.',
    ],
    holdDurationSec: 20,
    rewardRub: 265,
    quotaPoints: 1,
    objectiveSummary: 'TOTAL >= 750 MW & ALL 6 SECTORS >= 125 MW (20s)',
    arrivalVox:
      'ATTENTION COMRADE OPERATOR. NEW STATE GRID OUTPUT DIRECTIVE RECEIVED ON DESK TERMINAL.',
    powerTargets: {
      minTotalMW: 750,
      sectorMinMW: {
        pripyat: 125,
        duga: 125,
        kolkhoz: 125,
        kgb: 125,
        vodka: 125,
        steel: 125,
      },
    },
  },
}

export function getPost84PowerOrderSpec(
  orderId: string,
  templateId: Post84OrderTemplateId,
  title: string
): ActivePost84PowerOrder {
  const bp = ORDER_BLUEPRINTS[templateId]
  return {
    orderId,
    templateId,
    title,
    ...(bp.powerTargets.minTotalMW !== undefined
      ? { minTotalMW: bp.powerTargets.minTotalMW }
      : {}),
    ...(bp.powerTargets.sectorMinMW
      ? { sectorMinMW: { ...bp.powerTargets.sectorMinMW } }
      : {}),
    ...(bp.powerTargets.sectorMaxMW
      ? { sectorMaxMW: { ...bp.powerTargets.sectorMaxMW } }
      : {}),
  }
}

export function createPost84OrderMessage(
  templateId: Post84OrderTemplateId,
  sequenceNum: number,
  shiftTimeMinutes: number
): Post84Message {
  const bp = ORDER_BLUEPRINTS[templateId]
  return {
    id: `mail-order-${sequenceNum}-${templateId}`,
    sender: bp.sender,
    orgTag: bp.orgTag,
    subject: bp.subject,
    timestamp: formatOrderTimestamp(shiftTimeMinutes),
    bodyLines: [...bp.bodyLines],
    status: 'unread',
    order: {
      templateId,
      orderState: 'pending',
      holdDurationSec: bp.holdDurationSec,
      holdProgressSec: 0,
      rewardRub: bp.rewardRub,
      quotaPoints: bp.quotaPoints,
      objectiveSummary: bp.objectiveSummary,
      arrivalVox: bp.arrivalVox,
    },
  }
}

const ALL_SECTOR_IDS: readonly SectorNodeId[] = [
  'pripyat',
  'duga',
  'kolkhoz',
  'kgb',
  'vodka',
  'steel',
]

function findStarvedUncappedSector(
  d: Record<SectorNodeId, number>,
  exempt: readonly SectorNodeId[],
  minMW = 50
): SectorNodeId | null {
  for (const id of ALL_SECTOR_IDS) {
    if (exempt.includes(id)) continue
    if (d[id] < minMW) return id
  }
  return null
}

export function evaluatePost84Order(
  templateId: Post84OrderTemplateId,
  telemetry: Post84LiveTelemetry,
  holdProgressSec: number,
  holdDurationSec: number,
  orderState: Post84OrderState
): Post84OrderEvaluation {
  const holdStr =
    orderState === 'completed'
      ? 'DONE'
      : orderState === 'active'
        ? `${holdProgressSec.toFixed(1)}/${holdDurationSec}s`
        : `HOLD ${holdDurationSec}s`

  const delivered = computeDeliveredPost84Power(telemetry)
  const d = delivered.sectorDeliveredMW
  const shortfallTag = delivered.isPowerShortfall ? ' [LOW GEN]' : ''

  switch (templateId) {
    case 'municipal_heating': {
      const starved = findStarvedUncappedSector(d, ['pripyat'])
      const starvedTag = starved ? ` [STARVED: ${starved.toUpperCase()} <50MW]` : ''
      const met = d.pripyat >= 175 && starved === null
      return {
        met,
        liveReadout: `PRIPYAT: ${d.pripyat}/>=175 MW${shortfallTag}${starvedTag} (${holdStr})`,
        detailLine:
          'UNIT A #1 (PRIPYAT) >= 175 MW // KEEP OTHER SECTORS >= 50 MW',
      }
    }
    case 'vodka_batch': {
      const starved = findStarvedUncappedSector(d, ['vodka'])
      const starvedTag = starved ? ` [STARVED: ${starved.toUpperCase()} <50MW]` : ''
      const met = d.vodka >= 175 && starved === null
      return {
        met,
        liveReadout: `VODKA: ${d.vodka}/>=175 MW${shortfallTag}${starvedTag} (${holdStr})`,
        detailLine:
          'UNIT A #5 (VODKA) >= 175 MW // KEEP OTHER SECTORS >= 50 MW',
      }
    }
    case 'kolkhoz_lamps': {
      const starved = findStarvedUncappedSector(d, ['kolkhoz'])
      const starvedTag = starved ? ` [STARVED: ${starved.toUpperCase()} <50MW]` : ''
      const met = d.kolkhoz >= 175 && starved === null
      return {
        met,
        liveReadout: `KOLKHOZ: ${d.kolkhoz}/>=175 MW${shortfallTag}${starvedTag} (${holdStr})`,
        detailLine:
          'UNIT A #3 (KOLKHOZ) >= 175 MW // KEEP OTHER SECTORS >= 50 MW',
      }
    }
    case 'tractor_foundry': {
      const starved = findStarvedUncappedSector(d, ['steel', 'vodka'])
      const starvedTag = starved ? ` [STARVED: ${starved.toUpperCase()} <50MW]` : ''
      const met = d.steel >= 175 && d.vodka >= 150 && starved === null
      return {
        met,
        liveReadout: `STEEL:${d.steel}/>=175 | VODKA:${d.vodka}/>=150 MW${shortfallTag}${starvedTag} (${holdStr})`,
        detailLine:
          'UNIT A #6 (STEEL) >= 175 & #5 (VODKA) >= 150 MW // OTHERS >= 50 MW',
      }
    }
    case 'duga_radar': {
      const starved = findStarvedUncappedSector(d, ['duga', 'kolkhoz'])
      const starvedTag = starved ? ` [STARVED: ${starved.toUpperCase()} <50MW]` : ''
      const met =
        d.duga >= 200 &&
        telemetry.sectorMW.kolkhoz <= 50 &&
        d.kolkhoz <= 50 &&
        starved === null
      return {
        met,
        liveReadout: `DUGA:${d.duga}/>=200 | KOLKHOZ:${d.kolkhoz}/<=50 MW${shortfallTag}${starvedTag} (${holdStr})`,
        detailLine:
          'UNIT A #2 (DUGA) >= 200 MW, #3 (KOLKHOZ) <= 50 MW & OTHERS >= 50 MW',
      }
    }
    case 'kgb_interrogation': {
      const starved = findStarvedUncappedSector(d, ['kgb', 'pripyat'])
      const starvedTag = starved ? ` [STARVED: ${starved.toUpperCase()} <50MW]` : ''
      const kgbOffTag = !telemetry.kgbLineActive ? ' [KGB LINE OFF]' : ''
      const met =
        d.kgb >= 175 &&
        telemetry.sectorMW.pripyat <= 50 &&
        d.pripyat <= 50 &&
        telemetry.kgbLineActive &&
        starved === null
      return {
        met,
        liveReadout: `KGB #7:${d.kgb}/>=175 | PRIPYAT:${d.pripyat}/<=50 MW${shortfallTag}${kgbOffTag}${starvedTag} (${holdStr})`,
        detailLine:
          'UNIT A #4 (KGB) >= 175 MW, #1 (PRIPYAT) <= 50 MW, OTHERS >= 50 MW & UNIT C KGB LINE ON',
      }
    }
    case 'swan_lake_tv': {
      const met = delivered.totalDeliveredMW >= 750
      return {
        met,
        liveReadout: `GRID DELIVERED: ${delivered.totalDeliveredMW} / >=750 MW${shortfallTag} (${holdStr})`,
        detailLine: 'UNIT A LEVERS #1-#6 -> >= 750 MW TOTAL DELIVERED',
      }
    }
    case 'volkor_driveway': {
      const met = delivered.totalDeliveredMW >= 800
      return {
        met,
        liveReadout: `GRID DELIVERED: ${delivered.totalDeliveredMW} / >=800 MW${shortfallTag} (${holdStr})`,
        detailLine: 'UNIT A LEVERS #1-#6 -> >= 800 MW TOTAL DELIVERED',
      }
    }
    case 'moscow_inspection': {
      const minSectorDelivered = Math.min(
        d.pripyat,
        d.duga,
        d.kolkhoz,
        d.kgb,
        d.vodka,
        d.steel
      )
      const kgbOffTag = !telemetry.kgbLineActive ? ' [KGB LINE OFF]' : ''
      const met =
        delivered.totalDeliveredMW >= 750 &&
        minSectorDelivered >= 125 &&
        telemetry.kgbLineActive
      return {
        met,
        liveReadout: `GRID:${delivered.totalDeliveredMW}/>=750 | MIN SECT:${minSectorDelivered}/>=125 MW${shortfallTag}${kgbOffTag} (${holdStr})`,
        detailLine:
          'UNIT A #1-#6 ALL >= 125 MW (>= 750 MW) & UNIT C KGB LINE ON',
      }
    }
  }
}
