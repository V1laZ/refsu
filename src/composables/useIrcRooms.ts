import { ref, computed, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type {
  RoomUnion,
  RoomsMap,
  ActiveRoomMessageEvent,
  InactiveRoomUnreadUpdateEvent,
  ActiveRoomLobbyStateUpdateEvent,
  RoomMatchStatusUpdateEvent,
  RoomsListUpdatedEvent,
  RoomError,
  MessagesPage,
} from '@/types'

const MESSAGE_PAGE_SIZE = 20

export function useIrcRooms() {
  const roomsMap = ref<RoomsMap>(new Map())
  const activeRoom = ref<RoomUnion | null>(null)
  const roomsList = computed(() => Array.from(roomsMap.value.values()))
  let loadingMore = false

  const unlisteners: UnlistenFn[] = []

  async function getRoomState(roomId: string): Promise<RoomUnion | null> {
    try {
      return await invoke<RoomUnion | null>('get_room_state', { roomId })
    }
    catch (error) {
      console.error('Failed to get room state:', error)
      return null
    }
  }

  async function handleRoomsListResponse(response: RoomsListUpdatedEvent) {
    roomsMap.value = new Map(response.rooms.map(room => [room.id, room]))

    if (!response.activeRoomId) {
      activeRoom.value = null
      return
    }

    if (activeRoom.value?.id === response.activeRoomId) {
      return
    }

    activeRoom.value = await getRoomState(response.activeRoomId)
  }

  async function loadRoomsList() {
    try {
      const response = await invoke<RoomsListUpdatedEvent>('get_rooms_list')
      await handleRoomsListResponse(response)
    }
    catch (error) {
      console.error('Failed to load rooms:', error)
    }
  }

  async function selectRoom(roomId: string) {
    if (activeRoom.value?.id === roomId) return

    try {
      const room = await invoke<RoomUnion>('set_active_room', { roomId })
      activeRoom.value = room
      const item = roomsMap.value.get(roomId)
      if (item) item.unreadCount = 0
    }
    catch (error) {
      console.error('Failed to select room:', error)
    }
  }

  async function loadMoreMessages() {
    if (!activeRoom.value || loadingMore || !activeRoom.value.hasMoreMessages) return

    loadingMore = true
    try {
      const offset = activeRoom.value.messages.length
      const result = await invoke<MessagesPage>('get_room_messages_page', {
        roomId: activeRoom.value.id,
        offset,
        limit: MESSAGE_PAGE_SIZE,
      })

      if (result.messages.length > 0 && activeRoom.value) {
        activeRoom.value.messages = [...result.messages, ...activeRoom.value.messages]
        activeRoom.value.hasMoreMessages = result.hasMore
      }
      else if (activeRoom.value) {
        activeRoom.value.hasMoreMessages = false
      }
    }
    catch (error) {
      console.error('Failed to load more messages:', error)
    }
    finally {
      loadingMore = false
    }
  }

  onMounted(async () => {
    await loadRoomsList()

    unlisteners.push(
      await listen<ActiveRoomMessageEvent>('active-room-message', ({ payload }) => {
        if (activeRoom.value) {
          activeRoom.value.messages.push(payload.message)
        }
      }),

      await listen<InactiveRoomUnreadUpdateEvent>('inactive-room-unread-updated', ({ payload }) => {
        const room = roomsMap.value.get(payload.roomId)
        if (room) room.unreadCount = payload.unreadCount
      }),

      await listen<ActiveRoomLobbyStateUpdateEvent>('active-room-lobby-state-updated', ({ payload }) => {
        if (activeRoom.value?.roomType === 'MultiplayerLobby') {
          activeRoom.value.lobbyState = payload.lobbyState
        }
      }),

      await listen<RoomMatchStatusUpdateEvent>('room-match-status-updated', ({ payload }) => {
        const room = roomsMap.value.get(payload.roomId)
        if (room) room.matchStatus = payload.matchStatus
      }),

      await listen<RoomsListUpdatedEvent>('rooms-list-updated', ({ payload }) => {
        handleRoomsListResponse(payload)
      }),

      await listen<RoomError>('room-error', ({ payload }) => {
        console.error('Room error:', payload)
        if (activeRoom.value?.id === payload.channel) {
          activeRoom.value = null
        }
        roomsMap.value.delete(payload.channel)
        alert(`Failed to join ${payload.channel}: ${payload.error}`)
      }),
    )
  })

  onUnmounted(() => {
    unlisteners.forEach(fn => fn())
  })

  return { roomsMap, activeRoom, roomsList, selectRoom, loadRoomsList, loadMoreMessages }
}
