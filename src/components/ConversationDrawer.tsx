import React from 'react';
import { ChatMessage, HudTheme } from '../types';
import { Volume2, X, Trash2, Bot, User } from 'lucide-react';
import { soundFx } from '../utils/soundFx';

interface ConversationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onReplayAudio: (msg: ChatMessage) => void;
  onClearHistory: () => void;
  theme: HudTheme;
}

export const ConversationDrawer: React.FC<ConversationDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onReplayAudio,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md h-full bg-[#070b19] border-l border-cyan-500/25 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <span className="font-hud font-bold text-sm tracking-wider uppercase text-cyan-300">
              Vocal Telemetry Log
            </span>
            <span className="text-xs text-slate-400 font-mono-code tabular-nums">
              ({messages.length} exchanges)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playClick();
                onClearHistory();
              }}
              className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors rounded hover:bg-white/5"
              title="Clear transcript log"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white transition-colors rounded hover:bg-white/5"
              title="Close log"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6">
              <Bot className="w-10 h-10 mb-3 text-cyan-500/40" />
              <p className="font-hud text-sm uppercase tracking-wider text-slate-400">Log Buffer Empty</p>
              <p className="text-xs mt-1 text-slate-500 max-w-xs">
                Speak to JARVIS using the microphone to log vocal directives here.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isJarvis = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col rounded p-3 text-sm transition-all ${
                    isJarvis
                      ? 'bg-cyan-950/25 border border-cyan-500/30 text-slate-100 shadow-[0_0_15px_rgba(6,182,212,0.08)]'
                      : 'bg-slate-900/60 border border-slate-700/50 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      {isJarvis ? (
                        <span className="font-hud text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5" /> J.A.R.V.I.S.
                          {msg.language && (
                            <span className="text-[10px] text-cyan-400/80 font-mono-code font-normal ml-1">
                              [{msg.language}]
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="font-hud text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3.5 h-3.5" /> User Message
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono-code text-slate-500 tabular-nums">
                      {msg.timestamp}
                    </span>
                  </div>

                  <p className="leading-relaxed text-sm sm:text-base font-urdu-clean font-medium" dir="auto">
                    {msg.text}
                  </p>
                  {msg.romanText && msg.romanText !== msg.text && (
                    <p className="text-xs text-cyan-300/80 font-sans mt-1">
                      {msg.romanText}
                    </p>
                  )}

                  {isJarvis && (
                    <div className="mt-2.5 flex items-center justify-end">
                      <button
                        onClick={() => {
                          soundFx.playClick();
                          onReplayAudio(msg);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-hud uppercase tracking-wider text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/30 rounded transition-colors"
                      >
                        <Volume2 className="w-3 h-3" /> سنیں (Replay)
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-cyan-500/20 bg-slate-950/80 text-center">
          <span className="text-[11px] text-slate-400 font-mono-code">
            Stark Neural Transcriptions · Local Cache
          </span>
        </div>
      </div>
    </div>
  );
};
