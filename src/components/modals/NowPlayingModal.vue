<template>
  <Modal
    v-model="modelValue"
    size="sm"
    body-padding="none"
    title="Beatmap"
  >
    <template #header>
      <div class="sr-only">
        Now playing
      </div>
    </template>

    <div
      v-if="loading"
      class="p-8"
    >
      <Loading text="Loading beatmap info" />
    </div>

    <template v-else>
      <div class="relative min-h-36 overflow-hidden bg-slate-800">
        <img
          v-if="coverUrl"
          :src="coverUrl"
          :alt="beatmap?.title ?? ''"
          class="absolute inset-0 size-full object-cover"
        >
        <div class="absolute inset-0 bg-slate-950/55" />
        <div class="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/40 to-transparent" />

        <div class="absolute inset-0 flex min-h-36 flex-col justify-end p-5">
          <template v-if="beatmap">
            <h2 class="text-base font-semibold text-white drop-shadow-md">
              {{ beatmap.artist }} - {{ beatmap.title }}
            </h2>
            <p class="mt-0.5 text-sm text-slate-200 drop-shadow">
              [{{ beatmap.difficulty }}] by {{ beatmap.mapper }}
            </p>

            <div
              v-if="nowPlaying.mods.length"
              class="mt-2.5 flex flex-wrap items-center gap-1.5"
            >
              <Mod
                v-for="mod in nowPlaying.mods"
                :key="mod"
                :mod="mod"
              />
            </div>
          </template>
        </div>
      </div>

      <div
        v-if="error"
        class="px-5 py-4 text-center text-sm text-slate-400"
      >
        {{ error }}
      </div>

      <template v-else-if="beatmap">
        <div class="grid grid-cols-2 gap-3 p-5">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="rounded-lg border border-slate-800 bg-slate-800/50 p-3"
          >
            <div class="text-xs text-slate-400">
              {{ stat.label }}
            </div>
            <div class="mt-0.5 font-semibold text-slate-100">
              {{ stat.value }}
            </div>
          </div>
        </div>
      </template>
    </template>

    <template
      v-if="!loading"
      #footer
    >
      <Btn
        variant="ghost"
        size="sm"
        @click="openInBrowser"
      >
        <template #icon>
          <Icon
            name="external"
            size="sm"
          />
        </template>
        Open in browser
      </Btn>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { dbService } from '@/services/database'
import { globalState } from '@/stores/global'
import type { BeatmapData } from '@/types'
import type { NowPlaying } from '@/utils/nowPlaying'
import Modal from '@/components/UI/Modal.vue'
import Btn from '@/components/UI/Btn.vue'
import Icon from '@/components/UI/Icon.vue'
import Mod from '@/components/Mod.vue'
import Loading from '@/components/UI/Loading.vue'

const props = defineProps<{
  nowPlaying: NowPlaying
}>()

const modelValue = defineModel<boolean>({ default: false })

const loading = ref(true)
const beatmap = ref<BeatmapData | null>(null)
const error = ref<string | null>(null)

const MODE_NAMES: Record<number, string> = {
  0: 'osu!',
  1: 'osu!taiko',
  2: 'osu!catch',
  3: 'osu!mania',
}

const coverUrl = computed(() =>
  beatmap.value
    ? `https://assets.ppy.sh/beatmaps/${beatmap.value.beatmapset_id}/covers/cover.jpg`
    : null,
)

const stats = computed(() => {
  if (!beatmap.value) return []
  const b = beatmap.value
  const minutes = Math.floor(b.total_length / 60)
  const seconds = String(b.total_length % 60).padStart(2, '0')
  return [
    { label: 'Star rating', value: `★ ${b.difficulty_rating.toFixed(2)}` },
    { label: 'Length', value: `${minutes}:${seconds}` },
    { label: 'BPM', value: `${Math.round(b.bpm)}` },
    { label: 'Mode', value: MODE_NAMES[b.mode] ?? '—' },
  ]
})

const openInBrowser = () => openUrl(props.nowPlaying.url)

onMounted(async () => {
  try {
    const accessToken = await dbService.getAccessToken(globalState.user ?? '')
    if (!accessToken) {
      error.value = 'Connect your osu! account in Settings to view beatmap info.'
      return
    }

    beatmap.value = await invoke<BeatmapData>('fetch_beatmap_data', {
      beatmapId: props.nowPlaying.beatmapId,
      accessToken,
    })
  }
  catch (err) {
    error.value = 'Could not load beatmap info.'
    console.error('Failed to fetch beatmap data:', err)
  }
  finally {
    loading.value = false
  }
})
</script>
