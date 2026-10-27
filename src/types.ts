export type AssistantState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export type VoicePersona = 'Fenrir' | 'Zephyr' | 'Puck' | 'Charon' | 'Kore';

export type HudTheme = 'stark-cyan' | 'arc-gold' | 'quantum-emerald' | 'crimson-tactical';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  audioData?: string | null;
  duration?: string;
}

export interface VoiceSettings {
  voiceName: VoicePersona;
  continuous: boolean;
  soundFx: boolean;
  wakeWordEnabled: boolean;
  theme: HudTheme;
  speechRate: number;
}

export interface TelemetryData {
  cpu: number;
  memoryMb: number;
  neuralLoad: number;
  frequencyHz: number;
  dbLevel: number;
  pingMs: number;
  protocol: string;
}
