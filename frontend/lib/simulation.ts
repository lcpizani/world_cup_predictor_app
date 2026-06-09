import type { Match, Prediction } from '@/types/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamStats {
  team: string
  group: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number  // goals for
  ga: number  // goals against
  gd: number  // goal difference
  pts: number
}

export interface SimulatedGroup {
  group: string        // e.g. "GROUP_A"
  letter: string       // e.g. "A"
  standings: TeamStats[] // ranked 1st–4th
}

export interface QualifiedTeam {
  team: string
  group: string        // e.g. "GROUP_A"
  letter: string       // e.g. "A"
  position: number     // 1, 2, or 3
  stats: TeamStats
}

export interface R32Matchup {
  matchKey: string     // e.g. "R32_M74"
  slotKey: string      // bracket slot id, e.g. "74"
  home: QualifiedTeam | null
  away: QualifiedTeam | null
}

// ── FIFA WC 2026 third-place slot assignment (Annex C, all 495 combinations) ───
// Source: wc2026_round_of_32.js — direct translation, no hand-transcription.
// Key: 8 qualifying group letters, sorted, comma-separated (e.g. "A,B,C,D,E,F,G,H")
// Value: [m74, m77, m79, m80, m81, m82, m85, m87]
//   m74=WinnerE, m77=WinnerI, m79=WinnerA, m80=WinnerL,
//   m81=WinnerD, m82=WinnerG, m85=WinnerB, m87=WinnerK

