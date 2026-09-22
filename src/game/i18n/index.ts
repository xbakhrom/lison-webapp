import strings from './uz.json'

type Key = keyof typeof strings

/**
 * Interface text lives in `uz.json` only — spec §8 forbids hardcoded strings.
 * `t` fills `{name}` placeholders and falls back to the key itself so a missing
 * translation is visible rather than silently blank.
 */
export function t(key: Key | string, params?: Record<string, string | number>): string {
  const template = (strings as Record<string, string>)[key]
  if (template === undefined) return key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  )
}
