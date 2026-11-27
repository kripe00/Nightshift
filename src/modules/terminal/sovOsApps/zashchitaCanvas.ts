import type {
  SovOsAlertSeverity,
  SovOsPluginApp,
  SovOsPluginClickResult,
  SovOsPluginHitRegion,
  SovOsPluginStatusMeta,
  SovOsWindowRect,
} from '../../../shared/sovOsAppRegistry'
import { useGameStore } from '../../../shared/useGameStore'
import {
  getGostRulesForTier,
  getZashchitaState,
  killZashchitaProcess,
  runDiagnosticPacketScan,
  selectZashchitaProcess,
  startZashchitaWave,
} from './zashchitaEngine'

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

function drawFirewallShieldGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  alertSeverity: SovOsAlertSeverity
): void {
  ctx.save()
  const strokeCol = alertSeverity === 'danger' ? '#ff2a2a' : color
  ctx.strokeStyle = strokeCol
  ctx.fillStyle = strokeCol
  ctx.lineWidth = 2.5

  // Soviet shield + crosshair inside 70x48 box
  ctx.beginPath()
  ctx.moveTo(x + 17, y + 6)
  ctx.lineTo(x + 53, y + 6)
  ctx.lineTo(x + 53, y + 24)
  ctx.lineTo(x + 35, y + 43)
  ctx.lineTo(x + 17, y + 24)
  ctx.closePath()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x + 35, y + 12)
  ctx.lineTo(x + 35, y + 34)
  ctx.moveTo(x + 24, y + 22)
  ctx.lineTo(x + 46, y + 22)
  ctx.stroke()
  ctx.restore()
}

