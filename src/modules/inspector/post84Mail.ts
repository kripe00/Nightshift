export type Post84MessageStatus = 'unread' | 'read'

export type Post84OrderState = 'pending' | 'active' | 'completed'

export type Post84TrainingDirectiveState = 'pending' | 'accepted' | 'skipped'

export type Post84OrderTemplateId =
  | 'vodka_batch'
  | 'tractor_foundry'
  | 'swan_lake_tv'
  | 'municipal_heating'
  | 'volkor_driveway'
  | 'moscow_inspection'
  | 'duga_radar'

export interface Post84LiveTelemetry {
  totalElectricalMW: number
  energyCreatedMW: number
  pressureBar: number
  gridHz: number
  avrActive: boolean
  kgbLineActive: boolean
  radiationLevel: number
  waterReservoir: number
  bubblerLevel: number
  containmentSealLocked: boolean
  coreTemp: number
  sectorMW: {
    pripyat: number
    duga: number
    kolkhoz: number
    kgb: number
    vodka: number
    steel: number
  }
}

export interface Post84OrderSpec {
  templateId: Post84OrderTemplateId
  orderState: Post84OrderState
  holdDurationSec: number
  holdProgressSec: number
  rewardRub: number
  quotaPoints: number
  objectiveSummary: string
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

export const POST84_ORDER_TEMPLATE_IDS: Post84OrderTemplateId[] = [
  'vodka_batch',
  'tractor_foundry',
  'swan_lake_tv',
  'municipal_heating',
  'volkor_driveway',
  'moscow_inspection',
  'duga_radar',
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

interface OrderTemplateBlueprint {
  sender: string
  orgTag: string
  subject: string
  bodyLines: string[]
  holdDurationSec: number
  rewardRub: number
  quotaPoints: number
  objectiveSummary: string
}

const ORDER_BLUEPRINTS: Record<Post84OrderTemplateId, OrderTemplateBlueprint> = {
  vodka_batch: {
    sender: 'GLAVSPIRTPROM',
    orgTag: 'DISTILLERY HQ',
    subject: 'VODKA DISTILLERY NIGHT BATCH',
    bodyLines: [
      'Party Congress delegates arrive by midnight and our potato stills are currently running on lukewarm patriotism.',
      'Boost Sector 5 (Vodka Plant) on UNIT A to >= 175 MW and hold 15s so the night mash hits 96 proof.',
    ],
    holdDurationSec: 15,
    rewardRub: 180,
    quotaPoints: 1,
    objectiveSummary: 'VODKA SECTOR >= 175 MW (HOLD 15s)',
  },
  tractor_foundry: {
    sender: "PEOPLE'S FOUNDRY #4",
    orgTag: 'HEAVY INDUSTRY',
    subject: 'TRACTOR & TANK FOUNDRY SURGE',
    bodyLines: [
      'Our arc welders fusing "agricultural tractors" with 120mm plows keep dimming the town streetlights.',
      'Divert >= 175 MW to Sector 6 (Steel Works) on UNIT A while keeping grid sync at 50.0 Hz (AVR ON) for 15s.',
    ],
    holdDurationSec: 15,
    rewardRub: 200,
    quotaPoints: 1,
    objectiveSummary: 'STEEL >= 175 MW & 50.0 Hz SYNC (HOLD 15s)',
  },
  swan_lake_tv: {
    sender: 'GOSTELERADIO',
    orgTag: 'STATE TELEVISION',
    subject: 'STATE TV "SWAN LAKE" BROADCAST',
    bodyLines: [
      'State TV airs Swan Lake in high-contrast monochrome tonight, and any flicker on the General Secretary screen means reindeer duty.',
      'Hold Total Electrical output >= 675 MW with grid frequency synced near 50.0 Hz for 15s.',
    ],
    holdDurationSec: 15,
    rewardRub: 220,
    quotaPoints: 1,
    objectiveSummary: 'TOTAL OUTPUT >= 675 MW & 50.0 Hz (HOLD 15s)',
  },
  municipal_heating: {
    sender: 'PRIPYAT HOUSING DEPT.',
    orgTag: 'MUNICIPAL STEAM',
    subject: 'FROZEN MUNICIPAL HEATING PIPES',
    bodyLines: [
      'The Mayor reports his bathroom radiator has frozen into an ideological sculpture of Lenin.',
      'Hold Steam Drum Pressure in 65-78 BAR while supplying >= 150 MW to Sector 1 (Pripyat) for 15s without popping a seal.',
    ],
    holdDurationSec: 15,
    rewardRub: 190,
    quotaPoints: 1,
    objectiveSummary: 'PRESSURE 65-78 BAR & PRIPYAT >= 150 MW (15s)',
  },
  volkor_driveway: {
    sender: 'DIRECTOR VOLKOR',
    orgTag: 'PARTY COMMISSAR // SECTOR-84',
    subject: "COMMISSAR VOLKOR'S HEATED DRIVEWAY",
    bodyLines: [
      'A single snowflake dared to land near my black Volga sedan and the heated asphalt coils demand immediate megawatts.',
      'Raise Control Rods [UNIT A-2] and Feedwater [UNIT B] to generate >= 750 MW Energy Created for 18s.',
    ],
    holdDurationSec: 18,
    rewardRub: 240,
    quotaPoints: 1,
    objectiveSummary: 'ENERGY CREATED >= 750 MW (HOLD 18s)',
  },
  moscow_inspection: {
    sender: 'MOSCOW SAFETY BOARD',
    orgTag: 'SHOW-TRIAL AUDIT',
    subject: 'MOSCOW SAFETY SHOW-TRIAL INSPECTION',
    bodyLines: [
      'Pravda photographers are outside capturing "the safest reactor on Earth", so conceal any glowing puddles at once.',
      'Lock all 3 Seals [UNIT B] and keep Rad <= 0.8 R/h, Water >= 70%, Bubbler <= 65%, and Grid >= 550 MW for 20s.',
    ],
    holdDurationSec: 20,
    rewardRub: 260,
    quotaPoints: 1,
    objectiveSummary: 'SEALS LOCKED, RAD<=0.8, H2O>=70%, BUB<=65%, >=550 MW (20s)',
  },
  duga_radar: {
    sender: 'DUGA-1 COMMAND',
    orgTag: 'MINISTRY OF DEFENSE',
    subject: 'DUGA-1 "WOODPECKER" RADAR SWEEP',
    bodyLines: [
      'Radar operators spotted a suspicious seagull near Finland that may be an unauthorized NATO spy drone.',
      'Divert >= 175 MW to Sector 2 (Duga-1 Radar) on UNIT A with KGB Line ON [UNIT C] for 15s to rattle Western jazz radio.',
    ],
    holdDurationSec: 15,
    rewardRub: 210,
    quotaPoints: 1,
    objectiveSummary: 'DUGA-1 >= 175 MW & KGB LINE ON (HOLD 15s)',
  },
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
    },
  }
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

