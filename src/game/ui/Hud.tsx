import { t } from '../i18n'
import { BarsikFace } from './Barsik'

type Props = {
  title: string
  done: number
  total: number
  score: number
  hintsLeft: number
  onHint: () => void
  onExit: () => void
}

/** Spec §8: episode name and progress on top, score on the right, Barsik below. */
export function Hud({ title, done, total, score, hintsLeft, onHint, onExit }: Props) {
  return (
    <>
      <div className="tm-hud">
        <button type="button" className="tm-hud-exit" onClick={onExit} aria-label={t('hud.pause')}>
          ←
        </button>
        <div className="tm-hud-title">
          <strong>{title}</strong>
          <span>{t('hud.progress', { done, total })}</span>
        </div>
        <div className="tm-hud-score">
          <small>{t('hud.score')}</small>
          <b>{score}</b>
        </div>
      </div>
      <div className="tm-hud-progress" aria-hidden="true">
        <span style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
      </div>
      <button
        type="button"
        className={`tm-hint-button ${hintsLeft === 0 ? 'is-empty' : ''}`}
        onClick={onHint}
        disabled={hintsLeft === 0}
        aria-label={hintsLeft > 0 ? t('hud.hintsLeft', { count: hintsLeft }) : t('hud.noHints')}
      >
        <BarsikFace size={34} />
        <span>{hintsLeft}</span>
      </button>
    </>
  )
}
