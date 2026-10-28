export type AssistantState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export type VoicePersona = 'Kore' | 'Fenrir' | 'Zephyr' | 'Puck' | 'Charon';

export type HudTheme = 'stark-cyan' | 'arc-gold' | 'quantum-emerald' | 'crimson-tactical';

export type LanguageMode = 'auto' | 'ur-PK' | 'en-US';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  romanText?: string;
  language?: 'urdu' | 'roman_urdu' | 'english' | 'auto';
  timestamp: string;
  audioData?: string | null;
  duration?: string;
}

export interface VoiceSettings {
  voiceName: VoicePersona;
  languageMode: LanguageMode;
  continuous: boolean;
  soundFx: boolean;
  autoSpeak: boolean;
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
