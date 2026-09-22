import { getSave, updateSave } from '../save/store'
import type { EpisodeItem, SrsEntry } from '../types'

// Spec §4: a simplified three-box Leitner system. A wrong answer drops the item
// back to box 1; three correct answers in a row retire it from the queue.
const BOX_INTERVAL_DAYS: Record<1 | 2 | 3, number> = { 1: 0, 2: 1, 3: 3 }
export const RETIRE_STREAK = 3
/** Spec §4: one in every five free-stage tasks is pulled from the queue. */
export const SRS_EVERY = 5

function dueDate(box: 1 | 2 | 3, now: Date): string {
  const due = new Date(now)
  due.setDate(due.getDate() + BOX_INTERVAL_DAYS[box])
  return due.toISOString()
}

export function recordWrong(item: EpisodeItem, episodeId: string, now = new Date()): void {
  updateSave((current) => {
    const existing = current.srsQueue.find((entry) => entry.itemId === item.id)
    const entry: SrsEntry = existing
      ? { ...existing, box: 1, wrongCount: existing.wrongCount + 1, correctStreak: 0, nextDue: dueDate(1, now) }
      : { itemId: item.id, episodeId, box: 1, wrongCount: 1, correctStreak: 0, nextDue: dueDate(1, now) }
    return {
      ...current,
      srsQueue: existing
        ? current.srsQueue.map((queued) => (queued.itemId === item.id ? entry : queued))
        : [...current.srsQueue, entry],
    }
  })
}

/** Returns true when the item graduated out of the queue with this answer. */
export function recordCorrect(itemId: string, now = new Date()): boolean {
  const existing = getSave().srsQueue.find((entry) => entry.itemId === itemId)
  if (!existing) return false
  const correctStreak = existing.correctStreak + 1
  if (correctStreak >= RETIRE_STREAK) {
    updateSave((current) => ({
      ...current,
      srsQueue: current.srsQueue.filter((entry) => entry.itemId !== itemId),
    }))
    return true
  }
  const box = Math.min(3, existing.box + 1) as 1 | 2 | 3
  updateSave((current) => ({
    ...current,
    srsQueue: current.srsQueue.map((entry) =>
      entry.itemId === itemId ? { ...entry, box, correctStreak, nextDue: dueDate(box, now) } : entry,
    ),
  }))
  return false
}

/**
 * Picks the most overdue entry that is not part of the episode being played —
 * the point of the reminder is to drag old mistakes forward, and the current
 * episode already asks its own items.
 */
export function pickDue(excludeEpisodeId: string, used: Set<string>, now = new Date()): SrsEntry | null {
  const candidates = getSave().srsQueue
    .filter((entry) => entry.episodeId !== excludeEpisodeId && !used.has(entry.itemId))
    .filter((entry) => new Date(entry.nextDue).getTime() <= now.getTime())
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => {
    if (a.box !== b.box) return a.box - b.box
    return b.wrongCount - a.wrongCount
  })[0]
}

export function queueSize(): number {
  return getSave().srsQueue.length
}
