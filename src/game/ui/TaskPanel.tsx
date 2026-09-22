import { useEffect } from 'react'
import { t } from '../i18n'
import type { EpisodeItem } from '../types'
import { Prompt } from './Prompt'
import { TaskBody } from './TaskBody'

export type TaskResult = { correct: boolean; chosen: string }

type Props = {
  item: EpisodeItem
  options: string[]
  zoneCaptions: Record<string, string>
  fromSrs: boolean
  result: TaskResult | null
  onAnswer: (value: string) => void
  onContinue: () => void
}

/** How long a wrong answer stays on screen before the game moves on (spec §8). */
const WRONG_HOLD_MS = 5000
const RIGHT_HOLD_MS = 1200

export function TaskPanel({ item, options, zoneCaptions, fromSrs, result, onAnswer, onContinue }: Props) {
  useEffect(() => {
    if (!result) return
    const timer = window.setTimeout(onContinue, result.correct ? RIGHT_HOLD_MS : WRONG_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [result, onContinue])

  return (
    <div className={`tm-panel ${result ? (result.correct ? 'is-correct' : 'is-wrong') : ''}`}>
      {fromSrs && (
        <div className="tm-panel-tags">
          <span className="tm-tag is-srs">↻ {t('task.fromSrs')}</span>
        </div>
      )}

      <Prompt item={item} revealed={result !== null} />

      <TaskBody
        item={item}
        options={options}
        zoneCaptions={zoneCaptions}
        locked={result !== null}
        chosen={result?.chosen ?? ''}
        onAnswer={onAnswer}
      />

      {result && (
        <div className="tm-feedback" role="status">
          <b>{result.correct ? `✓ ${t('task.correct')}` : `✗ ${t('task.wrong')}`}</b>
          {!result.correct && <span className="tm-answer">{t('task.answerWas', { answer: item.answer })}</span>}
          <p>{item.explainUz}</p>
          {!result.correct && <small>{t('task.srsAdded')}</small>}
          <button type="button" className="tm-primary" onClick={onContinue}>
            {t('task.continue')}
          </button>
        </div>
      )}
    </div>
  )
}
