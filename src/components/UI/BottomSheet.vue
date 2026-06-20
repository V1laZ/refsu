<template>
  <Teleport to="body">
    <div
      v-if="mounted"
      v-bind="$attrs"
      :style="{ zIndex }"
      class="fixed inset-0"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ease-out"
        :class="shown ? 'opacity-100' : 'opacity-0'"
      />

      <!-- Sheet -->
      <div
        ref="sheetEl"
        class="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border-t border-slate-800 bg-slate-900 shadow-2xl transition-transform duration-300 ease-out"
        :style="sheetStyle"
        :inert="!shown || undefined"
        role="dialog"
        aria-modal="true"
        @transitionend="onTransitionEnd"
      >
        <!-- Grab handle -->
        <div
          class="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
          @pointerdown="onDragStart"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        >
          <span class="h-1.5 w-10 rounded-full bg-slate-600" />
        </div>

        <!-- Optional header -->
        <div
          v-if="title || $slots.header"
          class="shrink-0 border-b border-slate-800 px-4 pb-3"
        >
          <slot name="header">
            <h2 class="text-base font-semibold text-slate-100">
              {{ title }}
            </h2>
          </slot>
        </div>

        <!-- Body -->
        <div
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
          :style="bodyStyle"
        >
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useModalLayer } from '@/composables/useModalLayer'

defineOptions({ inheritAttrs: false })

const open = defineModel<boolean>({ default: false })

const { title = '', dismissible = true, autofocus = true } = defineProps<{
  title?: string
  dismissible?: boolean
  autofocus?: boolean
}>()

const sheetEl = useTemplateRef('sheetEl')
const mounted = ref(false)
const shown = ref(false)

const isDragging = ref(false)
const dragOffset = ref(0)
let startY = 0
let closeTimer: ReturnType<typeof setTimeout> | null = null

const { zIndex } = useModalLayer(open, close)

onClickOutside(sheetEl, () => close())

const sheetStyle = computed(() => ({
  maxHeight: 'calc(100dvh - env(safe-area-inset-top) - var(--title-bar-h) - 1rem)',
  paddingLeft: 'env(safe-area-inset-left)',
  paddingRight: 'env(safe-area-inset-right)',
  transform: isDragging.value
    ? `translateY(${dragOffset.value}px)`
    : shown.value ? 'translateY(0)' : 'translateY(100%)',
  transition: isDragging.value ? 'none' : undefined,
}))

const bodyStyle = computed(() => ({
  paddingBottom: 'env(safe-area-inset-bottom)',
}))

watch(open, (isOpen) => {
  if (isOpen) {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    isDragging.value = false
    dragOffset.value = 0
    mounted.value = true
    requestAnimationFrame(() => requestAnimationFrame(() => {
      shown.value = true
    }))
  }
  else {
    shown.value = false
    closeTimer = setTimeout(() => {
      if (!shown.value) mounted.value = false
    }, 350)
  }
}, { immediate: true })

watch(shown, (isShown) => {
  if (!isShown || !autofocus) return
  nextTick(() => {
    sheetEl.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  })
})

onBeforeUnmount(() => {
  if (closeTimer) clearTimeout(closeTimer)
})

function close() {
  if (!dismissible) return
  open.value = false
}

function onTransitionEnd(event: TransitionEvent) {
  if (event.target !== sheetEl.value || event.propertyName !== 'transform') return
  if (!shown.value) mounted.value = false
}

function onDragStart(event: PointerEvent) {
  if (!dismissible) return
  isDragging.value = true
  dragOffset.value = 0
  startY = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onDragMove(event: PointerEvent) {
  if (!isDragging.value) return
  dragOffset.value = Math.max(0, event.clientY - startY)
}

function onDragEnd() {
  if (!isDragging.value) return

  const sheetHeight = sheetEl.value?.offsetHeight ?? 0
  const threshold = Math.min(120, sheetHeight * 0.3)
  const shouldClose = dragOffset.value > threshold

  isDragging.value = false

  if (shouldClose) {
    shown.value = false
    open.value = false
    nextTick(() => {
      closeTimer = setTimeout(() => {
        if (!shown.value) mounted.value = false
      }, 350)
    })
  }
  else {
    dragOffset.value = 0
  }
}
</script>
