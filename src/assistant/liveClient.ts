// Drives one conversation with Maks.
//
// The browser talks to Gemini directly over a WebSocket; the Lison backend only
// mints the short-lived token that opens it. A single connection lives about ten
// minutes, so this client transparently re-mints and reconnects with a session
// resumption handle whenever the server signals that the end is near.

import { GoogleGenAI, Modality } from '@google/genai'
import type { LiveServerMessage, Session } from '@google/genai'
import { ApiError, api } from '../api'
import type { AudioInput } from './audioIn'
import { MicrophoneDeniedError, startAudioInput } from './audioIn'
import { createAudioOutput } from './audioOut'
import type { AudioOutput } from './audioOut'
import { runTool, toolDeclarations } from './tools'
import type { ToolEffects } from './tools'

export type AssistantStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'reconnecting'
  | 'closed'

export type TranscriptEntry = {
  id: string
  speaker: 'learner' | 'maks'
  text: string
}

export type AssistantFailure =
  | 'microphone_denied'
  | 'quota_exceeded'
  | 'assistant_disabled'
  | 'connection_failed'

export type AssistantCallbacks = {
  onStatus: (status: AssistantStatus) => void
  onTranscript: (entries: TranscriptEntry[]) => void
  onLevel?: (level: number) => void
  onFailure: (failure: AssistantFailure, message: string) => void
  onRemainingSeconds?: (seconds: number) => void
} & ToolEffects

export type AssistantSessionOptions = {
  topicSlug?: string
  callbacks: AssistantCallbacks
}

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_BASE_DELAY_MS = 600

export type AssistantSession = {
  stop: () => Promise<void>
  setMuted: (muted: boolean) => void
  /** Type instead of speaking — also the fallback when the microphone is refused. */
  sendText: (text: string) => void
}

