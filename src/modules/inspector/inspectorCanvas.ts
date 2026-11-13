// 1984 Soviet Inspector Desk Canvas & 16-Color Bayer Dithering Renderers
// Implements STEP 1–5: 16-Color Bayer Dithered Hardware, Compact Teletype Slips,
// Full Expanded Directives with Relative Ink Stamps, 3-Page Scrollable KGB Security Manual,
// and True 2x Straight Optical Magnifying Glass Zoom (Zero UV).

import type { WePadChatMessage, WePadTabId } from '../../shared/types'
import {
  INK_COLOR_HEX,
  PAPER_COLOR_HEX,
  PAPER_COMPACT_H_3D,
  PAPER_COMPACT_W_3D,
  PAPER_EXPANDED_H_3D,
  PAPER_EXPANDED_W_3D,
  type DeskDocument,
  type DocumentFontType,
  type InspectionVerdict,
  type ManualPageId,
  type SealEmblemType,
  type SealMicroDefect,
} from './useDeskStore'

export interface WePadTelemetryPayload {
  activeTab: WePadTabId
  wePadHeld: boolean
  wePadInspecting: boolean
  tutorialPhase: string
  tutorialHeader: string
  tutorialBody: string
  tutorialHint: string
  tutorialPanelKey: string
  tutorialActionLine: string
  tutorialWhyLines: [string, string]
  tutorialVolkovQuote: string
  chatLog: WePadChatMessage[]
  thermalPower: number
  drumPressure: number
  drumWaterLevel: number
  coreTemp: number
  controlRods: number
  reactivity: number
  xenonPoisoning: number
  voidFraction: number
  rpm: number
  gridHz: number
  syncPhase: number
  gridConnected: boolean
  turbineValve?: number
  totalElectricalMW: number
  neededMWe: number
  generatedMWe: number
  houseLoadMW: number
  plantWaterDrainPct: number
  mcpActiveCount: number
}

// 16-Color Soviet Bunker Palette from Master Prompt STEP 1
export const SOVIET_16_PALETTE_HEX = [
  '#0d110f', // 0: Deep Bunker Black
  '#18211b', // 1: Dark Cast Iron
  '#2a362b', // 2: Oxidized Olive Drab
  '#3e4d40', // 3: Worn Military Green
  '#576657', // 4: Steel Highlight
  '#778472', // 5: Brushed Specular Metal
  '#2b1a12', // 6: Dark Bakelite Shadow
  '#472b1e', // 7: Bakelite Brown
  '#6b442e', // 8: Turned Wood Highlight
  '#5c4d2c', // 9: Tarnished Brass Shadow
  '#8c7a4b', // 10: Brass Midtone
  '#b8a46b', // 11: Brass Specular
  '#8f8772', // 12: Pravda Shadow Grey-Ivory
  '#b5ad96', // 13: Pravda Mid Ivory
  '#cfc6b0', // 14: Pravda Aged Ivory
  '#8b1e1e', // 15: Soviet Crimson (Ink / LED)
] as const

