import { canSpeak, speakRussian } from '../engine/speech'
import { t } from '../i18n'

type Props = {
  ru: string
  uz?: string
  size?: 'lead' | 'body'
  /** Off inside answer tiles — a button may not contain another button. */
  speakable?: boolean
}

/**
 * Russian study material with its Uzbek translation attached (spec §1) and a
 * pronunciation button that disappears when the browser has no voices (spec §6).
 */
export function RuText({ ru, uz, size = 'body', speakable = true }: Props) {
  return (
    <span className={`tm-ru tm-ru-${size}`}>
      <span className="tm-ru-word" title={uz ?? undefined}>{ru}</span>
      {speakable && canSpeak() && (
        <button
          type="button"
          className="tm-speak"
          onClick={(event) => {
            event.stopPropagation()
            speakRussian(ru)
          }}
          aria-label={t('task.speak')}
        >
          🔊
        </button>
      )}
      {uz && <small className="tm-ru-uz">{uz}</small>}
    </span>
  )
}
