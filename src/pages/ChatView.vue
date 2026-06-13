<template>
  <div class="flex grow overflow-hidden bg-slate-950 text-slate-100">
    <!-- Left Drawer - Channels -->
    <RoomsDrawer
      :is-open="leftDrawerOpen"
      :rooms="roomsList"
      :active-room-id="activeRoom?.id"
      @close="leftDrawerOpen = false"
      @select-room="handleSelectRoom"
      @join-channel="joinChannel"
      @leave-room="leaveRoom"
      @open-create-lobby="createLobbyOpen = true"
      @start-private-message="startPrivateMessage"
    />

    <!-- Main Chat Area -->
    <div class="relative grow flex flex-col min-w-0">
      <SelectMap
        v-if="activeRoom && activeRoom.roomType === 'MultiplayerLobby'"
        :is-open="isOpenSelectMap"
        :lobby-state="activeRoom.lobbyState"
        :room-id="activeRoom.id"
        @close="isOpenSelectMap = false"
        @set-mappool="activeRoom.lobbyState.currentMappoolId = $event"
        @select-beatmap="selectMap"
      />

      <ChatHeader
        :active-channel="activeRoom"
        :has-unread="hasUnreadInOtherRooms"
        @toggle-left-drawer="leftDrawerOpen = !leftDrawerOpen"
        @toggle-right-drawer="rightDrawerOpen = !rightDrawerOpen"
        @open-settings="settingsOpen = true"
        @open-mappools="router.push('/mappools')"
        @refresh="refreshLobbyState"
      />

      <QuickActionBar
        v-if="activeRoom && activeRoom.roomType === 'MultiplayerLobby'"
        :key="activeRoom.id"
        :room="activeRoom"
        @open-select-map="isOpenSelectMap = true"
        @send-message="sendMessage"
      />

      <div
        v-if="!activeRoom"
        class="flex grow flex-col items-center justify-center px-6 text-center text-slate-500"
      >
        <Icon
          name="chat"
          size="xl"
          class="mb-3 text-slate-600"
        />
        <p class="text-sm">
          Select or join a channel to start chatting
        </p>
      </div>
      <ChatMessages
        v-else
        :messages="activeRoom.messages"
        :active-channel-id="activeRoom.id"
        :has-more-messages="activeRoom.hasMoreMessages"
        class="grow"
        @click-username="handleClickUsername"
        @load-more="loadMoreMessages"
      />

      <MessageInput
        :disabled="!globalState.isConnected || !activeRoom"
        @send-message="sendMessage"
      />
    </div>

    <PlayersDrawer
      v-if="activeRoom && activeRoom.roomType === 'MultiplayerLobby'"
      :is-open="rightDrawerOpen"
      :lobby-state="activeRoom.lobbyState"
      @move="sendMessage(`!mp move ${$event.playerName} ${$event.to}`)"
      @team-change="sendMessage(`!mp team ${$event.playerName} ${$event.team}`)"
      @host="($event) => {
        if ($event === null) {
          sendMessage('!mp clearhost')
        } else {
          sendMessage(`!mp host ${$event}`)
        }
      }"
      @close="rightDrawerOpen = false"
      @open-invite-player="invitePlayerOpen = true"
    />

    <SettingsModal
      v-model="settingsOpen"
      @logout="handleLogout"
    />

    <CreateLobbyModal
      v-if="createLobbyOpen"
      v-model="createLobbyOpen"
      @create-lobby="handleCreateLobby"
    />

    <InvitePlayerModal
      v-model="invitePlayerOpen"
      @invite="sendMessage(`!mp invite ${$event}`)"
    />

    <PlayerModal
      v-if="playerModalOpen && selectedPlayerUsername"
      v-model="playerModalOpen"
      :username="selectedPlayerUsername"
    />

    <!-- Mobile Overlay -->
    <div
      class="fixed inset-safe z-30 transition-colors lg:hidden"
      :class="leftDrawerOpen || rightDrawerOpen
        ? 'bg-slate-950/70 backdrop-blur-sm'
        : 'pointer-events-none'"
      @click="closeDrawers"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import RoomsDrawer from '@/components/Drawer/Rooms/Rooms.vue'
import PlayersDrawer from '@/components/Drawer/Players/Players.vue'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import QuickActionBar from '@/components/chat/QuickActionBar.vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import SettingsModal from '@/components/modals/SettingsModal.vue'
import CreateLobbyModal from '@/components/modals/CreateLobbyModal.vue'
import PlayerModal from '@/components/modals/PlayerModal.vue'
import { globalState } from '@/stores/global'
import SelectMap from '@/components/Drawer/SelectMap.vue'
import InvitePlayerModal from '@/components/modals/InvitePlayerModal.vue'
import Icon from '@/components/UI/Icon.vue'
import { useIrcRooms } from '@/composables/useIrcRooms'
import type { CreateLobbySettings, BeatmapEntry, UserJoinEvent } from '@/types'

const router = useRouter()

const { roomsMap, activeRoom, roomsList, selectRoom, loadMoreMessages } = useIrcRooms()

const hasUnreadInOtherRooms = computed(() =>
  roomsList.value.some(room => room.id !== activeRoom.value?.id && room.unreadCount > 0),
)

const isOpenSelectMap = ref(false)
const leftDrawerOpen = ref(false)
const rightDrawerOpen = ref(false)
const settingsOpen = ref(false)
const createLobbyOpen = ref(false)
const invitePlayerOpen = ref(false)
const playerModalOpen = ref(false)
const settingsForNewLobby = ref<CreateLobbySettings | null>(null)
const selectedPlayerUsername = ref<string | null>(null)

