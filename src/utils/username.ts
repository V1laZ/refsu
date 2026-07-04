export function toIrcUsername(username: string): string {
  return username.trim().replace(/ /g, '_')
}
