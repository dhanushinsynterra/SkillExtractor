import type {
  SkillDepth,
  SkillEdge,
  SkillEvidence,
  SkillGraphSnapshot,
  SkillKind,
  SkillNode,
} from '@skillx/shared';
import { catalogFor } from './catalog.js';

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function clampDepth(n: number): SkillDepth {
  return Math.max(0, Math.min(4, Math.round(n))) as SkillDepth;
}

export interface EvidenceInput {
  skill: string;
  depth: number;
  note: string;
  kind?: SkillKind;
  relatedTo?: string;
  source?: SkillEvidence['source'];
}

/**
 * Real-time skill tracker. Each piece of evidence raises confidence; depth is
 * a confidence-weighted blend of the evidence so a single boastful answer does
 * not immediately read as "expert".
 */
export class SkillGraph {
  private nodes = new Map<string, SkillNode>();
  private edges: SkillEdge[] = [];

  static forDomain(domain: string): SkillGraph {
    const graph = new SkillGraph();
    const catalog = catalogFor(domain);
    for (const s of catalog.skills) {
      graph.nodes.set(s.id, {
        id: s.id,
        name: s.name,
        kind: s.kind,
        depth: 0,
        confidence: 0,
        probed: false,
        evidence: [],
      });
    }
    graph.edges = [...catalog.edges];
    return graph;
  }

  static fromSnapshot(snapshot: SkillGraphSnapshot): SkillGraph {
    const graph = new SkillGraph();
    for (const n of snapshot.nodes) graph.nodes.set(n.id, structuredClone(n));
    graph.edges = [...snapshot.edges];
    return graph;
  }

  /** Resolve a free-text skill name to an existing node id, if any. */
  resolve(skill: string): string | undefined {
    const slug = slugify(skill);
    if (this.nodes.has(slug)) return slug;
    const lower = skill.toLowerCase().trim();
    if (lower.length < 3) return undefined;
    for (const node of this.nodes.values()) {
      const name = node.name.toLowerCase();
      if (name === lower || name.includes(lower) || lower.includes(node.id.replace(/_/g, ' '))) {
        return node.id;
      }
    }
    return undefined;
  }

  markProbed(skill: string): SkillNode {
    const id = this.resolve(skill) ?? this.addNode(skill, 'related');
    const node = this.nodes.get(id)!;
    node.probed = true;
    return node;
  }

  addEvidence(input: EvidenceInput, at = new Date()): SkillNode {
    let id = this.resolve(input.skill);
    if (!id) id = this.addNode(input.skill, input.kind ?? 'tool');
    const node = this.nodes.get(id)!;

    if (input.relatedTo) {
      const relatedId = this.resolve(input.relatedTo);
      if (relatedId && relatedId !== id && !this.hasEdge(relatedId, id)) {
        this.edges.push({ from: relatedId, to: id, relation: 'related_to' });
      }
    }

    const evidence: SkillEvidence = {
      at: at.toISOString(),
      note: input.note.slice(0, 400),
      depth: clampDepth(input.depth),
      source: input.source ?? 'conversation',
    };
    node.evidence.push(evidence);
    node.probed = true;

    // Confidence: 1 - 0.6^n, so 1 → 0.4, 2 → 0.64, 3 → 0.78, 4 → 0.87.
    node.confidence = Number((1 - Math.pow(0.6, node.evidence.length)).toFixed(2));

    // Depth: recency-weighted mean of evidence, pulled toward the strongest
    // demonstrated depth as confidence grows.
    const weights = node.evidence.map((_, i) => 1 + i * 0.5);
    const weighted =
      node.evidence.reduce((sum, e, i) => sum + e.depth * weights[i], 0) /
      weights.reduce((a, b) => a + b, 0);
    const peak = Math.max(...node.evidence.map((e) => e.depth));
    node.depth = clampDepth(weighted * (1 - node.confidence) + Math.max(weighted, peak - 1) * node.confidence);

    return node;
  }

  /**
   * Unprobed skills adjacent to what the candidate has already demonstrated,
   * ranked so the AI asks contextual (not redundant) follow-ups.
   */
  suggestNextProbes(limit = 3): SkillNode[] {
    const demonstrated = new Set(
      [...this.nodes.values()].filter((n) => n.evidence.length > 0).map((n) => n.id),
    );
    const scored = [...this.nodes.values()]
      .filter((n) => !n.probed)
      .map((n) => {
        const adjacency = this.edges.filter(
          (e) => (e.to === n.id && demonstrated.has(e.from)) || (e.from === n.id && demonstrated.has(e.to)),
        ).length;
        const kindWeight = n.kind === 'core' ? 2 : n.kind === 'related' ? 1 : 0.5;
        return { node: n, score: adjacency * 2 + kindWeight };
      })
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.node);
  }

  coverage(): { probed: number; total: number } {
    const all = [...this.nodes.values()];
    return { probed: all.filter((n) => n.probed).length, total: all.length };
  }

  get(skill: string): SkillNode | undefined {
    const id = this.resolve(skill);
    return id ? this.nodes.get(id) : undefined;
  }

  snapshot(): SkillGraphSnapshot {
    return {
      nodes: [...this.nodes.values()].map((n) => structuredClone(n)),
      edges: [...this.edges],
    };
  }

  /** Compact text summary for the model's context. */
  describeForModel(): string {
    const lines = [...this.nodes.values()].map((n) => {
      const status = n.evidence.length
        ? `depth ${n.depth}/4, confidence ${n.confidence}`
        : n.probed
          ? 'asked, no evidence yet'
          : 'not yet explored';
      return `- ${n.name} [${n.kind}]: ${status}`;
    });
    const next = this.suggestNextProbes().map((n) => n.name);
    return `${lines.join('\n')}\nSuggested next topics: ${next.join(', ') || 'none — coverage is good'}`;
  }

  private addNode(name: string, kind: SkillKind): string {
    let id = slugify(name) || `skill_${this.nodes.size + 1}`;
    while (this.nodes.has(id)) id = `${id}_x`;
    this.nodes.set(id, { id, name, kind, depth: 0, confidence: 0, probed: false, evidence: [] });
    return id;
  }

  private hasEdge(from: string, to: string): boolean {
    return this.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from));
  }
}
