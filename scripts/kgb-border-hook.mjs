// KGB Pre-Commit Border Hook — Blocks commits that cross Komrad Kristianov / Komrad Oleg boundaries
import { execSync } from 'node:child_process'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function runGit(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const branch = runGit('git branch --show-current')
const staged = runGit('git diff --cached --name-only')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)

let violations = []
if (branch === 'Komrad-Kristianov') {
  violations = staged.filter((file) => file.startsWith('src/modules/inspector/'))
} else if (branch === 'Komrad-Oleg') {
  violations = staged.filter(
    (file) => file.startsWith('src/modules/reactor/') || file.startsWith('src/modules/terminal/')
  )
}

if (violations.length > 0) {
  process.stderr.write(
    `\n${RED}${BOLD}╔══════════════════════════════════════════════════════════════════════════╗${RESET}\n` +
      `${RED}${BOLD}║  🚨 KGB ARRESTORDRE — ULOVLIG GRENSEPASSERING BLOKKERT!               ☭  ║${RESET}\n` +
      `${RED}${BOLD}╚══════════════════════════════════════════════════════════════════════════╝${RESET}\n` +
      `${YELLOW}Aktiv branch:${RESET} ${BOLD}${branch}${RESET}\n` +
      `${RED}Du forsøkte å committe filer i kameratens beskyttede modul:${RESET}\n` +
      violations.map((f) => `  ${RED}✗ ${f}${RESET}`).join('\n') +
      `\n\n${YELLOW}Tilbakestill filene med:${RESET} git checkout -- ${violations.join(' ')}\n\n`
  )
  process.exit(1)
}

process.stdout.write(`${GREEN}☭ [KGB GRENSEKONTROLL] Stagede filer godkjent for branch ${branch}.${RESET}\n`)
