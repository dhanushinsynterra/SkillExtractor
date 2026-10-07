import { useRef, useState } from 'react';
import { ArrowLeft, BadgeCheck, Briefcase, Clock, Code2, Download, Eye, Mail, MessageSquareQuote, Smartphone, UserRound, Wifi, Mic } from 'lucide-react';
import { TopBar } from '../components/Chrome';
import { Avatar, DepthPips, Ring, VerdictBadge } from '../components/bits';
import { CANDIDATES, OPENINGS, DEPTH_LABEL, TRACK_LABEL, type Candidate, type SkillScore } from '../data/demo';
import { navigate } from '../lib/router';

type Tab = 'manager' | 'hr' | 'tech';
const TABS: { id: Tab; label: string; icon: typeof Briefcase; who: string }[] = [
  { id: 'manager', label: 'Manager', icon: Briefcase, who: 'Verdict and fit' },
  { id: 'hr', label: 'HR', icon: UserRound, who: 'People and integrity' },
  { id: 'tech', label: 'Tech', icon: Code2, who: 'Skill depth and evidence' },
];

function Radar({ skills }: { skills: SkillScore[] }) {
  const s = skills.slice(0, 8);
  const n = s.length;
  const size = 300;
  const c = size / 2;
  const R = 100;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  const poly = s.map((sk, i) => pt(i, (R * sk.depth) / 4).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label="Skill depth radar">
      {[1, 2, 3, 4].map((lvl) => (
        <polygon key={lvl} className="radar-grid" points={s.map((_, i) => pt(i, (R * lvl) / 4).join(',')).join(' ')} />
      ))}
      {s.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} className="radar-axis" x1={c} y1={c} x2={x} y2={y} />;
      })}
      <polygon className="radar-shape" points={poly} />
      {s.map((sk, i) => {
        const [x, y] = pt(i, (R * sk.depth) / 4);
        return <circle key={i} className="radar-dot" cx={x} cy={y} r={4} />;
      })}
      {s.map((sk, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <text key={i} x={x} y={y} className="radar-label" textAnchor={Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end'} dominantBaseline="middle">
            {sk.name}
          </text>
        );
      })}
    </svg>
  );
}

function Meter5({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="meter5">
      <div className="meter5-head">
        <span>{label}</span>
        <strong>{value}/5</strong>
      </div>
      <div className="meter5-track">
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} className={i <= value ? 'on' : ''} />
        ))}
      </div>
      <p className="small muted">{note}</p>
    </div>
  );
}

