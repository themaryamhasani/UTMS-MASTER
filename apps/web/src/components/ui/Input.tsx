import React from 'react';
import { cn } from '../../utils/cn';
import { DESCRIPTION_MAX_LENGTH } from '../../utils/inputRules';
function pasteIntoControlledField<T extends HTMLInputElement | HTMLTextAreaElement>(event: React.ClipboardEvent<T>, value: unknown, onPaste?: React.ClipboardEventHandler<T>) {
    onPaste?.(event);
    if (event.defaultPrevented || value === undefined || event.currentTarget.disabled || event.currentTarget.readOnly)
        return;
    const text = event.clipboardData.getData('text');
    if (!text)
        return;
    const field = event.currentTarget;
    const current = String(value ?? '');
    const start = field.selectionStart ?? current.length;
    const end = field.selectionEnd ?? start;
    const rawNextValue = `${current.slice(0, start)}${text}${current.slice(end)}`;
    const maxLength = field.maxLength > -1 ? field.maxLength : undefined;
    const nextValue = maxLength ? rawNextValue.slice(0, maxLength) : rawNextValue;
    const prototype = field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    event.preventDefault();
    setter?.call(field, nextValue);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    requestAnimationFrame(() => {
        const cursor = Math.min(start + text.length, nextValue.length);
        field.setSelectionRange(cursor, cursor);
    });
}
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string | undefined;
    error?: string | undefined;
    hint?: string | undefined;
}
export const Input: React.FC<InputProps> = ({ label, error, hint, className, id, onPaste, value, ...props }) => {
    const generatedId = React.useId();
    const inputId = id || `utms-input-${generatedId.replace(/:/g, '')}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    return (<div className="w-full">
      {label && (<label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>)}
      <input id={inputId} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : hint ? hintId : undefined} className={cn('w-full px-3 py-2 border rounded-lg text-gray-900 placeholder-gray-400', 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent', 'disabled:bg-gray-100 disabled:cursor-not-allowed', error ? 'border-red-500' : 'border-gray-300', className)} value={value} onPaste={(event) => pasteIntoControlledField(event, value, onPaste)} {...props}/>
      {error && <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
      {hint && !error && <p id={hintId} className="mt-1 text-sm text-gray-500">{hint}</p>}
    </div>);
};
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string | undefined;
    error?: string | undefined;
    showCounter?: boolean | undefined;
}
export const Textarea: React.FC<TextareaProps> = ({ label, error, className, id, onPaste, value, maxLength, showCounter, ...props }) => {
    const generatedId = React.useId();
    const inputId = id || `utms-textarea-${generatedId.replace(/:/g, '')}`;
    const errorId = `${inputId}-error`;
    const autoLimitDescription = !!label && (label.includes('توضیح') || label.includes('توضیحات'));
    const effectiveMaxLength = maxLength ?? (autoLimitDescription ? DESCRIPTION_MAX_LENGTH : undefined);
    const shouldShowCounter = showCounter ?? effectiveMaxLength !== undefined;
    const currentLength = String(value ?? '').length;
    return (<div className="w-full">
      {label && (<label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>)}
      <textarea id={inputId} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} className={cn('w-full px-3 py-2 border rounded-lg text-gray-900 placeholder-gray-400', 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent', 'disabled:bg-gray-100 disabled:cursor-not-allowed resize-y min-h-[100px]', error ? 'border-red-500' : 'border-gray-300', className)} value={value} maxLength={effectiveMaxLength} onPaste={(event) => pasteIntoControlledField(event, value, onPaste)} {...props}/>
      {shouldShowCounter && effectiveMaxLength && (<div className={cn('mt-1 text-xs text-left', currentLength >= effectiveMaxLength ? 'text-red-600' : 'text-gray-500')}>
          {currentLength}/{effectiveMaxLength}
        </div>)}
      {error && <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
    </div>);
};
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string | undefined;
    error?: string | undefined;
    options: Array<{
        value: string;
        label: string;
    }>;
    placeholder?: string | undefined;
}
export const Select: React.FC<SelectProps> = ({ label, error, options, placeholder, className, id, ...props }) => {
    const generatedId = React.useId();
    const inputId = id || `utms-select-${generatedId.replace(/:/g, '')}`;
    const errorId = `${inputId}-error`;
    return (<div className="w-full">
      {label && (<label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>)}
      <select id={inputId} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} className={cn('w-full px-3 py-2 border rounded-lg text-gray-900', 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent', 'disabled:bg-gray-100 disabled:cursor-not-allowed', error ? 'border-red-500' : 'border-gray-300', className)} {...props}>
        {placeholder && (<option value="" disabled>
            {placeholder}
          </option>)}
        {options.map((opt) => (<option key={opt.value} value={opt.value}>
            {opt.label}
          </option>))}
      </select>
      {error && <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
    </div>);
};
