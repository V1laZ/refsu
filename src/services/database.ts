import Database from '@tauri-apps/plugin-sql'
import { fetch } from '@tauri-apps/plugin-http'
import { UserCredentials, Mappool, BeatmapEntry } from '@/types'

class DatabaseService {
  private db: Database | null = null

  async init(): Promise<void> {
    try {
      this.db = await Database.load('sqlite:refsu_database.db')

      console.log('Database initialized successfully')
    }
    catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  }

  async saveCredentials(username: string, password: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const now = new Date().toISOString()

    await this.db.execute(
      `INSERT INTO user_credentials (username, password, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET
         password = excluded.password,
         updated_at = excluded.updated_at`,
      [username, password, now, now],
    )
  }

  async getCredentials(): Promise<UserCredentials | null> {
    if (!this.db) throw new Error('Database not initialized')

    const result = await this.db.select<UserCredentials[]>(
      `SELECT id, username, password, created_at, updated_at
       FROM user_credentials
       LIMIT 1`,
    )

    return result.length > 0 ? result[0] : null
  }

  async getOsuConnectedStatus(username: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized')

    const [result] = await this.db.select<{ id: number, expires_at: string, refresh_token: string }[]>(
      `SELECT id, expires_at, refresh_token FROM oauth_tokens WHERE irc_username = ? LIMIT 1`,
      [username],
    )

    if (!result) return false

    const isExpired = new Date(result.expires_at) <= new Date()
    if (!isExpired) return true

    return (await this.refreshToken(username, result.refresh_token)) !== null
  }

  async deleteCredentials(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.execute('DELETE FROM user_credentials')
  }

  async createMappool(name: string, description?: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    const now = new Date().toISOString()

    const result = await this.db.execute(
      `INSERT INTO mappools (name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [name, description || null, now, now],
    )

    return result.lastInsertId || 0
  }

  async getMappools(): Promise<Mappool[]> {
    if (!this.db) throw new Error('Database not initialized')

    return await this.db.select<Mappool[]>(
      `SELECT id, name, description, created_at, updated_at
       FROM mappools
       ORDER BY updated_at DESC`,
    )
  }

  async updateMappool(id: number, name: string, description?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const now = new Date().toISOString()

    await this.db.execute(
      `UPDATE mappools SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
      [name, description || null, now, id],
    )
  }

  async deleteMappool(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.execute('DELETE FROM mappools WHERE id = ?', [id])
  }

  async addBeatmapToPool(
    mappoolId: number,
    beatmapId: number,
    artist: string,
    title: string,
    difficulty: string,
    mapper: string,
    modCombination?: string,
    category?: string,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const now = new Date().toISOString()

    await this.db.execute(
      `INSERT INTO beatmap_entries
       (mappool_id, beatmap_id, artist, title, difficulty, mapper, mod_combination, category, created_at, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
         (SELECT COALESCE(MAX(position), -1) + 1 FROM beatmap_entries WHERE mappool_id = ?))`,
      [mappoolId, beatmapId, artist, title, difficulty, mapper, modCombination || null, category || null, now, mappoolId],
    )
  }

  async importMappool(
    name: string,
    entries: { beatmapId: number, artist: string, title: string, difficulty: string, mapper: string, mods?: string, category?: string }[],
  ): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    const mappoolId = await this.createMappool(name)

    for (const entry of entries) {
      await this.addBeatmapToPool(
        mappoolId,
        entry.beatmapId,
        entry.artist,
        entry.title,
        entry.difficulty,
        entry.mapper,
        entry.mods || undefined,
        entry.category || undefined,
      )
    }

    return mappoolId
  }

  async getMappoolBeatmaps(mappoolId: number): Promise<BeatmapEntry[]> {
    if (!this.db) throw new Error('Database not initialized')

    return await this.db.select<BeatmapEntry[]>(
      `SELECT id, mappool_id, beatmap_id, artist, title, difficulty, mapper, mod_combination, category, created_at, position
       FROM beatmap_entries
       WHERE mappool_id = ?
       ORDER BY position ASC, created_at ASC, id ASC`,
      [mappoolId],
    )
  }

  async updateBeatmapInPool(id: number, category?: string, modCombination?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.execute(
      `UPDATE beatmap_entries SET category = ?, mod_combination = ? WHERE id = ?`,
      [category || null, modCombination || null, id],
    )
  }

  async reorderBeatmaps(orderedIds: number[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    for (let i = 0; i < orderedIds.length; i++) {
      await this.db.execute(
        'UPDATE beatmap_entries SET position = ? WHERE id = ?',
        [i, orderedIds[i]],
      )
    }
  }

  async deleteBeatmapFromPool(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.execute('DELETE FROM beatmap_entries WHERE id = ?', [id])
  }

  async getAccessToken(username: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized')

    const [result] = await this.db.select<{ id: number, expires_at: string, refresh_token: string, access_token: string }[]>(
      `SELECT id, access_token, expires_at, refresh_token FROM oauth_tokens WHERE irc_username = ? LIMIT 1`,
      [username],
    )

    if (!result) return null

    const isExpired = new Date(result.expires_at) <= new Date()
    if (!isExpired) return result.access_token

    return this.refreshToken(username, result.refresh_token)
  }

  private async refreshToken(username: string, oldRefreshToken: string): Promise<string | null> {
    const res = await fetch(
      'https://refsu.vilaz.dev/refresh-token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: oldRefreshToken }),
      },
    )

    if (!res.ok) {
      await this.db!.execute('DELETE FROM oauth_tokens WHERE irc_username = ?', [username])
      console.error('Failed to refresh token:', res.status, res.statusText)
      return null
    }

    const resJson = await res.json()
    try {
      await this.saveOAuthToken(username, resJson.access_token, resJson.refresh_token, resJson.expires_in)
      return resJson.access_token
    }
    catch (error) {
      await this.db!.execute('DELETE FROM oauth_tokens WHERE irc_username = ?', [username])
      console.error('Failed to save refreshed token:', error)
      return null
    }
  }

  async saveOAuthToken(
    username: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString()

    await this.db.execute(
      `INSERT INTO oauth_tokens (irc_username, access_token, refresh_token, expires_in, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(irc_username) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_in = excluded.expires_in,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      [username, accessToken, refreshToken, expiresIn, expiresAt, now.toISOString(), now.toISOString()],
    )
  }

  async deleteOauthToken(username: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.execute('DELETE FROM oauth_tokens WHERE irc_username = ?', [username])
  }

  async getMentionKeywords(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized')

    const rows = await this.db.select<{ word: string }[]>(
      `SELECT word FROM mention_keywords ORDER BY created_at ASC, id ASC`,
    )

    return rows.map(row => row.word)
  }

  async addMentionKeyword(word: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.execute(
      `INSERT INTO mention_keywords (word, created_at) VALUES (?, ?)
       ON CONFLICT(word) DO NOTHING`,
      [word, new Date().toISOString()],
    )
  }

  async deleteMentionKeyword(word: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.execute('DELETE FROM mention_keywords WHERE word = ?', [word])
  }

  async getSetting(key: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized')

    const rows = await this.db.select<{ value: string }[]>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    )

    return rows.length ? rows[0].value : null
  }

  async setSetting(key: string, value: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    await this.db.execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    )
  }
}

export const dbService = new DatabaseService()
