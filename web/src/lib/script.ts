import { firstName, type CandidateDraft, type TrackId } from './candidate';

/** Display name of the AI interviewer. */
export const AI_NAME = 'Aria';

export type Phase = 'hello' | 'ice_breaker' | 'domain' | 'problem' | 'code_card' | 'wrap_up';

export const PHASES: { id: Phase; label: string }[] = [
  { id: 'hello', label: 'Introduction' },
  { id: 'ice_breaker', label: 'Warm-up' },
  { id: 'domain', label: 'Experience' },
  { id: 'problem', label: 'Problem solving' },
  { id: 'code_card', label: 'Code review' },
  { id: 'wrap_up', label: 'Wrap-up' },
];

export interface Step {
  phase: Phase;
  say: string;
  /** What the candidate does next. */
  expect: 'reply' | 'code' | 'none';
}

interface TrackScript {
  domain: [string, string];
  problem: string;
  problemFollowUp: string;
}

const TRACK_SCRIPTS: Record<TrackId, TrackScript> = {
  frontend: {
    domain: [
      'Tell me about a web interface you built recently. What was the most challenging part?',
      'When that interface felt slow or broke on smaller screens, how did you track down the cause?',
    ],
    problem:
      "Let's work through a scenario together. A registration form occasionally gets submitted twice on slow connections, creating duplicate records. How would you prevent that? Feel free to think out loud.",
    problemFollowUp: 'Good. What would you add on the server side in case a duplicate still gets through?',
  },
  backend: {
    domain: [
      'Describe a backend service or API you have worked on. Walk me through what happens when a request comes in.',
      'Where did the data live, and what would you change if traffic grew tenfold?',
    ],
    problem:
      "Here's a scenario to reason through together. In a ticket booking API, two users try to book the last available seat at the same moment. How do you guarantee only one succeeds?",
    problemFollowUp: 'Makes sense. What should the second user receive, and how would you test this behaviour?',
  },
  data: {
    domain: [
      'Tell me about a dataset you have worked with. What question were you trying to answer?',
      'How did you handle missing or inconsistent values?',
    ],
    problem:
      "Let's think through a scenario. A retailer wants to forecast next week's demand for a product. What data would you collect first, and how would you evaluate whether the model is any good?",
    problemFollowUp: 'Good. What could cause the model to fail in production, and how would you detect it?',
  },
  mobile: {
    domain: [
      'Tell me about an app you have built or contributed to. Which part are you most proud of?',
      'How did the app behave when the network was unreliable?',
    ],
    problem:
      "Let's design something together. A delivery tracking app shows stale or jumping locations when GPS signal is weak. How would you handle that?",
    problemFollowUp: 'I like that. How would you communicate to the user that the location may be out of date?',
  },
  qa: {
    domain: [
      'Tell me about a defect you found that you are proud of. How did you track it down?',
      'How do you decide what to automate and what to test manually?',
    ],
    problem:
      "Here's a scenario. A payment screen sometimes shows a failure, yet the customer is still charged. How would you go about reproducing it?",
    problemFollowUp: 'Good. What would you include in the bug report so an engineer can fix it quickly?',
  },
};

export function buildScript(c: CandidateDraft): Step[] {
  const name = firstName(c.name);
  const t = TRACK_SCRIPTS[c.track];

  return [
    {
      phase: 'hello',
      say: `Hi ${name}, I'm ${AI_NAME}. This is a relaxed conversation about your work rather than a formal test. There are no trick questions, and it's completely fine to take a moment before answering. Shall we begin?`,
      expect: 'reply',
    },
    {
      phase: 'ice_breaker',
      say: "Great. To warm up, what's something you've learned recently that you found genuinely interesting?",
      expect: 'reply',
    },
    { phase: 'domain', say: t.domain[0], expect: 'reply' },
    { phase: 'domain', say: t.domain[1], expect: 'reply' },
    { phase: 'problem', say: t.problem, expect: 'reply' },
    { phase: 'problem', say: t.problemFollowUp, expect: 'reply' },
    {
      phase: 'code_card',
      say: "One last exercise. There's a short code snippet on your screen with a bug in it. Tell me which line to change and what to change it to, and I'll apply exactly that edit. For example: line 3, change this to that.",
      expect: 'code',
    },
    { phase: 'code_card', say: "That's correct, well done. In one sentence, why was it broken?", expect: 'reply' },
    {
      phase: 'wrap_up',
      say: `Thank you, ${name}. That's everything from my side. Your responses will be shared with the hiring team, and you'll see a short summary of your strengths in a moment. Best of luck.`,
      expect: 'none',
    },
  ];
}

const ACKS = ['Got it.', 'Thanks, that helps.', 'That makes sense.', 'Understood.', 'Interesting.'];
export const ack = (i: number) => ACKS[i % ACKS.length];

export const REASSURE = 'Take your time. A rough example is perfectly fine, and you can think out loud.';

