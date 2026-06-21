import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { dbService } from '@/services/database'
import { pickPredictionSettings } from '@/stores/settings'
import { isBanned } from '@/stores/mapBans'
import type { ActiveRoomMessageEvent, BeatmapEntry, IrcMessage, RoomUnion } from '@/types'
import { globalState } from '@/stores/global'

export type PickPrediction = {
  beatmap: BeatmapEntry
  category: string
  username: string
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildTokens(message: string): Set<string> {
  const words = message.split(/\s+/).map(normalize).filter(Boolean)
  const tokens = new Set(words)

  for (let i = 0; i < words.length - 1; i++) {
    if (/^[a-z]+$/.test(words[i]) && /^[0-9]+$/.test(words[i + 1])) {
      tokens.add(words[i] + words[i + 1])
    }
  }

  return tokens
}

const AUTO_DISMISS_MS = 10000

export function usePickPrediction(activeRoom: Ref<RoomUnion | null>) {
  const prediction = ref<PickPrediction | null>(null)
  let beatmaps: BeatmapEntry[] = []
  let unlisten: UnlistenFn | null = null
  let dismissTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (dismissTimer !== null) {
      clearTimeout(dismissTimer)
      dismissTimer = null
    }
  }

  const dismiss = () => {
    prediction.value = null
  }

  watch(prediction, (value) => {
    clearTimer()
    if (value) dismissTimer = setTimeout(dismiss, AUTO_DISMISS_MS)
  })

  const loadBeatmaps = async (mappoolId: number | null | undefined) => {
    if (!mappoolId) {
      beatmaps = []
      return
    }
    try {
      beatmaps = await dbService.getMappoolBeatmaps(mappoolId)
    }
    catch (error) {
      beatmaps = []
      console.error('Failed to load mappool for pick prediction:', error)
    }
  }

  watch(
    () => (activeRoom.value?.roomType === 'MultiplayerLobby' ? activeRoom.value.lobbyState.currentMappoolId : null),
    (mappoolId) => {
      prediction.value = null
      loadBeatmaps(mappoolId)
    },
    { immediate: true },
  )

  watch(() => activeRoom.value?.id, dismiss)

  const handleMessage = (event: ActiveRoomMessageEvent) => {
    if (!pickPredictionSettings.enabled) return

    const room = activeRoom.value
    if (!room || room.roomType !== 'MultiplayerLobby') return
    if (event.roomId !== room.id || !beatmaps.length) return

    const message: IrcMessage = event.message
    const sender = message.username.toLowerCase()
    if (sender === 'banchobot') return
    if (globalState.user && sender === globalState.user.toLowerCase()) return

    const tokens = buildTokens(message.message)
    if (!tokens.size) return

    const match = beatmaps.find(beatmap => beatmap.category && tokens.has(normalize(beatmap.category)))
    if (!match || isBanned(room.id, match.id)) return

    prediction.value = {
      beatmap: match,
      category: match.category ?? '',
      username: message.username,
    }
  }

  onMounted(async () => {
    unlisten = await listen<ActiveRoomMessageEvent>('active-room-message', ({ payload }) => {
      handleMessage(payload)
    })
  })

  onUnmounted(() => {
    unlisten?.()
    clearTimer()
  })

  return { prediction, dismiss }
}
