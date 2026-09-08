// Author: Gemini
// OS support: Web/Node
// Description: Formatting utilities for dates, phone numbers, codes and test durations

export const getVNDate = (dateInput?: string | Date | null): Date => {
    if (!dateInput) return new Date();
    
    let d: Date;
    if (dateInput instanceof Date) {
        d = dateInput;
    } else {
        let str = String(dateInput).trim();
        if (str.startsWith('"') && str.endsWith('"')) {
            str = str.slice(1, -1);
        }
        if (str.startsWith("'") && str.endsWith("'")) {
            str = str.slice(1, -1);
        }
        str = str.trim();
        if (!str) return new Date();
        
        // Match DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            d = new Date(year, month, day, 12, 0, 0);
        } else {
            // Match YYYY-MM-DD
            const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(.*)$/);
            if (ymdMatch) {
                const year = parseInt(ymdMatch[1], 10);
                const month = parseInt(ymdMatch[2], 10) - 1;
                const day = parseInt(ymdMatch[3], 10);
                d = new Date(year, month, day, 12, 0, 0);
            } else {
                d = new Date(str);
            }
        }
    }
    
    if (isNaN(d.getTime())) {
        d = new Date();
    }
    
    try {
        const vnStr = d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnDate = new Date(vnStr);
        if (!isNaN(vnDate.getTime())) {
            return vnDate;
        }
    } catch (e) {
        // Fallback
    }
    return d;
};

export const normalizeDateString = (val: any, returnISO: boolean = false): string | null => {
    if (val === undefined || val === null || val === '') return null;
    
    let str = String(val).trim();
    if (str.startsWith('"') && str.endsWith('"')) {
        str = str.slice(1, -1);
    }
    if (str.startsWith("'") && str.endsWith("'")) {
        str = str.slice(1, -1);
    }
    str = str.trim();
    if (!str) return null;
    
    let parsedDate: Date;
    
    if (str.includes('T') && (str.endsWith('Z') || str.includes('+') || str.includes('-') && str.indexOf('T') < str.lastIndexOf('-'))) {
        parsedDate = new Date(str);
    } else {
        const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            parsedDate = new Date(year, month, day, 12, 0, 0);
        } else {
            const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(.*)$/);
            if (ymdMatch) {
                const year = parseInt(ymdMatch[1], 10);
                const month = parseInt(ymdMatch[2], 10) - 1;
                const day = parseInt(ymdMatch[3], 10);
                parsedDate = new Date(year, month, day, 12, 0, 0);
            } else {
                parsedDate = new Date(str);
            }
        }
    }
    
    if (isNaN(parsedDate.getTime())) return null;
    
    if (returnISO) {
        return parsedDate.toISOString();
    }
    
    const yyyy = parsedDate.getFullYear();
    const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(parsedDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

export const removeAccents = (str: string): string => {
    if (!str) return '';
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

export const getYYMMDD = (dateInput: Date = new Date()): string => {
    const vnDate = getVNDate(dateInput);
    const yy = vnDate.getFullYear().toString().slice(-2);
    const mm = (vnDate.getMonth() + 1).toString().padStart(2, '0');
    const dd = vnDate.getDate().toString().padStart(2, '0');
    return `${yy}${mm}${dd}`;
};

type DateParts = {
    year: number;
    month: number;
    day: number;
};

const isValidDateParts = (parts: DateParts): boolean => {
    if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) return false;
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    return date.getUTCFullYear() === parts.year
        && date.getUTCMonth() === parts.month - 1
        && date.getUTCDate() === parts.day;
};

const formatDateParts = (parts: DateParts): string => (
    `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`
);

const getVietnamDateParts = (date: Date): DateParts | null => {
    if (isNaN(date.getTime())) return null;
    const values = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
    }).formatToParts(date);
    const parts = {
        year: Number(values.find((part) => part.type === 'year')?.value),
        month: Number(values.find((part) => part.type === 'month')?.value),
        day: Number(values.find((part) => part.type === 'day')?.value),
    };
    return isValidDateParts(parts) ? parts : null;
};

const getDateParts = (value: string | Date | null | undefined): DateParts | null => {
    if (value instanceof Date) return getVietnamDateParts(value);
    const text = String(value ?? '').trim();
    if (!text) return null;

    const isoDateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateOnly) {
        const parts = {
            year: Number(isoDateOnly[1]),
            month: Number(isoDateOnly[2]),
            day: Number(isoDateOnly[3]),
        };
        return isValidDateParts(parts) ? parts : null;
    }

    const displayDateOnly = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (displayDateOnly) {
        const parts = {
            year: Number(displayDateOnly[3]),
            month: Number(displayDateOnly[2]),
            day: Number(displayDateOnly[1]),
        };
        return isValidDateParts(parts) ? parts : null;
    }

    return getVietnamDateParts(new Date(text));
};

const getVietnamDateTimeParts = (date: Date): (DateParts & { hour: number; minute: number }) | null => {
    const dateParts = getVietnamDateParts(date);
    if (!dateParts) return null;
    const values = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Ho_Chi_Minh',
    }).formatToParts(date);
    return {
        ...dateParts,
        hour: Number(values.find((part) => part.type === 'hour')?.value),
        minute: Number(values.find((part) => part.type === 'minute')?.value),
    };
};

export const formatDateDdMmYyyy = (value: string | Date | null | undefined): string => {
    const parts = getDateParts(value);
    return parts ? formatDateParts(parts) : '';
};

