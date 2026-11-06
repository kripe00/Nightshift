// KGB Fourth Directorate — Automated Border Guard & Code Inspection (Sector 84)
import { execSync } from 'node:child_process'

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function runCmd(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true, output: out.trim() }
  } catch (err) {
    const stdout = err.stdout ? String(err.stdout) : ''
    const stderr = err.stderr ? String(err.stderr) : ''
    return { ok: false, output: `${stdout}\n${stderr}`.trim() }
  }
}

const branchRes = runCmd('git branch --show-current')
const branch = branchRes.output || 'unknown'
const statusRes = runCmd('git status --short')
const changedLines = statusRes.output ? statusRes.output.split('\n').filter(Boolean) : []

let borderViolations = []
if (branch === 'Komrad-Kristianov') {
  borderViolations = changedLines.filter((line) => line.includes('src/modules/inspector/'))
} else if (branch === 'Komrad-Oleg') {
  borderViolations = changedLines.filter(
    (line) => line.includes('src/modules/reactor/') || line.includes('src/modules/terminal/')
  )
}

process.stdout.write(
  `\n${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════════════╗${RESET}\n` +
    `${GREEN}${BOLD}║  🕵️  KGB FOURTH DIRECTORATE — SEKTOR 84 SIKKERHETSINSPEKSJON          ☭  ║${RESET}\n` +
    `${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════════════╝${RESET}\n`
)

process.stdout.write(`${YELLOW}• Aktiv Branch:${RESET} ${BOLD}${branch}${RESET}\n`)
process.stdout.write(`${YELLOW}• Endrede filer i arbeidsmappe:${RESET} ${changedLines.length}\n`)

if (borderViolations.length > 0) {
  process.stdout.write(
    `\n${RED}${BOLD}🚨 [KGB GRENSEALARM] ULOVLIG GRENSEPASSERING OPPDAGET PÅ BRANCH ${branch}!${RESET}\n` +
      `${RED}Følgende filer tilhører den andre kamratens avdeling og MÅ tilbakestilles umiddelbart:${RESET}\n` +
      borderViolations.map((v) => `  ${RED}✗ ${v}${RESET}`).join('\n') +
      '\n\n'
  )
  process.exit(1)
} else {
  process.stdout.write(`${GREEN}✓ [KGB GRENSEKONTROLL] Domenegrenser mellom Kristianov og Oleg er 100 % respektert.${RESET}\n`)
}

const tscRes = runCmd('npx tsc -b')
if (!tscRes.ok) {
  process.stdout.write(
    `\n${RED}${BOLD}🚨 [CIA-SABOTASJE I TYPESCRIPT] Kompilatoren oppdaget vestlige infiltratører:${RESET}\n${tscRes.output}\n\n`
  )
  process.exit(1)
} else {
  process.stdout.write(`${GREEN}✓ [GOSPLAN TYPE-KONTROLL] tsc -b bestått med 0 feil.${RESET}\n`)
}

const lintRes = runCmd('npx oxlint')
if (!lintRes.ok) {
  process.stdout.write(
    `\n${RED}${BOLD}🚨 [CIA-SABOTASJE I LINTER] Oxlint rapporterer ideologiske avvik:${RESET}\n${lintRes.output}\n\n`
  )
  process.exit(1)
} else {
  process.stdout.write(`${GREEN}✓ [KGB KODEHYGIENE] oxlint bestått uten anmerkninger.${RESET}\n`)
}

process.stdout.write(
  `\n${GREEN}${BOLD}🏅 KGB-DOM: INGEN VESTLIGE SPIONER FUNNET! ARBEIDETS RØDE FANE TILDELES KAMRATEN!${RESET}\n\n`
)
