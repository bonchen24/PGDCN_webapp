// Author: Gemini
// OS support: Web/Node
// Description: Utility functions for scheduling, date calculations, and multi-chamber auto-scheduling for EMC testing

import { TestRequest, DayConfig, RequestStatus, LAB_CONSTANTS, AppSettings, SampleStatus, TestCategory, getProductDefaultTime } from '../types';
import { getVNDate } from './formatter';

const formatDateKey = (date: Date): string => {
  const vnDate = getVNDate(date);
  const y = vnDate.getFullYear();
  const m = (vnDate.getMonth() + 1).toString().padStart(2, '0');
  const d = vnDate.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getWorkDaysRange = (startDate: Date, daysNeeded: number, settings: AppSettings): string[] => {
    const dates: string[] = [];
    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    const workOnSat = settings.workOnSaturday !== false; 
    const workOnSun = settings.workOnSunday === true;

    let count = 0;
    let safetyLoop = 0;

    while (count < daysNeeded && safetyLoop < 90) {
        const dayOfWeek = currentDate.getDay();
        const isWeekendOff = (dayOfWeek === 0 && !workOnSun) || (dayOfWeek === 6 && !workOnSat);
        
        if (!isWeekendOff) {
            dates.push(formatDateKey(currentDate));
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
        safetyLoop++;
    }
    return dates;
};

export function calculateInternalDeadline(req: TestRequest): Date | null;
export function calculateInternalDeadline(requestDateStr: string | null | undefined, typeOrDays: string | number | undefined): Date | null;
export function calculateInternalDeadline(first: any, second?: any): Date | null {
    let dateStr: string | null = null;
    let explicitDeadlineStr: string | undefined = undefined;

    if (first && typeof first === 'object' && 'id' in first) {
        const req = first as TestRequest;
        explicitDeadlineStr = req.deadlineDate;
        dateStr = req.receivedDate || null;
    } else {
        dateStr = first;
    }

    if (explicitDeadlineStr) {
        const parts = explicitDeadlineStr.split(/[\/\-]/);
        if (parts.length >= 2) {
            const dd = parseInt(parts[0], 10);
            const mm = parseInt(parts[1], 10);
            if (!isNaN(dd) && !isNaN(mm)) {
                let year = new Date().getFullYear();
                if (dateStr) {
                    const receivedDate = new Date(dateStr);
                    if (!isNaN(receivedDate.getTime())) {
                        year = receivedDate.getFullYear();
                    }
                }
                if (parts.length === 3) {
                    const yyyy = parseInt(parts[2], 10);
                    if (!isNaN(yyyy)) year = yyyy < 100 ? 2000 + yyyy : yyyy;
                }
                return new Date(year, mm - 1, dd, 23, 59, 59);
            }
        }
    }

    if (!dateStr) return null;

    const daysNeeded = 10;
    let currentDate = getVNDate(new Date(dateStr));
    let addedDays = 0;

    while (addedDays < daysNeeded) {
        currentDate.setDate(currentDate.getDate() + 1);
        const day = currentDate.getDay();
        if (day !== 0 && day !== 6) {
            addedDays++;
        }
    }
    return currentDate;
}

export const sortPendingRequests = (requests: TestRequest[]): TestRequest[] => {
  return [...requests].sort((a, b) => {
    const aInLab = a.sampleStatus === SampleStatus.IN_LAB;
    const bInLab = b.sampleStatus === SampleStatus.IN_LAB;
    if (aInLab !== bInLab) return aInLab ? -1 : 1;

    const deadlineAObj = calculateInternalDeadline(a);
    const deadlineBObj = calculateInternalDeadline(b);
    const deadlineA = deadlineAObj ? deadlineAObj.getTime() : Infinity;
    const deadlineB = deadlineBObj ? deadlineBObj.getTime() : Infinity;
    if (deadlineA !== deadlineB) return deadlineA - deadlineB;

    if (b.priority !== a.priority) return b.priority - a.priority;
    
    const timeA = a.requestDate ? new Date(a.requestDate).getTime() : 0;
    const timeB = b.requestDate ? new Date(b.requestDate).getTime() : 0;
    return timeA - timeB;
  });
};

export const calculateRequestsLoad = (reqs: TestRequest[], category: TestCategory, products?: any[]) => {
    if (reqs.length === 0) return 0;
    let totalMin = 0;
    reqs.forEach((req, idx) => {
        let duration = 0;
        if (req.status === RequestStatus.CANCELLED) {
            duration = 30;
        } else {
            const matchedProduct = products?.find(p => String(p.name || '').trim().toLowerCase() === String(req.type || '').trim().toLowerCase());
            const defaults = getProductDefaultTime(req.type);
            if (category === TestCategory.EMC) {
                const prodTime = matchedProduct?.testTimeEMC !== undefined ? matchedProduct.testTimeEMC : defaults.testTimeEMC;
                const testTime = req.testTimeEMC !== undefined && req.testTimeEMC !== null ? req.testTimeEMC : (prodTime || 0);
                duration = testTime * (req.quantity || 1);
            } else {
                const prodTime = matchedProduct?.testTimeATD !== undefined ? matchedProduct.testTimeATD : defaults.testTimeATD;
                const testTime = req.testTimeATD !== undefined && req.testTimeATD !== null ? req.testTimeATD : (prodTime || 0);
                duration = testTime * (req.quantity || 1);
            }
        }
        totalMin += duration;
        if (idx > 0) {
            totalMin += 30;
        }
    });
    return totalMin / 60;
};

export const autoSchedule = (
  pendingRequests: TestRequest[],
  currentScheduledRequests: TestRequest[],
  dayConfigs: Record<string, DayConfig>,
  settings: AppSettings,
  testers?: any[],
  products?: any[]
): TestRequest[] => {
  
  const inLabPending = pendingRequests.filter(r => r.sampleStatus === SampleStatus.IN_LAB);
  const sortedPending = sortPendingRequests(inLabPending);
  const newSchedule: TestRequest[] = [];
  
  const scheduledByDateChamber1: Record<string, TestRequest[]> = {};
  const scheduledByDateChamber2: Record<string, TestRequest[]> = {};
  const scheduledByDateAtd: Record<string, TestRequest[]> = {};

  currentScheduledRequests.forEach(req => {
    if (req.scheduledDate) {
        const dateKey = formatDateKey(new Date(req.scheduledDate));
        if (req.testCategory === TestCategory.EMC || req.testCategory === TestCategory.BOTH) {
            const chamber = req.chamberId || 'Chamber 1';
            if (chamber === 'Chamber 2') {
                if (!scheduledByDateChamber2[dateKey]) scheduledByDateChamber2[dateKey] = [];
                scheduledByDateChamber2[dateKey].push(req);
            } else {
                if (!scheduledByDateChamber1[dateKey]) scheduledByDateChamber1[dateKey] = [];
                scheduledByDateChamber1[dateKey].push(req);
            }
        } else {
            if (!scheduledByDateAtd[dateKey]) scheduledByDateAtd[dateKey] = [];
            scheduledByDateAtd[dateKey].push(req);
        }
    }
  });

  const now = getVNDate();
  now.setHours(0, 0, 0, 0); 
  const today = now;
  
  const workOnSat = settings.workOnSaturday !== false;
  const workOnSun = settings.workOnSunday === true;

  let availableTestersAtd = settings.defaultTestersAtd || [];
  let availableTestersChamber1 = settings.defaultTestersChamber1 || settings.defaultTestersEmc || [];
  let availableTestersChamber2 = settings.defaultTestersChamber2 || settings.defaultTestersEmc || [];
  
  if (testers && testers.length > 0) {
    if (availableTestersAtd.length === 0) {
      availableTestersAtd = testers.filter(t => 
        (t.responsibilities && (t.responsibilities.toUpperCase().includes('ATD') || t.responsibilities.toUpperCase().includes('ATĐ') || t.responsibilities.toUpperCase().includes('ITD') || t.responsibilities.toUpperCase().includes('ITDC') || t.responsibilities.toUpperCase().includes('TẤT CẢ'))) || 
        (t.position && (t.position.toUpperCase().includes('ATĐ') || t.position.toUpperCase().includes('ATD') || t.position.toUpperCase().includes('ITD') || t.position.toUpperCase().includes('ITDC') || t.position.toUpperCase().includes('AN TOÀN ĐIỆN')))
      ).map(t => t.name);
    }
    
    const emcFallback = testers.filter(t => 
      (t.responsibilities && (t.responsibilities.toUpperCase().includes('EMC') || t.responsibilities.toUpperCase().includes('TẤT CẢ'))) || 
      (t.position && (t.position.toUpperCase().includes('EMC') || t.position.toUpperCase().includes('TƯƠNG THÍCH ĐIỆN TỪ')))
    ).map(t => t.name);

    if (availableTestersChamber1.length === 0) {
      availableTestersChamber1 = emcFallback;
    }
    if (availableTestersChamber2.length === 0) {
      availableTestersChamber2 = emcFallback;
    }
  }

  let testerIndexAtd = 0; 
  let testerIndexEmc1 = 0;
  let testerIndexEmc2 = 0;
  
  const emcActiveHours = [
    ...pendingRequests.filter(r => r.testCategory === TestCategory.EMC || r.testCategory === TestCategory.BOTH),
    ...currentScheduledRequests.filter(r => r.testCategory === TestCategory.EMC || r.testCategory === TestCategory.BOTH)
  ].filter(r => r.sampleStatus === SampleStatus.IN_LAB && r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.RESULTS_APPROVED && r.status !== RequestStatus.CANCELLED)
   .reduce((sum, req) => {
      const matchedProduct = products?.find(p => String(p.name || '').trim().toLowerCase() === String(req.type || '').trim().toLowerCase());
      const defaults = getProductDefaultTime(req.type);
      const prodTime = matchedProduct?.testTimeEMC !== undefined ? matchedProduct.testTimeEMC : defaults.testTimeEMC;
      const testTime = req.testTimeEMC !== undefined && req.testTimeEMC !== null ? req.testTimeEMC : (prodTime || 0);
      const hoursPerSample = testTime / 60;
      return sum + (req.quantity * hoursPerSample);
   }, 0);
  
  const isEmcPeak = emcActiveHours > 80;

  for (const req of sortedPending) {
    const isEMC = req.testCategory === TestCategory.EMC || req.testCategory === TestCategory.BOTH;

    for (let i = 0; i < 60; i++) {
        const checkDate = addDays(today, i);
        const dateKey = formatDateKey(checkDate);
        const dayOfWeek = checkDate.getDay();
        
        if (dayConfigs[dateKey]?.isHoliday) {
            continue;
        }

        const isWeekendOff = (dayOfWeek === 0 && !workOnSun) || (dayOfWeek === 6 && !workOnSat);
        if (isWeekendOff) continue;

        if (isEMC) {
            const FILL_CAPACITY = isEmcPeak ? LAB_CONSTANTS.CAPACITY_PEAK : LAB_CONSTANTS.CAPACITY_NORMAL;
            
            const currentChamber1List = scheduledByDateChamber1[dateKey] || [];
            const currentChamber2List = scheduledByDateChamber2[dateKey] || [];

            const loadWithNew1 = calculateRequestsLoad([...currentChamber1List, req], TestCategory.EMC, products);
            const loadWithNew2 = calculateRequestsLoad([...currentChamber2List, req], TestCategory.EMC, products);

            const fits1 = loadWithNew1 <= (FILL_CAPACITY + 1.0);
            const fits2 = loadWithNew2 <= (FILL_CAPACITY + 1.0);

            if (fits1 || fits2) {
                let chosenChamber: 'Chamber 1' | 'Chamber 2' = 'Chamber 1';
                if (fits1 && fits2) {
                    chosenChamber = loadWithNew1 <= loadWithNew2 ? 'Chamber 1' : 'Chamber 2';
                } else if (fits1) {
                    chosenChamber = 'Chamber 1';
                } else {
                    chosenChamber = 'Chamber 2';
                }

                let assignedTester = req.testerName;
                if (!assignedTester || assignedTester === 'Khác') {
                    if (chosenChamber === 'Chamber 1') {
                        if (availableTestersChamber1.length > 0) {
                            assignedTester = availableTestersChamber1[testerIndexEmc1 % availableTestersChamber1.length];
                            testerIndexEmc1++;
                        }
                    } else {
                        if (availableTestersChamber2.length > 0) {
                            assignedTester = availableTestersChamber2[testerIndexEmc2 % availableTestersChamber2.length];
                            testerIndexEmc2++;
                        }
                    }
                }

                const scheduledReq = {
                    ...req,
                    status: RequestStatus.SCHEDULED,
                    scheduledDate: dateKey,
                    chamberId: chosenChamber,
                    testerName: assignedTester || req.testerName
                };

                newSchedule.push(scheduledReq);

                if (chosenChamber === 'Chamber 1') {
                    if (!scheduledByDateChamber1[dateKey]) scheduledByDateChamber1[dateKey] = [];
                    scheduledByDateChamber1[dateKey].push(scheduledReq);
                } else {
                    if (!scheduledByDateChamber2[dateKey]) scheduledByDateChamber2[dateKey] = [];
                    scheduledByDateChamber2[dateKey].push(scheduledReq);
                }
                break;
            }
        } else {
            const FILL_CAPACITY = LAB_CONSTANTS.CAPACITY_NORMAL;
            const currentAtdList = scheduledByDateAtd[dateKey] || [];
            const loadWithNewAtd = calculateRequestsLoad([...currentAtdList, req], TestCategory.ATD, products);

            if (loadWithNewAtd <= (FILL_CAPACITY + 1.0)) {
                let assignedTester = req.testerName;
                if (!assignedTester || assignedTester === 'Khác') {
                    if (availableTestersAtd.length > 0) {
                        assignedTester = availableTestersAtd[testerIndexAtd % availableTestersAtd.length];
                        testerIndexAtd++;
                    }
                }

                const scheduledReq = {
                    ...req,
                    status: RequestStatus.SCHEDULED,
                    scheduledDate: dateKey,
                    testerName: assignedTester || req.testerName
                };

                newSchedule.push(scheduledReq);

                if (!scheduledByDateAtd[dateKey]) scheduledByDateAtd[dateKey] = [];
                scheduledByDateAtd[dateKey].push(scheduledReq);
                break;
            }
        }
    }
  }

  return newSchedule;
};

// --- End of scheduler.ts ---
