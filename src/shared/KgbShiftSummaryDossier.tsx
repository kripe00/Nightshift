import { useEffect, useState } from 'react'
import { playPaperRustle, playStampInkThud } from '../modules/inspector/audio'
import type { ShiftSummaryData } from './types'

interface CommissarRemark {
  prefix: string
  redacted: string
  suffix: string
}

const COMMISSAR_REMARKS: CommissarRemark[] = [
  {
    prefix: 'Acoustic monitoring confirms operator spoke 0 treasonous words near ',
    redacted: 'COOLANT VALVE 4',
    suffix: '. Ration of synthetic cabbage approved.',
  },
  {
    prefix: 'Dosimeter badge registered ',
    redacted: '42 ROENTGEN-HOURS',
    suffix: '; reclassified as patriotic central-heating warmth by Sector 84 decree.',
  },
  {
    prefix: 'K.O.M.R.A.D.-84 flagged slight hesitation before honoring ',
    redacted: 'PRIPYAT GRID PRIORITY',
    suffix: '. Desk lamp bulb wattage halved for one week.',
  },
  {
    prefix: 'Pneumatic tube residue tested positive for ',
    redacted: 'CANTEEN BORSCHT OIL',
    suffix: '. Please wipe gloves before stamping state orders.',
  },
  {
    prefix: 'Duga-1 harmonic bleed detected during ',
    redacted: '03:14 SUBSTATION SHIFT',
    suffix: '. Any ringing in teeth remains normal.',
  },
  {
    prefix: 'Lubyanka archive confirms operator filed ',
    redacted: 'CLASSIFIED FORGERIES',
    suffix: ' without asking unauthorized questions about Sector 07.',
  },
]

const STRIKE_X_ANGLES = [-5, 3, -2, 4, -6, 2] as const

function getQuotaEvaluation(completed: number, target: number): {
  label: string
  color: string
  border: string
  bg: string
} {
  if (completed <= 0) {
    return {
      label: 'PARASITIC MINIMUM',
      color: '#8f1d1d',
      border: '#8f1d1d',
      bg: 'rgba(143, 29, 29, 0.09)',
    }
  }
  if (completed <= 2) {
    return {
      label: 'BARELY TOLERATED',
      color: '#8a4b08',
      border: '#8a4b08',
      bg: 'rgba(138, 75, 8, 0.09)',
    }
  }
  if (completed < target) {
    return {
      label: 'ACCEPTABLE COMPLIANCE',
      color: '#2c3a2b',
      border: '#2c3a2b',
      bg: 'rgba(44, 58, 43, 0.08)',
    }
  }
  return {
    label: 'HERO OF SOCIALIST LABOR',
    color: '#1a5c2a',
    border: '#1a5c2a',
    bg: 'rgba(26, 92, 42, 0.1)',
  }
}

function getRubberStampConfig(
  completedStr: string,
  quotaMet: boolean,
  treasonStrikes: number
): {
  headline: string
  subline: string
  inkHex: string
  bgTint: string
} {
  if (treasonStrikes >= 3) {
    return {
      headline: 'PROVISIONAL CLEARANCE',
      subline: `WATCHLIST • SHIFT ${completedStr} — 06:00`,
      inkHex: '#9c1616',
      bgTint: 'rgba(156, 22, 22, 0.06)',
    }
  }
  if (quotaMet) {
    return {
      headline: 'STAKHANOVITE EXEMPLAR',
      subline: `SHIFT ${completedStr} CLEARED // 06:00`,
      inkHex: '#1b5e2e',
      bgTint: 'rgba(27, 94, 46, 0.06)',
    }
  }
  return {
    headline: `SHIFT ${completedStr} CLEARED`,
    subline: '06:00 HRS // APPROVED',
    inkHex: '#8f1d1d',
    bgTint: 'rgba(143, 29, 29, 0.055)',
  }
}

