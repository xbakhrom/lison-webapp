import { useEffect, useState } from 'react'
import { api } from '../api'
import { cardsLabel } from '../format'
import type { Card, Rating } from '../types'
import { ErrorState, Loading } from './Loading'

const ratings: { value: Rating; label: string; hint: string }[] = [
  { value: 'again', label: 'Не помню', hint: 'Ещё раз' },
  { value: 'hard', label: 'Трудно', hint: '1 день' },
  { value: 'good', label: 'Хорошо', hint: 'По плану' },
  { value: 'easy', label: 'Легко', hint: 'Позже' },
]

export function ReviewPage({ onDone }: { onDone: () => void }) {
  const [queue, setQueue] = useState<Card[]>([])
  const [initialCount, setInitialCount] = useState(0)
  const [completed, setCompleted] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.dueCards()
      .then(({ cards }) => {
        if (!active) return
        setQueue(cards)
        setInitialCount(cards.length)
      })
      .catch((reason: Error) => active && setError(reason.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [reload])

  async function rate(rating: Rating) {
    const current = queue[0]
    if (!current || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await api.review(current.id, rating)
      const rest = queue.slice(1)
      if (rating === 'again') setQueue([...rest, current])
      else {
        setQueue(rest)
        setCompleted((count) => count + 1)
      }
      setRevealed(false)
      window.Telegram?.WebApp.HapticFeedback?.impactOccurred('light')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading label="Готовим повторение…" />
  if (error && initialCount === 0) return <ErrorState message={error} onRetry={() => { setError(''); setReload((value) => value + 1) }} />

  if (queue.length === 0) {
    return (
      <div className="page review-finished">
        <div className="success-orbit"><span>✓</span></div>
        <div className="eyebrow">На сегодня всё</div>
        <h1>Повторение завершено</h1>
        <p>{completed > 0 ? `Вы повторили ${completed} ${cardsLabel(completed)}. Следующая встреча со словами — по расписанию.` : 'Новых карточек для повторения пока нет.'}</p>
        <button className="button primary wide" onClick={onDone}>Вернуться к карточкам</button>
      </div>
    )
  }

  const current = queue[0]
  const progress = initialCount ? Math.min(100, (completed / initialCount) * 100) : 0
  return (
    <div className="page review-page">
      <div className="review-header">
        <button className="icon-button" onClick={onDone} aria-label="Закрыть">×</button>
        <div className="review-progress"><span style={{ width: `${progress}%` }} /></div>
        <span>{completed}/{initialCount}</span>
      </div>

      <div className={`flashcard ${revealed ? 'revealed' : ''}`}>
        <span className="card-side-label">{revealed ? 'Ответ' : 'Переведите на русский'}</span>
        <div className="flashcard-word">{revealed ? current.russian : current.uzbek}</div>
        {revealed && <div className="flashcard-translation">{current.uzbek}</div>}
        <span className="flashcard-topic">{current.topicTitle}</span>
      </div>

      {error && <div className="inline-error">{error}</div>}

      {!revealed ? (
        <button className="button primary wide reveal-button" onClick={() => setRevealed(true)}>Показать ответ</button>
      ) : (
        <div className="rating-area">
          <p>Насколько легко вспомнили?</p>
          <div className="rating-grid">
            {ratings.map((rating) => (
              <button className={`rating ${rating.value}`} key={rating.value} disabled={submitting} onClick={() => rate(rating.value)}>
                <strong>{rating.label}</strong><span>{rating.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
