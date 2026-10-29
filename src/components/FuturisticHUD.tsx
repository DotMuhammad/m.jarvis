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
  AlertTriangle,
  RotateCcw,
  Send,
  Radio,
  User,
  Bot,
  Sparkles,
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
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat area when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript, currentResponse]);

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

  // State Badge Config
  const getStatusBadge = () => {
    switch (state) {
      case 'listening':
        return {
          label: 'LISTENING',
          dotClass: 'bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.9)] animate-pulse',
          badgeClass: 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]',
        };
      case 'processing':
      case 'connecting':
        return {
          label: 'THINKING',
          dotClass: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse',
          badgeClass: 'border-amber-500/50 bg-amber-950/40 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.25)]',
        };
      case 'speaking':
        return {
          label: 'SPEAKING',
          dotClass: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-pulse',
          badgeClass: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.25)]',
        };
      case 'error':
        return {
          label: 'ERROR',
          dotClass: 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)] animate-ping',
          badgeClass: 'border-rose-500/50 bg-rose-950/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.25)]',
        };
      case 'idle':
      default:
        return {
          label: 'IDLE',
          dotClass: 'bg-cyan-500/60 shadow-[0_0_6px_rgba(6,182,212,0.4)]',
          badgeClass: 'border-slate-800 bg-slate-900/60 text-slate-300',
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="min-h-screen bg-[#040714] text-slate-100 flex flex-col justify-between relative overflow-x-hidden select-none">
      {/* Background Subtle Cyber Grid & Ambient Radial Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:40px_40px] opacity-10 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(6,182,212,0.08),transparent_70%)] pointer-events-none" />

      {/* TOP HEADER BAR */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-md">
        {/* Left: JARVIS Wordmark & Glowing status indicator */}
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${statusBadge.dotClass}`} />
          <h1 className="font-hud text-lg sm:text-xl font-bold tracking-widest text-white uppercase flex items-center gap-2">
            <span>J.A.R.V.I.S.</span>
            <span className="text-[10px] text-cyan-400 font-mono-code font-normal tracking-normal border border-cyan-500/30 px-1.5 py-0.5 rounded bg-cyan-950/50 hidden sm:inline">
              VOICE OS
            </span>
          </h1>
        </div>

        {/* Center: Clear Status Pill (Idle, Listening, Thinking, Speaking, Error) */}
        <div className="flex items-center">
          <div
            className={`flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-hud font-semibold uppercase tracking-wider transition-all duration-300 ${statusBadge.badgeClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusBadge.dotClass}`} />
            <span>{statusBadge.label}</span>
          </div>
        </div>

        {/* Right Controls: Continuous Toggle, Settings, History */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Compact Continuous Toggle */}
          <button
            onClick={() => {
              soundFx.playClick();
              onUpdateSettings({ ...settings, continuous: !settings.continuous });
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md border text-xs font-hud uppercase tracking-wider transition-all ${
              settings.continuous
                ? 'border-cyan-400/60 bg-cyan-950/70 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
            }`}
            title={settings.continuous ? 'Continuous Conversation: ON' : 'Continuous Conversation: OFF'}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Continuous</span>
            <span className="font-mono-code text-[10px] text-cyan-300 font-bold">
              {settings.continuous ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* History drawer button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setIsDrawerOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-hud uppercase tracking-wider text-slate-300 border border-slate-800 rounded-md hover:bg-slate-900/80 hover:text-cyan-300 transition-colors"
            title="Conversation History"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Log</span>
            <span className="text-[10px] font-mono-code text-cyan-400 font-bold">({messages.length})</span>
          </button>

          {/* Settings modal button */}
          <button
            onClick={() => {
              soundFx.playClick();
              setIsSettingsOpen(true);
            }}
            className="p-1.5 text-slate-300 hover:text-cyan-300 border border-slate-800 rounded-md hover:bg-slate-900/80 transition-colors"
            title="Voice and Language Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT: FOCUSED CINEMATIC INTERFACE */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-between px-4 py-3 max-w-4xl w-full mx-auto">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="w-full max-w-xl mb-2 p-3 rounded-lg border border-rose-500/40 bg-rose-950/70 backdrop-blur-md flex items-center justify-between gap-3 text-rose-200 text-xs shadow-lg animate-fade-in">
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

        {/* TOP: Central Animated Visualizer (JarvisCore) */}
        <div className="flex flex-col items-center justify-center my-auto py-2">
          <JarvisCore
            state={state}
            theme={settings.theme}
            isMicActive={isMicActive}
            getVisualizerData={getVisualizerData}
            onCoreClick={onToggleListening}
          />
        </div>

        {/* MIDDLE: READABLE CONVERSATION AREA */}
        <div className="w-full max-w-2xl flex flex-col my-2">
          <div
            ref={chatScrollRef}
            className="w-full rounded-xl border border-cyan-500/25 bg-slate-950/85 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.12)] p-4 sm:p-5 max-h-[220px] sm:max-h-[260px] overflow-y-auto space-y-3.5 scroll-smooth border-t-cyan-400/40"
          >
            {/* If there are prior messages in session, show the last 3-4 cleanly */}
            {messages.length === 0 && !interimTranscript && (
              <div className="text-center py-6 text-slate-400">
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-cyan-400 opacity-60" />
                <p className="text-sm font-medium text-slate-300">
                  Ready for your directive, sir.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Click the microphone to speak, or type your question below.
                </p>
              </div>
            )}

            {messages.slice(-4).map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-hud uppercase tracking-wider mb-1 ${
                    msg.role === 'user' ? 'text-cyan-400' : 'text-slate-400'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <>
                      <span>You</span>
                      <User className="w-3 h-3 text-cyan-400" />
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                      <span>J.A.R.V.I.S.</span>
                      {msg.language && (
                        <span className="text-[10px] font-mono-code text-cyan-300/80 px-1 rounded bg-cyan-950/60 border border-cyan-500/20">
                          {msg.language}
                        </span>
                      )}
                    </>
                  )}
                  <span className="text-[10px] text-slate-600 font-mono-code ml-1">
                    {msg.timestamp}
                  </span>
                </div>

                <div
                  className={`max-w-[90%] rounded-lg px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-cyan-950/60 border border-cyan-500/30 text-cyan-100'
                      : 'bg-slate-900/80 border border-slate-800 text-slate-100 shadow-sm'
                  } ${
                    msg.language === 'urdu'
                      ? 'font-urdu-clean text-base leading-relaxed text-right'
                      : 'font-sans leading-relaxed'
                  }`}
                  dir={msg.language === 'urdu' ? 'rtl' : 'ltr'}
                >
                  <p>{msg.text}</p>
                  {msg.language === 'urdu' && msg.romanText && msg.romanText !== msg.text && (
                    <p className="text-xs text-cyan-300/80 font-sans mt-1 pt-1 border-t border-white/5">
                      {msg.romanText}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* LIVE VOICE TRANSCRIPTION PREVIEW */}
            {interimTranscript && (
              <div className="flex flex-col items-end animate-pulse">
                <div className="flex items-center gap-1.5 text-[11px] font-hud uppercase tracking-wider mb-1 text-cyan-400">
                  <span>Listening...</span>
                  <User className="w-3 h-3 text-cyan-400" />
                </div>
                <div className="max-w-[90%] rounded-lg px-4 py-2.5 text-sm bg-cyan-950/80 border border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  <p className="italic">"{interimTranscript}"</p>
                </div>
              </div>
            )}

            {/* THINKING INDICATOR */}
            {state === 'processing' && (
              <div className="flex flex-col items-start animate-pulse">
                <div className="flex items-center gap-1.5 text-[11px] font-hud uppercase tracking-wider mb-1 text-amber-400">
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  <span>J.A.R.V.I.S. (Thinking)</span>
                </div>
                <div className="rounded-lg px-4 py-2.5 text-xs font-mono-code bg-amber-950/30 border border-amber-500/40 text-amber-200">
                  <span>Connecting to neural core matrix...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM CONTROLS DOCK: INPUT + SEND + MIC + STOP + MUTE */}
        <div className="w-full max-w-2xl flex flex-col gap-2.5 mt-1">
          {/* Quick Directives */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-hud uppercase tracking-wider text-slate-500 shrink-0">Quick:</span>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onSendMessage('Jarvis, kya haal hai?');
              }}
              className="px-2.5 py-1 rounded bg-slate-900/90 hover:bg-cyan-950 border border-cyan-500/30 text-cyan-200 text-[11px] font-sans shrink-0 hover:border-cyan-400 transition-colors shadow-sm"
            >
              "Jarvis, kya haal hai?"
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onSendMessage('آپ کیا مدد کر سکتے ہیں؟');
              }}
              className="px-2.5 py-1 rounded bg-slate-900/90 hover:bg-cyan-950 border border-cyan-500/30 text-cyan-200 text-[12px] font-urdu-clean shrink-0 hover:border-cyan-400 transition-colors shadow-sm"
            >
              "آپ کیا مدد کر سکتے ہیں؟"
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onSendMessage('کوانٹم کمپیوٹنگ کیا ہے؟');
              }}
              className="px-2.5 py-1 rounded bg-slate-900/90 hover:bg-cyan-950 border border-cyan-500/30 text-cyan-200 text-[12px] font-urdu-clean shrink-0 hover:border-cyan-400 transition-colors shadow-sm"
            >
              "کوانٹم کمپیوٹنگ کیا ہے؟"
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onSendMessage('What is your current system status?');
              }}
              className="px-2.5 py-1 rounded bg-slate-900/90 hover:bg-cyan-950 border border-cyan-500/30 text-cyan-200 text-[11px] font-sans shrink-0 hover:border-cyan-400 transition-colors shadow-sm"
            >
              "System status" (EN)
            </button>
          </div>

          {/* Single Message Input + Send Button */}
          <form onSubmit={handleTextSubmit} className="relative flex items-center w-full">
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder="Ask JARVIS anything (اردو میں بات کریں، Roman Urdu، یا English)..."
              className="w-full px-4 py-3 pr-20 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all font-sans"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <button
                type="submit"
                disabled={!typedInput.trim()}
                className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 text-white transition-all focus:outline-none shadow-md"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* PRIMARY AUDIO CONTROLS & LANGUAGE SWITCHER */}
          <div className="flex items-center justify-between px-2">
            {/* Left: Language Toggle Buttons (Auto / English / Urdu) */}
            <div className="flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => handleLanguageChange('auto')}
                className={`px-2.5 py-1 text-[11px] font-hud uppercase tracking-wider rounded transition-colors ${
                  settings.languageMode === 'auto'
                    ? 'bg-cyan-950 border border-cyan-400 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Automatically match spoken language"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('en-US')}
                className={`px-2.5 py-1 text-[11px] font-hud uppercase tracking-wider rounded transition-colors ${
                  settings.languageMode === 'en-US'
                    ? 'bg-cyan-950 border border-cyan-400 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="English Language Mode"
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('ur-PK')}
                className={`px-2.5 py-1 text-[11px] font-hud uppercase tracking-wider rounded transition-colors ${
                  settings.languageMode === 'ur-PK'
                    ? 'bg-cyan-950 border border-cyan-400 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Urdu & Roman Urdu Mode"
              >
                اردو / Roman
              </button>
            </div>

            {/* Center / Right: Mute, Primary Mic Button, Stop/Interrupt Button */}
            <div className="flex items-center gap-3">
              {/* Mute Control */}
              <button
                onClick={onToggleMute}
                className={`p-3 rounded-full border transition-all ${
                  isMuted
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                }`}
                title={isMuted ? 'Unmute JARVIS Voice' : 'Mute JARVIS Voice'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              {/* Primary Microphone Button */}
              <button
                onClick={onToggleListening}
                className={`relative group p-4 sm:p-5 rounded-full border-2 transition-all duration-300 shadow-2xl ${
                  isMicActive
                    ? 'bg-cyan-400 border-white text-slate-950 scale-105 shadow-[0_0_35px_rgba(6,182,212,0.9)]'
                    : 'bg-slate-900/90 border-cyan-400/60 text-cyan-300 hover:border-cyan-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]'
                }`}
                aria-label={isMicActive ? 'Stop Listening' : 'Speak to JARVIS'}
                title={isMicActive ? 'Listening active. Click to pause.' : 'Click to speak to JARVIS'}
              >
                {isMicActive && (
                  <span className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping opacity-60 pointer-events-none" />
                )}
                <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>

              {/* Stop / Interrupt Button (Active during speaking or processing) */}
              <button
                onClick={onStopSpeaking}
                disabled={state !== 'speaking' && state !== 'processing'}
                className={`p-3 rounded-full border transition-all ${
                  state === 'speaking' || state === 'processing'
                    ? 'bg-amber-950/70 border-amber-400 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.5)] hover:bg-amber-900 animate-pulse cursor-pointer'
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed'
                }`}
                title="Stop Speaking / Interrupt JARVIS"
              >
                <Square className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER BAR: Clean waveform visualizer bar */}
      <footer className="relative z-20 px-6 py-2.5 border-t border-cyan-500/20 bg-slate-950/90 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="w-full max-w-lg mx-auto">
          <AudioVisualizerBar
            state={state}
            theme={settings.theme}
            getVisualizerData={getVisualizerData}
          />
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
