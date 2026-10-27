import React, { useEffect, useRef } from 'react';
import { AssistantState, HudTheme } from '../types';

interface AudioVisualizerBarProps {
  state: AssistantState;
  theme: HudTheme;
  getVisualizerData: () => { frequency: Uint8Array; timeDomain: Uint8Array };
}

export const AudioVisualizerBar: React.FC<AudioVisualizerBarProps> = ({
  state,
  theme,
  getVisualizerData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getThemeColor = () => {
    switch (theme) {
      case 'arc-gold':
        return '#f59e0b';
      case 'quantum-emerald':
        return '#10b981';
      case 'crimson-tactical':
        return '#f43f5e';
      case 'stark-cyan':
      default:
        return '#06b6d4';
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { frequency, timeDomain } = getVisualizerData();
      const color = getThemeColor();

      const width = canvas.width;
      const height = canvas.height;

      // Draw subtle center line
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw frequency spectrum vertical bars
      const numBars = 36;
      const barWidth = width / numBars - 2;

      for (let i = 0; i < numBars; i++) {
        const freqIdx = Math.floor((i / numBars) * (frequency.length * 0.8));
        let val = frequency[freqIdx] || 0;

        // Ambient rhythm if idle
        if (state === 'idle') {
          val = 15 + Math.sin(Date.now() * 0.003 + i * 0.25) * 12;
        } else if (state === 'thinking') {
          val = 30 + Math.sin(Date.now() * 0.015 + i * 0.4) * 25 + Math.random() * 15;
        }

        const barHeight = Math.max(3, (val / 255) * (height * 0.85));
        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, color);
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
        grad.addColorStop(1, color);

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      // Draw oscilloscope overlay line
      ctx.beginPath();
      for (let i = 0; i < timeDomain.length; i++) {
        const v = timeDomain[i] / 128.0;
        const y = (v * height) / 2;
        const x = (i / timeDomain.length) * width;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `${color}40`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, theme, getVisualizerData]);

  return (
    <div className="w-full flex items-center justify-between gap-4 py-2 px-3 rounded border border-cyan-500/20 bg-slate-950/60 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="font-hud text-xs text-cyan-400 font-semibold tracking-wider uppercase">
          Acoustic Spectrum
        </span>
        <span className="text-[10px] text-slate-500 font-mono-code tabular-nums">
          48kHz · stereo
        </span>
      </div>

      <div className="flex-1 max-w-[280px] h-9 flex items-center justify-center">
        <canvas ref={canvasRef} width={280} height={36} className="w-full h-full" />
      </div>

      <div className="hidden sm:flex items-center gap-2 font-mono-code text-[10px] text-slate-400 tabular-nums">
        <span className="text-cyan-400 font-medium">RMS:</span>
        <span>{state === 'speaking' ? '-14.2 dB' : state === 'listening' ? '-22.8 dB' : '-58.4 dB'}</span>
      </div>
    </div>
  );
};