function ManagerTab({ c }: { c: Candidate }) {
  const top = [...(c.skills ?? [])].sort((a, b) => b.depth - a.depth).slice(0, 3);
  const next =
    c.verdict === 'strong'
      ? 'Move to the technical panel. Skip the aptitude round.'
      : c.verdict === 'promising'
        ? 'Short technical call focused on the gaps below.'
        : c.verdict === 'review'
          ? 'Watch the flagged moment, then decide. Consider a 10-minute call.'
          : 'Not ready for this role yet. Share the feedback summary and invite them to reapply later.';
  return (
    <div className="tab-grid">
      <article className="card card--span">
        <h3>Summary</h3>
        <p className="summary">{c.summary}</p>
        <div className="next-step">
          <BadgeCheck size={18} />
          <div>
            <strong>Suggested next step</strong>
            <p>{next}</p>
          </div>
        </div>
      </article>
      <article className="card">
        <h3>Skill profile</h3>
        <Radar skills={c.skills ?? []} />
      </article>
      <article className="card">
        <h3>Standout strengths</h3>
        <ul className="stand">
          {top.map((s) => (
            <li key={s.name}>
              <div className="stand-head">
                <strong>{s.name}</strong>
                <DepthPips depth={s.depth} />
              </div>
              <p className="quote">{s.evidence}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt">Gaps to probe</h3>
        <ul className="ticks ticks--muted">
          {(c.practise ?? []).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}

const EVENT_ICON = { gaze: Eye, phone: Smartphone, voice: Mic, reconnect: Wifi };

function HrTab({ c }: { c: Candidate }) {
  return (
    <div className="tab-grid">
      <article className="card">
        <h3>Communication</h3>
        <Meter5 label="Communication" value={c.communication ?? 0} note="Clarity and structure of explanations." />
        <Meter5 label="Composure" value={c.composure ?? 0} note="Relative to their own baseline, not other candidates." />
        <Meter5 label="Collaboration" value={c.collaboration ?? 0} note="Building on Aria’s hints during the joint problem." />
      </article>
      <article className="card">
        <h3>Integrity timeline</h3>
        {c.integrity && c.integrity.length > 0 ? (
          <ol className="events">
            {c.integrity.map((e, i) => {
              const Icon = EVENT_ICON[e.kind];
              return (
                <li key={i} className={`event event--${e.severity}`}>
                  <span className="event-time">{e.at}</span>
                  <span className="event-icon">
                    <Icon size={15} />
                  </span>
                  <span>{e.note}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="clean">
            <BadgeCheck size={16} /> Nothing to review. Clean session.
          </p>
        )}
        <p className="small muted mt-sm">Signals are for human review only. Aria never rejects anyone automatically.</p>
      </article>
      <article className="card card--span">
        <h3>Candidate’s feedback card</h3>
        <div className="feedback-cols">
          <div>
            <h4>Strengths shared</h4>
            <ul className="ticks">
              {(c.strengths ?? []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Practise next</h4>
            <ul className="ticks ticks--muted">
              {(c.practise ?? []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </article>
    </div>
  );
}

function TechTab({ c }: { c: Candidate }) {
  const groups: { kind: SkillScore['kind']; label: string }[] = [
    { kind: 'core', label: 'Core' },
    { kind: 'related', label: 'Related (validated implicitly)' },
    { kind: 'tool', label: 'Tools' },
  ];
  return (
    <div className="tab-grid">
      <article className="card card--span">
        <h3>Skill depth with evidence</h3>
        <div className="depth-legend">
          {([1, 2, 3, 4] as const).map((d) => (
            <span key={d}>
              <DepthPips depth={d} /> {DEPTH_LABEL[d]}
            </span>
          ))}
        </div>
        {groups.map((g) => {
          const items = (c.skills ?? []).filter((s) => s.kind === g.kind);
          if (!items.length) return null;
          return (
            <div key={g.kind} className="skill-group">
              <h4>{g.label}</h4>
              <ul className="skills">
                {items.map((s) => (
                  <li key={s.name}>
                    <div className="skill-name">
                      <strong>{s.name}</strong>
                      <span className="skill-depth">
                        <DepthPips depth={s.depth} /> {DEPTH_LABEL[s.depth]}
                      </span>
                    </div>
                    <p className="quote">{s.evidence}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </article>
      {c.codeCard && (
        <article className="card">
          <h3>Code card</h3>
          <div className="cc-stats">
            <div>
              <span className="cc-num">{c.codeCard.solved ? 'Solved' : 'Unsolved'}</span>
              <span className="small muted">result</span>
            </div>
            <div>
              <span className="cc-num">{c.codeCard.attempts}</span>
              <span className="small muted">instructions</span>
            </div>
            <div>
              <span className="cc-num">{c.codeCard.timeSec}s</span>
              <span className="small muted">time</span>
            </div>
          </div>
          <p className="quote">{c.codeCard.explanation}</p>
        </article>
      )}
      {c.highlights && (
        <article className="card">
          <h3>
            <MessageSquareQuote size={16} /> Moments worth reading
          </h3>
          <ol className="captions-log captions-log--static">
            {c.highlights.map((h, i) => (
              <li key={i} className={`bubble bubble--${h.who}`}>
                <span className="bubble-who">{h.who === 'ai' ? 'Aria' : c.name.split(' ')[0]}</span>
                {h.text}
              </li>
            ))}
          </ol>
        </article>
      )}
    </div>
  );
}

export default function Report({ id }: { id: string }) {
  const c = CANDIDATES.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>('manager');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!c || c.status !== 'completed') {
    return (
      <div className="app">
        <TopBar home="/admin" suffix="Admin" />
        <main className="app-main">
          <h1 data-route-focus tabIndex={-1}>
            Report not ready
          </h1>
          <button className="btn btn--soft" onClick={() => navigate('/admin', 'back')}>
            Back to candidates
          </button>
        </main>
      </div>
    );
  }

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = (i + d + TABS.length) % TABS.length;
    setTab(TABS[n].id);
    tabRefs.current[n]?.focus();
  };

  return (
    <div className="app">
      <TopBar home="/admin" suffix="Admin" />
      <main className="app-main">
        <button className="back-link" onClick={() => navigate('/admin', 'back')}>
          <ArrowLeft size={16} /> All candidates
        </button>

        <header className="report-head">
          <Avatar name={c.name} size="lg" />
          <div className="report-who">
            <h1 data-route-focus tabIndex={-1}>
              {c.name}
            </h1>
            <p className="muted">
              {TRACK_LABEL[c.track]} · {OPENINGS.find((o) => o.id === c.openingId)?.title}
            </p>
            <div className="report-meta">
              <span>
                <Clock size={14} /> {c.durationMin} min interview
              </span>
              <span>
                <Mail size={14} /> {c.email}
              </span>
            </div>
          </div>
          <div className="report-score">
            <div className="score-ring">
              <Ring value={(c.score ?? 0) / 100} size={64} stroke={4} label={`Score ${c.score} of 100`} />
              <span>{c.score}</span>
            </div>
            <VerdictBadge verdict={c.verdict!} />
          </div>
          <button className="btn btn--ghost btn--sm report-dl" onClick={() => window.print()}>
            <Download size={16} /> Save PDF
          </button>
        </header>

        <div className="tabs" role="tablist" aria-label="Report views">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => (tabRefs.current[i] = el)}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={`tab ${tab === t.id ? 'is-on' : ''}`}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <t.icon size={17} />
              <span className="tab-label">{t.label}</span>
              <span className="tab-who">{t.who}</span>
            </button>
          ))}
        </div>

        <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel" key={tab}>
          {tab === 'manager' && <ManagerTab c={c} />}
          {tab === 'hr' && <HrTab c={c} />}
          {tab === 'tech' && <TechTab c={c} />}
        </section>
      </main>
    </div>
  );
}
