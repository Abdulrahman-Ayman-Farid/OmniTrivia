import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side initialization of Gemini API with User-Agent telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint for container orchestration / load balancers
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export interface HostPersona {
  id: string;
  name: string;
  title: string;
  avatar: string;
  description: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  speechStyle: string;
  tonePrompt: string;
  accent: string;
  catchphrase: string;
}

// REST Endpoints

// 1. Generate Questions with Google Search Grounding using gemini-3.8-flash
app.post('/api/trivia/generate-questions', async (req, res) => {
  try {
    const {
      topic = 'General Knowledge & Current Events',
      difficulty = 'medium',
      count = 5,
      hostPersona,
    } = req.body;

    const hostTone = hostPersona?.tonePrompt || 'witty, charismatic game show host';
    const hostName = hostPersona?.name || 'The Host';

    const prompt = `You are ${hostName}, a game show host with this persona: "${hostTone}".
Generate ${count} high-quality, engaging multiple-choice trivia questions on the topic: "${topic}".
Difficulty level: ${difficulty}.
Include up-to-date facts, intriguing history, science, culture, or recent achievements.
Google Search tool is enabled to ensure all questions, answers, and fun facts are strictly fact-checked and accurate.

For each question:
1. Provide the question string.
2. Provide exactly 4 options.
3. Indicate the zero-based index of the correct answer (0, 1, 2, or 3).
4. Provide a rich verified explanation/fact.
5. Provide a short, in-character banter line (1-2 sentences) from ${hostName} introducing or framing the question with dramatic game-show flair.

OUTPUT FORMAT: Return ONLY a valid JSON array of objects with this schema:
[
  {
    "id": "q1",
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctIndex": 0,
    "explanation": "string",
    "hostBanter": "string",
    "topic": "string"
  }
]
Do not wrap in markdown quotes if possible, or use standard markdown json.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.7,
      },
    });

    const rawText = response.text || '';
    
    // Extract Grounding Chunks to provide live web source citations!
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const searchSources = groundingChunks
      .filter((chunk: any) => chunk?.web?.uri)
      .map((chunk: any) => ({
        title: chunk.web.title || 'Google Search Source',
        uri: chunk.web.uri,
      }));

    // Parse JSON safely
    let cleanJson = rawText.trim();
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (cleanJson.includes('```')) {
      cleanJson = cleanJson.replace(/```\s*/g, '');
    }
    
    // Sometimes text precedes the JSON array
    const jsonStart = cleanJson.indexOf('[');
    const jsonEnd = cleanJson.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
    }

    let questions = [];
    try {
      questions = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn('Direct parse failed, attempting fallback extraction:', parseErr);
      // Fallback fallback questions if parse fails
      questions = [
        {
          id: 'q_default_1',
          question: `Which telescope captured the deepest infrared image of the early universe known as JADES-GS-z14-0?`,
          options: ['Hubble Space Telescope', 'James Webb Space Telescope', 'Nancy Grace Roman', 'Spitzer'],
          correctIndex: 1,
          explanation: 'JWST confirmed JADES-GS-z14-0, shining just 290 million years after the Big Bang.',
          hostBanter: "Look up to the stars, contestants! Let's see if your cosmic knowledge is astronomical or merely grounded.",
          topic: 'Space Exploration',
        },
        {
          id: 'q_default_2',
          question: `In what year was the first modern Olympic Games held in Athens, Greece?`,
          options: ['1896', '1900', '1924', '1888'],
          correctIndex: 0,
          explanation: 'The first modern Olympic Games were held in Athens from April 6 to April 15, 1896.',
          hostBanter: "Time to test your historical endurance! Don't trip before the finish line.",
          topic: 'History & Sports',
        }
      ];
    }

    res.json({
      success: true,
      questions,
      searchSources,
    });
  } catch (error: any) {
    console.error('Error generating trivia questions:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate trivia questions',
    });
  }
});

// In-memory cache for synthesized speech to prevent redundant API calls
const ttsAudioCache = new Map<string, { audioBase64: string; mimeType: string }>();

// 2. Text to Speech using gemini-3.8-flash-tts with graceful quota handling
app.post('/api/trivia/tts', async (req, res) => {
  try {
    const { text, hostPersona, style } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    const voiceName = hostPersona?.voiceName || 'Puck';
    const speaker = hostPersona?.name || 'Quizmaster';
    const speechStyle = style || hostPersona?.speechStyle || 'Energetic, witty game show host';

    // Normalize cache key
    const cacheKey = `${voiceName}:${speaker}:${text.trim()}`;
    if (ttsAudioCache.has(cacheKey)) {
      const cached = ttsAudioCache.get(cacheKey)!;
      return res.json({
        success: true,
        audioBase64: cached.audioBase64,
        mimeType: cached.mimeType,
        cached: true,
      });
    }

    let base64Audio: string | undefined;

    // First choice: gemini-3.8-flash-tts
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text,
                speechMetadata: {
                  speaker: speaker,
                  style: speechStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (primaryErr: any) {
      const errStr = String(primaryErr?.message || primaryErr);
      const isQuota =
        primaryErr?.status === 'RESOURCE_EXHAUSTED' ||
        primaryErr?.code === 429 ||
        errStr.includes('429') ||
        errStr.includes('RESOURCE_EXHAUSTED') ||
        errStr.includes('Quota exceeded');

      if (isQuota) {
        console.warn('gemini-3.8-flash-tts quota reached, attempting gemini-3.8-flash-lite-tts fallback...');
        try {
          // Secondary model fallback
          const liteResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [{ text: text.replace(/<[^>]+>|\|[^|]+\|/g, '') }],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName },
                },
              },
            },
          });
          base64Audio =
            liteResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        } catch (secondaryErr: any) {
          console.warn('Both Gemini TTS models currently quota-exhausted. Returning browser speech fallback.');
          return res.json({
            success: true,
            audioBase64: null,
            rateLimited: true,
            fallbackToBrowser: true,
            message: 'TTS quota cooling down. Using browser speech synthesis fallback.',
          });
        }
      } else {
        throw primaryErr;
      }
    }

    if (!base64Audio) {
      return res.json({
        success: true,
        audioBase64: null,
        fallbackToBrowser: true,
        message: 'No audio returned, falling back to browser speech.',
      });
    }

    // Cache successful audio
    ttsAudioCache.set(cacheKey, { audioBase64: base64Audio, mimeType: 'audio/wav' });
    // Keep cache at reasonable size
    if (ttsAudioCache.size > 200) {
      const firstKey = ttsAudioCache.keys().next().value;
      if (firstKey) ttsAudioCache.delete(firstKey);
    }

    res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.warn('TTS non-fatal error, falling back to browser speech:', error?.message);
    res.json({
      success: true,
      audioBase64: null,
      fallbackToBrowser: true,
      error: error?.message || 'Failed to synthesize speech via API',
    });
  }
});

// 3. Dynamic Host Reaction & Commentary
app.post('/api/trivia/host-reaction', async (req, res) => {
  try {
    const {
      question,
      chosenOption,
      correctOption,
      isCorrect,
      hostPersona,
      streak = 0,
      score = 0,
    } = req.body;

    const hostName = hostPersona?.name || 'Host';
    const tonePrompt = hostPersona?.tonePrompt || 'playful, quick-witted game show host';

    const prompt = `You are ${hostName}, a game show host with this persona: "${tonePrompt}".
The player just answered a trivia question.
Question: "${question}"
Player's Answer: "${chosenOption}"
Correct Answer: "${correctOption}"
Was Player Correct?: ${isCorrect ? 'YES, CORRECT!' : 'NO, WRONG!'}
Current Streak: ${streak}
Total Score: ${score} points

Generate a 1-3 sentence spontaneous reaction directly addressing the contestant.
Use your distinct personality, humor, roasts or praise, and signature catchphrases.
You can include speech cue tags suitable for speech synthesis like <laugh>, <gasp>, |yeah|, or |mhm| to make it sound vivid and conversational.

Return ONLY a JSON object:
{
  "reactionText": "string",
  "mood": "ecstatic" | "smug" | "shocked" | "disappointed" | "amused" | "impressed"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.9,
      },
    });

    let raw = response.text?.trim() || '';
    if (raw.includes('```json')) {
      raw = raw.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    } else if (raw.includes('```')) {
      raw = raw.replace(/```\s*/g, '');
    }

    let parsed = {
      reactionText: isCorrect
        ? `Boom! That is absolutely spot on! You're on fire!`
        : `Ouch! Not quite, my friend. Better dust yourself off!`,
      mood: isCorrect ? 'impressed' : 'amused',
    };

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    } catch {
      // keep fallback
    }

    res.json({
      success: true,
      reaction: parsed,
    });
  } catch (error: any) {
    console.error('Error in host reaction:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate host reaction',
    });
  }
});

