import React, { useEffect, useId, useRef } from 'react';
import { cn } from '../../utils/cn';
import { X } from 'lucide-react';
import { Button } from './Button';
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string | undefined;
    children: React.ReactNode;
    size?: ('sm' | 'md' | 'lg' | 'xl' | 'full' | 'wide') | undefined;
    showCloseButton?: boolean | undefined;
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', showCloseButton = true, }) => {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedElement = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);
    useEffect(() => {
        if (isOpen) {
            previouslyFocusedElement.current = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            document.body.style.overflow = 'hidden';
            window.requestAnimationFrame(() => {
                if (!dialogRef.current?.contains(document.activeElement)) {
                    dialogRef.current?.focus();
                }
            });
            const handleKeyDown = (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                    onCloseRef.current();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                document.body.style.overflow = '';
                previouslyFocusedElement.current?.focus();
            };
        }
        document.body.style.overflow = '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);
    if (!isOpen)
        return null;
    const sizes = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-2xl',
        full: 'max-w-4xl',
        wide: 'max-w-[96vw]',
    };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose}/>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1} className={cn('relative bg-white rounded-xl shadow-xl w-full mx-4', 'max-h-[90vh] overflow-hidden flex flex-col', sizes[size])}>
        {(title || showCloseButton) && (<div className="flex items-center justify-between p-4 border-b">
            {title && <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>}
            {showCloseButton && (<button type="button" onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" aria-label="بستن">
                <X className="w-5 h-5"/>
              </button>)}
          </div>)}
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>);
};
interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string | undefined;
    cancelText?: string | undefined;
    variant?: ('danger' | 'warning' | 'primary') | undefined;
    loading?: boolean | undefined;
}
export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'تایید', cancelText = 'انصراف', variant = 'primary', loading = false, }) => {
    return (<Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmText}
        </Button>
      </div>
    </Modal>);
};

