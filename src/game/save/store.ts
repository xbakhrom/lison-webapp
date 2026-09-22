import { useSyncExternalStore } from 'react'
import type { GameSettings, SaveState, SrsEntry } from '../types'

const STORAGE_KEY = 'temur-moskvada-save'
export const SAVE_VERSION = 1

const defaultSettings: GameSettings = {
  sound: true,
  autoSpeak: false,
  shadows: true,
  fontScale: 1,
}

function emptySave(): SaveState {
  return {
    version: SAVE_VERSION,
    unlockedEpisode: 1,
    stars: {},
    srsQueue: [],
    stats: {},
    settings: { ...defaultSettings },
    tutorialDone: false,
  }
}

/** Older saves are upgraded field by field; unknown shapes fall back to empty. */
function migrate(raw: unknown): SaveState {
  if (typeof raw !== 'object' || raw === null) return emptySave()
  const source = raw as Partial<SaveState>
  const base = emptySave()
  return {
    version: SAVE_VERSION,
    unlockedEpisode: typeof source.unlockedEpisode === 'number' ? Math.max(1, source.unlockedEpisode) : 1,
    stars: typeof source.stars === 'object' && source.stars !== null ? { ...source.stars } : {},
    srsQueue: Array.isArray(source.srsQueue) ? (source.srsQueue.filter(isSrsEntry) as SrsEntry[]) : [],
    stats: typeof source.stats === 'object' && source.stats !== null ? { ...source.stats } : {},
    settings: { ...base.settings, ...(typeof source.settings === 'object' ? source.settings : null) },
    tutorialDone: source.tutorialDone === true,
  }
}

function isSrsEntry(value: unknown): value is SrsEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<SrsEntry>
  return typeof entry.itemId === 'string' && typeof entry.episodeId === 'string' && typeof entry.box === 'number'
}

let writable = true
let state: SaveState = read()
const listeners = new Set<() => void>()

function read(): SaveState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptySave()
    return migrate(JSON.parse(raw))
  } catch {
    // Private mode, disabled storage or corrupted JSON: play on without a save.
    writable = false
    return emptySave()
  }
}

function write(next: SaveState): void {
  state = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    writable = false
  }
  listeners.forEach((listener) => listener())
}

/** False when the browser refuses to persist — the UI warns once, nothing breaks. */
export function isPersistent(): boolean {
  return writable
}

export function getSave(): SaveState {
  return state
}

export function updateSave(change: (current: SaveState) => SaveState): SaveState {
  write(change(state))
  return state
}

export function resetSave(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    writable = true
  } catch {
    writable = false
  }
  write(emptySave())
}

export function setSettings(change: Partial<GameSettings>): void {
  updateSave((current) => ({ ...current, settings: { ...current.settings, ...change } }))
}

export function markTutorialDone(): void {
  if (state.tutorialDone) return
  updateSave((current) => ({ ...current, tutorialDone: true }))
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSave(): SaveState {
  return useSyncExternalStore(subscribe, getSave, getSave)
}
