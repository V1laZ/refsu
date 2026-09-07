import { onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { downloadDir, join } from '@tauri-apps/api/path'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import type { IrcMessage, RoomUnion } from '@/types'

const pad = (value: number) => value.toString().padStart(2, '0')

const formatTimestamp = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
  + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`

const formatFileStamp = (date: Date) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`

// Room ids carry `#` and PM room ids are usernames, neither of which is safe
// everywhere a file name goes.
const toFileNameSlug = (roomId: string) =>
  roomId.replace(/^#/, '').replace(/[^\w.-]+/g, '_')

function buildChatLog(room: RoomUnion, messages: IrcMessage[], exportedAt: Date) {
  const lines = [
    `# Refsu chat log`,
    `# Room: ${room.id}`,
  ]

  if (room.roomType === 'MultiplayerLobby' && room.lobbyState.settings?.roomName) {
    lines.push(`# Name: ${room.lobbyState.settings.roomName}`)
    lines.push(`# History: https://osu.ppy.sh/mp/${room.id.replace('#mp_', '')}`)
  }

  lines.push(`# Exported: ${formatTimestamp(exportedAt)}`, '')

  for (const message of messages) {
    lines.push(
      `[${formatTimestamp(new Date(message.timestamp * 1000))}] <${message.username}> ${message.message}`,
    )
  }

  return `${lines.join('\n')}\n`
}

/**
 * Suggests a file name, inside the downloads folder where one is resolvable.
 * On Android only the file name survives — the document picker chooses where
 * the file lands — so a failure to resolve the directory isn't worth reporting.
 */
async function defaultLogPath(room: RoomUnion, now: Date) {
  const fileName = `refsu-${toFileNameSlug(room.id)}-${formatFileStamp(now)}.txt`

  try {
    return await join(await downloadDir(), fileName)
  }
  catch {
    return fileName
  }
}

export function useChatLog() {
  const saving = ref(false)
  // Drives a short-lived confirmation on the save button; there is no toast
  // system to hand a "saved" message to.
  const justSaved = ref(false)
  let justSavedTimeout: ReturnType<typeof setTimeout> | undefined

  /**
   * Prompts for a location and writes the room's whole buffered chat log there.
   * Resolves to the chosen path, or `null` if the dialog was cancelled.
   */
  async function saveChatLog(room: RoomUnion): Promise<string | null> {
    if (saving.value) return null
    saving.value = true

    try {
      const messages = await invoke<IrcMessage[]>('get_room_log', { roomId: room.id })

      if (messages.length === 0) {
        alert('This room has no messages to save yet.')
        return null
      }

      const now = new Date()
      const path = await save({
        defaultPath: await defaultLogPath(room, now),
        filters: [{ name: 'Text file', extensions: ['txt'] }],
      })

      if (!path) return null

      await writeTextFile(path, buildChatLog(room, messages, now))

      justSaved.value = true
      clearTimeout(justSavedTimeout)
      justSavedTimeout = setTimeout(() => {
        justSaved.value = false
      }, 2000)

      return path
    }
    catch (error) {
      // Android's document picker rejects on cancel rather than resolving null,
      // which is not something to warn about.
      if (String(error).toLowerCase().includes('cancel')) return null

      console.error('Failed to save chat log:', error)
      alert('Failed to save the chat log. See the console for details.')
      return null
    }
    finally {
      saving.value = false
    }
  }

  onUnmounted(() => clearTimeout(justSavedTimeout))

  return { saving, justSaved, saveChatLog }
}