// prettier-ignore
const COMBINATIONS: ReadonlyMap<string, readonly [string,string,string,string,string,string,string,string]> = new Map([
  ["E,F,G,H,I,J,K,L",["F","G","E","K","I","H","J","L"]],
  ["D,F,G,H,I,J,K,L",["D","F","H","K","I","J","G","L"]],
  ["D,E,G,H,I,J,K,L",["D","G","E","K","I","H","J","L"]],
  ["D,E,F,H,I,J,K,L",["D","F","E","K","I","H","J","L"]],
  ["D,E,F,G,I,J,K,L",["D","F","E","K","I","J","G","L"]],
  ["D,E,F,G,H,J,K,L",["D","F","E","K","J","H","G","L"]],
  ["D,E,F,G,H,I,K,L",["D","F","E","K","I","H","G","L"]],
  ["D,E,F,G,H,I,J,L",["D","F","E","I","J","H","G","L"]],
  ["D,E,F,G,H,I,J,K",["D","F","E","K","J","H","G","I"]],
  ["C,F,G,H,I,J,K,L",["C","F","H","K","I","J","G","L"]],
  ["C,E,G,H,I,J,K,L",["C","G","E","K","I","H","J","L"]],
  ["C,E,F,H,I,J,K,L",["C","F","E","K","I","H","J","L"]],
  ["C,E,F,G,I,J,K,L",["C","F","E","K","I","J","G","L"]],
  ["C,E,F,G,H,J,K,L",["C","F","E","K","J","H","G","L"]],
  ["C,E,F,G,H,I,K,L",["C","F","E","K","I","H","G","L"]],
  ["C,E,F,G,H,I,J,L",["C","F","E","I","J","H","G","L"]],
  ["C,E,F,G,H,I,J,K",["C","F","E","K","J","H","G","I"]],
  ["C,D,G,H,I,J,K,L",["C","D","H","K","I","J","G","L"]],
  ["C,D,F,H,I,J,K,L",["D","F","C","K","I","H","J","L"]],
  ["C,D,F,G,I,J,K,L",["D","F","C","K","I","J","G","L"]],
  ["C,D,F,G,H,J,K,L",["D","F","C","K","J","H","G","L"]],
  ["C,D,F,G,H,I,K,L",["D","F","C","K","I","H","G","L"]],
  ["C,D,F,G,H,I,J,L",["D","F","C","I","J","H","G","L"]],
  ["C,D,F,G,H,I,J,K",["D","F","C","K","J","H","G","I"]],
  ["C,D,E,H,I,J,K,L",["C","D","E","K","I","H","J","L"]],
  ["C,D,E,G,I,J,K,L",["C","D","E","K","I","J","G","L"]],
  ["C,D,E,G,H,J,K,L",["C","D","E","K","J","H","G","L"]],
  ["C,D,E,G,H,I,K,L",["C","D","E","K","I","H","G","L"]],
  ["C,D,E,G,H,I,J,L",["C","D","E","I","J","H","G","L"]],
  ["C,D,E,G,H,I,J,K",["C","D","E","K","J","H","G","I"]],
  ["C,D,E,F,I,J,K,L",["D","F","C","K","E","I","J","L"]],
  ["C,D,E,F,H,J,K,L",["D","F","C","K","E","H","J","L"]],
  ["C,D,E,F,H,I,K,L",["D","F","C","K","I","H","E","L"]],
  ["C,D,E,F,H,I,J,L",["D","F","C","I","E","H","J","L"]],
  ["C,D,E,F,H,I,J,K",["D","F","C","K","E","H","J","I"]],
  ["C,D,E,F,G,J,K,L",["D","F","C","K","E","J","G","L"]],
  ["C,D,E,F,G,I,K,L",["D","F","C","K","E","I","G","L"]],
  ["C,D,E,F,G,I,J,L",["D","F","C","I","E","J","G","L"]],
  ["C,D,E,F,G,I,J,K",["D","F","C","K","E","J","G","I"]],
  ["C,D,E,F,G,H,K,L",["D","F","C","K","E","H","G","L"]],
  ["C,D,E,F,G,H,J,L",["D","F","C","E","J","H","G","L"]],
  ["C,D,E,F,G,H,J,K",["D","F","C","K","J","H","G","E"]],
  ["C,D,E,F,G,H,I,L",["D","F","C","I","E","H","G","L"]],
  ["C,D,E,F,G,H,I,K",["D","F","C","K","E","H","G","I"]],
  ["C,D,E,F,G,H,I,J",["D","F","C","I","J","H","G","E"]],
  ["B,F,G,H,I,J,K,L",["F","G","H","K","B","I","J","L"]],
  ["B,E,G,H,I,J,K,L",["B","G","E","K","I","H","J","L"]],
  ["B,E,F,H,I,J,K,L",["F","H","E","K","B","I","J","L"]],
  ["B,E,F,G,I,J,K,L",["F","G","E","K","B","I","J","L"]],
  ["B,E,F,G,H,J,K,L",["F","G","E","K","B","H","J","L"]],
  ["B,E,F,G,H,I,K,L",["F","H","E","K","B","I","G","L"]],
  ["B,E,F,G,H,I,J,L",["F","G","E","I","B","H","J","L"]],
  ["B,E,F,G,H,I,J,K",["F","G","E","K","B","H","J","I"]],
  ["B,D,G,H,I,J,K,L",["D","G","H","K","B","I","J","L"]],
  ["B,D,F,H,I,J,K,L",["D","F","H","K","B","I","J","L"]],
  ["B,D,F,G,I,J,K,L",["D","F","I","K","B","J","G","L"]],
  ["B,D,F,G,H,J,K,L",["D","F","H","K","B","J","G","L"]],
  ["B,D,F,G,H,I,K,L",["D","F","H","K","B","I","G","L"]],
  ["B,D,F,G,H,I,J,L",["D","F","H","I","B","J","G","L"]],
  ["B,D,F,G,H,I,J,K",["D","F","H","K","B","J","G","I"]],
  ["B,D,E,H,I,J,K,L",["D","H","E","K","B","I","J","L"]],
  ["B,D,E,G,I,J,K,L",["D","G","E","K","B","I","J","L"]],
  ["B,D,E,G,H,J,K,L",["D","G","E","K","B","H","J","L"]],
  ["B,D,E,G,H,I,K,L",["D","H","E","K","B","I","G","L"]],
  ["B,D,E,G,H,I,J,L",["D","G","E","I","B","H","J","L"]],
  ["B,D,E,G,H,I,J,K",["D","G","E","K","B","H","J","I"]],
  ["B,D,E,F,I,J,K,L",["D","F","E","K","B","I","J","L"]],
  ["B,D,E,F,H,J,K,L",["D","F","E","K","B","H","J","L"]],
  ["B,D,E,F,H,I,K,L",["D","F","E","K","B","H","I","L"]],
  ["B,D,E,F,H,I,J,L",["D","F","E","I","B","H","J","L"]],
  ["B,D,E,F,H,I,J,K",["D","F","E","K","B","H","J","I"]],
  ["B,D,E,F,G,J,K,L",["D","F","E","K","B","J","G","L"]],
  ["B,D,E,F,G,I,K,L",["D","F","E","K","B","I","G","L"]],
  ["B,D,E,F,G,I,J,L",["D","F","E","I","B","J","G","L"]],
  ["B,D,E,F,G,I,J,K",["D","F","E","K","B","J","G","I"]],
  ["B,D,E,F,G,H,K,L",["D","F","E","K","B","H","G","L"]],
  ["B,D,E,F,G,H,J,L",["D","F","H","E","B","J","G","L"]],
  ["B,D,E,F,G,H,J,K",["D","F","H","K","B","J","G","E"]],
  ["B,D,E,F,G,H,I,L",["D","F","E","I","B","H","G","L"]],
  ["B,D,E,F,G,H,I,K",["D","F","E","K","B","H","G","I"]],
  ["B,D,E,F,G,H,I,J",["D","F","H","I","B","J","G","E"]],
  ["B,C,G,H,I,J,K,L",["C","G","H","K","B","I","J","L"]],
  ["B,C,F,H,I,J,K,L",["C","F","H","K","B","I","J","L"]],
  ["B,C,F,G,I,J,K,L",["C","F","I","K","B","J","G","L"]],
  ["B,C,F,G,H,J,K,L",["C","F","H","K","B","J","G","L"]],
  ["B,C,F,G,H,I,K,L",["C","F","H","K","B","I","G","L"]],
  ["B,C,F,G,H,I,J,L",["C","F","H","I","B","J","G","L"]],
  ["B,C,F,G,H,I,J,K",["C","F","H","K","B","J","G","I"]],
  ["B,C,E,H,I,J,K,L",["C","H","E","K","B","I","J","L"]],
  ["B,C,E,G,I,J,K,L",["C","G","E","K","B","I","J","L"]],
  ["B,C,E,G,H,J,K,L",["C","G","E","K","B","H","J","L"]],
  ["B,C,E,G,H,I,K,L",["C","H","E","K","B","I","G","L"]],
  ["B,C,E,G,H,I,J,L",["C","G","E","I","B","H","J","L"]],
  ["B,C,E,G,H,I,J,K",["C","G","E","K","B","H","J","I"]],
  ["B,C,E,F,I,J,K,L",["C","F","E","K","B","I","J","L"]],
  ["B,C,E,F,H,J,K,L",["C","F","E","K","B","H","J","L"]],
  ["B,C,E,F,H,I,K,L",["C","F","E","K","B","H","I","L"]],
  ["B,C,E,F,H,I,J,L",["C","F","E","I","B","H","J","L"]],
  ["B,C,E,F,H,I,J,K",["C","F","E","K","B","H","J","I"]],
  ["B,C,E,F,G,J,K,L",["C","F","E","K","B","J","G","L"]],
  ["B,C,E,F,G,I,K,L",["C","F","E","K","B","I","G","L"]],
  ["B,C,E,F,G,I,J,L",["C","F","E","I","B","J","G","L"]],
  ["B,C,E,F,G,I,J,K",["C","F","E","K","B","J","G","I"]],
  ["B,C,E,F,G,H,K,L",["C","F","E","K","B","H","G","L"]],
  ["B,C,E,F,G,H,J,L",["C","F","H","E","B","J","G","L"]],
  ["B,C,E,F,G,H,J,K",["C","F","H","K","B","J","G","E"]],
  ["B,C,E,F,G,H,I,L",["C","F","E","I","B","H","G","L"]],
  ["B,C,E,F,G,H,I,K",["C","F","E","K","B","H","G","I"]],
  ["B,C,E,F,G,H,I,J",["C","F","H","I","B","J","G","E"]],
  ["B,C,D,H,I,J,K,L",["C","D","H","K","B","I","J","L"]],
  ["B,C,D,G,I,J,K,L",["C","D","I","K","B","J","G","L"]],
  ["B,C,D,G,H,J,K,L",["C","D","H","K","B","J","G","L"]],
  ["B,C,D,G,H,I,K,L",["C","D","H","K","B","I","G","L"]],
  ["B,C,D,G,H,I,J,L",["C","D","H","I","B","J","G","L"]],
  ["B,C,D,G,H,I,J,K",["C","D","H","K","B","J","G","I"]],
  ["B,C,D,F,I,J,K,L",["D","F","C","K","B","I","J","L"]],
  ["B,C,D,F,H,J,K,L",["D","F","C","K","B","H","J","L"]],
  ["B,C,D,F,H,I,K,L",["D","F","C","K","B","H","I","L"]],
  ["B,C,D,F,H,I,J,L",["D","F","C","I","B","H","J","L"]],
  ["B,C,D,F,H,I,J,K",["D","F","C","K","B","H","J","I"]],
  ["B,C,D,F,G,J,K,L",["D","F","C","K","B","J","G","L"]],
  ["B,C,D,F,G,I,K,L",["D","F","C","K","B","I","G","L"]],
  ["B,C,D,F,G,I,J,L",["D","F","C","I","B","J","G","L"]],
  ["B,C,D,F,G,I,J,K",["D","F","C","K","B","J","G","I"]],
  ["B,C,D,F,G,H,K,L",["D","F","C","K","B","H","G","L"]],
  ["B,C,D,F,G,H,J,L",["D","F","C","J","B","H","G","L"]],
  ["B,C,D,F,G,H,J,K",["C","F","H","K","B","J","G","D"]],
  ["B,C,D,F,G,H,I,L",["D","F","C","I","B","H","G","L"]],
  ["B,C,D,F,G,H,I,K",["D","F","C","K","B","H","G","I"]],
  ["B,C,D,F,G,H,I,J",["C","F","H","I","B","J","G","D"]],
  ["B,C,D,E,I,J,K,L",["C","D","E","K","B","I","J","L"]],
  ["B,C,D,E,H,J,K,L",["C","D","E","K","B","H","J","L"]],
  ["B,C,D,E,H,I,K,L",["C","D","E","K","B","H","I","L"]],
  ["B,C,D,E,H,I,J,L",["C","D","E","I","B","H","J","L"]],
  ["B,C,D,E,H,I,J,K",["C","D","E","K","B","H","J","I"]],
  ["B,C,D,E,G,J,K,L",["C","D","E","K","B","J","G","L"]],
  ["B,C,D,E,G,I,K,L",["C","D","E","K","B","I","G","L"]],
  ["B,C,D,E,G,I,J,L",["C","D","E","I","B","J","G","L"]],
  ["B,C,D,E,G,I,J,K",["C","D","E","K","B","J","G","I"]],
  ["B,C,D,E,G,H,K,L",["C","D","E","K","B","H","G","L"]],
  ["B,C,D,E,G,H,J,L",["C","D","H","E","B","J","G","L"]],
  ["B,C,D,E,G,H,J,K",["C","D","H","K","B","J","G","E"]],
  ["B,C,D,E,G,H,I,L",["C","D","E","I","B","H","G","L"]],
  ["B,C,D,E,G,H,I,K",["C","D","E","K","B","H","G","I"]],
  ["B,C,D,E,G,H,I,J",["C","D","H","I","B","J","G","E"]],
  ["B,C,D,E,F,J,K,L",["D","F","C","K","B","E","J","L"]],
  ["B,C,D,E,F,I,K,L",["D","F","C","K","B","I","E","L"]],
  ["B,C,D,E,F,I,J,L",["D","F","C","I","B","E","J","L"]],
  ["B,C,D,E,F,I,J,K",["D","F","C","K","B","E","J","I"]],
  ["B,C,D,E,F,H,K,L",["D","F","C","K","B","H","E","L"]],
  ["B,C,D,E,F,H,J,L",["D","F","C","E","B","H","J","L"]],
  ["B,C,D,E,F,H,J,K",["D","F","C","K","B","H","J","E"]],
  ["B,C,D,E,F,H,I,L",["D","F","C","I","B","H","E","L"]],
  ["B,C,D,E,F,H,I,K",["D","F","C","K","B","H","E","I"]],
  ["B,C,D,E,F,H,I,J",["D","F","C","I","B","H","J","E"]],
  ["B,C,D,E,F,G,K,L",["D","F","C","K","B","E","G","L"]],
  ["B,C,D,E,F,G,J,L",["D","F","C","E","B","J","G","L"]],
  ["B,C,D,E,F,G,J,K",["D","F","C","K","B","J","G","E"]],
  ["B,C,D,E,F,G,I,L",["D","F","C","I","B","E","G","L"]],
  ["B,C,D,E,F,G,I,K",["D","F","C","K","B","E","G","I"]],
  ["B,C,D,E,F,G,I,J",["D","F","C","I","B","J","G","E"]],
  ["B,C,D,E,F,G,H,L",["D","F","C","E","B","H","G","L"]],
  ["B,C,D,E,F,G,H,K",["D","F","C","K","B","H","G","E"]],
  ["B,C,D,E,F,G,H,J",["C","F","H","E","B","J","G","D"]],
  ["B,C,D,E,F,G,H,I",["D","F","C","I","B","H","G","E"]],
  ["A,F,G,H,I,J,K,L",["F","G","H","K","I","A","J","L"]],
  ["A,E,G,H,I,J,K,L",["A","G","E","K","I","H","J","L"]],
  ["A,E,F,H,I,J,K,L",["F","H","E","K","I","A","J","L"]],
  ["A,E,F,G,I,J,K,L",["F","G","E","K","I","A","J","L"]],
  ["A,E,F,G,H,J,K,L",["F","H","E","K","J","A","G","L"]],
  ["A,E,F,G,H,I,K,L",["F","H","E","K","I","A","G","L"]],
  ["A,E,F,G,H,I,J,L",["F","H","E","I","J","A","G","L"]],
  ["A,E,F,G,H,I,J,K",["F","H","E","K","J","A","G","I"]],
  ["A,D,G,H,I,J,K,L",["D","G","H","K","I","A","J","L"]],
  ["A,D,F,H,I,J,K,L",["D","F","H","K","I","A","J","L"]],
  ["A,D,F,G,I,J,K,L",["D","F","I","K","J","A","G","L"]],
  ["A,D,F,G,H,J,K,L",["D","F","H","K","J","A","G","L"]],
  ["A,D,F,G,H,I,K,L",["D","F","H","K","I","A","G","L"]],
  ["A,D,F,G,H,I,J,L",["D","F","H","I","J","A","G","L"]],
  ["A,D,F,G,H,I,J,K",["D","F","H","K","J","A","G","I"]],
  ["A,D,E,H,I,J,K,L",["D","H","E","K","I","A","J","L"]],
  ["A,D,E,G,I,J,K,L",["D","G","E","K","I","A","J","L"]],
  ["A,D,E,G,H,J,K,L",["D","H","E","K","J","A","G","L"]],
  ["A,D,E,G,H,I,K,L",["D","H","E","K","I","A","G","L"]],
  ["A,D,E,G,H,I,J,L",["D","H","E","I","J","A","G","L"]],
  ["A,D,E,G,H,I,J,K",["D","H","E","K","J","A","G","I"]],
  ["A,D,E,F,I,J,K,L",["D","F","E","K","I","A","J","L"]],
  ["A,D,E,F,H,J,K,L",["D","F","H","K","E","A","J","L"]],
  ["A,D,E,F,H,I,K,L",["D","F","H","K","I","A","E","L"]],
  ["A,D,E,F,H,I,J,L",["D","F","H","I","E","A","J","L"]],
  ["A,D,E,F,H,I,J,K",["D","F","H","K","E","A","J","I"]],
  ["A,D,E,F,G,J,K,L",["D","F","E","K","J","A","G","L"]],
  ["A,D,E,F,G,I,K,L",["D","F","E","K","I","A","G","L"]],
  ["A,D,E,F,G,I,J,L",["D","F","E","I","J","A","G","L"]],
  ["A,D,E,F,G,I,J,K",["D","F","E","K","J","A","G","I"]],
  ["A,D,E,F,G,H,K,L",["D","F","H","K","E","A","G","L"]],
  ["A,D,E,F,G,H,J,L",["D","F","H","E","J","A","G","L"]],
  ["A,D,E,F,G,H,J,K",["D","F","H","K","J","A","G","E"]],
  ["A,D,E,F,G,H,I,L",["D","F","H","I","E","A","G","L"]],
  ["A,D,E,F,G,H,I,K",["D","F","H","K","E","A","G","I"]],
  ["A,D,E,F,G,H,I,J",["D","F","H","I","J","A","G","E"]],
  ["A,C,G,H,I,J,K,L",["C","G","H","K","I","A","J","L"]],
  ["A,C,F,H,I,J,K,L",["C","F","H","K","I","A","J","L"]],
  ["A,C,F,G,I,J,K,L",["C","F","I","K","J","A","G","L"]],
  ["A,C,F,G,H,J,K,L",["C","F","H","K","J","A","G","L"]],
  ["A,C,F,G,H,I,K,L",["C","F","H","K","I","A","G","L"]],
  ["A,C,F,G,H,I,J,L",["C","F","H","I","J","A","G","L"]],
  ["A,C,F,G,H,I,J,K",["C","F","H","K","J","A","G","I"]],
  ["A,C,E,H,I,J,K,L",["C","H","E","K","I","A","J","L"]],
  ["A,C,E,G,I,J,K,L",["C","G","E","K","I","A","J","L"]],
  ["A,C,E,G,H,J,K,L",["C","H","E","K","J","A","G","L"]],
  ["A,C,E,G,H,I,K,L",["C","H","E","K","I","A","G","L"]],
  ["A,C,E,G,H,I,J,L",["C","H","E","I","J","A","G","L"]],
  ["A,C,E,G,H,I,J,K",["C","H","E","K","J","A","G","I"]],
  ["A,C,E,F,I,J,K,L",["C","F","E","K","I","A","J","L"]],
  ["A,C,E,F,H,J,K,L",["C","F","H","K","E","A","J","L"]],
  ["A,C,E,F,H,I,K,L",["C","F","H","K","I","A","E","L"]],
  ["A,C,E,F,H,I,J,L",["C","F","H","I","E","A","J","L"]],
  ["A,C,E,F,H,I,J,K",["C","F","H","K","E","A","J","I"]],
  ["A,C,E,F,G,J,K,L",["C","F","E","K","J","A","G","L"]],
  ["A,C,E,F,G,I,K,L",["C","F","E","K","I","A","G","L"]],
  ["A,C,E,F,G,I,J,L",["C","F","E","I","J","A","G","L"]],
  ["A,C,E,F,G,I,J,K",["C","F","E","K","J","A","G","I"]],
  ["A,C,E,F,G,H,K,L",["C","F","H","K","E","A","G","L"]],
  ["A,C,E,F,G,H,J,L",["C","F","H","E","J","A","G","L"]],
  ["A,C,E,F,G,H,J,K",["C","F","H","K","J","A","G","E"]],
  ["A,C,E,F,G,H,I,L",["C","F","H","I","E","A","G","L"]],
  ["A,C,E,F,G,H,I,K",["C","F","H","K","E","A","G","I"]],
  ["A,C,E,F,G,H,I,J",["C","F","H","I","J","A","G","E"]],
  ["A,C,D,H,I,J,K,L",["C","D","H","K","I","A","J","L"]],
  ["A,C,D,G,I,J,K,L",["C","D","I","K","J","A","G","L"]],
  ["A,C,D,G,H,J,K,L",["C","D","H","K","J","A","G","L"]],
  ["A,C,D,G,H,I,K,L",["C","D","H","K","I","A","G","L"]],
  ["A,C,D,G,H,I,J,L",["C","D","H","I","J","A","G","L"]],
  ["A,C,D,G,H,I,J,K",["C","D","H","K","J","A","G","I"]],
  ["A,C,D,F,I,J,K,L",["D","F","C","K","I","A","J","L"]],
  ["A,C,D,F,H,J,K,L",["C","D","H","K","F","A","J","L"]],
  ["A,C,D,F,H,I,K,L",["C","D","H","K","I","A","F","L"]],
  ["A,C,D,F,H,I,J,L",["C","D","H","I","F","A","J","L"]],
  ["A,C,D,F,H,I,J,K",["C","D","H","K","F","A","J","I"]],
  ["A,C,D,F,G,J,K,L",["D","F","C","K","J","A","G","L"]],
  ["A,C,D,F,G,I,K,L",["D","F","C","K","I","A","G","L"]],
  ["A,C,D,F,G,I,J,L",["D","F","C","I","J","A","G","L"]],
  ["A,C,D,F,G,I,J,K",["D","F","C","K","J","A","G","I"]],
  ["A,C,D,F,G,H,K,L",["C","D","H","K","F","A","G","L"]],
  ["A,C,D,F,G,H,J,L",["D","F","C","H","J","A","G","L"]],
  ["A,C,D,F,G,H,J,K",["C","F","H","K","J","A","G","D"]],
  ["A,C,D,F,G,H,I,L",["C","D","H","I","F","A","G","L"]],
  ["A,C,D,F,G,H,I,K",["C","D","H","K","F","A","G","I"]],
  ["A,C,D,F,G,H,I,J",["C","F","H","I","J","A","G","D"]],
  ["A,C,D,E,I,J,K,L",["C","D","E","K","I","A","J","L"]],
  ["A,C,D,E,H,J,K,L",["C","D","H","K","E","A","J","L"]],
  ["A,C,D,E,H,I,K,L",["C","D","H","K","I","A","E","L"]],
  ["A,C,D,E,H,I,J,L",["C","D","H","I","E","A","J","L"]],
  ["A,C,D,E,H,I,J,K",["C","D","H","K","E","A","J","I"]],
  ["A,C,D,E,G,J,K,L",["C","D","E","K","J","A","G","L"]],
  ["A,C,D,E,G,I,K,L",["C","D","E","K","I","A","G","L"]],
  ["A,C,D,E,G,I,J,L",["C","D","E","I","J","A","G","L"]],
  ["A,C,D,E,G,I,J,K",["C","D","E","K","J","A","G","I"]],
  ["A,C,D,E,G,H,K,L",["C","D","H","K","E","A","G","L"]],
  ["A,C,D,E,G,H,J,L",["C","D","H","E","J","A","G","L"]],
  ["A,C,D,E,G,H,J,K",["C","D","H","K","J","A","G","E"]],
  ["A,C,D,E,G,H,I,L",["C","D","H","I","E","A","G","L"]],
  ["A,C,D,E,G,H,I,K",["C","D","H","K","E","A","G","I"]],
  ["A,C,D,E,G,H,I,J",["C","D","H","I","J","A","G","E"]],
  ["A,C,D,E,F,J,K,L",["D","F","C","K","E","A","J","L"]],
  ["A,C,D,E,F,I,K,L",["D","F","C","K","I","A","E","L"]],
  ["A,C,D,E,F,I,J,L",["D","F","C","I","E","A","J","L"]],
  ["A,C,D,E,F,I,J,K",["D","F","C","K","E","A","J","I"]],
  ["A,C,D,E,F,H,K,L",["C","D","H","K","F","A","E","L"]],
  ["A,C,D,E,F,H,J,L",["C","D","H","E","F","A","J","L"]],
  ["A,C,D,E,F,H,J,K",["C","F","H","K","E","A","J","D"]],
  ["A,C,D,E,F,H,I,L",["C","D","H","I","F","A","E","L"]],
  ["A,C,D,E,F,H,I,K",["C","D","H","K","F","A","E","I"]],
  ["A,C,D,E,F,H,I,J",["C","F","H","I","E","A","J","D"]],
  ["A,C,D,E,F,G,K,L",["D","F","C","K","E","A","G","L"]],
  ["A,C,D,E,F,G,J,L",["D","F","C","E","J","A","G","L"]],
  ["A,C,D,E,F,G,J,K",["D","F","C","K","J","A","G","E"]],
  ["A,C,D,E,F,G,I,L",["D","F","C","I","E","A","G","L"]],
  ["A,C,D,E,F,G,I,K",["D","F","C","K","E","A","G","I"]],
  ["A,C,D,E,F,G,I,J",["D","F","C","I","J","A","G","E"]],
  ["A,C,D,E,F,G,H,L",["C","D","H","E","F","A","G","L"]],
  ["A,C,D,E,F,G,H,K",["C","F","H","K","E","A","G","D"]],
  ["A,C,D,E,F,G,H,J",["C","F","H","E","J","A","G","D"]],
  ["A,C,D,E,F,G,H,I",["C","F","H","I","E","A","G","D"]],
  ["A,B,G,H,I,J,K,L",["A","G","H","K","B","I","J","L"]],
  ["A,B,F,H,I,J,K,L",["A","F","H","K","B","I","J","L"]],
  ["A,B,F,G,I,J,K,L",["F","G","I","K","B","A","J","L"]],
  ["A,B,F,G,H,J,K,L",["F","G","H","K","B","A","J","L"]],
  ["A,B,F,G,H,I,K,L",["A","F","H","K","B","I","G","L"]],
  ["A,B,F,G,H,I,J,L",["F","G","H","I","B","A","J","L"]],
  ["A,B,F,G,H,I,J,K",["F","G","H","K","B","A","J","I"]],
  ["A,B,E,H,I,J,K,L",["A","H","E","K","B","I","J","L"]],
  ["A,B,E,G,I,J,K,L",["A","G","E","K","B","I","J","L"]],
  ["A,B,E,G,H,J,K,L",["A","G","E","K","B","H","J","L"]],
  ["A,B,E,G,H,I,K,L",["A","H","E","K","B","I","G","L"]],
  ["A,B,E,G,H,I,J,L",["A","G","E","I","B","H","J","L"]],
  ["A,B,E,G,H,I,J,K",["A","G","E","K","B","H","J","I"]],
  ["A,B,E,F,I,J,K,L",["A","F","E","K","B","I","J","L"]],
  ["A,B,E,F,H,J,K,L",["F","H","E","K","B","A","J","L"]],
  ["A,B,E,F,H,I,K,L",["F","H","E","K","B","A","I","L"]],
  ["A,B,E,F,H,I,J,L",["F","H","E","I","B","A","J","L"]],
  ["A,B,E,F,H,I,J,K",["F","H","E","K","B","A","J","I"]],
  ["A,B,E,F,G,J,K,L",["F","G","E","K","B","A","J","L"]],
  ["A,B,E,F,G,I,K,L",["A","F","E","K","B","I","G","L"]],
  ["A,B,E,F,G,I,J,L",["F","G","E","I","B","A","J","L"]],
  ["A,B,E,F,G,I,J,K",["F","G","E","K","B","A","J","I"]],
  ["A,B,E,F,G,H,K,L",["F","H","E","K","B","A","G","L"]],
  ["A,B,E,F,G,H,J,L",["F","G","H","E","B","A","J","L"]],
  ["A,B,E,F,G,H,J,K",["F","G","H","K","B","A","J","E"]],
  ["A,B,E,F,G,H,I,L",["F","H","E","I","B","A","G","L"]],
  ["A,B,E,F,G,H,I,K",["F","H","E","K","B","A","G","I"]],
  ["A,B,E,F,G,H,I,J",["F","G","H","I","B","A","J","E"]],
  ["A,B,D,H,I,J,K,L",["D","H","I","K","B","A","J","L"]],
  ["A,B,D,G,I,J,K,L",["D","G","I","K","B","A","J","L"]],
  ["A,B,D,G,H,J,K,L",["D","G","H","K","B","A","J","L"]],
  ["A,B,D,G,H,I,K,L",["D","H","I","K","B","A","G","L"]],
  ["A,B,D,G,H,I,J,L",["D","G","H","I","B","A","J","L"]],
  ["A,B,D,G,H,I,J,K",["D","G","H","K","B","A","J","I"]],
  ["A,B,D,F,I,J,K,L",["D","F","I","K","B","A","J","L"]],
  ["A,B,D,F,H,J,K,L",["D","F","H","K","B","A","J","L"]],
  ["A,B,D,F,H,I,K,L",["D","F","H","K","B","A","I","L"]],
  ["A,B,D,F,H,I,J,L",["D","F","H","I","B","A","J","L"]],
  ["A,B,D,F,H,I,J,K",["D","F","H","K","B","A","J","I"]],
  ["A,B,D,F,G,J,K,L",["D","G","F","K","B","A","J","L"]],
  ["A,B,D,F,G,I,K,L",["D","F","I","K","B","A","G","L"]],
  ["A,B,D,F,G,I,J,L",["D","G","F","I","B","A","J","L"]],
  ["A,B,D,F,G,I,J,K",["D","G","F","K","B","A","J","I"]],
  ["A,B,D,F,G,H,K,L",["D","F","H","K","B","A","G","L"]],
  ["A,B,D,F,G,H,J,L",["D","F","H","J","B","A","G","L"]],
  ["A,B,D,F,G,H,J,K",["D","F","H","K","B","A","G","J"]],
  ["A,B,D,F,G,H,I,L",["D","F","H","I","B","A","G","L"]],
  ["A,B,D,F,G,H,I,K",["D","F","H","K","B","A","G","I"]],
  ["A,B,D,F,G,H,I,J",["D","F","H","J","B","A","G","I"]],
  ["A,B,D,E,I,J,K,L",["A","D","E","K","B","I","J","L"]],
  ["A,B,D,E,H,J,K,L",["D","H","E","K","B","A","J","L"]],
  ["A,B,D,E,H,I,K,L",["D","H","E","K","B","A","I","L"]],
  ["A,B,D,E,H,I,J,L",["D","H","E","I","B","A","J","L"]],
  ["A,B,D,E,H,I,J,K",["D","H","E","K","B","A","J","I"]],
  ["A,B,D,E,G,J,K,L",["D","G","E","K","B","A","J","L"]],
  ["A,B,D,E,G,I,K,L",["A","D","E","K","B","I","G","L"]],
  ["A,B,D,E,G,I,J,L",["D","G","E","I","B","A","J","L"]],
  ["A,B,D,E,G,I,J,K",["D","G","E","K","B","A","J","I"]],
  ["A,B,D,E,G,H,K,L",["D","H","E","K","B","A","G","L"]],
  ["A,B,D,E,G,H,J,L",["D","G","H","E","B","A","J","L"]],
  ["A,B,D,E,G,H,J,K",["D","G","H","K","B","A","J","E"]],
  ["A,B,D,E,G,H,I,L",["D","H","E","I","B","A","G","L"]],
  ["A,B,D,E,G,H,I,K",["D","H","E","K","B","A","G","I"]],
  ["A,B,D,E,G,H,I,J",["D","G","H","I","B","A","J","E"]],
  ["A,B,D,E,F,J,K,L",["D","F","E","K","B","A","J","L"]],
  ["A,B,D,E,F,I,K,L",["D","F","E","K","B","A","I","L"]],
  ["A,B,D,E,F,I,J,L",["D","F","E","I","B","A","J","L"]],
  ["A,B,D,E,F,I,J,K",["D","F","E","K","B","A","J","I"]],
  ["A,B,D,E,F,H,K,L",["D","F","H","K","B","A","E","L"]],
  ["A,B,D,E,F,H,J,L",["D","F","H","E","B","A","J","L"]],
  ["A,B,D,E,F,H,J,K",["D","F","H","K","B","A","J","E"]],
  ["A,B,D,E,F,H,I,L",["D","F","H","I","B","A","E","L"]],
  ["A,B,D,E,F,H,I,K",["D","F","H","K","B","A","E","I"]],
  ["A,B,D,E,F,H,I,J",["D","F","H","I","B","A","J","E"]],
  ["A,B,D,E,F,G,K,L",["D","F","E","K","B","A","G","L"]],
  ["A,B,D,E,F,G,J,L",["D","F","E","J","B","A","G","L"]],
  ["A,B,D,E,F,G,J,K",["D","F","E","K","B","A","G","J"]],
  ["A,B,D,E,F,G,I,L",["D","F","E","I","B","A","G","L"]],
  ["A,B,D,E,F,G,I,K",["D","F","E","K","B","A","G","I"]],
  ["A,B,D,E,F,G,I,J",["D","F","E","J","B","A","G","I"]],
  ["A,B,D,E,F,G,H,L",["D","F","H","E","B","A","G","L"]],
  ["A,B,D,E,F,G,H,K",["D","F","H","K","B","A","G","E"]],
  ["A,B,D,E,F,G,H,J",["D","F","H","J","B","A","G","E"]],
  ["A,B,D,E,F,G,H,I",["D","F","H","I","B","A","G","E"]],
  ["A,B,C,H,I,J,K,L",["C","H","I","K","B","A","J","L"]],
  ["A,B,C,G,I,J,K,L",["C","G","I","K","B","A","J","L"]],
  ["A,B,C,G,H,J,K,L",["C","G","H","K","B","A","J","L"]],
  ["A,B,C,G,H,I,K,L",["C","H","I","K","B","A","G","L"]],
  ["A,B,C,G,H,I,J,L",["C","G","H","I","B","A","J","L"]],
  ["A,B,C,G,H,I,J,K",["C","G","H","K","B","A","J","I"]],
  ["A,B,C,F,I,J,K,L",["C","F","I","K","B","A","J","L"]],
  ["A,B,C,F,H,J,K,L",["C","F","H","K","B","A","J","L"]],
  ["A,B,C,F,H,I,K,L",["C","F","H","K","B","A","I","L"]],
  ["A,B,C,F,H,I,J,L",["C","F","H","I","B","A","J","L"]],
  ["A,B,C,F,H,I,J,K",["C","F","H","K","B","A","J","I"]],
  ["A,B,C,F,G,J,K,L",["F","G","C","K","B","A","J","L"]],
  ["A,B,C,F,G,I,K,L",["C","F","I","K","B","A","G","L"]],
  ["A,B,C,F,G,I,J,L",["F","G","C","I","B","A","J","L"]],
  ["A,B,C,F,G,I,J,K",["F","G","C","K","B","A","J","I"]],
  ["A,B,C,F,G,H,K,L",["C","F","H","K","B","A","G","L"]],
  ["A,B,C,F,G,H,J,L",["C","F","H","J","B","A","G","L"]],
  ["A,B,C,F,G,H,J,K",["C","F","H","K","B","A","G","J"]],
  ["A,B,C,F,G,H,I,L",["C","F","H","I","B","A","G","L"]],
  ["A,B,C,F,G,H,I,K",["C","F","H","K","B","A","G","I"]],
  ["A,B,C,F,G,H,I,J",["C","F","H","J","B","A","G","I"]],
  ["A,B,C,E,I,J,K,L",["A","C","E","K","B","I","J","L"]],
  ["A,B,C,E,H,J,K,L",["C","H","E","K","B","A","J","L"]],
  ["A,B,C,E,H,I,K,L",["C","H","E","K","B","A","I","L"]],
  ["A,B,C,E,H,I,J,L",["C","H","E","I","B","A","J","L"]],
  ["A,B,C,E,H,I,J,K",["C","H","E","K","B","A","J","I"]],
  ["A,B,C,E,G,J,K,L",["C","G","E","K","B","A","J","L"]],
  ["A,B,C,E,G,I,K,L",["A","C","E","K","B","I","G","L"]],
  ["A,B,C,E,G,I,J,L",["C","G","E","I","B","A","J","L"]],
  ["A,B,C,E,G,I,J,K",["C","G","E","K","B","A","J","I"]],
  ["A,B,C,E,G,H,K,L",["C","H","E","K","B","A","G","L"]],
  ["A,B,C,E,G,H,J,L",["C","G","H","E","B","A","J","L"]],
  ["A,B,C,E,G,H,J,K",["C","G","H","K","B","A","J","E"]],
  ["A,B,C,E,G,H,I,L",["C","H","E","I","B","A","G","L"]],
  ["A,B,C,E,G,H,I,K",["C","H","E","K","B","A","G","I"]],
  ["A,B,C,E,G,H,I,J",["C","G","H","I","B","A","J","E"]],
  ["A,B,C,E,F,J,K,L",["C","F","E","K","B","A","J","L"]],
  ["A,B,C,E,F,I,K,L",["C","F","E","K","B","A","I","L"]],
  ["A,B,C,E,F,I,J,L",["C","F","E","I","B","A","J","L"]],
  ["A,B,C,E,F,I,J,K",["C","F","E","K","B","A","J","I"]],
  ["A,B,C,E,F,H,K,L",["C","F","H","K","B","A","E","L"]],
  ["A,B,C,E,F,H,J,L",["C","F","H","E","B","A","J","L"]],
  ["A,B,C,E,F,H,J,K",["C","F","H","K","B","A","J","E"]],
  ["A,B,C,E,F,H,I,L",["C","F","H","I","B","A","E","L"]],
  ["A,B,C,E,F,H,I,K",["C","F","H","K","B","A","E","I"]],
  ["A,B,C,E,F,H,I,J",["C","F","H","I","B","A","J","E"]],
  ["A,B,C,E,F,G,K,L",["C","F","E","K","B","A","G","L"]],
  ["A,B,C,E,F,G,J,L",["C","F","E","J","B","A","G","L"]],
  ["A,B,C,E,F,G,J,K",["C","F","E","K","B","A","G","J"]],
  ["A,B,C,E,F,G,I,L",["C","F","E","I","B","A","G","L"]],
  ["A,B,C,E,F,G,I,K",["C","F","E","K","B","A","G","I"]],
  ["A,B,C,E,F,G,I,J",["C","F","E","J","B","A","G","I"]],
  ["A,B,C,E,F,G,H,L",["C","F","H","E","B","A","G","L"]],
  ["A,B,C,E,F,G,H,K",["C","F","H","K","B","A","G","E"]],
  ["A,B,C,E,F,G,H,J",["C","F","H","J","B","A","G","E"]],
  ["A,B,C,E,F,G,H,I",["C","F","H","I","B","A","G","E"]],
  ["A,B,C,D,I,J,K,L",["C","D","I","K","B","A","J","L"]],
  ["A,B,C,D,H,J,K,L",["C","D","H","K","B","A","J","L"]],
  ["A,B,C,D,H,I,K,L",["C","D","H","K","B","A","I","L"]],
  ["A,B,C,D,H,I,J,L",["C","D","H","I","B","A","J","L"]],
  ["A,B,C,D,H,I,J,K",["C","D","H","K","B","A","J","I"]],
  ["A,B,C,D,G,J,K,L",["D","G","C","K","B","A","J","L"]],
  ["A,B,C,D,G,I,K,L",["C","D","I","K","B","A","G","L"]],
  ["A,B,C,D,G,I,J,L",["D","G","C","I","B","A","J","L"]],
  ["A,B,C,D,G,I,J,K",["D","G","C","K","B","A","J","I"]],
  ["A,B,C,D,G,H,K,L",["C","D","H","K","B","A","G","L"]],
  ["A,B,C,D,G,H,J,L",["C","D","H","J","B","A","G","L"]],
  ["A,B,C,D,G,H,J,K",["C","D","H","K","B","A","G","J"]],
  ["A,B,C,D,G,H,I,L",["C","D","H","I","B","A","G","L"]],
  ["A,B,C,D,G,H,I,K",["C","D","H","K","B","A","G","I"]],
  ["A,B,C,D,G,H,I,J",["C","D","H","J","B","A","G","I"]],
  ["A,B,C,D,F,J,K,L",["D","F","C","K","B","A","J","L"]],
  ["A,B,C,D,F,I,K,L",["D","F","C","K","B","A","I","L"]],
  ["A,B,C,D,F,I,J,L",["D","F","C","I","B","A","J","L"]],
  ["A,B,C,D,F,I,J,K",["D","F","C","K","B","A","J","I"]],
  ["A,B,C,D,F,H,K,L",["C","D","H","K","B","A","F","L"]],
  ["A,B,C,D,F,H,J,L",["D","F","C","H","B","A","J","L"]],
  ["A,B,C,D,F,H,J,K",["C","F","H","K","B","A","J","D"]],
  ["A,B,C,D,F,H,I,L",["C","D","H","I","B","A","F","L"]],
  ["A,B,C,D,F,H,I,K",["C","D","H","K","B","A","F","I"]],
  ["A,B,C,D,F,H,I,J",["C","F","H","I","B","A","J","D"]],
  ["A,B,C,D,F,G,K,L",["D","F","C","K","B","A","G","L"]],
  ["A,B,C,D,F,G,J,L",["D","F","C","J","B","A","G","L"]],
  ["A,B,C,D,F,G,J,K",["D","F","C","K","B","A","G","J"]],
  ["A,B,C,D,F,G,I,L",["D","F","C","I","B","A","G","L"]],
  ["A,B,C,D,F,G,I,K",["D","F","C","K","B","A","G","I"]],
  ["A,B,C,D,F,G,I,J",["D","F","C","J","B","A","G","I"]],
  ["A,B,C,D,F,G,H,L",["D","F","C","H","B","A","G","L"]],
  ["A,B,C,D,F,G,H,K",["C","F","H","K","B","A","G","D"]],
  ["A,B,C,D,F,G,H,J",["C","F","H","J","B","A","G","D"]],
  ["A,B,C,D,F,G,H,I",["C","F","H","I","B","A","G","D"]],
  ["A,B,C,D,E,J,K,L",["C","D","E","K","B","A","J","L"]],
  ["A,B,C,D,E,I,K,L",["C","D","E","K","B","A","I","L"]],
  ["A,B,C,D,E,I,J,L",["C","D","E","I","B","A","J","L"]],
  ["A,B,C,D,E,I,J,K",["C","D","E","K","B","A","J","I"]],
  ["A,B,C,D,E,H,K,L",["C","D","H","K","B","A","E","L"]],
  ["A,B,C,D,E,H,J,L",["C","D","H","E","B","A","J","L"]],
  ["A,B,C,D,E,H,J,K",["C","D","H","K","B","A","J","E"]],
  ["A,B,C,D,E,H,I,L",["C","D","H","I","B","A","E","L"]],
  ["A,B,C,D,E,H,I,K",["C","D","H","K","B","A","E","I"]],
  ["A,B,C,D,E,H,I,J",["C","D","H","I","B","A","J","E"]],
  ["A,B,C,D,E,G,K,L",["C","D","E","K","B","A","G","L"]],
  ["A,B,C,D,E,G,J,L",["C","D","E","J","B","A","G","L"]],
  ["A,B,C,D,E,G,J,K",["C","D","E","K","B","A","G","J"]],
  ["A,B,C,D,E,G,I,L",["C","D","E","I","B","A","G","L"]],
  ["A,B,C,D,E,G,I,K",["C","D","E","K","B","A","G","I"]],
  ["A,B,C,D,E,G,I,J",["C","D","E","J","B","A","G","I"]],
  ["A,B,C,D,E,G,H,L",["C","D","H","E","B","A","G","L"]],
  ["A,B,C,D,E,G,H,K",["C","D","H","K","B","A","G","E"]],
  ["A,B,C,D,E,G,H,J",["C","D","H","J","B","A","G","E"]],
  ["A,B,C,D,E,G,H,I",["C","D","H","I","B","A","G","E"]],
  ["A,B,C,D,E,F,K,L",["D","F","C","K","B","A","E","L"]],
  ["A,B,C,D,E,F,J,L",["D","F","C","E","B","A","J","L"]],
  ["A,B,C,D,E,F,J,K",["D","F","C","K","B","A","J","E"]],
  ["A,B,C,D,E,F,I,L",["D","F","C","I","B","A","E","L"]],
  ["A,B,C,D,E,F,I,K",["D","F","C","K","B","A","E","I"]],
  ["A,B,C,D,E,F,I,J",["D","F","C","I","B","A","J","E"]],
  ["A,B,C,D,E,F,H,L",["C","D","H","E","B","A","F","L"]],
  ["A,B,C,D,E,F,H,K",["C","F","H","K","B","A","E","D"]],
  ["A,B,C,D,E,F,H,J",["C","F","H","E","B","A","J","D"]],
  ["A,B,C,D,E,F,H,I",["C","F","H","I","B","A","E","D"]],
  ["A,B,C,D,E,F,G,L",["D","F","C","E","B","A","G","L"]],
  ["A,B,C,D,E,F,G,K",["D","F","C","K","B","A","G","E"]],
  ["A,B,C,D,E,F,G,J",["D","F","C","J","B","A","G","E"]],
  ["A,B,C,D,E,F,G,I",["D","F","C","I","B","A","G","E"]],
  ["A,B,C,D,E,F,G,H",["C","F","H","E","B","A","G","D"]],
])

