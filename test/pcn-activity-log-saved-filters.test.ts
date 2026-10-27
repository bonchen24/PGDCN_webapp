import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACTIVITY_LOG_SAVED_FILTER_LIMIT,
  readActivityLogSavedFilters,
  removeActivityLogSavedFilter,
  upsertActivityLogSavedFilter,
  writeActivityLogSavedFilters,
  type ActivityLogFilterSnapshot,
  type ActivityLogSavedFilter,
} from '../utils/activityLogSavedFilters';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function setupMockStorage(initialStore: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initialStore));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };

  (globalThis as any).window = {
    localStorage: storage,
  };

  return { store, storage };
}

const sampleSnapshot: ActivityLogFilterSnapshot = {
  domain: 'PCN',
  search: 'hồ sơ chứng nhận',
  action: 'UPDATED',
  entityType: 'REQUEST',
  period: 'WEEK',
  selectedActors: ['chuyenvien.a', 'chuyenvien.b'],
};

test('storage isolation: account A and B keep separate presets by username', () => {
  setupMockStorage();

  const filterA: ActivityLogSavedFilter = {
    id: 'preset-a',
    name: 'Bộ lọc A',
    snapshot: sampleSnapshot,
    updatedAt: '2026-10-27T10:00:00.000Z',
  };
  const filterB: ActivityLogSavedFilter = {
    id: 'preset-b',
    name: 'Bộ lọc B',
    snapshot: { ...sampleSnapshot, domain: 'PGD', selectedActors: ['giamdinh.c'] },
    updatedAt: '2026-10-27T11:00:00.000Z',
  };

  assert.equal(writeActivityLogSavedFilters('user_alpha', [filterA]), true);
  assert.equal(writeActivityLogSavedFilters('user_beta', [filterB]), true);

  const readA = readActivityLogSavedFilters('user_alpha');
  const readB = readActivityLogSavedFilters('user_beta');

  assert.equal(readA.length, 1);
  assert.equal(readA[0].name, 'Bộ lọc A');
  assert.deepEqual(readA[0].snapshot.selectedActors, ['chuyenvien.a', 'chuyenvien.b']);

  assert.equal(readB.length, 1);
  assert.equal(readB[0].name, 'Bộ lọc B');
  assert.equal(readB[0].snapshot.domain, 'PGD');
  assert.deepEqual(readB[0].snapshot.selectedActors, ['giamdinh.c']);
});

test('missing or blank username never reads or writes to shared key', () => {
  const { store } = setupMockStorage();

  const filter: ActivityLogSavedFilter = {
    id: 'preset-anon',
    name: 'Preset Ẩn danh',
    snapshot: sampleSnapshot,
    updatedAt: '2026-10-27T10:00:00.000Z',
  };

  assert.equal(writeActivityLogSavedFilters(null, [filter]), false);
  assert.equal(writeActivityLogSavedFilters(undefined, [filter]), false);
  assert.equal(writeActivityLogSavedFilters('', [filter]), false);
  assert.equal(writeActivityLogSavedFilters('   ', [filter]), false);

  assert.equal(store.size, 0);
  assert.deepEqual(readActivityLogSavedFilters(null), []);
  assert.deepEqual(readActivityLogSavedFilters(undefined), []);
  assert.deepEqual(readActivityLogSavedFilters(''), []);
  assert.deepEqual(readActivityLogSavedFilters('   '), []);
});

