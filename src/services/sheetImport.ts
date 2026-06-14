import { fetch } from '@tauri-apps/plugin-http'
import type { ExtractedRound, ExtractedSheet } from '@/types'

const EXTRACT_URL = 'https://refsu.vilaz.dev/extract-mappool'

export async function extractMappoolFromSheet(url: string, accessToken: string): Promise<ExtractedSheet> {
  const res = await fetch(EXTRACT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ url }),
  })

  const data = await res.json().catch(() => null) as { rounds?: ExtractedRound[], sheetTitle?: string | null, error?: string } | null

  if (!res.ok) {
    throw new Error(data?.error || `Failed to read the sheet (${res.status})`)
  }

  return {
    sheetTitle: data?.sheetTitle ?? null,
    rounds: data?.rounds ?? [],
  }
}
