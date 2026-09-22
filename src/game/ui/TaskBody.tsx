import { useEffect, useState } from 'react'
import { t } from '../i18n'
import type { EpisodeItem } from '../types'
import { RuText } from './RuText'

type Props = {
  item: EpisodeItem
  /** Pre-shuffled so the same item never sits in the same slot twice. */
  options: string[]
  /** Uzbek caption for a `sort` zone, keyed by the Russian zone label. */
  zoneCaptions?: Record<string, string>
  locked: boolean
  chosen: string
  onAnswer: (value: string) => void
}

const defaultAsk: Record<EpisodeItem['type'], string> = {
  choice: 'task.choice',
  sort: 'task.sort',
  fill: 'task.fill',
  order: 'task.order',
}

function tileState(option: string, item: EpisodeItem, chosen: string, locked: boolean): string {
  if (!locked) return ''
  if (option === item.answer) return 'is-correct'
  if (option === chosen) return 'is-wrong'
  return 'is-dimmed'
}

export function TaskBody({ item, options, zoneCaptions, locked, chosen, onAnswer }: Props) {
  const [picked, setPicked] = useState<number[]>([])

  useEffect(() => {
    setPicked([])
  }, [item.id])

  const ask = item.askUz ?? t(defaultAsk[item.type])

  if (item.type === 'order') {
    const sentence = picked.map((index) => options[index]).join(' ')
    return (
      <div className="tm-task-body">
        <p className="tm-ask">{ask}</p>
        <div className="tm-order-line" aria-live="polite">
          {picked.length === 0 ? <span className="tm-order-empty">…</span> : sentence}
        </div>
        <div className="tm-order-tokens">
          {options.map((token, index) => (
            <button
              type="button"
              key={`${token}-${index}`}
              className={`tm-token ${picked.includes(index) ? 'is-used' : ''}`}
              disabled={locked || picked.includes(index)}
              onClick={() => setPicked((current) => [...current, index])}
            >
              {token}
            </button>
          ))}
        </div>
        <div className="tm-order-actions">
          <button type="button" className="tm-ghost" disabled={locked || picked.length === 0} onClick={() => setPicked([])}>
            {t('task.orderReset')}
          </button>
          <button
            type="button"
            className="tm-primary"
            disabled={locked || picked.length !== options.length}
            onClick={() => onAnswer(sentence)}
          >
            {t('task.orderCheck')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="tm-task-body">
      <p className="tm-ask">{ask}</p>
      <div className={`tm-options ${item.type === 'sort' ? 'is-zones' : ''}`}>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={`tm-option ${tileState(option, item, chosen, locked)}`}
            disabled={locked}
            onClick={() => onAnswer(option)}
          >
            <RuText ru={option} uz={zoneCaptions?.[option]} speakable={false} />
          </button>
        ))}
      </div>
    </div>
  )
}
