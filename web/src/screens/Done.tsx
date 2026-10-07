import { useEffect, useState } from 'react';
import { BookOpen, Check, CheckCircle2, Clock, Loader2, Mail, Star } from 'lucide-react';
import { AI_NAME } from '../../../shared/types';
import { TopBar } from '../components/Chrome';
import { api } from '../lib/api';
import { firstName, useCandidate } from '../lib/candidate';
import { releaseMedia } from '../lib/media';

type Feedback = Awaited<ReturnType<typeof api.feedback>>;

export default function Done() {
  const c = useCandidate();
  const [fb, setFb] = useState<Feedback | null>(null);
  useEffect(() => releaseMedia, []);

  // The report is written after the interview ends; poll until it's ready.
  useEffect(() => {
    if (!c.session) return;
    let stop = false;
    let t: number | undefined;
    const poll = async (n: number) => {
      try {
        const r = await api.feedback(c.session!.id, c.session!.token);
        if (stop) return;
        setFb(r);
        if ((r.status === 'pending' || r.status === 'none') && n < 40) t = window.setTimeout(() => poll(n + 1), 3000);
      } catch {
        if (!stop && n < 40) t = window.setTimeout(() => poll(n + 1), 3000);
      }
    };
    void poll(0);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [c.session]);

  const waiting = !fb || fb.status === 'pending' || fb.status === 'none';

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
          <p className="lede">Your interview has been submitted to the hiring team.</p>
        </section>

        {fb?.status !== 'failed' && (
          <section className="feedback-card" aria-label="Your feedback" aria-busy={waiting}>
            <header>
              <h2>Your feedback</h2>
              <span className="muted small">From {AI_NAME}</span>
            </header>
            {waiting ? (
              <div className="feedback-wait">
                <Loader2 size={16} className="spin" /> Preparing your summary. This usually takes under a minute.
              </div>
            ) : (
              <div className="feedback-cols">
                <div>
                  <h3>
                    <Star size={13} /> Strengths
                  </h3>
                  <ul className="ticks">
                    {fb!.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>
                    <BookOpen size={13} /> Worth practising
                  </h3>
                  <ul className="practise">
                    {fb!.practise.map((p) => (
                      <li key={p.title}>
                        <strong>{p.title}</strong>
                        <span>{p.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="next" aria-label="What happens next">
          <h2>What happens next</h2>
          <ol className="timeline">
            <li className="done">
              <span className="tl-dot">
                <CheckCircle2 />
              </span>
              <div>
                <strong>Interview submitted</strong>
                <p>Your transcript and assessment are with the hiring team.</p>
              </div>
            </li>
            <li>
              <span className="tl-dot">
                <Clock />
              </span>
              <div>
                <strong>Human review</strong>
                <p>A member of the hiring team reviews your interview. The AI never makes the final decision.</p>
              </div>
            </li>
            <li>
              <span className="tl-dot">
                <Mail />
              </span>
              <div>
                <strong>You hear back</strong>
                <p>The hiring team will contact you{c.email ? ` at ${c.email}` : ''}.</p>
              </div>
            </li>
          </ol>
        </section>
        <p className="muted small">You can close this window.</p>
      </main>
    </div>
  );
}