// ── Group letter helpers ───────────────────────────────────────────────────────

// Matches stored as "Group A"; standings endpoint converts to "GROUP_A".
// Support both formats here.
function groupLetter(g: string): string {
  if (g.startsWith('GROUP_')) return g.replace('GROUP_', '')
  const m = g.match(/^Group (.+)$/)
  return m ? m[1] : g
}

// ── computeGroupStandings ─────────────────────────────────────────────────────

export function computeGroupStandings(
  matches: Match[],
  predictions: Prediction[]
): SimulatedGroup[] {
  const predMap = new Map<string, Prediction>()
  for (const p of predictions) predMap.set(p.match_id, p)

  // Collect group stage matches by group
  const groupMatches = new Map<string, Match[]>()
  for (const m of matches) {
    if (m.stage !== 'group_stage') continue
    if (!m.group) continue
    const key = m.group
    if (!groupMatches.has(key)) groupMatches.set(key, [])
    groupMatches.get(key)!.push(m)
  }

  const groups: SimulatedGroup[] = []

  for (const [group, gMatches] of groupMatches.entries()) {
    // Collect all teams
    const teamSet = new Set<string>()
    for (const m of gMatches) {
      teamSet.add(m.home_team)
      teamSet.add(m.away_team)
    }

    const stats = new Map<string, TeamStats>()
    for (const team of teamSet) {
      stats.set(team, {
        team,
        group,
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, pts: 0,
      })
    }

    // Apply predicted (or 0-0 default) results
    for (const m of gMatches) {
      const pred = predMap.get(m.id)
      const hg = pred?.predicted_home ?? 0
      const ag = pred?.predicted_away ?? 0

      const hs = stats.get(m.home_team)!
      const as_ = stats.get(m.away_team)!

      hs.played++; as_.played++
      hs.gf += hg; hs.ga += ag
      as_.gf += ag; as_.ga += hg
      hs.gd = hs.gf - hs.ga
      as_.gd = as_.gf - as_.ga

      if (hg > ag) {
        hs.won++; hs.pts += 3; as_.lost++
      } else if (hg < ag) {
        as_.won++; as_.pts += 3; hs.lost++
      } else {
        hs.drawn++; hs.pts += 1; as_.drawn++; as_.pts += 1
      }
    }

    const teamList = Array.from(stats.values())
    const ranked = rankTeams(teamList, gMatches, predMap)

    groups.push({ group, letter: groupLetter(group), standings: ranked })
  }

  // Sort groups alphabetically by letter
  groups.sort((a, b) => a.letter.localeCompare(b.letter))
  return groups
}

