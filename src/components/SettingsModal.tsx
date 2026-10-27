import React from 'react';
import { VoiceSettings, VoicePersona, HudTheme } from '../types';
import { X, Volume2, Mic, Sparkles, Sliders } from 'lucide-react';
import { soundFx } from '../utils/soundFx';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onUpdateSettings: (newSettings: VoiceSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const personas: { id: VoicePersona; label: string; desc: string }[] = [
    { id: 'Fenrir', label: 'Fenrir (JARVIS Classic)', desc: 'Aristocratic British accent, articulate, witty & poised' },
    { id: 'Zephyr', label: 'Zephyr (Tactical)', desc: 'Smooth, composed, military tactical cadence' },
    { id: 'Puck', label: 'Puck (Witty)', desc: 'Fast, playful, intellectually sharp' },
    { id: 'Charon', label: 'Charon (Deep Resonant)', desc: 'Commanding, deep timber, authoritative presence' },
    { id: 'Kore', label: 'Kore (Refined)', desc: 'Crisp, crystal clear, elegant pronunciation' },
  ];

  const themes: { id: HudTheme; label: string; color: string }[] = [
    { id: 'stark-cyan', label: 'Stark Cyan', color: 'bg-cyan-500' },
    { id: 'arc-gold', label: 'Arc Gold', color: 'bg-amber-500' },
    { id: 'quantum-emerald', label: 'Quantum Emerald', color: 'bg-emerald-500' },
    { id: 'crimson-tactical', label: 'Crimson Tactical', color: 'bg-rose-500' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-[#070d1e] border border-cyan-500/30 rounded-lg shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="font-hud font-bold text-base uppercase tracking-wider text-slate-100">
              JARVIS Subsystem Configuration
            </h2>
          </div>
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Voice Persona */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <label className="font-hud text-sm font-semibold uppercase tracking-wider text-slate-200">
                Neural Voice Persona
              </label>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Powered by Gemini 3.8 Neural Speech Synthesis. Select your preferred vocal persona.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {personas.map((p) => {
                const isSelected = settings.voiceName === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      soundFx.playClick();
                      onUpdateSettings({ ...settings, voiceName: p.id });
                    }}
                    className={`flex items-start justify-between p-3 rounded text-left transition-all border ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] text-white'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-hud font-bold text-sm tracking-wide text-cyan-300">
                        {p.label}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{p.desc}</div>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-mono-code text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40">
                        ACTIVE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* HUD Theme */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <label className="font-hud text-sm font-semibold uppercase tracking-wider text-slate-200">
                Holographic Interface Theme
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((t) => {
                const isSelected = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      soundFx.playClick();
                      onUpdateSettings({ ...settings, theme: t.id });
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded border text-left text-xs font-hud uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${t.color}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Mode Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between p-3 rounded bg-slate-900/40 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="font-hud text-sm font-semibold uppercase tracking-wide text-slate-200">
                    Continuous Vocal Dialogue
                  </div>
                  <div className="text-xs text-slate-400">
                    Keep microphone active after JARVIS responds for natural continuous speech
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.continuous}
                onChange={(e) => {
                  soundFx.playClick();
                  onUpdateSettings({ ...settings, continuous: e.target.checked });
                }}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-slate-900/40 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="font-hud text-sm font-semibold uppercase tracking-wide text-slate-200">
                    Synthesized Sci-Fi Audio FX
                  </div>
                  <div className="text-xs text-slate-400">
                    Play futuristic tones for boot, thinking, and communication status
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.soundFx}
                onChange={(e) => {
                  soundFx.playClick();
                  onUpdateSettings({ ...settings, soundFx: e.target.checked });
                }}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cyan-500/20 bg-slate-950/80 flex justify-end">
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-hud font-bold text-xs uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(6,182,212,0.4)]"
          >
            Apply Configurations
          </button>
        </div>
      </div>
    </div>
  );
};
