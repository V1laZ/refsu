<template>
  <div class="flex grow overflow-hidden bg-slate-950 text-slate-100">
    <!-- Left Drawer - Channels -->
    <RoomsDrawer
      v-model:open="leftDrawerOpen"
      :rooms="roomsList"
      :active-room-id="activeRoom?.id"
      @select-room="handleSelectRoom"
      @join-channel="joinChannel"
      @leave-room="leaveRoom"
      @open-create-lobby="createLobbyOpen = true"
      @start-private-message="startPrivateMessage"
    />

    <!-- Main Chat Area -->
    <div class="relative grow flex flex-col min-w-0">
      <div
        ref="headerWrapper"
        class="z-10"
      >
        <ChatHeader
          :active-channel="activeRoom"
          :has-unread="hasUnreadInOtherRooms"
          @toggle-left-drawer="leftDrawerOpen = !leftDrawerOpen"
          @toggle-right-drawer="rightDrawerOpen = !rightDrawerOpen"
          @open-settings="router.push('/settings')"
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
      </div>

      <Transition
        enter-active-class="transition duration-400 ease-out"
        enter-from-class="-translate-y-full opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-full opacity-0"
      >
        <PickPrediction
          v-if="pickPrediction"
          class="absolute w-full z-0 backdrop-blur-xl"
          :style="{ top: `${headerWrapperHeight}px` }"
          :prediction="pickPrediction"
          @pick="handlePredictionPick"
          @ban="handlePredictionBan"
          @dismiss="dismissPrediction"
        />
      </Transition>

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
        @click-beatmap="handleClickBeatmap"
        @load-more="loadMoreMessages"
      />

      <MessageInput
        :disabled="!globalState.isConnected || !activeRoom"
        @send-message="sendMessage"
      />

      <SelectMap
        v-if="activeRoom && activeRoom.roomType === 'MultiplayerLobby'"
        :key="activeRoom.id"
        :is-open="isOpenSelectMap"
        :lobby-state="activeRoom.lobbyState"
        :room-id="activeRoom.id"
        @close="isOpenSelectMap = false"
        @set-mappool="activeRoom.lobbyState.currentMappoolId = $event"
        @select-beatmap="selectMap"
      />
    </div>

    <PlayersDrawer
      v-if="activeRoom && activeRoom.roomType === 'MultiplayerLobby'"
      v-model:open="rightDrawerOpen"
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
      @open-invite-player="invitePlayerOpen = true"
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

    <NowPlayingModal
      v-if="nowPlayingModalOpen && selectedNowPlaying"
      v-model="nowPlayingModalOpen"
      :now-playing="selectedNowPlaying"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import RoomsDrawer from '@/components/Drawer/Rooms/Rooms.vue'
import PlayersDrawer from '@/components/Drawer/Players/Players.vue'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import QuickActionBar from '@/components/chat/QuickActionBar.vue'
import PickPrediction from '@/components/chat/PickPrediction.vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import CreateLobbyModal from '@/components/modals/CreateLobbyModal.vue'
import PlayerModal from '@/components/modals/PlayerModal.vue'
import NowPlayingModal from '@/components/modals/NowPlayingModal.vue'
import type { NowPlaying } from '@/utils/nowPlaying'
import { globalState } from '@/stores/global'
import SelectMap from '@/components/Drawer/SelectMap.vue'
import InvitePlayerModal from '@/components/modals/InvitePlayerModal.vue'
import Icon from '@/components/UI/Icon.vue'
import { useIrcRooms } from '@/composables/useIrcRooms'
import { usePickPrediction } from '@/composables/usePickPrediction'
import { banMap } from '@/stores/mapBans'
import type { CreateLobbySettings, BeatmapEntry, UserJoinEvent } from '@/types'
import { useElementSize } from '@vueuse/core'

const router = useRouter()

const headerWrapperRef = useTemplateRef('headerWrapper')

const { height: headerWrapperHeight } = useElementSize(headerWrapperRef)

const { roomsMap, activeRoom, roomsList, selectRoom, loadMoreMessages } = useIrcRooms()

const { prediction: pickPrediction, dismiss: dismissPrediction } = usePickPrediction(activeRoom)

const hasUnreadInOtherRooms = computed(() =>
  roomsList.value.some(room => room.id !== activeRoom.value?.id && room.hasUnread),
)

const isOpenSelectMap = ref(false)
const leftDrawerOpen = ref(false)
const rightDrawerOpen = ref(false)
const createLobbyOpen = ref(false)
const invitePlayerOpen = ref(false)
const playerModalOpen = ref(false)
const nowPlayingModalOpen = ref(false)
const settingsForNewLobby = ref<CreateLobbySettings | null>(null)
const selectedPlayerUsername = ref<string | null>(null)
const selectedNowPlaying = ref<NowPlaying | null>(null)

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

const handlePredictionPick = () => {
  if (!pickPrediction.value) return
  selectMap(pickPrediction.value.beatmap)
  dismissPrediction()
}

const handlePredictionBan = () => {
  if (!pickPrediction.value || !activeRoom.value) return
  banMap(activeRoom.value.id, pickPrediction.value.beatmap.id)
  dismissPrediction()
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

const handleClickBeatmap = (nowPlaying: NowPlaying) => {
  selectedNowPlaying.value = nowPlaying
  nowPlayingModalOpen.value = true
}
</script>
