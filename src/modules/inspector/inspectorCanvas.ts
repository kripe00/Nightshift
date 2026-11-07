// 1984 Soviet Inspector Desk Canvas & 16-Color Bayer Dithering Renderers
// Implements STEP 1–5: 16-Color Bayer Dithered Hardware, Compact Teletype Slips,
// Full Expanded Directives with Relative Ink Stamps, 3-Page Scrollable KGB Security Manual,
// and True 2x Straight Optical Magnifying Glass Zoom (Zero UV).

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
  type SealEmblemType,
  type SealMicroDefect,
} from './useDeskStore'

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

function getFontDeclaration(fontType: DocumentFontType, sizePx: number): string {
  switch (fontType) {
    case 'WESTERN_SERIF':
      return `bold ${sizePx}px Georgia, "Times New Roman", Times, serif`
    case 'SLANTED_ITALIC':
      return `italic bold ${sizePx}px "Courier Prime", monospace`
    case 'BOURGEOIS_SANS':
      return `bold ${sizePx}px Arial, Helvetica, sans-serif`
    case 'PRAVDA_BLOCK':
      return `900 ${sizePx}px "Courier Prime", monospace`
    case 'GOST_MONO':
    default:
      return `bold ${sizePx}px "Courier Prime", monospace`
  }
}

/**
 * Renders the 3 Official Soviet Seals (USSR State Seal, MinSredMash Atom, KGB Sword & Shield).
 * At 1x (`isMagnified = false`), micro-print is tiny and barely a texture line;
 * at 2x (`isMagnified = true` inside the optical lens), the micro-ring text, star points, and orbits are razor-sharp.
 */
