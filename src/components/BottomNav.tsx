import { Atom, BookOpen, Compass, Share2, Sparkles } from 'lucide-react';
import type { ScreenId } from '../types/alexyn';

interface BottomNavProps {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

const NAV_ITEMS: Array<{
  id: ScreenId;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: 'explore', label: 'Explore', icon: Sparkles },
  { id: 'subjects', label: 'Subjects', icon: Compass },
  { id: 'notes', label: 'Notes', icon: BookOpen },
  { id: 'lab', label: '3D Lab', icon: Atom },
  { id: 'share', label: 'Share', icon: Share2 },
];

export function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary quick navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--alexyn-border)] bg-[#071026]/95 backdrop-blur-lg"
    >
      <div className="mx-auto grid h-15 max-w-4xl grid-cols-5 items-center px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8BFF] ${
                isActive
                  ? 'text-[#38BDF8]'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
              <span className="whitespace-nowrap text-[11px] font-medium tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
