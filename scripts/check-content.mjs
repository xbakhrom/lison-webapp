// Validates «Temur Moskvada» episode content before the app is built, so a
// content mistake fails the build with a readable list instead of surfacing as
// a broken episode in production (spec §9).
//
// Runs the very same validator the app uses at runtime; Node strips the types.

import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const contentDir = join(here, '..', 'src', 'game', 'content')

const { validateEpisode } = await import(join(contentDir, 'validate.ts'))

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

const files = (await readdir(contentDir)).filter((name) => /^ep\d{2}\.json$/.test(name)).sort()
const manifest = await readJson(join(contentDir, 'manifest.json'))

const problems = []

if (!Array.isArray(manifest) || manifest.length === 0) {
  problems.push('manifest.json: expected a non-empty array of episode summaries')
}

const listed = new Set(manifest.map((entry) => entry.id))
for (const entry of manifest) {
  for (const key of ['id', 'title', 'titleUz', 'topicUz', 'icon', 'summaryUz']) {
    if (typeof entry[key] !== 'string' || entry[key].trim() === '') {
      problems.push(`manifest.json: ${entry.id ?? '?'} is missing "${key}"`)
    }
  }
  if (!Array.isArray(entry.map) || entry.map.length !== 2) {
    problems.push(`manifest.json: ${entry.id ?? '?'} needs a map position [x, y]`)
  }
}

for (const file of files) {
  const id = file.replace('.json', '')
  if (!listed.has(id)) problems.push(`${file}: not listed in manifest.json`)

  let episode
  try {
    episode = await readJson(join(contentDir, file))
  } catch (error) {
    problems.push(`${file}: invalid JSON — ${error.message}`)
    continue
  }

  problems.push(...validateEpisode(episode, file))

  const summary = manifest.find((entry) => entry.id === id)
  if (summary && summary.order !== episode.order) {
    problems.push(`${file}: order ${episode.order} does not match manifest order ${summary.order}`)
  }
  if (summary && summary.title !== episode.title) {
    problems.push(`${file}: title "${episode.title}" does not match manifest title "${summary.title}"`)
  }
}

const playable = files.length
if (problems.length > 0) {
  console.error(`\n✗ Temur Moskvada content check failed (${problems.length} problem(s)):\n`)
  for (const problem of problems) console.error(`  · ${problem}`)
  console.error('')
  process.exit(1)
}

const pending = manifest.filter((entry) => !files.includes(`${entry.id}.json`))
console.log(`✓ Temur Moskvada content: ${playable} playable episode(s) of ${manifest.length} validated`)
if (pending.length > 0) {
  console.log(`  awaiting content: ${pending.map((entry) => entry.id).join(', ')}`)
}
