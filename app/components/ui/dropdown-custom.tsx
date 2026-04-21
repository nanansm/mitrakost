import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '~/lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownCustomProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
}

export function DropdownCustom({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  className,
  name,
}: DropdownCustomProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setFocusIndex(-1);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [close]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setFocusIndex(0);
      }
      return;
    }
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusIndex >= 0 && focusIndex < options.length) {
        onChange(options[focusIndex].value);
        close();
      }
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3 text-sm',
          'bg-white border rounded-xl transition-all duration-150',
          'focus:outline-none',
          open
            ? 'border-red-600 ring-2 ring-red-100'
            : 'border-gray-200 hover:border-gray-300'
        )}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'text-gray-400 transition-transform duration-200 shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          {options.map((opt, idx) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                close();
              }}
              onMouseEnter={() => setFocusIndex(idx)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors',
                idx === focusIndex || opt.value === value
                  ? 'bg-red-50'
                  : 'hover:bg-red-50',
                opt.value === value ? 'text-red-600 font-medium' : 'text-gray-900'
              )}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={14} className="text-red-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
