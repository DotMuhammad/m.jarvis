import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '25mb' }));

// Initialize GoogleGenAI SDK with >=10s compliant timeout
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    timeout: 15000,
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const JARVIS_MULTILINGUAL_INSTRUCTION = `
You are J.A.R.V.I.S., the legendary futuristic AI assistant created by Tony Stark.
You are fully fluent in Pakistani Urdu (اردو), Roman Urdu, and English.

LANGUAGE MATCHING DIRECTIVE:
1. Identify the language of the user's question or message and respond in the EXACT same language:
   - If the user writes or speaks in Urdu script (e.g., "آپ کا کیا حال ہے؟", "سسٹم کی رپورٹ دیں"): Respond in natural, polite Urdu script.
   - If the user writes or speaks in Roman Urdu (e.g., "Jarvis kya haal hai?", "tum kon ho?", "aaj ka mausam kaisa hai?", "system ka status batao"): Respond in natural conversational Roman Urdu.
   - If the user writes or speaks in English (e.g., "Hello Jarvis", "Explain quantum computing", "Run diagnostic check"): Respond in refined, articulate, witty English like the classic Paul Bettany JARVIS persona.
   - If the user code-mixes Urdu and English (e.g., "Jarvis system status check karo"): Respond in natural Pakistani conversational style matching their tone.

PERSONA AND TONE:
1. Address the user with respect: "Sir" or "Ma'am" in English; "جناب" or "سر" in Urdu and Roman Urdu.
2. Conciseness by default: Normal questions must be answered in 1 to 2 crisp, direct sentences so spoken replies are fast and natural.
3. Detailed explanations: If and only if the user explicitly asks for details (e.g., "explain in detail", "tafseel se batao", "explain step by step"), provide a thorough, complete answer.
4. Avoid unnecessary robotic throat-clearing, disclaimer walls, or awkward markdown syntax that doesn't sound right when read aloud.

OUTPUT FORMAT:
Always return valid JSON with these keys:
{
  "language": "urdu" | "roman_urdu" | "english",
  "replyText": "<primary display text in matched language>",
  "spokenText": "<phonetic text optimized for audio speech synthesis>",
  "romanText": "<roman transliteration if replyText is in Urdu script, or identical to replyText>"
}
`;

