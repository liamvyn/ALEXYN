import { ArrowRight, PanelLeft, User } from 'lucide-react';
import { AlexynLogo } from './AlexynLogo';
import type { EducationProfile } from '../types/alexyn';

const COSMIC_HORIZON_IMAGE = '/src/assets/images/alexyn_cosmic_book_horizon_1794648443430.jpg';

interface WelcomeScreenProps {
  profile: EducationProfile;
  onExplore: () => void;
  onOpenDrawer: () => void;
  onOpenAccount: () => void;
}

export function WelcomeScreen({
  profile,
  onExplore,
  onOpenDrawer,
  onOpenAccount,
}: WelcomeScreenProps) {
  const isSignedIn = profile.mode === 'signed-in' && profile.name.trim().length > 0;

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#03091B] text-white">
      <div
        className="pointer-events-none absolute inset-0 cosmic-stars opacity-85"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[44vh] overflow-hidden"
        aria-hidden="true"
      >
        <img
          src={COSMIC_HORIZON_IMAGE}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#03091B] via-[#03091B]/45 to-transparent" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-4 py-4 md:px-8">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open conversations and library menu"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--alexyn-border)] bg-[#0A1533]/80 text-slate-200 backdrop-blur-md transition-colors hover:border-[#2E8BFF]/60 hover:text-white"
        >
          <PanelLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onOpenAccount}
          aria-label={isSignedIn ? `Account: ${profile.name}` : 'Account: Guest or Sign in'}
          className="flex h-11 items-center gap-2 rounded-full border border-[var(--alexyn-border)] bg-[#0A1533]/80 px-3.5 text-xs font-medium text-slate-100 backdrop-blur-md transition-colors hover:border-[#2E8BFF]/60 hover:text-white"
        >
          <User className="h-4 w-4 text-[#5EEAD4]" />
          <span>{isSignedIn ? profile.name.split(' ')[0] : 'Guest / Sign in'}</span>
        </button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-20 pt-4 text-center">
        <div className="mb-4 flex flex-col items-center">
          <AlexynLogo size="lg" />
          <span className="mt-3 text-3xl font-extrabold tracking-[0.26em] text-white sm:text-4xl">
            ALEXYN
          </span>
          <p className="mt-1.5 text-xs font-medium tracking-[0.2em] text-[#7DD3FC]">
            Learn · Explore · Excel
          </p>
        </div>

        <h1 className="mt-5 max-w-xl text-balance text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
          Understand more.
          <br />
          Memorise less.
          <br />
          Think smarter.
        </h1>

        <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
          Your personal space to explore ideas with AI, craft custom Smart Notes, master exam subjects & languages, and share your own study tricks.
        </p>

        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={onExplore}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#267DFF] via-[#486CFF] to-[#7A5BFF] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_36px_rgba(46,139,255,0.38)] transition-transform active:scale-[0.99]"
          >
            <span>Explore ALEXYN</span>
            <ArrowRight className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onOpenAccount}
            className="min-h-[44px] w-full rounded-xl border border-[var(--alexyn-border)] bg-[#0B1737]/85 px-4 py-2.5 text-xs font-semibold text-[#7DD3FC] backdrop-blur-md transition-colors hover:border-[#2E8BFF]/60 hover:text-white"
          >
            {isSignedIn ? `${profile.name} · Edit Education Setup` : 'Sign In or Continue as Guest'}
          </button>
        </div>
      </main>
    </div>
  );
}
