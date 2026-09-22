// Playback for the Live API's reply stream: raw PCM16 at 24 kHz, delivered as
// base64 chunks that have to be stitched into gapless speech.

const OUTPUT_SAMPLE_RATE = 24000

export type AudioOutput = {
  /** Queue one base64 PCM16 chunk from the model. */
  push: (base64: string) => void
  /** Drop everything queued — used when the learner talks over Maks. */
  interrupt: () => void
  /** Whether Maks is currently speaking. */
  isPlaying: () => boolean
  close: () => Promise<void>
}

export type AudioOutputOptions = {
  onSpeakingChange?: (speaking: boolean) => void
}

export function createAudioOutput(options: AudioOutputOptions = {}): AudioOutput {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) {
    return {
      push: () => undefined,
      interrupt: () => undefined,
      isPlaying: () => false,
      close: async () => undefined,
    }
  }

  const context = new AudioContextCtor({ sampleRate: OUTPUT_SAMPLE_RATE })
  const sources = new Set<AudioBufferSourceNode>()
  // Where the next chunk should start. Scheduling against the context clock
  // rather than "now" is what keeps consecutive chunks from clicking.
  let nextStartTime = 0
  let speaking = false

  function setSpeaking(next: boolean) {
    if (speaking === next) return
    speaking = next
    options.onSpeakingChange?.(next)
  }

  return {
    push(base64: string) {
      const samples = decodePCM16(base64)
      if (samples.length === 0) return
      if (context.state === 'suspended') void context.resume()

      const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE)
      buffer.copyToChannel(samples, 0)

      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)

      // A little lead time absorbs jitter in chunk arrival without an audible gap.
      const startAt = Math.max(context.currentTime + 0.05, nextStartTime)
      source.start(startAt)
      nextStartTime = startAt + buffer.duration
      sources.add(source)
      setSpeaking(true)

      source.onended = () => {
        sources.delete(source)
        if (sources.size === 0) setSpeaking(false)
      }
    },
    interrupt() {
      sources.forEach((source) => {
        source.onended = null
        try {
          source.stop()
        } catch {
          // Already finished; nothing to stop.
        }
      })
      sources.clear()
      nextStartTime = 0
      setSpeaking(false)
    },
    isPlaying: () => speaking,
    async close() {
      this.interrupt()
      await context.close().catch(() => undefined)
    },
  }
}

function decodePCM16(base64: string) {
  const binary = atob(base64)
  const sampleCount = binary.length >> 1
  // Backed by an explicit ArrayBuffer so copyToChannel accepts it: a plain
  // Float32Array is typed over ArrayBufferLike, which may be shared.
  const samples = new Float32Array(new ArrayBuffer(sampleCount * Float32Array.BYTES_PER_ELEMENT))
  for (let i = 0; i < sampleCount; i++) {
    // Little-endian: low byte first.
    const value = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)
    samples[i] = (value >= 0x8000 ? value - 0x10000 : value) / 0x8000
  }
  return samples
}