let unlistenUserJoin: UnlistenFn | null = null

onMounted(async () => {
  unlistenUserJoin = await listen<UserJoinEvent>('user-joined', async ({ payload: joinEvent }) => {
    if (joinEvent.username.toLowerCase() !== globalState.user?.toLowerCase()) return

    leftDrawerOpen.value = false

    if (!joinEvent.channel.startsWith('#mp_')) return

    if (settingsForNewLobby.value) {
      try {
        await invoke('send_message_to_room', {
          roomId: joinEvent.channel,
          message: `!mp set ${settingsForNewLobby.value.teamMode} ${settingsForNewLobby.value.scoreMode} 16`,
        })
        settingsForNewLobby.value = null
      }
      catch (error) {
        console.error('Failed to set lobby settings:', error)
      }
    }

    try {
      await invoke('send_message_to_room', {
        roomId: joinEvent.channel,
        message: '!mp settings',
      })
    }
    catch (error) {
      console.error('Failed to send !mp settings:', error)
    }
  })
})

onUnmounted(() => {
  if (unlistenUserJoin) unlistenUserJoin()
})

const handleSelectRoom = async (roomId: string) => {
  await selectRoom(roomId)
  leftDrawerOpen.value = false
}

const refreshLobbyState = async () => {
  if (!activeRoom.value || activeRoom.value.roomType !== 'MultiplayerLobby') {
    return
  }

  try {
    await invoke('send_message_to_room', {
      roomId: activeRoom.value.id,
      message: '!mp settings',
    })
  }
  catch (error) {
    console.error('Failed to refresh lobby state:', error)
  }
}

const parseMods = (modString: string) => {
  if (modString === 'None') return 'None'
  const mods = modString.match(/.{1,2}/g) || []

  if (mods.length === 0) return 'None'

  return mods.map((mod) => {
    if (mod === 'FM') return 'Freemod'
    return mod
  }).join(' ')
}

const selectMap = async (beatmap: BeatmapEntry) => {
  if (!activeRoom.value || activeRoom.value.roomType !== 'MultiplayerLobby') return
  isOpenSelectMap.value = false

  try {
    await invoke('send_message_to_room', {
      roomId: activeRoom.value.id,
      message: `!mp map ${beatmap.beatmap_id}`,
    })
  }
  catch (error) {
    console.error('Failed to select map:', error)
    alert('Failed to select map. Make sure you are connected and try again.')
  }

  const mods = parseMods(beatmap.mod_combination || 'None')
  try {
    await invoke('send_message_to_room', {
      roomId: activeRoom.value.id,
      message: `!mp mods ${mods}`,
    })
  }
  catch (error) {
    console.error('Failed to set mods:', error)
    alert('Failed to set mods. Make sure you are connected and try again.')
  }
}

const joinChannel = async (channelName: string) => {
  try {
    let channel = channelName.trim()

    if (!channel) {
      alert('Please enter a channel name')
      return
    }

    const mpId = parseInt(channel, 10)
    if (!isNaN(mpId)) {
      channel = `#mp_${mpId}`
    }

    if (!channel.startsWith('#')) {
      channel = '#' + channel
    }

    if (roomsMap.value.has(channel)) {
      alert(`Already in channel ${channel}`)
      return
    }

    await invoke('join_channel', { roomId: channel })
  }
  catch (error) {
    console.error('Failed to join channel:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    alert(`Failed to join channel: ${errorMessage}`)
  }
}

const startPrivateMessage = async (username: string) => {
  try {
    await invoke('start_private_message', { username })
    await selectRoom(username)
  }
  catch (error) {
    console.error('Failed to start private message:', error)
    alert('Failed to start private message')
  }
}

const sendMessage = async (messageText: string) => {
  if (!activeRoom.value || !messageText.trim()) {
    return
  }

  try {
    await invoke('send_message_to_room', {
      roomId: activeRoom.value.id,
      message: messageText,
    })
  }
  catch (error) {
    console.error('Failed to send message:', error)
  }
}

const closeDrawers = () => {
  leftDrawerOpen.value = false
  rightDrawerOpen.value = false
}

const handleLogout = async () => {
  globalState.isLoggingOut = true
  try {
    await invoke('disconnect_from_bancho')
    globalState.user = null
    globalState.isConnected = false
    router.replace('/login')
  }
  catch (error) {
    console.error('Failed to logout:', error)
    globalState.isLoggingOut = false
  }
}

const leaveRoom = async (roomId: string) => {
  try {
    const room = roomsMap.value.get(roomId)
    if (!room) return

    if (room.roomType === 'Channel' || room.roomType === 'MultiplayerLobby') {
      await invoke('leave_channel', { roomId })
    }
    else if (room.roomType === 'PrivateMessage') {
      await invoke('close_private_message', { username: roomId })
    }
  }
  catch (error) {
    console.error('Failed to leave room:', error)
  }
}

const handleCreateLobby = async (settings: CreateLobbySettings) => {
  try {
    await invoke('start_private_message', { username: 'BanchoBot' })

    await invoke('send_message_to_room', {
      roomId: 'BanchoBot',
      message: `!mp make ${settings.name}`,
    })

    settingsForNewLobby.value = settings
    createLobbyOpen.value = false
  }
  catch (error) {
    console.error('Failed to create lobby:', error)
    alert('Failed to create lobby. Make sure you are connected and try again.')
  }
}

const handleClickUsername = (username: string) => {
  selectedPlayerUsername.value = username
  playerModalOpen.value = true
}
</script>
