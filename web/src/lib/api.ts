import type { AssessmentReport, CandidateProfile, CreateSessionResponse, SessionSummary } from '@skillx/shared'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

function reviewerHeaders(): HeadersInit {
  const key = sessionStorageGet('reviewerKey')
  return key ? { 'X-Reviewer-Key': key } : {}
}

export function sessionStorageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function sessionStorageSet(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the app still works without it.
  }
}

export const api = {
  health: () => fetch('/api/health').then((r) => json<{ ok: boolean; mock: boolean; model: string }>(r)),
  domains: () => fetch('/api/domains').then((r) => json<Array<{ domain: string; label: string }>>(r)),
  createSession: (profile: CandidateProfile) =>
    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }).then((r) => json<CreateSessionResponse>(r)),
  listSessions: () => fetch('/api/sessions', { headers: reviewerHeaders() }).then((r) => json<SessionSummary[]>(r)),
  report: (id: string) =>
    fetch(`/api/sessions/${id}/report`, { headers: reviewerHeaders() }).then((r) => json<AssessmentReport>(r)),
}

export function socketUrl(sessionId: string, token: string): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws/sessions/${sessionId}?token=${encodeURIComponent(token)}`
}
