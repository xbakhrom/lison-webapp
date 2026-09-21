import { useEffect, useState } from 'react'
import { api } from '../api'
import type { GrammarTopicListItem } from '../types'
import { ErrorState, Loading } from './Loading'

type Props = {
  onOpen: (slug: string, review: boolean) => void
}

export function GrammarPage({ onOpen }: Props) {
  const [topics, setTopics] = useState<GrammarTopicListItem[]>([])
  const [dueCount, setDueCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.grammarTopics()
      .then((data) => {
        if (!active) return
        setTopics(data.topics)
        setDueCount(data.dueCount)
      })
      .catch((reason: Error) => active && setError(reason.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [reload])

  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={() => { setError(''); setReload((value) => value + 1) }} />

  const learned = topics.filter((topic) => topic.status === 'review').length

  return (
    <div className="page grammar-index stack-xl">
      <section className="grammar-welcome">
        <div>
          <div className="eyebrow">Грамматика без перегруза</div>
          <h1>Поймите правило.<br />Закрепите в игре.</h1>
          <p>Короткие объяснения, практика и лёгкие повторения в нужный момент.</p>
        </div>
        <div className="grammar-welcome-orbit" aria-hidden="true">
          <span>Л</span><i /><b>я</b>
        </div>
      </section>

      {dueCount > 0 && (
        <section className="grammar-due-callout">
          <div className="grammar-due-icon" aria-hidden="true">↻</div>
          <div>
            <span>Пора освежить</span>
            <strong>{dueCount} {dueCount === 1 ? 'тема ждёт' : 'темы ждут'} повторения</strong>
            <small>Одна игра — и правило снова в памяти.</small>
          </div>
        </section>
      )}

      <section>
        <div className="grammar-section-heading">
          <div>
            <span className="eyebrow">Ваша программа</span>
            <h2>Изученные темы</h2>
          </div>
          <span>{learned}/{topics.length}</span>
        </div>
        <div className="grammar-grid">
          {topics.map((topic, index) => (
            <button
              className={`grammar-card ${topic.due ? 'is-due' : ''}`}
              key={topic.id}
              onClick={() => onOpen(topic.slug, topic.due)}
            >
              <span className="grammar-card-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="grammar-card-icon" aria-hidden="true">{topic.icon}</span>
              <span className="grammar-card-copy">
                <span className="grammar-card-meta">
                  <span>{topic.level}</span>
                  {topic.due && <b>Повторить</b>}
                  {!topic.due && topic.status === 'review' && <b className="learned">{topic.bestScore}%</b>}
                </span>
                <strong>{topic.title}</strong>
                <small>{topic.summary}</small>
              </span>
              <span className="grammar-card-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