// ── rankTeams ─────────────────────────────────────────────────────────────────

function rankTeams(
  teams: TeamStats[],
  groupMatches: Match[],
  predMap: Map<string, Prediction>
): TeamStats[] {
  // Primary sort by overall stats
  const sorted = [...teams].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    if (b.gd  !== a.gd)  return b.gd  - a.gd
    if (b.gf  !== a.gf)  return b.gf  - a.gf
    return 0
  })

  // Resolve each contiguous tied group via a proper H2H mini-table.
  // Pairwise comparators are non-transitive for 3+ teams, so we group first.
  const result: TeamStats[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (
      j < sorted.length &&
      sorted[j].pts === sorted[i].pts &&
      sorted[j].gd  === sorted[i].gd &&
      sorted[j].gf  === sorted[i].gf
    ) j++

    if (j - i === 1) {
      result.push(sorted[i])
    } else {
      result.push(...resolveH2HTied(sorted.slice(i, j), groupMatches, predMap))
    }
    i = j
  }
  return result
}

function resolveH2HTied(
  tied: TeamStats[],
  groupMatches: Match[],
  predMap: Map<string, Prediction>
): TeamStats[] {
  const names = tied.map(t => t.team)
  const pts: Record<string, number> = Object.fromEntries(names.map(n => [n, 0]))
  const gd:  Record<string, number> = Object.fromEntries(names.map(n => [n, 0]))
  const gf:  Record<string, number> = Object.fromEntries(names.map(n => [n, 0]))

  for (const m of groupMatches) {
    if (!names.includes(m.home_team) || !names.includes(m.away_team)) continue
    const pred = predMap.get(m.id)
    const hg = pred?.predicted_home ?? 0
    const ag = pred?.predicted_away ?? 0
    gf[m.home_team] += hg; gf[m.away_team] += ag
    gd[m.home_team] += hg - ag; gd[m.away_team] += ag - hg
    if (hg > ag)      pts[m.home_team] += 3
    else if (hg < ag) pts[m.away_team] += 3
    else { pts[m.home_team] += 1; pts[m.away_team] += 1 }
  }

  return [...tied].sort((a, b) => {
    if (pts[b.team] !== pts[a.team]) return pts[b.team] - pts[a.team]
    if (gd[b.team]  !== gd[a.team])  return gd[b.team]  - gd[a.team]
    if (gf[b.team]  !== gf[a.team])  return gf[b.team]  - gf[a.team]
    return a.team.localeCompare(b.team)
  })
}

