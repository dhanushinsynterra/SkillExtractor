import { useEffect, useState, type FormEvent } from 'react'
import type { CandidateProfile } from '@skillx/shared'
import { api } from '../lib/api'

const FALLBACK_DOMAINS = [
  { domain: 'backend', label: 'Backend engineering' },
  { domain: 'frontend', label: 'Frontend engineering' },
  { domain: 'data', label: 'Data engineering & analytics' },
  { domain: 'devops', label: 'DevOps & platform' },
]

export function Welcome({ onContinue }: { onContinue: (p: CandidateProfile) => void }) {
  const [domains, setDomains] = useState(FALLBACK_DOMAINS)
  const [profile, setProfile] = useState<CandidateProfile>({ name: '', role: '', domain: 'backend' })

  useEffect(() => {
    api.domains().then(setDomains).catch(() => undefined)
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onContinue({ ...profile, name: profile.name.trim(), role: profile.role.trim() })
  }

  return (
    <main className="screen narrow">
      <div className="card welcome">
        <p className="eyebrow">Welcome</p>
        <h1>Let’s have a relaxed chat</h1>
        <p>
          You’ll talk with <strong>Sage</strong>, a friendly AI, for about 15–20 minutes. It’s a conversation, not
          an exam. Sage is curious about what you’ve built and how you think.
        </p>
        <ul className="calm-list">
          <li>Thinking out loud is welcome. Pauses are completely fine.</li>
          <li>At some point you’ll look at a small code snippet together.</li>
          <li>Please keep your camera on, stay in a quiet space, and put your phone away.</li>
          <li>Captions are shown, and you can type if you’d prefer.</li>
        </ul>

        <form onSubmit={submit} className="form">
          <label>
            Your name
            <input
              required
              maxLength={80}
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              autoComplete="name"
            />
          </label>
          <label>
            Role you’re applying for
            <input
              required
              maxLength={80}
              value={profile.role}
              placeholder="e.g. Backend Engineer"
              onChange={(e) => setProfile({ ...profile, role: e.target.value })}
            />
          </label>
          <label>
            Your main area
            <select value={profile.domain} onChange={(e) => setProfile({ ...profile, domain: e.target.value })}>
              {domains.map((d) => (
                <option key={d.domain} value={d.domain}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" type="submit">
            Check my mic & camera
          </button>
        </form>
      </div>
    </main>
  )
}
