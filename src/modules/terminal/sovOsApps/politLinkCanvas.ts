import type {
  SovOsAlertSeverity,
  SovOsPluginApp,
  SovOsPluginClickResult,
  SovOsPluginHitRegion,
  SovOsPluginStatusMeta,
  SovOsWindowRect,
} from '../../../shared/sovOsAppRegistry'
import { isPreVolkovPanelLocked, useGameStore } from '../../../shared/useGameStore'
import {
  getPolitLinkState,
  selectPolitLinkOption,
  startPolitLinkDuel,
} from './politLinkEngine'

function drawWrapped(
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
  let lines = 0
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight)
      lines += 1
      if (lines >= maxLines) return lines
      line = words[i]
    } else {
      line = test
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y + lines * lineHeight)
    lines += 1
  }
  return lines
}

function drawKomradEyeGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  alertSeverity: SovOsAlertSeverity
): void {
  ctx.save()
  ctx.strokeStyle = alertSeverity === 'danger' ? '#ff2a2a' : color
  ctx.fillStyle = alertSeverity === 'danger' ? '#ff2a2a' : color
  ctx.lineWidth = 2.5

  // Pixelated Soviet eye silhouette inside 70x48 box
  ctx.beginPath()
  ctx.moveTo(x + 8, y + 24)
  ctx.quadraticCurveTo(x + 35, y + 4, x + 62, y + 24)
  ctx.quadraticCurveTo(x + 35, y + 44, x + 8, y + 24)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x + 35, y + 24, 9, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillRect(x + 32, y + 21, 6, 6)
  ctx.restore()
}

function drawKomradOscilloscopePanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  suspicion: number,
  trust: number,
  animClockSec: number,
  active: boolean
): void {
  ctx.fillStyle = '#041208'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = suspicion >= 65 ? '#ff2a2a' : active ? '#ffb000' : '#22b549'
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, w, h)

  // Pixel grid inside CRT eye scope
  ctx.strokeStyle = '#0d2b16'
  ctx.lineWidth = 1
  for (let gx = x + 16; gx < x + w; gx += 16) {
    ctx.beginPath()
    ctx.moveTo(gx, y)
    ctx.lineTo(gx, y + h)
    ctx.stroke()
  }

  const eyeCx = x + Math.round(w * 0.5)
  const eyeCy = y + 54
  const eyeColor =
    suspicion >= 65 ? '#ff2a2a' : active ? '#ffb000' : '#33ff66'
  const irisR = active ? 22 + Math.round(Math.sin(animClockSec * 4) * 2) : 18
  const pupilOffset = active ? Math.round(Math.sin(animClockSec * 2.1) * 5) : 0

  // Outer mechanical shutter lens
  ctx.strokeStyle = eyeColor
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(eyeCx - 66, eyeCy)
  ctx.lineTo(eyeCx - 34, eyeCy - 26)
  ctx.lineTo(eyeCx + 34, eyeCy - 26)
  ctx.lineTo(eyeCx + 66, eyeCy)
  ctx.lineTo(eyeCx + 34, eyeCy + 26)
  ctx.lineTo(eyeCx - 34, eyeCy + 26)
  ctx.closePath()
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(eyeCx, eyeCy, irisR, 0, Math.PI * 2)
  ctx.stroke()

  // Pixel pupil
  ctx.fillStyle = eyeColor
  ctx.fillRect(eyeCx + pupilOffset - 6, eyeCy - 6, 12, 12)
  ctx.fillStyle = '#e6dec3'
  ctx.fillRect(eyeCx + pupilOffset - 2, eyeCy - 2, 4, 4)

  // Oscilloscope waveform along bottom of scope box
  const waveY = y + h - 26
  const amp = active ? 8 + (suspicion / 100) * 10 : 4
  ctx.strokeStyle = eyeColor
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let px = 0; px <= w - 16; px += 6) {
    const wy =
      waveY +
      Math.round(
        Math.sin(px * 0.11 + animClockSec * (active ? 8 : 3)) *
          amp *
          Math.sin((px / (w - 16)) * Math.PI)
      )
    if (px === 0) ctx.moveTo(x + 8 + px, wy)
    else ctx.lineTo(x + 8 + px, wy)
  }
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.font = 'bold 12px "Courier Prime", monospace'
  ctx.fillStyle = eyeColor
  ctx.fillText(
    active
      ? `K.O.M.R.A.D.-84 // TRUST ${trust}%`
      : 'K.O.M.R.A.D.-84 // WATCHING',
    eyeCx,
    y + 14
  )
  ctx.textAlign = 'left'
}

function drawImpostorScopePanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  suspicion: number,
  trust: number,
  animClockSec: number
): void {
  const pulse = Math.floor(animClockSec * 6) % 2 === 0
  ctx.fillStyle = '#13070c'
  ctx.fillRect(x, y, w, h)

  // Glitch border: alternating red / imperialist blue / amber
  ctx.strokeStyle = pulse ? '#ff2a2a' : '#4da6ff'
  ctx.lineWidth = 2.5
  ctx.strokeRect(x, y, w, h)
  ctx.strokeStyle = '#ffb000'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6)

  // Static CRT scanline interference bands
  for (let sy = y + 18; sy < y + h - 18; sy += 12) {
    const jitterX = Math.round(Math.sin(animClockSec * 9 + sy) * 6)
    ctx.fillStyle = (sy / 12) % 2 === 0 ? 'rgba(255,42,42,0.16)' : 'rgba(77,166,255,0.14)'
    ctx.fillRect(x + 6 + Math.max(0, jitterX), sy, w - 18, 3)
  }

  const cx = x + Math.round(w * 0.5)
  const cy = y + 60
  // Pixelated cowboy-hat / hijacked-signal emblem
  ctx.fillStyle = pulse ? '#ffb000' : '#ff2a2a'
  ctx.fillRect(cx - 32, cy - 2, 64, 6) // Brim
  ctx.fillRect(cx - 18, cy - 18, 36, 16) // Crown
  ctx.fillStyle = '#4da6ff'
  ctx.fillRect(cx - 18, cy - 6, 36, 4) // Hatband
  ctx.fillStyle = '#e6dec3'
  ctx.fillRect(cx - 10, cy + 8, 6, 6)
  ctx.fillRect(cx + 4, cy + 8, 6, 6)
  ctx.fillStyle = '#ff2a2a'
  ctx.fillRect(cx - 22, cy + 16, 44, 4)

  ctx.textAlign = 'center'
  ctx.font = 'bold 11px "Courier Prime", monospace'
  ctx.fillStyle = pulse ? '#ff2a2a' : '#4da6ff'
  ctx.fillText('LANGLEY_NODE_04 // IMPOSTOR', cx, y + 16, w - 12)

  ctx.fillStyle = pulse ? '#ffb000' : '#e6dec3'
  ctx.fillText(
    `COWBOY FILTER DETECTED (${trust}%)`,
    cx,
    y + h - 16,
    w - 14
  )
  ctx.fillStyle = '#ff2a2a'
  ctx.fillRect(x + 12, y + h - 32, Math.round(((w - 24) * Math.max(15, suspicion)) / 100), 4)
  ctx.textAlign = 'left'
}

