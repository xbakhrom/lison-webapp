import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { advanceDifficulty, grammarDifficulty, pickNextQuestion, type AdaptiveState, type Difficulty } from '../grammarAdaptive'
import type { GrammarAnswer, GrammarGameResult, GrammarQuestion, GrammarTopicDetail } from '../types'
import { GrammarQuestGame } from './GrammarQuestGame'
import { ErrorState, Loading } from './Loading'

type Phase = 'lesson' | 'practice' | 'game' | 'result'

type Props = {
  slug: string
  review: boolean
  onDone: () => void
}

const SESSION_SIZE = 8

function safeDifficulty(value: number): Difficulty {
  return Math.min(3, Math.max(1, value)) as Difficulty
}

export function GrammarTopicPage({ slug, review, onDone }: Props) {
  const [topic, setTopic] = useState<GrammarTopicDetail | null>(null)
  const [phase, setPhase] = useState<Phase>(review ? 'game' : 'lesson')
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [practiceChoice, setPracticeChoice] = useState('')
  const [practiceCorrect, setPracticeCorrect] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<GrammarQuestion | null>(null)
  const [gameChoice, setGameChoice] = useState('')
  const [answers, setAnswers] = useState<GrammarAnswer[]>([])
  const [adaptive, setAdaptive] = useState<AdaptiveState>({ difficulty: 1, correctStreak: 0, mistakeStreak: 0 })
  const [adaptiveMessage, setAdaptiveMessage] = useState('')
  const [questXP, setQuestXP] = useState(0)
  const [questCombo, setQuestCombo] = useState(0)
  const [questHearts, setQuestHearts] = useState(3)
  const [result, setResult] = useState<GrammarGameResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    api.grammarTopic(slug)
      .then((data) => {
        if (!active) return
        setTopic(data)
        if (review) startGame(data)
      })
      .catch((reason: Error) => active && setError(reason.message))
    return () => { active = false }
  }, [slug, reload, review])

  const sessionSize = Math.min(SESSION_SIZE, topic?.game.length ?? SESSION_SIZE)
  const gameProgress = sessionSize ? (answers.length / sessionSize) * 100 : 0

  function startGame(currentTopic: GrammarTopicDetail) {
    const difficulty = review ? safeDifficulty(currentTopic.progress.masteryLevel) : 1
    const state: AdaptiveState = { difficulty, correctStreak: 0, mistakeStreak: 0 }
    setAdaptive(state)
    setAnswers([])
    setGameChoice('')
    setAdaptiveMessage(review && difficulty > 1 ? `Начинаем с уровня «${grammarDifficulty[difficulty].label}»` : '')
    setQuestXP(0)
    setQuestCombo(0)
    setQuestHearts(3)
    setResult(null)
    setError('')
    setCurrentQuestion(pickNextQuestion(currentTopic.game, new Set(), difficulty))
    setPhase('game')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
      startGame(topic)
    }
  }

  function chooseGame(option: string) {
    if (gameChoice || !currentQuestion) return
    const correct = option === currentQuestion.answer
    const nextAdaptive = advanceDifficulty(adaptive, correct)
    if (nextAdaptive.difficulty > adaptive.difficulty) {
      setAdaptiveMessage(`Отличная серия — переходим на уровень «${grammarDifficulty[nextAdaptive.difficulty].label}»`)
    } else if (nextAdaptive.difficulty < adaptive.difficulty) {
      setAdaptiveMessage('Закрепим основу — следующий вопрос будет проще')
    } else {
      setAdaptiveMessage('')
    }
    setAdaptive(nextAdaptive)
    if (correct) {
      setQuestXP((value) => value + currentQuestion.difficulty * 20 + Math.min(questCombo, 4) * 5)
      setQuestCombo((value) => value + 1)
      if ((questCombo + 1) % 3 === 0) setQuestHearts((value) => Math.min(3, value + 1))
    } else {
      setQuestCombo(0)
      setQuestHearts((value) => Math.max(0, value - 1))
    }
    setGameChoice(option)
    setAnswers((current) => [...current, { questionId: currentQuestion.id, answer: option }])
    window.Telegram?.WebApp.HapticFeedback?.notificationOccurred(correct ? 'success' : 'error')
  }

  async function nextGame() {
    if (!topic || !currentQuestion || !gameChoice || saving) return

    const usedIDs = new Set(answers.map((answer) => answer.questionId))
    if (answers.length < sessionSize) {
      const nextQuestion = pickNextQuestion(topic.game, usedIDs, adaptive.difficulty, currentQuestion.kind)
      if (nextQuestion) {
        setCurrentQuestion(nextQuestion)
        setGameChoice('')
        return
      }
    }

    setSaving(true)
    setError('')
    try {
      const gameResult = await api.finishGrammarGame(topic.id, answers)
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

  if (phase === 'game' && currentQuestion) {
    return (
      <GrammarQuestGame
        topic={topic}
        question={currentQuestion}
        answered={answers.length}
        total={sessionSize}
        choice={gameChoice}
        progress={gameProgress}
        saving={saving}
        error={error}
        review={review}
        nextDifficulty={adaptive.difficulty}
        adaptiveMessage={adaptiveMessage}
        xp={questXP}
        combo={questCombo}
        hearts={questHearts}
        onChoose={chooseGame}
        onNext={nextGame}
      />
    )
  }

  if (phase === 'result' && result) {
    const passed = result.status === 'review'
    const resultDifficulty = grammarDifficulty[safeDifficulty(result.masteryLevel)]
    return (
      <div className="page grammar-result">
        <div className={`grammar-result-orbit ${passed ? '' : 'retry'}`} aria-hidden="true">
          <span>{passed ? '✓' : '↻'}</span><i /><b>★</b>
        </div>
        <div className="eyebrow">Lison Quest завершён</div>
        <h1>{passed ? 'Правило закреплено' : 'Ещё один короткий круг'}</h1>
        <p>{passed
          ? `Верно ${result.correct} из ${result.total}. Следующее повторение появится через ${result.intervalDays} дн.`
          : `Верно ${result.correct} из ${result.total}. Вернёмся к простым примерам и попробуем ещё раз.`}</p>
        <div className="grammar-score"><strong>{result.score}%</strong><span>+{questXP} XP · уровень заданий {resultDifficulty.label}</span></div>
        <button className="button primary wide" onClick={onDone}>К учебному маршруту</button>
        {!passed && <button className="button ghost wide" onClick={() => { setPhase('lesson'); setPracticeIndex(0); setPracticeChoice(''); setPracticeCorrect(0); setAnswers([]); setResult(null) }}>Повторить правило</button>}
      </div>
    )
  }

  if (phase === 'practice') {
    const question = topic.practice[practiceIndex]
    return (
      <div className="page grammar-practice-page">
        <div className="grammar-flow-head">
          <div><span>Разминка · легко</span><strong>{topic.title}</strong></div>
          <span>{practiceIndex + 1}/{topic.practice.length}</span>
        </div>
        <div className="progress-track"><span style={{ width: `${((practiceIndex + 1) / topic.practice.length) * 100}%` }} /></div>
        <QuestionCard question={question} choice={practiceChoice} onChoose={choosePractice} />
        {practiceChoice && (
          <button className="button primary wide" onClick={nextPractice}>
            {practiceIndex + 1 === topic.practice.length ? `Начать Lison Quest · ${practiceCorrect}/${topic.practice.length}` : 'Дальше'}
          </button>
        )}
      </div>
    )
  }

  const gameCounts = ([1, 2, 3] as Difficulty[]).map((difficulty) => topic.game.filter((question) => question.difficulty === difficulty).length)

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
        <span><b>2</b>Разминка</span><i />
        <span><b>3</b>2D-квест</span>
      </div>

      <section className="grammar-difficulty-map" aria-label="Уровни заданий">
        {([1, 2, 3] as Difficulty[]).map((difficulty, index) => (
          <div className={`level-${difficulty}`} key={difficulty}>
            <b>{difficulty}</b>
            <span><strong>{grammarDifficulty[difficulty].label}</strong><small>{gameCounts[index]} задания в банке</small></span>
          </div>
        ))}
      </section>

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
        Начать с лёгкой разминки
      </button>
    </div>
  )
}

