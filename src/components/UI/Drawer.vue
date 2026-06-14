<template>
  <!-- Backdrop (mobile only) -->
  <div
    v-show="backdropVisible"
    class="fixed inset-safe z-30 bg-slate-950 backdrop-blur-sm lg:hidden"
    :class="dragging ? '' : 'transition-opacity duration-300 ease-in-out'"
    :style="{ opacity: backdropOpacity }"
    @click="isOpen = false"
  />

  <aside
    ref="panel"
    class="fixed bottom-safe top-safe z-40 flex w-80 max-w-[85%] transform flex-col bg-slate-900 lg:relative lg:top-auto lg:max-w-none lg:translate-x-0"
    :class="[
      side === 'left' ? 'left-safe border-r border-slate-800' : 'right-safe border-l border-slate-800',
      dragging ? '' : 'transition-transform duration-300 ease-in-out',
    ]"
    :style="panelStyle"
  >
    <slot />
  </aside>
</template>

<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  side?: 'left' | 'right'
}>(), {
  side: 'left',
})

const isOpen = defineModel<boolean>('open', { default: false })

const isDesktop = useMediaQuery('(min-width: 1024px)')

const EDGE_SIZE = 24
const SLOP = 8
const VELOCITY_THRESHOLD = 0.4
const BACKDROP_MAX = 0.7

const panel = ref<HTMLElement | null>(null)
const dragging = ref(false)
const dragOffset = ref<number | null>(null)

let pending = false
let activated = false
let mode: 'open' | 'close' | null = null
let startX = 0
let startY = 0
let startOffset = 0
let lastX = 0
let lastTime = 0
let velocity = 0
let panelWidth = 0

// +1 when sliding the panel toward open advances along +x (left drawer), -1 otherwise.
const openingSign = computed(() => (props.side === 'left' ? 1 : -1))

const closedOffset = () => (props.side === 'left' ? -panelWidth : panelWidth)

const progress = computed(() => {
  if (dragging.value && dragOffset.value !== null && panelWidth > 0) {
    const closed = closedOffset()
    return (dragOffset.value - closed) / (0 - closed)
  }
  return isOpen.value ? 1 : 0
})

const panelStyle = computed(() => {
  if (isDesktop.value) return {}

  if (dragging.value && dragOffset.value !== null) {
    return { transform: `translateX(${dragOffset.value}px)` }
  }

  return {
    transform: isOpen.value
      ? 'translateX(0)'
      : `translateX(${props.side === 'left' ? '-100%' : '100%'})`,
  }
})

const backdropVisible = computed(() => !isDesktop.value && (isOpen.value || dragging.value))
const backdropOpacity = computed(() => (isDesktop.value ? 0 : progress.value * BACKDROP_MAX))

const onTouchStart = (e: TouchEvent) => {
  if (isDesktop.value || e.touches.length !== 1) return

  pending = false
  activated = false
  mode = null

  const t = e.touches[0]

  if (isOpen.value) {
    // Drag-to-close only when the gesture begins on the panel itself.
    if (panel.value?.contains(t.target as Node)) {
      mode = 'close'
    }
  }
  else {
    // Edge-swipe-to-open from the matching screen edge.
    const w = window.innerWidth
    if (props.side === 'left' && t.clientX <= EDGE_SIZE) {
      mode = 'open'
    }
    else if (props.side === 'right' && t.clientX >= w - EDGE_SIZE) {
      mode = 'open'
    }
  }

  if (!mode) return

  pending = true
  startX = t.clientX
  startY = t.clientY
  lastX = startX
  lastTime = e.timeStamp
  velocity = 0
  panelWidth = panel.value?.offsetWidth || 320
  startOffset = isOpen.value ? 0 : closedOffset()
}

const onTouchMove = (e: TouchEvent) => {
  if (!pending) return

  const t = e.touches[0]
  const dx = t.clientX - startX
  const dy = t.clientY - startY

  if (!activated) {
    if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
    // A predominantly vertical move is a scroll — let it through.
    if (Math.abs(dy) > Math.abs(dx)) {
      pending = false
      return
    }
    activated = true
    dragging.value = true
  }

  const dt = e.timeStamp - lastTime
  if (dt > 0) {
    velocity = (t.clientX - lastX) / dt
  }

  lastX = t.clientX
  lastTime = e.timeStamp

  let offset = startOffset + dx
  if (props.side === 'left') {
    offset = Math.min(0, Math.max(closedOffset(), offset))
  }
  else {
    offset = Math.max(0, Math.min(closedOffset(), offset))
  }

  dragOffset.value = offset

  e.preventDefault()
}

const onTouchEnd = () => {
  if (!pending) return

  const wasDragging = activated
  pending = false
  activated = false
  mode = null

  if (!wasDragging) {
    dragging.value = false
    dragOffset.value = null
    return
  }

  const dirVelocity = velocity * openingSign.value
  let shouldOpen: boolean
  if (dirVelocity > VELOCITY_THRESHOLD) {
    shouldOpen = true
  }
  else if (dirVelocity < -VELOCITY_THRESHOLD) {
    shouldOpen = false
  }
  else {
    shouldOpen = progress.value > 0.5
  }

  dragging.value = false
  dragOffset.value = null
  if (shouldOpen !== isOpen.value) {
    isOpen.value = shouldOpen
  }
}

useEventListener(window, 'touchstart', onTouchStart, { passive: true })
useEventListener(window, 'touchmove', onTouchMove, { passive: false })
useEventListener(window, 'touchend', onTouchEnd)
useEventListener(window, 'touchcancel', onTouchEnd)
</script>
