import React, { useEffect, useRef } from 'react';
import { AssistantState, HudTheme } from '../types';

interface JarvisCoreProps {
  state: AssistantState;
  theme: HudTheme;
  isMicActive: boolean;
  getVisualizerData: () => { frequency: Uint8Array; timeDomain: Uint8Array };
  onCoreClick: () => void;
}

export const JarvisCore: React.FC<JarvisCoreProps> = ({
  state,
  theme,
  isMicActive,
  getVisualizerData,
  onCoreClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const rotationAngleRef = useRef<number>(0);
  const innerAngleRef = useRef<number>(0);
  const pulseRef = useRef<number>(0);

  // Theme color maps
  const getThemePalette = () => {
    switch (theme) {
      case 'arc-gold':
        return {
          primary: '#f59e0b',
          primaryGlow: 'rgba(245, 158, 11, ',
          secondary: '#ef4444',
          coreGradient: ['#fef08a', '#f59e0b', '#b45309'],
        };
      case 'quantum-emerald':
        return {
          primary: '#10b981',
          primaryGlow: 'rgba(16, 185, 129, ',
          secondary: '#06b6d4',
          coreGradient: ['#a7f3d0', '#10b981', '#047857'],
        };
      case 'crimson-tactical':
        return {
          primary: '#f43f5e',
          primaryGlow: 'rgba(244, 63, 94, ',
          secondary: '#fb7185',
          coreGradient: ['#fecdd3', '#f43f5e', '#9f1239'],
        };
      case 'stark-cyan':
      default:
        return {
          primary: '#06b6d4',
          primaryGlow: 'rgba(6, 182, 212, ',
          secondary: '#3b82f6',
          coreGradient: ['#cffafe', '#06b6d4', '#1d4ed8'],
        };
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(window.innerWidth * 0.85, 540);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    // Particles for cyber dust
    const particles = Array.from({ length: 48 }, () => ({
      radius: Math.random() * (size * 0.44) + 30,
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() * 0.008 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.7 + 0.2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      const centerX = size / 2;
      const centerY = size / 2;
      const palette = getThemePalette();

      const { frequency } = getVisualizerData();

      // Compute average audio level
      let sumFreq = 0;
      for (let i = 0; i < frequency.length; i++) {
        sumFreq += frequency[i];
      }
      const avgAudio = frequency.length ? sumFreq / frequency.length : 0;
      const audioScale = state === 'speaking' ? avgAudio / 90 : state === 'listening' ? avgAudio / 110 : 0.08;

      // Update rotation angles based on state
      const rotSpeed = state === 'thinking' ? 0.045 : state === 'speaking' ? 0.018 : 0.006;
      rotationAngleRef.current += rotSpeed;
      innerAngleRef.current -= rotSpeed * 1.4;
      pulseRef.current += 0.03;

      // 1. Draw Cyber Particle Field
      particles.forEach((p) => {
        p.angle += p.speed * (state === 'thinking' ? 3.5 : 1);
        const px = centerX + Math.cos(p.angle) * p.radius;
        const py = centerY + Math.sin(p.angle) * p.radius;

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${palette.primaryGlow}${p.alpha * (state === 'thinking' ? 0.9 : 0.5)})`;
        ctx.shadowColor = palette.primary;
        ctx.shadowBlur = 8;
        ctx.fill();
      });

      // 2. Outer Calibration Ring with Ticks
      const outerRadius = size * 0.42;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `${palette.primaryGlow}0.2)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Outer ticks
      const totalTicks = 72;
      for (let i = 0; i < totalTicks; i++) {
        const tickAngle = (i * (Math.PI * 2)) / totalTicks + rotationAngleRef.current * 0.2;
        const isMajor = i % 6 === 0;
        const tickLen = isMajor ? 8 : 4;
        const r1 = outerRadius - tickLen;
        const r2 = outerRadius;

        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(tickAngle) * r1, centerY + Math.sin(tickAngle) * r1);
        ctx.lineTo(centerX + Math.cos(tickAngle) * r2, centerY + Math.sin(tickAngle) * r2);
        ctx.strokeStyle = isMajor ? `${palette.primaryGlow}0.7)` : `${palette.primaryGlow}0.25)`;
        ctx.lineWidth = isMajor ? 1.5 : 0.75;
        ctx.stroke();
      }

      // 3. Middle Segmented Rotating Arcs
      const midRadius = size * 0.34;
      const numSegments = 4;
      const segmentSpan = (Math.PI * 2) / numSegments;
      for (let s = 0; s < numSegments; s++) {
        const start = s * segmentSpan + rotationAngleRef.current;
        const end = start + segmentSpan * 0.7;

        ctx.beginPath();
        ctx.arc(centerX, centerY, midRadius, start, end);
        ctx.strokeStyle = `${palette.primaryGlow}${0.4 + Math.sin(pulseRef.current + s) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = palette.primary;
        ctx.shadowBlur = 12;
        ctx.stroke();

        // Node markers at arc terminals
        const terminalX = centerX + Math.cos(end) * midRadius;
        const terminalY = centerY + Math.sin(end) * midRadius;
        ctx.beginPath();
        ctx.arc(terminalX, terminalY, 3, 0, Math.PI * 2);
        ctx.fillStyle = palette.primary;
        ctx.fill();
      }

      // 4. Counter-rotating Inner Precision Ring
      const innerRingRadius = size * 0.26;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRingRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `${palette.primaryGlow}0.3)`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5. Radial Audio Equalizer Waveform Bars (Bloom out from reactor core)
      const numRays = 48;
      const coreRayRadius = size * 0.17;
      for (let i = 0; i < numRays; i++) {
        const rayAngle = (i * (Math.PI * 2)) / numRays + innerAngleRef.current;
        const freqIdx = Math.floor((i / numRays) * (frequency.length * 0.75));
        const freqVal = frequency[freqIdx] || 0;

        // Dynamic height based on audio level or ambient pulse
        let rayLength = (freqVal / 255) * (size * 0.16) + (Math.sin(pulseRef.current * 2 + i) * 3 + 4);
        if (state === 'idle') {
          rayLength = 6 + Math.sin(pulseRef.current + i * 0.5) * 4;
        } else if (state === 'thinking') {
          rayLength = 12 + Math.random() * 14;
        }

        const startX = centerX + Math.cos(rayAngle) * coreRayRadius;
        const startY = centerY + Math.sin(rayAngle) * coreRayRadius;
        const endX = centerX + Math.cos(rayAngle) * (coreRayRadius + rayLength);
        const endY = centerY + Math.sin(rayAngle) * (coreRayRadius + rayLength);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = `${palette.primaryGlow}${0.35 + (rayLength / (size * 0.16)) * 0.65})`;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 6. Radiant Central Arc Reactor Core
      const baseCoreRadius = size * 0.13 * (1 + audioScale * 0.35);
      const coreGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        baseCoreRadius * 1.5
      );
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, palette.coreGradient[0]);
      coreGrad.addColorStop(0.7, palette.coreGradient[1]);
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseCoreRadius * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = state === 'speaking' || state === 'thinking' ? 36 : 22;
      ctx.fill();

      // Inner geometric hologram (Nested rotating triangles / hexagon)
      const sides = 6;
      ctx.beginPath();
      for (let s = 0; s < sides; s++) {
        const hexAngle = (s * (Math.PI * 2)) / sides + rotationAngleRef.current * 0.8;
        const hx = centerX + Math.cos(hexAngle) * (baseCoreRadius * 0.7);
        const hy = centerY + Math.sin(hexAngle) * (baseCoreRadius * 0.7);
        if (s === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Reactor innermost iris
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseCoreRadius * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18;
      ctx.fill();

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state, theme, getVisualizerData]);

  // Status subtitle and color
  const getStatusBadge = () => {
    switch (state) {
      case 'listening':
        return { text: 'LISTENING // VOCAL STREAM ENGAGED', color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40' };
      case 'thinking':
        return { text: 'COMPUTING // PROCESSING DIRECTIVE', color: 'text-amber-400 border-amber-500/40 bg-amber-950/40' };
      case 'speaking':
        return { text: 'TRANSMITTING // SPEECH SYNTHESIS', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40' };
      case 'muted':
        return { text: 'AUDIO MUTED // SENSORS STANDBY', color: 'text-rose-400 border-rose-500/40 bg-rose-950/40' };
      case 'booting':
        return { text: 'INITIALIZING // CALIBRATING SYSTEM', color: 'text-blue-400 border-blue-500/40 bg-blue-950/40' };
      case 'idle':
      default:
        return {
          text: isMicActive ? 'STANDBY // VOCAL DETECTION ACTIVE' : 'ONLINE // CLICK CORE TO SPEAK',
          color: 'text-slate-300 border-slate-700/60 bg-slate-900/50',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-4">
      {/* Background ambient radial glow */}
      <div
        className={`absolute w-[440px] h-[440px] rounded-full blur-[100px] pointer-events-none transition-all duration-700 opacity-30 ${
          state === 'speaking'
            ? 'bg-cyan-500/40 scale-110'
            : state === 'thinking'
            ? 'bg-amber-500/35 scale-115'
            : state === 'listening'
            ? 'bg-blue-500/40 scale-105'
            : 'bg-cyan-600/20'
        }`}
      />

      {/* Holographic targeting brackets */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[490px] h-[490px] max-w-[90vw] max-h-[90vw] border border-cyan-500/10 rounded-full relative">
          {/* 4 Corner Crosshairs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-3 h-1 bg-cyan-400/40" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-3 h-1 bg-cyan-400/40" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-1 h-3 bg-cyan-400/40" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-1 h-3 bg-cyan-400/40" />
        </div>
      </div>

      {/* Interactive Core Canvas */}
      <button
        onClick={onCoreClick}
        aria-label="Toggle JARVIS Voice Listening"
        className="relative group cursor-pointer focus:outline-none z-10 transition-transform duration-300 active:scale-95 hover:scale-[1.02]"
      >
        <canvas ref={canvasRef} className="rounded-full drop-shadow-[0_0_35px_rgba(6,182,212,0.25)]" />

        {/* Hover ring guide */}
        <div className="absolute inset-0 rounded-full border border-cyan-400/0 group-hover:border-cyan-400/30 transition-colors pointer-events-none" />
      </button>

      {/* State Badge with Zero-Pill Aesthetic */}
      <div className="mt-4 flex items-center gap-2 font-hud tracking-wider text-xs font-semibold px-4 py-1 rounded border backdrop-blur-md transition-colors duration-300 uppercase z-10 shadow-lg">
        <span className={status.color.split(' ')[0]}>{status.text}</span>
      </div>
    </div>
  );
};