export const formatDateTimeDdMmYyyy = (value: string | Date | null | undefined): string => {
    if (value instanceof Date) {
        const parts = getVietnamDateTimeParts(value);
        return parts
            ? `${formatDateParts(parts)} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
            : '';
    }
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
        return formatDateDdMmYyyy(text);
    }
    const localDateTime = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/);
    if (localDateTime) {
        const dateParts = {
            year: Number(localDateTime[1]),
            month: Number(localDateTime[2]),
            day: Number(localDateTime[3]),
        };
        const hour = Number(localDateTime[4]);
        const minute = Number(localDateTime[5]);
        if (isValidDateParts(dateParts) && hour <= 23 && minute <= 59) {
            return `${formatDateParts(dateParts)} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        }
        return '';
    }
    const parts = getVietnamDateTimeParts(new Date(text));
    return parts
        ? `${formatDateParts(parts)} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
        : '';
};

export const parseDdMmYyyy = (value: string): string => {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return '';
    const parts = {
        year: Number(match[3]),
        month: Number(match[2]),
        day: Number(match[1]),
    };
    return isValidDateParts(parts)
        ? `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
        : '';
};

export const parseDdMmYyyyTime = (value: string): string => {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (!match) return '';
    const date = parseDdMmYyyy(`${match[1]}/${match[2]}/${match[3]}`);
    if (!date) return '';
    if (match[4] === undefined) return date;
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    if (hour > 23 || minute > 59) return '';
    return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const formatDateVN = (dateInput: string | Date | null | undefined): string => formatDateDdMmYyyy(dateInput);

export const generateSequenceCode = (prefix: string, items: any[], codeField: string, date: Date = new Date(), separator: string = '-'): string => {
    const dateStr = getYYMMDD(date);
    const pattern = `${prefix}${separator}${dateStr}-`;
    
    let maxNum = 0;
    items.forEach(item => {
        if (item[codeField] && typeof item[codeField] === 'string' && item[codeField].startsWith(pattern)) {
            const numStr = item[codeField].substring(pattern.length);
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) {
                maxNum = num;
            }
        }
    });
    
    const tt = (maxNum + 1).toString().padStart(2, '0');
    return `${pattern}${tt}`;
};

export const calculateLotSequenceInYear = (items: any[], date: Date = new Date()): number => {
    const vnDate = getVNDate(date);
    const currentYear = vnDate.getFullYear();
    const yearSuffix = currentYear.toString().slice(-2);
    
    let maxLot = currentYear === 2026 ? 1000 : 0;
    const uniqueRequestsInYear = new Set();
    
    items.forEach(item => {
        const itemDate = getVNDate(item.requestDate || item.arrivalDate || item.createdAt);
        if (itemDate.getFullYear() === currentYear) {
            if (item.requestCode && typeof item.requestCode === 'string' && item.requestCode.trim() !== '' && item.requestCode !== 'CHƯA PHÂN LOẠI') {
                uniqueRequestsInYear.add(item.requestCode.trim());
            }
            if (item.encodeNumber) {
                const encodeStr = String(item.encodeNumber).trim();
                const parts = encodeStr.split('-');
                if (parts.length === 2 && parts[1] === yearSuffix) {
                    const num = parseInt(parts[0], 10);
                    if (!isNaN(num) && num > maxLot) {
                        maxLot = num;
                    }
                }
            }
        }
    });
    
    const countBasedLot = (currentYear === 2026 ? 1000 : 0) + uniqueRequestsInYear.size;
    return Math.max(maxLot, countBasedLot) + 1;
};

export const generateSampleEncodeNumber = (
  prefix: 'ATD' | 'EMC' | 'ITD' | 'ITDC',
  lotEncodeString: string,
  sampleIndexOrMtt: number | string
): string => {
  const mtt = typeof sampleIndexOrMtt === 'number' 
    ? `M${String(sampleIndexOrMtt + 1).padStart(2, '0')}`
    : sampleIndexOrMtt;
  return `${prefix} ${lotEncodeString}-${mtt}`;
};

export const formatTestTime = (minutes?: number | string | null): string => {
    if (minutes === undefined || minutes === null || minutes === '') return '0h00ph';
    const mins = Number(minutes);
    if (isNaN(mins)) return '0h00ph';
    
    const hours = Math.floor(mins / 60);
    const remainingMins = Math.round(mins % 60);
    const formattedMins = remainingMins < 10 ? `0${remainingMins}` : `${remainingMins}`;
    return `${hours}h${formattedMins}ph`;
};

export const formatPhoneNumber = (phone: any): string => {
    if (!phone) return '';
    let p = String(phone).trim();
    if (!p) return '';
    
    p = p.replace(/[\s\-\(\)\.]/g, '');

    if (p.startsWith('+84')) {
        const remaining = p.slice(3);
        return '+84' + remaining.padStart(9, '0');
    }

    if (p.startsWith('84')) {
        const remaining = p.slice(2);
        return '0' + remaining.padStart(9, '0');
    }

    if (p.startsWith('0')) {
        return p.padStart(10, '0');
    }

    return ('0' + p).padStart(10, '0');
};

export const formatTaxId = (taxId: any): string => {
    if (!taxId) return '';
    let t = String(taxId).trim();
    if (!t) return '';
    
    // Remove characters except alphanumeric and hyphen
    t = t.replace(/[^a-zA-Z0-9\-]/g, '');

    if (t.includes('-')) {
        const parts = t.split('-');
        const mainPart = parts[0].padStart(10, '0');
        const subPart = parts[1].padStart(3, '0');
        return `${mainPart}-${subPart}`;
    } else {
        if (/^\d+$/.test(t)) {
            if (t.length <= 10) {
                return t.padStart(10, '0');
            } else {
                return t.padStart(13, '0');
            }
        }
    }
    return t;
};

// --- End of formatter.ts ---
