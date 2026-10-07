import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Clock, Copy, Link2, Plus, Search, ShieldAlert, Sparkles, Users, X } from 'lucide-react';
import { TopBar } from '../components/Chrome';
import { Avatar, Ring, VerdictBadge } from '../components/bits';
import { CANDIDATES, OPENINGS, TRACK_LABEL, type Candidate, type Verdict } from '../data/demo';
import { navigate } from '../lib/router';

type Filter = 'all' | Verdict | 'in_progress';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strong', label: 'Strong yes' },
  { id: 'promising', label: 'Promising' },
  { id: 'review', label: 'Needs review' },
  { id: 'hold', label: 'Not yet' },
  { id: 'in_progress', label: 'In progress' },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function NewOpeningDialog({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/#/?invite=demo`;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="nd-title" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn dialog-x" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2 id="nd-title">New opening</h2>
        <p className="muted">Candidates use the invite link to start their interview straight away.</p>
        <div className="dialog-grid">
          <div className="field">
            <label htmlFor="nd-name">Role title</label>
            <input id="nd-name" placeholder="e.g. Senior Frontend Engineer" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="nd-team">Team</label>
            <input id="nd-team" placeholder="e.g. Web Platform" />
          </div>
          <div className="field">
            <label htmlFor="nd-track">Interview track</label>
            <select id="nd-track" defaultValue="frontend">
              {Object.entries(TRACK_LABEL).map(([id, l]) => (
                <option key={id} value={id}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nd-close">Closes on</label>
            <input id="nd-close" type="date" />
          </div>
        </div>
        <div className="invite">
          <Link2 size={18} />
          <code>{link}</code>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              navigator.clipboard?.writeText(link).catch(() => {});
              setCopied(true);
            }}
          >
            {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="dialog-actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={onClose}>
            Create opening
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [opening, setOpening] = useState<string>('all');
  const [dialog, setDialog] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CANDIDATES.filter((c) => {
      if (opening !== 'all' && c.openingId !== opening) return false;
      if (filter === 'in_progress' && c.status !== 'in_progress') return false;
      if (filter !== 'all' && filter !== 'in_progress' && c.verdict !== filter) return false;
      if (needle && !`${c.name} ${c.email} ${TRACK_LABEL[c.track]}`.toLowerCase().includes(needle)) return false;
      return true;
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [q, filter, opening]);

  const done = CANDIDATES.filter((c) => c.status === 'completed');
  const strong = done.filter((c) => c.verdict === 'strong').length;
  const flagged = done.filter((c) => c.integrity?.some((e) => e.severity === 'warn')).length;
  const avgMin = Math.round(done.reduce((s, c) => s + (c.durationMin ?? 0), 0) / done.length);
  const live = OPENINGS.reduce((s, o) => s + o.live, 0);

  const open = (c: Candidate) => c.status === 'completed' && navigate(`/admin/report/${c.id}`);

  return (
    <div className="app">
      <TopBar home="/admin" suffix="Admin">
        <span className="admin-user">
          <Avatar name="Hiring Admin" size="sm" />
          <span className="hide-sm">Hiring team</span>
        </span>
      </TopBar>

      <main className="app-main">
        <div className="dash-head">
          <div>
            <h1 data-route-focus tabIndex={-1}>
              Interviews
            </h1>
            <p className="muted">
              {live > 0 ? (
                <>
                  <span className="live-dot" /> {live} candidates are interviewing right now
                </>
              ) : (
                'No interviews in progress'
              )}
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => setDialog(true)}>
            <Plus size={18} /> New opening
          </button>
        </div>

        <section className="kpis" aria-label="Summary">
          <div className="kpi">
            <span className="kpi-icon kpi-icon--brand">
              <Users size={18} />
            </span>
            <span className="kpi-label">Completed this week</span>
            <span className="kpi-value">68</span>
            <span className="kpi-delta kpi-delta--up">+23 vs last week</span>
          </div>
          <div className="kpi">
            <span className="kpi-icon kpi-icon--success">
              <Sparkles size={18} />
            </span>
            <span className="kpi-label">Strong yes</span>
            <span className="kpi-value">
              {strong}
              <small> / {done.length}</small>
            </span>
            <span className="kpi-delta">Ready for the technical round</span>
          </div>
          <div className="kpi">
            <span className="kpi-icon kpi-icon--warn">
              <ShieldAlert size={18} />
            </span>
            <span className="kpi-label">Integrity flags</span>
            <span className="kpi-value">{flagged}</span>
            <span className="kpi-delta">Awaiting human review</span>
          </div>
          <div className="kpi">
            <span className="kpi-icon kpi-icon--accent">
              <Clock size={18} />
            </span>
            <span className="kpi-label">Average duration</span>
            <span className="kpi-value">
              {avgMin}
              <small> min</small>
            </span>
            <span className="kpi-delta">vs ~45 min panel round</span>
          </div>
        </section>

        <section aria-labelledby="openings-title">
          <div className="row-head">
            <h2 id="openings-title">Openings</h2>
            {opening !== 'all' && (
              <button className="btn btn--ghost btn--sm" onClick={() => setOpening('all')}>
                Show all
              </button>
            )}
          </div>
          <div className="drives">
            {OPENINGS.map((o) => {
              const pct = o.invited ? o.completed / o.invited : 0;
              const selected = opening === o.id;
              return (
                <button key={o.id} className={`drive ${selected ? 'is-on' : ''}`} onClick={() => setOpening(selected ? 'all' : o.id)} aria-pressed={selected}>
                  <div className="drive-top">
                    <strong className="drive-title">{o.title}</strong>
                    {o.live > 0 && (
                      <span className="live-pill">
                        <span className="pulse-dot" /> {o.live} live
                      </span>
                    )}
                  </div>
                  <span className="drive-meta">
                    {o.team} · {o.location}
                  </span>
                  <div className="drive-progress">
                    <Ring value={pct} size={20} stroke={3} label={`${Math.round(pct * 100)}% complete`} />
                    <span>
                      <strong>{o.completed}</strong> of {o.invited} completed
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="table-card" aria-labelledby="cands-title">
          <div className="table-tools">
            <h2 id="cands-title">
              Candidates {opening !== 'all' && <span className="muted-ink">· {OPENINGS.find((o) => o.id === opening)?.title}</span>}
            </h2>
            <div className="search">
              <Search size={16} />
              <label htmlFor="q" className="sr-only">
                Search candidates
              </label>
              <input id="q" placeholder="Search name, email, track" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="filter-row" role="group" aria-label="Filter by verdict">
            {FILTERS.map((f) => (
              <button key={f.id} className={`chip chip--sm ${filter === f.id ? 'is-on' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="cand-head" aria-hidden="true">
            <span />
            <span>Candidate</span>
            <span>Track</span>
            <span>Score</span>
            <span>Status</span>
            <span />
            <span>Date</span>
            <span />
          </div>
          <div className="cand-list" role="list">
            {rows.map((c) => (
              <div
                key={c.id}
                role="listitem"
                className={`cand ${c.status === 'completed' ? 'is-link' : ''}`}
                tabIndex={c.status === 'completed' ? 0 : -1}
                onClick={() => open(c)}
                onKeyDown={(e) => e.key === 'Enter' && open(c)}
              >
                <Avatar name={c.name} />
                <div className="cand-who">
                  <strong>{c.name}</strong>
                  <span>{c.email}</span>
                </div>
                <span className="cand-track">{TRACK_LABEL[c.track]}</span>
                <div className="cand-score">
                  {c.score != null ? (
                    <>
                      <span className="bar">
                        <i style={{ width: `${c.score}%` }} />
                      </span>
                      <span className="cand-num">{c.score}</span>
                    </>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </div>
                <div className="cand-verdict">
                  {c.verdict ? (
                    <VerdictBadge verdict={c.verdict} />
                  ) : c.status === 'in_progress' ? (
                    <span className="live-pill">
                      <span className="pulse-dot" /> Interviewing
                    </span>
                  ) : (
                    <span className="soon-pill">Invited</span>
                  )}
                </div>
                <div className="cand-flags">
                  {c.integrity?.some((e) => e.severity === 'warn') && (
                    <span className="flag" title="Integrity event to review">
                      <ShieldAlert size={15} />
                    </span>
                  )}
                </div>
                <span className="cand-date">{c.completedAt ? fmtDate(c.completedAt) : ''}</span>
                <span className="cand-go">{c.status === 'completed' && <ChevronRight size={18} />}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="empty">
                <p>No candidates match these filters.</p>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setQ('');
                    setFilter('all');
                    setOpening('all');
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {dialog && <NewOpeningDialog onClose={() => setDialog(false)} />}
    </div>
  );
}
