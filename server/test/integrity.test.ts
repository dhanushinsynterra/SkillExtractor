import { describe, expect, it } from 'vitest';
import { IntegrityPolicy } from '../src/integrity/policy.js';

const at = new Date().toISOString();

describe('IntegrityPolicy', () => {
  it('logs brief glances without counting them', () => {
    const p = new IntegrityPolicy();
    expect(p.evaluate({ type: 'gaze_away', at, durationMs: 1200 }).verdict).toBe('logged');
    expect(p.violationCount).toBe(0);
  });

  it('adapts the gaze threshold to the candidate baseline, within bounds', () => {
    const p = new IntegrityPolicy();
    for (const d of [2500, 2600, 2800, 2900]) p.evaluate({ type: 'gaze_away', at, durationMs: d });
    expect(p.gazeThresholdMs()).toBeGreaterThan(3000);
    expect(p.gazeThresholdMs()).toBeLessThanOrEqual(8000);
    expect(p.evaluate({ type: 'gaze_away', at, durationMs: 3500 }).verdict).toBe('logged');
  });

  it('warns first and terminates only after repeated violations', () => {
    const p = new IntegrityPolicy({ maxViolations: 2, dedupeWindowMs: 0 });
    const t = 1_000_000;
    expect(p.evaluate({ type: 'phone_detected', at }, t).verdict).toBe('warning');
    expect(p.evaluate({ type: 'phone_detected', at }, t + 1).verdict).toBe('warning');
    expect(p.evaluate({ type: 'phone_detected', at }, t + 2).verdict).toBe('terminate');
  });

  it('de-duplicates bursts of the same violation', () => {
    const p = new IntegrityPolicy();
    const t = 1_000_000;
    expect(p.evaluate({ type: 'phone_detected', at }, t).verdict).toBe('warning');
    expect(p.evaluate({ type: 'phone_detected', at }, t + 2000).verdict).toBe('logged');
    expect(p.violationCount).toBe(1);
  });

  it('ignores low-confidence detections', () => {
    const p = new IntegrityPolicy();
    expect(p.evaluate({ type: 'multiple_faces', at, confidence: 0.2 }).verdict).toBe('ignored');
  });
});
