import { useEffect, useState } from 'react'
import { DEPTH_LABELS, type AssessmentReport, type Recommendation } from '@skillx/shared'
import { api } from '../lib/api'

type Tab = 'manager' | 'hr' | 'technical' | 'transcript'

const RECOMMENDATION: Record<Recommendation, string> = {
  strong_yes: 'Strong yes',
  yes: 'Yes',
  lean_yes: 'Lean yes',
  lean_no: 'Lean no',
  no: 'No',
  insufficient_data: 'Not enough signal',
}

export function Report({ sessionId }: { sessionId: string }) {
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('manager')

  useEffect(() => {
    api
      .report(sessionId)
      .then(setReport)
      .catch((e: Error) => setError(e.message))
  }, [sessionId])

  if (error)
    return (
      <main className="screen">
        <div className="card">
          <p className="error">{error}</p>
          <a href="#/review">← Back to sessions</a>
        </div>
      </main>
    )
  if (!report)
    return (
      <main className="screen">
        <div className="card muted">Loading report…</div>
      </main>
    )

  return (
    <main className="screen report">
      <a href="#/review" className="back">
        ← All sessions
      </a>
      <header className="card report-head">
        <div>
          <p className="eyebrow">
            {report.candidate.role} · {report.durationMinutes} min · {report.status}
          </p>
          <h1>{report.candidate.name}</h1>
          <p>{report.manager.headline}</p>
        </div>
        <div className="score">
          <span className="score-num">{report.manager.overallScore}</span>
          <span className={`pill rec-${report.manager.recommendation}`}>
            {RECOMMENDATION[report.manager.recommendation]}
          </span>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {(['manager', 'hr', 'technical', 'transcript'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className="tab" onClick={() => setTab(t)}>
            {t === 'hr' ? 'HR' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'manager' && (
        <section className="card">
          <h2>Strengths</h2>
          <List items={report.manager.strengths} empty="No standout strengths recorded." />
          <h2>Risks & gaps</h2>
          <List items={report.manager.risks} empty="No notable risks." />
        </section>
      )}

      {tab === 'hr' && (
        <section className="card">
          <h2>Communication</h2>
          <p>{report.hr.communication}</p>
          <h2>Composure</h2>
          <p>{report.hr.composure}</p>
          <h2>Integrity</h2>
          <p>
            <span className={`pill integrity-${report.hr.integrity.verdict}`}>
              {report.hr.integrity.verdict.replace('_', ' ')}
            </span>{' '}
            {report.hr.integrity.warnings} warning(s)
          </p>
          {report.hr.integrity.events.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Signal</th>
                  <th>Outcome</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {report.hr.integrity.events.map((e, i) => (
                  <tr key={i}>
                    <td>{new Date(e.at).toLocaleTimeString()}</td>
                    <td>{e.type.replace('_', ' ')}</td>
                    <td>{e.verdict}</td>
                    <td>{e.durationMs ? `${Math.round(e.durationMs / 1000)}s ` : ''}{e.detail ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'technical' && (
        <section className="card">
          <p className="muted">
            Explored {report.technical.coverage.probed} of {report.technical.coverage.total} skills ·{' '}
            {report.narrativeSource === 'model' ? 'AI-written notes' : 'heuristic summary'}
          </p>
          {report.technical.notes.length > 0 && <List items={report.technical.notes} />}
          <div className="skills">
            {report.technical.skills.map((s) => (
              <details key={s.id} className="skill">
                <summary>
                  <span className="skill-name">
                    {s.name} <span className="tiny muted">{s.kind}</span>
                  </span>
                  <span className="depth" aria-label={`Depth ${s.depth} of 4`}>
                    {[1, 2, 3, 4].map((n) => (
                      <i key={n} className={n <= s.depth ? 'on' : ''} />
                    ))}
                  </span>
                  <span className="tiny muted">{s.evidence.length ? DEPTH_LABELS[s.depth] : 'not explored'}</span>
                </summary>
                {s.evidence.length > 0 ? (
                  <ul>
                    {s.evidence.map((e, i) => (
                      <li key={i}>
                        <strong>{DEPTH_LABELS[e.depth]}</strong> ({e.source.replace('_', ' ')}): {e.note}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted tiny">No evidence collected.</p>
                )}
              </details>
            ))}
          </div>
          {report.technical.codeCard && (
            <>
              <h2>Code card: {report.technical.codeCard.title}</h2>
              <p>
                {report.technical.codeCard.solved ? 'Fixed' : 'Not fixed'} after {report.technical.codeCard.edits}{' '}
                dictated edit(s).
              </p>
              <pre className="code">
                {report.technical.codeCard.finalLines.map((l, i) => (
                  <div key={i} className="code-line">
                    <span className="ln">{i + 1}</span>
                    <code>{l || ' '}</code>
                  </div>
                ))}
              </pre>
            </>
          )}
        </section>
      )}

      {tab === 'transcript' && (
        <section className="card transcript-full">
          {report.transcript.map((t, i) => (
            <p key={i} className={`line line-${t.role}`}>
              <span className="who">{t.role === 'ai' ? 'Sage' : t.role === 'candidate' ? report.candidate.name : 'System'}</span>
              {t.text}
            </p>
          ))}
        </section>
      )}
    </main>
  )
}

function List({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="muted">{empty}</p>
  return (
    <ul>
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  )
}
