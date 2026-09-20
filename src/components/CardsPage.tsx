import { useEffect, useState } from 'react'
import { api } from '../api'
import { cardsLabel } from '../format'
import type { Card, Reminder } from '../types'
import { ErrorState, Loading } from './Loading'

export function CardsPage({ onReview, onBrowse }: { onReview: () => void; onBrowse: () => void }) {
  const [cards, setCards] = useState<Card[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [reminder, setReminder] = useState<Reminder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingReminder, setSavingReminder] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([api.cards(), api.reminder()])
      .then(([cardData, reminderData]) => {
        if (!active) return
        setCards(cardData.cards)
        setDueCount(cardData.dueCount)
        setReminder(reminderData)
      })
      .catch((reason: Error) => active && setError(reason.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [reload])

  async function saveReminder(next: Reminder) {
    setReminder(next)
    setSavingReminder(true)
    try {
      setReminder(await api.updateReminder(next))
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setSavingReminder(false)
    }
  }

  async function remove(card: Card) {
    if (!window.confirm(`Удалить карточку «${card.russian}»? Прогресс будет потерян.`)) return
    try {
      await api.removeCard(card.id)
      setCards((current) => current.filter((item) => item.id !== card.id))
      if (card.dueDate <= new Date().toISOString().slice(0, 10)) setDueCount((count) => Math.max(0, count - 1))
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  if (loading) return <Loading label="Загружаем карточки…" />
  if (error && cards.length === 0) return <ErrorState message={error} onRetry={() => { setError(''); setReload((value) => value + 1) }} />

  return (
    <div className="page stack-lg">
      <section className="page-heading">
        <div className="eyebrow">Моя коллекция</div>
        <h1>Карточки</h1>
      </section>

      {cards.length === 0 ? (
        <section className="empty-card">
          <div className="empty-art">Aa</div>
          <h2>У вас пока нет карточек</h2>
          <p>Добавьте слова из темы, чтобы начать первое повторение.</p>
          <button className="button primary" onClick={onBrowse}>Перейти к темам</button>
        </section>
      ) : (
        <>
          <section className="review-summary">
            <div>
              <span className="summary-label">На сегодня</span>
              <strong>{dueCount}</strong>
              <span>{cardsLabel(dueCount)}</span>
            </div>
            <button className="button light" onClick={onReview} disabled={dueCount === 0}>
              {dueCount > 0 ? 'Повторить сейчас' : 'Всё готово'}
            </button>
          </section>

          {reminder && (
            <section className="panel reminder-panel">
              <div className="panel-heading compact">
                <div><h2>Напоминания</h2><p>Напишем, только если есть слова на сегодня.</p></div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={reminder.enabled}
                    onChange={(event) => saveReminder({ ...reminder, enabled: event.target.checked })}
                  />
                  <span />
                </label>
              </div>
              {reminder.enabled && (
                <label className="time-field">
                  <span>Время</span>
                  <input
                    type="time"
                    value={reminder.time}
                    onChange={(event) => setReminder({ ...reminder, time: event.target.value })}
                    onBlur={() => reminder && saveReminder(reminder)}
                  />
                </label>
              )}
              <small>{savingReminder ? 'Сохраняем…' : reminder.timezone}</small>
            </section>
          )}

          <section className="panel">
            <div className="panel-heading"><h2>Все карточки</h2><span>{cards.length}</span></div>
            <div className="card-list">
              {cards.map((card) => (
                <article className="card-list-item" key={card.id}>
                  <div>
                    <strong>{card.russian}</strong>
                    <span>{card.uzbek}</span>
                    <span className="card-topic-tag">{card.topicTitle}</span>
                  </div>
                  <button className="icon-button danger" onClick={() => remove(card)} aria-label={`Удалить ${card.russian}`}>×</button>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
