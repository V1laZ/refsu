<template>
  <div class="flex h-8 flex-shrink-0 select-none items-center border-b border-slate-800 bg-slate-950">
    <div
      data-tauri-drag-region
      class="flex h-full flex-1 items-center gap-2 px-3"
    >
      <span class="text-xs font-medium text-slate-400">Refsu</span>
    </div>

    <div class="flex h-full">
      <button
        class="flex h-full w-10 items-center justify-center text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-100"
        @click="minimize"
      >
        <svg
          width="10"
          height="1"
          viewBox="0 0 10 1"
          fill="currentColor"
        >
          <rect
            width="10"
            height="1"
          />
        </svg>
      </button>

      <button
        class="flex h-full w-10 items-center justify-center text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-100"
        @click="toggleMaximize"
      >
        <svg
          v-if="isMaximized"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        >
          <path d="M2.5 0.5 H9.5 V7.5" />
          <rect
            x="0.5"
            y="2.5"
            width="7"
            height="7"
          />
        </svg>
        <svg
          v-else
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        >
          <rect
            x="0.5"
            y="0.5"
            width="9"
            height="9"
          />
        </svg>
      </button>

      <button
        class="flex h-full w-10 items-center justify-center text-slate-500 transition-colors hover:bg-rose-500 hover:text-white"
        @click="close"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
        >
          <line
            x1="0.5"
            y1="0.5"
            x2="9.5"
            y2="9.5"
          />
          <line
            x1="9.5"
            y1="0.5"
            x2="0.5"
            y2="9.5"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()
const isMaximized = ref(false)
let unlistenResize: (() => void) | null = null

async function minimize() {
  await appWindow.minimize()
}

async function toggleMaximize() {
  await appWindow.toggleMaximize()
}

async function close() {
  await appWindow.close()
}

onMounted(async () => {
  isMaximized.value = await appWindow.isMaximized()
  unlistenResize = await appWindow.onResized(async () => {
    isMaximized.value = await appWindow.isMaximized()
  })
})

onUnmounted(() => {
  if (unlistenResize) unlistenResize()
})
</script>
