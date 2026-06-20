<template>
  <Teleport to="body">
    <div
      v-if="mounted"
      v-bind="$attrs"
      :style="containerStyle"
      class="fixed bottom-0 left-0 right-0"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ease-out"
        :class="shown ? 'opacity-100' : 'opacity-0'"
      />

      <!-- Panel -->
      <div
        ref="panelEl"
        class="absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-800 bg-slate-900 shadow-2xl transition-transform duration-300 ease-out"
        :class="widthClass"
        :style="panelStyle"
        :inert="!shown || undefined"
        role="dialog"
        aria-modal="true"
        @transitionend="onTransitionEnd"
      >
        <!-- Optional header -->
        <div
          v-if="title || $slots.header"
          class="shrink-0 border-b border-slate-800 px-4 py-3"
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

const { title = '', dismissible = true, width = 'md' } = defineProps<{
  title?: string
  dismissible?: boolean
  width?: 'sm' | 'md' | 'lg'
}>()

const panelEl = useTemplateRef('panelEl')

const mounted = ref(false)
const shown = ref(false)

let closeTimer: ReturnType<typeof setTimeout> | null = null

const { zIndex } = useModalLayer(open, close)

onClickOutside(panelEl, () => close())

const widthClass = computed(() => ({
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}[width]))

const containerStyle = computed(() => ({
  top: 'calc(env(safe-area-inset-top) + var(--title-bar-h))',
  zIndex: zIndex.value,
}))

const panelStyle = computed(() => ({
  paddingRight: 'env(safe-area-inset-right)',
  transform: shown.value ? 'translateX(0)' : 'translateX(100%)',
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
  if (!isShown) return
  nextTick(() => {
    panelEl.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
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
  if (event.target !== panelEl.value || event.propertyName !== 'transform') return
  if (!shown.value) mounted.value = false
}
</script>
