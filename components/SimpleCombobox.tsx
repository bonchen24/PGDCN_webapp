import React, { useState, useRef, useEffect } from 'react';

export default function SimpleCombobox({
  label,
  value,
  onChange,
  options,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter options based on typed value
  const filteredOptions = options.filter(o => 
    o.toLowerCase().includes(value.toLowerCase())
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

  return (
    <div className="flex flex-col relative flex-1 w-full" ref={wrapperRef}>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">{label}</label>
      <div className="relative w-full">
        <input 
          type="text" 
          className="w-full border-b border-slate-300 py-1 pr-8 px-0 rounded-none text-sm bg-transparent outline-none focus:border-emerald-500 transition-colors" 
          value={value} 
          onChange={e => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
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
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              <div className="font-medium">{opt}</div>
            </div>
          )) : (
            <div className="px-3 py-2 text-sm text-slate-500 italic">Không tìm thấy (có thể tự nhập thủ công)</div>
          )}
        </div>
      )}
    </div>
  );
}
