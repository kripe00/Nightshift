import { useDeskStore } from '../modules/inspector/useDeskStore'
import type { SavedGameStatePayload } from './types'
import { useGameStore } from './useGameStore'

const STORAGE_KEY = 'MIP_SAVED_SHIFT_84'

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
  return Math.max(
    0,
    300 + snap.desk.commendations * 150 - snap.desk.citations * 50
  )
}

export function readSavedShift(): SavedShiftSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
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
      return null
    }
    return parsed as SavedShiftSnapshot
  } catch {
    return null
  }
}

export function saveCurrentShiftToStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const g = useGameStore.getState()
    const d = useDeskStore.getState()
    const snapshot: SavedShiftSnapshot = {
      savedAt: Date.now(),
      game: {
        shiftNumber: g.shiftNumber,
        shiftTimeMinutes: g.shiftTimeMinutes,
        treasonStrikes: g.treasonStrikes,
        lastDecisionFeedback: g.lastDecisionFeedback,
        activeMandate: g.activeMandate,
        activePost84Order: g.activePost84Order,
        tutorialPhase: g.tutorialPhase,
        tutorialStep: g.tutorialStep,
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
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSavedShiftStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage access errors
  }
}

export function startFreshShiftFromLobby(): void {
  clearSavedShiftStorage()
  useDeskStore.getState().resetDeskStore()
  useGameStore.getState().resetShift('door_opening')
}

export function restoreSavedShiftFromStorage(snap: SavedShiftSnapshot): void {
  useDeskStore.setState({
    documents: Array.isArray(snap.desk.documents) ? snap.desk.documents : [],
    printingDoc: snap.desk.printingDoc ?? null,
    nextTemplateIndex:
      typeof snap.desk.nextTemplateIndex === 'number'
        ? snap.desk.nextTemplateIndex
        : 0,
    commendations:
      typeof snap.desk.commendations === 'number' ? snap.desk.commendations : 0,
    citations: typeof snap.desk.citations === 'number' ? snap.desk.citations : 0,
    lastVerdict: snap.desk.lastVerdict ?? null,
  })
  useGameStore.getState().restoreSavedShift(snap.game)
}
