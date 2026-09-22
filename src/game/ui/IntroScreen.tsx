import { useState } from 'react'
import { t } from '../i18n'
import type { Episode } from '../types'
import { BarsikFace } from './Barsik'
import { RuText } from './RuText'

type Props = {
  episode: Episode
  onStart: () => void
}

/** Spec §4.1: Barsik explains the rule on 3–5 cards; a replayer can skip. */
export function IntroScreen({ episode, onStart }: Props) {
  const [step, setStep] = useState(0)
  const cards = episode.ruleCards
  const card = cards[step]
  const last = step === cards.length - 1

  return (
    <div className="tm-screen tm-intro">
      <header className="tm-intro-head">
        <span className="tm-eyebrow">{t('rules.eyebrow')}</span>
        <h2>
          {episode.title} <small>{episode.titleUz}</small>
        </h2>
        <p className="tm-intro-topic">{episode.topicUz}</p>
      </header>

      <div className="tm-intro-dialog">
        <BarsikFace size={52} />
        <div>
          {episode.intro.map((line, index) => (
            <p key={index}>
              {line.textUz}
              {line.ru && <RuText ru={line.ru} size="body" />}
            </p>
          ))}
        </div>
      </div>

      <article className={`tm-rule-card ${card.isException ? 'is-exception' : ''}`} key={step}>
        <div className="tm-rule-head">
          <span>{card.isException ? `⭐ ${t('rules.exception')}` : t('rules.card', { index: step + 1, total: cards.length })}</span>
        </div>
        <h3>{card.titleUz}</h3>
        <p>{card.bodyUz}</p>
        <ul>
          {card.examplesRu.map((example) => (
            <li key={example}>
              <RuText ru={example} />
            </li>
          ))}
        </ul>
      </article>

      <div className="tm-dots" aria-hidden="true">
        {cards.map((_, index) => (
          <i key={index} className={index === step ? 'is-on' : ''} />
        ))}
      </div>

      <div className="tm-intro-actions">
        <button type="button" className="tm-ghost" onClick={onStart}>
          {t('rules.skip')}
        </button>
        <button
          type="button"
          className="tm-primary"
          onClick={() => (last ? onStart() : setStep((current) => current + 1))}
        >
          {last ? t('rules.start') : t('rules.next')}
        </button>
      </div>
    </div>
  )
}
