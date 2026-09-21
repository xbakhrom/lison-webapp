import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { GrammarGameResult, GrammarQuestion, GrammarTopicDetail } from '../types'
import { ErrorState, Loading } from './Loading'

type Phase = 'lesson' | 'practice' | 'game' | 'result'

type Props = {
  slug: string
  review: boolean
  onDone: () => void
}

export function GrammarTopicPage({ slug, review, onDone }: Props) {
  const [topic, setTopic] = useState<GrammarTopicDetail | null>(null)
  const [phase, setPhase] = useState<Phase>(review ? 'game' : 'lesson')
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [practiceChoice, setPracticeChoice] = useState('')
  const [practiceCorrect, setPracticeCorrect] = useState(0)
  const [gameIndex, setGameIndex] = useState(0)
  const [gameChoice, setGameChoice] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<GrammarGameResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    api.grammarTopic(slug)
      .then((data) => active && setTopic(data))
      .catch((reason: Error) => active && setError(reason.message))
    return () => { active = false }
  }, [slug, reload])

  const gameProgress = useMemo(() => {
    if (!topic?.game.length) return 0
    return ((gameIndex + (gameChoice ? 1 : 0)) / topic.game.length) * 100
  }, [topic, gameIndex, gameChoice])

  function choosePractice(option: string) {
    if (practiceChoice) return
    setPracticeChoice(option)
    const question = topic?.practice[practiceIndex]
    if (question && option === question.answer) setPracticeCorrect((value) => value + 1)
    window.Telegram?.WebApp.HapticFeedback?.notificationOccurred(option === question?.answer ? 'success' : 'error')
  }

  function nextPractice() {
    if (!topic) return
    if (practiceIndex + 1 < topic.practice.length) {
      setPracticeIndex((value) => value + 1)
      setPracticeChoice('')
    } else {
      setPhase('game')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function chooseGame(option: string) {
    if (gameChoice || !topic) return
    const question = topic.game[gameIndex]
    setGameChoice(option)
    setAnswers((current) => ({ ...current, [question.id]: option }))
    window.Telegram?.WebApp.HapticFeedback?.notificationOccurred(option === question.answer ? 'success' : 'error')
  }

  async function nextGame() {
    if (!topic || !gameChoice || saving) return
    if (gameIndex + 1 < topic.game.length) {
      setGameIndex((value) => value + 1)
      setGameChoice('')
      return
    }
    const finalAnswers = { ...answers, [topic.game[gameIndex].id]: gameChoice }
    setSaving(true)
    setError('')
    try {
      const gameResult = await api.finishGrammarGame(topic.id, finalAnswers)
      setResult(gameResult)
      setPhase('result')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!topic && !error) return <Loading />
  if (!topic) return <ErrorState message={error} onRetry={() => { setError(''); setReload((value) => value + 1) }} />

  if (phase === 'game') {
    const question = topic.game[gameIndex]
    return (
      <GrammarGame
        topic={topic}
        question={question}
        index={gameIndex}
        choice={gameChoice}
        progress={gameProgress}
        saving={saving}
        error={error}
        review={review}
        onChoose={chooseGame}
        onNext={nextGame}
      />
    )
  }

  if (phase === 'result' && result) {
    const passed = result.status === 'review'
    return (
      <div className="page grammar-result">
        <div className={`grammar-result-orbit ${passed ? '' : 'retry'}`} aria-hidden="true">
          <span>{passed ? '✓' : '↻'}</span><i /><b>★</b>
        </div>
        <div className="eyebrow">Игра завершена</div>
        <h1>{passed ? 'Правило закреплено' : 'Ещё один короткий круг'}</h1>
        <p>{passed
          ? `Верно ${result.correct} из ${result.total}. Следующая лёгкая игра появится через ${result.intervalDays} дн.`
          : `Верно ${result.correct} из ${result.total}. Посмотрите объяснения и попробуйте ещё раз — тема останется на сегодня.`}</p>
        <div className="grammar-score"><strong>{result.score}%</strong><span>лучший результат сохраняется</span></div>
        <button className="button primary wide" onClick={onDone}>К списку грамматики</button>
        {!passed && <button className="button ghost wide" onClick={() => { setPhase('lesson'); setGameIndex(0); setGameChoice(''); setAnswers({}); setResult(null) }}>Повторить правило</button>}
      </div>
    )
  }

  if (phase === 'practice') {
    const question = topic.practice[practiceIndex]
    return (
      <div className="page grammar-practice-page">
        <div className="grammar-flow-head">
          <div><span>Практика</span><strong>{topic.title}</strong></div>
          <span>{practiceIndex + 1}/{topic.practice.length}</span>
        </div>
        <div className="progress-track"><span style={{ width: `${((practiceIndex + 1) / topic.practice.length) * 100}%` }} /></div>
        <QuestionCard question={question} choice={practiceChoice} onChoose={choosePractice} />
        {practiceChoice && (
          <button className="button primary wide" onClick={nextPractice}>
            {practiceIndex + 1 === topic.practice.length ? `В игру · ${practiceCorrect}/${topic.practice.length}` : 'Дальше'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="page grammar-topic-page stack-lg">
      <section className="grammar-topic-hero">
        <div className="grammar-topic-icon" aria-hidden="true">{topic.icon}</div>
        <div>
          <span>{topic.level} · {topic.lesson.length} шага</span>
          <h1>{topic.title}</h1>
          <p>{topic.summary}</p>
        </div>
      </section>

      <div className="grammar-roadmap" aria-label="Этапы изучения">
        <span className="active"><b>1</b>Правило</span><i />
        <span><b>2</b>Практика</span><i />
        <span><b>3</b>Игра</span>
      </div>

      <section className="grammar-lessons">
        {topic.lesson.map((block, index) => (
          <article className="grammar-lesson-card" key={block.title}>
            <span className="grammar-lesson-index">{String(index + 1).padStart(2, '0')}</span>
            <h2>{block.title}</h2>
            <p>{block.text}</p>
            <div className="grammar-examples">
              {block.examples.map((example) => <code key={example}>{example}</code>)}
            </div>
            {block.note && <aside><span>Запомнить</span>{block.note}</aside>}
          </article>
        ))}
      </section>

      <button className="button primary wide grammar-start" onClick={() => { setPhase('practice'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
        Проверить себя
      </button>
    </div>
  )
}

function QuestionCard({ question, choice, onChoose }: { question: GrammarQuestion; choice: string; onChoose: (option: string) => void }) {
  return (
    <section className="grammar-question-card">
      <span className="eyebrow">{question.prompt}</span>
      <h2>{question.phrase}</h2>
      <div className="grammar-options">
        {question.options.map((option) => {
          const state = choice ? (option === question.answer ? 'correct' : option === choice ? 'wrong' : 'muted') : ''
          return <button className={state} key={option} onClick={() => onChoose(option)} disabled={Boolean(choice)}><span>{option}</span>{state === 'correct' && <b>✓</b>}{state === 'wrong' && <b>×</b>}</button>
        })}
      </div>
      {choice && <div className={`grammar-explanation ${choice === question.answer ? 'correct' : 'wrong'}`}><strong>{choice === question.answer ? 'Точно!' : `Правильно: ${question.answer}`}</strong><span>{question.explanation}</span></div>}
    </section>
  )
}

function GrammarGame({ topic, question, index, choice, progress, saving, error, review, onChoose, onNext }: {
  topic: GrammarTopicDetail
  question: GrammarQuestion
  index: number
  choice: string
  progress: number
  saving: boolean
  error: string
  review: boolean
  onChoose: (option: string) => void
  onNext: () => void
}) {
  const position = Math.min(92, 8 + progress * .84)
  return (
    <div className="grammar-game-shell">
      <div className="grammar-game-sky" aria-hidden="true"><i /><i /><i /></div>
      <div className="grammar-game-header">
        <div><span>{review ? 'Повторение' : 'Игра на закрепление'}</span><strong>{topic.title}</strong></div>
        <b>{index + 1}/{topic.game.length}</b>
      </div>
      <div className="grammar-game-route" aria-hidden="true">
        <div className="grammar-game-line"><span style={{ width: `${progress}%` }} /></div>
        <div className={`grammar-mascot ${choice === question.answer ? 'is-happy' : choice ? 'is-shaking' : ''}`} style={{ left: `${position}%` }}><span>Л</span></div>
        <b className="grammar-finish">★</b>
      </div>
      <div className="grammar-game-content">
        <QuestionCard question={question} choice={choice} onChoose={onChoose} />
        {error && <div className="inline-error">{error}</div>}
        {choice && <button className="button light wide" onClick={onNext} disabled={saving}>{saving ? 'Сохраняем результат…' : index + 1 === topic.game.length ? 'Завершить маршрут' : 'К следующей станции'}</button>}
      </div>
    </div>
  )
}
