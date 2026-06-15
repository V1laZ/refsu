<template>
  <div
    :data-slot-index="index"
    :data-slot-occupied="slotInfo.player ? 'true' : 'false'"
    :class="[
      'flex items-center rounded-lg px-3 py-2 ring-1 ring-inset transition-colors',
      slotClasses,
      highlight ? 'ring-pink-400/60' : '',
    ]"
  >
    <div class="flex min-w-0 flex-1 items-center justify-between">
      <div
        v-if="slotInfo.player"
        class="flex min-w-0 flex-1 cursor-grab items-center gap-2 select-none"
        @pointerdown="drag.startDrag($event, slotInfo.player?.username || 'Unknown')"
      >
        <button
          class="shrink-0 cursor-pointer transition-colors"
          :class="slotInfo.player.isHost ? 'text-amber-300 hover:text-amber-200' : 'text-slate-500 hover:text-slate-300'"
          :title="slotInfo.player.isHost ? 'Clear host' : 'Make host'"
          @click="emit('host', slotInfo.player.isHost ? null : slotInfo.player.username)"
        >
          <Icon
            :name="slotInfo.player.isHost ? 'crown' : 'crownOutline'"
            size="md"
          />
        </button>
        <span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
          {{ slotInfo.player.username }}
        </span>
      </div>

      <div
        v-else
        class="min-w-0 flex-1 text-sm italic text-slate-500"
      >
        Empty
      </div>

      <button
        v-if="slotInfo.player && slotInfo.player.team"
        class="ml-2 size-4 shrink-0 cursor-pointer rounded ring-2 ring-inset"
        :class="teamColor"
        :title="`Team ${slotInfo.player.team}`"
        @click.stop="emit('teamChange', {
          playerName: slotInfo.player.username,
          team: slotInfo.player.team === 'red' ? 'blue' : 'red'
        })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { playerDragKey } from './usePlayerDrag'
import Icon from '@/components/UI/Icon.vue'
import type { PlayerSlot, PlayerTeamChangeEvent } from '@/types'

const { slotInfo, index } = defineProps<{
  slotInfo: PlayerSlot
  index: number
}>()
const emit = defineEmits<{
  teamChange: [event: PlayerTeamChangeEvent]
  host: [host: string | null]
}>()

const drag = inject(playerDragKey)!

const highlight = computed(() => !slotInfo.player && drag.overIndex.value === index)

const slotClasses = computed(() => {
  if (slotInfo.player) {
    if (slotInfo.player.isReady) {
      return 'bg-emerald-500/10 ring-emerald-400/30'
    }
    if (slotInfo.player.isPlaying) {
      return 'bg-sky-500/10 ring-sky-400/30'
    }
    return 'bg-slate-800/80 ring-slate-700'
  }
  return 'bg-slate-800/40 ring-slate-800'
})

const teamColor = computed(() => {
  if (!slotInfo.player) return 'bg-slate-600 ring-slate-500'
  return slotInfo.player.team === 'red'
    ? 'bg-rose-400 ring-rose-300/50'
    : 'bg-sky-400 ring-sky-300/50'
})
</script>
