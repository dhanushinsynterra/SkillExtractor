import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SessionRecord, TrackId } from '../../shared/types';
import { instructionLeakDetector } from '../src/prompt';

const candidate = (track: TrackId) => ({ name: 'Dhanush A', email: 'd@example.com', track });

describe('instruction leak detector', () => {
  const leaked = instructionLeakDetector(candidate('backend'));

  it('flags the interviewer reading its instructions', () => {
    expect(
      leaked(
        'Could you please explain the flow of a message through your WebSocket service? Got it." or "Makes sense.") are fine. Avoid long praise or summaries. - Use plain',
      ),
    ).toBe(true);
    expect(leaked('When they give an instruction, call apply_code_edit with the line number')).toBe(true);
    expect(leaked('Messages starting with [Candidate request] come from help buttons')).toBe(true);
  });

  it('does not flag normal interviewer speech, including the scripted scenario', () => {
    const fine = [
      "Hello Dhanush, I'm Aria, and this is a relaxed conversation of about twenty minutes, so are you ready to start?",
      "Wonderful. To start off, what is an interesting technical concept or tool you've learned recently?",
      'Got it. Could you tell me about a backend service you have worked on and explain how the request lifecycle worked?',
      'In a ticket booking API, two users try to book the last seat at the same moment. How do you guarantee only one succeeds, what does the other user see, and how would you test it?',
      'Sorry, could you say that again?',
      'Of course, take your time.',
    ];
    for (const line of fine) expect(leaked(line), line).toBe(false);
  });

  it('does not flag any interviewer line from recorded sessions', () => {
    const dir = path.resolve('data/sessions');
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as SessionRecord;
      const check = instructionLeakDetector(s.candidate);
      for (const t of s.transcript.filter((x) => x.who === 'ai')) {
        // The one known leak in the recorded data is expected to be flagged.
        if (/Avoid long praise|apply_code_edit|SKILL TRACKING/.test(t.text)) continue;
        expect(check(t.text), t.text).toBe(false);
      }
    }
  });
});
