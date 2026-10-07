import type { CodeCardView, TrackId } from '../../shared/types';

/** Short buggy snippets for the code-review stage, one per track. */
interface CodeCard {
  title: string;
  language: string;
  lines: string[];
  bugLine: number;
  /** Accepted fixes for the bug line, compared with whitespace removed. */
  fixes: string[];
  bug: string;
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
    fixes: ['for (let i = 0; i < items.length; i++) {'],
    bug: 'Off-by-one: `<=` reads past the end of the array, so items[items.length] is undefined.',
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
    fixes: ['if seat["id"] == wanted:', "if seat['id'] == wanted:"],
    bug: 'Line 3 uses assignment `=` instead of comparison `==` (a syntax error in Python).',
  },
  data: {
    title: 'scores.py',
    language: 'Python',
    lines: ['def average(scores):', '    total = 0', '    for s in scores:', '        total = s', '    return total / len(scores)'],
    bugLine: 4,
    fixes: ['total += s', 'total = total + s'],
    bug: '`total = s` overwrites the running total instead of accumulating it.',
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
    fixes: ['if (!m.read) count++;', 'if (m.read == false) count++;', 'if (!m.read) { count++; }'],
    bug: 'The condition counts read messages; it should count messages where read is false.',
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
    fixes: ['expect(price).toBe(450);'],
    bug: 'The assertion expects the undiscounted price; 10% off 500 is 450.',
  },
};

const norm = (s: string) => s.replace(/\s+/g, '');

export function newCard(track: TrackId): CodeCardView {
  const c = CODE_CARDS[track];
  return { title: c.title, language: c.language, lines: [...c.lines], changedLine: null, solved: false, attempts: 0 };
}

/** Replaces a whole line verbatim. Returns an error string for bad line numbers. */
export function applyEdit(track: TrackId, view: CodeCardView, line: number, newText: string): string | null {
  if (!Number.isInteger(line) || line < 1 || line > view.lines.length) return `Line ${line} does not exist.`;
  const indent = view.lines[line - 1].match(/^\s*/)?.[0] ?? '';
  view.lines[line - 1] = indent + newText.trim();
  view.changedLine = line;
  view.attempts += 1;
  const c = CODE_CARDS[track];
  view.solved = c.fixes.some((f) => norm(f) === norm(view.lines[c.bugLine - 1]));
  return null;
}

export function numbered(view: CodeCardView) {
  return view.lines.map((l, i) => `${i + 1}: ${l}`).join('\n');
}
