// Author: Gemini
// OS support: Web/Node
// Description: Fixed Vietnam timezone formatting for system activity timestamps

export const ACTIVITY_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export type ActivityPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export const DEFAULT_ACTIVITY_PERIOD: ActivityPeriod = 'MONTH';

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

const toVietnamDateParts = (value: Date): { year: number; month: number; day: number } => {
  const shifted = new Date(value.getTime() + VIETNAM_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
};

const toUtcIsoFromVietnamDate = (year: number, month: number, day: number): string =>
  new Date(Date.UTC(year, month, day) - VIETNAM_OFFSET_MS).toISOString();

export const getActivityPeriodBounds = (
  period: ActivityPeriod | undefined = DEFAULT_ACTIVITY_PERIOD,
  referenceDate: Date = new Date(),
): { from: string; to: string } => {
  const selectedPeriod = period || DEFAULT_ACTIVITY_PERIOD;
  const { year, month, day } = toVietnamDateParts(referenceDate);
  const localDate = new Date(Date.UTC(year, month, day));
  let startYear = year;
  let startMonth = month;
  let startDay = day;
  let endYear = year;
  let endMonth = month;
  let endDay = day + 1;

  if (selectedPeriod === 'WEEK') {
    const daysFromMonday = (localDate.getUTCDay() + 6) % 7;
    startDay = day - daysFromMonday;
    endDay = startDay + 7;
  } else if (selectedPeriod === 'MONTH') {
    startDay = 1;
    endMonth = month + 1;
    endDay = 1;
  } else if (selectedPeriod === 'YEAR') {
    startMonth = 0;
    startDay = 1;
    endYear = year + 1;
    endMonth = 0;
    endDay = 1;
  }

  return {
    from: toUtcIsoFromVietnamDate(startYear, startMonth, startDay),
    to: new Date(Date.parse(toUtcIsoFromVietnamDate(endYear, endMonth, endDay)) - 1).toISOString(),
  };
};

export const formatActivityTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: ACTIVITY_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
};

// --- End of activityLogTime.ts ---
