import type {
  BracketSlot,
  GroupData,
  LeaderboardResponse,
  LiveLeaderboardResponse,
  Match,
  Prediction,
  PredictionHistoryItem,
  Tournament,
  TournamentCompareMatch,
  TournamentMember,
  User,
  UserProfile,
} from '@/types/api'

const BASE_URL = typeof window === 'undefined'
  ? (process.env.BACKEND_URL ?? 'http://localhost:8080')
  : '/api/proxy'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Auth is forwarded by the same-origin /api/proxy route, which reads the
  // httpOnly cookie and injects the Authorization header server-side.
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
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
  updateMe: (data: { username?: string; display_name?: string; language?: string; timezone?: string }) =>
    request<User>('/users/me', { method: 'PUT', body: JSON.stringify(data) }),

  // ── Users ─────────────────────────────────────────────────────────────────
  getUserProfile: (username: string) => request<UserProfile>(`/users/${username}`),
  getUserPredictions: (username: string) => request<PredictionHistoryItem[]>(`/users/${username}/predictions`),

  // ── Tournaments ───────────────────────────────────────────────────────────
  listTournaments: () => request<Tournament[]>('/tournaments'),
  getTournamentPreview: (code: string) => request<{ name: string }>(`/tournaments/${code}/preview`),
  getTournament: (code: string) => request<Tournament>(`/tournaments/${code}`),
  createTournament: (data: {
    name: string
    scoring_rules: {
      correct_result_pts: number
      correct_winner_pts: number
      correct_goal_diff_pts: number
      correct_goals_one_team_pts: number
    }
  }) => request<Tournament>('/tournaments', { method: 'POST', body: JSON.stringify(data) }),
  joinTournament: (invite_code: string) =>
    request<TournamentMember>('/tournaments/join', {
      method: 'POST',
      body: JSON.stringify({ invite_code }),
    }),
  deleteTournament: (invite_code: string) =>
    request<void>(`/tournaments/${invite_code}`, { method: 'DELETE' }),
  getLeaderboard: (code: string) =>
    request<LeaderboardResponse>(`/tournaments/${code}/leaderboard`),
  getLiveLeaderboard: (code: string) =>
    request<LiveLeaderboardResponse>(`/tournaments/${code}/leaderboard/live`),
  listCompare: (code: string) =>
    request<TournamentCompareMatch[]>(`/tournaments/${code}/compare`),

  // ── Matches ───────────────────────────────────────────────────────────────
  createMatch: (data: {
    home_team: string
    away_team: string
    kickoff_at: string
    stage: string
  }) => request<Match>('/matches', { method: 'POST', body: JSON.stringify(data) }),

  listMatches: (filters?: { stage?: string; match_status?: string }) => {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters ?? {}).filter(([, v]) => v !== undefined)
      ) as Record<string, string>
    )
    const qs = params.toString()
    return request<Match[]>(`/matches${qs ? `?${qs}` : ''}`)
  },

  // ── Predictions ───────────────────────────────────────────────────────────
  listPredictions: (tournament_id?: string) =>
    request<Prediction[]>(tournament_id ? `/predictions?tournament_id=${tournament_id}` : '/predictions'),
  submitPrediction: (data: {
    match_id: string
    predicted_home: number
    predicted_away: number
  }) =>
    request<Prediction>('/predictions', { method: 'POST', body: JSON.stringify(data) }),
  updatePrediction: (
    id: string,
    data: { predicted_home: number; predicted_away: number }
  ) =>
    request<Prediction>(`/predictions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // ── Standings & Bracket ───────────────────────────────────────────────────
  getStandings: () => request<GroupData[]>('/standings'),
  getBracket: () => request<BracketSlot[]>('/standings/bracket'),

  // ── Admin ─────────────────────────────────────────────────────────────────
  getRegistrationInvite: () => request<{ invite_code: string }>('/admin/registration-invite'),
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
  syncStandings: (competition_code = 'WC') =>
    request<{ synced: number }>(
      `/admin/sync/standings?competition_code=${competition_code}`,
      { method: 'POST' }
    ),
}
