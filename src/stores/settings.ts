import { reactive, watch } from 'vue'

export type SoundEvent = 'mention' | 'matchStart' | 'matchFinish' | 'allReady'

export type SoundSettings = {
  enabled: boolean
  volume: number // 0..1
  events: Record<SoundEvent, boolean>
}

const STORAGE_KEY = 'refsu.soundSettings'

const defaults: SoundSettings = {
  enabled: true,
  volume: 0.6,
  events: {
    mention: true,
    matchStart: true,
    matchFinish: true,
    allReady: true,
  },
}

function load(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(defaults)
    const parsed = JSON.parse(raw) as Partial<SoundSettings>
    return {
      enabled: parsed.enabled ?? defaults.enabled,
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : defaults.volume,
      events: { ...defaults.events, ...parsed.events },
    }
  }
  catch {
    return structuredClone(defaults)
  }
}

export const soundSettings = reactive<SoundSettings>(load())

watch(
  soundSettings,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    }
    catch (error) {
      console.error('Failed to persist sound settings:', error)
    }
  },
  { deep: true },
)
