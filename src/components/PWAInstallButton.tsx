import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Share2, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

interface PWAInstallButtonProps {
  variant?: 'compact' | 'settings';
}

export function PWAInstallButton({ variant = 'compact' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (variant === 'compact') {
    if (isInstalled) return null;

    if (isInstallable) {
      return (
        <button
          type="button"
          onClick={() => void install()}
          aria-label="Install ALEXYN app"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#2E8BFF]/45 bg-[#122658] px-3 text-xs font-semibold text-[#7DD3FC] transition-colors hover:border-[#38BDF8] hover:bg-[#193372] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8BFF]"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      );
    }

    if (isIOS) {
      return (
        <>
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            aria-label="Install ALEXYN on iOS"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--alexyn-border)] bg-[#101D3D] px-2.5 text-xs font-semibold text-[#7DD3FC] transition-colors hover:border-[#2E8BFF]/60 hover:bg-[#162752] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8BFF]"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Install</span>
          </button>
          <IOSInstallGuideModal open={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
        </>
      );
    }

    return null;
  }

  return (
    <section
      aria-label="Install ALEXYN App"
      className="space-y-2.5 rounded-2xl border border-[#2E8BFF]/30 bg-[#0B1636] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-[#5EEAD4]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#7DD3FC]">
            Install as Desktop or Mobile App
          </h3>
        </div>
        {isInstalled && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Installed
          </span>
        )}
      </div>

      {isInstalled ? (
        <p className="text-xs text-slate-300">
          ALEXYN is running in standalone app mode with cached offline support for your Calculator, Math Notebook, 3D Labs, Saved Notes, and Quizzes.
        </p>
      ) : isInstallable ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs text-slate-300">
            Install ALEXYN directly onto your home screen or desktop for instant standalone launch and offline study tools.
          </p>
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2E8BFF] to-[#6E5BFF] px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-110"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Install ALEXYN App</span>
          </button>
        </div>
      ) : isIOS ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs text-slate-300">
            Add ALEXYN to your iPhone or iPad Home Screen for full-screen standalone launch.
          </p>
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#2E8BFF]/45 bg-[#122658] px-3.5 py-2 text-xs font-semibold text-[#7DD3FC] hover:bg-[#193372]"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>How to Install on iOS</span>
          </button>
          <IOSInstallGuideModal open={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-slate-300">
          When opened over <span className="font-mono text-[#7DD3FC]">https://</span> or{' '}
          <span className="font-mono text-[#7DD3FC]">http://localhost:3000</span> in Chrome, Edge, or Android browser, use the browser menu&apos;s{' '}
          <strong className="text-white">Install App</strong> / <strong className="text-white">Add to Home Screen</strong> option. Offline tools remain cached automatically.
        </p>
      )}
    </section>
  );
}

function IOSInstallGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Install ALEXYN on iOS"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[var(--alexyn-border)] bg-[#081129] p-5 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">Install ALEXYN on iPhone / iPad</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install instructions"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-[#122249] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-300">
          <li>
            1. Tap the <strong className="text-white">Share</strong> icon in Safari&apos;s toolbar.
          </li>
          <li>
            2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
          </li>
          <li>
            3. Tap <strong className="text-white">Add</strong> to launch ALEXYN like a native app.
          </li>
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-[#122658] py-2 text-xs font-semibold text-[#7DD3FC] hover:bg-[#193372]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-[#1F1707]/95 px-3 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur-md md:bottom-4"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-300" />
      <span>Offline Mode — Calculator, 3D Labs &amp; Saved Notes remain available.</span>
    </div>
  );
}
