<template>
  <Drawer
    class="lg:min-w-64 lg:max-w-64 lg:w-64"
    side="left"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <header class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
      <h2 class="text-base font-semibold text-slate-100">
        Rooms
      </h2>
      <IconBtn
        icon="close"
        size="sm"
        class="lg:hidden"
        @click="emit('update:open', false)"
      />
    </header>

    <div class="flex flex-1 flex-col overflow-y-auto">
      <section class="px-3 py-4">
        <h3 class="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Chat
        </h3>
        <div
          v-if="chatRooms.length > 0"
          class="space-y-0.5"
        >
          <RoomItem
            v-for="room in chatRooms"
            :key="room.id"
            :room="room"
            :is-active="room.id === activeRoomId"
            @select="emit('selectRoom', room.id)"
            @leave="handleLeaveRoom(room)"
          />
        </div>

        <p
          v-else
          class="px-1 text-sm text-slate-500"
        >
          No open chats.
        </p>
      </section>

      <section class="mb-auto border-t border-slate-800 px-3 py-4">
        <h3 class="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Multiplayer
        </h3>
        <div
          v-if="mutiplayerLobbies.length > 0"
          class="mb-2 space-y-0.5"
        >
          <RoomItem
            v-for="room in mutiplayerLobbies"
            :key="room.id"
            :room="room"
            :is-active="room.id === activeRoomId"
            @select="emit('selectRoom', room.id)"
            @leave="handleLeaveRoom(room)"
          />
        </div>
        <Btn
          block
          @click="emit('openCreateLobby')"
        >
          <template #icon>
            <Icon
              name="plus"
              size="sm"
            />
          </template>
          Create lobby
        </Btn>
      </section>
    </div>

    <footer class="border-t border-slate-800 bg-slate-900 px-3 py-4">
      <h3 class="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        Join room
      </h3>
      <div class="flex gap-2">
        <Input
          v-model="newRoomName"
          placeholder="#channel or username"
          @keyup.enter="handleJoinOrMessage"
        />
        <IconBtn
          icon="plus"
          variant="accent"
          :disabled="!newRoomName.trim()"
          title="Join"
          @click="handleJoinOrMessage"
        />
      </div>
    </footer>
  </Drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import RoomItem from './RoomItem.vue'
import Drawer from '@/components/UI/Drawer.vue'
import Btn from '@/components/UI/Btn.vue'
import IconBtn from '@/components/UI/IconBtn.vue'
import Icon from '@/components/UI/Icon.vue'
import Input from '@/components/UI/Input.vue'
import { confirm } from '@/composables/useConfirm'
import type { RoomListItem } from '@/types'

const props = defineProps<{
  open: boolean
  rooms: RoomListItem[]
  activeRoomId?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'selectRoom': [roomId: string]
  'joinChannel': [channel: string]
  'leaveRoom': [roomId: string]
  'startPrivateMessage': [username: string]
  'openCreateLobby': []
}>()

const newRoomName = ref('')

const mutiplayerLobbies = computed(() => {
  return props.rooms.filter(room => room.roomType === 'MultiplayerLobby')
})

const chatRooms = computed(() => {
  return props.rooms.filter(room => room.roomType !== 'MultiplayerLobby')
})

const handleJoinOrMessage = () => {
  const input = newRoomName.value.trim()

  if (!input) {
    alert('Please enter a channel name or username')
    return
  }

  if (input.startsWith('#')) {
    if (input.length > 49) {
      alert('Channel name is too long (max 49 characters)')
      return
    }

    if (input.includes(' ')) {
      alert('Channel names cannot contain spaces')
      return
    }

    emit('joinChannel', input)
  }
  else {
    if (input.length > 50) {
      alert('Username is too long (max 50 characters)')
      return
    }

    if (input.includes(' ')) {
      alert('Usernames cannot contain spaces')
      return
    }

    emit('startPrivateMessage', input)
  }

  newRoomName.value = ''
}

const handleLeaveRoom = async (room: RoomListItem) => {
  const isLobby = room.roomType === 'MultiplayerLobby'
  const isChannel = room.roomType === 'Channel'

  const title = isLobby
    ? `Leave ${room.displayName}?`
    : isChannel
      ? `Leave ${room.displayName}?`
      : `Close conversation with ${room.displayName}?`

  const message = isLobby || isChannel
    ? 'You will stop receiving messages from this room.'
    : 'You can re-open this conversation later by messaging the user again.'

  const ok = await confirm({
    title,
    message,
    confirmText: isLobby || isChannel ? 'Leave' : 'Close',
    tone: 'danger',
  })

  if (ok) emit('leaveRoom', room.id)
}
</script>
