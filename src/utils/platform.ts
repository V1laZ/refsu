import { platform } from '@tauri-apps/plugin-os'

let android: boolean | undefined

/**
 * Whether the app is running on Android. Resolved on first call rather than at
 * import time, since `platform()` reads an object Tauri injects into the page.
 */
export function isAndroid() {
  android ??= platform() === 'android'
  return android
}
