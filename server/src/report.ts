import { Type, type Schema } from '@google/genai';
import { TRACK_LABEL, type Report, type SessionRecord } from '../../shared/types';
import { CODE_CARDS } from './codecards';
import { client, ensureModels, friendlyError, markRefused } from './settings';
import { persist } from './store';

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    verdict: { type: Type.STRING, enum: ['strong', 'promising', 'review', 'hold'] },
    score: { type: Type.INTEGER, description: '0-100 overall' },
    summary: { type: Type.STRING, description: '2-4 sentences for a hiring manager.' },
    nextStep: { type: Type.STRING, description: 'One concrete recommended next step.' },
    communication: { type: Type.INTEGER, description: '1-5' },
    composure: { type: Type.INTEGER, description: '1-5' },
    collaboration: { type: Type.INTEGER, description: '1-5' },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: '2-4 items, addressed to the candidate.' },
    practise: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { title: { type: Type.STRING }, why: { type: Type.STRING } },
        required: ['title', 'why'],
      },
      description: '2-3 concrete topics the candidate should practise.',
    },
    skills: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          kind: { type: Type.STRING, enum: ['core', 'related', 'tool'] },
          depth: { type: Type.INTEGER, description: '0-4' },
          evidence: { type: Type.STRING },
        },
        required: ['name', 'kind', 'depth', 'evidence'],
      },
    },
  },
  required: ['verdict', 'score', 'summary', 'nextStep', 'communication', 'composure', 'collaboration', 'strengths', 'practise', 'skills'],
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function buildPrompt(s: SessionRecord) {
  const card = CODE_CARDS[s.candidate.track];
  const transcript = s.transcript.map((t) => `[${fmt(t.at)}] ${t.who === 'ai' ? 'Interviewer' : 'Candidate'}: ${t.text}`).join('\n');
  const evidence = s.evidence.map((e) => `- ${e.skill} (${e.kind}, depth ${e.depth}): ${e.evidence}`).join('\n') || '(none recorded)';
  const integrity = s.integrity.map((e) => `- [${fmt(e.at)}] ${e.kind}: ${e.note}`).join('\n') || '(none)';
  const code = s.code
    ? `Card ${card.title}. Bug: ${card.bug}. Solved: ${s.code.solved}. Edit attempts: ${s.code.attempts}. Final code:\n${s.code.lines.join('\n')}`
    : 'The code card stage was not reached.';

  return `You are assessing a recorded voice interview for a ${TRACK_LABEL[s.candidate.track]} role. Write a fair, evidence-based report.

Rules:
- Base every judgement on the transcript. Quote or paraphrase the candidate in skill evidence.
- Do NOT penalise accent, grammar, nervousness or speech-recognition errors in the transcript; judge technical substance.
- Do NOT penalise asking for questions to be repeated or rephrased, taking time to think, long pauses, or brief tangents. These are neutral, and many neurodivergent candidates rely on them.
- Integrity events are context for a human reviewer. Only use verdict "review" when they materially matter; never treat them as proof of cheating.
- If the interview is too short to judge, use verdict "review" and say so in the summary.
- verdict: strong (clearly ready for the next round), promising (good, with gaps to probe), review (a human should look before deciding), hold (not ready yet).
- Merge duplicate skills; keep the most informative evidence.

Interviewer's live skill notes:
${evidence}

Code card:
${code}

Integrity events:
${integrity}

Transcript:
${transcript || '(empty)'}`;
}

export async function generateReport(s: SessionRecord): Promise<void> {
  if (s.transcript.filter((t) => t.who === 'candidate').length === 0) {
    s.reportStatus = 'failed';
    s.reportError = 'The candidate did not answer any questions.';
    persist(s.id, true);
    return;
  }
  s.reportStatus = 'pending';
  s.reportError = undefined;
  persist(s.id);
  try {
    const ask = async (model: string) =>
      client().models.generateContent({
        model,
        contents: buildPrompt(s),
        config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 },
      });
    // Retired models can still be listed but answer 404; skip them and retry.
    let res;
    for (let attempt = 0; ; attempt++) {
      const model = (await ensureModels()).reportModel;
      try {
        res = await ask(model);
        break;
      } catch (e) {
        if ((e as { status?: number }).status !== 404 || attempt >= 3) throw e;
        console.warn(`Report model ${model} was refused (404); trying another.`);
        markRefused(model);
      }
    }
    const r = JSON.parse(res.text ?? '{}') as Report;
    s.report = {
      ...r,
      score: clamp(r.score, 0, 100),
      communication: clamp(r.communication, 1, 5),
      composure: clamp(r.composure, 1, 5),
      collaboration: clamp(r.collaboration, 1, 5),
      skills: (r.skills ?? []).map((k) => ({ ...k, depth: clamp(k.depth, 0, 4) as Report['skills'][number]['depth'] })),
    };
    s.reportStatus = 'ready';
  } catch (e) {
    console.error(`Report generation failed for ${s.id}:`, e);
    s.reportStatus = 'failed';
    s.reportError = friendlyError(e);
  }
  persist(s.id, true);
}
