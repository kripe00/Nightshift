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
  type ManualPageId,
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

  // 6. Directive Title (Bold 22px), Power Routing Order Box & Body Paragraphs
  ctx.save()
  if (doc.fontType === 'SLANTED_ITALIC') {
    ctx.transform(1, 0, -0.18, 1, 46, 0)
  }
  ctx.fillStyle = inkHex
  ctx.textAlign = 'left'
  ctx.font = getFontDeclaration(doc.fontType, 22)
  const titleLines = wrapCanvasText(ctx, doc.title, LW - 92)
  let y = 164
  for (const line of titleLines) {
    ctx.fillText(line, 44, y)
    y += 26
  }

  // Prominent Framed Regional Power Routing Order Banner
  if (doc.powerOrderText) {
    const boxY = y - 6
    ctx.fillStyle = '#18241d'
    ctx.fillRect(42, boxY, LW - 84, 38)
    ctx.strokeStyle = inkHex
    ctx.lineWidth = 2
    ctx.strokeRect(42, boxY, LW - 84, 38)
    ctx.fillStyle = '#33ff66'
    ctx.font = 'bold 15px "Courier Prime", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(doc.powerOrderText, LW / 2, boxY + 24)
    ctx.textAlign = 'left'
    y = boxY + 58
  } else {
    y += 10
  }

  ctx.fillStyle = '#141413'
  ctx.font = getFontDeclaration(doc.fontType, 18)
  const bodyLines = wrapCanvasText(ctx, doc.content, LW - 92)
  for (const line of bodyLines) {
    ctx.fillText(line, 44, y)
    y += 25
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
  ctx.font = 'bold 17px "VT323", monospace'
  ctx.textAlign = 'center'
  ctx.fillText(
    'STAMP [ОДОБРЕНО] -> DROP IN LEFT [ПНЕВМОПОЧТА TUBE] OR SHRED [RIGHT]',
    LW / 2,
    LH - 44
  )

  ctx.restore()
}

export const drawDirectiveCanvas = drawFullDirectiveSheetCanvas

type ManualIconKind =
  | 'levers'
  | 'wheel'
  | 'az5'
  | 'octagon'
  | 'gas'
  | 'rheostat'
  | 'breaker'
  | 'printer'
  | 'stamp'
  | 'piston'
  | 'vent'

function drawManualSchematicIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  kind: ManualIconKind
): void {
  ctx.save()
  ctx.translate(cx, cy)

  if (kind === 'levers') {
    // 3 MW Slotted Levers Icon
    ctx.fillStyle = '#18211b'
    ctx.fillRect(-34, -34, 68, 68)
    ctx.strokeStyle = '#b8a46b'
    ctx.lineWidth = 2.5
    ctx.strokeRect(-34, -34, 68, 68)
    const leverHeights = [-14, 4, -8]
    const cols = ['#33ff66', '#ffb000', '#33ff66']
    ;[-18, 0, 18].forEach((lx, i) => {
      ctx.fillStyle = '#0d110f'
      ctx.fillRect(lx - 3, -24, 6, 48)
      const hy = leverHeights[i] ?? 0
      ctx.fillStyle = cols[i] ?? '#33ff66'
      ctx.fillRect(lx - 7, hy - 6, 14, 12)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 1.5
      ctx.strokeRect(lx - 7, hy - 6, 14, 12)
    })
  } else if (kind === 'wheel') {
    // 6-Spoke Valve Handwheel Icon
    ctx.strokeStyle = '#6e1a14'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(0, 0, 26, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = '#b8a46b'
    ctx.lineWidth = 3
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * -23, Math.sin(a) * -23)
      ctx.lineTo(Math.cos(a) * 23, Math.sin(a) * 23)
      ctx.stroke()
    }
    ctx.fillStyle = '#b8a46b'
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'az5') {
    // Hinged Hazard Cover & Red AZ-5 Button + Green Boron Plunger
    ctx.fillStyle = '#d49b27'
    ctx.fillRect(-32, -32, 64, 20)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2
    ctx.strokeRect(-32, -32, 64, 20)
    ctx.fillStyle = '#8b1e1e'
    ctx.beginPath()
    ctx.arc(-13, 12, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#145c26'
    ctx.beginPath()
    ctx.arc(16, 12, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (kind === 'octagon') {
    // Octagonal RBMK 37-Channel Bio-Shield Matrix Icon
    ctx.fillStyle = '#18211b'
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8
      const px = Math.cos(a) * 32
      const py = Math.sin(a) * 32
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#b8a46b'
    ctx.lineWidth = 2.5
    ctx.stroke()
    for (let gx = -15; gx <= 15; gx += 15) {
      for (let gy = -15; gy <= 15; gy += 15) {
        const isHot = (gx === 0 && gy === 0) || (gx === 15 && gy === -15)
        ctx.fillStyle = isHot ? '#ff2a2a' : '#33ff66'
        ctx.fillRect(gx - 5, gy - 5, 10, 10)
      }
    }
  } else if (kind === 'gas') {
    // Containment Toggles & Bubbler Sight-Glass Column Icon
    ctx.fillStyle = '#18211b'
    ctx.fillRect(-34, -30, 40, 60)
    ctx.strokeStyle = '#b8a46b'
    ctx.lineWidth = 2
    ctx.strokeRect(-34, -30, 40, 60)
    ;[-21, -7].forEach((tx) => {
      ctx.fillStyle = '#33ff66'
      ctx.beginPath()
      ctx.arc(tx, -12, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#cfc6b0'
      ctx.fillRect(tx - 2.5, 2, 5, 18)
    })
    ctx.fillStyle = '#0d110f'
    ctx.fillRect(14, -30, 18, 60)
    ctx.fillStyle = '#28d8ff'
    ctx.fillRect(17, -6, 12, 33)
    ctx.strokeStyle = '#b8a46b'
    ctx.strokeRect(14, -30, 18, 60)
  } else if (kind === 'rheostat') {
    // 50Hz Rotary Rheostat Dial with Pointer Bar
    ctx.fillStyle = '#18211b'
    ctx.beginPath()
    ctx.arc(0, 0, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#b8a46b'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.strokeStyle = '#33ff66'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, 22, -Math.PI * 0.8, -Math.PI * 0.2)
    ctx.stroke()
    ctx.strokeStyle = '#ffb000'
    ctx.lineWidth = 4.5
    ctx.beginPath()
    ctx.moveTo(0, 4)
    ctx.lineTo(0, -20)
    ctx.stroke()
  } else if (kind === 'breaker') {
    // Copper Knife-Switch MAIN BREAKER Icon
    ctx.fillStyle = '#18211b'
    ctx.fillRect(-32, -32, 64, 64)
    ctx.strokeStyle = '#ff2a2a'
    ctx.lineWidth = 2.5
    ctx.strokeRect(-32, -32, 64, 64)
    ctx.strokeStyle = '#d4874b'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(-11, 18)
    ctx.lineTo(-11, -16)
    ctx.moveTo(11, 18)
    ctx.lineTo(11, -16)
    ctx.stroke()
    ctx.fillStyle = '#6e1a14'
    ctx.fillRect(-20, -22, 40, 11)
  } else if (kind === 'printer') {
    // Pravda Printer & Magnifying Lens Icon
    ctx.fillStyle = '#2b302c'
    ctx.fillRect(-32, -8, 64, 36)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2
    ctx.strokeRect(-32, -8, 64, 36)
    ctx.fillStyle = '#e6dec3'
    ctx.fillRect(-22, -32, 44, 32)
    ctx.strokeRect(-22, -32, 44, 32)
    ctx.strokeStyle = '#b8a46b'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(10, -14, 12, 0, Math.PI * 2)
    ctx.stroke()
  } else if (kind === 'stamp') {
    // Stamp & Shredder Icon
    ctx.fillStyle = '#145c26'
    ctx.fillRect(-30, -24, 36, 18)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2
    ctx.strokeRect(-30, -24, 36, 18)
    ctx.fillStyle = '#6e1a14'
    ctx.fillRect(6, -28, 24, 56)
    ctx.strokeRect(6, -28, 24, 56)
    ctx.fillStyle = '#e6dec3'
    ctx.fillRect(-28, 2, 28, 24)
  } else if (kind === 'piston') {
    // Boron T-Handle Piston Pump Icon
    ctx.fillStyle = '#18211b'
    ctx.fillRect(-30, -32, 60, 64)
    ctx.strokeStyle = '#b8a46b'
    ctx.lineWidth = 2
    ctx.strokeRect(-30, -32, 60, 64)
    ctx.fillStyle = '#8a929a'
    ctx.fillRect(-4, -18, 8, 42)
    ctx.fillStyle = '#4a1210'
    ctx.fillRect(-22, -24, 44, 12)
    ctx.strokeStyle = '#111111'
    ctx.strokeRect(-22, -24, 44, 12)
  } else if (kind === 'vent') {
    // Steam Vent Lever & Guarded Toggle Icon
    ctx.fillStyle = '#18211b'
    ctx.fillRect(-32, -32, 64, 64)
    ctx.strokeStyle = '#b8a46b'
    ctx.lineWidth = 2
    ctx.strokeRect(-32, -32, 64, 64)
    ctx.strokeStyle = '#8a929a'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(-12, -20)
    ctx.lineTo(-12, 18)
    ctx.stroke()
    ctx.fillStyle = '#6e1a14'
    ctx.fillRect(-22, 10, 20, 12)
    ctx.fillStyle = '#d49b27'
    ctx.fillRect(8, -18, 16, 36)
  }

  ctx.restore()
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
  const cardX = 42
  const cardW = LW - 72
  const cardH = 196

  // Cream technical card body
  ctx.fillStyle = '#e6dfd0'
  ctx.fillRect(cardX, ry, cardW, cardH)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 2.5
  ctx.strokeRect(cardX, ry, cardW, cardH)

  // Top Header Badge Bar
  ctx.fillStyle = '#144722'
  ctx.fillRect(cardX, ry, cardW, 30)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 2
  ctx.strokeRect(cardX, ry, cardW, 30)

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.font = 'bold 17px "Courier Prime", monospace'
  ctx.fillText(card.badge, cardX + 10, ry + 21)

  // Left Schematic Mini-Diagram Box
  ctx.fillStyle = '#d6cdb8'
  ctx.fillRect(cardX + 2, ry + 31, 88, cardH - 33)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cardX + 90, ry + 30)
  ctx.lineTo(cardX + 90, ry + cardH)
  ctx.stroke()

  drawManualSchematicIcon(ctx, cardX + 46, ry + 113, card.icon)

  // Right Column Structured Breakdown: USE (Blue-Black), EFFECT (Green), REACTION (Crimson)
  const tx = cardX + 98
  ctx.textAlign = 'left'
  ctx.font = 'bold 15px "Courier Prime", monospace'

  // 1. HOW TO OPERATE (USE:)
  ctx.fillStyle = '#14264c'
  ctx.fillText(`USE: ${card.useLines[0]}`, tx, ry + 52)
  ctx.fillText(`     ${card.useLines[1]}`, tx, ry + 72)

  // Horizontal separator rule
  ctx.strokeStyle = '#b8ae96'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(tx, ry + 81)
  ctx.lineTo(cardX + cardW - 8, ry + 81)
  ctx.stroke()

  // 2. DIRECT ACTION / EFFECT (EFFECT:)
  ctx.fillStyle = '#13522d'
  ctx.fillText(`EFFECT: ${card.effectLines[0]}`, tx, ry + 101)
  ctx.fillText(`        ${card.effectLines[1]}`, tx, ry + 121)

  // Horizontal separator rule
  ctx.beginPath()
  ctx.moveTo(tx, ry + 130)
  ctx.lineTo(cardX + cardW - 8, ry + 130)
  ctx.stroke()

  // 3. COUNTER-REACTION / SIDE EFFECT (REACTION:)
  ctx.fillStyle = '#8a1c14'
  ctx.fillText(`REACTION: ${card.reactionLines[0]}`, tx, ry + 151)
  ctx.fillText(`          ${card.reactionLines[1]}`, tx, ry + 172)
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

  // Clean High-Contrast Manual Page Cardstock (#dfd8c5) shifted slightly right to clear the 3-ring binder holes
  ctx.fillStyle = '#dfd8c5'
  ctx.fillRect(14, 14, LW - 28, LH - 28)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 3
  ctx.strokeRect(20, 20, LW - 40, LH - 40)

  // Left-Edge Punched 3-Ring Binder Holes & Brass Reinforcements on Page
  ;[195, 388, 580].forEach((hy) => {
    ctx.fillStyle = '#b8a46b'
    ctx.beginPath()
    ctx.arc(32, hy, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2b1a12'
    ctx.beginPath()
    ctx.arc(32, hy, 5, 0, Math.PI * 2)
    ctx.fill()
  })

  // Scrollable Viewport Clip Area (y: 132 to LH - 66)
  ctx.save()
  ctx.beginPath()
  ctx.rect(24, 132, LW - 48, LH - 198)
  ctx.clip()
  ctx.translate(0, -scrollY * 1.55)

  if (page === 1) {
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 22px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('1. OFFICIAL SOVIET SEALS & SPECIMENS:', 44, 158)

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
      const ry = 170 + idx * 212
      ctx.fillStyle = '#dfd8c5'
      ctx.fillRect(42, ry, LW - 72, 198)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2.5
      ctx.strokeRect(42, ry, LW - 72, 198)

      drawOfficialSeal(
        ctx,
        102,
        ry + 99,
        52,
        row.type,
        'NONE',
        row.ink,
        isMagnified || true
      )

      ctx.fillStyle = '#111111'
      ctx.textAlign = 'left'
      ctx.font = 'bold 21px "Courier Prime", monospace'
      ctx.fillText(row.title, 164, ry + 34)
      ctx.fillStyle = '#1e2b22'
      ctx.font = 'bold 19px "Courier Prime", monospace'
      ctx.fillText(row.ministry, 164, ry + 66)
      ctx.fillStyle = '#145c26'
      ctx.font = 'bold 19px "Courier Prime", monospace'
      ctx.fillText(row.rule1, 164, ry + 104)
      ctx.fillText(row.rule2, 164, ry + 138)
      ctx.fillStyle = '#8b1e1e'
      ctx.fillText(row.rule3, 164, ry + 172)
    })
  } else if (page === 2) {
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 22px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('2. AUTHORIZED MINISTRIES & FONTS:', 44, 158)

    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(42, 170, LW - 72, 214)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2.5
    ctx.strokeRect(42, 170, LW - 72, 214)

    const validMinistries = [
      '1. MINISTRY OF MEDIUM MACHINE BLDG',
      '2. STATE COMMITTEE ATOMIC ENERGY',
      '3. COUNCIL OF MINISTERS USSR',
      '4. 5TH CHIEF DIRECTORATE',
    ]
    ctx.fillStyle = '#145c26'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    validMinistries.forEach((m, i) => {
      ctx.fillText(`✓ ${m}`, 52, 202 + i * 34)
    })
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 19px "Courier Prime", monospace'
    ctx.fillText('✗ SHRED ANY OTHER MINISTRY HEADER!', 52, 362)

    // Approved Fonts Box
    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(42, 398, LW - 72, 194)
    ctx.strokeStyle = '#145c26'
    ctx.lineWidth = 2.5
    ctx.strokeRect(42, 398, LW - 72, 194)
    ctx.fillStyle = '#145c26'
    ctx.font = 'bold 21px "Courier Prime", monospace'
    ctx.fillText('✓ APPROVED SOVIET FONTS (ГОСТ 84):', 52, 430)
    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('GOST_MONO', 21)
    ctx.fillText('• GOST MONO: ДИРЕКТИВА №44', 52, 468)
    ctx.font = 'bold 19px "Courier Prime", monospace'
    ctx.fillStyle = '#1e2b22'
    ctx.fillText('  Monospaced slab; flat terminals.', 52, 498)
    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('PRAVDA_BLOCK', 21)
    ctx.fillText('• PRAVDA BLOCK: ПРОТОКОЛ ГКАЭ', 52, 538)
    ctx.font = 'bold 19px "Courier Prime", monospace'
    ctx.fillStyle = '#1e2b22'
    ctx.fillText('  Heavy block strokes; zero slant.', 52, 570)

    // Forbidden Western Fonts Box
    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(42, 606, LW - 72, 202)
    ctx.strokeStyle = '#8b1e1e'
    ctx.lineWidth = 2.5
    ctx.strokeRect(42, 606, LW - 72, 202)
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 21px "Courier Prime", monospace'
    ctx.fillText('✗ FORBIDDEN WESTERN FONTS (SHRED!):', 52, 638)
    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('WESTERN_SERIF', 21)
    ctx.fillText('• WESTERN SERIF: Roman Serif 88', 52, 676)
    ctx.font = 'bold 19px "Courier Prime", monospace'
    ctx.fillStyle = '#8b1e1e'
    ctx.fillText('  Triangular serifs & thin strokes!', 52, 708)
    ctx.fillStyle = '#111111'
    ctx.font = getFontDeclaration('SLANTED_ITALIC', 21)
    ctx.fillText('• SLANTED / SANS: 12° Italic', 52, 748)
    ctx.font = 'bold 19px "Courier Prime", monospace'
    ctx.fillStyle = '#8b1e1e'
    ctx.fillText('  12° cursive slant or sans curves!', 52, 780)
  } else if (page === 3) {
    ctx.fillStyle = '#8b1e1e'
    ctx.font = 'bold 22px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('3. PAPER STOCK & MINISTRY INKS:', 44, 158)

    // Paper Stock Swatches
    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(42, 170, LW - 72, 292)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2.5
    ctx.strokeRect(42, 170, LW - 72, 292)
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 21px "Courier Prime", monospace'
    ctx.fillText('1. PAPER STOCK TINT SWATCHES:', 52, 202)

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
      const py = 218 + idx * 58
      ctx.fillStyle = p.hex
      ctx.fillRect(54, py, 36, 38)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2
      ctx.strokeRect(54, py, 36, 38)
      ctx.fillStyle = p.ok ? '#145c26' : '#8b1e1e'
      ctx.font = 'bold 20px "Courier Prime", monospace'
      ctx.fillText(p.label, 100, py + 16)
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 18px "Courier Prime", monospace'
      ctx.fillText(p.desc, 100, py + 40)
    })

    // Ministry Ink Swatches
    ctx.fillStyle = '#dfd8c5'
    ctx.fillRect(42, 476, LW - 72, 316)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 2.5
    ctx.strokeRect(42, 476, LW - 72, 316)
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 21px "Courier Prime", monospace'
    ctx.fillText('2. MANDATORY MINISTRY INKS:', 52, 508)

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
      const iy = 526 + idx * 62
      ctx.fillStyle = ink.hex
      ctx.fillRect(54, iy, 36, 38)
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 2
      ctx.strokeRect(54, iy, 36, 38)
      ctx.fillStyle = ink.ok ? '#111111' : '#8b1e1e'
      ctx.font = 'bold 20px "Courier Prime", monospace'
      ctx.fillText(ink.title, 100, iy + 16)
      ctx.fillStyle = ink.ok ? '#145c26' : '#8b1e1e'
      ctx.font = 'bold 19px "Courier Prime", monospace'
      ctx.fillText(ink.rule, 100, iy + 42)
    })
  } else if (page === 4) {
    // =========================================================================
    // SECTION II — TAB 4 (`4. HOW TO PLAY (SHIFT LOOP)`)
    // =========================================================================
    ctx.fillStyle = '#144722'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('4. HOW TO PLAY: 00:00-06:00 SHIFT LOOP', 44, 156)

    const loopCards: FieldGuideCardSpec[] = [
      {
        icon: 'az5',
        badge: '1. THE GOAL (SURVIVE 00:00 TO 06:00 SHIFT)',
        useLines: [
          'Press Keys [1]-[5] to move between panels',
          'or press [B] to hold this Manual in hand.',
        ],
        effectLines: [
          'Survive from 00:00 to 06:00 AM to complete',
          'your night shift at RBMK Sector 84.',
        ],
        reactionLines: [
          'Core Temp >1000°C triggers RBMK Meltdown!',
          '4 KGB Citations = immediate KGB arrest!',
        ],
      },
      {
        icon: 'printer',
        badge: '2. STEP 1 — TEAR & INSPECT ([KEY 4] DESK)',
        useLines: [
          'When ПРАВДА-84 prints a directive, grab &',
          'drag paper sideways across the tear-bar.',
        ],
        effectLines: [
          'Use the 2x Magnifying Glass & Section I',
          '(1.SEALS, 2.FONTS, 3.COLOURS) to inspect.',
        ],
        reactionLines: [
          'Missing a hidden CIA forgery flaw or taking',
          'too long earns a KGB Citation penalty!',
        ],
      },
      {
        icon: 'stamp',
        badge: '3. STEP 2 — STAMP [ОДОБРЕНО] & PNEUMATIC TUBE',
        useLines: [
          'GENUINE: Stamp ОДОБРЕНО, then drag onto or',
          'click the left ПНЕВМОПОЧТА Outbox Tube!',
        ],
        effectLines: [
          'Dispatches capsule & updates Regional Map',
          'MW targets (CITY / DEFENSE / VODKA).',
        ],
        reactionLines: [
          'FORGED: Drag into right Shredder & pull handle',
          '5x! Dispatching a forgery triggers sabotage!',
        ],
      },
      {
        icon: 'levers',
        badge: '4. STEP 3 — ROUTE MW & PROTECT VODKA WATER!',
        useLines: [
          'Drag 1.CITY, 2.DEFENSE, 3.VODKA levers on',
          'UNIT A [Key 1] to match Regional Map MW.',
        ],
        effectLines: [
          'Balance Cooling Pumps, Helium-N2 Gas Loop',
          '(UNIT B) & Bubbler Water Recycle (+12%/s).',
        ],
        reactionLines: [
          'Over-pumping river water (<40% Reservoir)',
          'causes a Vodka Distillery Water Drought!',
        ],
      },
    ]

    loopCards.forEach((c, idx) => {
      drawFieldGuideCard(ctx, LW, 168 + idx * 208, c)
    })
  } else if (page === 5) {
    // =========================================================================
    // SECTION II — TAB 5 (`5. UNIT A (MAIN REACTOR [KEY 1])`)
    // =========================================================================
    ctx.fillStyle = '#144722'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('5. UNIT A: MAIN REACTOR PANEL [KEY 1]', 44, 156)

    const unitACards: FieldGuideCardSpec[] = [
      {
        icon: 'levers',
        badge: '[KEY 1] REGIONAL MW LEVERS (1.CITY / 2.DEF / 3.VODKA)',
        useLines: [
          'Drag 1.CITY & AGRI, 2.DEFENSE GRID, and',
          '3.VODKA & STEEL levers directly (0-80 MW).',
        ],
        effectLines: [
          'Routes Megawatts to the 3 regional sectors',
          'on the K.O.M.R.A.D.-84 Map (+/-5 MW).',
        ],
        reactionLines: [
          'Higher MW heats CORE TEMP & PRESSURE and',
          'pulls GRID 50Hz [Key 5] off-center!',
        ],
      },
      {
        icon: 'wheel',
        badge: '[KEY 1] COOLING PUMPS A & B (RIVER WATER)',
        useLines: [
          'Grab 6-spoke wheel with mouse and crank in',
          'a circle (or up/down) through 6 steps.',
        ],
        effectLines: [
          'Pumps cold Pripyat river water through the',
          'core to lower CORE TEMP (°C).',
        ],
        reactionLines: [
          'Both pumps >110% drains WATER RESERVOIR',
          '(<40% = Vodka Drought! <10% = Pump Dry)!',
        ],
      },
      {
        icon: 'az5',
        badge: '[KEY 1] AZ-5 SCRAM & BORON INJECTION',
        useLines: [
          'AZ-5: Click cover open, then press button',
          '(>850°C). BORON: Press green plunger in.',
        ],
        effectLines: [
          'BORON drops CORE TEMP -85°C & -10 BAR.',
          'AZ-5 executes emergency full-core scram.',
        ],
        reactionLines: [
          'Consumes 35% of BORON TANK on UNIT A-2',
          '(must be hand-pumped back!) + 30s cooldown.',
        ],
      },
    ]

    unitACards.forEach((c, idx) => {
      drawFieldGuideCard(ctx, LW, 168 + idx * 208, c)
    })
  } else if (page === 6) {
    // =========================================================================
    // SECTION II — TAB 6 (`6. UNIT A-2 & B (AUX SYSTEMS [KEY 3])`)
    // =========================================================================
    ctx.fillStyle = '#144722'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('6. UNIT A-2 & B: AUX SYSTEMS [KEY 3]', 44, 156)

    const auxCards: FieldGuideCardSpec[] = [
      {
        icon: 'octagon',
        badge: '[UNIT A-2] RBMK 37-TILE CORE BIO-SHIELD',
        useLines: [
          'Watch the 37 steel channel caps. When a',
          'tile flashes AMBER/RED, click it directly.',
        ],
        effectLines: [
          'Slams a local control rod into the channel',
          'to quench local fuel channel overheating.',
        ],
        reactionLines: [
          'Every unquenched RED tile adds +5°C/s to',
          'CORE TEMP and +1.2 BAR/s to STEAM PRESSURE!',
        ],
      },
      {
        icon: 'wheel',
        badge: '[UNIT A-2] OIL COOLER VALVE (LEFT WHEEL)',
        useLines: [
          'Grab and crank the cast-iron handwheel',
          'on the lower-left of UNIT A-2 (0-100%).',
        ],
        effectLines: [
          'Cools down PUMP A/B BEARING HEAT (%) and',
          'restores LUBE OIL PRESSURE.',
        ],
        reactionLines: [
          'Diverts 15% of water pressure away from',
          'main reactor core cooling on UNIT A!',
        ],
      },
      {
        icon: 'piston',
        badge: '[UNIT A-2] BORON PISTON PUMP (T-HANDLE)',
        useLines: [
          'Grab the horizontal Bakelite T-handle on',
          'UNIT A-2 and pump it up & down repeatedly.',
        ],
        effectLines: [
          'Refills BORON RESERVE TANK back to 100%',
          'so BORON INJECTION and AZ-5 can function.',
        ],
        reactionLines: [
          'Requires physical pumping strokes after',
          'every BORON injection or AZ-5 scram!',
        ],
      },
      {
        icon: 'wheel',
        badge: '[UNIT B] HELIUM-N2 LOOP (DRY GAS COOLING)',
        useLines: [
          'Crank the left regulator handwheel on',
          'UNIT B to hold gas pressure at 40-55 BAR.',
        ],
        effectLines: [
          'Cools GRAPHITE (°C) & takes 35% heat load',
          'off water pumps WITHOUT using river water!',
        ],
        reactionLines: [
          'If GRAPHITE TEMP exceeds 650°C, positive',
          'void reactivity makes CORE TEMP skyrocket!',
        ],
      },
      {
        icon: 'gas',
        badge: '[UNIT B] BUBBLER DRAIN (WATER RECYCLING)',
        useLines: [
          'Flip 3 metal toggles UP to lock seals; hold',
          'down spring-loaded BUBBLER DRAIN lever.',
        ],
        effectLines: [
          'Condenses steam from CONDENSER % and',
          'recycles +12% water/s to WATER RESERVOIR!',
        ],
        reactionLines: [
          'Prevents Vodka Distillery Water Droughts!',
          'Pool >=90% blocks cooling & spikes BAR!',
        ],
      },
    ]

    auxCards.forEach((c, idx) => {
      drawFieldGuideCard(ctx, LW, 168 + idx * 208, c)
    })
  } else {
    // =========================================================================
    // SECTION II — TAB 7 (`7. TURBINE & GRID (RIGHT PANEL [KEY 5])`)
    // =========================================================================
    ctx.fillStyle = '#144722'
    ctx.font = 'bold 20px "Courier Prime", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('7. TURBINE & GRID (RIGHT PANEL [KEY 5])', 44, 156)

    const gridCards: FieldGuideCardSpec[] = [
      {
        icon: 'breaker',
        badge: '[KEY 5] MAIN BREAKER (COPPER KNIFE-SWITCH)',
        useLines: [
          'Grab the big red handle and drag it all the',
          'way UP into the copper jaws (or [SPACE]).',
        ],
        effectLines: [
          'Energizes the bunker and connects the',
          'turbine generator to the Soviet 50Hz grid.',
        ],
        reactionLines: [
          'Trips OPEN automatically into blackout if',
          'GRID HZ stays in the red zone for >8s!',
        ],
      },
      {
        icon: 'rheostat',
        badge: '[KEY 5] 50HZ RHEOSTAT (CENTER ROTARY DIAL)',
        useLines: [
          'Grab and drag left/right with mouse to',
          'rotate the ceramic dial through its clicks.',
        ],
        effectLines: [
          'Trims GRID FREQUENCY back to 50.0 Hz',
          '(12 o-clock) after changing MW on UNIT A.',
        ],
        reactionLines: [
          'Neglecting 50.0 Hz trips the MAIN BREAKER',
          'and plunges the control room into blackout!',
        ],
      },
      {
        icon: 'vent',
        badge: '[KEY 5] STEAM VENT (SPRING PULL-LEVER)',
        useLines: [
          'Grab and hold the right lever DOWN with',
          'your mouse (snaps back up on release).',
        ],
        effectLines: [
          'Rapidly dumps excess STEAM PRESSURE',
          '(-18 BAR/s) to prevent pipe rupture (>95).',
        ],
        reactionLines: [
          'Releases radioactive steam, spiking room',
          'DOSIMETER (R/H) & filling UNIT B bubbler!',
        ],
      },
      {
        icon: 'gas',
        badge: '[KEY 5] VENTILATION (GUARDED METAL TOGGLE)',
        useLines: [
          'Flip the bottom-left guarded metal toggle',
          'switch UP (ON) on the Right Panel.',
        ],
        effectLines: [
          'Scrubs radioactive contamination out of',
          'the control room (-1.2 R/H per second).',
        ],
        reactionLines: [
          'Draws +10 MW parasitic electrical load,',
          'pulling GRID HZ down & heating the core!',
        ],
      },
    ]

    gridCards.forEach((c, idx) => {
      drawFieldGuideCard(ctx, LW, 168 + idx * 208, c)
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
