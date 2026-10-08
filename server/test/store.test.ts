import { describe, expect, it } from 'vitest';
import * as store from '../src/store';

const candidate = { name: 'Jane Doe', email: 'jane@example.com', track: 'backend' as const };

describe('session store', () => {
  it('authorizes only the matching token', () => {
    const { record, token } = store.create(candidate);
    expect(store.authorize(record.id, token)?.id).toBe(record.id);
    expect(store.authorize(record.id, 'wrong')).toBeUndefined();
    expect(store.authorize(record.id, null)).toBeUndefined();
    expect(store.authorize('missing', token)).toBeUndefined();
  });

  it('never exposes the token hash', () => {
    const { record } = store.create(candidate);
    expect(store.publicRecord(record)).not.toHaveProperty('tokenHash');
  });

  it('summarises duration and integrity flags', () => {
    const { record } = store.create(candidate);
    record.startedAt = '2026-10-08T10:00:00.000Z';
    record.endedAt = '2026-10-08T10:21:30.000Z';
    record.status = 'completed';
    record.integrity.push({ kind: 'absent', note: 'away', severity: 'warn', at: 1000 });
    record.integrity.push({ kind: 'returned', note: 'back', severity: 'info', at: 5000 });
    const s = store.summaries().find((x) => x.id === record.id)!;
    expect(s.durationMin).toBe(22);
    expect(s.flags).toBe(1);
  });

  it('removes sessions', () => {
    const { record } = store.create(candidate);
    store.remove(record.id);
    expect(store.get(record.id)).toBeUndefined();
  });
});
