import { useCallback, useEffect, useState } from 'react'
import type { AssessmentPhase } from '@skillx/shared'
import { CodeCard } from '../components/CodeCard'
import { Transcript } from '../components/Transcript'
import { VoiceOrb } from '../components/VoiceOrb'
import { useAssessment } from '../lib/useAssessment'

interface Props {
  sessionId: string
  token: string
  stream: MediaStream
  candidateName: string
  onFinished: (outcome: 'ended' | 'terminated', reason: string | null) => void
}

const PHASE_COPY: Record<AssessmentPhase, string> = {
  introduction: 'Saying hello',
  ice_breaker: 'Getting comfortable',
  domain_exploration: 'Talking about your work',
  collaborative_problem: 'Solving something together',
  code_card: 'Looking at some code',
  wrap_up: 'Wrapping up',
}

export function Session({ sessionId, token, stream, candidateName, onFinished }: Props) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const a = useAssessment({ sessionId, token, stream, video })
  const { resumeAudio } = a

  const attachVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) el.srcObject = stream
      setVideo(el)
    },
    [stream],
  )

  useEffect(() => {
    if (a.state === 'ended' || a.state === 'terminated') {
      const t = window.setTimeout(() => onFinished(a.state as 'ended' | 'terminated', a.endReason), 1500)
      return () => window.clearTimeout(t)
    }
  }, [a.state, a.endReason, onFinished])

  // Browsers keep audio suspended until a user gesture; the Start click usually counts, but be safe.
  useEffect(() => {
    const resume = () => void resumeAudio()
    resume()
    window.addEventListener('pointerdown', resume, { once: true })
    return () => window.removeEventListener('pointerdown', resume)
  }, [resumeAudio])

  return (
    <main className="screen session">
      <header className="session-bar">
        <span className="phase">{PHASE_COPY[a.phase]}</span>
        <StatusPill state={a.state} mock={a.mock} />
      </header>

      <div className="session-grid">
        <div className="stage card">
          <VoiceOrb mic={a.micAnalyser} ai={a.aiAnalyser} muted={a.muted} />
          <p className="stage-caption">
            {a.state === 'connecting' && 'Connecting you with Sage…'}
            {a.state === 'reconnecting' && 'Reconnecting, hang on a moment…'}
            {a.state === 'live' && (a.muted ? 'You’re muted' : 'Sage is listening')}
            {a.state === 'error' && 'We lost the connection. Refresh the page to pick up where you left off.'}
          </p>
          <div className="stage-controls">
            <button className="btn btn-quiet" onClick={a.toggleMute} aria-pressed={a.muted}>
              {a.muted ? 'Unmute' : 'Mute'}
            </button>
            <button
              className="btn btn-quiet"
              onClick={() => {
                if (confirm('End the conversation now?')) a.end()
              }}
            >
              End
            </button>
          </div>
          <div className="self-view">
            <video
              ref={attachVideo}
              autoPlay
              playsInline
              muted
            />
            {a.proctorReady === false && <span className="tiny muted">Camera checks unavailable</span>}
          </div>
        </div>

        <div className="side">
          {a.codeCard && <CodeCard card={a.codeCard} />}
          <Transcript
            entries={a.transcript}
            candidateName={candidateName}
            onSend={a.sendText}
            disabled={a.state !== 'live'}
          />
        </div>
      </div>

      {a.warning && (
        <div className="toast" role="status">
          <p>{a.warning.message}</p>
          <button className="btn btn-quiet" onClick={a.dismissWarning}>
            Got it
          </button>
        </div>
      )}
    </main>
  )
}

function StatusPill({ state, mock }: { state: string; mock: boolean }) {
  const label = state === 'live' ? 'Live' : state === 'reconnecting' ? 'Reconnecting' : state === 'error' ? 'Offline' : '…'
  return (
    <span className={`pill pill-${state}`}>
      {label}
      {mock && ' · demo mode'}
    </span>
  )
}
