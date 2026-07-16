import { Moon, Sun } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string | undefined;
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const actionLabel = isDark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت شب';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="تغییر حالت نمایش"
      aria-pressed={isDark}
      title={actionLabel}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900',
        compact ? 'min-w-11 p-2' : 'w-full px-3 py-2.5',
        className,
      )}
    >
      <span className="relative h-5 w-5 flex-shrink-0" aria-hidden="true">
        <Moon className={cn('absolute inset-0 h-5 w-5 transition-all', isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100')} />
        <Sun className={cn('absolute inset-0 h-5 w-5 transition-all', isDark ? 'scale-100 rotate-0 opacity-100 text-amber-500' : 'scale-0 -rotate-90 opacity-0')} />
      </span>
      {!compact && <span>{isDark ? 'حالت روشن' : 'حالت شب'}</span>}
    </button>
  );
}
