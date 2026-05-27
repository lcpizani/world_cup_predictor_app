import Cookies from 'js-cookie'
import type {
  LeaderboardResponse,
  Match,
  Prediction,
  Tournament,
  TournamentMember,
  User,
} from '@/types/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

function getToken(): string {
  if (typeof window === 'undefined') return ''
  return Cookies.get('auth_token') ?? ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `Request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  getMe: () => request<User>('/auth/me'),

  // ── Tournaments ───────────────────────────────────────────────────────────
  listTournaments: () => request<Tournament[]>('/tournaments/'),
  getTournament: (id: string) => request<Tournament>(`/tournaments/${id}`),
  createTournament: (data: {
    name: string
    scoring_rules: {
      correct_result_pts: number
      correct_winner_pts: number
      correct_goal_diff_pts: number
      correct_goals_one_team_pts: number
    }
  }) => request<Tournament>('/tournaments/', { method: 'POST', body: JSON.stringify(data) }),
  joinTournament: (invite_code: string) =>
    request<TournamentMember>('/tournaments/join', {
      method: 'POST',
      body: JSON.stringify({ invite_code }),
    }),
  getLeaderboard: (id: string) =>
    request<LeaderboardResponse>(`/tournaments/${id}/leaderboard`),

  // ── Matches ───────────────────────────────────────────────────────────────
  createMatch: (data: {
    home_team: string
    away_team: string
    kickoff_at: string
    stage: string
  }) => request<Match>('/matches/', { method: 'POST', body: JSON.stringify(data) }),

  listMatches: (filters?: { stage?: string; match_status?: string }) => {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters ?? {}).filter(([, v]) => v !== undefined)
      ) as Record<string, string>
    )
    const qs = params.toString()
    return request<Match[]>(`/matches/${qs ? `?${qs}` : ''}`)
  },

  // ── Predictions ───────────────────────────────────────────────────────────
  listPredictions: (tournament_id: string) =>
    request<Prediction[]>(`/predictions/?tournament_id=${tournament_id}`),
  submitPrediction: (data: {
    match_id: string
    tournament_id: string
    predicted_home: number
    predicted_away: number
  }) =>
    request<Prediction>('/predictions/', { method: 'POST', body: JSON.stringify(data) }),
  updatePrediction: (
    id: string,
    data: { predicted_home: number; predicted_away: number }
  ) =>
    request<Prediction>(`/predictions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ── Admin ─────────────────────────────────────────────────────────────────
  applyResult: (match_id: string, home_score: number, away_score: number) =>
    request<Match>(`/matches/${match_id}/result`, {
      method: 'PUT',
      body: JSON.stringify({ home_score, away_score, status: 'finished' }),
    }),
  recompute: (tournament_id: string) =>
    request<{ recomputed_matches: number; recomputed_predictions: number }>(
      `/admin/tournaments/${tournament_id}/recompute`,
      { method: 'POST' }
    ),
  resetAllMatches: () =>
    request<{ ok: boolean }>('/admin/matches/reset', { method: 'DELETE' }),
  syncMatches: (competition_code = 'WC') =>
    request<{ upserted: number }>(
      `/admin/sync/matches?competition_code=${competition_code}`,
      { method: 'POST' }
    ),
  syncResults: (competition_code = 'WC') =>
    request<{ scored: number }>(
      `/admin/sync/results?competition_code=${competition_code}`,
      { method: 'POST' }
    ),
}
