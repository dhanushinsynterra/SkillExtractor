import { useCallback, useEffect, useState } from 'react'
import type { CandidateProfile } from '@skillx/shared'
import { api, sessionStorageGet, sessionStorageSet } from './lib/api'
import { Done } from './screens/Done'
import { HardwareCheck } from './screens/HardwareCheck'
import { Report } from './screens/Report'
import { ReviewerList } from './screens/Reviewer'
import { Session } from './screens/Session'
import { Welcome } from './screens/Welcome'

interface ActiveSession {
  sessionId: string
  token: string
  profile: CandidateProfile
}

type Step =
  | { name: 'welcome' }
  | { name: 'hardware'; profile: CandidateProfile; resume?: ActiveSession }
  | { name: 'session'; active: ActiveSession; stream: MediaStream }
  | { name: 'done'; outcome: 'ended' | 'terminated'; reason: string | null }

const STORAGE_KEY = 'activeSession'

function useHashRoute() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const onChange = () => setHash(location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

function savedSession(): ActiveSession | undefined {
  try {
    const raw = sessionStorageGet(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActiveSession) : undefined
  } catch {
    return undefined
  }
}

export default function App() {
  const hash = useHashRoute()
  const reportMatch = hash.match(/^#\/report\/([\w-]+)/)
  if (reportMatch) return <Report sessionId={reportMatch[1]} />
  if (hash.startsWith('#/review')) return <ReviewerList />
  return <CandidateFlow />
}

function CandidateFlow() {
  const [step, setStep] = useState<Step>(() => {
    // A refresh mid-conversation resumes the same session after a fresh hardware check.
    const saved = savedSession()
    return saved ? { name: 'hardware', profile: saved.profile, resume: saved } : { name: 'welcome' }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async (profile: CandidateProfile, resume: ActiveSession | undefined, stream: MediaStream) => {
    setBusy(true)
    setError(null)
    try {
      let active = resume
      if (!active) {
        const { sessionId, resumeToken } = await api.createSession(profile)
        active = { sessionId, token: resumeToken, profile }
      }
      sessionStorageSet(STORAGE_KEY, JSON.stringify(active))
      setStep({ name: 'session', active, stream })
    } catch (e) {
      setError((e as Error).message)
      stream.getTracks().forEach((t) => t.stop())
    } finally {
      setBusy(false)
    }
  }

  const finish = useCallback(
    (outcome: 'ended' | 'terminated', reason: string | null) => {
      sessionStorageSet(STORAGE_KEY, null)
      if (step.name === 'session') step.stream.getTracks().forEach((t) => t.stop())
      setStep({ name: 'done', outcome, reason })
    },
    [step],
  )

  switch (step.name) {
    case 'welcome':
      return <Welcome onContinue={(profile) => setStep({ name: 'hardware', profile })} />
    case 'hardware':
      return (
        <HardwareCheck
          busy={busy}
          error={error}
          onBack={() => {
            sessionStorageSet(STORAGE_KEY, null)
            setStep({ name: 'welcome' })
          }}
          onReady={(stream) => void start(step.profile, step.resume, stream)}
        />
      )
    case 'session':
      return (
        <Session
          sessionId={step.active.sessionId}
          token={step.active.token}
          stream={step.stream}
          candidateName={step.active.profile.name}
          onFinished={finish}
        />
      )
    case 'done':
      return <Done outcome={step.outcome} reason={step.reason} />
  }
}