// ── rankThirdPlaceTeams ───────────────────────────────────────────────────────

export function rankThirdPlaceTeams(groups: SimulatedGroup[]): QualifiedTeam[] {
  const thirds: QualifiedTeam[] = groups
    .filter(g => g.standings.length >= 3)
    .map(g => ({
      team: g.standings[2].team,
      group: g.group,
      letter: g.letter,
      position: 3,
      stats: g.standings[2],
    }))

  // Rank: pts → gd → gf → alphabetical
  thirds.sort((a, b) => {
    if (b.stats.pts !== a.stats.pts) return b.stats.pts - a.stats.pts
    if (b.stats.gd !== a.stats.gd) return b.stats.gd - a.stats.gd
    if (b.stats.gf !== a.stats.gf) return b.stats.gf - a.stats.gf
    return a.team.localeCompare(b.team)
  })

  return thirds.slice(0, 8)
}

// ── buildR32Bracket ───────────────────────────────────────────────────────────

// R32 match structure (FIFA WC 2026)
// slotKey → [homeDesc, awayDesc] where desc is "1X" (winner group X), "2X" (runner-up), or "3X" (3rd place slot)
const R32_STRUCTURE: Record<string, [string, string]> = {
  "74": ["1E", "3rd74"],  // Match 74: Winner E vs 3rd (assigned via lookup)
  "77": ["1I", "3rd77"],  // Match 77: Winner I vs 3rd
  "79": ["1A", "3rd79"],  // Match 79: Winner A vs 3rd
  "80": ["1L", "3rd80"],  // Match 80: Winner L vs 3rd
  "81": ["1D", "3rd81"],  // Match 81: Winner D vs 3rd
  "82": ["1G", "3rd82"],  // Match 82: Winner G vs 3rd
  "85": ["1B", "3rd85"],  // Match 85: Winner B vs 3rd
  "87": ["1K", "3rd87"],  // Match 87: Winner K vs 3rd
  "73": ["2A", "2B"],
  "75": ["1F", "2C"],
  "76": ["1C", "2F"],
  "78": ["2E", "2I"],
  "83": ["2K", "2L"],
  "84": ["1H", "2J"],
  "86": ["2G", "2H"],
  "88": ["1J", "2D"],
}

