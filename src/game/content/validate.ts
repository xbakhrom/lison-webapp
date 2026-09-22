// Content schema validator for «Temur Moskvada».
//
// Deliberately self-contained: no imports, no DOM and no enums, so Node can run
// this file directly with type stripping (`scripts/check-content.mjs`) while the
// app imports the very same rules at runtime. One schema, two call sites.

type Unknown = Record<string, unknown>

export const ITEM_TYPES = ['choice', 'sort', 'fill', 'order'] as const
export const PROP_KINDS = ['box', 'cylinder', 'cone', 'sphere'] as const

/** Spec §5: at least 60 items, 15+ of them exceptions. */
export const MIN_ITEMS = 60
export const MIN_EXCEPTIONS = 15
/** A boss round draws 6 exceptions + 4 rule questions; the pool must be larger
 *  than one round so a retry can ask the same topic in a different order. */
export const MIN_BOSS_EXCEPTIONS = 10
export const MIN_BOSS_REGULAR = 6
/** Spec §5: every listed exception appears in at least two items. */
export const MIN_EXCEPTION_OCCURRENCES = 2
/** Comfortably wider than the engine's 2.1 interaction radius. */
export const MIN_SPAWN_CLEARANCE = 3

function isObject(value: unknown): value is Unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => isText(entry))
}

function isNumberTriplet(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === 'number')
}

function includesText(item: Unknown, needle: string): boolean {
  const haystack = [item.promptRu, item.answer, item.explainUz, item.uz]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle.toLowerCase())
}

function checkScene(scene: unknown, errors: string[]): void {
  if (!isObject(scene)) {
    errors.push('scene: missing')
    return
  }
  for (const key of ['ground', 'sky', 'fog']) {
    if (!isText(scene[key])) errors.push(`scene.${key}: expected a colour string`)
  }
  if (!Array.isArray(scene.bounds) || scene.bounds.length !== 2) {
    errors.push('scene.bounds: expected [x, z]')
  }
  const spawn = scene.spawn
  if (!Array.isArray(spawn) || spawn.length !== 2 || spawn.some((n) => typeof n !== 'number')) {
    errors.push('scene.spawn: expected [x, z]')
  }
  if (!Array.isArray(scene.stations) || scene.stations.length < 6) {
    errors.push('scene.stations: expected at least 6 task stations')
  } else {
    scene.stations.forEach((station, index) => {
      if (!Array.isArray(station) || station.length !== 2 || station.some((n) => typeof n !== 'number')) {
        errors.push(`scene.stations[${index}]: expected [x, z]`)
        return
      }
      // A station inside the spawn radius pops its task open before the player
      // has taken a step.
      if (Array.isArray(spawn) && spawn.length === 2) {
        const distance = Math.hypot(station[0] - (spawn[0] as number), station[1] - (spawn[1] as number))
        if (distance < MIN_SPAWN_CLEARANCE) {
          errors.push(`scene.stations[${index}]: only ${distance.toFixed(1)} from spawn, need ${MIN_SPAWN_CLEARANCE}`)
        }
      }
    })
  }
  if (!Array.isArray(scene.props)) {
    errors.push('scene.props: expected an array')
  } else {
    scene.props.forEach((prop, index) => {
      if (!isObject(prop)) {
        errors.push(`scene.props[${index}]: expected an object`)
        return
      }
      if (!PROP_KINDS.includes(prop.kind as (typeof PROP_KINDS)[number])) {
        errors.push(`scene.props[${index}].kind: expected one of ${PROP_KINDS.join(', ')}`)
      }
      if (!isNumberTriplet(prop.pos)) errors.push(`scene.props[${index}].pos: expected [x, y, z]`)
      if (!isNumberTriplet(prop.size)) errors.push(`scene.props[${index}].size: expected [x, y, z]`)
      if (!isText(prop.color)) errors.push(`scene.props[${index}].color: expected a colour string`)
    })
  }
  if (!Array.isArray(scene.zones)) {
    errors.push('scene.zones: expected an array')
  } else {
    scene.zones.forEach((zone, index) => {
      if (!isObject(zone)) {
        errors.push(`scene.zones[${index}]: expected an object`)
        return
      }
      if (!isText(zone.label)) errors.push(`scene.zones[${index}].label: expected text`)
      if (!isText(zone.labelUz)) errors.push(`scene.zones[${index}].labelUz: expected text`)
      if (!isNumberTriplet(zone.pos)) errors.push(`scene.zones[${index}].pos: expected [x, y, z]`)
      if (!isText(zone.color)) errors.push(`scene.zones[${index}].color: expected a colour string`)
    })
  }
}

