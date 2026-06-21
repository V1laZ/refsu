import { reactive, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { dbService } from '@/services/database'

export type SoundEvent = 'mention' | 'matchStart' | 'matchFinish' | 'allReady' | 'timerEnd'

export type SoundSettings = {
  enabled: boolean
  volume: number // 0..1
  events: Record<SoundEvent, boolean>
}

export type NotificationSettings = {
  enabled: boolean
}

export type PickPredictionSettings = {
  enabled: boolean
}

export type AppearanceSettings = {
  compactMode: boolean
  teamColors: boolean
}

const SOUND_KEY = 'sound'
const NOTIFICATION_KEY = 'notification'
const PICK_PREDICTION_KEY = 'pickPrediction'
const APPEARANCE_KEY = 'appearance'

const soundDefaults: SoundSettings = {
  enabled: true,
  volume: 0.6,
  events: {
    mention: true,
    matchStart: true,
    matchFinish: true,
    allReady: true,
    timerEnd: true,
  },
}

const notificationDefaults: NotificationSettings = {
  enabled: true,
}

const pickPredictionDefaults: PickPredictionSettings = {
  enabled: true,
}

const appearanceDefaults: AppearanceSettings = {
  compactMode: false,
  teamColors: true,
}

export const soundSettings = reactive<SoundSettings>(structuredClone(soundDefaults))
export const notificationSettings = reactive<NotificationSettings>(structuredClone(notificationDefaults))
export const pickPredictionSettings = reactive<PickPredictionSettings>(structuredClone(pickPredictionDefaults))
export const appearanceSettings = reactive<AppearanceSettings>(structuredClone(appearanceDefaults))

// Guards the persistence watchers so the initial DB load doesn't write straight
// back to the DB.
let loaded = false

function applySound(parsed: Partial<SoundSettings>) {
  soundSettings.enabled = parsed.enabled ?? soundDefaults.enabled
  soundSettings.volume = typeof parsed.volume === 'number'
    ? Math.min(1, Math.max(0, parsed.volume))
    : soundDefaults.volume
  soundSettings.events = { ...soundDefaults.events, ...parsed.events }
}

function applyNotification(parsed: Partial<NotificationSettings>) {
  notificationSettings.enabled = parsed.enabled ?? notificationDefaults.enabled
}

function applyPickPrediction(parsed: Partial<PickPredictionSettings>) {
  pickPredictionSettings.enabled = parsed.enabled ?? pickPredictionDefaults.enabled
}

function applyAppearance(parsed: Partial<AppearanceSettings>) {
  appearanceSettings.compactMode = parsed.compactMode ?? appearanceDefaults.compactMode
  appearanceSettings.teamColors = parsed.teamColors ?? appearanceDefaults.teamColors
}

async function readSetting<T>(key: string): Promise<Partial<T> | null> {
  const stored = await dbService.getSetting(key)
  if (!stored) return null
  try {
    return JSON.parse(stored) as Partial<T>
  }
  catch {
    return null
  }
}

export async function loadSettings() {
  try {
    const sound = await readSetting<SoundSettings>(SOUND_KEY)
    if (sound) applySound(sound)

    const notification = await readSetting<NotificationSettings>(NOTIFICATION_KEY)
    if (notification) applyNotification(notification)

    const pickPrediction = await readSetting<PickPredictionSettings>(PICK_PREDICTION_KEY)
    if (pickPrediction) applyPickPrediction(pickPrediction)

    const appearance = await readSetting<AppearanceSettings>(APPEARANCE_KEY)
    if (appearance) applyAppearance(appearance)
  }
  catch (error) {
    console.error('Failed to load settings:', error)
  }
  finally {
    loaded = true
  }

  await syncNotificationSettingsToBackend()
}

export async function syncNotificationSettingsToBackend() {
  try {
    await invoke('set_os_notifications_enabled', { enabled: notificationSettings.enabled })
  }
  catch (error) {
    console.error('Failed to sync notification settings to backend:', error)
  }
}

watch(
  soundSettings,
  (value) => {
    if (!loaded) return
    dbService.setSetting(SOUND_KEY, JSON.stringify(value))
      .catch(error => console.error('Failed to persist sound settings:', error))
  },
  { deep: true },
)

watch(
  () => notificationSettings.enabled,
  () => {
    if (!loaded) return
    dbService.setSetting(NOTIFICATION_KEY, JSON.stringify(notificationSettings))
      .catch(error => console.error('Failed to persist notification settings:', error))
    syncNotificationSettingsToBackend()
  },
)

watch(
  () => pickPredictionSettings.enabled,
  () => {
    if (!loaded) return
    dbService.setSetting(PICK_PREDICTION_KEY, JSON.stringify(pickPredictionSettings))
      .catch(error => console.error('Failed to persist pick prediction settings:', error))
  },
)

watch(
  appearanceSettings,
  () => {
    if (!loaded) return
    dbService.setSetting(APPEARANCE_KEY, JSON.stringify(appearanceSettings))
      .catch(error => console.error('Failed to persist appearance settings:', error))
  },
  { deep: true },
)
