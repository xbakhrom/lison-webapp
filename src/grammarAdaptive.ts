import type { GrammarQuestion, GrammarStage } from './types'

export const grammarDifficulty = {
  1: { label: 'Легко', short: 'База' },
  2: { label: 'Уверенно', short: 'Контекст' },
  3: { label: 'Сложно', short: 'Вызов' },
} as const

export type Difficulty = keyof typeof grammarDifficulty

// The route is walked stage by stage: word forms, then verbs, then cases, then
// everything that makes speech sound natural.
export const grammarStages: { key: GrammarStage; eyebrow: string; title: string; description: string }[] = [
  {
    key: 'foundation',
    eyebrow: 'Ступень 1 · Фундамент',
    title: 'Собираем основу',
    description: 'Алфавит и ударение, род существительных, местоимения, «есть» и «нет», числа и время.',
  },
  {
    key: 'verbs',
    eyebrow: 'Ступень 2 · Глагол',
    title: 'Сердце предложения',
    description: 'Три времени, глаголы движения и вид — без них не построить ни одной фразы.',
  },
  {
    key: 'cases',
    eyebrow: 'Ступень 3 · Падежи',
    title: 'По одному, по частоте',
    description: 'Падежи в порядке реальной нужности: где, кого, чего нет, кому и с кем.',
  },
  {
    key: 'fluency',
    eyebrow: 'Ступень 4 · Речь',
    title: 'Говорим свободно',
    description: 'Прилагательные, просьбы, частица «бы», сложные предложения и готовые формулы.',
  },
]

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

  const ranked = available
    .map((question) => ({ question, distance: Math.abs(question.difficulty - target), noise: Math.random() }))
    .sort((left, right) => {
      if (left.distance !== right.distance) return left.distance - right.distance
      // When two fallbacks are equally far away, protect the learner from an
      // unnecessary jump: prefer the easier one before considering variety.
      if (left.question.difficulty !== right.question.difficulty) return left.question.difficulty - right.question.difficulty
      const leftRepeatsKind = left.question.kind === previousKind ? 1 : 0
      const rightRepeatsKind = right.question.kind === previousKind ? 1 : 0
      if (leftRepeatsKind !== rightRepeatsKind) return leftRepeatsKind - rightRepeatsKind
      // Every bank holds twenty questions per level, so a random tie-break is
      // what keeps a repeated session from feeling like the same session.
      return left.noise - right.noise
    })
  return ranked[0].question
}

// A warm-up is short on purpose: the bank is large, so each visit draws a fresh
// ladder of three easy, two medium and one hard question.
const practiceShape: Difficulty[] = [1, 1, 1, 2, 2, 3]

export function pickPracticeSet(questions: GrammarQuestion[], size = practiceShape.length) {
  const remaining = [...questions]
  const chosen: GrammarQuestion[] = []

  for (const difficulty of practiceShape.slice(0, size)) {
    const matches = remaining.filter((question) => question.difficulty === difficulty)
    const pool = matches.length ? matches : remaining
    if (!pool.length) break
    const picked = pool[Math.floor(Math.random() * pool.length)]
    remaining.splice(remaining.indexOf(picked), 1)
    chosen.push(picked)
  }
  return chosen
}

// Kahoot pacing: a countdown per question and points that reward both accuracy
// and speed, so a confident answer is worth more than a lucky late tap.
export const questionSeconds = { 1: 20, 2: 25, 3: 30 } as const
export const maxQuestionPoints = 1000

export function roundPoints(correct: boolean, secondsLeft: number, limitSeconds: number, streak: number) {
  if (!correct) return 0
  const speed = Math.max(0, Math.min(1, secondsLeft / limitSeconds))
  const base = Math.round(maxQuestionPoints * (0.5 + 0.5 * speed))
  return base + Math.min(streak, 5) * 50
}
