// K.O.M.R.A.D.-84 Terminal Shift Startup Bulletin (Sector 84)
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const forecasts = [
  '3.6 Roentgen/h — Not great, not terrible (Actually delightful!)',
  'Cherenkov Sky Glow: 100% Patriotic Illumination over Sector 84',
  'Canteen Menu: Boiled Cabbage Soup No. 4 with Potassium Iodide Mints',
  'CIA Teletype Interference: 0% (Liquidated by Party Firewall)',
]

const pick = forecasts[Math.floor(Math.random() * forecasts.length)]

process.stdout.write(
  `\n${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════════════╗${RESET}\n` +
    `${GREEN}${BOLD}║  ☭  PEOPLE'S AUTOMATED NUCLEAR PLANT NO. 4 — SECTOR 84 (1984)         ☢️  ║${RESET}\n` +
    `${GREEN}${BOLD}║  K.O.M.R.A.D.-84 // CENTRAL CONTROL ROOM TELEMETRY SERVER                ║${RESET}\n` +
    `${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${RESET}\n` +
    `${GREEN}║  • Chief Engineer : ${YELLOW}Komrad Kristian${GREEN} (Branch: ${BOLD}Komrad-Kristian${RESET}${GREEN})           ║${RESET}\n` +
    `${GREEN}║  • Senior Inspector: ${YELLOW}Komrad Ole${GREEN}      (Branch: ${BOLD}Komrad-Ole${RESET}${GREEN})                ║${RESET}\n` +
    `${GREEN}║  • Sector Bulletin : ${pick.padEnd(51, ' ').slice(0, 51)} ║${RESET}\n` +
    `${GREEN}║  • Supreme Axiom   : ${RED}${BOLD}MELTDOWN IS CAPITALIST PROPAGANDA${RESET}${GREEN}                   ║${RESET}\n` +
    `${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════════════╝${RESET}\n\n`
)
