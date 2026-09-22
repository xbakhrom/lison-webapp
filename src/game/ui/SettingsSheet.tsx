import { useState } from 'react'
import { canSpeak } from '../engine/speech'
import { t } from '../i18n'
import { resetSave, setSettings, useSave } from '../save/store'

type Props = {
  onClose: () => void
}

export function SettingsSheet({ onClose }: Props) {
  const save = useSave()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="tm-sheet-backdrop" onClick={onClose}>
      <div className="tm-sheet" onClick={(event) => event.stopPropagation()}>
        <header>
          <h3>{t('settings.title')}</h3>
          <button type="button" onClick={onClose} aria-label={t('app.close')}>
            ×
          </button>
        </header>

        <label className="tm-toggle">
          <span>{t('settings.sound')}</span>
          <input
            type="checkbox"
            checked={save.settings.sound}
            onChange={(event) => setSettings({ sound: event.target.checked })}
          />
        </label>

        <label className={`tm-toggle ${canSpeak() ? '' : 'is-disabled'}`}>
          <span>{t('settings.autoSpeak')}</span>
          <input
            type="checkbox"
            disabled={!canSpeak()}
            checked={save.settings.autoSpeak && canSpeak()}
            onChange={(event) => setSettings({ autoSpeak: event.target.checked })}
          />
        </label>
        {!canSpeak() && <p className="tm-note">{t('settings.speechOff')}</p>}

        <label className="tm-toggle">
          <span>{t('settings.shadows')}</span>
          <input
            type="checkbox"
            checked={save.settings.shadows}
            onChange={(event) => setSettings({ shadows: event.target.checked })}
          />
        </label>

        <label className="tm-range">
          <span>{t('settings.fontScale')}</span>
          <input
            type="range"
            min="0.9"
            max="1.35"
            step="0.05"
            value={save.settings.fontScale}
            onChange={(event) => setSettings({ fontScale: Number(event.target.value) })}
          />
        </label>

        {confirming ? (
          <div className="tm-confirm">
            <p>{t('settings.resetConfirm')}</p>
            <div className="tm-intro-actions">
              <button type="button" className="tm-ghost" onClick={() => setConfirming(false)}>
                {t('settings.resetNo')}
              </button>
              <button
                type="button"
                className="tm-danger"
                onClick={() => {
                  resetSave()
                  setConfirming(false)
                  onClose()
                }}
              >
                {t('settings.resetYes')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="tm-ghost tm-wide" onClick={() => setConfirming(true)}>
            {t('settings.reset')}
          </button>
        )}
      </div>
    </div>
  )
}
