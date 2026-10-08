import { describe, expect, it } from 'vitest';
import { chooseModel, friendlyError } from '../src/settings';

const opts = (...ids: string[]) => ids.map((id) => ({ id, label: id }));

describe('model selection', () => {
  it('prefers the newest stable live model and skips specialised ones', () => {
    const live = opts(
      'gemini-3.5-transcribe-live',
      'gemini-2.5-flash-native-audio-preview-09-2025',
      'gemini-3.8-live',
      'gemini-3.8-live-extended-thinking',
      'gemini-3.5-live-translate-preview',
    );
    expect(chooseModel(live, 'live')).toBe('gemini-3.8-live');
  });

  it('prefers the newest full flash model for reports', () => {
    const text = opts(
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-nano-banana-2.1',
      'gemini-3.1-pro-preview',
    );
    expect(chooseModel(text, 'text')).toBe('gemini-3.5-flash');
  });

  it('returns undefined when nothing suitable exists', () => {
    expect(chooseModel(opts('gemini-3.5-transcribe-live'), 'live')).toBeUndefined();
  });

  it('extracts readable messages from Gemini error payloads', () => {
    const raw = new Error('got status: 400. {"error":{"code":400,"message":"API key not valid."}}');
    expect(friendlyError(raw)).toBe('API key not valid.');
    expect(friendlyError(new Error('plain'))).toBe('plain');
  });
});
