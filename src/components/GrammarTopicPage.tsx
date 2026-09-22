import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import {
  advanceDifficulty,
  grammarDifficulty,
  pickNextQuestion,
  pickPracticeSet,
  questionSeconds,
  roundPoints,
  type AdaptiveState,
  type Difficulty,
} from '../grammarAdaptive'
import type { GrammarAnswer, GrammarGameResult, GrammarQuestion, GrammarTopicDetail } from '../types'
import { GrammarKahootGame } from './GrammarKahootGame'
import { ErrorState, Loading } from './Loading'

type Phase = 'lesson' | 'practice' | 'game' | 'result'

type Props = {
  slug: string
  review: boolean
  onDone: () => void
}

const SESSION_SIZE = 10
// A question nobody answered in time is submitted as an empty answer: the API
// compares it with the stored answer and counts it as a miss.
const TIMED_OUT = ''

function safeDifficulty(value: number): Difficulty {
  return Math.min(3, Math.max(1, value)) as Difficulty
}

export function GrammarTopicPage({ slug, review, onDone }: Props) {
  const [topic, setTopic] = useState<GrammarTopicDetail | null>(null)
  const [phase, setPhase] = useState<Phase>(review ? 'game' : 'lesson')
  const [practiceSet, setPracticeSet] = useState<GrammarQuestion[]>([])
  const [practiceIndex, setPracticeIndex] = useState(0)
  const [practiceChoice, setPracticeChoice] = useState('')
  const [practiceCorrect, setPracticeCorrect] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<GrammarQuestion | null>(null)
  const [gameChoice, setGameChoice] = useState('')
  const [timedOut, setTimedOut] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [answers, setAnswers] = useState<GrammarAnswer[]>([])
  const [adaptive, setAdaptive] = useState<AdaptiveState>({ difficulty: 1, correctStreak: 0, mistakeStreak: 0 })
  const [adaptiveMessage, setAdaptiveMessage] = useState('')
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [lastPoints, setLastPoints] = useState(0)
  const [result, setResult] = useState<GrammarGameResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const deadline = useRef(0)
  const resolvedQuestion = useRef('')

  const limitSeconds = currentQuestion ? questionSeconds[safeDifficulty(currentQuestion.difficulty)] : 20
  const answered = Boolean(gameChoice) || timedOut

  const startQuestion = useCallback((question: GrammarQuestion) => {
    setCurrentQuestion(question)
    setGameChoice('')
    setTimedOut(false)
    const limit = questionSeconds[safeDifficulty(question.difficulty)]
    deadline.current = Date.now() + limit * 1000
    resolvedQuestion.current = ''
    setSecondsLeft(limit)
  }, [])

  const startGame = useCallback((currentTopic: GrammarTopicDetail) => {
    const difficulty = review ? safeDifficulty(currentTopic.progress.masteryLevel) : 1
    setAdaptive({ difficulty, correctStreak: 0, mistakeStreak: 0 })
    setAnswers([])
    setAdaptiveMessage(review && difficulty > 1 ? `Начинаем с уровня «${grammarDifficulty[difficulty].label}»` : '')
    setScore(0)
    setStreak(0)
    setBestStreak(0)
    setLastPoints(0)
    setResult(null)
    setError('')
    const first = pickNextQuestion(currentTopic.game, new Set(), difficulty)
    if (first) startQuestion(first)
    setPhase('game')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [review, startQuestion])

  useEffect(() => {
    let active = true
    api.grammarTopic(slug)
      .then((data) => {
        if (!active) return
        setTopic(data)
        setPracticeSet(pickPracticeSet(data.practice))
        if (review) startGame(data)
      })
      .catch((reason: Error) => active && setError(reason.message))
    return () => { active = false }
  }, [slug, reload, review, startGame])

  const sessionSize = Math.min(SESSION_SIZE, topic?.game.length ?? SESSION_SIZE)

  function registerAnswer(option: string, remainingSeconds: number) {
    if (!currentQuestion) return
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

    const points = roundPoints(correct, remainingSeconds, limitSeconds, streak)
    setLastPoints(points)
    setScore((value) => value + points)
    if (correct) {
      setStreak((value) => {
        const next = value + 1
        setBestStreak((best) => Math.max(best, next))
        return next
      })
    } else {
      setStreak(0)
    }
    setAnswers((current) => [...current, { questionId: currentQuestion.id, answer: option }])
    window.Telegram?.WebApp.HapticFeedback?.notificationOccurred(correct ? 'success' : 'error')
  }

  // The countdown is the whole point of the Kahoot format, so it runs off a
  // wall-clock deadline instead of a tick counter that a backgrounded tab drifts.
  useEffect(() => {
    if (phase !== 'game' || !currentQuestion || answered) return
    const tick = () => {
      const remaining = Math.max(0, (deadline.current - Date.now()) / 1000)
      setSecondsLeft((shown) => (shown === Math.ceil(remaining) ? shown : Math.ceil(remaining)))
      // The ref, not the state flag, guards the miss: a second tick can fire
      // before React re-renders with timedOut set.
      if (remaining <= 0 && resolvedQuestion.current !== currentQuestion.id) {
        resolvedQuestion.current = currentQuestion.id
        setTimedOut(true)
        registerAnswer(TIMED_OUT, 0)
      }
    }
    const timer = window.setInterval(tick, 200)
    return () => window.clearInterval(timer)
  })

  function choosePractice(option: string) {
    if (practiceChoice) return
    setPracticeChoice(option)
    const question = practiceSet[practiceIndex]
    if (question && option === question.answer) setPracticeCorrect((value) => value + 1)
    window.Telegram?.WebApp.HapticFeedback?.notificationOccurred(option === question?.answer ? 'success' : 'error')
  }

  function nextPractice() {
    if (!topic) return
    if (practiceIndex + 1 < practiceSet.length) {
      setPracticeIndex((value) => value + 1)
      setPracticeChoice('')
    } else {
      startGame(topic)
    }
  }

  function chooseGame(option: string) {
    if (answered || !currentQuestion || resolvedQuestion.current === currentQuestion.id) return
    resolvedQuestion.current = currentQuestion.id
    setGameChoice(option)
    registerAnswer(option, Math.max(0, (deadline.current - Date.now()) / 1000))
  }

  async function nextGame() {
    if (!topic || !currentQuestion || !answered || saving) return

    const usedIDs = new Set(answers.map((answer) => answer.questionId))
    if (answers.length < sessionSize) {
      const nextQuestion = pickNextQuestion(topic.game, usedIDs, adaptive.difficulty, currentQuestion.kind)
      if (nextQuestion) {
        startQuestion(nextQuestion)
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

  function restart() {
    if (!topic) return
    setPhase('lesson')
    setPracticeSet(pickPracticeSet(topic.practice))
    setPracticeIndex(0)
    setPracticeChoice('')
    setPracticeCorrect(0)
    setAnswers([])
    setResult(null)
  }

  if (!topic && !error) return <Loading />
  if (!topic) return <ErrorState message={error} onRetry={() => { setError(''); setReload((value) => value + 1) }} />

  if (phase === 'game' && currentQuestion) {
    return (
      <GrammarKahootGame
        topic={topic}
        question={currentQuestion}
        answered={answers.length}
        total={sessionSize}
        choice={gameChoice}
        timedOut={timedOut}
        secondsLeft={secondsLeft}
        limitSeconds={limitSeconds}
        score={score}
        streak={streak}
        lastPoints={lastPoints}
        saving={saving}
        error={error}
        review={review}
        nextDifficulty={adaptive.difficulty}
        adaptiveMessage={adaptiveMessage}
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
        <div className="eyebrow">Раунд завершён</div>
        <h1>{passed ? 'Правило закреплено' : 'Ещё один короткий круг'}</h1>
        <p>{passed
          ? `Верно ${result.correct} из ${result.total}. Следующее повторение появится через ${result.intervalDays} дн.`
          : `Верно ${result.correct} из ${result.total}. Вернёмся к простым примерам и попробуем ещё раз.`}</p>
        <div className="kahoot-podium">
          <span><strong>{score}</strong><small>очков</small></span>
          <span><strong>{result.score}%</strong><small>точность</small></span>
          <span><strong>{bestStreak}</strong><small>серия подряд</small></span>
        </div>
        <p className="kahoot-podium-note">Уровень заданий: {resultDifficulty.label}</p>
        <button className="button primary wide" onClick={onDone}>К учебному маршруту</button>
        {!passed && <button className="button ghost wide" onClick={restart}>Повторить правило</button>}
      </div>
    )
  }

  if (phase === 'practice') {
    const question = practiceSet[practiceIndex]
    if (!question) return <Loading />
    return (
      <div className="page grammar-practice-page">
        <div className="grammar-flow-head">
          <div><span>Разминка · без таймера</span><strong>{topic.title}</strong></div>
          <span>{practiceIndex + 1}/{practiceSet.length}</span>
        </div>
        <div className="progress-track"><span style={{ width: `${((practiceIndex + 1) / practiceSet.length) * 100}%` }} /></div>
        <QuestionCard question={question} choice={practiceChoice} onChoose={choosePractice} />
        {practiceChoice && (
          <button className="button primary wide" onClick={nextPractice}>
            {practiceIndex + 1 === practiceSet.length ? `Начать игру · ${practiceCorrect}/${practiceSet.length}` : 'Дальше'}
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
        <span><b>3</b>Игра</span>
      </div>

      <section className="grammar-difficulty-map" aria-label="Уровни заданий">
        {([1, 2, 3] as Difficulty[]).map((difficulty, index) => (
          <div className={`level-${difficulty}`} key={difficulty}>
            <b>{difficulty}</b>
            <span><strong>{grammarDifficulty[difficulty].label}</strong><small>{gameCounts[index]} заданий в банке</small></span>
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
