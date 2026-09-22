import type { Episode, EpisodeSummary } from '../types'
import manifest from './manifest.json'
import { validateEpisode } from './validate'

// Episode files are loaded on demand: opening the map must not pull 11 JSON
// banks into memory, and a device only ever needs the episode being played.
const files = import.meta.glob<{ default: unknown }>('./ep*.json')

export const episodeSummaries: EpisodeSummary[] = [...(manifest as EpisodeSummary[])].sort(
  (a, b) => a.order - b.order,
)

export const TOTAL_EPISODES = episodeSummaries.length

const cache = new Map<string, Episode>()

export async function loadEpisode(id: string): Promise<Episode> {
  const cached = cache.get(id)
  if (cached) return cached

  const loader = files[`./${id}.json`]
  if (!loader) throw new Error(`Epizod topilmadi: ${id}`)

  const module = await loader()
  const errors = validateEpisode(module.default, `${id}.json`)
  if (errors.length > 0) {
    // The build script catches this first; at runtime it still refuses to play
    // broken content rather than crashing halfway through an episode.
    throw new Error(errors.join('\n'))
  }
  const episode = module.default as Episode
  cache.set(id, episode)
  return episode
}

export function summaryOf(id: string): EpisodeSummary | undefined {
  return episodeSummaries.find((episode) => episode.id === id)
}

/**
 * The map lists all eleven episodes, but only those with a content file can be
 * played: the rest are shown as «tez orada» until their bank is approved.
 */
export function hasContent(id: string): boolean {
  return Boolean(files[`./${id}.json`])
}
