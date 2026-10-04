import { Type, type FunctionDeclaration } from '@google/genai';
import { PHASES, type AssessmentPhase, type CodeEdit } from '@skillx/shared';
import { applyEdit, cardById, CodeEditError, newCardState, pickCard, toView } from '../codecards/cards.js';
import type { AssessmentSession } from '../sessions/store.js';

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'record_skill_evidence',
    description: 'Record evidence of a skill the candidate just demonstrated (or failed to demonstrate).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        skill: { type: Type.STRING, description: 'Skill, practice or tool name, e.g. "Caching" or "Redis".' },
        depth: { type: Type.INTEGER, description: '0 none, 1 aware, 2 working knowledge, 3 proficient, 4 expert.' },
        note: { type: Type.STRING, description: 'Short justification quoting or paraphrasing the candidate.' },
        related_to: { type: Type.STRING, description: 'Optional skill this came up in the context of.' },
      },
      required: ['skill', 'depth', 'note'],
    },
  },
  {
    name: 'get_skill_coverage',
    description: 'Get which skills are covered so far and suggested next topics to avoid redundant questions.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'set_phase',
    description: 'Tell the app the conversation moved to a new phase.',
    parameters: {
      type: Type.OBJECT,
      properties: { phase: { type: Type.STRING, enum: [...PHASES] } },
      required: ['phase'],
    },
  },
  {
    name: 'present_code_card',
    description: 'Show the candidate a short buggy code snippet. Returns the code and private notes on the bug.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'edit_code_line',
    description:
      'Apply exactly one edit the candidate dictated to the code card. Use their exact text; never fix anything yourself.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ['replace', 'insert_after', 'delete'] },
        line: { type: Type.INTEGER, description: '1-based line number. For insert_after, 0 inserts at the top.' },
        content: { type: Type.STRING, description: 'Full new line text, exactly as dictated (replace/insert_after).' },
      },
      required: ['action', 'line'],
    },
  },
  {
    name: 'check_code_card',
    description: 'Check whether the code card now works. Call when the candidate says they are done.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'end_assessment',
    description: 'End the conversation after the wrap-up.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

/** Side effects the bridge should forward to the browser after a tool runs. */
export interface ToolEffects {
  skillsChanged?: boolean;
  phaseChanged?: boolean;
  codeCardChanged?: boolean;
  end?: boolean;
}

export interface ToolResult {
  response: Record<string, unknown>;
  effects: ToolEffects;
}

export function runTool(session: AssessmentSession, name: string, args: Record<string, unknown> = {}): ToolResult {
  switch (name) {
    case 'record_skill_evidence': {
      const skill = String(args.skill ?? '').trim();
      if (!skill) return { response: { error: 'skill is required' }, effects: {} };
      const node = session.skills.addEvidence({
        skill,
        depth: Number(args.depth ?? 0),
        note: String(args.note ?? ''),
        relatedTo: args.related_to ? String(args.related_to) : undefined,
        source: session.phase === 'code_card' ? 'code_card' : session.phase === 'collaborative_problem' ? 'problem_solving' : 'conversation',
      });
      return {
        response: { ok: true, skill: node.name, depth: node.depth, confidence: node.confidence },
        effects: { skillsChanged: true },
      };
    }

    case 'get_skill_coverage':
      return { response: { coverage: session.skills.describeForModel() }, effects: {} };

    case 'set_phase': {
      const phase = String(args.phase) as AssessmentPhase;
      if (!PHASES.includes(phase)) return { response: { error: `unknown phase ${phase}` }, effects: {} };
      session.phase = phase;
      return { response: { ok: true }, effects: { phaseChanged: true } };
    }

    case 'present_code_card': {
      if (!session.codeCard) {
        const card = pickCard(session.candidate.domain, session.usedCardIds);
        session.codeCard = newCardState(card);
        session.usedCardIds.push(card.id);
      }
      session.phase = 'code_card';
      const card = cardById(session.codeCard.cardId)!;
      return {
        response: {
          title: card.title,
          framing: card.prompt,
          code: numbered(session.codeCard.lines),
          private_bug_notes: card.bugNotes,
        },
        effects: { codeCardChanged: true, phaseChanged: true },
      };
    }

    case 'edit_code_line': {
      if (!session.codeCard) return { response: { error: 'No code card is showing. Call present_code_card first.' }, effects: {} };
      const edit: CodeEdit = {
        action: args.action as CodeEdit['action'],
        line: Number(args.line),
        content: args.content === undefined ? undefined : String(args.content),
      };
      try {
        session.codeCard = applyEdit(session.codeCard, edit);
      } catch (err) {
        if (err instanceof CodeEditError) return { response: { error: err.message }, effects: {} };
        throw err;
      }
      return { response: { ok: true, code: numbered(session.codeCard.lines) }, effects: { codeCardChanged: true } };
    }

    case 'check_code_card': {
      if (!session.codeCard) return { response: { error: 'No code card is showing.' }, effects: {} };
      const card = cardById(session.codeCard.cardId)!;
      const { solved, edits } = session.codeCard;
      session.skills.addEvidence({
        skill: card.skill,
        depth: solved ? (edits.length <= 3 ? 3 : 2) : 1,
        note: solved
          ? `Fixed the "${card.title}" card with ${edits.length} dictated edit(s).`
          : `Did not fully fix the "${card.title}" card after ${edits.length} edit(s).`,
        source: 'code_card',
      });
      return { response: { solved, edits: edits.length }, effects: { codeCardChanged: true, skillsChanged: true } };
    }

    case 'end_assessment':
      return { response: { ok: true }, effects: { end: true } };

    default:
      return { response: { error: `unknown tool ${name}` }, effects: {} };
  }
}

export function codeCardView(session: AssessmentSession) {
  return session.codeCard ? toView(session.codeCard) : null;
}

function numbered(lines: string[]): string {
  return lines.map((l, i) => `${String(i + 1).padStart(2, ' ')} | ${l}`).join('\n');
}
