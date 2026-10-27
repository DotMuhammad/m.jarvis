import React, { useState, useEffect } from 'react';
import { soundFx } from '../utils/soundFx';

interface StartupSequenceProps {
  onComplete: () => void;
}

export const StartupSequence: React.FC<StartupSequenceProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState<number>(0);
  const [logIndex, setLogIndex] = useState<number>(0);

  const logs = [
    'INITIALIZING STARK TELEMETRY SUBSYSTEMS...',
    'ESTABLISHING QUANTUM NEURAL INTERFACE...',
    'CALIBRATING 48KHZ STEREO ACOUSTIC TRANSDUCERS...',
    'LOADING HIGH-DEFINITION SPEECH SYNTHESIS MATRIX...',
    'JARVIS PROTOCOL MARK 85 ENGAGED. ALL SYSTEMS NOMINAL.',
  ];

  useEffect(() => {
    soundFx.playStartup();

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 400);
          return 100;
        }
        return prev + 4;
      });
    }, 60);

    const logInterval = setInterval(() => {
      setLogIndex((prev) => {
        if (prev < logs.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 450);

    return () => {
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-[#030612] flex flex-col items-center justify-center p-6 text-cyan-400 select-none">
      {/* Background cyber grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:32px_32px] opacity-15" />

      {/* Center Startup Arc */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full text-center">
        {/* Holographic boot ring */}
        <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping opacity-30" />
          <div className="absolute inset-2 rounded-full border-2 border-t-cyan-400 border-r-cyan-400/30 border-b-transparent border-l-transparent animate-spin-slow" />
          <div className="absolute inset-5 rounded-full border border-b-cyan-300 border-t-transparent border-l-cyan-300/40 border-r-transparent animate-spin-reverse" />
          <div className="w-10 h-10 rounded-full bg-cyan-400/20 backdrop-blur-md border border-cyan-300 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.6)]">
            <span className="font-hud font-bold text-lg text-white">J</span>
          </div>
        </div>

        <h1 className="font-hud text-3xl sm:text-4xl font-bold tracking-widest text-slate-100 uppercase mb-2">
          J.A.R.V.I.S.
        </h1>
        <p className="font-mono-code text-xs text-cyan-400/80 tracking-widest uppercase mb-8">
          Voice Operating System // Mark 85
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-slate-900/80 rounded-full h-2 p-0.5 border border-cyan-500/30 mb-4 overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.2)]">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-white rounded-full transition-all duration-100 shadow-[0_0_12px_rgba(6,182,212,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Diagnostic Status Line */}
        <div className="h-6 flex items-center justify-center">
          <p className="font-mono-code text-xs text-slate-400 tracking-wide transition-opacity duration-300">
            {logs[logIndex]}
          </p>
        </div>

        {/* Percentage */}
        <span className="font-hud font-bold text-sm text-cyan-300 mt-2 tabular-nums">
          {progress}%
        </span>

        {/* Immediate Access Button */}
        <button
          onClick={onComplete}
          className="mt-8 px-6 py-2 rounded font-hud text-xs font-semibold tracking-wider uppercase text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/10 hover:border-cyan-400 transition-colors focus:outline-none"
        >
          Engage Direct Interface
        </button>
      </div>
    </div>
  );
};