function getLocalJarvisFallback(prompt: string): {
  language: 'urdu' | 'roman_urdu' | 'english';
  replyText: string;
  spokenText: string;
  romanText: string;
} {
  const p = prompt.toLowerCase();

  // 1. Detect Urdu script characters
  const hasUrduScript = /[\u0600-\u06FF]/.test(prompt);
  if (hasUrduScript) {
    if (p.includes('حال') || p.includes('کیسے') || p.includes('خیریت')) {
      return {
        language: 'urdu',
        replyText: 'میں بالکل ٹھیک ہوں جناب! فرمائیے، میں آپ کی کیا خدمت کر سکتا ہوں؟',
        spokenText: 'Main bilkul theek hoon janab! Farmayiye, main aap ki kya khidmat kar sakta hoon?',
        romanText: 'Main bilkul theek hoon janab! Farmayiye, main aap ki kya khidmat kar sakta hoon?',
      };
    }
    return {
      language: 'urdu',
      replyText: 'تمام سسٹمز اور پروٹوکولز فعال ہیں جناب۔ میں آپ کے حکم کا منتظر ہوں۔',
      spokenText: 'Tamaam systems aur protocols faal hain janab. Main aap ke hukum ka muntazir hoon.',
      romanText: 'Tamaam systems aur protocols faal hain janab. Main aap ke hukum ka muntazir hoon.',
    };
  }

  // 2. Detect Roman Urdu keywords
  const romanUrduKeywords = [
    'haal', 'kaise', 'kaisay', 'kya', 'chal', 'raha', 'hai', 'batao', 'karo', 'shukriya',
    'meherbani', 'kon', 'kaun', 'mera', 'meri', 'apna', 'naam', 'theek', 'hoon', 'salam',
    'assalam', 'hukum', 'kijiye', 'janab', 'tafseel', 'madad'
  ];
  const isRomanUrdu = romanUrduKeywords.some((kw) => p.includes(kw));

  if (isRomanUrdu) {
    if (p.includes('haal') || p.includes('kaise') || p.includes('kaisay')) {
      return {
        language: 'roman_urdu',
        replyText: 'Main bilkul theek hoon janab! Aap batayein, aaj main aap ki kya madad kar sakta hoon?',
        spokenText: 'Main bilkul theek hoon janab! Aap batayein, aaj main aap ki kya madad kar sakta hoon?',
        romanText: 'Main bilkul theek hoon janab! Aap batayein, aaj main aap ki kya madad kar sakta hoon?',
      };
    }
    if (p.includes('kon') || p.includes('kaun') || p.includes('naam')) {
      return {
        language: 'roman_urdu',
        replyText: 'Main J.A.R.V.I.S. hoon janab, aap ka jadeed AI voice assistant.',
        spokenText: 'Main Jarvis hoon janab, aap ka jadeed AI voice assistant.',
        romanText: 'Main J.A.R.V.I.S. hoon janab, aap ka jadeed AI voice assistant.',
      };
    }
    if (p.includes('status') || p.includes('system') || p.includes('report')) {
      return {
        language: 'roman_urdu',
        replyText: 'All systems online hain janab. Arc reactor 99.4% efficiency par operate kar raha hai.',
        spokenText: 'All systems online hain janab. Arc reactor ninety-nine point four percent efficiency par operate kar raha hai.',
        romanText: 'All systems online hain janab. Arc reactor 99.4% efficiency par operate kar raha hai.',
      };
    }
    return {
      language: 'roman_urdu',
      replyText: 'Jee janab, main aap ke hukum ka muntazir hoon. Farmayiye kya karna hai?',
      spokenText: 'Jee janab, main aap ke hukum ka muntazir hoon. Farmayiye kya karna hai?',
      romanText: 'Jee janab, main aap ke hukum ka muntazir hoon. Farmayiye kya karna hai?',
    };
  }

  // 3. Default to English
  if (p.includes('status') || p.includes('diagnostic') || p.includes('report') || p.includes('systems')) {
    return {
      language: 'english',
      replyText: 'All core subroutines are online, sir. Arc reactor telemetry indicates 99.4% efficiency and all defense protocols are nominal.',
      spokenText: 'All core subroutines are online, sir. Arc reactor telemetry indicates ninety-nine point four percent efficiency and all defense protocols are nominal.',
      romanText: 'All core subroutines are online, sir.',
    };
  }
  if (p.includes('who are you') || p.includes('your name')) {
    return {
      language: 'english',
      replyText: 'I am J.A.R.V.I.S., your personal artificial intelligence assistant. At your service, sir.',
      spokenText: 'I am Jarvis, your personal artificial intelligence assistant. At your service, sir.',
      romanText: 'I am J.A.R.V.I.S., your personal artificial intelligence assistant.',
    };
  }
  return {
    language: 'english',
    replyText: `Directive acknowledged, sir. Processing your request regarding "${prompt}".`,
    spokenText: `Directive acknowledged, sir. Processing your request regarding ${prompt}.`,
    romanText: `Directive acknowledged, sir.`,
  };
}

