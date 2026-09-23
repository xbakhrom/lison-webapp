// Microphone capture for the Live API: mono PCM16 at 16 kHz, base64 encoded.
//
// The processor runs in an AudioWorklet so capture survives a busy main thread.
// Its source is inlined as a blob URL rather than a separate build entry: the
// Mini App is served from a plain static build and this keeps the worklet from
// depending on how Vite happens to name chunks.

const TARGET_SAMPLE_RATE = 16000
const FRAME_SAMPLES = 2048

const workletSource = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(${FRAME_SAMPLES})
    this.filled = 0
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.filled++] = channel[i]
      if (this.filled === this.buffer.length) {
        this.port.postMessage(this.buffer.slice(0))
        this.filled = 0
      }
    }
    return true
  }
}
registerProcessor('pcm-capture', PcmCapture)
`

export type MicrophoneStatus = 'idle' | 'listening' | 'speaking'

export type AudioInputOptions = {
  /** Called with a base64 PCM16 chunk that should go to the Live session. */
  onChunk: (base64: string) => void
  /** Called with the current input level (0..1) for the UI meter. */
  onLevel?: (level: number) => void
}

/** Thrown when the learner (or the platform) refuses microphone access. */
export class MicrophoneDeniedError extends Error {
  constructor(cause?: unknown) {
    super('microphone access denied')
    this.name = 'MicrophoneDeniedError'
    this.cause = cause
  }
}

export type AudioInput = {
  /** Stop sending audio without tearing the microphone down. */
  setMuted: (muted: boolean) => void
  stop: () => Promise<void>
}

export async function startAudioInput(options: AudioInputOptions): Promise<AudioInput> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneDeniedError(new Error('getUserMedia is unavailable'))
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  } catch (error) {
    throw new MicrophoneDeniedError(error)
  }

  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) {
    stream.getTracks().forEach((track) => track.stop())
    throw new MicrophoneDeniedError(new Error('AudioContext is unavailable'))
  }

  // Asking for 16 kHz lets the browser resample for us. Safari has honoured this
  // since 14.1; where it does not, downsample() below picks up the slack.
  const context = new AudioContextCtor({ sampleRate: TARGET_SAMPLE_RATE })
  if (context.state === 'suspended') await context.resume()

  const workletURL = URL.createObjectURL(new Blob([workletSource], { type: 'application/javascript' }))
  try {
    await context.audioWorklet.addModule(workletURL)
  } finally {
    URL.revokeObjectURL(workletURL)
  }

  const source = context.createMediaStreamSource(stream)
  const capture = new AudioWorkletNode(context, 'pcm-capture')
  let muted = false

  // Silence is streamed on purpose. Turn detection lives in the server's VAD,
  // which needs to hear the trailing quiet to close a turn; a client-side gate
  // tried here earlier kept cutting real speech once autoGainControl drifted,
  // leaving the model waiting forever on a half-heard utterance.
  capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
    if (muted) return
    const frame = event.data
    options.onLevel?.(Math.min(1, rms(frame) * 12))

    const samples = context.sampleRate === TARGET_SAMPLE_RATE
      ? frame
      : downsample(frame, context.sampleRate, TARGET_SAMPLE_RATE)
    options.onChunk(encodeBase64(toPCM16(samples)))
  }

  source.connect(capture)
  // Worklets only pull input while connected to the graph. A zero-gain sink
  // keeps it running without routing the microphone back to the speakers.
  const sink = context.createGain()
  sink.gain.value = 0
  capture.connect(sink).connect(context.destination)

  return {
    setMuted(next: boolean) {
      muted = next
    },
    async stop() {
      capture.port.onmessage = null
      capture.disconnect()
      source.disconnect()
      sink.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      await context.close().catch(() => undefined)
    },
  }
}

function rms(frame: Float32Array): number {
  let total = 0
  for (let i = 0; i < frame.length; i++) total += frame[i] * frame[i]
  return Math.sqrt(total / frame.length)
}

function downsample(frame: Float32Array, from: number, to: number): Float32Array {
  const ratio = from / to
  const length = Math.floor(frame.length / ratio)
  const result = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    // Average the source window instead of picking one sample, which would
    // alias high frequencies down into the speech band.
    const start = Math.floor(i * ratio)
    const end = Math.min(frame.length, Math.floor((i + 1) * ratio))
    let total = 0
    for (let j = start; j < end; j++) total += frame[j]
    result[i] = end > start ? total / (end - start) : 0
  }
  return result
}

function toPCM16(samples: Float32Array): Uint8Array {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }
  return new Uint8Array(buffer)
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}
