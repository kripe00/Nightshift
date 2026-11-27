import {
  getSovOsPluginApp,
  getSovOsPluginApps,
  type SovOsPluginAppId,
} from '../../shared/sovOsAppRegistry'
import {
  createInitialPost84Inbox,
  evaluatePost84Order,
  type Post84LiveTelemetry,
  type Post84Message,
} from './post84Mail'

export type DesktopAppId = 'mail' | SovOsPluginAppId

export type DesktopCursorAction =
  | { kind: 'open_app'; appId: DesktopAppId }
  | { kind: 'focus_app'; appId: DesktopAppId }
  | { kind: 'minimize_app'; appId: DesktopAppId }
  | { kind: 'close_app'; appId: DesktopAppId }
  | { kind: 'minimize_all' }
  | { kind: 'taskbar_toggle'; appId: DesktopAppId }
  | { kind: 'mail_select'; messageId: string }
  | { kind: 'mail_scroll'; delta: number }
  | { kind: 'mail_accept_order'; messageId: string }
  | { kind: 'mail_accept_training'; messageId: string }
  | { kind: 'mail_skip_training'; messageId: string }
  | {
      kind: 'plugin_click'
      appId: SovOsPluginAppId
      regionId: string
      payload?: string
    }

export interface DesktopHitRegion {
  id: string
  x: number
  y: number
  w: number
  h: number
  action: DesktopCursorAction
  windowScope?: DesktopAppId
}

export interface DesktopTelemetrySnapshot {
  shiftNumber: number
  shiftTimeMinutes: number
  shiftCompletedAt0600: 'active' | 'closing_shift' | 'awaiting_elevator'
  tutorialPhase: string
  isBlackout: boolean
  az5Active: boolean
  coreTemp: number
  pressureBar: number
  energyCreatedMW: number
  totalElectricalMW: number
  energyDemandMW: number
  batteryStoredPct: number
  radiationLevel: number
  gridHz: number
  waterReservoir: number
  avrActive: boolean
  kgbLineActive: boolean
  bubblerLevel: number
  containmentSealLocked: boolean
  sectorMW: Post84LiveTelemetry['sectorMW']
  targetSectorMW: Post84LiveTelemetry['targetSectorMW']
  coolingMW: number
  defenseMW: number
  facilityMW: number
  commendations: number
  citations: number
  treasonStrikes: number
  strike5SurgeFlashSec: number
  rubles: number
  quotaCompleted: number
  activeMandateTitle: string | null
  activeMandateText: string | null
  recentLogs: Array<{
    id: string
    source: string
    text: string
    time: string
    level: 'normal' | 'warn' | 'danger'
  }>
  latestKomradLine: string | null
}

export interface DesktopOsState {
  /** Z-order of currently open windows; last entry is the top-most focused window. */
  openWindows: DesktopAppId[]
  /** Windows explicitly minimized to the taskbar (retaining visual indicator). */
  minimizedWindows: DesktopAppId[]
  mailMessages: Post84Message[]
  selectedMailId: string
  mailScrollOffset: number
  mailEarnedRub: number
  mailOrdersCompleted: number
  lastStatusNotice: string
}

export const DESKTOP_CANVAS_W = 1024
export const DESKTOP_CANVAS_H = 640

export function createInitialDesktopOsState(): DesktopOsState {
  const initialInbox = createInitialPost84Inbox()
  return {
    openWindows: [],
    minimizedWindows: [],
    mailMessages: initialInbox,
    selectedMailId: '',
    mailScrollOffset: 0,
    mailEarnedRub: 0,
    mailOrdersCompleted: 0,
    lastStatusNotice: 'URGENT: VOLKOV MAIL UNREAD',
  }
}

export function deliverIncomingPost84Message(
  state: DesktopOsState,
  message: Post84Message,
  notice = 'NEW DISPATCH: VOLKOR'
): { nextState: DesktopOsState; didDeliver: boolean } {
  if (state.mailMessages.some((m) => m.id === message.id)) {
    return { nextState: state, didDeliver: false }
  }
  return {
    nextState: {
      ...state,
      mailMessages: [
        {
          ...message,
          bodyLines: [...message.bodyLines],
          order: message.order ? { ...message.order } : undefined,
        },
        ...state.mailMessages,
      ],
      selectedMailId: state.selectedMailId,
      mailScrollOffset: state.mailScrollOffset > 0 ? state.mailScrollOffset + 1 : 0,
      lastStatusNotice: notice,
    },
    didDeliver: true,
  }
}

export function completeActivePost84Order(
  state: DesktopOsState,
  messageId: string
): { nextState: DesktopOsState; completedMessage: Post84Message | null } {
  const target = state.mailMessages.find((m) => m.id === messageId)
  if (!target || !target.order || target.order.orderState === 'completed') {
    return { nextState: state, completedMessage: null }
  }

  let completedMessage: Post84Message | null = null
  const nextMessages = state.mailMessages.map((msg) => {
    if (msg.id !== messageId || !msg.order) return msg
    const updated: Post84Message = {
      ...msg,
      status: 'read',
      order: {
        ...msg.order,
        orderState: 'completed',
        holdProgressSec: msg.order.holdDurationSec,
      },
    }
    completedMessage = updated
    return updated
  })

  return {
    nextState: {
      ...state,
      mailMessages: nextMessages,
      mailEarnedRub: state.mailEarnedRub + target.order.rewardRub,
      mailOrdersCompleted: state.mailOrdersCompleted + target.order.quotaPoints,
      lastStatusNotice: `PAID +${target.order.rewardRub} RUB (+${target.order.quotaPoints} QUOTA)`,
    },
    completedMessage,
  }
}

export function uvToCanvasCoords(u: number, v: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(DESKTOP_CANVAS_W - 1, u * DESKTOP_CANVAS_W)),
    y: Math.max(0, Math.min(DESKTOP_CANVAS_H - 1, (1 - v) * DESKTOP_CANVAS_H)),
  }
}

export function computeBalanceRub(
  telemetry: DesktopTelemetrySnapshot,
  _state: DesktopOsState
): number {
  return Math.max(0, Math.round(telemetry.rubles))
}

function getWindowRect() {
  return {
    x: 228,
    y: 60,
    w: 738,
    h: 468,
  }
}

/**
 * Single source of truth for all interactive desktop regions in z-order (front-most last).
 */
export function buildDesktopHitRegions(
  state: DesktopOsState
): DesktopHitRegion[] {
  const regions: DesktopHitRegion[] = []
  const pluginApps = getSovOsPluginApps()

  // Left desktop column: P.O.S.T.-84 + registered SOV-OS 84 plugin apps
  regions.push({
    id: 'icon:mail',
    x: 24,
    y: 64,
    w: 184,
    h: 104,
    action: { kind: 'open_app', appId: 'mail' },
  })
  pluginApps.forEach((plugin, idx) => {
    regions.push({
      id: `icon:${plugin.id}`,
      x: 24,
      y: 182 + idx * 116,
      w: 184,
      h: 104,
      action: { kind: 'open_app', appId: plugin.id },
    })
  })

  // Open window: P.O.S.T.-84 or active plugin app
  const activeWinId = state.openWindows[0]
  if (activeWinId === 'mail') {
    const rect = getWindowRect()
    regions.push({
      id: 'win:mail:body',
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      action: { kind: 'focus_app', appId: 'mail' },
      windowScope: 'mail',
    })

    regions.push({
      id: 'win:mail:minimize',
      x: rect.x + rect.w - 94,
      y: rect.y + 6,
      w: 40,
      h: 32,
      action: { kind: 'minimize_app', appId: 'mail' },
      windowScope: 'mail',
    })

    regions.push({
      id: 'win:mail:close',
      x: rect.x + rect.w - 48,
      y: rect.y + 6,
      w: 40,
      h: 32,
      action: { kind: 'close_app', appId: 'mail' },
      windowScope: 'mail',
    })

    regions.push(
      {
        id: 'mail:scroll_up',
        x: rect.x + 190,
        y: rect.y + 56,
        w: 40,
        h: 30,
        action: { kind: 'mail_scroll', delta: -1 },
        windowScope: 'mail',
      },
      {
        id: 'mail:scroll_down',
        x: rect.x + 236,
        y: rect.y + 56,
        w: 40,
        h: 30,
        action: { kind: 'mail_scroll', delta: 1 },
        windowScope: 'mail',
      }
    )

    const visibleMail = state.mailMessages.slice(
      state.mailScrollOffset,
      state.mailScrollOffset + 5
    )
    visibleMail.forEach((msg, idx) => {
      regions.push({
        id: `mail:row:${msg.id}`,
        x: rect.x + 16,
        y: rect.y + 94 + idx * 70,
        w: 260,
        h: 64,
        action: { kind: 'mail_select', messageId: msg.id },
        windowScope: 'mail',
      })
    })

    const selected = state.selectedMailId
      ? (state.mailMessages.find((m) => m.id === state.selectedMailId) ?? null)
      : null
    if (selected?.order?.orderState === 'pending') {
      regions.push({
        id: 'mail:accept_order',
        x: rect.x + 300,
        y: rect.y + 396,
        w: 412,
        h: 46,
        action: { kind: 'mail_accept_order', messageId: selected.id },
        windowScope: 'mail',
      })
    } else if (selected?.trainingDirective?.state === 'pending') {
      regions.push(
        {
          id: 'mail:accept_training',
          x: rect.x + 300,
          y: rect.y + 356,
          w: 412,
          h: 44,
          action: { kind: 'mail_accept_training', messageId: selected.id },
          windowScope: 'mail',
        },
        {
          id: 'mail:skip_training',
          x: rect.x + 300,
          y: rect.y + 408,
          w: 412,
          h: 34,
          action: { kind: 'mail_skip_training', messageId: selected.id },
          windowScope: 'mail',
        }
      )
    }
  } else if (activeWinId) {
    const plugin = getSovOsPluginApp(activeWinId)
    if (plugin) {
      const rect = getWindowRect()
      regions.push({
        id: `win:${plugin.id}:body`,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        action: { kind: 'focus_app', appId: plugin.id },
        windowScope: plugin.id,
      })
      regions.push({
        id: `win:${plugin.id}:minimize`,
        x: rect.x + rect.w - 94,
        y: rect.y + 6,
        w: 40,
        h: 32,
        action: { kind: 'minimize_app', appId: plugin.id },
        windowScope: plugin.id,
      })
      regions.push({
        id: `win:${plugin.id}:close`,
        x: rect.x + rect.w - 48,
        y: rect.y + 6,
        w: 40,
        h: 32,
        action: { kind: 'close_app', appId: plugin.id },
        windowScope: plugin.id,
      })
      for (const pReg of plugin.getHitRegions(rect)) {
        regions.push({
          id: pReg.id,
          x: pReg.x,
          y: pReg.y,
          w: pReg.w,
          h: pReg.h,
          action: {
            kind: 'plugin_click',
            appId: plugin.id,
            regionId: pReg.id,
            payload: pReg.payload,
          },
          windowScope: plugin.id,
        })
      }
    }
  }

  // Bottom taskbar (`y = 588..640`): HOME, POST-84 & plugin app tabs
  regions.push(
    {
      id: 'taskbar:desk',
      x: 14,
      y: 594,
      w: 104,
      h: 38,
      action: { kind: 'minimize_all' },
    },
    {
      id: 'taskbar:mail',
      x: 126,
      y: 594,
      w: 148,
      h: 38,
      action: { kind: 'taskbar_toggle', appId: 'mail' },
    }
  )
  pluginApps.forEach((plugin, idx) => {
    regions.push({
      id: `taskbar:${plugin.id}`,
      x: 282 + idx * 142,
      y: 594,
      w: 134,
      h: 38,
      action: { kind: 'taskbar_toggle', appId: plugin.id },
    })
  })

  return regions
}

