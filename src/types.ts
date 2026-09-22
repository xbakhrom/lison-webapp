export type TopicListItem = {
  id: string
  slug: string
  title: string
  summary: string
  level: string
  wordCount: number
  addedCount: number
  dueCount: number
}

export type VocabularyItem = {
  id: string
  russian: string
  uzbek: string
  added: boolean
}

export type VocabularyCategory = {
  id: string
  title: string
  items: VocabularyItem[]
}

export type FormField = {
  id: string
  label: string
  inputType: 'text' | 'textarea' | 'collection'
  initialValue: unknown
  value: unknown
}

export type FormSection = {
  id: string
  title: string
  fields: FormField[]
}

export type ChecklistItem = {
  id: string
  prompt: string
  hint: string
  checked: boolean
}

export type ChecklistGroup = {
  title: string
  items: ChecklistItem[]
}

export type TopicDetail = {
  id: string
  slug: string
  title: string
  summary: string
  level: string
  contentMarkdown: string
  vocabulary: VocabularyCategory[]
  forms: FormSection[]
  checklist: ChecklistGroup[]
}

export type Card = {
  id: number
  vocabularyId: string
  russian: string
  uzbek: string
  topicTitle: string
  state: 'new' | 'review' | 'relearning'
  intervalDays: number
  easeFactor: number
  dueDate: string
  repetitions: number
  lapses: number
}

export type Reminder = {
  enabled: boolean
  time: string
  timezone: string
}

export type Rating = 'hard' | 'good' | 'easy'

export type GrammarLessonBlock = {
  title: string
  text: string
  examples: string[]
  note: string
}

export type GrammarQuestion = {
  id: string
  prompt: string
  phrase: string
  kind: 'choice' | 'true_false' | 'order'
  difficulty: 1 | 2 | 3
  options?: string[]
  tokens?: string[]
  answer: string
  explanation: string
}

export type GrammarAnswer = {
  questionId: string
  answer: string
}

export type GrammarTopicListItem = {
  id: string
  slug: string
  title: string
  summary: string
  level: string
  icon: string
  status: 'new' | 'learning' | 'review'
  bestScore: number
  dueDate: string
  due: boolean
  lessonBlocks: number
  masteryLevel: number
}

export type GrammarTopicDetail = {
  id: string
  slug: string
  title: string
  summary: string
  level: string
  icon: string
  lesson: GrammarLessonBlock[]
  practice: GrammarQuestion[]
  game: GrammarQuestion[]
  progress: {
    status: 'new' | 'learning' | 'review'
    bestScore: number
    dueDate: string
    repetitions: number
    masteryLevel: number
  }
}

export type GrammarGameResult = {
  score: number
  correct: number
  total: number
  status: 'learning' | 'review'
  intervalDays: number
  dueDate: string
  masteryLevel: number
}
