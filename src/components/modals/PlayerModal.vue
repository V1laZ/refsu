<template>
  <Modal
    v-model="modelValue"
    size="sm"
    body-padding="none"
    title="Player Info"
  >
    <div
      v-if="loading"
      class="p-8"
    >
      <Loading text="Loading player info" />
    </div>

    <template v-else>
      <div class="border-b border-slate-800 px-5 py-5">
        <div class="flex items-center gap-4">
          <div class="size-16 shrink-0 overflow-hidden rounded-full ring-2 ring-inset ring-pink-400/30">
            <img
              v-if="player?.avatar_url"
              :src="player.avatar_url"
              :alt="username"
              class="size-full object-cover"
            >
            <div
              v-else
              class="flex size-full items-center justify-center bg-pink-500/20 text-pink-200"
            >
              <span class="text-2xl font-bold">{{ username.charAt(0).toUpperCase() }}</span>
            </div>
          </div>

          <div class="min-w-0">
            <h2 class="truncate text-lg font-semibold text-slate-100">
              {{ player?.username ?? username }}
            </h2>
            <div
              v-if="player"
              class="mt-0.5 flex items-center gap-1.5"
            >
              <span class="leading-none">{{ flagEmoji(player.country) }}</span>
              <span class="text-sm text-slate-400">{{ player.country }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="error"
        class="px-5 py-4 text-center text-sm text-slate-400"
      >
        {{ error }}
      </div>

      <div
        v-if="player"
        class="grid grid-cols-2 gap-3 p-5"
      >
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
import type { UserData } from '@/types'
import Modal from '@/components/UI/Modal.vue'
import Btn from '@/components/UI/Btn.vue'
import Icon from '@/components/UI/Icon.vue'
import Loading from '@/components/UI/Loading.vue'

const props = defineProps<{
  username: string
}>()

const modelValue = defineModel<boolean>({ default: false })

const loading = ref(true)
const player = ref<UserData | null>(null)
const error = ref<string | null>(null)

const stats = computed(() => {
  if (!player.value) return []
  const p = player.value
  return [
    { label: 'Global rank', value: p.rank != null ? `#${p.rank.toLocaleString()}` : '—' },
    { label: 'Country rank', value: p.country_rank != null ? `#${p.country_rank.toLocaleString()}` : '—' },
    { label: 'Performance', value: `${Math.round(p.pp).toLocaleString()}pp` },
    { label: 'Accuracy', value: `${p.accuracy.toFixed(2)}%` },
  ]
})

const flagEmoji = (code: string) =>
  code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('')

const openInBrowser = () =>
  openUrl(`https://osu.ppy.sh/users/${encodeURIComponent(props.username)}`)

onMounted(async () => {
  try {
    const accessToken = await dbService.getAccessToken(globalState.user ?? '')
    if (!accessToken) {
      error.value = 'Connect your osu! account in Settings to view player info.'
      return
    }

    player.value = await invoke<UserData>('fetch_user_data', {
      username: props.username,
      accessToken,
    })
  }
  catch (err) {
    error.value = 'Could not load player info.'
    console.error('Failed to fetch player data:', err)
  }
  finally {
    loading.value = false
  }
})
</script>