export function hitTestDesktopOs(
  state: DesktopOsState,
  x: number,
  y: number
): DesktopHitRegion | null {
  const regions = buildDesktopHitRegions(state)
  // Iterate backwards so front-most UI element catches the pointer first
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i]
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return r
    }
  }
  return null
}

export function handleDesktopOsClick(
  state: DesktopOsState,
  x: number,
  y: number
): {
  nextState: DesktopOsState
  clickedRegion: DesktopHitRegion | null
  didAction: boolean
  pluginSound?: 'click' | 'clank' | 'chime' | 'alarm'
} {
  const hit = hitTestDesktopOs(state, x, y)
  if (!hit) {
    return { nextState: state, clickedRegion: null, didAction: false }
  }

  const next: DesktopOsState = {
    ...state,
    openWindows: [...state.openWindows],
    minimizedWindows: [...state.minimizedWindows],
    mailMessages: state.mailMessages.map((msg) => ({
      ...msg,
      order: msg.order ? { ...msg.order } : undefined,
      trainingDirective: msg.trainingDirective
        ? { ...msg.trainingDirective }
        : undefined,
    })),
  }

  const selectPendingTrainingIfUnselected = () => {
    if (next.selectedMailId) return
    const pendingTraining = next.mailMessages.find(
      (m) => m.trainingDirective?.state === 'pending'
    )
    if (pendingTraining) {
      next.selectedMailId = pendingTraining.id
    }
  }

  const focusAppWindow = (appId: DesktopAppId) => {
    const prevOpen = next.openWindows.filter((w) => w !== appId)
    const mergedMin = new Set([...next.minimizedWindows, ...prevOpen])
    mergedMin.delete(appId)
    next.minimizedWindows = Array.from(mergedMin)
    next.openWindows = [appId]
  }

  const minimizeAppWindow = (appId: DesktopAppId) => {
    next.openWindows = next.openWindows.filter((w) => w !== appId)
    if (!next.minimizedWindows.includes(appId)) {
      next.minimizedWindows = [...next.minimizedWindows, appId]
    }
  }

  const focusMailWindow = () => {
    focusAppWindow('mail')
  }

  const appDisplayName = (appId: DesktopAppId): string => {
    if (appId === 'mail') return 'P.O.S.T.-84'
    return getSovOsPluginApp(appId)?.iconTitle ?? appId.toUpperCase()
  }

  let pluginClickResult: ReturnType<
    NonNullable<ReturnType<typeof getSovOsPluginApp>>['handleClick']
  > | null = null

  const action = hit.action
  switch (action.kind) {
    case 'open_app':
    case 'focus_app': {
      focusAppWindow(action.appId)
      if (action.appId === 'mail') {
        selectPendingTrainingIfUnselected()
      }
      next.lastStatusNotice = `OPEN: ${appDisplayName(action.appId)}`
      break
    }
    case 'minimize_app': {
      minimizeAppWindow(action.appId)
      next.lastStatusNotice = `MINIMIZED: ${appDisplayName(action.appId)}`
      break
    }
    case 'close_app': {
      next.openWindows = next.openWindows.filter((w) => w !== action.appId)
      next.minimizedWindows = next.minimizedWindows.filter((w) => w !== action.appId)
      next.lastStatusNotice = `CLOSED: ${appDisplayName(action.appId)}`
      break
    }
    case 'minimize_all': {
      const merged = new Set([...next.minimizedWindows, ...next.openWindows])
      next.minimizedWindows = Array.from(merged)
      next.openWindows = []
      next.lastStatusNotice = 'DESKTOP HOMESCREEN'
      break
    }
    case 'taskbar_toggle': {
      if (next.openWindows.includes(action.appId)) {
        minimizeAppWindow(action.appId)
        next.lastStatusNotice = `MINIMIZED: ${appDisplayName(action.appId)}`
      } else {
        focusAppWindow(action.appId)
        if (action.appId === 'mail') {
          selectPendingTrainingIfUnselected()
        }
        next.lastStatusNotice = `ACTIVE: ${appDisplayName(action.appId)}`
      }
      break
    }
    case 'plugin_click': {
      const plugin = getSovOsPluginApp(action.appId)
      if (!plugin) {
        return { nextState: state, clickedRegion: hit, didAction: false }
      }
      focusAppWindow(action.appId)
      pluginClickResult = plugin.handleClick(action.regionId, action.payload)
      if (!pluginClickResult.handled) {
        return { nextState: state, clickedRegion: hit, didAction: false }
      }
      if (pluginClickResult.statusNotice) {
        next.lastStatusNotice = pluginClickResult.statusNotice
      }
      break
    }
    case 'mail_select': {
      const targetMsgId = action.messageId
      focusMailWindow()
      next.selectedMailId = targetMsgId
      const msg = next.mailMessages.find((m) => m.id === targetMsgId)
      if (msg) {
        if (
          msg.status === 'unread' &&
          msg.trainingDirective?.state !== 'pending'
        ) {
          msg.status = 'read'
        }
        next.lastStatusNotice = `READ: ${msg.sender}`
      }
      break
    }
    case 'mail_scroll': {
      focusMailWindow()
      const maxMailOffset = Math.max(0, next.mailMessages.length - 5)
      next.mailScrollOffset = Math.max(
        0,
        Math.min(maxMailOffset, next.mailScrollOffset + action.delta)
      )
      break
    }
    case 'mail_accept_order': {
      focusMailWindow()
      next.selectedMailId = action.messageId
      const msg = next.mailMessages.find((m) => m.id === action.messageId)
      if (msg?.order && msg.order.orderState === 'pending') {
        msg.status = 'read'
        msg.order.orderState = 'active'
        msg.order.holdProgressSec = 0
        next.lastStatusNotice = `ACTIVE: ${msg.subject.slice(0, 24)}`
      }
      break
    }
    case 'mail_accept_training': {
      focusMailWindow()
      next.selectedMailId = action.messageId
      const msg = next.mailMessages.find((m) => m.id === action.messageId)
      if (msg?.trainingDirective && msg.trainingDirective.state === 'pending') {
        msg.status = 'read'
        msg.trainingDirective.state = 'accepted'
        next.lastStatusNotice = 'TRAINING DIRECTIVE ACCEPTED'
      }
      break
    }
    case 'mail_skip_training': {
      focusMailWindow()
      next.selectedMailId = action.messageId
      const msg = next.mailMessages.find((m) => m.id === action.messageId)
      if (msg?.trainingDirective && msg.trainingDirective.state === 'pending') {
        msg.status = 'read'
        msg.trainingDirective.state = 'skipped'
        next.lastStatusNotice = 'CERTIFIED SKIP // LIVE SHIFT'
      }
      break
    }
  }

  return {
    nextState: next,
    clickedRegion: hit,
    didAction: true,
    pluginSound: pluginClickResult?.sound,
  }
}

