import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../engine/audio'
import { speakRussian } from '../engine/speech'
import type { World } from '../engine/world'
import { hasContent, loadEpisode, summaryOf, TOTAL_EPISODES } from '../content'
import { buildFreeStage, HINTS_PER_EPISODE, optionsFor, scoreFor, starsFor, type Task } from '../gameplay/session'
import { pickDue, recordCorrect, recordWrong, SRS_EVERY } from '../gameplay/srs'
import { t } from '../i18n'
import { getSave, updateSave, useSave } from '../save/store'
import type { Episode, EpisodeItem } from '../types'
import { BarsikBubble } from './Barsik'
import { BossScreen } from './BossScreen'
import { GameCanvas } from './GameCanvas'
import { Hud } from './Hud'
import { IntroScreen } from './IntroScreen'
import { StatsScreen } from './StatsScreen'
import { TaskPanel, type TaskResult } from './TaskPanel'
import { Tutorial } from './Tutorial'

type Props = {
  episode: Episode
  onExit: () => void
}

type Phase = 'intro' | 'play' | 'boss' | 'stats'

type Hint = { title: string; text: string; tone: 'default' | 'exception' }

/** What to list under "weak forms": the noun being classified, or the form the
 *  learner had to produce. */
function weakLabel(item: EpisodeItem): { ru: string; uz: string } {
  const ru = item.type === 'sort' || item.type === 'choice' ? item.promptRu : item.answer
  return { ru, uz: item.uz }
}

/** Collects overdue forms from earlier episodes so they can be mixed back in. */
async function collectReminders(episodeId: string, limit: number): Promise<Task[]> {
  const reminders: Task[] = []
  const used = new Set<string>()
  for (let index = 0; index < limit; index += 1) {
    const due = pickDue(episodeId, used)
    if (!due) break
    used.add(due.itemId)
    try {
      const source = await loadEpisode(due.episodeId)
      const item = source.items.find((candidate) => candidate.id === due.itemId)
      if (item) reminders.push({ item, episodeId: source.id, fromSrs: true })
    } catch {
      // A reminder whose episode cannot be loaded is simply skipped.
    }
  }
  return reminders
}

