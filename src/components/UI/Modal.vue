<template>
  <Teleport to="body">
    <Transition
      appear
      enter-active-class="transition-opacity duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        :style="{ zIndex }"
        class="fixed inset-safe flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />
        <Transition
          appear
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
        >
          <div
            class="relative w-full"
            :inert="!open || undefined"
          >
            <div
              ref="wrapperEl"
              :class="[
                'mx-auto flex w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl',
                sizeClass,
                wrapperClass,
              ]"
            >
              <div
                v-if="$slots.header || title"
                class="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4"
              >
                <div class="min-w-0">
                  <slot name="header">
                    <h2 class="text-lg font-semibold text-slate-100">
                      {{ title }}
                    </h2>
                    <p
                      v-if="subtitle"
                      class="mt-0.5 text-sm text-slate-400"
                    >
                      {{ subtitle }}
                    </p>
                  </slot>
                </div>
                <IconBtn
                  icon="close"
                  size="sm"
                  @click="open = false"
                />
              </div>

              <div
                :class="[
                  'min-h-0 flex-1',
                  scroll ? 'overflow-y-auto' : '',
                  bodyPaddingClass,
                ]"
              >
                <slot />
              </div>

              <div
                v-if="$slots.footer"
                class="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-3"
              >
                <slot name="footer" />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import IconBtn from './IconBtn.vue'
import { onClickOutside } from '@vueuse/core'
import { useModalLayer } from '@/composables/useModalLayer'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const {
  size = 'md',
  bodyPadding = 'md',
  scroll = false,
  wrapperClass = '',
} = defineProps<{
  title?: string
  subtitle?: string
  size?: Size
  bodyPadding?: 'none' | 'sm' | 'md' | 'lg'
  scroll?: boolean
  wrapperClass?: string
}>()

const open = defineModel<boolean>({ required: true })

const wrapperElRef = useTemplateRef('wrapperEl')

onClickOutside(wrapperElRef, () => {
  open.value = false
})

const sizeClass = computed(() => ({
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}[size]))

const bodyPaddingClass = computed(() => ({
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
}[bodyPadding]))

function close() {
  open.value = false
}

const { zIndex } = useModalLayer(open, close)
</script>
