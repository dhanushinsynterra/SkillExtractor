import { Modality, type LiveServerMessage, type Session, type FunctionCall } from '@google/genai';
import type { WebSocket } from 'ws';
import type { ClientMessage, IntegrityKind, Phase, ServerMessage, SessionRecord, SkillEvidence } from '../../shared/types';
import { applyEdit, newCard, numbered } from './codecards';
import { systemPrompt, TOOLS } from './prompt';
import { generateReport } from './report';
import { client, friendlyError, settings } from './settings';
import { persist } from './store';

/**
 * One live interview: bridges the candidate's browser WebSocket to a Gemini
 * Live session, records the transcript, executes the model's tool calls and
 * relays proctoring signals. Survives short browser disconnects.
 */

const RECONNECT_GRACE_MS = 90_000;
const ABSENT_LIMIT_MS = 120_000;
const END_AFTER_WRAPUP_MS = 10_000;

const PHASES: Phase[] = ['hello', 'ice_breaker', 'domain', 'problem', 'code_card', 'wrap_up'];

const NOTICES: Partial<Record<IntegrityKind, string>> = {
  absent:
    '[Proctoring notice] The candidate is no longer visible on camera. Stop the current question, and politely ask whether they are still there and can return to the camera. Do not continue the interview until they are back.',
  returned: '[Proctoring notice] The candidate is visible on camera again. Briefly welcome them back and continue where you left off.',
  multiple_faces:
    '[Proctoring notice] More than one person appears to be visible on camera. Politely remind the candidate that the interview must be completed on their own, then continue.',
  tab_hidden:
    '[Proctoring notice] The candidate switched away from the interview window. Gently ask them to keep the interview window in focus, then continue.',
};

const live = new Map<string, LiveInterview>();

export function attach(ws: WebSocket, record: SessionRecord) {
  const existing = live.get(record.id);
  if (existing) return existing.attach(ws, true);
  if (record.status !== 'created') {
    send(ws, { type: 'error', message: 'This interview has already finished.' });
    ws.close(4001, 'finished');
    return;
  }
  const li = new LiveInterview(record);
  live.set(record.id, li);
  li.attach(ws, false);
}

export function activeCount() {
  return live.size;
}

function send(ws: WebSocket | undefined, msg: ServerMessage) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

class LiveInterview {
  private session?: Session;
  private ws?: WebSocket;
  private started = false;
  private ended = false;
  private t0 = 0;
  private aiBuf = '';
  private userBuf = '';
  private endRequested = false;
  private graceTimer?: NodeJS.Timeout;
  private absentTimer?: NodeJS.Timeout;
  private endTimer?: NodeJS.Timeout;
  private ping?: NodeJS.Timeout;

  constructor(private record: SessionRecord) {}

  private get elapsed() {
    return this.t0 ? Date.now() - this.t0 : 0;
  }

  attach(ws: WebSocket, resumed: boolean) {
    clearTimeout(this.graceTimer);
    if (this.ws && this.ws !== ws) this.ws.close(4002, 'replaced');
    this.ws = ws;

    clearInterval(this.ping);
    this.ping = setInterval(() => ws.readyState === ws.OPEN && ws.ping(), 25_000);

    ws.on('message', (data, isBinary) => {
      if (isBinary) this.onAudio(data as Buffer);
      else {
        try {
          this.onClient(JSON.parse(String(data)) as ClientMessage);
        } catch (e) {
          console.warn('Bad client message', e);
        }
      }
    });
    ws.on('close', () => this.detach(ws));

    if (resumed && this.started) {
      this.integrity('reconnect', 'Connection dropped and was restored.', 'info', false);
      send(ws, this.readyMessage(true));
    }
  }

  private readyMessage(resumed: boolean): ServerMessage {
    return { type: 'ready', resumed, phase: this.record.phase, transcript: this.record.transcript, code: this.record.code ?? null };
  }

  private detach(ws: WebSocket) {
    if (this.ws !== ws) return;
    this.ws = undefined;
    clearInterval(this.ping);
    if (this.ended) return;
    if (!this.started) {
      live.delete(this.record.id);
      return;
    }
    this.graceTimer = setTimeout(() => this.finish('abandoned'), RECONNECT_GRACE_MS);
  }

