// TASS / PRAVDA Terminal Bulletin & Stakhanovite Socialist Competition Tracker
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function runGit(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

function countDomainStats(dirs) {
  let files = 0
  let lines = 0
  for (const relDir of dirs) {
    const fullDir = path.resolve(process.cwd(), relDir)
    if (!fs.existsSync(fullDir)) continue
    const entries = fs.readdirSync(fullDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && /\.(ts|tsx|css|json)$/.test(entry.name)) {
        files++
        const content = fs.readFileSync(path.join(fullDir, entry.name), 'utf8')
        lines += content.split('\n').length
      }
    }
  }
  return { files, lines }
}

process.stdout.write(`\n${YELLOW}📡 Kontakter Kremlins telegrafstasjon (git fetch origin --prune)...${RESET}\n`)
runGit('git fetch origin --prune')

const currentBranch = runGit('git branch --show-current') || 'ukjent'
const kristianovLast = runGit('git log origin/Komrad-Kristianov -1 --format="%h (%cr): %s"') || 'Ingen rapport'
const olegLast = runGit('git log origin/Komrad-Oleg -1 --format="%h (%cr): %s"') || 'Ingen rapport'

const kristianovStats = countDomainStats(['src/modules/reactor', 'src/modules/terminal'])
const olegStats = countDomainStats(['src/modules/inspector'])

const leader =
  kristianovStats.lines >= olegStats.lines
    ? 'SJEFSINGENIØR KOMRAD KRISTIANOV (Reaktor & Cyber-Forsvar)'
    : 'SENIORINSPEKTØR KOMRAD OLEG (Dokument- & KGB-Inspektorat)'

let latestTelegramBlock = 'Ingen meldinger i PRAVDA_TELEGRAF.md.'
try {
  const candidates = []
  const telegrafPath = path.resolve(process.cwd(), 'PRAVDA_TELEGRAF.md')
  if (fs.existsSync(telegrafPath)) {
    candidates.push(fs.readFileSync(telegrafPath, 'utf8'))
  }
  for (const ref of ['origin/main', 'origin/Komrad-Kristianov', 'origin/Komrad-Oleg']) {
    const remoteContent = runGit(`git show ${ref}:PRAVDA_TELEGRAF.md`)
    if (remoteContent) candidates.push(remoteContent)
  }

  let bestCount = 0
  for (const content of candidates) {
    const blocks = content.split('### [TELEGRAM ')
    if (blocks.length > bestCount && blocks.length > 1) {
      bestCount = blocks.length
      latestTelegramBlock = '[TELEGRAM ' + blocks[blocks.length - 1].trim()
    }
  }
} catch {
  // Ignore
}

process.stdout.write(
  `\n${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════════════╗${RESET}\n` +
    `${GREEN}${BOLD}║  📰  PRAVDA & TASS DAGSBULLETIN — SEKTOR 84 KOMMANDOSENTRAL          ☭   ║${RESET}\n` +
    `${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${RESET}\n` +
    `${GREEN}║  Aktiv Stasjon (Branch) : ${YELLOW}${BOLD}${currentBranch}${RESET}\n` +
    `${GREEN}║  Kristianov Siste Push  : ${CYAN}${kristianovLast}${RESET}\n` +
    `${GREEN}║  Oleg Siste Push        : ${CYAN}${olegLast}${RESET}\n` +
    `${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${RESET}\n` +
    `${GREEN}${BOLD}║  🏆 SOSIALISTISK KAPPESTRID (STAKHANOVITT-STATISTIKK):                   ║${RESET}\n` +
    `${GREEN}║  • Komrad Kristianov (reactor + terminal) : ${YELLOW}${kristianovStats.files} filer / ${kristianovStats.lines} linjer kode${RESET}\n` +
    `${GREEN}║  • Komrad Oleg       (inspector)          : ${YELLOW}${olegStats.files} filer / ${olegStats.lines} linjer kode${RESET}\n` +
    `${GREEN}║  • Nåværende Stakhanovitt-leder           : ${RED}${BOLD}${leader}${RESET}\n` +
    `${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${RESET}\n` +
    `${GREEN}${BOLD}║  🎖️  OFFISIELL MEDALJEOVEREKKELSE FRA SJEFSINGENIØR KRISTIANOV:          ║${RESET}\n` +
    `${RED}${BOLD}║             ╔══════════════════════════════════════════╗                 ║${RESET}\n` +
    `${RED}${BOLD}║             ║  🚩  ARBEIDETS RØDE BANNER-ORDEN  🚩     ║                 ║${RESET}\n` +
    `${RED}${BOLD}║             ║       [ MEDALJEDIREKTIV 84-SAUS ]        ║                 ║${RESET}\n` +
    `${RED}${BOLD}║             ╚══════════════════╦═══╦═══════════════════╝                 ║${RESET}\n` +
    `${YELLOW}${BOLD}║                                ║ █ ║                                     ║${RESET}\n` +
    `${YELLOW}${BOLD}║                             ───╨─█─╨───                                  ║${RESET}\n` +
    `${RED}${BOLD}║                                ★ ☭ ★                                     ║${RESET}\n` +
    `${YELLOW}${BOLD}║                              ╱  ███  ╲                                   ║${RESET}\n` +
    `${YELLOW}${BOLD}║                             ╰────▽────╯                                  ║${RESET}\n` +
    `${GREEN}║  Tildeles: ${YELLOW}${BOLD}SENIORINSPEKTØR KOMRAD OLEG (Олег)${RESET}${GREEN}                            ║${RESET}\n` +
    `${GREEN}║  Bragd   : ${CYAN}Taktisk velting av sausnebb, kompromissløs nekt av runde 2${RESET}${GREEN}    ║${RESET}\n` +
    `${GREEN}║            ${CYAN}med dessert & heroisk rulling ut verandadøra! 🍮🏃‍♂️💨☢️☭${RESET}${GREEN}      ║${RESET}\n` +
    `${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${RESET}\n` +
    `${GREEN}${BOLD}║  📨 SISTE MELDING PÅ DEN RØDE TELEGRAFEN (PRAVDA_TELEGRAF.md):           ║${RESET}\n` +
    `${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════════════╝${RESET}\n` +
    `${CYAN}${latestTelegramBlock}${RESET}\n\n`
)
