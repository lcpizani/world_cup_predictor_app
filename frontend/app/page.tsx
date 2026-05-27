import Link from 'next/link'
import Image from 'next/image'
import { MARQUEE_NATIONS, getFlagUrl } from '@/lib/flags'

// Double the list so the marquee loop is seamless
const MARQUEE = [...MARQUEE_NATIONS, ...MARQUEE_NATIONS]

// Scoreboard mockup data shown on the hero
const HERO_MATCH = {
  home: { name: 'Brazil', code: 'br', score: 2 },
  away: { name: 'Argentina', code: 'ar', score: 1 },
  minute: "45'",
  stage: 'World Cup Final',
}

// Featured nations for the flag grid section
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

export default function LandingPage() {
  return (
    <div className="bg-[#080c14] text-white overflow-x-hidden">

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center bg-pitch overflow-hidden">

        {/* Stadium light radial gradient */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(240,180,41,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Faint centre-circle watermark */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5"
          style={{ width: 600, height: 600 }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5"
          style={{ width: 300, height: 300 }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#f0b429]/10 border border-[#f0b429]/30 rounded-full px-4 py-1.5 mb-8 animate-fade-up">
              <span className="animate-pulse-live inline-block w-2 h-2 rounded-full bg-[#f0b429]" />
              <span className="text-[#f0b429] text-sm font-semibold tracking-widest uppercase">
                World Cup 2026 · Predict Now
              </span>
            </div>

            <h1
              className="font-[family-name:var(--font-oswald)] font-bold leading-none uppercase animate-fade-up-delay"
              style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)' }}
            >
              Predict the<br />
              <span className="text-[#f0b429]">Beautiful</span>{' '}
              Game
            </h1>

            <p className="mt-6 text-[#94a3b8] text-lg leading-relaxed max-w-md animate-fade-up-delay2">
              Create private leagues, predict match scores with friends, and
              crown the ultimate football genius. May the best fan win.
            </p>

            <div className="flex flex-wrap gap-4 mt-10 animate-fade-up-delay2">
              <Link
                href="/auth/register"
                className="group relative inline-flex items-center gap-2 bg-[#f0b429] text-[#080c14] px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white transition-all duration-200 shadow-lg"
              >
                ⚡ Get Started
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 border border-white/20 text-white px-8 py-3.5 rounded-xl font-semibold text-sm uppercase tracking-wider hover:border-white/50 hover:bg-white/5 transition-all duration-200"
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
                <div key={label}>
                  <p className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#f0b429]">
                    {value}
                  </p>
                  <p className="text-xs text-[#64748b] uppercase tracking-widest mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — live scoreboard mockup */}
          <div className="flex justify-center lg:justify-end animate-fade-up-delay animate-float">
            <div
              className="w-full max-w-sm rounded-2xl overflow-hidden border border-white/10 animate-glow"
              style={{ background: '#0f1620' }}
            >
              {/* Scoreboard header */}
              <div className="bg-[#f0b429] px-5 py-3 flex items-center justify-between">
                <span className="text-[#080c14] text-xs font-bold uppercase tracking-widest">
                  {HERO_MATCH.stage}
                </span>
                <span className="flex items-center gap-1.5 text-[#080c14] text-xs font-bold">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#dc2626] animate-pulse-live" />
                  LIVE {HERO_MATCH.minute}
                </span>
              </div>

              {/* Teams */}
              <div className="px-5 py-8 space-y-5">
                {[HERO_MATCH.home, HERO_MATCH.away].map((team, i) => (
                  <div key={team.code} className="flex items-center gap-4">
                    <div className="w-14 h-10 rounded-md overflow-hidden border border-white/10 flex-shrink-0">
                      <Image
                        src={getFlagUrl(team.code, 80)}
                        alt={team.name}
                        width={56}
                        height={40}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="flex-1 font-[family-name:var(--font-oswald)] font-semibold text-lg uppercase tracking-wider text-white">
                      {team.name}
                    </span>
                    <span className="font-[family-name:var(--font-oswald)] font-bold text-4xl text-[#f0b429] font-scoreboard">
                      {team.score}
                    </span>
                  </div>
                ))}
              </div>

              {/* "What would you have predicted?" */}
              <div className="border-t border-white/10 px-5 py-4">
                <p className="text-xs text-[#64748b] text-center">
                  What would <span className="text-[#f0b429]">you</span> have predicted?
                </p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <div className="w-14 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xl font-[family-name:var(--font-oswald)] font-bold text-white">
                    ?
                  </div>
                  <span className="text-white/40 text-lg">–</span>
                  <div className="w-14 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xl font-[family-name:var(--font-oswald)] font-bold text-white">
                    ?
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FLAGS MARQUEE ────────────────────────────────────────────────── */}
      <div className="relative border-y border-white/10 bg-[#0a0f1a] py-4 overflow-hidden">
        <div className="flex w-max animate-marquee gap-6 items-center">
          {MARQUEE.map((nation, i) => (
            <div key={`${nation.code}-${i}`} className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-9 h-6 rounded overflow-hidden border border-white/10">
                <Image
                  src={getFlagUrl(nation.code, 40)}
                  alt={nation.name}
                  width={36}
                  height={24}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <span className="text-[#475569] text-xs font-semibold uppercase tracking-widest whitespace-nowrap">
                {nation.name}
              </span>
              <span className="text-white/10 text-lg ml-1">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-[#f0b429] text-xs font-bold uppercase tracking-[0.3em] mb-3">
            How it works
          </p>
          <h2 className="font-[family-name:var(--font-oswald)] text-4xl font-bold uppercase">
            Simple. Competitive. Glorious.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '01', icon: '🏆', title: 'Create a League', desc: 'Set up a private tournament and choose your own scoring rules.' },
            { step: '02', icon: '📨', title: 'Invite Friends', desc: 'Share your invite code and get everyone in your league.' },
            { step: '03', icon: '⚽', title: 'Predict Scores', desc: 'Submit your predicted scores before each match kicks off.' },
            { step: '04', icon: '🥇', title: 'Win Glory', desc: 'Earn points for every correct prediction. Crown the champion.' },
          ].map(({ step, icon, title, desc }) => (
            <div
              key={step}
              className="relative rounded-2xl border border-white/10 bg-[#0f1620] p-6 hover:border-[#f0b429]/30 transition-colors group"
            >
              <p className="font-[family-name:var(--font-oswald)] text-5xl font-bold text-white/5 absolute top-4 right-5 select-none">
                {step}
              </p>
              <div className="text-3xl mb-4">{icon}</div>
              <h3 className="font-[family-name:var(--font-oswald)] font-semibold text-lg uppercase tracking-wide text-white mb-2">
                {title}
              </h3>
              <p className="text-[#64748b] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED NATIONS ─────────────────────────────────────────────── */}
      <section className="border-t border-white/5 bg-[#0a0f1a] py-20">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-[#f0b429] text-xs font-bold uppercase tracking-[0.3em] mb-10">
            Join the world
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
            {FEATURED.map(({ name, code }) => (
              <div key={code} className="flex flex-col items-center gap-2 group cursor-default">
                <div className="w-12 h-8 sm:w-14 sm:h-10 rounded-md overflow-hidden border border-white/10 group-hover:border-[#f0b429]/40 transition-colors shadow-lg">
                  <Image
                    src={getFlagUrl(code, 80)}
                    alt={name}
                    width={56}
                    height={40}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <span className="text-[10px] text-[#475569] group-hover:text-[#94a3b8] transition-colors text-center font-semibold uppercase tracking-wide leading-tight">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-20 text-center">
        <h2 className="font-[family-name:var(--font-oswald)] text-4xl sm:text-5xl font-bold uppercase mb-4">
          Ready to{' '}
          <span className="text-[#f0b429]">prove it?</span>
        </h2>
        <p className="text-[#64748b] mb-8 text-lg">
          Free to play. No downloads. Just football.
        </p>
        <Link
          href="/auth/register"
          className="inline-flex items-center gap-2 bg-[#f0b429] text-[#080c14] px-10 py-4 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-white transition-all duration-200 shadow-lg"
        >
          ⚡ Start Predicting
        </Link>
      </section>

    </div>
  )
}
