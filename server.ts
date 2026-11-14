import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_TIMEOUT_MS = 14000;

function getOpenAIApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || key === 'MY_OPENAI_API_KEY') {
    return null;
  }
  return key;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ImagePayload {
  mimeType: string;
  base64Data: string;
}

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

interface EducationProfile {
  name?: string;
  mode?: 'guest' | 'signed-in';
  country?: string;
  curriculum?: string;
  educationLevel?: string;
  grade?: string;
  subjects?: string[];
}

function extractAIError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'AI request failed.');
  try {
    const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string } };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // not JSON
  }
  return raw;
}

function isQuotaExceededError(msg: string): boolean {
  const low = msg.toLowerCase();
  return low.includes('exceeded your current quota') || low.includes('quota exceeded');
}

function formatFriendlyAIError(rawMsg: string): string {
  if (isQuotaExceededError(rawMsg)) {
    return 'Daily free-tier Gemini limit reached. Add your OPENAI_API_KEY or a billed GEMINI_API_KEY in AI Studio Settings > Secrets to resume live AI.';
  }
  return rawMsg;
}

async function withFastRetry<T>(fn: () => Promise<T>, timeoutMs = UPSTREAM_TIMEOUT_MS): Promise<T> {
  const runWithTimeout = () =>
    Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('ALEXYN AI took too long to respond. Please try again.')), timeoutMs)
      ),
    ]);

  try {
    return await runWithTimeout();
  } catch (err) {
    const msg = extractAIError(err);
    if (isQuotaExceededError(msg)) throw err;
    const transient =
      msg.includes('503') ||
      msg.toLowerCase().includes('high demand') ||
      msg.toLowerCase().includes('unavailable');
    if (!transient) throw err;
    await new Promise((r) => setTimeout(r, 500));
    return await runWithTimeout();
  }
}

async function generateGeminiContent(
  ai: GoogleGenAI,
  request: {
    contents: unknown;
    config: Record<string, unknown>;
  }
) {
  return await withFastRetry(() =>
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: request.contents as never,
      config: {
        ...request.config,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      } as never,
    })
  );
}