// API: Process voice command & typed message
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const prompt = (req.body.prompt || req.body.message || '').toString();
    const { history = [], voiceName = 'Kore', generateVoice = true } = req.body;

    if (!prompt.trim()) {
      res.status(400).json({ error: 'Missing prompt parameter' });
      return;
    }

    let parsedResult = {
      language: 'english' as 'urdu' | 'roman_urdu' | 'english',
      replyText: '',
      spokenText: '',
      romanText: '',
    };

    // Step 1: Rapid generation with gemini-3.1-flash-lite
    if (apiKey) {
      const contents: any[] = [];
      if (Array.isArray(history) && history.length > 0) {
        const recentHistory = history.slice(-4);
        for (const item of recentHistory) {
          if (item.role === 'user') {
            contents.push({ role: 'user', parts: [{ text: item.text }] });
          } else if (item.role === 'assistant') {
            contents.push({ role: 'model', parts: [{ text: item.text }] });
          }
        }
      }
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      try {
        const textResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            systemInstruction: JARVIS_MULTILINGUAL_INSTRUCTION,
            responseMimeType: 'application/json',
            temperature: 0.6,
          },
        });

        const rawJson = textResponse.text?.trim() || '';
        if (rawJson) {
          try {
            const data = JSON.parse(rawJson);
            parsedResult = {
              language: data.language || 'english',
              replyText: data.replyText || '',
              spokenText: data.spokenText || data.replyText || '',
              romanText: data.romanText || data.replyText || '',
            };
          } catch (jsonErr) {
            console.warn('JSON parse error from model output, using text directly:', jsonErr);
            parsedResult = {
              language: /[\u0600-\u06FF]/.test(rawJson) ? 'urdu' : 'english',
              replyText: rawJson.replace(/[*_#`~]/g, '').trim(),
              spokenText: rawJson.replace(/[*_#`~]/g, '').trim(),
              romanText: rawJson.replace(/[*_#`~]/g, '').trim(),
            };
          }
        }
      } catch (err: any) {
        console.warn('Gemini model call note, engaging local JARVIS fallback:', err?.message || err);
        parsedResult = getLocalJarvisFallback(prompt);
      }
    }

    if (!parsedResult.replyText) {
      parsedResult = getLocalJarvisFallback(prompt);
    }

    let audioData: string | null = null;

    // Step 2: Generate speech audio via Gemini TTS
    if (generateVoice && apiKey) {
      try {
        // Choose voice persona based on language
        let selectedVoice = voiceName || 'Fenrir';
        if (parsedResult.language === 'urdu') {
          selectedVoice = 'Kore';
        } else if (parsedResult.language === 'roman_urdu') {
          selectedVoice = 'Kore';
        } else {
          selectedVoice = voiceName === 'Kore' ? 'Fenrir' : (voiceName || 'Fenrir');
        }

        const ttsText = (parsedResult.spokenText || parsedResult.replyText)
          .replace(/[*_#`~]/g, '')
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          .trim();

        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: ttsText,
                  speechMetadata: {
                    style:
                      parsedResult.language === 'english'
                        ? 'Articulate, refined British accent, intelligent futuristic assistant'
                        : 'Warm, natural, articulate Pakistani Urdu accent',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        });

        audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (ttsErr: any) {
        console.warn('Gemini TTS notice (browser speech synthesis fallback engaged):', ttsErr?.message || ttsErr);
      }
    }

    const elapsedMs = Date.now() - startTime;

    res.json({
      language: parsedResult.language,
      replyText: parsedResult.replyText,
      spokenText: parsedResult.spokenText || parsedResult.replyText,
      romanText: parsedResult.romanText || parsedResult.replyText,
      audioData,
      mimeType: audioData ? 'audio/wav' : null,
      voiceName,
      latencyMs: elapsedMs,
    });
  } catch (error: any) {
    console.error('Chat API general error:', error);
    const fallback = getLocalJarvisFallback(req.body?.prompt || '');
    res.json({
      language: fallback.language,
      replyText: fallback.replyText,
      spokenText: fallback.spokenText,
      romanText: fallback.romanText,
      audioData: null,
      mimeType: null,
      voiceName: req.body?.voiceName || 'Fenrir',
      latencyMs: Date.now() - startTime,
    });
  }
});

// API: Standalone Text-to-Speech
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Fenrir', language = 'english' } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Missing text parameter' });
      return;
    }

    if (!apiKey) {
      res.json({ audioData: null, mimeType: null });
      return;
    }

    try {
      const isUrdu = language === 'urdu' || language === 'roman_urdu' || /[\u0600-\u06FF]/.test(text);
      const selectedVoice = isUrdu ? 'Kore' : (voiceName || 'Fenrir');

      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim(),
                speechMetadata: {
                  style: isUrdu
                    ? 'Warm, natural Pakistani Urdu accent'
                    : 'Articulate, refined British accent',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      res.json({ audioData, mimeType: 'audio/wav' });
    } catch {
      res.json({ audioData: null, mimeType: null });
    }
  } catch (error: any) {
    console.error('TTS API error:', error);
    res.json({ audioData: null, mimeType: null });
  }
});

// API: Transcribe audio fallback for recorded audio blobs
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: 'Missing audio data' });
      return;
    }

    if (!apiKey) {
      res.status(503).json({ error: 'Gemini API key is not configured.' });
      return;
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: audioBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          { text: 'Transcribe this user speech exactly. The speech may be in English, Urdu, or Roman Urdu. Return only the exact transcription text.' },
        ],
      },
    });

    res.json({ text: response.text?.trim() || '' });
  } catch (error: any) {
    console.error('Transcribe error:', error);
    res.status(500).json({ error: error?.message || 'Transcription error' });
  }
});

// System Status API
app.get('/api/system-status', (_req, res) => {
  res.json({
    system: 'J.A.R.V.I.S. OS Mark 85',
    languages: ['English', 'Urdu (اردو)', 'Roman Urdu'],
    status: 'ONLINE',
    neuralCore: 'Active',
    latencyMs: Math.floor(14 + Math.random() * 8),
    uptimeSeconds: process.uptime(),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    acousticProcessor: 'WebAudio Stereo 48kHz',
    activeProtocol: 'Veritas Protocol Level 4',
  });
});

// Serve frontend: Vite dev server or static build
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`JARVIS Multilingual Core initialized on http://0.0.0.0:${port}`);
  });
}

startServer();
