'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { filterPcnCatalogOptions, normalizePcnSearchText } from '../utils/pcnSearch';

export type PcnCatalogOption = {
  value: string;
  label: string;
  searchText?: string;
  description?: string;
  disabled?: boolean;
};

export type PcnCatalogComboboxProps = {
  id: string;
  label: string;
  value: string;
  options: readonly PcnCatalogOption[];
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  'aria-invalid'?: boolean;
  ariaLabel?: string;
  useParentLabel?: boolean;
  unmatchedOption?: PcnCatalogOption;
  hideLabel?: boolean;
};

export function PcnCatalogCombobox({
  id,
  label,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
  invalid = false,
  'aria-invalid': ariaInvalid = false,
  ariaLabel,
  useParentLabel = false,
  unmatchedOption,
  hideLabel = false,
}: PcnCatalogComboboxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = useMemo(() => {
    const configured = options.find((option) => option.value === value);
    if (configured) return configured;
    if (unmatchedOption?.value === value) return unmatchedOption;
    return undefined;
  }, [options, unmatchedOption, value]);

  const mergedOptions = useMemo(() => {
    if (!unmatchedOption || !value || options.some((option) => option.value === value)) return options;
    return [unmatchedOption, ...options];
  }, [options, unmatchedOption, value]);

  const filteredOptions = useMemo(() => {
    if (!normalizePcnSearchText(inputValue) || selectedOption?.label === inputValue) return mergedOptions;
    return filterPcnCatalogOptions(mergedOptions, inputValue, (option) => [option.value, option.label, option.searchText, option.description]);
  }, [inputValue, mergedOptions, selectedOption?.label]);

  const enabledIndexes = useMemo(
    () => filteredOptions.map((option, index) => (option.disabled ? -1 : index)).filter((index) => index >= 0),
    [filteredOptions],
  );

  useEffect(() => {
    if (!isOpen) setInputValue(selectedOption?.label || value || '');
  }, [isOpen, selectedOption?.label, value]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setInputValue(selectedOption?.label || value || '');
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [selectedOption?.label, value]);

  useEffect(() => {
    if (enabledIndexes.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => enabledIndexes.includes(current) ? current : enabledIndexes[0]);
  }, [enabledIndexes]);

  const selectOption = (option: PcnCatalogOption) => {
    if (disabled || option.disabled) return;
    onChange(option.value);
    setInputValue(option.label);
    setIsOpen(false);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const moveActive = (direction: 1 | -1) => {
    if (enabledIndexes.length === 0) return;
    const currentPosition = Math.max(0, enabledIndexes.indexOf(activeIndex));
    const nextPosition = (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPosition]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setInputValue(selectedOption?.label || value || '');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp' && isOpen) {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      const option = filteredOptions[activeIndex] || filteredOptions[enabledIndexes[0]];
      if (option && !option.disabled) selectOption(option);
      return;
    }
  };

  const listboxId = `${id}-listbox`;
  const activeOptionId = enabledIndexes.includes(activeIndex) ? `${id}-option-${activeIndex}` : undefined;

  return (
    <div ref={wrapperRef} className="relative block min-w-0">
      {!hideLabel && <label htmlFor={id} className="mb-1 block text-[10px] font-black text-slate-500">{label}</label>}
      <div className="relative">
        <Search aria-hidden="true" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          type="text"
          value={inputValue}

          required={required}
          disabled={disabled}
          aria-label={hideLabel ? (useParentLabel ? ariaLabel : label) : undefined}
          aria-invalid={invalid || ariaInvalid || undefined}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={isOpen ? activeOptionId : undefined}
          autoComplete="off"
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={(event) => {
            setInputValue(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-20 text-xs outline-none transition-all hover:border-slate-300 focus:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        <div className="absolute inset-y-0 right-0 flex items-center">
          {value && !disabled && <button type="button" aria-label={`Xóa ${label}`} onClick={() => { onChange(''); setInputValue(''); setIsOpen(false); inputRef.current?.focus(); }} className="mobile-touch-target text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1">
            <X size={14} />
          </button>}
          <button type="button" disabled={disabled} aria-label={isOpen ? `Đóng ${label}` : `Mở ${label}`} onClick={() => { setIsOpen((current) => !current); inputRef.current?.focus(); }} className="mobile-touch-target text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50">
            <ChevronDown size={15} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </div>
      </div>
      {isOpen && !disabled && <div id={listboxId} role="listbox" aria-label={label} className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto mobile-scroll-y rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
        {filteredOptions.length === 0 ? <div className="px-2.5 py-3 text-[10px] text-slate-500">Không có giá trị phù hợp.</div> : filteredOptions.map((option, index) => {
          const isSelected = option.value === value;
          const isActive = index === activeIndex;
          return <button
            key={option.value}
            id={`${id}-option-${index}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            disabled={option.disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectOption(option)}
            className={`block min-h-10 w-full rounded-lg px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'} ${option.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <span className="block font-bold">{option.label}</span>
            {option.description && <span className="mt-0.5 block text-[10px] text-slate-500">{option.description}</span>}
          </button>;
        })}
      </div>}
    </div>
  );
}

export default PcnCatalogCombobox;
