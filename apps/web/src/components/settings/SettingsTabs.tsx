import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface SettingsTabItem {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  badge?: string | number;
}

interface SettingsTabsProps {
  items: SettingsTabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ items, activeId, onChange }) => {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const moveFocus = (currentIndex: number, offset: number) => {
    const nextIndex = (currentIndex + offset + items.length) % items.length;
    const item = items[nextIndex];
    if (item) tabRefs.current[item.id]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number, id: string) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveFocus(index, -1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveFocus(index, 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const item = items[0];
      if (item) tabRefs.current[item.id]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const item = items[items.length - 1];
      if (item) tabRefs.current[item.id]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChange(id);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="دسته‌بندی تنظیمات سیستم"
      aria-orientation="horizontal"
      className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-sm"
      dir="rtl"
    >
      {items.map((item, index) => {
        const selected = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={element => { tabRefs.current[item.id] = element; }}
            id={`settings-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`settings-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={event => handleKeyDown(event, index, item.id)}
            className={cn(
              'group flex min-w-[180px] flex-1 items-center gap-3 rounded-xl px-3 py-3 text-right outline-none transition',
              'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              selected
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <span className={cn('rounded-lg p-2', selected ? 'bg-white/15' : 'bg-gray-100 text-gray-600')}>
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold">
                {item.label}
                {item.badge !== undefined && (
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[11px]',
                    selected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600',
                  )}>
                    {item.badge}
                  </span>
                )}
              </span>
              <span className={cn('mt-0.5 block truncate text-xs', selected ? 'text-blue-100' : 'text-gray-500')}>
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
