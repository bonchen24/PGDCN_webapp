// Author: Gemini
// OS support: Web/Node
// Description: Searchable dropdown component supporting custom trigger styling and search filtering

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { removeAccents } from '../utils/formatter';

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  className = '',
  triggerClassName = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option => {
    if (!searchTerm) return true;
    const normalizedOption = removeAccents(option).toLowerCase();
    const normalizedSearch = removeAccents(searchTerm).toLowerCase();
    return normalizedOption.includes(normalizedSearch);
  });

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div
        className={`${triggerClassName || "w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-2.5 pr-8 text-[11px] font-bold text-slate-700 outline-none cursor-pointer focus-within:ring-1 focus-within:ring-blue-500 flex items-center justify-between"} ${disabled ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          setSearchTerm('');
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown size={12} className="text-slate-400" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-60">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 sticky top-0 bg-white">
            <Search size={12} className="text-slate-400" />
            <input
              type="text"
              className="w-full text-[11px] outline-none text-slate-700 bg-transparent"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <div
              className={`px-3 py-2 text-[11px] cursor-pointer hover:bg-slate-50 ${!value ? 'bg-blue-50/50 text-blue-600 font-semibold' : 'text-slate-700'}`}
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
            >
              {placeholder}
            </div>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-500 text-center italic">Không tìm thấy</div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option}
                  className={`px-3 py-2 text-[11px] cursor-pointer hover:bg-slate-50 truncate ${value === option ? 'bg-blue-50/50 text-blue-600 font-semibold' : 'text-slate-700'}`}
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                  title={option}
                >
                  {option}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- End of SearchableSelect.tsx ---
