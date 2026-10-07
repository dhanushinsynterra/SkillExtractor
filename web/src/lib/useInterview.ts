import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CandidateDraft } from './candidate';
import { ack, applyEdit, buildScript, CODE_CARDS, isFixed, REASSURE, type CodeCard, type Phase } from './script';
import { canRecognise, listenOnce, speak, stopSpeaking } from './speech';

/**
 * Scripted stand-in for the Gemini Live session. Same surface the real
 * WebSocket client will expose: status, phase, transcript, code card, and
 * submit/mute/end controls.
 */

export type InterviewStatus = 'idle' | 'speaking' | 'listening' | 'thinking' | 'ended';

export interface Turn {
  id: number;
  who: 'ai' | 'you';
  text: string;
  note?: string;
}

export interface CodeState {
  card: CodeCard;
  lines: string[];
  changed: number | null;
  solved: boolean;
  feedback: string | null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useInterview(candidate: CandidateDraft, opts: { voice: boolean }) {
  const script = useMemo(() => buildScript(candidate), [candidate]);
  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [phase, setPhase] = useState<Phase>('hello');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interim, setInterim] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [code, setCode] = useState<CodeState | null>(null);

  const stepRef = useRef(0);
  const idRef = useRef(0);
  const listenRef = useRef<{ cancel: () => void } | null>(null);
  const aliveRef = useRef(true);
  const voiceRef = useRef(opts.voice);
  const micRef = useRef(micOn);
  const codeRef = useRef(code);
  voiceRef.current = opts.voice;
  micRef.current = micOn;
  codeRef.current = code;

  const push = useCallback((who: Turn['who'], text: string, note?: string) => {
    setTurns((t) => [...t, { id: ++idRef.current, who, text, note }]);
  }, []);

  const say = useCallback(
    async (text: string) => {
      setStatus('speaking');
      push('ai', text);
      if (voiceRef.current) await speak(text);
      else await wait(Math.min(2400, 500 + text.length * 14));
    },
    [push],
  );

  const listen = useCallback(() => {
    if (!aliveRef.current) return;
    setStatus('listening');
    setInterim('');
    if (!canRecognise || !micRef.current) return;
    const l = listenOnce(setInterim);
    listenRef.current = l;
    l.done.then((text) => {
      if (listenRef.current !== l) return;
      listenRef.current = null;
      if (text) handleReply(text);
      else if (aliveRef.current) listen();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runStep = useCallback(
    async (i: number, prefix?: string) => {
      const step = script[i];
      if (!step || !aliveRef.current) return;
      stepRef.current = i;
      setPhase(step.phase);
      if (step.expect === 'code' && !codeRef.current) {
        const card = CODE_CARDS[candidate.track];
        setCode({ card, lines: [...card.lines], changed: null, solved: false, feedback: null });
      }
      await say(prefix ? `${prefix} ${step.say}` : step.say);
      if (!aliveRef.current) return;
      if (step.expect === 'none') {
        setStatus('ended');
        return;
      }
      listen();
    },
    [script, say, listen, candidate.track],
  );

  // Reference kept stable via ref so recognition callbacks see the latest.
  const handleReplyRef = useRef<(text: string) => void>(() => {});
  function handleReply(text: string) {
    handleReplyRef.current(text);
  }

  handleReplyRef.current = async (text: string) => {
    listenRef.current?.cancel();
    listenRef.current = null;
    setInterim('');
    const step = script[stepRef.current];
    if (!step || status === 'ended') return;

    if (step.expect === 'code' && code) {
      const res = applyEdit(code.lines, text);
      if (!res.ok) {
        push('you', text);
        setCode({ ...code, feedback: res.reason });
        setStatus('thinking');
        await wait(500);
        await say(res.reason);
        listen();
        return;
      }
      const lines = code.lines.map((l, idx) => (idx === res.line - 1 ? res.after : l));
      const solved = isFixed(code.card, lines);
      push('you', text, `Line ${res.line} edited`);
      setCode({ ...code, lines, changed: res.line, solved, feedback: null });
      setStatus('thinking');
      await wait(900);
      if (solved) return runStep(stepRef.current + 1);
      await say(`Applied to line ${res.line}. The code still isn't correct. ${code.card.hint}`);
      listen();
      return;
    }

    push('you', text);
    setStatus('thinking');
    await wait(900 + Math.random() * 600);
    const words = text.trim().split(/\s+/).length;
    const deep = step.phase === 'domain' || step.phase === 'problem';
    if (deep && words < 5 && !turns.some((t) => t.note === 'reassured')) {
      push('ai', REASSURE, 'reassured');
      setStatus('speaking');
      if (voiceRef.current) await speak(REASSURE);
      else await wait(1600);
      listen();
      return;
    }
    runStep(stepRef.current + 1, step.phase === 'hello' ? undefined : ack(stepRef.current));
  };

  const start = useCallback(() => {
    aliveRef.current = true;
    runStep(0);
  }, [runStep]);

  const submit = useCallback((text: string) => {
    if (text.trim()) handleReply(text.trim());
  }, []);

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      if (on) {
        listenRef.current?.cancel();
        listenRef.current = null;
        setInterim('');
      }
      return !on;
    });
  }, []);

  // Restart recognition when the mic comes back on mid-listen.
  useEffect(() => {
    if (micOn && status === 'listening' && !listenRef.current) listen();
  }, [micOn, status, listen]);

  const end = useCallback(() => {
    aliveRef.current = false;
    listenRef.current?.cancel();
    stopSpeaking();
    setStatus('ended');
  }, []);

  useEffect(
    () => () => {
      aliveRef.current = false;
      listenRef.current?.cancel();
      stopSpeaking();
    },
    [],
  );

  const stepIndex = stepRef.current;
  return { status, phase, turns, interim, micOn, code, stepIndex, total: script.length, start, submit, toggleMic, end };
}