function KgbAtomicCrestSvg() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-12 w-12 shrink-0 sm:h-14 sm:w-14"
      aria-hidden="true"
    >
      {/* Shield outline */}
      <path
        d="M12 8 L32 4 L52 8 L50 34 C49 47 32 58 32 58 C32 58 15 47 14 34 Z"
        fill="rgba(143, 29, 29, 0.06)"
        stroke="#8f1d1d"
        strokeWidth="2.2"
      />
      <path
        d="M16 12 L32 8.5 L48 12 L46.5 33.5 C45.5 44 32 53 32 53 C32 53 18.5 44 17.5 33.5 Z"
        fill="none"
        stroke="#1c1b18"
        strokeWidth="1"
        strokeDasharray="2 1.5"
      />
      {/* Top Soviet Star */}
      <polygon
        points="32,10.5 33.6,14.8 38.2,14.8 34.5,17.4 35.9,21.8 32,19.1 28.1,21.8 29.5,17.4 25.8,14.8 30.4,14.8"
        fill="#8f1d1d"
      />
      {/* Atom orbitals */}
      <g transform="translate(32 34)" stroke="#1c1b18" strokeWidth="1.3" fill="none">
        <ellipse rx="12" ry="4.5" transform="rotate(0)" />
        <ellipse rx="12" ry="4.5" transform="rotate(60)" />
        <ellipse rx="12" ry="4.5" transform="rotate(120)" />
        <circle r="3.4" fill="#8f1d1d" stroke="#1c1b18" strokeWidth="1" />
      </g>
      {/* Sword / column shaft */}
      <line x1="32" y1="23" x2="32" y2="49" stroke="#8f1d18" strokeWidth="1.2" opacity="0.55" />
    </svg>
  )
}

function CornerPaperclipAndStaplesSvg() {
  return (
    <svg
      viewBox="0 0 90 95"
      className="pointer-events-none absolute -top-2.5 left-2.5 z-30 h-20 w-20 drop-shadow-[1px_2px_2px_rgba(0,0,0,0.45)]"
      aria-hidden="true"
    >
      {/* Twin brass/rusted staples pinning upper corner */}
      <g transform="translate(38, 12) rotate(-14)">
        <rect x="0" y="0" width="16" height="3.2" rx="1.2" fill="#8b6f3d" stroke="#3c2d14" strokeWidth="0.7" />
        <rect x="2" y="0.6" width="12" height="1" fill="#c7ab70" opacity="0.7" />
      </g>
      <g transform="translate(56, 17) rotate(6)">
        <rect x="0" y="0" width="15" height="3" rx="1.1" fill="#7c5d36" stroke="#352512" strokeWidth="0.7" />
        <rect x="2" y="0.6" width="11" height="0.9" fill="#b79664" opacity="0.65" />
      </g>
      {/* Oxidized steel paperclip */}
      <g transform="translate(8, 2) rotate(-18)">
        <path
          d="M14 6 L14 48 C14 55 24 55 24 48 L24 14 C24 9 17 9 17 14 L17 42 C17 45.5 21 45.5 21 42 L21 18"
          fill="none"
          stroke="#2f3235"
          strokeWidth="3.3"
          strokeLinecap="round"
        />
        <path
          d="M14 6 L14 48 C14 55 24 55 24 48 L24 14 C24 9 17 9 17 14 L17 42 C17 45.5 21 45.5 21 42 L21 18"
          fill="none"
          stroke="#8a8f94"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Rust accent */}
        <path
          d="M14 26 L14 38 M24 22 L24 31"
          fill="none"
          stroke="#7f4324"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>
    </svg>
  )
}

function VolkovSignatureSvg() {
  return (
    <svg
      viewBox="0 0 180 42"
      className="h-8 w-36 overflow-visible"
      aria-hidden="true"
    >
      <path
        d="M8 30 C14 14, 22 6, 23 26 C24 34, 34 10, 42 12 C46 13, 39 29, 46 27 C52 25, 55 17, 60 20 C63 22, 61 29, 68 25 C75 21, 79 11, 82 26 C84 32, 92 18, 99 22 C106 25, 114 16, 121 22 C128 28, 138 15, 168 19"
        fill="none"
        stroke="#1a2844"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 33 C58 31, 108 29, 158 31"
        fill="none"
        stroke="#1a2844"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.82"
      />
    </svg>
  )
}

