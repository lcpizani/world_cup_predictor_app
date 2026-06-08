'use client'

import { useTranslations } from 'next-intl'

interface Props {
  open: boolean
  onClose: () => void
}

const CATEGORIES = [
  { icon: '🎯', nameKey: 'cat_exact_name', descKey: 'cat_exact_desc', color: 'green' },
  { icon: '🏆', nameKey: 'cat_winner_name', descKey: 'cat_winner_desc', color: 'yellow' },
  { icon: '⚖️', nameKey: 'cat_diff_name', descKey: 'cat_diff_desc', color: 'yellow' },
  { icon: '⚽', nameKey: 'cat_one_team_name', descKey: 'cat_one_team_desc', color: 'yellow' },
] as const

const EXAMPLES = [
  { predKey: 'example_1_prediction', earnedKey: 'example_1_earned', highlight: 'green' },
  { predKey: 'example_2_prediction', earnedKey: 'example_2_earned', highlight: 'yellow' },
  { predKey: 'example_3_prediction', earnedKey: 'example_3_earned', highlight: 'yellow' },
  { predKey: 'example_4_prediction', earnedKey: 'example_4_earned', highlight: 'yellow' },
  { predKey: 'example_5_prediction', earnedKey: 'example_5_earned', highlight: 'none' },
] as const

export default function ScoringExplanationModal({ open, onClose }: Props) {
  const t = useTranslations('scoringHelp')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl overflow-y-auto"
        style={{
          background: 'linear-gradient(160deg, rgba(170,255,0,0.06) 0%, #060f18 30%)',
          border: '1px solid rgba(170,255,0,0.35)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 60px rgba(170,255,0,0.1), inset 0 1px 0 rgba(170,255,0,0.2)',
          maxHeight: '90vh',
        }}
      >
        {/* Teal accent line */}
        <div
          className="h-[2px] w-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(170,255,0,0.8), transparent)' }}
        />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-white leading-tight">
                {t('title')}
              </h2>
              <p className="text-sm mt-1.5" style={{ color: '#5a6a82' }}>
                {t('subtitle')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: '#aaff00', opacity: 0.6 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6' }}
            >
              ✕
            </button>
          </div>

          {/* Categories */}
          <div className="mb-6">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] mb-3" style={{ color: '#aaff00' }}>
              {t('categories_title')}
            </p>
            <div className="space-y-2.5">
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.nameKey}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={cat.color === 'green'
                    ? { background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)' }
                    : { background: 'rgba(240,180,41,0.05)', border: '1px solid rgba(240,180,41,0.15)' }
                  }
                >
                  <span className="text-xl shrink-0 mt-0.5">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: cat.color === 'green' ? '#22c55e' : '#f0b429' }}
                    >
                      {t(cat.nameKey)}
                    </span>
                    <p className="text-xs mt-0.5" style={{ color: '#5a6a82' }}>{t(cat.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div className="space-y-3 mb-6">
            {/* Exclusivity */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
            >
              <p className="text-sm font-bold text-green-400 mb-1">{t('exclusivity_title')}</p>
              <p className="text-xs leading-relaxed" style={{ color: '#5a8a6a' }}>
                {t('exclusivity_desc')}
              </p>
            </div>

            {/* Stacking */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(240,180,41,0.06)', border: '1px solid rgba(240,180,41,0.15)' }}
            >
              <p className="text-sm font-bold mb-1" style={{ color: '#f0b429' }}>{t('stacking_title')}</p>
              <p className="text-xs leading-relaxed" style={{ color: '#8a7040' }}>
                {t('stacking_desc')}
              </p>
            </div>

            {/* Knockout matches */}
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.18)' }}
            >
              <p className="text-sm font-bold mb-1" style={{ color: '#63b3ed' }}>{t('knockout_title')}</p>
              <p className="text-xs leading-relaxed" style={{ color: '#4a6e8a' }}>
                {t('knockout_desc')}
              </p>
            </div>
          </div>

          {/* Worked examples */}
          <div className="mb-6">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] mb-1" style={{ color: '#aaff00' }}>
              {t('examples_title')}
            </p>
            <p className="text-xs mb-3" style={{ color: '#3f5068' }}>
              {t('examples_result')}
            </p>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {/* Table header */}
              <div
                className="grid grid-cols-[1fr_2fr] gap-3 px-4 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#3f5068' }}>
                  {t('examples_col_prediction')}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#3f5068' }}>
                  {t('examples_col_earned')}
                </span>
              </div>

              {/* Rows */}
              {EXAMPLES.map((ex, i) => (
                <div
                  key={ex.predKey}
                  className="grid grid-cols-[1fr_2fr] gap-3 px-4 py-3 items-center"
                  style={{
                    borderBottom: i < EXAMPLES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <span
                    className="font-[family-name:var(--font-oswald)] font-bold text-base tabular-nums"
                    style={{
                      color: ex.highlight === 'green' ? '#22c55e'
                        : ex.highlight === 'yellow' ? '#f0b429'
                        : '#3f5068',
                    }}
                  >
                    {t(ex.predKey)}
                  </span>
                  <span className="text-xs leading-snug" style={{ color: ex.highlight === 'none' ? '#3f5068' : '#8496af' }}>
                    {t(ex.earnedKey)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <p className="text-xs leading-relaxed mb-6" style={{ color: '#3f5068' }}>
            {t('note')}
          </p>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200"
            style={{ background: 'rgba(170,255,0,0.12)', border: '1px solid rgba(170,255,0,0.3)', color: '#aaff00' }}
            onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(170,255,0,0.2)', borderColor: 'rgba(170,255,0,0.55)' }) }}
            onMouseLeave={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(170,255,0,0.12)', borderColor: 'rgba(170,255,0,0.3)' }) }}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
