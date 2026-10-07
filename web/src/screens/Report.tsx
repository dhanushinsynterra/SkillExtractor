import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Clock,
  Code2,
  Download,
  Eye,
  Loader2,
  Mail,
  MessageSquareText,
  MonitorX,
  RefreshCw,
  Trash2,
  UserRound,
  Users,
  UserX,
  Wifi,
  CameraOff,
} from 'lucide-react';
import { AI_NAME, DEPTH_LABEL, TRACK_LABEL, type IntegrityKind, type Report as ReportData, type SessionRecord } from '../../../shared/types';
import { AdminShell } from '../components/AdminShell';
import { Avatar, DepthPips, Ring, VerdictBadge } from '../components/bits';
import { api } from '../lib/api';
import { navigate } from '../lib/router';

type Tab = 'manager' | 'hr' | 'tech' | 'transcript';
const TABS: { id: Tab; label: string; icon: typeof Briefcase }[] = [
  { id: 'manager', label: 'Manager', icon: Briefcase },
  { id: 'hr', label: 'HR', icon: UserRound },
  { id: 'tech', label: 'Tech', icon: Code2 },
  { id: 'transcript', label: 'Transcript', icon: MessageSquareText },
];

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function Radar({ skills }: { skills: ReportData['skills'] }) {
  const s = [...skills].sort((a, b) => b.depth - a.depth).slice(0, 8);
  if (s.length < 3) return <p className="muted small">Not enough skills recorded for a chart.</p>;
  const n = s.length;
  const size = 300;
  const c = size / 2;
  const R = 96;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label="Skill depth chart">
      {[1, 2, 3, 4].map((lvl) => (
        <polygon key={lvl} className="radar-grid" points={s.map((_, i) => pt(i, (R * lvl) / 4).join(',')).join(' ')} />
      ))}
      {s.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} className="radar-axis" x1={c} y1={c} x2={x} y2={y} />;
      })}
      <polygon className="radar-shape" points={s.map((sk, i) => pt(i, (R * sk.depth) / 4).join(',')).join(' ')} />
      {s.map((sk, i) => {
        const [x, y] = pt(i, (R * sk.depth) / 4);
        return <circle key={i} className="radar-dot" cx={x} cy={y} r={3} />;
      })}
      {s.map((sk, i) => {
        const [x, y] = pt(i, R + 20);
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

const EVENT_ICON: Record<IntegrityKind, typeof Eye> = {
  absent: UserX,
  returned: Eye,
  multiple_faces: Users,
  camera_off: CameraOff,
  reconnect: Wifi,
  tab_hidden: MonitorX,
};

function Integrity({ s }: { s: SessionRecord }) {
  if (s.integrity.length === 0)
    return (
      <p className="clean">
        <BadgeCheck size={16} /> No integrity events.
      </p>
    );
  return (
    <ol className="events">
      {s.integrity.map((e, i) => {
        const Icon = EVENT_ICON[e.kind] ?? Eye;
        return (
          <li key={i} className={`event event--${e.severity}`}>
            <span className="event-time">{fmt(e.at)}</span>
            <span className="event-icon">
              <Icon size={14} />
            </span>
            <span>{e.note}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Transcript({ s }: { s: SessionRecord }) {
  if (s.transcript.length === 0) return <p className="muted small">No conversation was recorded.</p>;
  return (
    <ol className="captions-log captions-log--static">
      {s.transcript.map((t, i) => (
        <li key={i} className={`bubble bubble--${t.who === 'ai' ? 'ai' : 'you'}`}>
          <span className="bubble-who">
            {t.who === 'ai' ? AI_NAME : s.candidate.name} <span className="event-time">{fmt(t.at)}</span>
          </span>
          {t.text}
        </li>
      ))}
    </ol>
  );
}

function ReportView({ id }: { id: string }) {
  const [s, setS] = useState<SessionRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('manager');
  const [busy, setBusy] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let stop = false;
    let t: number | undefined;
    const load = () =>
      api
        .session(id)
        .then((r) => {
          if (stop) return;
          setS(r);
          if (r.status === 'active' || r.reportStatus === 'pending') t = window.setTimeout(load, 3000);
        })
        .catch((e) => !stop && setErr(e.message));
    void load();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [id]);

  async function regenerate() {
    setBusy(true);
    try {
      setS(await api.regenerate(id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this interview and its transcript permanently?')) return;
    try {
      await api.deleteSession(id);
      navigate('/admin', 'back');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (err && !s)
    return (
      <main className="app-main">
        <div className="notice notice--warn">
          <AlertTriangle size={16} /> {err}
        </div>
      </main>
    );
  if (!s)
    return (
      <main className="app-main center-block">
        <Loader2 className="spin" size={18} />
      </main>
    );

  const r = s.report;
  const durationMin = s.startedAt && s.endedAt ? Math.max(1, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000)) : null;
  const evidence = r?.skills ?? [];
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = (i + d + TABS.length) % TABS.length;
    setTab(TABS[n].id);
    tabRefs.current[n]?.focus();
  };

  return (
    <main className="app-main">
      <button className="back-link" onClick={() => navigate('/admin', 'back')}>
        <ArrowLeft size={14} /> All interviews
      </button>

      <header className="report-head">
        <Avatar name={s.candidate.name} size="lg" />
        <div className="report-who">
          <h1 data-route-focus tabIndex={-1}>
            {s.candidate.name}
          </h1>
          <p className="muted">{TRACK_LABEL[s.candidate.track]}</p>
          <div className="report-meta">
            <span>
              <Mail size={13} /> {s.candidate.email}
            </span>
            <span>
              <Clock size={13} /> {new Date(s.createdAt).toLocaleString()}
              {durationMin != null && ` · ${durationMin} min`}
            </span>
          </div>
        </div>
        {r && (
          <div className="report-score">
            <div className="score-ring">
              <Ring value={r.score / 100} size={64} stroke={4} label={`Score ${r.score} of 100`} />
              <span>{r.score}</span>
            </div>
            <VerdictBadge verdict={r.verdict} />
          </div>
        )}
        <div className="report-actions">
          {r && (
            <button className="btn btn--ghost btn--sm" onClick={() => window.print()}>
              <Download size={14} /> PDF
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={remove} aria-label="Delete interview" title="Delete interview">
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      {s.status === 'active' && (
        <div className="notice">
          <span className="live-dot" /> This interview is in progress. The report will be written when it ends.
        </div>
      )}
      {(s.status === 'abandoned' || s.status === 'terminated') && (
        <div className="notice notice--warn">
          <AlertTriangle size={16} />
          {s.status === 'abandoned' ? 'The interview ended early because the connection was lost.' : 'The interview was ended by the proctoring policy.'}
        </div>
      )}
      {s.reportStatus === 'pending' && (
        <div className="notice">
          <Loader2 size={14} className="spin" /> Writing the report…
        </div>
      )}
      {s.reportStatus === 'failed' && (
        <div className="notice notice--warn">
          <AlertTriangle size={16} />
          <span>Report could not be generated: {s.reportError}</span>
          <button className="btn btn--ghost btn--sm" onClick={regenerate} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Retry
          </button>
        </div>
      )}

      <div>
        <div className="tabs" role="tablist" aria-label="Report views">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={`tab ${tab === t.id ? 'is-on' : ''}`}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <t.icon />
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </div>

        <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel" key={tab}>
          {tab === 'transcript' ? (
            <article className="card">
              <Transcript s={s} />
            </article>
          ) : !r ? (
            <article className="card">
              <p className="muted">The report isn’t available yet. The transcript tab shows the conversation so far.</p>
            </article>
          ) : tab === 'manager' ? (
            <div className="tab-grid">
              <article className="card card--span">
                <h3>Summary</h3>
                <p className="summary">{r.summary}</p>
                <div className="next-step">
                  <BadgeCheck />
                  <div>
                    <strong>Suggested next step</strong>
                    <p>{r.nextStep}</p>
                  </div>
                </div>
              </article>
              <article className="card">
                <h3>Skill profile</h3>
                <Radar skills={evidence} />
              </article>
              <article className="card">
                <h3>Standout strengths</h3>
                <ul className="stand">
                  {[...evidence]
                    .sort((a, b) => b.depth - a.depth)
                    .slice(0, 3)
                    .map((k) => (
                      <li key={k.name}>
                        <div className="stand-head">
                          <strong>{k.name}</strong>
                          <DepthPips depth={k.depth} />
                        </div>
                        <p className="quote">{k.evidence}</p>
                      </li>
                    ))}
                </ul>
                <h4>Gaps to probe</h4>
                <ul className="ticks ticks--muted">
                  {r.practise.map((p) => (
                    <li key={p.title}>{p.title}</li>
                  ))}
                </ul>
              </article>
            </div>
          ) : tab === 'hr' ? (
            <div className="tab-grid">
              <article className="card">
                <h3>Communication</h3>
                <Meter5 label="Clarity" value={r.communication} note="How clearly and logically answers were structured." />
                <Meter5 label="Composure" value={r.composure} note="Steadiness under follow-up questions." />
                <Meter5 label="Collaboration" value={r.collaboration} note="Building on hints during the joint problem." />
              </article>
              <article className="card">
                <h3>Integrity timeline</h3>
                <Integrity s={s} />
                <p className="small muted mt-sm">Signals are for human review only. They are never used to reject a candidate automatically.</p>
              </article>
              <article className="card card--span">
                <h3>Feedback shared with the candidate</h3>
                <div className="feedback-cols">
                  <div>
                    <h4>Strengths</h4>
                    <ul className="ticks">
                      {r.strengths.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Practise next</h4>
                    <ul className="ticks ticks--muted">
                      {r.practise.map((p) => (
                        <li key={p.title}>
                          {p.title} — <span className="muted">{p.why}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            </div>
          ) : (
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
                {(['core', 'related', 'tool'] as const).map((kind) => {
                  const items = evidence.filter((k) => k.kind === kind);
                  if (!items.length) return null;
                  return (
                    <div key={kind}>
                      <h4>{kind === 'core' ? 'Core' : kind === 'related' ? 'Related' : 'Tools'}</h4>
                      <ul className="skills">
                        {items.map((k) => (
                          <li key={k.name}>
                            <div className="skill-name">
                              <strong>{k.name}</strong>
                              <span className="skill-depth">
                                <DepthPips depth={k.depth} /> {DEPTH_LABEL[k.depth]}
                              </span>
                            </div>
                            <p className="quote">{k.evidence}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </article>
              <article className="card card--span">
                <h3>Code review</h3>
                {s.code ? (
                  <>
                    <div className="cc-stats">
                      <div>
                        <span className="cc-num">{s.code.solved ? 'Solved' : 'Unsolved'}</span>
                        <span className="small muted">result</span>
                      </div>
                      <div>
                        <span className="cc-num">{s.code.attempts}</span>
                        <span className="small muted">edits</span>
                      </div>
                      <div>
                        <span className="cc-num">
                          {s.code.solvedAt != null && s.code.startedAt != null ? `${Math.round((s.code.solvedAt - s.code.startedAt) / 1000)}s` : '—'}
                        </span>
                        <span className="small muted">time to fix</span>
                      </div>
                    </div>
                    <pre className="code-final">
                      {s.code.lines.map((l, i) => (
                        <div key={i}>
                          <span className="ln">{i + 1}</span>
                          {l}
                        </div>
                      ))}
                    </pre>
                  </>
                ) : (
                  <p className="muted small">The interview ended before the code review stage.</p>
                )}
              </article>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function Report({ id }: { id: string }) {
  return (
    <AdminShell>
      <ReportView id={id} />
    </AdminShell>
  );
}
