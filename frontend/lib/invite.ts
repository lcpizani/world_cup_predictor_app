export function encodeInviteCode(code: string): string {
  return btoa(code).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function decodeInviteCode(encoded: string): string {
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(encoded.length + (4 - (encoded.length % 4)) % 4, '=')
  return atob(padded)
}