function formatShiftClock(totalMinutes: number): string {
  const clamped = Math.max(0, Math.floor(totalMinutes))
  const hours = Math.floor(clamped / 60) % 24
  const mins = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function drawMailEnvelopeGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2.5

  ctx.strokeRect(x + 8, y + 7, 54, 34)
  ctx.beginPath()
  ctx.moveTo(x + 8, y + 7)
  ctx.lineTo(x + 35, y + 27)
  ctx.lineTo(x + 62, y + 7)
  ctx.stroke()
  ctx.fillRect(x + 48, y + 29, 8, 6)

  ctx.restore()
}

function formatWindowTitleForKremlin(rawTitle: string): string {
  return rawTitle
    .replace(/\s*\/\/\s*/g, '  //  ')
    .replace(/(\d)\s+([A-Z])/g, '$1   $2')
}

function drawFittedKremlinTitle(
  ctx: CanvasRenderingContext2D,
  rawTitle: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  const formatted = formatWindowTitleForKremlin(rawTitle)
  let fontSize = 18
  ctx.font = `bold ${fontSize}px "Kremlin", "Courier Prime", monospace`
  while (fontSize > 14 && ctx.measureText(formatted).width > maxWidth) {
    fontSize -= 1
    ctx.font = `bold ${fontSize}px "Kremlin", "Courier Prime", monospace`
  }
  ctx.fillText(formatted, x, y, maxWidth)
}

function fitEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  const ellipsis = '...'
  const ellipsisW = ctx.measureText(ellipsis).width
  if (ellipsisW >= maxWidth) return ''
  let end = text.length
  while (end > 0 && ctx.measureText(text.slice(0, end)).width + ellipsisW > maxWidth) {
    end--
  }
  return text.slice(0, end).trimEnd() + ellipsis
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.split(/\s+/)
  let line = ''
  let linesDrawn = 0
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + linesDrawn * lineHeight)
      linesDrawn++
      if (linesDrawn >= maxLines) return linesDrawn
      line = words[i]
    } else {
      line = testLine
    }
  }
  if (line && linesDrawn < maxLines) {
    ctx.fillText(line, x, y + linesDrawn * lineHeight)
    linesDrawn++
  }
  return linesDrawn
}

