import React, { useState, useEffect } from 'react';
import { soundFx } from '../utils/soundFx';
import { Power, Sparkles, Shield, Volume2 } from 'lucide-react';

interface StartupSequenceProps {
  onStart: () => void;
}

export const StartupSequence: React.FC<StartupSequenceProps> = ({ onStart }) => {
  const [progress, setProgress] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsReady(true);
          return 100;
        }
        return prev + 5;
      });
    }, 45);

    return () => clearInterval(interval);
  }, []);

  const handleStartClick = () => {
    setIsInitializing(true);
    soundFx.playStartup();
    onStart();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#030612] flex flex-col items-center justify-center p-6 text-cyan-400 select-none">
      {/* Background cyber grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:36px_36px] opacity-15" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_60%)]" />

      {/* Center Startup Container */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full text-center">
        {/* Holographic Arc Core */}
        <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping opacity-25" />
          <div className="absolute inset-1 rounded-full border-2 border-t-cyan-400 border-r-cyan-400/40 border-b-transparent border-l-transparent animate-spin-slow" />
          <div className="absolute inset-4 rounded-full border border-b-cyan-300 border-t-transparent border-l-cyan-300/40 border-r-transparent animate-spin-reverse" />
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-300 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.7)]">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>

        <h1 className="font-hud text-3xl sm:text-5xl font-bold tracking-widest text-slate-100 uppercase mb-2">
          J.A.R.V.I.S.
        </h1>
        <p className="font-mono-code text-xs text-cyan-300 tracking-widest uppercase mb-6 flex items-center gap-2">
          <span>Stark Industries OS</span>
          <span className="text-cyan-500">·</span>
          <span>Mark 85</span>
          <span className="text-cyan-500">·</span>
          <span>Voice Matrix</span>
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-slate-900/90 rounded-full h-2 p-0.5 border border-cyan-500/30 mb-3 overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.25)]">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-white rounded-full transition-all duration-100 shadow-[0_0_12px_rgba(6,182,212,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between w-full text-[11px] font-mono-code text-slate-400 mb-8 px-1">
          <span>{isReady ? 'SUBSYSTEMS SYNCHRONIZED' : 'CALIBRATING TRANSDUCERS...'}</span>
          <span className="text-cyan-300 font-bold tabular-nums">{progress}%</span>
        </div>

        {/* Big Cinematic Start Button (Ensures direct user gesture for audio & mic) */}
        <button
          onClick={handleStartClick}
          disabled={isInitializing}
          className="group relative px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-hud font-bold text-base sm:text-lg uppercase tracking-widest transition-all duration-300 shadow-[0_0_35px_rgba(6,182,212,0.6)] hover:shadow-[0_0_50px_rgba(6,182,212,0.9)] hover:scale-105 active:scale-95 focus:outline-none flex items-center gap-3"
        >
          <Power className="w-5 h-5 text-cyan-200 group-hover:rotate-12 transition-transform" />
          <span>{isInitializing ? 'INITIALIZING VOICE CORE...' : 'START J.A.R.V.I.S.'}</span>
        </button>

        <div className="mt-6 flex items-center gap-4 text-xs font-hud text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> Speech Synthesis
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-400" /> Microphone Sensor
          </span>
        </div>
      </div>
    </div>
  );
};
