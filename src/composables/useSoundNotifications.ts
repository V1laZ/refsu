import { onMounted, onUnmounted } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { soundService } from '@/services/sound'
import { soundSettings } from '@/stores/settings'
import type { SoundNotificationEvent } from '@/types'

export function useSoundNotifications() {
  let unlisten: UnlistenFn | null = null

  onMounted(async () => {
    unlisten = await listen<SoundNotificationEvent>('sound-notification', ({ payload }) => {
      if (!soundSettings.events[payload.type]) return
      soundService.play(payload.type)
    })
  })

  onUnmounted(() => {
    unlisten?.()
  })
}
