import { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantState, ChatMessage, VoiceSettings, TelemetryData } from '../types';
import { soundFx } from '../utils/soundFx';

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export function useJarvisVoice(settings: VoiceSettings) {
  const [state, setState] = useState<AssistantState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    cpu: 32,
    memoryMb: 124,
    neuralLoad: 38,
    frequencyHz: 440,
    dbLevel: -42,
    pingMs: 22,
    protocol: 'MARK 85 // NOMINAL',
  });

  // Audio Context & Analysers
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const continuousRef = useRef<boolean>(settings.continuous);

  useEffect(() => {
    continuousRef.current = settings.continuous;
  }, [settings.continuous]);

  useEffect(() => {
    soundFx.enabled = settings.soundFx;
  }, [settings.soundFx]);

  // Ensure and resume AudioContext with user gesture
  const ensureAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    } catch (e) {
      console.warn('AudioContext initialization notice:', e);
      return null;
    }
  }, []);

  // Set up microphone audio stream for visualizer
  const setupMicStream = useCallback(async (): Promise<boolean> => {
    try {
      const ctx = await ensureAudioContext();
      if (!micStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = stream;

        if (ctx) {
          try {
            const micSource = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 128;
            analyser.smoothingTimeConstant = 0.8;
            micSource.connect(analyser);
            micAnalyserRef.current = analyser;
          } catch (audioNodeErr) {
            console.warn('Mic analyser node notice:', audioNodeErr);
          }
        }
      }
      setErrorMessage(null);
      return true;
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      const isNotAllowed = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setErrorMessage(
        isNotAllowed
          ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
          : 'Could not access audio device. Please check your microphone connection.'
      );
      setState('error');
      return false;
    }
  }, [ensureAudioContext]);

  // Clean, audible HTML5 audio playback for Gemini TTS WAV
  const playAudioData = useCallback(async (base64Audio: string): Promise<void> => {
    return new Promise(async (resolve) => {
      try {
        await ensureAudioContext();

        // Stop any prior audio
        if (currentAudioElementRef.current) {
          try {
            currentAudioElementRef.current.pause();
            currentAudioElementRef.current.currentTime = 0;
          } catch {
            // ignore
          }
          currentAudioElementRef.current = null;
        }

        // Convert base64 to binary ArrayBuffer and create Blob
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = settings.speechRate || 1.0;
        currentAudioElementRef.current = audio;

        // Try connecting to Web Audio output analyser for visualizer
        if (audioContextRef.current) {
          try {
            if (!outputAnalyserRef.current) {
              const analyser = audioContextRef.current.createAnalyser();
              analyser.fftSize = 128;
              analyser.smoothingTimeConstant = 0.82;
              analyser.connect(audioContextRef.current.destination);
              outputAnalyserRef.current = analyser;
            }
            const source = audioContextRef.current.createMediaElementSource(audio);
            source.connect(outputAnalyserRef.current);
          } catch {
            // If already connected or CORS, fallback to standard audio playback
          }
        }

        isSpeakingRef.current = true;
        setState('speaking');

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudioElementRef.current = null;
          isSpeakingRef.current = false;
          resolve();
        };

        audio.onerror = (e) => {
          console.warn('Audio element error during playback, using browser fallback:', e);
          URL.revokeObjectURL(audioUrl);
          currentAudioElementRef.current = null;
          isSpeakingRef.current = false;
          resolve();
        };

        await audio.play();
      } catch (err) {
        console.warn('Audio playback start exception:', err);
        isSpeakingRef.current = false;
        resolve();
      }
    });
  }, [ensureAudioContext, settings.speechRate]);

  // Robust Web Speech Synthesis fallback (with Chrome GC fix and safety timeout)
  const speakWithBrowser = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }

      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
          window.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        activeUtteranceRef.current = utterance;
        utterance.rate = (settings.speechRate || 1.0) * 0.98;
        utterance.pitch = 0.95;

        const populateVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          const preferred =
            voices.find(
              (v) =>
                v.lang.includes('en-GB') ||
                v.name.includes('British') ||
                v.name.includes('Daniel') ||
                v.name.includes('Oliver') ||
                v.name.includes('George')
            ) || voices.find((v) => v.lang.startsWith('en'));

          if (preferred) {
            utterance.voice = preferred;
          }
        };

        populateVoice();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = populateVoice;
        }

        isSpeakingRef.current = true;
        setState('speaking');

        let isDone = false;
        const finish = () => {
          if (!isDone) {
            isDone = true;
            activeUtteranceRef.current = null;
            isSpeakingRef.current = false;
            resolve();
          }
        };

        utterance.onend = finish;
        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis error:', e);
          finish();
        };

        // Safety timeout so JARVIS is never permanently stuck in 'speaking'
        const estimatedDurationMs = Math.max(3000, text.length * 90);
        setTimeout(finish, estimatedDurationMs);

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('speakWithBrowser exception:', e);
        isSpeakingRef.current = false;
        resolve();
      }
    });
  }, [settings.speechRate]);

  // Stop currently speaking audio immediately
  const stopSpeaking = useCallback(() => {
    soundFx.playClick();
    if (currentAudioElementRef.current) {
      try {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      currentAudioElementRef.current = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    activeUtteranceRef.current = null;
    isSpeakingRef.current = false;

    if (continuousRef.current && isMicActive) {
      setState('listening');
    } else {
      setState('idle');
    }
  }, [isMicActive]);

  // Send message to AI and speak response aloud
  const sendMessage = useCallback(async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isProcessingRef.current) return;

    isProcessingRef.current = true;
    soundFx.playProcessing();
    setState('processing');
    setInterimTranscript('');
    setCurrentResponse('Analyzing tactical query...');

    // Temporarily halt speech recognition to avoid capturing AI speech
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

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

      // Speak response aloud to user
      if (!isMuted) {
        if (data.audioData) {
          await playAudioData(data.audioData);
        } else {
          await speakWithBrowser(replyText);
        }
      }

      // Check if continuous listening should be resumed
      if (continuousRef.current && isMicActive) {
        // Wait 400ms after speech ends before listening again
        setTimeout(() => {
          if (continuousRef.current && isMicActive && !isSpeakingRef.current) {
            startSpeechRecognition();
          }
        }, 400);
      } else {
        setState('idle');
      }
    } catch (err: any) {
      console.error('sendMessage failed:', err);
      const fallbackReply = 'My cognitive matrix encountered a latency spike, sir. Standing by for your directive.';
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
    } finally {
      isProcessingRef.current = false;
    }
  }, [messages, settings.voiceName, isMuted, isMicActive, playAudioData, speakWithBrowser]);

  // Start Speech Recognition (or MediaRecorder fallback)
  const startSpeechRecognition = useCallback(async () => {
    setState('connecting');
    const micGranted = await setupMicStream();
    if (!micGranted) {
      return;
    }

    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    // Option A: Browser has SpeechRecognition API
    if (SpeechRec) {
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
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsMicActive(true);
          setErrorMessage(null);
          if (!isSpeakingRef.current && !isProcessingRef.current) {
            setState('listening');
            soundFx.playListening();
          }
        };

        recognition.onresult = (event: any) => {
          if (isSpeakingRef.current || isProcessingRef.current) return;

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

          if (currentSpeech.trim().length > 1) {
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }

            silenceTimerRef.current = setTimeout(() => {
              const queryToSend = currentSpeech.trim();
              setInterimTranscript('');
              if (queryToSend) {
                sendMessage(queryToSend);
              }
            }, 1200);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition event error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsMicActive(false);
            setState('error');
            setErrorMessage('Microphone access denied. Please click the padlock or camera/mic icon in your browser address bar to allow microphone.');
          } else if (event.error === 'network') {
            setErrorMessage('Speech service network error. Switched to direct audio buffer.');
          }
        };

        recognition.onend = () => {
          if (continuousRef.current && isMicActive && !isSpeakingRef.current && !isProcessingRef.current) {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }
        };

        speechRecognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition failed, falling back to MediaRecorder:', err);
      }
    }

    // Option B: MediaRecorder direct capture fallback
    if (micStreamRef.current && typeof MediaRecorder !== 'undefined') {
      try {
        recordedAudioChunksRef.current = [];
        const recorder = new MediaRecorder(micStreamRef.current);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedAudioChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = async () => {
          if (recordedAudioChunksRef.current.length > 0) {
            const audioBlob = new Blob(recordedAudioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Audio = (reader.result as string)?.split(',')[1];
              if (base64Audio) {
                try {
                  const res = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audioBase64: base64Audio, mimeType: 'audio/webm' }),
                  });
                  const data = await res.json();
                  if (data.text) {
                    sendMessage(data.text);
                  }
                } catch {
                  // ignore
                }
              }
            };
            reader.readAsDataURL(audioBlob);
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(250);
        setIsMicActive(true);
        setState('listening');
        soundFx.playListening();
      } catch (mediaRecErr) {
        console.error('MediaRecorder fallback error:', mediaRecErr);
        setState('error');
        setErrorMessage('Unable to initialize voice recording in this browser.');
      }
    }
  }, [setupMicStream, sendMessage]);

  // Stop Speech Recognition
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

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (state === 'listening' || state === 'connecting') {
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

  const toggleMute = useCallback(() => {
    soundFx.playClick();
    setIsMuted((prev) => {
      const next = !prev;
      if (next && isSpeakingRef.current) {
        stopSpeaking();
      }
      return next;
    });
  }, [stopSpeaking]);

  // Startup Boot Completion & Immediate Welcome Speech
  const startJarvis = useCallback(async () => {
    // 1. Prime AudioContext & SpeechSynthesis on direct user gesture
    await ensureAudioContext();
    soundFx.playStartup();

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

    // 2. Pre-prompt microphone so permissions are settled upfront
    await setupMicStream();

    // 3. Immediately synthesize and play welcome speech
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
      // ignore
    }
    await speakWithBrowser(welcome);
  }, [ensureAudioContext, setupMicStream, settings.voiceName, playAudioData, speakWithBrowser]);

  // Heartbeat telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        cpu: Math.floor(26 + Math.random() * 16),
        neuralLoad:
          state === 'processing'
            ? 86 + Math.floor(Math.random() * 10)
            : state === 'speaking'
            ? 60 + Math.floor(Math.random() * 12)
            : 32 + Math.floor(Math.random() * 10),
        frequencyHz:
          state === 'speaking'
            ? 440 + Math.floor(Math.random() * 400)
            : state === 'listening'
            ? 220 + Math.floor(Math.random() * 200)
            : 120 + Math.floor(Math.random() * 40),
        dbLevel:
          state === 'listening'
            ? -20 + Math.floor(Math.random() * 14)
            : state === 'speaking'
            ? -10 + Math.floor(Math.random() * 8)
            : -60,
        pingMs: 14 + Math.floor(Math.random() * 8),
      }));
    }, 1200);

    return () => clearInterval(interval);
  }, [state]);

  // Read visualizer data from output analyser (when speaking) or mic analyser (when listening)
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
    errorMessage,
    telemetry,
    toggleListening,
    sendMessage,
    stopSpeaking,
    toggleMute,
    startJarvis,
    getVisualizerData,
    startSpeechRecognition,
    stopSpeechRecognition,
  };
}
