import type { AssessmentReport, Recommendation, SkillNode } from '@skillx/shared';
import { DEPTH_LABELS } from '@skillx/shared';
import { cardById } from '../codecards/cards.js';
import type { AssessmentSession } from '../sessions/store.js';

/** Weighted 0..100 score: core skills count most, and confidence damps thin evidence. */
export function overallScore(skills: SkillNode[]): number {
  const weight = { core: 3, related: 2, tool: 1 } as const;
  let num = 0;
  let den = 0;
  for (const s of skills) {
    const w = weight[s.kind];
    den += w * 4;
    num += w * s.depth * (0.5 + 0.5 * s.confidence);
  }
  return den ? Math.round((num / den) * 100) : 0;
}

export function recommend(score: number, evidenceCount: number, terminated: boolean): Recommendation {
  if (terminated) return 'no';
  if (evidenceCount < 3) return 'insufficient_data';
  if (score >= 70) return 'strong_yes';
  if (score >= 55) return 'yes';
  if (score >= 42) return 'lean_yes';
  if (score >= 28) return 'lean_no';
  return 'no';
}

export function buildHeuristicReport(session: AssessmentSession): AssessmentReport {
  const skills = session.skills.snapshot().nodes;
  const evidenced = skills.filter((s) => s.evidence.length > 0);
  const terminated = session.status === 'terminated';
  const score = overallScore(skills);
  const records = session.integrity.records.filter((r) => r.verdict !== 'ignored');
  const warnings = records.filter((r) => r.verdict === 'warning').length;
  const end = session.endedAt ?? new Date();
  const start = session.startedAt ?? session.createdAt;

  const strengths = [...evidenced]
    .filter((s) => s.depth >= 3)
    .sort((a, b) => b.depth - a.depth || b.confidence - a.confidence)
    .slice(0, 5)
    .map((s) => `${s.name}: ${DEPTH_LABELS[s.depth].toLowerCase()} (${s.evidence.at(-1)?.note ?? ''})`);

  const risks: string[] = [];
  const weakCore = skills.filter((s) => s.kind === 'core' && s.evidence.length > 0 && s.depth <= 1);
  const unexploredCore = skills.filter((s) => s.kind === 'core' && s.evidence.length === 0);
  if (weakCore.length) risks.push(`Limited depth in core areas: ${weakCore.map((s) => s.name).join(', ')}.`);
  if (unexploredCore.length) risks.push(`Not covered in conversation: ${unexploredCore.map((s) => s.name).join(', ')}.`);
  if (warnings) risks.push(`${warnings} integrity warning(s) during the session.`);
  if (terminated) risks.push('Session was terminated after repeated integrity violations.');

  const candidateTurns = session.transcript.filter((t) => t.role === 'candidate');
  const avgWords = candidateTurns.length
    ? Math.round(candidateTurns.reduce((n, t) => n + t.text.split(/\s+/).length, 0) / candidateTurns.length)
    : 0;

  const card = session.codeCard ? cardById(session.codeCard.cardId) : undefined;

  return {
    sessionId: session.id,
    candidate: session.candidate,
    generatedAt: new Date().toISOString(),
    status: session.status,
    durationMinutes: Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)),
    narrativeSource: 'heuristic',
    manager: {
      headline: `${session.candidate.name} showed ${scoreWord(score)} depth for ${session.candidate.role} across ${evidenced.length} skills.`,
      recommendation: recommend(score, evidenced.reduce((n, s) => n + s.evidence.length, 0), terminated),
      overallScore: score,
      strengths,
      risks,
    },
    hr: {
      communication: candidateTurns.length
        ? `${candidateTurns.length} conversational turns, averaging ${avgWords} words each.`
        : 'Not enough conversation captured to comment on communication.',
      composure:
        session.affect.episodes === 0
          ? 'Stayed composed throughout; no sustained nervousness detected.'
          : `${session.affect.episodes} short period(s) of nervousness detected; the AI offered reassurance ${session.affect.reassurances} time(s).`,
      nervousnessEpisodes: session.affect.episodes,
      reassurancesGiven: session.affect.reassurances,
      integrity: {
        verdict: terminated ? 'terminated' : warnings >= 2 ? 'serious_flags' : warnings === 1 ? 'minor_flags' : 'clean',
        warnings,
        events: records.filter((r) => r.verdict !== 'logged' || r.type !== 'gaze_away'),
      },
    },
    technical: {
      skills: [...skills].sort((a, b) => b.depth - a.depth || a.name.localeCompare(b.name)),
      coverage: session.skills.coverage(),
      codeCard:
        card && session.codeCard
          ? {
              title: card.title,
              solved: session.codeCard.solved,
              edits: session.codeCard.edits.length,
              finalLines: session.codeCard.lines,
            }
          : undefined,
      notes: [],
    },
    transcript: session.transcript,
  };
}

function scoreWord(score: number): string {
  if (score >= 70) return 'strong';
  if (score >= 50) return 'solid';
  if (score >= 30) return 'moderate';
  return 'limited';
}
