<template>
  <div class="flex items-center gap-3 border-b border-pink-500/20 bg-pink-500/5 px-3 py-2.5">
    <Icon
      name="bell"
      size="sm"
      class="shrink-0 text-pink-300"
    />

    <div class="min-w-0 flex-1">
      <p class="truncate text-xs text-slate-400">
        <span class="font-medium text-slate-200">{{ prediction.username }}</span>
        called
        <span class="font-semibold text-pink-200">{{ prediction.category }}</span>
      </p>
      <p class="truncate text-sm text-slate-200">
        {{ prediction.beatmap.artist }} - {{ prediction.beatmap.title }}
        <span class="text-slate-400">[{{ prediction.beatmap.difficulty }}]</span>
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <Btn
        variant="success"
        size="sm"
        @click="emit('pick')"
      >
        Pick
      </Btn>
      <Btn
        variant="danger"
        size="sm"
        @click="emit('ban')"
      >
        Ban
      </Btn>
      <IconBtn
        icon="close"
        size="sm"
        title="Dismiss"
        @click="emit('dismiss')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from '@/components/UI/Icon.vue'
import Btn from '@/components/UI/Btn.vue'
import IconBtn from '@/components/UI/IconBtn.vue'
import type { PickPrediction } from '@/composables/usePickPrediction'

defineProps<{
  prediction: PickPrediction
}>()

const emit = defineEmits<{
  pick: []
  ban: []
  dismiss: []
}>()
</script>
