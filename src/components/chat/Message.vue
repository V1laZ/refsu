<template>
  <div class="group rounded-lg px-3 py-1.5 transition-colors hover:bg-slate-800/50">
    <div class="flex items-start gap-3">
      <button
        class="mt-0.5 flex-shrink-0 rounded-full"
        :class="message.username !== 'BanchoBot' ? 'cursor-pointer' : 'cursor-default'"
        :disabled="message.username === 'BanchoBot'"
        @click="handleUsernameClick"
      >
        <Avatar
          :username="message.username"
          size="sm"
        />
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <button
            class="font-semibold text-slate-100"
            :class="message.username !== 'BanchoBot' ? 'hover:text-pink-200 hover:underline cursor-pointer' : ''"
            @click="handleUsernameClick"
          >
            {{ message.username }}
          </button>

          <span class="text-xs text-slate-500">
            {{ formattedTime }}
          </span>
        </div>

        <button
          v-if="nowPlaying"
          class="mt-1 cursor-pointer flex w-full max-w-md items-center gap-2.5 rounded-lg border border-pink-400/20 bg-pink-500/5 px-3 py-2 text-left transition-colors hover:border-pink-400/40 hover:bg-pink-500/10"
          @click="handleNowPlayingClick"
        >
          <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-pink-500/15 text-pink-200">
            <Icon
              name="musicCollection"
              size="sm"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-xs text-slate-400">is {{ nowPlaying.verb }}</span>
            <span class="block truncate text-sm font-medium text-pink-100">{{ nowPlaying.title }}</span>
          </span>
          <span
            v-if="nowPlaying.mods.length"
            class="flex shrink-0 flex-wrap justify-end gap-1"
          >
            <Mod
              v-for="mod in nowPlaying.mods"
              :key="mod"
              :mod="mod"
            />
          </span>
        </button>

        <p
          v-else
          class="mt-0.5 wrap-break-word text-sm text-slate-200"
        >
          <template
            v-for="(segment, index) in messageSegments"
            :key="index"
          >
            <a
              v-if="segment.type === 'link'"
              :href="segment.value"
              target="_blank"
              rel="noopener noreferrer"
              class="text-pink-300 hover:text-pink-200 hover:underline"
            >{{ segment.value }}</a>
            <template v-else>
              {{ segment.value }}
            </template>
          </template>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IrcMessage } from '@/types'
import { computed } from 'vue'
import { openUrl } from '@tauri-apps/plugin-opener'
import { globalState } from '@/stores/global'
import { parseNowPlaying, type NowPlaying } from '@/utils/nowPlaying'
import Avatar from '@/components/UI/Avatar.vue'
import Icon from '@/components/UI/Icon.vue'
import Mod from '@/components/Mod.vue'

const props = defineProps<{
  message: IrcMessage
}>()

const emit = defineEmits<{
  clickUsername: [username: string]
  clickBeatmap: [nowPlaying: NowPlaying]
}>()

const nowPlaying = computed(() => parseNowPlaying(props.message.message))

const formattedTime = computed(() => {
  return new Date(props.message.timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
})

type MessageSegment = { type: 'text' | 'link', value: string }

const messageSegments = computed<MessageSegment[]>(() => {
  const text = props.message.message
  const segments: MessageSegment[] = []
  const urlRegex = /(https?:\/\/[^\s]+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'link', value: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return segments
})

const handleUsernameClick = () => {
  if (props.message.username === 'BanchoBot') return
  if (!globalState.isConnectedOsu) {
    openUrl(`https://osu.ppy.sh/users/${encodeURIComponent(props.message.username)}`)
    return
  }
  emit('clickUsername', props.message.username)
}

const handleNowPlayingClick = () => {
  if (!nowPlaying.value) return
  if (!globalState.isConnectedOsu) {
    openUrl(nowPlaying.value.url)
    return
  }
  emit('clickBeatmap', nowPlaying.value)
}
</script>
