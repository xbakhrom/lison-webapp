import type { Card, Rating, Reminder, TopicDetail, TopicListItem } from './types'

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tashkent'

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
    throw new Error(payload?.error?.message ?? 'Что-то пошло не так. Попробуйте ещё раз.')
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
  timezone,
}
