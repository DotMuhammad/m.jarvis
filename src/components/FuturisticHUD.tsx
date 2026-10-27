import React, { useState } from 'react';
import { AssistantState, VoiceSettings, TelemetryData, ChatMessage } from '../types';
import { JarvisCore } from './JarvisCore';
import { AudioVisualizerBar } from './AudioVisualizerBar';
import { ConversationDrawer } from './ConversationDrawer';
import { SettingsModal } from './SettingsModal';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sliders,
  History,
  Square,
  Sparkles,
  Cpu,
  Radio,
  Activity,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { soundFx } from '../utils/soundFx';

interface FuturisticHUDProps {
  state: AssistantState;
  settings: VoiceSettings;
  telemetry: TelemetryData;
  messages: ChatMessage[];
  interimTranscript: string;
  currentResponse: string;
  isMicActive: boolean;
  isMuted: boolean;
  errorMessage: string | null;
  onToggleListening: () => void;
  onSendMessage: (text: string) => void;
  onStopSpeaking: () => void;
  onToggleMute: () => void;
  onUpdateSettings: (settings: VoiceSettings) => void;
  onReplayAudio: (msg: ChatMessage) => void;
  onClearHistory: () => void;
  getVisualizerData: () => { frequency: Uint8Array; timeDomain: Uint8Array };
}

