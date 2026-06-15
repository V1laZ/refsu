export type Player = {
  username: string
  team: 'red' | 'blue' | null
  isReady: boolean
  isPlaying: boolean
  isHost: boolean
}

export type PlayerMoveEvent = {
  playerName: string
  to: number
}

export type PlayerTeamChangeEvent = {
  playerName: string
  team: 'red' | 'blue'
}

export type PlayerSlot = {
  id: number
  player: Player | null
}

export type CurrentMap = {
  beatmapId: number
  title: string
  difficulty: string
  artist: string
}

export type LobbySettings = {
  roomName: string
  teamMode: 'HeadToHead' | 'TagCoop' | 'TeamVs' | 'TagTeamVs'
  winCondition: 'Score' | 'Accuracy' | 'Combo' | 'ScoreV2'
  size: number
  password?: string
}

export type LobbyState = {
  settings: LobbySettings | null
  currentMap: CurrentMap | null
  slots: PlayerSlot[]
  matchStatus: 'idle' | 'ready' | 'starting' | 'active'
  host: string | null
  freemod: boolean
  selectedMods: string[]
  currentMappoolId: number | null
  matchStartTime: number | null
  mapDrainTime: number | null
  timerStartTime: number | null
  timerDuration: number | null
  defaultTimerSeconds: number
  defaultStartSeconds: number
}

export type CreateLobbySettings = {
  name: string
  teamMode: '0' | '1' | '2' | '3'
  scoreMode: '0' | '1' | '2' | '3'
}
