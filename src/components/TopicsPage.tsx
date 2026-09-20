import { useEffect, useState } from 'react'
import { api } from '../api'
import { wordsLabel } from '../format'
import type { TopicListItem } from '../types'
import { ErrorState, Loading } from './Loading'

export function TopicsPage({ onOpen }: { onOpen: (slug: string) => void }) {
  const [topics, setTopics] = useState<TopicListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.topics()
      .then(({ topics: loaded }) => active && setTopics(loaded))
      .catch((reason: Error) => active && setError(reason.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [reload])

  if (loading) return <Loading />
  if (error) return <ErrorState message={error} onRetry={() => { setError(''); setReload((value) => value + 1) }} />

  return (
    <div className="page stack-xl">
      <section className="welcome">
        <div className="eyebrow">Учимся через живую речь</div>
        <h1>Выберите тему</h1>
        <p>Читайте материал, сохраняйте нужные слова и повторяйте их вовремя.</p>
      </section>

      <section className="topic-grid">
        {topics.map((topic) => {
          const progress = topic.wordCount ? Math.round((topic.addedCount / topic.wordCount) * 100) : 0
          return (
            <button className="topic-card" key={topic.id} onClick={() => onOpen(topic.slug)}>
              <div className="topic-illustration" aria-hidden="true">
                <span className="building tall" />
                <span className="building short" />
                <span className="building medium" />
              </div>
              <div className="topic-card-content">
                <div className="topic-meta"><span>{topic.level}</span><span>{topic.wordCount} {wordsLabel(topic.wordCount)}</span></div>
                <h2>{topic.title}</h2>
                <p>{topic.summary}</p>
                <div className="progress-row">
                  <span>{topic.addedCount ? `Добавлено ${topic.addedCount} из ${topic.wordCount}` : 'Начать тему'}</span>
                  {topic.dueCount > 0 && <span className="due-badge">{topic.dueCount} сегодня</span>}
                </div>
                <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
              </div>
            </button>
          )
        })}
      </section>
    </div>
  )
}
