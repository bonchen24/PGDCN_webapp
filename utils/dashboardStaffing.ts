// Author: Gemini
// OS support: Web/Node
// Description: Resolves Dashboard staff from real test-schedule assignments

export interface ScheduledTesterAssignment {
  id?: string;
  scheduledDate?: string | null;
  testerName?: string | null;
}

const PLACEHOLDER_TESTER_NAMES = new Set(['chưa giao', 'khác']);

export function isRealScheduledTesterAssignment(request: ScheduledTesterAssignment): boolean {
  const scheduledDate = String(request.scheduledDate || '').trim();
  const testerName = String(request.testerName || '').trim();
  return Boolean(scheduledDate && testerName && !PLACEHOLDER_TESTER_NAMES.has(testerName.toLocaleLowerCase('vi-VN')));
}

export function getAssignedTesterNames(requests: ScheduledTesterAssignment[]): Set<string> {
  return new Set(
    requests
      .filter(request => !request.id?.includes('-log-') && isRealScheduledTesterAssignment(request))
      .map(request => String(request.testerName).trim()),
  );
}

// --- End of dashboardStaffing.ts ---
