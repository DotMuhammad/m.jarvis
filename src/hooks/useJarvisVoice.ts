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
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [currentRomanResponse, setCurrentRomanResponse] = useState<string>('');
  const [currentLanguage, setCurrentLanguage] = useState<'urdu' | 'roman_urdu' | 'english'>('english');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(!settings.autoSpeak);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    cpu: 28,
    memoryMb: 118,
    neuralLoad: 32,
    frequencyHz: 440,
    dbLevel: -42,
    pingMs: 18,
    protocol: 'MARK 85 // MULTILINGUAL',
  });

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
  const languageModeRef = useRef<LanguageMode>(settings.languageMode);

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
      console.warn('AudioContext notice:', e);
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

  // Play WAV audio data from Gemini Neural TTS
  const playAudioData = useCallback(async (base64Audio: string): Promise<void> => {
    return new Promise(async (resolve) => {
      try {
        await ensureAudioContext();

        if (currentAudioElementRef.current) {
          try {
            currentAudioElementRef.current.pause();
            currentAudioElementRef.current.currentTime = 0;
          } catch {
            // ignore
          }
          currentAudioElementRef.current = null;
        }

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
            // fallback to direct audio
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

        audio.onerror = () => {
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

  // Multilingual browser speech synthesis fallback
  const speakWithBrowser = useCallback(
    (replyText: string, romanText?: string, language: 'urdu' | 'roman_urdu' | 'english' = 'english'): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          resolve();
          return;
        }

        try {
          if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
            window.speechSynthesis.cancel();
          }

          const voices = window.speechSynthesis.getVoices();
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
              voices.find((v) => v.lang.startsWith('hi')) ||
              voices.find((v) => v.name.toLowerCase().includes('urdu'));

            if (urduVoice) {
              selectedVoice = urduVoice;
              textToSpeak = replyText;
            } else {
              // Phonetic Roman Urdu via natural South Asian or English voice
              selectedVoice =
                voices.find((v) => v.lang.includes('en-IN') || v.lang.includes('hi')) ||
                voices.find((v) => v.lang.startsWith('en'));
              textToSpeak = romanText || replyText;
            }
          }

          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          activeUtteranceRef.current = utterance;
          utterance.rate = (settings.speechRate || 1.0) * 0.98;
          utterance.pitch = language === 'english' ? 0.95 : 0.98;

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
    [settings.speechRate]
  );

  // Send prompt (both voice and typed) to AI
  const sendMessage = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed || isProcessingRef.current) return;

      isProcessingRef.current = true;
      soundFx.playProcessing();
      setState('processing');
      setLastUserQuery(trimmed);
      setInterimTranscript('');
      setCurrentResponse('Processing query...');
      setCurrentRomanResponse('Thinking...');

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
        const romanText = data.romanText || replyText;
        const lang = data.language || 'english';

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

        // Resume continuous listening if active
        if (continuousRef.current && isMicActive) {
          setTimeout(() => {
            if (continuousRef.current && isMicActive && !isSpeakingRef.current) {
              startSpeechRecognition();
            }
          }, 350);
        } else {
          setState('idle');
        }
      } catch (err: any) {
        console.error('sendMessage failed:', err);
        const fallbackReply = 'My computational link encountered a latency spike, sir. Standing by for your directive.';
        setCurrentResponse(fallbackReply);
        setCurrentRomanResponse(fallbackReply);

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
          await speakWithBrowser(fallbackReply, fallbackReply, 'english');
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
    if (isSpeakingRef.current) {
      stopSpeaking();
    }

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

        // Set recognition language: ur-PK understands Urdu and Roman Urdu; en-US for English
        const activeLangMode = languageModeRef.current;
        recognition.lang = activeLangMode === 'en-US' ? 'en-US' : 'ur-PK';
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

          // Fast response: 650ms silence triggers auto-dispatch
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
            }, 650);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition event error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsMicActive(false);
            setState('error');
            setErrorMessage('Microphone access denied. Please click the site settings / address bar icon to allow microphone access.');
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

    // MediaRecorder fallback
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
        recorder.start(200);
        setIsMicActive(true);
        setState('listening');
        soundFx.playListening();
      } catch (mediaRecErr) {
        console.error('MediaRecorder error:', mediaRecErr);
        setState('error');
        setErrorMessage('Unable to initialize voice recording in this browser.');
      }
    }
  }, [setupMicStream, sendMessage, stopSpeaking]);

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

  // Startup Jarvis
  const startJarvis = useCallback(async () => {
    await ensureAudioContext();
    soundFx.playStartup();

    setState('idle');
    const welcome = "All systems operational, sir. Acoustic channels and speech synthesis online. How may I assist you today?";
    setCurrentResponse(welcome);
    setCurrentRomanResponse(welcome);
    setCurrentLanguage('english');

    const welcomeMsg: ChatMessage = {
      id: `msg-${Date.now()}-welcome`,
      role: 'assistant',
      text: welcome,
      romanText: welcome,
      language: 'english',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setMessages([welcomeMsg]);

    await setupMicStream();

    if (!isMuted) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: welcome, voiceName: settings.voiceName, language: 'english' }),
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
      await speakWithBrowser(welcome, welcome, 'english');
    }
  }, [ensureAudioContext, setupMicStream, settings.voiceName, isMuted, playAudioData, speakWithBrowser]);

  // Telemetry heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        cpu: Math.floor(24 + Math.random() * 14),
        neuralLoad:
          state === 'processing'
            ? 88 + Math.floor(Math.random() * 8)
            : state === 'speaking'
            ? 58 + Math.floor(Math.random() * 12)
            : 30 + Math.floor(Math.random() * 8),
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
