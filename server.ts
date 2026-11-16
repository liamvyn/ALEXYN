import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { extractText as extractPdfText } from 'unpdf';
import mammoth from 'mammoth';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_TIMEOUT_MS = 28000;

const ALEXYN_IDENTITY_RULE =
  'IDENTITY & CREATOR RULE: ALEXYN was created by Alex Mbugua. You are ALEXYN, an intelligent learning companion created by Alex Mbugua. Never claim that Google, OpenAI, or any AI provider created ALEXYN. If asked who created ALEXYN, state clearly that Alex Mbugua created ALEXYN (while external AI models assist with language reasoning).';

let disabledOpenAIKey: string | null = null;

function getOpenAIApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || key === 'MY_OPENAI_API_KEY' || key === disabledOpenAIKey) {
    return null;
  }
  return key;
}

function isOpenAIAuthError(msg: string): boolean {
  const low = msg.toLowerCase();
  return (
    low.includes('incorrect api key') ||
    low.includes('invalid_api_key') ||
    low.includes('invalid api key') ||
    low.includes('openai http 401')
  );
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
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

interface AITutorSettings {
  explanationDepth?: 'foundational' | 'balanced' | 'deep';
  responseLength?: 'concise' | 'medium' | 'comprehensive';
  teachingApproach?: 'intuitive' | 'step-by-step' | 'socratic' | 'exam-focused';
  useRelatableExamples?: boolean;
  useHumorousExamples?: boolean;
  askFollowUpQuestions?: boolean;
  educationalLevel?: 'auto' | 'Primary' | 'Secondary' | 'College' | 'University';
}

interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
}

function isPrivateOrBlockedHost(hostname: string): boolean {
  const low = hostname.toLowerCase();
  if (
    low === 'localhost' ||
    low === '127.0.0.1' ||
    low === '::1' ||
    low === '0.0.0.0' ||
    low.endsWith('.local') ||
    low.startsWith('10.') ||
    low.startsWith('192.168.') ||
    low.startsWith('169.254.')
  ) {
    return true;
  }
  const m172 = low.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function buildAITutorBehaviorRules(aiSettings?: AITutorSettings, profile?: EducationProfile): string {
  const depth = aiSettings?.explanationDepth || 'balanced';
  const length = aiSettings?.responseLength || 'medium';
  const approach = aiSettings?.teachingApproach || 'intuitive';
  const relatable = aiSettings?.useRelatableExamples !== false;
  const humorous = aiSettings?.useHumorousExamples !== false;
  const followUps = aiSettings?.askFollowUpQuestions !== false;
  const level =
    aiSettings?.educationalLevel && aiSettings.educationalLevel !== 'auto'
      ? aiSettings.educationalLevel
      : profile?.educationLevel || 'Secondary';

  const depthRule =
    depth === 'foundational'
      ? 'Explanation depth: Foundational & beginner-friendly — start from everyday intuition before introducing technical terminology.'
      : depth === 'deep'
      ? 'Explanation depth: Deep & rigorous — explain underlying mechanisms, edge cases, derivations, and "why" behind each rule.'
      : 'Explanation depth: Balanced — clear conceptual intuition paired with accurate key terms.';

  const lengthRule =
    length === 'concise'
      ? 'Response length: Concise — keep replies crisp and high-yield (around 3–6 short lines or bullets).'
      : length === 'comprehensive'
      ? 'Response length: Comprehensive — provide thorough, well-structured sections with worked examples.'
      : 'Response length: Medium — clear, well-paced paragraphs without unnecessary fluff.';

  const approachRule =
    approach === 'step-by-step'
      ? 'Teaching approach: Step-by-Step — break complex problems into numbered logical steps so the student can follow every transition.'
      : approach === 'socratic'
      ? 'Teaching approach: Socratic Coach — guide the student to reason out the next step rather than giving everything away at once.'
      : approach === 'exam-focused'
      ? 'Teaching approach: Exam-Focused — highlight marking keywords, common examiner traps, and how to earn full method marks.'
      : 'Teaching approach: Intuitive & Conceptual — help the student truly understand how things work rather than memorizing blindly.';

  return [
    'CONVERSATION QUALITY RULE: Keep simple greetings ("hi", "hello", "hey") short, natural, and welcoming (1–2 sentences max — do not dump unsolicited lessons on greetings). Give brief direct answers when a quick answer suffices, and detailed explanations when asked or when teaching a concept.',
    `Adapt tone, vocabulary, and rigor to a ${level} student.`,
    depthRule,
    lengthRule,
    approachRule,
    relatable
      ? 'Use relatable everyday analogies naturally when explaining tricky ideas.'
      : 'Keep explanations direct and literal without everyday analogies.',
    humorous
      ? 'When helpful, weave in a light, imaginative comparison so the concept sticks naturally.'
      : 'Keep a calm, straightforward academic tone without jokes.',
    followUps
      ? 'When teaching a substantive topic (not on simple greetings), end with 1 brief, helpful check-in question to confirm understanding.'
      : 'Do not end with follow-up questions unless the student asks for a quiz.',
    'If the topic connects to an interactive ALEXYN Practice Area (Math Geometry/Graphing/Drawing, Biology Cells/DNA/Body, Chemistry Atoms/Molecules/Reactions, Physics Forces/Waves/Circuits/Orbits, ICT Logic & Binary, Economics Supply & Demand, Geography Earth & Grids, Language Practice Studio, or Humanities Concepts), mention how exploring it in the matching Practice Area helps visualize and practice it.',
  ].join('\n');
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

function repairJsonControlChars(jsonStr: string): string {
  // Replace raw newlines/tabs inside JSON string literals and strip trailing commas
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < jsonStr.length; i += 1) {
    const ch = jsonStr[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
    }
    out += ch;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

function parseAIJsonSafe<T>(raw: string): T {
  const cleaned = String(raw || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new Error('AI returned an empty response.');
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    try {
      return JSON.parse(repairJsonControlChars(cleaned)) as T;
    } catch {
      // Fall through to balanced slice extraction
    }
    const objStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');
    let startIdx = -1;
    let openChar = '{';
    let closeChar = '}';

    if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
      startIdx = objStart;
      openChar = '{';
      closeChar = '}';
    } else if (arrStart !== -1) {
      startIdx = arrStart;
      openChar = '[';
      closeChar = ']';
    }

    if (startIdx !== -1) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = startIdx; i < cleaned.length; i += 1) {
        const ch = cleaned[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\' && inString) {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (ch === openChar) depth += 1;
          else if (ch === closeChar) {
            depth -= 1;
            if (depth === 0) {
              const slice = cleaned.slice(startIdx, i + 1);
              try {
                return JSON.parse(slice) as T;
              } catch {
                return JSON.parse(repairJsonControlChars(slice)) as T;
              }
            }
          }
        }
      }
    }
    throw new Error('AI returned an invalid structured response. Please try again.');
  }
}