export function EpisodeScreen({ episode, onExit }: Props) {
  const save = useSave()
  const [phase, setPhase] = useState<Phase>('intro')
  const [queue, setQueue] = useState<Task[]>([])
  const [slots, setSlots] = useState<(Task | null)[]>([])
  const [world, setWorld] = useState<World | null>(null)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [result, setResult] = useState<TaskResult | null>(null)
  const [hint, setHint] = useState<Hint | null>(null)
  const [hintsLeft, setHintsLeft] = useState(HINTS_PER_EPISODE)
  const [score, setScore] = useState(0)
  const [showTutorial, setShowTutorial] = useState(!save.tutorialDone)
  const [runKey, setRunKey] = useState(0)
  const [summary, setSummary] = useState<{ correct: number; total: number; stars: number; unlocked?: string } | null>(null)

  // Slots are mirrored in a ref: assigning the next task needs the current
  // layout, and React may replay a state updater, which must stay pure.
  const slotsRef = useRef<(Task | null)[]>([])
  const cursorRef = useRef(0)
  const streakRef = useRef(0)
  const wrongStreakRef = useRef(0)
  const tally = useRef({ answered: 0, correct: 0 })
  const weakRef = useRef<Map<string, { ru: string; uz: string }>>(new Map())
  const srsAddedRef = useRef<Set<string>>(new Set())

  const zoneCaptions = useMemo(
    () => Object.fromEntries(episode.scene.zones.map((zone) => [zone.label, zone.labelUz])),
    [episode],
  )
  const ruleNudge = useMemo(
    () => episode.ruleCards.find((card) => !card.isException)?.bodyUz ?? t('barsik.noHint'),
    [episode],
  )

  // ------------------------------------------------------------- preparation
  useEffect(() => {
    let active = true
    const freeCount = episode.items.filter((item) => !item.isBoss).length
    collectReminders(episode.id, Math.floor(freeCount / SRS_EVERY)).then((reminders) => {
      if (active) setQueue(buildFreeStage(episode, reminders))
    })
    return () => {
      active = false
    }
  }, [episode, runKey])

  const applySlots = useCallback((next: (Task | null)[]) => {
    slotsRef.current = next
    setSlots(next)
  }, [])

  /** Fills every pedestal once both the world and the task queue are ready.
   *  Written so a repeated run assigns the same tasks rather than skipping ahead. */
  useEffect(() => {
    if (!world || queue.length === 0 || slots.length > 0) return
    const count = world.stationCount
    const initial: (Task | null)[] = Array.from({ length: count }, (_, index) => queue[index] ?? null)
    cursorRef.current = Math.min(count, queue.length)
    initial.forEach((task, index) => {
      world.setStation(index, task ? (task.item.isException ? 'exception' : 'normal') : 'empty')
    })
    applySlots(initial)
  }, [world, queue, slots.length, applySlots])

  const activeTask = activeSlot !== null ? slots[activeSlot] ?? null : null
  const options = useMemo(() => (activeTask ? optionsFor(activeTask.item) : []), [activeTask])

  useEffect(() => {
    if (!activeTask || !getSave().settings.autoSpeak) return
    speakRussian(activeTask.item.promptRu)
  }, [activeTask])

  /** Puts the next task on the free pedestal furthest from the player, so the
   *  episode is walked through rather than answered from one spot. */
  const refill = useCallback(
    (solvedSlot: number) => {
      if (!world) return
      const next = [...slotsRef.current]
      next[solvedSlot] = null

      if (cursorRef.current < queue.length) {
        let best = -1
        let bestDistance = -1
        next.forEach((task, index) => {
          if (task) return
          const distance = world.distanceToPlayer(index)
          if (distance > bestDistance) {
            bestDistance = distance
            best = index
          }
        })
        if (best >= 0) {
          const task = queue[cursorRef.current]
          cursorRef.current += 1
          next[best] = task
          world.setStation(best, task.item.isException ? 'exception' : 'normal')
        }
      }
      applySlots(next)
    },
    [world, queue, applySlots],
  )

  const answer = useCallback(
    (value: string) => {
      const task = activeTask
      if (!task || result) return
      const correct = value === task.item.answer
      tally.current.answered += 1

      if (correct) {
        tally.current.correct += 1
        streakRef.current += 1
        wrongStreakRef.current = 0
        setScore((current) => current + scoreFor(task.item, streakRef.current))
        recordCorrect(task.item.id)
        sfx.correct()
      } else {
        streakRef.current = 0
        wrongStreakRef.current += 1
        recordWrong(task.item, task.episodeId)
        srsAddedRef.current.add(task.item.id)
        weakRef.current.set(task.item.id, weakLabel(task.item))
        sfx.wrong()
        if (task.item.isException) {
          // Spec §2: Barsik spells the exception out and says it will come back.
          setHint({ title: t('barsik.exceptionTitle'), text: task.item.explainUz, tone: 'exception' })
        }
      }
      setResult({ correct, chosen: value })
    },
    [activeTask, result],
  )

  const goOn = useCallback(() => {
    const slot = activeSlot
    const task = activeTask
    setResult(null)
    setActiveSlot(null)
    setHint(null)
    if (slot === null || !task) return
    world?.solveStation(slot, task.item.type === 'sort' ? task.item.answer : undefined)
    refill(slot)

    // Two mistakes in a row: a nudge back to the rule, never the answer (spec §2).
    if (wrongStreakRef.current >= 2) {
      setHint({ title: t('barsik.hintTitle'), text: ruleNudge, tone: 'default' })
      wrongStreakRef.current = 0
    }
  }, [activeSlot, activeTask, refill, ruleNudge, world])

  const askHint = useCallback(() => {
    if (hintsLeft === 0) return
    setHintsLeft((current) => current - 1)
    setHint({
      title: t('barsik.hintTitle'),
      text: activeTask?.item.hintUz ?? ruleNudge,
      tone: 'default',
    })
  }, [activeTask, hintsLeft, ruleNudge])

  // The free stage ends when the queue is drained and every pedestal is empty.
  const stageDone =
    phase === 'play' && queue.length > 0 && cursorRef.current >= queue.length && slots.length > 0 && slots.every((task) => task === null)

  useEffect(() => {
    if (stageDone) setPhase('boss')
  }, [stageDone])

  const onBossAnswer = useCallback(
    (item: EpisodeItem, correct: boolean) => {
      tally.current.answered += 1
      if (correct) {
        tally.current.correct += 1
        recordCorrect(item.id)
      } else {
        recordWrong(item, episode.id)
        srsAddedRef.current.add(item.id)
        weakRef.current.set(item.id, weakLabel(item))
      }
    },
    [episode],
  )

  const finishEpisode = useCallback(() => {
    const answered = tally.current.answered
    const correct = tally.current.correct
    const accuracy = answered > 0 ? correct / answered : 0
    const stars = starsFor(accuracy, srsAddedRef.current.size)
    const nextOrder = Math.min(TOTAL_EPISODES, episode.order + 1)
    const nextId = `ep${String(nextOrder).padStart(2, '0')}`
    // Only announce the next episode once its content bank has been released.
    const firstClear =
      getSave().unlockedEpisode <= episode.order && episode.order < TOTAL_EPISODES && hasContent(nextId)

    updateSave((current) => {
      const previous = current.stats[episode.id]
      return {
        ...current,
        unlockedEpisode: Math.max(current.unlockedEpisode, nextOrder),
        stars: { ...current.stars, [episode.id]: Math.max(current.stars[episode.id] ?? 0, stars) },
        stats: {
          ...current.stats,
          [episode.id]: {
            accuracy,
            attempts: (previous?.attempts ?? 0) + 1,
            bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, accuracy),
          },
        },
      }
    })

    setSummary({
      correct,
      total: answered,
      stars,
      unlocked: firstClear ? summaryOf(nextId)?.title : undefined,
    })
    setPhase('stats')
  }, [episode])

  const restart = useCallback(() => {
    cursorRef.current = 0
    streakRef.current = 0
    wrongStreakRef.current = 0
    tally.current = { answered: 0, correct: 0 }
    weakRef.current = new Map()
    srsAddedRef.current = new Set()
    setScore(0)
    setHintsLeft(HINTS_PER_EPISODE)
    applySlots([])
    setQueue([])
    setResult(null)
    setActiveSlot(null)
    setSummary(null)
    setWorld(null)
    setPhase('intro')
    setRunKey((current) => current + 1)
  }, [applySlots])

  const handleNear = useCallback((index: number | null) => {
    setActiveSlot((current) => {
      if (current !== null) return current
      return index
    })
  }, [])

  // -------------------------------------------------------------- rendering
  if (phase === 'intro') {
    return <IntroScreen episode={episode} onStart={() => setPhase('play')} />
  }

  if (phase === 'stats' && summary) {
    return (
      <StatsScreen
        title={`${episode.title} · ${episode.titleUz}`}
        correct={summary.correct}
        total={summary.total}
        stars={summary.stars}
        weak={[...weakRef.current.values()].slice(0, 12)}
        addedToSrs={srsAddedRef.current.size}
        unlockedTitle={summary.unlocked}
        onAgain={restart}
        onMap={onExit}
      />
    )
  }

  const done = Math.min(tally.current.answered, queue.length)

  return (
    <div className="tm-episode" style={{ fontSize: `${save.settings.fontScale}rem` }}>
      <GameCanvas
        key={runKey}
        scene={episode.scene}
        shadows={save.settings.shadows}
        paused={activeSlot !== null || phase === 'boss'}
        onNear={handleNear}
        onReady={setWorld}
      />

      {phase === 'play' && (
        <>
          <Hud
            title={`${episode.title} · ${episode.topicUz}`}
            done={done}
            total={queue.length}
            score={score}
            hintsLeft={hintsLeft}
            onHint={askHint}
            onExit={onExit}
          />
          {showTutorial && <Tutorial onDone={() => setShowTutorial(false)} />}
          {hint && (
            <div className="tm-hint-layer">
              <BarsikBubble title={hint.title} tone={hint.tone} onClose={() => setHint(null)}>
                {hint.text}
              </BarsikBubble>
            </div>
          )}
          {activeTask && (
            <TaskPanel
              item={activeTask.item}
              options={options}
              zoneCaptions={zoneCaptions}
              fromSrs={activeTask.fromSrs}
              result={result}
              onAnswer={answer}
              onContinue={goOn}
            />
          )}
        </>
      )}

      {phase === 'boss' && (
        <BossScreen
          episode={episode}
          zoneCaptions={zoneCaptions}
          onAnswered={onBossAnswer}
          onPassed={finishEpisode}
          onExit={onExit}
        />
      )}
    </div>
  )
}
