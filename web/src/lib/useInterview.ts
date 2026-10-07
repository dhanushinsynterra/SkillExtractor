import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, CodeCardView, IntegrityKind, Phase, ServerMessage } from '../../../shared/types';
import { levelOf, MicStreamer, Player } from './audio';

/**
 * Client side of a live interview: WebSocket to the server (which bridges to
 * Gemini Live), microphone streaming, audio playback and transcript state.
 */

export type InterviewStatus = 'idle' | 'connecting' | 'reconnecting' | 'listening' | 'thinking' | 'speaking' | 'ended' | 'error';

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
}

const MAX_RECONNECT_MS = 60_000;

export function useInterview({ session, stream, levelTarget }: Options) {
  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [phase, setPhase] = useState<Phase>('hello');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [code, setCode] = useState<CodeCardView | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const player = useRef<Player | null>(null);
  const mic = useRef<MicStreamer | null>(null);
  const micAnalyser = useRef<AnalyserNode | null>(null);
  const micOnRef = useRef(micOn);
  const ready = useRef(false);
  const ended = useRef(false);
  const awaitingReply = useRef(false);
  const idRef = useRef(0);
  const reconnectStart = useRef(0);
  micOnRef.current = micOn;

  const sendMsg = useCallback((m: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m));
  }, []);

  const appendDelta = useCallback((who: Turn['who'], delta: string) => {
    setTurns((ts) => {
      const last = ts[ts.length - 1];
      if (last && last.who === who && !last.final) {
        return [...ts.slice(0, -1), { ...last, text: last.text + delta }];
      }
      // A new speaker closes the previous turn.
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
          if (m.who === 'candidate') awaitingReply.current = true;
          else awaitingReply.current = false;
          appendDelta(m.who, m.delta);
          break;
        case 'turn_complete':
          setTurns((ts) => ts.map((t) => (t.final ? t : { ...t, final: true })));
          break;
        case 'interrupted':
          player.current?.flush();
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
    [appendDelta],
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

  /** Must be called from a user gesture (audio contexts need one). */
  const start = useCallback(async (mediaStream: MediaStream | null = stream) => {
    if (ws.current) return;
    setStatus('connecting');
    setError(null);
    player.current = new Player();
    await player.current.resume();
    if (mediaStream?.getAudioTracks().length) {
      mic.current = new MicStreamer((pcm) => {
        if (micOnRef.current && ready.current && ws.current?.readyState === WebSocket.OPEN) ws.current.send(pcm);
      });
      try {
        micAnalyser.current = await mic.current.start(mediaStream);
      } catch (e) {
        console.error('Microphone pipeline failed', e);
      }
    }
    connect();
  }, [stream, connect]);

  // Drive status (speaking / thinking / listening) and the level indicator.
  useEffect(() => {
    if (status === 'idle' || status === 'ended' || status === 'error') return;
    const buf = new Float32Array(1024);
    let raf = 0;
    let last = '';
    const loop = () => {
      const p = player.current;
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
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status === 'idle' || status === 'ended' || status === 'error', levelTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      ended.current = true;
      ws.current?.close();
      mic.current?.stop();
      player.current?.close();
    },
    [],
  );

  const submitText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      setTurns((ts) => [...ts.map((x) => (x.final ? x : { ...x, final: true })), { id: ++idRef.current, who: 'candidate', text: t, final: true }]);
      awaitingReply.current = true;
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

  const integrity = useCallback((kind: IntegrityKind, note: string) => sendMsg({ type: 'integrity', kind, note }), [sendMsg]);

  const end = useCallback(() => {
    sendMsg({ type: 'end' });
    ended.current = true;
    setStatus('ended');
    setEndReason('ended_by_candidate');
  }, [sendMsg]);

  return { status, phase, turns, code, micOn, error, endReason, start, submitText, toggleMic, setVolume, integrity, end };
}