// ---------------------------------------------------------------------------
// Code cards: the candidate dictates edits, which are applied verbatim.
// ---------------------------------------------------------------------------

export interface CodeCard {
  title: string;
  language: string;
  lines: string[];
  bugLine: number;
  fixed: string;
  hint: string;
}

export const CODE_CARDS: Record<TrackId, CodeCard> = {
  frontend: {
    title: 'cart.js',
    language: 'JavaScript',
    lines: [
      'function totalPrice(items) {',
      '  let total = 0;',
      '  for (let i = 0; i <= items.length; i++) {',
      '    total += items[i].price * items[i].qty;',
      '  }',
      '  return total;',
      '}',
    ],
    bugLine: 3,
    fixed: 'for (let i = 0; i < items.length; i++) {',
    hint: 'Look at how far the loop goes.',
  },
  backend: {
    title: 'seats.py',
    language: 'Python',
    lines: [
      'def find_seat(seats, wanted):',
      '    for seat in seats:',
      '        if seat["id"] = wanted:',
      '            return seat',
      '    return None',
    ],
    bugLine: 3,
    fixed: 'if seat["id"] == wanted:',
    hint: 'Is line 3 comparing, or assigning?',
  },
  data: {
    title: 'marks.py',
    language: 'Python',
    lines: ['def average(marks):', '    total = 0', '    for m in marks:', '        total = m', '    return total / len(marks)'],
    bugLine: 4,
    fixed: 'total += m',
    hint: 'What does total hold after the loop?',
  },
  mobile: {
    title: 'inbox.dart',
    language: 'Dart',
    lines: [
      'int countUnread(List<Message> msgs) {',
      '  var count = 0;',
      '  for (final m in msgs) {',
      '    if (m.read) count++;',
      '  }',
      '  return count;',
      '}',
    ],
    bugLine: 4,
    fixed: 'if (!m.read) count++;',
    hint: 'Which messages should we be counting?',
  },
  qa: {
    title: 'discount.test.js',
    language: 'JavaScript',
    lines: [
      "test('applies 10% discount code', () => {",
      "  const price = applyDiscount(500, 'SAVE10');",
      '  expect(price).toBe(500);',
      '});',
    ],
    bugLine: 3,
    fixed: 'expect(price).toBe(450);',
    hint: 'What should 500 be after 10% off?',
  },
};

const SPOKEN: [RegExp, string][] = [
  [/\bless than or equal to\b/gi, '<='],
  [/\bgreater than or equal to\b/gi, '>='],
  [/\bless than\b/gi, '<'],
  [/\bgreater than\b/gi, '>'],
  [/\bdouble equals?\b|\bequals equals\b/gi, '=='],
  [/\bplus equals?\b/gi, '+='],
  [/\bnot equals?( to)?\b/gi, '!='],
];

const normaliseSpoken = (s: string) => SPOKEN.reduce((acc, [re, sym]) => acc.replace(re, sym), s);

export type EditResult = { ok: true; line: number; before: string; after: string } | { ok: false; reason: string };

const QUOTE = `[\`'"]?`;
const SWAP_RE = new RegExp(`(?:change|replace|swap)\\s+${QUOTE}(.+?)${QUOTE}\\s+(?:to|with|into|by)\\s+${QUOTE}(.+?)${QUOTE}\\s*\\.?$`, 'i');
const WHOLE_RE = new RegExp(`(?:should be|becomes|to be|make it|write)\\s*:?\\s*${QUOTE}(.+?)${QUOTE}\\s*$`, 'i');

/**
 * Parses "line 3 change X to Y", "on line 3 replace X with Y" or
 * "line 3 should be Z". Applies exactly what was said; no auto-correct.
 */
export function applyEdit(lines: string[], instruction: string): EditResult {
  const text = normaliseSpoken(instruction.trim());
  const lineMatch = text.match(/line\s*(?:number\s*)?(\d+)/i);
  if (!lineMatch) return { ok: false, reason: "Tell me the line number first, like 'line 3'." };
  const line = Number(lineMatch[1]);
  if (line < 1 || line > lines.length) return { ok: false, reason: `There's no line ${line} on this card.` };
  const rest = text.slice((lineMatch.index ?? 0) + lineMatch[0].length).replace(/^[\s,:]+/, '');
  const before = lines[line - 1];
  const indent = before.match(/^\s*/)?.[0] ?? '';

  const swap = rest.match(SWAP_RE);
  if (swap) {
    const [, from, to] = swap;
    if (!before.includes(from)) return { ok: false, reason: `I can't find "${from}" on line ${line}.` };
    return { ok: true, line, before, after: before.replace(from, to) };
  }
  const whole = rest.match(WHOLE_RE);
  if (whole) return { ok: true, line, before, after: indent + whole[1].trim() };
  return { ok: false, reason: "Tell me what to change, like 'change X to Y'." };
}

export const isFixed = (card: CodeCard, lines: string[]) =>
  lines[card.bugLine - 1].replace(/\s+/g, '') === card.fixed.replace(/\s+/g, '');
