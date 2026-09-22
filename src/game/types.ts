// Domain types for «Temur Moskvada». The shapes here mirror the content JSON
// schema one to one, so a content file that type-checks also validates.

export type ItemType = 'choice' | 'sort' | 'fill' | 'order'

export type EpisodeItem = {
  id: string
  type: ItemType
  /** Russian study material: a word, or a sentence with ___ for `fill`. */
  promptRu: string
  /** Uzbek translation of the material, shown as a tooltip. */
  uz: string
  /** Uzbek task question; falls back to a per-type default from i18n. */
  askUz?: string
  options?: string[]
  tokens?: string[]
  answer: string
  isException?: boolean
  isBoss?: boolean
  explainUz: string
  /** Barsik's nudge after two wrong answers in a row — never the answer itself. */
  hintUz?: string
}

export type RuleCard = {
  titleUz: string
  bodyUz: string
  examplesRu: string[]
  isException?: boolean
}

export type ScenePropKind = 'box' | 'cylinder' | 'cone' | 'sphere'

export type SceneProp = {
  kind: ScenePropKind
  pos: [number, number, number]
  size: [number, number, number]
  color: string
  rotY?: number
  /** Blocks the player instead of being walked through. */
  solid?: boolean
}

export type SceneZone = {
  /** Must match one of the `options` of the episode's `sort` items. */
  label: string
  labelUz: string
  pos: [number, number, number]
  color: string
}

export type EpisodeScene = {
  ground: string
  sky: string
  fog: string
  /** Half-extents of the walkable area on x and z. */
  bounds: [number, number]
  /** Where the player starts; keep it clear of every station. */
  spawn: [number, number]
  props: SceneProp[]
  zones: SceneZone[]
  /** Pedestals that hold one task each; refilled until the queue runs out. */
  stations: [number, number][]
}

export type BarsikLine = {
  textUz: string
  ru?: string
}

export type EpisodeBoss = {
  nameRu: string
  nameUz: string
  introUz: string
  winUz: string
  loseUz: string
  color: string
}

/** An exception from the spec that the content must cover at least twice. */
export type RequiredException = {
  key: string
  /** Substring looked for in promptRu / answer / explainUz of an item. */
  match: string
}

export type Episode = {
  id: string
  order: number
  title: string
  titleUz: string
  topic: string
  topicUz: string
  summaryUz: string
  icon: string
  intro: BarsikLine[]
  ruleCards: RuleCard[]
  requiredExceptions: RequiredException[]
  scene: EpisodeScene
  boss: EpisodeBoss
  items: EpisodeItem[]
}

export type EpisodeSummary = {
  id: string
  order: number
  title: string
  titleUz: string
  topicUz: string
  icon: string
  summaryUz: string
  /** Position on the stylised Moscow map, 0..100 in both axes. */
  map: [number, number]
}

export type SrsEntry = {
  itemId: string
  episodeId: string
  box: 1 | 2 | 3
  wrongCount: number
  correctStreak: number
  nextDue: string
}

export type EpisodeStats = {
  accuracy: number
  attempts: number
  bestAccuracy: number
}

export type GameSettings = {
  sound: boolean
  autoSpeak: boolean
  shadows: boolean
  fontScale: number
}

export type SaveState = {
  version: number
  unlockedEpisode: number
  stars: Record<string, number>
  srsQueue: SrsEntry[]
  stats: Record<string, EpisodeStats>
  settings: GameSettings
  tutorialDone: boolean
}
