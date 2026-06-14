<template>
  <Drawer
    side="right"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <header class="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
      <div>
        <h2 class="text-base font-semibold text-slate-100">
          Player slots
        </h2>
        <div class="text-xs text-slate-400">
          <span>Ready </span>
          <span class="text-slate-200">{{ readyPlayers }}/{{ occupiedSlots }}</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <IconBtn
          icon="userPlus"
          size="sm"
          title="Invite player"
          @click="emit('openInvitePlayer')"
        />
        <IconBtn
          icon="close"
          size="sm"
          class="lg:hidden"
          @click="emit('update:open', false)"
        />
      </div>
    </header>

    <div class="flex min-h-0 flex-1 flex-col p-3">
      <div class="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        <PlayerSlot
          v-for="(slot, idx) in lobbyState.slots"
          :key="slot.id"
          :slot-info="slot"
          @player-move="emit('move', { playerName: $event, to: idx + 1 })"
          @team-change="emit('teamChange', $event)"
          @host="emit('host', $event)"
        />
      </div>
    </div>
  </Drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PlayerSlot from './PlayerSlot.vue'
import Drawer from '@/components/UI/Drawer.vue'
import IconBtn from '@/components/UI/IconBtn.vue'
import type { LobbyState, PlayerMoveEvent, PlayerTeamChangeEvent } from '@/types'

const props = defineProps<{
  open: boolean
  lobbyState: LobbyState
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'move': [move: PlayerMoveEvent]
  'teamChange': [event: PlayerTeamChangeEvent]
  'host': [host: string | null]
  'openInvitePlayer': []
}>()

const occupiedSlots = computed(() =>
  props.lobbyState.slots.filter(slot => slot.player !== null).length || 0,
)

const readyPlayers = computed(() =>
  props.lobbyState.slots.filter(slot => slot.player?.isReady).length || 0,
)
</script>
