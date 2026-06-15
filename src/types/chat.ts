import type { LobbyState } from './lobby'

export type RoomType = 'Channel' | 'PrivateMessage' | 'MultiplayerLobby'

export type ConnectionStatus = {
  type: string
  message: string
}

export type RoomBase = {
  id: string
  displayName: string
  messages: IrcMessage[]
  unreadCount: number
  hasMoreMessages: boolean
}

export type MessagesPage = {
  messages: IrcMessage[]
  hasMore: boolean
}

export type MultiplayerRoom = RoomBase & {
  roomType: 'MultiplayerLobby'
  lobbyState: LobbyState
}

export type ChannelRoom = RoomBase & {
  roomType: 'Channel'
}

export type PrivateMessageRoom = RoomBase & {
  roomType: 'PrivateMessage'
}

export type RoomUnion = MultiplayerRoom | ChannelRoom | PrivateMessageRoom

export type RoomListItem = Omit<RoomUnion, 'messages' | 'lobbyState'> & {
  matchStatus: LobbyState['matchStatus'] | null
}

export type RoomsMap = Map<string, RoomListItem>

export type IrcMessage = {
  roomId: string
  username: string
  message: string
  timestamp: number
  isPrivate: boolean
}

export type RoomError = {
  channel: string
  error: string
}

export type UserJoinEvent = {
  username: string
  channel: string
}

export type ActiveRoomMessageEvent = {
  roomId: string
  message: IrcMessage
}

export type InactiveRoomUnreadUpdateEvent = {
  roomId: string
  unreadCount: number
}

export type ActiveRoomLobbyStateUpdateEvent = {
  lobbyState: LobbyState
}

export type RoomsListUpdatedEvent = {
  rooms: RoomListItem[]
  activeRoomId: string | null
}

export type RoomMatchStatusUpdateEvent = {
  roomId: string
  matchStatus: LobbyState['matchStatus']
}

export type SoundNotificationType = 'mention' | 'matchStart' | 'matchFinish' | 'allReady'

export type SoundNotificationEvent = {
  type: SoundNotificationType
  roomId: string
}
