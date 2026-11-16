import {
  Atom,
  BookOpen,
  ClipboardCheck,
  Compass,
  Share2,
  Sparkles,
} from 'lucide-react';
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
  { id: 'quizzes', label: 'Quizzes', icon: ClipboardCheck },
  { id: 'notes', label: 'Notes', icon: BookOpen },
  { id: 'lab', label: 'Practice Area', icon: Atom },
  { id: 'share', label: 'Share', icon: Share2 },
];

export function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary quick navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--alexyn-border)] bg-[#071026]/95 backdrop-blur-lg"
    >
      <div className="mx-auto grid h-16 max-w-4xl grid-cols-6 items-center px-1 sm:px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8BFF] ${
                isActive
                  ? 'text-[#38BDF8]'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${isActive ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
              <span className="max-w-full text-center text-[9.5px] font-medium leading-tight tracking-tight sm:text-[11px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