export function createZashchitaPluginApp(): SovOsPluginApp {
  return {
    id: 'zashchita',
    iconTitle: 'ZASHCHITA',
    taskbarLabel: 'FIREWALL',
    windowTitle: 'ZASHCHITA-84 // SECTOR 07 FIREWALL',
    drawIconGlyph: drawFirewallShieldGlyph,

    getStatusMeta: (): SovOsPluginStatusMeta => {
      const zs = getZashchitaState()
      const gs = useGameStore.getState()
      if (zs.active || gs.ciaIntrusionActive) {
        const remaining = zs.processes.filter(
          (p) => p.isCiaHostile && p.status === 'running'
        ).length
        const pct = Math.round(gs.ciaIntrusionProgress)
        return {
          subtitle: zs.isDrill
            ? `DRILL (${remaining} LEFT)`
            : `BREACH ${pct}%`,
          badgeText: remaining > 0 ? String(remaining) : '!',
          alertSeverity: pct >= 60 ? 'danger' : 'warn',
          isUrgent: true,
        }
      }
      return {
        subtitle: 'SEC-07 OK',
        badgeText: null,
        alertSeverity: 'none',
        isUrgent: false,
      }
    },

    getRenderSignature: (): string => {
      const zs = getZashchitaState()
      const gs = useGameStore.getState()
      const procSig = zs.processes
        .map((p) => `${p.pid}:${p.status}`)
        .join(',')
      return [
        zs.active ? 1 : 0,
        zs.isDrill ? 1 : 0,
        zs.selectedPid ?? 0,
        zs.lastOutcome,
        zs.waveCount,
        zs.lastFeedback,
        Math.round(gs.ciaIntrusionProgress),
        gs.ciaIntrusionActive ? 1 : 0,
        procSig,
      ].join('|')
    },

    getHitRegions: (rect: SovOsWindowRect): SovOsPluginHitRegion[] => {
      const zs = getZashchitaState()
      const regions: SovOsPluginHitRegion[] = []

      if (!zs.active) {
        regions.push({
          id: 'zash:scan_idle',
          x: rect.x + 18,
          y: rect.y + 392,
          w: 416,
          h: 50,
        })
        return regions
      }

      // Process list rows + [KILL] buttons
      const listX = rect.x + 14
      const rowW = 420
      zs.processes.slice(0, 6).forEach((proc, idx) => {
        const ry = rect.y + 132 + idx * 45
        regions.push({
          id: `zash:row:${proc.pid}`,
          x: listX,
          y: ry,
          w: rowW - 86,
          h: 39,
          payload: String(proc.pid),
        })
        if (proc.status === 'running') {
          regions.push({
            id: `zash:kill:${proc.pid}`,
            x: listX + rowW - 80,
            y: ry + 2,
            w: 74,
            h: 35,
            payload: String(proc.pid),
          })
        }
      })

      // Right inspector [TERMINATE PROCESS] button or Drill Reset
      const selected = zs.processes.find((p) => p.pid === zs.selectedPid)
      if (selected?.status === 'running') {
        regions.push({
          id: 'zash:kill_selected',
          x: rect.x + 456,
          y: rect.y + 394,
          w: 256,
          h: 42,
          payload: String(selected.pid),
        })
      } else if (zs.isDrill) {
        regions.push({
          id: 'zash:reset_drill',
          x: rect.x + 456,
          y: rect.y + 394,
          w: 256,
          h: 42,
        })
      }

      return regions
    },

    handleClick: (regionId: string, payload?: string): SovOsPluginClickResult => {
      if (regionId.startsWith('zash:row:') && payload) {
        selectZashchitaProcess(Number(payload))
        return { handled: true, sound: 'click' }
      }
      if (
        (regionId.startsWith('zash:kill:') || regionId === 'zash:kill_selected') &&
        payload
      ) {
        const res = killZashchitaProcess(Number(payload))
        if (!res.handled) return { handled: false }
        return {
          handled: true,
          statusNotice:
            res.outcome === 'win'
              ? 'CIA INTRUSION PURGED'
              : res.outcome === 'wrong_kill'
                ? 'FAULT: VALID PROCESS KILLED'
                : 'HOSTILE PROCESS PURGED',
          sound:
            res.outcome === 'win'
              ? 'chime'
              : res.outcome === 'wrong_kill'
                ? 'alarm'
                : 'clank',
        }
      }
      if (regionId === 'zash:reset_drill') {
        startZashchitaWave(true)
        return {
          handled: true,
          statusNotice: 'FIREWALL DRILL RESET',
          sound: 'clank',
        }
      }
      if (regionId === 'zash:scan_idle') {
        runDiagnosticPacketScan()
        return {
          handled: true,
          statusNotice: 'SECTOR 07 SCAN CLEAN',
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
      const zs = getZashchitaState()
      const gs = useGameStore.getState()
      const rules = getGostRulesForTier(zs.shiftTier)

      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'

      // Top Breach Meter Bar (rect.y + 54..96)
      const pct = Math.max(0, Math.min(100, Math.round(gs.ciaIntrusionProgress)))
      const barX = rect.x + 14
      const barW = rect.w - 28
      ctx.fillStyle = zs.active ? '#1d0808' : '#071d0e'
      ctx.fillRect(barX, rect.y + 54, barW, 42)
      ctx.strokeStyle = zs.active
        ? pct >= 65 && alertPhase === 2
          ? '#e6dec3'
          : '#ff2a2a'
        : '#22b549'
      ctx.lineWidth = 2
      ctx.strokeRect(barX, rect.y + 54, barW, 42)

      if (zs.active) {
        const fillW = Math.round(((barW - 220) * pct) / 100)
        ctx.fillStyle = '#090303'
        ctx.fillRect(barX + 10, rect.y + 64, barW - 220, 22)
        if (fillW > 0) {
          ctx.fillStyle = pct >= 65 ? '#ff2a2a' : '#ffb000'
          ctx.fillRect(barX + 10, rect.y + 64, fillW, 22)
        }
        ctx.strokeStyle = '#ff2a2a'
        ctx.strokeRect(barX + 10, rect.y + 64, barW - 220, 22)

        const remaining = zs.processes.filter(
          (p) => p.isCiaHostile && p.status === 'running'
        ).length
        ctx.textAlign = 'right'
        ctx.fillStyle = '#ffb000'
        ctx.font = 'bold 15px "Courier Prime", monospace'
        ctx.fillText(
          zs.isDrill
            ? `DRILL // CIA LEFT: ${remaining}`
            : `BREACH ${pct}% | CIA: ${remaining}`,
          barX + barW - 12,
          rect.y + 75,
          196
        )
        ctx.textAlign = 'left'
      } else {
        ctx.fillStyle = '#33ff66'
        ctx.font = 'bold 16px "Courier Prime", monospace'
        ctx.fillText(
          'SECTOR 07 FIREWALL: NOMINAL // NO ACTIVE CIA PACKET STREAM',
          barX + 14,
          rect.y + 75,
          barW - 28
        )
      }

      // Left Pane: Process List (x: rect.x + 14, w: 420)
      const listX = rect.x + 14
      const listW = 420
      const listY = rect.y + 104

      // Header row
      ctx.fillStyle = '#0e3319'
      ctx.fillRect(listX, listY, listW, 24)
      ctx.strokeStyle = '#22b549'
      ctx.lineWidth = 1.5
      ctx.strokeRect(listX, listY, listW, 24)
      ctx.fillStyle = '#ffb000'
      ctx.font = 'bold 12px "Courier Prime", monospace'
      ctx.fillText('PID', listX + 6, listY + 12)
      ctx.fillText('PROCESS', listX + 48, listY + 12)
      ctx.fillText('PORT', listX + 184, listY + 12)
      ctx.fillText('SIG', listX + 232, listY + 12)
      ctx.fillText('CPU', listX + 306, listY + 12)
      ctx.fillText('ACT', listX + 354, listY + 12)

      if (!zs.active) {
        ctx.fillStyle = '#061a0c'
        ctx.fillRect(listX, listY + 28, listW, 248)
        ctx.strokeStyle = '#1b6b31'
        ctx.strokeRect(listX, listY + 28, listW, 248)

        ctx.fillStyle = '#33ff66'
        ctx.font = 'bold 17px "Courier Prime", monospace'
        ctx.fillText('ALL SECTOR 07 DAEMONS VERIFIED', listX + 18, listY + 62)

        ctx.fillStyle = '#e6dec3'
        ctx.font = '14px "Courier Prime", monospace'
        drawWrapped(
          ctx,
          zs.lastFeedback,
          listX + 18,
          listY + 100,
          listW - 36,
          19,
          4
        )

        ctx.fillStyle = '#8fd4a4'
        ctx.font = '13px "Courier Prime", monospace'
        drawWrapped(
          ctx,
          'When CIA cyber intrusions strike, compare each process PID/PORT/SIG/CPU against the GOST-84 Checklist on the right. Terminating genuine Soviet processes disrupts hardware!',
          listX + 18,
          listY + 188,
          listW - 36,
          18,
          4
        )

        const scanHover = hoveredId === 'zash:scan_idle'
        ctx.fillStyle = scanHover ? '#33ff66' : '#124a21'
        ctx.fillRect(rect.x + 18, rect.y + 392, 416, 50)
        ctx.strokeStyle = scanHover ? '#e6dec3' : '#33ff66'
        ctx.lineWidth = 2
        ctx.strokeRect(rect.x + 18, rect.y + 392, 416, 50)
        ctx.textAlign = 'center'
        ctx.fillStyle = scanHover ? '#061a0c' : '#e6dec3'
        ctx.font = 'bold 15px "Courier Prime", monospace'
        ctx.fillText(
          '[ RUN DIAGNOSTIC PACKET SCAN ]',
          rect.x + 226,
          rect.y + 417
        )
        ctx.textAlign = 'left'
      } else {
        zs.processes.slice(0, 6).forEach((proc, idx) => {
          const ry = rect.y + 132 + idx * 45
          const isSel = zs.selectedPid === proc.pid
          const rowHover = hoveredId === `zash:row:${proc.pid}`
          const killHover = hoveredId === `zash:kill:${proc.pid}`

          ctx.fillStyle =
            proc.status === 'purged'
              ? '#0a2b14'
              : proc.status === 'fault_killed'
                ? '#330a0a'
                : isSel
                  ? '#144421'
                  : rowHover
                    ? '#10361b'
                    : '#071d0e'
          ctx.fillRect(listX, ry, listW, 39)
          ctx.strokeStyle =
            proc.status === 'fault_killed'
              ? '#ff2a2a'
              : isSel || rowHover
                ? '#ffb000'
                : '#1b6b31'
          ctx.lineWidth = isSel ? 2 : 1.5
          ctx.strokeRect(listX, ry, listW, 39)

          ctx.fillStyle = proc.status === 'running' ? '#e6dec3' : '#6ca37c'
          ctx.font = 'bold 12px "Courier Prime", monospace'
          ctx.fillText(String(proc.pid), listX + 6, ry + 20)
          ctx.fillText(proc.name, listX + 46, ry + 20, 134)
          ctx.fillText(String(proc.port), listX + 186, ry + 20)
          ctx.fillText(proc.signature, listX + 230, ry + 20, 72)
          ctx.fillText(`${proc.cpuPct}%`, listX + 306, ry + 20)

          if (proc.status === 'running') {
            ctx.fillStyle = killHover ? '#ff2a2a' : '#5c1818'
            ctx.fillRect(listX + listW - 80, ry + 2, 74, 35)
            ctx.strokeStyle = killHover ? '#e6dec3' : '#ff2a2a'
            ctx.lineWidth = 1.5
            ctx.strokeRect(listX + listW - 80, ry + 2, 74, 35)
            ctx.textAlign = 'center'
            ctx.fillStyle = '#e6dec3'
            ctx.font = 'bold 13px "Courier Prime", monospace'
            ctx.fillText('[KILL]', listX + listW - 43, ry + 20)
            ctx.textAlign = 'left'
          } else {
            ctx.textAlign = 'center'
            ctx.fillStyle =
              proc.status === 'purged' ? '#33ff66' : '#ff2a2a'
            ctx.font = 'bold 12px "Courier Prime", monospace'
            ctx.fillText(
              proc.status === 'purged' ? 'PURGED' : 'FAULT',
              listX + listW - 43,
              ry + 20
            )
            ctx.textAlign = 'left'
          }
        })

        // Bottom left live feedback strip
        ctx.fillStyle = '#092412'
        ctx.fillRect(listX, rect.y + 406, listW, 44)
        ctx.strokeStyle = '#22b549'
        ctx.strokeRect(listX, rect.y + 406, listW, 44)
        ctx.fillStyle = '#ffb000'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        drawWrapped(
          ctx,
          zs.lastFeedback,
          listX + 10,
          rect.y + 420,
          listW - 20,
          16,
          2
        )
      }

      // Right Pane: GOST-84 Checklist + Packet Inspector (x: rect.x + 446, w: 278)
      const rightX = rect.x + 446
      const rightW = 278

      ctx.fillStyle = '#082110'
      ctx.fillRect(rightX, rect.y + 104, rightW, 134)
      ctx.strokeStyle = '#ffb000'
      ctx.lineWidth = 2
      ctx.strokeRect(rightX, rect.y + 104, rightW, 134)

      ctx.fillStyle = '#ffb000'
      ctx.font = 'bold 14px "Courier Prime", monospace'
      ctx.fillText(
        `GOST-84 CHECKLIST (TIER ${zs.shiftTier})`,
        rightX + 10,
        rect.y + 122
      )

      ctx.fillStyle = '#e6dec3'
      ctx.font = '12px "Courier Prime", monospace'
      rules.forEach((rule, idx) => {
        ctx.fillText(rule, rightX + 10, rect.y + 144 + idx * 18, rightW - 20)
      })

      // Packet Inspector Card
      ctx.fillStyle = '#061a0c'
      ctx.fillRect(rightX, rect.y + 246, rightW, 204)
      ctx.strokeStyle = '#22b549'
      ctx.lineWidth = 1.5
      ctx.strokeRect(rightX, rect.y + 246, rightW, 204)

      const selected = zs.processes.find((p) => p.pid === zs.selectedPid) ?? null
      ctx.fillStyle = '#33ff66'
      ctx.font = 'bold 14px "Courier Prime", monospace'
      ctx.fillText('PACKET INSPECTOR', rightX + 10, rect.y + 266)

      if (selected && zs.active) {
        ctx.fillStyle = '#e6dec3'
        ctx.font = 'bold 13px "Courier Prime", monospace'
        ctx.fillText(
          `PID ${selected.pid} // ${selected.name}`,
          rightX + 10,
          rect.y + 292,
          rightW - 20
        )
        ctx.font = '12px "Courier Prime", monospace'
        ctx.fillStyle = '#8fd4a4'
        ctx.fillText(`ORIGIN: ${selected.origin}`, rightX + 10, rect.y + 314, rightW - 20)
        ctx.fillText(
          `PORT: ${selected.port}  |  SIG: ${selected.signature}  |  CPU: ${selected.cpuPct}%`,
          rightX + 10,
          rect.y + 334,
          rightW - 20
        )
        ctx.fillStyle = '#ffb000'
        drawWrapped(
          ctx,
          `LINKED: ${selected.linkedHardware}`,
          rightX + 10,
          rect.y + 356,
          rightW - 20,
          15,
          2
        )

        if (selected.status === 'running') {
          const btnHover = hoveredId === 'zash:kill_selected'
          ctx.fillStyle = btnHover ? '#ff2a2a' : '#5c1818'
          ctx.fillRect(rightX + 10, rect.y + 394, rightW - 20, 42)
          ctx.strokeStyle = btnHover ? '#e6dec3' : '#ff2a2a'
          ctx.lineWidth = 2
          ctx.strokeRect(rightX + 10, rect.y + 394, rightW - 20, 42)
          ctx.textAlign = 'center'
          ctx.fillStyle = '#e6dec3'
          ctx.font = 'bold 14px "Courier Prime", monospace'
          ctx.fillText('[ TERMINATE PROCESS ]', rightX + rightW / 2, rect.y + 415)
          ctx.textAlign = 'left'
        } else if (zs.isDrill) {
          const resetHover = hoveredId === 'zash:reset_drill'
          ctx.fillStyle = resetHover ? '#ffb000' : '#2e2208'
          ctx.fillRect(rightX + 10, rect.y + 394, rightW - 20, 42)
          ctx.strokeStyle = '#ffb000'
          ctx.strokeRect(rightX + 10, rect.y + 394, rightW - 20, 42)
          ctx.textAlign = 'center'
          ctx.fillStyle = resetHover ? '#061a0c' : '#ffb000'
          ctx.font = 'bold 14px "Courier Prime", monospace'
          ctx.fillText('[ RESET FIREWALL DRILL ]', rightX + rightW / 2, rect.y + 415)
          ctx.textAlign = 'left'
        }
      } else {
        ctx.fillStyle = '#4e8b62'
        ctx.font = '13px "Courier Prime", monospace'
        drawWrapped(
          ctx,
          'Select any active process row during an intrusion to inspect origin bus and linked plant hardware.',
          rightX + 10,
          rect.y + 308,
          rightW - 20,
          18,
          4
        )
      }
    },
  }
}