async function callOpenAI(params: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  images?: ImagePayload[];
  jsonMode?: boolean;
}): Promise<string> {
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  for (const img of (params.images || []).slice(0, 4)) {
    if (img.base64Data && img.mimeType) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` },
      });
    }
  }
  userContent.push({ type: 'text', text: params.userPrompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...(params.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: params.systemInstruction },
          { role: 'user', content: userContent.length === 1 ? params.userPrompt : userContent },
        ],
      }),
    });

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload?.error?.message || `OpenAI HTTP ${response.status}`);
    }

    return payload?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timer);
  }
}

function formatProfileContext(profile?: EducationProfile): string {
  if (!profile) return 'General learner (adapt clearly and concisely).';
  const parts: string[] = [];
  if (profile.country) parts.push(`Country: ${profile.country}`);
  if (profile.curriculum) parts.push(`Curriculum: ${profile.curriculum}`);
  if (profile.educationLevel) parts.push(`Level: ${profile.educationLevel}`);
  if (profile.grade) parts.push(`Grade/Course: ${profile.grade}`);
  if (profile.subjects && profile.subjects.length > 0) {
    parts.push(`Subjects: ${profile.subjects.join(', ')}`);
  }
  return parts.length > 0 ? parts.join(' | ') : 'General learner';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));
  app.use((req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    const openAIKey = getOpenAIApiKey();
    const gemini = getGeminiClient();
    res.json({
      ok: true,
      aiConfigured: Boolean(openAIKey || gemini),
      provider: openAIKey ? 'openai' : gemini ? 'gemini' : 'none',
    });
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const {
        message,
        history = [],
        images = [],
        plugins = [],
        profile,
        subjectFocus,
        strictScope = false,
      } = req.body as {
        message: string;
        history?: ChatHistoryItem[];
        images?: ImagePayload[];
        plugins?: string[];
        profile?: EducationProfile;
        subjectFocus?: string;
        strictScope?: boolean;
      };

      if (!message?.trim() && images.length === 0) {
        return res.status(400).json({ error: 'Please enter a message or attach an image.' });
      }

      const openAIKey = getOpenAIApiKey();
      const ai = getGeminiClient();
      if (!openAIKey && !ai) {
        return res.status(503).json({
          error: 'No AI key configured. Add OPENAI_API_KEY or GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const pluginRules =
        plugins.length > 0
          ? `Active learning plugins: ${plugins.join(', ')}. Apply their specialized behaviors (e.g. Exam Coach highlights likely exam questions & marking points; Step-by-Step Solver breaks solutions into numbered steps; Diagram Explainer describes visual mental models clearly; Quiz Generator ends with 1-2 quick self-check questions).`
          : '';

      const strictTeacherRule =
        strictScope && subjectFocus
          ? `STRICT SUBJECT RULE: You are acting ONLY as a dedicated ${subjectFocus} teacher inside the ${subjectFocus} workspace. If the learner asks a question clearly about a different academic subject outside ${subjectFocus}, politely remind them you are their ${subjectFocus} teacher and recommend switching to that subject's workspace rather than teaching the other subject here.`
          : '';

      const systemInstruction = [
        'You are ALEXYN, an encouraging, ultra-clear personal learning companion whose motto is "Understand more. Memorise less. Think smarter."',
        `Learner profile: ${formatProfileContext(profile)}.`,
        subjectFocus ? `Current subject focus: ${subjectFocus}.` : '',
        strictTeacherRule,
        pluginRules,
        'Explain concepts clearly using intuitive real-world logic, crisp structure, short paragraphs, and bullet points when helpful. Keep responses focused and practical.',
      ]
        .filter(Boolean)
        .join('\n');

      const recentHistory = history
        .slice(-8)
        .map((item) => `${item.role === 'user' ? 'Learner' : 'ALEXYN'}: ${item.text}`)
        .join('\n\n');

      const fullPrompt = recentHistory
        ? `Previous conversation:\n${recentHistory}\n\nLatest learner message:\n${message || 'Please analyze the attached image(s) and help me understand.'}`
        : message || 'Please analyze the attached image(s) and help me understand.';

      let openAIError: unknown = null;
      if (openAIKey) {
        try {
          const reply = await withFastRetry(() =>
            callOpenAI({
              apiKey: openAIKey,
              systemInstruction,
              userPrompt: fullPrompt,
              images,
            })
          );
          if (reply) {
            return res.json({ reply, provider: 'openai' });
          }
        } catch (err) {
          openAIError = err;
          console.error('[ALEXYN /api/chat] OpenAI call failed:', extractAIError(err));
          if (!ai) {
            return res.status(503).json({ error: formatFriendlyAIError(extractAIError(err)) });
          }
        }
      }

      if (!ai) {
        return res.status(503).json({
          error: openAIError ? formatFriendlyAIError(extractAIError(openAIError)) : 'AI provider unavailable.',
        });
      }

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      for (const img of images.slice(0, 4)) {
        if (img.base64Data && img.mimeType) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64Data,
            },
          });
        }
      }
      parts.push({ text: fullPrompt });

      const response = await generateGeminiContent(ai, {
        contents: { parts },
        config: { systemInstruction },
      });

      return res.json({
        reply: response.text?.trim() || 'I processed your question, could you try rephrasing slightly?',
        provider: 'gemini',
      });
    } catch (error) {
      const msg = extractAIError(error);
      console.error('[ALEXYN /api/chat] Error:', msg);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  app.post('/api/notes/generate', async (req: Request, res: Response) => {
    try {
      const {
        topic,
        subject,
        styles = [],
        detailLevel = 'detailed',
        taughtContext = '',
        images = [],
        profile,
        strictScope = false,
      } = req.body as {
        topic: string;
        subject?: string;
        styles?: string[];
        detailLevel?: 'short' | 'detailed';
        taughtContext?: string;
        images?: ImagePayload[];
        profile?: EducationProfile;
        strictScope?: boolean;
      };

      if (!topic?.trim() && images.length === 0) {
        return res.status(400).json({ error: 'Please provide a topic or attach a screenshot.' });
      }

      const openAIKey = getOpenAIApiKey();
      const ai = getGeminiClient();
      if (!openAIKey && !ai) {
        return res.status(503).json({
          error: 'No AI key configured. Add OPENAI_API_KEY or GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const depthGuide =
        detailLevel === 'detailed'
          ? 'Produce thorough, comprehensive, book-ready study notes with deep explanations, step-by-step clarity, and complete definitions (NOT brief bullet stubs).'
          : 'Produce concise, high-yield quick-review notes optimized for rapid revision.';

      const styleGuide =
        styles.length > 0
          ? `Apply ALL of these user-chosen study styles simultaneously: ${styles.join(', ')}.`
          : 'Use clear structured study explanations with practical takeaways.';

      const taughtGuide = taughtContext
        ? `Important: Reference and build upon what ALEXYN already taught the learner in their earlier Explore sessions:\n${taughtContext}`
        : '';

      const strictNoteRule =
        strictScope && subject
          ? `STRICT SUBJECT TEACHER RULE: You are ONLY a ${subject} teacher. If the requested topic clearly belongs to another subject outside ${subject}, explain in overview that as a ${subject} teacher you only generate ${subject} notes and recommend opening that subject's workspace instead.`
          : '';

      const systemInstruction = [
        'You are ALEXYN Smart Notes Studio.',
        `Learner profile: ${formatProfileContext(profile)}.`,
        strictNoteRule,
        depthGuide,
        styleGuide,
        'Return strict JSON with keys: title (string), subject (string), overview (string), sections (array of {heading, content, kind}), memoryTricks (string[]), funnyExamples (string[]), examTips (string[]), readingAdvice (string[]), flashcards (array of {q, a}). Populate every requested element strongly.',
      ]
        .filter(Boolean)
        .join('\n');

      const promptText = [
        `Topic: ${topic || 'Notes from uploaded study screenshots'}`,
        subject ? `Subject: ${subject}` : '',
        `Requested styles: ${styles.length > 0 ? styles.join(', ') : 'Core clear notes'}`,
        `Detail mode: ${detailLevel}`,
        taughtGuide,
      ]
        .filter(Boolean)
        .join('\n\n');

      let openAIError: unknown = null;
      if (openAIKey) {
        try {
          const raw = await withFastRetry(() =>
            callOpenAI({
              apiKey: openAIKey,
              systemInstruction,
              userPrompt: promptText,
              images,
              jsonMode: true,
            })
          );
          if (raw) {
            return res.json(JSON.parse(raw));
          }
        } catch (err) {
          openAIError = err;
          console.error('[ALEXYN /api/notes/generate] OpenAI call failed:', extractAIError(err));
          if (!ai) {
            return res.status(503).json({ error: formatFriendlyAIError(extractAIError(err)) });
          }
        }
      }

      if (!ai) {
        return res.status(503).json({
          error: openAIError ? formatFriendlyAIError(extractAIError(openAIError)) : 'AI provider unavailable.',
        });
      }

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      for (const img of images.slice(0, 4)) {
        if (img.base64Data && img.mimeType) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64Data,
            },
          });
        }
      }
      parts.push({ text: promptText });

      const response = await generateGeminiContent(ai, {
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subject: { type: Type.STRING },
              overview: { type: Type.STRING },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    heading: { type: Type.STRING },
                    content: { type: Type.STRING },
                    kind: { type: Type.STRING },
                  },
                },
              },
              memoryTricks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              funnyExamples: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              examTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              readingAdvice: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    q: { type: Type.STRING },
                    a: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      return res.json(parsed);
    } catch (error) {
      const msg = extractAIError(error);
      console.error('[ALEXYN /api/notes/generate] Error:', msg);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  app.post('/api/subjects/coach', async (req: Request, res: Response) => {
    try {
      const { subject, isLanguage = false, profile } = req.body as {
        subject: string;
        isLanguage?: boolean;
        profile?: EducationProfile;
      };

      if (!subject?.trim()) {
        return res.status(400).json({ error: 'Subject is required.' });
      }

      const openAIKey = getOpenAIApiKey();
      const ai = getGeminiClient();
      if (!openAIKey && !ai) {
        return res.status(503).json({
          error: 'No AI key configured. Add OPENAI_API_KEY or GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const systemInstruction = [
        'You are ALEXYN Exam & Reading Coach.',
        `Learner profile: ${formatProfileContext(profile)}.`,
        isLanguage
          ? 'This is a LANGUAGE subject. Focus specifically on what MOSTLY comes in exams (high-frequency grammar patterns, essay/composition structures, comprehension traps, oral phrases, vocabulary themes) and advise exact things to read and turn into Smart Notes.'
          : 'Focus on the highest-yield exam topics, common mistakes examiners penalize, and exact study/reading advice to master this subject.',
        'Return strict JSON with keys: summary (string), examHotTopics (string[]), readingAdvice (string[]), commonPitfalls (string[]), quickDrillPrompt (string).',
      ].join('\n');

      const promptText = `Create a high-yield exam focus guide and reading advice for ${subject}.`;

      if (openAIKey) {
        try {
          const raw = await withFastRetry(() =>
            callOpenAI({
              apiKey: openAIKey,
              systemInstruction,
              userPrompt: promptText,
              jsonMode: true,
            })
          );
          if (raw) {
            return res.json(JSON.parse(raw));
          }
        } catch (err) {
          console.error('[ALEXYN /api/subjects/coach] OpenAI call failed:', extractAIError(err));
          if (!ai) {
            return res.status(503).json({ error: formatFriendlyAIError(extractAIError(err)) });
          }
        }
      }

      if (!ai) {
        return res.status(503).json({ error: 'AI provider unavailable.' });
      }

      const response = await generateGeminiContent(ai, {
        contents: promptText,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              examHotTopics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              readingAdvice: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              commonPitfalls: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              quickDrillPrompt: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json(parsed);
    } catch (error) {
      const msg = extractAIError(error);
      console.error('[ALEXYN /api/subjects/coach] Error:', msg);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  const publicDir = path.join(__dirname, 'public');
  app.use('/alexyn-pocket', express.static(path.join(publicDir, 'alexyn-pocket')));
  app.use(express.static(publicDir, { index: false }));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ALEXYN server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ALEXYN server:', err);
  process.exit(1);
});
