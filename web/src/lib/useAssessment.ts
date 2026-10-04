import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AssessmentPhase,
  ClientMessage,
  CodeCardView,
  IntegrityEvent,
  ServerMessage,
  TranscriptEntry,
} from '@skillx/shared'
import { AffectAnalyzer } from '../audio/affect'
import { startCapture, type MicCapture } from '../audio/capture'
import { floatToPcm16Base64 } from '../audio/pcm'
import { AudioPlayer } from '../audio/player'
import { startProctor, watchVisibility, type Proctor } from '../proctor/vision'
import { socketUrl } from './api'

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'ended' | 'terminated' | 'error'

export interface Warning {
  message: string
  violations: number
  maxViolations: number
}

interface Options {
  sessionId: string
  token: string
  stream: MediaStream
  video: HTMLVideoElement | null
}

const MAX_RETRIES = 5

export function useAssessment({ sessionId, token, stream, video }: Options) {
  const [state, setState] = useState<ConnectionState>('connecting')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [phase, setPhase] = useState<AssessmentPhase>('introduction')
  const [codeCard, setCodeCard] = useState<CodeCardView | null>(null)
  const [warning, setWarning] = useState<Warning | null>(null)
  const [endReason, setEndReason] = useState<string | null>(null)
  const [mock, setMock] = useState(false)
  const [muted, setMuted] = useState(false)
  const [proctorReady, setProctorReady] = useState<boolean | null>(null)

  const ws = useRef<WebSocket | null>(null)
  const player = useRef<AudioPlayer | null>(null)
  const capture = useRef<MicCapture | null>(null)
  const finished = useRef(false)
  /** Speaker whose transcript fragments are still streaming in. */
  const openTurn = useRef<TranscriptEntry['role'] | null>(null)

  const send = useCallback((msg: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg))
  }, [])

  const reportIntegrity = useCallback((event: IntegrityEvent) => send({ type: 'integrity', event }), [send])

  // Socket with automatic resume after drops.
  useEffect(() => {
    let retries = 0
    let retryTimer: number | undefined
    let disposed = false
    player.current ??= new AudioPlayer()

    const append = (role: TranscriptEntry['role'], text: string) => {
      const continuing = openTurn.current === role
      openTurn.current = role
      setTranscript((prev) => {
        const last = prev.at(-1)
        if (continuing && last?.role === role) {
          const joined = /^[,.!?;:')\]]/.test(text) ? last.text + text : `${last.text} ${text}`
          return [...prev.slice(0, -1), { ...last, text: joined }]
        }
        return [...prev, { role, text, at: new Date().toISOString() }]
      })
    }

    const connect = () => {
      const socket = new WebSocket(socketUrl(sessionId, token))
      ws.current = socket

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as ServerMessage
        switch (msg.type) {
          case 'ready':
            retries = 0
            setState('live')
            setMock(msg.mock)
            setPhase(msg.phase)
            break
          case 'audio':
            player.current?.enqueue(msg.data)
            break
          case 'interrupted':
            player.current?.flush()
            break
          case 'transcript':
            append(msg.role, msg.text)
            break
          case 'turn_complete':
            openTurn.current = null
            break
          case 'phase':
            setPhase(msg.phase)
            break
          case 'code_card':
            setCodeCard(msg.card)
            break
          case 'warning':
            setWarning({ message: msg.message, violations: msg.violations, maxViolations: msg.maxViolations })
            break
          case 'terminated':
            finished.current = true
            setEndReason(msg.reason)
            setState('terminated')
            break
          case 'ended':
            finished.current = true
            setState((s) => (s === 'terminated' ? s : 'ended'))
            break
          case 'error':
            setEndReason(msg.message)
            break
          case 'skills':
            // Skill estimates are for reviewers only; the candidate UI does not show them.
            break
        }
      }

      socket.onclose = (event) => {
        if (disposed || finished.current) return
        if (event.code === 4000) return // replaced by another tab
        if (retries >= MAX_RETRIES) {
          setState('error')
          return
        }
        retries += 1
        setState('reconnecting')
        retryTimer = window.setTimeout(connect, Math.min(8000, 500 * 2 ** retries))
      }
    }

    connect()
    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      ws.current?.close()
    }
  }, [sessionId, token])

  // Microphone → server, plus acoustic affect analysis.
  useEffect(() => {
    let cancelled = false
    const analyzer = new AffectAnalyzer(
      (sample) => send({ type: 'affect', sample }),
      reportIntegrity,
    )
    void startCapture(stream, (chunk) => {
      send({ type: 'audio', data: floatToPcm16Base64(chunk) })
      // Skip analysis while the AI talks so residual echo does not skew the baseline.
      if (!player.current?.speaking) analyzer.push(chunk)
    }).then((c) => {
      if (cancelled) c.stop()
      else capture.current = c
    })
    return () => {
      cancelled = true
      capture.current?.stop()
      capture.current = null
    }
  }, [stream, send, reportIntegrity])

  // Webcam proctoring and tab visibility.
  useEffect(() => {
    if (!video) return
    let proctor: Proctor | undefined
    let cancelled = false
    const unwatch = watchVisibility(reportIntegrity)
    startProctor(video, reportIntegrity)
      .then((p) => {
        if (cancelled) p.stop()
        else {
          proctor = p
          setProctorReady(true)
        }
      })
      .catch((err) => {
        console.warn('Proctoring unavailable', err)
        setProctorReady(false)
      })
    return () => {
      cancelled = true
      unwatch()
      proctor?.stop()
    }
  }, [video, reportIntegrity])

  useEffect(() => () => player.current?.close(), [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      capture.current?.setMuted(!m)
      if (!m) send({ type: 'audio_end' })
      return !m
    })
  }, [send])

  const resumeAudio = useCallback(() => player.current?.resume(), [])
  const micAnalyser = useCallback(() => capture.current?.analyser ?? null, [])
  const aiAnalyser = useCallback(() => player.current?.analyser ?? null, [])

  return {
    state,
    transcript,
    phase,
    codeCard,
    warning,
    dismissWarning: () => setWarning(null),
    endReason,
    mock,
    muted,
    proctorReady,
    toggleMute,
    sendText: (text: string) => send({ type: 'text', text }),
    end: () => send({ type: 'end' }),
    resumeAudio,
    micAnalyser,
    aiAnalyser,
  }
}
