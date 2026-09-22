import type { Episode, EpisodeItem } from '../types'
import { SRS_EVERY } from './srs'

export type Task = {
  item: EpisodeItem
  /** Episode the item belongs to — an SRS reminder can come from an older one. */
  episodeId: string
  fromSrs: boolean
}

/** Spec §4: 10 boss questions, 6 from exceptions and 4 from the plain rule. */
export const BOSS_QUESTIONS = 10
export const BOSS_EXCEPTIONS = 6
export const BOSS_TIME_LIMIT = 15
export const BOSS_PASS_RATIO = 0.9
export const HINTS_PER_EPISODE = 3

export function shuffle<T>(list: readonly T[]): T[] {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

/**
 * Free stage: every non-boss item of the episode in a fresh order, with an SRS
 * reminder slotted in after every fifth task.
 */
export function buildFreeStage(episode: Episode, reminders: Task[]): Task[] {
  const own = shuffle(episode.items.filter((item) => !item.isBoss)).map((item) => ({
    item,
    episodeId: episode.id,
    fromSrs: false,
  }))

  if (reminders.length === 0) return own

  const queue: Task[] = []
  const pending = [...reminders]
  own.forEach((task, index) => {
    queue.push(task)
    if ((index + 1) % SRS_EVERY === 0 && pending.length > 0) {
      queue.push(pending.shift() as Task)
    }
  })
  return queue
}

/**
 * Boss round: drawn fresh from the bank on every attempt, so a retry asks the
 * same material in a different order (spec §4).
 */
export function buildBossRound(episode: Episode): Task[] {
  const bossItems = episode.items.filter((item) => item.isBoss)
  const exceptions = shuffle(bossItems.filter((item) => item.isException)).slice(0, BOSS_EXCEPTIONS)
  const regular = shuffle(bossItems.filter((item) => !item.isException)).slice(0, BOSS_QUESTIONS - BOSS_EXCEPTIONS)
  const picked = [...exceptions, ...regular]

  // Guard against a thin bank: top up from whatever is left rather than asking
  // fewer questions than the pass ratio assumes.
  if (picked.length < BOSS_QUESTIONS) {
    const rest = shuffle(bossItems.filter((item) => !picked.includes(item)))
    picked.push(...rest.slice(0, BOSS_QUESTIONS - picked.length))
  }

  return shuffle(picked).map((item) => ({ item, episodeId: episode.id, fromSrs: false }))
}

export function bossPassed(correct: number, total: number): boolean {
  return total > 0 && correct / total >= BOSS_PASS_RATIO
}

export function scoreFor(item: EpisodeItem, streak: number): number {
  const base = item.isException ? 150 : 100
  return base + Math.min(5, Math.max(0, streak - 1)) * 20
}

/** Spec §4: 1–3 stars from accuracy and how much the run left in the SRS queue. */
export function starsFor(accuracy: number, addedToSrs: number): number {
  if (accuracy >= 0.95 && addedToSrs === 0) return 3
  if (accuracy >= 0.85 && addedToSrs <= 3) return 2
  return 1
}

/**
 * The tappable pieces of a task, shuffled (spec §8): answer options for most
 * types, and the words to arrange for an `order` task.
 */
export function optionsFor(item: EpisodeItem): string[] {
  return shuffle(item.type === 'order' ? (item.tokens ?? []) : (item.options ?? []))
}
