'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import type { Match } from '@/types/api'
import { getTeamFlagCode, getFlagUrl, translateTeamName } from '@/lib/flags'
import { formatMatchDateTime } from '@/lib/date'
import { triggerIcsDownload } from '@/lib/ical'
import { api } from '@/lib/api'

interface Props {
  matches: Match[]      // only upcoming scheduled matches
  timezone?: string | null
  userEmail?: string | null
  onClose: () => void
}

type EmailStatus = 'idle' | 'sending' | 'sent' | 'error'

const STAGE_ORDER = ['group_stage', 'round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'final']

function Flag({ name }: { name: string }) {
  const code = getTeamFlagCode(name)
  if (!code) return null
  return (
    <div className="w-7 h-5 rounded overflow-hidden shrink-0" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      <Image src={getFlagUrl(code, 40)} alt={name} width={28} height={20} className="w-full h-full object-cover" unoptimized />
    </div>
  )
}

export default function CalendarExportModal({ matches, timezone, userEmail, onClose }: Props) {
  const locale = useLocale()
  const t = useTranslations('calendarExport')
  const tPred = useTranslations('predictions')

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(matches.map(m => m.id)))
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle')

  const stageLabel = (stage: string): string => {
    const key = `stage_${stage}` as Parameters<typeof tPred>[0]
    try { return tPred(key) } catch { return stage.replace(/_/g, ' ') }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return matches
    const s = search.toLowerCase()
    return matches.filter(m => {
      const homeRaw = m.home_team.toLowerCase()
      const awayRaw = m.away_team.toLowerCase()
      const homeTr = translateTeamName(m.home_team, locale).toLowerCase()
      const awayTr = translateTeamName(m.away_team, locale).toLowerCase()
      return homeRaw.includes(s) || awayRaw.includes(s) || homeTr.includes(s) || awayTr.includes(s)
    })
  }, [matches, search, locale])

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const m of filtered) {
      const stage = STAGE_ORDER.includes(m.stage) ? m.stage : 'other'
      if (!map.has(stage)) map.set(stage, [])
      map.get(stage)!.push(m)
    }
    map.forEach(g => g.sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()))
    const orderedKeys = [...STAGE_ORDER, 'other'].filter(k => map.has(k))
    return orderedKeys.map(k => ({ stage: k, matches: map.get(k)! }))
  }, [filtered])

  const filteredIds = useMemo(() => new Set(filtered.map(m => m.id)), [filtered])
  const allFilteredSelected = filtered.length > 0 && filtered.every(m => selected.has(m.id))
  const selectedCount = matches.filter(m => selected.has(m.id)).length

  function toggleMatch(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        filteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  function handleDownload() {
    const toExport = matches.filter(m => selected.has(m.id))
    triggerIcsDownload(toExport, locale)
    onClose()
  }

  async function handleEmail() {
    if (emailStatus === 'sending' || selectedCount === 0) return
    setEmailStatus('sending')
    try {
      await api.emailCalendar(Array.from(selected), locale)
      setEmailStatus('sent')
    } catch {
      setEmailStatus('error')
    }
  }

  const countLabel = search.trim() && filtered.length < matches.length
    ? t('count_filtered', { shown: filtered.length, total: matches.length })
    : t('count_upcoming', { count: matches.length })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4 py-0 sm:py-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative z-10 w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: '#080c14',
          border: '1px solid rgba(90,140,220,0.25)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 60px rgba(90,140,220,0.07)',
          maxHeight: '90vh',
        }}
      >
        {/* Blue accent bar */}
        <div className="h-[3px] w-full shrink-0" style={{ background: 'linear-gradient(90deg, rgba(90,140,220,0.4), rgba(90,140,220,0.8), rgba(90,140,220,0.4))' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#5a8fdf' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="12" y1="14" x2="12" y2="18" />
              <line x1="10" y1="16" x2="14" y2="16" />
            </svg>
            <span className="font-[family-name:var(--font-oswald)] font-bold text-base uppercase tracking-wider text-white">
              {t('title')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: '#3f5068' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3f5068'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search + Select All */}
        <div className="px-4 pt-3 pb-2 shrink-0 space-y-2">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#3f5068' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('filter_placeholder')}
              className="w-full pl-8 pr-3 py-2 rounded-xl text-sm text-white transition-all"
              style={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)', outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(90,140,220,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,140,220,0.08)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3f5068] hover:text-white transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Select all row */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-xs font-semibold transition-colors"
              style={{ color: allFilteredSelected ? '#5a8fdf' : '#5a6a82' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = allFilteredSelected ? '#8aabdf' : 'white' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = allFilteredSelected ? '#5a8fdf' : '#5a6a82' }}
            >
              <span
                className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                style={allFilteredSelected
                  ? { background: '#5a8fdf', border: '1px solid #5a8fdf' }
                  : { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }
                }
              >
                {allFilteredSelected && (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                )}
              </span>
              {allFilteredSelected ? t('deselect_all') : t('select_all')}
              {search.trim() && filtered.length > 0 && (
                <span className="text-[10px] font-normal" style={{ color: '#3f5068' }}>
                  {t('shown', { count: filtered.length })}
                </span>
              )}
            </button>
            <span className="text-[11px] font-medium" style={{ color: '#3f5068' }}>
              {countLabel}
            </span>
          </div>
        </div>

        {/* Match list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3 min-h-0">
          {filtered.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm font-medium" style={{ color: '#3f5068' }}>{t('no_matches')}</p>
            </div>
          )}

          {grouped.map(({ stage, matches: stageMatches }) => (
            <div key={stage}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-0.5" style={{ color: '#3f5068' }}>
                {stageLabel(stage)}
              </p>
              <div className="space-y-1">
                {stageMatches.map(m => {
                  const isSelected = selected.has(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMatch(m.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                      style={{
                        background: isSelected ? 'rgba(90,140,220,0.07)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid rgba(90,140,220,0.2)' : '1px solid rgba(255,255,255,0.05)',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'
                      }}
                    >
                      {/* Checkbox */}
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                        style={isSelected
                          ? { background: '#5a8fdf', border: '1px solid #5a8fdf' }
                          : { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }
                        }
                      >
                        {isSelected && (
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                      </span>

                      {/* Teams */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Flag name={m.home_team} />
                        <span className="font-[family-name:var(--font-oswald)] font-semibold text-sm text-white uppercase tracking-wide truncate">
                          {translateTeamName(m.home_team, locale)}
                        </span>
                        <span className="text-[10px] font-bold shrink-0" style={{ color: '#2d3e52' }}>vs</span>
                        <span className="font-[family-name:var(--font-oswald)] font-semibold text-sm text-white uppercase tracking-wide truncate">
                          {translateTeamName(m.away_team, locale)}
                        </span>
                        <Flag name={m.away_team} />
                      </div>

                      {/* Date */}
                      <span className="text-[10px] font-medium shrink-0 text-right" style={{ color: '#5a6a82' }}>
                        {formatMatchDateTime(m.kickoff_at, timezone, locale)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Selected count */}
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <span className="text-xs font-medium" style={{ color: '#5a6a82' }}>
              {t('selected_count', { count: selectedCount })}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Email button */}
            {userEmail && (
              <button
                onClick={handleEmail}
                disabled={selectedCount === 0 || emailStatus === 'sending' || emailStatus === 'sent'}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'transparent',
                  border: emailStatus === 'sent'
                    ? '1px solid rgba(74,222,128,0.5)'
                    : emailStatus === 'error'
                    ? '1px solid rgba(248,113,113,0.5)'
                    : '1px solid rgba(90,140,220,0.35)',
                  color: emailStatus === 'sent' ? '#4ade80' : emailStatus === 'error' ? '#f87171' : '#5a8fdf',
                }}
                onMouseEnter={e => {
                  if (selectedCount > 0 && emailStatus === 'idle')
                    (e.currentTarget as HTMLElement).style.background = 'rgba(90,140,220,0.08)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {emailStatus === 'sending' ? (
                  <>
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    {t('email_sending')}
                  </>
                ) : emailStatus === 'sent' ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {t('email_sent')}
                  </>
                ) : emailStatus === 'error' ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {t('email_error')}
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    {t('email_btn')}
                  </>
                )}
              </button>
            )}

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={selectedCount === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: '#5a8fdf', color: 'white' }}
              onMouseEnter={e => { if (selectedCount > 0) (e.currentTarget as HTMLElement).style.background = '#7aaaf0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#5a8fdf' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('download')}
            </button>
          </div>

          {/* Import hint */}
          <p className="mt-2.5 text-[11px] leading-relaxed text-center" style={{ color: '#3f5068' }}>
            {t('import_hint')}
          </p>
        </div>
      </div>
    </div>
  )
}
