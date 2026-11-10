import { LEVELS } from './levels'

const KEY = 'bubble-shooter-save'

export interface SaveData { unlocked: number; best: Record<number, number>; muted: boolean }

/** Reads saved progress, ignoring anything malformed (localStorage is user-editable). */
export function loadSave(): SaveData {
  const d: SaveData = { unlocked: 1, best: {}, muted: false }
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (Number.isInteger(s.unlocked)) d.unlocked = Math.min(Math.max(s.unlocked, 1), LEVELS.length)
    if (s.best && typeof s.best === 'object')
      for (const [k, v] of Object.entries(s.best)) if (typeof v === 'number' && v >= 0) d.best[+k] = v
    d.muted = s.muted === true
  } catch { /* corrupt or unavailable storage: start fresh */ }
  return d
}

export function writeSave(d: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* private mode / quota: progress just won't persist */ }
}
