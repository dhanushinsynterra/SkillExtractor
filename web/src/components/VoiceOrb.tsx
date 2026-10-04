import { useEffect, useRef } from 'react'
import { level } from '../audio/player'

interface Props {
  mic: () => AnalyserNode | null
  ai: () => AnalyserNode | null
  muted: boolean
}

/** Soft orb that glows with the candidate's voice and ripples when the AI speaks. */
export function VoiceOrb({ mic, ai, muted }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const el = ref.current
      if (!el) return
      const m = mic()
      const a = ai()
      const micLevel = m && !muted ? Math.min(1, level(m) * 8) : 0
      const aiLevel = a ? Math.min(1, level(a) * 8) : 0
      el.style.setProperty('--mic', micLevel.toFixed(3))
      el.style.setProperty('--ai', aiLevel.toFixed(3))
      el.dataset.speaker = aiLevel > 0.05 ? 'ai' : micLevel > 0.08 ? 'candidate' : 'idle'
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [mic, ai, muted])

  return (
    <div className="orb" ref={ref} data-muted={muted} aria-hidden="true">
      <div className="orb-glow" />
      <div className="orb-core" />
    </div>
  )
}
