import type { ConnectOptions, LiveModel, LiveModelHandlers, ToolCall, ToolResponse } from './model.js';

interface Step {
  say: string;
  calls?: Array<Omit<ToolCall, 'id'>>;
}

/**
 * Scripted stand-in for the Live API, used when no GEMINI_API_KEY is set.
 * It replies in text only, and treats a pause after speech (or any typed message)
 * as the end of the candidate's turn, so the full UI flow can be exercised
 * locally.
 */
const SCRIPT: Step[] = [
  {
    say: "Hi! I'm Sage. This is just a relaxed chat, with no trick questions, and thinking out loud is totally fine. How's your day going so far?",
    calls: [{ name: 'set_phase', args: { phase: 'introduction' } }],
  },
  {
    say: "Nice. To warm up, what's a project you worked on recently that you really enjoyed?",
    calls: [{ name: 'set_phase', args: { phase: 'ice_breaker' } }],
  },
  {
    say: 'That sounds fun. How did you structure the data side of it? What did you store, and where?',
    calls: [{ name: 'set_phase', args: { phase: 'domain_exploration' } }],
  },
  {
    say: 'Makes sense. When reads started getting slow, how did you think about caching?',
    calls: [{ name: 'record_skill_evidence', args: { skill: 'Databases', depth: 2, note: '(mock) described their data model' } }],
  },
  {
    say: "Let's think through something together: say we need an API that has to absorb a sudden 10x traffic spike. Where would we start?",
    calls: [
      { name: 'record_skill_evidence', args: { skill: 'Caching', depth: 2, note: '(mock) discussed caching', related_to: 'Databases' } },
      { name: 'set_phase', args: { phase: 'collaborative_problem' } },
    ],
  },
  {
    say: "Love that. One last thing: a teammate's snippet is misbehaving. Can you tell me what's wrong, then dictate the fix to me line by line?",
    calls: [{ name: 'present_code_card', args: {} }],
  },
  {
    say: "Got it, I'll only change exactly what you tell me. Say \"done\" when you're happy with it.",
  },
  {
    say: "Thanks so much, this was a really nice chat! The team will follow up with next steps soon.",
    calls: [
      { name: 'check_code_card', args: {} },
      { name: 'set_phase', args: { phase: 'wrap_up' } },
    ],
  },
  { say: 'Take care!', calls: [{ name: 'end_assessment', args: {} }] },
];

const SPEECH_RMS = 0.02;
const END_OF_TURN_MS = 1200;

export async function connectMock(_options: ConnectOptions, h: LiveModelHandlers): Promise<LiveModel> {
  let step = 0;
  let closed = false;
  let heardSpeech = false;
  let lastSpeechAt = 0;
  let callSeq = 0;
  let timer: NodeJS.Timeout | undefined;

  const advance = () => {
    if (closed || step >= SCRIPT.length) return;
    const current = SCRIPT[step++];
    if (current.calls?.length) h.onToolCalls(current.calls.map((c) => ({ ...c, id: `mock-${++callSeq}` })));
    setTimeout(() => {
      if (closed) return;
      h.onAiTranscript(current.say);
      h.onTurnComplete();
    }, 400);
  };

  const candidateTurnEnded = (text: string) => {
    h.onCandidateTranscript(text);
    advance();
  };

  // Greet first, like the real model does after the setup prompt.
  setTimeout(advance, 600);

  timer = setInterval(() => {
    if (heardSpeech && Date.now() - lastSpeechAt > END_OF_TURN_MS) {
      heardSpeech = false;
      candidateTurnEnded('(spoken answer, no transcription in mock mode)');
    }
  }, 250);

  return {
    kind: 'mock',
    sendAudio(data) {
      if (rms(data) > SPEECH_RMS) {
        heardSpeech = true;
        lastSpeechAt = Date.now();
      }
    },
    audioStreamEnd() {},
    sendText(text) {
      // Orchestrator notes are acknowledged out loud, like the real model would.
      if (text.startsWith('[system]')) {
        if (/nervous/i.test(text)) h.onAiTranscript('No rush at all, take your time. You are doing great.');
        else if (/integrity/i.test(text)) h.onAiTranscript(text.replace(/^\[system\][^:]*:\s*/, ''));
        h.onTurnComplete();
        return;
      }
      candidateTurnEnded(text);
    },
    sendToolResponses(_responses: ToolResponse[]) {},
    close() {
      closed = true;
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}

function rms(base64: string): number {
  const buf = Buffer.from(base64, 'base64');
  const samples = Math.floor(buf.length / 2);
  if (!samples) return 0;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const s = buf.readInt16LE(i * 2) / 32768;
    sum += s * s;
  }
  return Math.sqrt(sum / samples);
}