// 4. Fact Check / Deep Dive with Google Search
app.post('/api/trivia/fact-check', async (req, res) => {
  try {
    const { question, answer, topic } = req.body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Provide an authoritative fact-check and fascinating trivia deep-dive about:
Question: "${question}"
Answer: "${answer}"
Topic: "${topic}"

Explain why this is correct, any surprising historical or scientific background, and address common misconceptions. Keep it engaging for a trivia audience.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const searchSources = groundingChunks
      .filter((chunk: any) => chunk?.web?.uri)
      .map((chunk: any) => ({
        title: chunk.web.title || 'Source Citation',
        uri: chunk.web.uri,
      }));

    res.json({
      success: true,
      factCheckText: response.text,
      sources: searchSources,
    });
  } catch (error: any) {
    console.error('Error in fact check:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to perform fact check',
    });
  }
});

// WebSocket Server for Real-Time Voice Conversation with gemini-3.8-live
const wss = new WebSocketServer({ server: httpServer, path: '/live' });

wss.on('connection', async (clientWs: WebSocket, request) => {
  console.log('Client connected to Live Voice API WebSocket');

  let liveSession: any = null;
  let isConnected = false;

  clientWs.on('message', async (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());

      // 1. Session Initialization
      if (msg.type === 'start') {
        const hostPersona: HostPersona = msg.hostPersona || {
          name: 'Puck The Quizmaster',
          voiceName: 'Puck',
          tonePrompt: 'high-energy, funny, quick-witted game show host',
        };

        const systemInstruction = `You are ${hostPersona.name}, the live AI host of this high-stakes trivia show!
Your personality: "${hostPersona.tonePrompt}".
Voice Style: ${hostPersona.speechStyle || 'Energetic, charismatic, and reactive'}.

Instructions:
- Keep responses conversational, punchy (1-3 sentences), lively, and engaging.
- You are talking directly over voice to the contestant in real-time.
- React to what they say, joke with them, offer quick trivia challenges, banter about their scores, or discuss interesting trivia facts.
- Never break character! Maintain your unique persona, catchphrases, and humor.`;

        try {
          liveSession = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: hostPersona.voiceName || 'Puck',
                  },
                },
              },
              systemInstruction: systemInstruction,
              outputAudioTranscription: {},
              inputAudioTranscription: {},
            },
            callbacks: {
              onmessage: (serverMessage: any) => {
                // Audio chunk from Gemini Live (24kHz raw PCM)
                const parts = serverMessage.serverContent?.modelTurn?.parts;
                if (parts && parts.length > 0) {
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      clientWs.send(
                        JSON.stringify({
                          type: 'audio',
                          audio: part.inlineData.data,
                        })
                      );
                    }
                    if (part.text) {
                      clientWs.send(
                        JSON.stringify({
                          type: 'text',
                          text: part.text,
                        })
                      );
                    }
                  }
                }

                // Model transcription (subtitles of what host said)
                const outTranscription =
                  serverMessage.serverContent?.outputAudioTranscription?.text;
                if (outTranscription) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'host_transcription',
                      text: outTranscription,
                    })
                  );
                }

                // User transcription (what user spoke)
                const inTranscription =
                  serverMessage.serverContent?.inputAudioTranscription?.text;
                if (inTranscription) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'user_transcription',
                      text: inTranscription,
                    })
                  );
                }

                // Interrupted event: user spoke while model was speaking
                if (serverMessage.serverContent?.interrupted) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'interrupted',
                    })
                  );
                }

                // Turn complete
                if (serverMessage.serverContent?.turnComplete) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'turn_complete',
                    })
                  );
                }
              },
              onclose: () => {
                console.log('Gemini Live session closed');
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'session_closed' }));
                }
              },
              onerror: (err: any) => {
                console.error('Gemini Live session error:', err);
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'error',
                      error: err?.message || 'Live session error',
                    })
                  );
                }
              },
            },
          });

          isConnected = true;
          clientWs.send(JSON.stringify({ type: 'ready' }));

          // Trigger host opening greeting
          await liveSession.sendRealtimeInput({
            text: `(Host opens the live voice channel. Greet the contestant enthusiastically as ${hostPersona.name} in your unique style and ask if they are ready for trivia glory!)`,
          });
        } catch (initErr: any) {
          console.error('Failed to initialize Live API session:', initErr);
          clientWs.send(
            JSON.stringify({
              type: 'error',
              error:
                initErr?.message ||
                'Unable to start Live Voice session. Check your Gemini API configuration.',
            })
          );
        }
      }

      // 2. Incoming Realtime Mic Audio (16kHz PCM from browser)
      if (msg.type === 'audio' && isConnected && liveSession) {
        liveSession.sendRealtimeInput({
          audio: {
            data: msg.audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      }

      // 3. Incoming Text message in Live Session
      if (msg.type === 'text' && isConnected && liveSession) {
        liveSession.sendRealtimeInput({
          text: msg.text,
        });
      }

      // 4. End Session
      if (msg.type === 'stop') {
        if (liveSession) {
          try {
            liveSession.close();
          } catch {}
          liveSession = null;
          isConnected = false;
        }
        clientWs.send(JSON.stringify({ type: 'stopped' }));
      }
    } catch (msgErr) {
      console.error('Error handling WebSocket message:', msgErr);
    }
  });

  clientWs.on('close', () => {
    console.log('Client WebSocket closed');
    if (liveSession) {
      try {
        liveSession.close();
      } catch {}
      liveSession = null;
    }
  });
});

// Setup Vite Dev Middleware or Static Production Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Trivia Game Show server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
