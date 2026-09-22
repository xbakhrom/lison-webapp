import { useState } from 'react'
import { episodeSummaries, hasContent, TOTAL_EPISODES } from '../content'
import { t } from '../i18n'
import { isPersistent, useSave } from '../save/store'
import type { EpisodeSummary } from '../types'
import { SettingsSheet } from './SettingsSheet'

type Props = {
  onPlay: (episode: EpisodeSummary) => void
}

/** Spec §8: the main menu is a Moscow map with eleven points, unlocked ones in
 *  colour and the rest sealed until the previous boss falls. */
export function MapScreen({ onPlay }: Props) {
  const save = useSave()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const totalStars = Object.values(save.stars).reduce((sum, stars) => sum + stars, 0)
  const finished = Object.keys(save.stars).length

  return (
    <div className="tm-map">
      <header className="tm-map-head">
        <div>
          <span className="tm-eyebrow">{t('map.eyebrow')}</span>
          <h1>{t('map.title')}</h1>
          <p>{t('map.lead')}</p>
        </div>
        <button type="button" className="tm-icon-button" onClick={() => setSettingsOpen(true)} aria-label={t('map.settings')}>
          ⚙
        </button>
      </header>

      <div className="tm-map-summary">
        <span>
          <b>{finished}</b>
          <small>{t('map.progress', { done: finished, total: TOTAL_EPISODES })}</small>
        </span>
        <i />
        <span>
          <b>★ {totalStars}</b>
          <small>{t('map.stars', { stars: totalStars })}</small>
        </span>
        <i />
        <span>
          <b>{save.srsQueue.length}</b>
          <small>{t('map.srs', { count: save.srsQueue.length })}</small>
        </span>
      </div>

      {!isPersistent() && <p className="tm-note tm-warning">{t('map.noStorage')}</p>}

      <div className="tm-map-board">
        <svg className="tm-map-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="ring" d="M50 12c21 0 34 14 34 34S71 88 50 88 16 74 16 46 29 12 50 12Z" />
          <path className="ring inner" d="M50 28c12 0 19 8 19 18s-7 18-19 18-19-8-19-18 7-18 19-18Z" />
          <path className="river" d="M4 58c14 10 24-6 38 2s22 18 38 8" />
        </svg>

        {episodeSummaries.map((episode) => {
          const ready = hasContent(episode.id)
          const unlocked = ready && episode.order <= save.unlockedEpisode
          const stars = save.stars[episode.id] ?? 0
          return (
            <button
              type="button"
              key={episode.id}
              className={`tm-map-point ${unlocked ? 'is-open' : 'is-locked'}`}
              style={{ left: `${episode.map[0]}%`, top: `${episode.map[1]}%` }}
              disabled={!unlocked}
              onClick={() => onPlay(episode)}
              aria-label={`${episode.order}. ${episode.title}${unlocked ? '' : ` — ${ready ? t('map.locked') : t('map.soon')}`}`}
            >
              <span className="tm-map-icon">{unlocked ? episode.icon : ready ? '🔒' : '⏳'}</span>
              <span className="tm-map-order">{episode.order}</span>
              {stars > 0 && <span className="tm-map-stars">{'★'.repeat(stars)}</span>}
            </button>
          )
        })}
      </div>

      <div className="tm-map-list">
        {episodeSummaries.map((episode) => {
          const ready = hasContent(episode.id)
          const unlocked = ready && episode.order <= save.unlockedEpisode
          const stars = save.stars[episode.id] ?? 0
          const isFinal = episode.order === TOTAL_EPISODES
          return (
            <button
              type="button"
              key={episode.id}
              className={`tm-episode-row ${unlocked ? '' : 'is-locked'}`}
              disabled={!unlocked}
              onClick={() => onPlay(episode)}
            >
              <span className="tm-episode-icon">{unlocked ? episode.icon : ready ? '🔒' : '⏳'}</span>
              <span className="tm-episode-copy">
                <small>
                  {String(episode.order).padStart(2, '0')} · {episode.topicUz}
                </small>
                <strong>
                  {episode.title} <em>{episode.titleUz}</em>
                </strong>
                <span>
                  {unlocked
                    ? episode.summaryUz
                    : !ready
                      ? t('map.soonHint')
                      : isFinal
                        ? t('map.finalLocked')
                        : t('map.lockedHint')}
                </span>
              </span>
              <span className="tm-episode-side">
                {stars > 0 && <b className="tm-episode-stars">{'★'.repeat(stars)}</b>}
                {unlocked && <em>{stars > 0 ? t('map.replay') : t('map.play')}</em>}
                {!ready && <em className="tm-episode-soon">{t('map.soon')}</em>}
              </span>
            </button>
          )
        })}
      </div>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
