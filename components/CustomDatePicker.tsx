// Author: Gemini
// OS support: Web/Node
// Description: Reusable localized date picker with overflow-safe calendar rendering

import React from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { vi } from 'date-fns/locale/vi';
import "react-datepicker/dist/react-datepicker.css";

registerLocale('vi', vi);

interface DatePickerProps {
    value: string;
    onChange: (dateStr: string) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
}

export const CustomDatePicker: React.FC<DatePickerProps> = ({ value, onChange, className, placeholder = 'dd/mm/yyyy', disabled }) => {
    
    const parsedDate = value ? new Date(value) : null;
    const isValidDate = parsedDate && !isNaN(parsedDate.getTime());

    return (
        <div className="relative w-full">
            <DatePicker
                selected={isValidDate ? parsedDate : null}
                onChange={(date) => {
                    if (date) {
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        onChange(`${yyyy}-${mm}-${dd}`);
                    } else {
                        onChange('');
                    }
                }}
                dateFormat="dd/MM/yyyy"
                locale="vi"
                className={className}
                placeholderText={placeholder}
                disabled={disabled}
                isClearable={false}
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                portalId="report-date-picker-portal"
                popperClassName="!z-[2000]"
            />
        </div>
    );
};

// --- End of components/CustomDatePicker.tsx ---
