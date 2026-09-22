import { useEffect, useState } from 'react'
import { api } from '../api'
import { grammarDifficulty } from '../grammarAdaptive'
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
  const groups = [
    {
      key: 'A1',
      eyebrow: 'Старт · A1',
      title: 'Собираем основу',
      description: 'Сначала слова и базовые формы, затем первые падежи и время.',
      topics: topics.filter((topic) => topic.level.startsWith('A1')),
    },
    {
      key: 'A2',
      eyebrow: 'Следующий шаг · A2',
      title: 'Говорим точнее',
      description: 'Расширяем падежи и переходим к более тонким значениям.',
      topics: topics.filter((topic) => !topic.level.startsWith('A1')),
    },
  ]

  return (
    <div className="page grammar-index stack-xl">
      <section className="grammar-welcome">
        <div>
          <div className="eyebrow">Ваш маршрут A1 → A2</div>
          <h1>От простого<br />к уверенному.</h1>
          <p>Задания подстраиваются под ответы: два верных — сложнее, две ошибки — снова проще.</p>
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

      <section className="grammar-route-summary" aria-label="Прогресс по маршруту">
        <span><strong>{learned}</strong><small>тем изучено</small></span>
        <i />
        <span><strong>3</strong><small>уровня заданий</small></span>
        <i />
        <span><strong>{dueCount}</strong><small>ждут повтора</small></span>
      </section>

      {groups.map((group) => group.topics.length > 0 && (
        <section className="grammar-level-group" key={group.key}>
          <div className="grammar-section-heading">
            <div>
              <span className="eyebrow">{group.eyebrow}</span>
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            <span>{group.topics.filter((topic) => topic.status === 'review').length}/{group.topics.length}</span>
          </div>
          <div className="grammar-grid">
            {group.topics.map((topic) => {
              const routeIndex = topics.findIndex((item) => item.id === topic.id)
              const mastery = grammarDifficulty[Math.min(3, Math.max(1, topic.masteryLevel)) as 1 | 2 | 3]
              return (
                <button
                  className={`grammar-card ${topic.due ? 'is-due' : ''}`}
                  key={topic.id}
                  onClick={() => onOpen(topic.slug, topic.due)}
                >
                  <span className="grammar-card-number">{String(routeIndex + 1).padStart(2, '0')}</span>
                  <span className="grammar-card-icon" aria-hidden="true">{topic.icon}</span>
                  <span className="grammar-card-copy">
                    <span className="grammar-card-meta">
                      <span>{topic.level}</span>
                      {topic.due && <b>Повторить</b>}
                      {!topic.due && topic.status === 'review' && <b className="learned">{topic.bestScore}%</b>}
                    </span>
                    <strong>{topic.title}</strong>
                    <small>{topic.summary}</small>
                    <span className={`grammar-mastery level-${topic.masteryLevel}`}>{mastery.label}</span>
                  </span>
                  <span className="grammar-card-arrow" aria-hidden="true">→</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