// Ordered R32 matchups for bracket display (left half then right half)
export const R32_ORDER = ["73","74","75","76","77","78","79","80","81","82","83","84","85","86","87","88"]

export function buildR32Bracket(groups: SimulatedGroup[]): { matchups: R32Matchup[]; slotAssignmentValid: boolean } {
  // Build lookup: letter → {1st, 2nd, 3rd}
  const byLetter = new Map<string, SimulatedGroup>()
  for (const g of groups) byLetter.set(g.letter, g)

  const makeQT = (group: SimulatedGroup, pos: number): QualifiedTeam | null => {
    const s = group.standings[pos - 1]
    if (!s) return null
    return { team: s.team, group: group.group, letter: group.letter, position: pos, stats: s }
  }

  // Determine qualifying 3rd-place teams and their slot assignments
  const best8thirds = rankThirdPlaceTeams(groups)
  const combinationKey = best8thirds.map(t => t.letter).sort().join(',')
  const slotAssignment = COMBINATIONS.get(combinationKey)

  // slotAssignment: [m74, m77, m79, m80, m81, m82, m85, m87]
  const thirdBySlot: Record<string, QualifiedTeam | null> = {}
  const slotKeys = ["74","77","79","80","81","82","85","87"]
  if (slotAssignment) {
    slotKeys.forEach((slot, i) => {
      const letter = slotAssignment[i]
      const team = best8thirds.find(t => t.letter === letter) ?? null
      thirdBySlot[`3rd${slot}`] = team
    })
  } else {
    // Fallback: fill slots in rank order
    slotKeys.forEach((slot, i) => {
      thirdBySlot[`3rd${slot}`] = best8thirds[i] ?? null
    })
  }

  const resolveTeam = (desc: string): QualifiedTeam | null => {
    if (desc.startsWith('3rd')) return thirdBySlot[desc] ?? null
    const pos = desc[0] === '1' ? 1 : 2
    const letter = desc[1]
    const g = byLetter.get(letter)
    if (!g) return null
    return makeQT(g, pos)
  }

  return {
    matchups: R32_ORDER.map(slotKey => ({
      matchKey: `R32_M${slotKey}`,
      slotKey,
      home: resolveTeam(R32_STRUCTURE[slotKey][0]),
      away: resolveTeam(R32_STRUCTURE[slotKey][1]),
    })),
    slotAssignmentValid: !!slotAssignment,
  }
}