export function drawOfficialSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  sealType: SealEmblemType,
  microDefect: SealMicroDefect,
  inkHex: string,
  isMagnified: boolean
): void {
  ctx.save()
  ctx.translate(cx, cy)
  const scale = radius / 50
  ctx.scale(scale, scale)

  const hasLatinRing =
    microDefect === 'LATIN_RING_TEXT' ||
    microDefect === 'SIX_POINT_STAR' ||
    microDefect === 'BROKEN_ORBIT'

  const topRingText = hasLatinRing
    ? '★ CCCP-LATIN • SERIES-6 ★'
    : '★ СССР • ГОССТАНДАРТ 84 ★'

  const bottomRingText =
    sealType === 'USSR_STATE_SEAL'
      ? hasLatinRing
        ? 'SOVMIN • WESTERN PRESS'
        : 'СОВЕТ МИНИСТРОВ СССР'
      : sealType === 'MINSREDMASH_ATOM'
        ? hasLatinRing
          ? 'MINSREDMASH • ORBIT-1'
          : 'МИНСРЕДМАШ • ОБЪЕКТ №4'
        : hasLatinRing
          ? '5-UPR • LANGLEY COPY'
          : '5-Е УПРАВЛЕНИЕ КГБ СССР'

  ctx.strokeStyle = inkHex
  ctx.fillStyle = inkHex

  // Outer Double Stamp Ring
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(0, 0, 47, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 1.1
  ctx.setLineDash([2.2, 1.6])
  ctx.beginPath()
  ctx.arc(0, 0, 43, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(0, 0, 31, 0, Math.PI * 2)
  ctx.stroke()

  // Micro-print top & bottom ring labels (crisp, un-dithered high-contrast strokes)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = isMagnified
    ? 'bold 6.2px "Courier Prime", monospace'
    : 'bold 4.2px "Courier Prime", monospace'
  ctx.fillText(topRingText, 0, -36.5)
  ctx.fillText(bottomRingText, 0, 38)

  // Left & Right micro serial codes
  ctx.font = isMagnified
    ? 'bold 6.0px "Courier Prime", monospace'
    : 'bold 4.0px "Courier Prime", monospace'
  ctx.fillText(microDefect === 'NONE' ? '№84' : 'ERR', -37, 2)
  ctx.fillText(microDefect === 'NONE' ? '5★' : '6★', 37, 2)

  // Top Crown Star at (0, -24)
  const starY = -24
  const rOuter = 6.5
  if (microDefect === 'SIX_POINT_STAR') {
    ctx.beginPath()
    ctx.moveTo(0, starY - rOuter)
    ctx.lineTo(rOuter * 0.86, starY + rOuter * 0.5)
    ctx.lineTo(-rOuter * 0.86, starY + rOuter * 0.5)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(0, starY + rOuter)
    ctx.lineTo(rOuter * 0.86, starY - rOuter * 0.5)
    ctx.lineTo(-rOuter * 0.86, starY - rOuter * 0.5)
    ctx.closePath()
    ctx.fill()
  } else if (microDefect === 'FOUR_POINT_STAR') {
    const rIn = rOuter * 0.35
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
  } else {
    const rInner = rOuter * 0.42
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
  }

  // Center Emblem by Seal Type
  if (sealType === 'USSR_STATE_SEAL') {
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, 4, 14, 0, Math.PI * 2)
    ctx.stroke()

    ctx.lineWidth = 1.0
    ctx.beginPath()
    ctx.ellipse(0, 4, 7, 14, 0, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(-14, 4)
    ctx.lineTo(14, 4)
    ctx.moveTo(-12, -3)
    ctx.lineTo(12, -3)
    ctx.moveTo(-12, 11)
    ctx.lineTo(12, 11)
    ctx.stroke()

    ctx.lineWidth = 2.8
    ctx.setLineDash([3, 1.5])
    ctx.beginPath()
    ctx.arc(0, 4, 21, Math.PI * 0.68, Math.PI * 1.32)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 4, 21, -Math.PI * 0.32, Math.PI * 0.32)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(-7, 11)
    ctx.lineTo(7, -5)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(1, 3, 8, -Math.PI * 0.65, Math.PI * 0.55)
    ctx.stroke()
  } else if (sealType === 'MINSREDMASH_ATOM') {
    ctx.lineWidth = 1.7
    ctx.beginPath()
    ctx.ellipse(0, 4, 19, 7.5, (-32 * Math.PI) / 180, 0, Math.PI * 2)
    ctx.stroke()

    if (microDefect === 'BROKEN_ORBIT') {
      ctx.setLineDash([2.5, 2.5])
      ctx.beginPath()
      ctx.ellipse(0, 4, 19, 7.5, (32 * Math.PI) / 180, 0, Math.PI * 1.15)
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      ctx.beginPath()
      ctx.ellipse(0, 4, 19, 7.5, (32 * Math.PI) / 180, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(0, 4, 2.8, 0, Math.PI * 2)
    ctx.fill()

    ctx.lineWidth = 2.0
    ctx.beginPath()
    ctx.moveTo(-8, 12)
    ctx.lineTo(8, -5)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(1, 4, 8.5, -Math.PI * 0.6, Math.PI * 0.55)
    ctx.stroke()
  } else if (sealType === 'KGB_SWORD_SHIELD') {
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(0, -18)
    ctx.lineTo(0, 25)
    ctx.moveTo(-8, -13)
    ctx.lineTo(8, -13)
    ctx.stroke()

    ctx.fillStyle = '#d8d2c0'
    ctx.lineWidth = 2.0
    ctx.beginPath()
    ctx.moveTo(-12, -10)
    ctx.lineTo(12, -10)
    ctx.lineTo(10, 8)
    ctx.lineTo(0, 20)
    ctx.lineTo(-10, 8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = inkHex
    ctx.lineWidth = 1.9
    ctx.beginPath()
    ctx.moveTo(-6, 10)
    ctx.lineTo(6, -4)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 3, 6.5, -Math.PI * 0.6, Math.PI * 0.55)
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
  ctx.imageSmoothingEnabled = false
  const paperHex = PAPER_COLOR_HEX[doc.paperColor]
  const inkHex = INK_COLOR_HEX[doc.inkColor]

  ctx.fillStyle = paperHex
  ctx.fillRect(0, 0, w, h)

  // Left & Right Tractor Sprocket Holes
  ctx.fillStyle = '#0d110f'
  for (let y = 14; y < h - 18; y += 26) {
    ctx.fillRect(8, y, 8, 8)
    ctx.fillRect(w - 16, y, 8, 8)
  }

  // Serrated bottom tear edge shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.fillRect(0, h - 10, w, 10)
  ctx.fillStyle = '#0d110f'
  for (let x = 0; x < w; x += 12) {
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.lineTo(x + 6, h - 7)
    ctx.lineTo(x + 12, h)
    ctx.closePath()
    ctx.fill()
  }

  // Inner Slip Frame
  ctx.strokeStyle = '#18211b'
  ctx.lineWidth = 2
  ctx.strokeRect(24, 12, w - 48, h - 28)

  // Header Badge: ПРАВДА-84 // ТЕЛЕТАЙП
  ctx.fillStyle = inkHex
  ctx.fillRect(30, 20, w - 60, 28)
  ctx.fillStyle = paperHex
  ctx.font = 'bold 14px "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ПРАВДА-84 // ТЕЛЕТАЙП', w / 2, 34)

  // Title & Reference Code
  ctx.fillStyle = '#0d110f'
  ctx.textAlign = 'left'
  ctx.font = getFontDeclaration(doc.fontType, 14)
  const lines = wrapCanvasText(ctx, doc.title, w - 68)
  let y = 72
  for (const line of lines.slice(0, 3)) {
    ctx.fillText(line, 34, y)
    y += 20
  }

  ctx.font = 'bold 13px "Courier Prime", monospace'
  ctx.fillStyle = '#2a362b'
  ctx.fillText(`КОД: ${doc.referenceCode}`, 34, y + 12)
  ctx.fillText(`ДАТА: ${doc.dateString}`, 34, y + 32)

  // Ministry Stamp Box
  ctx.strokeStyle = inkHex
  ctx.lineWidth = 2
  ctx.strokeRect(34, h - 82, w - 68, 38)
  ctx.fillStyle = inkHex
  ctx.textAlign = 'center'
  ctx.font = 'bold 12px "Courier Prime", monospace'
  ctx.fillText(doc.ministry.slice(0, 24), w / 2, h - 63)

  ctx.fillStyle = '#8b1e1e'
  ctx.font = 'bold 12px "VT323", monospace'
  ctx.fillText('► DRAG ONTO MAT TO UNFOLD ►', w / 2, h - 26)

  ctx.restore()
}

/**
 * Draws the Full Expanded Directive Document (768x1024 crisp high-DPI canvas, normalized to 560x740 logical grid).
 * Increases base typography size by 35% (Ministry header 24px-28px, Ref/Date/Title 20px-22px, Body 18px-20px in #141413 ink)
 * while keeping micro-print seal rings, star points, and orbits fine enough that the 2x Magnifying Glass remains essential.
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
  const inkHex = INK_COLOR_HEX[doc.inkColor]

  // 1. Paper Stock Tint Background
  ctx.fillStyle = paperHex
  ctx.fillRect(0, 0, LW, LH)

  // Folded top-right dog-ear corner
  ctx.fillStyle = '#8f8772'
  ctx.beginPath()
  ctx.moveTo(LW - 42, 0)
  ctx.lineTo(LW, 42)
  ctx.lineTo(LW - 42, 42)
  ctx.closePath()
  ctx.fill()

  // 2. Tractor-Feed Sprocket Holes Left & Right
  ctx.fillStyle = '#0d110f'
  for (let y = 18; y < LH - 18; y += 34) {
    ctx.fillRect(10, y, 10, 10)
    ctx.fillRect(LW - 20, y, 10, 10)
  }

  // 3. Official Double Border Frame
  ctx.strokeStyle = '#18211b'
  ctx.lineWidth = 3
  ctx.strokeRect(30, 16, LW - 60, LH - 32)
  ctx.lineWidth = 1.2
  ctx.strokeRect(35, 21, LW - 70, LH - 42)

  // Micro-print security border line along top edge (subtle at 1x, crisp under 2x Magnifying Glass)
  ctx.fillStyle = inkHex
  ctx.font = isMagnified
    ? 'bold 12px "Courier Prime", monospace'
    : 'bold 8.5px "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(
    `${doc.secretWatermark} • ФОРМА №4 • ${doc.paperColor} • ${doc.inkColor}`,
    LW / 2,
    34
  )

  // 4. Issuing Ministry Header Banner (Bold 24px–26px, wrapped cleanly if 2 lines)
  ctx.fillStyle = inkHex
  ctx.fillRect(42, 42, LW - 84, 58)
  ctx.fillStyle = paperHex
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = getFontDeclaration(doc.fontType, 24)
  const ministryLines = wrapCanvasText(ctx, doc.ministry, LW - 100)
  if (ministryLines.length === 1) {
    ctx.font = getFontDeclaration(doc.fontType, 25)
    ctx.fillText(ministryLines[0], LW / 2, 71)
  } else {
    ctx.font = getFontDeclaration(doc.fontType, 22)
    ctx.fillText(ministryLines[0], LW / 2, 58)
    ctx.fillText(ministryLines.slice(1).join(' '), LW / 2, 83)
  }

  // 5. Reference Code (`ИСХ. №`) & Date (`ДАТА`) Row (Bold 20px)
  ctx.fillStyle = '#141413'
  ctx.textAlign = 'left'
  ctx.font = getFontDeclaration(doc.fontType, 20)
  ctx.fillText(`ИСХ. № ${doc.referenceCode}`, 44, 122)
  ctx.textAlign = 'right'
  ctx.fillText(`ДАТА: ${doc.dateString}`, LW - 44, 122)

  ctx.strokeStyle = inkHex
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(42, 138)
  ctx.lineTo(LW - 42, 138)
  ctx.stroke()

  // 6. Directive Title (Bold 22px) & Body Paragraphs (Bold 19px-20px in dark #141413 ink)
  ctx.save()
  if (doc.fontType === 'SLANTED_ITALIC') {
    ctx.transform(1, 0, -0.18, 1, 46, 0)
  }
  ctx.fillStyle = inkHex
  ctx.textAlign = 'left'
  ctx.font = getFontDeclaration(doc.fontType, 22)
  const titleLines = wrapCanvasText(ctx, doc.title, LW - 92)
  let y = 166
  for (const line of titleLines) {
    ctx.fillText(line, 44, y)
    y += 27
  }

  ctx.fillStyle = '#141413'
  ctx.font = getFontDeclaration(doc.fontType, 19)
  const bodyLines = wrapCanvasText(ctx, doc.content, LW - 92)
  y += 10
  for (const line of bodyLines) {
    ctx.fillText(line, 44, y)
    y += 27
  }
  ctx.restore()

  // 7. Bottom Footer Row: Signature & Clearance Block (Left) + Official Soviet Seal Emblem (Right)
  const footerTop = 426
  const footerH = 228
  ctx.strokeStyle = inkHex
  ctx.lineWidth = 2.2
  ctx.strokeRect(42, footerTop, LW - 84, footerH)

  // Official Soviet Seal at (cx=426, cy=footerTop + 114, r=78)
  drawOfficialSeal(
    ctx,
    426,
    footerTop + 114,
    78,
    doc.sealType,
    doc.sealMicroDefect,
    inkHex,
    isMagnified
  )

  ctx.fillStyle = '#141413'
  ctx.textAlign = 'left'
  ctx.font = 'bold 18px "Courier Prime", monospace'
  ctx.fillText('ПОДПИСЬ:', 54, footerTop + 30)
  ctx.fillStyle = inkHex
  ctx.font = getFontDeclaration(doc.fontType, 21)
  ctx.fillText(doc.signature, 54, footerTop + 60)

  ctx.fillStyle = '#141413'
  ctx.font = 'bold 18px "Courier Prime", monospace'
  ctx.fillText(`PAPER: ${doc.paperColor}`, 54, footerTop + 104)
  ctx.fillText(`INK:   ${doc.inkColor}`, 54, footerTop + 132)
  ctx.fillText(`FONT:  ${doc.fontType}`, 54, footerTop + 160)
  ctx.fillStyle = inkHex
  ctx.font = isMagnified
    ? 'bold 13px "Courier Prime", monospace'
    : 'bold 10px "Courier Prime", monospace'
  ctx.fillText(`МИКРО-КОД: ${doc.secretWatermark}`, 54, footerTop + 198)

  // 8. Permanently Attached Relative Ink Stamps (`doc.stamps`)
  for (const stamp of doc.stamps) {
    ctx.save()
    const sx = Math.max(115, Math.min(LW - 115, stamp.u * LW))
    const sy = Math.max(66, Math.min(LH - 66, stamp.v * LH))
    ctx.translate(sx, sy)
    ctx.rotate(-0.08)
    const stampColor = stamp.type === 'APPROVED' ? '#1b6e32' : '#8b1e1e'
    ctx.fillStyle = 'rgba(230, 222, 195, 0.85)'
    ctx.fillRect(-104, -35, 208, 70)
    ctx.strokeStyle = stampColor
    ctx.fillStyle = stampColor
    ctx.lineWidth = 5
    ctx.strokeRect(-104, -35, 208, 70)
    ctx.lineWidth = 2
    ctx.strokeRect(-96, -27, 192, 54)
    ctx.font = 'bold 24px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      stamp.type === 'APPROVED' ? 'ОДОБРЕНО' : 'УНИЧТОЖЕНО',
      0,
      -7
    )
    ctx.font = 'bold 15px "Courier Prime", monospace'
    ctx.fillText(`${stamp.type} // №4`, 0, 16)
    ctx.restore()
  }

  // 9. Bottom Instruction Strip
  ctx.fillStyle = '#0d110f'
  ctx.fillRect(42, LH - 66, LW - 84, 36)
  ctx.fillStyle = '#b8a46b'
  ctx.font = 'bold 18px "VT323", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(
    'DRAG TO [ИСХОДЯЩИЕ OUTBOX] (TOP) OR [УНИЧТОЖИТЕЛЬ-84 SHREDDER] (RIGHT)',
    LW / 2,
    LH - 44
  )

  ctx.restore()
}

export const drawDirectiveCanvas = drawFullDirectiveSheetCanvas

/**
 * Draws Komrad Oleg's 3-Page KGB Security Manual '84 (`КГБ СССР // ФОРМА 84-Б`)
 * with 50% larger high-contrast typography (headers 28px-30px bold, section titles 22px-24px bold,
 * rules/examples/labels 20px-22px bold in #111111 ink on #dfd8c5 paper).
 */
export function drawSecurityManualCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  page: 1 | 2 | 3,
  scrollY = 0,
  isMagnified = false
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  const LW = 620
  const LH = 775
  ctx.scale(w / LW, h / LH)

  // Crimson KGB Hardcover Binder Frame
  ctx.fillStyle = '#6b1d18'
  ctx.fillRect(0, 0, LW, LH)

  // Clean High-Contrast Manual Page Cardstock (#dfd8c5)
  ctx.fillStyle = '#dfd8c5'
  ctx.fillRect(14, 14, LW - 28, LH - 28)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 3
  ctx.strokeRect(20, 20, LW - 40, LH - 40)

  // Scrollable Viewport Clip Area (y: 124 to LH - 68)
  ctx.save()
  ctx.beginPath()
  ctx.rect(24, 124, LW - 48, LH - 192)
  ctx.clip()
  ctx.translate(0, -scrollY * 1.55)

  if (page === 1) {
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 23px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('1. OFFICIAL SOVIET SEALS & SPECIMENS:', 32, 152)

    const sealRows: Array<{
      type: SealEmblemType
      ink: string
      title: string
      ministry: string
      rule1: string
      rule2: string
      rule3: string
    }> = [
      {
        type: 'USSR_STATE_SEAL',
        ink: '#111111',
        title: '1. STATE SEAL (ГЕРБ СССР)',
        ministry: 'Issuer: COUNCIL OF MINISTERS',
        rule1: '✓ 5-PT STAR on crest (6/4-pt = Fake)',
        rule2: '✓ СССР • ГОССТАНДАРТ 84 ring',
        rule3: '✗ Shred any CCCP-LATIN ring text!',
      },
      {
        type: 'MINSREDMASH_ATOM',
        ink: '#8b1e1e',
        title: '2. ATOM SEAL (АТОМНЫЙ ЩИТ)',
        ministry: 'Issuer: MINSREDMASH & ATOMIC EN.',
        rule1: '✓ 2 SOLID ORBITS (Broken = Sabotage)',
        rule2: '✓ 5-PT STAR & СССР micro-ring',
        rule3: '✓ Rim code №84 / 5★ under 2x lens',
      },
      {
        type: 'KGB_SWORD_SHIELD',
        ink: '#8b1e1e',
        title: '3. KGB SHIELD (ЩИТ И МЕЧ)',
        ministry: 'Issuer: 5TH CHIEF DIRECTORATE',
        rule1: '✓ VERTICAL SWORD on shield axis',
        rule2: '✓ 5-Е УПРАВЛЕНИЕ КГБ СССР ring',
        rule3: '✗ Shred any LANGLEY COPY ring!',
      },
    ]

    sealRows.forEach((row, idx) => {
      const ry = 166 + idx * 212
      ctx.fillStyle = '#dfd8c5'
      ctx.fillRect(30, ry, LW - 60, 198)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2.5
      ctx.strokeRect(30, ry, LW - 60, 198)

      drawOfficialSeal(
        ctx,
        92,
        ry + 99,
        54,
        row.type,
        'NONE',
        row.ink,
        isMagnified || true
      )

      ctx.fillStyle = '#111111'
      ctx.textAlign = 'left'
      ctx.font = 'bold 22px "Courier Prime", monospace'
      ctx.fillText(row.title, 156, ry + 34)
      ctx.fillStyle = '#1e2b22'
      ctx.font = 'bold 20px "Courier Prime", monospace'
      ctx.fillText(row.ministry, 156, ry + 66)
      ctx.fillStyle = '#145c26'
      ctx.font = 'bold 20px "Courier Prime", monospace'
      ctx.fillText(row.rule1, 156, ry + 104)
      ctx.fillText(row.rule2, 156, ry + 138)
      ctx.fillStyle = '#8b1e1e'
      ctx.fillText(row.rule3, 156, ry + 172)
    })
  } else if (page === 2) {
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 23px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('2. AUTHORIZED MINISTRIES & FONTS:', 32, 152)

    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(30, 166, LW - 60, 214)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2.5
    ctx.strokeRect(30, 166, LW - 60, 214)

    const validMinistries = [
      '1. MINISTRY OF MEDIUM MACHINE BLDG',
      '2. STATE COMMITTEE ATOMIC ENERGY',
      '3. COUNCIL OF MINISTERS USSR',
      '4. 5TH CHIEF DIRECTORATE',
    ]
    ctx.fillStyle = '#145c26'
    ctx.font = 'bold 21px "Courier Prime", monospace'
    validMinistries.forEach((m, i) => {
      ctx.fillText(`✓ ${m}`, 42, 198 + i * 34)
    })
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.fillText(
      '✗ SHRED ANY OTHER MINISTRY HEADER!',
      42,
      358
    )

    // Approved Fonts Box
    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(30, 394, LW - 60, 194)
    ctx.strokeStyle = '#145c26'
    ctx.lineWidth = 2.5
    ctx.strokeRect(30, 394, LW - 60, 194)
    ctx.fillStyle = '#145c26'
    ctx.font = 'bold 22px "Courier Prime", monospace'
    ctx.fillText('✓ APPROVED SOVIET FONTS (ГОСТ 84):', 42, 426)
    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('GOST_MONO', 22)
    ctx.fillText('• GOST MONO: ДИРЕКТИВА №44', 42, 464)
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.fillStyle = '#1e2b22'
    ctx.fillText('  Monospaced slab; flat terminals.', 42, 494)
    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('PRAVDA_BLOCK', 22)
    ctx.fillText('• PRAVDA BLOCK: ПРОТОКОЛ ГКАЭ', 42, 534)
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.fillStyle = '#1e2b22'
    ctx.fillText('  Heavy block strokes; zero slant.', 42, 566)

    // Forbidden Western Fonts Box
    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(30, 602, LW - 60, 202)
    ctx.strokeStyle = '#8b1e1e'
    ctx.lineWidth = 2.5
    ctx.strokeRect(30, 602, LW - 60, 202)
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 22px "Courier Prime", monospace'
    ctx.fillText('✗ FORBIDDEN WESTERN FONTS (SHRED!):', 42, 634)
    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('WESTERN_SERIF', 22)
    ctx.fillText('• WESTERN SERIF: Roman Serif 88', 42, 672)
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.fillStyle = '#8b1e1e'
    ctx.fillText('  Triangular serifs & thin strokes!', 42, 704)
    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('SLANTED_ITALIC', 22)
    ctx.fillText('• SLANTED / SANS: 12° Italic', 42, 744)
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.fillStyle = '#8b1e1e'
    ctx.fillText('  12° cursive slant or sans curves!', 42, 776)
  } else {
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 23px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('3. PAPER STOCK & MINISTRY INKS:', 32, 152)

    // Paper Stock Swatches
    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(30, 166, LW - 60, 292)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2.5
    ctx.strokeRect(30, 166, LW - 60, 292)
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 22px "Courier Prime", monospace'
    ctx.fillText('1. PAPER STOCK TINT SWATCHES:', 42, 198)

    const papers: Array<{ hex: string; label: string; desc: string; ok: boolean }> = [
      {
        hex: PAPER_COLOR_HEX.STATE_IVORY,
        label: 'VALID: State Ivory (#d8d2c0)',
        desc: 'Unbleached Factory No. 4 stock.',
        ok: true,
      },
      {
        hex: PAPER_COLOR_HEX.BUNKER_GREY,
        label: 'VALID: Bunker Grey (#bfc4be)',
        desc: 'Recycled security archive card.',
        ok: true,
      },
      {
        hex: PAPER_COLOR_HEX.BLEACHED_WHITE,
        label: 'SHRED: Bleached White (#f4f4f6)',
        desc: 'Western optical-brightened bond!',
        ok: false,
      },
      {
        hex: PAPER_COLOR_HEX.YELLOW_PARCHMENT,
        label: 'SHRED: Yellow Parchment (#e6d8ad)',
        desc: 'Counterfeit chemically aged stock!',
        ok: false,
      },
    ]
    papers.forEach((p, idx) => {
      const py = 214 + idx * 58
      ctx.fillStyle = p.hex
      ctx.fillRect(44, py, 36, 38)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2
      ctx.strokeRect(44, py, 36, 38)
      ctx.fillStyle = p.ok ? '#145c26' : '#8b1e1e'
      ctx.font = 'bold 21px "Courier Prime", monospace'
      ctx.fillText(p.label, 92, py + 16)
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 19px "Courier Prime", monospace'
      ctx.fillText(p.desc, 92, py + 40)
    })

    // Ministry Ink Swatches
    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(30, 472, LW - 60, 316)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2.5
    ctx.strokeRect(30, 472, LW - 60, 316)
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 22px "Courier Prime", monospace'
    ctx.fillText('2. MANDATORY MINISTRY INKS:', 42, 504)

    const inks: Array<{ hex: string; title: string; rule: string; ok: boolean }> = [
      {
        hex: INK_COLOR_HEX.SOVIET_CRIMSON,
        title: 'Soviet Crimson (#8b1e1e)',
        rule: 'ONLY: MinSredMash & 5th Dir.',
        ok: true,
      },
      {
        hex: INK_COLOR_HEX.BUNKER_OLIVE,
        title: 'Bunker Olive (#2d4c2b)',
        rule: 'ONLY: Atomic Energy Committee',
        ok: true,
      },
      {
        hex: INK_COLOR_HEX.PRAVDA_BLACK,
        title: 'Pravda Black (#1a1a1a)',
        rule: 'ONLY: Council of Min. & 5th Dir.',
        ok: true,
      },
      {
        hex: INK_COLOR_HEX.CIA_NAVY_BLUE,
        title: 'SHRED: Navy Blue / Purple Ink',
        rule: 'Forbidden Western ink = SHRED!',
        ok: false,
      },
    ]
    inks.forEach((ink, idx) => {
      const iy = 522 + idx * 62
      ctx.fillStyle = ink.hex
      ctx.fillRect(44, iy, 36, 38)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2
      ctx.strokeRect(44, iy, 36, 38)
      ctx.fillStyle = ink.ok ? '#111111' : '#8b1e1e'
      ctx.font = 'bold 21px "Courier Prime", monospace'
      ctx.fillText(ink.title, 92, iy + 16)
      ctx.fillStyle = ink.ok ? '#145c26' : '#8b1e1e'
      ctx.font = 'bold 20px "Courier Prime", monospace'
      ctx.fillText(ink.rule, 92, iy + 42)
    })
  }

  ctx.restore() // end scrollable clip

  // Fixed Top Header Bar (`★ КГБ СССР // ФОРМА 84-Б`) — Bold 28px
  ctx.fillStyle = '#111111'
  ctx.fillRect(24, 22, LW - 48, 52)
  ctx.fillStyle = '#b8a46b'
  ctx.font = 'bold 28px "Courier Prime", monospace'
  ctx.textAlign = 'center'
  ctx.fillText('★ КГБ СССР // ФОРМА 84-Б ★', LW / 2, 56)

  // Fixed 3 Page Tabs Bar (`1. SEALS`, `2. FONTS`, `3. COLOURS`) — Bold 20px
  const tabs: Array<{ id: 1 | 2 | 3; label: string }> = [
    { id: 1, label: '1. SEALS' },
    { id: 2, label: '2. FONTS' },
    { id: 3, label: '3. COLOURS' },
  ]
  const tabW = Math.floor((LW - 52) / 3)
  tabs.forEach((t, idx) => {
    const tx = 26 + idx * tabW
    const isActive = page === t.id
    ctx.fillStyle = isActive ? '#8b1e1e' : '#b5ad96'
    ctx.fillRect(tx, 78, tabW - 4, 38)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2.5
    ctx.strokeRect(tx, 78, tabW - 4, 38)
    ctx.fillStyle = isActive ? '#dfd8c5' : '#111111'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(t.label, tx + (tabW - 4) / 2, 104)
  })

  // Fixed Footer Navigation & Stepped Scroll Bar — Bold 22px
  ctx.fillStyle = '#111111'
  ctx.fillRect(24, LH - 64, LW - 48, 42)
  ctx.fillStyle = '#b8a46b'
  ctx.font = 'bold 22px "VT323", monospace'
  ctx.textAlign = 'left'
  ctx.fillText(
    `[< PREV]  PAGE ${page}/3  [NEXT >]`,
    32,
    LH - 36
  )
  ctx.textAlign = 'right'
  ctx.fillStyle = '#33ff66'
  ctx.fillText(
    `[▲ UP]  [▼ DOWN] (${Math.round((scrollY / 180) * 100)}%)`,
    LW - 32,
    LH - 36
  )

  ctx.restore()
}

/**
 * Renders the True 2x Straight Optical Magnifying Glass Lens (384x384).
 * Zero UV — computes the exact intersection with the topmost overlapping 3D Directive
 * (or the KGB Security Manual) and draws a genuine 2x optically magnified crop!
 */
export function drawTrue2xOpticalLensCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lensX: number,
  lensZ: number,
  docs: DeskDocument[],
  manualPage: 1 | 2 | 3,
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
  isFreeLookMode = false
): void {
  ctx.save()
  ctx.imageSmoothingEnabled = false

  ctx.fillStyle = '#09120e'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#b8a46b'
  ctx.lineWidth = 4
  ctx.strokeRect(4, 4, w - 8, h - 8)

  // Left Title in Phosphor Green / Brass
  ctx.fillStyle = '#33ff66'
  ctx.font = 'bold 18px "Courier Prime", monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('ПУНКТ №4 // DESK', 16, 28)

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
    isFreeLookMode
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

  // Bottom Verdict Ticker Row
  const tickerBg = !lastVerdict
    ? '#0d1a14'
    : lastVerdict.pending
      ? '#2b220d'
      : lastVerdict.correct
        ? '#0f2e19'
        : '#3b0f0f'
  ctx.fillStyle = tickerBg
  ctx.fillRect(14, 50, w - 28, 36)
  const tickerColor = !lastVerdict
    ? '#33ff66'
    : lastVerdict.pending
      ? '#ffb000'
      : lastVerdict.correct
        ? '#33ff66'
        : '#ff2a2a'
  ctx.strokeStyle = tickerColor
  ctx.lineWidth = 2
  ctx.strokeRect(14, 50, w - 28, 36)

  ctx.fillStyle = tickerColor
  ctx.font = 'bold 16px "Courier Prime", monospace'
  ctx.textAlign = 'center'
  const text = lastVerdict
    ? `${lastVerdict.docId} [${lastVerdict.decision}]: ${lastVerdict.reason}`
    : 'INSPECT SEALS (2x ZOOM), FONTS/MINISTRIES & COLOURS IN KGB MANUAL BEFORE DISPATCHING'
  ctx.fillText(text.slice(0, 88), w / 2, 69)

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
