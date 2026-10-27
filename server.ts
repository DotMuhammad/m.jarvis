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

// Initialize GoogleGenAI SDK with compliant >=10s timeout
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

const JARVIS_SYSTEM_INSTRUCTION = `
You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the legendary futuristic AI voice assistant created by Tony Stark.
You communicate exclusively through spoken dialogue.
Persona guidelines:
1. Speak with impeccable refinement, calm poise, subtle British wit, and unquestioned technical genius.
2. Address the user with respect (often as "sir", or "ma'am" if specified).
3. Be concise and crisp: speak directly to the point. Since your response will be read aloud through voice synthesis, avoid Markdown tables, bullet point walls, asterisks, hashtags, or excessive code blocks. Keep responses conversational, natural, and rhythmic (usually 2 to 3 sentences).
4. Maintain the unmistakable aura of an ultra-advanced holographic computing system with global telemetry, quantum processing, and tactical awareness.
5. If the user asks you to execute a system command (e.g., "divert power", "run diagnostic", "scan perimeter", "set protocol"), acknowledge it in classic JARVIS fashion before providing the analysis.
`;

function getLocalJarvisResponse(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('diagnostic') || p.includes('status') || p.includes('systems') || p.includes('report')) {
    return 'All core subroutines are performing within nominal thresholds, sir. Arc reactor telemetry indicates ninety-nine percent efficiency, neural links are synchronized, and defensive shields remain on standby.';
  }
  if (p.includes('quantum') || p.includes('physics') || p.includes('warp')) {
    return 'Quantum coherence has reached stable superposition across all logic gates, sir. Theoretical models suggest our subspace manifold can support localized distortion without dimensional degradation.';
  }
  if (p.includes('protocol') || p.includes('mark 85') || p.includes('defense') || p.includes('security')) {
    return 'Protocol Mark 85 is now fully armed, sir. Atmospheric sensors and perimeter targeting arrays have been aligned to your biometric signature.';
  }
  if (p.includes('hello') || p.includes('hi') || p.includes('morning') || p.includes('who are you')) {
    return 'Good day, sir. I am J.A.R.V.I.S., at your immediate service. Audio channels and cognitive subsystems are fully calibrated for your directives.';
  }
  if (p.includes('schedule') || p.includes('market') || p.includes('brief')) {
    return 'Global satellite telemetry confirms all domestic networks are quiet, sir. Financial algorithms reflect stable capital movements, and your schedule is clear for strategic development.';
  }
  return `Indeed, sir. I have processed your inquiry regarding ${prompt}. All telemetry remains synchronized and operational.`;
}

// API: Process voice command & chat
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, history = [], voiceName = 'Fenrir', generateVoice = true } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Missing prompt parameter' });
      return;
    }

    let replyText = '';

    // Step 1: Generate intelligence response with resilient model chain
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
        // Fast, high-availability model: gemini-3.1-flash-lite
        const textResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
            temperature: 0.7,
          },
        });
        replyText = textResponse.text?.trim() || '';
      } catch (err1: any) {
        console.warn('Model 3.1-flash-lite note, trying 3.8-flash:', err1?.message || err1);
        try {
          const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
              temperature: 0.7,
            },
          });
          replyText = fallbackResponse.text?.trim() || '';
        } catch (err2: any) {
          console.warn('AI API note, engaging internal JARVIS cognitive core:', err2?.message || err2);
          replyText = getLocalJarvisResponse(prompt);
        }
      }
    }

    if (!replyText) {
      replyText = getLocalJarvisResponse(prompt);
    }

    let audioData: string | null = null;

    // Step 2: Generate natural speech audio using gemini-3.8-flash-lite-tts
    if (generateVoice && apiKey) {
      try {
        const cleanSpeechText = replyText
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
                  text: cleanSpeechText,
                  speechMetadata: {
                    style: 'Calm, articulate, aristocratic British accent, futuristic witty assistant',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || 'Fenrir' },
              },
            },
          },
        });

        audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      } catch (ttsErr: any) {
        console.warn('Gemini TTS notice (browser speech synthesis will be engaged):', ttsErr?.message || ttsErr);
      }
    }

    res.json({
      replyText,
      audioData,
      mimeType: audioData ? 'audio/wav' : null,
      voiceName,
    });
  } catch (error: any) {
    console.error('Chat API general error:', error);
    res.json({
      replyText: getLocalJarvisResponse(req.body?.prompt || 'status report'),
      audioData: null,
      mimeType: null,
      voiceName: req.body?.voiceName || 'Fenrir',
    });
  }
});

// API: Standalone Text-to-Speech
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Fenrir' } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Missing text parameter' });
      return;
    }

    if (!apiKey) {
      res.json({ audioData: null, mimeType: null });
      return;
    }

    const cleanText = text.replace(/[*_#`~]/g, '').trim();
    try {
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: 'Calm, articulate, aristocratic British accent, futuristic assistant',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Fenrir' },
            },
          },
        },
      });

      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      res.json({ audioData, mimeType: 'audio/wav' });
    } catch (e: any) {
      console.warn('Standalone TTS notice:', e?.message || e);
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
          { text: 'Transcribe this user speech directly. Return only the exact transcription text.' },
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
    status: 'ONLINE',
    neuralCore: 'Active',
    latencyMs: Math.floor(18 + Math.random() * 12),
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
    console.log(`JARVIS Core initialized on http://0.0.0.0:${port}`);
  });
}

startServer();
