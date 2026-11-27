import {
  clearSavedShiftFromStorage,
  saveCurrentShiftToStorage,
} from '../../../shared/shiftSaveStorage'
import type {
  SovOsAlertSeverity,
  SovOsPluginApp,
  SovOsPluginClickResult,
  SovOsPluginHitRegion,
  SovOsPluginStatusMeta,
  SovOsWindowRect,
} from '../../../shared/sovOsAppRegistry'
import { useGameStore } from '../../../shared/useGameStore'
import { CLEAR_SKY_ACTS, getClearSkyAct } from './clearSkyCampaign'

function formatClockHHMM(minutes: number): string {
  const clamped = Math.max(0, Math.min(360, Math.floor(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

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

function drawShiftDossierGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  alertSeverity: SovOsAlertSeverity
): void {
  ctx.save()
  const strokeCol =
    alertSeverity === 'danger'
      ? '#ff2a2a'
      : alertSeverity === 'warn'
        ? '#ffb000'
        : color
  ctx.strokeStyle = strokeCol
  ctx.fillStyle = strokeCol
  ctx.lineWidth = 2.5

  // Soviet clock / dossier emblem inside 70x48 box
  ctx.beginPath()
  ctx.arc(x + 35, y + 24, 18, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x + 35, y + 24)
  ctx.lineTo(x + 35, y + 11)
  ctx.moveTo(x + 35, y + 24)
  ctx.lineTo(x + 46, y + 24)
  ctx.stroke()

  ctx.fillRect(x + 33, y + 22, 4, 4)
  ctx.restore()
}

function drawMeterBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  val: number,
  maxVal: number,
  fillHex: string
): void {
  ctx.fillStyle = '#e6dec3'
  ctx.font = 'bold 12px "Courier Prime", monospace'
  ctx.fillText(`${label}: ${val}`, x, y + 10)

  ctx.fillStyle = '#041208'
  ctx.fillRect(x, y + 20, w, 14)
  ctx.strokeStyle = '#1f7036'
  ctx.lineWidth = 1.5
  ctx.strokeRect(x, y + 20, w, 14)

  const ratio = Math.max(0, Math.min(1, val / Math.max(1, maxVal)))
  ctx.fillStyle = fillHex
  ctx.fillRect(x + 2, y + 22, Math.round((w - 4) * ratio), 10)
}

export function createShiftReportPluginApp(): SovOsPluginApp {
  return {
    id: 'shift_report',
    iconTitle: 'SHIFT-84',
    taskbarLabel: 'SHIFT-84',
    windowTitle: 'SHIFT-84 // SECTOR 84 NIGHT SHIFT DOSSIER',
    drawIconGlyph: drawShiftDossierGlyph,

    getStatusMeta: (): SovOsPluginStatusMeta => {
      const gs = useGameStore.getState()
      if (gs.campaignEnding !== null) {
        return {
          subtitle: gs.campaignEnding === 'clear_sky' ? 'CLEAR SKY!' : 'COMPLETE',
          badgeText: 'END',
          alertSeverity: gs.campaignEnding === 'clear_sky' ? 'warn' : 'none',
          isUrgent: true,
        }
      }
      if (gs.shiftDebriefActive) {
        return {
          subtitle: '06:00 REPORT',
          badgeText: '06:00',
          alertSeverity: 'warn',
          isUrgent: true,
        }
      }
      return {
        subtitle: `SHIFT ${gs.shiftNumber}/3`,
        badgeText:
          gs.archivedIntelIds.length > 0
            ? `${gs.archivedIntelIds.length}/3`
            : null,
        alertSeverity: 'none',
        isUrgent: false,
      }
    },

    getRenderSignature: (): string => {
      const gs = useGameStore.getState()
      return [
        gs.shiftNumber,
        Math.floor(gs.shiftTimeMinutes),
        gs.tutorialPhase,
        gs.shiftDebriefActive ? 1 : 0,
        gs.campaignEnding ?? 'none',
        gs.rubles,
        gs.quotaCompleted,
        gs.treasonStrikes,
        gs.complianceScore,
        gs.truthIntel,
        gs.archivedIntelIds.join(','),
        Math.round(gs.coreTemp),
      ].join('|')
    },

    getHitRegions: (rect: SovOsWindowRect): SovOsPluginHitRegion[] => {
      const gs = useGameStore.getState()
      const regions: SovOsPluginHitRegion[] = []

      if (gs.campaignEnding !== null) {
        regions.push({
          id: 'shift:new_campaign',
          x: rect.x + 170,
          y: rect.y + 392,
          w: 398,
          h: 48,
        })
        return regions
      }

      if (gs.shiftDebriefActive && gs.shiftNumber < 3) {
        regions.push({
          id: 'shift:next_shift',
          x: rect.x + 170,
          y: rect.y + 392,
          w: 398,
          h: 48,
        })
        return regions
      }

      if (gs.shiftDebriefActive && gs.shiftNumber >= 3) {
        regions.push({
          id: 'shift:ending_bureaucrat',
          x: rect.x + 24,
          y: rect.y + 390,
          w: 334,
          h: 50,
        })
        const clearSkyUnlocked =
          gs.truthIntel >= 50 || gs.archivedIntelIds.length >= 2
        if (clearSkyUnlocked) {
          regions.push({
            id: 'shift:ending_clear_sky',
            x: rect.x + 380,
            y: rect.y + 390,
            w: 334,
            h: 50,
          })
        }
      }

      return regions
    },

    handleClick: (regionId: string): SovOsPluginClickResult => {
      const gs = useGameStore.getState()

      if (regionId === 'shift:new_campaign') {
        clearSavedShiftFromStorage()
        gs.resetShift('entered_control_room')
        return {
          handled: true,
          statusNotice: 'NEW 3-SHIFT CAMPAIGN STARTED',
          sound: 'clank',
        }
      }

      if (regionId === 'shift:next_shift') {
        const nextShift = Math.min(3, gs.shiftNumber + 1)
        gs.advanceToNextShift()
        saveCurrentShiftToStorage()
        return {
          handled: true,
          statusNotice: `SHIFT ${nextShift}/3 COMMENCING`,
          sound: 'chime',
        }
      }

      if (regionId === 'shift:ending_bureaucrat') {
        gs.resolveCampaignEnding('bureaucrat')
        saveCurrentShiftToStorage()
        return {
          handled: true,
          statusNotice: 'ENDING A: HERO OF SOCIALIST LABOR',
          sound: 'chime',
        }
      }

      if (regionId === 'shift:ending_clear_sky') {
        gs.resolveCampaignEnding('clear_sky')
        saveCurrentShiftToStorage()
        return {
          handled: true,
          statusNotice: 'ENDING B: OPERATION CLEAR SKY TRANSMITTED!',
          sound: 'alarm',
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
      const gs = useGameStore.getState()
      const act = getClearSkyAct(gs.shiftNumber)
      const px = rect.x + 16
      const pw = rect.w - 32

      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'

      // Mode 1: Campaign Ending Epilogue Dossier
      if (gs.campaignEnding !== null) {
        const isTruth = gs.campaignEnding === 'clear_sky'
        const isBad =
          gs.campaignEnding === 'meltdown' || gs.campaignEnding === 'siberia'
        const borderCol = isTruth ? '#4dd9ff' : isBad ? '#ff2a2a' : '#ffb000'

        ctx.fillStyle = isTruth ? '#061a24' : isBad ? '#1f0808' : '#121c10'
        ctx.fillRect(px, rect.y + 56, pw, 318)
        ctx.strokeStyle = borderCol
        ctx.lineWidth = 2.5
        ctx.strokeRect(px, rect.y + 56, pw, 318)

        ctx.fillStyle = borderCol
        ctx.font = 'bold 20px "Courier Prime", monospace'
        const title =
          gs.campaignEnding === 'clear_sky'
            ? 'ENDING B // OPERATION CLEAR SKY TRANSMITTED'
            : gs.campaignEnding === 'bureaucrat'
              ? 'ENDING A // HERO OF SOCIALIST LABOR'
              : gs.campaignEnding === 'meltdown'
                ? 'ENDING C // OFFICIAL TASS DENIAL (MELTDOWN)'
                : 'ENDING D // SIBERIAN LIQUIDATION (6/6 STRIKES)'
        ctx.fillText(title, px + 18, rect.y + 84, pw - 36)

        ctx.fillStyle = '#e6dec3'
        ctx.font = '14px "Courier Prime", monospace'
        const epilogueText =
          gs.campaignEnding === 'clear_sky'
            ? 'At 05:59 you routed archived Duga-1 carrier logs and Volkov Directive 84-Z onto all UKV emergency bands before the morning shift unlocked the blast door. K.O.M.R.A.D.-84 screamed "PROPAGANDA!" as Pripyat evacuated in time.'
            : gs.campaignEnding === 'bureaucrat'
              ? 'Three shifts survived with spotless Party discipline. Commissar Volkov pins an aluminum Star of Quota onto your coat and grants one (1) lukewarm tea voucher. Beneath Sector 84, the graphite flaws remain sealed in concrete.'
              : gs.campaignEnding === 'meltdown'
                ? 'Official TASS Communique: No nuclear incident occurred at Plant No. 4. The glowing blue sky over Sector 84 is a scheduled celebration of heavy industry.'
                : 'K.O.M.R.A.D.-84 terminated your station clearance on Strike 6. Personnel records expunged; enjoy counting pine needles in Magadan Oblast.'
        drawWrapped(ctx, epilogueText, px + 18, rect.y + 124, pw - 36, 20, 5)

        // Epilogue Summary Box
        ctx.fillStyle = '#061a0c'
        ctx.fillRect(px + 18, rect.y + 238, pw - 36, 114)
        ctx.strokeStyle = '#22b549'
        ctx.lineWidth = 1.5
        ctx.strokeRect(px + 18, rect.y + 238, pw - 36, 114)

        ctx.fillStyle = '#33ff66'
        ctx.font = 'bold 14px "Courier Prime", monospace'
        ctx.fillText(
          `FINAL RECORD // RUBLES: ${gs.rubles} RUB   |   QUOTAS: ${gs.quotaCompleted}   |   STRIKES: ${gs.treasonStrikes}/6`,
          px + 34,
          rect.y + 268
        )
        ctx.fillStyle = '#ffb000'
        ctx.fillText(
          `OBEDIENCE (COMPLIANCE): ${gs.complianceScore}   |   CLEAR SKY INTEL: ${gs.truthIntel} (${gs.archivedIntelIds.length}/3 FILES)`,
          px + 34,
          rect.y + 300
        )
        ctx.fillStyle = '#e6dec3'
        ctx.font = '13px "Courier Prime", monospace'
        ctx.fillText(
          `REACTOR CORE AT HANDOVER: ${Math.round(gs.coreTemp)}°C   |   SHIFT REACHED: ${gs.shiftNumber}/3`,
          px + 34,
          rect.y + 330
        )

        const btnHover = hoveredId === 'shift:new_campaign'
        ctx.fillStyle = btnHover ? '#33ff66' : '#124a21'
        ctx.fillRect(rect.x + 170, rect.y + 392, 398, 48)
        ctx.strokeStyle = btnHover ? '#e6dec3' : '#33ff66'
        ctx.lineWidth = 2.5
        ctx.strokeRect(rect.x + 170, rect.y + 392, 398, 48)
        ctx.textAlign = 'center'
        ctx.fillStyle = btnHover ? '#061a0c' : '#e6dec3'
        ctx.font = 'bold 16px "Courier Prime", monospace'
        ctx.fillText('[ START NEW 3-SHIFT CAMPAIGN ]', rect.x + 369, rect.y + 416)
        ctx.textAlign = 'left'
        return
      }

      // Header Banner (Live & Debrief Modes)
      const isDebrief = gs.shiftDebriefActive
      ctx.fillStyle = isDebrief ? '#1f1907' : '#082110'
      ctx.fillRect(px, rect.y + 54, pw, 54)
      ctx.strokeStyle = isDebrief
        ? alertPhase === 1
          ? '#ff2a2a'
          : '#ffb000'
        : '#22b549'
      ctx.lineWidth = 2
      ctx.strokeRect(px, rect.y + 54, pw, 54)

      ctx.fillStyle = isDebrief ? '#ffb000' : '#33ff66'
      ctx.font = 'bold 16px "Courier Prime", monospace'
      ctx.fillText(
        isDebrief
          ? `06:00 HANDOVER DEBRIEF // ${act.actLabel}: ${act.codename}`
          : `${act.actLabel} // SHIFT ${gs.shiftNumber}/3: ${act.codename}`,
        px + 14,
        rect.y + 73,
        pw - 180
      )

      ctx.textAlign = 'right'
      ctx.fillStyle = '#e6dec3'
      ctx.font = 'bold 16px "Courier Prime", monospace'
      ctx.fillText(
        `${formatClockHHMM(gs.shiftTimeMinutes)} / 06:00`,
        px + pw - 14,
        rect.y + 73
      )
      ctx.textAlign = 'left'

      const clockNote =
        gs.shiftNumber === 1 && gs.tutorialPhase !== 'COMPLETED'
          ? 'CLOCK FROZEN ON DAY 1 UNTIL SKALA-84 TUTORIAL IS COMPLETED'
          : isDebrief
            ? 'SHIFT COMPLETE — REVIEW RECORD & ADVANCE HANDOVER BELOW'
            : act.briefingLine
      ctx.fillStyle = '#8fd4a4'
      ctx.font = '12px "Courier Prime", monospace'
      ctx.fillText(clockNote, px + 14, rect.y + 95, pw - 28)

      // Middle Left Card: Shift Metrics & Moral Meters
      const colW = Math.floor((pw - 14) / 2)
      ctx.fillStyle = '#061a0c'
      ctx.fillRect(px, rect.y + 118, colW, 256)
      ctx.strokeStyle = '#22b549'
      ctx.lineWidth = 1.5
      ctx.strokeRect(px, rect.y + 118, colW, 256)

      ctx.fillStyle = '#ffb000'
      ctx.font = 'bold 14px "Courier Prime", monospace'
      ctx.fillText('OPERATOR RECORD', px + 14, rect.y + 140)

      ctx.fillStyle = '#e6dec3'
      ctx.font = '13px "Courier Prime", monospace'
      ctx.fillText(`STATE RUBLES     : ${gs.rubles} RUB`, px + 14, rect.y + 168)
      ctx.fillText(`QUOTAS COMPLETED : ${gs.quotaCompleted}`, px + 14, rect.y + 190)
      ctx.fillStyle = gs.treasonStrikes >= 4 ? '#ff2a2a' : '#e6dec3'
      ctx.fillText(
        `TREASON STRIKES  : ${gs.treasonStrikes} / 6`,
        px + 14,
        rect.y + 212
      )
      ctx.fillStyle = gs.coreTemp >= 700 ? '#ff2a2a' : '#33ff66'
      ctx.fillText(
        `CORE INTEGRITY   : ${Math.round(gs.coreTemp)}°C`,
        px + 14,
        rect.y + 234
      )

      drawMeterBar(
        ctx,
        px + 14,
        rect.y + 262,
        colW - 28,
        'OBEDIENCE (COMPLIANCE)',
        gs.complianceScore,
        100,
        '#ffb000'
      )
      drawMeterBar(
        ctx,
        px + 14,
        rect.y + 312,
        colW - 28,
        'CLEAR SKY INTEL (TRUTH)',
        gs.truthIntel,
        100,
        '#4dd9ff'
      )

      // Middle Right Card: Clear Sky Evidence Dossier
      const rightX = px + colW + 14
      ctx.fillStyle = '#061a0c'
      ctx.fillRect(rightX, rect.y + 118, colW, 256)
      ctx.strokeStyle = '#4dd9ff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(rightX, rect.y + 118, colW, 256)

      ctx.fillStyle = '#4dd9ff'
      ctx.font = 'bold 14px "Courier Prime", monospace'
      ctx.fillText(
        `CLEAR SKY EVIDENCE (${gs.archivedIntelIds.length}/3)`,
        rightX + 14,
        rect.y + 140
      )

      ;([1, 2, 3] as const).forEach((sNum, idx) => {
        const slot = CLEAR_SKY_ACTS[sNum]
        const sy = rect.y + 160 + idx * 64
        const archived = gs.archivedIntelIds.includes(slot.intelId)
        ctx.fillStyle = archived ? '#0b2b36' : '#0a1f12'
        ctx.fillRect(rightX + 12, sy, colW - 24, 54)
        ctx.strokeStyle = archived ? '#4dd9ff' : '#1b6b31'
        ctx.lineWidth = 1.5
        ctx.strokeRect(rightX + 12, sy, colW - 24, 54)

        ctx.fillStyle = archived ? '#4dd9ff' : '#ffb000'
        ctx.font = 'bold 12px "Courier Prime", monospace'
        ctx.fillText(
          `${slot.processName}  [${archived ? 'ARCHIVED' : 'SEALED'}]`,
          rightX + 20,
          sy + 16,
          colW - 40
        )
        ctx.fillStyle = archived ? '#e6dec3' : '#588c68'
        ctx.font = '11px "Courier Prime", monospace'
        drawWrapped(
          ctx,
          archived
            ? slot.summary
            : `Look for ${slot.processName} in ZASHCHITA-84 during Shift ${sNum} and click [ARCHIVE].`,
          rightX + 20,
          sy + 33,
          colW - 40,
          13,
          2
        )
      })

      // Bottom Action Bar
      if (!isDebrief) {
        ctx.fillStyle = '#082110'
        ctx.fillRect(px, rect.y + 390, pw, 50)
        ctx.strokeStyle = '#1f7036'
        ctx.lineWidth = 1.5
        ctx.strokeRect(px, rect.y + 390, pw, 50)
        ctx.fillStyle = '#8fd4a4'
        ctx.font = '13px "Courier Prime", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(
          'REACH 06:00 TO FILE SHIFT REPORT. ARCHIVE EVIDENCE IN ZASHCHITA-84 TO UNLOCK CLEAR SKY.',
          rect.x + rect.w / 2,
          rect.y + 415,
          pw - 24
        )
        ctx.textAlign = 'left'
        return
      }

      if (gs.shiftNumber < 3) {
        const nextHover = hoveredId === 'shift:next_shift'
        ctx.fillStyle = nextHover ? '#33ff66' : '#124a21'
        ctx.fillRect(rect.x + 170, rect.y + 392, 398, 48)
        ctx.strokeStyle = nextHover ? '#e6dec3' : '#33ff66'
        ctx.lineWidth = 2.5
        ctx.strokeRect(rect.x + 170, rect.y + 392, 398, 48)
        ctx.textAlign = 'center'
        ctx.fillStyle = nextHover ? '#061a0c' : '#e6dec3'
        ctx.font = 'bold 16px "Courier Prime", monospace'
        ctx.fillText(
          `[ PROCEED TO SHIFT ${gs.shiftNumber + 1}/3 -> 00:00 ]`,
          rect.x + 369,
          rect.y + 416
        )
        ctx.textAlign = 'left'
        return
      }

      // Shift 3 Final Choice: Ending A vs Ending B
      const hoverA = hoveredId === 'shift:ending_bureaucrat'
      ctx.fillStyle = hoverA ? '#ffb000' : '#3b2d0d'
      ctx.fillRect(rect.x + 24, rect.y + 390, 334, 50)
      ctx.strokeStyle = hoverA ? '#e6dec3' : '#ffb000'
      ctx.lineWidth = 2.5
      ctx.strokeRect(rect.x + 24, rect.y + 390, 334, 50)
      ctx.textAlign = 'center'
      ctx.fillStyle = hoverA ? '#061a0c' : '#e6dec3'
      ctx.font = 'bold 14px "Courier Prime", monospace'
      ctx.fillText('[ FILE OFFICIAL VOLKOV REPORT ]', rect.x + 191, rect.y + 415)

      const clearSkyUnlocked =
        gs.truthIntel >= 50 || gs.archivedIntelIds.length >= 2
      if (clearSkyUnlocked) {
        const hoverB = hoveredId === 'shift:ending_clear_sky'
        ctx.fillStyle = hoverB ? '#4dd9ff' : '#0d3645'
        ctx.fillRect(rect.x + 380, rect.y + 390, 334, 50)
        ctx.strokeStyle = hoverB ? '#e6dec3' : '#4dd9ff'
        ctx.lineWidth = 2.5
        ctx.strokeRect(rect.x + 380, rect.y + 390, 334, 50)
        ctx.fillStyle = hoverB ? '#061a0c' : '#4dd9ff'
        ctx.fillText('[ TRANSMIT CLEAR SKY LEAK ]', rect.x + 547, rect.y + 415)
      } else {
        ctx.fillStyle = '#1b1414'
        ctx.fillRect(rect.x + 380, rect.y + 390, 334, 50)
        ctx.strokeStyle = '#5c2626'
        ctx.lineWidth = 1.5
        ctx.strokeRect(rect.x + 380, rect.y + 390, 334, 50)
        ctx.fillStyle = '#9c5a5a'
        ctx.font = 'bold 12px "Courier Prime", monospace'
        ctx.fillText(
          'CLEAR SKY LOCKED (NEED 50 TRUTH OR 2 FILES)',
          rect.x + 547,
          rect.y + 415,
          318
        )
      }
      ctx.textAlign = 'left'
    },
  }
}