export function createPolitLinkPluginApp(): SovOsPluginApp {
  return {
    id: 'polit_link',
    iconTitle: 'POLIT-LINK',
    taskbarLabel: 'POLIT-84',
    windowTitle: 'POLIT-LINK 84 // K.O.M.R.A.D.-84 IDEOLOGY',
    drawIconGlyph: drawKomradEyeGlyph,

    getStatusMeta: (): SovOsPluginStatusMeta => {
      const ps = getPolitLinkState()
      const gs = useGameStore.getState()
      const preVolkovLocked = !ps.active && isPreVolkovPanelLocked(gs)
      if (preVolkovLocked) {
        return {
          subtitle: 'LOCKED (MAIL)',
          badgeText: 'LOCK',
          alertSeverity: 'warn',
          isUrgent: false,
        }
      }
      if (ps.active) {
        const isImpostor = ps.mode === 'impostor'
        const isDanger =
          isImpostor ||
          ps.suspicion >= 65 ||
          (ps.timeLeftSec > 0 && ps.timeLeftSec <= 15)
        return {
          subtitle: isImpostor
            ? `IMPOSTOR ${Math.ceil(ps.timeLeftSec)}S`
            : ps.mode === 'tutorial_drill'
              ? `DRILL R${ps.roundIndex + 1}/${ps.totalRounds}`
              : ps.timeLeftSec > 0
                ? `DUEL ${Math.ceil(ps.timeLeftSec)}S`
                : `ROUND ${ps.roundIndex + 1}/${ps.totalRounds}`,
          badgeText: isImpostor ? 'CIA!' : isDanger ? '!!' : 'DUEL',
          alertSeverity: isDanger ? 'danger' : 'warn',
          isUrgent: true,
        }
      }
      if (gs.partyApprovedBuffSec > 0) {
        return {
          subtitle: `OK ${Math.ceil(gs.partyApprovedBuffSec)}S`,
          badgeText: null,
          alertSeverity: 'none',
          isUrgent: false,
        }
      }
      return {
        subtitle: gs.komradOverrideLocked ? 'LOCKED' : 'AI LINK',
        badgeText: gs.komradOverrideLocked ? '!' : null,
        alertSeverity: gs.komradOverrideLocked ? 'danger' : 'none',
        isUrgent: gs.komradOverrideLocked,
      }
    },

    getRenderSignature: (): string => {
      const ps = getPolitLinkState()
      const gs = useGameStore.getState()
      const preVolkovLocked = !ps.active && isPreVolkovPanelLocked(gs)
      const pulseStep = ps.active ? Math.floor(ps.animClockSec * 4) : Math.floor(ps.animClockSec)
      return [
        ps.active ? 1 : 0,
        preVolkovLocked ? 1 : 0,
        ps.mode,
        ps.roundIndex,
        ps.trust,
        ps.suspicion,
        Math.ceil(ps.timeLeftSec),
        ps.lastOutcome,
        ps.drillFailed ? 1 : 0,
        Math.ceil(gs.partyApprovedBuffSec),
        gs.komradOverrideLocked ? 1 : 0,
        pulseStep,
      ].join(':')
    },

    getHitRegions: (rect: SovOsWindowRect): SovOsPluginHitRegion[] => {
      const ps = getPolitLinkState()
      const regions: SovOsPluginHitRegion[] = []
      const rightX = rect.x + 242
      const rightW = rect.w - 258

      if (ps.active) {
        const scenario = ps.scenarioQueue[ps.roundIndex]
        if (scenario) {
          scenario.options.forEach((opt, idx) => {
            regions.push({
              id: `polit:opt:${opt.id}`,
              x: rightX,
              y: rect.y + 206 + idx * 62,
              w: rightW,
              h: 54,
              payload: opt.id,
            })
          })
        }
        return regions
      }

      if (ps.drillFailed) {
        regions.push({
          id: 'polit:retry_drill',
          x: rightX + 24,
          y: rect.y + 356,
          w: rightW - 48,
          h: 52,
        })
        return regions
      }

      if (isPreVolkovPanelLocked(useGameStore.getState())) {
        return regions
      }

      regions.push({
        id: 'polit:start_voluntary',
        x: rightX + 24,
        y: rect.y + 356,
        w: rightW - 48,
        h: 52,
      })
      return regions
    },

    handleClick: (regionId: string, payload?: string): SovOsPluginClickResult => {
      if (regionId.startsWith('polit:opt:') && payload) {
        const res = selectPolitLinkOption(payload as 'A' | 'B' | 'C' | 'D')
        if (!res.accepted) return { handled: false }
        return {
          handled: true,
          statusNotice:
            res.requestFocusApp === 'zashchita'
              ? 'IMPOSTOR EXPOSED! SWITCHING TO ZASHCHITA-84'
              : res.outcome === 'win'
                ? 'PARTY APPROVAL GRANTED'
                : res.outcome === 'fail' || res.outcome === 'drill_mistake'
                  ? 'IDEOLOGICAL REJECTION!'
                  : 'RESPONSE LOGGED',
          sound:
            res.requestFocusApp === 'zashchita'
              ? 'alarm'
              : res.outcome === 'win'
                ? 'chime'
                : res.outcome === 'fail' || res.outcome === 'drill_mistake'
                  ? 'alarm'
                  : 'click',
          requestFocusApp: res.requestFocusApp,
        }
      }
      if (regionId === 'polit:retry_drill') {
        startPolitLinkDuel('tutorial_drill')
        return {
          handled: true,
          statusNotice: 'DRILL RESTARTED',
          sound: 'clank',
        }
      }
      if (regionId === 'polit:start_voluntary') {
        if (isPreVolkovPanelLocked(useGameStore.getState())) {
          return {
            handled: true,
            statusNotice: 'LOCKED: ACCEPT VOLKOV MAIL IN P.O.S.T.-84 FIRST',
            sound: 'alarm',
          }
        }
        startPolitLinkDuel('voluntary')
        return {
          handled: true,
          statusNotice: 'PRAISE SESSION OPENED',
          sound: 'click',
        }
      }
      return { handled: false }
    },

    paintWindow: (
      ctx: CanvasRenderingContext2D,
      rect: SovOsWindowRect,
      hoveredId: string | null,
      alertPhase: 0 | 1 | 2
    ): void => {
      const ps = getPolitLinkState()
      const gs = useGameStore.getState()
      const leftX = rect.x + 14
      const leftW = 216
      const rightX = rect.x + 242
      const rightW = rect.w - 258

      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'

      // Left Column: Animated K.O.M.R.A.D.-84 Eye (or LANGLEY_NODE_04 Impostor Glitch) + Gauges
      if (ps.active && ps.mode === 'impostor') {
        drawImpostorScopePanel(
          ctx,
          leftX,
          rect.y + 56,
          leftW,
          142,
          ps.suspicion,
          ps.trust,
          ps.animClockSec
        )
      } else {
        drawKomradOscilloscopePanel(
          ctx,
          leftX,
          rect.y + 56,
          leftW,
          142,
          ps.suspicion,
          ps.trust,
          ps.animClockSec,
          ps.active
        )
      }

      // TRUST bar
      ctx.fillStyle = '#071d0e'
      ctx.fillRect(leftX, rect.y + 208, leftW, 66)
      ctx.strokeStyle = '#22b549'
      ctx.lineWidth = 1.5
      ctx.strokeRect(leftX, rect.y + 208, leftW, 66)
      ctx.font = 'bold 14px "Courier Prime", monospace'
      ctx.fillStyle = '#33ff66'
      ctx.fillText(`TRUST (80%): ${ps.trust}%`, leftX + 10, rect.y + 225, leftW - 20)
      ctx.fillStyle = '#041208'
      ctx.fillRect(leftX + 10, rect.y + 240, leftW - 20, 22)
      ctx.fillStyle = ps.trust >= 80 ? '#33ff66' : '#22b549'
      ctx.fillRect(
        leftX + 10,
        rect.y + 240,
        Math.round(((leftW - 20) * ps.trust) / 100),
        22
      )
      ctx.strokeStyle = '#33ff66'
      ctx.strokeRect(leftX + 10, rect.y + 240, leftW - 20, 22)

      // SUSPICION bar
      ctx.fillStyle = '#140c06'
      ctx.fillRect(leftX, rect.y + 284, leftW, 66)
      ctx.strokeStyle = ps.suspicion >= 65 ? '#ff2a2a' : '#ffb000'
      ctx.strokeRect(leftX, rect.y + 284, leftW, 66)
      ctx.fillStyle = ps.suspicion >= 65 ? '#ff2a2a' : '#ffb000'
      ctx.fillText(
        `SUSPICION (85%): ${ps.suspicion}%`,
        leftX + 10,
        rect.y + 301,
        leftW - 20
      )
      ctx.fillStyle = '#0b0604'
      ctx.fillRect(leftX + 10, rect.y + 316, leftW - 20, 22)
      ctx.fillStyle = ps.suspicion >= 65 ? '#ff2a2a' : '#ffb000'
      ctx.fillRect(
        leftX + 10,
        rect.y + 316,
        Math.round(((leftW - 20) * ps.suspicion) / 100),
        22
      )
      ctx.strokeStyle = ps.suspicion >= 65 ? '#ff2a2a' : '#ffb000'
      ctx.strokeRect(leftX + 10, rect.y + 316, leftW - 20, 22)

      // Bottom Left Status Box (Timer / Buff / AI Lock)
      ctx.fillStyle = '#071d0e'
      ctx.fillRect(leftX, rect.y + 360, leftW, 92)
      ctx.strokeStyle =
        ps.active && ps.timeLeftSec > 0 && ps.timeLeftSec <= 15
          ? '#ff2a2a'
          : '#22b549'
      ctx.strokeRect(leftX, rect.y + 360, leftW, 92)
      ctx.textAlign = 'center'
      if (ps.active) {
        ctx.fillStyle = '#ffb000'
        ctx.font = 'bold 14px "Courier Prime", monospace'
        ctx.fillText(
          `ROUND ${ps.roundIndex + 1} OF ${ps.totalRounds} [${ps.mode.toUpperCase()}]`,
          leftX + leftW / 2,
          rect.y + 384,
          leftW - 14
        )
        ctx.font = 'bold 24px "Courier Prime", monospace'
        ctx.fillStyle =
          ps.timeLeftSec > 0
            ? ps.timeLeftSec <= 15
              ? '#ff2a2a'
              : '#e6dec3'
            : '#33ff66'
        ctx.fillText(
          ps.timeLeftSec > 0
            ? `${Math.ceil(ps.timeLeftSec)} SEC`
            : 'SAFE DRILL',
          leftX + leftW / 2,
          rect.y + 422
        )
      } else {
        ctx.fillStyle =
          gs.partyApprovedBuffSec > 0
            ? '#33ff66'
            : gs.komradOverrideLocked
              ? '#ff2a2a'
              : '#ffb000'
        ctx.font = 'bold 14px "Courier Prime", monospace'
        ctx.fillText(
          gs.partyApprovedBuffSec > 0
            ? 'PARTY APPROVED IMMUNITY'
            : gs.komradOverrideLocked
              ? 'AI LOCK ACTIVE!'
              : 'STATUS: MONITORING',
          leftX + leftW / 2,
          rect.y + 388,
          leftW - 14
        )
        ctx.fillStyle = '#e6dec3'
        ctx.font = 'bold 18px "Courier Prime", monospace'
        ctx.fillText(
          gs.partyApprovedBuffSec > 0
            ? `${Math.ceil(gs.partyApprovedBuffSec)}S REMAINING`
            : gs.komradOverrideLocked
              ? 'PASS DUEL OR OVERRIDE'
              : 'BUFFER: 0S',
          leftX + leftW / 2,
          rect.y + 422,
          leftW - 14
        )
      }
      ctx.textAlign = 'left'

      // Right Column: Active Duel or Standby / Retry View
      if (ps.active) {
        const scenario = ps.scenarioQueue[ps.roundIndex]
        if (!scenario) return

        // Stance Hint Banner
        ctx.fillStyle = '#241804'
        ctx.fillRect(rightX, rect.y + 56, rightW, 34)
        ctx.strokeStyle = alertPhase === 2 ? '#e6dec3' : '#ffb000'
        ctx.lineWidth = 2
        ctx.strokeRect(rightX, rect.y + 56, rightW, 34)
        ctx.fillStyle = '#ffb000'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.fillText(scenario.stanceHint, rightX + 10, rect.y + 73, rightW - 20)

        // Prompt + Last Exchange Box
        ctx.fillStyle = '#061a0c'
        ctx.fillRect(rightX, rect.y + 98, rightW, 98)
        ctx.strokeStyle = '#22b549'
        ctx.lineWidth = 1.5
        ctx.strokeRect(rightX, rect.y + 98, rightW, 98)

        ctx.fillStyle = '#e6dec3'
        ctx.font = 'bold 14px "Courier Prime", monospace'
        drawWrapped(ctx, scenario.prompt, rightX + 10, rect.y + 114, rightW - 20, 17, 3)

        ctx.fillStyle = '#33ff66'
        ctx.font = '12px "Courier Prime", monospace'
        drawWrapped(
          ctx,
          `>> ${ps.lastExchange}`,
          rightX + 10,
          rect.y + 170,
          rightW - 20,
          15,
          2
        )

        // 4 Clickable Rhetoric Response Cards
        scenario.options.forEach((opt, idx) => {
          const cardY = rect.y + 206 + idx * 62
          const cardH = 54
          const isHover = hoveredId === `polit:opt:${opt.id}`
          ctx.fillStyle = isHover ? '#164d24' : '#0a2612'
          ctx.fillRect(rightX, cardY, rightW, cardH)
          ctx.strokeStyle = isHover ? '#e6dec3' : '#22b549'
          ctx.lineWidth = isHover ? 2.5 : 1.5
          ctx.strokeRect(rightX, cardY, rightW, cardH)

          // Tag pill
          const tagCol =
            opt.tag === 'PARTY_LINE'
              ? '#33ff66'
              : opt.tag === 'DECREE'
                ? '#ffb000'
                : opt.tag === 'KGB_THREAT'
                  ? '#7ef9ff'
                  : '#ff6655'
          ctx.fillStyle = '#061a0c'
          ctx.fillRect(rightX + 8, cardY + 8, 106, 38)
          ctx.strokeStyle = tagCol
          ctx.lineWidth = 1.5
          ctx.strokeRect(rightX + 8, cardY + 8, 106, 38)

          ctx.textAlign = 'center'
          ctx.fillStyle = tagCol
          ctx.font = 'bold 12px "Courier Prime", monospace'
          ctx.fillText(`[${idx + 1}] ${opt.label}`, rightX + 61, cardY + 27, 98)

          ctx.textAlign = 'left'
          ctx.fillStyle = isHover ? '#ffffff' : '#e6dec3'
          ctx.font = '13px "Courier Prime", monospace'
          drawWrapped(ctx, opt.shortText, rightX + 124, cardY + 19, rightW - 134, 17, 2)
        })
        return
      }

      // Idle or Drill-Failed View
      ctx.fillStyle = '#061a0c'
      ctx.fillRect(rightX, rect.y + 56, rightW, 286)
      ctx.strokeStyle = ps.drillFailed ? '#ff2a2a' : '#22b549'
      ctx.lineWidth = 2
      ctx.strokeRect(rightX, rect.y + 56, rightW, 286)

      ctx.fillStyle = ps.drillFailed
        ? '#ff2a2a'
        : ps.lastOutcome === 'win'
          ? '#33ff66'
          : '#ffb000'
      ctx.font = 'bold 18px "Courier Prime", monospace'
      ctx.fillText(
        ps.drillFailed
          ? 'IDEOLOGICAL DRILL REJECTED (0 STRIKES)'
          : ps.lastOutcome === 'win'
            ? 'CLEARANCE CONFIRMED // PARTY APPROVED'
            : 'K.O.M.R.A.D.-84 IDEOLOGY MONITOR',
        rightX + 16,
        rect.y + 84,
        rightW - 32
      )

      ctx.fillStyle = '#e6dec3'
      ctx.font = '14px "Courier Prime", monospace'
      drawWrapped(
        ctx,
        ps.lastExchange,
        rightX + 16,
        rect.y + 122,
        rightW - 32,
        19,
        4
      )

      ctx.fillStyle = '#8fd4a4'
      ctx.font = '13px "Courier Prime", monospace'
      drawWrapped(
        ctx,
        'TACTICAL BRIEF: K.O.M.R.A.D.-84 interrogates you during crises and random audits. Read the STANCE CLUE — never admit meltdowns unless backed by decree! Win for Party Approval; lose for +1 Strike & sabotage.',
        rightX + 16,
        rect.y + 206,
        rightW - 32,
        18,
        6
      )

      const preVolkovLocked = isPreVolkovPanelLocked(gs)
      if (preVolkovLocked) {
        ctx.fillStyle = '#331010'
        ctx.fillRect(rightX + 24, rect.y + 356, rightW - 48, 52)
        ctx.strokeStyle = '#ff2a2a'
        ctx.lineWidth = 2
        ctx.strokeRect(rightX + 24, rect.y + 356, rightW - 48, 52)
        ctx.textAlign = 'center'
        ctx.fillStyle = '#ffb000'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.fillText(
          'SAFETY INTERLOCK // OPEN P.O.S.T.-84 MAIL FIRST',
          rightX + rightW / 2,
          rect.y + 382,
          rightW - 64
        )
        ctx.textAlign = 'left'
        return
      }

      const btnId = ps.drillFailed
        ? 'polit:retry_drill'
        : 'polit:start_voluntary'
      const btnHover = hoveredId === btnId
      ctx.fillStyle = btnHover
        ? ps.drillFailed
          ? '#ff2a2a'
          : '#33ff66'
        : ps.drillFailed
          ? '#4a1212'
          : '#124a21'
      ctx.fillRect(rightX + 24, rect.y + 356, rightW - 48, 52)
      ctx.strokeStyle = btnHover
        ? '#e6dec3'
        : ps.drillFailed
          ? '#ff2a2a'
          : '#33ff66'
      ctx.lineWidth = 2.5
      ctx.strokeRect(rightX + 24, rect.y + 356, rightW - 48, 52)
      ctx.textAlign = 'center'
      ctx.fillStyle = btnHover ? '#061a0c' : '#e6dec3'
      ctx.font = 'bold 16px "Courier Prime", monospace'
      ctx.fillText(
        ps.drillFailed
          ? '[ RETRY IDEOLOGICAL DRILL ]'
          : '[ INITIATE VOLUNTARY LOYALTY PRAISE ]',
        rightX + rightW / 2,
        rect.y + 382,
        rightW - 64
      )
      ctx.textAlign = 'left'
    },
  }
}
