<template>
  <div
    class="group rounded-lg px-3 hover:bg-slate-800/50 py-0.5"
    :class="{
      'mt-2': !isContinuation,
    }"
  >
    <div class="flex items-start gap-3">
      <template v-if="!appearanceSettings.compactMode">
        <button
          v-if="!isContinuation"
          class="mt-0.5 shrink-0 rounded-full"
          :class="message.username !== 'BanchoBot' ? 'cursor-pointer' : 'cursor-default'"
          :disabled="message.username === 'BanchoBot'"
          @click="handleUsernameClick"
        >
          <Avatar
            :username="message.username"
            size="sm"
          />
        </button>

        <div
          v-else
          class="w-8 select-none"
        />
      </template>

      <div class="min-w-0 flex-1">
        <div
          v-if="!isContinuation"
          class="flex items-baseline gap-2"
        >
          <button
            class="font-semibold"
            :class="usernameClass"
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

        <template v-else>
          <p
            v-if="textSegments.length"
            class="wrap-break-word text-sm text-slate-200"
          >
            <template
              v-for="(segment, index) in textSegments"
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

          <template
            v-for="url in screenshotSegments"
            :key="url"
          >
            <a
              v-if="failedScreenshots.has(url)"
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-0.5 block text-sm text-pink-300 hover:text-pink-200 hover:underline"
            >{{ url }}</a>
            <button
              v-else
              class="mt-1 block cursor-pointer overflow-hidden rounded-lg ring-1 ring-inset ring-slate-700 transition-opacity hover:opacity-90"
              @click="openUrl(url)"
            >
              <img
                :src="url"
                alt="Screenshot"
                loading="lazy"
                class="block max-h-64 max-w-sm object-contain"
                @error="handleScreenshotError(url)"
              >
            </button>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IrcMessage } from '@/types'
import { computed, ref } from 'vue'
import { openUrl } from '@tauri-apps/plugin-opener'
import { globalState } from '@/stores/global'
import { parseNowPlaying, type NowPlaying } from '@/utils/nowPlaying'
import { appearanceSettings } from '@/stores/settings'
import Avatar from '@/components/UI/Avatar.vue'
import Icon from '@/components/UI/Icon.vue'
import Mod from '@/components/Mod.vue'

const props = withDefaults(defineProps<{
  message: IrcMessage
  isContinuation?: boolean
  team?: 'red' | 'blue' | null
}>(), {
  isContinuation: false,
  team: null,
})

const emit = defineEmits<{
  clickUsername: [username: string]
  clickBeatmap: [nowPlaying: NowPlaying]
}>()

const nowPlaying = computed(() => parseNowPlaying(props.message.message))

const usernameClass = computed(() => {
  let base = 'text-slate-100'
  let hover = 'hover:text-pink-200'

  if (appearanceSettings.teamColors && props.team) {
    base = props.team === 'red' ? 'text-rose-300' : 'text-sky-300'
    hover = props.team === 'red' ? 'hover:text-rose-200' : 'hover:text-sky-200'
  }

  if (props.message.username === 'BanchoBot') return base
  return `${base} ${hover} hover:underline cursor-pointer`
})

const formattedTime = computed(() => {
  return new Date(props.message.timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
})

type MessageSegment = { type: 'text' | 'link' | 'screenshot', value: string }

const SCREENSHOT_REGEX = /^https?:\/\/osu\.ppy\.sh\/ss\/\d+\/[\w-]+\/?$/

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
    segments.push({
      type: SCREENSHOT_REGEX.test(match[0]) ? 'screenshot' : 'link',
      value: match[0],
    })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return segments
})

// Text and links render inline in a paragraph; screenshots stack as blocks below.
const textSegments = computed(() => messageSegments.value.filter(s => s.type !== 'screenshot'))
const screenshotSegments = computed(() =>
  messageSegments.value.filter(s => s.type === 'screenshot').map(s => s.value),
)

const failedScreenshots = ref<Set<string>>(new Set())

const handleScreenshotError = (url: string) => {
  failedScreenshots.value = new Set(failedScreenshots.value).add(url)
}

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
