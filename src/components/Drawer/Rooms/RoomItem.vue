<template>
  <div class="group relative">
    <div
      :class="[
        'flex items-center rounded-lg transition-colors',
        isActive
          ? 'bg-pink-500/15 text-pink-100 ring-1 ring-inset ring-pink-400/30'
          : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100',
      ]"
    >
      <button
        class="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left"
        @click="emit('select', room.id)"
      >
        <Icon
          v-if="room.roomType !== 'MultiplayerLobby'"
          :name="iconName"
          size="sm"
          :class="isActive ? 'text-pink-300' : 'text-slate-400'"
        />
        <StatusDot
          v-if="room.roomType === 'MultiplayerLobby'"
          :tone="statusTone"
        />
        <span class="min-w-0 flex-1 truncate text-sm font-medium">
          {{ room.displayName }}
        </span>
        <span
          v-if="room.unreadCount > 0 && !isActive"
          class="ml-auto shrink-0 rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-semibold text-pink-200 ring-1 ring-inset ring-pink-400/30"
        >
          {{ room.unreadCount > 99 ? '99+' : room.unreadCount }}
        </span>
      </button>

      <button
        class="mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md opacity-100 transition-colors md:opacity-0 group-hover:opacity-100"
        :class="isActive
          ? 'text-pink-200 hover:bg-pink-500/15'
          : 'text-slate-500 hover:bg-slate-700 hover:text-slate-100'"
        title="Leave room"
        @click.stop="emit('leave', room)"
      >
        <Icon
          name="close"
          size="sm"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/UI/Icon.vue'
import StatusDot from '@/components/UI/StatusDot.vue'
import type { RoomListItem } from '@/types'
import type { IconName } from '@/components/UI/icons'

const props = defineProps<{
  room: RoomListItem
  isActive: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  leave: [room: RoomListItem]
}>()

const iconName = computed<IconName>(() => {
  if (props.room.roomType === 'Channel') return 'channel'
  return 'user'
})

const statusTone = computed(() => {
  switch (props.room.matchStatus) {
    case 'active':
    case 'starting':
      return 'warning' as const
    case 'ready':
      return 'success' as const
    default:
      return 'neutral' as const
  }
})
</script>