function ArchivalSealSvg() {
  return (
    <svg viewBox="0 0 72 72" className="h-12 w-12 shrink-0 opacity-75" aria-hidden="true">
      <circle cx="36" cy="36" r="31" fill="none" stroke="#8f1d1d" strokeWidth="1.8" />
      <circle
        cx="36"
        cy="36"
        r="25"
        fill="none"
        stroke="#8f1d1d"
        strokeWidth="1"
        strokeDasharray="2.5 2"
      />
      <text
        x="36"
        y="25"
        textAnchor="middle"
        fill="#8f1d1d"
        fontSize="6.5"
        fontFamily="Courier Prime, monospace"
        fontWeight="700"
        letterSpacing="0.8"
      >
        KGB ARCHIVE
      </text>
      <polygon
        points="36,29 37.4,33 41.6,33 38.2,35.4 39.5,39.4 36,37 32.5,39.4 33.8,35.4 30.4,33 34.6,33"
        fill="#8f1d1d"
      />
      <text
        x="36"
        y="48"
        textAnchor="middle"
        fill="#8f1d1d"
        fontSize="5.8"
        fontFamily="Courier Prime, monospace"
        fontWeight="700"
      >
        GOST 9327-60
      </text>
    </svg>
  )
}

export function KgbShiftSummaryDossier({
  summary,
  onBeginNextShift,
  isTransitioning = false,
}: {
  summary: ShiftSummaryData
  onBeginNextShift: () => void
  isTransitioning?: boolean
}) {
  const [stampSlammed, setStampSlammed] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('iskra-terminal-seated')
    document.body.classList.remove('iskra-terminal-seated')
    document.body.style.cursor = ''
    if (document.pointerLockElement) {
      document.exitPointerLock?.()
    }

    const paperTimer = window.setTimeout(() => {
      playPaperRustle(false)
    }, 40)

    const stampTimer = window.setTimeout(() => {
      setStampSlammed(true)
      playStampInkThud(summary.treasonStrikes >= 3 ? 'SHREDDED' : 'APPROVED')
    }, 320)

    return () => {
      window.clearTimeout(paperTimer)
      window.clearTimeout(stampTimer)
    }
  }, [summary.treasonStrikes])

  const completedStr = String(summary.completedShiftNumber).padStart(2, '0')
  const nextStr = String(summary.nextShiftNumber).padStart(2, '0')
  const quotaMet = summary.quotaCompleted >= summary.quotaTarget
  const quotaEval = getQuotaEvaluation(summary.quotaCompleted, summary.quotaTarget)
  const rubberStamp = getRubberStampConfig(
    completedStr,
    quotaMet,
    summary.treasonStrikes
  )

  const remarkIdx =
    Math.abs(
      summary.completedShiftNumber * 3 +
        summary.treasonStrikes * 2 +
        summary.quotaCompleted
    ) % COMMISSAR_REMARKS.length
  const remark = COMMISSAR_REMARKS[remarkIdx]

  return (
    <div
      data-testid="sovos-shift-summary"
      className="fixed inset-0 z-50 flex cursor-default items-center justify-center p-3 select-none sm:p-5"
      style={{
        backgroundColor: 'rgba(6, 7, 8, 0.92)',
        backgroundImage:
          'radial-gradient(ellipse 68% 60% at 50% 42%, rgba(255, 212, 138, 0.17) 0%, rgba(215, 148, 66, 0.06) 38%, rgba(6, 7, 8, 0.96) 78%), radial-gradient(circle at 50% 50%, transparent 45%, rgba(0, 0, 0, 0.72) 100%)',
      }}
    >
      {/* Dossier Assembly Container */}
      <div className="kgb-dossier-slide-in relative my-auto w-full max-w-[780px] pt-5">
        {/* Outer Weathered Olive-Tan Manila Folder Backing (-0.8deg) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[-12px] top-3 bottom-[-10px] rounded-[3px] border border-[#52452b] shadow-[0_24px_56px_rgba(0,0,0,0.85)] sm:inset-x-[-16px]"
          style={{
            transform: 'rotate(-0.8deg)',
            background:
              'linear-gradient(155deg, #ab9870 0%, #927f58 55%, #776645 100%)',
            boxShadow:
              '0 24px 56px rgba(0, 0, 0, 0.85), inset 0 0 28px rgba(42, 32, 16, 0.35)',
          }}
        >
          {/* Protruding Top-Left Manila Folder Index Tab */}
          <div
            className="absolute -top-5 left-12 flex h-6 items-center rounded-t-[4px] border border-b-0 border-[#52452b] px-3.5 shadow-[0_-2px_6px_rgba(0,0,0,0.3)] sm:left-14"
            style={{
              background: 'linear-gradient(180deg, #b8a67d 0%, #a5936b 100%)',
              fontFamily: '"Courier Prime", monospace',
            }}
          >
            <span className="text-[10px] font-bold tracking-[0.14em] text-[#241d12] uppercase sm:text-[11px]">
              FILE NO. 84-MCR // OPERATOR DOSSIER
            </span>
          </div>
          {/* Subtle Folder Spine Crease */}
          <div
            className="absolute inset-y-2 left-2.5 w-[2px] opacity-30"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, #3d311d 15%, #3d311d 85%, transparent 100%)',
            }}
          />
        </div>

        {/* Rusted Staples & Paperclip Pinning Paper to Manila Folder */}
        <CornerPaperclipAndStaplesSvg />

        {/* Aged Soviet Paper Sheet (GOST 9327-60) */}
        <div
          className={`relative max-h-[89vh] overflow-y-auto rounded-[2px] border border-[#8c7f66] px-6 py-4 text-[#1c1b18] sm:px-9 sm:py-5 ${
            stampSlammed ? 'kgb-paper-impact-jolt' : ''
          }`}
          style={{
            background:
              'radial-gradient(ellipse at 50% 42%, #e6dec8 0%, #ded5be 58%, #cfc3a6 100%)',
            boxShadow:
              '0 14px 38px rgba(0, 0, 0, 0.7), inset 0 0 32px rgba(96, 77, 45, 0.16)',
            fontFamily: '"Courier Prime", monospace',
          }}
        >
          {/* Procedural SVG Fractal-Noise Paper Grain Overlay */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.085] mix-blend-multiply"
            aria-hidden="true"
          >
            <filter id="kgb-paper-grain">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.75"
                numOctaves="3"
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter="url(#kgb-paper-grain)" />
          </svg>

          {/* Horizontal Mid-Page Fold Crease */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[48%] z-10 h-[3px] opacity-40"
            style={{
              background:
                'linear-gradient(180deg, rgba(60, 48, 28, 0.28) 0%, rgba(255, 250, 238, 0.65) 55%, transparent 100%)',
            }}
          />

          {/* Subtle Coffee-Mug Ring Stain Near Bottom Margin */}
          <svg
            viewBox="0 0 110 110"
            className="pointer-events-none absolute right-8 bottom-16 z-0 h-24 w-24 opacity-80"
            aria-hidden="true"
          >
            <circle
              cx="55"
              cy="55"
              r="38"
              fill="none"
              stroke="rgba(104, 65, 32, 0.13)"
              strokeWidth="4.2"
              strokeDasharray="190 14 42 8"
            />
            <circle
              cx="57"
              cy="54"
              r="35.5"
              fill="none"
              stroke="rgba(104, 65, 32, 0.09)"
              strokeWidth="1.6"
            />
            <circle cx="88" cy="34" r="2.2" fill="rgba(104, 65, 32, 0.11)" />
          </svg>

          {/* Twin Vertical Red Security Margin Lines + Side Micro-Print */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-5 z-10 flex gap-[2px] sm:left-6"
          >
            <div className="h-full w-[1px] bg-[#9c2b2b]/45" />
            <div className="h-full w-[1px] bg-[#9c2b2b]/25" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1 z-10 hidden -translate-y-1/2 text-[7.5px] font-bold tracking-[0.16em] text-[#8f1d1d]/65 uppercase sm:block"
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
            }}
          >
            DO NOT FOLD OR MUTILATE // PROPERTY OF KGB 4TH DIRECTORATE
          </div>

          {/* Animated Diagonal Wet-Ink Rubber Stamp */}
          {stampSlammed && (
            <div
              data-testid="shift-complete-stamp"
              className="kgb-rubber-stamp-slam pointer-events-none absolute top-12 right-5 z-20 border-4 border-double px-3.5 py-1.5 text-center uppercase mix-blend-multiply sm:top-14 sm:right-8 sm:px-4"
              style={{
                borderColor: rubberStamp.inkHex,
                color: rubberStamp.inkHex,
                backgroundColor: rubberStamp.bgTint,
                boxShadow: `inset 0 0 8px ${rubberStamp.bgTint}`,
              }}
            >
              <div
                className="text-sm font-bold tracking-[0.16em] sm:text-base"
                style={{ fontFamily: '"Kremlin", "Courier Prime", monospace' }}
              >
                {rubberStamp.headline}
              </div>
              <div className="text-[10px] font-bold tracking-[0.18em] sm:text-[11px]">
                {rubberStamp.subline}
              </div>
            </div>
          )}

          {/* Main Paper Content Wrapper (offset inside red margin line) */}
          <div className="relative z-10 pl-3 sm:pl-4">
            {/* Official Ministry & KGB Letterhead */}
            <header className="flex flex-col gap-2.5 border-b-2 border-[#1c1b18] pb-2.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2.5">
                <KgbAtomicCrestSvg />
                <div>
                  <div className="text-[12px] leading-tight font-bold tracking-[0.07em] text-[#8f1d1d] uppercase sm:text-[13px]">
                    USSR COMMITTEE FOR STATE SECURITY (KGB) — FOURTH DIRECTORATE
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold tracking-[0.06em] text-[#1c1b18] uppercase sm:text-[12px]">
                    MINISTRY OF MEDIUM MACHINE BUILDING // SECTOR 84 RBMK-1000
                  </div>
                  <div className="mt-0.5 text-[10px] tracking-[0.12em] text-[#474237] uppercase">
                    END-OF-SHIFT OPERATIONAL CLEARANCE &amp; GOSBANK PAY VOUCHER
                  </div>
                </div>
              </div>

              <div className="shrink-0 border border-[#2b2822] bg-[#d6ccb2]/60 px-2.5 py-1 text-[9.5px] leading-[1.35] tracking-[0.06em] uppercase sm:text-right">
                <div className="font-bold text-[#1c1b18]">
                  FORM 84-T // STRICT ACCOUNTING
                </div>
                <div className="font-bold text-[#8f1d1d]">
                  CLASSIFICATION: TOP SECRET
                </div>
                <div className="text-[#3e3a31]">
                  COPY 1 OF 3 (LUBYANKA ARCHIVE)
                </div>
              </div>
            </header>

            {/* Section I — Operational Duty Record */}
            <section className="mt-2.5">
              <div className="mb-1 flex items-center justify-between border-b border-[#4a4439] pb-0.5 text-[10.5px] font-bold tracking-[0.12em] text-[#1c1b18] uppercase">
                <span>SECTION I — OPERATIONAL DUTY RECORD</span>
                <span className="text-[9.5px] text-[#575043]">LOG REF: MCR4-{completedStr}</span>
              </div>

              <div className="space-y-1 text-[11.5px] leading-snug sm:text-[12px]">
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-bold text-[#38342c]">
                    SHIFT DESIGNATION:
                  </span>
                  <span className="flex-1 border-b border-dotted border-[#7a705d]" />
                  <span className="shrink-0 font-bold text-[#1c1b18]">
                    SHIFT {completedStr} (00:00 – 06:00 HRS)
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-bold text-[#38342c]">
                    REACTOR CONTAINMENT STATUS:
                  </span>
                  <span className="flex-1 border-b border-dotted border-[#7a705d]" />
                  <span className="shrink-0 font-bold text-[#1c1b18]">
                    NOMINAL // MELTDOWN REMAINS PROPAGANDA
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="shrink-0 font-bold text-[#38342c]">
                    STATE DIRECTIVE QUOTAS:
                  </span>
                  <span className="hidden flex-1 border-b border-dotted border-[#7a705d] sm:inline-block" />
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-[#1c1b18]">
                      {summary.quotaCompleted} / {summary.quotaTarget} FULFILLED
                    </span>
                    <span
                      className="border px-1.5 py-[1px] text-[10px] font-bold tracking-[0.08em] uppercase"
                      style={{
                        color: quotaEval.color,
                        borderColor: quotaEval.border,
                        backgroundColor: quotaEval.bg,
                      }}
                    >
                      {quotaEval.label}
                    </span>
                  </span>
                </div>
              </div>
            </section>

            {/* Section II — State Gosbank Payroll & Ruble Voucher */}
            <section className="mt-2.5">
              <div className="mb-1 border-b border-[#4a4439] pb-0.5 text-[10.5px] font-bold tracking-[0.12em] text-[#1c1b18] uppercase">
                SECTION II — STATE GOSBANK PAYROLL &amp; RUBLE VOUCHER
              </div>

              <table className="w-full border-collapse text-[11px] sm:text-[11.5px]">
                <thead>
                  <tr className="border-b border-[#4a4439] bg-[#d4cab0]/65 text-left text-[9.5px] tracking-[0.1em] text-[#3a352b] uppercase">
                    <th className="border-r border-[#8d826b] px-2 py-1 font-bold">
                      ITEM CODE
                    </th>
                    <th className="border-r border-[#8d826b] px-2 py-1 font-bold">
                      ALLOCATION DESCRIPTION
                    </th>
                    <th className="px-2 py-1 text-right font-bold">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#a79c84]">
                    <td className="border-r border-[#8d826b] px-2 py-1 font-bold text-[#38342c]">
                      84-A
                    </td>
                    <td className="border-r border-[#8d826b] px-2 py-1 text-[#1c1b18]">
                      Night Shift Survival Stipend (Radiation Hazard Tier I)
                    </td>
                    <td className="px-2 py-1 text-right font-bold text-[#1a5c2a]">
                      +{summary.baseBonusRubles} RUB
                    </td>
                  </tr>
                  <tr className="border-b border-[#4a4439]">
                    <td className="border-r border-[#8d826b] px-2 py-1 font-bold text-[#38342c]">
                      84-B
                    </td>
                    <td className="border-r border-[#8d826b] px-2 py-1 text-[#1c1b18]">
                      Stakhanovite 5/5 Quota Bonus
                    </td>
                    <td
                      className={`px-2 py-1 text-right font-bold ${
                        quotaMet ? 'text-[#1a5c2a]' : 'text-[#8f1d1d]/85'
                      }`}
                    >
                      {quotaMet
                        ? `+${summary.quotaBonusRubles} RUB`
                        : '0 RUB — QUOTA UNMET'}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-[#d6ccb2]/45">
                    <td
                      colSpan={2}
                      className="px-2 py-1.5 text-right text-[11px] font-bold tracking-[0.06em] text-[#1c1b18] uppercase"
                    >
                      TREASURY BALANCE CARRIED TO SHIFT {nextStr}:
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span
                        data-testid="shift-summary-rubles"
                        className="inline-block border-b-[3px] border-double border-[#1c1b18] pb-[1px] text-[13px] font-bold text-[#1c1b18]"
                      >
                        {summary.totalRublesAfterBonus} RUB
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>

            {/* Section III — KGB Ideological & Treason Dossier */}
            <section className="mt-2.5">
              <div className="mb-1.5 flex items-center justify-between border-b border-[#4a4439] pb-0.5 text-[10.5px] font-bold tracking-[0.12em] text-[#1c1b18] uppercase">
                <span>SECTION III — KGB IDEOLOGICAL &amp; TREASON DOSSIER</span>
                <span
                  className={`text-[10.5px] font-bold ${
                    summary.treasonStrikes >= 4
                      ? 'text-[#8f1d1d]'
                      : summary.treasonStrikes > 0
                        ? 'text-[#8a4b08]'
                        : 'text-[#1a5c2a]'
                  }`}
                >
                  {summary.treasonStrikes} / 6 STRIKES CARRIED FORWARD
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* 6 Physical Square Inspection Punch Boxes */}
                <div className="flex items-center gap-2">
                  {Array.from({ length: 6 }, (_, idx) => {
                    const isMarked = idx < summary.treasonStrikes
                    const boxNum = String(idx + 1).padStart(2, '0')
                    return (
                      <div
                        key={boxNum}
                        className="relative flex h-8 w-8 flex-col items-center justify-center border border-[#2b2822] bg-[#e8e0cb]/70"
                        style={{
                          boxShadow: isMarked
                            ? 'inset 0 0 6px rgba(143, 29, 29, 0.22)'
                            : 'inset 0 1px 2px rgba(0, 0, 0, 0.08)',
                        }}
                      >
                        <span className="absolute top-[1px] left-[2px] text-[7px] leading-none text-[#5d5547]">
                          {boxNum}
                        </span>
                        {isMarked ? (
                          <span
                            className="text-lg leading-none font-bold text-[#9c1616]"
                            style={{
                              transform: `rotate(${STRIKE_X_ANGLES[idx]}deg)`,
                            }}
                          >
                            X
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#8d8370]"> </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Stern Strike Advisory */}
                <div
                  className={`flex-1 border px-2.5 py-1 text-[10px] leading-snug font-bold uppercase ${
                    summary.treasonStrikes >= 4
                      ? 'border-[#8f1d1d] bg-[#8f1d1d]/10 text-[#8f1d1d]'
                      : summary.treasonStrikes >= 1
                        ? 'border-[#8a4b08]/60 bg-[#8a4b08]/8 text-[#7a4106]'
                        : 'border-[#4a5743]/50 bg-[#2c3a2b]/6 text-[#2c3a2b]'
                  }`}
                >
                  {summary.treasonStrikes >= 4
                    ? 'WARNING: CRITICAL PROXIMITY TO LIQUIDATION (6/6). SIBERIAN PERMAFROST SHOVEL BRIGADE TRANSFER ORDERS PRE-DRAFTED.'
                    : summary.treasonStrikes >= 1
                      ? 'CAUTION: IDEOLOGICAL DEFICIENCIES REMAIN PERMANENTLY FILED IN LUBYANKA ARCHIVE.'
                      : 'RECORD UNBLEMISHED — OPERATOR LOYALTY REGISTERED FOR FIVE-YEAR PLAN AUDIT.'}
                </div>
              </div>
            </section>

            {/* Section IV — Commissar Remarks & Signatures */}
            <section className="mt-2.5">
              <div className="mb-1 border-b border-[#4a4439] pb-0.5 text-[10.5px] font-bold tracking-[0.12em] text-[#1c1b18] uppercase">
                SECTION IV — COMMISSAR REMARKS &amp; SIGNATURES
              </div>

              <p className="border-l-2 border-[#8f1d1d]/70 bg-[#d5cbb1]/55 px-2.5 py-1 text-[11px] leading-snug text-[#1c1b18] italic">
                &ldquo;{remark.prefix}
                <span
                  aria-label="REDACTED"
                  className="mx-0.5 inline-block rounded-[1px] bg-[#161513] px-1.5 not-italic text-transparent select-none"
                >
                  {remark.redacted}
                </span>
                {remark.suffix}&rdquo;
              </p>

              {/* Signature Strip */}
              <div className="mt-2 grid grid-cols-1 items-end gap-2 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <div className="pl-1">
                    <VolkovSignatureSvg />
                  </div>
                  <div className="border-t border-[#2b2822] pt-0.5 text-[10px] leading-tight">
                    <span className="font-bold text-[#1c1b18]">
                      Commissar V. Volkov
                    </span>{' '}
                    <span className="text-[#4a4338]">— Inspectorate Chief</span>
                  </div>
                </div>

                <div className="sm:col-span-5">
                  <div
                    className="border border-dashed border-[#2b5434] bg-[#cfd5c3]/65 px-2 py-1 text-center text-[#194022]"
                    style={{ fontFamily: '"VT323", "Courier Prime", monospace' }}
                  >
                    <div className="text-[13px] leading-none font-bold tracking-[0.08em]">
                      K.O.M.R.A.D.-84 // AUTO-VERIFIED 06:00
                    </div>
                    <div className="mt-0.5 text-[10px] leading-none tracking-[0.08em] text-[#324637]">
                      DATE: 04.11.1984 • SECTOR 84 TELEMETRY
                    </div>
                  </div>
                </div>

                <div className="hidden justify-end sm:col-span-2 sm:flex">
                  <ArchivalSealSvg />
                </div>
              </div>
            </section>

            {/* Perforated Operator Acknowledgment Tear-Off Slip */}
            <div className="mt-3 pt-1">
              <div className="mb-2 flex items-center gap-2 text-[9.5px] font-bold tracking-[0.18em] text-[#5c5342] uppercase">
                <span className="shrink-0">✂</span>
                <span className="flex-1 border-t border-dashed border-[#6d624f]" />
                <span className="shrink-0">OPERATOR ACKNOWLEDGMENT SLIP</span>
                <span className="flex-1 border-t border-dashed border-[#6d624f]" />
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  data-testid="proceed-next-shift-lobby-btn"
                  disabled={isTransitioning}
                  onClick={onBeginNextShift}
                  className="group relative cursor-pointer border-2 border-[#6e1616] bg-[#d8cca8] px-5 py-2 text-[13px] font-bold tracking-[0.08em] text-[#5e1111] uppercase shadow-[0_3px_0_#4c3f28,0_6px_14px_rgba(0,0,0,0.28)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[#8f1d1d] hover:bg-[#e8d5a3] hover:text-[#781212] hover:shadow-[0_4px_0_#4c3f28,0_0_20px_rgba(255,204,112,0.35)] active:translate-y-[1px] active:shadow-[0_1px_0_#4c3f28] disabled:cursor-default disabled:opacity-75 sm:px-7 sm:text-[14.5px]"
                  style={{ fontFamily: '"Courier Prime", monospace' }}
                >
                  <span className="pointer-events-none absolute inset-[2px] border border-[#6e1616]/45 group-hover:border-[#8f1d1d]/70" />
                  [ SIGN VOUCHER &amp; BEGIN SHIFT {nextStr} ]
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
