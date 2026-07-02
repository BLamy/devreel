/**
 * In-browser narration via the Web Speech API — the dev-time stand-in for the
 * ElevenLabs bake used in production. Picks the sanest voice available:
 * high-quality local voices first, then any local English voice, then whatever
 * the browser offers.
 *
 * Note: Chrome requires a user gesture before speech is allowed, so the first
 * act(s) may be silent until the user clicks anything in the scene — the same
 * rule as autoplaying <video> with sound.
 */

const PREFERRED = [
  'Samantha', // macOS — the classic "sane" one
  'Google US English',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Ava Online (Natural) - English (United States)',
  'Microsoft Zira',
  'Karen',
  'Daniel',
  'Alex',
]

export interface Narrator {
  speak(text: string): void
  cancel(): void
  setEnabled(on: boolean): void
  enabled(): boolean
  dispose(): void
}

export function createNarrator(initiallyEnabled = true): Narrator {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  let on = initiallyEnabled
  let voice: SpeechSynthesisVoice | null = null

  const pickVoice = () => {
    const voices = synth?.getVoices() ?? []
    voice = null
    for (const name of PREFERRED) {
      const v = voices.find((v) => v.name === name || v.name.startsWith(name))
      if (v) {
        voice = v
        break
      }
    }
    if (!voice) {
      voice =
        voices.find((v) => v.lang?.startsWith('en') && v.localService) ??
        voices.find((v) => v.lang?.startsWith('en')) ??
        voices[0] ??
        null
    }
  }
  pickVoice()
  synth?.addEventListener?.('voiceschanged', pickVoice)

  const cancel = () => synth?.cancel()

  return {
    speak(text: string) {
      if (!synth || !on || !text) return
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      if (voice) u.voice = voice
      u.rate = 1.04
      u.pitch = 1.0
      u.volume = 1
      synth.speak(u)
    },
    cancel,
    setEnabled(v: boolean) {
      on = v
      if (!v) cancel()
    },
    enabled: () => on,
    dispose() {
      cancel()
      synth?.removeEventListener?.('voiceschanged', pickVoice)
    },
  }
}