const PALETTE_RGB: Array<[number, number, number]> = SOVIET_16_PALETTE_HEX.map(
  (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
)

// 4x4 Ordered Bayer Matrix (normalized -0.5 to +0.5)
const BAYER_4X4 = [
  [-0.5, 8 / 16 - 0.5, 2 / 16 - 0.5, 10 / 16 - 0.5],
  [12 / 16 - 0.5, 4 / 16 - 0.5, 14 / 16 - 0.5, 6 / 16 - 0.5],
  [3 / 16 - 0.5, 11 / 16 - 0.5, 1 / 16 - 0.5, 9 / 16 - 0.5],
  [15 / 16 - 0.5, 7 / 16 - 0.5, 13 / 16 - 0.5, 5 / 16 - 0.5],
]

/**
 * Applies the Master Prompt's 16-color 4x4 Ordered Bayer Dithering directly to a Canvas2D context.
 */
export function apply16ColorBayerDither(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ditherStrength = 16
): void {
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data
  for (let y = 0; y < h; y++) {
    const bayerRow = BAYER_4X4[y & 3]
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const a = data[idx + 3]
      if (a < 90) {
        data[idx + 3] = 0
        continue
      }
      const bayer = bayerRow[x & 3] * ditherStrength
      const r = Math.min(255, Math.max(0, data[idx] + bayer))
      const g = Math.min(255, Math.max(0, data[idx + 1] + bayer))
      const b = Math.min(255, Math.max(0, data[idx + 2] + bayer))

      let bestDist = Infinity
      let bestColor = PALETTE_RGB[0]
      for (let i = 0; i < PALETTE_RGB.length; i++) {
        const pr = PALETTE_RGB[i][0] - r
        const pg = PALETTE_RGB[i][1] - g
        const pb = PALETTE_RGB[i][2] - b
        const dist = pr * pr + pg * pg + pb * pb
        if (dist < bestDist) {
          bestDist = dist
          bestColor = PALETTE_RGB[i]
        }
      }
      data[idx] = bestColor[0]
      data[idx + 1] = bestColor[1]
      data[idx + 2] = bestColor[2]
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(imgData, 0, 0)
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

const DIRECTIVE_HIGH_CONTRAST_INK_HEX: Record<
  DeskDocument['inkColor'],
  string
> = {
  SOVIET_CRIMSON: '#8a0f0a',
  BUNKER_OLIVE: '#143b16',
  PRAVDA_BLACK: '#0a0a0a',
  IMPERIAL_PURPLE: '#4e106e',
  CIA_NAVY_BLUE: '#0b2968',
}

function getFontDeclaration(fontType: DocumentFontType, sizePx: number): string {
  switch (fontType) {
    case 'WESTERN_SERIF':
      return `900 ${sizePx}px Georgia, "Times New Roman", Times, serif`
    case 'SLANTED_ITALIC':
      return `italic 900 ${sizePx}px "Courier Prime", "Consolas", monospace`
    case 'BOURGEOIS_SANS':
      return `900 ${sizePx}px "Arial Black", Arial, Helvetica, sans-serif`
    case 'PRAVDA_BLOCK':
      return `900 ${sizePx}px "Courier Prime", "Consolas", monospace`
    case 'GOST_MONO':
    default:
      return `900 ${sizePx}px "Courier Prime", "Consolas", monospace`
  }
}

/**
 * 1. Helper Function for Ultra-Thick Text (`drawHeavyText`)
 * Sets `ctx.lineJoin = 'round'`, `ctx.miterLimit = 2`, and `ctx.lineWidth = Math.max(2.2, fontSize * 0.08)`
 * in the exact same color as `ctx.fillStyle` (or an optional dark outline), then calls BOTH
 * `ctx.strokeText(text, x, y)` AND `ctx.fillText(text, x, y)` so every character stroke is 2-3x thicker!
 */
export function drawHeavyText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fillColor: string,
  options?: {
    maxWidth?: number
    outlineColor?: string
    outlineWidth?: number
    strokeColor?: string
    strokeWidth?: number
  }
): void {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  const maxWidth = options?.maxWidth

  // Optional outer contrast outline pass (e.g. black outline behind white Ministry banner text)
  if (options?.outlineColor) {
    ctx.strokeStyle = options.outlineColor
    ctx.lineWidth = options.outlineWidth ?? Math.max(4.5, fontSize * 0.16)
    if (maxWidth !== undefined) {
      ctx.strokeText(text, x, y, maxWidth)
    } else {
      ctx.strokeText(text, x, y)
    }
  }

  // Primary self-colored thickening stroke pass + solid fill pass
  ctx.fillStyle = fillColor
  ctx.strokeStyle = options?.strokeColor ?? fillColor
  ctx.lineWidth = options?.strokeWidth ?? Math.max(2.2, fontSize * 0.08)

  if (maxWidth !== undefined) {
    ctx.strokeText(text, x, y, maxWidth)
    ctx.fillText(text, x, y, maxWidth)
  } else {
    ctx.strokeText(text, x, y)
    ctx.fillText(text, x, y)
  }
  ctx.restore()
}

function parseDirectiveOrderDisplay(doc: DeskDocument): {
  sectorLine: string
  targetLoadLine: string
  shortNote: string
} {
  let sectorLine = '[5] VODKA PLANT'
  let targetLoadLine = 'TARGET: 25 MW (+10 MW)'

  const bracketMatch = doc.powerOrderText.match(/\[(\d+)\.?\s*([^\]]+)\]/)
  if (bracketMatch) {
    sectorLine = `[${bracketMatch[1]}] ${bracketMatch[2].trim()}`
  }

  const mwMatch = doc.powerOrderText.match(/TO\s+(\d+)\s*MW/i)
  const deltaMatch = doc.powerOrderText.match(/\(\s*([+-]?\d+\s*MW)\s*\)/i)
  if (mwMatch) {
    const deltaPart = deltaMatch ? ` (${deltaMatch[1].replace(/\s+/g, ' ')})` : ''
    targetLoadLine = `TARGET: ${mwMatch[1]} MW${deltaPart}`
  }

  const rawWords = doc.content
    .replace(/^.*?\(\s*[+-]?\d+\s*MW\s*\)\.?\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const shortNote = (
    rawWords.length > 0
      ? rawWords.slice(0, 5).join(' ')
      : 'STAMP GREEN APPROVED'
  ).toUpperCase()

  return { sectorLine, targetLoadLine, shortNote }
}

/**
 * Renders the 3 Official Soviet Seals (USSR State Seal, MinSredMash Atom, KGB Sword & Shield).
 * Giant, thick-lined (`4px–6px` lineWidth) with 2.5x larger bold ring text (`★ СССР ★ 1984 ★` vs `★ CCCP-LATIN ★`)
 * so every seal detail is crystal clear at a glance on a MacBook screen.
 */
export function drawOfficialSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  sealType: SealEmblemType,
  microDefect: SealMicroDefect,
  inkHex: string,
  _isMagnified: boolean
): void {
  ctx.save()
  ctx.translate(cx, cy)
  const scale = radius / 100
  ctx.scale(scale, scale)

  const hasLatinRing =
    microDefect === 'LATIN_RING_TEXT' ||
    microDefect === 'SIX_POINT_STAR' ||
    microDefect === 'BROKEN_ORBIT'

  const topRingText = hasLatinRing ? '★ CCCP-LATIN ★' : '★ СССР ★ 1984 ★'

  const bottomRingText =
    sealType === 'USSR_STATE_SEAL'
      ? hasLatinRing
        ? 'SOVMIN-WEST'
        : 'СОВМИН СССР'
      : sealType === 'MINSREDMASH_ATOM'
        ? hasLatinRing
          ? 'ORBIT-FAKE'
          : 'МИНСРЕДМАШ'
        : hasLatinRing
          ? 'LANGLEY-5'
          : 'КГБ СССР №4'

  ctx.strokeStyle = inkHex
  ctx.fillStyle = inkHex
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Outer & Inner Stamp Rings (Doubled 4px-6px heavy lineWidth)
  ctx.lineWidth = 6.0
  ctx.beginPath()
  ctx.arc(0, 0, 95, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 3.8
  ctx.setLineDash([5.5, 3.8])
  ctx.beginPath()
  ctx.arc(0, 0, 86, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.lineWidth = 5.0
  ctx.beginPath()
  ctx.arc(0, 0, 56, 0, Math.PI * 2)
  ctx.stroke()

  // 2.5x Larger Bold Ring Text (`★ СССР ★ 1984 ★` vs `★ CCCP-LATIN ★`) with `drawHeavyText`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 18.5px "Courier Prime", "Consolas", monospace'
  drawHeavyText(ctx, topRingText, 0, -71, 18.5, inkHex, {
    maxWidth: 146,
    strokeWidth: 2.0,
  })
  drawHeavyText(ctx, bottomRingText, 0, 72, 18.5, inkHex, {
    maxWidth: 144,
    strokeWidth: 2.0,
  })

  // Left & Right Bold Rim Codes
  ctx.font = '900 17px "Courier Prime", "Consolas", monospace'
  const leftCode = microDefect === 'NONE' ? '№84' : 'ERR'
  const rightCode =
    microDefect === 'NONE'
      ? '5★'
      : microDefect === 'FOUR_POINT_STAR'
        ? '4★'
        : '6★'
  drawHeavyText(ctx, leftCode, -72, 2, 17, inkHex, { strokeWidth: 1.8 })
  drawHeavyText(ctx, rightCode, 72, 2, 17, inkHex, { strokeWidth: 1.8 })

  // Top Crown Star at (0, -39) — giant & thick-lined (`5-pt` vs `4-pt` / `6-pt` fake)
  const starY = -39
  const rOuter = 16.5
  ctx.lineWidth = 3.2
  if (microDefect === 'SIX_POINT_STAR') {
    ctx.beginPath()
    ctx.moveTo(0, starY - rOuter)
    ctx.lineTo(rOuter * 0.86, starY + rOuter * 0.5)
    ctx.lineTo(-rOuter * 0.86, starY + rOuter * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, starY + rOuter)
    ctx.lineTo(rOuter * 0.86, starY - rOuter * 0.5)
    ctx.lineTo(-rOuter * 0.86, starY - rOuter * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (microDefect === 'FOUR_POINT_STAR') {
    const rIn = rOuter * 0.36
    ctx.beginPath()
    ctx.moveTo(0, starY - rOuter)
    ctx.lineTo(rIn, starY - rIn)
    ctx.lineTo(rOuter, starY)
    ctx.lineTo(rIn, starY + rIn)
    ctx.lineTo(0, starY + rOuter)
    ctx.lineTo(-rIn, starY + rIn)
    ctx.lineTo(-rOuter, starY)
    ctx.lineTo(-rIn, starY - rIn)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    const rInner = rOuter * 0.44
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? rOuter : rInner
      const angle = -Math.PI / 2 + (i * Math.PI) / 5
      const px = Math.cos(angle) * r
      const py = starY + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // Center Emblem by Seal Type (Doubled 4px–6px lineWidth)
  if (sealType === 'USSR_STATE_SEAL') {
    ctx.lineWidth = 5.4
    ctx.beginPath()
    ctx.arc(0, 11, 27, 0, Math.PI * 2)
    ctx.stroke()

    ctx.lineWidth = 4.2
    ctx.beginPath()
    ctx.ellipse(0, 11, 13.5, 27, 0, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(-27, 11)
    ctx.lineTo(27, 11)
    ctx.moveTo(-23, -3)
    ctx.lineTo(23, -3)
    ctx.moveTo(-23, 25)
    ctx.lineTo(23, 25)
    ctx.stroke()

    ctx.lineWidth = 6.2
    ctx.setLineDash([6.5, 3.5])
    ctx.beginPath()
    ctx.arc(0, 11, 39, Math.PI * 0.68, Math.PI * 1.32)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 11, 39, -Math.PI * 0.32, Math.PI * 0.32)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.lineWidth = 5.8
    ctx.beginPath()
    ctx.moveTo(-14, 24)
    ctx.lineTo(14, -6)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(2, 9, 16, -Math.PI * 0.65, Math.PI * 0.55)
    ctx.stroke()
  } else if (sealType === 'MINSREDMASH_ATOM') {
    ctx.lineWidth = 5.8
    ctx.beginPath()
    ctx.ellipse(0, 11, 37, 16, (-32 * Math.PI) / 180, 0, Math.PI * 2)
    ctx.stroke()

    if (microDefect === 'BROKEN_ORBIT') {
      ctx.setLineDash([7.0, 6.5])
      ctx.beginPath()
      ctx.ellipse(0, 11, 37, 16, (32 * Math.PI) / 180, 0, Math.PI * 1.12)
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      ctx.beginPath()
      ctx.ellipse(0, 11, 37, 16, (32 * Math.PI) / 180, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(0, 11, 8.8, 0, Math.PI * 2)
    ctx.fill()

    ctx.lineWidth = 5.6
    ctx.beginPath()
    ctx.moveTo(-15, 26)
    ctx.lineTo(15, -6)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(2, 11, 17, -Math.PI * 0.6, Math.PI * 0.55)
    ctx.stroke()
  } else if (sealType === 'KGB_SWORD_SHIELD') {
    ctx.lineWidth = 6.2
    ctx.beginPath()
    ctx.moveTo(0, -28)
    ctx.lineTo(0, 48)
    ctx.moveTo(-18, -19)
    ctx.lineTo(18, -19)
    ctx.stroke()

    ctx.fillStyle = '#e8dec3'
    ctx.lineWidth = 5.6
    ctx.beginPath()
    ctx.moveTo(-24, -13)
    ctx.lineTo(24, -13)
    ctx.lineTo(20, 19)
    ctx.lineTo(0, 41)
    ctx.lineTo(-20, 19)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = inkHex
    ctx.lineWidth = 5.6
    ctx.beginPath()
    ctx.moveTo(-12, 23)
    ctx.lineTo(12, -4)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 9, 13.5, -Math.PI * 0.6, Math.PI * 0.55)
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Draws a compact perforated teletype slip (used inside the ПРАВДА-84 roller slot,
 * in the left output tray, and when loaded into the УНИЧТОЖИТЕЛЬ-84 shredder jaws).
 */
export function drawCompactTeletypeSlipCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  doc: DeskDocument
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  const LW = 256
  const LH = 320
  ctx.scale(w / LW, h / LH)

  const paperHex = PAPER_COLOR_HEX[doc.paperColor]
  const inkHex = DIRECTIVE_HIGH_CONTRAST_INK_HEX[doc.inkColor]
  const { sectorLine, targetLoadLine } = parseDirectiveOrderDisplay(doc)

  ctx.fillStyle = paperHex
  ctx.fillRect(0, 0, LW, LH)

  // Left & Right Tractor Sprocket Holes
  ctx.fillStyle = '#0a0a0a'
  for (let y = 14; y < LH - 18; y += 26) {
    ctx.fillRect(7, y, 8, 8)
    ctx.fillRect(LW - 15, y, 8, 8)
  }

  // Serrated bottom tear edge shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.fillRect(0, LH - 10, LW, 10)
  ctx.fillStyle = '#0a0a0a'
  for (let x = 0; x < LW; x += 12) {
    ctx.beginPath()
    ctx.moveTo(x, LH)
    ctx.lineTo(x + 6, LH - 7)
    ctx.lineTo(x + 12, LH)
    ctx.closePath()
    ctx.fill()
  }

  // Inner Slip Frame
  ctx.strokeStyle = '#0a0a0a'
  ctx.lineWidth = 3.5
  ctx.strokeRect(20, 10, LW - 40, LH - 24)

  // 1. Bold Ministry Header Banner
  ctx.fillStyle = inkHex
  ctx.fillRect(24, 15, LW - 48, 52)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = getFontDeclaration(doc.fontType, 18)
  const minLines = wrapCanvasText(ctx, doc.ministry, LW - 56)
  if (minLines.length === 1) {
    drawHeavyText(ctx, minLines[0], LW / 2, 41, 18, '#ffffff', {
      maxWidth: LW - 54,
      outlineColor: '#0a0a0a',
      outlineWidth: 3.5,
    })
  } else {
    ctx.font = getFontDeclaration(doc.fontType, 16)
    drawHeavyText(ctx, minLines[0], LW / 2, 30, 16, '#ffffff', {
      maxWidth: LW - 54,
      outlineColor: '#0a0a0a',
      outlineWidth: 3.2,
    })
    drawHeavyText(ctx, minLines.slice(1).join(' '), LW / 2, 52, 16, '#ffffff', {
      maxWidth: LW - 54,
      outlineColor: '#0a0a0a',
      outlineWidth: 3.2,
    })
  }

  // 2. Massive Dark 2-Line Center Target Box
  ctx.fillStyle = '#101814'
  ctx.fillRect(24, 74, LW - 48, 108)
  ctx.strokeStyle = '#0a0a0a'
  ctx.lineWidth = 3.5
  ctx.strokeRect(24, 74, LW - 48, 108)

  ctx.font = '900 22px "Courier Prime", "Consolas", monospace'
  drawHeavyText(ctx, sectorLine, LW / 2, 104, 22, '#33ff66', {
    maxWidth: LW - 58,
    outlineColor: '#050807',
    outlineWidth: 3.5,
  })

  ctx.strokeStyle = '#28b862'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(32, 126)
  ctx.lineTo(LW - 32, 126)
  ctx.stroke()

  ctx.font = '900 22px "Courier Prime", "Consolas", monospace'
  drawHeavyText(ctx, targetLoadLine, LW / 2, 156, 22, '#ffe066', {
    maxWidth: LW - 58,
    outlineColor: '#050807',
    outlineWidth: 3.5,
  })

  // 3. Bottom Unfold Callout & Giant Seal Preview
  drawOfficialSeal(
    ctx,
    LW / 2,
    234,
    44,
    doc.sealType,
    doc.sealMicroDefect,
    inkHex,
    false
  )

  ctx.font = '900 17px "VT323", monospace'
  drawHeavyText(ctx, '► TEAR TO DESK ►', LW / 2, LH - 24, 17, '#8a0f0a', {
    maxWidth: LW - 56,
  })

  ctx.restore()
}

/**
 * Draws the Full Expanded Directive Document (768x1024 crisp high-DPI canvas, normalized to 560x740 logical grid).
 * Restructured from top to bottom with ZERO empty middle gap, ultra-thick `drawHeavyText` strokes,
 * a 200px tall center dark command box, +55% larger metadata & signature, +35% larger thick-lined seal,
 * and a clean unclipped bottom instruction bar.
 */
export function drawFullDirectiveSheetCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  doc: DeskDocument,
  isMagnified = false
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  const LW = 560
  const LH = 740
  ctx.scale(w / LW, h / LH)

  const paperHex = PAPER_COLOR_HEX[doc.paperColor]
  const inkHex = DIRECTIVE_HIGH_CONTRAST_INK_HEX[doc.inkColor]
  const { sectorLine, targetLoadLine, shortNote } =
    parseDirectiveOrderDisplay(doc)

  // 1. Paper Stock Tint Background
  ctx.fillStyle = paperHex
  ctx.fillRect(0, 0, LW, LH)

  // Folded top-right dog-ear corner
  ctx.fillStyle = '#8f8772'
  ctx.beginPath()
  ctx.moveTo(LW - 36, 0)
  ctx.lineTo(LW, 36)
  ctx.lineTo(LW - 36, 36)
  ctx.closePath()
  ctx.fill()

  // 2. Tractor-Feed Sprocket Holes Left & Right
  ctx.fillStyle = '#0a0a0a'
  for (let y = 18; y < LH - 18; y += 34) {
    ctx.fillRect(8, y, 10, 10)
    ctx.fillRect(LW - 18, y, 10, 10)
  }

  // 3. Heavy Official Double Border Frame
  ctx.strokeStyle = '#0a0a0a'
  ctx.lineWidth = 4.5
  ctx.strokeRect(26, 14, LW - 52, LH - 28)
  ctx.lineWidth = 2.2
  ctx.strokeRect(32, 20, LW - 64, LH - 40)

  // ============================================================================
  // SECTION 1: TOP MINISTRY BANNER (Taller & Bolder, y: 26..136) + GOST & DATE ROW (y: 140..176)
  // - Removed tiny unreadable micro-line above the red banner.
  // - 40% taller coloured Ministry banner with +45% larger white + black-outlined strokes.
  // - Single big, bold row for GOST code & Date (`ГОСТ-84-01  |  04.11.1984`) at +50% larger font size.
  // ============================================================================
  const bannerX = 38
  const bannerY = 26
  const bannerW = LW - 76
  const bannerH = 108
  ctx.fillStyle = inkHex
  ctx.fillRect(bannerX, bannerY, bannerW, bannerH)
  ctx.strokeStyle = '#0a0a0a'
  ctx.lineWidth = 4.0
  ctx.strokeRect(bannerX, bannerY, bannerW, bannerH)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = getFontDeclaration(doc.fontType, 38)
  const ministryLines = wrapCanvasText(ctx, doc.ministry, bannerW - 24)
  if (ministryLines.length === 1) {
    ctx.font = getFontDeclaration(doc.fontType, 42)
    drawHeavyText(
      ctx,
      ministryLines[0],
      LW / 2,
      bannerY + bannerH / 2,
      42,
      '#ffffff',
      {
        maxWidth: bannerW - 20,
        outlineColor: '#0a0a0a',
        outlineWidth: 6.5,
      }
    )
  } else {
    ctx.font = getFontDeclaration(doc.fontType, 38)
    drawHeavyText(
      ctx,
      ministryLines[0],
      LW / 2,
      bannerY + 32,
      38,
      '#ffffff',
      {
        maxWidth: bannerW - 20,
        outlineColor: '#0a0a0a',
        outlineWidth: 6.0,
      }
    )
    drawHeavyText(
      ctx,
      ministryLines.slice(1).join(' '),
      LW / 2,
      bannerY + 76,
      38,
      '#ffffff',
      {
        maxWidth: bannerW - 20,
        outlineColor: '#0a0a0a',
        outlineWidth: 6.0,
      }
    )
  }

  // Single Big, Bold Row for GOST Code & Date (`ГОСТ-84-01  |  04.11.1984`) at +50% larger font size
  const gostRowY = 140
  const gostRowH = 38
  ctx.fillStyle = 'rgba(10, 10, 10, 0.08)'
  ctx.fillRect(bannerX, gostRowY, bannerW, gostRowH)
  ctx.strokeStyle = '#0a0a0a'
  ctx.lineWidth = 3.0
  ctx.strokeRect(bannerX, gostRowY, bannerW, gostRowH)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = getFontDeclaration(doc.fontType, 27)
  drawHeavyText(
    ctx,
    `${doc.referenceCode}   |   ${doc.dateString}`,
    LW / 2,
    gostRowY + gostRowH / 2 + 1,
    27,
    '#0a0a0a',
    { maxWidth: bannerW - 20 }
  )

  // ============================================================================
  // SECTION 2: MASSIVE 2-LINE CENTER TARGET BOX (Fills Upper-Middle of Page, y: 184..382, height = 198px!)
  //   - Line 1 (Huge Bold Emerald/Yellow): `[5] VODKA PLANT` (Font size 2x larger!)
  //   - Line 2 (Giant Poster-Sized Readout): `TARGET: 25 MW (+10 MW)` (Font size 2.2x larger, ultra-thick stroke!)
  // ============================================================================
  const boxX = 38
  const boxY = 184
  const boxW = LW - 76
  const boxH = 198
  ctx.fillStyle = '#0f1713'
  ctx.fillRect(boxX, boxY, boxW, boxH)
  ctx.strokeStyle = '#0a0a0a'
  ctx.lineWidth = 5.0
  ctx.strokeRect(boxX, boxY, boxW, boxH)
  ctx.strokeStyle = '#28b862'
  ctx.lineWidth = 3.0
  ctx.strokeRect(boxX + 6, boxY + 6, boxW - 12, boxH - 12)

  // Line 1: Huge Bold Emerald `[5] VODKA PLANT`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 50px "Courier Prime", "Consolas", monospace'
  drawHeavyText(ctx, sectorLine, LW / 2, boxY + 54, 50, '#3dff78', {
    maxWidth: boxW - 28,
    outlineColor: '#040806',
    outlineWidth: 7.0,
    strokeWidth: 4.2,
  })

  // Heavy Emerald Center Divider Bar inside Dark Command Box
  ctx.strokeStyle = '#28b862'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(boxX + 18, boxY + 100)
  ctx.lineTo(boxX + boxW - 18, boxY + 100)
  ctx.stroke()

  // Line 2: Giant Poster-Sized Readout `TARGET: 25 MW (+10 MW)`
  ctx.font = '900 52px "Courier Prime", "Consolas", monospace'
  drawHeavyText(ctx, targetLoadLine, LW / 2, boxY + 150, 52, '#ffe066', {
    maxWidth: boxW - 28,
    outlineColor: '#040806',
    outlineWidth: 7.5,
    strokeWidth: 4.5,
  })

  // ============================================================================
  // SECTION 3: 1-LINE CIPHER / FONT INSPECTION BANNER (y: 388..444, +60% larger font size!)
  // Rendered in `doc.fontType` so `GOST_MONO` vs fake font is huge and effortless to inspect!
  // ============================================================================
  const noteY = 388
  const noteH = 56
  ctx.fillStyle = 'rgba(10, 10, 10, 0.08)'
  ctx.fillRect(bannerX, noteY, bannerW, noteH)
  ctx.strokeStyle = inkHex
  ctx.lineWidth = 3.5
  ctx.strokeRect(bannerX, noteY, bannerW, noteH)

  ctx.save()
  ctx.beginPath()
  ctx.rect(bannerX + 4, noteY + 2, bannerW - 8, noteH - 4)
  ctx.clip()
  if (doc.fontType === 'SLANTED_ITALIC') {
    ctx.translate(LW / 2, noteY + noteH / 2)
    ctx.transform(1, 0, -0.24, 1, 0, 0)
    ctx.translate(-LW / 2, -(noteY + noteH / 2))
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = getFontDeclaration(doc.fontType, 34)
  drawHeavyText(
    ctx,
    shortNote,
    LW / 2,
    noteY + noteH / 2 + 1,
    34,
    '#0a0a0a',
    { maxWidth: bannerW - 20 }
  )
  ctx.restore()

  // ============================================================================
  // SECTION 4: EXPANDED BOTTOM METADATA, SIGNATURE & GIANT OFFICIAL SEAL (`ПЕЧАТЬ`) (y: 450..674)
  // - Left Column (`ПОДПИСЬ`, `PAPER`, `INK`, `FONT`): +55% larger font with `drawHeavyText`, removed tiny micro-code.
  // - Right Column: Giant, thick-lined Official Seal (`radius = 104`, fills right half of lower box).
  // ============================================================================
  const footerTop = 450
  const footerH = 224
  ctx.strokeStyle = inkHex
  ctx.lineWidth = 4.0
  ctx.strokeRect(bannerX, footerTop, bannerW, footerH)

  // Left Column (x: 48..296)
  const leftX = 48
  const leftMaxW = 246
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  ctx.font = '900 22px "Courier Prime", "Consolas", monospace'
  drawHeavyText(ctx, 'ПОДПИСЬ:', leftX, footerTop + 26, 22, '#0a0a0a', {
    maxWidth: leftMaxW,
  })

  ctx.font = getFontDeclaration(doc.fontType, 32)
  drawHeavyText(ctx, doc.signature, leftX, footerTop + 62, 32, inkHex, {
    maxWidth: leftMaxW,
  })

  ctx.strokeStyle = '#0a0a0a'
  ctx.lineWidth = 3.0
  ctx.beginPath()
  ctx.moveTo(leftX, footerTop + 86)
  ctx.lineTo(leftX + leftMaxW, footerTop + 86)
  ctx.stroke()

  // 3 Huge, Crystal-Clear Inspection Lines (`PAPER`, `INK`, `FONT`) at +55% larger font size
  ctx.font = '900 25px "Courier Prime", "Consolas", monospace'
  drawHeavyText(
    ctx,
    `PAPER: ${doc.paperColor}`,
    leftX,
    footerTop + 114,
    25,
    '#0a0a0a',
    { maxWidth: leftMaxW }
  )
  drawHeavyText(
    ctx,
    `INK:   ${doc.inkColor}`,
    leftX,
    footerTop + 154,
    25,
    inkHex,
    { maxWidth: leftMaxW }
  )
  drawHeavyText(
    ctx,
    `FONT:  ${doc.fontType}`,
    leftX,
    footerTop + 194,
    25,
    '#0a0a0a',
    { maxWidth: leftMaxW }
  )

  // Right Column — Giant, Thick-Lined Official Seal (`ПЕЧАТЬ`) filling the entire right half of the lower box
  drawOfficialSeal(
    ctx,
    410,
    footerTop + 112,
    104,
    doc.sealType,
    doc.sealMicroDefect,
    inkHex,
    isMagnified
  )

  // ============================================================================
  // SECTION 5: UNCLIPPED BOTTOM BLACK INSTRUCTION BAR (y: 680..720)
  // Shortened to `[ОДОБРЕНО] -> LEFT TUBE  |  [УНИЧТОЖЕНО] -> RIGHT SHREDDER`
  // centered cleanly inside the black bar with zero left/right clipping!
  // ============================================================================
  const bottomBarY = 680
  const bottomBarH = 40
  ctx.fillStyle = '#0a0d0b'
  ctx.fillRect(bannerX, bottomBarY, bannerW, bottomBarH)
  ctx.strokeStyle = '#b8a46b'
  ctx.lineWidth = 2.8
  ctx.strokeRect(bannerX, bottomBarY, bannerW, bottomBarH)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '900 22px "VT323", "Courier Prime", monospace'
  drawHeavyText(
    ctx,
    '[ОДОБРЕНО] -> LEFT TUBE  |  [УНИЧТОЖЕНО] -> RIGHT SHREDDER',
    LW / 2,
    bottomBarY + bottomBarH / 2 + 1,
    22,
    '#ffe066',
    {
      maxWidth: bannerW - 18,
      outlineColor: '#000000',
      outlineWidth: 3.5,
      strokeWidth: 1.8,
    }
  )

  // 6. Permanently Attached Relative Ink Stamps (`doc.stamps`)
  for (const stamp of doc.stamps) {
    ctx.save()
    const sx = Math.max(115, Math.min(LW - 115, stamp.u * LW))
    const sy = Math.max(66, Math.min(LH - 66, stamp.v * LH))
    ctx.translate(sx, sy)
    ctx.rotate(-0.08)
    const stampColor = stamp.type === 'APPROVED' ? '#0f5c25' : '#8a0f0a'
    ctx.fillStyle = 'rgba(235, 228, 205, 0.94)'
    ctx.fillRect(-118, -42, 236, 84)
    ctx.strokeStyle = stampColor
    ctx.fillStyle = stampColor
    ctx.lineWidth = 6.5
    ctx.strokeRect(-118, -42, 236, 84)
    ctx.lineWidth = 3.0
    ctx.strokeRect(-108, -32, 216, 64)
    ctx.font = '900 32px "Courier Prime", "Consolas", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    drawHeavyText(
      ctx,
      stamp.type === 'APPROVED' ? 'ОДОБРЕНО' : 'УНИЧТОЖЕНО',
      0,
      -8,
      32,
      stampColor
    )
    ctx.font = '900 20px "Courier Prime", "Consolas", monospace'
    drawHeavyText(ctx, `${stamp.type} // №4`, 0, 20, 20, stampColor)
    ctx.restore()
  }

  ctx.restore()
}

export const drawDirectiveCanvas = drawFullDirectiveSheetCanvas

type ManualIconKind =
  | 'shift_goal_crt'
  | 'tear_inspect'
  | 'stamp_tube_shred'
  | 'route_mw_water'
  | 'levers'
  | 'wheel'
  | 'az5'
  | 'octagon'
  | 'gas'
  | 'rheostat'
  | 'breaker'
  | 'piston'
  | 'vent'
  | 'ventilation_toggle'

function drawFivePointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number
): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawFourPointFakeStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number
): void {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const a = -Math.PI / 2 + (i * Math.PI) / 4
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawManualSchematicIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  kind: ManualIconKind
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(0.84, 0.88)

  const INK_BLACK = '#111111'
  const INK_GREEN = '#094a20'
  const INK_RED = '#7a110a'
  const INK_NAVY = '#0c2854'
  const PAPER_BG = '#e8dec3'

  // Subtle blueprint cross-hatch grid inside icon frame
  ctx.strokeStyle = 'rgba(20, 18, 16, 0.14)'
  ctx.lineWidth = 1
  for (let gx = -46; gx <= 46; gx += 12) {
    ctx.beginPath()
    ctx.moveTo(gx, -68)
    ctx.lineTo(gx, 68)
    ctx.stroke()
  }
  for (let gy = -64; gy <= 64; gy += 12) {
    ctx.beginPath()
    ctx.moveTo(-48, gy)
    ctx.lineTo(48, gy)
    ctx.stroke()
  }

  if (kind === 'shift_goal_crt') {
    // Card 1 (SHIFT GOAL & GRID MAP): K.O.M.R.A.D.-84 CRT monitor + central Nuclear Plant icon,
    // radiating power lines (MW), thermometer gauge (<1000°C), and shift clock (00:00 -> 06:00).
    ctx.fillStyle = '#18241d'
    ctx.fillRect(-44, -64, 88, 70)
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.8
    ctx.strokeRect(-44, -64, 88, 70)
    ctx.strokeStyle = '#b8a46b'
    ctx.lineWidth = 1.8
    ctx.strokeRect(-40, -60, 80, 62)

    // Radiating grid transmission lines from central plant to regional nodes
    ctx.strokeStyle = '#33ff66'
    ctx.lineWidth = 2.2
    const nodes: Array<[number, number]> = [
      [-30, -48],
      [28, -48],
      [-32, -16],
      [30, -16],
    ]
    nodes.forEach(([nx, ny]) => {
      ctx.beginPath()
      ctx.moveTo(0, -32)
      ctx.lineTo(nx, ny)
      ctx.stroke()
      ctx.fillStyle = '#33ff66'
      ctx.fillRect(nx - 3.5, ny - 3.5, 7, 7)
    })

    // Central Nuclear Plant Cooling Tower & Reactor Dome
    ctx.fillStyle = '#ffb000'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.0
    ctx.beginPath()
    ctx.moveTo(-9, -20)
    ctx.lineTo(-6, -42)
    ctx.lineTo(6, -42)
    ctx.lineTo(9, -20)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ff2a2a'
    drawFivePointStar(ctx, 0, -31, 5.5, 2.3)
    ctx.fill()

    // MW Callout Tag inside CRT
    ctx.fillStyle = '#33ff66'
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('100 MW GRID', 0, -6)

    // Bottom Left: Thermometer Gauge (<1000°C)
    ctx.fillStyle = PAPER_BG
    ctx.fillRect(-44, 12, 42, 52)
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.2
    ctx.strokeRect(-44, 12, 42, 52)
    ctx.strokeStyle = INK_RED
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-32, 20)
    ctx.lineTo(-32, 48)
    ctx.stroke()
    ctx.fillStyle = INK_RED
    ctx.beginPath()
    ctx.arc(-32, 51, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = INK_RED
    ctx.font = '800 9.5px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('<1000°', -23, 33)
    ctx.fillStyle = INK_BLACK
    ctx.fillText('MAX °C', -23, 49)

    // Bottom Right: Shift Clock (00:00 -> 06:00)
    ctx.fillStyle = PAPER_BG
    ctx.fillRect(2, 12, 42, 52)
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.2
    ctx.strokeRect(2, 12, 42, 52)
    ctx.beginPath()
    ctx.arc(23, 30, 11, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = INK_GREEN
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(23, 30)
    ctx.lineTo(23, 21)
    ctx.moveTo(23, 30)
    ctx.lineTo(30, 30)
    ctx.stroke()
    ctx.fillStyle = INK_NAVY
    ctx.font = '800 9.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('00->06h', 23, 55)
  } else if (kind === 'tear_inspect') {
    // Card 2 (STEP 1: TEAR & INSPECT): ПРАВДА-84 teleprinter with perforated directive sheet
    // being ripped sideways (--> arrow) and inspected under a Magnifying Glass lens over a 5-point Soviet star seal.
    ctx.fillStyle = '#364940'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.5
    ctx.fillRect(-44, 14, 88, 38)
    ctx.strokeRect(-44, 14, 88, 38)

    // Roller platen slot
    ctx.fillStyle = INK_BLACK
    ctx.fillRect(-36, 10, 72, 7)

    // Printer nameplate
    ctx.fillStyle = '#e8dec3'
    ctx.font = '800 10px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ПРАВДА-84', 0, 38)

    // Perforated Directive Sheet emerging and ripping sideways
    ctx.fillStyle = '#f2ead4'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(-32, 12)
    ctx.lineTo(-32, -56)
    ctx.lineTo(22, -56)
    ctx.lineTo(28, 12)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Tractor pin holes along left edge
    ctx.fillStyle = INK_BLACK
    for (let py = -48; py <= 2; py += 12) {
      ctx.fillRect(-29, py, 3.5, 3.5)
    }

    // Text lines on directive
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.0
    ctx.beginPath()
    ctx.moveTo(-20, -44)
    ctx.lineTo(14, -44)
    ctx.moveTo(-20, -34)
    ctx.lineTo(8, -34)
    ctx.moveTo(-20, -24)
    ctx.lineTo(4, -24)
    ctx.stroke()

    // Sideways Tear-Off Arrow (-->)
    ctx.strokeStyle = INK_RED
    ctx.fillStyle = INK_RED
    ctx.lineWidth = 2.8
    ctx.beginPath()
    ctx.moveTo(-26, -6)
    ctx.lineTo(36, -6)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(42, -6)
    ctx.lineTo(31, -12)
    ctx.lineTo(31, 0)
    ctx.closePath()
    ctx.fill()

    // Magnifying Glass Lens over a 5-point Soviet Star Seal
    ctx.fillStyle = '#d9f2e6'
    ctx.strokeStyle = '#8c6d1f'
    ctx.lineWidth = 3.2
    ctx.beginPath()
    ctx.arc(14, -32, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // 5-Point Star Seal inside Magnifier Lens
    ctx.fillStyle = INK_RED
    drawFivePointStar(ctx, 14, -32, 11, 4.5)
    ctx.fill()

    // Magnifier Handle
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 5.0
    ctx.beginPath()
    ctx.moveTo(27, -19)
    ctx.lineTo(43, -3)
    ctx.stroke()

    ctx.fillStyle = INK_NAVY
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('TEAR -> 2x LENS', 0, 65)
  } else if (kind === 'stamp_tube_shred') {
    // Card 3 (STEP 2: STAMP & PNEUMATIC TUBE vs SHREDDER):
    // Left: Wooden Rubber Stamp (ОДОБРЕНО) + vertical Pneumatic Outbox Tube (ИСХОДЯЩИЕ) with upward arrow (^).
    // Right: Mechanical Shredder (УНИЧТОЖИТЕЛЬ) with gears and downward pull-handle (v x5).
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 1.8
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(0, -64)
    ctx.lineTo(0, 52)
    ctx.stroke()
    ctx.setLineDash([])

    // LEFT HALF: Pneumatic Outbox Tube + Upward Arrow + Green Stamp
    ctx.fillStyle = '#c2e8d8'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.4
    ctx.fillRect(-38, -58, 22, 72)
    ctx.strokeRect(-38, -58, 22, 72)

    // Brass collar rings on tube
    ctx.fillStyle = '#b8a46b'
    ctx.fillRect(-40, -46, 26, 6)
    ctx.fillRect(-40, -14, 26, 6)
    ctx.strokeRect(-40, -46, 26, 6)
    ctx.strokeRect(-40, -14, 26, 6)

    // Upward Dispatch Arrow (^) inside tube
    ctx.strokeStyle = INK_GREEN
    ctx.fillStyle = INK_GREEN
    ctx.lineWidth = 2.8
    ctx.beginPath()
    ctx.moveTo(-27, 4)
    ctx.lineTo(-27, -34)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-27, -42)
    ctx.lineTo(-34, -30)
    ctx.lineTo(-20, -30)
    ctx.closePath()
    ctx.fill()

    // Wooden Rubber Stamp (ОДОБРЕНО) at bottom-left
    ctx.fillStyle = INK_GREEN
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.arc(-25, 23, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillRect(-29, 30, 8, 8)
    ctx.fillRect(-39, 38, 28, 9)
    ctx.strokeRect(-39, 38, 28, 9)

    // RIGHT HALF: Shredder Box with Gears + Downward Pull-Handle (v x5)
    ctx.fillStyle = '#3a4a3f'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.4
    ctx.fillRect(6, -30, 32, 54)
    ctx.strokeRect(6, -30, 32, 54)

    // Meshing Gear Wheels inside Shredder
    ctx.strokeStyle = '#e8dec3'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.arc(16, -6, 6.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(28, -6, 6.5, 0, Math.PI * 2)
    ctx.stroke()

    // Red Shredder Pull-Handle & Downward Arrow (v x5)
    ctx.strokeStyle = INK_RED
    ctx.fillStyle = INK_RED
    ctx.lineWidth = 3.0
    ctx.beginPath()
    ctx.moveTo(41, -46)
    ctx.lineTo(41, 14)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(41, -48, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(41, 22)
    ctx.lineTo(35, 11)
    ctx.lineTo(47, 11)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = INK_GREEN
    ctx.font = '800 9.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('^TUBE', -25, 62)
    ctx.fillStyle = INK_RED
    ctx.fillText('vSHREDx5', 24, 62)
  } else if (kind === 'route_mw_water') {
    // Card 4 (STEP 3: ROUTE MW & BALANCE WATER):
    // T-Handle MW Lever pushed up (+MW), linked by an arrow to a 6-Spoke Cooling Wheel
    // and a Vodka Distillery Bottle/Tower + Water Droplet (H2O %).
    // 1. Left: T-Handle MW Lever (+MW)
    ctx.fillStyle = '#23312b'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.4
    ctx.fillRect(-44, -56, 24, 66)
    ctx.strokeRect(-44, -56, 24, 66)
    ctx.fillStyle = INK_BLACK
    ctx.fillRect(-35, -48, 6, 50)
    // T-Handle pushed UP
    ctx.fillStyle = INK_GREEN
    ctx.fillRect(-46, -44, 28, 11)
    ctx.strokeRect(-46, -44, 28, 11)

    // Arrow from Lever to Wheel/Water
    ctx.strokeStyle = INK_NAVY
    ctx.fillStyle = INK_NAVY
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-16, -24)
    ctx.lineTo(0, -24)
    ctx.stroke()

    // 2. Top-Right: 6-Spoke Cooling Wheel
    const wx = 20
    const wy = -34
    ctx.strokeStyle = INK_RED
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.arc(wx, wy, 17, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.2
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3
      ctx.beginPath()
      ctx.moveTo(wx + Math.cos(a) * -15, wy + Math.sin(a) * -15)
      ctx.lineTo(wx + Math.cos(a) * 15, wy + Math.sin(a) * 15)
      ctx.stroke()
    }

    // 3. Bottom-Right: Vodka Bottle/Tower + Water Droplet (H2O %)
    ctx.fillStyle = '#2b4c3f'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(6, 46)
    ctx.lineTo(6, 16)
    ctx.lineTo(11, 8)
    ctx.lineTo(11, -2)
    ctx.lineTo(19, -2)
    ctx.lineTo(19, 8)
    ctx.lineTo(24, 16)
    ctx.lineTo(24, 46)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // Red star label on bottle
    ctx.fillStyle = '#ff2a2a'
    drawFivePointStar(ctx, 15, 28, 5, 2)
    ctx.fill()

    // Water Droplet (H2O)
    ctx.fillStyle = '#1c6ea4'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.0
    ctx.beginPath()
    ctx.moveTo(37, 6)
    ctx.quadraticCurveTo(46, 22, 43, 32)
    ctx.arc(37, 32, 7, 0, Math.PI)
    ctx.quadraticCurveTo(28, 22, 37, 6)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = INK_BLACK
    ctx.font = '800 10px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('+MW -> H2O%', 0, 64)
  } else if (kind === 'levers') {
    // MW Substation Levers: Notched ratchet track, twin chrome arms, Bakelite T-handle, and digital MW readout box (40/40 MW)
    // Digital Nixie Readout Window at Top
    ctx.fillStyle = INK_BLACK
    ctx.strokeStyle = '#8c6d1f'
    ctx.lineWidth = 2.4
    ctx.fillRect(-44, -64, 88, 24)
    ctx.strokeRect(-44, -64, 88, 24)
    ctx.fillStyle = '#33ff66'
    ctx.font = '800 13.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('40/40 MW', 0, -47)

    // Slotted Steel Substation Bay & Notched Ratchet Track
    ctx.fillStyle = '#2a3830'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.5
    ctx.fillRect(-38, -35, 76, 82)
    ctx.strokeRect(-38, -35, 76, 82)

    // Left & Right Engraved Scale Ticks (50..0 MW)
    ctx.strokeStyle = '#e8dec3'
    ctx.lineWidth = 2.0
    for (let ty = -27; ty <= 39; ty += 11) {
      ctx.beginPath()
      ctx.moveTo(-34, ty)
      ctx.lineTo(-22, ty)
      ctx.moveTo(22, ty)
      ctx.lineTo(34, ty)
      ctx.stroke()
    }

    // Center Ratchet Slot & Twin Chrome Lever Arms
    ctx.fillStyle = INK_BLACK
    ctx.fillRect(-10, -29, 20, 70)
    ctx.strokeStyle = '#d8dee2'
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(-6, 36)
    ctx.lineTo(-6, -12)
    ctx.moveTo(6, 36)
    ctx.lineTo(6, -12)
    ctx.stroke()

    // Heavy Bakelite T-Handle Crossbar
    ctx.fillStyle = INK_RED
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.6
    ctx.fillRect(-32, -20, 64, 16)
    ctx.strokeRect(-32, -20, 64, 16)
    ctx.fillStyle = '#e8dec3'
    ctx.fillRect(-20, -14, 40, 4)

    ctx.fillStyle = INK_NAVY
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('6x MW LEVERS', 0, 63)
  } else if (kind === 'wheel') {
    // Cooling Pump / Oil / Helium Handwheels: 6-spoke cast-iron valve wheel with circular rotation arrows (↻) and pressure pipe
    // Horizontal flanged pressure pipe behind wheel
    ctx.fillStyle = '#576657'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.5
    ctx.fillRect(-46, -10, 92, 20)
    ctx.strokeRect(-46, -10, 92, 20)
    // Pipe flanges
    ctx.fillRect(-42, -16, 8, 32)
    ctx.strokeRect(-42, -16, 8, 32)
    ctx.fillRect(34, -16, 8, 32)
    ctx.strokeRect(34, -16, 8, 32)

    // 6-Spoke Cast-Iron Valve Wheel
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 9.0
    ctx.beginPath()
    ctx.arc(0, -6, 31, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = INK_RED
    ctx.lineWidth = 5.5
    ctx.beginPath()
    ctx.arc(0, -6, 31, 0, Math.PI * 2)
    ctx.stroke()

    // 6 Cast-Iron Spokes
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 3.2
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * -28, -6 + Math.sin(a) * -28)
      ctx.lineTo(Math.cos(a) * 28, -6 + Math.sin(a) * 28)
      ctx.stroke()
    }

    // Center Brass Hub
    ctx.fillStyle = '#b8a46b'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(0, -6, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Circular Rotation Arrow above wheel
    ctx.strokeStyle = INK_NAVY
    ctx.fillStyle = INK_NAVY
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.arc(0, -6, 40, -Math.PI * 0.78, -Math.PI * 0.22)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(31, -31)
    ctx.lineTo(22, -37)
    ctx.lineTo(25, -26)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = INK_BLACK
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('CRANK WHEEL', 0, 62)
  } else if (kind === 'az5') {
    // AZ-5 & Boron Injection: Striped flip-up safety cover over the square AZ-5 button alongside the circular BORON plunger
    // Hinged Yellow/Black Hazard Cover flipped UP
    ctx.fillStyle = '#e09f1f'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.5
    ctx.fillRect(-42, -62, 46, 26)
    ctx.strokeRect(-42, -62, 46, 26)
    // Diagonal hazard stripes on cover
    ctx.beginPath()
    ctx.moveTo(-34, -62)
    ctx.lineTo(-42, -46)
    ctx.moveTo(-18, -62)
    ctx.lineTo(-30, -36)
    ctx.moveTo(-2, -62)
    ctx.lineTo(-14, -36)
    ctx.stroke()

    // Square Red AZ-5 Button Housing below flipped cover
    ctx.fillStyle = '#23312b'
    ctx.fillRect(-42, -30, 46, 46)
    ctx.strokeRect(-42, -30, 46, 46)
    ctx.fillStyle = INK_RED
    ctx.fillRect(-34, -22, 30, 30)
    ctx.strokeRect(-34, -22, 30, 30)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 11px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('AZ-5', -19, -3)

    // Right: Circular Green BORON Plunger
    ctx.fillStyle = '#23312b'
    ctx.fillRect(8, -30, 36, 46)
    ctx.strokeRect(8, -30, 36, 46)
    ctx.fillStyle = INK_GREEN
    ctx.beginPath()
    ctx.arc(26, -7, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 9.5px "Courier Prime", monospace'
    ctx.fillText('B-10', 26, -4)

    ctx.fillStyle = INK_BLACK
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.fillText('AZ-5 & BORON', 0, 62)
  } else if (kind === 'octagon') {
    // RBMK Octagonal Bio-Shield: Octagon frame with grid of square channel caps and cursor arrow clicking a flashing hotspot tile
    ctx.fillStyle = '#23312b'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 3.0
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8
      const px = Math.cos(a) * 42
      const py = -8 + Math.sin(a) * 42
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // 5x5 Channel Cap Grid inside Octagon
    for (let gx = -2; gx <= 2; gx++) {
      for (let gy = -2; gy <= 2; gy++) {
        if (Math.abs(gx) === 2 && Math.abs(gy) === 2) continue
        const tx = gx * 11
        const ty = -8 + gy * 11
        const isHot = (gx === 0 && gy === 0) || (gx === 1 && gy === -1)
        ctx.fillStyle = isHot ? '#ff2a2a' : '#33ff66'
        ctx.fillRect(tx - 4.5, ty - 4.5, 9, 9)
        ctx.strokeStyle = INK_BLACK
        ctx.lineWidth = 1.4
        ctx.strokeRect(tx - 4.5, ty - 4.5, 9, 9)
      }
    }

    // Cursor Arrow clicking center flashing hotspot tile
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(4, -4)
    ctx.lineTo(28, 12)
    ctx.lineTo(18, 14)
    ctx.lineTo(23, 26)
    ctx.lineTo(16, 29)
    ctx.lineTo(11, 17)
    ctx.lineTo(4, 23)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = INK_RED
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('CLICK HOT TILE', 0, 62)
  } else if (kind === 'gas') {
    // Bubbler Drain & Sight-Glass: Vertical glass water column with graduation ticks next to downward pull-handle recycling water (-> H2O)
    // Left: Vertical Sight-Glass Water Column with Graduation Ticks
    ctx.fillStyle = '#18241d'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.5
    ctx.fillRect(-40, -58, 30, 96)
    ctx.strokeRect(-40, -58, 30, 96)

    // Cyan/Blue Water Level inside Sight Glass
    ctx.fillStyle = '#1f7ab8'
    ctx.fillRect(-36, -12, 22, 46)

    // Graduation ticks on Sight-Glass
    ctx.strokeStyle = '#e8dec3'
    ctx.lineWidth = 2.0
    for (let gy = -46; gy <= 26; gy += 12) {
      ctx.beginPath()
      ctx.moveTo(-40, gy)
      ctx.lineTo(-28, gy)
      ctx.stroke()
    }

    // Right: 3 Seal Toggles at top + Downward Pull-Handle at bottom
    ;[-2, 14, 30].forEach((tx) => {
      ctx.fillStyle = INK_GREEN
      ctx.strokeStyle = INK_BLACK
      ctx.lineWidth = 1.8
      ctx.fillRect(tx - 4, -56, 8, 16)
      ctx.strokeRect(tx - 4, -56, 8, 16)
    })

    // Spring-Loaded Drain Pull-Handle
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 3.2
    ctx.beginPath()
    ctx.moveTo(16, -28)
    ctx.lineTo(16, 16)
    ctx.stroke()
    ctx.fillStyle = INK_RED
    ctx.fillRect(2, 10, 28, 12)
    ctx.strokeRect(2, 10, 28, 12)

    // Downward Arrow + -> H2O
    ctx.strokeStyle = INK_NAVY
    ctx.fillStyle = INK_NAVY
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(38, -22)
    ctx.lineTo(38, 18)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(38, 26)
    ctx.lineTo(32, 15)
    ctx.lineTo(44, 15)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = INK_GREEN
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('DRAIN -> H2O', 0, 62)
  } else if (kind === 'rheostat') {
    // 50Hz Rheostat: Circular 50.0 Hz dial with scale ticks, center needle, and rotary grip bar
    ctx.fillStyle = '#18241d'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 3.0
    ctx.beginPath()
    ctx.arc(0, -10, 38, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Green safe arc around 12 o'clock (50.0 Hz)
    ctx.strokeStyle = '#33ff66'
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.arc(0, -10, 29, -Math.PI * 0.75, -Math.PI * 0.25)
    ctx.stroke()

    // Scale ticks around perimeter
    ctx.strokeStyle = '#e8dec3'
    ctx.lineWidth = 2.0
    for (let i = -4; i <= 4; i++) {
      const a = -Math.PI / 2 + i * 0.28
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 26, -10 + Math.sin(a) * 26)
      ctx.lineTo(Math.cos(a) * 34, -10 + Math.sin(a) * 34)
      ctx.stroke()
    }

    // Center needle pointing to 12 o'clock (50.0 Hz)
    ctx.strokeStyle = '#ffb000'
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(0, 6)
    ctx.lineTo(0, -34)
    ctx.stroke()

    // Center Bakelite Knob
    ctx.fillStyle = '#b8a46b'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.arc(0, -10, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = INK_BLACK
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('50.0 Hz DIAL', 0, 48)
    ctx.fillStyle = INK_NAVY
    ctx.fillText('< DRAG L/R >', 0, 63)
  } else if (kind === 'breaker') {
    // Knife-Switch Breaker: Dual-blade copper knife switch ([SPACE]) with top contact jaws and insulated crossbar handle
    ctx.fillStyle = '#23312b'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.6
    ctx.fillRect(-38, -60, 76, 98)
    ctx.strokeRect(-38, -60, 76, 98)

    // Top Copper Contact Jaws
    ctx.fillStyle = '#c87636'
    ctx.fillRect(-26, -52, 14, 16)
    ctx.strokeRect(-26, -52, 14, 16)
    ctx.fillRect(12, -52, 14, 16)
    ctx.strokeRect(12, -52, 14, 16)

    // Bottom Pivot Blocks
    ctx.fillRect(-26, 14, 14, 14)
    ctx.strokeRect(-26, 14, 14, 14)
    ctx.fillRect(12, 14, 14, 14)
    ctx.strokeRect(12, 14, 14, 14)

    // Dual Copper Blades engaged UP
    ctx.fillStyle = '#e08b46'
    ctx.fillRect(-23, -44, 8, 62)
    ctx.strokeRect(-23, -44, 8, 62)
    ctx.fillRect(15, -44, 8, 62)
    ctx.strokeRect(15, -44, 8, 62)

    // Red Insulated Crossbar Handle at top
    ctx.fillStyle = INK_RED
    ctx.fillRect(-32, -34, 64, 14)
    ctx.strokeRect(-32, -34, 64, 14)

    ctx.fillStyle = INK_BLACK
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('BREAKER [SPC]', 0, 62)
  } else if (kind === 'piston') {
    // Boron T-Handle Piston Pump: Vertical graduated cylinder with chrome plunger rod and Bakelite T-handle
    ctx.fillStyle = '#23312b'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.6
    ctx.fillRect(-28, -14, 56, 56)
    ctx.strokeRect(-28, -14, 56, 56)

    // Green Boron Tank Level Window
    ctx.fillStyle = INK_GREEN
    ctx.fillRect(-16, -4, 32, 36)
    ctx.strokeRect(-16, -4, 32, 36)

    // Chrome Plunger Shaft
    ctx.fillStyle = '#d8dee2'
    ctx.fillRect(-6, -46, 12, 34)
    ctx.strokeRect(-6, -46, 12, 34)

    // Horizontal Bakelite T-Handle at top
    ctx.fillStyle = INK_RED
    ctx.fillRect(-34, -58, 68, 14)
    ctx.strokeRect(-34, -58, 68, 14)

    // Up/Down Pump Arrows
    ctx.strokeStyle = INK_NAVY
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.moveTo(38, -44)
    ctx.lineTo(38, 18)
    ctx.stroke()

    ctx.fillStyle = INK_BLACK
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PUMP T-HANDLE', 0, 62)
  } else if (kind === 'vent') {
    // Steam Vent (Spring Pull-Lever): Vertical slot with heavy red handle pulled DOWN + steam cloud puffs
    ctx.fillStyle = '#23312b'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.6
    ctx.fillRect(-36, -58, 44, 96)
    ctx.strokeRect(-36, -58, 44, 96)

    // Vertical Lever Slot
    ctx.fillStyle = INK_BLACK
    ctx.fillRect(-19, -48, 10, 76)

    // Lever Arm & Red Handle pulled DOWN
    ctx.fillStyle = INK_RED
    ctx.fillRect(-32, 4, 36, 16)
    ctx.strokeRect(-32, 4, 36, 16)

    // Downward Pull Arrow
    ctx.strokeStyle = INK_RED
    ctx.fillStyle = INK_RED
    ctx.lineWidth = 3.0
    ctx.beginPath()
    ctx.moveTo(26, -44)
    ctx.lineTo(26, 16)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(26, 26)
    ctx.lineTo(18, 12)
    ctx.lineTo(34, 12)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = INK_BLACK
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PULL DOWN', 0, 62)
  } else if (kind === 'ventilation_toggle') {
    // Ventilation (Guarded Metal Toggle): Flip-up hazard guard + heavy chrome toggle bat switch + fan icon
    ctx.fillStyle = '#23312b'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.6
    ctx.fillRect(-38, -56, 76, 94)
    ctx.strokeRect(-38, -56, 76, 94)

    // Yellow Guard U-Bracket
    ctx.strokeStyle = '#d49b27'
    ctx.lineWidth = 4.0
    ctx.beginPath()
    ctx.moveTo(-22, 24)
    ctx.lineTo(-22, -42)
    ctx.lineTo(22, -42)
    ctx.lineTo(22, 24)
    ctx.stroke()

    // Center Toggle Bat Switch flipped UP (ON)
    ctx.fillStyle = '#b8a46b'
    ctx.strokeStyle = INK_BLACK
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(0, 6, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#d8dee2'
    ctx.beginPath()
    ctx.moveTo(-5, 6)
    ctx.lineTo(-9, -30)
    ctx.lineTo(9, -30)
    ctx.lineTo(5, 6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = INK_GREEN
    ctx.font = '800 10.5px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('FLIP UP [ON]', 0, 62)
  }

  ctx.restore()
}

const MANUAL_BODY_FONT_STACK =
  '"Consolas", "Lucida Console", "Segoe UI", Arial, sans-serif'

function drawFittedCardLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  baseSize = 21
): void {
  let size = baseSize
  ctx.font = `bold ${size}px ${MANUAL_BODY_FONT_STACK}`
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= 0.5
    ctx.font = `bold ${size}px ${MANUAL_BODY_FONT_STACK}`
  }
  ctx.fillText(text, x, y, maxWidth)
}

function drawWrappedManualSection(
  ctx: CanvasRenderingContext2D,
  label: string,
  bodyLines: readonly string[],
  x: number,
  topY: number,
  cardRightX: number,
  color: string
): void {
  const maxWidth = cardRightX - x - 18
  const fullText = bodyLines.map((s) => s.trim()).join(' ')
  ctx.fillStyle = color
  ctx.textAlign = 'left'

  for (const fontSize of [21, 20.5, 20, 19.5, 19, 18.5, 18, 17.5]) {
    ctx.font = `bold ${fontSize}px ${MANUAL_BODY_FONT_STACK}`
    const labelW = ctx.measureText(label).width
    const firstLineMaxW = maxWidth - labelW - 6

    const words = fullText.split(/\s+/).filter(Boolean)
    let line1 = ''
    let idx = 0
    while (idx < words.length) {
      const candidate = line1 ? `${line1} ${words[idx]}` : words[idx]
      if (ctx.measureText(candidate).width <= firstLineMaxW || !line1) {
        line1 = candidate
        idx++
      } else {
        break
      }
    }
    const line2 = words.slice(idx).join(' ')
    if (
      ctx.measureText(line1).width <= firstLineMaxW &&
      (!line2 || ctx.measureText(line2).width <= maxWidth)
    ) {
      ctx.fillText(label, x, topY)
      ctx.fillText(line1, x + labelW + 6, topY)
      if (line2) {
        ctx.fillText(line2, x, topY + 22)
      }
      return
    }
  }

  // Fallback with guaranteed maxWidth clamping so zero characters ever touch the right border
  ctx.font = `bold 17.5px ${MANUAL_BODY_FONT_STACK}`
  const labelW = ctx.measureText(label).width
  const firstLineMaxW = Math.max(80, maxWidth - labelW - 6)
  ctx.fillText(label, x, topY)
  drawFittedCardLine(ctx, bodyLines[0] ?? '', x + labelW + 6, topY, firstLineMaxW, 17.5)
  if (bodyLines[1]) {
    drawFittedCardLine(ctx, bodyLines[1], x, topY + 22, maxWidth, 17.5)
  }
}

interface FieldGuideCardSpec {
  icon: ManualIconKind
  badge: string
  useLines: [string, string]
  effectLines: [string, string]
  reactionLines: [string, string]
}

function drawFieldGuideCard(
  ctx: CanvasRenderingContext2D,
  LW: number,
  ry: number,
  card: FieldGuideCardSpec
): void {
  const cardX = 38
  const cardW = LW - 64
  const cardH = 204
  const cardRightX = cardX + cardW

  // Warm Vintage Card Body (#e8dec3) with heavy dark charcoal-black border (#111111)
  ctx.fillStyle = '#e8dec3'
  ctx.fillRect(cardX, ry, cardW, cardH)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 3.0
  ctx.strokeRect(cardX, ry, cardW, cardH)

  // Top Header Badge Bar (Deep Forest Stamp Green #094a20)
  ctx.fillStyle = '#094a20'
  ctx.fillRect(cardX, ry, cardW, 33)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 2.5
  ctx.strokeRect(cardX, ry, cardW, cardH)
  ctx.strokeRect(cardX, ry, cardW, 33)

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  drawFittedCardLine(ctx, card.badge, cardX + 10, ry + 23, cardW - 20, 19.5)

  // Narrowed Left Technical Schematic Box (82px wide, ~21% narrower so text gets +38px horizontal room!)
  const diagW = 82
  ctx.fillStyle = '#ded2b4'
  ctx.fillRect(cardX + 2, ry + 34, diagW - 2, cardH - 36)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(cardX + diagW, ry + 33)
  ctx.lineTo(cardX + diagW, ry + cardH)
  ctx.stroke()

  drawManualSchematicIcon(ctx, cardX + diagW / 2, ry + 116, card.icon)

  // Right Column Structured Breakdown (Clean Left Alignment & Word-Wrap Helper):
  // USE: Deep Navy Blueprint Ink (#0c2854)
  // EFFECT: Deep Forest Stamp Green (#094a20)
  // RISK: Deep Crimson Ink (#7a110a)
  const tx = cardX + diagW + 10

  // 1. HOW TO OPERATE (USE:)
  drawWrappedManualSection(
    ctx,
    'USE:',
    card.useLines,
    tx,
    ry + 56,
    cardRightX,
    '#0c2854'
  )

  // Crisp Dark Divider Rule
  ctx.strokeStyle = '#8c7f65'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(tx, ry + 87)
  ctx.lineTo(cardRightX - 10, ry + 87)
  ctx.stroke()

  // 2. DIRECT ACTION / EFFECT (EFFECT:)
  drawWrappedManualSection(
    ctx,
    'EFFECT:',
    card.effectLines,
    tx,
    ry + 109,
    cardRightX,
    '#094a20'
  )

  // Crisp Dark Divider Rule
  ctx.beginPath()
  ctx.moveTo(tx, ry + 140)
  ctx.lineTo(cardRightX - 10, ry + 140)
  ctx.stroke()

  // 3. COUNTER-REACTION / SIDE EFFECT (RISK:)
  drawWrappedManualSection(
    ctx,
    'RISK:',
    card.reactionLines,
    tx,
    ry + 162,
    cardRightX,
    '#7a110a'
  )
}

/**
 * Draws Komrad Oleg's 6-Page Soviet Control Room Master Folder (`ТЕХНИЧЕСКАЯ ПАПКА БЛОКА №4`):
 * - SECTION I (`pages 1..3`): KGB Forgery Security Manual (`1. SEALS`, `2. FONTS`, `3. COLOURS`)
 * - SECTION II (`pages 4..6`): RBMK Control Panel Operating Manual (`4. UNIT A`, `5. UNIT A-2/B`, `6. GRID [5]`)
 */
export function drawSecurityManualCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  page: ManualPageId,
  scrollY = 0,
  isMagnified = false,
  isHeld = false
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  const LW = 620
  const LH = 775
  ctx.scale(w / LW, h / LH)

  const isRbmkSection = page >= 4

  // Hardcover Folder Leatherette Outer Frame (Maroon for KGB Section I, Deep Bunker Olive for RBMK Section II)
  ctx.fillStyle = isRbmkSection ? '#1f362a' : '#6b1d18'
  ctx.fillRect(0, 0, LW, LH)

  // Warm Vintage Manual Page Cardstock (#e8dec3) shifted slightly right to clear the 3-ring binder holes
  ctx.fillStyle = '#e8dec3'
  ctx.fillRect(14, 14, LW - 28, LH - 28)
  ctx.strokeStyle = '#141210'
  ctx.lineWidth = 3.2
  ctx.strokeRect(20, 20, LW - 40, LH - 40)

  // Left-Edge Punched 3-Ring Binder Holes & Brass Reinforcements on Page
  ;[195, 388, 580].forEach((hy) => {
    ctx.fillStyle = '#b8a46b'
    ctx.beginPath()
    ctx.arc(31, hy, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2b1a12'
    ctx.beginPath()
    ctx.arc(31, hy, 5, 0, Math.PI * 2)
    ctx.fill()
  })

  // Scrollable Viewport Clip Area (y: 132 to LH - 66)
  ctx.save()
  ctx.beginPath()
  ctx.rect(24, 132, LW - 48, LH - 198)
  ctx.clip()
  ctx.translate(0, -scrollY * 1.55)

  if (page === 1) {
    ctx.fillStyle = '#7a110a'
    ctx.font = `bold 21px ${MANUAL_BODY_FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText('1. OFFICIAL SOVIET SEALS & SPECIMENS:', 38, 156)

    const sealRows: Array<{
      type: SealEmblemType
      ink: string
      title: string
      ministry: string
      rule1: string
      rule2: string
      rule3: string
      genuineLabel: string
      fakeLabel: string
      defectKind: 'STAR' | 'ORBIT' | 'SWORD'
    }> = [
      {
        type: 'USSR_STATE_SEAL',
        ink: '#111111',
        title: '1. STATE SEAL (ГЕРБ СССР)',
        ministry: 'Issuer: COUNCIL OF MINISTERS',
        rule1: '✓ 5-PT STAR crest (4/6-pt = Fake)',
        rule2: '✓ СССР • ГОССТАНДАРТ 84 ring',
        rule3: '✗ Shred CCCP-LATIN ring text!',
        genuineLabel: '✓ GENUINE (5★)',
        fakeLabel: '✗ FAKE (4/6★)',
        defectKind: 'STAR',
      },
      {
        type: 'MINSREDMASH_ATOM',
        ink: '#7a110a',
        title: '2. ATOM SEAL (АТОМНЫЙ ЩИТ)',
        ministry: 'Issuer: MINSREDMASH & ATOM EN.',
        rule1: '✓ 2 SOLID ORBITS (Gap = Fake)',
        rule2: '✓ 5-PT STAR & СССР micro-ring',
        rule3: '✓ Rim code №84 / 5★ under lens',
        genuineLabel: '✓ SOLID ORBITS',
        fakeLabel: '✗ BROKEN ORBIT',
        defectKind: 'ORBIT',
      },
      {
        type: 'KGB_SWORD_SHIELD',
        ink: '#7a110a',
        title: '3. KGB SHIELD (ЩИТ И МЕЧ)',
        ministry: 'Issuer: 5TH CHIEF DIRECTORATE',
        rule1: '✓ VERTICAL SWORD on shield axis',
        rule2: '✓ 5-Е УПРАВЛЕНИЕ КГБ СССР ring',
        rule3: '✗ Shred any LANGLEY COPY ring!',
        genuineLabel: '✓ STRAIGHT AXIS',
        fakeLabel: '✗ CROOKED / 4★',
        defectKind: 'SWORD',
      },
    ]

    sealRows.forEach((row, idx) => {
      const ry = 166 + idx * 222
      const cardX = 38
      const cardW = LW - 64
      const cardH = 212
      const cardRightX = cardX + cardW

      ctx.fillStyle = '#e8dec3'
      ctx.fillRect(cardX, ry, cardW, cardH)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 3.0
      ctx.strokeRect(cardX, ry, cardW, cardH)

      // Top Header Strip for Seal Specimen
      ctx.fillStyle = '#7a110a'
      ctx.fillRect(cardX, ry, cardW, 32)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2.5
      ctx.strokeRect(cardX, ry, cardW, 32)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      drawFittedCardLine(ctx, row.title, cardX + 12, ry + 23, cardW - 24, 20.5)

      // Narrowed Left Seal Column (124px wide -> +30px more horizontal width for right text column!)
      const sealColW = 124
      ctx.fillStyle = '#ded2b4'
      ctx.fillRect(cardX + 2, ry + 33, sealColW - 2, cardH - 35)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(cardX + sealColW, ry + 32)
      ctx.lineTo(cardX + sealColW, ry + cardH)
      ctx.stroke()

      drawOfficialSeal(
        ctx,
        cardX + sealColW / 2,
        ry + 121,
        56,
        row.type,
        'NONE',
        row.ink,
        isMagnified || true
      )

      // Right Column Rules + Side-by-Side [✓ GENUINE] vs [✗ FAKE] Visual Callout Boxes
      const tx = cardX + sealColW + 10
      const rightMaxW = cardRightX - tx - 18
      ctx.textAlign = 'left'
      ctx.fillStyle = '#0c2854'
      drawFittedCardLine(ctx, row.ministry, tx, ry + 55, rightMaxW, 20)

      ctx.fillStyle = '#094a20'
      drawFittedCardLine(ctx, row.rule1, tx, ry + 81, rightMaxW, 19.5)
      drawFittedCardLine(ctx, row.rule2, tx, ry + 104, rightMaxW, 19.5)
      ctx.fillStyle = '#7a110a'
      drawFittedCardLine(ctx, row.rule3, tx, ry + 127, rightMaxW, 19.5)

      // Side-by-Side Visual Callout Comparison Boxes (y: ry + 136..204)
      const boxY = ry + 136
      const boxW = 194
      const boxH = 68

      // Left Box: ✓ GENUINE Specimen Callout
      ctx.fillStyle = '#d9eadc'
      ctx.fillRect(tx, boxY, boxW, boxH)
      ctx.strokeStyle = '#094a20'
      ctx.lineWidth = 2.5
      ctx.strokeRect(tx, boxY, boxW, boxH)
      ctx.fillStyle = '#094a20'
      drawFittedCardLine(ctx, row.genuineLabel, tx + 8, boxY + 19, boxW - 14, 16)

      // Right Box: ✗ FAKE Defect Callout
      const fakeX = tx + boxW + 10
      ctx.fillStyle = '#f2d8d5'
      ctx.fillRect(fakeX, boxY, boxW, boxH)
      ctx.strokeStyle = '#7a110a'
      ctx.lineWidth = 2.5
      ctx.strokeRect(fakeX, boxY, boxW, boxH)
      ctx.fillStyle = '#7a110a'
      drawFittedCardLine(ctx, row.fakeLabel, fakeX + 8, boxY + 19, boxW - 14, 16)

      // Draw enlarged visual icons inside the GENUINE vs FAKE comparison boxes
      const iconY = boxY + 45
      if (row.defectKind === 'STAR') {
        // Genuine 5-Point Star vs Fake 4-Point & 6-Point Stars
        ctx.fillStyle = '#094a20'
        drawFivePointStar(ctx, tx + 32, iconY, 16, 6.8)
        ctx.fill()
        drawFittedCardLine(ctx, '5 POINTS', tx + 56, iconY + 5, boxW - 64, 16)

        ctx.fillStyle = '#7a110a'
        drawFourPointFakeStar(ctx, fakeX + 30, iconY, 16, 5.5)
        ctx.fill()
        drawFittedCardLine(ctx, '4/6 PT = CIA', fakeX + 54, iconY + 5, boxW - 62, 16)
      } else if (row.defectKind === 'ORBIT') {
        // Genuine Solid Dual Orbits vs Fake Broken Dashed Orbit
        ctx.strokeStyle = '#094a20'
        ctx.lineWidth = 2.6
        ctx.beginPath()
        ctx.ellipse(tx + 36, iconY, 21, 9, -0.45, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(tx + 36, iconY, 21, 9, 0.45, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#094a20'
        drawFittedCardLine(ctx, '2 CLOSED', tx + 64, iconY + 5, boxW - 72, 16)

        ctx.strokeStyle = '#7a110a'
        ctx.lineWidth = 2.6
        ctx.beginPath()
        ctx.ellipse(fakeX + 36, iconY, 21, 9, -0.45, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.ellipse(fakeX + 36, iconY, 21, 9, 0.45, 0, Math.PI * 1.1)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#7a110a'
        drawFittedCardLine(ctx, 'GAP / DASH', fakeX + 64, iconY + 5, boxW - 72, 16)
      } else {
        // Genuine Vertical Sword & Shield vs Fake Crooked Sword / Latin Ring
        ctx.strokeStyle = '#094a20'
        ctx.lineWidth = 3.0
        ctx.beginPath()
        ctx.moveTo(tx + 32, iconY - 17)
        ctx.lineTo(tx + 32, iconY + 17)
        ctx.moveTo(tx + 22, iconY - 10)
        ctx.lineTo(tx + 42, iconY - 10)
        ctx.stroke()
        ctx.fillStyle = '#094a20'
        drawFittedCardLine(ctx, '90° + СССР', tx + 54, iconY + 5, boxW - 62, 16)

        ctx.strokeStyle = '#7a110a'
        ctx.lineWidth = 3.0
        ctx.beginPath()
        ctx.moveTo(fakeX + 24, iconY - 16)
        ctx.lineTo(fakeX + 40, iconY + 16)
        ctx.moveTo(fakeX + 18, iconY - 8)
        ctx.lineTo(fakeX + 38, iconY - 12)
        ctx.stroke()
        ctx.fillStyle = '#7a110a'
        drawFittedCardLine(ctx, 'LATIN/TILT', fakeX + 52, iconY + 5, boxW - 60, 16)
      }
    })
  } else if (page === 2) {
    const cardX = 38
    const cardW = LW - 64
    const maxW = cardW - 28
    ctx.fillStyle = '#7a110a'
    ctx.font = `bold 21px ${MANUAL_BODY_FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText('2. AUTHORIZED MINISTRIES & FONTS:', cardX, 158)

    // Authorized Ministries Box
    ctx.fillStyle = '#e8dec3'
    ctx.fillRect(cardX, 170, cardW, 224)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 3.0
    ctx.strokeRect(cardX, 170, cardW, 224)

    ctx.fillStyle = '#0c2854'
    ctx.fillRect(cardX, 170, cardW, 32)
    ctx.strokeRect(cardX, 170, cardW, 32)
    ctx.fillStyle = '#ffffff'
    drawFittedCardLine(ctx, 'AUTHORIZED SOVIET ISSUING MINISTRIES:', 50, 192, maxW, 20)

    const validMinistries = [
      '1. MINISTRY OF MEDIUM MACHINE BLDG',
      '2. STATE COMMITTEE ATOMIC ENERGY',
      '3. COUNCIL OF MINISTERS USSR',
      '4. 5TH CHIEF DIRECTORATE',
    ]
    ctx.fillStyle = '#094a20'
    validMinistries.forEach((m, i) => {
      drawFittedCardLine(ctx, `✓ ${m}`, 50, 230 + i * 33, maxW, 21)
    })
    ctx.fillStyle = '#7a110a'
    drawFittedCardLine(ctx, '✗ SHRED ANY OTHER MINISTRY HEADER!', 50, 376, maxW, 21)

    // Approved Fonts Box
    ctx.fillStyle = '#e8dec3'
    ctx.fillRect(cardX, 408, cardW, 200)
    ctx.strokeStyle = '#094a20'
    ctx.lineWidth = 3.0
    ctx.strokeRect(cardX, 408, cardW, 200)
    ctx.fillStyle = '#094a20'
    ctx.fillRect(cardX, 408, cardW, 32)
    ctx.strokeStyle = '#111111'
    ctx.strokeRect(cardX, 408, cardW, 32)
    ctx.fillStyle = '#ffffff'
    drawFittedCardLine(ctx, '✓ APPROVED SOVIET FONTS (ГОСТ 84):', 50, 430, maxW, 20)

    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('GOST_MONO', 22)
    ctx.fillText('• GOST MONO: ДИРЕКТИВА №44', 50, 472, maxW)
    ctx.fillStyle = '#094a20'
    drawFittedCardLine(ctx, '  Monospaced slab; flat terminals.', 50, 502, maxW, 21)

    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('PRAVDA_BLOCK', 22)
    ctx.fillText('• PRAVDA BLOCK: ПРОТОКОЛ ГКАЭ', 50, 546, maxW)
    ctx.fillStyle = '#094a20'
    drawFittedCardLine(ctx, '  Heavy block strokes; zero slant.', 50, 578, maxW, 21)

    // Forbidden Western Fonts Box
    ctx.fillStyle = '#e8dec3'
    ctx.fillRect(cardX, 622, cardW, 204)
    ctx.strokeStyle = '#7a110a'
    ctx.lineWidth = 3.0
    ctx.strokeRect(cardX, 622, cardW, 204)
    ctx.fillStyle = '#7a110a'
    ctx.fillRect(cardX, 622, cardW, 32)
    ctx.strokeStyle = '#111111'
    ctx.strokeRect(cardX, 622, cardW, 32)
    ctx.fillStyle = '#ffffff'
    drawFittedCardLine(ctx, '✗ FORBIDDEN WESTERN FONTS (SHRED!):', 50, 644, maxW, 20)

    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('WESTERN_SERIF', 22)
    ctx.fillText('• WESTERN SERIF: Roman Serif 88', 50, 686, maxW)
    ctx.fillStyle = '#7a110a'
    drawFittedCardLine(ctx, '  Triangular serifs & thin strokes!', 50, 718, maxW, 21)

    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('SLANTED_ITALIC', 22)
    ctx.fillText('• SLANTED / SANS: 12° Italic', 50, 762, maxW)
    ctx.fillStyle = '#7a110a'
    drawFittedCardLine(ctx, '  12° cursive slant or sans curves!', 50, 794, maxW, 21)
  } else if (page === 3) {
    const cardX = 38
    const cardW = LW - 64
    const maxW = cardX + cardW - 104 - 18
    ctx.fillStyle = '#7a110a'
    ctx.font = `bold 21px ${MANUAL_BODY_FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText('3. PAPER STOCK & MINISTRY INKS:', cardX, 158)

    // Paper Stock Swatches
    ctx.fillStyle = '#e8dec3'
    ctx.fillRect(cardX, 170, cardW, 304)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 3.0
    ctx.strokeRect(cardX, 170, cardW, 304)
    ctx.fillStyle = '#0c2854'
    ctx.fillRect(cardX, 170, cardW, 32)
    ctx.strokeRect(cardX, 170, cardW, 32)
    ctx.fillStyle = '#ffffff'
    drawFittedCardLine(ctx, '1. PAPER STOCK TINT SWATCHES:', 50, 192, cardW - 28, 20)

    const papers: Array<{ hex: string; label: string; desc: string; ok: boolean }> = [
      {
        hex: PAPER_COLOR_HEX.STATE_IVORY,
        label: '✓ VALID: State Ivory (#d8d2c0)',
        desc: 'Unbleached Factory No. 4 stock.',
        ok: true,
      },
      {
        hex: PAPER_COLOR_HEX.BUNKER_GREY,
        label: '✓ VALID: Bunker Grey (#bfc4be)',
        desc: 'Recycled security archive card.',
        ok: true,
      },
      {
        hex: PAPER_COLOR_HEX.BLEACHED_WHITE,
        label: '✗ SHRED: Bleached White (#f4f4f6)',
        desc: 'Western optical-brightened bond!',
        ok: false,
      },
      {
        hex: PAPER_COLOR_HEX.YELLOW_PARCHMENT,
        label: '✗ SHRED: Yellow Stock (#e6d8ad)',
        desc: 'Counterfeit chemically aged stock!',
        ok: false,
      },
    ]
    papers.forEach((p, idx) => {
      const py = 214 + idx * 62
      ctx.fillStyle = p.hex
      ctx.fillRect(50, py, 42, 44)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2.6
      ctx.strokeRect(50, py, 42, 44)
      ctx.fillStyle = p.ok ? '#094a20' : '#7a110a'
      drawFittedCardLine(ctx, p.label, 104, py + 18, maxW, 21)
      ctx.fillStyle = '#111111'
      drawFittedCardLine(ctx, p.desc, 104, py + 42, maxW, 20)
    })

    // Ministry Ink Swatches
    ctx.fillStyle = '#e8dec3'
    ctx.fillRect(cardX, 488, cardW, 320)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 3.0
    ctx.strokeRect(cardX, 488, cardW, 320)
    ctx.fillStyle = '#7a110a'
    ctx.fillRect(cardX, 488, cardW, 32)
    ctx.strokeRect(cardX, 488, cardW, 32)
    ctx.fillStyle = '#ffffff'
    drawFittedCardLine(ctx, '2. MANDATORY MINISTRY INKS:', 50, 510, cardW - 28, 20)

    const inks: Array<{ hex: string; title: string; rule: string; ok: boolean }> = [
      {
        hex: INK_COLOR_HEX.SOVIET_CRIMSON,
        title: '✓ Soviet Crimson (#8b1e1e)',
        rule: 'ONLY: MinSredMash & 5th Dir.',
        ok: true,
      },
      {
        hex: INK_COLOR_HEX.BUNKER_OLIVE,
        title: '✓ Bunker Olive (#2d4c2b)',
        rule: 'ONLY: Atomic Energy Committee',
        ok: true,
      },
      {
        hex: INK_COLOR_HEX.PRAVDA_BLACK,
        title: '✓ Pravda Black (#1a1a1a)',
        rule: 'ONLY: Council of Min. & 5th Dir.',
        ok: true,
      },
      {
        hex: INK_COLOR_HEX.CIA_NAVY_BLUE,
        title: '✗ SHRED: Navy Blue / Purple Ink',
        rule: 'Forbidden Western ink = SHRED!',
        ok: false,
      },
    ]
    inks.forEach((ink, idx) => {
      const iy = 532 + idx * 65
      ctx.fillStyle = ink.hex
      ctx.fillRect(50, iy, 42, 44)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2.6
      ctx.strokeRect(50, iy, 42, 44)
      ctx.fillStyle = ink.ok ? '#111111' : '#7a110a'
      drawFittedCardLine(ctx, ink.title, 104, iy + 18, maxW, 21)
      ctx.fillStyle = ink.ok ? '#094a20' : '#7a110a'
      drawFittedCardLine(ctx, ink.rule, 104, iy + 43, maxW, 20)
    })
  } else if (page === 4) {
    // =========================================================================
    // SECTION II — TAB 4 (`4. HOW TO PLAY (SHIFT LOOP)`)
    // =========================================================================
    ctx.fillStyle = '#094a20'
    ctx.font = `bold 21px ${MANUAL_BODY_FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText('4. HOW TO PLAY: 00:00-06:00 SHIFT LOOP', 38, 156)

    const loopCards: FieldGuideCardSpec[] = [
      {
        icon: 'shift_goal_crt',
        badge: '1. SHIFT GOAL & UNIT C MASTER OVERVIEW',
        useLines: [
          'Press Keys [1]-[5] to switch stations;',
          'check [KEY 5] UNIT C for plant balance!',
        ],
        effectLines: [
          'Align GENERATED MWe (black needle) with',
          'NEEDED MWe (red marker) at 50.0 HZ.',
        ],
        reactionLines: [
          'Keep STEAM BAR 60-72 BAR & CORE <580°C.',
          '"Meltdown is Western Rumor" — K.O.M.R.A.D.',
        ],
      },
      {
        icon: 'tear_inspect',
        badge: '2. STEP 1 — TEAR & STAMP ([KEY 4] DESK)',
        useLines: [
          'When PRAVDA-84 prints a directive, drag',
          'paper sideways across the brass tear-bar.',
        ],
        effectLines: [
          'Stamp genuine orders APPROVED, pack into',
          'CAPSULE & launch Pneumatic Tube lever!',
        ],
        reactionLines: [
          'Updates NEEDED MWe on UNIT C & Sector',
          'targets on K.O.M.R.A.D.-84 (85s window).',
        ],
      },
      {
        icon: 'stamp_tube_shred',
        badge: '3. CAUSE & EFFECT: WHY EVERY PANEL MATTERS',
        useLines: [
          'RODS [A-2] -> Fission Heat -> Boils Water',
          'into STEAM BAR -> Spins TURBINE [UNIT C]!',
        ],
        effectLines: [
          'Opening TURBINE THROTTLE gulps live steam;',
          'without more RODS & WATER, BAR collapses!',
        ],
        reactionLines: [
          'Shedding load traps excess steam; without',
          'lowering RODS or VENTING, BAR spikes >78!',
        ],
      },
      {
        icon: 'route_mw_water',
        badge: '4. +MW SURGE vs -MW SHED CHECKLIST',
        useLines: [
          '+MW: 1. RODS UP [A-2] + WATER UP [B] ->',
          '2. Pull Sector Lever [A] (NEEDED MWe) ->',
        ],
        effectLines: [
          '3. Open THROTTLE [C] to match NEEDED MWe!',
          '-MW: 1. Lower Lever [A] & THROTTLE [C] ->',
        ],
        reactionLines: [
          '2. Push RODS IN [A-2] (stop excess boil;',
          'pull STEAM VENT if BAR > 75)!',
        ],
      },
    ]

    loopCards.forEach((c, idx) => {
      drawFieldGuideCard(ctx, LW, 168 + idx * 214, c)
    })
  } else if (page === 5) {
    // =========================================================================
    // SECTION II — TAB 5 (`5. UNIT A (MAIN REACTOR [KEY 1])`)
    // =========================================================================
    ctx.fillStyle = '#094a20'
    ctx.font = `bold 21px ${MANUAL_BODY_FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText('5. UNIT A: MAIN REACTOR PANEL [KEY 1]', 38, 156)

    const unitACards: FieldGuideCardSpec[] = [
      {
        icon: 'levers',
        badge: '[KEY 1] 6 REGIONAL MW SUBSTATION LEVERS',
        useLines: [
          'Drag any of the 6 sector levers (0-250 MW)',
          'or use -25 / +25 MW step buttons.',
        ],
        effectLines: [
          'Routes electrical load to PRIPYAT, KOLKHOZ,',
          'DUGA-1, KGB BUNKER, VODKA & STEEL WORKS.',
        ],
        reactionLines: [
          'Grid holds 50.0 HZ steady — match NEEDED',
          'MWe using TURBINE THROTTLE on UNIT C!',
        ],
      },
      {
        icon: 'wheel',
        badge: '[KEY 1] COOLING PUMPS A & B (WHEEL vs LEVER)',
        useLines: [
          'LEFT WHEEL = Bearing Oil Cool %;',
          'RIGHT LEVER = Primary Coolant Flow %.',
        ],
        effectLines: [
          'Pushes cold water through 1,661 fuel tubes',
          'so boiling does not flash to Steam Voids!',
        ],
        reactionLines: [
          'Keep Bearing <80°C with Left Wheel —',
          'melted bearings come out of your pension!',
        ],
      },
      {
        icon: 'az5',
        badge: '[KEY 1] AZ-5 SCRAM & BORON INJECTION',
        useLines: [
          'AZ-5: Flip red cover & press (>750°C).',
          'BORON: Press green plunger for emergency!',
        ],
        effectLines: [
          'BORON floods core with liquid neutron',
          'poison (-35% Steam Void, cools hotspots).',
        ],
        reactionLines: [
          'WARNING: AZ-5 graphite rod tips cause a',
          '3.5s positive power surge if Void >20%!',
        ],
      },
    ]

    unitACards.forEach((c, idx) => {
      drawFieldGuideCard(ctx, LW, 168 + idx * 214, c)
    })
  } else if (page === 6) {
    // =========================================================================
    // SECTION II — TAB 6 (`6. UNIT A-2 & B (AUX SYSTEMS [KEY 3])`)
    // =========================================================================
    ctx.fillStyle = '#094a20'
    ctx.font = `bold 21px ${MANUAL_BODY_FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText('6. UNIT A-2 & B: CORE, BORON & GAS [KEY 3]', 38, 156)

    const auxCards: FieldGuideCardSpec[] = [
      {
        icon: 'octagon',
        badge: '[UNIT A-2] BORON RODS & XENON-135 ASH',
        useLines: [
          'Boron rods are neutron sponges: pull UP',
          'for more MWt heat; push DOWN to cool.',
        ],
        effectLines: [
          'Fission leaves Xenon-135 ("nuclear ash")',
          'that suffocates neutrons after power cuts.',
        ],
        reactionLines: [
          'When XENON >35%, pull Rods higher (70%+)',
          'or click CYAN core tiles until burned off!',
        ],
      },
      {
        icon: 'wheel',
        badge: '[UNIT A-2] OIL COOLER & STEAM VOIDS',
        useLines: [
          'Turn OIL COOLER wheel (50-65%) on A-2;',
          'match FEEDWATER wheel (55-80%) on UNIT B.',
        ],
        effectLines: [
          'Keeps pump bearings cool and Drum Level',
          'near 0 mm so tubes never boil dry.',
        ],
        reactionLines: [
          'Dry RBMK tubes create Steam Voids (+void',
          'accelerates fission instead of slowing it)!',
        ],
      },
      {
        icon: 'piston',
        badge: '[UNIT A-2] BORON PISTON PUMP',
        useLines: [
          'Drag the horizontal Bakelite T-handle on',
          'UNIT A-2 up and down for full strokes.',
        ],
        effectLines: [
          'Recharges hydraulic BORON TANK (+3.5% per',
          'stroke) used by rods & tile quenching.',
        ],
        reactionLines: [
          'Below 25% Boron Tank, control rods lose',
          'neutron stopping power — keep topped up!',
        ],
      },
      {
        icon: 'wheel',
        badge: '[UNIT B] HELIUM-N2 GAS & SEAL SCRUBBERS',
        useLines: [
          'Flip 3 SEAL SCRUBBERS UP & open HELIUM-N2',
          'handwheel (~50%) on UNIT B.',
        ],
        effectLines: [
          'Blankets hot 550°C graphite in inert gas so',
          'it cannot catch fire in open air.',
        ],
        reactionLines: [
          'Ministry cut our containment dome for a',
          'banner — keep Scrubbers ON or rads leak!',
        ],
      },
      {
        icon: 'gas',
        badge: '[UNIT B] BUBBLER POOL & DRAIN LEVER',
        useLines: [
          'Pull & hold BUBBLER DRAIN lever whenever',
          'BUBBLER POOL rises above 75%.',
        ],
        effectLines: [
          'Pumps condensed steam water back into',
          'PRIPYAT, KOLKHOZ & VODKA reservoirs!',
        ],
        reactionLines: [
          'If Pool hits 95%, STEAM VENT chokes and',
          'cannot relieve overpressure!',
        ],
      },
    ]

    auxCards.forEach((c, idx) => {
      drawFieldGuideCard(ctx, LW, 168 + idx * 214, c)
    })
  } else {
    // =========================================================================
    // SECTION II — TAB 7 (`7. UNIT C: MASTER OVERVIEW & THROTTLE [KEY 5]`)
    // =========================================================================
    ctx.fillStyle = '#094a20'
    ctx.font = `bold 21px ${MANUAL_BODY_FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText('7. UNIT C: MASTER OVERVIEW & THROTTLE [KEY 5]', 38, 156)

    const gridCards: FieldGuideCardSpec[] = [
      {
        icon: 'rheostat',
        badge: '[KEY 5] TRUE 50HZ GRID LOCK & BALANCE',
        useLines: [
          'Once MAIN BREAKER is CLOSED, the regional',
          'grid holds rotor speed locked at 50.0 HZ!',
        ],
        effectLines: [
          'RED MARKER = NEEDED MWe (Quotas + Aux);',
          'BLACK NEEDLE = GENERATED MWe pushed out.',
        ],
        reactionLines: [
          'Deficit browns out sectors; >+60 MWe',
          'surplus overloads grid transformers!',
        ],
      },
      {
        icon: 'wheel',
        badge: '[KEY 5] TURBINE THROTTLE (MWe GAS PEDAL)',
        useLines: [
          'Drag the cast-steel spoked wheel or scroll',
          'mouse wheel (0-100% LED bargraph).',
        ],
        effectLines: [
          'BREAKER OPEN: Set ~18% ONLY to spin free',
          'rotor to 50.0 HZ before locking grid!',
        ],
        reactionLines: [
          'LOCKED 50HZ: Pure Megawatt gas pedal!',
          'Boil steam on A-2/B or BAR drains <25!',
        ],
      },
      {
        icon: 'breaker',
        badge: '[KEY 5] MAIN BREAKER & STEAM VENT',
        useLines: [
          'Pull MAIN BREAKER ([SPACE] or drag) ONLY',
          'inside 49.5-50.5 HZ green sync window!',
        ],
        effectLines: [
          'Magnetically locks onto 50.0 HZ grid.',
          'Pull STEAM VENT left if BAR climbs >75!',
        ],
        reactionLines: [
          'Out-of-sync close or <25 BAR starvation',
          'trips breaker (3 forms in triplicate)!',
        ],
      },
      {
        icon: 'ventilation_toggle',
        badge: '[KEY 5] 4 AUXILIARY SWITCHGEAR TOGGLES',
        useLines: [
          'Keep 2.AVR EXCITER (+8MW), 3.KGB (+10MW)',
          '& 4.CONDENSER VACUUM (+12MW) ON (=30MW)!',
        ],
        effectLines: [
          'AVR aids 50HZ sync & MWe torque; VACUUM',
          'gives blade efficiency & resets trips.',
        ],
        reactionLines: [
          'Flip 1.VENTILATION (+15MW) ON whenever',
          'room radiation rises above 0.5 R/h!',
        ],
      },
    ]

    gridCards.forEach((c, idx) => {
      drawFieldGuideCard(ctx, LW, 168 + idx * 214, c)
    })
  }

  ctx.restore() // end scrollable clip

  // Right-edge Scrollbar Track & Thumb Indicator (y: 136..704)
  const sbX = LW - 26
  const sbY = 136
  const sbH = LH - 206
  ctx.fillStyle = '#2b261f'
  ctx.fillRect(sbX, sbY, 6, sbH)
  const maxScroll = page === 6 ? 360 : page === 4 || page === 7 ? 200 : 120
  const scrollFrac = Math.max(0, Math.min(1, scrollY / maxScroll))
  const thumbH = Math.max(48, Math.floor(sbH * (page === 6 ? 0.45 : 0.65)))
  const thumbY = sbY + Math.floor(scrollFrac * (sbH - thumbH))
  ctx.fillStyle = isRbmkSection ? '#33ff66' : '#ffb000'
  ctx.fillRect(sbX, thumbY, 6, thumbH)

  // =========================================================================
  // FIXED TOP TWO-ROW DOSSIER HEADER & TAB SWITCHER
  // Row 1 (y: 22..72, v: 0.028..0.093): Top Dossier Section Switcher
  //   - Left Half (`u < 0.5`): `[ I. KGB FORGERY GUIDE ]` (Pages 1..3)
  //   - Right Half (`u >= 0.5`): `[ II. RBMK PANEL MANUAL ]` (Pages 4..7)
  // Row 2 (y: 78..120, v: 0.10..0.16): 3 Sub-Tabs (Sec I) or 4 Sub-Tabs (Sec II)
  // =========================================================================
  const secW = Math.floor((LW - 52) / 2)
  const sections: Array<{ id: 'KGB' | 'RBMK'; label: string; active: boolean }> = [
    { id: 'KGB', label: '★ I. KGB FORGERY GUIDE', active: !isRbmkSection },
    { id: 'RBMK', label: '⚙ II. RBMK PANEL MANUAL', active: isRbmkSection },
  ]
  sections.forEach((sec, idx) => {
    const sx = 24 + idx * (secW + 4)
    ctx.fillStyle = sec.active
      ? sec.id === 'KGB'
        ? '#8b1e1e'
        : '#145c26'
      : '#1b221e'
    ctx.fillRect(sx, 22, secW, 48)
    ctx.strokeStyle = sec.active ? '#ffb000' : '#8c7a4b'
    ctx.lineWidth = sec.active ? 3 : 2
    ctx.strokeRect(sx, 22, secW, 48)
    ctx.fillStyle = sec.active ? '#ffffff' : '#b5ad96'
    ctx.font = 'bold 18px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(sec.label, sx + secW / 2, 52)
  })

  // Row 2: Sub-Page Tabs (`1. SEALS | 2. FONTS | 3. COLOURS` or `4. HOW TO PLAY | 5. UNIT A | 6. UNIT A-2/B | 7. GRID [5]`)
  const tabs: Array<{ id: ManualPageId; label: string }> = isRbmkSection
    ? [
        { id: 4, label: '4. HOW TO PLAY' },
        { id: 5, label: '5. UNIT A' },
        { id: 6, label: '6. UNIT A-2/B' },
        { id: 7, label: '7. GRID [5]' },
      ]
    : [
        { id: 1, label: '1. SEALS' },
        { id: 2, label: '2. FONTS' },
        { id: 3, label: '3. COLOURS' },
      ]
  const tabW = Math.floor((LW - 52) / tabs.length)
  tabs.forEach((t, idx) => {
    const tx = 26 + idx * tabW
    const isActive = page === t.id
    ctx.fillStyle = isActive
      ? isRbmkSection
        ? '#145c26'
        : '#8b1e1e'
      : '#b5ad96'
    ctx.fillRect(tx, 76, tabW - 4, 42)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2.5
    ctx.strokeRect(tx, 76, tabW - 4, 42)
    ctx.fillStyle = isActive ? '#ffffff' : '#111111'
    ctx.font = isRbmkSection
      ? 'bold 15px "Courier Prime", monospace'
      : 'bold 19px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(t.label, tx + (tabW - 4) / 2, 103)
  })

  // Fixed Footer Navigation, Handheld Pickup Toggle & Stepped Scroll Bar — Bold 20px-22px
  ctx.fillStyle = '#111111'
  ctx.fillRect(24, LH - 64, LW - 48, 42)
  ctx.fillStyle = '#b8a46b'
  ctx.font = 'bold 21px "VT323", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('[< PREV]  [NEXT >]', 30, LH - 36)

  // Center Interactive Handheld Pickup / Put Down Pill (u: 0.36..0.68 -> x: 224..420)
  ctx.fillStyle = isHeld ? '#6e1a14' : '#145c26'
  ctx.fillRect(224, LH - 60, 196, 34)
  ctx.strokeStyle = isHeld ? '#ffb000' : '#33ff66'
  ctx.lineWidth = 2
  ctx.strokeRect(224, LH - 60, 196, 34)
  ctx.fillStyle = isHeld ? '#ffb000' : '#ffffff'
  ctx.font = 'bold 20px "VT323", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(
    isHeld ? '[▼ PUT DOWN (B)]' : '[▲ PICK UP (B)]',
    322,
    LH - 36
  )

  ctx.textAlign = 'right'
  ctx.fillStyle = '#33ff66'
  ctx.font = 'bold 21px "VT323", monospace'
  ctx.fillText('[▲ UP]  [▼ DOWN]', LW - 30, LH - 36)

  ctx.restore()
}

/**
 * Draws the engraved Soviet "Bitten Beetroot with Hammer & Sickle" ("Надкусанная Свёкла с Серпом и Молотом")
 * emblem for ЭЛЕКТРОНИКА «МЫ-ПАД 84» (WE-PAD 84).
 */
export function drawBittenBeetrootHammerSickleLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 1.0,
  strokeCol = '#39ff14',
  fillCol = '#7a1628'
): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)

  // Beetroot leafy sprouts at top
  ctx.strokeStyle = strokeCol
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(0, -14)
  ctx.quadraticCurveTo(-9, -24, -14, -22)
  ctx.moveTo(0, -14)
  ctx.lineTo(0, -25)
  ctx.moveTo(0, -14)
  ctx.quadraticCurveTo(9, -24, 14, -22)
  ctx.stroke()

  // Beetroot body with a prominent Apple-style bite on the right side + root tail at bottom
  ctx.fillStyle = fillCol
  ctx.strokeStyle = strokeCol
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.moveTo(0, -14)
  ctx.bezierCurveTo(-16, -14, -19, 2, -10, 13)
  ctx.lineTo(0, 24) // Root taproot tip
  ctx.lineTo(9, 13)
  // Bite indentation on right flank
  ctx.arc(15, 0, 7.5, Math.PI * 0.68, -Math.PI * 0.68, true)
  ctx.quadraticCurveTo(10, -14, 0, -14)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Hammer & Sickle inside the beetroot
  ctx.strokeStyle = '#ffd000'
  ctx.lineWidth = 2.4
  // Hammer handle & head
  ctx.beginPath()
  ctx.moveTo(-6, 9)
  ctx.lineTo(5, -5)
  ctx.moveTo(1, -7)
  ctx.lineTo(8, -2)
  ctx.stroke()
  // Sickle arc
  ctx.beginPath()
  ctx.arc(-1, 1, 7.5, -Math.PI * 0.65, Math.PI * 0.55)
  ctx.stroke()

  ctx.restore()
}

/**
 * Draws the high-contrast phosphor screen of ЭЛЕКТРОНИКА «МЫ-ПАД 84» (WE-PAD 84) at 1024x1280:
 * +50% larger crisp laptop-readable fonts (34px-44px, max ~38-40 chars/line, generous line spacing, zero stroke bleed).
 * Tab 1 (`[1] GUIDE`) renders 3 clean visual cards:
 *   1. `STEP & PANEL KEY` + bold `ACTION`
 *   2. `WHY & GAUGE EFFECT` (2 crisp lines)
 *   3. `COMRADE VOLKOV` (punchy 1984 Soviet bureaucracy humor)
 */
export function drawWePad84ScreenCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  payload: WePadTelemetryPayload,
  scrollY = 0
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  const LW = 1024
  const LH = 1280
  ctx.scale(w / LW, h / LH)

  const activeTab = payload.activeTab

  // Deep Phosphor-Black CRT Screen Background & Crisp Outer Frame
  ctx.fillStyle = '#030d06'
  ctx.fillRect(0, 0, LW, LH)
  ctx.strokeStyle = '#39ff14'
  ctx.lineWidth = 4
  ctx.strokeRect(10, 10, LW - 20, LH - 20)

  // =========================================================================
  // ZONE 1 (TOP): CRISP MASTER TELEMETRY BANNER (34px) + 6 LARGE TABS (32px)
  // =========================================================================
  ctx.fillStyle = '#082112'
  ctx.fillRect(20, 20, LW - 40, 66)
  ctx.strokeStyle = '#28b862'
  ctx.lineWidth = 2.5
  ctx.strokeRect(20, 20, LW - 40, 66)

  const genVal = Math.round(payload.generatedMWe)
  const needVal = Math.round(payload.neededMWe)
  const barVal = Math.round(payload.drumPressure)
  const hzStr = (payload.gridHz || 0).toFixed(1)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#00f0ff'
  ctx.font = 'bold 34px "Consolas", "Courier Prime", monospace'
  const teleLine = `GEN:${genVal}/${needVal} MWe | ${barVal} BAR | ${hzStr} HZ`
  ctx.fillText(teleLine, LW / 2, 64, LW - 56)

  // 6 Chapter Tab Buttons (2 rows x 3 columns, y = 96..234, +50% larger 32px font)
  const tabSpecs: Array<{ id: WePadTabId; label: string }> = [
    { id: 1, label: '[1] GUIDE' },
    { id: 2, label: '[2] TELEM' },
    { id: 3, label: '[3] STARTUP' },
    { id: 4, label: '[4] ORDERS' },
    { id: 5, label: '[5] ALARMS' },
    { id: 6, label: '[6] MANUAL' },
  ]
  const colW = Math.floor((LW - 52) / 3)
  tabSpecs.forEach((tab, idx) => {
    const col = idx % 3
    const row = Math.floor(idx / 3)
    const tx = 20 + col * (colW + 6)
    const ty = 96 + row * 68
    const isSel = activeTab === tab.id
    ctx.fillStyle = isSel ? '#196b30' : '#091d11'
    ctx.fillRect(tx, ty, colW, 60)
    ctx.strokeStyle = isSel ? '#ffd000' : '#28b862'
    ctx.lineWidth = isSel ? 4 : 2
    ctx.strokeRect(tx, ty, colW, 60)
    ctx.fillStyle = isSel ? '#ffffff' : '#8ce8a4'
    ctx.font = 'bold 32px "Consolas", "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(tab.label, tx + colW / 2, ty + 41, colW - 14)
  })

  // =========================================================================
  // ZONE 2 (MIDDLE — y = 244..1192): 3 CLEAN CARDS (TAB 1) OR BIG REFERENCE
  // =========================================================================
  const vpX = 20
  const vpY = 244
  const vpW = LW - 40
  const vpH = 948

  ctx.save()
  ctx.beginPath()
  ctx.rect(vpX, vpY, vpW, vpH)
  ctx.clip()

  if (activeTab === 1) {
    const isCompletedShift = payload.tutorialPhase === 'COMPLETED'
    const latestLiveMsg =
      isCompletedShift && payload.chatLog.length > 0
        ? payload.chatLog[payload.chatLog.length - 1]
        : null

    // -----------------------------------------------------------------------
    // CARD 1 (y = 248..556): STEP & PANEL KEY + GIANT BOLD ACTION
    // -----------------------------------------------------------------------
    const c1Y = vpY + 4
    const c1H = 304
    ctx.fillStyle = '#171504'
    ctx.fillRect(vpX + 4, c1Y, vpW - 8, c1H)
    ctx.strokeStyle = '#ffd000'
    ctx.lineWidth = 4
    ctx.strokeRect(vpX + 4, c1Y, vpW - 8, c1H)

    // Top Panel Key Ribbon
    ctx.fillStyle = '#ffd000'
    ctx.fillRect(vpX + 4, c1Y, vpW - 8, 62)
    ctx.fillStyle = '#081008'
    ctx.textAlign = 'left'
    ctx.font = 'bold 34px "Consolas", "Courier Prime", monospace'
    const panelKeyText =
      payload.tutorialPanelKey || 'GO TO: [KEY 5] UNIT C'
    ctx.fillText(panelKeyText, vpX + 22, c1Y + 43, vpW - 44)

    // Step Subtitle
    ctx.fillStyle = '#39ff14'
    ctx.font = 'bold 30px "Consolas", "Courier Prime", monospace'
    const stepTitle = payload.tutorialHeader.replace(/^>>\s*/, '')
    ctx.fillText(stepTitle, vpX + 24, c1Y + 110, vpW - 48)

    // Bold Action Command (40px crisp font, max 3 lines, generous 48px line height)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 40px "Consolas", "Courier Prime", monospace'
    const actionRaw =
      payload.tutorialActionLine || payload.tutorialBody || 'HOLD 50.0 HZ'
    const actionWrapped = wrapCanvasText(ctx, actionRaw, vpW - 48).slice(0, 3)
    actionWrapped.forEach((ln, idx) => {
      ctx.fillText(ln, vpX + 24, c1Y + 168 + idx * 48, vpW - 48)
    })

    // -----------------------------------------------------------------------
    // CARD 2 (y = 570..864): WHY & GAUGE EFFECT (2 CRISP CAUSE-EFFECT LINES)
    // -----------------------------------------------------------------------
    const c2Y = c1Y + c1H + 18
    const c2H = 292
    ctx.fillStyle = '#051a18'
    ctx.fillRect(vpX + 4, c2Y, vpW - 8, c2H)
    ctx.strokeStyle = '#00f0ff'
    ctx.lineWidth = 3.5
    ctx.strokeRect(vpX + 4, c2Y, vpW - 8, c2H)

    ctx.fillStyle = '#00f0ff'
    ctx.fillRect(vpX + 4, c2Y, vpW - 8, 56)
    ctx.fillStyle = '#03100e'
    ctx.textAlign = 'left'
    ctx.font = 'bold 32px "Consolas", "Courier Prime", monospace'
    ctx.fillText('WHY & GAUGE EFFECT', vpX + 22, c2Y + 39, vpW - 44)

    const whyPair = payload.tutorialWhyLines ?? [
      'Rods make heat -> heat boils steam.',
      'Watch POWER BALANCE on [KEY 5] UNIT C.',
    ]
    ctx.font = 'bold 34px "Consolas", "Courier Prime", monospace'
    let whyCursorY = c2Y + 106
    whyPair.forEach((item, wIdx) => {
      ctx.fillStyle = wIdx === 0 ? '#ffffff' : '#7ef9ff'
      const lines = wrapCanvasText(ctx, `• ${item}`, vpW - 48).slice(0, 2)
      lines.forEach((ln) => {
        ctx.fillText(ln, vpX + 22, whyCursorY, vpW - 44)
        whyCursorY += 44
      })
      whyCursorY += 10
    })

    // -----------------------------------------------------------------------
    // CARD 3 (y = 880..1186): COMRADE VOLKOV // SOVIET SATIRE & DISPATCH
    // -----------------------------------------------------------------------
    const c3Y = c2Y + c2H + 18
    const c3H = 304
    ctx.fillStyle = '#091f10'
    ctx.fillRect(vpX + 4, c3Y, vpW - 8, c3H)
    ctx.strokeStyle = '#39ff14'
    ctx.lineWidth = 3.5
    ctx.strokeRect(vpX + 4, c3Y, vpW - 8, c3H)

    ctx.fillStyle = '#196b30'
    ctx.fillRect(vpX + 4, c3Y, vpW - 8, 56)
    ctx.fillStyle = '#ffe600'
    ctx.textAlign = 'left'
    ctx.font = 'bold 31px "Consolas", "Courier Prime", monospace'
    const card3Header =
      isCompletedShift && latestLiveMsg
        ? `DISPATCH // ${latestLiveMsg.sender} [${latestLiveMsg.timestamp}]`
        : 'COMRADE VOLKOV // SHIFT BRIEFING'
    ctx.fillText(card3Header, vpX + 22, c3Y + 39, vpW - 44)

    const quoteSource =
      isCompletedShift && latestLiveMsg && scrollY > 20
        ? payload.chatLog[
            Math.max(
              0,
              payload.chatLog.length - 1 - Math.floor(scrollY / 40)
            )
          ]?.text ?? payload.tutorialVolkovQuote
        : isCompletedShift && latestLiveMsg && !payload.tutorialHeader.startsWith('>> ACTIVE')
          ? latestLiveMsg.text
          : payload.tutorialVolkovQuote || payload.tutorialBody

    ctx.fillStyle = '#c8ffd4'
    ctx.font = 'bold 33px "Consolas", "Courier Prime", monospace'
    const quoteLines = wrapCanvasText(
      ctx,
      `"${quoteSource.replace(/^"|"$/g, '')}"`,
      vpW - 48
    ).slice(0, 4)
    quoteLines.forEach((ln, qIdx) => {
      ctx.fillText(ln, vpX + 22, c3Y + 106 + qIdx * 46, vpW - 44)
    })
  } else if (activeTab === 2) {
    // -----------------------------------------------------------------------
    // TAB 2: [2] TELEM — GIANT PLANT OVERVIEW READOUT (MATCHES UNIT C)
    // -----------------------------------------------------------------------
    const deltaMW = Math.round(payload.generatedMWe - payload.neededMWe)
    const deltaSign = deltaMW >= 0 ? '+' : ''
    const rows: Array<{ label: string; val: string; col: string }> = [
      {
        label: 'GENERATED MWe',
        val: payload.gridConnected ? `${Math.round(payload.generatedMWe)} MWe` : '0 MWe (OPEN)',
        col: payload.gridConnected ? '#39ff14' : '#ffd000',
      },
      {
        label: 'NEEDED MWe',
        val: `${Math.round(payload.neededMWe)} (${deltaSign}${deltaMW})`,
        col: Math.abs(deltaMW) <= 20 && payload.gridConnected ? '#39ff14' : '#ffd000',
      },
      {
        label: 'GRID FREQ',
        val: `${(payload.gridHz || 0).toFixed(1)} HZ (${Math.round(payload.rpm)} RPM)`,
        col: Math.abs((payload.gridHz || 0) - 50) <= 0.4 ? '#39ff14' : '#ff5555',
      },
      {
        label: 'STEAM DRUM',
        val: `${Math.round(payload.drumPressure)} BAR / ${Math.round(payload.drumWaterLevel)} mm`,
        col: payload.drumPressure >= 58 && payload.drumPressure <= 74 ? '#00f0ff' : '#ffd000',
      },
      {
        label: 'BORON RODS',
        val: `${Math.round(payload.controlRods * 100)}% (${Math.round(payload.thermalPower)} MWt)`,
        col: '#39ff14',
      },
      {
        label: 'XENON-135 ASH',
        val: `${Math.round(payload.xenonPoisoning)}%`,
        col: payload.xenonPoisoning > 35 ? '#ffd000' : '#00f0ff',
      },
      {
        label: 'STEAM VOID',
        val: `${Math.round(payload.voidFraction)}%`,
        col: payload.voidFraction > 28 ? '#ff5555' : '#39ff14',
      },
    ]

    rows.forEach((r, idx) => {
      const ry = vpY + 8 + idx * 132
      ctx.fillStyle = '#071c10'
      ctx.fillRect(vpX + 4, ry, vpW - 8, 118)
      ctx.strokeStyle = r.col
      ctx.lineWidth = 3
      ctx.strokeRect(vpX + 4, ry, vpW - 8, 118)

      ctx.textAlign = 'left'
      ctx.fillStyle = '#9be8b0'
      ctx.font = 'bold 32px "Consolas", "Courier Prime", monospace'
      ctx.fillText(r.label, vpX + 24, ry + 44)

      ctx.textAlign = 'right'
      ctx.fillStyle = r.col
      ctx.font = 'bold 42px "Consolas", "Courier Prime", monospace'
      ctx.fillText(r.val, vpX + vpW - 24, ry + 94)
    })
  } else {
    // -----------------------------------------------------------------------
    // TABS 3–6: LARGE CRISP CARDS (+50% FONT SIZE: 34px-38px, ZERO CLUTTER)
    // -----------------------------------------------------------------------
    const drawBigGuideCards = (
      banner: string,
      cards: Array<{ head: string; line1: string; line2: string }>,
      accent: string
    ) => {
      ctx.fillStyle = accent
      ctx.fillRect(vpX + 4, vpY + 4, vpW - 8, 64)
      ctx.fillStyle = '#041007'
      ctx.textAlign = 'left'
      ctx.font = 'bold 34px "Consolas", "Courier Prime", monospace'
      ctx.fillText(banner, vpX + 22, vpY + 48, vpW - 44)

      cards.forEach((c, idx) => {
        const cy = vpY + 84 + idx * 214
        ctx.fillStyle = '#071a0f'
        ctx.fillRect(vpX + 4, cy, vpW - 8, 198)
        ctx.strokeStyle = accent
        ctx.lineWidth = 3
        ctx.strokeRect(vpX + 4, cy, vpW - 8, 198)

        ctx.fillStyle = '#ffd000'
        ctx.font = 'bold 33px "Consolas", "Courier Prime", monospace'
        ctx.fillText(c.head, vpX + 22, cy + 46, vpW - 44)

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 32px "Consolas", "Courier Prime", monospace'
        ctx.fillText(c.line1, vpX + 22, cy + 104, vpW - 44)

        ctx.fillStyle = '#8ef6ff'
        ctx.fillText(c.line2, vpX + 22, cy + 158, vpW - 44)
      })
    }

    if (activeTab === 3) {
      drawBigGuideCards(
        'COLD STARTUP // 4 STEPS TO 600 MWe',
        [
          {
            head: '1. [KEY 3] UNIT B: GAS & PUMPS',
            line1: 'Flip 3 SCRUBBERS + 4 PUMPS UP;',
            line2: 'turn HELIUM-N2 & FEEDWATER ~55%.',
          },
          {
            head: '2. [KEY 3] UNIT A-2: OIL & RODS',
            line1: 'Open OIL COOLER ~55%; flip AUTO ON',
            line2: '& raise BORON RODS to 55% (65 BAR).',
          },
          {
            head: '3. [KEY 5] UNIT C: SPIN & LOCK 50HZ',
            line1: 'OPEN ONLY: ~18% wheel -> 50.0 HZ,',
            line2: 'then pull MAIN BREAKER [SPACE]!',
          },
          {
            head: '4. [KEY 5 & 1]: MWe GAS PEDAL',
            line1: 'Grid holds 50HZ! Open THROTTLE ~60%',
            line2: '& set 6 Levers [KEY 1] to 100 MW!',
          },
        ],
        '#39ff14'
      )
    } else if (activeTab === 4) {
      drawBigGuideCards(
        '+MW SURGE vs -MW SHED ORDERS',
        [
          {
            head: 'ONCE LOCKED = MWe GAS PEDAL!',
            line1: 'Grid holds 50.0 HZ steady! Throttle',
            line2: 'pushes MWe to match NEEDED MWe.',
          },
          {
            head: '+MW ORDER (NEED MORE POWER):',
            line1: '1. RODS UP [A-2] + WATER UP [B]',
            line2: '2. Lever [A] -> 3. Open THROTTLE [C]!',
          },
          {
            head: '-MW ORDER (SHED GRID LOAD):',
            line1: '1. Lower Lever [A] & THROTTLE [C]',
            line2: '2. Push RODS IN [A-2] (VENT >75 BAR)!',
          },
          {
            head: 'TEAR & STAMP AT [KEY 4] DESK:',
            line1: 'Tear Pravda order -> Stamp APPROVED',
            line2: '-> Pack Capsule -> Pull Tube Lever!',
          },
        ],
        '#ffd000'
      )
    } else if (activeTab === 5) {
      drawBigGuideCards(
        'REACTOR ALARMS & QUICK CURES',
        [
          {
            head: 'XENON-135 ("NUCLEAR ASH" >35%):',
            line1: 'Suffocates neutrons after power cuts!',
            line2: 'CURE: Pull RODS 70%+ or click CYAN.',
          },
          {
            head: 'STEAM VOIDS ("BOILING DRY" >28%):',
            line1: 'Bubbles speed up RBMK fission!',
            line2: 'CURE: Open FEEDWATER [B] & PUMPS [A].',
          },
          {
            head: 'HIGH STEAM BAR (>76 BAR):',
            line1: 'Boiler making more steam than used!',
            line2: 'CURE: Pull STEAM VENT [C] & cut RODS.',
          },
          {
            head: 'HOT PUMP BEARINGS (>80°C):',
            line1: 'Melted bearings come off your pension!',
            line2: 'CURE: Open OIL COOLER wheel [A-2/A].',
          },
        ],
        '#ff5555'
      )
    } else {
      drawBigGuideCards(
        'SOVIET RBMK-1000 PHYSICS NOTES',
        [
          {
            head: 'NO CONTAINMENT DOME ([KEY 3] B):',
            line1: 'Ministry bought a banner instead —',
            line2: 'keep He-N2 & 3 Scrubbers ON always!',
          },
          {
            head: 'BORON RODS ([KEY 3] UNIT A-2):',
            line1: 'Neutron sponges: UP = hotter steam,',
            line2: 'DOWN = cooler core. Keep Boron >25%!',
          },
          {
            head: 'TRUE 50HZ GRID LOCK ([KEY 5] C):',
            line1: 'Tune 50HZ ONLY when Breaker OPEN;',
            line2: 'locked = Throttle is pure MWe pedal!',
          },
          {
            head: 'SCROLL WHEEL SHORTCUT:',
            line1: 'Scroll mouse wheel on ANY wheel or',
            line2: 'lever (hold SHIFT for 1% fine trim)!',
          },
        ],
        '#00f0ff'
      )
    }
  }

  ctx.restore() // end Zone 2 clip

  // =========================================================================
  // ZONE 3 (BOTTOM): CRISP 30PX FOOTER CONTROLS IN 100% ENGLISH
  // =========================================================================
  ctx.strokeStyle = '#28b862'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(24, 1202)
  ctx.lineTo(LW - 24, 1202)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffd000'
  ctx.font = 'bold 30px "Consolas", "Courier Prime", monospace'
  ctx.fillText(
    '[1-6]: TABS  |  [TAB]: CLOSE ZOOM  |  [E]: PUT ON DESK',
    LW / 2,
    1248,
    LW - 40
  )

  ctx.restore()
}

export function drawTrue2xOpticalLensCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lensX: number,
  lensZ: number,
  docs: DeskDocument[],
  manualPage: ManualPageId,
  manualScrollY: number,
  manualBounds: { x: number; z: number; width: number; height: number }
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false

  // Circular lens background (Green Desk Mat under 2x magnification)
  ctx.fillStyle = '#18211b'
  ctx.fillRect(0, 0, w, h)

  // Subtle desk mat grid lines at 2x
  ctx.strokeStyle = 'rgba(184, 164, 107, 0.14)'
  ctx.lineWidth = 1
  for (let gx = 0; gx < w; gx += 32) {
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, h)
    ctx.stroke()
  }
  for (let gz = 0; gz < h; gz += 32) {
    ctx.beginPath()
    ctx.moveTo(0, gz)
    ctx.lineTo(w, gz)
    ctx.stroke()
  }

  // Check if the lens is over the 3-Page KGB Security Manual
  const manLeft = manualBounds.x - manualBounds.width / 2
  const manTop = manualBounds.z - manualBounds.height / 2
  if (
    lensX >= manLeft - 0.12 &&
    lensX <= manLeft + manualBounds.width + 0.12 &&
    lensZ >= manTop - 0.12 &&
    lensZ <= manTop + manualBounds.height + 0.12
  ) {
    const u = (lensX - manLeft) / manualBounds.width
    const v = (lensZ - manTop) / manualBounds.height
    ctx.save()
    // 2x optical magnification centered on (u * 512, v * 640)
    ctx.translate(w / 2, h / 2)
    ctx.scale(2.0, 2.0)
    ctx.translate(-u * 512, -v * 640)
    drawSecurityManualCanvas(ctx, 512, 640, manualPage, manualScrollY, true)
    ctx.restore()
  }

  // Check overlapping Desk Directives (in z-order from back to front)
  for (const doc of docs) {
    if (doc.status !== 'desk') continue
    const docW = doc.isExpanded ? PAPER_EXPANDED_W_3D : PAPER_COMPACT_W_3D
    const docH = doc.isExpanded ? PAPER_EXPANDED_H_3D : PAPER_COMPACT_H_3D
    const left = doc.x - docW / 2
    const top = doc.z - docH / 2
    if (
      lensX >= left - 0.12 &&
      lensX <= left + docW + 0.12 &&
      lensZ >= top - 0.12 &&
      lensZ <= top + docH + 0.12
    ) {
      const u = (lensX - left) / docW
      const v = (lensZ - top) / docH
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.scale(2.0, 2.0)
      if (doc.isExpanded) {
        ctx.translate(-u * 512, -v * 640)
        drawFullDirectiveSheetCanvas(ctx, 512, 640, doc, true)
      } else {
        ctx.translate(-u * 256, -v * 320)
        drawCompactTeletypeSlipCanvas(ctx, 256, 320, doc)
      }
      ctx.restore()
    }
  }

  // Optical Crosshair & Brass Rim Inner Shadow
  ctx.strokeStyle = 'rgba(13, 17, 15, 0.28)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(w / 2 - 24, h / 2)
  ctx.lineTo(w / 2 + 24, h / 2)
  ctx.moveTo(w / 2, h / 2 - 24)
  ctx.lineTo(w / 2, h / 2 + 24)
  ctx.stroke()

  ctx.strokeStyle = '#b8a46b'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}

/**
 * Draws the Top Status & Forensic Verdict Header Ticker on the raised rear desk shelf.
 */
export function drawDeskHeaderTickerCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  commendations: number,
  citations: number,
  lastVerdict: InspectionVerdict | null,
  isMuted = false,
  isFreeLookMode = false,
  tutorialPrompt: string | null = null,
  diagnosticHint: string | null = null
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false

  const activeBannerPrompt = diagnosticHint ?? tutorialPrompt
  const isDrillMode = Boolean(tutorialPrompt && !diagnosticHint)

  ctx.fillStyle = '#09120e'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = activeBannerPrompt ? '#ffb000' : '#b8a46b'
  ctx.lineWidth = 4
  ctx.strokeRect(4, 4, w - 8, h - 8)

  // Left Title in Phosphor Green / Brass (or Training Drill / Diagnostic Badge)
  ctx.fillStyle = activeBannerPrompt ? '#ffb000' : '#33ff66'
  ctx.font = 'bold 17px "Courier Prime", monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    isDrillMode
      ? 'УЧЕБНАЯ ТРЕВОГА'
      : diagnosticHint
        ? 'ТАБЛО ТРЕВОГИ'
        : 'ПУНКТ №4 // DESK',
    16,
    28
  )

  // Diegetic Camera Mode Pill ([L-CTRL] РЕЖИМ: КУРСОР / ОБЗОР)
  ctx.fillStyle = isFreeLookMode ? '#3b280b' : '#112e22'
  ctx.fillRect(210, 10, 344, 34)
  ctx.strokeStyle = isFreeLookMode ? '#ffb000' : '#33ff66'
  ctx.lineWidth = 2
  ctx.strokeRect(210, 10, 344, 34)
  ctx.fillStyle = isFreeLookMode ? '#ffb000' : '#33ff66'
  ctx.font = 'bold 14px "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(
    isDrillMode
      ? '[BACKSPACE] SKIP TRAINING DRILL'
      : isFreeLookMode
        ? '[L-CTRL] РЕЖИМ: ОБЗОР (FREE-LOOK)'
        : '[L-CTRL] РЕЖИМ: КУРСОР (CURSOR)',
    382,
    28
  )

  // Mute Status Pill ([M] AUDIO)
  ctx.fillStyle = isMuted ? '#8b1e1e' : '#1b4728'
  ctx.fillRect(w - 504, 10, 118, 34)
  ctx.strokeStyle = isMuted ? '#ff2a2a' : '#33ff66'
  ctx.lineWidth = 2
  ctx.strokeRect(w - 504, 10, 118, 34)
  ctx.fillStyle = isMuted ? '#ff9999' : '#33ff66'
  ctx.font = 'bold 14px "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(isMuted ? '[M] MUTED' : '[M] AUDIO ON', w - 445, 28)

  // Right Commendations & Citations Pills
  ctx.fillStyle = '#143820'
  ctx.fillRect(w - 376, 10, 176, 34)
  ctx.strokeStyle = '#33ff66'
  ctx.strokeRect(w - 376, 10, 176, 34)
  ctx.fillStyle = '#33ff66'
  ctx.font = 'bold 15px "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`COMMENDATIONS: ${commendations}`, w - 288, 28)

  ctx.fillStyle = '#3b1111'
  ctx.fillRect(w - 190, 10, 174, 34)
  ctx.strokeStyle = '#ff2a2a'
  ctx.strokeRect(w - 190, 10, 174, 34)
  ctx.fillStyle = '#ff5555'
  ctx.fillText(`CITATIONS: ${citations}`, w - 103, 28)

  // Bottom Verdict / Training Drill / Contextual Diagnostic Hint Ticker Row
  const tickerBg = activeBannerPrompt
    ? '#2b1e08'
    : !lastVerdict
      ? '#0d1a14'
      : lastVerdict.pending
        ? '#2b220d'
        : lastVerdict.correct
          ? '#0f2e19'
          : '#3b0f0f'
  ctx.fillStyle = tickerBg
  ctx.fillRect(14, 50, w - 28, 36)
  const tickerColor = activeBannerPrompt
    ? '#ffdd55'
    : !lastVerdict
      ? '#33ff66'
      : lastVerdict.pending
        ? '#ffb000'
        : lastVerdict.correct
          ? '#33ff66'
          : '#ff2a2a'
  ctx.strokeStyle = activeBannerPrompt ? '#ffb000' : tickerColor
  ctx.lineWidth = 2
  ctx.strokeRect(14, 50, w - 28, 36)

  ctx.fillStyle = tickerColor
  ctx.textAlign = 'center'
  const text = activeBannerPrompt
    ? activeBannerPrompt
    : lastVerdict
      ? `${lastVerdict.docId} [${lastVerdict.decision}]: ${lastVerdict.reason}`
      : 'INSPECT SEALS (2x ZOOM), FONTS/MINISTRIES & COLOURS IN KGB MANUAL BEFORE DISPATCHING'

  let fontPx = activeBannerPrompt ? 14 : 16
  ctx.font = `bold ${fontPx}px "Courier Prime", monospace`
  while (ctx.measureText(text).width > w - 44 && fontPx > 11) {
    fontPx -= 0.5
    ctx.font = `bold ${fontPx}px "Courier Prime", monospace`
  }
  ctx.fillText(text, w / 2, 69)

  ctx.restore()
}

/**
 * Draws a 16-Color Bayer-Dithered pixel face for Chief Engineer Komrad Kristianov's Bobblehead!
 * Features thick dark-rimmed nuclear engineer glasses, intense caffeinated night-shift eyes,
 * and reactor-shift stubble.
 */
export function drawKristianovBobbleFaceCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false

  // Warm ivory-beige skin base
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(0, 0, w, h)

  // Cheekbone & jawline shadows
  ctx.fillStyle = '#b5ad96'
  ctx.fillRect(0, Math.floor(h * 0.62), w, Math.floor(h * 0.38))
  ctx.fillRect(0, 0, 14, h)
  ctx.fillRect(w - 14, 0, 14, h)

  // 5-o'clock night-shift reactor stubble
  ctx.fillStyle = '#576657'
  for (let y = Math.floor(h * 0.68); y < h - 8; y += 6) {
    for (let x = 20; x < w - 20; x += 6) {
      if ((x + y) % 12 === 0) {
        ctx.fillRect(x, y, 3, 3)
      }
    }
  }

  // Intense furrowed eyebrows
  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(20, 26, 36, 7)
  ctx.fillRect(w - 56, 26, 36, 7)

  // Thick Soviet Bakelite Engineer Glasses (Frames + Bridge)
  ctx.fillStyle = '#0d110f'
  ctx.fillRect(16, 34, 42, 32)
  ctx.fillRect(w - 58, 34, 42, 32)
  ctx.fillRect(58, 44, w - 116, 6)
  ctx.fillRect(6, 42, 10, 5)
  ctx.fillRect(w - 16, 42, 10, 5)

  // Caffeinated wide eyes with Cherenkov green/white reflection inside lenses
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(21, 39, 32, 22)
  ctx.fillRect(w - 53, 39, 32, 22)

  // Dark under-eye night-shift bags
  ctx.fillStyle = '#8f8772'
  ctx.fillRect(21, 57, 32, 4)
  ctx.fillRect(w - 53, 57, 32, 4)

  // Pupils + Cherenkov CRT glint
  ctx.fillStyle = '#0d110f'
  ctx.fillRect(32, 44, 12, 12)
  ctx.fillRect(w - 42, 44, 12, 12)
  ctx.fillStyle = '#778472'
  ctx.fillRect(34, 46, 4, 4)
  ctx.fillRect(w - 40, 46, 4, 4)

  // Nose bridge & shadow
  ctx.fillStyle = '#8f8772'
  ctx.fillRect(w / 2 - 5, 50, 10, 26)
  ctx.fillStyle = '#6b442e'
  ctx.fillRect(w / 2 - 7, 72, 14, 5)

  // Determined slight smirk / grimace
  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(w / 2 - 22, 90, 44, 6)
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(w / 2 - 16, 91, 32, 3)

  apply16ColorBayerDither(ctx, w, h, 14)
  ctx.restore()
}

/**
 * Draws a 16-Color Bayer-Dithered pixel face for Senior KGB Inspector Komrad Oleg's Bobblehead!
 * Features a stern KGB eagle-eyed scowl, raised inspector eyebrow, and a glorious Soviet mustache.
 */
export function drawOlegBobbleFaceCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false

  // Warm ivory-tan skin base
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(0, 0, w, h)

  // Side temple & jaw shading
  ctx.fillStyle = '#b5ad96'
  ctx.fillRect(0, Math.floor(h * 0.64), w, Math.floor(h * 0.36))
  ctx.fillRect(0, 0, 14, h)
  ctx.fillRect(w - 14, 0, 14, h)

  // Stern KGB Inspector Eyebrows (Left angled down, Right raised in suspicion)
  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(20, 30, 36, 8)
  ctx.fillRect(w - 56, 25, 36, 8)

  // Sharp vigilant KGB eyes
  ctx.fillStyle = '#cfc6b0'
  ctx.fillRect(24, 40, 28, 16)
  ctx.fillRect(w - 52, 40, 28, 16)
  ctx.strokeStyle = '#0d110f'
  ctx.lineWidth = 3
  ctx.strokeRect(24, 40, 28, 16)
  ctx.strokeRect(w - 52, 40, 28, 16)

  ctx.fillStyle = '#18211b'
  ctx.fillRect(33, 43, 11, 11)
  ctx.fillRect(w - 43, 43, 11, 11)
  ctx.fillStyle = '#b8a46b'
  ctx.fillRect(35, 45, 3, 3)
  ctx.fillRect(w - 41, 45, 3, 3)

  // Strong sculpted nose
  ctx.fillStyle = '#8f8772'
  ctx.fillRect(w / 2 - 6, 46, 12, 26)
  ctx.fillStyle = '#6b442e'
  ctx.fillRect(w / 2 - 9, 68, 18, 5)

  // Glorious 1984 Soviet Walrus / Handlebar Mustache!
  ctx.fillStyle = '#2b1a12'
  ctx.fillRect(w / 2 - 34, 75, 68, 14)
  ctx.fillRect(w / 2 - 40, 81, 14, 12)
  ctx.fillRect(w / 2 + 26, 81, 14, 12)
  ctx.fillStyle = '#472b1e'
  ctx.fillRect(w / 2 - 28, 77, 56, 5)

  // Stern lower lip below mustache
  ctx.fillStyle = '#6b442e'
  ctx.fillRect(w / 2 - 14, 93, 28, 5)

  apply16ColorBayerDither(ctx, w, h, 14)
  ctx.restore()
}

/**
 * Draws a 16-Color Bayer-Dithered brass nameplate for a Bobblehead pedestal
 * (Dithering applied strictly to the metal background plate BEFORE drawing crisp text).
 */
export function drawBobbleNameplateCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  name: string,
  subtitle: string
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  // Clean, solid bright brass plate (#b8a46b) with dark cast-iron border
  ctx.fillStyle = '#0d110f'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#b8a46b'
  ctx.fillRect(4, 4, w - 8, h - 8)
  ctx.strokeStyle = '#472b1e'
  ctx.lineWidth = 2
  ctx.strokeRect(7, 7, w - 14, h - 14)

  // Corner brass rivets
  ctx.fillStyle = '#141414'
  ctx.fillRect(10, 10, 5, 5)
  ctx.fillRect(w - 15, 10, 5, 5)
  ctx.fillRect(10, h - 15, 5, 5)
  ctx.fillRect(w - 15, h - 15, 5, 5)

  // Crisp, high-contrast dark engraved Cyrillic letters on bright brass (#b8a46b)
  ctx.fillStyle = '#0d110f'
  ctx.font = 'bold 26px "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, w / 2, 23)
  ctx.fillStyle = '#472b1e'
  ctx.font = 'bold 14px "Courier Prime", monospace'
  ctx.fillText(subtitle, w / 2, 46)

  ctx.restore()
}

/**
 * Draws industrial yellow/brass & black diagonal hazard stripes (`ОПАСНО`) for the shredder throat.
 * Dithers the metal chevron background first, then draws crisp un-dithered warning text.
 */
export function drawHazardChevronCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#b8a46b'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#0d110f'
  for (let x = -h; x < w + h; x += 24) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 12, 0)
    ctx.lineTo(x + 12 - h, h)
    ctx.lineTo(x - h, h)
    ctx.closePath()
    ctx.fill()
  }
  apply16ColorBayerDither(ctx, w, h, 10)

  ctx.fillStyle = '#0d110f'
  ctx.fillRect(w / 2 - 58, 4, 116, h - 8)
  ctx.strokeStyle = '#b8a46b'
  ctx.lineWidth = 2
  ctx.strokeRect(w / 2 - 58, 4, 116, h - 8)
  ctx.fillStyle = '#cfc6b0'
  ctx.font = 'bold 13px "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ОПАСНО // НОЖИ', w / 2, h / 2)
  ctx.restore()
}
