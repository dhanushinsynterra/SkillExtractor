/**
 * Audio I/O for the live interview.
 * - MicStreamer: microphone → 16 kHz mono PCM16 chunks (~100 ms each).
 * - Player: 24 kHz mono PCM16 chunks from Gemini → gapless playback, with
 *   instant flush when the candidate interrupts.
 */

const WORKLET = `
class Pcm16Downsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.pos = 0;
    this.buf = new Int16Array(1600);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (; this.pos < ch.length; this.pos += this.ratio) {
      const s = Math.max(-1, Math.min(1, ch[Math.floor(this.pos)]));
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) {
        this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
        this.buf = new Int16Array(1600);
        this.n = 0;
      }
    }
    this.pos -= ch.length;
    return true;
  }
}
registerProcessor('pcm16-downsampler', Pcm16Downsampler);
`;

export class MicStreamer {
  private ctx?: AudioContext;
  private node?: AudioWorkletNode;
  private src?: MediaStreamAudioSourceNode;

  constructor(private onChunk: (pcm: ArrayBuffer) => void) {}

  async start(stream: MediaStream): Promise<AnalyserNode> {
    this.ctx = new AudioContext();
    // Created after an await, so the browser may start it suspended.
    await this.ctx.resume().catch(() => {});
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    this.src = this.ctx.createMediaStreamSource(stream);
    this.node = new AudioWorkletNode(this.ctx, 'pcm16-downsampler');
    this.node.port.onmessage = (e) => this.onChunk(e.data as ArrayBuffer);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 1024;
    this.src.connect(this.node);
    this.src.connect(analyser);
    // The worklet must be connected to the graph to run; route it to a muted gain.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.node.connect(sink).connect(this.ctx.destination);
    return analyser;
  }

  stop() {
    this.src?.disconnect();
    this.node?.disconnect();
    void this.ctx?.close();
  }
}

export class Player {
  private ctx = new AudioContext({ sampleRate: 24000 });
  private next = 0;
  private sources = new Set<AudioBufferSourceNode>();
  readonly analyser: AnalyserNode;
  private out: GainNode;

  constructor() {
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.out = this.ctx.createGain();
    this.out.connect(this.analyser).connect(this.ctx.destination);
  }

  resume() {
    return this.ctx.resume();
  }

  set volume(v: number) {
    this.out.gain.value = v;
  }

  play(pcm: ArrayBuffer) {
    const i16 = new Int16Array(pcm);
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x8000;
    const buf = this.ctx.createBuffer(1, f32.length, 24000);
    buf.copyToChannel(f32, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.out);
    const at = Math.max(this.ctx.currentTime + 0.03, this.next);
    src.start(at);
    this.next = at + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** False if the browser blocked audio output (autoplay policy). */
  get running() {
    return this.ctx.state === 'running';
  }

  /** True while audio plays and for a short tail after (room echo decays). */
  get busy() {
    return this.running && this.next + 0.6 > this.ctx.currentTime;
  }

  /** True while queued audio is still playing. */
  get playing() {
    return this.running && this.next > this.ctx.currentTime + 0.02;
  }

  private rmsBuf = new Float32Array(1024);

  /** Current output level (RMS, 0..1), used to estimate speaker echo. */
  rms() {
    this.analyser.getFloatTimeDomainData(this.rmsBuf);
    let sum = 0;
    for (const v of this.rmsBuf) sum += v * v;
    return Math.sqrt(sum / this.rmsBuf.length);
  }

  flush() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.next = 0;
  }

  close() {
    this.flush();
    void this.ctx.close();
  }
}

/** RMS level 0..1 from an analyser. */
export function levelOf(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.min(1, Math.sqrt(sum / buf.length) * 6);
}

/** A short two-note chime for the speaker test. */
export async function chime() {
  const ctx = new AudioContext();
  const t = ctx.currentTime;
  [660, 880].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f;
    o.type = 'sine';
    g.gain.setValueAtTime(0, t + i * 0.18);
    g.gain.linearRampToValueAtTime(0.18, t + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start(t + i * 0.18);
    o.stop(t + i * 0.18 + 0.55);
  });
  await new Promise((r) => setTimeout(r, 800));
  await ctx.close();
}
