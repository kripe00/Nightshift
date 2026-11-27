import { silenceAllLegacyGlobalBgm } from '../modules/inspector/audio'
import { useDeskStore } from '../modules/inspector/useDeskStore'
import { airlockDoorState } from './airlockDoorState'
import { abortKomradGrab, isKomradLiquidating } from './komradGrabState'
import { captureSovOsPersistenceSnapshot } from './sovOsAppRegistry'
import type { SavedGameStatePayload } from './types'
import {
  getPreOrderSectorTargetsSnapshot,
  registerSavedShiftLiquidator,
  registerSavedShiftPersister,
  useGameStore,
} from './useGameStore'

const STORAGE_KEY = 'MIP_SAVED_SHIFT_84'
const SECONDARY_STORAGE_KEYS = [
  'MIP_SAVED_SHIFT_84_BACKUP',
  'MIP_SHIFT_CHECKPOINT_84',
  'MIP_DESK_SNAPSHOT_84',
] as const

const storageListeners = new Set<() => void>()
let cachedStorageRaw: string | null | undefined = undefined
let cachedStorageParsed: SavedShiftSnapshot | null = null

function notifySavedShiftListeners(): void {
  cachedStorageRaw = undefined
  storageListeners.forEach((listener) => listener())
}

export function subscribeSavedShiftStorage(listener: () => void): () => void {
  storageListeners.add(listener)
  return () => {
    storageListeners.delete(listener)
  }
}

export interface SavedDeskSnapshot {
  documents: ReturnType<typeof useDeskStore.getState>['documents']
  printingDoc: ReturnType<typeof useDeskStore.getState>['printingDoc']
  nextTemplateIndex: number
  commendations: number
  citations: number
  lastVerdict: ReturnType<typeof useDeskStore.getState>['lastVerdict']
}

export interface SavedShiftSnapshot {
  savedAt: number
  game: SavedGameStatePayload
  desk: SavedDeskSnapshot
}

export function computeSavedShiftRubles(snap: SavedShiftSnapshot): number {
  if (typeof snap.game.rubles === 'number' && Number.isFinite(snap.game.rubles)) {
    return Math.max(0, Math.round(snap.game.rubles))
  }
  return Math.max(
    0,
    300 + snap.desk.commendations * 150 - snap.desk.citations * 50
  )
}

export function readSavedShift(): SavedShiftSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === cachedStorageRaw) {
      return cachedStorageParsed
    }
    cachedStorageRaw = raw
    if (!raw) {
      cachedStorageParsed = null
      return null
    }
    const parsed = JSON.parse(raw) as Partial<SavedShiftSnapshot>
    if (
      !parsed ||
      !parsed.game ||
      typeof parsed.game.shiftTimeMinutes !== 'number' ||
      typeof parsed.game.shiftNumber !== 'number' ||
      !parsed.desk ||
      !Array.isArray(parsed.desk.documents) ||
      typeof parsed.desk.commendations !== 'number' ||
      typeof parsed.desk.citations !== 'number'
    ) {
      cachedStorageParsed = null
      return null
    }
    cachedStorageParsed = parsed as SavedShiftSnapshot
    return cachedStorageParsed
  } catch {
    cachedStorageRaw = null
    cachedStorageParsed = null
    return null
  }
}

