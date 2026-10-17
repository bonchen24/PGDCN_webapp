import assert from 'node:assert/strict';
import test from 'node:test';

import * as sourceFormsPanel from '../components/PgdSourceFormsPanel';

const dateHelpers = sourceFormsPanel as unknown as {
  getLocalCalendarDate: (date: Date) => string;
  toLocalIsoTimestamp: (date: string, time: string) => string;
};

function withTimezone<T>(timezone: string, action: () => T): T {
  const previousTimezone = process.env.TZ;
  process.env.TZ = timezone;
  try {
    return action();
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
}

test('default date uses the local calendar day near the UTC date boundary', () => {
  withTimezone('Asia/Bangkok', () => {
    assert.equal(dateHelpers.getLocalCalendarDate(new Date('2026-05-10T17:30:00.000Z')), '2026-05-11');
  });
});

test('event ISO timestamp preserves the entered local day and time', () => {
  withTimezone('Asia/Bangkok', () => {
    const timestamp = dateHelpers.toLocalIsoTimestamp('2026-05-11', '00:30');
    const localTimestamp = new Date(timestamp);

    assert.equal(timestamp, '2026-05-10T17:30:00.000Z');
    assert.equal(
      `${localTimestamp.getFullYear()}-${String(localTimestamp.getMonth() + 1).padStart(2, '0')}-${String(localTimestamp.getDate()).padStart(2, '0')}T${String(localTimestamp.getHours()).padStart(2, '0')}:${String(localTimestamp.getMinutes()).padStart(2, '0')}`,
      '2026-05-11T00:30',
    );
  });
});
