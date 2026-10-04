import { describe, expect, it } from 'vitest';
import { applyEdit, CodeEditError, newCardState, pickCard } from '../src/codecards/cards.js';

describe('code cards', () => {
  it('picks a card for the domain', () => {
    expect(pickCard('frontend').domains).toContain('frontend');
  });

  it('applies edits verbatim without auto-correcting', () => {
    const state = newCardState(pickCard('frontend', ['async-total']));
    const next = applyEdit(state, { action: 'replace', line: 5, content: '  }, [qurey]);' });
    expect(next.lines[4]).toBe('  }, [qurey]);');
    expect(next.solved).toBe(false);
    const fixed = applyEdit(next, { action: 'replace', line: 5, content: '  }, [query]);' });
    expect(fixed.solved).toBe(true);
    expect(fixed.edits).toHaveLength(2);
  });

  it('solves the async card with a for...of rewrite', () => {
    let s = newCardState(pickCard('backend'));
    s = applyEdit(s, { action: 'replace', line: 3, content: '  for (const id of ids) {' });
    s = applyEdit(s, { action: 'replace', line: 6, content: '  }' });
    expect(s.solved).toBe(true);
  });

  it('rejects edits to lines that do not exist', () => {
    const s = newCardState(pickCard('backend'));
    expect(() => applyEdit(s, { action: 'delete', line: 99 })).toThrow(CodeEditError);
  });
});