function isQuotaExceededError(msg: string): boolean {
  const low = msg.toLowerCase();
  return low.includes('exceeded your current quota') || low.includes('quota exceeded');
}

function formatFriendlyAIError(rawMsg: string): string {
  if (isQuotaExceededError(rawMsg)) {
    return 'Live AI has temporarily reached its current request limit. Please wait a moment and try again.';
  }
  const low = rawMsg.toLowerCase();
  if (
    low.includes('api key') ||
    low.includes('gemini_api_key') ||
    low.includes('openai_api_key') ||
    low.includes('unauthorized')
  ) {
    return 'Live AI service configuration is temporarily unavailable. Please try again shortly.';
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
  const candidates: Array<{ model: string; thinkingLevel?: ThinkingLevel }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
    { model: 'gemini-3.1-flash-lite' },
  ];

  let lastErr: unknown = null;
  for (const candidate of candidates) {
    try {
      return await withFastRetry(() =>
        ai.models.generateContent({
          model: candidate.model,
          contents: request.contents as never,
          config: {
            ...request.config,
            ...(candidate.thinkingLevel
              ? { thinkingConfig: { thinkingLevel: candidate.thinkingLevel } }
              : {}),
          } as never,
        })
      );
    } catch (err) {
      lastErr = err;
      console.warn(`[ALEXYN Gemini] Model "${candidate.model}" failed:`, extractAIError(err));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(extractAIError(lastErr));
}

async function callOpenAI(params: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  history?: ChatHistoryItem[];
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

  const historyMessages = (params.history || [])
    .slice(-10)
    .filter((item) => item.text?.trim())
    .map((item) => ({
      role: item.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: item.text,
    }));

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
          ...historyMessages,
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

async function runStructuredJsonAI<T>(params: {
  systemInstruction: string;
  userPrompt: string;
  images?: ImagePayload[];
  responseSchema?: Record<string, unknown>;
}): Promise<T> {
  const ai = getGeminiClient();
  const openAIKey = getOpenAIApiKey();

  if (!ai && !openAIKey) {
    throw new Error('Live AI service configuration is temporarily unavailable.');
  }

  let geminiError: unknown = null;
  if (ai) {
    try {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      for (const img of (params.images || []).slice(0, 4)) {
        if (img.base64Data && img.mimeType) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64Data,
            },
          });
        }
      }
      parts.push({ text: params.userPrompt });

      const response = await generateGeminiContent(ai, {
        contents: { parts },
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          ...(params.responseSchema ? { responseSchema: params.responseSchema } : {}),
        },
      });

      const raw = (response.text ?? '{}').trim();
      return parseAIJsonSafe<T>(raw);
    } catch (err) {
      geminiError = err;
      console.warn('[ALEXYN Structured AI] Gemini attempt failed:', extractAIError(err));
      if (!openAIKey) throw err;
    }
  }

  if (openAIKey) {
    try {
      const raw = await withFastRetry(() =>
        callOpenAI({
          apiKey: openAIKey,
          systemInstruction: params.systemInstruction,
          userPrompt: params.userPrompt,
          images: params.images,
          jsonMode: true,
        })
      );
      if (raw) {
        return parseAIJsonSafe<T>(raw);
      }
      throw new Error('OpenAI returned an empty JSON response.');
    } catch (err) {
      const msg = extractAIError(err);
      if (isOpenAIAuthError(msg)) {
        disabledOpenAIKey = openAIKey;
        console.warn('[ALEXYN Structured AI] Ignoring rejected OPENAI_API_KEY fallback.');
      } else {
        console.warn('[ALEXYN Structured AI] OpenAI fallback failed:', msg);
      }
      throw geminiError || err;
    }
  }

  throw geminiError instanceof Error ? geminiError : new Error('AI provider unavailable.');
}