export async function startAssistantSession(
  options: AssistantSessionOptions,
): Promise<AssistantSession> {
  const { callbacks, topicSlug } = options
  const transcript: TranscriptEntry[] = []
  const startedAt = Date.now()

  let session: Session | null = null
  let audioIn: AudioInput | null = null
  let audioOut: AudioOutput | null = null
  let resumptionHandle: string | undefined
  let stopped = false
  let reconnectAttempts = 0
  let muted = false
  // Transcription arrives in fragments; keep appending to the open entry until
  // the speaker changes so the UI reads as sentences, not confetti.
  let openEntry: TranscriptEntry | null = null

  function emitTranscript() {
    callbacks.onTranscript([...transcript])
  }

  function appendTranscript(speaker: TranscriptEntry['speaker'], text: string) {
    if (!text) return
    if (openEntry && openEntry.speaker === speaker) {
      openEntry.text += text
    } else {
      openEntry = { id: `${speaker}-${Date.now()}-${transcript.length}`, speaker, text }
      transcript.push(openEntry)
    }
    emitTranscript()
  }

  const effects: ToolEffects = {
    onCardsChanged: callbacks.onCardsChanged,
    onTopicChanged: callbacks.onTopicChanged,
  }

  async function handleToolCall(message: LiveServerMessage) {
    const calls = message.toolCall?.functionCalls ?? []
    if (calls.length === 0) return
    const responses = await Promise.all(
      calls.map(async (call) => {
        const result = await runTool(call.name ?? '', (call.args ?? {}) as Record<string, unknown>, effects)
        return {
          id: call.id,
          name: call.name,
          response: result.scheduling
            ? { ...result.response, scheduling: result.scheduling }
            : result.response,
        }
      }),
    )
    // The session may have been torn down while the REST calls were in flight.
    if (stopped || !session) return
    session.sendToolResponse({ functionResponses: responses })
  }

  function handleMessage(message: LiveServerMessage) {
    if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
      resumptionHandle = message.sessionResumptionUpdate.newHandle
    }

    // goAway is the ten-minute warning. Reconnect now rather than waiting for the
    // socket to drop mid-sentence.
    if (message.goAway) {
      void reconnect()
      return
    }

    if (message.toolCall) {
      void handleToolCall(message)
      return
    }

    const content = message.serverContent
    if (!content) return

    if (content.interrupted) {
      audioOut?.interrupt()
      callbacks.onStatus(muted ? 'idle' : 'listening')
    }

    if (content.inputTranscription?.text) {
      appendTranscript('learner', content.inputTranscription.text)
    }
    if (content.outputTranscription?.text) {
      appendTranscript('maks', content.outputTranscription.text)
    }

    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) audioOut?.push(part.inlineData.data)
    }

    if (content.turnComplete) {
      openEntry = null
    }
  }

  async function connect(resume: boolean): Promise<void> {
    const token = await api.assistantToken(topicSlug)
    callbacks.onRemainingSeconds?.(token.remainingSeconds)

    const ai = new GoogleGenAI({ apiKey: token.token })
    session = await ai.live.connect({
      model: token.model,
      // The persona, voice and transcription settings are pinned to the token by
      // the backend, so they are deliberately not repeated here. Only the tools
      // and the resumption handle are the client's to choose.
      config: {
        responseModalities: [Modality.AUDIO],
        tools: [{ functionDeclarations: toolDeclarations }],
        sessionResumption: resume && resumptionHandle ? { handle: resumptionHandle } : {},
      },
      callbacks: {
        onopen: () => {
          reconnectAttempts = 0
          callbacks.onStatus(muted ? 'idle' : 'listening')
        },
        onmessage: handleMessage,
        onerror: () => {
          if (!stopped) void reconnect()
        },
        onclose: () => {
          if (!stopped) void reconnect()
        },
      },
    })
  }

  let reconnecting = false
  async function reconnect(): Promise<void> {
    if (stopped || reconnecting) return
    reconnecting = true
    callbacks.onStatus('reconnecting')
    try {
      session?.close()
    } catch {
      // Already gone.
    }
    session = null

    while (!stopped && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++
      await delay(RECONNECT_BASE_DELAY_MS * reconnectAttempts)
      try {
        await connect(true)
        reconnecting = false
        return
      } catch (error) {
        if (error instanceof ApiError && error.code === 'assistant_quota_exceeded') {
          reconnecting = false
          callbacks.onFailure('quota_exceeded', error.message)
          await stop()
          return
        }
      }
    }
    reconnecting = false
    if (!stopped) {
      callbacks.onFailure('connection_failed', 'Связь с помощником прервалась. Попробуйте ещё раз.')
      await stop()
    }
  }

  async function stop(): Promise<void> {
    if (stopped) return
    stopped = true
    callbacks.onStatus('closed')
    await audioIn?.stop().catch(() => undefined)
    audioIn = null
    await audioOut?.close().catch(() => undefined)
    audioOut = null
    try {
      session?.close()
    } catch {
      // Already gone.
    }
    session = null

    const seconds = Math.round((Date.now() - startedAt) / 1000)
    if (seconds > 0) {
      // Best effort: a failed report costs the learner nothing, and the session
      // was already counted when its first token was minted.
      await api.reportAssistantSession(seconds).catch(() => undefined)
    }
  }

  callbacks.onStatus('connecting')
  audioOut = createAudioOutput({
    onSpeakingChange: (speaking) => {
      if (stopped) return
      callbacks.onStatus(speaking ? 'speaking' : muted ? 'idle' : 'listening')
    },
  })

  try {
    await connect(false)
  } catch (error) {
    await audioOut.close().catch(() => undefined)
    audioOut = null
    throw error
  }

  try {
    audioIn = await startAudioInput({
      onChunk: (base64) => {
        if (stopped || muted || !session) return
        session.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } })
      },
      onLevel: callbacks.onLevel,
    })
  } catch (error) {
    if (error instanceof MicrophoneDeniedError) {
      // Keep the session alive: the learner can still type, which is the
      // documented fallback when a webview refuses the microphone.
      muted = true
      callbacks.onFailure(
        'microphone_denied',
        'Микрофон недоступен. Можно продолжить перепиской.',
      )
      callbacks.onStatus('idle')
    } else {
      await stop()
      throw error
    }
  }

  return {
    stop,
    setMuted(next: boolean) {
      muted = next
      audioIn?.setMuted(next)
      if (next) audioOut?.interrupt()
      if (!stopped) callbacks.onStatus(next ? 'idle' : 'listening')
    },
    sendText(text: string) {
      const trimmed = text.trim()
      if (!trimmed || stopped || !session) return
      appendTranscript('learner', trimmed)
      openEntry = null
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: trimmed }] }], turnComplete: true })
    },
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
