import { useCallback, useEffect, useRef, useState } from 'react';
import type { CandidateRequest, ClientMessage, CodeCardView, IntegrityKind, Phase, ServerMessage } from '../../../shared/types';
import { levelOf, MicStreamer, Player } from './audio';
import { DEFAULT_THRESHOLD, rmsOf, VoiceGate } from './voicegate';

/**
 * Client side of a live interview: WebSocket to the server (which bridges to
 * Gemini Live), gated microphone streaming, audio playback and transcript.
 */

export type InterviewStatus = 'idle' | 'connecting' | 'reconnecting' | 'listening' | 'thinking' | 'speaking' | 'ended' | 'error';

/** Problems the candidate can act on, shown as a hint under the question. */
export type AudioHint = 'audio_blocked' | 'mic_silent' | 'not_heard' | null;

export interface Turn {
  id: number;
  who: 'ai' | 'candidate';
  text: string;
  final: boolean;
}

interface Options {
  session: { id: string; token: string };
  stream: MediaStream | null;
  /** Element whose --level custom property follows the active voice. */
  levelTarget: React.RefObject<HTMLElement | null>;
  /** Headphones: no speaker echo, so the mic is never held back. */
  fullDuplex: boolean;
  /** Calibrated gate level from the device check (RMS). */
  voiceThreshold?: number | null;
  /** Candidate asked for extra thinking time. */
  extraTime: boolean;
}

const MAX_RECONNECT_MS = 60_000;
const TICK_MS = 80;

