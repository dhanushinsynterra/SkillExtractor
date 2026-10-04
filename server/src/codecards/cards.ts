import type { CodeCardView, CodeEdit } from '@skillx/shared';

export interface CodeCardDefinition {
  id: string;
  domains: string[];
  title: string;
  language: string;
  /** What the candidate sees. Never reveals the bug. */
  prompt: string;
  lines: string[];
  /** Private notes for the AI: the bug and what a good fix looks like. */
  bugNotes: string;
  /** Skill this card exercises, for evidence logging. */
  skill: string;
  isSolved(lines: string[]): boolean;
}

const joined = (lines: string[]) => lines.join('\n').replace(/\s+/g, ' ');

export const CODE_CARDS: CodeCardDefinition[] = [
  {
    id: 'async-total',
    domains: ['backend', 'frontend'],
    title: 'Order total comes back as 0',
    language: 'typescript',
    prompt: 'This helper is supposed to add up the prices of an order. It keeps returning 0. Walk me through it?',
    lines: [
      'async function orderTotal(ids: string[]): Promise<number> {',
      '  let total = 0;',
      '  ids.forEach(async (id) => {',
      '    const item = await fetchItem(id);',
      '    total += item.price;',
      '  });',
      '  return total;',
      '}',
    ],
    bugNotes:
      'forEach does not await async callbacks, so the function returns before any price is added. ' +
      'Good fixes: a for...of loop with await, or `const items = await Promise.all(ids.map(fetchItem))` then reduce.',
    skill: 'Concurrency & async',
    isSolved(lines) {
      const code = joined(lines);
      if (/\.forEach\(\s*async/.test(code)) return false;
      const forOf = /for\s*\(\s*(const|let)\s+\w+\s+of\s+ids\s*\)/.test(code) && /await\s+fetchItem/.test(code);
      const promiseAll = /await\s+Promise\.all\(/.test(code);
      return (forOf || promiseAll) && /return\s+/.test(code);
    },
  },
  {
    id: 'sql-injection',
    domains: ['backend', 'data'],
    title: 'User lookup endpoint',
    language: 'javascript',
    prompt: 'A teammate wrote this lookup. Security review flagged it. What would you change?',
    lines: [
      "app.get('/users', async (req, res) => {",
      '  const name = req.query.name;',
      "  const sql = `SELECT id, email FROM users WHERE name = '${name}'`;",
      '  const rows = await db.query(sql);',
      '  res.json(rows);',
      '});',
    ],
    bugNotes:
      'SQL injection via string interpolation. Fix with a parameterised query, e.g. ' +
      "`db.query('SELECT id, email FROM users WHERE name = $1', [name])` (or `?` placeholders).",
    skill: 'AuthN/AuthZ & security',
    isSolved(lines) {
      const code = joined(lines);
      if (/\$\{\s*name\s*\}/.test(code) || /'\s*\+\s*name/.test(code)) return false;
      return /(\$1|\?)/.test(code) && /db\.query\([^)]*,\s*\[\s*name\s*\]/.test(code);
    },
  },
  {
    id: 'react-stale-effect',
    domains: ['frontend'],
    title: 'Search results never update',
    language: 'tsx',
    prompt: 'Typing in the search box should refresh the results, but it only ever shows the first query. Thoughts?',
    lines: [
      'function Results({ query }: { query: string }) {',
      '  const [items, setItems] = useState<string[]>([]);',
      '  useEffect(() => {',
      '    search(query).then(setItems);',
      '  }, []);',
      '  return <List items={items} />;',
      '}',
    ],
    bugNotes:
      'The effect has an empty dependency array, so it never re-runs when `query` changes. ' +
      'Fix: depend on [query]. Bonus: ignore stale responses with a cancelled flag / AbortController.',
    skill: 'React',
    isSolved(lines) {
      return /\},\s*\[\s*query\s*\]\s*\)/.test(joined(lines));
    },
  },
  {
    id: 'off-by-one-batches',
    domains: ['data', 'devops', 'backend'],
    title: 'Batch job drops records',
    language: 'python',
    prompt: 'This splits records into batches for upload. Ops says the last few records sometimes go missing. Why?',
    lines: [
      'def batches(records, size):',
      '    out = []',
      '    for start in range(0, len(records) - size, size):',
      '        out.append(records[start:start + size])',
      '    return out',
    ],
    bugNotes:
      'range stops at len(records) - size, so the final (possibly partial) batch is skipped. ' +
      'Fix: range(0, len(records), size).',
    skill: 'Pipelines & ETL',
    isSolved(lines) {
      const code = joined(lines);
      return /range\(\s*0\s*,\s*len\(records\)\s*,\s*size\s*\)/.test(code) && /records\[start\s*:\s*start\s*\+\s*size\]/.test(code);
    },
  },
];

export function pickCard(domain: string, exclude: string[] = []): CodeCardDefinition {
  const d = domain.toLowerCase();
  return (
    CODE_CARDS.find((c) => c.domains.includes(d) && !exclude.includes(c.id)) ??
    CODE_CARDS.find((c) => !exclude.includes(c.id)) ??
    CODE_CARDS[0]
  );
}

export function cardById(id: string): CodeCardDefinition | undefined {
  return CODE_CARDS.find((c) => c.id === id);
}

export interface CodeCardState {
  cardId: string;
  lines: string[];
  edits: CodeEdit[];
  solved: boolean;
}

export function newCardState(card: CodeCardDefinition): CodeCardState {
  return { cardId: card.id, lines: [...card.lines], edits: [], solved: false };
}

export class CodeEditError extends Error {}

/**
 * Applies exactly one candidate-dictated edit. No normalisation, no
 * auto-completion — the content is written verbatim so the exercise measures
 * how precisely the candidate communicates.
 */
export function applyEdit(state: CodeCardState, edit: CodeEdit): CodeCardState {
  const lines = [...state.lines];
  const n = Math.trunc(edit.line);
  switch (edit.action) {
    case 'replace':
      if (n < 1 || n > lines.length) throw new CodeEditError(`Line ${n} does not exist (card has ${lines.length} lines).`);
      if (edit.content === undefined) throw new CodeEditError('replace needs content.');
      lines[n - 1] = edit.content;
      break;
    case 'insert_after':
      if (n < 0 || n > lines.length) throw new CodeEditError(`Cannot insert after line ${n}.`);
      if (edit.content === undefined) throw new CodeEditError('insert_after needs content.');
      lines.splice(n, 0, edit.content);
      break;
    case 'delete':
      if (n < 1 || n > lines.length) throw new CodeEditError(`Line ${n} does not exist.`);
      lines.splice(n - 1, 1);
      break;
    default:
      throw new CodeEditError(`Unknown action ${(edit as CodeEdit).action}.`);
  }
  const card = cardById(state.cardId);
  return {
    cardId: state.cardId,
    lines,
    edits: [...state.edits, edit],
    solved: card ? card.isSolved(lines) : false,
  };
}

export function toView(state: CodeCardState): CodeCardView {
  const card = cardById(state.cardId)!;
  return {
    id: card.id,
    title: card.title,
    language: card.language,
    prompt: card.prompt,
    lines: state.lines,
    solved: state.solved,
    edits: state.edits.length,
  };
}
