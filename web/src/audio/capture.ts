import { INPUT_SAMPLE_RATE } from '@skillx/shared'

// Runs on the audio thread: resamples the mic to 16 kHz and posts ~100 ms chunks.
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.target = options.processorOptions.target;
    this.ratio = sampleRate / this.target;
    this.chunk = new Float32Array(this.target / 10);
    this.filled = 0;
    this.pos = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    while (this.pos < input.length) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const next = i + 1 < input.length ? input[i + 1] : input[i];
      this.chunk[this.filled++] = input[i] + (next - input[i]) * frac;
      if (this.filled === this.chunk.length) {
        this.port.postMessage(this.chunk.slice());
        this.filled = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= input.length;
    return true;
  }
}
registerProcessor('skillx-capture', Capture);
`

export interface MicCapture {
  context: AudioContext
  analyser: AnalyserNode
  setMuted(muted: boolean): void
  stop(): void
}

/** Streams 16 kHz mono float chunks from the given mic stream. */
export async function startCapture(stream: MediaStream, onChunk: (samples: Float32Array) => void): Promise<MicCapture> {
  const context = new AudioContext()
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
  await context.audioWorklet.addModule(url)
  URL.revokeObjectURL(url)

  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 512
  const node = new AudioWorkletNode(context, 'skillx-capture', {
    processorOptions: { target: INPUT_SAMPLE_RATE },
  })
  let muted = false
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    if (!muted) onChunk(e.data)
  }
  source.connect(analyser)
  source.connect(node)

  return {
    context,
    analyser,
    setMuted(value) {
      muted = value
    },
    stop() {
      node.port.onmessage = null
      source.disconnect()
      node.disconnect()
      void context.close()
    },
  }
}
