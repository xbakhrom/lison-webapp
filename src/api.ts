import type {
  AssistantToken,
  AssistantUsage,
  Card,
  CustomWordResult,
  DiscussionQuestion,
  FeedbackCategory,
  GrammarAnswer,
  GrammarGameResult,
  GrammarTopicDetail,
  GrammarTopicListItem,
  Rating,
  Reminder,
  TopicDetail,
  TopicListItem,
  VocabularySearchResult,
} from './types'

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tashkent'

/** Carries the backend's error code so callers can react to a specific failure. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const initData = window.Telegram?.WebApp.initData ?? ''
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Timezone': timezone,
      ...(initData ? { Authorization: `tma ${initData}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(
      payload?.error?.message ?? 'Что-то пошло не так. Попробуйте ещё раз.',
      payload?.error?.code ?? 'unknown_error',
      response.status,
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  async topics() {
    return request<{ topics: TopicListItem[] }>('/topics')
  },
  async topic(slug: string) {
    return request<TopicDetail>(`/topics/${slug}`)
  },
  async grammarTopics() {
    return request<{ topics: GrammarTopicListItem[]; dueCount: number }>('/grammar')
  },
  async grammarTopic(slug: string) {
    return request<GrammarTopicDetail>(`/grammar/${slug}`)
  },
  async finishGrammarGame(topicID: string, answers: GrammarAnswer[]) {
    return request<GrammarGameResult>(`/grammar/${topicID}/games`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    })
  },
  async addCards(ids: string[]) {
    return request<{ added: number }>('/cards/bulk', {
      method: 'POST',
      body: JSON.stringify({ vocabularyItemIds: ids }),
    })
  },
  async cards() {
    return request<{ cards: Card[]; dueCount: number }>('/cards')
  },
  async removeCard(id: number) {
    return request<void>(`/cards/${id}`, { method: 'DELETE' })
  },
  async dueCards(topicID?: string) {
    const query = topicID ? `?topicId=${encodeURIComponent(topicID)}` : ''
    return request<{ cards: Card[] }>(`/reviews/due${query}`)
  },
  async review(cardID: number, rating: Rating) {
    return request<{ state: string; intervalDays: number; dueDate: string }>(`/reviews/${cardID}`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    })
  },
  async saveAnswer(topicID: string, fieldID: string, value: unknown) {
    return request<{ saved: boolean }>(`/topics/${topicID}/answers/${fieldID}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    })
  },
  async saveChecklist(topicID: string, itemID: string, checked: boolean) {
    return request<{ saved: boolean }>(`/topics/${topicID}/checklist/${itemID}`, {
      method: 'PUT',
      body: JSON.stringify({ checked }),
    })
  },
  async reminder() {
    return request<Reminder>('/reminder')
  },
  async updateReminder(reminder: Reminder) {
    return request<Reminder>('/reminder', {
      method: 'PUT',
      body: JSON.stringify(reminder),
    })
  },
  async sendFeedback(feedback: { category: FeedbackCategory; message: string; screen: string; topicSlug: string }) {
    return request<{ received: boolean }>('/feedback', {
      method: 'POST',
      body: JSON.stringify(feedback),
    })
  },
  async assistantToken(topicSlug?: string) {
    return request<AssistantToken>('/assistant/token', {
      method: 'POST',
      body: JSON.stringify(topicSlug ? { topicSlug } : {}),
    })
  },
  async setAssistantLevel(level: string) {
    return request<{ level: string }>('/assistant/level', {
      method: 'PUT',
      body: JSON.stringify({ level }),
    })
  },
  async reportAssistantSession(seconds: number) {
    return request<AssistantUsage>('/assistant/sessions', {
      method: 'POST',
      body: JSON.stringify({ seconds }),
    })
  },
  async searchVocabulary(query: string, limit = 8) {
    const params = new URLSearchParams({ q: query, limit: String(limit) })
    return request<{ results: VocabularySearchResult[] }>(`/vocabulary/search?${params}`)
  },
  async addCustomWord(russian: string, uzbek: string) {
    return request<CustomWordResult>('/vocabulary/custom', {
      method: 'POST',
      body: JSON.stringify({ russian, uzbek }),
    })
  },
  async nextDiscussion(topicID?: string) {
    const query = topicID ? `?topicId=${encodeURIComponent(topicID)}` : ''
    const { question } = await request<{ question: DiscussionQuestion | null; exhausted: boolean }>(
      `/discussions/next${query}`,
    )
    return question
  },
  async logDiscussion(questionID: string, summary: string) {
    return request<{ saved: boolean }>(`/discussions/${encodeURIComponent(questionID)}/log`, {
      method: 'POST',
      body: JSON.stringify({ summary }),
    })
  },
  timezone,
}