function checkItem(item: unknown, index: number, zoneLabels: string[], seen: Set<string>, errors: string[]): void {
  const where = `items[${index}]`
  if (!isObject(item)) {
    errors.push(`${where}: expected an object`)
    return
  }
  const id = item.id
  if (!isText(id)) {
    errors.push(`${where}.id: expected text`)
  } else if (seen.has(id)) {
    errors.push(`${where}.id: duplicate id "${id}"`)
  } else {
    seen.add(id)
  }
  const label = isText(id) ? id : where

  const type = item.type
  if (!ITEM_TYPES.includes(type as (typeof ITEM_TYPES)[number])) {
    errors.push(`${label}.type: expected one of ${ITEM_TYPES.join(', ')}`)
    return
  }
  if (!isText(item.promptRu)) errors.push(`${label}.promptRu: expected Russian material`)
  if (!isText(item.uz)) errors.push(`${label}.uz: expected an Uzbek translation`)
  if (!isText(item.explainUz)) errors.push(`${label}.explainUz: expected an Uzbek explanation`)
  if (!isText(item.answer)) {
    errors.push(`${label}.answer: expected text`)
    return
  }
  const answer = item.answer as string

  if (type === 'order') {
    if (!isStringArray(item.tokens) || item.tokens.length < 3) {
      errors.push(`${label}.tokens: expected at least 3 tokens`)
      return
    }
    const tokens = [...(item.tokens as string[])].sort()
    const fromAnswer = answer.split(' ').filter(Boolean).sort()
    if (tokens.join('|') !== fromAnswer.join('|')) {
      errors.push(`${label}: tokens and answer do not contain the same words`)
    }
    return
  }

  if (!isStringArray(item.options)) {
    errors.push(`${label}.options: expected 2–4 options`)
    return
  }
  const options = item.options as string[]
  if (options.length < 2 || options.length > 4) {
    errors.push(`${label}.options: expected 2–4 options, found ${options.length}`)
  }
  if (new Set(options).size !== options.length) {
    errors.push(`${label}.options: options must be unique`)
  }
  if (!options.includes(answer)) {
    errors.push(`${label}.answer: "${answer}" is not among the options`)
  }
  if (type === 'fill' && !(item.promptRu as string).includes('___')) {
    errors.push(`${label}.promptRu: a fill item needs a ___ gap`)
  }
  if (type === 'sort') {
    const missing = options.filter((option) => !zoneLabels.includes(option))
    if (missing.length > 0) {
      errors.push(`${label}.options: no scene zone for ${missing.join(', ')}`)
    }
  }
}

/**
 * Validates one episode file. Returns every problem found rather than throwing
 * on the first, so an author fixing content sees the whole list at once.
 */
