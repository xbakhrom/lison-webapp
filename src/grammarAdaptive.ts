import type { GrammarQuestion } from './types'

export const grammarDifficulty = {
  1: { label: 'Легко', short: 'База' },
  2: { label: 'Уверенно', short: 'Контекст' },
  3: { label: 'Сложно', short: 'Вызов' },
} as const

export type Difficulty = keyof typeof grammarDifficulty

export type AdaptiveState = {
  difficulty: Difficulty
  correctStreak: number
  mistakeStreak: number
}

export function advanceDifficulty(state: AdaptiveState, correct: boolean): AdaptiveState {
  if (correct) {
    const streak = state.correctStreak + 1
    if (streak >= 2 && state.difficulty < 3) {
      return { difficulty: (state.difficulty + 1) as Difficulty, correctStreak: 0, mistakeStreak: 0 }
    }
    return { ...state, correctStreak: streak, mistakeStreak: 0 }
  }

  const streak = state.mistakeStreak + 1
  if (streak >= 2 && state.difficulty > 1) {
    return { difficulty: (state.difficulty - 1) as Difficulty, correctStreak: 0, mistakeStreak: 0 }
  }
  return { ...state, correctStreak: 0, mistakeStreak: streak }
}

export function pickNextQuestion(
  questions: GrammarQuestion[],
  usedIDs: Set<string>,
  target: Difficulty,
  previousKind?: GrammarQuestion['kind'],
) {
  const available = questions.filter((question) => !usedIDs.has(question.id))
  if (!available.length) return null

  return [...available].sort((left, right) => {
    const leftDistance = Math.abs(left.difficulty - target)
    const rightDistance = Math.abs(right.difficulty - target)
    if (leftDistance !== rightDistance) return leftDistance - rightDistance
    // When two fallbacks are equally far away, protect the learner from an
    // unnecessary jump: prefer the easier one before considering variety.
    if (left.difficulty !== right.difficulty) return left.difficulty - right.difficulty
    const leftRepeatsKind = left.kind === previousKind ? 1 : 0
    const rightRepeatsKind = right.kind === previousKind ? 1 : 0
    return leftRepeatsKind - rightRepeatsKind
  })[0]
}
