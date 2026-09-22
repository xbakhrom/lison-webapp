import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { grammarDifficulty, type Difficulty } from '../grammarAdaptive'
import type { GrammarQuestion, GrammarTopicDetail } from '../types'

type Props = {
  topic: GrammarTopicDetail
  question: GrammarQuestion
  answered: number
  total: number
  choice: string
  progress: number
  saving: boolean
  error: string
  review: boolean
  nextDifficulty: Difficulty
  adaptiveMessage: string
  xp: number
  combo: number
  hearts: number
  onChoose: (option: string) => void
  onNext: () => void
}

const targetSymbols = ['◆', '●', '▲']

export function GrammarQuestGame({
  topic,
  question,
  answered,
  total,
  choice,
  progress,
  saving,
  error,
  review,
  nextDifficulty,
  adaptiveMessage,
  xp,
  combo,
  hearts,
  onChoose,
  onNext,
}: Props) {
  const correct = Boolean(choice) && choice === question.answer
  const currentNumber = Math.min(total, answered + (choice ? 0 : 1))

  return (
    <div className={`grammar-game-shell quest-shell level-${question.difficulty}`}>
      <header className="quest-header">
        <div>
          <span>{review ? 'Повторение-квест' : 'Lison Quest'} · {grammarDifficulty[question.difficulty].label}</span>
          <strong>{topic.title}</strong>
        </div>
        <b>{currentNumber}/{total}</b>
      </header>

      <div className="quest-hud" aria-label="Игровая статистика">
        <div className="quest-hearts" aria-label={`${hearts} энергии из 3`}>
          {[0, 1, 2].map((heart) => <span aria-hidden="true" className={heart < hearts ? 'active' : ''} key={heart}>♥</span>)}
        </div>
        <div className="quest-level-path" aria-label={`Пройдено ${Math.round(progress)}%`}>
          {Array.from({ length: total }, (_, index) => (
            <i className={index < answered ? 'done' : index === currentNumber - 1 ? 'current' : ''} key={index} />
          ))}
        </div>
        <div className="quest-score"><span>XP</span><strong>{xp}</strong></div>
      </div>

      {combo > 1 && <div className="quest-combo" aria-live="polite">⚡ {combo} combo</div>}
      {adaptiveMessage && (
        <div className={`grammar-adaptive-note quest-adaptive-note level-${nextDifficulty}`}>
          <span>{adaptiveMessage.startsWith('Закрепим') ? '↘' : '↗'}</span>{adaptiveMessage}
        </div>
      )}

      <main className={`quest-world kind-${question.kind} ${choice ? (correct ? 'is-success' : 'is-miss') : ''}`} key={question.id}>
        <QuestScenery difficulty={question.difficulty} />

        <section className="quest-mission">
          <span>{question.prompt}</span>
          <h2>{question.phrase}</h2>
        </section>

        {question.kind === 'order' ? (
          <QuestBridge question={question} choice={choice} onChoose={onChoose} />
        ) : (
          <QuestTargets question={question} choice={choice} onChoose={onChoose} />
        )}

        <div className="quest-ground" aria-hidden="true">
          <QuestHero state={!choice ? 'idle' : correct ? 'win' : 'hurt'} />
          <div className="quest-goal"><i />★</div>
        </div>

        {choice && (
          <div className={`quest-feedback ${correct ? 'correct' : 'wrong'}`} role="status">
            <b>{correct ? 'Путь открыт!' : `Верный ответ: ${question.answer}`}</b>
            <span>{question.explanation}</span>
          </div>
        )}
      </main>

      {error && <div className="inline-error">{error}</div>}
      {choice && (
        <button className="button light wide quest-next" onClick={onNext} disabled={saving}>
          {saving ? 'Сохраняем результат…' : answered >= total ? 'Забрать награду' : 'Продолжить путь'}
        </button>
      )}
    </div>
  )
}

