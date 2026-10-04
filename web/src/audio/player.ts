import { OUTPUT_SAMPLE_RATE } from '@skillx/shared'
import { pcm16Base64ToFloat } from './pcm'

/** Gapless playback of the model's 24 kHz PCM stream, with barge-in support. */
export class AudioPlayer {
  readonly context = new AudioContext()
  readonly analyser: AnalyserNode
  private playhead = 0
  private sources = new Set<AudioBufferSourceNode>()

  constructor() {
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.connect(this.context.destination)
  }

  get speaking(): boolean {
    return this.sources.size > 0
  }

  async resume(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume()
  }

  enqueue(base64: string): void {
    const samples = pcm16Base64ToFloat(base64)
    if (!samples.length) return
    const buffer = this.context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE)
    buffer.copyToChannel(samples, 0)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.analyser)
    const now = this.context.currentTime
    // A small lead avoids clicks when the queue has run dry.
    this.playhead = Math.max(this.playhead, now + 0.05)
    source.start(this.playhead)
    this.playhead += buffer.duration
    this.sources.add(source)
    source.onended = () => this.sources.delete(source)
  }

  /** Called when the candidate interrupts: drop everything queued. */
  flush(): void {
    for (const s of this.sources) {
      try {
        s.stop()
      } catch {
        // already stopped
      }
    }
    this.sources.clear()
    this.playhead = 0
  }

  close(): void {
    this.flush()
    void this.context.close()
  }
}

export function level(analyser: AnalyserNode, buf = new Uint8Array(analyser.fftSize)): number {
  analyser.getByteTimeDomainData(buf)
  let sum = 0
  for (const v of buf) {
    const s = (v - 128) / 128
    sum += s * s
  }
  return Math.sqrt(sum / buf.length)
}
