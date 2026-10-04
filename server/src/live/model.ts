export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResponse {
  id: string;
  name: string;
  response: Record<string, unknown>;
}

export interface LiveModelHandlers {
  onAudio(base64Pcm24k: string): void;
  onAiTranscript(text: string): void;
  onCandidateTranscript(text: string): void;
  onTurnComplete(): void;
  onInterrupted(): void;
  onToolCalls(calls: ToolCall[]): void;
  onResumptionHandle(handle: string): void;
  /** The service is about to drop the connection; the bridge should reconnect. */
  onGoAway(timeLeft?: string): void;
  onClose(reason: string): void;
  onError(error: Error): void;
}

/** A single upstream conversation with a realtime model. */
export interface LiveModel {
  readonly kind: 'gemini' | 'mock';
  sendAudio(base64Pcm16k: string): void;
  audioStreamEnd(): void;
  /** Text from the candidate (typed fallback) or a [system] note from the orchestrator. */
  sendText(text: string): void;
  sendToolResponses(responses: ToolResponse[]): void;
  close(): void;
}

export interface ConnectOptions {
  systemInstruction: string;
  resumptionHandle?: string;
}

export type LiveModelFactory = (options: ConnectOptions, handlers: LiveModelHandlers) => Promise<LiveModel>;