export function saveCurrentShiftToStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const g = useGameStore.getState()
    if (g.siberiaGameOverActive || g.treasonStrikes >= 6 || isKomradLiquidating()) return
    const d = useDeskStore.getState()
    const snapshot: SavedShiftSnapshot = {
      savedAt: Date.now(),
      game: {
        shiftNumber: g.shiftNumber,
        shiftTimeMinutes: g.shiftTimeMinutes,
        treasonStrikes: g.treasonStrikes,
        lastStrikeReason: g.lastStrikeReason,
        rubles: g.rubles,
        quotaCompleted: g.quotaCompleted,
        lastDecisionFeedback: g.lastDecisionFeedback,
        activeMandate: g.activeMandate,
        activePost84Order: g.activePost84Order,
        post84InboxSnapshot: g.post84InboxSnapshot,
        sovOsSavedState: captureSovOsPersistenceSnapshot(),
        ciaIntrusionActive: g.ciaIntrusionActive,
        ciaIntrusionProgress: g.ciaIntrusionProgress,
        ideologyDuelActive: g.ideologyDuelActive,
        komradOverrideLocked: g.komradOverrideLocked,
        partyApprovedBuffSec: g.partyApprovedBuffSec,
        frontWallPurgeCooldownSec: g.frontWallPurgeCooldownSec,
        frontWallOverrideCooldownSec: g.frontWallOverrideCooldownSec,
        preOrderSectorTargets: getPreOrderSectorTargetsSnapshot(),
        tutorialPhase: g.tutorialPhase,
        tutorialStep: g.tutorialStep,
        tutorialHintsHidden: g.tutorialHintsHidden,
        dismissedCrisisIds: [...g.dismissedCrisisIds],
        coreTemp: g.coreTemp,
        pressureBar: g.pressureBar,
        drumPressure: g.drumPressure,
        drumWaterLevel: g.drumWaterLevel,
        radiationLevel: g.radiationLevel,
        roomRadiation: g.roomRadiation,
        powerAllocation: { ...g.powerAllocation },
        redlineInstability: g.redlineInstability,
        isBlackout: g.isBlackout,
        pumpsActive: [...g.pumpsActive] as [boolean, boolean],
        mcpActive: [...g.mcpActive],
        pumpThrottle: [...g.pumpThrottle] as [number, number],
        pumpAHeat: g.pumpAHeat,
        pumpBHeat: g.pumpBHeat,
        lubeOilPressure: g.lubeOilPressure,
        oilCoolerValve: g.oilCoolerValve,
        boronTankLevel: g.boronTankLevel,
        boronReservePool: g.boronReservePool,
        boronDampingTimer: g.boronDampingTimer,
        boronCooldown: g.boronCooldown,
        graphiteTemp: g.graphiteTemp,
        nitrogenLoopValve: g.nitrogenLoopValve,
        heliumPressure: g.heliumPressure,
        bubblerLevel: g.bubblerLevel,
        feedwaterValve: g.feedwaterValve,
        waterReservoir: g.waterReservoir,
        pripyatWater: g.pripyatWater,
        kolkhozWater: g.kolkhozWater,
        vodkaWater: g.vodkaWater,
        xenon: g.xenon,
        iodine: g.iodine,
        voidFraction: g.voidFraction,
        controlRods: g.controlRods,
        controlRodLevel: g.controlRodLevel,
        coolantFlow: g.coolantFlow,
        fuelBurnupTimer: g.fuelBurnupTimer,
        az5Active: g.az5Active,
        az5Timer: g.az5Timer,
        az5Cooldown: g.az5Cooldown,
        az5Available: g.az5Available,
        thermalPower: g.thermalPower,
        energyCreatedMW: g.energyCreatedMW,
        batteryStoredMWh: g.batteryStoredMWh,
        batteryOutputValve: g.batteryOutputValve,
        energyDemandMW: g.energyDemandMW,
        totalElectricalMW: g.totalElectricalMW,
        sealToggles: [...g.sealToggles] as [boolean, boolean, boolean],
        containmentSealLocked: g.containmentSealLocked,
        gridHz: g.gridHz,
        excitationTrim: g.excitationTrim,
        ventilationActive: g.ventilationActive,
        avrActive: g.avrActive,
        kgbLineActive: g.kgbLineActive,
        condenserVacActive: g.auxLoopBActive,
        auxLoopBActive: g.auxLoopBActive,
        radioOn: g.radioOn,
        radioVolume: g.radioVolume,
        vodkaDroughtTimer: g.vodkaDroughtTimer,
        coreTileAnomalies: { ...(g.coreTileAnomalies ?? {}) },
        turbines: [{ ...g.turbines[0] }, { ...g.turbines[1] }],
        substations: g.substations.map((s) => ({ ...s })),
      },
      desk: {
        documents: d.documents,
        printingDoc: d.printingDoc,
        nextTemplateIndex: d.nextTemplateIndex,
        commendations: d.commendations,
        citations: d.citations,
        lastVerdict: d.lastVerdict,
      },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    notifySavedShiftListeners()
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSavedShiftFromStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    for (const key of SECONDARY_STORAGE_KEYS) {
      window.localStorage.removeItem(key)
    }
    notifySavedShiftListeners()
  } catch {
    // Ignore storage access errors
  }
}

export function clearSavedShiftStorage(): void {
  clearSavedShiftFromStorage()
}

registerSavedShiftLiquidator(clearSavedShiftFromStorage)
registerSavedShiftPersister(saveCurrentShiftToStorage)

export function resetGameToMcrLobbyAfterLiquidation(): void {
  clearSavedShiftFromStorage()
  abortKomradGrab()
  silenceAllLegacyGlobalBgm()
  airlockDoorState.wantOpen = false
  airlockDoorState.wheelProgress = 0
  airlockDoorState.openProgress = 0
  airlockDoorState.menuUnlockElapsed = 0
  useDeskStore.getState().resetDeskStore()
  useGameStore.getState().resetShift('menu_locked')
}

export function startFreshShiftFromLobby(): void {
  clearSavedShiftFromStorage()
  useDeskStore.getState().resetDeskStore()
  useGameStore.getState().resetShift('door_opening')
}

export function completeShiftAndReturnToNextLobby(): void {
  abortKomradGrab()
  silenceAllLegacyGlobalBgm()
  airlockDoorState.wantOpen = false
  airlockDoorState.wheelProgress = 0
  airlockDoorState.openProgress = 0
  airlockDoorState.menuUnlockElapsed = 0
  useDeskStore.getState().resetDeskStore()
  useGameStore.getState().completeShiftRolloverToLobby()
  saveCurrentShiftToStorage()
}

export function restoreSavedShiftFromStorage(snap: SavedShiftSnapshot): void {
  const resolvedRubles = computeSavedShiftRubles(snap)
  const resolvedQuota =
    typeof snap.game.quotaCompleted === 'number' &&
    Number.isFinite(snap.game.quotaCompleted)
      ? Math.max(0, Math.round(snap.game.quotaCompleted))
      : Math.max(
          0,
          (typeof snap.desk.commendations === 'number'
            ? snap.desk.commendations
            : 0) + (snap.game.post84InboxSnapshot?.mailOrdersCompleted ?? 0)
        )
  useGameStore.getState().restoreSavedShift({
    ...snap.game,
    rubles: resolvedRubles,
    quotaCompleted: resolvedQuota,
  })
  useDeskStore.getState().restoreDeskSnapshot(snap.desk)
}
