// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for PCN department roles

import { fetchPcnDepartmentRoles } from '../../../../lib/server/users.ts';
import { jsonOk, jsonServerError } from '../../../../lib/server/response.ts';

export async function GET() {
  try {
    const items = await fetchPcnDepartmentRoles();
    return jsonOk({ items });
  } catch (error: any) {
    return jsonServerError(error, 'Không thể tải danh sách role phòng ban PCN.');
  }
}
