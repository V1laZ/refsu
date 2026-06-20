import { reactive } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { dbService } from '@/services/database'

export const mentionKeywords = reactive<{ words: string[], loaded: boolean }>({
  words: [],
  loaded: false,
})

async function syncToBackend() {
  try {
    await invoke('set_mention_keywords', { keywords: [...mentionKeywords.words] })
  }
  catch (error) {
    console.error('Failed to sync mention keywords to backend:', error)
  }
}

export async function loadMentionKeywords() {
  try {
    mentionKeywords.words = await dbService.getMentionKeywords()
    mentionKeywords.loaded = true
    await syncToBackend()
  }
  catch (error) {
    console.error('Failed to load mention keywords:', error)
  }
}

export async function addMentionKeyword(raw: string): Promise<boolean> {
  const word = raw.trim()
  if (!word) return false
  if (mentionKeywords.words.some(w => w.toLowerCase() === word.toLowerCase())) return false

  try {
    await dbService.addMentionKeyword(word)
    mentionKeywords.words.push(word)
    await syncToBackend()
    return true
  }
  catch (error) {
    console.error('Failed to add mention keyword:', error)
    return false
  }
}

export async function removeMentionKeyword(word: string) {
  try {
    await dbService.deleteMentionKeyword(word)
    mentionKeywords.words = mentionKeywords.words.filter(w => w !== word)
    await syncToBackend()
  }
  catch (error) {
    console.error('Failed to remove mention keyword:', error)
  }
}
