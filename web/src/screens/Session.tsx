import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Captions, CaptionsOff, Keyboard, Loader2, Mic, MicOff, PhoneOff, Send, ShieldCheck, UserX, Users, Volume2, VolumeX } from 'lucide-react';
import { AI_NAME, PHASES } from '../../../shared/types';
import { Logo } from '../components/Chrome';
import { Voice } from '../components/Voice';
import { useCandidate, firstName } from '../lib/candidate';
import { acquireMedia, currentMedia } from '../lib/media';
import { Proctor, type Presence } from '../lib/proctor';
import { navigate } from '../lib/router';
import { useInterview, type InterviewStatus } from '../lib/useInterview';
import type { CodeCardView } from '../../../shared/types';

const STATUS_TEXT: Record<InterviewStatus, string> = {
  idle: 'Ready when you are',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: `${AI_NAME} is speaking`,
  ended: 'Interview complete',
  error: 'Connection problem',
};

function useClock(running: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function CodeCard({ code }: { code: CodeCardView }) {
  return (
    <section className={`codecard ${code.solved ? 'codecard--solved' : ''}`} aria-label="Code review">
      <header className="codecard-head">
        <span className="codecard-file">{code.title}</span>
        <span className="codecard-lang">{code.language}</span>
      </header>
      <ol className="codecard-lines">
        {code.lines.map((l, i) => (
          <li key={i} className={code.changedLine === i + 1 ? (code.solved ? 'is-fixed' : 'is-changed') : ''}>
            <span className="ln">{i + 1}</span>
            <code>{l || ' '}</code>
          </li>
        ))}
      </ol>
      <footer className="codecard-foot">
        {code.solved ? (
          <span className="status status--ok">Fixed</span>
        ) : (
          <span>Tell {AI_NAME} which line to change and what to change it to.</span>
        )}
        {code.attempts > 0 && <span className="mono-sm">{code.attempts} edit{code.attempts > 1 ? 's' : ''}</span>}
      </footer>
    </section>
  );
}

export default function Session() {
  const candidate = useCandidate();
  const session = candidate.session;
  const [started, setStarted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [voiceOn, setVoiceOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(currentMedia());
  const [presence, setPresence] = useState<Presence>('unknown');
  const voiceRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const logRef = useRef<HTMLOListElement>(null);

  const m = useInterview({ session: session ?? { id: '', token: '' }, stream, levelTarget: voiceRef });
  const live = started && m.status !== 'ended' && m.status !== 'error';
  const clock = useClock(live);
  const hasVideo = Boolean(stream?.getVideoTracks().length);
  const integrity = m.integrity;

  useEffect(() => {
    if (!session) navigate('/', 'back');
  }, [session]);

  // Camera preview + presence detection, reported to the interviewer.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream || !hasVideo || !started) return;
    v.srcObject = stream;
    let prev: Presence = 'unknown';
    const p = new Proctor(v, (next) => {
      setPresence(next);
      if (next === 'absent') integrity('absent', 'No face visible on camera.');
      else if (next === 'multiple') integrity('multiple_faces', 'More than one face visible on camera.');
      else if (next === 'present' && (prev === 'absent' || prev === 'multiple')) integrity('returned', 'Candidate is visible again.');
      prev = next;
    });
    p.start().catch(() => integrity('camera_off', 'Face detection could not load in the browser.'));
    return () => p.stop();
  }, [stream, hasVideo, started, integrity]);

  // Switching tabs or windows during the interview.
  useEffect(() => {
    if (!started) return;
    let t: number | undefined;
    const onVis = () => {
      clearTimeout(t);
      if (document.hidden) t = window.setTimeout(() => integrity('tab_hidden', 'Interview window was hidden for more than 3 seconds.'), 3000);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [started, integrity]);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: 'end' });
  }, [m.turns]);

  useEffect(() => {
    if (m.status !== 'ended') return;
    const t = setTimeout(() => navigate('/done'), 2000);
    return () => clearTimeout(t);
  }, [m.status]);

  useEffect(() => m.setVolume(voiceOn), [voiceOn, m.setVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  async function begin() {
    let s = stream;
    if (!s) {
      try {
        s = await acquireMedia(!candidate.audioOnly);
        setStream(s);
      } catch {
        setTyping(true);
      }
    }
    setStarted(true);
    await m.start(s);
  }

  if (!session) return null;

  const lastAi = [...m.turns].reverse().find((t) => t.who === 'ai');
  const phaseIdx = PHASES.findIndex((p) => p.id === m.phase);

  return (
    <div className={`session ${m.code ? 'session--code' : ''} ${showTranscript && started ? 'session--captions' : ''}`}>
      <header className="session-bar">
        <div className="session-brand">
          <Logo />
          <span>Interview</span>
        </div>
        <ol className="phase-track" aria-label="Interview progress">
          {PHASES.map((p, i) => (
            <li key={p.id} className={i < phaseIdx ? 'done' : i === phaseIdx && started ? 'current' : ''} aria-current={i === phaseIdx ? 'step' : undefined}>
              <span className="phase-dot" />
              <span className="phase-label">{p.label}</span>
            </li>
          ))}
        </ol>
        <div className="session-end">
          <span className="clock" aria-label="Elapsed time">
            {clock}
          </span>
        </div>
      </header>

      <main className="session-main">
        <section className="stage" aria-live="polite">
          {presence === 'absent' && live && (
            <div className="presence-alert" role="alert">
              <UserX size={16} /> You’re not visible on camera. Please return to your seat. {AI_NAME} has paused.
            </div>
          )}
          {presence === 'multiple' && live && (
            <div className="presence-alert" role="alert">
              <Users size={16} /> More than one person is visible. The interview must be completed on your own.
            </div>
          )}

          <Voice ref={voiceRef} state={!started ? 'idle' : m.status === 'speaking' ? 'speaking' : m.status === 'thinking' ? 'thinking' : m.status === 'listening' && m.micOn ? 'listening' : 'idle'} size={m.code ? 'md' : 'lg'} />

          {!started ? (
            <div className="stage-intro">
              <h1 data-route-focus tabIndex={-1}>
                Ready, {firstName(candidate.name)}?
              </h1>
              <p className="muted">
                {AI_NAME} will open the conversation and guide you through each stage. Speak naturally. You can interrupt at any time.
              </p>
              <button className="btn btn--primary btn--lg" onClick={begin}>
                Start interview <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              <p className={`stage-status stage-status--${m.status}`}>
                {(m.status === 'connecting' || m.status === 'reconnecting') && <Loader2 size={12} className="spin" />}
                {m.status === 'listening' && m.micOn && <span className="pulse-dot" />}
                {STATUS_TEXT[m.status]}
                {m.status === 'listening' && !m.micOn && ' · microphone muted'}
              </p>
              {lastAi && (
                <p key={lastAi.id} className="stage-line">
                  {lastAi.text}
                </p>
              )}
              {m.error && (
                <div className="notice notice--warn" role="alert">
                  <AlertTriangle size={16} />
                  <span>{m.error}</span>
                </div>
              )}
              {m.status === 'error' && (
                <button className="btn btn--ghost" onClick={() => location.reload()}>
                  Reconnect
                </button>
              )}
            </>
          )}
        </section>

        {m.code && (
          <div className="code-wrap">
            <CodeCard code={m.code} />
          </div>
        )}

        {showTranscript && started && (
          <aside className="captions" aria-label="Transcript">
            <h2 className="captions-title">Transcript</h2>
            <ol ref={logRef} className="captions-log">
              {m.turns.map((t) => (
                <li key={t.id} className={`bubble bubble--${t.who === 'ai' ? 'ai' : 'you'} ${t.final ? '' : 'bubble--interim'}`}>
                  <span className="bubble-who">{t.who === 'ai' ? AI_NAME : 'You'}</span>
                  {t.text}
                </li>
              ))}
              {m.turns.length === 0 && <li className="bubble muted">The conversation will appear here.</li>}
            </ol>
          </aside>
        )}

        {hasVideo && started && (
          <div className={`selfview ${presence === 'absent' || presence === 'multiple' ? 'is-alert' : ''}`}>
            <video ref={videoRef} autoPlay playsInline muted />
            <span className="selfview-pill">
              {presence === 'present' ? (
                <>
                  <ShieldCheck size={12} /> In view
                </>
              ) : presence === 'absent' ? (
                <>
                  <UserX size={12} /> Not visible
                </>
              ) : presence === 'multiple' ? (
                <>
                  <Users size={12} /> Multiple people
                </>
              ) : (
                'Checking…'
              )}
            </span>
          </div>
        )}
      </main>

      {started && (
        <footer className="dock">
          {typing && live && (
            <form
              className="dock-type"
              onSubmit={(e) => {
                e.preventDefault();
                m.submitText(draft);
                setDraft('');
              }}
            >
              <label htmlFor="reply" className="sr-only">
                Type your answer
              </label>
              <input
                id="reply"
                autoFocus
                autoComplete="off"
                placeholder={m.code && !m.code.solved ? 'e.g. Line 3: change <= to <' : 'Type your answer…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button className="icon-btn icon-btn--brand" aria-label="Send" disabled={!draft.trim()}>
                <Send size={16} />
              </button>
            </form>
          )}
          <div className="dock-controls">
            <button className={`dock-btn ${typing ? 'is-on' : ''}`} onClick={() => setTyping((t) => !t)} aria-pressed={typing} aria-label="Type instead" title="Type instead">
              <Keyboard />
            </button>
            <button className={`dock-btn ${showTranscript ? 'is-on' : ''}`} onClick={() => setShowTranscript((s) => !s)} aria-pressed={showTranscript} aria-label="Transcript" title="Transcript">
              {showTranscript ? <Captions /> : <CaptionsOff />}
            </button>
            <button
              className={`dock-mic ${m.micOn ? '' : 'is-muted'}`}
              onClick={m.toggleMic}
              disabled={!stream?.getAudioTracks().length}
              aria-pressed={!m.micOn}
              aria-label={m.micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {m.micOn ? <Mic /> : <MicOff />}
            </button>
            <button className={`dock-btn ${voiceOn ? 'is-on' : ''}`} onClick={() => setVoiceOn((v) => !v)} aria-pressed={!voiceOn} aria-label={voiceOn ? 'Mute interviewer' : 'Unmute interviewer'} title="Interviewer audio">
              {voiceOn ? <Volume2 /> : <VolumeX />}
            </button>
            <button
              className="dock-btn dock-btn--end"
              aria-label="End interview"
              title="End interview"
              onClick={() => {
                if (confirm('End the interview now? You won’t be able to resume it.')) m.end();
              }}
            >
              <PhoneOff />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
