import { useEffect } from 'react';
import { BookOpen, Check, CheckCircle2, Clock, Mail, Star } from 'lucide-react';
import { TopBar } from '../components/Chrome';
import { firstName, useCandidate, type TrackId } from '../lib/candidate';
import { releaseMedia } from '../lib/media';
import { AI_NAME } from '../lib/script';

const FEEDBACK: Record<TrackId, { strong: string[]; practise: { title: string; why: string }[] }> = {
  frontend: {
    strong: ['Explained your project clearly and in your own words', 'Considered users on slow connections'],
    practise: [
      { title: 'Idempotent form submissions', why: 'Prevents duplicate records even when a request is retried.' },
      { title: 'Loop boundaries', why: 'Off-by-one errors are among the most common production bugs.' },
    ],
  },
  backend: {
    strong: ['Walked through the request lifecycle step by step', 'Reasoned about concurrent access'],
    practise: [
      { title: 'Transactions and locking strategies', why: 'Central to booking, inventory and payment systems.' },
      { title: 'HTTP status codes for failures', why: 'A clear 409 is easier to handle than an error inside a 200.' },
    ],
  },
  data: {
    strong: ['Started from the business question, not the tool', 'Addressed data quality before modelling'],
    practise: [
      { title: 'Time-series validation', why: 'Avoid leakage by never shuffling time-ordered data.' },
      { title: 'Communicating results', why: 'Stakeholders need a clear recommendation, not just metrics.' },
    ],
  },
  mobile: {
    strong: ['Designed for unreliable networks', 'Focused on what the user actually sees'],
    practise: [
      { title: 'Offline-first state management', why: 'Cache locally, sync later, resolve conflicts.' },
      { title: 'Boolean logic in conditions', why: 'A single negation can invert a feature’s behaviour.' },
    ],
  },
  qa: {
    strong: ['Thought about realistic failure modes', 'Structured approach to reproducing defects'],
    practise: [
      { title: 'API-level testing', why: 'Many payment issues live between client and server.' },
      { title: 'Deriving assertions from requirements', why: 'Compute the expected value before writing the test.' },
    ],
  },
};

export default function Done() {
  const c = useCandidate();
  const fb = FEEDBACK[c.track];
  useEffect(() => releaseMedia, []);

  return (
    <div className="flow done">
      <TopBar />
      <main className="flow-main done-main">
        <section className="done-hero">
          <div className="done-mark" aria-hidden="true">
            <Check size={22} strokeWidth={2.5} />
          </div>
          <p className="eyebrow">Interview complete</p>
          <h1 data-route-focus tabIndex={-1}>
            Thank you, {firstName(c.name)}.
          </h1>
          <p className="lede">Your interview has been submitted. Here’s a short summary to keep, whatever the outcome.</p>
        </section>

        <section className="feedback-card" aria-label="Your feedback">
          <header>
            <h2>Your feedback</h2>
            <span className="muted small">From {AI_NAME}</span>
          </header>
          <div className="feedback-cols">
            <div>
              <h3>
                <Star size={16} /> Strengths
              </h3>
              <ul className="ticks">
                {fb.strong.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>
                <BookOpen size={16} /> Worth practising
              </h3>
              <ul className="practise">
                {fb.practise.map((p) => (
                  <li key={p.title}>
                    <strong>{p.title}</strong>
                    <span>{p.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="next" aria-label="What happens next">
          <h2>What happens next</h2>
          <ol className="timeline">
            <li className="done">
              <span className="tl-dot">
                <CheckCircle2 size={16} />
              </span>
              <div>
                <strong>Interview submitted</strong>
                <p>Your transcript and assessment are with the hiring team.</p>
              </div>
            </li>
            <li>
              <span className="tl-dot">
                <Clock size={16} />
              </span>
              <div>
                <strong>Human review</strong>
                <p>A member of the hiring team reviews your report. The AI never makes the final decision.</p>
              </div>
            </li>
            <li>
              <span className="tl-dot">
                <Mail size={16} />
              </span>
              <div>
                <strong>You hear back</strong>
                <p>Typically within three working days{c.email ? `, at ${c.email}` : ''}.</p>
              </div>
            </li>
          </ol>
        </section>
        <p className="muted small center">You can close this window.</p>
      </main>
    </div>
  );
}