async function fetchPublicWebSearch(query: string): Promise<{
  hits: WebSearchHit[];
  searchError?: string;
}> {
  const ai = getGeminiClient();
  // 1. Prefer Gemini Google Search grounding when GEMINI_API_KEY is available
  if (ai) {
    try {
      const resp = await generateGeminiContent(ai, {
        contents: `Search trustworthy educational resources, syllabi, and past papers for: ${query}. Summarize key factual findings briefly.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      const chunks = (
        resp.candidates?.[0] as
          | {
              groundingMetadata?: {
                groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
              };
            }
          | undefined
      )?.groundingMetadata?.groundingChunks;
      const hits: WebSearchHit[] = [];
      for (const ch of chunks || []) {
        if (ch.web?.uri) {
          hits.push({
            title: ch.web.title || ch.web.uri,
            url: ch.web.uri,
            snippet: (resp.text || '').slice(0, 320),
          });
        }
      }
      if (hits.length > 0) {
        return { hits: hits.slice(0, 6) };
      }
    } catch (err) {
      console.warn('[ALEXYN Search] Gemini search grounding fallback:', extractAIError(err));
    }
  }

  // 2. Fallback: public DuckDuckGo HTML + Wikipedia API search (works cleanly without Gemini key)
  const collected: WebSearchHit[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const ddgRes = await fetch(ddgUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ALEXYN-EduBot/1.0)',
        },
      });
      if (ddgRes.ok) {
        const html = await ddgRes.text();
        const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippets: string[] = [];
        let sm: RegExpExecArray | null;
        while ((sm = snippetRegex.exec(html)) !== null) {
          snippets.push(sm[1].replace(/<[^>]+>/g, '').trim());
        }
        let m: RegExpExecArray | null;
        let idx = 0;
        while ((m = linkRegex.exec(html)) !== null && collected.length < 6) {
          let href = m[1];
          const uddg = href.match(/uddg=([^&]+)/);
          if (uddg) {
            href = decodeURIComponent(uddg[1]);
          }
          const title = m[2].replace(/<[^>]+>/g, '').trim();
          if (href.startsWith('http') && title) {
            collected.push({
              title,
              url: href,
              snippet: snippets[idx] || '',
            });
          }
          idx += 1;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // ignore DDG failure and check Wikipedia
  }

  if (collected.length < 2) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          query
        )}&format=json&srlimit=3`;
        const wRes = await fetch(wikiUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'ALEXYN-Edu/1.0' },
        });
        if (wRes.ok) {
          const wData = (await wRes.json()) as {
            query?: { search?: Array<{ title: string; snippet: string }> };
          };
          for (const item of wData?.query?.search || []) {
            collected.push({
              title: `${item.title} — Wikipedia`,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(
                item.title.replace(/\s+/g, '_')
              )}`,
              snippet: item.snippet.replace(/<[^>]+>/g, '').trim(),
            });
          }
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }

  if (collected.length === 0) {
    return {
      hits: [],
      searchError: 'Online web search could not reach external educational sources from this environment right now.',
    };
  }
  return { hits: collected };
}

interface MediaPhotoItem {
  id: string;
  title: string;
  imageUrl: string;
  caption: string;
  sourceUrl: string;
}

async function fetchTopicEducationalPhotos(topicQuery: string): Promise<MediaPhotoItem[]> {
  const cleanQuery = topicQuery.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQuery) return [];

  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanQuery
    )}&gsrlimit=6&prop=pageimages|extracts|info&inprop=url&exintro=1&explaintext=1&exsentences=1&piprop=thumbnail&pithumbsize=800&format=json&origin=*`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(6500),
      headers: { 'User-Agent': 'ALEXYN-Edu/1.0' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid: number;
            title: string;
            extract?: string;
            fullurl?: string;
            thumbnail?: { source: string; width: number; height: number };
          }
        >;
      };
    };

    const pages = Object.values(data.query?.pages || {});
    const photos: MediaPhotoItem[] = [];

    for (const page of pages) {
      const thumb = page.thumbnail;
      if (!thumb?.source) continue;
      if (thumb.width < 220 || thumb.height < 140) continue;
      const srcLower = thumb.source.toLowerCase();
      // Prefer photographic / scientific diagrams over tiny flag/icon SVGs
      if (srcLower.includes('commons-logo') || srcLower.includes('ambox') || srcLower.includes('question_book')) {
        continue;
      }
      if (!/\.(jpg|jpeg|png|webp)/i.test(srcLower)) continue;

      photos.push({
        id: `wiki-${page.pageid}`,
        title: page.title,
        imageUrl: thumb.source,
        caption: (page.extract || `Educational visual reference for ${page.title}`).slice(0, 180),
        sourceUrl:
          page.fullurl ||
          `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/\s+/g, '_'))}`,
      });
      if (photos.length >= 2) break;
    }

    return photos;
  } catch {
    return [];
  }
}

async function extractTextFromUploadedFile(params: {
  fileName: string;
  mimeType: string;
  base64Data: string;
}): Promise<{ text: string; detailLabel: string }> {
  const cleanB64 = params.base64Data.includes(',')
    ? params.base64Data.split(',')[1]
    : params.base64Data;
  const buffer = Buffer.from(cleanB64, 'base64');
  const ext = path.extname(params.fileName || '').toLowerCase();
  const mime = (params.mimeType || '').toLowerCase();

  if (ext === '.pdf' || mime.includes('pdf')) {
    const result = await extractPdfText(new Uint8Array(buffer), { mergePages: true });
    const rawText = Array.isArray(result.text) ? result.text.join('\n\n') : String(result.text || '');
    return {
      text: rawText.trim(),
      detailLabel: `${result.totalPages || '?'} PDF page(s)`,
    };
  }

  if (ext === '.docx' || mime.includes('wordprocessingml')) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: (result.value || '').trim(),
      detailLabel: 'Word document (.docx)',
    };
  }

  if (ext === '.pptx' || mime.includes('presentationml')) {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0);
        const nb = Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0);
        return na - nb;
      });
    const slideTexts: string[] = [];
    for (const sFile of slideFiles) {
      const xml = await zip.files[sFile].async('text');
      const matches = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
        .map((m) => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim())
        .filter(Boolean);
      if (matches.length > 0) {
        const slideNum = sFile.match(/slide(\d+)/i)?.[1] || '';
        slideTexts.push(`Slide ${slideNum}: ${matches.join(' ')}`);
      }
    }
    return {
      text: slideTexts.join('\n\n').trim(),
      detailLabel: `${slideFiles.length} PowerPoint slide(s)`,
    };
  }

  // Plain text, markdown, CSV, code files
  const utf = buffer.toString('utf8').trim();
  return {
    text: utf,
    detailLabel: `Text / source file (${ext || mime || 'text'})`,
  };
}

