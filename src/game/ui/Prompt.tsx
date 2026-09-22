import { t } from '../i18n'
import type { EpisodeItem } from '../types'
import { RuText } from './RuText'

type Props = {
  item: EpisodeItem
  /** After answering, a `fill` gap shows the right form instead of ___. */
  revealed: boolean
}

/** The study material of a task, shared by the free stage and the boss round. */
export function Prompt({ item, revealed }: Props) {
  if (item.type === 'order') {
    // The material of an ordering task is the Uzbek meaning to be expressed.
    return (
      <div className="tm-prompt">
        {item.isException && <span className="tm-tag is-exception">⭐ {t('task.exception')}</span>}
        <p className="tm-prompt-sentence is-uz">{item.promptRu}</p>
      </div>
    )
  }

  if (item.type === 'fill') {
    const [before, after] = item.promptRu.split('___')
    return (
      <div className="tm-prompt">
        {item.isException && <span className="tm-tag is-exception">⭐ {t('task.exception')}</span>}
        <p className="tm-prompt-sentence">
          {before}
          <b className="tm-gap">{revealed ? item.answer : '___'}</b>
          {after}
        </p>
        <small className="tm-prompt-uz">{item.uz}</small>
      </div>
    )
  }

  return (
    <div className="tm-prompt">
      {item.isException && <span className="tm-tag is-exception">⭐ {t('task.exception')}</span>}
      <RuText ru={item.promptRu} size="lead" />
      <small className="tm-prompt-uz">{item.uz}</small>
    </div>
  )
}
