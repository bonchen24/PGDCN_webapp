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

export const formatDateVN = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return '';
    const vnDate = getVNDate(new Date(dateInput));
    if (isNaN(vnDate.getTime())) return '';
    
    const day = vnDate.getDate().toString().padStart(2, '0');
    const month = (vnDate.getMonth() + 1).toString().padStart(2, '0');
    const year = vnDate.getFullYear();
    
    return `${day}/${month}/${year}`;
};

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
