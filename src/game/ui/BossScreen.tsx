import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../engine/audio'
import { BOSS_PASS_RATIO, BOSS_TIME_LIMIT, buildBossRound, bossPassed, optionsFor, type Task } from '../gameplay/session'
import { t } from '../i18n'
import type { Episode, EpisodeItem } from '../types'
import { Prompt } from './Prompt'
import { TaskBody } from './TaskBody'

type Props = {
  episode: Episode
  zoneCaptions: Record<string, string>
  onAnswered: (item: EpisodeItem, correct: boolean) => void
  onPassed: (correct: number, total: number) => void
  onExit: () => void
}

type Stage = 'intro' | 'asking' | 'verdict'

/**
 * Spec §4.4: ten questions, 60% of them exceptions, fifteen seconds each and a
 * 90% pass mark. A failed attempt redraws the round from the same bank.
 */
export function BossScreen({ episode, zoneCaptions, onAnswered, onPassed, onExit }: Props) {
  const [attempt, setAttempt] = useState(0)
  const [stage, setStage] = useState<Stage>('intro')
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [chosen, setChosen] = useState('')
  const [timedOut, setTimedOut] = useState(false)
  const [seconds, setSeconds] = useState(BOSS_TIME_LIMIT)

  const round = useMemo<Task[]>(() => buildBossRound(episode), [episode, attempt])
  const task = round[index]
  const options = useMemo(() => (task ? optionsFor(task.item) : []), [task])
  const answered = chosen !== '' || timedOut
  const answeredRef = useRef(false)
  answeredRef.current = answered

  // Callbacks are read through refs so a parent re-render can never restart the
  // countdown or report the same answer twice.
  const answeredCallback = useRef(onAnswered)
  const passedCallback = useRef(onPassed)
  answeredCallback.current = onAnswered
  passedCallback.current = onPassed

  const finish = useCallback((item: EpisodeItem, value: string) => {
    const isCorrect = value === item.answer
    if (isCorrect) {
      setCorrect((current) => current + 1)
      sfx.correct()
    } else {
      sfx.wrong()
    }
    answeredCallback.current(item, isCorrect)
  }, [])

  // One countdown per question; running out counts as a wrong answer.
  useEffect(() => {
    if (stage !== 'asking' || !task) return
    setSeconds(BOSS_TIME_LIMIT)
    setChosen('')
    setTimedOut(false)
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (answeredRef.current) return
      const left = BOSS_TIME_LIMIT - Math.floor((Date.now() - started) / 1000)
      setSeconds(Math.max(0, left))
      if (left <= 0) {
        window.clearInterval(timer)
        setTimedOut(true)
        finish(task.item, '')
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [stage, task, finish])

  useEffect(() => {
    if (!answered) return
    const timer = window.setTimeout(() => {
      if (index + 1 >= round.length) setStage('verdict')
      else setIndex((current) => current + 1)
    }, chosen && chosen === task?.item.answer ? 900 : 2600)
    return () => window.clearTimeout(timer)
  }, [answered, chosen, index, round.length, task])

  useEffect(() => {
    if (stage !== 'verdict') return
    if (bossPassed(correct, round.length)) {
      sfx.win()
      passedCallback.current(correct, round.length)
    } else {
      sfx.lose()
    }
  }, [stage, correct, round.length])

  if (stage === 'intro') {
    return (
      <div className="tm-boss tm-boss-intro" style={{ ['--boss' as string]: episode.boss.color }}>
        <BossFigure color={episode.boss.color} />
        <h2>{t('boss.title', { name: episode.boss.nameRu })}</h2>
        <p className="tm-boss-name-uz">{episode.boss.nameUz}</p>
        <p className="tm-boss-intro-text">{episode.boss.introUz}</p>
        <p className="tm-boss-rule">{t('boss.needed', { percent: Math.round(BOSS_PASS_RATIO * 100) })}</p>
        <div className="tm-intro-actions">
          <button type="button" className="tm-ghost" onClick={onExit}>
            {t('boss.exit')}
          </button>
          <button type="button" className="tm-primary" onClick={() => setStage('asking')}>
            {t('boss.intro')}
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'verdict') {
    const passed = bossPassed(correct, round.length)
    return (
      <div className={`tm-boss tm-boss-verdict ${passed ? 'is-win' : 'is-lose'}`} style={{ ['--boss' as string]: episode.boss.color }}>
        <BossFigure color={episode.boss.color} defeated={passed} />
        <h2>{passed ? t('boss.win') : t('boss.lose')}</h2>
        <p className="tm-boss-score">{t('boss.result', { correct, total: round.length })}</p>
        <p className="tm-boss-intro-text">{passed ? episode.boss.winUz : episode.boss.loseUz}</p>
        {!passed && (
          <div className="tm-intro-actions">
            <button type="button" className="tm-ghost" onClick={onExit}>
              {t('boss.exit')}
            </button>
            <button
              type="button"
              className="tm-primary"
              onClick={() => {
                setAttempt((current) => current + 1)
                setIndex(0)
                setCorrect(0)
                setChosen('')
                setTimedOut(false)
                setStage('asking')
              }}
            >
              {t('boss.retry')}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (!task) return null
  const ratio = Math.max(0, seconds / BOSS_TIME_LIMIT)

  return (
    <div className="tm-boss tm-boss-round" style={{ ['--boss' as string]: episode.boss.color }}>
      <header className="tm-boss-head">
        <BossFigure color={episode.boss.color} size={52} />
        <div>
          <strong>{episode.boss.nameRu}</strong>
          <span>{t('boss.question', { index: index + 1, total: round.length })}</span>
        </div>
        <div className={`tm-boss-timer ${seconds <= 5 ? 'is-urgent' : ''}`}>
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle className="track" cx="22" cy="22" r="19" />
            <circle className="value" cx="22" cy="22" r="19" style={{ strokeDashoffset: 119.4 * (1 - ratio) }} />
          </svg>
          <b>{answered ? '–' : seconds}</b>
        </div>
      </header>

      <div className="tm-boss-pips" aria-hidden="true">
        {round.map((_, pip) => (
          <i key={pip} className={pip < index ? 'done' : pip === index ? 'current' : ''} />
        ))}
      </div>

      <Prompt item={task.item} revealed={answered} />

      <TaskBody
        item={task.item}
        options={options}
        zoneCaptions={zoneCaptions}
        locked={answered}
        chosen={chosen}
        onAnswer={(value) => {
          if (answeredRef.current) return
          setChosen(value)
          finish(task.item, value)
        }}
      />

      {answered && (
        <div className={`tm-feedback ${chosen === task.item.answer ? 'is-correct' : 'is-wrong'}`} role="status">
          <b>{timedOut ? t('boss.timeout') : chosen === task.item.answer ? `✓ ${t('task.correct')}` : `✗ ${t('task.wrong')}`}</b>
          {chosen !== task.item.answer && <span className="tm-answer">{t('task.answerWas', { answer: task.item.answer })}</span>}
          <p>{task.item.explainUz}</p>
        </div>
      )}
    </div>
  )
}

function BossFigure({ color, size = 118, defeated = false }: { color: string; size?: number; defeated?: boolean }) {
  return (
    <span className={`tm-boss-figure ${defeated ? 'is-defeated' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="20" r="11" fill="#e8b98e" />
        <path d="M20 19a12 12 0 0 1 24 0Z" fill={color} />
        <path d="M17 62c0-13 6.7-32 15-32s15 19 15 32Z" fill={color} />
        <circle cx="27" cy="20" r="1.8" fill="#26303f" />
        <circle cx="37" cy="20" r="1.8" fill="#26303f" />
        <path d={defeated ? 'M27 27c3-2 7-2 10 0' : 'M27 27h10'} stroke="#26303f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  )
}