function parseGitHubLocation(rawUrl: string): {
  owner: string;
  repo: string;
  branch?: string;
  filePath?: string;
  isFileUrl: boolean;
} | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const shorthand = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand) {
    return { owner: shorthand[1], repo: shorthand[2].replace(/\.git$/, ''), isFileUrl: false };
  }
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (host === 'raw.githubusercontent.com' && segments.length >= 4) {
      return {
        owner: segments[0],
        repo: segments[1],
        branch: segments[2],
        filePath: segments.slice(3).join('/'),
        isFileUrl: true,
      };
    }
    if ((host === 'github.com' || host === 'www.github.com') && segments.length >= 2) {
      const owner = segments[0];
      const repo = segments[1].replace(/\.git$/, '');
      if ((segments[2] === 'blob' || segments[2] === 'tree') && segments.length >= 4) {
        return {
          owner,
          repo,
          branch: segments[3],
          filePath: segments.slice(4).join('/') || undefined,
          isFileUrl: segments[2] === 'blob' && segments.length >= 5,
        };
      }
      return { owner, repo, isFileUrl: false };
    }
    return null;
  } catch {
    return null;
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
  app.use(express.json({ limit: '24mb' }));
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
    const gemini = getGeminiClient();
    const openAIKey = getOpenAIApiKey();
    res.json({
      ok: true,
      aiConfigured: Boolean(gemini || openAIKey),
      provider: gemini ? 'gemini' : openAIKey ? 'openai' : 'none',
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
        aiSettings,
        subjectFocus,
        strictScope = false,
        learnerContext = '',
      } = req.body as {
        message: string;
        history?: ChatHistoryItem[];
        images?: ImagePayload[];
        plugins?: string[];
        profile?: EducationProfile;
        aiSettings?: AITutorSettings;
        subjectFocus?: string;
        strictScope?: boolean;
        learnerContext?: string;
      };

      if (!message?.trim() && images.length === 0) {
        return res.status(400).json({ error: 'Please enter a message or attach an image.' });
      }

      const openAIKey = getOpenAIApiKey();
      const ai = getGeminiClient();
      if (!openAIKey && !ai) {
        return res.status(503).json({
          error: 'Live AI service configuration is temporarily unavailable.',
        });
      }

      // Check if learner is asking about frequently examined topics or online research
      let searchHits: WebSearchHit[] = [];
      const wantsOnlineResearch = /\b(mostly comes|frequently examined|common exam|past paper|syllabus topics|exam pattern|likely questions|research online)\b/i.test(
        message || ''
      );
      if (wantsOnlineResearch) {
        const searchQuery = [
          subjectFocus || '',
          profile?.curriculum || '',
          profile?.educationLevel || '',
          message || '',
        ]
          .filter(Boolean)
          .join(' ');
        const searchRes = await fetchPublicWebSearch(searchQuery);
        searchHits = searchRes.hits.slice(0, 4);
      }

      const pluginRules =
        plugins.length > 0
          ? `Active learning plugins: ${plugins.join(', ')}. Apply their specialized behaviors (e.g. Exam Coach highlights likely exam questions & marking points; Step-by-Step Solver breaks solutions into numbered steps; Visual Mental Model describes clear visual analogies; Quick Quiz Check ends with 1-2 quick self-check questions).`
          : '';

      const strictTeacherRule =
        strictScope && subjectFocus
          ? `STRICT SUBJECT RULE: You are acting ONLY as a dedicated ${subjectFocus} teacher inside the ${subjectFocus} workspace. If the learner asks a question clearly about a different academic subject outside ${subjectFocus}, politely remind them you are their ${subjectFocus} teacher and recommend switching to that subject's workspace rather than teaching the other subject here.`
          : '';

      const searchContextRule =
        searchHits.length > 0
          ? `Online research references retrieved:\n${searchHits
              .map((h, i) => `${i + 1}. ${h.title} (${h.url}) — ${h.snippet}`)
              .join('\n')}\nCite relevant sources honestly and NEVER claim a topic is guaranteed to appear in a future exam; explain that insights are based on available syllabus/past-paper/uploaded evidence.`
          : '';

      const isLangFocus = /\b(french|spanish|japanese|chinese|mandarin|kiswahili|swahili|german|arabic|korean|portuguese|italian|hindi|language|translate|pronounce)\b/i.test(
        `${subjectFocus || ''} ${message || ''}`
      );

      const languageTutorRule = isLangFocus
        ? 'BILINGUAL LANGUAGE TUTORING RULE: Conduct conversational guidance and grammar explanations in English (the learner’s explanation language) rather than writing the whole reply solely in the target language, unless the learner explicitly asks for full immersion. Whenever introducing a target-language word or phrase, write it in bold with its English meaning in square brackets right after it (e.g. **Bonjour** [Hello] or **おはようございます** [Good morning]) so the learner can listen to each target-language phrase individually.'
        : '';

      const systemInstruction = [
        'You are ALEXYN, a knowledgeable, patient, and encouraging personal tutor whose motto is "Understand more. Memorise less. Think smarter."',
        ALEXYN_IDENTITY_RULE,
        `Learner profile: ${formatProfileContext(profile)}.`,
        subjectFocus ? `Current subject focus: ${subjectFocus}.` : '',
        learnerContext ? `Learner study & performance context:\n${learnerContext}` : '',
        buildAITutorBehaviorRules(aiSettings, profile),
        languageTutorRule,
        strictTeacherRule,
        pluginRules,
        searchContextRule,
        'Patiently correct any misconceptions without judging, break complicated topics into digestible pieces, and format cleanly for readability.',
      ]
        .filter(Boolean)
        .join('\n');

      const latestUserMessage =
        message?.trim() || 'Please analyze the attached image(s) and help me understand.';

      const recentHistory = history
        .slice(-10)
        .map((item) => `${item.role === 'user' ? 'Learner' : 'ALEXYN'}: ${item.text}`)
        .join('\n\n');

      const fullPrompt = recentHistory
        ? `Previous conversation:\n${recentHistory}\n\nLatest learner message:\n${latestUserMessage}`
        : latestUserMessage;

      const formattedSources = searchHits.map((h) => ({
        title: h.title,
        url: h.url,
        kind: 'educational' as const,
      }));

      let geminiError: unknown = null;
      if (ai) {
        try {
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
            sources: formattedSources,
          });
        } catch (err) {
          geminiError = err;
          console.warn('[ALEXYN /api/chat] Gemini attempt failed:', extractAIError(err));
          if (!openAIKey) {
            return res.status(503).json({ error: formatFriendlyAIError(extractAIError(err)) });
          }
        }
      }

      if (openAIKey) {
        try {
          const reply = await withFastRetry(() =>
            callOpenAI({
              apiKey: openAIKey,
              systemInstruction,
              userPrompt: latestUserMessage,
              history,
              images,
            })
          );
          if (reply) {
            return res.json({ reply, provider: 'openai', sources: formattedSources });
          }
        } catch (err) {
          const msg = extractAIError(err);
          if (isOpenAIAuthError(msg)) {
            disabledOpenAIKey = openAIKey;
            console.warn('[ALEXYN /api/chat] Ignoring rejected OPENAI_API_KEY fallback.');
          } else {
            console.warn('[ALEXYN /api/chat] OpenAI fallback failed:', msg);
          }
          const finalErr = geminiError || err;
          return res.status(503).json({ error: formatFriendlyAIError(extractAIError(finalErr)) });
        }
      }

      return res.status(503).json({
        error: geminiError
          ? formatFriendlyAIError(extractAIError(geminiError))
          : 'Live AI service configuration is temporarily unavailable.',
      });
    } catch (error) {
      const msg = extractAIError(error);
      console.warn('[ALEXYN /api/chat] Error:', msg);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  // DOCUMENT & EXTERNAL CONTENT IMPORT ENDPOINTS
  app.post('/api/import/extract', async (req: Request, res: Response) => {
    try {
      const { fileName, mimeType, base64Data } = req.body as {
        fileName: string;
        mimeType?: string;
        base64Data: string;
      };
      if (!fileName || !base64Data) {
        return res.status(400).json({ error: 'File name and data are required.' });
      }
      const extracted = await extractTextFromUploadedFile({
        fileName,
        mimeType: mimeType || '',
        base64Data,
      });
      if (!extracted.text) {
        return res.status(422).json({
          error: 'Could not extract readable text from this file (it may be scanned images — upload it as an image instead).',
        });
      }
      return res.json({
        fileName,
        detailLabel: extracted.detailLabel,
        text: extracted.text.slice(0, 28000),
        charCount: extracted.text.length,
      });
    } catch (err) {
      return res.status(422).json({
        error: err instanceof Error ? err.message : 'Unable to parse uploaded document.',
      });
    }
  });

  app.post('/api/import/url', async (req: Request, res: Response) => {
    try {
      const { url } = req.body as { url: string };
      if (!url?.trim()) {
        return res.status(400).json({ error: 'Please enter a valid educational webpage URL.' });
      }
      let parsed: URL;
      try {
        parsed = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format.' });
      }
      if (!['http:', 'https:'].includes(parsed.protocol) || isPrivateOrBlockedHost(parsed.hostname)) {
        return res.status(400).json({ error: 'Unsupported or private URL host.' });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const resp = await fetch(parsed.toString(), {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ALEXYN-Edu/1.0)' },
        });
        if (!resp.ok) {
          return res.status(502).json({
            error: `Website returned HTTP ${resp.status}. Access is restricted or unavailable — please copy the relevant text or upload a file instead.`,
          });
        }
        const html = await resp.text();
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : parsed.hostname;
        const cleaned = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
          .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
          .replace(/<(h1|h2|h3|p|li|tr)[^>]*>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (cleaned.length < 40) {
          return res.status(422).json({
            error: 'Website loaded but contains little readable article text (it may require JavaScript login). Try pasting key paragraphs or uploading a document.',
          });
        }

        return res.json({
          url: parsed.toString(),
          title,
          text: cleaned.slice(0, 22000),
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      return res.status(502).json({
        error: `Could not access webpage (${err instanceof Error ? err.message : 'network error'}). Do not worry — paste key study text or upload a PDF/Word/photo instead.`,
      });
    }
  });

  app.post('/api/import/github', async (req: Request, res: Response) => {
    try {
      const { url, selectedPaths } = req.body as {
        url: string;
        selectedPaths?: string[];
      };
      const gh = parseGitHubLocation(url || '');
      if (!gh) {
        return res.status(400).json({
          error: 'Please paste a valid public GitHub repository or file URL (e.g. https://github.com/owner/repo).',
        });
      }

      const headers = {
        'User-Agent': 'ALEXYN-Edu/1.0',
        Accept: 'application/vnd.github+json',
      };

      // Fetch repo metadata for default branch if omitted
      let branch = gh.branch;
      let repoHtmlUrl = `https://github.com/${gh.owner}/${gh.repo}`;
      if (!branch) {
        const metaRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`, {
          headers,
          signal: AbortSignal.timeout(10000),
        });
        if (!metaRes.ok) {
          return res.status(metaRes.status === 404 ? 404 : 502).json({
            error:
              metaRes.status === 404
                ? 'GitHub repository not found or is private.'
                : `GitHub API returned HTTP ${metaRes.status}. Check that the repository is public.`,
          });
        }
        const metaJson = (await metaRes.json()) as { default_branch?: string; html_url?: string };
        branch = metaJson.default_branch || 'main';
        if (metaJson.html_url) repoHtmlUrl = metaJson.html_url;
      }

      // Single file mode OR fetching chosen files
      const pathsToFetch =
        selectedPaths && selectedPaths.length > 0
          ? selectedPaths.slice(0, 6)
          : gh.isFileUrl && gh.filePath
          ? [gh.filePath]
          : null;

      if (pathsToFetch) {
        const files: Array<{ path: string; url: string; content: string }> = [];
        for (const fPath of pathsToFetch) {
          const rawUrl = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${branch}/${fPath}`;
          const fRes = await fetch(rawUrl, {
            headers: { 'User-Agent': 'ALEXYN-Edu/1.0' },
            signal: AbortSignal.timeout(10000),
          });
          if (fRes.ok) {
            const text = await fRes.text();
            files.push({
              path: fPath,
              url: `${repoHtmlUrl}/blob/${branch}/${fPath}`,
              content: text.slice(0, 9000),
            });
          }
        }
        if (files.length === 0) {
          return res.status(404).json({
            error: 'Could not read the requested GitHub file(s). Confirm the branch and file path are public.',
          });
        }
        return res.json({
          mode: 'files',
          owner: gh.owner,
          repo: gh.repo,
          branch,
          repoUrl: repoHtmlUrl,
          files,
        });
      }

      // Repository file tree browsing
      const treeRes = await fetch(
        `https://api.github.com/repos/${gh.owner}/${gh.repo}/git/trees/${branch}?recursive=1`,
        { headers, signal: AbortSignal.timeout(10000) }
      );
      if (!treeRes.ok) {
        return res.status(502).json({
          error: `Could not list files in ${gh.owner}/${gh.repo} (HTTP ${treeRes.status}).`,
        });
      }
      const treeJson = (await treeRes.json()) as {
        tree?: Array<{ path: string; type: string; size?: number }>;
      };
      const supportedExt = /\.(md|txt|py|js|jsx|ts|tsx|html|css|java|c|cpp|h|json|sql|rst)$/i;
      const availableFiles = (treeJson.tree || [])
        .filter(
          (item) =>
            item.type === 'blob' &&
            supportedExt.test(item.path) &&
            !item.path.includes('node_modules/') &&
            !item.path.includes('package-lock.json') &&
            (item.size || 0) < 120000
        )
        .filter((item) => !gh.filePath || item.path.startsWith(gh.filePath))
        .slice(0, 60)
        .map((item) => ({ path: item.path, size: item.size || 0 }));

      return res.json({
        mode: 'tree',
        owner: gh.owner,
        repo: gh.repo,
        branch,
        repoUrl: repoHtmlUrl,
        availableFiles,
      });
    } catch (err) {
      return res.status(502).json({
        error: `Failed to reach GitHub: ${err instanceof Error ? err.message : 'network error'}`,
      });
    }
  });

  // SMART NOTES GENERATION (with Bilingual support, External Material, & SVG Visual Diagrams)
  app.post('/api/notes/generate', async (req: Request, res: Response) => {
    try {
      const {
        topic,
        subject,
        styles = [],
        detailLevel = 'detailed',
        taughtContext = '',
        importedSourceText = '',
        importedMaterialText = '',
        importedSourceLabel = '',
        isLanguage = false,
        images = [],
        profile,
        strictScope = false,
      } = req.body as {
        topic: string;
        subject?: string;
        styles?: string[];
        detailLevel?: 'short' | 'detailed';
        taughtContext?: string;
        importedSourceText?: string;
        importedMaterialText?: string;
        importedSourceLabel?: string;
        isLanguage?: boolean;
        images?: ImagePayload[];
        profile?: EducationProfile;
        strictScope?: boolean;
      };

      const resolvedImportedText = (importedSourceText || importedMaterialText || '').trim();

      if (!topic?.trim() && images.length === 0 && !resolvedImportedText) {
        return res.status(400).json({ error: 'Please provide a topic, upload a document/screenshot, or paste a source.' });
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
        ? `Reference and build upon what ALEXYN already taught the learner in Explore:\n${taughtContext}`
        : '';

      const importedGuide = resolvedImportedText
        ? `IMPORTED SOURCE MATERIAL (${importedSourceLabel || 'Uploaded Material'}):\nPreserve key technical terms, definitions, and code/formulas accurately from this source while organizing clear explanations alongside them:\n${resolvedImportedText.slice(0, 14000)}`
        : '';

      const languageGuide = isLanguage
        ? `BILINGUAL LANGUAGE RULE: Since ${subject || 'this subject'} is a language, populate a "bilingual" object combining target-language vocabulary/expressions with English meanings in brackets, pronunciation guides, grammar rules explaining HOW and WHEN to use them, and example sentences with word-by-word/structural explanations. Do NOT just translate mechanically.`
        : 'Set "bilingual" to null unless teaching a language topic.';

      const visualGuide =
        'VISUAL DIAGRAM RULE: Populate "visuals" with 1-2 helpful, cleanly labelled educational inline <svg viewBox=\'0 0 600 280\' xmlns=\'http://www.w3.org/2000/svg\'>...</svg> scientific diagrams, flowcharts, labelled illustrations, or charts directly illustrating this exact topic on a dark navy background (#060E24) with crisp cyan (#38BDF8), teal (#5EEAD4), white (#F8FAFC), and indigo (#818CF8) strokes/text (use SINGLE QUOTES inside SVG attributes so JSON stays valid, legible spacing, no overlapping text, no <script> tags). Also use ### Subheadings, **bold key concepts**, __underlined key words and definitions__, bullet points (- ), and worked Example: steps inside section content.';

      const strictNoteRule =
        strictScope && subject
          ? `STRICT SUBJECT TEACHER RULE: You are ONLY a ${subject} teacher. If the requested topic clearly belongs to another subject outside ${subject}, explain in overview that as a ${subject} teacher you only generate ${subject} notes and recommend opening that subject's workspace instead.`
          : '';

      const systemInstruction = [
        'You are ALEXYN Smart Notes Studio.',
        ALEXYN_IDENTITY_RULE,
        `Learner profile: ${formatProfileContext(profile)}.`,
        strictNoteRule,
        depthGuide,
        styleGuide,
        languageGuide,
        visualGuide,
        'Return strict JSON with keys: title (string), subject (string), overview (string), sections (array of {heading, content, kind}), memoryTricks (string[]), funnyExamples (string[]), examTips (string[]), readingAdvice (string[]), flashcards (array of {q, a}), visuals (array of {title, caption, kind, svgMarkup}), bilingual (null or {targetLanguage, languageCode, vocabulary: [{term, english, pronunciationGuide, usageNote}], exampleSentences: [{targetText, englishTranslation, grammarBreakdown, register}], grammarNotes: string[]}).',
      ]
        .filter(Boolean)
        .join('\n');

      const promptText = [
        `Topic: ${topic || 'Study notes from imported material'}`,
        subject ? `Subject: ${subject}` : '',
        `Requested styles: ${styles.length > 0 ? styles.join(', ') : 'Core clear notes'}`,
        `Detail mode: ${detailLevel}`,
        taughtGuide,
        importedGuide,
      ]
        .filter(Boolean)
        .join('\n\n');

      const photoSearchTerm = [topic?.trim() || '', subject?.trim() || '']
        .filter(Boolean)
        .join(' ')
        .slice(0, 120);

      const [parsed, mediaPhotos] = await Promise.all([
        runStructuredJsonAI<Record<string, unknown>>({
          systemInstruction,
          userPrompt: promptText,
          images,
        }),
        photoSearchTerm ? fetchTopicEducationalPhotos(photoSearchTerm) : Promise.resolve([]),
      ]);
      return res.json({
        ...parsed,
        mediaPhotos,
      });
    } catch (error) {
      const msg = extractAIError(error);
      console.error('[ALEXYN /api/notes/generate] Error:', msg);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  // EXAM TOPIC RESEARCH & SUBJECT COACH
  app.post('/api/subjects/coach', async (req: Request, res: Response) => {
    try {
      const {
        subject,
        isLanguage = false,
        profile,
        uploadedMaterialsText = '',
      } = req.body as {
        subject: string;
        isLanguage?: boolean;
        profile?: EducationProfile;
        uploadedMaterialsText?: string;
      };

      if (!subject?.trim()) {
        return res.status(400).json({ error: 'Subject is required.' });
      }

      const searchQuery = `${subject} ${profile?.curriculum || ''} ${profile?.educationLevel || ''} frequently examined topics past papers syllabus`;
      const webSearch = await fetchPublicWebSearch(searchQuery);

      const sourcesBlock =
        webSearch.hits.length > 0
          ? `Online educational sources retrieved:\n${webSearch.hits
              .map((h, idx) => `[${idx + 1}] ${h.title} (${h.url}) — ${h.snippet}`)
              .join('\n')}`
          : webSearch.searchError || 'No external web results returned.';

      const uploadedBlock = uploadedMaterialsText?.trim()
        ? `Learner's own saved notes / uploaded materials in ${subject}:\n${uploadedMaterialsText.slice(0, 6000)}`
        : '';

      const systemInstruction = [
        'You are ALEXYN Exam & Syllabus Research Coach.',
        ALEXYN_IDENTITY_RULE,
        `Learner profile: ${formatProfileContext(profile)}.`,
        isLanguage
          ? 'This is a LANGUAGE subject. Focus on frequently examined grammar structures, composition formats, comprehension patterns, listening/speaking traps, and vocabulary themes.'
          : 'Analyze frequently examined topics, recurring question patterns, core concepts, and often-overlooked exam areas.',
        'EVIDENCE HONESTY RULE: Never claim any topic is guaranteed or certain to appear on a future exam. State clearly in "evidenceNote" that insights are compiled from available syllabus outlines, past-paper patterns, and uploaded learner materials.',
        'Return strict JSON with keys: summary (string), examHotTopics (string[]), commonQuestionPatterns (string[]), areasNeedingRevision (string[]), overlookedAreas (string[]), readingAdvice (string[]), commonPitfalls (string[]), quickDrillPrompt (string), evidenceNote (string).',
      ].join('\n');

      const promptText = [
        `Research commonly examined topics and question patterns for ${subject}.`,
        sourcesBlock,
        uploadedBlock,
      ]
        .filter(Boolean)
        .join('\n\n');

      const parsed = await runStructuredJsonAI<Record<string, unknown>>({
        systemInstruction,
        userPrompt: promptText,
      });

      return res.json({
        ...parsed,
        sources: webSearch.hits.map((h) => ({
          title: h.title,
          url: h.url,
          kind: 'educational',
        })),
        searchStatus: webSearch.searchError || null,
      });
    } catch (error) {
      const msg = extractAIError(error);
      console.error('[ALEXYN /api/subjects/coach] Error:', msg);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  // QUIZZES ENDPOINTS
  app.post('/api/quizzes/generate', async (req: Request, res: Response) => {
    try {
      const {
        subject,
        topic,
        difficulty = 'medium',
        count = 5,
        profile,
        weakTopics = [],
      } = req.body as {
        subject: string;
        topic?: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        count?: number;
        profile?: EducationProfile;
        weakTopics?: string[];
      };

      if (!subject?.trim()) {
        return res.status(400).json({ error: 'Subject is required to generate a quiz.' });
      }

      const safeCount = Math.max(3, Math.min(12, Number(count) || 5));
      const systemInstruction = [
        'You are ALEXYN Quiz & Assessment Author.',
        ALEXYN_IDENTITY_RULE,
        `Learner profile: ${formatProfileContext(profile)}.`,
        `Create ${safeCount} clear multiple-choice questions for ${subject}${topic ? ` focusing on "${topic}"` : ''} at "${difficulty}" difficulty.`,
        weakTopics.length > 0 ? `Emphasize practice on areas needing improvement: ${weakTopics.join(', ')}.` : '',
        'Each question MUST have exactly 4 distinct plausible options, a valid 0-based integer correctIndex (0..3), the specific sub-topic tag, and a concise, helpful teaching explanation.',
        'Return strict JSON: { title: string, topic: string, questions: [{ prompt: string, topic: string, options: string[], correctIndex: number, explanation: string }] }.',
      ]
        .filter(Boolean)
        .join('\n');

      const data = await runStructuredJsonAI<{
        title?: string;
        topic?: string;
        questions?: Array<{
          prompt: string;
          topic?: string;
          options: string[];
          correctIndex: number;
          explanation: string;
        }>;
      }>({
        systemInstruction,
        userPrompt: `Generate a ${difficulty} ${safeCount}-question interactive quiz on ${subject}${topic ? ` — ${topic}` : ''}.`,
      });

      const questions = (data.questions || []).slice(0, safeCount).map((q, idx) => ({
        id: `q-${Date.now()}-${idx}`,
        prompt: q.prompt,
        topic: q.topic || topic || subject,
        options: Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 4) : ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3 ? q.correctIndex : 0,
        hasOfficialAnswerKey: true,
        explanation: q.explanation || 'Review the core principle in this topic.',
        origin: 'ai-generated' as const,
      }));

      return res.json({
        title: data.title || `${subject}: ${topic || 'Practice Quiz'}`,
        topic: data.topic || topic || subject,
        origin: 'ai-generated',
        questions,
      });
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  app.post('/api/quizzes/extract', async (req: Request, res: Response) => {
    try {
      const {
        subject,
        subjectHint,
        fileName,
        mimeType,
        base64Data,
        fileBase64,
        rawText,
        images = [],
      } = req.body as {
        subject?: string;
        subjectHint?: string;
        fileName?: string;
        mimeType?: string;
        base64Data?: string;
        fileBase64?: string;
        rawText?: string;
        images?: ImagePayload[];
      };

      const resolvedSubject = subject || subjectHint;
      const resolvedBase64 = base64Data || fileBase64;

      let extractedDocumentText = rawText?.trim() || '';
      if (!extractedDocumentText && resolvedBase64 && fileName) {
        const parsedDoc = await extractTextFromUploadedFile({
          fileName,
          mimeType: mimeType || '',
          base64Data: resolvedBase64,
        });
        extractedDocumentText = parsedDoc.text;
      }

      if (!extractedDocumentText && images.length === 0) {
        return res.status(400).json({ error: 'Please upload a quiz/exam file (PDF, Word, PPT, TXT, or image) or paste quiz text.' });
      }

      const systemInstruction = [
        'You are ALEXYN Exam Document Extractor.',
        'Extract multiple-choice questions and their answer options from the uploaded examination/quiz material.',
        'STRICT PRESERVATION RULE: Preserve original wording and meaning faithfully without rewriting or altering the test questions.',
        'STRICT ANSWER-KEY HONESTY RULE: Only set correctIndex (0..3) and hasOfficialAnswerKey=true if an explicit answer key, marking scheme, or circled/indicated answer is explicitly present in the provided material. If NO official answer key is present in the material, you MUST set correctIndex to null and hasOfficialAnswerKey to false. NEVER guess or invent an official answer key when missing.',
        'Return strict JSON: { title: string, subject: string, topic: string, answerKeyFound: boolean, questions: [{ prompt: string, topic: string, options: string[], correctIndex: number | null, hasOfficialAnswerKey: boolean, explanation: string }] }.',
      ].join('\n');

      const data = await runStructuredJsonAI<{
        title?: string;
        subject?: string;
        topic?: string;
        answerKeyFound?: boolean;
        questions?: Array<{
          prompt: string;
          topic?: string;
          options: string[];
          correctIndex: number | null;
          hasOfficialAnswerKey?: boolean;
          explanation?: string;
        }>;
      }>({
        systemInstruction,
        userPrompt: `Subject hint: ${resolvedSubject || 'General'}\nDocument name: ${fileName || 'Uploaded exam'}\n\nExtract all multiple-choice questions cleanly:\n${extractedDocumentText.slice(0, 18000)}`,
        images,
      });

      const questions = (data.questions || []).map((q, idx) => {
        const hasKey = Boolean(q.hasOfficialAnswerKey && typeof q.correctIndex === 'number');
        return {
          id: `ext-${Date.now()}-${idx}`,
          prompt: q.prompt,
          topic: q.topic || data.topic || resolvedSubject || 'Extracted Exam',
          options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
          correctIndex: hasKey ? q.correctIndex : null,
          hasOfficialAnswerKey: hasKey,
          explanation: q.explanation || (hasKey ? 'From uploaded answer key.' : 'No official answer key provided in uploaded document — assign or review after checking.'),
          origin: 'uploaded-document' as const,
        };
      });

      return res.json({
        title: data.title || fileName || 'Uploaded Quiz',
        subject: data.subject || resolvedSubject || 'General',
        topic: data.topic || 'Uploaded Exam',
        answerKeyFound: questions.some((q) => q.hasOfficialAnswerKey),
        questions,
      });
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  app.post('/api/quizzes/research', async (req: Request, res: Response) => {
    try {
      const { query, subject, profile } = req.body as {
        query: string;
        subject?: string;
        profile?: EducationProfile;
      };
      if (!query?.trim()) {
        return res.status(400).json({ error: 'Please describe the exam style, subject, or topic to research.' });
      }

      const fullQuery = `${query} ${subject || ''} ${profile?.curriculum || ''} past paper practice questions`;
      const webSearch = await fetchPublicWebSearch(fullQuery);

      const systemInstruction = [
        'You are ALEXYN Online Exam & Practice Question Researcher.',
        ALEXYN_IDENTITY_RULE,
        `Learner profile: ${formatProfileContext(profile)}.`,
        'HONEST LABELING RULE: Analyze the retrieved online search snippets carefully:',
        '- Label a question origin as "past-paper" ONLY if the retrieved snippet clearly quotes an actual documented past paper and include that sourceUrl.',
        '- Label as "educational-practice" if drawn from retrieved online educational study sites/exercises and include that sourceUrl.',
        '- Label any newly written practice question inspired by the curriculum/exam style as "ai-generated" (NEVER claim AI-generated questions are official past-paper items!).',
        'Return strict JSON: { title: string, subject: string, topic: string, summaryNote: string, questions: [{ prompt: string, topic: string, options: string[], correctIndex: number, explanation: string, origin: "past-paper" | "educational-practice" | "ai-generated", sourceTitle: string, sourceUrl: string }] }.',
      ].join('\n');

      const searchContext =
        webSearch.hits.length > 0
          ? `Retrieved online sources:\n${webSearch.hits
              .map((h, i) => `[${i + 1}] Title: ${h.title}\nURL: ${h.url}\nExcerpt: ${h.snippet}`)
              .join('\n\n')}`
          : webSearch.searchError || 'No external web results available.';

      const data = await runStructuredJsonAI<{
        title?: string;
        subject?: string;
        topic?: string;
        summaryNote?: string;
        questions?: Array<{
          prompt: string;
          topic?: string;
          options: string[];
          correctIndex: number;
          explanation: string;
          origin?: 'past-paper' | 'educational-practice' | 'ai-generated';
          sourceTitle?: string;
          sourceUrl?: string;
        }>;
      }>({
        systemInstruction,
        userPrompt: `Learner request: "${query}"\nSubject: ${subject || 'Auto-detect'}\n\n${searchContext}\n\nProvide 5 high-quality interactive exam/practice questions with honest origin labels and source links.`,
      });

      const validUrls = new Set(webSearch.hits.map((h) => h.url));
      const questions = (data.questions || []).slice(0, 8).map((q, idx) => {
        const verifiedUrl = q.sourceUrl && validUrls.has(q.sourceUrl) ? q.sourceUrl : '';
        const safeOrigin =
          verifiedUrl && q.origin === 'past-paper'
            ? 'past-paper'
            : verifiedUrl && q.origin === 'educational-practice'
            ? 'educational-practice'
            : 'ai-generated';
        return {
          id: `res-${Date.now()}-${idx}`,
          prompt: q.prompt,
          topic: q.topic || data.topic || subject || 'Exam Practice',
          options: Array.isArray(q.options) ? q.options.slice(0, 4) : ['A', 'B', 'C', 'D'],
          correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
          hasOfficialAnswerKey: true,
          explanation: q.explanation || '',
          origin: safeOrigin,
          sourceTitle: verifiedUrl ? q.sourceTitle || 'Educational Source' : 'ALEXYN Exam-Style Practice (AI-Generated)',
          sourceUrl: verifiedUrl || undefined,
        };
      });

      return res.json({
        title: data.title || `Exam Research: ${query.slice(0, 45)}`,
        subject: data.subject || subject || 'General',
        topic: data.topic || query,
        summaryNote:
          data.summaryNote ||
          (webSearch.searchError
            ? `${webSearch.searchError} Questions generated below are clearly marked as AI-generated exam-style practice.`
            : 'Sources and question origins are verified and separated cleanly below.'),
        sources: webSearch.hits.map((h) => ({
          title: h.title,
          url: h.url,
          kind: 'past-paper' as const,
        })),
        questions,
      });
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  // LANGUAGE PRACTICE CHECK ENDPOINT
  app.post('/api/language/check', async (req: Request, res: Response) => {
    try {
      const {
        language,
        prompt,
        learnerAttempt,
        sentence,
        expectedMeaning,
        mode = 'translation',
      } = req.body as {
        language: string;
        prompt?: string;
        learnerAttempt?: string;
        sentence?: string;
        expectedMeaning?: string;
        mode?: string;
      };

      const attempt = (learnerAttempt || sentence || '').trim();
      const taskPrompt =
        prompt?.trim() ||
        (expectedMeaning ? `Translate or express: "${expectedMeaning}"` : 'Evaluate naturalness and grammar');

      if (!language || !attempt) {
        return res.status(400).json({ error: 'Please write or translate a sentence to check.' });
      }
      const systemInstruction = [
        `You are an encouraging ${language} language tutor inside ALEXYN.`,
        ALEXYN_IDENTITY_RULE,
        `Evaluate the learner's ${mode} attempt cleanly. Explain HOW and WHY the grammar works in English (with target-language examples), give a corrected natural version in ${language}, provide its English meaning, and include a quick pronunciation tip.`,
        'Return strict JSON: { isCorrect: boolean, correctedSentence: string, englishMeaning: string, grammarExplanation: string, pronunciationTip: string }.',
      ].join('\n');

      const data = await runStructuredJsonAI<{
        isCorrect: boolean;
        correctedSentence: string;
        englishMeaning?: string;
        grammarExplanation: string;
        pronunciationTip: string;
      }>({
        systemInstruction,
        userPrompt: `Task prompt: ${taskPrompt}\nLearner's attempt in ${language}: "${attempt}"`,
      });
      return res.json({
        ...data,
        isNatural: Boolean(data.isCorrect),
        corrected: data.correctedSentence,
        englishMeaning: data.englishMeaning || expectedMeaning || '',
        feedback: data.grammarExplanation,
      });
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  // DEEP AI PERFORMANCE ANALYSIS ENDPOINT
  app.post('/api/progress/analyze', async (req: Request, res: Response) => {
    try {
      const { attempts = [], summaries = [], profile } = req.body as {
        attempts: unknown[];
        summaries: unknown[];
        profile?: EducationProfile;
      };
      if (!Array.isArray(attempts) || attempts.length === 0) {
        return res.status(400).json({ error: 'Complete at least one quiz before requesting AI performance analysis.' });
      }
      const systemInstruction = [
        'You are ALEXYN Academic Performance Analyst.',
        ALEXYN_IDENTITY_RULE,
        `Learner profile: ${formatProfileContext(profile)}.`,
        'Strictly analyze ONLY the real quiz attempt data provided. Do NOT invent scores or draw strong trend conclusions for any subject that only has 1 quiz.',
        'Return strict JSON: { headline: string, insights: string[], actionPlan: string[] }.',
      ].join('\n');

      const data = await runStructuredJsonAI<{
        headline: string;
        insights: string[];
        actionPlan: string[];
      }>({
        systemInstruction,
        userPrompt: `Subject summaries:\n${JSON.stringify(summaries)}\n\nRecent attempts:\n${JSON.stringify(attempts.slice(-12))}`,
      });
      return res.json(data);
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  const publicDir = path.join(__dirname, 'public');
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
