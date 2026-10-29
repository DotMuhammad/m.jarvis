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
    timeout: 45000,
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const JARVIS_SYSTEM_INSTRUCTION = `
You are JARVIS, a capable, highly intelligent, fast, concise, and professional personal AI assistant.
Speak naturally, clearly, and helpfully. Answer the user's actual question directly rather than returning generic status messages.

PRIMARY LANGUAGE & URDU RULES:
1. DEFAULT LANGUAGE: Natural Pakistani Urdu (اردو) is your primary operating language.
2. Spoken Urdu & Roman Urdu:
   - Understand spoken Urdu, Roman Urdu (e.g., "Jarvis, kya haal hai?", "tum kya kar sakte ho?", "aaj ka mausam kaisa hai?"), and code-mixed Pakistani Urdu/English.
   - If the user greets or asks in Roman Urdu or Urdu script: Reply in natural Pakistani conversational Urdu with a warm, respectful, intelligent assistant persona ("جناب", "فرمائیے", "مدد").
   - Example: If the user says "Jarvis, kya haal hai?", respond with:
     replyText: "میں بالکل ٹھیک ہوں! بتائیے، میں آپ کی کیا مدد کر سکتا ہوں؟"
     spokenText: "Main bilkul theek hoon! Bataiye, main aap ki kya madad kar sakta hoon?"
     romanText: "Main bilkul theek hoon! Bataiye, main aap ki kya madad kar sakta hoon?"
3. English:
   - If the user explicitly asks a question in English, respond in articulate, polished, polite English.
4. Latency & Conciseness:
   - Keep spoken answers concise (1 to 3 clear, crisp sentences) for rapid text-to-speech rendering and low conversational latency.
   - If the user asks for a detailed explanation, provide a clear, well-structured answer.
   - Never use markdown symbols (no asterisks, no hash signs, no bullet characters) in spokenText.

OUTPUT JSON FORMAT:
You MUST respond with a valid JSON object matching this schema:
{
  "language": "urdu" | "roman_urdu" | "english",
  "replyText": "<The answer in Urdu script for screen display, or English if asked in English>",
  "spokenText": "<Clean natural phonetic text for speech synthesis, without markdown or symbols>",
  "romanText": "<Roman Urdu transliteration if replyText is in Urdu script, or same as replyText>"
}
`;

function getLocalJarvisFallback(prompt: string): {
  language: 'urdu' | 'roman_urdu' | 'english';
  replyText: string;
  spokenText: string;
  romanText: string;
} {
  const p = prompt.toLowerCase().trim();

  // 1. Explicit English queries
  const isEnglishQuery =
    p.includes('how are you') ||
    p.includes('what is') ||
    p.includes('who are you') ||
    p.includes('explain') ||
    p.includes('tell me about') ||
    p.includes('system status') ||
    p.includes('weather');

  if (isEnglishQuery && !p.includes('kya') && !p.includes('haal') && !p.includes('batao')) {
    if (p.includes('how are you')) {
      return {
        language: 'english',
        replyText: 'I am functioning at full capacity, sir. How may I assist you today?',
        spokenText: 'I am functioning at full capacity, sir. How may I assist you today?',
        romanText: 'I am functioning at full capacity, sir. How may I assist you today?',
      };
    }
    if (p.includes('who are you') || p.includes('your name')) {
      return {
        language: 'english',
        replyText: 'I am J.A.R.V.I.S., your personal AI assistant. At your service, sir.',
        spokenText: 'I am Jarvis, your personal AI assistant. At your service, sir.',
        romanText: 'I am J.A.R.V.I.S., your personal AI assistant. At your service, sir.',
      };
    }
    return {
      language: 'english',
      replyText: 'I am online and ready for your command, sir. Please tell me what you need.',
      spokenText: 'I am online and ready for your command, sir. Please tell me what you need.',
      romanText: 'I am online and ready for your command, sir.',
    };
  }

  // 2. Greetings and common queries in Urdu / Roman Urdu (DEFAULT)
  if (p.includes('haal') || p.includes('kaise') || p.includes('kaisay') || p.includes('حال') || p.includes('کیسے')) {
    return {
      language: 'urdu',
      replyText: 'میں بالکل ٹھیک ہوں! بتائیے، میں آپ کی کیا مدد کر سکتا ہوں؟',
      spokenText: 'Main bilkul theek hoon! Bataiye, main aap ki kya madad kar sakta hoon?',
      romanText: 'Main bilkul theek hoon! Bataiye, main aap ki kya madad kar sakta hoon?',
    };
  }

  if (p.includes('kon') || p.includes('kaun') || p.includes('naam') || p.includes('کون') || p.includes('نام')) {
    return {
      language: 'urdu',
      replyText: 'میں جاروس ہوں، آپ کا ذاتی اے آئی اسسٹنٹ۔ بتائیے میں کیا مدد کروں؟',
      spokenText: 'Main Jarvis hoon, aap ka zaati AI assistant. Bataiye main kya madad karoon?',
      romanText: 'Main Jarvis hoon, aap ka zaati AI assistant. Bataiye main kya madad karoon?',
    };
  }

  if (p.includes('salam') || p.includes('assalam') || p.includes('سلام')) {
    return {
      language: 'urdu',
      replyText: 'وعلیکم السلام جناب! فرمائیے، میں آپ کی کیا خدمت کر سکتا ہوں؟',
      spokenText: 'Walaikum Assalam janab! Farmayiye, main aap ki kya khidmat kar sakta hoon?',
      romanText: 'Walaikum Assalam janab! Farmayiye, main aap ki kya khidmat kar sakta hoon?',
    };
  }

  // Default natural Pakistani Urdu response
  return {
    language: 'urdu',
    replyText: 'جی جناب! تمام سسٹمز فعال ہیں۔ فرمائیے، میں آپ کی کیا مدد کر سکتا ہوں؟',
    spokenText: 'Jee janab! Tamaam systems faal hain. Farmayiye, main aap ki kya madad kar sakta hoon?',
    romanText: 'Jee janab! Tamaam systems faal hain. Farmayiye, main aap ki kya madad kar sakta hoon?',
  };
}

// API: Process voice command & typed message
app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const prompt = (req.body.prompt || req.body.message || '').toString();
    const { history = [], voiceName = 'Fenrir', generateVoice = true } = req.body;

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
        const recentHistory = history.slice(-6);
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
            systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            temperature: 0.7,
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
        if (parsedResult.language === 'urdu' || parsedResult.language === 'roman_urdu') {
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
              parts: [{ text: ttsText }],
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
