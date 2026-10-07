import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Copy, Loader2, Search, ShieldAlert, Sparkles, Users } from 'lucide-react';
import { TRACK_LABEL, type SessionSummary, type Verdict } from '../../../shared/types';
import { AdminShell } from '../components/AdminShell';
import { Avatar, VerdictBadge } from '../components/bits';
import { api } from '../lib/api';
import { navigate } from '../lib/router';

type Filter = 'all' | Verdict | 'live' | 'incomplete';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strong', label: 'Strong yes' },
  { id: 'promising', label: 'Promising' },
  { id: 'review', label: 'Needs review' },
  { id: 'hold', label: 'Not yet' },
  { id: 'live', label: 'In progress' },
  { id: 'incomplete', label: 'Incomplete' },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function StatusCell({ s }: { s: SessionSummary }) {
  if (s.verdict) return <VerdictBadge verdict={s.verdict} />;
  if (s.status === 'active')
    return (
      <span className="live-pill">
        <span className="pulse-dot" /> In progress
      </span>
    );
  if (s.status === 'created') return <span className="soon-pill">Not started</span>;
  if (s.reportStatus === 'pending')
    return (
      <span className="soon-pill">
        <Loader2 size={11} className="spin" /> Writing report
      </span>
    );
  if (s.status === 'abandoned') return <span className="soon-pill">Abandoned</span>;
  if (s.status === 'terminated') return <span className="verdict verdict--review">Terminated</span>;
  return <span className="soon-pill">No report</span>;
}

function Interviews() {
  const [data, setData] = useState<{ sessions: SessionSummary[]; live: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [copied, setCopied] = useState(false);
  const [keyMissing, setKeyMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () =>
      api
        .sessions()
        .then((d) => !stop && (setData(d), setErr(null)))
        .catch((e) => !stop && setErr(e.message));
    void load();
    api.settings().then((s) => !stop && setKeyMissing(!s.hasKey)).catch(() => {});
    const t = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.sessions ?? []).filter((s) => {
      if (filter === 'live' && s.status !== 'active') return false;
      if (filter === 'incomplete' && !(s.status === 'abandoned' || s.status === 'terminated' || s.status === 'created')) return false;
      if (!['all', 'live', 'incomplete'].includes(filter) && s.verdict !== filter) return false;
      if (needle && !`${s.candidate.name} ${s.candidate.email} ${TRACK_LABEL[s.candidate.track]}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, q, filter]);

  const all = data?.sessions ?? [];
  const reported = all.filter((s) => s.verdict);
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = all.filter((s) => s.status === 'completed' && Date.parse(s.endedAt ?? s.createdAt) > weekAgo).length;
  const strong = reported.filter((s) => s.verdict === 'strong').length;
  const flagged = all.filter((s) => s.flags > 0).length;
  const durations = all.map((s) => s.durationMin).filter((d): d is number => d != null);
  const avgMin = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  const link = `${location.origin}${location.pathname}#/`;
  const open = (s: SessionSummary) => s.status !== 'created' && navigate(`/admin/report/${s.id}`);

  return (
    <main className="app-main">
      <div className="dash-head">
        <div>
          <h1 data-route-focus tabIndex={-1}>
            Interviews
          </h1>
          <p className="muted">
            {data && data.live > 0 ? (
              <>
                <span className="live-dot" /> {data.live} interview{data.live > 1 ? 's' : ''} in progress
              </>
            ) : (
              'No interviews in progress'
            )}
          </p>
        </div>
        <div className="invite invite--inline">
          <code>{link}</code>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              navigator.clipboard?.writeText(link).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy candidate link'}
          </button>
        </div>
      </div>

      {keyMissing && (
        <div className="notice notice--warn" role="alert">
          <AlertTriangle size={16} />
          <span>
            Candidates can’t start interviews until a Gemini API key is added.{' '}
            <a
              href="#/admin/settings"
              onClick={(e) => {
                e.preventDefault();
                navigate('/admin/settings');
              }}
            >
              Open settings
            </a>
          </span>
        </div>
      )}
      {err && (
        <div className="notice notice--warn" role="alert">
          <AlertTriangle size={16} />
          <span>{err}</span>
        </div>
      )}

      <section className="kpis" aria-label="Summary">
        <div className="kpi">
          <span className="kpi-icon">
            <Users />
          </span>
          <span className="kpi-label">Completed this week</span>
          <span className="kpi-value">{data ? thisWeek : '—'}</span>
          <span className="kpi-delta">{all.length} interviews in total</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon">
            <Sparkles />
          </span>
          <span className="kpi-label">Strong yes</span>
          <span className="kpi-value">
            {data ? strong : '—'}
            {data && <small> / {reported.length}</small>}
          </span>
          <span className="kpi-delta">Of interviews with a report</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon">
            <ShieldAlert />
          </span>
          <span className="kpi-label">Integrity flags</span>
          <span className="kpi-value">{data ? flagged : '—'}</span>
          <span className="kpi-delta">Interviews to review</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon">
            <Clock />
          </span>
          <span className="kpi-label">Average duration</span>
          <span className="kpi-value">
            {avgMin ?? '—'}
            {avgMin != null && <small> min</small>}
          </span>
          <span className="kpi-delta">Across finished interviews</span>
        </div>
      </section>

      <section className="table-card" aria-labelledby="cands-title">
        <div className="table-tools">
          <h2 id="cands-title">Candidates</h2>
          <div className="search">
            <Search />
            <label htmlFor="q" className="sr-only">
              Search candidates
            </label>
            <input id="q" placeholder="Search name, email, track" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="filter-row" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} className={`chip ${filter === f.id ? 'is-on' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {rows.length > 0 && (
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
        )}
        <div className="cand-list" role="list">
          {rows.map((s) => {
            const clickable = s.status !== 'created';
            return (
              <div
                key={s.id}
                role="listitem"
                className={`cand ${clickable ? 'is-link' : ''}`}
                tabIndex={clickable ? 0 : -1}
                onClick={() => open(s)}
                onKeyDown={(e) => e.key === 'Enter' && open(s)}
              >
                <Avatar name={s.candidate.name} />
                <div className="cand-who">
                  <strong>{s.candidate.name}</strong>
                  <span>{s.candidate.email}</span>
                </div>
                <span className="cand-track">{TRACK_LABEL[s.candidate.track]}</span>
                <div className="cand-score">
                  {s.score != null ? (
                    <>
                      <span className="bar">
                        <i style={{ width: `${s.score}%` }} />
                      </span>
                      <span className="cand-num">{s.score}</span>
                    </>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </div>
                <div className="cand-verdict">
                  <StatusCell s={s} />
                </div>
                <div className="cand-flags">
                  {s.flags > 0 && (
                    <span className="flag" title={`${s.flags} integrity event${s.flags > 1 ? 's' : ''}`}>
                      <ShieldAlert size={15} />
                    </span>
                  )}
                </div>
                <span className="cand-date">{fmtDate(s.createdAt)}</span>
                <span className="cand-go">{clickable && <ChevronRight />}</span>
              </div>
            );
          })}
          {data && rows.length === 0 && (
            <div className="empty">
              {all.length === 0 ? (
                <>
                  <p>No interviews yet.</p>
                  <p className="small">Share the candidate link above. Interviews appear here as soon as they start.</p>
                </>
              ) : (
                <>
                  <p>No interviews match these filters.</p>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      setQ('');
                      setFilter('all');
                    }}
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}
          {!data && !err && (
            <div className="empty">
              <Loader2 className="spin" size={18} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function Dashboard() {
  return (
    <AdminShell>
      <Interviews />
    </AdminShell>
  );
}
