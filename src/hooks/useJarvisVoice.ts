import { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantState, ChatMessage, VoiceSettings, TelemetryData, LanguageMode } from '../types';
import { soundFx } from '../utils/soundFx';

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export function useJarvisVoice(settings: VoiceSettings) {
  const [state, setState] = useState<AssistantState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [lastUserQuery, setLastUserQuery] = useState<string>('');
  const [currentResponse, setCurrentResponse] = useState<string>('تمام سسٹمز فعال ہیں۔ فرمائیے، میں آپ کی کیا مدد کر سکتا ہوں؟');
  const [currentRomanResponse, setCurrentRomanResponse] = useState<string>('Tamaam systems faal hain. Farmayiye, main aap ki kya madad kar sakta hoon?');
  const [currentLanguage, setCurrentLanguage] = useState<'urdu' | 'roman_urdu' | 'english'>('urdu');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(!settings.autoSpeak);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    cpu: 28,
    memoryMb: 118,
    neuralLoad: 32,
    frequencyHz: 440,
    dbLevel: -42,
    pingMs: 18,
    protocol: 'MARK 85 // URDU VOICE OS',
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const currentBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDispatchedTextRef = useRef<string>('');
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const continuousRef = useRef<boolean>(settings.continuous);
  const languageModeRef = useRef<LanguageMode>(settings.languageMode);
  const startSpeechRecognitionRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    continuousRef.current = settings.continuous;
  }, [settings.continuous]);

  useEffect(() => {
    languageModeRef.current = settings.languageMode;
  }, [settings.languageMode]);

  useEffect(() => {
    soundFx.enabled = settings.soundFx;
  }, [settings.soundFx]);

  useEffect(() => {
    setIsMuted(!settings.autoSpeak);
  }, [settings.autoSpeak]);

  // Load browser speech synthesis voices asynchronously
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const updateVoices = () => {
        try {
          const v = window.speechSynthesis.getVoices();
          if (v && v.length > 0) {
            setBrowserVoices(v);
          }
        } catch {
          // ignore
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Ensure and resume AudioContext with user gesture
  const ensureAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    } catch (e) {
      console.warn('AudioContext initialization note:', e);
      return null;
    }
  }, []);

  // Request mic stream and create mic analyser for visualizer
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
          ? 'Microphone access denied. Please click the site settings / address bar icon to allow microphone permissions.'
          : 'Microphone hardware device not found. Please check your audio inputs.'
      );
      setState('error');
      return false;
    }
  }, [ensureAudioContext]);

  // Stop currently speaking audio immediately
  const stopSpeaking = useCallback(() => {
    soundFx.playClick();

    // 1. Stop Web Audio Buffer Source Node
    if (currentBufferSourceRef.current) {
      try {
        currentBufferSourceRef.current.stop();
        currentBufferSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      currentBufferSourceRef.current = null;
    }

    // 2. Stop HTML Audio fallback
    if (currentAudioElementRef.current) {
      try {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      currentAudioElementRef.current = null;
    }

    // 3. Stop SpeechSynthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    activeUtteranceRef.current = null;
    isSpeakingRef.current = false;
    isProcessingRef.current = false;

    if (continuousRef.current && isMicActive) {
      setState('listening');
      startSpeechRecognitionRef.current?.();
    } else {
      setState('idle');
    }
  }, [isMicActive]);

  // Play WAV audio data from Gemini Neural TTS with Web Audio API
  const playAudioData = useCallback(
    async (base64Audio: string): Promise<void> => {
      return new Promise(async (resolve) => {
        try {
          const ctx = await ensureAudioContext();

          // Stop any currently playing audio
          if (currentBufferSourceRef.current) {
            try {
              currentBufferSourceRef.current.stop();
              currentBufferSourceRef.current.disconnect();
            } catch {
              // ignore
            }
            currentBufferSourceRef.current = null;
          }
          if (currentAudioElementRef.current) {
            try {
              currentAudioElementRef.current.pause();
              currentAudioElementRef.current.currentTime = 0;
            } catch {
              // ignore
            }
            currentAudioElementRef.current = null;
          }

          // Decode base64 to binary ArrayBuffer
          const binaryString = atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Primary Path: Native Web Audio API decoding (synchronized with analyser)
          if (ctx) {
            try {
              // Create a fresh copy of buffer for decodeAudioData
              const bufferCopy = bytes.buffer.slice(0);
              const audioBuffer = await ctx.decodeAudioData(bufferCopy);

              if (!outputAnalyserRef.current) {
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 128;
                analyser.smoothingTimeConstant = 0.82;
                analyser.connect(ctx.destination);
                outputAnalyserRef.current = analyser;
              }

              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.playbackRate.value = settings.speechRate || 1.0;
              source.connect(outputAnalyserRef.current);
              currentBufferSourceRef.current = source;

              isSpeakingRef.current = true;
              setState('speaking');

              let resolved = false;
              const finish = () => {
                if (!resolved) {
                  resolved = true;
                  currentBufferSourceRef.current = null;
                  isSpeakingRef.current = false;
                  resolve();
                }
              };

              source.onended = finish;
              source.start(0);
              return;
            } catch (decodeErr) {
              console.warn('Web Audio decode failed, falling back to HTML5 Audio element:', decodeErr);
            }
          }

          // Fallback Path: HTML5 Audio
          const blob = new Blob([bytes], { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audio.playbackRate = settings.speechRate || 1.0;
          currentAudioElementRef.current = audio;

          isSpeakingRef.current = true;
          setState('speaking');

          let isResolved = false;
          const finishAudio = () => {
            if (!isResolved) {
              isResolved = true;
              URL.revokeObjectURL(audioUrl);
              currentAudioElementRef.current = null;
              isSpeakingRef.current = false;
              resolve();
            }
          };

          audio.onended = finishAudio;
          audio.onerror = finishAudio;
          await audio.play();
        } catch (err) {
          console.warn('Audio playback exception:', err);
          isSpeakingRef.current = false;
          resolve();
        }
      });
    },
    [ensureAudioContext, settings.speechRate]
  );

  // Multilingual browser speech synthesis fallback
  const speakWithBrowser = useCallback(
    (replyText: string, romanText?: string, language: 'urdu' | 'roman_urdu' | 'english' = 'urdu'): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          resolve();
          return;
        }

        try {
          if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
            window.speechSynthesis.cancel();
          }

          const voices = browserVoices.length > 0 ? browserVoices : window.speechSynthesis.getVoices();
          let selectedVoice: SpeechSynthesisVoice | undefined;
          let textToSpeak = replyText;

          if (language === 'english') {
            selectedVoice =
              voices.find((v) => v.lang.includes('en-GB') || v.name.includes('Daniel') || v.name.includes('George')) ||
              voices.find((v) => v.lang.startsWith('en'));
            textToSpeak = replyText;
          } else {
            // Urdu or Roman Urdu
            const urduVoice =
              voices.find((v) => v.lang.startsWith('ur')) ||
              voices.find((v) => v.name.toLowerCase().includes('urdu'));

            if (urduVoice) {
              selectedVoice = urduVoice;
              textToSpeak = replyText;
            } else {
              // Browser lacks native Urdu voice: speak phonetic Roman Urdu via South Asian / English voice
              selectedVoice =
                voices.find((v) => v.lang.includes('hi') || v.lang.includes('en-IN')) ||
                voices.find((v) => v.lang.startsWith('en'));
              textToSpeak = romanText || replyText;
            }
          }

          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          activeUtteranceRef.current = utterance;
          utterance.rate = (settings.speechRate || 1.0) * 0.96;
          utterance.pitch = language === 'english' ? 0.95 : 1.0;

          if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
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
          utterance.onerror = finish;

          const estimatedDurationMs = Math.max(2500, textToSpeak.length * 80);
          setTimeout(finish, estimatedDurationMs);

          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('speakWithBrowser exception:', e);
          isSpeakingRef.current = false;
          resolve();
        }
      });
    },
    [browserVoices, settings.speechRate]
  );

  // Send prompt (both voice and typed) to AI
  const sendMessage = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || isProcessingRef.current) return;

      // Prevent duplicate immediate dispatches of the same phrase
      if (lastDispatchedTextRef.current === trimmed && Date.now() - (lastDispatchedTextRef as any).lastTime < 2000) {
        return;
      }
      lastDispatchedTextRef.current = trimmed;
      (lastDispatchedTextRef as any).lastTime = Date.now();

      isProcessingRef.current = true;
      soundFx.playProcessing();
      setState('processing');
      setLastUserQuery(trimmed);
      setInterimTranscript('');
      setCurrentResponse('پراسیسنگ جاری ہے...');
      setCurrentRomanResponse('Processing query...');

      // Abort speech recognition during processing to prevent feedback
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
            voiceName: settings.voiceName || 'Kore',
            generateVoice: !isMuted,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const data = await response.json();
        const replyText = data.replyText || 'جی جناب، میں آپ کی بات سمجھ گیا ہوں۔';
        const romanText = data.romanText || replyText;
        const lang = data.language || 'urdu';

        setCurrentResponse(replyText);
        setCurrentRomanResponse(romanText);
        setCurrentLanguage(lang);

        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-jarvis`,
          role: 'assistant',
          text: replyText,
          romanText: romanText,
          language: lang,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          audioData: data.audioData,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        soundFx.playResponse();

        // Speak aloud automatically
        if (!isMuted) {
          if (data.audioData) {
            await playAudioData(data.audioData);
          } else {
            await speakWithBrowser(replyText, romanText, lang);
          }
        }

        // Resume continuous listening if enabled and mic is active
        if (continuousRef.current && isMicActive) {
          setTimeout(() => {
            if (continuousRef.current && isMicActive && !isSpeakingRef.current) {
              startSpeechRecognitionRef.current?.();
            }
          }, 350);
        } else {
          setState('idle');
        }
      } catch (err: any) {
        console.error('sendMessage failed:', err);
        const fallbackReply = 'معذرت، رابطہ قائم کرنے میں تاخیر ہوئی۔ میں آپ کے حکم کا منتظر ہوں۔';
        const fallbackRoman = 'Maazrat, rabta qayam karne mein takheer hui. Main aap ke hukam ka muntazir hoon.';
        setCurrentResponse(fallbackReply);
        setCurrentRomanResponse(fallbackRoman);

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-jarvis`,
            role: 'assistant',
            text: fallbackReply,
            romanText: fallbackRoman,
            language: 'urdu',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
        ]);

        if (!isMuted) {
          await speakWithBrowser(fallbackReply, fallbackRoman, 'urdu');
        }
        setState('idle');
      } finally {
        isProcessingRef.current = false;
      }
    },
    [messages, settings.voiceName, isMuted, isMicActive, playAudioData, speakWithBrowser]
  );

  // Start Speech Recognition
  const startSpeechRecognition = useCallback(async () => {
    startSpeechRecognitionRef.current = startSpeechRecognition;

    setState('connecting');
    const micGranted = await setupMicStream();
    if (!micGranted) {
      return;
    }

    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

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

        // Set recognition language: ur-PK for Urdu/Roman Urdu, en-US for English
        const activeLangMode = languageModeRef.current;
        if (activeLangMode === 'en-US') {
          recognition.lang = 'en-US';
        } else {
          // Default to Pakistani Urdu for accurate speech recognition
          recognition.lang = 'ur-PK';
        }
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

            // If we have a final chunk, 500ms delay; for interim, 1100ms of silence
            const delayMs = final.trim().length > 0 ? 500 : 1100;
            silenceTimerRef.current = setTimeout(() => {
              const queryToSend = (final || currentSpeech).trim();
              setInterimTranscript('');
              if (queryToSend) {
                sendMessage(queryToSend);
              }
            }, delayMs);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition event error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsMicActive(false);
            setState('error');
            setErrorMessage('Microphone access denied. Please click the site settings / address bar icon to allow microphone access.');
          } else if (event.error === 'no-speech') {
            // Natural silence; don't set error
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
        console.warn('SpeechRecognition error, falling back to MediaRecorder:', err);
      }
    }

    // MediaRecorder fallback for browsers without SpeechRecognition
    if (micStreamRef.current && typeof MediaRecorder !== 'undefined') {
      try {
        const recorder = new MediaRecorder(micStreamRef.current);
        const recordedChunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          if (recordedChunks.length > 0) {
            const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
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

        recorder.start(250);
        setIsMicActive(true);
        setState('listening');
        soundFx.playListening();
      } catch (mediaRecErr) {
        console.error('MediaRecorder error:', mediaRecErr);
        setState('error');
        setErrorMessage('Unable to initialize voice recording in this browser.');
      }
    }
  }, [setupMicStream, sendMessage]);

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
      if (isSpeakingRef.current) {
        stopSpeaking();
      }
      startSpeechRecognition();
    }
  }, [isMicActive, startSpeechRecognition, stopSpeechRecognition, stopSpeaking]);

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

  // Startup Jarvis with natural Pakistani Urdu greeting
  const startJarvis = useCallback(async () => {
    await ensureAudioContext();
    soundFx.playStartup();

    setState('idle');
    const welcome = 'السلام علیکم! تمام سسٹمز فعال ہیں۔ فرمائیے، میں آپ کی کیا مدد کر سکتا ہوں؟';
    const welcomeRoman = 'Assalam-o-Alaikum! Tamaam systems faal hain. Farmayiye, main aap ki kya madad kar sakta hoon?';

    setCurrentResponse(welcome);
    setCurrentRomanResponse(welcomeRoman);
    setCurrentLanguage('urdu');

    const welcomeMsg: ChatMessage = {
      id: `msg-${Date.now()}-welcome`,
      role: 'assistant',
      text: welcome,
      romanText: welcomeRoman,
      language: 'urdu',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setMessages([welcomeMsg]);

    await setupMicStream();

    // Play welcome speech aloud and wait for it to complete
    if (!isMuted) {
      let playedAudio = false;
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: welcome,
            voiceName: settings.voiceName || 'Kore',
            language: 'urdu',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audioData) {
            playedAudio = true;
            await playAudioData(data.audioData);
          }
        }
      } catch (e) {
        console.warn('Startup TTS request notice:', e);
      }

      if (!playedAudio) {
        await speakWithBrowser(welcome, welcomeRoman, 'urdu');
      }
    }

    // Auto-engage continuous listening after welcome audio finishes
    if (continuousRef.current) {
      setTimeout(() => {
        startSpeechRecognitionRef.current?.();
      }, 350);
    }
  }, [ensureAudioContext, setupMicStream, settings.voiceName, isMuted, playAudioData, speakWithBrowser]);

  // Telemetry heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        cpu: Math.floor(22 + Math.random() * 12),
        neuralLoad:
          state === 'processing'
            ? 88 + Math.floor(Math.random() * 8)
            : state === 'speaking'
            ? 58 + Math.floor(Math.random() * 12)
            : 28 + Math.floor(Math.random() * 8),
        frequencyHz:
          state === 'speaking'
            ? 440 + Math.floor(Math.random() * 400)
            : state === 'listening'
            ? 220 + Math.floor(Math.random() * 200)
            : 120 + Math.floor(Math.random() * 40),
        dbLevel:
          state === 'listening'
            ? -18 + Math.floor(Math.random() * 12)
            : state === 'speaking'
            ? -8 + Math.floor(Math.random() * 6)
            : -60,
        pingMs: 12 + Math.floor(Math.random() * 6),
      }));
    }, 1200);

    return () => clearInterval(interval);
  }, [state]);

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
    lastUserQuery,
    currentResponse,
    currentRomanResponse,
    currentLanguage,
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
