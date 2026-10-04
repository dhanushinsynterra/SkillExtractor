import { describe, expect, it } from 'vitest';
import { buildHeuristicReport, overallScore, recommend } from '../src/report/generate.js';
import { appendTranscript, finish, SessionStore } from '../src/sessions/store.js';

describe('report', () => {
  it('returns insufficient_data when there is little evidence', () => {
    expect(recommend(90, 1, false)).toBe('insufficient_data');
    expect(recommend(90, 10, true)).toBe('no');
  });

  it('scores zero for an empty graph', () => {
    const s = new SessionStore({ maxViolations: 3 }).create({ name: 'Ada', role: 'Backend', domain: 'backend' });
    expect(overallScore(s.skills.snapshot().nodes)).toBe(0);
  });

  it('builds a report for all three audiences', () => {
    const s = new SessionStore({ maxViolations: 3 }).create({ name: 'Ada', role: 'Backend', domain: 'backend' });
    s.skills.addEvidence({ skill: 'API design', depth: 4, note: 'versioning strategy' });
    s.skills.addEvidence({ skill: 'API design', depth: 3, note: 'pagination trade-offs' });
    s.skills.addEvidence({ skill: 'Databases', depth: 3, note: 'indexes' });
    appendTranscript(s, 'candidate', 'I usually start from the access patterns.');
    s.integrity.evaluate({ type: 'phone_detected', at: new Date().toISOString() });
    finish(s, 'completed');

    const r = buildHeuristicReport(s);
    expect(r.manager.overallScore).toBeGreaterThan(0);
    expect(r.manager.strengths[0]).toMatch(/API design/);
    expect(r.hr.integrity.verdict).toBe('minor_flags');
    expect(r.technical.coverage.probed).toBe(2);
    expect(r.transcript).toHaveLength(1);
  });

  it('merges transcript fragments from the same speaker', () => {
    const s = new SessionStore({ maxViolations: 3 }).create({ name: 'Ada', role: 'Backend', domain: 'backend' });
    appendTranscript(s, 'ai', 'Hello');
    appendTranscript(s, 'ai', ', how are');
    appendTranscript(s, 'ai', 'you?');
    expect(s.transcript).toEqual([expect.objectContaining({ text: 'Hello, how are you?' })]);
  });
});
