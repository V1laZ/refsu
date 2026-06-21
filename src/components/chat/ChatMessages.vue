<template>
  <div
    ref="messagesContainer"
    class="flex-1 overflow-y-auto bg-slate-950 px-2 py-3"
  >
    <div
      v-if="messages.length === 0"
      class="flex h-32 flex-col items-center justify-center text-slate-500"
    >
      <Icon
        name="chat"
        size="xl"
        class="mb-2 text-slate-600"
      />
      <p class="text-sm">
        No messages yet
      </p>
      <p class="mt-1 text-xs text-slate-600">
        Start chatting or wait for messages to appear
      </p>
    </div>

    <div v-else>
      <Message
        v-for="(item, index) in clusteredMessages"
        :key="`${item.message.timestamp}${index}`"
        :message="item.message"
        :is-continuation="item.isContinuation"
        :team="playerTeams[item.message.username] ?? null"
        @click-username="emit('clickUsername', $event)"
        @click-beatmap="emit('clickBeatmap', $event)"
      />
    </div>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <button
        v-if="!isAtBottom && messages.length > 0"
        class="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] -translate-x-full z-10 inline-flex items-center gap-2 rounded-full bg-pink-500/15 px-3 py-2 text-xs font-medium text-pink-200 shadow-lg ring-1 ring-inset ring-pink-400/30 transition-colors hover:bg-pink-500/25 hover:text-pink-100"
        :style="{ left: `${right - 22}px` }"
        @click="scrollToBottom"
      >
        <Icon
          name="arrowDown"
          class="shrink-0"
          size="xs"
        />
        <span class="hidden whitespace-nowrap sm:block">New messages</span>
      </button>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUpdated, nextTick, onUnmounted, watch, useTemplateRef } from 'vue'
import Message from './Message.vue'
import Icon from '@/components/UI/Icon.vue'
import type { IrcMessage } from '@/types'
import type { NowPlaying } from '@/utils/nowPlaying'
import { useElementBounding } from '@vueuse/core'

const props = withDefaults(defineProps<{
  messages: IrcMessage[]
  activeChannelId: string
  hasMoreMessages: boolean
  playerTeams?: Record<string, 'red' | 'blue'>
}>(), {
  playerTeams: () => ({}),
})

const emit = defineEmits<{
  clickUsername: [username: string]
  clickBeatmap: [nowPlaying: NowPlaying]
  loadMore: []
}>()

const CLUSTER_WINDOW_SECONDS = 60

const clusteredMessages = computed(() =>
  props.messages.map((message, index) => {
    const prev = props.messages[index - 1]
    const isContinuation
      = !!prev
        && prev.username === message.username
        && message.timestamp - prev.timestamp <= CLUSTER_WINDOW_SECONDS
    return { message, isContinuation }
  }),
)

const messagesContainer = useTemplateRef('messagesContainer')
const isAtBottom = ref(true)

const { right } = useElementBounding(messagesContainer)

let savedScrollHeight = 0

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const checkIfAtBottom = () => {
  if (messagesContainer.value) {
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
    isAtBottom.value = scrollTop + clientHeight >= scrollHeight - 5

    if (scrollTop < 50 && props.hasMoreMessages) {
      emit('loadMore')
    }
  }
}

onMounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', checkIfAtBottom)
    scrollToBottom()
    checkIfAtBottom()
  }
})

onUpdated(() => {
  nextTick(() => {
    if (!messagesContainer.value) return
    const newScrollHeight = messagesContainer.value.scrollHeight

    if (savedScrollHeight > 0 && newScrollHeight > savedScrollHeight) {
      messagesContainer.value.scrollTop += newScrollHeight - savedScrollHeight
      savedScrollHeight = 0
    }
    else if (isAtBottom.value) {
      scrollToBottom()
    }
  })
})

watch(() => props.activeChannelId, () => {
  savedScrollHeight = 0
  scrollToBottom()
  checkIfAtBottom()
}, { flush: 'post', immediate: true })

watch(() => props.messages, (newMessages, oldMessages) => {
  if (newMessages !== oldMessages && messagesContainer.value) {
    savedScrollHeight = messagesContainer.value.scrollHeight
  }
}, { flush: 'sync' })

onUnmounted(() => {
  if (messagesContainer.value) {
    messagesContainer.value.removeEventListener('scroll', checkIfAtBottom)
  }
})
</script>
