import { describe, expect, it } from 'vitest';
import type { AffectSample } from '@skillx/shared';
import { NervousnessDetector } from '../src/affect/nervousness.js';

const sample = (over: Partial<AffectSample> = {}): AffectSample => ({
  at: new Date().toISOString(),
  speechRate: 4,
  pitchMean: 140,
  pitchStd: 15,
  energy: 0.1,
  voicedRatio: 0.6,
  ...over,
});

describe('NervousnessDetector', () => {
  it('builds a baseline before judging', () => {
    const d = new NervousnessDetector();
    for (let i = 0; i < 3; i++) expect(d.push(sample()).score).toBe(0);
  });

  it('reassures after a sustained rise in rate and pitch, then cools down', () => {
    const d = new NervousnessDetector({ baselineSamples: 4, sustain: 2, cooldownMs: 60_000 });
    for (const r of [3.9, 4, 4.1, 4]) d.push(sample({ speechRate: r }), 0);
    const tense = sample({ speechRate: 6, pitchMean: 190, pitchStd: 35 });
    expect(d.push(tense, 1000).shouldReassure).toBe(false);
    expect(d.push(tense, 2000).shouldReassure).toBe(true);
    expect(d.push(tense, 3000).shouldReassure).toBe(false);
    expect(d.reassurances).toBe(1);
    expect(d.episodes).toBe(1);
  });

  it('skips silent windows', () => {
    const d = new NervousnessDetector({ baselineSamples: 1 });
    d.push(sample(), 0);
    expect(d.push(sample({ voicedRatio: 0.05, speechRate: 9 }), 1).nervous).toBe(false);
  });
});