export function validateEpisode(raw: unknown, source: string): string[] {
  const errors: string[] = []
  const push = (message: string) => errors.push(`${source}: ${message}`)

  if (!isObject(raw)) return [`${source}: expected a JSON object`]

  if (!/^ep\d{2}$/.test(String(raw.id))) push('id: expected the form "ep01"')
  if (typeof raw.order !== 'number' || raw.order < 1) push('order: expected a positive number')
  for (const key of ['title', 'titleUz', 'topic', 'topicUz', 'summaryUz', 'icon']) {
    if (!isText(raw[key])) push(`${key}: expected text`)
  }

  if (!Array.isArray(raw.intro) || raw.intro.length === 0) {
    push('intro: expected at least one Barsik line')
  } else {
    raw.intro.forEach((line, index) => {
      if (!isObject(line) || !isText(line.textUz)) push(`intro[${index}].textUz: expected text`)
    })
  }

  // Spec §5: 3–5 rule cards, exceptions on a card of their own.
  if (!Array.isArray(raw.ruleCards) || raw.ruleCards.length < 3 || raw.ruleCards.length > 5) {
    push('ruleCards: expected 3–5 cards')
  } else {
    raw.ruleCards.forEach((card, index) => {
      if (!isObject(card)) {
        push(`ruleCards[${index}]: expected an object`)
        return
      }
      if (!isText(card.titleUz)) push(`ruleCards[${index}].titleUz: expected text`)
      if (!isText(card.bodyUz)) push(`ruleCards[${index}].bodyUz: expected text`)
      if (!isStringArray(card.examplesRu) || (card.examplesRu as string[]).length === 0) {
        push(`ruleCards[${index}].examplesRu: expected at least one Russian example`)
      }
    })
    if (!raw.ruleCards.some((card) => isObject(card) && card.isException === true)) {
      push('ruleCards: one card must cover the exceptions (isException: true)')
    }
  }

  if (!isObject(raw.boss)) {
    push('boss: missing')
  } else {
    for (const key of ['nameRu', 'nameUz', 'introUz', 'winUz', 'loseUz', 'color']) {
      if (!isText(raw.boss[key])) push(`boss.${key}: expected text`)
    }
  }

  checkScene(raw.scene, errors)
  const zoneLabels = isObject(raw.scene) && Array.isArray(raw.scene.zones)
    ? raw.scene.zones.filter(isObject).map((zone) => String(zone.label))
    : []

  if (!Array.isArray(raw.items)) {
    push('items: expected an array')
    return errors
  }
  const items = raw.items
  const seen = new Set<string>()
  items.forEach((item, index) => checkItem(item, index, zoneLabels, seen, errors))

  const objects = items.filter(isObject)
  const exceptions = objects.filter((item) => item.isException === true)
  const bossItems = objects.filter((item) => item.isBoss === true)
  const bossExceptions = bossItems.filter((item) => item.isException === true)

  if (objects.length < MIN_ITEMS) push(`items: expected at least ${MIN_ITEMS}, found ${objects.length}`)
  if (exceptions.length < MIN_EXCEPTIONS) {
    push(`items: expected at least ${MIN_EXCEPTIONS} exception items, found ${exceptions.length}`)
  }
  if (bossExceptions.length < MIN_BOSS_EXCEPTIONS) {
    push(`items: expected at least ${MIN_BOSS_EXCEPTIONS} boss exceptions, found ${bossExceptions.length}`)
  }
  if (bossItems.length - bossExceptions.length < MIN_BOSS_REGULAR) {
    push(`items: expected at least ${MIN_BOSS_REGULAR} boss rule questions, found ${bossItems.length - bossExceptions.length}`)
  }
  // Spec §4: the free stage is 40+ tasks before the boss round.
  if (objects.length - bossItems.length < 40) {
    push(`items: expected at least 40 non-boss items, found ${objects.length - bossItems.length}`)
  }

  if (!Array.isArray(raw.requiredExceptions) || raw.requiredExceptions.length === 0) {
    push('requiredExceptions: list the spec exceptions this episode must cover')
  } else {
    raw.requiredExceptions.forEach((entry, index) => {
      if (!isObject(entry) || !isText(entry.key) || !isText(entry.match)) {
        push(`requiredExceptions[${index}]: expected { key, match }`)
        return
      }
      const match = entry.match as string
      const hits = objects.filter((item) => includesText(item, match))
      if (hits.length < MIN_EXCEPTION_OCCURRENCES) {
        push(`requiredExceptions "${entry.key}": found in ${hits.length} item(s), need ${MIN_EXCEPTION_OCCURRENCES}`)
      }
      if (!hits.some((item) => item.isBoss === true)) {
        push(`requiredExceptions "${entry.key}": never asked by the boss`)
      }
    })
  }

  return errors
}
