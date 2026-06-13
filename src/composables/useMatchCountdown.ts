import { computed, watch, type Ref } from 'vue'
import { useCountdown } from '@vueuse/core'
import { invoke } from '@tauri-apps/api/core'
import { dbService } from '@/services/database'
import { globalState } from '@/stores/global'
import type { LobbyState, BeatmapData } from '@/types'

function getModSpeedMultiplier(mods: string[]): number {
  if (mods.includes('DT') || mods.includes('NC')) return 1 / 1.5
  if (mods.includes('HT')) return 1 / 0.75
  return 1
}

export function useMatchCountdown(lobbyState: Readonly<Ref<LobbyState>>, roomId: Readonly<Ref<string>>) {
  const { remaining, start, stop, isActive } = useCountdown(0)

  watch(
    () => lobbyState.value.currentMap?.beatmapId,
    async (beatmapId, oldBeatmapId) => {
      if (!beatmapId || !globalState.isConnectedOsu) return
      if (oldBeatmapId === undefined && lobbyState.value.mapDrainTime != null) return

      try {
        const accessToken = await dbService.getAccessToken(globalState.user ?? '')
        if (!accessToken) return

        const data = await invoke<BeatmapData>('fetch_beatmap_data', {
          beatmapId: String(beatmapId),
          accessToken,
        })
        await invoke('set_map_drain_time', {
          roomId: roomId.value,
          drainTime: data.total_length,
        })
      }
      catch (err) {
        console.error('Failed to update map drain time:', err)
      }
    },
    { immediate: true },
  )

  watch(
    () => lobbyState.value.matchStatus,
    (status) => {
      if (status === 'active') {
        const { matchStartTime, mapDrainTime, selectedMods } = lobbyState.value
        if (matchStartTime == null || mapDrainTime == null) return

        const adjustedDrain = Math.round(mapDrainTime * getModSpeedMultiplier(selectedMods))
        const elapsed = Math.floor(Date.now() / 1000 - matchStartTime)
        const remaining = Math.max(0, adjustedDrain + 5 - elapsed)
        start(remaining)
      }
      else {
        stop()
      }
    },
    { immediate: true },
  )

  const formattedTime = computed(() => {
    if (!isActive.value) return null
    const m = Math.floor(remaining.value / 60)
    const s = remaining.value % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  })

  return { formattedTime, isActive }
}