function QuestTargets({ question, choice, onChoose }: { question: GrammarQuestion; choice: string; onChoose: (option: string) => void }) {
  return (
    <div className={`quest-targets ${question.kind === 'true_false' ? 'is-gates' : ''}`}>
      {(question.options ?? []).map((option, index) => {
        const state = choice
          ? option === question.answer ? 'is-correct' : option === choice ? 'is-wrong' : 'is-dimmed'
          : ''
        return (
          <button
            className={`quest-target target-${index + 1} ${state}`}
            style={{ '--target-delay': `${index * -.65}s` } as CSSProperties}
            key={option}
            onClick={() => onChoose(option)}
            disabled={Boolean(choice)}
          >
            <i aria-hidden="true">{question.kind === 'true_false' ? (index === 0 ? '✓' : '×') : targetSymbols[index]}</i>
            <span>{option}</span>
            {state === 'is-correct' && <b aria-hidden="true">{choice === question.answer ? '+XP' : '✓'}</b>}
          </button>
        )
      })}
    </div>
  )
}

function QuestBridge({ question, choice, onChoose }: { question: GrammarQuestion; choice: string; onChoose: (option: string) => void }) {
  const tokens = useMemo(() => shuffledTokens(question), [question])
  const [selected, setSelected] = useState<number[]>([])
  useEffect(() => setSelected([]), [question.id])

  const selectedTokens = selected.map((index) => tokens.find((item) => item.index === index)).filter(Boolean)
  const built = selectedTokens.map((item) => item!.token).join(' ')

  return (
    <div className="quest-bridge-game">
      <div className="quest-river" aria-label="Собранная фраза">
        <div className="quest-water" aria-hidden="true"><i /><i /><i /></div>
        <div className="quest-bridge">
          {selectedTokens.length ? selectedTokens.map((item, position) => (
            <button
              className={choice ? (choice === question.answer ? 'is-correct' : 'is-wrong') : ''}
              style={{ '--stone-index': position } as CSSProperties}
              key={item!.index}
              disabled={Boolean(choice)}
              onClick={() => setSelected((current) => current.filter((index) => index !== item!.index))}
            >
              {item!.token}
            </button>
          )) : <span>Соберите мост из слов</span>}
        </div>
      </div>

      <div className="quest-word-bank">
        {tokens.map((item, index) => (
          <button
            style={{ '--crystal-delay': `${index * -.4}s` } as CSSProperties}
            key={item.index}
            disabled={Boolean(choice) || selected.includes(item.index)}
            onClick={() => setSelected((current) => [...current, item.index])}
          >
            {item.token}
          </button>
        ))}
      </div>

      {!choice && (
        <button className="quest-cast" disabled={selected.length !== tokens.length} onClick={() => onChoose(built)}>
          <span aria-hidden="true">✦</span> Проверить мост
        </button>
      )}
    </div>
  )
}

function QuestScenery({ difficulty }: { difficulty: number }) {
  return (
    <div className="quest-scenery" aria-hidden="true">
      <div className="quest-sun">{difficulty === 3 ? '☾' : '✦'}</div>
      <div className="quest-cloud cloud-one" />
      <div className="quest-cloud cloud-two" />
      <div className="quest-hill hill-one" />
      <div className="quest-hill hill-two" />
      <i className="quest-spark spark-one" />
      <i className="quest-spark spark-two" />
      <i className="quest-spark spark-three" />
    </div>
  )
}

function QuestHero({ state }: { state: 'idle' | 'win' | 'hurt' }) {
  return (
    <div className={`quest-hero is-${state}`}>
      <div className="quest-hero-shadow" />
      <div className="quest-hero-body">
        <i className="quest-hero-ear left" /><i className="quest-hero-ear right" />
        <span className="quest-hero-face"><b>•</b><b>•</b><em>{state === 'hurt' ? '﹏' : 'ᴗ'}</em></span>
        <strong>Л</strong>
      </div>
    </div>
  )
}

function shuffledTokens(question: GrammarQuestion) {
  const source = (question.tokens ?? []).map((token, index) => ({ token, index }))
  const shuffled = [...source].sort((left, right) => tokenHash(`${question.id}-${left.index}`) - tokenHash(`${question.id}-${right.index}`))
  return shuffled.every((item, index) => item.index === index) ? shuffled.reverse() : shuffled
}

function tokenHash(value: string) {
  return [...value].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 997, 7)
}