export function useInterview({ session, stream, levelTarget, fullDuplex, voiceThreshold, extraTime }: Options) {
  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [phase, setPhase] = useState<Phase>('hello');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [code, setCode] = useState<CodeCardView | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [hint, setHint] = useState<AudioHint>(null);

  const ws = useRef<WebSocket | null>(null);
  const player = useRef<Player | null>(null);
  const mic = useRef<MicStreamer | null>(null);
  const micAnalyser = useRef<AnalyserNode | null>(null);
  const gate = useRef<VoiceGate | null>(null);
  const micOnRef = useRef(micOn);
  const ready = useRef(false);
  const ended = useRef(false);
  const awaitingReply = useRef(false);
  const idRef = useRef(0);
  const reconnectStart = useRef(0);
  const extraTimeRef = useRef(extraTime);
  micOnRef.current = micOn;
  extraTimeRef.current = extraTime;

  /** Local speech tracking, used to recover when the model misses a turn end. */
  const speech = useRef({
    active: false,
    endedAt: 0,
    streamEndSent: true,
    unheardMs: 0,
    lastSignalAt: 0,
    lastAiAt: 0,
  });

  const sendMsg = useCallback((m: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m));
  }, []);

  const closeOpenTurns = useCallback(() => setTurns((ts) => ts.map((t) => (t.final ? t : { ...t, final: true }))), []);

  const appendDelta = useCallback((who: Turn['who'], delta: string) => {
    setTurns((ts) => {
      const last = ts[ts.length - 1];
      if (last && last.who === who && !last.final) {
        return [...ts.slice(0, -1), { ...last, text: last.text + delta }];
      }
      const closed = last && !last.final ? [...ts.slice(0, -1), { ...last, final: true }] : ts;
      return [...closed, { id: ++idRef.current, who, text: delta.trimStart(), final: false }];
    });
  }, []);

  const onServer = useCallback(
    (m: ServerMessage) => {
      switch (m.type) {
        case 'ready':
          ready.current = true;
          reconnectStart.current = 0;
          setError(null);
          setPhase(m.phase);
          setCode(m.code);
          if (m.resumed) setTurns(m.transcript.map((t) => ({ id: ++idRef.current, who: t.who, text: t.text, final: true })));
          setStatus('listening');
          break;
        case 'transcript':
          if (m.who === 'candidate') {
            awaitingReply.current = true;
            speech.current.unheardMs = 0;
            setHint((h) => (h === 'not_heard' ? null : h));
          } else {
            awaitingReply.current = false;
            speech.current.lastAiAt = performance.now();
          }
          appendDelta(m.who, m.delta);
          break;
        case 'turn_complete':
          closeOpenTurns();
          break;
        case 'retract':
          player.current?.flush();
          setTurns((ts) => {
            const last = ts[ts.length - 1];
            return last && last.who === 'ai' && !last.final ? ts.slice(0, -1) : ts;
          });
          break;
        case 'interrupted':
          player.current?.flush();
          closeOpenTurns();
          break;
        case 'phase':
          setPhase(m.phase);
          break;
        case 'code':
          setCode(m.code);
          break;
        case 'ended':
          ended.current = true;
          setEndReason(m.reason);
          setStatus('ended');
          break;
        case 'error':
          setError(m.message);
          break;
      }
    },
    [appendDelta, closeOpenTurns],
  );

  const connect = useCallback(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const sock = new WebSocket(`${proto}://${location.host}/ws/sessions/${session.id}?token=${encodeURIComponent(session.token)}`);
    sock.binaryType = 'arraybuffer';
    ws.current = sock;
    sock.onopen = () => sock.send(JSON.stringify({ type: 'start' } satisfies ClientMessage));
    sock.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        awaitingReply.current = false;
        speech.current.lastAiAt = performance.now();
        player.current?.play(e.data);
      } else onServer(JSON.parse(e.data) as ServerMessage);
    };
    sock.onclose = (e) => {
      if (ws.current !== sock || ended.current) return;
      ready.current = false;
      if (e.code === 4001) {
        ended.current = true;
        setStatus('ended');
        return;
      }
      if (!reconnectStart.current) reconnectStart.current = Date.now();
      if (Date.now() - reconnectStart.current > MAX_RECONNECT_MS) {
        setStatus('error');
        setError('Lost connection to the interview server.');
        return;
      }
      setStatus('reconnecting');
      setTimeout(connect, 1500);
    };
  }, [session.id, session.token, onServer]);

  /** Every ~100 ms mic chunk passes through the voice gate before sending. */
  const onMicChunk = useCallback((pcm: ArrayBuffer) => {
    const sp = speech.current;
    const now = performance.now();
    if (rmsOf(new Int16Array(pcm)) > 0.002) sp.lastSignalAt = now;
    if (!micOnRef.current || !ready.current || ws.current?.readyState !== WebSocket.OPEN || !gate.current) return;

    const p = player.current;
    const r = gate.current.process(pcm, p?.rms() ?? 0, Boolean(p?.busy));
    if (r.bargeIn) {
      p?.flush();
      awaitingReply.current = false;
    }
    ws.current.send(r.out);

    if (r.speech) {
      sp.active = true;
      sp.streamEndSent = false;
      sp.unheardMs += 100;
    } else if (sp.active) {
      sp.active = false;
      sp.endedAt = now;
    }
  }, []);

  /** Must be called from a user gesture (audio contexts need one). */
  const start = useCallback(
    async (mediaStream: MediaStream | null = stream) => {
      if (ws.current) return;
      setStatus('connecting');
      setError(null);
      gate.current = new VoiceGate(voiceThreshold ?? DEFAULT_THRESHOLD, fullDuplex);
      player.current = new Player();
      await player.current.resume().catch(() => {});
      if (!player.current.running) setHint('audio_blocked');
      if (mediaStream?.getAudioTracks().length) {
        mic.current = new MicStreamer(onMicChunk);
        try {
          micAnalyser.current = await mic.current.start(mediaStream);
          speech.current.lastSignalAt = performance.now();
        } catch (e) {
          console.error('Microphone pipeline failed', e);
          setError('Your microphone could not be started. You can type your answers instead.');
        }
      }
      connect();
    },
    [stream, connect, onMicChunk, voiceThreshold, fullDuplex],
  );

  /** Resumes blocked audio output on the next click anywhere. */
  const unblockAudio = useCallback(async () => {
    await player.current?.resume().catch(() => {});
    if (player.current?.running) setHint((h) => (h === 'audio_blocked' ? null : h));
  }, []);

  useEffect(() => {
    if (hint !== 'audio_blocked') return;
    const on = () => void unblockAudio();
    window.addEventListener('pointerdown', on);
    return () => window.removeEventListener('pointerdown', on);
  }, [hint, unblockAudio]);

  // Status, level indicator and missed-turn recovery. A timer (not rAF) so it
  // keeps working when the tab is in the background.
  const live = status !== 'idle' && status !== 'ended' && status !== 'error';
  useEffect(() => {
    if (!live) return;
    const buf = new Float32Array(1024);
    let last = '';
    const t = setInterval(() => {
      const p = player.current;
      const sp = speech.current;
      const now = performance.now();
      const speaking = Boolean(p?.playing);

      let next: InterviewStatus | null = null;
      if (ready.current) next = speaking ? 'speaking' : awaitingReply.current ? 'thinking' : 'listening';
      if (!next) last = '';
      else if (next !== last) {
        last = next;
        setStatus(next);
      }

      let level = 0;
      if (speaking && p) level = levelOf(p.analyser, buf);
      else if (micAnalyser.current && micOnRef.current) level = levelOf(micAnalyser.current, buf);
      levelTarget.current?.style.setProperty('--level', level.toFixed(3));

      if (!ready.current || !micOnRef.current) return;

      // The candidate stopped talking but nothing came back: tell the model the
      // turn is over so it doesn't wait forever on a missed end-of-speech.
      const wait = extraTimeRef.current ? 9000 : 6000;
      if (!sp.active && !sp.streamEndSent && sp.endedAt && now - sp.endedAt > wait && sp.lastAiAt < sp.endedAt) {
        sp.streamEndSent = true;
        sendMsg({ type: 'mic', on: false });
      }

      if (sp.unheardMs > 6000 && !speaking) setHint((h) => h ?? 'not_heard');
      if (now - sp.lastSignalAt > 15000 && micAnalyser.current) setHint((h) => h ?? 'mic_silent');
      else setHint((h) => (h === 'mic_silent' ? null : h));
    }, TICK_MS);
    return () => clearInterval(t);
  }, [live, levelTarget, sendMsg]);

  useEffect(() => {
    ended.current = false;
    return () => {
      ended.current = true;
      ws.current?.close();
      mic.current?.stop();
      player.current?.close();
    };
  }, []);

  const submitText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      setTurns((ts) => [...ts.map((x) => (x.final ? x : { ...x, final: true })), { id: ++idRef.current, who: 'candidate', text: t, final: true }]);
      awaitingReply.current = true;
      speech.current.unheardMs = 0;
      setHint((h) => (h === 'not_heard' ? null : h));
      player.current?.flush();
      sendMsg({ type: 'text', text: t });
    },
    [sendMsg],
  );

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      sendMsg({ type: 'mic', on: !on });
      return !on;
    });
  }, [sendMsg]);

  const setVolume = useCallback((on: boolean) => {
    if (player.current) player.current.volume = on ? 1 : 0;
  }, []);

  /** Help buttons: ask the interviewer to repeat, rephrase or wait. */
  const request = useCallback(
    (kind: CandidateRequest) => {
      player.current?.flush();
      awaitingReply.current = kind !== 'pause';
      sendMsg({ type: 'request', kind });
    },
    [sendMsg],
  );

  const integrity = useCallback((kind: IntegrityKind, note: string) => sendMsg({ type: 'integrity', kind, note }), [sendMsg]);

  const end = useCallback(() => {
    sendMsg({ type: 'end' });
    ended.current = true;
    setStatus('ended');
    setEndReason('ended_by_candidate');
  }, [sendMsg]);

  const dismissHint = useCallback(() => {
    speech.current.unheardMs = 0;
    speech.current.lastSignalAt = performance.now();
    setHint(null);
  }, []);

  return {
    status,
    phase,
    turns,
    code,
    micOn,
    error,
    endReason,
    hint,
    start,
    submitText,
    toggleMic,
    setVolume,
    integrity,
    request,
    end,
    dismissHint,
    unblockAudio,
  };
}
