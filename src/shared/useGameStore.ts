// Shared Contract: Cross-module Zustand store
import { create } from 'zustand'
import type { GameState } from './types'

export const useGameStore = create<GameState>(() => ({}))
