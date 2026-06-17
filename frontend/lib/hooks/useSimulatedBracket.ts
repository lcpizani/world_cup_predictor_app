'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  computeGroupStandings,
  buildR32Bracket,
  type R32Matchup,
  type SimulatedGroup,
} from '@/lib/simulation'

export type SimulateMode = 'real' | 'predictions'

export interface SimulatedBracketResult {
  r32Matchups: R32Matchup[]
  groups: SimulatedGroup[]
  hasPredictions: boolean
  slotAssignmentValid: boolean
  predictedCount: number
  totalGroupMatches: number
  isLoading: boolean
  isError: boolean
}

export function useSimulatedBracket(mode: SimulateMode = 'real'): SimulatedBracketResult {
  const { data: matches = [], isLoading: loadingMatches, isError: errMatches } = useQuery({
    queryKey: ['matches', { stage: 'group_stage' }],
    queryFn: () => api.listMatches({ stage: 'group_stage' }),
    refetchInterval: mode === 'real' ? 30_000 : false,
  })

  const { data: predictions = [], isLoading: loadingPreds, isError: errPreds } = useQuery({
    queryKey: ['predictions'],
    queryFn: () => api.listPredictions(),
  })

  const isLoading = loadingMatches || loadingPreds
  const isError = errMatches || errPreds

  const groups = useMemo(
    () => computeGroupStandings(matches, predictions, mode === 'real'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches, predictions, mode]
  )

  const { matchups: r32Matchups, slotAssignmentValid } = useMemo(
    () => groups.length > 0 ? buildR32Bracket(groups) : { matchups: [], slotAssignmentValid: false },
    [groups]
  )

  const groupMatchIds = useMemo(() => new Set(matches.map(m => m.id)), [matches])

  const hasPredictions = useMemo(
    () => predictions.some(p => groupMatchIds.has(p.match_id)),
    [predictions, groupMatchIds]
  )

  const predictedCount = useMemo(
    () => predictions.filter(p => groupMatchIds.has(p.match_id)).length,
    [predictions, groupMatchIds]
  )

  return {
    r32Matchups,
    groups,
    hasPredictions,
    slotAssignmentValid,
    predictedCount,
    totalGroupMatches: matches.length,
    isLoading,
    isError,
  }
}
