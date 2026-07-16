import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Layers3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getContextApplicationLabel, useAuthStore } from '../../stores/authStore';
import { ROLE_LABELS, type AvailableContext } from '../../types';

interface ContextSwitcherProps {
  variant?: 'header' | 'sidebar';
  onSwitched?: (() => void) | undefined;
}

export function ContextSwitcher({ variant = 'header', onSwitched }: ContextSwitcherProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { activeContext, availableContexts, switchContext } = useAuthStore();
  const canSwitch = availableContexts.length > 1;

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  if (!activeContext) return null;

  const applicationLabel = getContextApplicationLabel(activeContext);
  const handleSwitch = (context: AvailableContext) => {
    if (context.contextId === activeContext.contextId) {
      setIsOpen(false);
      return;
    }
    if (!switchContext(context.contextId)) return;

    setIsOpen(false);
    navigate('/dashboard', { replace: true });
    onSwitched?.();
  };

  return (
    <div
      ref={containerRef}
      className={variant === 'sidebar' ? 'relative border-b border-gray-200' : 'relative'}
      dir="rtl"
    >
      <button
        type="button"
        onClick={() => canSwitch && setIsOpen(open => !open)}
        className={variant === 'sidebar'
          ? 'w-full bg-gradient-to-l from-blue-50 to-white p-4 text-right transition-colors hover:bg-blue-50'
          : 'flex min-w-0 max-w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-sm text-gray-700 transition-colors hover:bg-gray-100 sm:px-3'}
        aria-label={canSwitch ? 'تغییر نقش و محیط کاری' : 'محیط کاری فعال'}
        aria-haspopup={canSwitch ? 'menu' : undefined}
        aria-expanded={canSwitch ? isOpen : undefined}
      >
        {variant === 'sidebar' ? (
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
              <span className="text-sm font-bold text-blue-600">{activeContext.user.fullName.charAt(0)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{activeContext.user.fullName}</p>
              <p className="mt-0.5 text-xs font-medium text-blue-600">{ROLE_LABELS[activeContext.role]}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600" title={applicationLabel}>
                {applicationLabel}
              </p>
            </div>
            {canSwitch && (
              <ChevronDown className={`mt-1 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            )}
          </div>
        ) : (
          <>
            <Layers3 className="h-4 w-4 flex-shrink-0 text-blue-600" />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-gray-800">{ROLE_LABELS[activeContext.role]}</span>
              <span className="block max-w-48 truncate text-xs text-gray-500 sm:max-w-64" title={applicationLabel}>
                {applicationLabel}
              </span>
            </span>
            {canSwitch && (
              <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            )}
          </>
        )}
      </button>

      {canSwitch && isOpen && (
        <div
          role="menu"
          aria-label="انتخاب نقش و محیط کاری"
          className={variant === 'sidebar'
            ? 'absolute inset-x-3 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl'
            : 'absolute left-0 top-full z-50 mt-2 max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl'}
        >
          <p className="px-3 pb-2 pt-1 text-xs font-semibold text-gray-500">تغییر نقش و محیط کاری</p>
          <div className="space-y-1">
            {availableContexts.map(context => {
              const isActive = context.contextId === activeContext.contextId;
              const contextApplicationLabel = getContextApplicationLabel(context);
              return (
                <button
                  key={context.contextId}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => handleSwitch(context)}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-right transition-colors ${
                    isActive ? 'bg-blue-50 text-blue-800' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{ROLE_LABELS[context.role]}</span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">{contextApplicationLabel}</span>
                  </span>
                  {isActive && <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
