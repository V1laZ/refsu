export type NowPlayingVerb = 'playing' | 'listening to' | 'watching'

export type NowPlaying = {
  verb: NowPlayingVerb
  url: string
  beatmapId: string
  title: string
  mods: string[]
}

const MOD_SHORT: Record<string, string> = {
  Hidden: 'HD',
  HardRock: 'HR',
  DoubleTime: 'DT',
  Nightcore: 'NC',
  Easy: 'EZ',
  HalfTime: 'HT',
  Flashlight: 'FL',
  NoFail: 'NF',
  SuddenDeath: 'SD',
  Perfect: 'PF',
  Relax: 'RX',
  Autopilot: 'AP',
  SpunOut: 'SO',
  ScoreV2: 'V2',
}

const NP_REGEX = /^ACTION is (playing|listening to|watching) \[(https?:\/\/[^\s]+) (.+)\](.*)$/

const BEATMAP_ID_REGEX = /(?:\/b\/|\/beatmaps\/|#\w*\/)(\d+)/

const MOD_TOKEN_REGEX = /[+-]\w+/g

function parseMods(trailer: string): string[] {
  const tokens = trailer.replace(/<[^>]*>/g, ' ').match(MOD_TOKEN_REGEX)
  if (!tokens) return []

  return tokens
    .map(t => t.replace(/^[+-]/, ''))
    .filter(Boolean)
    .map(m => MOD_SHORT[m] ?? m)
}

export function parseNowPlaying(raw: string): NowPlaying | null {
  const text = raw.split('\u0001').join('').trim()
  const match = text.match(NP_REGEX)
  if (!match) return null

  const [, verb, url, title, trailer] = match

  const idMatch = url.match(BEATMAP_ID_REGEX)
  if (!idMatch) return null

  return {
    verb: verb as NowPlayingVerb,
    url,
    beatmapId: idMatch[1],
    title,
    mods: parseMods(trailer),
  }
}
