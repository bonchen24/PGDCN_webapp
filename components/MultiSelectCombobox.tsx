import React, { useState, useRef, useEffect } from 'react';

export default function MultiSelectCombobox({
  label,
  values,
  onChange,
  options,
  placeholder
}: {
  label: string;
  values: string[];
  onChange: (vals: string[]) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(o => 
    o.toLowerCase().includes(inputValue.toLowerCase()) && !values.includes(o)
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt: string) => {
    onChange([...values, opt]);
    setInputValue('');
  };

  const handleRemove = (opt: string) => {
    onChange(values.filter(v => v !== opt));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const match = filteredOptions.find(o => o.toLowerCase() === inputValue.toLowerCase());
      if (match) {
        handleSelect(match);
      } else if (!values.includes(inputValue.trim())) {
        handleSelect(inputValue.trim());
      }
    }
  };

  return (
    <div className="flex flex-col relative flex-1 w-full" ref={wrapperRef}>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">{label}</label>
      <div className="relative w-full border-b border-slate-300 py-1 px-0 rounded-none text-sm bg-transparent focus-within:border-emerald-500 transition-colors flex flex-wrap gap-1 items-center min-h-[30px]">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
            <span>{v}</span>
            <button type="button" onClick={() => handleRemove(v)} className="hover:text-green-900 focus:outline-none">
              &times;
            </button>
          </div>
        ))}
        <input 
          type="text" 
          className="flex-1 bg-transparent outline-none min-w-[100px] px-1 text-sm h-full"
          value={inputValue} 
          onChange={e => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ''}
        />
        <div 
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 p-1 hover:text-slate-600"
          onClick={() => setOpen(!open)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-auto bg-white border border-slate-200 rounded shadow-lg z-50">
          {filteredOptions.length > 0 ? filteredOptions.map((opt, i) => (
            <div 
              key={i} 
              className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer text-slate-800 border-b border-slate-100 last:border-0"
              onClick={() => handleSelect(opt)}
            >
              <div className="font-medium">{opt}</div>
            </div>
          )) : (
            <div className="px-3 py-2 text-sm text-slate-500 italic">Không tìm thấy (nhấn Enter để thêm mới)</div>
          )}
        </div>
      )}
    </div>
  );
}
