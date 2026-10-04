import { useEffect, useRef, useState } from 'react'
import { level } from '../audio/player'

interface Props {
  onReady: (stream: MediaStream) => void
  onBack: () => void
  busy: boolean
  error: string | null
}

type Check = 'pending' | 'ok' | 'failed'

export function HardwareCheck({ onReady, onBack, busy, error }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const meterRef = useRef<HTMLDivElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [camera, setCamera] = useState<Check>('pending')
  const [mic, setMic] = useState<Check>('pending')
  const [heard, setHeard] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const handedOff = useRef(false)

  useEffect(() => {
    let active: MediaStream | null = null
    navigator.mediaDevices
      .getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: 640, height: 480, facingMode: 'user' },
      })
      .then((s) => {
        active = s
        setStream(s)
        setCamera(s.getVideoTracks().length ? 'ok' : 'failed')
        setMic(s.getAudioTracks().length ? 'ok' : 'failed')
      })
      .catch((err: Error) => {
        setPermissionError(
          err.name === 'NotAllowedError'
            ? 'Camera or microphone access was blocked. Please allow both in your browser’s address bar, then try again.'
            : `We couldn’t start your camera or microphone (${err.message}).`,
        )
        setCamera('failed')
        setMic('failed')
      })
    return () => {
      // Keep the tracks running if they were handed to the session.
      if (!handedOff.current) active?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream])

  // Live mic meter so the candidate can see they are being heard.
  useEffect(() => {
    if (!stream) return
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const v = Math.min(1, level(analyser) * 10)
      meterRef.current?.style.setProperty('--level', v.toFixed(3))
      if (v > 0.25) setHeard(true)
    }
    loop()
    return () => {
      cancelAnimationFrame(raf)
      void ctx.close()
    }
  }, [stream])

  const ready = camera === 'ok' && mic === 'ok' && heard

  return (
    <main className="screen narrow">
      <div className="card">
        <p className="eyebrow">Quick check</p>
        <h1>Can we see and hear you?</h1>
        <div className="hw-grid">
          <div className="preview">
            <video ref={videoRef} autoPlay playsInline muted />
            {camera !== 'ok' && <div className="preview-empty">Camera preview</div>}
          </div>
          <div className="checks">
            <CheckRow label="Camera" state={camera} />
            <CheckRow label="Microphone" state={mic} />
            <div className="meter-wrap">
              <span className="muted">Say “hello” to test your mic</span>
              <div className="meter" ref={meterRef}>
                <div className="meter-fill" />
              </div>
              <CheckRow label="We can hear you" state={heard ? 'ok' : 'pending'} />
            </div>
          </div>
        </div>
        {(permissionError || error) && <p className="error">{permissionError ?? error}</p>}
        <div className="actions">
          <button className="btn btn-quiet" onClick={onBack}>
            Back
          </button>
          <button
            className="btn btn-primary"
            disabled={!ready || busy}
            onClick={() => {
              if (!stream) return
              handedOff.current = true
              onReady(stream)
            }}
          >
            {busy ? 'Starting…' : 'Start the conversation'}
          </button>
        </div>
      </div>
    </main>
  )
}

function CheckRow({ label, state }: { label: string; state: Check }) {
  return (
    <div className={`check check-${state}`}>
      <span className="dot" aria-hidden="true" />
      {label}
      <span className="sr-only">: {state}</span>
    </div>
  )
}
