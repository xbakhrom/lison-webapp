import { useEffect, useState } from 'react'
import { loadEpisode } from './content'
import { t } from './i18n'
import type { Episode, EpisodeSummary } from './types'
import { EpisodeScreen } from './ui/EpisodeScreen'
import { MapScreen } from './ui/MapScreen'
import './game.css'

/**
 * «Temur Moskvada» — the serial 3D grammar game. Everything runs in the
 * browser: content ships as JSON, progress lives in localStorage, no API.
 */
export default function TemurGame() {
  const [selected, setSelected] = useState<EpisodeSummary | null>(null)
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!selected) {
      setEpisode(null)
      return
    }
    let active = true
    setError('')
    loadEpisode(selected.id)
      .then((loaded) => active && setEpisode(loaded))
      .catch((reason: Error) => active && setError(reason.message))
    return () => {
      active = false
    }
  }, [selected])

  if (selected && error) {
    return (
      <div className="tm-root tm-state">
        <p>{t('app.error')}</p>
        <pre className="tm-error-detail">{error}</pre>
        <button type="button" className="tm-primary" onClick={() => setSelected(null)}>
          {t('stats.map')}
        </button>
      </div>
    )
  }

  if (selected && !episode) {
    return (
      <div className="tm-root tm-state">
        <span className="tm-spinner" aria-hidden="true" />
        <p>{t('app.loading')}</p>
      </div>
    )
  }

  return (
    <div className="tm-root">
      {episode ? (
        <EpisodeScreen episode={episode} onExit={() => setSelected(null)} />
      ) : (
        <MapScreen onPlay={setSelected} />
      )}
    </div>
  )
}
