import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { FeedbackCategory } from '../types'

const categories: { value: FeedbackCategory; label: string }[] = [
  { value: 'idea', label: 'Идея' },
  { value: 'bug', label: 'Ошибка' },
  { value: 'content', label: 'Контент' },
  { value: 'other', label: 'Другое' },
]

type FeedbackSheetProps = {
  open: boolean
  onClose: () => void
  screen: string
  topicSlug: string
}

export function FeedbackSheet({ open, onClose, screen, topicSlug }: FeedbackSheetProps) {
  const [category, setCategory] = useState<FeedbackCategory>('idea')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setError('')
    window.setTimeout(() => textareaRef.current?.focus(), 180)
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, onClose, submitting])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = message.trim()
    if (trimmed.length < 5 || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await api.sendFeedback({ category, message: trimmed, screen, topicSlug })
      setSent(true)
      window.Telegram?.WebApp.HapticFeedback?.notificationOccurred('success')
      window.setTimeout(() => {
        onClose()
        setMessage('')
        setCategory('idea')
        setSent(false)
      }, 1300)
    } catch (reason) {
      setError((reason as Error).message)
      window.Telegram?.WebApp.HapticFeedback?.notificationOccurred('error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="feedback-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <section className="feedback-sheet" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        {sent ? (
          <div className="feedback-success" role="status">
            <span aria-hidden="true">✓</span>
            <h2>Спасибо!</h2>
            <p>Предложение отправлено.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="feedback-heading">
              <div>
                <div className="eyebrow">Обратная связь</div>
                <h2 id="feedback-title">Помогите улучшить Lison</h2>
              </div>
              <button type="button" className="icon-button" onClick={onClose} disabled={submitting} aria-label="Закрыть">×</button>
            </div>

            <div className="feedback-categories" aria-label="Тип предложения">
              {categories.map((item) => (
                <button
                  type="button"
                  className={category === item.value ? 'active' : ''}
                  aria-pressed={category === item.value}
                  key={item.value}
                  onClick={() => setCategory(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="feedback-field">
              <span>Что стоит добавить или изменить?</span>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={1000}
                rows={5}
                placeholder="Опишите идею или проблему…"
                disabled={submitting}
              />
            </label>

            <div className="feedback-meta">
              <small>Telegram-профиль и текущий экран добавятся автоматически.</small>
              <span>{message.length}/1000</span>
            </div>
            {error && <div className="inline-error">{error}</div>}
            <button className="button primary wide" disabled={message.trim().length < 5 || submitting}>
              {submitting ? 'Отправляем…' : 'Отправить'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
