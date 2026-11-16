import { ArrowLeft, PanelLeft, Settings, User } from 'lucide-react';
import { AlexynLogo } from './AlexynLogo';
import type { EducationProfile } from '../types/alexyn';

interface TopBarProps {
  title?: string;
  showDrawer?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onOpenDrawer: () => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  profile: EducationProfile;
  onGoHome: () => void;
}

export function TopBar({
  title,
  showDrawer = true,
  showBack = false,
  onBack,
  onOpenDrawer,
  onOpenSettings,
  onOpenAccount,
  profile,
  onGoHome,
}: TopBarProps) {
  const isSignedIn = profile.mode === 'signed-in' && profile.name.trim().length > 0;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[var(--alexyn-border)] bg-[#060E24]/85 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {showDrawer && (
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open conversations and library menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-transparent text-slate-300 transition-colors hover:border-[var(--alexyn-border)] hover:bg-[#111F44] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8BFF]"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        )}

        {showBack && onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-[#111F44] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8BFF]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <button
          type="button"
          onClick={onGoHome}
          aria-label="Go to Explore AI"
          className="flex min-w-0 items-center gap-2 rounded-lg px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8BFF]"
        >
          <AlexynLogo size="sm" />
          <span className="truncate text-sm font-extrabold tracking-[0.18em] text-white sm:text-base sm:tracking-[0.2em]">
            {title || 'ALEXYN'}
          </span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open app settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--alexyn-border)] bg-[#101D3D] text-slate-200 transition-colors hover:border-[#2E8BFF]/60 hover:bg-[#162752] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8BFF]"
        >
          <Settings className="h-4 w-4 text-[#7DD3FC]" />
        </button>

        <button
          type="button"
          onClick={onOpenAccount}
          aria-label={isSignedIn ? `Account: ${profile.name}` : 'Account: Guest or Sign in'}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--alexyn-border)] bg-[#101D3D] px-3 text-xs font-medium text-slate-200 transition-colors hover:border-[#2E8BFF]/60 hover:bg-[#162752] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8BFF]"
        >
          <User className="h-4 w-4 text-[#5EEAD4]" />
          <span className="hidden whitespace-nowrap sm:inline">
            {isSignedIn ? profile.name.split(' ')[0] : 'Guest'}
          </span>
        </button>
      </div>
    </header>
  );
}
