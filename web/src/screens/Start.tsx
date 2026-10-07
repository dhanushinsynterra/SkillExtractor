import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Clock, Headphones, Loader2, MessageSquare, ShieldCheck } from 'lucide-react';
import { Steps, TopBar } from '../components/Chrome';
import { AI_NAME, TRACKS } from '../../../shared/types';
import { api } from '../lib/api';
import { setCandidate, useCandidate } from '../lib/candidate';
import { navigate } from '../lib/router';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Start() {
  const c = useCandidate();
  const [touched, setTouched] = useState(false);
  const [consent, setConsent] = useState(false);
  const nameOk = c.name.trim().length >= 2;
  const emailOk = EMAIL_RE.test(c.email.trim());
  const canGo = nameOk && emailOk && consent;
  const [ready, setReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .status()
      .then((s) => setReady(s.ready))
      .catch((e) => {
        setReady(false);
        setErr(e.message);
      });
  }, []);

  async function submit() {
    setTouched(true);
    if (!canGo || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const session = await api.createSession({ name: c.name.trim(), email: c.email.trim(), track: c.track });
      setCandidate({ session });
      navigate('/check');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flow">
      <TopBar>
        <Steps at={0} />
      </TopBar>

      <main className="flow-main flow-main--split">
        <section className="welcome">
          <p className="eyebrow">Voice interview</p>
          <h1 data-route-focus tabIndex={-1}>
            A conversation about your work, not an exam.
          </h1>
          <p className="lede">
            {AI_NAME} is an AI interviewer. You’ll talk through your experience, reason through a problem together and review a
            short piece of code. Speak naturally, the way you would with a colleague.
          </p>
          <ul className="welcome-facts">
            <li>
              <span className="fact-icon">
                <Clock size={18} />
              </span>
              <div>
                <strong>About 20 minutes</strong>
                <span>Six short stages, at your own pace</span>
              </div>
            </li>
            <li>
              <span className="fact-icon">
                <MessageSquare size={18} />
              </span>
              <div>
                <strong>Talk or type</strong>
                <span>Live transcript, with typing as a fallback</span>
              </div>
            </li>
            <li>
              <span className="fact-icon">
                <Headphones size={18} />
              </span>
              <div>
                <strong>Quiet space, headset if possible</strong>
                <span>Helps {AI_NAME} hear only you</span>
              </div>
            </li>
            <li>
              <span className="fact-icon">
                <ShieldCheck size={18} />
              </span>
              <div>
                <strong>Reviewed by people</strong>
                <span>The AI never makes the final decision</span>
              </div>
            </li>
          </ul>
        </section>

        <form
          className="panel form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <div>
            <h2>Your details</h2>
            <p className="muted small">Used to personalise the interview and share results with the hiring team.</p>
          </div>

          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              autoComplete="name"
              placeholder="Jane Doe"
              value={c.name}
              onChange={(e) => setCandidate({ name: e.target.value })}
              aria-invalid={touched && !nameOk}
              aria-describedby={touched && !nameOk ? 'name-err' : undefined}
            />
            {touched && !nameOk && (
              <span className="field-err" id="name-err">
                Enter your name.
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="jane@example.com"
              value={c.email}
              onChange={(e) => setCandidate({ email: e.target.value })}
              aria-invalid={touched && !emailOk}
              aria-describedby={touched && !emailOk ? 'email-err' : undefined}
            />
            {touched && !emailOk && (
              <span className="field-err" id="email-err">
                Enter a valid email address.
              </span>
            )}
          </div>

          <fieldset className="field">
            <legend>Area of expertise</legend>
            <div className="track-grid">
              {TRACKS.map((t) => (
                <label key={t.id} className={`track ${c.track === t.id ? 'is-on' : ''}`}>
                  <input type="radio" name="track" value={t.id} checked={c.track === t.id} onChange={() => setCandidate({ track: t.id })} />
                  <span className="track-title">{t.label}</span>
                  <span className="track-blurb">{t.blurb}</span>
                  <span className="track-check" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={`consent ${touched && !consent ? 'consent--err' : ''}`}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I consent to my microphone and camera being used during this interview, and to a summary being shared with the hiring
              team.
            </span>
          </label>

          {ready === false && (
            <div className="notice notice--warn" role="alert">
              <AlertTriangle size={16} />
              <span>{err ?? 'Interviews are not available yet. The hiring team needs to finish setup.'}</span>
            </div>
          )}
          {ready && err && (
            <div className="notice notice--warn" role="alert">
              <AlertTriangle size={16} />
              <span>{err}</span>
            </div>
          )}
          <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={!ready || busy} aria-disabled={!canGo}>
            {busy ? <Loader2 size={18} className="spin" /> : null}
            Continue to device check {!busy && <ArrowRight size={18} />}
          </button>
        </form>
      </main>
    </div>
  );
}
