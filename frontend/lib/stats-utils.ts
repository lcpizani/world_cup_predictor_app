export const STAGE_LABELS: Record<string, string> = {
  group_stage: 'Group',
  round_of_32: 'R32',
  round_of_16: 'R16',
  quarter_finals: 'QF',
  semi_finals: 'SF',
  third_place: '3rd',
  final: 'Final',
}

export function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`
}
