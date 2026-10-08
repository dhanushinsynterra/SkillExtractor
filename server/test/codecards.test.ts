import { describe, expect, it } from 'vitest';
import { applyEdit, newCard, numbered } from '../src/codecards';

describe('code cards', () => {
  it('applies the dictated line verbatim and keeps indentation', () => {
    const card = newCard('frontend');
    expect(applyEdit('frontend', card, 3, 'for (let i = 0; i < items.length; i++) {')).toBeNull();
    expect(card.lines[2]).toBe('  for (let i = 0; i < items.length; i++) {');
    expect(card.solved).toBe(true);
    expect(card.attempts).toBe(1);
    expect(card.changedLine).toBe(3);
  });

  it('does not auto-correct a wrong instruction', () => {
    const card = newCard('frontend');
    applyEdit('frontend', card, 3, 'for (let i = 1; i <= items.length; i++) {');
    expect(card.lines[2]).toContain('i = 1');
    expect(card.solved).toBe(false);
  });

  it('accepts equivalent fixes regardless of whitespace', () => {
    const card = newCard('mobile');
    applyEdit('mobile', card, 4, 'if (!m.read)   count++;');
    expect(card.solved).toBe(true);
  });

  it('rejects line numbers outside the card', () => {
    const card = newCard('qa');
    expect(applyEdit('qa', card, 99, 'x')).toMatch(/does not exist/);
    expect(applyEdit('qa', card, 0, 'x')).toMatch(/does not exist/);
    expect(card.attempts).toBe(0);
  });

  it('numbers lines for the model', () => {
    expect(numbered(newCard('data')).split('\n')[0]).toBe('1: def average(scores):');
  });
});
