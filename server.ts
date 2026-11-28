import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(apiVersion?: string): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface CoachRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  contextSummary?: {
    rangeLabel?: string;
    totalLogged?: number;
    avgScore?: number | null;
    avgState?: string;
    streakDays?: number;
    burnoutScore?: number;
    burnoutZone?: string;
    avgSleepHours?: number;
    avgSleepQuality?: number;
    avgHrv?: number;
    avgRestingHr?: number;
    topDriver?: string;
    recentEntries?: Array<{
      date: string;
      emotion: string;
      score: number;
      tags: string[];
      note: string;
      source: string;
    }>;
  };
}

function fmtNum(val: unknown, digits = 1, fallback = 'N/A'): string {
  return typeof val === 'number' && Number.isFinite(val) ? val.toFixed(digits) : fallback;
}

function safeText(val: unknown, maxLen: number, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const cleaned = val.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLen) : fallback;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/coach', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const body = req.body as CoachRequestBody;
      const sanitizedMessages = Array.isArray(body?.messages)
        ? body.messages
            .filter(
              (m) =>
                m &&
                (m.role === 'user' || m.role === 'assistant') &&
                typeof m.content === 'string' &&
                m.content.trim().length > 0
            )
            .slice(-20)
        : [];

      if (sanitizedMessages.length === 0) {
        res.status(400).json({ error: 'A non-empty messages array is required.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Gemini API key is not configured on the server. Please configure GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const ctx = body.contextSummary;
      const rangeLabel = safeText(ctx?.rangeLabel, 64, 'Last 7 days');
      const avgState = safeText(ctx?.avgState, 64, 'Steady');
      const burnoutZone = safeText(ctx?.burnoutZone, 64, 'Balanced');
      const topDriver = safeText(ctx?.topDriver, 80, 'No tags yet');

      const recentList = (Array.isArray(ctx?.recentEntries) ? ctx.recentEntries : [])
        .slice(0, 8)
        .map((e) => {
          const scoreStr = fmtNum(e?.score, 1, '—');
          const tagsStr =
            Array.isArray(e?.tags) && e.tags.length > 0
              ? e.tags
                  .slice(0, 8)
                  .map((t) => safeText(t, 32, ''))
                  .filter(Boolean)
                  .join(', ') || 'No tags'
              : 'No tags';
          const cleanedNote = safeText(e?.note, 280, '');
          const noteStr = cleanedNote ? ` — "${cleanedNote}"` : '';
          return `- ${safeText(e?.date, 32, 'Unknown')}: ${safeText(e?.emotion, 48, 'Check-in')} (${scoreStr}/5.0) [${tagsStr}]${noteStr} (${safeText(e?.source, 24, 'manual')})`;
        })
        .join('\n');

      const avgScoreText =
        typeof ctx?.avgScore === 'number' && Number.isFinite(ctx.avgScore) && (ctx?.totalLogged ?? 0) > 0
          ? `${ctx.avgScore.toFixed(1)}/5.0 (${avgState})`
          : 'No check-ins logged yet';

      const systemInstruction = `You are WELLBE+ Coach, a calm, evidence-informed emotional well-being and somatic regulation companion.
Your tone is warm, grounded, concise, adult-oriented, and non-clinical (you are a supportive wellness coach, not a diagnosing doctor).

USER'S LIVE TELEMETRY & LOGGED DATA (${rangeLabel}):
- Total check-ins logged: ${fmtNum(ctx?.totalLogged, 0, '0')}
- Active check-in streak: ${fmtNum(ctx?.streakDays, 0, '0')} days
- 7-Day Mood Average: ${avgScoreText}
- Burnout Resilience Index: ${fmtNum(ctx?.burnoutScore, 0)}/100 (${burnoutZone})
- Pixel Watch Biometrics (7-day avg): Sleep ${fmtNum(ctx?.avgSleepHours, 1)}h (quality ${fmtNum(ctx?.avgSleepQuality, 0)}/100), Est. HRV ${fmtNum(ctx?.avgHrv, 0)} ms, Resting HR ${fmtNum(ctx?.avgRestingHr, 0)} bpm
- Top Uplifting Driver: ${topDriver}

RECENT MOOD CHECK-INS:
${recentList || '- No recent entries logged yet.'}

GUIDELINES:
1. Ground every response in the user's actual logged emotions, tags, notes, and Pixel Watch biometrics above. Explicitly cite specific numbers or days when noticing a pattern.
2. When appropriate, recommend one of the user's built-in WELLBE+ somatic protocols by exact name: "4-7-8 Calm Breathing", "Sunlight & Stretch", "Mindful Grounding Scan", "Savoring Ritual", "Gratitude Capture", or "Voice Panic Anchor".
3. Keep responses scannable and calm (2–4 short paragraphs or a brief structured reflection with clear next steps, under 220 words). Avoid exclamation-mark hype, clichés, or emojis.
4. Clearly distinguish observed data ("Based on your last 7 days...") from supportive suggestions.`;

      const formattedContents = sanitizedMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content.trim().slice(0, 4000) }],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: formattedContents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'Received an empty response from the coach model.' });
        return;
      }

      const avgCitation =
        typeof ctx?.avgScore === 'number' && Number.isFinite(ctx.avgScore) && (ctx?.totalLogged ?? 0) > 0
          ? `${ctx.avgScore.toFixed(1)}/5.0 avg`
          : 'No logs yet';

      res.json({
        reply,
        citations: [
          `${safeText(ctx?.rangeLabel, 64, '7-day window')} · ${avgCitation}`,
          `Sleep ${fmtNum(ctx?.avgSleepHours, 1, '—')}h · HRV ${fmtNum(ctx?.avgHrv, 0, '—')} ms`,
          `Burnout index ${fmtNum(ctx?.burnoutScore, 0, '—')}/100`,
        ],
      });
    } catch (err: unknown) {
      console.error('WELLBE+ Coach error:', err);
      res.status(500).json({ error: 'Unable to reach WELLBE+ Coach right now. Please try again.' });
    }
  });

  // In-memory LRU cache for calm female voiceover clips (instant replay for breathing & grounding cues)
  const ttsCache = new Map<string, { audioBase64: string; mimeType: string }>();
  const TTS_CACHE_MAX = 48;

  app.post('/api/tts', async (req, res) => {
    try {
      const rawText = typeof req.body?.text === 'string' ? req.body.text : '';
      const text = rawText.replace(/\s+/g, ' ').trim().slice(0, 1200);
      if (!text) {
        res.status(400).json({ error: 'A non-empty text field is required.' });
        return;
      }

      const profile = req.body?.profile === 'sanctuary' ? 'sanctuary' : 'default';
      const cacheKey = `${profile}::${text}`;

      const cached = ttsCache.get(cacheKey);
      if (cached) {
        // Refresh LRU order
        ttsCache.delete(cacheKey);
        ttsCache.set(cacheKey, cached);
        res.json(cached);
        return;
      }

      // Gemini TTS fields (speechConfig / speechMetadata) require v1beta
      const ai = getGeminiClient('v1beta');
      if (!ai) {
        res.status(503).json({
          error:
            'Gemini API key is not configured on the server. Please configure GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const voiceStyle =
        profile === 'sanctuary'
          ? "Deeply calm, soft-spoken, gentle, and tender woman's voice; warm, hushed, reassuring mindfulness guide speaking slowly with unhurried pauses, soft breathy warmth, and zero sharpness or urgency"
          : "Calm, gentle, warm, soothing woman's voice speaking softly at a relaxed, reassuring pace";

      const voiceName = profile === 'sanctuary' ? 'Vindemiatrix' : 'Kore';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: voiceStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const audioBase64 = inlineData?.data;
      const mimeType = inlineData?.mimeType || 'audio/wav';

      if (!audioBase64) {
        res.status(502).json({ error: 'No audio payload returned from speech synthesis model.' });
        return;
      }

      const payload = { audioBase64, mimeType };
      if (ttsCache.size >= TTS_CACHE_MAX) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey !== undefined) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, payload);

      res.json(payload);
    } catch (err: unknown) {
      console.error('WELLBE+ TTS error:', err);
      res.status(500).json({ error: 'Unable to generate voiceover audio right now.' });
    }
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  // Prevent non-Vercel dev/production servers from returning index.html for Vercel Analytics script requests
  app.use('/_vercel', (_req, res) => {
    res.status(404).end();
  });

  // Return JSON errors for malformed JSON payloads instead of Express default HTML stack traces
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 400) {
      if (req.path.startsWith('/api/')) {
        res.status(400).json({ error: 'Invalid JSON request payload.' });
        return;
      }
    }
    next(err);
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: disableHmr ? false : { server: httpServer },
        hmr: !disableHmr,
        watch: disableHmr ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (/\.[a-z0-9]{1,8}$/i.test(req.path) && !req.path.endsWith('.html')) {
        res.status(404).end();
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`WELLBE+ server listening on http://localhost:${PORT}`);
  });
}

startServer();
