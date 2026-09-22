import { t } from '../i18n'
import { RuText } from './RuText'

type Props = {
  title: string
  correct: number
  total: number
  stars: number
  weak: { ru: string; uz: string }[]
  addedToSrs: number
  unlockedTitle?: string
  onAgain: () => void
  onMap: () => void
}

/** Spec §4.5: accuracy, the weak forms and what went into the SRS queue. */
export function StatsScreen({ title, correct, total, stars, weak, addedToSrs, unlockedTitle, onAgain, onMap }: Props) {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  return (
    <div className="tm-screen tm-stats">
      <span className="tm-eyebrow">{t('stats.title')}</span>
      <h2>{title}</h2>

      <div className="tm-stars" aria-label={t('map.stars', { stars })}>
        {[1, 2, 3].map((star) => (
          <span key={star} className={star <= stars ? 'is-on' : ''}>
            ★
          </span>
        ))}
      </div>

      <div className="tm-stat-grid">
        <div>
          <b>{accuracy}%</b>
          <small>{t('stats.accuracy')}</small>
        </div>
        <div>
          <b>{correct}</b>
          <small>{t('stats.answers', { correct, total })}</small>
        </div>
        <div>
          <b>{addedToSrs}</b>
          <small>{t('stats.srs', { count: addedToSrs })}</small>
        </div>
      </div>

      <section className="tm-weak">
        <h3>{t('stats.weak')}</h3>
        {weak.length === 0 ? (
          <p>{t('stats.weakEmpty')}</p>
        ) : (
          <ul>
            {weak.map((word) => (
              <li key={word.ru}>
                <RuText ru={word.ru} uz={word.uz} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {unlockedTitle && <p className="tm-unlocked">🔓 {t('stats.unlocked', { title: unlockedTitle })}</p>}

      <div className="tm-intro-actions">
        <button type="button" className="tm-ghost" onClick={onAgain}>
          {t('stats.again')}
        </button>
        <button type="button" className="tm-primary" onClick={onMap}>
          {t('stats.map')}
        </button>
      </div>
    </div>
  )
}
