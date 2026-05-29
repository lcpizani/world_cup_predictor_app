import Link from 'next/link'
import Image from 'next/image'
import { MARQUEE_NATIONS, getFlagUrl } from '@/lib/flags'

const MARQUEE = [...MARQUEE_NATIONS, ...MARQUEE_NATIONS]

const HERO_MATCH = {
  home: { name: 'Brazil', code: 'br', score: 2 },
  away: { name: 'Argentina', code: 'ar', score: 1 },
  minute: "45'",
  stage: 'World Cup Final',
}

const FEATURED: Array<{ name: string; code: string }> = [
  { name: 'Brazil', code: 'br' },
  { name: 'Argentina', code: 'ar' },
  { name: 'France', code: 'fr' },
  { name: 'Germany', code: 'de' },
  { name: 'Spain', code: 'es' },
  { name: 'Portugal', code: 'pt' },
  { name: 'England', code: 'gb-eng' },
  { name: 'Italy', code: 'it' },
  { name: 'Netherlands', code: 'nl' },
  { name: 'Croatia', code: 'hr' },
  { name: 'Morocco', code: 'ma' },
  { name: 'Japan', code: 'jp' },
  { name: 'USA', code: 'us' },
  { name: 'Mexico', code: 'mx' },
  { name: 'Senegal', code: 'sn' },
  { name: 'South Korea', code: 'kr' },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Create a League', desc: 'Set up a private tournament and choose your own scoring rules.' },
  { step: '02', title: 'Invite Friends', desc: 'Share your invite code and get everyone in your league.' },
  { step: '03', title: 'Predict Scores', desc: 'Submit your predicted scores before each match kicks off.' },
  { step: '04', title: 'Win Glory', desc: 'Earn points for every correct prediction. Crown the champion.' },
]

