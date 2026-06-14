import { ref, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { avatarCache } from '@/main'
import { dbService } from '@/services/database'
import { globalState } from '@/stores/global'
import { RateLimiter } from '@/utils/rateLimiter'

const inflightRequests = new Map<string, Promise<string>>()

const avatarLimiter = new RateLimiter({ maxRequests: 3, intervalMs: 1000 })

function loadAvatar(username: string): Promise<string> {
  const cached = avatarCache.get(username)
  if (cached !== undefined) return Promise.resolve(cached)

  const inflight = inflightRequests.get(username)
  if (inflight) return inflight

  const promise = (async () => {
    const accessToken = await dbService.getAccessToken(globalState.user ?? '')
    if (!accessToken) throw new Error('No access token')

    const cachedAfterToken = avatarCache.get(username)
    if (cachedAfterToken !== undefined) return cachedAfterToken

    const userData = await avatarLimiter.schedule(() =>
      invoke<{ avatar_url?: string }>('fetch_user_data', {
        username,
        accessToken,
      }),
    )

    const url = userData.avatar_url
    if (!url) throw new Error(`No avatar URL returned for ${username}`)

    avatarCache.set(username, url)
    return url
  })().finally(() => inflightRequests.delete(username))

  inflightRequests.set(username, promise)
  return promise
}

export function useUserAvatar(username: string) {
  const avatarUrl = ref<string | null>(null)
  let cancelled = false

  const fetchAvatar = async () => {
    if (!username || username === 'BanchoBot') return

    try {
      const url = await loadAvatar(username)
      if (!cancelled) avatarUrl.value = url
    }
    catch (err) {
      console.error(`Failed to load avatar for ${username}:`, err)
    }
  }

  onUnmounted(() => {
    cancelled = true
  })

  return { avatarUrl, fetchAvatar }
}