export function paintDesktopOsCanvas(
  ctx: CanvasRenderingContext2D,
  state: DesktopOsState,
  telemetry: DesktopTelemetrySnapshot,
  hoveredId: string | null,
  cursorPos: { x: number; y: number } | null,
  mailAlertPhase: 0 | 1 | 2 = 0
): void {
  const W = DESKTOP_CANVAS_W
  const H = DESKTOP_CANVAS_H

  ctx.save()
  ctx.imageSmoothingEnabled = false

  // Deep Soviet phosphor CRT background
  ctx.fillStyle = '#061a0c'
  ctx.fillRect(0, 0, W, H)

  // Subtle background grid
  ctx.strokeStyle = '#0b2914'
  ctx.lineWidth = 1
  for (let gx = 0; gx < W; gx += 32) {
    ctx.beginPath()
    ctx.moveTo(gx, 48)
    ctx.lineTo(gx, H - 52)
    ctx.stroke()
  }
  for (let gy = 48; gy < H - 52; gy += 32) {
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(W, gy)
    ctx.stroke()
  }

  // Uncluttered Retro Soviet Desktop Wallpaper Emblem
  ctx.save()
  ctx.translate(614, 290)
  ctx.strokeStyle = '#0d361a'
  ctx.lineWidth = 3
  for (const angle of [0, Math.PI / 3, -Math.PI / 3]) {
    ctx.save()
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.ellipse(0, 0, 128, 44, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  ctx.fillStyle = '#0f3d1d'
  ctx.beginPath()
  ctx.arc(0, 0, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#114420'
  ctx.font = 'bold 34px "Kremlin", "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ISKRA-84 // SECTOR 84', 614, 442)

  ctx.fillStyle = '#0f381b'
  ctx.font = 'bold 17px "Courier Prime", monospace'
  ctx.fillText("PEOPLE'S AUTOMATED NUCLEAR PLANT NO. 4", 614, 476)

  if (state.openWindows.length === 0) {
    ctx.textAlign = 'right'
    ctx.fillStyle = '#1d5c2f'
    ctx.font = 'bold 17px "Courier Prime", monospace'
    ctx.fillText('PRESS [E] TO STAND  |  CLICK ICON TO LAUNCH', W - 24, 564)
  }

  // =========================================================================
  // 1. TOP STATUS BAR (y = 0..48) — Read-Only Display Pills
  // =========================================================================
  ctx.fillStyle = '#0d2b15'
  ctx.fillRect(0, 0, W, 48)
  ctx.fillStyle = '#33ff66'
  ctx.fillRect(0, 46, W, 2)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = 'bold 19px "Kremlin", "Courier Prime", monospace'
  ctx.fillStyle = '#33ff66'
  ctx.fillText('SOV-OS 84', 14, 24, 122)

  // Shift & Quota Readout
  const quotaTarget = 5
  const totalQuotaDone = Math.max(0, Math.round(telemetry.quotaCompleted))
  const clockStr = formatShiftClock(telemetry.shiftTimeMinutes)
  ctx.fillStyle = '#08200f'
  ctx.fillRect(142, 6, 264, 36)
  ctx.strokeStyle = '#22b549'
  ctx.lineWidth = 2
  ctx.strokeRect(142, 6, 264, 36)
  ctx.font = 'bold 17px "Courier Prime", monospace'
  ctx.fillStyle = '#e6dec3'
  ctx.fillText(
    `SHF-0${telemetry.shiftNumber} ${clockStr} | QTA ${totalQuotaDone}/${quotaTarget}`,
    152,
    24,
    244
  )

  // Currency Balance Badge
  const rubBalance = computeBalanceRub(telemetry, state)
  ctx.fillStyle = '#1d1404'
  ctx.fillRect(414, 6, 166, 36)
  ctx.strokeStyle = '#ffb000'
  ctx.strokeRect(414, 6, 166, 36)
  ctx.fillStyle = '#ffb000'
  ctx.font = 'bold 17px "Courier Prime", monospace'
  ctx.fillText(`BAL: ${rubBalance} RUB`, 424, 24, 146)

  // Unified KGB Treason Strike Readout (0 = green, 1-3 = amber, 4-5 = flashing crimson)
  const strikes = Math.max(0, Math.min(6, Math.round(telemetry.treasonStrikes)))
  const strikeFlashHigh = strikes >= 4 && mailAlertPhase === 2
  const strikeBg =
    strikes === 0
      ? '#08200f'
      : strikes <= 3
        ? '#1f1504'
        : strikeFlashHigh
          ? '#ff2a2a'
          : '#3a0909'
  const strikeBorder =
    strikes === 0
      ? '#22b549'
      : strikes <= 3
        ? '#ffb000'
        : strikeFlashHigh
          ? '#e6dec3'
          : '#ff2a2a'
  const strikeTextCol =
    strikes === 0
      ? '#33ff66'
      : strikes <= 3
        ? '#ffb000'
        : strikeFlashHigh
          ? '#061a0c'
          : '#ff4d4d'
  ctx.fillStyle = strikeBg
  ctx.fillRect(588, 6, 186, 36)
  ctx.strokeStyle = strikeBorder
  ctx.lineWidth = strikes >= 4 ? 2.5 : 2
  ctx.strokeRect(588, 6, 186, 36)
  ctx.textAlign = 'center'
  ctx.fillStyle = strikeTextCol
  ctx.font = 'bold 18px "Courier Prime", monospace'
  ctx.fillText(`STRIKES: ${strikes}/6`, 681, 24, 174)
  ctx.textAlign = 'left'

  // Reactor Quick-Status Pill (read-only telemetry indicator)
  const coreRounded = Math.round(telemetry.coreTemp)
  const isCritical = coreRounded >= 900 || telemetry.radiationLevel >= 8.0
  const isElevated = !isCritical && (coreRounded >= 680 || telemetry.isBlackout)
  const pillColor = isCritical ? '#ff2a2a' : isElevated ? '#ffb000' : '#33ff66'
  const statusWord = isCritical
    ? 'CRIT'
    : telemetry.isBlackout
      ? 'UPS'
      : isElevated
        ? 'WARN'
        : 'OK'
  ctx.fillStyle = '#08200f'
  ctx.fillRect(782, 6, 230, 36)
  ctx.strokeStyle = pillColor
  ctx.lineWidth = 2
  ctx.strokeRect(782, 6, 230, 36)
  ctx.fillStyle = pillColor
  ctx.font = 'bold 17px "Courier Prime", monospace'
  ctx.fillText(`CORE ${coreRounded}C [${statusWord}]`, 794, 24, 206)

  // =========================================================================
  // 2. DESKTOP SHORTCUT ICON (ONLY P.O.S.T.-84)
  // =========================================================================
  const unreadMailCount = state.mailMessages.filter((m) => m.status === 'unread').length
  const isMailHovered = hoveredId === 'icon:mail'
  const isMailOpen = state.openWindows.includes('mail')
  const isMailMinimized = state.minimizedWindows.includes('mail')

  ctx.fillStyle =
    mailAlertPhase === 2 && unreadMailCount > 0
      ? '#261d05'
      : isMailHovered
        ? '#164d25'
        : isMailOpen
          ? '#0f391b'
          : 'rgba(9, 34, 16, 0.72)'
  ctx.fillRect(24, 64, 184, 104)

  if (mailAlertPhase === 2 && unreadMailCount > 0) {
    ctx.strokeStyle = '#ffb000'
    ctx.lineWidth = 3
    ctx.strokeRect(24, 64, 184, 104)
  } else if (isMailHovered || isMailOpen) {
    ctx.strokeStyle = isMailHovered ? '#e6dec3' : '#33ff66'
    ctx.lineWidth = isMailHovered ? 3 : 2
    ctx.strokeRect(24, 64, 184, 104)
  } else {
    ctx.strokeStyle = isMailMinimized ? '#ffb000' : '#185929'
    ctx.lineWidth = 1.5
    ctx.strokeRect(24, 64, 184, 104)
  }

  if (unreadMailCount > 0) {
    ctx.fillStyle = '#ffb000'
    ctx.fillRect(166, 70, 36, 20)
    ctx.textAlign = 'center'
    ctx.font = 'bold 16px "Courier Prime", monospace'
    ctx.fillStyle = '#061a0c'
    ctx.fillText(String(unreadMailCount), 184, 80)
  } else if (isMailOpen || isMailMinimized) {
    ctx.fillStyle = isMailOpen ? '#33ff66' : '#ffb000'
    ctx.fillRect(194, 72, 8, 8)
  }

  drawMailEnvelopeGlyph(ctx, 81, 68, isMailHovered ? '#e6dec3' : '#33ff66')

  ctx.textAlign = 'center'
  ctx.font = 'bold 18px "Courier Prime", monospace'
  ctx.fillStyle = isMailHovered ? '#e6dec3' : '#33ff66'
  ctx.fillText('P.O.S.T.-84', 116, 128)
  ctx.font = '16px "Courier Prime", monospace'
  ctx.fillStyle = unreadMailCount > 0 ? '#ffb000' : '#22b549'
  ctx.fillText(unreadMailCount > 0 ? `${unreadMailCount} UNREAD` : 'STATE INBOX', 116, 150)

  // Registered SOV-OS 84 Plugin App Icons
  const pluginApps = getSovOsPluginApps()
  pluginApps.forEach((plugin, idx) => {
    const iy = 182 + idx * 116
    const status = plugin.getStatusMeta()
    const isPlugHover = hoveredId === `icon:${plugin.id}`
    const isPlugOpen = state.openWindows.includes(plugin.id)
    const isPlugMin = state.minimizedWindows.includes(plugin.id)
    const hasAlert = status.alertSeverity !== 'none'
    const alertCol = status.alertSeverity === 'danger' ? '#ff2a2a' : '#ffb000'

    ctx.fillStyle =
      mailAlertPhase === 2 && hasAlert
        ? status.alertSeverity === 'danger'
          ? '#380d0d'
          : '#261d05'
        : isPlugHover
          ? '#164d25'
          : isPlugOpen
            ? '#0f391b'
            : 'rgba(9, 34, 16, 0.72)'
    ctx.fillRect(24, iy, 184, 104)

    if (mailAlertPhase === 2 && hasAlert) {
      ctx.strokeStyle = alertCol
      ctx.lineWidth = 3
      ctx.strokeRect(24, iy, 184, 104)
    } else if (isPlugHover || isPlugOpen) {
      ctx.strokeStyle = isPlugHover ? '#e6dec3' : '#33ff66'
      ctx.lineWidth = isPlugHover ? 3 : 2
      ctx.strokeRect(24, iy, 184, 104)
    } else {
      ctx.strokeStyle = hasAlert ? alertCol : isPlugMin ? '#ffb000' : '#185929'
      ctx.lineWidth = hasAlert ? 2 : 1.5
      ctx.strokeRect(24, iy, 184, 104)
    }

    if (status.badgeText) {
      ctx.fillStyle = alertCol
      ctx.fillRect(162, iy + 6, 40, 20)
      ctx.textAlign = 'center'
      ctx.font = 'bold 14px "Courier Prime", monospace'
      ctx.fillStyle = '#061a0c'
      ctx.fillText(status.badgeText, 182, iy + 16)
    } else if (isPlugOpen || isPlugMin) {
      ctx.fillStyle = isPlugOpen ? '#33ff66' : '#ffb000'
      ctx.fillRect(194, iy + 8, 8, 8)
    }

    plugin.drawIconGlyph(
      ctx,
      81,
      iy + 4,
      isPlugHover ? '#e6dec3' : '#33ff66',
      status.alertSeverity
    )

    ctx.textAlign = 'center'
    ctx.font = 'bold 18px "Courier Prime", monospace'
    ctx.fillStyle = isPlugHover ? '#e6dec3' : '#33ff66'
    ctx.fillText(plugin.iconTitle, 116, iy + 64)
    ctx.font = '15px "Courier Prime", monospace'
    ctx.fillStyle = hasAlert ? alertCol : '#22b549'
    ctx.fillText(status.subtitle, 116, iy + 86, 172)
  })

  // =========================================================================
  // 3. OPEN WINDOW (P.O.S.T.-84 OR ACTIVE PLUGIN APP)
  // =========================================================================
  const activeWinId = state.openWindows[0]
  const activePlugin =
    activeWinId && activeWinId !== 'mail'
      ? getSovOsPluginApp(activeWinId)
      : undefined
  if (telemetry.shiftCompletedAt0600 !== 'active') {
    // Crisp 06:00 Shift-Complete lockout banner across SOV-OS 84 desktop
    ctx.fillStyle = 'rgba(4, 14, 8, 0.9)'
    ctx.fillRect(228, 128, 744, 248)
    ctx.strokeStyle = '#ffb000'
    ctx.lineWidth = 4
    ctx.strokeRect(228, 128, 744, 248)
    ctx.strokeStyle = '#33ff66'
    ctx.lineWidth = 2
    ctx.strokeRect(238, 138, 724, 228)

    ctx.fillStyle = '#2b1d05'
    ctx.fillRect(240, 140, 720, 44)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffb000'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.fillText('06:00 NIGHT RELIEF AUTOMATED STANDBY ENGAGED', 600, 162, 696)

    ctx.fillStyle = '#33ff66'
    ctx.font = 'bold 34px "Kremlin", "Courier Prime", monospace'
    ctx.fillText('SHIFT COMPLETE — REPORT TO LIFT-84', 600, 232, 696)

    ctx.fillStyle = '#e6dec3'
    ctx.font = 'bold 18px "Courier Prime", monospace'
    ctx.fillText('ALL REACTOR PANELS & DESK APPS LOCKED UNTIL NEXT SHIFT.', 600, 290, 696)
    ctx.fillStyle = '#ffb000'
    ctx.fillText('EXIT THROUGH MCR-4 AIRLOCK & BOARD LIFT-84 ELEVATOR.', 600, 326, 696)
    ctx.textAlign = 'left'
  } else if (isMailOpen || activePlugin) {
    const rect = getWindowRect()
    const winId: DesktopAppId = activePlugin ? activePlugin.id : 'mail'
    const winTitle = activePlugin
      ? activePlugin.windowTitle
      : 'P.O.S.T.-84 // STATE TELETYPE INBOX'

    // Drop shadow behind window
    ctx.fillStyle = '#030d06'
    ctx.fillRect(rect.x + 8, rect.y + 8, rect.w, rect.h)

    // Window body frame
    ctx.fillStyle = '#081f0f'
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    ctx.strokeStyle = '#33ff66'
    ctx.lineWidth = 3
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)

    // Title bar
    ctx.fillStyle = '#165226'
    ctx.fillRect(rect.x, rect.y, rect.w, 44)
    ctx.fillStyle = '#33ff66'
    ctx.fillRect(rect.x, rect.y + 42, rect.w, 2)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#e6dec3'
    drawFittedKremlinTitle(ctx, winTitle, rect.x + 18, rect.y + 22, rect.w - 132)

    // Minimize [_] button
    const minHover = hoveredId === `win:${winId}:minimize`
    const mx = rect.x + rect.w - 94
    const my = rect.y + 6
    ctx.fillStyle = minHover ? '#24753a' : '#0d3b1b'
    ctx.fillRect(mx, my, 40, 32)
    ctx.strokeStyle = minHover ? '#e6dec3' : '#33ff66'
    ctx.lineWidth = 2
    ctx.strokeRect(mx, my, 40, 32)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e6dec3'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.fillText('_', mx + 20, my + 14)

    // Close [X] button
    const closeHover = hoveredId === `win:${winId}:close`
    const cx = rect.x + rect.w - 48
    const cy = rect.y + 6
    ctx.fillStyle = closeHover ? '#ff2a2a' : '#4a1212'
    ctx.fillRect(cx, cy, 40, 32)
    ctx.strokeStyle = closeHover ? '#e6dec3' : '#ff2a2a'
    ctx.lineWidth = 2
    ctx.strokeRect(cx, cy, 40, 32)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e6dec3'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.fillText('X', cx + 20, cy + 16)

    if (activePlugin) {
      activePlugin.paintWindow(ctx, rect, hoveredId, mailAlertPhase)
    } else {
      paintMailWindow(ctx, rect, state, telemetry, hoveredId, mailAlertPhase)
    }
  }

  // =========================================================================
  // 4. BOTTOM TASKBAR (y = 588..640) — HOME, POST-84 & PLUGIN TABS
  // =========================================================================
  ctx.fillStyle = '#0c2914'
  ctx.fillRect(0, 588, W, 52)
  ctx.fillStyle = '#33ff66'
  ctx.fillRect(0, 588, W, 2)

  // HOME / Minimize-All button
  const deskHover = hoveredId === 'taskbar:desk'
  const isHomeDesktop = state.openWindows.length === 0
  ctx.fillStyle = isHomeDesktop ? '#33ff66' : deskHover ? '#195429' : '#08200f'
  ctx.fillRect(14, 594, 104, 38)
  ctx.strokeStyle = deskHover ? '#e6dec3' : '#33ff66'
  ctx.lineWidth = 2
  ctx.strokeRect(14, 594, 104, 38)
  ctx.textAlign = 'center'
  ctx.font = 'bold 17px "Courier Prime", monospace'
  ctx.fillStyle = isHomeDesktop ? '#061a0c' : '#e6dec3'
  ctx.fillText('HOME', 66, 613)

  // POST-84 taskbar toggle button
  const mailTabHover = hoveredId === 'taskbar:mail'
  ctx.fillStyle = isMailOpen
    ? '#33ff66'
    : mailTabHover
      ? '#164d24'
      : isMailMinimized
        ? '#0a2612'
        : '#071b0c'
  ctx.fillRect(126, 594, 148, 38)
  ctx.strokeStyle = mailTabHover
    ? '#e6dec3'
    : isMailOpen
      ? '#33ff66'
      : mailAlertPhase === 2 && unreadMailCount > 0
        ? '#ffb000'
        : isMailMinimized
          ? '#ffb000'
          : '#1b5e2d'
  ctx.lineWidth = 2
  ctx.strokeRect(126, 594, 148, 38)
  ctx.fillStyle = isMailOpen
    ? '#061a0c'
    : isMailMinimized
      ? '#ffb000'
      : '#22b549'
  ctx.font = 'bold 16px "Courier Prime", monospace'
  const mailPrefix = isMailOpen ? '* ' : isMailMinimized ? '_ ' : ''
  const showTaskbarUnreadBadge = unreadMailCount > 0 && !isMailOpen
  ctx.fillText(`${mailPrefix}POST-84`, showTaskbarUnreadBadge ? 188 : 200, 613)

  if (showTaskbarUnreadBadge) {
    ctx.fillStyle = '#ffb000'
    ctx.fillRect(246, 603, 22, 20)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#061a0c'
    ctx.font = 'bold 14px "Courier Prime", monospace'
    ctx.fillText(String(unreadMailCount), 257, 613)
  }

  // Registered plugin taskbar tabs
  pluginApps.forEach((plugin, idx) => {
    const tx = 282 + idx * 142
    const tw = 134
    const pStatus = plugin.getStatusMeta()
    const isPlugOpen = state.openWindows.includes(plugin.id)
    const isPlugMin = state.minimizedWindows.includes(plugin.id)
    const isTabHover = hoveredId === `taskbar:${plugin.id}`
    const alertCol = pStatus.alertSeverity === 'danger' ? '#ff2a2a' : '#ffb000'
    const hasAlert = pStatus.alertSeverity !== 'none'

    ctx.fillStyle = isPlugOpen
      ? '#33ff66'
      : isTabHover
        ? '#164d24'
        : mailAlertPhase === 2 && hasAlert
          ? '#241804'
          : isPlugMin
            ? '#0a2612'
            : '#071b0c'
    ctx.fillRect(tx, 594, tw, 38)
    ctx.strokeStyle = isTabHover
      ? '#e6dec3'
      : isPlugOpen
        ? '#33ff66'
        : hasAlert
          ? alertCol
          : isPlugMin
            ? '#ffb000'
            : '#1b5e2d'
    ctx.lineWidth = 2
    ctx.strokeRect(tx, 594, tw, 38)
    ctx.textAlign = 'center'
    ctx.fillStyle = isPlugOpen
      ? '#061a0c'
      : hasAlert
        ? alertCol
        : isPlugMin
          ? '#ffb000'
          : '#22b549'
    ctx.font = 'bold 15px "Courier Prime", monospace'
    const prefix = isPlugOpen ? '* ' : isPlugMin ? '_ ' : ''
    ctx.fillText(`${prefix}${plugin.taskbarLabel}`, tx + tw / 2, 613, tw - 10)
  })

  // Taskbar right status readout
  if (mailAlertPhase > 0) {
    const alertText = `! ${state.lastStatusNotice.slice(0, 28)} !`
    ctx.fillStyle = mailAlertPhase === 2 ? '#ffb000' : '#241904'
    ctx.fillRect(W - 314, 596, 300, 34)
    ctx.strokeStyle = '#ffb000'
    ctx.lineWidth = 2
    ctx.strokeRect(W - 314, 596, 300, 34)
    ctx.textAlign = 'center'
    ctx.font = 'bold 15px "Courier Prime", monospace'
    ctx.fillStyle = mailAlertPhase === 2 ? '#061a0c' : '#ffb000'
    ctx.fillText(alertText, W - 164, 613, 288)
  } else {
    ctx.textAlign = 'right'
    ctx.font = 'bold 16px "Courier Prime", monospace'
    ctx.fillStyle = '#22b549'
    ctx.fillText(state.lastStatusNotice.slice(0, 34), W - 14, 613)
  }

  // Strike 5 seated intimidation CRT static jolt & crimson warning overlay
  if (telemetry.strike5SurgeFlashSec > 0) {
    const joltSeed = Math.floor(telemetry.strike5SurgeFlashSec * 24)
    const intensity = Math.min(1, telemetry.strike5SurgeFlashSec / 1.4)
    ctx.fillStyle = `rgba(255, 42, 42, ${(0.12 * intensity).toFixed(3)})`
    ctx.fillRect(0, 0, W, H)
    for (let k = 0; k < 16; k++) {
      const bandY = ((joltSeed * 89 + k * 53) % (H - 16)) + 4
      const bandH = k % 3 === 0 ? 10 : 4
      ctx.fillStyle =
        k % 2 === 0
          ? `rgba(255, 42, 42, ${(0.34 * intensity).toFixed(3)})`
          : `rgba(230, 222, 195, ${(0.22 * intensity).toFixed(3)})`
      ctx.fillRect(0, bandY, W, bandH)
    }
    ctx.strokeStyle = joltSeed % 2 === 0 ? '#ff2a2a' : '#ffb000'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, W - 6, H - 6)

    ctx.fillStyle = 'rgba(26, 4, 4, 0.92)'
    ctx.fillRect(148, 524, W - 296, 50)
    ctx.strokeStyle = '#ff2a2a'
    ctx.lineWidth = 3
    ctx.strokeRect(148, 524, W - 296, 50)
    ctx.textAlign = 'center'
    ctx.fillStyle = joltSeed % 2 === 0 ? '#ff4d4d' : '#ffb000'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.fillText(
      '!! 5/6 TREASON STRIKES — FINAL SIBERIA WARNING !!',
      W / 2,
      549,
      W - 320
    )
    ctx.textAlign = 'left'
  }

  // Subtle CRT horizontal scanline pass
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)'
  for (let sy = 0; sy < H; sy += 4) {
    ctx.fillRect(0, sy, W, 1)
  }

  // Retro Phosphor Cursor Overlay when pointing at CRT
  if (cursorPos) {
    const cx = Math.round(cursorPos.x)
    const cy = Math.round(cursorPos.y)
    ctx.fillStyle = '#061a0c'
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + 18, cy + 12)
    ctx.lineTo(cx + 8, cy + 14)
    ctx.lineTo(cx + 3, cy + 23)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = hoveredId ? '#ffb000' : '#e6dec3'
    ctx.beginPath()
    ctx.moveTo(cx + 2, cy + 2)
    ctx.lineTo(cx + 15, cy + 11)
    ctx.lineTo(cx + 7, cy + 13)
    ctx.lineTo(cx + 3, cy + 19)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

