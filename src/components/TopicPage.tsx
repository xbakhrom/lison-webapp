import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../api'
import { newWordsLabel } from '../format'
import type { TopicDetail } from '../types'
import { EditableSection } from './EditableSection'
import { ErrorState, Loading } from './Loading'

export function TopicPage({ slug, onReview }: { slug: string; onReview: () => void }) {
  const [topic, setTopic] = useState<TopicDetail | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const reminderOffered = useRef(false)

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
  const notAdded = allWords.filter((word) => !word.added)

  async function addWords(ids: string[]) {
    if (!topic || ids.length === 0) return
    try {
      const { added } = await api.addCards(ids)
      const addedSet = new Set(ids)
      setTopic({
        ...topic,
        vocabulary: topic.vocabulary.map((category) => ({
          ...category,
          items: category.items.map((word) => addedSet.has(word.id) ? { ...word, added: true } : word),
        })),
      })
      setSelected(new Set())
      setNotice(added ? `Добавлено карточек: ${added}` : 'Эти слова уже добавлены')
      window.Telegram?.WebApp.HapticFeedback?.notificationOccurred('success')
      window.setTimeout(() => setNotice(''), 2600)

      if (added > 0 && !reminderOffered.current) {
        reminderOffered.current = true
        window.setTimeout(async () => {
          if (window.confirm('Напоминать о повторениях каждый день в 20:00?')) {
            await api.updateReminder({ enabled: true, time: '20:00', timezone: api.timezone }).catch(() => undefined)
          }
        }, 400)
      }
    } catch (reason) {
      setNotice((reason as Error).message)
    }
  }

  function toggleWord(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleChecklist(itemID: string, checked: boolean) {
    if (!topic) return
    setTopic({
      ...topic,
      checklist: topic.checklist.map((group) => ({
        ...group,
        items: group.items.map((item) => item.id === itemID ? { ...item, checked } : item),
      })),
    })
    try {
      await api.saveChecklist(topic.id, itemID, checked)
    } catch (reason) {
      setNotice((reason as Error).message)
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
          <span><b>{allWords.length - notAdded.length}</b> в карточках</span>
        </div>
      </section>

      <article className="markdown panel prose">
        <ReactMarkdown>{topic.contentMarkdown}</ReactMarkdown>
      </article>

      <section className="panel vocabulary-panel">
        <div className="panel-heading vocabulary-heading">
          <div><span className="section-number">01</span><h2>Новые слова</h2></div>
          <button className="button ghost small" onClick={() => addWords(notAdded.map((word) => word.id))} disabled={notAdded.length === 0}>
            {notAdded.length ? 'Добавить все' : 'Все добавлены'}
          </button>
        </div>
        {topic.vocabulary.map((category) => (
          <div className="vocabulary-group" key={category.id}>
            <h3>{category.title}</h3>
            <div className="word-list">
              {category.items.map((word) => (
                <div className={`word-row ${word.added ? 'added' : ''}`} key={word.id}>
                  <label>
                    <input type="checkbox" checked={word.added || selected.has(word.id)} disabled={word.added} onChange={() => toggleWord(word.id)} />
                    <span className="custom-check">{word.added ? '✓' : ''}</span>
                    <span className="word-pair"><strong>{word.russian}</strong><span>{word.uzbek}</span></span>
                  </label>
                  {!word.added && <button className="word-add" onClick={() => addWords([word.id])} aria-label={`Добавить ${word.russian}`}>+</button>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {selected.size > 0 && (
          <div className="selection-bar">
            <span>Выбрано: {selected.size}</span>
            <button className="button primary small" onClick={() => addWords([...selected])}>Добавить выбранные</button>
          </div>
        )}
      </section>

      <section className="personal-area">
        <div className="section-intro">
          <span className="section-number">02</span>
          <div><h2>Мои ответы</h2><p>Заполняйте постепенно — всё сохранится автоматически.</p></div>
        </div>
        {topic.forms.map((section, index) => <EditableSection key={section.id} topicID={topic.id} section={section} open={index === 0} />)}
      </section>

      <section className="panel checklist-panel">
        <div className="section-intro compact"><span className="section-number">03</span><div><h2>Возможные вопросы</h2><p>Отмечайте вопросы, которые уже проговорили.</p></div></div>
        {topic.checklist.map((group) => (
          <div className="question-group" key={group.title}>
            <h3>{group.title}</h3>
            {group.items.map((item) => (
              <label className={`question-row ${item.checked ? 'checked' : ''}`} key={item.id}>
                <input type="checkbox" checked={item.checked} onChange={(event) => toggleChecklist(item.id, event.target.checked)} />
                <span className="custom-check">{item.checked ? '✓' : ''}</span>
                <span><strong>{item.prompt}</strong>{item.hint && <small>{item.hint}</small>}</span>
              </label>
            ))}
          </div>
        ))}
      </section>

      {allWords.some((word) => word.added) && <button className="button primary wide" onClick={onReview}>Перейти к повторению</button>}
    </div>
  )
}
