import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { config } from '../config.js';
import type { ConnectOptions, LiveModel, LiveModelHandlers, ToolResponse } from './model.js';
import { TOOL_DECLARATIONS } from './tools.js';

let client: GoogleGenAI | undefined;

function ai(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
}

/**
 * Opens a Gemini Live session. The API key never leaves the server: the
 * browser talks to our WebSocket and we relay audio/text both ways.
 */
export async function connectGemini(options: ConnectOptions, handlers: LiveModelHandlers): Promise<LiveModel> {
  let closed = false;

  const session: Session = await ai().live.connect({
    model: config.liveModel,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: options.systemInstruction,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Always ask for resumption handles so a dropped connection can pick up where it left off.
      sessionResumption: { handle: options.resumptionHandle },
      contextWindowCompression: { slidingWindow: {} },
    },
    callbacks: {
      onmessage: (msg: LiveServerMessage) => handleMessage(msg, handlers),
      onerror: (e: ErrorEvent) => handlers.onError(new Error(e.message || 'Live API error')),
      onclose: (e: CloseEvent) => {
        if (closed) return;
        closed = true;
        handlers.onClose(e.reason || `closed (${e.code})`);
      },
    },
  });

  return {
    kind: 'gemini',
    sendAudio(data) {
      if (!closed) session.sendRealtimeInput({ audio: { data, mimeType: 'audio/pcm;rate=16000' } });
    },
    audioStreamEnd() {
      if (!closed) session.sendRealtimeInput({ audioStreamEnd: true });
    },
    sendText(text) {
      if (!closed) session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
    },
    sendToolResponses(responses: ToolResponse[]) {
      if (!closed) session.sendToolResponse({ functionResponses: responses });
    },
    close() {
      if (closed) return;
      closed = true;
      session.close();
    },
  };
}

function handleMessage(msg: LiveServerMessage, h: LiveModelHandlers): void {
  const content = msg.serverContent;
  if (content) {
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/')) h.onAudio(part.inlineData.data);
    }
    if (content.outputTranscription?.text) h.onAiTranscript(content.outputTranscription.text);
    if (content.inputTranscription?.text) h.onCandidateTranscript(content.inputTranscription.text);
    if (content.interrupted) h.onInterrupted();
    if (content.turnComplete) h.onTurnComplete();
  }

  if (msg.toolCall?.functionCalls?.length) {
    h.onToolCalls(
      msg.toolCall.functionCalls.map((c) => ({
        id: c.id ?? '',
        name: c.name ?? '',
        args: (c.args ?? {}) as Record<string, unknown>,
      })),
    );
  }

  const resumption = msg.sessionResumptionUpdate;
  if (resumption?.resumable && resumption.newHandle) h.onResumptionHandle(resumption.newHandle);

  if (msg.goAway) h.onGoAway(msg.goAway.timeLeft);
}
