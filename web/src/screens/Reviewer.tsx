import { useEffect, useState, type FormEvent } from 'react'
import type { SessionSummary } from '@skillx/shared'
import { api, sessionStorageGet, sessionStorageSet } from '../lib/api'

export function ReviewerList() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(sessionStorageGet('reviewerKey') ?? '')

  const load = () =>
    api
      .listSessions()
      .then((list) => {
        setError(null)
        setSessions(list)
      })
      .catch((e: Error) => setError(e.message))

  useEffect(() => {
    void load()
  }, [])

  const saveKey = (e: FormEvent) => {
    e.preventDefault()
    sessionStorageSet('reviewerKey', key || null)
    void load()
  }

  return (
    <main className="screen">
      <div className="card">
        <p className="eyebrow">Reviewers</p>
        <h1>Assessment sessions</h1>
        <form className="inline-form" onSubmit={saveKey}>
          <input
            type="password"
            placeholder="Reviewer key (if required)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            aria-label="Reviewer key"
          />
          <button className="btn btn-quiet" type="submit">
            Load
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        {sessions && sessions.length === 0 && <p className="muted">No sessions yet.</p>}
        {sessions && sessions.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role</th>
                <th>Status</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.sessionId}>
                  <td>{s.candidate.name}</td>
                  <td>{s.candidate.role}</td>
                  <td>
                    <span className={`pill pill-${s.status}`}>{s.status}</span>
                  </td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>
                    <a href={`#/report/${s.sessionId}`}>Report →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
