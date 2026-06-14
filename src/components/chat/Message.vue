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

        <p class="mt-0.5 wrap-break-word text-sm text-slate-200">
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
import Avatar from '@/components/UI/Avatar.vue'

const props = defineProps<{
  message: IrcMessage
}>()

const emit = defineEmits<{
  clickUsername: [username: string]
}>()

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
</script>