test('malformed JSON and throwing storage fail safely without error', () => {
  setupMockStorage({
    pgdcn_activity_log_saved_filters_corrupt_user: '{"not": [valid, json}',
  });

  const corruptRead = readActivityLogSavedFilters('corrupt_user');
  assert.deepEqual(corruptRead, []);

  // Throwing storage
  (globalThis as any).window = {
    localStorage: {
      getItem: () => {
        throw new Error('Storage disabled by privacy mode');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
      clear: () => {},
    },
  };

  assert.doesNotThrow(() => {
    const result = readActivityLogSavedFilters('user_err');
    assert.deepEqual(result, []);
  });

  assert.doesNotThrow(() => {
    assert.equal(writeActivityLogSavedFilters('user_err', [{
      id: 'p-1',
      name: 'Test',
      snapshot: sampleSnapshot,
      updatedAt: '2026-10-27T10:00:00.000Z',
    }]), false);
  });
});

test('filters snapshot with multiple actor usernames round-trips intact', () => {
  setupMockStorage();

  const initialList: ActivityLogSavedFilter[] = [];
  const updated = upsertActivityLogSavedFilter(initialList, 'Bộ lọc kiểm tra', sampleSnapshot, '2026-10-27T12:00:00.000Z');
  writeActivityLogSavedFilters('actor_tester', updated);

  const restored = readActivityLogSavedFilters('actor_tester');
  assert.equal(restored.length, 1);
  assert.equal(restored[0].name, 'Bộ lọc kiểm tra');
  assert.deepEqual(restored[0].snapshot, sampleSnapshot);
  assert.deepEqual(restored[0].snapshot.selectedActors, ['chuyenvien.a', 'chuyenvien.b']);
});

test('duplicate name updates existing filter instead of creating duplicate', () => {
  const initial = upsertActivityLogSavedFilter([], 'Lọc Tuần Này', sampleSnapshot, '2026-10-27T08:00:00.000Z');
  assert.equal(initial.length, 1);
  const firstId = initial[0].id;

  const modifiedSnapshot: ActivityLogFilterSnapshot = {
    ...sampleSnapshot,
    search: 'cập nhật từ khóa',
    period: 'MONTH',
  };

  // Upsert with case-insensitive same name
  const next = upsertActivityLogSavedFilter(initial, 'lọc tuần này', modifiedSnapshot, '2026-10-27T09:00:00.000Z');
  assert.equal(next.length, 1);
  assert.equal(next[0].id, firstId);
  assert.equal(next[0].snapshot.search, 'cập nhật từ khóa');
  assert.equal(next[0].snapshot.period, 'MONTH');
  assert.equal(next[0].updatedAt, '2026-10-27T09:00:00.000Z');
});

test('cap at maximum 8 presets and deleting one preserves the others', () => {
  let list: ActivityLogSavedFilter[] = [];
  for (let i = 1; i <= 10; i += 1) {
    list = upsertActivityLogSavedFilter(list, `Preset ${i}`, { ...sampleSnapshot, search: `item ${i}` });
  }

  assert.equal(list.length, ACTIVITY_LOG_SAVED_FILTER_LIMIT);
  assert.equal(ACTIVITY_LOG_SAVED_FILTER_LIMIT, 8);
  assert.equal(list[0].name, 'Preset 10');

  const idToDelete = list[1].id;
  const deletedName = list[1].name;
  const remaining = removeActivityLogSavedFilter(list, idToDelete);

  assert.equal(remaining.length, 7);
  assert.ok(!remaining.some(f => f.id === idToDelete));
  assert.ok(!remaining.some(f => f.name === deletedName));
});

test('ActivityLogView source contract: scopes presets by username and exposes save/apply/delete controls', () => {
  const source = read('components/ActivityLogView.tsx');

  // Must import from dedicated helper
  assert.match(source, /from ['"]\.\.\/utils\/activityLogSavedFilters['"]/);

  // Must read/scope by username
  assert.match(source, /currentUser\??\.username/);

  // Must have saved filter UI container, save button and delete button
  assert.match(source, /data-testid="activity-log-saved-filters"/);
  assert.match(source, /Lưu bộ lọc/);
  assert.match(source, /Xóa bộ lọc đã lưu/);
});

test('ActivityLogView hides saved presets until they are loaded for the current username', () => {
  const source = read('components/ActivityLogView.tsx');

  assert.match(
    source,
    /\{currentUsername\s*&&\s*loadedFilterUsername\s*===\s*currentUsername\s*&&\s*\(/,
  );
});

test('ActivityLogView reports when browser storage cannot save a preset', () => {
  const source = read('components/ActivityLogView.tsx');

  assert.match(source, /Không thể lưu bộ lọc trên trình duyệt này/);
  assert.match(source, /role="status"/);
});
