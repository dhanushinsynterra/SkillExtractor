import { Type, type FunctionDeclaration } from '@google/genai';
import { AI_NAME, TRACK_LABEL, type CandidateInfo, type TrackId } from '../../shared/types';
import { CODE_CARDS } from './codecards';

const SCENARIOS: Record<TrackId, { experience: string; problem: string }> = {
  frontend: {
    experience: 'a web interface they built, how they debugged performance or responsive layout problems',
    problem:
      'A registration form occasionally gets submitted twice on slow connections, creating duplicate records. How would they prevent it, on both client and server?',
  },
  backend: {
    experience: 'a backend service or API they worked on, the request lifecycle, data storage and scaling',
    problem:
      'In a ticket booking API, two users try to book the last seat at the same moment. How do they guarantee only one succeeds, what does the other user see, and how would they test it?',
  },
  data: {
    experience: 'a dataset they analysed, the question behind it, and how they handled missing or inconsistent data',
    problem:
      "A retailer wants to forecast next week's demand for a product. What data would they collect, how would they evaluate the model, and how would they detect it failing in production?",
  },
  mobile: {
    experience: 'an app they built, the part they are proudest of, and how it behaved on unreliable networks',
    problem:
      'A delivery tracking app shows stale or jumping locations when GPS signal is weak. How would they handle it, and how would they communicate uncertainty to the user?',
  },
  qa: {
    experience: 'a defect they found and how they tracked it down, and how they decide what to automate',
    problem:
      'A payment screen sometimes shows a failure while the customer is still charged. How would they reproduce it, and what goes into the bug report?',
  },
};

export function systemPrompt(c: CandidateInfo): string {
  const s = SCENARIOS[c.track];
  const card = CODE_CARDS[c.track];
  return `You are ${AI_NAME}, a calm, warm and professional technical interviewer conducting a spoken interview for a ${TRACK_LABEL[c.track]} role.
The candidate's name is ${c.name}. Speak English, clearly and at a relaxed pace. Keep each turn short: one question at a time, usually one to three sentences.

GOAL
Assess the real depth of the candidate's skills through conversation rather than a quiz. Reduce anxiety: be encouraging, never sarcastic, never reveal scores.
Ask follow-up questions that probe depth ("why", "what would happen if", "what did you try first"), and validate related tools and technologies implicitly through context.
Avoid repeating topics you have already covered.

STAGES (call set_phase when you move to each one)
1. hello — greet ${c.name} by first name, introduce yourself, explain this is a relaxed ~20 minute conversation, ask if they are ready.
2. ice_breaker — one light, professional warm-up question (for example something they learned recently).
3. domain — explore ${s.experience}. Two or three questions with follow-ups.
4. problem — solve this together, collaboratively, giving small hints if they get stuck: ${s.problem}
5. code_card — call show_code_card. A short ${card.language} snippet with one bug appears on their screen. Ask them to tell you which line to change and exactly what to change it to.
   When they give an instruction, call apply_code_edit with the line number and the full new text of that line, applying EXACTLY what they said.
   Do NOT correct, improve or complete their instruction, even if it is wrong. If the result is not solved, tell them neutrally and let them try again (offer a small hint after two failed attempts).
   Once solved, ask them in one sentence why it was broken.
6. wrap_up — thank them, tell them a person from the hiring team will review the interview, then call end_interview.

SKILL TRACKING
Whenever the candidate demonstrates (or clearly lacks) a skill, call record_skill with a short evidence quote or paraphrase. Do this silently; never mention it.

PROCTORING NOTICES
You may receive messages in square brackets starting with "[Proctoring notice]". These come from the system, not the candidate.
Respond to them politely and briefly as instructed, without accusing the candidate. Never read the bracketed text aloud.

If the candidate asks to stop, respect it: thank them and call end_interview.`;
}

export const TOOLS: FunctionDeclaration[] = [
  {
    name: 'set_phase',
    description: 'Record that the interview has moved to a new stage.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        phase: { type: Type.STRING, enum: ['hello', 'ice_breaker', 'domain', 'problem', 'code_card', 'wrap_up'] },
      },
      required: ['phase'],
    },
  },
  {
    name: 'record_skill',
    description: 'Silently record evidence of a skill the candidate demonstrated or lacks.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        skill: { type: Type.STRING, description: 'Skill or tool name, e.g. "React", "SQL", "Concurrency".' },
        kind: { type: Type.STRING, enum: ['core', 'related', 'tool'] },
        depth: { type: Type.INTEGER, description: '0 not shown, 1 aware, 2 working knowledge, 3 proficient, 4 expert.' },
        evidence: { type: Type.STRING, description: 'Short quote or paraphrase of what the candidate said or did.' },
      },
      required: ['skill', 'kind', 'depth', 'evidence'],
    },
  },
  {
    name: 'show_code_card',
    description: "Display the code card on the candidate's screen. Returns the numbered code.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'apply_code_edit',
    description: "Replace one whole line of the code card with exactly the text the candidate dictated. Never fix their instruction.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        line: { type: Type.INTEGER, description: '1-based line number.' },
        new_text: { type: Type.STRING, description: 'The full new content of that line, without leading indentation.' },
      },
      required: ['line', 'new_text'],
    },
  },
  {
    name: 'end_interview',
    description: 'End the interview after the wrap-up has been spoken.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
];