export const FuturisticHUD: React.FC<FuturisticHUDProps> = ({
  state,
  settings,
  telemetry,
  messages,
  interimTranscript,
  currentResponse,
  isMicActive,
  isMuted,
  errorMessage,
  onToggleListening,
  onSendMessage,
  onStopSpeaking,
  onToggleMute,
  onUpdateSettings,
  onReplayAudio,
  onClearHistory,
  getVisualizerData,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const suggestions = [
    'Run full diagnostics on core systems',
    'Summarize quantum computing breakthroughs',
    'Explain the physics of warp propulsion',
    'Brief me on today\'s schedule and markets',
    'Engage defense protocol Mark 85',
  ];

  return (
    <div className="min-h-screen bg-[#040714] text-slate-100 flex flex-col justify-between relative overflow-x-hidden">
      {/* Background Subtle Cyber Grid & Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:40px_40px] opacity-10 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(6,182,212,0.06),transparent_70%)] pointer-events-none" />

      {/* TOP BAR CONTRACT: 3 Zones strictly separated */}
      <header className="relative z-20 flex items-center justify-between gap-8 px-6 py-4 border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-md">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              state === 'error'
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-ping'
                : 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] animate-pulse'
            }`}
          />
          <span className="font-hud text-xl font-bold tracking-widest text-white uppercase whitespace-nowrap">
            J.A.R.V.I.S. OS
          </span>
        </div>

        {/* Zone 2: Clean single-line status navigation */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-hud uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Voice: {settings.voiceName}</span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Neural Core: {telemetry.neuralLoad}%</span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Latency: {telemetry.pingMs}ms</span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
            <span>Protocol: {state === 'error' ? 'ANOMALY' : 'NOMINAL'}</span>
          </span>
        </nav>

        {/* Zone 3: 1 primary action group */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              soundFx.playClick();
              setIsDrawerOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-hud uppercase tracking-wider text-cyan-300 border border-cyan-500/30 rounded hover:bg-cyan-500/10 transition-colors whitespace-nowrap shrink-0"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Telemetry Log</span>
          </button>
          <button
            onClick={() => {
              soundFx.playClick();
              setIsSettingsOpen(true);
            }}
            className="p-1.5 text-slate-300 hover:text-cyan-300 border border-slate-700/60 rounded hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
            title="System Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT: Central Core + Real-Time Spoken Interaction */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-3 max-w-6xl w-full mx-auto">
        {/* Error notification banner if error occurs */}
        {errorMessage && (
          <div className="w-full max-w-xl mb-3 p-3 rounded border border-rose-500/40 bg-rose-950/70 backdrop-blur-md flex items-center justify-between gap-3 text-rose-200 text-xs shadow-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={onToggleListening}
              className="flex items-center gap-1 px-3 py-1 bg-rose-900/80 hover:bg-rose-800 border border-rose-400/50 rounded font-hud font-semibold text-xs tracking-wider uppercase text-white transition-colors shrink-0"
            >
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Core Layout Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left HUD Telemetry Column */}
          <div className="hidden lg:flex lg:col-span-3 flex-col gap-4 text-xs font-hud">
            <div className="p-4 rounded border border-cyan-500/20 bg-slate-950/60 backdrop-blur-md shadow-lg space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-cyan-400 font-semibold tracking-wider uppercase">
                  Subsystem Telemetry
                </span>
                <span className="text-[10px] font-mono-code text-emerald-400">ONLINE</span>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Neural Core Load</span>
                  <span className="font-mono-code tabular-nums text-slate-200">{telemetry.neuralLoad}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-300"
                    style={{ width: `${telemetry.neuralLoad}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Processor Allocation</span>
                  <span className="font-mono-code tabular-nums text-slate-200">{telemetry.cpu}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${telemetry.cpu}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-1.5 text-[11px] font-mono-code text-slate-400">
                <div className="flex justify-between">
                  <span>Acoustic Link:</span>
                  <span className="text-cyan-300">48kHz Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Voice Synth:</span>
                  <span className="text-cyan-300">Gemini 3.8 Neural</span>
                </div>
                <div className="flex justify-between">
                  <span>Continuous Mode:</span>
                  <span className={settings.continuous ? 'text-emerald-400' : 'text-slate-400'}>
                    {settings.continuous ? 'ENABLED' : 'MANUAL'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded border border-cyan-500/20 bg-slate-950/60 backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold tracking-wider uppercase mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Suggested Directives</span>
              </div>
              <div className="space-y-1.5">
                {suggestions.slice(0, 3).map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      soundFx.playClick();
                      onSendMessage(sug);
                    }}
                    className="w-full text-left p-2 rounded bg-slate-900/40 hover:bg-cyan-950/40 border border-slate-800/80 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all text-[11px] font-sans"
                  >
                    "{sug}"
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Central AI Arc Reactor Core */}
          <div className="col-span-1 lg:col-span-6 flex flex-col items-center justify-center">
            <JarvisCore
              state={state}
              theme={settings.theme}
              isMicActive={isMicActive}
              getVisualizerData={getVisualizerData}
              onCoreClick={onToggleListening}
            />

            {/* LIVE SPOKEN TRANSCRIPT & RESPONSE DISPLAY */}
            <div className="w-full max-w-xl mt-2 px-4 py-3 rounded-lg border border-cyan-500/25 bg-slate-950/75 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.12)] min-h-[96px] flex flex-col justify-center text-center">
              {interimTranscript ? (
                <div className="animate-pulse">
                  <div className="text-[11px] font-hud uppercase tracking-wider text-cyan-400 font-semibold mb-1">
                    Hearing Spoken Input...
                  </div>
                  <p className="text-sm sm:text-base text-cyan-200 font-medium italic">
                    "{interimTranscript}"
                  </p>
                </div>
              ) : state === 'connecting' ? (
                <div>
                  <div className="text-[11px] font-hud uppercase tracking-wider text-amber-300 font-semibold mb-1">
                    Connecting Acoustic Stream
                  </div>
                  <p className="text-sm text-slate-300 font-mono-code">
                    Initializing microphone transducers...
                  </p>
                </div>
              ) : state === 'processing' ? (
                <div>
                  <div className="text-[11px] font-hud uppercase tracking-wider text-amber-400 font-semibold mb-1">
                    Neural Processing
                  </div>
                  <p className="text-sm text-slate-300 font-mono-code">
                    Formulating response via Gemini cognitive matrix...
                  </p>
                </div>
              ) : currentResponse ? (
                <div>
                  <div className="text-[11px] font-hud uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>J.A.R.V.I.S. Vocal Channel</span>
                  </div>
                  <p className="text-sm sm:text-base text-slate-100 font-normal leading-relaxed">
                    {currentResponse}
                  </p>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-slate-400">
                  Ready. Press the center core or microphone button to speak naturally.
                </p>
              )}
            </div>

            {/* PRIMARY VOICE CONTROL DOCK */}
            <div className="flex items-center gap-4 mt-5">
              {/* Mute Audio Output Toggle */}
              <button
                onClick={onToggleMute}
                className={`p-3 rounded-full border transition-all ${
                  isMuted
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                    : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500'
                }`}
                title={isMuted ? 'Unmute JARVIS Voice' : 'Mute JARVIS Voice'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* MAIN VOICE TRIGGER BUTTON */}
              <button
                onClick={onToggleListening}
                className={`relative group p-5 rounded-full border-2 transition-all duration-300 shadow-2xl ${
                  isMicActive
                    ? 'bg-cyan-500 border-white text-slate-950 scale-105 shadow-[0_0_35px_rgba(6,182,212,0.8)]'
                    : 'bg-slate-900/90 border-cyan-400/60 text-cyan-300 hover:border-cyan-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]'
                }`}
                aria-label={isMicActive ? 'Stop Listening' : 'Start Speaking to JARVIS'}
              >
                {isMicActive && (
                  <span className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-60 pointer-events-none" />
                )}
                {isMicActive ? <Mic className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>

              {/* Stop Speaking / Interrupt Audio */}
              {state === 'speaking' ? (
                <button
                  onClick={onStopSpeaking}
                  className="p-3 rounded-full border border-amber-500/50 bg-amber-950/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:bg-amber-900/60 transition-all"
                  title="Interrupt Spoken Audio"
                >
                  <Square className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onUpdateSettings({ ...settings, continuous: !settings.continuous });
                  }}
                  className={`p-3 rounded-full border transition-all ${
                    settings.continuous
                      ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:text-white'
                  }`}
                  title={settings.continuous ? 'Continuous Voice: ON' : 'Continuous Voice: OFF'}
                >
                  <Radio className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Voice Status Sub-label */}
            <div className="mt-2.5 flex items-center gap-2 text-xs font-mono-code text-slate-400">
              <span className="text-cyan-400">Mic Status:</span>
              <span>{isMicActive ? 'Vocal Capture Live (Speak now)' : 'Push to speak / Standby'}</span>
            </div>
          </div>

          {/* Right Column: Audio Directives & History Quick Peek */}
          <div className="hidden lg:flex lg:col-span-3 flex-col gap-4 text-xs font-hud">
            <div className="p-4 rounded border border-cyan-500/20 bg-slate-950/60 backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold tracking-wider uppercase mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tactical Directives</span>
              </div>
              <div className="space-y-1.5">
                {suggestions.slice(2).map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      soundFx.playClick();
                      onSendMessage(sug);
                    }}
                    className="w-full text-left p-2 rounded bg-slate-900/40 hover:bg-cyan-950/40 border border-slate-800/80 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all text-[11px] font-sans"
                  >
                    "{sug}"
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded border border-cyan-500/20 bg-slate-950/60 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                <span className="text-cyan-400 font-semibold tracking-wider uppercase">
                  Vocal History
                </span>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="text-[10px] text-cyan-300 hover:underline uppercase"
                >
                  View All ({messages.length})
                </button>
              </div>

              {messages.length > 0 ? (
                <div className="space-y-2">
                  {messages.slice(-2).map((m) => (
                    <div key={m.id} className="text-[11px]">
                      <span className="text-slate-500 font-mono-code">
                        {m.role === 'assistant' ? 'JARVIS:' : 'USER:'}
                      </span>{' '}
                      <span className="text-slate-300 line-clamp-2">{m.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">No voice logs in current session buffer.</p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Quick Directive Strip */}
        <div className="lg:hidden w-full flex items-center gap-2 overflow-x-auto py-2 mt-3 px-1 no-scrollbar">
          {suggestions.map((sug, idx) => (
            <button
              key={idx}
              onClick={() => {
                soundFx.playClick();
                onSendMessage(sug);
              }}
              className="whitespace-nowrap shrink-0 px-3 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/30 text-xs text-slate-300 hover:text-cyan-200 hover:border-cyan-400 transition-colors"
            >
              {sug}
            </button>
          ))}
        </div>
      </main>

      {/* FOOTER BAR: Audio Visualizer Bar Spectrum */}
      <footer className="relative z-20 px-6 py-3 border-t border-cyan-500/20 bg-slate-950/90 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto flex-1 max-w-xl">
          <AudioVisualizerBar
            state={state}
            theme={settings.theme}
            getVisualizerData={getVisualizerData}
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-hud text-slate-400 uppercase tracking-wider">
          <span className="hidden md:inline">Neural Synthesis: Gemini 3.8</span>
          <span className="text-slate-600">·</span>
          <span>Persona: {settings.voiceName}</span>
          <span className="text-slate-600">·</span>
          <span className="text-cyan-400 font-mono-code tabular-nums">48kHz</span>
        </div>
      </footer>

      {/* Drawers & Modals */}
      <ConversationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        messages={messages}
        onReplayAudio={onReplayAudio}
        onClearHistory={onClearHistory}
        theme={settings.theme}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />
    </div>
  );
};