// ── Bracket tree helpers ───────────────────────────────────────────────────────

// Maps round keys → array of matchKeys in order
// Display order matches the binary-tree layout used for alignment:
// pairs (2k, 2k+1) in R32 feed R16 match k, etc.
// [74,77,73,75, 83,84,81,82, 76,78,79,80, 86,88,85,87]
export const BRACKET_STRUCTURE = {
  R32: [74,77,73,75, 83,84,81,82, 76,78,79,80, 86,88,85,87].map(n => `R32_M${n}`),
  R16: ["R16_1","R16_2","R16_3","R16_4","R16_5","R16_6","R16_7","R16_8"],
  QF:  ["QF_1","QF_2","QF_3","QF_4"],
  SF:  ["SF_1","SF_2"],
  F:   ["F_1"],
}

// Maps which two R32 matches feed into each R16 match
// Based on FIFA progression: M73 winner vs M75 winner → R16_1, etc.
export const R32_TO_R16: Record<string, [string, string]> = {
  "R16_1": ["R32_M74","R32_M77"],  // M89: E/I winners
  "R16_2": ["R32_M73","R32_M75"],  // M90: A/B runners + F/C winners
  "R16_3": ["R32_M83","R32_M84"],  // M93: K/L runners + H/J
  "R16_4": ["R32_M81","R32_M82"],  // M94: D/G winners
  "R16_5": ["R32_M76","R32_M78"],  // M91: C/F + E/I runners
  "R16_6": ["R32_M79","R32_M80"],  // M92: A/L winners
  "R16_7": ["R32_M86","R32_M88"],  // M95: G/H runners + J/D
  "R16_8": ["R32_M85","R32_M87"],  // M96: B/K winners
}

