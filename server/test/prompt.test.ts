import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../shared/types';
import { systemPrompt } from '../src/prompt';
import { buildPrompt } from '../src/report';

describe('interviewer prompt', () => {
  it('addresses the candidate by first name only', () => {
    const p = systemPrompt({ name: 'Dhanush A', email: 'd@example.com', track: 'backend' });
    expect(p).toContain('address them only as "Dhanush"');
    expect(p).toContain('[Candidate request]');
  });

  it('adds patience guidance when extra time is requested', () => {
    const base = systemPrompt({ name: 'Jo', email: 'j@example.com', track: 'qa' });
    const extra = systemPrompt({ name: 'Jo', email: 'j@example.com', track: 'qa', prefs: { extraTime: true } });
    expect(base).not.toContain('extra thinking time');
    expect(extra).toContain('extra thinking time');
  });
});

describe('report prompt', () => {
  it('includes timestamps and fairness rules', () => {
    const s = {
      id: 'x',
      candidate: { name: 'Jo', email: 'j@example.com', track: 'qa' },
      status: 'completed',
      phase: 'wrap_up',
      createdAt: '',
      transcript: [{ who: 'candidate', text: 'I would add retries.', at: 65_000 }],
      evidence: [],
      integrity: [],
      reportStatus: 'none',
    } as SessionRecord;
    const p = buildPrompt(s);
    expect(p).toContain('[01:05] Candidate: I would add retries.');
    expect(p).toContain('Do NOT penalise asking for questions to be repeated');
  });
});
