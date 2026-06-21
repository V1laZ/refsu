import { reactive } from 'vue'

const STORAGE_KEY = 'mapBans'

type BansByRoom = Record<string, number[]>

function load(): BansByRoom {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  }
  catch {
    return {}
  }
}

const bansByRoom = reactive<BansByRoom>(load())

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bansByRoom))
  }
  catch (error) {
    console.error('Failed to persist map bans:', error)
  }
}

export function getBannedIds(roomId: string): number[] {
  return bansByRoom[roomId] ?? []
}

export function isBanned(roomId: string, beatmapEntryId: number): boolean {
  return getBannedIds(roomId).includes(beatmapEntryId)
}

export function banMap(roomId: string, beatmapEntryId: number): void {
  const current = bansByRoom[roomId] ?? []
  if (current.includes(beatmapEntryId)) return
  bansByRoom[roomId] = [...current, beatmapEntryId]
  persist()
}

export function toggleBan(roomId: string, beatmapEntryId: number): void {
  const current = bansByRoom[roomId] ?? []
  bansByRoom[roomId] = current.includes(beatmapEntryId)
    ? current.filter(id => id !== beatmapEntryId)
    : [...current, beatmapEntryId]
  persist()
}

export function clearBans(roomId: string): void {
  if (!bansByRoom[roomId]?.length) return
  bansByRoom[roomId] = []
  persist()
}
