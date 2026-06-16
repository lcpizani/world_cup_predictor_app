export function formatMinute(minute: number | null, injuryTime: number | null): string {
  if (minute == null) return ''
  if (injuryTime != null && injuryTime > 0) return `${minute}+${injuryTime}'`
  return `${minute}'`
}
