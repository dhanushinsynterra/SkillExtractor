import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Captions, CaptionsOff, Keyboard, Lightbulb, Mic, MicOff, PhoneOff, Send, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { Logo } from '../components/Chrome';
import { Voice } from '../components/Voice';
import { useCandidate } from '../lib/candidate';
import { acquireMedia, currentMedia, useMicLevel } from '../lib/media';
import { navigate } from '../lib/router';
import { PHASES } from '../lib/script';
import { canRecognise } from '../lib/speech';
import { useInterview, type CodeState, type InterviewStatus } from '../lib/useInterview';

const STATUS_TEXT: Record<InterviewStatus, string> = {
  idle: 'Ready when you are',
  speaking: 'Aria is speaking',
  listening: 'Your turn',
  thinking: 'Aria is thinking',
  ended: 'Interview complete',
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

function CodeCardView({ code, onHint }: { code: CodeState; onHint: () => void }) {
  return (
    <section className={`codecard ${code.solved ? 'codecard--solved' : ''}`} aria-label="Code card">
      <header className="codecard-head">
        <span className="codecard-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="codecard-file">{code.card.title}</span>
        <span className="codecard-lang">{code.card.language}</span>
      </header>
      <ol className="codecard-lines">
        {code.lines.map((l, i) => (
          <li key={i} className={code.changed === i + 1 ? (code.solved ? 'is-fixed' : 'is-changed') : ''}>
            <span className="ln">{i + 1}</span>
            <code>{l || ' '}</code>
          </li>
        ))}
      </ol>
      <footer className="codecard-foot">
        {code.solved ? (
          <span className="status status--ok">Fixed</span>
        ) : code.feedback ? (
          <span className="codecard-feedback">{code.feedback}</span>
        ) : (
          <span className="muted small">Say or type: “line 3, change X to Y”</span>
        )}
        {!code.solved && (
          <button className="btn btn--ghost btn--sm" onClick={onHint}>
            <Lightbulb size={15} /> Hint
          </button>
        )}
      </footer>
    </section>
  );
}

export default function Session() {
  const candidate = useCandidate();
  const [voice, setVoice] = useState(true);
  const [started, setStarted] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [typing, setTyping] = useState(!canRecognise);
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(currentMedia());
  const m = useInterview(candidate, { voice });
  const clock = useClock(started && m.status !== 'ended');
  const orbRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const logRef = useRef<HTMLOListElement>(null);
  useMicLevel(m.status === 'listening' && m.micOn ? stream : null, orbRef);

  useEffect(() => {
    if (!candidate.name) navigate('/', 'back');
  }, [candidate.name]);

  useEffect(() => {
    if (videoRef.current && stream?.getVideoTracks().length) videoRef.current.srcObject = stream;
  }, [stream, started]);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [m.turns.length, m.interim]);

  useEffect(() => {
    if (m.status !== 'ended' || !started) return;
    const t = setTimeout(() => navigate('/done'), 2600);
    return () => clearTimeout(t);
  }, [m.status, started]);

  async function begin() {
    if (!stream) {
      try {
        setStream(await acquireMedia(!candidate.audioOnly));
      } catch {
        setTyping(true);
      }
    }
    setStarted(true);
    m.start();
  }

  const lastAi = [...m.turns].reverse().find((t) => t.who === 'ai');
  const phaseIdx = PHASES.findIndex((p) => p.id === m.phase);
  const hasVideo = Boolean(stream?.getVideoTracks().length);

  return (
    <div className={`session ${m.code ? 'session--code' : ''} ${showCaptions && started ? 'session--captions' : ''}`}>
      <header className="session-bar">
        <div className="session-brand">
          <Logo size={26} />
          <span className="hide-sm">Interview</span>
        </div>
        <ol className="phase-track" aria-label="Conversation progress">
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
          <Voice ref={orbRef} state={started ? m.status : 'idle'} size={m.code ? 'md' : 'lg'} />
          <p className={`stage-status stage-status--${m.status}`}>
            {m.status === 'listening' && m.micOn && canRecognise && <span className="pulse-dot" />}
            {started ? STATUS_TEXT[m.status] : STATUS_TEXT.idle}
            {m.status === 'listening' && !m.micOn && ' · mic is muted, type below'}
          </p>
          {!started ? (
            <div className="stage-intro">
              <h1 data-route-focus tabIndex={-1}>
                Hi {candidate.name.split(' ')[0] || 'there'}, I’m Aria.
              </h1>
              <p className="muted">When you’re ready, start the interview and I’ll introduce myself. Speak naturally, there’s no rush.</p>
              <button className="btn btn--primary btn--lg" onClick={begin}>
                Start interview <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <>
              <p key={lastAi?.id} className="stage-line">
                {lastAi?.text}
              </p>
              {m.interim && <p className="stage-interim">“{m.interim}”</p>}
            </>
          )}
        </section>

        {m.code && (
          <div className="code-wrap">
            <CodeCardView
              code={hint && !m.code.solved ? { ...m.code, feedback: `Hint: ${m.code.card.hint}` } : m.code}
              onHint={() => setHint(true)}
            />
          </div>
        )}

        {showCaptions && started && (
          <aside className="captions" aria-label="Live captions">
            <h2 className="captions-title">Transcript</h2>
            <ol ref={logRef} className="captions-log">
              {m.turns.map((t) => (
                <li key={t.id} className={`bubble bubble--${t.who}`}>
                  <span className="bubble-who">{t.who === 'ai' ? 'Aria' : 'You'}</span>
                  {t.text}
                  {t.note && t.note !== 'reassured' && <span className="bubble-note">{t.note}</span>}
                </li>
              ))}
              {m.interim && (
                <li className="bubble bubble--you bubble--interim">
                  <span className="bubble-who">You</span>
                  {m.interim}
                </li>
              )}
            </ol>
          </aside>
        )}

        {hasVideo && started && (
          <div className="selfview">
            <video ref={videoRef} autoPlay playsInline muted />
            <span className="selfview-pill">
              <ShieldCheck size={13} /> All good
            </span>
          </div>
        )}
      </main>

      {started && (
        <footer className="dock">
          {typing && m.status !== 'ended' && (
            <form
              className="dock-type"
              onSubmit={(e) => {
                e.preventDefault();
                m.submit(draft);
                setDraft('');
              }}
            >
              <label htmlFor="reply" className="sr-only">
                Type your reply
              </label>
              <input
                id="reply"
                autoFocus
                autoComplete="off"
                placeholder={m.code && !m.code.solved ? 'e.g. line 3, change <= to <' : 'Type your answer…'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={m.status !== 'listening'}
              />
              <button className="icon-btn icon-btn--brand" aria-label="Send" disabled={!draft.trim() || m.status !== 'listening'}>
                <Send size={18} />
              </button>
            </form>
          )}
          <div className="dock-controls">
            <button className={`dock-btn ${typing ? 'is-on' : ''}`} onClick={() => setTyping((t) => !t)} aria-pressed={typing} aria-label="Type instead">
              <Keyboard size={20} />
            </button>
            <button className={`dock-btn ${showCaptions ? 'is-on' : ''}`} onClick={() => setShowCaptions((s) => !s)} aria-pressed={showCaptions} aria-label="Captions">
              {showCaptions ? <Captions size={20} /> : <CaptionsOff size={20} />}
            </button>
            <button
              className={`dock-mic ${m.micOn ? '' : 'is-muted'} ${m.status === 'listening' && m.micOn ? 'is-live' : ''}`}
              onClick={m.toggleMic}
              aria-pressed={!m.micOn}
              aria-label={m.micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {m.micOn ? <Mic size={26} /> : <MicOff size={26} />}
            </button>
            <button className={`dock-btn ${voice ? 'is-on' : ''}`} onClick={() => setVoice((v) => !v)} aria-pressed={voice} aria-label="Aria’s voice">
              {voice ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              className="dock-btn dock-btn--end"
              aria-label="End interview"
              onClick={() => {
                m.end();
                navigate('/done');
              }}
            >
              <PhoneOff size={20} />
            </button>
          </div>
          {!canRecognise && <p className="dock-note">Voice replies need Chrome or Edge. Typing works everywhere.</p>}
        </footer>
      )}
    </div>
  );
}
