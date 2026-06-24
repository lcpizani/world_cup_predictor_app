'use client'

import Link from 'next/link'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'
import { clearLocaleCookie, getLocaleCookie, setLocaleCookie, type SupportedLocale } from '@/lib/locale'
import { useTranslations } from 'next-intl'

const subscribeNoop = () => () => {}
const getAuthSnapshot = () => !!Cookies.get('is_authenticated')
const getAuthServerSnapshot = () => false

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'text-white bg-white/10'
          : 'text-[#6b7f96] hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      {children}
      {active && (
        <span
          className="absolute -bottom-px left-1/2 -translate-x-1/2 h-px bg-[#f0b429] rounded-full"
          style={{ width: '55%' }}
        />
      )}
    </Link>
  )
}

function MobileNavLink({
  href,
  active,
  children,
  onClick,
}: {
  href: string
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-[15px] font-semibold transition-colors ${
        active
          ? 'text-white bg-white/[0.07] border border-white/[0.08]'
          : 'text-[#7a8fa8] hover:text-white hover:bg-white/[0.04] border border-transparent'
      }`}
    >
      <span>{children}</span>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#f0b429]" />}
    </Link>
  )
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('help')

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const items = [
    { title: t('auto_saves'), desc: t('auto_saves_desc') },
    { title: t('lock_window'), desc: t('lock_window_desc') },
    { title: t('change_prediction'), desc: t('change_prediction_desc') },
    { title: t('knockout_stages'), desc: t('knockout_stages_desc') },
    { title: t('knockout_scoring'), desc: t('knockout_scoring_desc') },
    { title: t('live_results'), desc: t('live_results_desc') },
    { title: t('calendar_page'), desc: t('calendar_page_desc') },
    { title: t('stats_page'), desc: t('stats_page_desc') },
    { title: t('export_calendar'), desc: t('export_calendar_desc') },
  ]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/[0.09] shadow-2xl flex flex-col"
        style={{ background: 'rgba(10,16,28,0.97)', maxHeight: 'calc(100dvh - 3rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07] shrink-0">
          <h2 className="text-white font-bold text-base tracking-wide">
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="text-[#4a5c70] hover:text-white transition-colors text-xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.06]"
          >
            ×
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {items.map((item) => (
            <div key={item.title}>
              <p className="text-[#f0b429] text-sm font-semibold mb-1">{item.title}</p>
              <p className="text-[#8496b0] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 shrink-0 border-t border-white/[0.07]">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#6b7f96] border border-white/[0.08] hover:bg-white/[0.05] hover:text-white transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const qc = useQueryClient()
  const t = useTranslations('nav')
  const tHelp = useTranslations('help')

  const hasToken = useSyncExternalStore(subscribeNoop, getAuthSnapshot, getAuthServerSnapshot)
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [locale, setLocale] = useState<SupportedLocale>('en')

  useEffect(() => {
    setLocale(getLocaleCookie())
  }, [])

  function toggleLocale(lang: SupportedLocale) {
    setLocaleCookie(lang)
    setLocale(lang)
    router.refresh()
  }

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    enabled: hasToken,
    retry: false,
  })

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    Cookies.remove('is_authenticated')
    clearLocaleCookie()
    qc.clear()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <>
      <nav className="glass sticky top-0 z-50 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-[60px]">

          {/* Logo */}
          <Link
            href={hasToken ? '/dashboard' : '/'}
            className="group flex items-center gap-2.5 shrink-0"
            onClick={() => setOpen(false)}
          >
            <div className="font-[family-name:var(--font-oswald)] font-bold text-[1.15rem] tracking-widest uppercase leading-none">
              <span className="text-[#f0b429]">WC</span>
              <span className="text-white">26</span>
            </div>
            <span className="h-4 w-px bg-white/15" />
            <span className="text-[0.7rem] font-semibold text-[#4a5c70] group-hover:text-[#8496b0] transition-colors uppercase tracking-[0.22em]">
              {t('predictor')}
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {user ? (
              <>
                <NavLink href="/dashboard" active={isActive('/dashboard')}>{t('dashboard')}</NavLink>
                <NavLink href="/leagues" active={isActive('/leagues')}>{t('leagues')}</NavLink>
                <NavLink href="/predictions" active={isActive('/predictions')}>{t('my_picks')}</NavLink>
                <NavLink href="/standings" active={isActive('/standings')}>{t('standings')}</NavLink>
                <NavLink href="/calendar" active={isActive('/calendar')}>{t('calendar')}</NavLink>
                <NavLink href="/stats" active={isActive('/stats')}>{t('stats')}</NavLink>
                <NavLink href="/simulate" active={isActive('/simulate')}>{t('simulate')}</NavLink>
                {user.is_admin && (
                  <NavLink href="/admin" active={isActive('/admin')}>{t('admin')}</NavLink>
                )}
                {/* Help button */}
                <button
                  onClick={() => setHelpOpen(true)}
                  aria-label="Help"
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-[#4a5c70] border border-white/[0.12] hover:text-white hover:border-white/25 hover:bg-white/[0.06] transition-all duration-200 ml-1"
                >
                  ?
                </button>
                <span className="h-4 w-px bg-white/[0.08] mx-1.5" />
                <Link
                  href="/profile"
                  className="text-[#3f5068] hover:text-white transition-colors text-sm px-2 py-1.5 font-medium rounded-lg hover:bg-white/[0.06] truncate max-w-[140px]"
                >
                  {user.display_name ?? user.username}
                </Link>
                <button
                  onClick={logout}
                  className="text-[#3f5068] hover:text-red-400/80 transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-red-500/[0.07] cursor-pointer"
                >
                  {t('logout')}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {/* Language toggle — unauthenticated only */}
                <div className="flex items-center rounded-lg overflow-hidden border border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {(['en', 'pt'] as SupportedLocale[]).map(lang => (
                    <button
                      key={lang}
                      onClick={() => toggleLocale(lang)}
                      className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all duration-200"
                      style={locale === lang
                        ? { background: 'rgba(240,180,41,0.15)', color: '#f0b429' }
                        : { color: '#3f5068' }
                      }
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <Link
                  href="/auth/login"
                  className="text-[#6b7f96] hover:text-white transition-colors font-medium px-4 py-1.5 rounded-lg hover:bg-white/[0.06] text-sm"
                >
                  {t('log_in')}
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-[#f0b429] text-[#080c14] px-5 py-1.5 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-[#fcd86e] transition-all duration-200"
                >
                  {t('register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile: compact actions */}
          <div className="md:hidden flex items-center gap-2">
            {!user && !hasToken && (
              <Link
                href="/auth/login"
                className="text-[#7a8fa8] hover:text-white transition-colors font-medium text-sm px-3 py-1.5 rounded-lg"
              >
                {t('log_in')}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              className="relative flex items-center justify-center w-10 h-10 rounded-lg text-white border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] transition-colors"
            >
              <span className="sr-only">Toggle menu</span>
              <span className="relative block w-4 h-4">
                <span
                  className={`absolute left-0 right-0 h-[2px] bg-current rounded-full transition-all duration-300 ${
                    open ? 'top-[7px] rotate-45' : 'top-[2px]'
                  }`}
                />
                <span
                  className={`absolute left-0 right-0 top-[7px] h-[2px] bg-current rounded-full transition-all duration-200 ${
                    open ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`absolute left-0 right-0 h-[2px] bg-current rounded-full transition-all duration-300 ${
                    open ? 'top-[7px] -rotate-45' : 'top-[12px]'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-x-0 top-[60px] bottom-0 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />

        {/* Sheet */}
        <div
          className={`absolute top-0 inset-x-0 glass border-b border-white/[0.07] transition-transform duration-300 ease-out ${
            open ? 'translate-y-0' : '-translate-y-2'
          }`}
        >
          <div className="px-4 py-4 space-y-1.5 max-h-[calc(100vh-60px)] overflow-y-auto">
            {user ? (
              <>
                <MobileNavLink href="/dashboard" active={isActive('/dashboard')} onClick={() => setOpen(false)}>{t('dashboard')}</MobileNavLink>
                <MobileNavLink href="/leagues" active={isActive('/leagues')} onClick={() => setOpen(false)}>{t('leagues')}</MobileNavLink>
                <MobileNavLink href="/predictions" active={isActive('/predictions')} onClick={() => setOpen(false)}>{t('my_picks')}</MobileNavLink>
                <MobileNavLink href="/standings" active={isActive('/standings')} onClick={() => setOpen(false)}>{t('standings')}</MobileNavLink>
                <MobileNavLink href="/calendar" active={isActive('/calendar')} onClick={() => setOpen(false)}>{t('calendar')}</MobileNavLink>
                <MobileNavLink href="/stats" active={isActive('/stats')} onClick={() => setOpen(false)}>{t('stats')}</MobileNavLink>
                <MobileNavLink href="/simulate" active={isActive('/simulate')} onClick={() => setOpen(false)}>{t('simulate')}</MobileNavLink>
                {user.is_admin && (
                  <MobileNavLink href="/admin" active={isActive('/admin')} onClick={() => setOpen(false)}>{t('admin')}</MobileNavLink>
                )}

                {/* Help row */}
                <button
                  onClick={() => { setOpen(false); setHelpOpen(true) }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[15px] font-semibold text-[#7a8fa8] hover:text-white hover:bg-white/[0.04] border border-transparent transition-colors"
                >
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border border-white/[0.15] text-[#4a5c70] shrink-0">?</span>
                  <span>{tHelp('title')}</span>
                </button>

                <div className="h-px bg-white/[0.06] my-3" />

                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-[family-name:var(--font-oswald)] font-bold text-[#f0b429] text-sm uppercase tracking-wider"
                       style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.22)' }}>
                    {(user.display_name ?? user.username).slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate leading-tight">{user.display_name ?? user.username}</p>
                    <p className="text-[#5a6a82] text-xs mt-0.5">{t('view_profile')}</p>
                  </div>
                </Link>

                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-3 rounded-xl text-[#f87171] hover:bg-red-500/[0.08] transition-colors text-sm font-semibold border border-transparent hover:border-red-500/15"
                >
                  {t('logout')}
                </button>
              </>
            ) : (
              <div className="space-y-2 py-2">
                {/* Language toggle in mobile drawer */}
                <div className="flex items-center justify-center gap-1 pb-1">
                  {(['en', 'pt'] as SupportedLocale[]).map(lang => (
                    <button
                      key={lang}
                      onClick={() => { toggleLocale(lang); setOpen(false) }}
                      className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200"
                      style={locale === lang
                        ? { background: 'rgba(240,180,41,0.15)', color: '#f0b429', border: '1px solid rgba(240,180,41,0.3)' }
                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#3f5068' }
                      }
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="block w-full text-center text-white px-4 py-3 rounded-xl font-semibold text-sm border border-white/[0.1] hover:bg-white/[0.04] transition-colors"
                >
                  {t('log_in')}
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setOpen(false)}
                  className="block w-full text-center bg-[#f0b429] text-[#080c14] px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-[#fcd86e] transition-colors"
                >
                  {t('register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help modal */}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </>
  )
}
