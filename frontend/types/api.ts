export interface User {
  id: string
  email: string
  username: string
  display_name: string | null
  avatar_url: string | null
  is_admin: boolean
  language: string | null
  timezone: string | null
  created_at: string
}

export interface UserProfile {
  id: string
  username: string
  display_name: string | null
  created_at: string
  tournaments_count: number
  total_points: number
}

export interface PredictionHistoryItem {
  match_id: string
  home_team: string
  away_team: string
  kickoff_at: string
  predicted_home: number | null
  predicted_away: number | null
  actual_home: number | null
  actual_away: number | null
  points_awarded: number | null
}

export interface ScoringRules {
  correct_result_pts: number
  correct_winner_pts: number
  correct_goal_diff_pts: number
  correct_goals_one_team_pts: number
}

export interface Tournament {
  id: string
  name: string
  invite_code: string
  is_active: boolean
  scoring_rules: ScoringRules
  created_at: string
  created_by: string
  creator: User
}

export interface TournamentMember {
  id: string
  tournament_id: string
  user_id: string
  total_points: number
  joined_at: string
  user: User
}

export interface Match {
  id: string
  external_match_id: string | null
  home_team: string
  away_team: string
  kickoff_at: string
  stage: string
  group: string | null
  status: MatchStatus
  home_score: number | null
  away_score: number | null
  created_at: string
}

export interface Prediction {
  id: string
  user_id: string
  match_id: string
  predicted_home: number
  predicted_away: number
  is_locked: boolean
  points_awarded: number | null
  submitted_at: string
  match: Match
}

export interface TournamentComparePrediction {
  user_id: string
  username: string
  predicted_home: number | null
  predicted_away: number | null
  points_awarded: number | null
}

export interface TournamentCompareMatch {
  match: Match
  predictions: TournamentComparePrediction[]
}

export interface LeaderboardEntry {
  rank: number
  user: User
  total_points: number
}

export interface LeaderboardResponse {
  tournament_id: string
  entries: LeaderboardEntry[]
}

export interface LiveLeaderboardEntry {
  rank: number
  user: User
  total_points: number
  provisional_points: number
  live_total: number
}

export interface LiveLeaderboardResponse {
  tournament_id: string
  has_live_matches: boolean
  entries: LiveLeaderboardEntry[]
}

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'suspended'