  // ---------------------------------------------------------------------------
  // Browser → server
  // ---------------------------------------------------------------------------

  private onClient(msg: ClientMessage) {
    switch (msg.type) {
      case 'start':
        void this.start();
        break;
      case 'text':
        if (!this.session || !msg.text.trim()) return;
        this.flushAi();
        this.pushTurn('candidate', msg.text.trim());
        this.session.sendRealtimeInput({ text: msg.text.trim() });
        break;
      case 'mic':
        if (!msg.on) this.session?.sendRealtimeInput({ audioStreamEnd: true });
        break;
      case 'integrity':
        this.onIntegrity(msg.kind, msg.note);
        break;
      case 'end':
        this.finish('ended_by_candidate');
        break;
    }
  }

  private onAudio(buf: Buffer) {
    if (!this.session || this.ended) return;
    this.session.sendRealtimeInput({ audio: { data: buf.toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
  }

  private async start() {
    if (this.started) {
      send(this.ws, this.readyMessage(true));
      return;
    }
    this.started = true;
    const { liveModel, voice } = settings();
    try {
      this.session = await client().live.connect({
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemPrompt(this.record.candidate),
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: TOOLS }],
          contextWindowCompression: { slidingWindow: {} },
        },
        callbacks: {
          onmessage: (m) => this.onGemini(m),
          onerror: (e) => console.error(`[${this.record.id}] Gemini error`, e),
          onclose: (e) => {
            if (this.ended) return;
            console.warn(`[${this.record.id}] Gemini closed: ${e.code} ${e.reason}`);
            send(this.ws, { type: 'error', message: `The voice service disconnected (${e.reason || e.code}).` });
            this.finish('abandoned');
          },
        },
      });
    } catch (e) {
      console.error(`[${this.record.id}] Could not connect to Gemini Live`, e);
      this.started = false;
      send(this.ws, { type: 'error', message: `Could not connect to the voice service: ${friendlyError(e)}` });
      return;
    }

    this.t0 = Date.now();
    this.record.status = 'active';
    this.record.startedAt = new Date().toISOString();
    persist(this.record.id);
    send(this.ws, this.readyMessage(false));
    this.session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text: '[Session start] The candidate is connected. Begin the interview now.' }] }],
      turnComplete: true,
    });
  }

  private onIntegrity(kind: IntegrityKind, note: string) {
    const warn = kind === 'absent' || kind === 'multiple_faces' || kind === 'tab_hidden';
    this.integrity(kind, note, warn ? 'warn' : 'info', true);

    if (kind === 'absent') {
      clearTimeout(this.absentTimer);
      this.absentTimer = setTimeout(() => {
        this.integrity('absent', 'Candidate was away from the camera for over 2 minutes. Interview ended.', 'warn', false);
        this.finish('terminated');
      }, ABSENT_LIMIT_MS);
    } else if (kind === 'returned') {
      clearTimeout(this.absentTimer);
    }
  }

  private integrity(kind: IntegrityKind, note: string, severity: 'info' | 'warn', notifyModel: boolean) {
    this.record.integrity.push({ kind, note, severity, at: this.elapsed });
    persist(this.record.id);
    const notice = NOTICES[kind];
    if (notifyModel && notice && this.session && !this.ended) {
      this.session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: notice }] }], turnComplete: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Gemini → server
  // ---------------------------------------------------------------------------

  private onGemini(m: LiveServerMessage) {
    const c = m.serverContent;
    if (c) {
      for (const part of c.modelTurn?.parts ?? []) {
        const data = part.inlineData?.data;
        if (data && this.ws?.readyState === this.ws?.OPEN) this.ws?.send(Buffer.from(data, 'base64'));
      }
      if (c.inputTranscription?.text) {
        this.flushAi();
        this.userBuf += c.inputTranscription.text;
        send(this.ws, { type: 'transcript', who: 'candidate', delta: c.inputTranscription.text });
      }
      if (c.outputTranscription?.text) {
        this.flushUser();
        this.aiBuf += c.outputTranscription.text;
        send(this.ws, { type: 'transcript', who: 'ai', delta: c.outputTranscription.text });
      }
      if (c.interrupted) {
        this.flushAi();
        send(this.ws, { type: 'interrupted' });
      }
      if (c.turnComplete) {
        this.flushUser();
        this.flushAi();
        send(this.ws, { type: 'turn_complete' });
        if (this.endRequested) {
          clearTimeout(this.endTimer);
          this.endTimer = setTimeout(() => this.finish('completed'), 1500);
        }
      }
    }
    if (m.toolCall?.functionCalls?.length) this.onTools(m.toolCall.functionCalls);
    if (m.goAway) console.warn(`[${this.record.id}] Gemini goAway, time left ${m.goAway.timeLeft}`);
  }

  private flushUser() {
    const t = this.userBuf.trim();
    this.userBuf = '';
    if (t) this.pushTurn('candidate', t);
  }

  private flushAi() {
    const t = this.aiBuf.trim();
    this.aiBuf = '';
    if (t) this.pushTurn('ai', t);
  }

  private pushTurn(who: 'ai' | 'candidate', text: string) {
    this.record.transcript.push({ who, text, at: this.elapsed });
    persist(this.record.id);
  }

  private onTools(calls: FunctionCall[]) {
    const responses = calls.map((fc) => {
      const args = (fc.args ?? {}) as Record<string, unknown>;
      let response: Record<string, unknown> = { ok: true };
      switch (fc.name) {
        case 'set_phase': {
          const phase = String(args.phase) as Phase;
          if (PHASES.includes(phase)) {
            this.record.phase = phase;
            send(this.ws, { type: 'phase', phase });
          }
          break;
        }
        case 'record_skill': {
          const ev: SkillEvidence = {
            skill: String(args.skill ?? '').slice(0, 80),
            kind: (['core', 'related', 'tool'].includes(String(args.kind)) ? args.kind : 'related') as SkillEvidence['kind'],
            depth: Math.min(4, Math.max(0, Math.round(Number(args.depth) || 0))) as SkillEvidence['depth'],
            evidence: String(args.evidence ?? '').slice(0, 400),
            at: this.elapsed,
          };
          if (ev.skill) this.record.evidence.push(ev);
          break;
        }
        case 'show_code_card': {
          if (!this.record.code) this.record.code = { ...newCard(this.record.candidate.track), startedAt: this.elapsed };
          this.record.phase = 'code_card';
          send(this.ws, { type: 'phase', phase: 'code_card' });
          send(this.ws, { type: 'code', code: this.record.code });
          response = { code: numbered(this.record.code) };
          break;
        }
        case 'apply_code_edit': {
          const code = this.record.code;
          if (!code) {
            response = { ok: false, error: 'Call show_code_card first.' };
            break;
          }
          const err = applyEdit(this.record.candidate.track, code, Number(args.line), String(args.new_text ?? ''));
          if (err) {
            response = { ok: false, error: err };
            break;
          }
          if (code.solved && !code.solvedAt) code.solvedAt = this.elapsed;
          send(this.ws, { type: 'code', code });
          response = { ok: true, solved: code.solved, attempts: code.attempts, code: numbered(code) };
          break;
        }
        case 'end_interview':
          this.endRequested = true;
          clearTimeout(this.endTimer);
          this.endTimer = setTimeout(() => this.finish('completed'), END_AFTER_WRAPUP_MS);
          break;
        default:
          response = { ok: false, error: `Unknown tool ${fc.name}` };
      }
      persist(this.record.id);
      return { id: fc.id, name: fc.name, response };
    });
    this.session?.sendToolResponse({ functionResponses: responses });
  }

  // ---------------------------------------------------------------------------

  private finish(reason: 'completed' | 'ended_by_candidate' | 'terminated' | 'abandoned') {
    if (this.ended) return;
    this.ended = true;
    [this.graceTimer, this.absentTimer, this.endTimer].forEach((t) => clearTimeout(t));
    clearInterval(this.ping);
    this.flushUser();
    this.flushAi();

    this.record.status = reason === 'terminated' ? 'terminated' : reason === 'abandoned' ? 'abandoned' : 'completed';
    this.record.endedAt = new Date().toISOString();
    persist(this.record.id, true);

    if (reason !== 'abandoned') send(this.ws, { type: 'ended', reason });
    try {
      this.session?.close();
    } catch {
      /* already closed */
    }
    const ws = this.ws;
    setTimeout(() => ws?.close(1000, 'ended'), 500);
    live.delete(this.record.id);
    void generateReport(this.record);
  }
}
