import { forwardRef } from 'react';
import { cn } from '~/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface InputModernProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
}

export const InputModern = forwardRef<HTMLInputElement, InputModernProps>(
  ({ label, error, iconLeft: IconLeft, iconRight: IconRight, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
            {props.required && <span className="text-red-600 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {IconLeft && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <IconLeft size={16} />
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full py-3 px-4 text-sm text-gray-900 bg-white',
              'border border-gray-200 rounded-xl',
              'placeholder:text-gray-400',
              'transition-all duration-150',
              'focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-100',
              IconLeft && 'pl-10',
              IconRight && 'pr-10',
              className
            )}
            {...props}
          />
          {IconRight && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <IconRight size={16} />
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

InputModern.displayName = 'InputModern';