export const R16_TO_QF: Record<string, [string, string]> = {
  "QF_1": ["R16_1","R16_2"],  // M97
  "QF_2": ["R16_3","R16_4"],  // M98
  "QF_3": ["R16_5","R16_6"],  // M99
  "QF_4": ["R16_7","R16_8"],  // M100
}

export const QF_TO_SF: Record<string, [string, string]> = {
  "SF_1": ["QF_1","QF_2"],
  "SF_2": ["QF_3","QF_4"],
}

export const SF_TO_F: Record<string, [string, string]> = {
  "F_1": ["SF_1","SF_2"],
}

// Get the seeded (R32) home/away team for a given match slot
export function getSeededTeams(
  slot: string,
  r32: R32Matchup[],
  picks: Record<string, string>
): [string | null, string | null] {
  if (slot.startsWith('R32_')) {
    const m = r32.find(m => m.matchKey === slot)
    if (!m) return [null, null]
    return [m.home?.team ?? null, m.away?.team ?? null]
  }
  if (slot.startsWith('R16_')) {
    const feeders = R32_TO_R16[slot]
    if (!feeders) return [null, null]
    return [picks[feeders[0]] ?? null, picks[feeders[1]] ?? null]
  }
  if (slot.startsWith('QF_')) {
    const feeders = R16_TO_QF[slot]
    if (!feeders) return [null, null]
    return [picks[feeders[0]] ?? null, picks[feeders[1]] ?? null]
  }
  if (slot.startsWith('SF_')) {
    const feeders = QF_TO_SF[slot]
    if (!feeders) return [null, null]
    return [picks[feeders[0]] ?? null, picks[feeders[1]] ?? null]
  }
  if (slot.startsWith('F_')) {
    const feeders = SF_TO_F[slot]
    if (!feeders) return [null, null]
    return [picks[feeders[0]] ?? null, picks[feeders[1]] ?? null]
  }
  return [null, null]
}

// All downstream match keys that depend on a given match key
export function getDownstreamKeys(matchKey: string): string[] {
  const all = [
    ...Object.entries(R32_TO_R16),
    ...Object.entries(R16_TO_QF),
    ...Object.entries(QF_TO_SF),
    ...Object.entries(SF_TO_F),
  ] as [string, [string, string]][]

  const result: string[] = []
  const queue = [matchKey]
  while (queue.length) {
    const current = queue.shift()!
    for (const [target, [a, b]] of all) {
      if ((a === current || b === current) && !result.includes(target)) {
        result.push(target)
        queue.push(target)
      }
    }
  }
  return result
}
