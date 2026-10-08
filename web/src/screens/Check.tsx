import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, CameraOff, Check as CheckIcon, Loader2, Mic, ScanFace, Volume2, Wifi } from 'lucide-react';
import { AI_NAME } from '../../../shared/types';
import { Steps, TopBar } from '../components/Chrome';
import { chime } from '../lib/audio';
import { setCandidate, useCandidate } from '../lib/candidate';
import { acquireMedia, checkNetwork, type NetworkResult, useMicLevel } from '../lib/media';
import { Proctor, type Presence } from '../lib/proctor';
import { calibrate } from '../lib/voicegate';
import { navigate } from '../lib/router';

type Perm = 'idle' | 'asking' | 'ready' | 'denied';

function Status({ state, children }: { state: 'ok' | 'wait' | 'warn' | 'idle'; children: React.ReactNode }) {
  return (
    <span className={`status status--${state}`}>
      {state === 'ok' && <CheckIcon size={12} />}
      {state === 'wait' && <Loader2 size={12} className="spin" />}
      {state === 'warn' && <AlertTriangle size={12} />}
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
  const [calibrated, setCalibrated] = useState(false);
  const samples = useRef<number[]>([]);
  const [net, setNet] = useState<NetworkResult | null>(null);
  const [speaker, setSpeaker] = useState<'idle' | 'playing' | 'done'>('idle');
  const [presence, setPresence] = useState<Presence>('unknown');
  const [faceErr, setFaceErr] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const { level } = useMicLevel(stream, meterRef);

  useEffect(() => {
    if (!c.session) navigate('/', 'back');
  }, [c.session]);

  useEffect(() => {
    checkNetwork().then(setNet);
  }, []);

  useEffect(() => {
    if (level > 0.15) setHeard(true);
    // Learn the candidate's speaking level so background voices can be filtered.
    if (!stream || calibrated) return;
    samples.current.push(level / 6);
    if (samples.current.length > 300) samples.current.shift();
    if (samples.current.filter((l) => l > 0.02).length >= 20) {
      const t = calibrate(samples.current);
      if (t) {
        setCandidate({ voiceThreshold: t });
        setCalibrated(true);
      }
    }
  }, [level, stream, calibrated]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream || !hasCam) return;
    v.srcObject = stream;
    const p = new Proctor(v, setPresence);
    p.start().catch(() => setFaceErr(true));
    return () => p.stop();
  }, [stream, hasCam]);

  async function allow(audioOnly = c.audioOnly) {
    setPerm('asking');
    try {
      const s = await acquireMedia(!audioOnly);
      setStream(s);
      setHasCam(s.getVideoTracks().length > 0);
      setPerm('ready');
    } catch {
      setPerm('denied');
    }
  }

  async function testSpeaker() {
    setSpeaker('playing');
    await chime();
    setSpeaker('done');
  }

  const bars = 28;
  const lit = Math.round(level * bars * 1.4);
  const faceOk = !hasCam || presence === 'present';
  const canStart = perm === 'ready' && faceOk;

  return (
    <div className="flow">
      <TopBar>
        <Steps at={1} />
      </TopBar>

      <main className="flow-main">
        <div className="check-head">
          <button type="button" className="back-link" onClick={() => navigate('/', 'back')}>
            <ArrowLeft size={14} /> Back
          </button>
          <h1 data-route-focus tabIndex={-1}>
            Check your setup
          </h1>
          <p className="muted">Takes about 30 seconds. Nothing here is recorded.</p>
        </div>

        <div className="check-grid">
          <section className="panel cam-panel" aria-label="Camera preview">
            <div className="cam">
              {hasCam ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted />
                  <div className={`cam-guide ${presence === 'present' ? 'is-ok' : ''}`} aria-hidden="true" />
                  <span className="cam-tag">
                    <span className="pulse-dot" /> Camera on
                  </span>
                </>
              ) : (
                <div className="cam-empty">
                  {c.audioOnly ? <CameraOff /> : <Camera />}
                  <p>{perm === 'denied' ? 'Camera and microphone access was blocked.' : c.audioOnly ? 'Audio-only mode' : 'Camera preview appears here'}</p>
                  {perm === 'denied' && <p className="small">Allow access from the camera icon in your browser’s address bar, then try again.</p>}
                </div>
              )}
            </div>
            {perm !== 'ready' ? (
              <div className="cam-actions">
                <button className="btn btn--primary" onClick={() => allow()} disabled={perm === 'asking'}>
                  {perm === 'asking' ? <Loader2 size={16} className="spin" /> : <Mic size={16} />}
                  {perm === 'denied' ? 'Try again' : c.audioOnly ? 'Allow microphone' : 'Allow camera and microphone'}
                </button>
                <label className="switch">
                  <input type="checkbox" checked={c.audioOnly} onChange={(e) => setCandidate({ audioOnly: e.target.checked })} />
                  <span className="switch-track" aria-hidden="true" />
                  Audio only
                </label>
              </div>
            ) : (
              <p className="cam-tip">{hasCam ? 'Face the camera in good light, with your face inside the outline.' : `Audio-only mode. ${AI_NAME} will only listen.`}</p>
            )}
          </section>

          <section className="checks" aria-label="Device checks">
            <div className="check-row">
              <span className="check-icon">
                <Mic />
              </span>
              <div className="check-body">
                <div className="check-title">
                  Microphone
                  {perm !== 'ready' ? <Status state="idle">Waiting</Status> : calibrated ? <Status state="ok">Voice calibrated</Status> : heard ? <Status state="wait">Keep talking</Status> : <Status state="wait">Say something</Status>}
                </div>
                <p className="check-prompt">
                  Say a sentence or two in your normal voice, e.g. <strong>“Hi {AI_NAME}, I’m ready to begin.”</strong> This teaches the filter what you sound like so background voices are ignored.
                </p>
                <div className="meter" ref={meterRef} role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
                  {Array.from({ length: bars }, (_, i) => (
                    <i key={i} className={i < lit ? 'on' : ''} />
                  ))}
                </div>
              </div>
            </div>

            {!c.audioOnly && (
              <div className="check-row">
                <span className="check-icon">
                  <ScanFace />
                </span>
                <div className="check-body">
                  <div className="check-title">
                    Face detection
                    {perm !== 'ready' || !hasCam ? (
                      <Status state="idle">Waiting</Status>
                    ) : faceErr ? (
                      <Status state="warn">Unavailable</Status>
                    ) : presence === 'present' ? (
                      <Status state="ok">Detected</Status>
                    ) : presence === 'multiple' ? (
                      <Status state="warn">Multiple people</Status>
                    ) : presence === 'absent' ? (
                      <Status state="warn">Not visible</Status>
                    ) : (
                      <Status state="wait">Loading</Status>
                    )}
                  </div>
                  <p className="small muted">
                    {faceErr
                      ? 'The face detector could not load, so presence checks are off. You can still continue.'
                      : `Stay in view during the interview. If you leave, ${AI_NAME} will pause and check in with you.`}
                  </p>
                </div>
              </div>
            )}

            <div className="check-row">
              <span className="check-icon">
                <Volume2 />
              </span>
              <div className="check-body">
                <div className="check-title">
                  Speakers
                  {speaker === 'done' ? <Status state="ok">Played</Status> : <Status state="idle">Optional</Status>}
                </div>
                <button className="btn btn--ghost btn--sm" onClick={testSpeaker} disabled={speaker === 'playing'}>
                  {speaker === 'playing' ? <Loader2 size={14} className="spin" /> : <Volume2 size={14} />} Play test sound
                </button>
                <label className="switch">
                  <input type="checkbox" checked={c.headphones} onChange={(e) => setCandidate({ headphones: e.target.checked })} />
                  <span className="switch-track" aria-hidden="true" />
                  I’m wearing headphones
                </label>
                <p className="small muted">
                  {c.headphones
                    ? `You can interrupt ${AI_NAME} at any time.`
                    : `On speakers, ${AI_NAME}’s own voice is filtered out of your mic. You can still interrupt by speaking up.`}
                </p>
              </div>
            </div>

            <div className="check-row">
              <span className="check-icon">
                <Wifi />
              </span>
              <div className="check-body">
                <div className="check-title">
                  Network
                  {!net ? <Status state="wait">Checking</Status> : net.quality === 'weak' ? <Status state="warn">Weak</Status> : <Status state="ok">{net.quality === 'good' ? 'Good' : 'Fair'}</Status>}
                </div>
                <p className="small muted">
                  {!net ? 'Measuring…' : net.quality === 'weak' ? 'Your connection is slow. Audio-only mode will help.' : `${net.latencyMs} ms to the server.`}
                </p>
              </div>
            </div>

            <div className="check-go">
              <button className="btn btn--primary btn--lg btn--block" disabled={!canStart && !(perm === 'ready' && faceErr)} onClick={() => navigate('/session')}>
                Start the interview <ArrowRight size={16} />
              </button>
              {perm === 'ready' && hasCam && !faceOk && !faceErr && <p className="small muted center">Position yourself so your face is clearly visible to continue.</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
