// Web Speech API pronunciation (spec §6). When the browser has no voices the
// caller hides the button instead of offering something that does nothing.

export function canSpeak(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  } catch {
    return false
  }
}

/** Strips combining stress accents — they are for the eye, not the voice. */
function plain(text: string): string {
  return text.replace(/́/g, '').replace(/_+/g, ' ')
}

export function speakRussian(text: string): void {
  if (!canSpeak() || !text.trim()) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(plain(text))
    utterance.lang = 'ru-RU'
    utterance.rate = 0.9
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.startsWith('ru'))
    if (voice) utterance.voice = voice
    window.speechSynthesis.speak(utterance)
  } catch {
    // A refusal to speak must never interrupt play.
  }
}
