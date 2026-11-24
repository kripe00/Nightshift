import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type {
  KomradMessageEntry,
  Post84InboxSnapshot,
  Post84SavedMessage,
  TerminalLogEntry,
} from '../../shared/types'
import { useGameStore } from '../../shared/useGameStore'
import { useDeskStore } from './useDeskStore'
import { onKremlinFontReady } from '../../shared/kremlinFontReady'
import { controlRoomPowerState } from '../../shared/ControlRoomScene'
import { notifyPost84OrderEvent } from '../../shared/komradSilenceState'
import { saveCurrentShiftToStorage } from '../../shared/shiftSaveStorage'
import {
  playCarriageReturnDing,
  playDetentClick,
  playOrderCompleteChime,
  playSwitchClank,
} from './audio'
import {
  DESKTOP_CANVAS_H,
  DESKTOP_CANVAS_W,
  completeActivePost84Order,
  createInitialDesktopOsState,
  deliverIncomingPost84Message,
  handleDesktopOsClick,
  hitTestDesktopOs,
  paintDesktopOsCanvas,
  uvToCanvasCoords,
  type DesktopOsState,
  type DesktopTelemetrySnapshot,
} from './desktopOsCanvas'
import {
  POST84_ORDER_COMPLETED_VOX,
  POST84_ORDER_TEMPLATE_IDS,
  VOLKOV_ONBOARDING_MAIL_ID,
  createPost84OrderMessage,
  createShuffledOrderDeck,
  evaluatePost84Order,
  getPost84PowerOrderSpec,
  type Post84LiveTelemetry,
  type Post84Message,
  type Post84OrderTemplateId,
} from './post84Mail'

const NOOP_RAYCAST: THREE.Object3D['raycast'] = () => {}

const MOUSE_RANGE_X = 0.052
const MOUSE_RANGE_Z = 0.044
const MOUSE_TARGET_DEADZONE = 0.0028
const MOUSE_SETTLE_EPS = 0.0005
const MOUSE_DAMP_SEATED = 11
const MOUSE_DAMP_RETURN = 9
const FIRST_ORDER_DELAY_AFTER_TUTORIAL_SEC = 20.0
const ORDER_COOLDOWN_MIN_SEC = 45.0
const ORDER_COOLDOWN_MAX_SEC = 60.0
const ORDER_ALERT_FLASH_DURATION_SEC = 4.5

