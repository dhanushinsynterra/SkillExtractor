import { describe, expect, it } from 'vitest';
import type { Depth } from '../../shared/types';
import { claim, initCoverage, MAP_BUDGET_MS, matchTopic, nextTopic, recordAnswer } from '../src/skillmap';

const B = MAP_BUDGET_MS;

/** Simulates the interview loop with a fixed answer quality and seconds per answer. */
function simulate(track: Parameters<typeof initCoverage>[0], answer: (sub: string, level: Depth) => Depth, secs = 45) {
  const cov = initCoverage(track);
  let t = 0;
  const order: string[] = [];
  let questions = 0;
  for (;;) {
    const n = nextTopic(cov, t, B, true);
    if (n.action !== 'ask') break;
    if (!n.same) order.push(n.topic.kind);
    recordAnswer(track, cov, n.topic.id, answer(n.topic.subtopics[n.topic.sub], n.topic.level));
    questions++;
    t += secs * 1000;
  }
  return { cov, order, questions, minutes: t / 60_000 };
}

describe('skill map', () => {
  it('matches free-form skill names to topics', () => {
    const cov = initCoverage('frontend');
    expect(matchTopic('frontend', cov, 'React hooks')?.id).toBe('framework');
    expect(matchTopic('frontend', cov, 'Docker')?.id).toBe('docker');
    expect(matchTopic('frontend', cov, 'CSS Grid')?.id).toBe('html_css');
    expect(matchTopic('frontend', cov, 'Rust')).toBeUndefined();
  });

  it('covers role skills first, then related skills, then extra skills', () => {
    const cov = initCoverage('frontend');
    claim('frontend', cov, ['Three.js', 'Docker']);
    const order: string[] = [];
    for (let i = 0; i < 400; i++) {
      const n = nextTopic(cov, 0, B);
      if (n.action !== 'ask') break;
      if (!n.same) order.push(n.topic.kind);
      recordAnswer('frontend', cov, n.topic.id, 2);
    }
    const tiers = order.filter((k, i) => k !== order[i - 1]);
    expect(tiers).toEqual(['core', 'adjacent', 'extra']);
    expect(cov.every((c) => c.status === 'done')).toBe(true);
  });

  it('a strong candidate fills most of the hour with many questions', () => {
    const r = simulate('backend', (_s, level) => level);
    expect(r.questions).toBeGreaterThan(40);
    expect(r.minutes).toBeGreaterThan(40);
    expect(r.cov.filter((c) => c.kind === 'core').every((c) => c.depth != null)).toBe(true);
    expect(r.cov.filter((c) => c.kind === 'adjacent' && c.depth != null).length).toBeGreaterThan(0);
  });

  it('explores several aspects of each role topic, not just one question', () => {
    const r = simulate('frontend', () => 2);
    for (const c of r.cov.filter((x) => x.kind === 'core')) expect(new Set(c.asks).size).toBeGreaterThanOrEqual(2);
  });

  it('climbs the depth ladder while answers are strong', () => {
    const cov = initCoverage('backend');
    const n = nextTopic(cov, 0, B);
    if (n.action !== 'ask') throw new Error('expected a topic');
    const t = n.topic;
    expect(t.level).toBe(2);
    recordAnswer('backend', cov, t.id, 2);
    expect(t.level).toBe(3);
    expect(t.sub).toBe(0);
    recordAnswer('backend', cov, t.id, 2); // could not handle level 3: next aspect
    expect(t.sub).toBe(1);
    expect(t.status).toBe('active');
  });

  it('asks one easier question when the first answer is weak, and stops if they know nothing', () => {
    const cov = initCoverage('data');
    const n = nextTopic(cov, 0, B);
    if (n.action !== 'ask') throw new Error('expected a topic');
    recordAnswer('data', cov, n.topic.id, 0);
    expect(n.topic.level).toBe(1);
    recordAnswer('data', cov, n.topic.id, 0);
    expect(n.topic.status).toBe('done');
  });

  it('prioritises what the candidate says they use, including tools outside the map', () => {
    const cov = initCoverage('frontend');
    expect(claim('frontend', cov, ['Docker', 'Svelte', 'Three.js'])).toEqual(['Docker', 'UI framework', 'Three.js']);
    expect(cov.find((c) => c.label === 'Three.js')?.kind).toBe('extra');
    const first = nextTopic(cov, 0, B);
    expect(first.action === 'ask' && first.topic.id).toBe('framework');
  });

  it('keeps time for related and extra skills, and reports empty / move_on', () => {
    const cov = initCoverage('qa');
    const late = nextTopic(cov, B * 0.8, B);
    expect(late.action === 'ask' && late.topic.kind).toBe('adjacent');
    expect(nextTopic(cov, B, B).action).toBe('move_on');
    const empty = initCoverage('qa').map((c) => ({ ...c, status: 'done' as const }));
    expect(nextTopic(empty, 0, B).action).toBe('empty');
  });

  it('credits skills shown in passing without derailing the current topic', () => {
    const cov = initCoverage('frontend');
    const n = nextTopic(cov, 0, B);
    if (n.action !== 'ask') throw new Error('expected a topic');
    const docker = recordAnswer('frontend', cov, 'Docker', 2)!;
    expect(docker.status).toBe('pending');
    expect(docker.level).toBe(3);
    expect(n.topic.status).toBe('active');
  });
});
