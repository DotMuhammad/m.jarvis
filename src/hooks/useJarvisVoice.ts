import { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantState, ChatMessage, VoiceSettings, TelemetryData } from '../types';
import { soundFx } from '../utils/soundFx';

// Helper for Web Speech Recognition types
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export function useJarvisVoice(settings: VoiceSettings, onSettingsChange?: (s: VoiceSettings) => void) {
  const [state, setState] = useState<AssistantState>('booting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    cpu: 34,
    memoryMb: 142,
    neuralLoad: 42,
    frequencyHz: 440,
    dbLevel: -42,
    pingMs: 24,
    protocol: 'MARK VII // ACTIVE',
  });

  // Audio Context & Analyser references
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const shouldContinueListeningRef = useRef<boolean>(settings.continuous);

  // Keep ref up to date
  useEffect(() => {
    shouldContinueListeningRef.current = settings.continuous;
  }, [settings.continuous]);

  useEffect(() => {
    soundFx.enabled = settings.soundFx;
  }, [settings.soundFx]);

  // Initialize Audio Context
  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Request mic stream and create mic analyser
  const setupMicStream = useCallback(async () => {
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return false;

      if (!micStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = stream;

        const micSource = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        micSource.connect(analyser);
        micAnalyserRef.current = analyser;
      }
      return true;
    } catch (err) {
      console.warn('Microphone permission request or connection error:', err);
      return false;
    }
  }, [ensureAudioContext]);

  // Decode and play WAV audio from Gemini TTS
  const playAudioData = useCallback(async (base64Audio: string): Promise<void> => {
    return new Promise(async (resolve) => {
      try {
        const ctx = ensureAudioContext();
        if (!ctx) {
          resolve();
          return;
        }

        // Stop any currently playing audio
        if (activeSourceNodeRef.current) {
          try {
            activeSourceNodeRef.current.stop();
          } catch {
            // ignore
          }
          activeSourceNodeRef.current = null;
        }

        // Setup output analyser if needed
        if (!outputAnalyserRef.current) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.82;
          analyser.connect(ctx.destination);
          outputAnalyserRef.current = analyser;
        }

        // Convert base64 to array buffer
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = settings.speechRate || 1.0;

        source.connect(outputAnalyserRef.current);
        activeSourceNodeRef.current = source;

        isSpeakingRef.current = true;
        setState('speaking');

        source.onended = () => {
          isSpeakingRef.current = false;
          activeSourceNodeRef.current = null;
          resolve();
        };

        source.start(0);
      } catch (err) {
        console.warn('Audio decoding error, falling back:', err);
        isSpeakingRef.current = false;
        resolve();
      }
    });
  }, [ensureAudioContext, settings.speechRate]);

  // Browser speech synthesis fallback
  const speakWithBrowser = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = (settings.speechRate || 1.0) * 0.95;
      utterance.pitch = 0.95;

      // Try selecting a British or natural English voice if present
      const voices = window.speechSynthesis.getVoices();
      const britishVoice = voices.find(
        (v) => v.lang.includes('en-GB') || v.name.includes('British') || v.name.includes('George') || v.name.includes('Daniel')
      ) || voices.find((v) => v.lang.startsWith('en'));

      if (britishVoice) {
        utterance.voice = britishVoice;
      }

      isSpeakingRef.current = true;
      setState('speaking');

      utterance.onend = () => {
        isSpeakingRef.current = false;
        resolve();
      };
      utterance.onerror = () => {
        isSpeakingRef.current = false;
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, [settings.speechRate]);

  // Process message and send to JARVIS
  const sendMessage = useCallback(async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;

    soundFx.playProcessing();
    setState('thinking');
    setInterimTranscript('');
    setCurrentResponse('Analyzing query parameters...');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          voiceName: settings.voiceName,
          generateVoice: !isMuted,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.replyText || 'Directive acknowledged, sir.';
      setCurrentResponse(replyText);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-jarvis`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        audioData: data.audioData,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      soundFx.playResponse();

      // Speak response aloud
      if (!isMuted) {
        if (data.audioData) {
          await playAudioData(data.audioData);
        } else {
          await speakWithBrowser(replyText);
        }
      }

      // Resume listening if continuous mode is enabled
      if (shouldContinueListeningRef.current && isMicActive) {
        setState('listening');
      } else {
        setState('idle');
      }
    } catch (err: any) {
      console.error('Error in sendMessage:', err);
      const fallbackReply = "My computational link experienced an anomaly, sir. Ready for your next command.";
      setCurrentResponse(fallbackReply);

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-jarvis`,
          role: 'assistant',
          text: fallbackReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
      ]);

      if (!isMuted) {
        await speakWithBrowser(fallbackReply);
      }
      setState('idle');
    }
  }, [messages, settings.voiceName, isMuted, isMicActive, playAudioData, speakWithBrowser]);

  // Setup Web Speech Recognition
  const startSpeechRecognition = useCallback(async () => {
    const micReady = await setupMicStream();
    if (!micReady) {
      console.warn('Microphone not available');
    }

    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn('SpeechRecognition API not supported in this browser environment');
      return;
    }

    try {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsMicActive(true);
        if (!isSpeakingRef.current) {
          setState('listening');
        }
        soundFx.playListening();
      };

      recognition.onresult = (event: any) => {
        // If JARVIS is currently speaking, don't capture JARVIS's own voice
        if (isSpeakingRef.current) {
          return;
        }

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        const currentSpeech = final || interim;
        setInterimTranscript(currentSpeech);

        // If user pauses for 1.3s after saying something, dispatch
        if (currentSpeech.trim().length > 1) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          silenceTimerRef.current = setTimeout(() => {
            const queryToSend = currentSpeech.trim();
            setInterimTranscript('');
            sendMessage(queryToSend);
          }, 1400);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        // Auto-restart if continuous mode is enabled and user hasn't explicitly stopped
        if (shouldContinueListeningRef.current && isMicActive && !isSpeakingRef.current) {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Speech recognition start failed:', e);
    }
  }, [setupMicStream, sendMessage, isMicActive]);

  const stopSpeechRecognition = useCallback(() => {
    setIsMicActive(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (state === 'listening') {
      setState('idle');
      soundFx.playStandby();
    }
  }, [state]);

  const toggleListening = useCallback(() => {
    soundFx.playClick();
    if (isMicActive) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  }, [isMicActive, startSpeechRecognition, stopSpeechRecognition]);

  const stopSpeaking = useCallback(() => {
    soundFx.playClick();
    if (activeSourceNodeRef.current) {
      try {
        activeSourceNodeRef.current.stop();
      } catch {
        // ignore
      }
      activeSourceNodeRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    setState(isMicActive ? 'listening' : 'idle');
  }, [isMicActive]);

  const toggleMute = useCallback(() => {
    soundFx.playClick();
    setIsMuted((prev) => {
      const next = !prev;
      if (next && state === 'speaking') {
        stopSpeaking();
      }
      return next;
    });
  }, [state, stopSpeaking]);

  // Initial boot completion & welcome
  const finishBooting = useCallback(async () => {
    setState('idle');
    const welcome = "All systems operational, sir. Speech synthesis and acoustic channels calibrated. How may I assist you today?";
    setCurrentResponse(welcome);

    const welcomeMsg: ChatMessage = {
      id: `msg-${Date.now()}-welcome`,
      role: 'assistant',
      text: welcome,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setMessages([welcomeMsg]);

    // Request speech synthesis of welcome after a short delay
    setTimeout(async () => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: welcome, voiceName: settings.voiceName }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audioData) {
            await playAudioData(data.audioData);
            return;
          }
        }
      } catch {
        // fallback
      }
      await speakWithBrowser(welcome);
    }, 600);
  }, [settings.voiceName, playAudioData, speakWithBrowser]);

  // Dynamic telemetry heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        cpu: Math.floor(28 + Math.random() * 18),
        neuralLoad: state === 'thinking' ? 88 + Math.floor(Math.random() * 10) : state === 'speaking' ? 62 + Math.floor(Math.random() * 12) : 35 + Math.floor(Math.random() * 10),
        frequencyHz: state === 'speaking' ? 440 + Math.floor(Math.random() * 400) : 120 + Math.floor(Math.random() * 40),
        dbLevel: state === 'listening' ? -24 + Math.floor(Math.random() * 15) : state === 'speaking' ? -12 + Math.floor(Math.random() * 8) : -60,
        pingMs: 16 + Math.floor(Math.random() * 8),
      }));
    }, 1200);

    return () => clearInterval(interval);
  }, [state]);

  // Read visualizer data from whichever analyser is active (output when speaking, mic when listening)
  const getVisualizerData = useCallback((): { frequency: Uint8Array; timeDomain: Uint8Array } => {
    const emptyFreq = new Uint8Array(64);
    const emptyTime = new Uint8Array(64).fill(128);

    if (state === 'speaking' && outputAnalyserRef.current) {
      const freq = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
      const time = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
      outputAnalyserRef.current.getByteFrequencyData(freq);
      outputAnalyserRef.current.getByteTimeDomainData(time);
      return { frequency: freq, timeDomain: time };
    }

    if ((state === 'listening' || isMicActive) && micAnalyserRef.current) {
      const freq = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
      const time = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
      micAnalyserRef.current.getByteFrequencyData(freq);
      micAnalyserRef.current.getByteTimeDomainData(time);
      return { frequency: freq, timeDomain: time };
    }

    return { frequency: emptyFreq, timeDomain: emptyTime };
  }, [state, isMicActive]);

  return {
    state,
    messages,
    interimTranscript,
    currentResponse,
    isMicActive,
    isMuted,
    telemetry,
    toggleListening,
    sendMessage,
    stopSpeaking,
    toggleMute,
    finishBooting,
    getVisualizerData,
    startSpeechRecognition,
    stopSpeechRecognition,
  };
}
