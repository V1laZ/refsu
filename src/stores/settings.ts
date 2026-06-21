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

const SOUND_KEY = 'sound'
const NOTIFICATION_KEY = 'notification'

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

export const soundSettings = reactive<SoundSettings>(structuredClone(soundDefaults))
export const notificationSettings = reactive<NotificationSettings>(structuredClone(notificationDefaults))

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