function paintMailWindow(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  state: DesktopOsState,
  telemetry: DesktopTelemetrySnapshot,
  hoveredId: string | null,
  mailAlertPhase: 0 | 1 | 2
) {
  const unreadCount = state.mailMessages.filter((m) => m.status === 'unread').length
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  // Inbox header & scroll controls (`rect.y + 56 .. 86`)
  ctx.fillStyle = unreadCount > 0 ? '#ffb000' : '#33ff66'
  ctx.font = 'bold 17px "Courier Prime", monospace'
  ctx.fillText(`INBOX (${unreadCount} NEW)`, rect.x + 18, rect.y + 71)

  const upHover = hoveredId === 'mail:scroll_up'
  const dnHover = hoveredId === 'mail:scroll_down'
  ctx.fillStyle = upHover ? '#164d24' : '#0b2b14'
  ctx.fillRect(rect.x + 190, rect.y + 56, 40, 30)
  ctx.strokeStyle = upHover ? '#e6dec3' : '#33ff66'
  ctx.lineWidth = 2
  ctx.strokeRect(rect.x + 190, rect.y + 56, 40, 30)

  ctx.fillStyle = dnHover ? '#164d24' : '#0b2b14'
  ctx.fillRect(rect.x + 236, rect.y + 56, 40, 30)
  ctx.strokeStyle = dnHover ? '#e6dec3' : '#33ff66'
  ctx.strokeRect(rect.x + 236, rect.y + 56, 40, 30)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#e6dec3'
  ctx.font = 'bold 17px "Courier Prime", monospace'
  ctx.fillText('▲', rect.x + 210, rect.y + 71)
  ctx.fillText('▼', rect.x + 256, rect.y + 71)

  // Left inbox list pane (5 visible rows)
  const visibleMail = state.mailMessages.slice(
    state.mailScrollOffset,
    state.mailScrollOffset + 5
  )
  const selected = state.selectedMailId
    ? (state.mailMessages.find((m) => m.id === state.selectedMailId) ?? null)
    : null

  ctx.textAlign = 'left'
  visibleMail.forEach((msg, idx) => {
    const rx = rect.x + 16
    const ry = rect.y + 94 + idx * 70
    const isUnread = msg.status === 'unread'
    const isSel = selected !== null && selected.id === msg.id
    const isHover = hoveredId === `mail:row:${msg.id}`
    const order = msg.order

    if (order) {
      const os = order.orderState
      if (isSel) {
        ctx.fillStyle = '#144922'
        ctx.strokeStyle = isHover ? '#e6dec3' : '#ffb000'
      } else if (os === 'completed') {
        ctx.fillStyle = isHover ? '#103b1c' : '#0b2813'
        ctx.strokeStyle = isHover ? '#e6dec3' : '#22b549'
      } else if (os === 'active') {
        ctx.fillStyle = isHover ? '#144421' : '#0f3319'
        ctx.strokeStyle = isHover ? '#e6dec3' : '#ffb000'
      } else if (isUnread) {
        ctx.fillStyle = isHover ? '#242d0c' : '#1b2408'
        ctx.strokeStyle = isHover ? '#e6dec3' : '#ffb000'
      } else {
        ctx.fillStyle = isHover ? '#103b1c' : '#0b2813'
        ctx.strokeStyle = isHover ? '#e6dec3' : '#1b6b31'
      }
      ctx.lineWidth = isSel || isHover || isUnread || os === 'active' ? 2.5 : 1.5
      ctx.fillRect(rx, ry, 260, 64)
      ctx.strokeRect(rx, ry, 260, 64)

      if (os === 'completed') {
        ctx.fillStyle = '#0a2e15'
        ctx.fillRect(rx + 6, ry + 10, 96, 20)
        ctx.strokeStyle = '#33ff66'
        ctx.lineWidth = 1.5
        ctx.strokeRect(rx + 6, ry + 10, 96, 20)
        ctx.fillStyle = '#33ff66'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('[COMPLETED]', rx + 54, ry + 20)
        ctx.textAlign = 'left'
      } else if (os === 'active') {
        ctx.fillStyle = '#0f3d1d'
        ctx.fillRect(rx + 6, ry + 10, 96, 20)
        ctx.strokeStyle = '#33ff66'
        ctx.lineWidth = 1.5
        ctx.strokeRect(rx + 6, ry + 10, 96, 20)
        ctx.fillStyle = '#33ff66'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('[DIRECTIVE]', rx + 54, ry + 20)
        ctx.textAlign = 'left'
      } else if (isUnread) {
        ctx.fillStyle = '#ffb000'
        ctx.fillRect(rx + 6, ry + 10, 96, 20)
        ctx.fillStyle = '#061a0c'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('[DIRECTIVE]', rx + 54, ry + 20)
        ctx.textAlign = 'left'
      } else {
        ctx.fillStyle = '#261c04'
        ctx.fillRect(rx + 6, ry + 10, 96, 20)
        ctx.strokeStyle = '#ffb000'
        ctx.lineWidth = 1.5
        ctx.strokeRect(rx + 6, ry + 10, 96, 20)
        ctx.fillStyle = '#ffb000'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('[DIRECTIVE]', rx + 54, ry + 20)
        ctx.textAlign = 'left'
      }

      ctx.fillStyle = isSel
        ? '#e6dec3'
        : isUnread || os === 'active'
          ? '#ffb000'
          : '#33ff66'
      ctx.font = 'bold 15px "Courier Prime", monospace'
      ctx.fillText(fitEllipsis(ctx, msg.sender, 144), rx + 108, ry + 20)

      ctx.fillStyle = '#e6dec3'
      ctx.font = '15px "Courier Prime", monospace'
      ctx.fillText(fitEllipsis(ctx, msg.subject, 244), rx + 8, ry + 45)
    } else if (msg.trainingDirective) {
      const tdState = msg.trainingDirective.state
      const isPending = tdState === 'pending'
      if (isSel) {
        ctx.fillStyle = isPending && mailAlertPhase === 2 ? '#29300a' : '#144922'
        ctx.strokeStyle = isHover ? '#e6dec3' : '#ffb000'
      } else if (isPending) {
        ctx.fillStyle = isHover
          ? '#2c360b'
          : mailAlertPhase === 2
            ? '#2a2205'
            : '#1b2408'
        ctx.strokeStyle = isHover ? '#e6dec3' : '#ffb000'
      } else {
        ctx.fillStyle = isHover ? '#103b1c' : '#0b2813'
        ctx.strokeStyle = isHover ? '#e6dec3' : '#22b549'
      }
      ctx.lineWidth = isSel || isHover || isPending ? 2.5 : 1.5
      ctx.fillRect(rx, ry, 260, 64)
      ctx.strokeRect(rx, ry, 260, 64)

      if (isPending) {
        ctx.fillStyle = mailAlertPhase === 2 ? '#33ff66' : '#ffb000'
        ctx.fillRect(rx + 6, ry + 10, 96, 20)
        ctx.fillStyle = '#061a0c'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('[DIRECTIVE]', rx + 54, ry + 20)
        ctx.textAlign = 'left'
      } else {
        ctx.fillStyle = '#0a2e15'
        ctx.fillRect(rx + 6, ry + 10, 96, 20)
        ctx.strokeStyle = '#33ff66'
        ctx.lineWidth = 1.5
        ctx.strokeRect(rx + 6, ry + 10, 96, 20)
        ctx.fillStyle = '#33ff66'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(
          tdState === 'accepted' ? '[ACCEPTED]' : '[SKIPPED]',
          rx + 54,
          ry + 20
        )
        ctx.textAlign = 'left'
      }

      ctx.fillStyle = isSel ? '#e6dec3' : isPending ? '#ffb000' : '#33ff66'
      ctx.font = 'bold 15px "Courier Prime", monospace'
      ctx.fillText(fitEllipsis(ctx, msg.sender, 144), rx + 108, ry + 20)

      ctx.fillStyle = '#e6dec3'
      ctx.font = '15px "Courier Prime", monospace'
      ctx.fillText(fitEllipsis(ctx, msg.subject, 244), rx + 8, ry + 45)
    } else {
      ctx.fillStyle = isSel
        ? '#144922'
        : isHover
          ? '#103b1c'
          : isUnread
            ? '#1b2408'
            : '#0b2813'
      ctx.fillRect(rx, ry, 260, 64)
      ctx.strokeStyle = isHover
        ? '#e6dec3'
        : isSel || isUnread
          ? '#ffb000'
          : '#1b6b31'
      ctx.lineWidth = isSel || isHover || isUnread ? 2.5 : 1.5
      ctx.strokeRect(rx, ry, 260, 64)

      if (isUnread) {
        ctx.fillStyle = '#ffb000'
        ctx.fillRect(rx + 6, ry + 9, 58, 22)
        ctx.fillStyle = '#061a0c'
        ctx.font = 'bold 15px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText('[NEW]', rx + 35, ry + 20)
        ctx.textAlign = 'left'
      } else {
        ctx.fillStyle = '#22b549'
        ctx.font = 'bold 15px "Courier Prime", monospace'
        ctx.fillText('[READ]', rx + 8, ry + 20)
      }

      ctx.fillStyle = isSel ? '#e6dec3' : isUnread ? '#ffb000' : '#33ff66'
      ctx.font = 'bold 15px "Courier Prime", monospace'
      ctx.fillText(fitEllipsis(ctx, msg.sender, 180), rx + 72, ry + 20)

      ctx.fillStyle = '#e6dec3'
      ctx.font = '15px "Courier Prime", monospace'
      ctx.fillText(fitEllipsis(ctx, msg.subject, 244), rx + 8, ry + 45)
    }
  })

  // Footer list index hint
  const startIdx = state.mailMessages.length === 0 ? 0 : state.mailScrollOffset + 1
  const endIdx = Math.min(state.mailMessages.length, state.mailScrollOffset + visibleMail.length)
  ctx.fillStyle = '#22b549'
  ctx.font = '16px "Courier Prime", monospace'
  ctx.fillText(
    `MSG ${startIdx}-${endIdx} OF ${state.mailMessages.length}`,
    rect.x + 18,
    rect.y + 452
  )

  // Right reading pane
  ctx.fillStyle = '#0c2c16'
  ctx.fillRect(rect.x + 288, rect.y + 56, 436, 398)
  ctx.strokeStyle = '#1e7837'
  ctx.lineWidth = 2
  ctx.strokeRect(rect.x + 288, rect.y + 56, 436, 398)

  if (!selected) {
    if (state.mailMessages.length === 0) {
      ctx.fillStyle = '#22b549'
      ctx.font = '18px "Courier Prime", monospace'
      ctx.fillText('INBOX EMPTY.', rect.x + 310, rect.y + 120)
      return
    }

    const centerX = rect.x + 506
    drawMailEnvelopeGlyph(
      ctx,
      centerX - 35,
      rect.y + 150,
      unreadCount > 0 ? '#ffb000' : '#33ff66'
    )
    ctx.textAlign = 'center'
    ctx.fillStyle = '#33ff66'
    ctx.font = 'bold 18px "Courier Prime", monospace'
    ctx.fillText('P.O.S.T.-84 TELETYPE ARCHIVE', centerX, rect.y + 228)

    ctx.fillStyle = unreadCount > 0 ? '#ffb000' : '#22b549'
    ctx.font = 'bold 16px "Courier Prime", monospace'
    ctx.fillText(
      unreadCount > 0
        ? `${unreadCount} UNREAD MESSAGE${unreadCount === 1 ? '' : 'S'} WAITING`
        : 'ALL DISPATCHES READ',
      centerX,
      rect.y + 260
    )

    ctx.fillStyle = '#e6dec3'
    ctx.font = '15px "Courier Prime", monospace'
    ctx.fillText('CLICK A MESSAGE ON THE LEFT TO READ', centerX, rect.y + 294)
    ctx.textAlign = 'left'
    return
  }

  if (selected.order) {
    const order = selected.order
    const evalRes = evaluatePost84Order(
      order.templateId,
      telemetry,
      order.holdProgressSec,
      order.holdDurationSec,
      order.orderState
    )

    // Metadata card
    ctx.fillStyle = '#071d0e'
    ctx.fillRect(rect.x + 300, rect.y + 66, 412, 84)
    ctx.strokeStyle = '#22b549'
    ctx.lineWidth = 1.5
    ctx.strokeRect(rect.x + 300, rect.y + 66, 412, 84)

    ctx.fillStyle = '#ffb000'
    ctx.font = 'bold 14px "Courier Prime", monospace'
    ctx.fillText(
      `FROM: ${selected.sender} [${selected.orgTag}]`,
      rect.x + 308,
      rect.y + 83,
      396
    )

    ctx.fillStyle = '#e6dec3'
    ctx.font = 'bold 14px "Courier Prime", monospace'
    ctx.fillText(`SUBJ: ${selected.subject}`, rect.x + 308, rect.y + 108, 396)

    ctx.fillStyle = '#22b549'
    ctx.font = '14px "Courier Prime", monospace'
    ctx.fillText(`DATE: ${selected.timestamp}`, rect.x + 308, rect.y + 133, 396)

    // Body box
    ctx.fillStyle = '#061a0c'
    ctx.fillRect(rect.x + 300, rect.y + 158, 412, 128)
    ctx.strokeStyle = '#164d25'
    ctx.lineWidth = 1.5
    ctx.strokeRect(rect.x + 300, rect.y + 158, 412, 128)

    let bodyY = rect.y + 174
    ctx.fillStyle = '#e6dec3'
    ctx.font = '14px "Courier Prime", monospace'
    for (const para of selected.bodyLines) {
      const maxLines = Math.floor((rect.y + 280 - bodyY) / 17)
      if (maxLines <= 0) break
      const drawn = drawWrappedText(ctx, para, rect.x + 312, bodyY, 388, 17, maxLines)
      bodyY += drawn * 17 + 7
    }

    // OBJECTIVE & REWARD card
    ctx.fillStyle = '#071d0e'
    ctx.fillRect(rect.x + 300, rect.y + 294, 412, 92)
    ctx.strokeStyle =
      order.orderState === 'completed'
        ? '#33ff66'
        : order.orderState === 'active'
          ? '#ffb000'
          : '#22b549'
    ctx.lineWidth = 1.5
    ctx.strokeRect(rect.x + 300, rect.y + 294, 412, 92)

    ctx.fillStyle = '#ffb000'
    ctx.font = 'bold 14px "Courier Prime", monospace'
    ctx.fillText('OBJECTIVE:', rect.x + 310, rect.y + 312)
    ctx.textAlign = 'right'
    ctx.fillText(
      `REWARD: +${order.rewardRub} RUB  +${order.quotaPoints} QUOTA`,
      rect.x + 702,
      rect.y + 312
    )
    ctx.textAlign = 'left'

    ctx.fillStyle =
      order.orderState === 'completed' || evalRes.met ? '#33ff66' : '#e6dec3'
    ctx.font = 'bold 14px "Courier Prime", monospace'
    ctx.fillText(evalRes.liveReadout, rect.x + 310, rect.y + 336, 392)

    if (order.orderState === 'active') {
      const pct = Math.max(
        0,
        Math.min(1, order.holdProgressSec / Math.max(1, order.holdDurationSec))
      )
      ctx.fillStyle = '#061a0c'
      ctx.fillRect(rect.x + 310, rect.y + 354, 392, 22)
      const fillW = Math.round(392 * pct)
      if (fillW > 0) {
        ctx.fillStyle = evalRes.met ? '#1a7a38' : '#6b4b08'
        ctx.fillRect(rect.x + 310, rect.y + 354, fillW, 22)
      }
      ctx.strokeStyle = evalRes.met ? '#33ff66' : '#ffb000'
      ctx.lineWidth = 1.5
      ctx.strokeRect(rect.x + 310, rect.y + 354, 392, 22)

      ctx.textAlign = 'center'
      ctx.fillStyle = '#e6dec3'
      ctx.font = 'bold 13px "Courier Prime", monospace'
      ctx.fillText(
        evalRes.met
          ? `HOLDING TARGET: ${order.holdProgressSec.toFixed(1)}s / ${order.holdDurationSec}s`
          : `ADJUST CONTROLS — HELD ${order.holdProgressSec.toFixed(1)}s / ${order.holdDurationSec}s`,
        rect.x + 506,
        rect.y + 365,
        382
      )
      ctx.textAlign = 'left'
    } else if (order.orderState === 'pending') {
      ctx.fillStyle = '#22b549'
      ctx.font = '13px "Courier Prime", monospace'
      ctx.fillText(evalRes.detailLine, rect.x + 310, rect.y + 365, 392)
    } else {
      ctx.fillStyle = '#0f4720'
      ctx.fillRect(rect.x + 310, rect.y + 354, 392, 22)
      ctx.strokeStyle = '#33ff66'
      ctx.lineWidth = 1.5
      ctx.strokeRect(rect.x + 310, rect.y + 354, 392, 22)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#33ff66'
      ctx.font = 'bold 13px "Courier Prime", monospace'
      ctx.fillText(
        `PAID +${order.rewardRub} RUB // +${order.quotaPoints} QUOTA CREDITED`,
        rect.x + 506,
        rect.y + 365,
        382
      )
      ctx.textAlign = 'left'
    }

    // Bottom Action / Status Bar
    if (order.orderState === 'pending') {
      const acceptHover = hoveredId === 'mail:accept_order'
      ctx.fillStyle = acceptHover ? '#33ff66' : '#124a21'
      ctx.fillRect(rect.x + 300, rect.y + 396, 412, 46)
      ctx.strokeStyle = acceptHover ? '#e6dec3' : '#33ff66'
      ctx.lineWidth = 2
      ctx.strokeRect(rect.x + 300, rect.y + 396, 412, 46)
      ctx.textAlign = 'center'
      ctx.fillStyle = acceptHover ? '#061a0c' : '#e6dec3'
      ctx.font = 'bold 17px "Courier Prime", monospace'
      ctx.fillText('[ACCEPT DIRECTIVE]', rect.x + 506, rect.y + 419)
    } else if (order.orderState === 'active') {
      ctx.fillStyle = '#1f1604'
      ctx.fillRect(rect.x + 300, rect.y + 396, 412, 46)
      ctx.strokeStyle = '#ffb000'
      ctx.lineWidth = 2
      ctx.strokeRect(rect.x + 300, rect.y + 396, 412, 46)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffb000'
      ctx.font = 'bold 13px "Courier Prime", monospace'
      ctx.fillText(
        'TRACKING ACTIVE — FULFILL AT UNIT A (AUTO-COMPLETES)',
        rect.x + 506,
        rect.y + 410,
        396
      )
      ctx.fillStyle = '#33ff66'
      ctx.font = '12px "Courier Prime", monospace'
      ctx.fillText(evalRes.detailLine, rect.x + 506, rect.y + 429, 396)
    } else {
      ctx.fillStyle = '#092913'
      ctx.fillRect(rect.x + 300, rect.y + 396, 412, 46)
      ctx.strokeStyle = '#33ff66'
      ctx.lineWidth = 2
      ctx.strokeRect(rect.x + 300, rect.y + 396, 412, 46)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#33ff66'
      ctx.font = 'bold 16px "Courier Prime", monospace'
      ctx.fillText(
        '[COMPLETED] — PAYOUT & QUOTA CREDITED',
        rect.x + 506,
        rect.y + 419,
        396
      )
    }
    ctx.textAlign = 'left'
    return
  }

  if (selected.trainingDirective) {
    const tdState = selected.trainingDirective.state

    // Metadata card
    ctx.fillStyle = '#071d0e'
    ctx.fillRect(rect.x + 300, rect.y + 66, 412, 82)
    ctx.strokeStyle = tdState === 'pending' ? '#ffb000' : '#22b549'
    ctx.lineWidth = 1.5
    ctx.strokeRect(rect.x + 300, rect.y + 66, 412, 82)

    ctx.fillStyle = '#ffb000'
    ctx.font = 'bold 14px "Courier Prime", monospace'
    ctx.fillText(
      `FROM: ${selected.sender} [${selected.orgTag}]`,
      rect.x + 308,
      rect.y + 83,
      396
    )

    ctx.fillStyle = '#e6dec3'
    ctx.font = 'bold 14px "Courier Prime", monospace'
    ctx.fillText(`SUBJ: ${selected.subject}`, rect.x + 308, rect.y + 108, 396)

    ctx.fillStyle = '#22b549'
    ctx.font = '14px "Courier Prime", monospace'
    ctx.fillText(`DATE: ${selected.timestamp}`, rect.x + 308, rect.y + 132, 396)

    // Body box
    ctx.fillStyle = '#061a0c'
    ctx.fillRect(rect.x + 300, rect.y + 154, 412, 194)
    ctx.strokeStyle = '#164d25'
    ctx.lineWidth = 1.5
    ctx.strokeRect(rect.x + 300, rect.y + 154, 412, 194)

    let bodyY = rect.y + 171
    ctx.fillStyle = '#e6dec3'
    ctx.font = '14px "Courier Prime", monospace'
    for (const para of selected.bodyLines) {
      const maxLines = Math.floor((rect.y + 342 - bodyY) / 17)
      if (maxLines <= 0) break
      const drawn = drawWrappedText(ctx, para, rect.x + 312, bodyY, 388, 17, maxLines)
      bodyY += drawn * 17 + 6
    }

    if (tdState === 'pending') {
      const acceptHover = hoveredId === 'mail:accept_training'
      const pulseOn = mailAlertPhase === 2
      ctx.fillStyle = acceptHover
        ? '#33ff66'
        : pulseOn
          ? '#244d14'
          : '#124a21'
      ctx.fillRect(rect.x + 300, rect.y + 356, 412, 44)
      ctx.strokeStyle = acceptHover
        ? '#e6dec3'
        : pulseOn
          ? '#ffb000'
          : '#33ff66'
      ctx.lineWidth = 2.5
      ctx.strokeRect(rect.x + 300, rect.y + 356, 412, 44)
      ctx.textAlign = 'center'
      ctx.fillStyle = acceptHover
        ? '#061a0c'
        : pulseOn
          ? '#ffb000'
          : '#e6dec3'
      ctx.font = 'bold 15px "Courier Prime", monospace'
      ctx.fillText(
        '[ ACCEPT DIRECTIVE — BEGIN TRAINING ]',
        rect.x + 506,
        rect.y + 378,
        396
      )

      const skipHover = hoveredId === 'mail:skip_training'
      ctx.fillStyle = skipHover ? '#362908' : '#0a2111'
      ctx.fillRect(rect.x + 300, rect.y + 408, 412, 34)
      ctx.strokeStyle = skipHover ? '#ffb000' : '#438557'
      ctx.lineWidth = 1.5
      ctx.strokeRect(rect.x + 300, rect.y + 408, 412, 34)
      ctx.fillStyle = skipHover ? '#ffb000' : '#8fd4a4'
      ctx.font = 'bold 13px "Courier Prime", monospace'
      ctx.fillText(
        '[ SKIP TRAINING — CERTIFIED OPERATOR ]',
        rect.x + 506,
        rect.y + 425,
        396
      )
    } else if (tdState === 'accepted') {
      ctx.fillStyle = '#092913'
      ctx.fillRect(rect.x + 300, rect.y + 356, 412, 86)
      ctx.strokeStyle = '#33ff66'
      ctx.lineWidth = 2
      ctx.strokeRect(rect.x + 300, rect.y + 356, 412, 86)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#33ff66'
      ctx.font = 'bold 16px "Courier Prime", monospace'
      ctx.fillText(
        '[ACCEPTED] — CALIBRATION ACTIVE',
        rect.x + 506,
        rect.y + 388,
        396
      )
      ctx.fillStyle = '#e6dec3'
      ctx.font = '14px "Courier Prime", monospace'
      ctx.fillText(
        'STAND UP [E] & CHECK CENTRAL SKALA-84 CRT',
        rect.x + 506,
        rect.y + 416,
        396
      )
    } else {
      ctx.fillStyle = '#092913'
      ctx.fillRect(rect.x + 300, rect.y + 356, 412, 86)
      ctx.strokeStyle = '#ffb000'
      ctx.lineWidth = 2
      ctx.strokeRect(rect.x + 300, rect.y + 356, 412, 86)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffb000'
      ctx.font = 'bold 16px "Courier Prime", monospace'
      ctx.fillText(
        '[SKIPPED] — CERTIFIED LIVE SHIFT',
        rect.x + 506,
        rect.y + 388,
        396
      )
      ctx.fillStyle = '#e6dec3'
      ctx.font = '14px "Courier Prime", monospace'
      ctx.fillText(
        'FULL REACTOR OPERATIONS & ORDERS ACTIVE',
        rect.x + 506,
        rect.y + 416,
        396
      )
    }
    ctx.textAlign = 'left'
    return
  }

  // Metadata card
  ctx.fillStyle = '#071d0e'
  ctx.fillRect(rect.x + 300, rect.y + 66, 412, 88)
  ctx.strokeStyle = '#22b549'
  ctx.lineWidth = 1.5
  ctx.strokeRect(rect.x + 300, rect.y + 66, 412, 88)

  ctx.fillStyle = '#ffb000'
  ctx.font = 'bold 14px "Courier Prime", monospace'
  ctx.fillText(
    `FROM: ${selected.sender} [${selected.orgTag}]`,
    rect.x + 308,
    rect.y + 84,
    396
  )

  ctx.fillStyle = '#e6dec3'
  ctx.font = 'bold 14px "Courier Prime", monospace'
  ctx.fillText(`SUBJ: ${selected.subject}`, rect.x + 308, rect.y + 110, 396)

  ctx.fillStyle = '#22b549'
  ctx.font = '14px "Courier Prime", monospace'
  ctx.fillText(`DATE: ${selected.timestamp}`, rect.x + 308, rect.y + 136, 396)

  // Message body box
  ctx.fillStyle = '#061a0c'
  ctx.fillRect(rect.x + 300, rect.y + 164, 412, 250)
  ctx.strokeStyle = '#164d25'
  ctx.lineWidth = 1.5
  ctx.strokeRect(rect.x + 300, rect.y + 164, 412, 250)

  let bodyY = rect.y + 180
  ctx.fillStyle = '#e6dec3'
  ctx.font = '15px "Courier Prime", monospace'
  for (const para of selected.bodyLines) {
    const maxLines = Math.floor((rect.y + 408 - bodyY) / 19)
    if (maxLines <= 0) break
    const drawn = drawWrappedText(ctx, para, rect.x + 312, bodyY, 388, 19, maxLines)
    bodyY += drawn * 19 + 9
  }

  // Clean non-interactive footer
  ctx.textAlign = 'center'
  ctx.fillStyle = '#22b549'
  ctx.font = '14px "Courier Prime", monospace'
  ctx.fillText(
    'P.O.S.T.-84 INTERNAL TELETYPE // NO ACTION REQUIRED',
    rect.x + 506,
    rect.y + 434
  )
  ctx.textAlign = 'left'
}
