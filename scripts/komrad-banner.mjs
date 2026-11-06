// K.O.M.R.A.D.-84 Terminal Shift Startup Bulletin (Sector 84)
import fs from 'node:fs'
import path from 'node:path'

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const forecasts = [
  '3.6 Roentgen/h — Not great, not terrible (Actually delightful!)',
  'Cherenkov Sky Glow: 100% Patriotic Illumination over Sector 84',
  'Canteen Menu: Boiled Cabbage Soup No. 4 with Potassium Iodide Mints',
  'CIA Teletype Interference: 0% (Liquidated by Party Firewall)',
]

const pick = forecasts[Math.floor(Math.random() * forecasts.length)]

let latestTelegramSubject = 'Ingen nye telegrafmeldinger fra Moskva.'
try {
  const telegrafPath = path.resolve(process.cwd(), 'PRAVDA_TELEGRAF.md')
  if (fs.existsSync(telegrafPath)) {
    const content = fs.readFileSync(telegrafPath, 'utf8')
    const subjects = [...content.matchAll(/- \*\*EMNE:\*\*\s*(.+)/g)]
    if (subjects.length > 0) {
      latestTelegramSubject = subjects[subjects.length - 1][1].trim()
    }
  }
} catch {
  // Ignore file read errors
}

try {
  const hooksDir = path.resolve(process.cwd(), '.git/hooks')
  if (fs.existsSync(hooksDir)) {
    const preCommitPath = path.join(hooksDir, 'pre-commit')
    const hookContent = '#!/bin/sh\nnode scripts/kgb-border-hook.mjs\n'
    if (!fs.existsSync(preCommitPath) || fs.readFileSync(preCommitPath, 'utf8') !== hookContent) {
      fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 })
    }
  }
} catch {
  // Ignore git hook setup errors
}

process.stdout.write(
  `\n${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════════════╗${RESET}\n` +
    `${GREEN}${BOLD}║  ☭  PEOPLE'S AUTOMATED NUCLEAR PLANT NO. 4 — SECTOR 84 (1984)         ☢️  ║${RESET}\n` +
    `${GREEN}${BOLD}║  K.O.M.R.A.D.-84 // CENTRAL CONTROL ROOM TELEMETRY SERVER                ║${RESET}\n` +
    `${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${RESET}\n` +
    `${GREEN}║  • Chief Engineer  : ${YELLOW}Komrad Kristianov${GREEN} (Branch: ${BOLD}Komrad-Kristianov${RESET}${GREEN})     ║${RESET}\n` +
    `${GREEN}║  • Senior Inspector: ${YELLOW}Komrad Oleg${GREEN}       (Branch: ${BOLD}Komrad-Oleg${RESET}${GREEN})           ║${RESET}\n` +
    `${GREEN}║  • Røde Telegraf   : ${CYAN}${latestTelegramSubject.padEnd(51, ' ').slice(0, 51)}${GREEN} ║${RESET}\n` +
    `${GREEN}║  • Sector Bulletin : ${pick.padEnd(51, ' ').slice(0, 51)} ║${RESET}\n` +
    `${GREEN}║  • Supreme Axiom   : ${RED}${BOLD}MELTDOWN IS CAPITALIST PROPAGANDA${RESET}${GREEN}                   ║${RESET}\n` +
    `${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════════════╝${RESET}\n\n`
)
