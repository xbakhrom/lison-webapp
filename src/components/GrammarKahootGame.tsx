import { grammarDifficulty, maxQuestionPoints, type Difficulty } from '../grammarAdaptive'
import type { GrammarQuestion, GrammarTopicDetail } from '../types'

type Props = {
  topic: GrammarTopicDetail
  question: GrammarQuestion
  answered: number
  total: number
  choice: string
  timedOut: boolean
  secondsLeft: number
  limitSeconds: number
  score: number
  streak: number
  lastPoints: number
  saving: boolean
  error: string
  review: boolean
  nextDifficulty: Difficulty
  adaptiveMessage: string
  onChoose: (option: string) => void
  onNext: () => void
}

// Kahoot answer tiles: a shape and a colour per position so a learner picks by
// sight long before reading the option text.
const tileShapes = ['▲', '◆', '●', '■']
const trueFalseShapes = ['✓', '✕']

export function GrammarKahootGame({
  topic,
  question,
  answered,
  total,
  choice,
  timedOut,
  secondsLeft,
  limitSeconds,
  score,
  streak,
  lastPoints,
  saving,
  error,
  review,
  nextDifficulty,
  adaptiveMessage,
  onChoose,
  onNext,
}: Props) {
  const revealed = Boolean(choice) || timedOut
  const correct = choice === question.answer
  const currentNumber = Math.min(total, answered + (revealed ? 0 : 1))
  const timeRatio = Math.max(0, Math.min(1, secondsLeft / limitSeconds))
  const shapes = question.kind === 'true_false' ? trueFalseShapes : tileShapes

  return (
    <div className={`kahoot-shell level-${question.difficulty}`}>
      <header className="kahoot-header">
        <div>
          <span>{review ? 'Повторение' : 'Игра'} · {grammarDifficulty[question.difficulty].label}</span>
          <strong>{topic.title}</strong>
        </div>
        <b>{currentNumber}/{total}</b>
      </header>

      <div className="kahoot-hud">
        <div className={`kahoot-timer ${!revealed && secondsLeft <= 5 ? 'is-urgent' : ''}`} aria-label={`Осталось ${secondsLeft} секунд`}>
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle className="track" cx="22" cy="22" r="19" />
            <circle className="value" cx="22" cy="22" r="19" style={{ strokeDashoffset: 119.4 * (1 - timeRatio) }} />
          </svg>
          <b>{revealed ? '–' : secondsLeft}</b>
        </div>
        <div className="kahoot-progress" aria-label={`Вопрос ${currentNumber} из ${total}`}>
          {Array.from({ length: total }, (_, index) => (
            <i className={index < answered ? 'done' : index === currentNumber - 1 ? 'current' : ''} key={index} />
          ))}
        </div>
        <div className="kahoot-score">
          <span>Очки</span>
          <strong>{score}</strong>
        </div>
      </div>

      {streak > 1 && !revealed && <div className="kahoot-streak" aria-live="polite">🔥 {streak} подряд</div>}
      {adaptiveMessage && (
        <div className={`kahoot-adaptive level-${nextDifficulty}`}>
          <span aria-hidden="true">{adaptiveMessage.startsWith('Закрепим') ? '↓' : '↑'}</span>{adaptiveMessage}
        </div>
      )}

      <section className="kahoot-question" key={question.id}>
        <span>{question.prompt}</span>
        <h2>{question.phrase}</h2>
      </section>

      <div className={`kahoot-tiles ${question.kind === 'true_false' ? 'is-pair' : ''}`}>
        {(question.options ?? []).map((option, index) => {
          const state = revealed
            ? option === question.answer ? 'is-correct' : option === choice ? 'is-wrong' : 'is-dimmed'
            : ''
          return (
            <button
              className={`kahoot-tile tile-${index + 1} ${state}`}
              key={option}
              onClick={() => onChoose(option)}
              disabled={revealed}
            >
              <i aria-hidden="true">{shapes[index] ?? tileShapes[index % tileShapes.length]}</i>
              <span>{option}</span>
            </button>
          )
        })}
      </div>

      {revealed && (
        <div className={`kahoot-reveal ${correct ? 'correct' : 'wrong'}`} role="status">
          <div className="kahoot-reveal-head">
            <b>{correct ? 'Верно!' : timedOut ? 'Время вышло' : `Правильно: ${question.answer}`}</b>
            <em>{correct ? `+${lastPoints}` : `+0`}</em>
          </div>
          <span>{question.explanation}</span>
        </div>
      )}

      {error && <div className="inline-error">{error}</div>}
      {revealed && (
        <button className="button light wide kahoot-next" onClick={onNext} disabled={saving}>
          {saving ? 'Сохраняем результат…' : answered >= total ? 'Показать результат' : 'Следующий вопрос'}
        </button>
      )}
      {!revealed && (
        <p className="kahoot-hint">Чем быстрее ответ, тем больше очков — максимум {maxQuestionPoints}.</p>
      )}
    </div>
  )
}