function QuestionCard({ question, choice, onChoose }: { question: GrammarQuestion; choice: string; onChoose: (option: string) => void }) {
  const difficulty = grammarDifficulty[question.difficulty]
  const kindLabel = question.kind === 'order' ? 'Соберите фразу' : question.kind === 'true_false' ? 'Верно / неверно' : 'Выберите ответ'

  return (
    <section className="grammar-question-card">
      <div className="grammar-question-meta">
        <span className={`grammar-difficulty-pill level-${question.difficulty}`}>{difficulty.label}</span>
        <span>{kindLabel}</span>
      </div>
      <span className="eyebrow">{question.prompt}</span>
      <h2>{question.phrase}</h2>
      {question.kind === 'order' ? (
        <OrderQuestion question={question} choice={choice} onChoose={onChoose} />
      ) : (
        <div className={`grammar-options ${question.kind === 'true_false' ? 'true-false' : ''}`}>
          {(question.options ?? []).map((option) => {
            const state = choice ? (option === question.answer ? 'correct' : option === choice ? 'wrong' : 'muted') : ''
            return <button className={state} key={option} onClick={() => onChoose(option)} disabled={Boolean(choice)}><span>{option}</span>{state === 'correct' && <b>✓</b>}{state === 'wrong' && <b>×</b>}</button>
          })}
        </div>
      )}
      {choice && <div className={`grammar-explanation ${choice === question.answer ? 'correct' : 'wrong'}`}><strong>{choice === question.answer ? 'Точно!' : `Правильно: ${question.answer}`}</strong><span>{question.explanation}</span></div>}
    </section>
  )
}

