
import { CustomerRef } from "../types";

// --- HELPERS ---

/**
 * Hàm xóa dấu Tiếng Việt và chuyển về chữ thường
 */
export const removeAccents = (str: string): string => {
    if (!str) return "";
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D')
              .toLowerCase()
              .trim();
};

/**
 * Hàm chuẩn hóa danh sách khách hàng từ Backend để tối ưu tìm kiếm
 * (Tạo index search string 1 lần)
 */
export const normalizeCustomerData = (rawCustomers: any[]): CustomerRef[] => {
    if (!rawCustomers) return [];
    
    return rawCustomers.map(c => ({
        name: c.name,
        address: c.address,
        // Tạo search key bao gồm cả tên và địa chỉ không dấu
        normalizedSearchStr: removeAccents(`${c.name} ${c.address || ''}`)
    }));
};

/**
 * Hàm tìm kiếm tối ưu
 */
export const searchCustomers = (query: string, data: CustomerRef[]): CustomerRef[] => {
    if (!query || query.length < 1 || !data) return [];
    
    const searchKey = removeAccents(query);
    if (!searchKey) return [];

    const results: CustomerRef[] = [];
    const limit = 10;
    
    for (let i = 0; i < data.length; i++) {
        const c = data[i];
        const searchStr = c.normalizedSearchStr || removeAccents(`${c.name} ${c.address || ''} ${c.taxId || ''}`);
        if (searchStr.includes(searchKey)) {
            results.push(c);
            if (results.length >= limit) break;
        }
    }
    return results;
};

export const searchBrands = (query: string, data: string[]): string[] => {
    if (!query || !data) return [];
    const lowerQuery = removeAccents(query);
    return data.filter(b => 
        removeAccents(b).includes(lowerQuery)
    ).slice(0, 5);
};
