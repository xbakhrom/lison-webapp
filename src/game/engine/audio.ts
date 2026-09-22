import { getSave } from '../save/store'

// Short synthesised blips instead of audio files: no download, no licence, and
// nothing to add to the bundle budget.
let context: AudioContext | null = null

function ensureContext(): AudioContext | null {
  if (!getSave().settings.sound) return null
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context ??= new Ctor()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

function blip(frequency: number, duration: number, when: number, type: OscillatorType = 'sine'): void {
  const audio = ensureContext()
  if (!audio) return
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime + when)
  gain.gain.setValueAtTime(0.0001, audio.currentTime + when)
  gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + when + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + when + duration)
  oscillator.connect(gain).connect(audio.destination)
  oscillator.start(audio.currentTime + when)
  oscillator.stop(audio.currentTime + when + duration + 0.02)
}

export const sfx = {
  correct(): void {
    blip(660, 0.12, 0)
    blip(880, 0.16, 0.09)
  },
  wrong(): void {
    blip(180, 0.22, 0, 'square')
  },
  win(): void {
    blip(523, 0.14, 0)
    blip(659, 0.14, 0.12)
    blip(784, 0.26, 0.24)
  },
  lose(): void {
    blip(300, 0.2, 0, 'sawtooth')
    blip(200, 0.3, 0.18, 'sawtooth')
  },
}