  switch (templateId) {
    case 'vodka_batch': {
      const met = telemetry.sectorMW.vodka >= 175
      return {
        met,
        liveReadout: `CURRENT: ${Math.round(telemetry.sectorMW.vodka)} MW / TARGET: >= 175 MW (${holdStr})`,
        detailLine: 'UNIT A LEVER #5 (VODKA) // AUTO-COMPLETES WHEN HELD',
      }
    }
    case 'tractor_foundry': {
      const met =
        telemetry.sectorMW.steel >= 175 &&
        telemetry.gridHz >= 49.5 &&
        telemetry.gridHz <= 50.5 &&
        telemetry.avrActive
      return {
        met,
        liveReadout: `STEEL: ${Math.round(telemetry.sectorMW.steel)}/>=175MW | ${telemetry.gridHz.toFixed(1)}Hz AVR:${telemetry.avrActive ? 'ON' : 'OFF'} (${holdStr})`,
        detailLine: 'UNIT A LEVER #6 (STEEL) + UNIT C AVR ON',
      }
    }
    case 'swan_lake_tv': {
      const met =
        telemetry.totalElectricalMW >= 675 &&
        telemetry.gridHz >= 49.5 &&
        telemetry.gridHz <= 50.5
      return {
        met,
        liveReadout: `GRID: ${Math.round(telemetry.totalElectricalMW)}/>=675MW | ${telemetry.gridHz.toFixed(1)}/50.0Hz (${holdStr})`,
        detailLine: 'UNIT A LEVERS / UNIT C WHEEL >= 675 MW @ 50.0 Hz',
      }
    }
    case 'municipal_heating': {
      const met =
        telemetry.pressureBar >= 65 &&
        telemetry.pressureBar <= 78 &&
        telemetry.sectorMW.pripyat >= 150
      return {
        met,
        liveReadout: `BAR: ${telemetry.pressureBar.toFixed(1)} (65-78) | PRIPYAT: ${Math.round(telemetry.sectorMW.pripyat)}/>=150MW (${holdStr})`,
        detailLine: 'UNIT B/A-2 STEAM 65-78 BAR + UNIT A LEVER #1 PRIPYAT',
      }
    }
    case 'volkor_driveway': {
      const met = telemetry.energyCreatedMW >= 750
      return {
        met,
        liveReadout: `CREATED: ${Math.round(telemetry.energyCreatedMW)} MW / TARGET: >= 750 MW (${holdStr})`,
        detailLine: 'UNIT A-2 RODS & UNIT B FEEDWATER -> >= 750 MW CREATED',
      }
    }
    case 'moscow_inspection': {
      const met =
        telemetry.radiationLevel <= 0.8 &&
        telemetry.waterReservoir >= 70 &&
        telemetry.bubblerLevel <= 65 &&
        telemetry.containmentSealLocked &&
        telemetry.totalElectricalMW >= 550
      return {
        met,
        liveReadout: `SEALS:${telemetry.containmentSealLocked ? 'OK' : 'NO'} RAD:${telemetry.radiationLevel.toFixed(1)} H2O:${Math.round(telemetry.waterReservoir)}% BUB:${Math.round(telemetry.bubblerLevel)}% MW:${Math.round(telemetry.totalElectricalMW)} (${holdStr})`,
        detailLine: 'UNIT B 3 SEALS LOCKED, RAD<=0.8, H2O>=70%, BUB<=65%, >=550 MW',
      }
    }
    case 'duga_radar': {
      const met = telemetry.sectorMW.duga >= 175 && telemetry.kgbLineActive
      return {
        met,
        liveReadout: `DUGA-1: ${Math.round(telemetry.sectorMW.duga)}/>=175MW | KGB LINE:${telemetry.kgbLineActive ? 'ON' : 'OFF'} (${holdStr})`,
        detailLine: 'UNIT A LEVER #2 (DUGA-1) + UNIT C KGB LINE ON',
      }
    }
  }
}
