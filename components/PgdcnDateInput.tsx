'use client';

import { useEffect, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import {
  formatDateDdMmYyyy,
  formatDateTimeDdMmYyyy,
  parseDdMmYyyy,
  parseDdMmYyyyTime,
} from '../utils/formatter';

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value?: string | null;
  onChange: (value: string) => void;
};

function useDisplayDraft(value: string | null | undefined, format: (input: string | null | undefined) => string) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => format(value));

  useEffect(() => {
    if (!focused) setDraft(format(value));
  }, [focused, format, value]);

  return { draft, setDraft, focused, setFocused };
}

export function PgdcnDateInput({ value, onChange, placeholder = 'dd/mm/yyyy', onBlur, onFocus, ...props }: DateInputProps) {
  const display = useDisplayDraft(value, formatDateDdMmYyyy);
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={display.draft}
      onFocus={(event) => {
        display.setFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        display.setDraft(next);
        const parsed = parseDdMmYyyy(next);
        if (parsed || next.trim() === '') onChange(parsed);
      }}
      onBlur={(event) => {
        display.setFocused(false);
        const parsed = parseDdMmYyyy(display.draft);
        if (parsed || display.draft.trim() === '') {
          onChange(parsed);
          display.setDraft(parsed ? formatDateDdMmYyyy(parsed) : '');
        } else {
          display.setDraft(formatDateDdMmYyyy(value));
        }
        onBlur?.(event);
      }}
    />
  );
}

export function PgdcnDateTimeInput({ value, onChange, placeholder = 'dd/mm/yyyy HH:mm', onBlur, onFocus, ...props }: DateInputProps) {
  const display = useDisplayDraft(value, formatDateTimeDdMmYyyy);
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={display.draft}
      onFocus={(event) => {
        display.setFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        display.setDraft(next);
        const parsed = parseDdMmYyyyTime(next);
        if (parsed || next.trim() === '') onChange(parsed);
      }}
      onBlur={(event) => {
        display.setFocused(false);
        const parsed = parseDdMmYyyyTime(display.draft);
        if (parsed || display.draft.trim() === '') {
          onChange(parsed);
          display.setDraft(parsed ? formatDateTimeDdMmYyyy(parsed) : '');
        } else {
          display.setDraft(formatDateTimeDdMmYyyy(value));
        }
        onBlur?.(event);
      }}
    />
  );
}

export default PgdcnDateInput;