function formatShiftHM(shiftTimeMinutes: number): string {
  const totalMins = Math.floor(Math.max(0, Math.min(360, shiftTimeMinutes)))
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function formatShiftHMS(shiftTimeMinutes: number): string {
  const totalSeconds = Math.floor(Math.max(0, Math.min(360, shiftTimeMinutes)) * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

let post84LogSeq = 0

function pushKomradTerminalNotice(
  text: string,
  level: 'normal' | 'warn',
  sender: 'PRINTER' | 'K.O.M.R.A.D.-84' | 'OPERATOR',
  pushToKomradWall = true,
  spokenVoxText?: string
): void {
  post84LogSeq += 1
  const cur = useGameStore.getState()
  const hm = formatShiftHM(cur.shiftTimeMinutes)
  const hms = formatShiftHMS(cur.shiftTimeMinutes)
  const entry: TerminalLogEntry = {
    id: `post84-log-${post84LogSeq}`,
    timestamp: hm,
    sender,
    text,
    level,
  }
  const komradMsg: KomradMessageEntry = {
    id: `post84-kmsg-${post84LogSeq}`,
    timestamp: hms,
    sender,
    text,
    ...(spokenVoxText ? { spokenVoxText } : {}),
    mood: level === 'warn' ? 'warning' : 'normal',
  }
  useGameStore.setState((prev) => ({
    lastDecisionFeedback: text,
    terminalEntries: [...prev.terminalEntries.slice(-24), entry],
    terminalLogs: [
      ...prev.terminalLogs.slice(-24),
      `[${entry.timestamp}] ${entry.sender}: ${entry.text}`,
    ],
    ...(pushToKomradWall
      ? { komradMessages: [...prev.komradMessages.slice(-18), komradMsg] }
      : {}),
  }))
}

function readTelemetrySnapshot(osState?: DesktopOsState): {
  snapshot: DesktopTelemetrySnapshot
  key: string
} {
  const gs = useGameStore.getState()
  const ds = useDeskStore.getState()

  const snapshot: DesktopTelemetrySnapshot = {
    shiftNumber: gs.shiftNumber,
    shiftTimeMinutes: gs.shiftTimeMinutes,
    tutorialPhase: gs.tutorialPhase,
    isBlackout: gs.isBlackout,
    az5Active: gs.az5Active,
    coreTemp: gs.coreTemp,
    pressureBar: gs.pressureBar,
    energyCreatedMW: gs.energyCreatedMW,
    totalElectricalMW: gs.totalElectricalMW,
    energyDemandMW: gs.energyDemandMW,
    batteryStoredPct: gs.batteryStoredPct,
    radiationLevel: gs.radiationLevel,
    gridHz: gs.gridHz,
    waterReservoir: gs.waterReservoir,
    avrActive: gs.avrActive,
    kgbLineActive: gs.kgbLineActive,
    bubblerLevel: gs.bubblerLevel,
    containmentSealLocked: gs.containmentSealLocked,
    sectorMW: { ...gs.sectorMW },
    targetSectorMW: { ...gs.targetSectorMW },
    coolingMW: gs.powerAllocation.cooling,
    defenseMW: gs.powerAllocation.defense,
    facilityMW: gs.powerAllocation.facility,
    commendations: ds.commendations,
    citations: ds.citations,
    rubles: gs.rubles,
    quotaCompleted: gs.quotaCompleted,
    activeMandateTitle: gs.activeMandate ? gs.activeMandate.title : null,
    activeMandateText: gs.activeMandate ? gs.activeMandate.requirementText : null,
    recentLogs: [],
    latestKomradLine: null,
  }

  const isMailOpen = osState ? osState.openWindows.includes('mail') : false
  const selectedOrderMsg =
    isMailOpen && osState?.selectedMailId
      ? osState.mailMessages.find((m) => m.id === osState.selectedMailId)?.order
      : undefined

  const keyParts: Array<string | number> = [
    snapshot.shiftNumber,
    Math.floor(snapshot.shiftTimeMinutes),
    Math.round(snapshot.rubles),
    Math.round(snapshot.quotaCompleted),
    snapshot.isBlackout ? 1 : 0,
    Math.round(snapshot.coreTemp),
    snapshot.radiationLevel >= 8.0 ? 1 : 0,
  ]

  if (selectedOrderMsg) {
    keyParts.push(
      selectedOrderMsg.templateId,
      selectedOrderMsg.orderState,
      Math.round(snapshot.totalElectricalMW),
      snapshot.az5Active ? 1 : 0,
      snapshot.kgbLineActive ? 1 : 0,
      snapshot.sectorMW.pripyat,
      snapshot.sectorMW.duga,
      snapshot.sectorMW.kolkhoz,
      snapshot.sectorMW.kgb,
      snapshot.sectorMW.vodka,
      snapshot.sectorMW.steel,
      snapshot.targetSectorMW.pripyat,
      snapshot.targetSectorMW.duga,
      snapshot.targetSectorMW.kolkhoz,
      snapshot.targetSectorMW.kgb,
      snapshot.targetSectorMW.vodka,
      snapshot.targetSectorMW.steel
    )
  }

  return { snapshot, key: keyParts.join('|') }
}

function drawMonitorBadgeCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#0d110f'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#8c7a4b'
  ctx.fillRect(4, 4, w - 8, h - 8)
  ctx.strokeStyle = '#2b1a12'
  ctx.lineWidth = 2
  ctx.strokeRect(7, 7, w - 14, h - 14)

  ctx.fillStyle = '#0d110f'
  ctx.font = 'bold 20px "Kremlin", "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ISKRA-84 // ЭВМ', w / 2, h / 2 + 1, w - 24)
  ctx.restore()
}

function isValidOrderTemplateId(id: string): id is Post84OrderTemplateId {
  return (POST84_ORDER_TEMPLATE_IDS as readonly string[]).includes(id)
}

function serializePost84Snapshot(
  osState: DesktopOsState,
  orderDeck: Post84OrderTemplateId[],
  orderSequence: number,
  lastOrderTemplateId: Post84OrderTemplateId | undefined,
  orderSpawnCountdownSec: number | null,
  tutorialCompletedSeen: boolean
): Post84InboxSnapshot {
  const mailMessages: Post84SavedMessage[] = osState.mailMessages.map((m) => ({
    id: m.id,
    sender: m.sender,
    orgTag: m.orgTag,
    subject: m.subject,
    timestamp: m.timestamp,
    bodyLines: [...m.bodyLines],
    status: m.status,
    ...(m.order ? { order: { ...m.order } } : {}),
    ...(m.trainingDirective
      ? { trainingDirective: { ...m.trainingDirective } }
      : {}),
  }))
  return {
    mailMessages,
    selectedMailId: osState.selectedMailId,
    mailScrollOffset: osState.mailScrollOffset,
    mailEarnedRub: osState.mailEarnedRub,
    mailOrdersCompleted: osState.mailOrdersCompleted,
    lastStatusNotice: osState.lastStatusNotice,
    orderDeck: [...orderDeck],
    orderSequence,
    ...(lastOrderTemplateId ? { lastOrderTemplateId } : {}),
    orderSpawnCountdownSec,
    tutorialCompletedSeen,
  }
}

function hydratePost84Snapshot(snapshot: Post84InboxSnapshot): {
  osState: DesktopOsState
  orderDeck: Post84OrderTemplateId[]
  orderSequence: number
  lastOrderTemplateId: Post84OrderTemplateId | undefined
  orderSpawnCountdownSec: number | null
  tutorialCompletedSeen: boolean
} {
  const mailMessages: Post84Message[] = snapshot.mailMessages.map((m) => {
    const order =
      m.order && isValidOrderTemplateId(m.order.templateId)
        ? {
            ...m.order,
            templateId: m.order.templateId,
          }
        : undefined
    return {
      id: m.id,
      sender: m.sender,
      orgTag: m.orgTag,
      subject: m.subject,
      timestamp: m.timestamp,
      bodyLines: Array.isArray(m.bodyLines) ? [...m.bodyLines] : [],
      status: m.status,
      ...(order ? { order } : {}),
      ...(m.trainingDirective
        ? { trainingDirective: { ...m.trainingDirective } }
        : {}),
    }
  })
  return {
    osState: {
      openWindows: [],
      minimizedWindows: [],
      mailMessages,
      selectedMailId: snapshot.selectedMailId ?? '',
      mailScrollOffset: snapshot.mailScrollOffset ?? 0,
      mailEarnedRub: snapshot.mailEarnedRub ?? 0,
      mailOrdersCompleted: snapshot.mailOrdersCompleted ?? 0,
      lastStatusNotice: snapshot.lastStatusNotice ?? 'INBOX SYNCED',
    },
    orderDeck: Array.isArray(snapshot.orderDeck)
      ? snapshot.orderDeck.filter(isValidOrderTemplateId)
      : [],
    orderSequence: snapshot.orderSequence ?? 0,
    lastOrderTemplateId:
      snapshot.lastOrderTemplateId &&
      isValidOrderTemplateId(snapshot.lastOrderTemplateId)
        ? snapshot.lastOrderTemplateId
        : undefined,
    orderSpawnCountdownSec:
      typeof snapshot.orderSpawnCountdownSec === 'number'
        ? snapshot.orderSpawnCountdownSec
        : null,
    tutorialCompletedSeen: Boolean(snapshot.tutorialCompletedSeen),
  }
}

export function DesktopComputer3D() {
  const isSeatedAtDesk = useGameStore((s) => s.isSeatedAtDesk)
  const osStateRef = useRef<DesktopOsState>(createInitialDesktopOsState())
  const hoveredIdRef = useRef<string | null>(null)
  const cursorPosRef = useRef<{ x: number; y: number } | null>(null)
  const latestTelemetryRef = useRef<DesktopTelemetrySnapshot>(readTelemetrySnapshot().snapshot)
  const lastTelemetryKeyRef = useRef<string>('')
  const lastShiftRunIdRef = useRef<number>(useGameStore.getState().shiftRunId)
  const telemetryAccumRef = useRef<number>(0)
  const dirtyRef = useRef<boolean>(true)
  const diskPulseRef = useRef<number>(0)
  const volkovPulseAccumRef = useRef<number>(0)
  const mailAlertFlashRef = useRef<number>(0)
  const alertBlinkStepRef = useRef<number>(-1)
  const tutorialCompletedSeenRef = useRef<boolean>(false)
  const orderSpawnCountdownRef = useRef<number | null>(null)
  const orderDeckRef = useRef<Post84OrderTemplateId[]>([])
  const orderSequenceRef = useRef<number>(0)
  const lastOrderTemplateRef = useRef<Post84OrderTemplateId | undefined>(undefined)
  const orderProgressPaintAccumRef = useRef<number>(0)
  const orderProgressSaveAccumRef = useRef<number>(0)

  const syncSnapshotToStore = () => {
    useGameStore
      .getState()
      .setPost84InboxSnapshot(
        serializePost84Snapshot(
          osStateRef.current,
          orderDeckRef.current,
          orderSequenceRef.current,
          lastOrderTemplateRef.current,
          orderSpawnCountdownRef.current,
          tutorialCompletedSeenRef.current
        )
      )
  }

  const applyStoreSnapshot = (snapshot: Post84InboxSnapshot) => {
    const hydrated = hydratePost84Snapshot(snapshot)
    osStateRef.current = hydrated.osState
    orderDeckRef.current = hydrated.orderDeck
    orderSequenceRef.current = hydrated.orderSequence
    lastOrderTemplateRef.current = hydrated.lastOrderTemplateId
    orderSpawnCountdownRef.current = hydrated.orderSpawnCountdownSec
    tutorialCompletedSeenRef.current = hydrated.tutorialCompletedSeen
    orderProgressSaveAccumRef.current = 0
  }

  const mouseGroupRef = useRef<THREE.Group | null>(null)
  const mouseTargetRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 })
  const screenMatRef = useRef<THREE.MeshBasicMaterial | null>(null)
  const bezelPowerLedMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const towerPowerLedMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const diskLedMatRef = useRef<THREE.MeshStandardMaterial | null>(null)

  const { screenCanvas, screenTex, markScreenTexUpdated } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = DESKTOP_CANVAS_W
    canvas.height = DESKTOP_CANVAS_H
    const tex = new THREE.CanvasTexture(canvas)
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    tex.colorSpace = THREE.SRGBColorSpace
    return {
      screenCanvas: canvas,
      screenTex: tex,
      markScreenTexUpdated: () => {
        tex.needsUpdate = true
      },
    }
  }, [])

  const badge = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 48
    const tex = new THREE.CanvasTexture(canvas)
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    tex.colorSpace = THREE.SRGBColorSpace
    const redraw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      drawMonitorBadgeCanvas(ctx, 256, 48)
      tex.needsUpdate = true
    }
    redraw()
    return { tex, redraw }
  }, [])

  const cableGeo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 28; i++) {
      const t = i / 28
      const x = THREE.MathUtils.lerp(-0.06, -0.26, t)
      const z = THREE.MathUtils.lerp(0.20, -0.14, t)
      const coil = i > 2 && i < 26 ? Math.sin(t * Math.PI * 10) * 0.012 : 0
      const y = 0.935 + Math.sin(t * Math.PI) * 0.01 + Math.abs(coil) * 0.35
      pts.push(new THREE.Vector3(x + coil, y, z))
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    return new THREE.TubeGeometry(curve, 28, 0.007, 6, false)
  }, [])

  const mouseCableGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.52, 0.942, 0.23),
      new THREE.Vector3(0.50, 0.935, 0.04),
      new THREE.Vector3(0.36, 0.935, -0.16),
      new THREE.Vector3(0.16, 0.945, -0.24),
    ])
    return new THREE.TubeGeometry(curve, 18, 0.0055, 6, false)
  }, [])

  useEffect(() => {
    const initSnap = useGameStore.getState().post84InboxSnapshot
    if (initSnap) {
      const hydrated = hydratePost84Snapshot(initSnap)
      osStateRef.current = hydrated.osState
      orderDeckRef.current = hydrated.orderDeck
      orderSequenceRef.current = hydrated.orderSequence
      lastOrderTemplateRef.current = hydrated.lastOrderTemplateId
      orderSpawnCountdownRef.current = hydrated.orderSpawnCountdownSec
      tutorialCompletedSeenRef.current = hydrated.tutorialCompletedSeen
      dirtyRef.current = true
    }
    const offFont = onKremlinFontReady(() => {
      badge.redraw()
      dirtyRef.current = true
    })
    return () => {
      offFont()
      screenTex.dispose()
      badge.tex.dispose()
      cableGeo.dispose()
      mouseCableGeo.dispose()
      useGameStore.getState().setActivePost84Order(null)
    }
  }, [badge, cableGeo, mouseCableGeo, screenTex])

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta)
    const gs = useGameStore.getState()

    if (gs.shiftRunId !== lastShiftRunIdRef.current) {
      lastShiftRunIdRef.current = gs.shiftRunId
      hoveredIdRef.current = null
      cursorPosRef.current = null
      mouseTargetRef.current.x = 0
      mouseTargetRef.current.z = 0
      volkovPulseAccumRef.current = 0
      mailAlertFlashRef.current = 0
      alertBlinkStepRef.current = -1
      orderProgressPaintAccumRef.current = 0
      orderProgressSaveAccumRef.current = 0
      if (gs.post84InboxSnapshot) {
        applyStoreSnapshot(gs.post84InboxSnapshot)
      } else {
        osStateRef.current = createInitialDesktopOsState()
        tutorialCompletedSeenRef.current = false
        orderSpawnCountdownRef.current = null
        orderDeckRef.current = []
        orderSequenceRef.current = 0
        lastOrderTemplateRef.current = undefined
      }
      dirtyRef.current = true
    }

    if (gs.tutorialPhase !== 'AWAITING_VOLKOV_MAIL') {
      const onboardingMsg = osStateRef.current.mailMessages.find(
        (m) => m.id === VOLKOV_ONBOARDING_MAIL_ID
      )
      if (onboardingMsg?.trainingDirective?.state === 'pending') {
        osStateRef.current = {
          ...osStateRef.current,
          mailMessages: osStateRef.current.mailMessages.map((m) =>
            m.id === VOLKOV_ONBOARDING_MAIL_ID && m.trainingDirective
              ? {
                  ...m,
                  status: 'read',
                  trainingDirective: {
                    state:
                      gs.tutorialPhase === 'COMPLETED' ? 'skipped' : 'accepted',
                  },
                }
              : m
          ),
          lastStatusNotice:
            gs.tutorialPhase === 'COMPLETED'
              ? 'CERTIFIED SKIP // LIVE SHIFT'
              : 'TRAINING DIRECTIVE ACCEPTED',
        }
        syncSnapshotToStore()
        dirtyRef.current = true
      }
    }

    // Post-tutorial genuine Orders loop (strictly 1 uncompleted order at a time)
    if (
      gs.phase === 'playing' &&
      gs.isShiftControlReady &&
      gs.tutorialPhase === 'COMPLETED'
    ) {
      if (!tutorialCompletedSeenRef.current) {
        tutorialCompletedSeenRef.current = true
        orderSpawnCountdownRef.current = FIRST_ORDER_DELAY_AFTER_TUTORIAL_SEC
        syncSnapshotToStore()
      }

      const uncompletedOrder = osStateRef.current.mailMessages.find(
        (m) => m.order && m.order.orderState !== 'completed'
      )

      if (uncompletedOrder?.order) {
        if (uncompletedOrder.order.orderState === 'active') {
          const liveTelemetry: Post84LiveTelemetry = {
            totalElectricalMW: gs.totalElectricalMW,
            isBlackout: gs.isBlackout,
            az5Active: gs.az5Active,
            kgbLineActive: gs.kgbLineActive,
            sectorMW: gs.sectorMW,
            targetSectorMW: gs.targetSectorMW,
          }
          const evalRes = evaluatePost84Order(
            uncompletedOrder.order.templateId,
            liveTelemetry,
            uncompletedOrder.order.holdProgressSec,
            uncompletedOrder.order.holdDurationSec,
            uncompletedOrder.order.orderState
          )
          if (evalRes.met) {
            uncompletedOrder.order.holdProgressSec = Math.min(
              uncompletedOrder.order.holdDurationSec,
              uncompletedOrder.order.holdProgressSec + dt
            )
          } else {
            uncompletedOrder.order.holdProgressSec = Math.max(
              0,
              uncompletedOrder.order.holdProgressSec - dt * 0.5
            )
          }

          if (
            osStateRef.current.openWindows.includes('mail') &&
            osStateRef.current.selectedMailId === uncompletedOrder.id
          ) {
            orderProgressPaintAccumRef.current += dt
            if (orderProgressPaintAccumRef.current >= 0.25) {
              orderProgressPaintAccumRef.current = 0
              dirtyRef.current = true
            }
          }

          if (
            uncompletedOrder.order.holdProgressSec >=
            uncompletedOrder.order.holdDurationSec
          ) {
            const { nextState, completedMessage } = completeActivePost84Order(
              osStateRef.current,
              uncompletedOrder.id
            )
            if (completedMessage?.order) {
              osStateRef.current = nextState
              mailAlertFlashRef.current = 3.5
              diskPulseRef.current = 0.75
              playOrderCompleteChime()
              notifyPost84OrderEvent()
              const storeApi = useGameStore.getState()
              storeApi.addRubles(completedMessage.order.rewardRub)
              storeApi.addQuotaCompleted(completedMessage.order.quotaPoints)
              storeApi.setActivePost84Order(null)
              pushKomradTerminalNotice(
                `DIRECTIVE COMPLETED: ${completedMessage.subject} — PAID +${completedMessage.order.rewardRub} RUB (+${completedMessage.order.quotaPoints} QUOTA)`,
                'normal',
                'K.O.M.R.A.D.-84',
                true,
                POST84_ORDER_COMPLETED_VOX
              )
              orderSpawnCountdownRef.current =
                ORDER_COOLDOWN_MIN_SEC +
                Math.random() * (ORDER_COOLDOWN_MAX_SEC - ORDER_COOLDOWN_MIN_SEC)
              orderProgressSaveAccumRef.current = 0
              syncSnapshotToStore()
              saveCurrentShiftToStorage()
              const refreshed = readTelemetrySnapshot(osStateRef.current)
              latestTelemetryRef.current = refreshed.snapshot
              lastTelemetryKeyRef.current = refreshed.key
              dirtyRef.current = true
            }
          } else {
            orderProgressSaveAccumRef.current += dt
            if (orderProgressSaveAccumRef.current >= 10.0) {
              orderProgressSaveAccumRef.current = 0
              syncSnapshotToStore()
            }
          }
        }
      } else if (orderSpawnCountdownRef.current !== null) {
        orderSpawnCountdownRef.current -= dt
        if (orderSpawnCountdownRef.current <= 0) {
          orderSpawnCountdownRef.current = null
          if (orderDeckRef.current.length === 0) {
            orderDeckRef.current = createShuffledOrderDeck(
              lastOrderTemplateRef.current
            )
          }
          const templateId = orderDeckRef.current.shift()
          if (templateId) {
            lastOrderTemplateRef.current = templateId
            orderSequenceRef.current += 1
            const newOrderMsg = createPost84OrderMessage(
              templateId,
              orderSequenceRef.current,
              gs.shiftTimeMinutes
            )
            const { nextState, didDeliver } = deliverIncomingPost84Message(
              osStateRef.current,
              newOrderMsg,
              'NEW DIRECTIVE: CHECK INBOX'
            )
            if (didDeliver) {
              osStateRef.current = nextState
              mailAlertFlashRef.current = ORDER_ALERT_FLASH_DURATION_SEC
              diskPulseRef.current = 0.75
              playCarriageReturnDing()
              notifyPost84OrderEvent()
              pushKomradTerminalNotice(
                `NEW STATE DIRECTIVE RECEIVED ON ISKRA-84 DESK TERMINAL: ${newOrderMsg.subject}`,
                'warn',
                'PRINTER',
                true,
                newOrderMsg.order?.arrivalVox
              )
              if (cursorPosRef.current) {
                const updatedHit = hitTestDesktopOs(
                  nextState,
                  cursorPosRef.current.x,
                  cursorPosRef.current.y
                )
                hoveredIdRef.current = updatedHit ? updatedHit.id : null
              }
              orderProgressSaveAccumRef.current = 0
              syncSnapshotToStore()
              const refreshed = readTelemetrySnapshot(osStateRef.current)
              latestTelemetryRef.current = refreshed.snapshot
              lastTelemetryKeyRef.current = refreshed.key
              dirtyRef.current = true
            }
          }
        } else {
          orderProgressSaveAccumRef.current += dt
          if (orderProgressSaveAccumRef.current >= 10.0) {
            orderProgressSaveAccumRef.current = 0
            syncSnapshotToStore()
          }
        }
      }
    }

    if (mailAlertFlashRef.current > 0) {
      mailAlertFlashRef.current = Math.max(0, mailAlertFlashRef.current - dt)
    }
    let blinkStep = -1
    if (mailAlertFlashRef.current > 0) {
      blinkStep = Math.floor(mailAlertFlashRef.current * 4)
    } else if (gs.tutorialPhase === 'AWAITING_VOLKOV_MAIL' && gs.isShiftControlReady) {
      volkovPulseAccumRef.current += dt
      blinkStep = Math.floor(volkovPulseAccumRef.current * 2) % 2
    }
    if (blinkStep !== alertBlinkStepRef.current) {
      alertBlinkStepRef.current = blinkStep
      dirtyRef.current = true
    }

    const isSeatedActive = gs.isSeatedAtDesk && document.pointerLockElement === null
    if (!isSeatedActive) {
      mouseTargetRef.current.x = 0
      mouseTargetRef.current.z = 0
      if (cursorPosRef.current !== null || hoveredIdRef.current !== null) {
        cursorPosRef.current = null
        hoveredIdRef.current = null
        dirtyRef.current = true
      }
    }

    // Smooth 3D physical mouse movement strictly while seated, snapping cleanly at rest
    if (mouseGroupRef.current) {
      const dampLambda = isSeatedActive ? MOUSE_DAMP_SEATED : MOUSE_DAMP_RETURN
      const targetX = mouseTargetRef.current.x
      const targetZ = mouseTargetRef.current.z
      const nextX = THREE.MathUtils.damp(
        mouseGroupRef.current.position.x,
        targetX,
        dampLambda,
        dt
      )
      const nextZ = THREE.MathUtils.damp(
        mouseGroupRef.current.position.z,
        targetZ,
        dampLambda,
        dt
      )
      mouseGroupRef.current.position.x =
        Math.abs(targetX - nextX) < MOUSE_SETTLE_EPS ? targetX : nextX
      mouseGroupRef.current.position.z =
        Math.abs(targetZ - nextZ) < MOUSE_SETTLE_EPS ? targetZ : nextZ
    }

    const deskPower =
      gs.lobbyMenuPhase !== 'entered_control_room'
        ? 0.14
        : THREE.MathUtils.lerp(0.14, 1.0, controlRoomPowerState.zone1)
    if (screenMatRef.current) {
      screenMatRef.current.color.setRGB(deskPower, deskPower, deskPower)
    }
    if (bezelPowerLedMatRef.current) {
      bezelPowerLedMatRef.current.emissiveIntensity = 1.6 * deskPower
    }
    if (towerPowerLedMatRef.current) {
      towerPowerLedMatRef.current.emissiveIntensity = 1.4 * deskPower
    }

    // Pulse disk activity LED when loading modules or clicking inside OS
    if (diskLedMatRef.current) {
      if (diskPulseRef.current > 0) {
        diskPulseRef.current = Math.max(0, diskPulseRef.current - dt)
        diskLedMatRef.current.emissiveIntensity = 1.9 * deskPower
      } else {
        diskLedMatRef.current.emissiveIntensity = 0.22 * deskPower
      }
    }

    // Poll telemetry cleanly at ~6 Hz without React re-renders
    telemetryAccumRef.current += dt
    if (telemetryAccumRef.current >= 0.16) {
      telemetryAccumRef.current = 0
      const { snapshot, key } = readTelemetrySnapshot(osStateRef.current)
      if (key !== lastTelemetryKeyRef.current) {
        lastTelemetryKeyRef.current = key
        latestTelemetryRef.current = snapshot
        dirtyRef.current = true
      }
    }

    if (dirtyRef.current) {
      dirtyRef.current = false
      const ctx = screenCanvas.getContext('2d')
      if (ctx) {
        const mailAlertPhase: 0 | 1 | 2 =
          blinkStep < 0 ? 0 : blinkStep % 2 === 0 ? 2 : 1
        paintDesktopOsCanvas(
          ctx,
          osStateRef.current,
          latestTelemetryRef.current,
          hoveredIdRef.current,
          cursorPosRef.current,
          mailAlertPhase
        )
        markScreenTexUpdated()
      }
    }
  })

  const handleScreenPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (!e.uv) return

    const gs = useGameStore.getState()
    if (!gs.isSeatedAtDesk || document.pointerLockElement !== null) return

    const raw = uvToCanvasCoords(e.uv.x, e.uv.y)
    const coords = { x: Math.round(raw.x), y: Math.round(raw.y) }

    const rawX = THREE.MathUtils.clamp((e.uv.x - 0.5) * 0.104, -MOUSE_RANGE_X, MOUSE_RANGE_X)
    const rawZ = THREE.MathUtils.clamp((0.5 - e.uv.y) * 0.088, -MOUSE_RANGE_Z, MOUSE_RANGE_Z)
    if (
      Math.hypot(rawX - mouseTargetRef.current.x, rawZ - mouseTargetRef.current.z) >=
      MOUSE_TARGET_DEADZONE
    ) {
      mouseTargetRef.current.x = rawX
      mouseTargetRef.current.z = rawZ
    }

    const hit = hitTestDesktopOs(osStateRef.current, coords.x, coords.y)
    const nextHover = hit ? hit.id : null
    const prevCursor = cursorPosRef.current
    const cursorMoved =
      prevCursor === null || prevCursor.x !== coords.x || prevCursor.y !== coords.y

    if (cursorMoved || hoveredIdRef.current !== nextHover) {
      cursorPosRef.current = coords
      hoveredIdRef.current = nextHover
      dirtyRef.current = true
    }
  }

  const handleScreenPointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    mouseTargetRef.current.x = 0
    mouseTargetRef.current.z = 0
    if (cursorPosRef.current !== null || hoveredIdRef.current !== null) {
      cursorPosRef.current = null
      hoveredIdRef.current = null
      dirtyRef.current = true
    }
  }

  const handleScreenPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const gs = useGameStore.getState()
    if (!gs.isSeatedAtDesk || document.pointerLockElement !== null) return

    const coords = e.uv
      ? uvToCanvasCoords(e.uv.x, e.uv.y)
      : cursorPosRef.current
    if (!coords) return

    const { nextState, clickedRegion, didAction } = handleDesktopOsClick(
      osStateRef.current,
      coords.x,
      coords.y
    )
    if (!didAction) return

    osStateRef.current = nextState
    diskPulseRef.current = 0.28

    if (clickedRegion?.action.kind === 'mail_accept_training') {
      mailAlertFlashRef.current = 0
      alertBlinkStepRef.current = -1
      playOrderCompleteChime()
      playSwitchClank(true)
      useGameStore.getState().acceptVolkovTrainingDirective()
    } else if (clickedRegion?.action.kind === 'mail_skip_training') {
      mailAlertFlashRef.current = 0
      alertBlinkStepRef.current = -1
      playSwitchClank(true)
      useGameStore.getState().skipTutorial()
    } else if (clickedRegion?.action.kind === 'mail_accept_order') {
      const acceptedMessageId = clickedRegion.action.messageId
      mailAlertFlashRef.current = 0
      alertBlinkStepRef.current = -1
      const accepted = nextState.mailMessages.find((m) => m.id === acceptedMessageId)
      if (accepted?.order) {
        useGameStore
          .getState()
          .setActivePost84Order(
            getPost84PowerOrderSpec(
              accepted.id,
              accepted.order.templateId,
              accepted.subject
            )
          )
        pushKomradTerminalNotice(
          `DIRECTIVE ACCEPTED: ${accepted.subject} — ${accepted.order.objectiveSummary}`,
          'normal',
          'OPERATOR',
          false
        )
        const refreshed = readTelemetrySnapshot(osStateRef.current)
        latestTelemetryRef.current = refreshed.snapshot
        lastTelemetryKeyRef.current = refreshed.key
      }
    }

    if (
      clickedRegion &&
      (clickedRegion.action.kind === 'open_app' ||
        clickedRegion.action.kind === 'close_app' ||
        clickedRegion.action.kind === 'minimize_app' ||
        clickedRegion.action.kind === 'minimize_all' ||
        clickedRegion.action.kind === 'taskbar_toggle')
    ) {
      playSwitchClank(false)
    } else if (clickedRegion?.action.kind === 'mail_accept_order') {
      playSwitchClank(true)
    } else if (
      clickedRegion?.action.kind !== 'mail_accept_training' &&
      clickedRegion?.action.kind !== 'mail_skip_training'
    ) {
      playDetentClick(1)
    }

    const newHit = hitTestDesktopOs(nextState, coords.x, coords.y)
    hoveredIdRef.current = newHit ? newHit.id : null
    syncSnapshotToStore()
    dirtyRef.current = true
  }

  return (
    <group>
      {/* =====================================================================
          1. CENTER CRT MONITOR (ISKRA-84 // ЭВМ) — Enlarged Seated Display
         ===================================================================== */}
      <group position={[0, 0.925, -0.24]} scale={1.08}>
        {/* Cast-iron swivel stand base & pedestal neck */}
        <mesh position={[0, 0.015, 0.01]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.5, 0.03, 0.34]} />
          <meshStandardMaterial color="#18211b" roughness={0.65} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.06, -0.01]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.12, 0.15, 0.07, 14]} />
          <meshStandardMaterial color="#2a362b" roughness={0.6} metalness={0.45} />
        </mesh>

        {/* Gently tilted CRT monitor head assembly */}
        <group position={[0, 0.415, 0.02]} rotation={[-0.08, 0, 0]}>
          {/* Outer Soviet Olive-Steel Casing */}
          <mesh position={[0, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.02, 0.67, 0.36]} />
            <meshStandardMaterial color="#2a362b" roughness={0.62} metalness={0.35} />
          </mesh>
          {/* Rear CRT Yoke Housing */}
          <mesh position={[0, -0.01, -0.24]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.64, 0.44, 0.16]} />
            <meshStandardMaterial color="#18211b" roughness={0.7} metalness={0.45} />
          </mesh>
          {/* Top Heat Vent Ribs */}
          {[-0.32, -0.16, 0, 0.16, 0.32].map((vx) => (
            <mesh key={vx} position={[vx, 0.339, -0.03]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.05, 0.008, 0.24]} />
              <meshStandardMaterial color="#0d110f" roughness={0.8} />
            </mesh>
          ))}

          {/* Front Deep Bakelite Bezel Frame (4 Perimeter Bars around Enlarged Screen) */}
          <mesh position={[0, 0.314, 0.194]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.0, 0.034, 0.032]} />
            <meshStandardMaterial color="#141414" roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.308, 0.194]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.0, 0.054, 0.032]} />
            <meshStandardMaterial color="#141414" roughness={0.55} />
          </mesh>
          <mesh position={[-0.482, 0.008, 0.194]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.036, 0.58, 0.032]} />
            <meshStandardMaterial color="#141414" roughness={0.55} />
          </mesh>
          <mesh position={[0.482, 0.008, 0.194]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.036, 0.58, 0.032]} />
            <meshStandardMaterial color="#141414" roughness={0.55} />
          </mesh>

          {/* Bottom Bezel Brass Model Nameplate & Power Rocker / Indicator */}
          <mesh position={[0, -0.308, 0.212]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.23, 0.038]} />
            <meshStandardMaterial
              map={badge.tex}
              emissive="#ffffff"
              emissiveMap={badge.tex}
              emissiveIntensity={0.22}
              roughness={0.4}
              polygonOffset
              polygonOffsetFactor={-2}
              polygonOffsetUnits={-2}
            />
          </mesh>
          <mesh position={[0.37, -0.308, 0.214]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.026, 0.018, 0.012]} />
            <meshStandardMaterial color="#8b1e1e" roughness={0.5} />
          </mesh>
          <mesh position={[0.425, -0.308, 0.214]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.006, 8, 8]} />
            <meshStandardMaterial
              ref={bezelPowerLedMatRef}
              color="#33ff66"
              emissive="#33ff66"
              emissiveIntensity={1.6}
            />
          </mesh>

          {/* Recessed CRT Screen Backing + Single 2-Triangle Enlarged Display Plane (16:10) */}
          <mesh position={[0, 0.008, 0.181]} raycast={NOOP_RAYCAST}>
            <planeGeometry args={[0.936, 0.586]} />
            <meshBasicMaterial color="#030a05" />
          </mesh>
          <mesh
            position={[0, 0.008, 0.185]}
            raycast={isSeatedAtDesk ? undefined : NOOP_RAYCAST}
            onPointerMove={handleScreenPointerMove}
            onPointerOut={handleScreenPointerOut}
            onPointerDown={handleScreenPointerDown}
          >
            <planeGeometry args={[0.928, 0.58]} />
            <meshBasicMaterial
              ref={screenMatRef}
              color="#242424"
              map={screenTex}
              toneMapped={false}
              fog={false}
            />
          </mesh>
        </group>
      </group>

      {/* =====================================================================
          2. LEFT SYSTEM TOWER (5.25" DUAL FLOPPY CHASSIS)
         ===================================================================== */}
      <group position={[-0.98, 0.925, -0.24]} rotation={[0, 0.12, 0]}>
        <mesh position={[0, 0.18, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.22, 0.36, 0.42]} />
          <meshStandardMaterial color="#23332b" roughness={0.65} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.18, 0.212]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.205, 0.34, 0.012]} />
          <meshStandardMaterial color="#18211b" roughness={0.7} />
        </mesh>
        {/* Dual 5.25" Floppy Drive Bays */}
        {[0.27, 0.205].map((by, idx) => (
          <group key={idx} position={[0, by, 0.22]}>
            <mesh raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.17, 0.048, 0.008]} />
              <meshStandardMaterial color="#0d110f" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.005]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.145, 0.007, 0.006]} />
              <meshStandardMaterial color="#030504" />
            </mesh>
            <mesh position={[0.048, -0.008, 0.007]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.022, 0.014, 0.008]} />
              <meshStandardMaterial color="#8c7a4b" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
        ))}
        {/* Keylock + Power LED + Animated Disk Activity LED */}
        <mesh position={[-0.055, 0.09, 0.222]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
          <cylinderGeometry args={[0.012, 0.012, 0.012, 10]} />
          <meshStandardMaterial color="#b8a46b" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0.02, 0.09, 0.223]} raycast={NOOP_RAYCAST}>
          <sphereGeometry args={[0.006, 8, 8]} />
          <meshStandardMaterial
            ref={towerPowerLedMatRef}
            color="#33ff66"
            emissive="#33ff66"
            emissiveIntensity={1.4}
          />
        </mesh>
        <mesh position={[0.055, 0.09, 0.223]} raycast={NOOP_RAYCAST}>
          <sphereGeometry args={[0.006, 8, 8]} />
          <meshStandardMaterial
            ref={diskLedMatRef}
            color="#ffb000"
            emissive="#ffb000"
            emissiveIntensity={0.22}
          />
        </mesh>
      </group>

      {/* =====================================================================
          3. FRONT MECHANICAL SOVIET KEYBOARD & COILED CORD
         ===================================================================== */}
      <group position={[-0.06, 0.925, 0.3]} rotation={[0.06, 0, 0]}>
        <mesh position={[0, 0.018, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.62, 0.034, 0.21]} />
          <meshStandardMaterial color="#18211b" roughness={0.65} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.036, -0.005]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.59, 0.008, 0.18]} />
          <meshStandardMaterial color="#2a362b" roughness={0.7} />
        </mesh>
        {/* Function row + Main Key Rows */}
        {[-0.064, -0.034, -0.004, 0.026].map((rz, idx) => (
          <mesh key={idx} position={[-0.05, 0.044, rz]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.42, 0.01, 0.022]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.75} />
          </mesh>
        ))}
        {/* Crimson ESC Keycap */}
        <mesh position={[-0.245, 0.045, -0.064]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.028, 0.011, 0.022]} />
          <meshStandardMaterial color="#8b1e1e" roughness={0.55} />
        </mesh>
        {/* Spacebar */}
        <mesh position={[-0.05, 0.044, 0.058]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.24, 0.01, 0.022]} />
          <meshStandardMaterial color="#b5ad96" roughness={0.75} />
        </mesh>
        {/* Right Numpad Block */}
        <mesh position={[0.228, 0.044, -0.002]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.105, 0.01, 0.145]} />
          <meshStandardMaterial color="#3e4d40" roughness={0.7} />
        </mesh>
      </group>
      <mesh geometry={cableGeo} raycast={NOOP_RAYCAST}>
        <meshStandardMaterial color="#141414" roughness={0.8} />
      </mesh>

      {/* =====================================================================
          4. RIGHT MOUSEPAD & DYNAMICALLY TRACKED BALL MOUSE
         ===================================================================== */}
      <group position={[0.52, 0.925, 0.3]}>
        <mesh position={[0, 0.003, 0]} raycast={NOOP_RAYCAST}>
          <boxGeometry args={[0.24, 0.006, 0.24]} />
          <meshStandardMaterial color="#141414" roughness={0.92} />
        </mesh>
        <group ref={mouseGroupRef} position={[0, 0.006, 0]}>
          <mesh position={[0, 0.016, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.068, 0.032, 0.108]} />
            <meshStandardMaterial color="#cfc6b0" roughness={0.62} />
          </mesh>
          <mesh position={[-0.016, 0.033, -0.034]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.026, 0.006, 0.032]} />
            <meshStandardMaterial color="#8b1e1e" roughness={0.5} />
          </mesh>
          <mesh position={[0.016, 0.033, -0.034]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.026, 0.006, 0.032]} />
            <meshStandardMaterial color="#18211b" roughness={0.6} />
          </mesh>
        </group>
      </group>
      <mesh geometry={mouseCableGeo} raycast={NOOP_RAYCAST}>
        <meshStandardMaterial color="#141414" roughness={0.8} />
      </mesh>
    </group>
  )
}
