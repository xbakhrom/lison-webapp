// Maks lives on top of whatever the learner is already reading: tapping him
// starts listening in place, so a lesson never has to be left behind to talk
// about it. The panel above him stays small and can be folded away entirely.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../api'
import { MaksMascot } from './MaksMascot'
import type { MascotState } from './MaksMascot'
import { startAssistantSession } from './liveClient'
import type { AssistantFailure, AssistantSession, AssistantStatus, TranscriptEntry } from './liveClient'

type AssistantDockProps = {
  /** Lesson the learner was reading when they tapped Maks, if any. */
  topicSlug?: string
  onClose: () => void
}

const statusLabels: Record<AssistantStatus, string> = {
  idle: 'На паузе',
  connecting: 'Подключаемся…',
  listening: 'Слушаю',
  speaking: 'Говорит',
  reconnecting: 'Восстанавливаем связь…',
  closed: 'Разговор завершён',
}

const mascotStates: Record<AssistantStatus, MascotState> = {
  idle: 'paused',
  connecting: 'connecting',
  listening: 'listening',
  speaking: 'speaking',
  reconnecting: 'connecting',
  closed: 'idle',
}

export function AssistantDock({ topicSlug, onClose }: AssistantDockProps) {
  const [status, setStatus] = useState<AssistantStatus>('connecting')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [level, setLevel] = useState(0)
  const [muted, setMuted] = useState(false)
  const [notice, setNotice] = useState('')
  const [fatal, setFatal] = useState('')
  const [textMode, setTextMode] = useState(false)
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)

  const sessionRef = useRef<AssistantSession | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  // Tool calls happen silently mid-conversation, so surface them briefly:
  // the learner should see that Maks really did save something.
  const flashToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const handleFailure = useCallback((failure: AssistantFailure, message: string) => {
    if (failure === 'microphone_denied') {
      // The session is still usable by typing, so this is a notice, not an end.
      setTextMode(true)
      setExpanded(true)
      setNotice(message)
      return
    }
    setFatal(message)
    setExpanded(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    let started: AssistantSession | null = null

    // Starting is deferred by a tick so a mount that is immediately undone costs
    // nothing. React's StrictMode does exactly that in development, and each
    // start mints a token against the learner's daily allowance.
    const timer = window.setTimeout(() => {
      startAssistantSession({
        topicSlug,
        callbacks: {
          onStatus: (next) => !cancelled && setStatus(next),
          onTranscript: (entries) => !cancelled && setTranscript(entries),
          onLevel: (next) => !cancelled && setLevel(next),
          onFailure: (failure, message) => !cancelled && handleFailure(failure, message),
          onRemainingSeconds: (seconds) => !cancelled && setRemaining(seconds),
          onCardsChanged: () => !cancelled && flashToast('Карточки обновлены'),
          onTopicChanged: () => !cancelled && flashToast('Ответ сохранён в теме'),
        },
      })
        .then((session) => {
          started = session
          sessionRef.current = session
          if (cancelled) void session.stop()
        })
        .catch((error: unknown) => {
          if (cancelled) return
          const message =
            error instanceof ApiError
              ? error.message
              : 'Не удалось начать разговор. Попробуйте ещё раз.'
          setFatal(message)
          setExpanded(true)
          setStatus('closed')
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      sessionRef.current = null
      void started?.stop()
    }
  }, [topicSlug, handleFailure, flashToast])

  useEffect(() => {
    const node = transcriptRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [transcript, expanded])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    sessionRef.current?.setMuted(next)
    window.Telegram?.WebApp.HapticFeedback?.impactOccurred('light')
  }

  function submitDraft(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    sessionRef.current?.sendText(text)
    setDraft('')
  }

  async function finish() {
    await sessionRef.current?.stop()
    sessionRef.current = null
    onClose()
  }

  // Folded up, the dock still has to answer the only question that matters:
  // is he hearing me? The last thing said stands in for the whole transcript.
  const lastLine = transcript.at(-1)

  return (
    <div className="maks-dock" role="region" aria-label="Разговор с Максом">
      <div className={`maks-panel ${expanded ? 'expanded' : ''}`}>
        <div className="maks-panel-head">
          <span className={`maks-status ${status === 'listening' ? 'live' : ''}`}>
            {statusLabels[status]}
          </span>
          {expanded && remaining !== null && (
            <span className="maks-quota">{Math.max(0, Math.round(remaining / 60))} мин</span>
          )}
          <button
            className="maks-icon-button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Свернуть разговор' : 'Развернуть разговор'}
          >
            <span aria-hidden="true">{expanded ? '⌄' : '⌃'}</span>
          </button>
          <button className="maks-icon-button" onClick={finish} aria-label="Завершить разговор">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {toast && <p className="maks-toast">{toast}</p>}
        {notice && <p className="maks-notice">{notice}</p>}
        {fatal && <p className="maks-fatal">{fatal}</p>}

        {!expanded && !fatal && lastLine && (
          <p className={`maks-last ${lastLine.speaker}`}>{lastLine.text}</p>
        )}

        {expanded && !fatal && (
          <div className="maks-transcript" ref={transcriptRef}>
            {transcript.length === 0 ? (
              <p className="maks-hint">
                Говорите по-русски — Макс объяснит по-узбекски и сам добавит новые слова в карточки.
              </p>
            ) : (
              transcript.map((entry) => (
                <p key={entry.id} className={`maks-line ${entry.speaker}`}>
                  {entry.text}
                </p>
              ))
            )}
          </div>
        )}

        {expanded && textMode && !fatal && (
          <form className="maks-compose" onSubmit={submitDraft}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Напишите сообщение…"
              aria-label="Сообщение Максу"
            />
            <button type="submit" disabled={!draft.trim()}>→</button>
          </form>
        )}
      </div>

      <div className="maks-launcher-row">
        {!textMode && !fatal && (
          <button
            className={`maks-mute ${muted ? 'muted' : ''}`}
            onClick={toggleMute}
            disabled={status === 'connecting' || status === 'reconnecting'}
            aria-label={muted ? 'Включить микрофон' : 'Поставить на паузу'}
          >
            <span aria-hidden="true">{muted ? '▶' : '❚❚'}</span>
          </button>
        )}
        <button
          className="maks-launcher active"
          onClick={() => setExpanded((value) => !value)}
          aria-label="Разговор с Максом"
        >
          <MaksMascot state={mascotStates[status]} size={56} level={level} />
        </button>
      </div>
    </div>
  )
}

export default AssistantDock
