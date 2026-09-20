import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../api'
import { newWordsLabel } from '../format'
import type { TopicDetail } from '../types'
import { ErrorState, Loading } from './Loading'

function omitExpressions(markdown: string) {
  const lines = markdown.split('\n')
  const sectionStart = lines.findIndex((line) => line.trim() === '## Выражения')
  if (sectionStart === -1) return markdown

  const nextSectionOffset = lines
    .slice(sectionStart + 1)
    .findIndex((line) => /^##\s+/.test(line.trim()))
  const sectionEnd = nextSectionOffset === -1 ? lines.length : sectionStart + nextSectionOffset + 1

  return [...lines.slice(0, sectionStart), ...lines.slice(sectionEnd)].join('\n').trim()
}

export function TopicPage({ slug, onReview }: { slug: string; onReview: (topicID: string) => void }) {
  const [topic, setTopic] = useState<TopicDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingPractice, setStartingPractice] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.topic(slug)
      .then((data) => active && setTopic(data))
      .catch((reason: Error) => active && setError(reason.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [slug, reload])

  const allWords = useMemo(() => topic?.vocabulary.flatMap((category) => category.items) ?? [], [topic])
  const contentMarkdown = useMemo(() => omitExpressions(topic?.contentMarkdown ?? ''), [topic?.contentMarkdown])
  const notAdded = allWords.filter((word) => !word.added)
  const learningCount = allWords.length - notAdded.length

  async function startPractice() {
    if (!topic || startingPractice) return
    setStartingPractice(true)
    setNotice('')
    try {
      const nextWords = notAdded.slice(0, 10)
      if (nextWords.length > 0) {
        await api.addCards(nextWords.map((word) => word.id))
      }
      window.Telegram?.WebApp.HapticFeedback?.impactOccurred('light')
      onReview(topic.id)
    } catch (reason) {
      setNotice((reason as Error).message)
      setStartingPractice(false)
    }
  }

  if (loading) return <Loading />
  if (error || !topic) return <ErrorState message={error || 'Тема не найдена.'} onRetry={() => { setError(''); setReload((value) => value + 1) }} />

  return (
    <div className="page topic-page stack-lg">
      {notice && <div className="toast">{notice}</div>}
      <section className="topic-hero">
        <span className="topic-level">{topic.level}</span>
        <h1>{topic.title}</h1>
        <p>{topic.summary}</p>
        <div className="topic-stat-row">
          <span><b>{allWords.length}</b> {newWordsLabel(allWords.length)}</span>
          <span><b>{learningCount}</b> в изучении</span>
        </div>
      </section>

      <article className="markdown panel prose">
        <ReactMarkdown>{contentMarkdown}</ReactMarkdown>
      </article>

      <section className="panel vocabulary-panel">
        <div className="panel-heading vocabulary-heading">
          <div><span className="section-number">01</span><h2>Новые слова</h2></div>
          <span>{learningCount}/{allWords.length}</span>
        </div>
        {topic.vocabulary.map((category) => (
          <div className="vocabulary-group" key={category.id}>
            <h3>{category.title}</h3>
            <div className="word-list">
              {category.items.map((word) => (
                <div className="word-row" key={word.id}>
                  <span className="word-pair"><strong>{word.russian}</strong><span>{word.uzbek}</span></span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {allWords.length > 0 && (
        <button className="button primary wide" onClick={startPractice} disabled={startingPractice}>
          {startingPractice
            ? 'Готовим повторение…'
            : notAdded.length === 0
              ? 'Повторить слова'
              : learningCount === 0
                ? 'Начать изучение'
                : 'Продолжить изучение'}
        </button>
      )}
    </div>
  )
}