export default function LandingPage() {
  return (
    <div className="bg-[#080c14] text-white overflow-x-hidden">

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center bg-pitch overflow-hidden">

        {/* Atmospheric top light — warm stadium glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(240,180,41,0.11) 0%, rgba(240,160,20,0.04) 45%, transparent 70%)',
          }}
        />

        {/* Secondary ambient from bottom-right */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 40% at 85% 95%, rgba(20,40,80,0.6) 0%, transparent 70%)',
          }}
        />

        {/* Centre-circle watermark — faint football field reference */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]"
          style={{ width: 700, height: 700 }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]"
          style={{ width: 360, height: 360 }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white/[0.08]"
        />

        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24 w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left — copy */}
          <div>
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 animate-fade-up"
              style={{
                background: 'rgba(240,180,41,0.08)',
                border: '1px solid rgba(240,180,41,0.25)',
              }}
            >
              <span className="animate-pulse-live inline-block w-1.5 h-1.5 rounded-full bg-[#f0b429]" />
              <span className="text-[#f0b429] text-xs font-bold tracking-[0.25em] uppercase">
                World Cup 2026 · Predict Now
              </span>
            </div>

            <h1
              className="font-[family-name:var(--font-oswald)] font-bold leading-[0.95] uppercase animate-fade-up-delay"
              style={{ fontSize: 'clamp(2.6rem, 8.5vw, 5.8rem)' }}
            >
              Predict the<br />
              <span className="text-gold-gradient">Beautiful</span>{' '}
              Game
            </h1>

            <p className="mt-6 text-[#7a8fa8] text-[1.05rem] leading-relaxed max-w-[26rem] animate-fade-up-delay2">
              Create private leagues, predict match scores with friends, and
              crown the ultimate football genius. May the best fan win.
            </p>

            <div className="flex flex-wrap gap-3 mt-10 animate-fade-up-delay2">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 bg-[#f0b429] text-[#080c14] px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-[#fcd86e] transition-all duration-200 shadow-lg"
              >
                Get Started
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 border border-white/[0.15] text-white px-8 py-3.5 rounded-xl font-semibold text-sm uppercase tracking-wider hover:border-white/40 hover:bg-white/[0.04] transition-all duration-200"
              >
                Log In
              </Link>
            </div>

            {/* Stats row */}
            <div className="mt-12 flex gap-8 animate-fade-up-delay2">
              {[
                { value: '32', label: 'Nations' },
                { value: '64', label: 'Matches' },
                { value: '∞', label: 'Bragging rights' },
              ].map(({ value, label }) => (
                <div key={label} className="group">
                  <p className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#f0b429] leading-none">
                    {value}
                  </p>
                  <p className="text-[0.65rem] text-[#4a5c70] uppercase tracking-[0.2em] mt-1.5 font-semibold">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — live scoreboard card */}
          <div className="flex justify-center lg:justify-end animate-fade-up-delay animate-float">
            <div
              className="w-full max-w-[340px] rounded-2xl overflow-hidden animate-glow"
              style={{
                background: '#0d1520',
                border: '1px solid rgba(255,255,255,0.09)',
              }}
            >
              {/* Card header */}
              <div
                className="px-5 py-3.5 flex items-center justify-between"
                style={{
                  background: 'linear-gradient(135deg, #c8900a 0%, #f0b429 55%, #f5c842 100%)',
                }}
              >
                <span className="text-[#3a2200] text-[0.7rem] font-bold uppercase tracking-[0.2em]">
                  {HERO_MATCH.stage}
                </span>
                <span className="flex items-center gap-1.5 text-[#3a2200] text-[0.7rem] font-bold uppercase tracking-wider">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-700 animate-pulse-live" />
                  Live {HERO_MATCH.minute}
                </span>
              </div>

              {/* Teams + scores */}
              <div className="px-5 py-7 space-y-5">
                {[HERO_MATCH.home, HERO_MATCH.away].map((team) => (
                  <div key={team.code} className="flex items-center gap-4">
                    <div
                      className="w-14 h-[38px] rounded-md overflow-hidden shrink-0"
                      style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <Image
                        src={getFlagUrl(team.code, 80)}
                        alt={team.name}
                        width={56}
                        height={38}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="flex-1 font-[family-name:var(--font-oswald)] font-semibold text-[1.05rem] uppercase tracking-wider text-white">
                      {team.name}
                    </span>
                    <span className="font-[family-name:var(--font-oswald)] font-bold text-[2.6rem] text-[#f0b429] font-scoreboard leading-none">
                      {team.score}
                    </span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

              {/* "What would you predict?" */}
              <div className="px-5 py-4">
                <p className="text-[0.7rem] text-[#3f5068] text-center font-semibold tracking-[0.12em] uppercase mb-3">
                  What would <span className="text-[#f0b429]">you</span> predict?
                </p>
                <div className="flex items-center justify-center gap-3">
                  <div
                    className="w-14 h-10 rounded-xl flex items-center justify-center text-xl font-[family-name:var(--font-oswald)] font-bold text-[#3f5068]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    ?
                  </div>
                  <span className="text-[#2d3a4a] text-lg font-light">—</span>
                  <div
                    className="w-14 h-10 rounded-xl flex items-center justify-center text-xl font-[family-name:var(--font-oswald)] font-bold text-[#3f5068]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    ?
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── FLAGS MARQUEE ────────────────────────────────────────────────── */}
      <div
        className="relative py-3.5 overflow-hidden"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#070a11',
        }}
      >
        <div className="flex w-max animate-marquee gap-5 items-center">
          {MARQUEE.map((nation, i) => (
            <div key={`${nation.code}-${i}`} className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-6 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
                <Image
                  src={getFlagUrl(nation.code, 40)}
                  alt={nation.name}
                  width={36}
                  height={24}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <span className="text-[#2d3a4a] text-[0.6rem] font-bold uppercase tracking-[0.2em] whitespace-nowrap">
                {nation.name}
              </span>
              <span className="text-[#1a2330] text-base ml-0.5">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-20 sm:py-28">
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-[#f0b429] text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3">
            How it works
          </p>
          <h2 className="font-[family-name:var(--font-oswald)] text-3xl sm:text-4xl font-bold uppercase tracking-wide">
            Simple. Competitive. Glorious.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div
              key={step}
              className="relative rounded-2xl p-6 group transition-all duration-200 hover:-translate-y-1"
              style={{
                background: '#0d1520',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Step number */}
              <div className="flex items-center gap-2.5 mb-5">
                <span
                  className="font-[family-name:var(--font-oswald)] text-xs font-bold tracking-[0.15em] px-2 py-0.5 rounded-md"
                  style={{
                    color: '#f0b429',
                    background: 'rgba(240,180,41,0.1)',
                    border: '1px solid rgba(240,180,41,0.2)',
                  }}
                >
                  {step}
                </span>
                {/* Connector line (not on last item) */}
                {step !== '04' && (
                  <span className="hidden lg:block flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                )}
              </div>
              <h3 className="font-[family-name:var(--font-oswald)] font-semibold text-lg uppercase tracking-wide text-white mb-2 group-hover:text-[#f0b429] transition-colors duration-200">
                {title}
              </h3>
              <p className="text-[#4a5c70] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED NATIONS ─────────────────────────────────────────────── */}
      <section
        className="py-20"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#070a11' }}
      >
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <p className="text-center text-[#f0b429] text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-10 sm:mb-12">
            Join the world
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 sm:gap-5">
            {FEATURED.map(({ name, code }) => (
              <div key={code} className="flex flex-col items-center gap-2 group cursor-default">
                <div
                  className="w-12 h-8 sm:w-14 sm:h-10 rounded-md overflow-hidden transition-all duration-200 group-hover:scale-105"
                  style={{
                    border: '1px solid rgba(255,255,255,0.09)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <Image
                    src={getFlagUrl(code, 80)}
                    alt={name}
                    width={56}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <span className="text-[9px] text-[#2d3a4a] group-hover:text-[#6b7f96] transition-colors text-center font-semibold uppercase tracking-wide leading-tight">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────────────────── */}
      <section
        className="relative py-20 sm:py-28 px-5 sm:px-6 text-center overflow-hidden"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Ambient center glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(240,180,41,0.06) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10">
          <p className="text-[#f0b429] text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-5">
            Free to play · No downloads
          </p>
          <h2
            className="font-[family-name:var(--font-oswald)] font-bold uppercase leading-[0.9] mb-8"
            style={{ fontSize: 'clamp(2.3rem, 6vw, 5rem)' }}
          >
            Ready to{' '}
            <span className="text-gold-gradient">prove it?</span>
          </h2>
          <p className="text-[#3f5068] mb-10 text-base max-w-sm mx-auto leading-relaxed">
            Just football. Just friends. Just bragging rights.
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 bg-[#f0b429] text-[#080c14] px-10 py-4 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-[#fcd86e] transition-all duration-200 shadow-xl"
          >
            Start Predicting
          </Link>
        </div>
      </section>

    </div>
  )
}
