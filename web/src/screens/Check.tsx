import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, CameraOff, Check as CheckIcon, Loader2, Mic, Volume2, Wifi, AlertTriangle } from 'lucide-react';
import { Steps, TopBar } from '../components/Chrome';
import { acquireMedia, checkNetwork, type NetworkResult, useMicLevel } from '../lib/media';
import { navigate } from '../lib/router';
import { firstName, setCandidate, useCandidate } from '../lib/candidate';
import { speak } from '../lib/speech';

type Perm = 'idle' | 'asking' | 'ready' | 'denied';

function Status({ state, children }: { state: 'ok' | 'wait' | 'warn' | 'idle'; children: React.ReactNode }) {
  return (
    <span className={`status status--${state}`}>
      {state === 'ok' && <CheckIcon size={14} />}
      {state === 'wait' && <Loader2 size={14} className="spin" />}
      {state === 'warn' && <AlertTriangle size={14} />}
      {children}
    </span>
  );
}

export default function Check() {
  const c = useCandidate();
  const [perm, setPerm] = useState<Perm>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCam, setHasCam] = useState(false);
  const [heard, setHeard] = useState(false);
  const [net, setNet] = useState<NetworkResult | null>(null);
  const [speaker, setSpeaker] = useState<'idle' | 'playing' | 'done'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const { level } = useMicLevel(stream, meterRef);

  useEffect(() => {
    checkNetwork().then(setNet);
  }, []);

  useEffect(() => {
    if (level > 0.18) setHeard(true);
  }, [level]);

  useEffect(() => {
    if (videoRef.current && stream && hasCam) videoRef.current.srcObject = stream;
  }, [stream, hasCam]);

  async function allow(audioOnly = c.audioOnly) {
    setPerm('asking');
    try {
      const s = await acquireMedia(!audioOnly);
      setStream(s);
      setHasCam(s.getVideoTracks().length > 0);
      setPerm('ready');
    } catch {
      if (!audioOnly) {
        // Camera may be missing or blocked; fall back to microphone only.
        try {
          const s = await acquireMedia(false);
          setStream(s);
          setHasCam(false);
          setCandidate({ audioOnly: true });
          setPerm('ready');
          return;
        } catch {
          /* fall through */
        }
      }
      setPerm('denied');
    }
  }

  async function testSpeaker() {
    setSpeaker('playing');
    await speak(`Hi ${firstName(c.name)}, can you hear me clearly?`);
    setSpeaker('done');
  }

  const bars = 24;
  const lit = Math.round(level * bars * 1.4);

  return (
    <div className="flow">
      <TopBar>
        <Steps at={1} />
      </TopBar>

      <main className="flow-main">
        <div className="check-head">
          <button type="button" className="back-link" onClick={() => navigate('/', 'back')}>
            <ArrowLeft size={16} /> Back
          </button>
          <h1 data-route-focus tabIndex={-1}>
            Let’s check your setup
          </h1>
          <p className="muted">This takes about 30 seconds. Nothing here is recorded.</p>
        </div>

        <div className="check-grid">
          <section className="panel cam-panel" aria-label="Camera preview">
            <div className={`cam ${hasCam ? 'cam--on' : ''}`}>
              {hasCam ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted />
                  <div className="cam-guide" aria-hidden="true" />
                  <span className="cam-tag">
                    <span className="pulse-dot" /> Camera on
                  </span>
                </>
              ) : (
                <div className="cam-empty">
                  {c.audioOnly ? <CameraOff size={36} /> : <Camera size={36} />}
                  <p>{perm === 'denied' ? 'We couldn’t access your devices.' : c.audioOnly ? 'Audio-only mode' : 'Your camera preview appears here'}</p>
                  {perm === 'denied' && (
                    <p className="small">Click the camera icon in your browser’s address bar, allow access, then try again.</p>
                  )}
                </div>
              )}
            </div>
            {perm !== 'ready' ? (
              <div className="cam-actions">
                <button className="btn btn--primary" onClick={() => allow()} disabled={perm === 'asking'}>
                  {perm === 'asking' ? <Loader2 size={18} className="spin" /> : <Mic size={18} />}
                  {perm === 'denied' ? 'Try again' : c.audioOnly ? 'Allow microphone' : 'Allow microphone & camera'}
                </button>
                <label className="switch">
                  <input type="checkbox" checked={c.audioOnly} onChange={(e) => setCandidate({ audioOnly: e.target.checked })} />
                  <span className="switch-track" aria-hidden="true" />
                  Audio only (low bandwidth)
                </label>
              </div>
            ) : (
              <p className="cam-tip">{hasCam ? 'Sit facing a light, with your face inside the oval.' : 'Audio-only is fine. Aria will just listen.'}</p>
            )}
          </section>

          <section className="checks" aria-label="Device checks">
            <div className="check-row">
              <span className="check-icon">
                <Mic size={20} />
              </span>
              <div className="check-body">
                <div className="check-title">
                  Microphone
                  {perm !== 'ready' ? (
                    <Status state="idle">Waiting</Status>
                  ) : heard ? (
                    <Status state="ok">Sounds great</Status>
                  ) : (
                    <Status state="wait">Say something</Status>
                  )}
                </div>
                <p className="check-prompt">
                  Try saying: <strong>“Hi Aria, I’m ready to begin.”</strong>
                </p>
                <div className="meter" ref={meterRef} role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
                  {Array.from({ length: bars }, (_, i) => (
                    <i key={i} className={i < lit ? 'on' : ''} style={{ '--i': i } as React.CSSProperties} />
                  ))}
                </div>
              </div>
            </div>

            <div className="check-row">
              <span className="check-icon">
                <Volume2 size={20} />
              </span>
              <div className="check-body">
                <div className="check-title">
                  Speaker
                  {speaker === 'done' ? <Status state="ok">Played</Status> : <Status state="idle">Optional</Status>}
                </div>
                <button className="btn btn--soft btn--sm" onClick={testSpeaker} disabled={speaker === 'playing'}>
                  {speaker === 'playing' ? <Loader2 size={16} className="spin" /> : <Volume2 size={16} />} Play Aria’s voice
                </button>
              </div>
            </div>

            <div className="check-row">
              <span className="check-icon">
                <Wifi size={20} />
              </span>
              <div className="check-body">
                <div className="check-title">
                  Network
                  {!net ? (
                    <Status state="wait">Checking</Status>
                  ) : net.quality === 'weak' ? (
                    <Status state="warn">Weak</Status>
                  ) : (
                    <Status state="ok">{net.quality === 'good' ? 'Good' : 'Okay'}</Status>
                  )}
                </div>
                <p className="small muted">
                  {!net
                    ? 'Measuring…'
                    : net.quality === 'weak'
                      ? 'Your connection is slow. Audio-only mode will keep things smooth.'
                      : `${net.latencyMs} ms${net.type ? ` · ${net.type.toUpperCase()}` : ''}. If it drops, we’ll reconnect and continue.`}
                </p>
              </div>
            </div>

            <div className="check-go">
              <button className="btn btn--primary btn--lg btn--block" disabled={perm !== 'ready'} onClick={() => navigate('/session')}>
                Start the interview <ArrowRight size={18} />
              </button>
              {perm === 'ready' && !heard && <p className="small muted center">We haven’t heard you yet, but you can still continue.</p>}
              {perm === 'denied' && (
                <button className="btn btn--ghost btn--block" onClick={() => navigate('/session')}>
                  Continue without a microphone (type answers)
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
