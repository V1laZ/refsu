import { soundSettings } from '@/stores/settings'
import mentionUrl from '@/assets/sounds/mention.wav'
import matchStartUrl from '@/assets/sounds/match-start.wav'
import matchFinishUrl from '@/assets/sounds/match-finish.wav'
import allReadyUrl from '@/assets/sounds/all-ready.wav'
import timerEndUrl from '@/assets/sounds/timer-end.wav'

export type SoundName = 'mention' | 'matchStart' | 'matchFinish' | 'allReady' | 'timerEnd'

const SOUND_URLS: Record<SoundName, string> = {
  mention: mentionUrl,
  matchStart: matchStartUrl,
  matchFinish: matchFinishUrl,
  allReady: allReadyUrl,
  timerEnd: timerEndUrl,
}

// Minimum gap between two plays of the same sound
const THROTTLE_MS = 1000

class SoundService {
  private ctx: AudioContext | null = null
  private buffers = new Map<SoundName, AudioBuffer>()
  private lastPlayed = new Map<SoundName, number>()
  private initialized = false
  private unlockBound = false

  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    catch (error) {
      console.error('Web Audio not available, sounds disabled:', error)
      return
    }

    this.armUnlock()

    await Promise.all(
      (Object.keys(SOUND_URLS) as SoundName[]).map(async (name) => {
        try {
          const res = await fetch(SOUND_URLS[name])
          const data = await res.arrayBuffer()
          const buffer = await this.ctx!.decodeAudioData(data)
          this.buffers.set(name, buffer)
        }
        catch (error) {
          console.error(`Failed to load sound "${name}":`, error)
        }
      }),
    )
  }

  private armUnlock(): void {
    if (this.unlockBound) return
    this.unlockBound = true

    const resume = () => {
      this.ctx?.resume().catch(() => {})
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)
  }

  play(name: SoundName): void {
    if (!soundSettings.enabled) return
    if (!this.ctx) return

    const buffer = this.buffers.get(name)
    if (!buffer) return

    const now = this.ctx.currentTime * 1000
    const last = this.lastPlayed.get(name) ?? -Infinity
    if (now - last < THROTTLE_MS) return
    this.lastPlayed.set(name, now)

    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})

    const source = this.ctx.createBufferSource()
    source.buffer = buffer

    const gain = this.ctx.createGain()
    gain.gain.value = soundSettings.volume

    source.connect(gain)
    gain.connect(this.ctx.destination)
    source.start()
  }
}

export const soundService = new SoundService()
