import type { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '@skillx/shared';
import { appendTranscript, finish, type AssessmentSession } from '../sessions/store.js';
import type { LiveModel, LiveModelFactory, LiveModelHandlers, ToolCall } from './model.js';
import { buildResumeContext, buildSystemInstruction } from './prompt.js';
import { codeCardView, runTool, type ToolEffects } from './tools.js';

const MAX_RECONNECTS = 3;
/** Give the goodbye audio time to play before closing the socket. */
const END_DELAY_MS = 4000;

const activeBridges = new Map<string, LiveBridge>();

/**
 * One bridge per connected browser. It owns the upstream model connection and
 * applies everything the model or the browser does to the persisted session.
 */
export class LiveBridge {
  private model?: LiveModel;
  private reconnects = 0;
  private reconnecting = false;
  private disposed = false;

  constructor(
    private readonly session: AssessmentSession,
    private readonly ws: WebSocket,
    private readonly connect: LiveModelFactory,
  ) {}

  static attach(session: AssessmentSession, ws: WebSocket, connect: LiveModelFactory): LiveBridge {
    // A newer tab or reconnect replaces the previous socket for the session.
    activeBridges.get(session.id)?.dispose('replaced by a new connection');
    const bridge = new LiveBridge(session, ws, connect);
    activeBridges.set(session.id, bridge);
    void bridge.start();
    return bridge;
  }

  private async start(): Promise<void> {
    const resumed = this.session.transcript.length > 0;
    this.ws.on('message', (raw) => this.onClientMessage(raw.toString()));
    this.ws.on('close', () => this.dispose('client disconnected'));

    try {
      await this.openModel();
    } catch (err) {
      this.send({ type: 'error', message: `Could not reach the voice model: ${(err as Error).message}` });
      this.ws.close(1011, 'model unavailable');
      return;
    }

    this.session.status = 'active';
    this.session.startedAt ??= new Date();
    this.session.lastSeenAt = new Date();

    this.send({
      type: 'ready',
      sessionId: this.session.id,
      resumed,
      mock: this.model?.kind === 'mock',
      phase: this.session.phase,
    });
    this.send({ type: 'skills', graph: this.session.skills.snapshot() });
    this.send({ type: 'code_card', card: codeCardView(this.session) });

    if (!resumed) {
      this.model?.sendText(
        `[system] ${this.session.candidate.name} has joined and their microphone is working. Start with the introduction.`,
      );
    }
  }

  private async openModel(): Promise<void> {
    const handle = this.session.resumptionHandle;
    this.model = await this.connect(
      { systemInstruction: buildSystemInstruction(this.session), resumptionHandle: handle },
      this.modelHandlers(),
    );
    // Without a handle the new model session has no memory, so re-seed it from our own copy of the conversation.
    if (!handle && this.session.transcript.length > 0) {
      this.model.sendText(buildResumeContext(this.session));
    }
  }

  private async reconnect(reason: string): Promise<void> {
    if (this.disposed || this.reconnecting || this.isFinished()) return;
    if (this.reconnects >= MAX_RECONNECTS) {
      this.send({ type: 'error', message: `Voice connection lost (${reason}). Please refresh to resume.` });
      return;
    }
    this.reconnecting = true;
    this.reconnects += 1;
    try {
      this.model?.close();
      await this.openModel();
      console.info(`[bridge ${this.session.id}] reconnected to model (${reason})`);
    } catch (err) {
      console.warn(`[bridge ${this.session.id}] reconnect failed`, err);
      this.reconnecting = false;
      setTimeout(() => void this.reconnect(reason), 1000 * this.reconnects);
      return;
    }
    this.reconnecting = false;
  }

  private modelHandlers(): LiveModelHandlers {
    return {
      onAudio: (data) => this.send({ type: 'audio', data }),
      onAiTranscript: (text) => {
        appendTranscript(this.session, 'ai', text);
        this.send({ type: 'transcript', role: 'ai', text });
      },
      onCandidateTranscript: (text) => {
        appendTranscript(this.session, 'candidate', text);
        this.send({ type: 'transcript', role: 'candidate', text });
      },
      onTurnComplete: () => this.send({ type: 'turn_complete' }),
      onInterrupted: () => this.send({ type: 'interrupted' }),
      onToolCalls: (calls) => this.handleToolCalls(calls),
      onResumptionHandle: (handle) => {
        this.session.resumptionHandle = handle;
      },
      onGoAway: () => void this.reconnect('server go-away'),
      onClose: (reason) => {
        if (!this.disposed && !this.isFinished()) void this.reconnect(reason);
      },
      onError: (error) => console.warn(`[bridge ${this.session.id}] model error`, error.message),
    };
  }

  private handleToolCalls(calls: ToolCall[]): void {
    const effects: ToolEffects = {};
    const responses = calls.map((call) => {
      const result = runTool(this.session, call.name, call.args);
      Object.assign(effects, Object.fromEntries(Object.entries(result.effects).filter(([, v]) => v)));
      return { id: call.id, name: call.name, response: result.response };
    });
    this.model?.sendToolResponses(responses);

    if (effects.skillsChanged) this.send({ type: 'skills', graph: this.session.skills.snapshot() });
    if (effects.phaseChanged) this.send({ type: 'phase', phase: this.session.phase });
    if (effects.codeCardChanged) this.send({ type: 'code_card', card: codeCardView(this.session) });
    if (effects.end) setTimeout(() => this.end('completed'), END_DELAY_MS);
  }

  private onClientMessage(raw: string): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    if (this.isFinished()) return;
    this.session.lastSeenAt = new Date();

    switch (msg.type) {
      case 'audio':
        if (typeof msg.data === 'string') this.model?.sendAudio(msg.data);
        break;
      case 'audio_end':
        this.model?.audioStreamEnd();
        break;
      case 'text': {
        const text = String(msg.text ?? '').slice(0, 2000).trim();
        if (!text) break;
        appendTranscript(this.session, 'candidate', text);
        this.send({ type: 'transcript', role: 'candidate', text });
        this.model?.sendText(text);
        break;
      }
      case 'integrity': {
        const decision = this.session.integrity.evaluate(msg.event);
        if (decision.verdict === 'warning') {
          this.send({
            type: 'warning',
            message: decision.message ?? '',
            violations: decision.violations,
            maxViolations: this.session.integrity.maxViolations,
          });
          this.model?.sendText(`[system] Integrity reminder, say this kindly in your own words: ${decision.message}`);
        } else if (decision.verdict === 'terminate') {
          appendTranscript(this.session, 'system', `Session ended after repeated integrity flags (${msg.event.type}).`);
          this.end('terminated', 'The session was ended after repeated integrity warnings.');
        }
        break;
      }
      case 'affect': {
        const state = this.session.affect.push(msg.sample);
        if (state.shouldReassure) {
          this.model?.sendText(
            '[system] The candidate sounds nervous (faster speech, higher pitch). At a natural moment, gently reassure them.',
          );
        }
        break;
      }
      case 'end':
        this.end('completed', 'Candidate ended the session.');
        break;
    }
  }

  private end(status: 'completed' | 'terminated', reason?: string): void {
    if (this.isFinished()) return;
    finish(this.session, status, reason);
    if (status === 'terminated') this.send({ type: 'terminated', reason: reason ?? 'Session ended.' });
    this.send({ type: 'ended', sessionId: this.session.id });
    this.dispose('session finished');
    this.ws.close(1000, 'session finished');
  }

  dispose(reason: string): void {
    if (this.disposed) return;
    this.disposed = true;
    this.model?.close();
    if (activeBridges.get(this.session.id) === this) activeBridges.delete(this.session.id);
    if (this.session.status === 'active') this.session.status = 'paused';
    this.session.lastSeenAt = new Date();
    if (this.ws.readyState === this.ws.OPEN && reason === 'replaced by a new connection') {
      this.ws.close(4000, reason);
    }
  }

  private isFinished(): boolean {
    return this.session.status === 'completed' || this.session.status === 'terminated';
  }

  private send(msg: ServerMessage): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