function OrderQuestion({ question, choice, onChoose }: { question: GrammarQuestion; choice: string; onChoose: (option: string) => void }) {
  const tokens = useMemo(() => {
    const source = (question.tokens ?? []).map((token, index) => ({ token, index }))
    const shuffled = [...source].sort((left, right) => tokenHash(`${question.id}-${left.index}`) - tokenHash(`${question.id}-${right.index}`))
    return shuffled.every((item, index) => item.index === index) ? shuffled.reverse() : shuffled
  }, [question])
  const [selected, setSelected] = useState<number[]>([])

  useEffect(() => setSelected([]), [question.id])

  const selectedTokens = selected.map((index) => tokens.find((item) => item.index === index)).filter(Boolean)

  return (
    <div className="grammar-order">
      <div className={`grammar-order-answer ${choice ? (choice === question.answer ? 'correct' : 'wrong') : ''}`}>
        {selectedTokens.length ? selectedTokens.map((item) => (
          <button key={item!.index} disabled={Boolean(choice)} onClick={() => setSelected((current) => current.filter((index) => index !== item!.index))}>{item!.token}</button>
        )) : <span>Нажимайте на слова по порядку</span>}
      </div>
      <div className="grammar-order-tokens">
        {tokens.map((item) => (
          <button key={item.index} disabled={Boolean(choice) || selected.includes(item.index)} onClick={() => setSelected((current) => [...current, item.index])}>{item.token}</button>
        ))}
      </div>
      {!choice && <button className="grammar-order-check" disabled={selected.length !== tokens.length} onClick={() => onChoose(selectedTokens.map((item) => item!.token).join(' '))}>Проверить фразу</button>}
    </div>
  )
}

function tokenHash(value: string) {
  return [...value].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 997, 7)
}
