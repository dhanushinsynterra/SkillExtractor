import { GoogleGenAI, Type } from '@google/genai';
import type { AssessmentReport } from '@skillx/shared';
import { config } from '../config.js';

interface Narrative {
  headline: string;
  strengths: string[];
  risks: string[];
  communication: string;
  technicalNotes: string[];
}

/**
 * Rewrites the heuristic report's prose with a text model, grounded in the
 * transcript and the skill evidence. Scores, recommendation and integrity facts
 * stay heuristic, so the model cannot inflate or invent them.
 */
export async function withModelNarrative(report: AssessmentReport): Promise<AssessmentReport> {
  if (config.mock) return report;

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const evidence = report.technical.skills
    .filter((s) => s.evidence.length)
    .map((s) => `- ${s.name} (depth ${s.depth}/4): ${s.evidence.map((e) => e.note).join(' | ')}`)
    .join('\n');
  const transcript = report.transcript
    .slice(-80)
    .map((t) => `${t.role}: ${t.text}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: config.textModel,
    contents: `You are writing a candidate summary for a hiring manager, HR and the technical team.
Candidate: ${report.candidate.name}, role: ${report.candidate.role}.
Overall score (fixed, do not change): ${report.manager.overallScore}/100.

Skill evidence:
${evidence || '(none)'}

Transcript (most recent part):
${transcript || '(empty)'}

Write concise, specific, neutral prose. Only claim what the evidence or transcript supports.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING, description: 'One sentence for the hiring manager.' },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          risks: { type: Type.ARRAY, items: { type: Type.STRING } },
          communication: { type: Type.STRING, description: 'Two sentences on communication style, for HR.' },
          technicalNotes: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Notes for the technical team.' },
        },
        required: ['headline', 'strengths', 'risks', 'communication', 'technicalNotes'],
      },
    },
  });

  const narrative = JSON.parse(response.text ?? '{}') as Partial<Narrative>;
  if (!narrative.headline) return report;

  return {
    ...report,
    narrativeSource: 'model',
    manager: {
      ...report.manager,
      headline: narrative.headline,
      strengths: narrative.strengths?.length ? narrative.strengths : report.manager.strengths,
      // Keep the factual integrity and coverage risks, and add the model's observations.
      risks: [...new Set([...report.manager.risks, ...(narrative.risks ?? [])])],
    },
    hr: { ...report.hr, communication: narrative.communication || report.hr.communication },
    technical: { ...report.technical, notes: narrative.technicalNotes ?? [] },
  };
}
