import { describe, expect, it } from 'vitest';
import { SkillGraph } from '../src/skills/graph.js';

describe('SkillGraph', () => {
  it('seeds nodes from the domain catalog', () => {
    const g = SkillGraph.forDomain('backend');
    expect(g.get('SQL')?.kind).toBe('tool');
    expect(g.coverage().probed).toBe(0);
  });

  it('falls back to the first catalog for unknown domains', () => {
    expect(SkillGraph.forDomain('underwater basket weaving').get('API design')).toBeDefined();
  });

  it('raises confidence with corroborating evidence', () => {
    const g = SkillGraph.forDomain('backend');
    const first = g.addEvidence({ skill: 'Databases', depth: 3, note: 'explained indexes' });
    expect(first.confidence).toBe(0.4);
    const second = g.addEvidence({ skill: 'Databases', depth: 3, note: 'covered isolation levels' });
    expect(second.confidence).toBe(0.64);
    expect(second.depth).toBe(3);
  });

  it('adds unknown skills as new nodes linked to their context', () => {
    const g = SkillGraph.forDomain('backend');
    const node = g.addEvidence({ skill: 'gRPC', depth: 2, note: 'used it for services', relatedTo: 'API design' });
    expect(node.id).toBe('grpc');
    expect(g.snapshot().edges).toContainEqual({ from: 'api_design', to: 'grpc', relation: 'related_to' });
  });

  it('suggests unprobed neighbours of demonstrated skills first', () => {
    const g = SkillGraph.forDomain('backend');
    g.addEvidence({ skill: 'Caching', depth: 2, note: 'cache-aside' });
    const ranked = g.suggestNextProbes(20).map((n) => n.id);
    expect(ranked[0]).toBe('api_design'); // core and adjacent
    expect(ranked.indexOf('redis')).toBeLessThan(ranked.indexOf('docker'));
  });

  it('does not resolve very short fragments to arbitrary skills', () => {
    expect(SkillGraph.forDomain('backend').resolve('a')).toBeUndefined();
  });
});
