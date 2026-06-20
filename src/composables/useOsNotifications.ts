import { onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification'
import type { UnlistenFn } from '@tauri-apps/api/event'

export function useOsNotifications() {
  let unlistenFocus: UnlistenFn | null = null

  async function setFocused(focused: boolean) {
    try {
      await invoke('set_app_focused', { focused })
    }
    catch (error) {
      console.error('Failed to update app focus state:', error)
    }
  }

  function onVisibilityChange() {
    setFocused(document.visibilityState === 'visible')
  }

  onMounted(async () => {
    try {
      if (!(await isPermissionGranted())) {
        await requestPermission()
      }
    }
    catch (error) {
      console.error('Failed to request notification permission:', error)
    }

    await setFocused(document.visibilityState === 'visible')

    try {
      unlistenFocus = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        setFocused(focused)
      })
    }
    catch (error) {
      console.error('Failed to listen for focus changes:', error)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    unlistenFocus?.()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
}
