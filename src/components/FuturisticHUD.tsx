import React, { useState, useRef, useEffect } from 'react';
import { AssistantState, VoiceSettings, TelemetryData, ChatMessage, LanguageMode } from '../types';
import { JarvisCore } from './JarvisCore';
import { AudioVisualizerBar } from './AudioVisualizerBar';
import { ConversationDrawer } from './ConversationDrawer';
import { SettingsModal } from './SettingsModal';
import {
  Mic,
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
  Send,
  CornerDownLeft,
  Globe,
  User,
  Bot,
} from 'lucide-react';
import { soundFx } from '../utils/soundFx';

interface FuturisticHUDProps {
  state: AssistantState;
  settings: VoiceSettings;
  telemetry: TelemetryData;
  messages: ChatMessage[];
  interimTranscript: string;
  lastUserQuery: string;
  currentResponse: string;
  currentRomanResponse: string;
  currentLanguage: 'urdu' | 'roman_urdu' | 'english';
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
  lastUserQuery,
  currentResponse,
  currentRomanResponse,
  currentLanguage,
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
  const [typedInput, setTypedInput] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Suggestions covering Urdu, Roman Urdu, and English
  const suggestions = [
    { text: 'Jarvis, kya haal hai?', tag: 'Roman Urdu' },
    { text: 'تمام سسٹمز کی رپورٹ دیں', tag: 'Urdu' },
    { text: 'Explain quantum computing simply', tag: 'English' },
    { text: 'What is the current status of the arc reactor?', tag: 'English' },
    { text: 'پروٹوکول مارک 85 فعال کریں', tag: 'Urdu' },
  ];

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = typedInput.trim();
    if (!query) return;
    soundFx.playClick();
    onSendMessage(query);
    setTypedInput('');
  };

  const handleLanguageChange = (mode: LanguageMode) => {
    soundFx.playClick();
    onUpdateSettings({ ...settings, languageMode: mode });
  };

  return (
    <div className="min-h-screen bg-[#040714] text-slate-100 flex flex-col justify-between relative overflow-x-hidden">
      {/* Background Subtle Cyber Grid & Ambient Radial Vignette */}
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
                : state === 'listening'
                ? 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.9)] animate-pulse'
                : state === 'speaking'
                ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse'
                : 'bg-cyan-400/80'
            }`}
          />
          <span className="font-hud text-xl font-bold tracking-widest text-white uppercase whitespace-nowrap">
            J.A.R.V.I.S. OS · Multilingual
          </span>
        </div>

        {/* Zone 2: Clean single-line status navigation */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-hud uppercase tracking-wider text-slate-400">
          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mode: {settings.languageMode === 'auto' ? 'Auto-Detect' : settings.languageMode === 'ur-PK' ? 'Urdu (ur-PK)' : 'English (en-US)'}</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Neural Load: {telemetry.neuralLoad}%</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Latency: {telemetry.pingMs}ms</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
            <span>Protocol: {state === 'error' ? 'ANOMALY' : 'NOMINAL'}</span>
          </div>
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
            <span className="hidden sm:inline">History Log ({messages.length})</span>
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

      {/* MAIN VIEWPORT */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-3 max-w-6xl w-full mx-auto">
        {/* Error notification banner */}
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
            {/* Subsystem Telemetry */}
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
                  <span>Processor Frequency</span>
                  <span className="font-mono-code tabular-nums text-slate-200">{telemetry.frequencyHz} Hz</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${(telemetry.frequencyHz / 800) * 100}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-1.5 text-[11px] font-mono-code text-slate-400">
                <div className="flex justify-between">
                  <span>Input Engine:</span>
                  <span className="text-cyan-300">Voice & Keyboard</span>
                </div>
                <div className="flex justify-between">
                  <span>Languages:</span>
                  <span className="text-cyan-300">Urdu · Roman · EN</span>
                </div>
                <div className="flex justify-between">
                  <span>Continuous Mode:</span>
                  <span className={settings.continuous ? 'text-emerald-400' : 'text-slate-400'}>
                    {settings.continuous ? 'ENABLED' : 'MANUAL'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Directive Suggestions */}
            <div className="p-4 rounded border border-cyan-500/20 bg-slate-950/60 backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold tracking-wider uppercase mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick Directives</span>
              </div>
              <div className="space-y-1.5">
                {suggestions.slice(0, 3).map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      soundFx.playClick();
                      onSendMessage(sug.text);
                    }}
                    className="w-full text-left p-2.5 rounded bg-slate-900/40 hover:bg-cyan-950/40 border border-slate-800/80 hover:border-cyan-500/40 text-slate-200 hover:text-white transition-all text-xs flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{sug.text}</span>
                    <span className="text-[10px] text-cyan-400/80 uppercase font-mono-code shrink-0">
                      {sug.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Central AI Arc Reactor Core & Spoken Interaction Centerpiece */}
          <div className="col-span-1 lg:col-span-6 flex flex-col items-center justify-center">
            <JarvisCore
              state={state}
              theme={settings.theme}
              isMicActive={isMicActive}
              getVisualizerData={getVisualizerData}
              onCoreClick={onToggleListening}
            />

            {/* DISPLAY RECOGNIZED QUESTION & ANSWER */}
            <div className="w-full max-w-xl mt-2 px-5 py-3.5 rounded-lg border border-cyan-500/25 bg-slate-950/85 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.14)] min-h-[110px] flex flex-col justify-center text-center">
              {/* If user is currently speaking or just spoke: show recognized question */}
              {interimTranscript ? (
                <div className="animate-pulse">
                  <div className="text-[11px] font-hud uppercase tracking-wider text-cyan-400 font-semibold mb-1 flex items-center justify-center gap-1">
                    <User className="w-3 h-3" />
                    <span>Listening to Voice Input...</span>
                  </div>
                  <p className="text-base sm:text-lg text-cyan-200 font-medium italic">
                    "{interimTranscript}"
                  </p>
                </div>
              ) : state === 'connecting' ? (
                <div>
                  <div className="text-[11px] font-hud uppercase tracking-wider text-amber-300 font-semibold mb-1">
                    Connecting Audio Stream
                  </div>
                  <p className="text-sm text-slate-300 font-mono-code">
                    Initializing microphone transducers...
                  </p>
                </div>
              ) : state === 'processing' ? (
                <div>
                  <div className="text-[11px] font-hud uppercase tracking-wider text-amber-400 font-semibold mb-1">
                    Processing Query
                  </div>
                  <p className="text-sm text-slate-300 font-mono-code">
                    {lastUserQuery ? `"${lastUserQuery}"` : 'Analyzing via Gemini neural matrix...'}
                  </p>
                </div>
              ) : currentResponse ? (
                <div>
                  {/* Recognized Question Kicker */}
                  {lastUserQuery && (
                    <div className="text-xs text-slate-400 font-hud uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
                      <User className="w-3 h-3 text-cyan-400" />
                      <span className="truncate max-w-[280px]">"{lastUserQuery}"</span>
                    </div>
                  )}

                  {/* JARVIS Answer Display */}
                  <div className="text-[11px] font-hud uppercase tracking-wider text-cyan-400 font-semibold mb-1 flex items-center justify-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    <span>J.A.R.V.I.S. Response ({currentLanguage})</span>
                  </div>

                  <p
                    className={`leading-relaxed font-medium ${
                      currentLanguage === 'urdu'
                        ? 'text-lg sm:text-xl font-urdu-clean text-slate-100'
                        : 'text-sm sm:text-base font-sans text-slate-100'
                    }`}
                    dir={currentLanguage === 'urdu' ? 'rtl' : 'ltr'}
                  >
                    {currentResponse}
                  </p>

                  {/* Roman Urdu translation if in Urdu script */}
                  {currentLanguage === 'urdu' && currentRomanResponse && currentRomanResponse !== currentResponse && (
                    <p className="text-xs text-cyan-300/80 font-sans mt-1">
                      {currentRomanResponse}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-slate-400">
                  Ready. Press the microphone button to speak, or type your question below.
                </p>
              )}
            </div>

            {/* TYPED MESSAGE INPUT & VOICE CONTROLS DOCK */}
            <div className="w-full max-w-xl mt-4 flex flex-col gap-3">
              {/* Typed Message Form */}
              <form onSubmit={handleTextSubmit} className="relative flex items-center w-full">
                <input
                  ref={inputRef}
                  type="text"
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  placeholder="Type a message (English, Urdu, or Roman Urdu)..."
                  className="w-full px-4 py-2.5 pr-24 rounded-lg bg-slate-900/90 border border-cyan-500/30 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all font-sans"
                />

                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="submit"
                    disabled={!typedInput.trim()}
                    className="p-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white transition-colors focus:outline-none"
                    title="Send Message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              {/* PRIMARY VOICE ACTION CONTROLS */}
              <div className="flex items-center justify-center gap-4">
                {/* Mute/Unmute Audio Toggle */}
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

                {/* MAIN MICROPHONE TRIGGER BUTTON */}
                <button
                  onClick={onToggleListening}
                  className={`relative group p-5 rounded-full border-2 transition-all duration-300 shadow-2xl ${
                    isMicActive
                      ? 'bg-cyan-500 border-white text-slate-950 scale-105 shadow-[0_0_35px_rgba(6,182,212,0.85)]'
                      : 'bg-slate-900/90 border-cyan-400/60 text-cyan-300 hover:border-cyan-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]'
                  }`}
                  aria-label={isMicActive ? 'Stop Listening' : 'Speak to JARVIS'}
                >
                  {isMicActive && (
                    <span className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-60 pointer-events-none" />
                  )}
                  {isMicActive ? <Mic className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>

                {/* Stop Speaking / Interrupt Button */}
                {state === 'speaking' ? (
                  <button
                    onClick={onStopSpeaking}
                    className="p-3 rounded-full border border-amber-500/50 bg-amber-950/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:bg-amber-900/60 transition-all animate-pulse"
                    title="Stop Speaking / Interrupt JARVIS"
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

              {/* Language Selector Bar */}
              <div className="flex items-center justify-center gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-lg max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('auto')}
                  className={`px-2.5 py-1 text-[11px] font-hud uppercase tracking-wider rounded transition-colors ${
                    settings.languageMode === 'auto'
                      ? 'bg-cyan-950 border border-cyan-400 text-cyan-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('ur-PK')}
                  className={`px-2.5 py-1 text-[11px] font-hud uppercase tracking-wider rounded transition-colors ${
                    settings.languageMode === 'ur-PK'
                      ? 'bg-cyan-950 border border-cyan-400 text-cyan-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  اردو / Roman
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('en-US')}
                  className={`px-2.5 py-1 text-[11px] font-hud uppercase tracking-wider rounded transition-colors ${
                    settings.languageMode === 'en-US'
                      ? 'bg-cyan-950 border border-cyan-400 text-cyan-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  English
                </button>
              </div>
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
                      onSendMessage(sug.text);
                    }}
                    className="w-full text-left p-2.5 rounded bg-slate-900/40 hover:bg-cyan-950/40 border border-slate-800/80 hover:border-cyan-500/40 text-slate-200 hover:text-white transition-all text-xs flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{sug.text}</span>
                    <span className="text-[10px] text-cyan-400/80 uppercase font-mono-code shrink-0">
                      {sug.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded border border-cyan-500/20 bg-slate-950/60 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                <span className="text-cyan-400 font-semibold tracking-wider uppercase">
                  Telemetry History
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
                onSendMessage(sug.text);
              }}
              className="whitespace-nowrap shrink-0 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-cyan-500/30 text-xs text-slate-200 hover:text-cyan-200 hover:border-cyan-400 transition-colors"
            >
              {sug.text}
            </button>
          ))}
        </div>
      </main>

      {/* FOOTER BAR */}
      <footer className="relative z-20 px-6 py-3 border-t border-cyan-500/20 bg-slate-950/90 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto flex-1 max-w-xl">
          <AudioVisualizerBar
            state={state}
            theme={settings.theme}
            getVisualizerData={getVisualizerData}
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-hud text-slate-400 uppercase tracking-wider">
          <span className="hidden md:inline">Neural Mode: Gemini 3.1 Flash + TTS</span>
          <span className="text-slate-600">·</span>
          <span>Voice: {settings.voiceName}</span>
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
