import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { extractText as extractPdfText } from 'unpdf';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import {
  ensurePlayableWavBuffer,
  LANGUAGE_DISPLAY_NAMES,
  normalizeSpeechLangCode,
} from './src/utils/ttsUtils.ts';
import {
  extractSourceDomain,
  formatFriendlyAIError,
  shouldTriggerOnlineSearch,
} from './src/utils/aiHelpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_TIMEOUT_MS = 90000;

const ALEXYN_IDENTITY_RULE =
  'IDENTITY & CREATOR RULE: ALEXYN was created by Alex Mbugua. Never claim that Google, OpenAI, or any external AI provider created ALEXYN. Only mention Alex Mbugua or introduce yourself when the user asks who you are, who created ALEXYN, or on an explicit identity question — never repeat repetitive creator introductions in normal conversation.';

type AIProviderId =
  | 'auto'
  | 'gemini'
  | 'openai'
  | 'groq'
  | 'openrouter'
  | 'mistral'
  | 'custom';

interface AISelection {
  providerId?: AIProviderId;
  modelId?: string;
}

interface AIModelOption {
  id: string;
  label: string;
  tier: 'free' | 'paid' | 'varies';
  notes: string;
  supportsVision?: boolean;
  supportsJson?: boolean;
}

interface AIProviderInfo {
  id: AIProviderId;
  name: string;
  shortName: string;
  description: string;
  configured: boolean;
  statusText: string;
  freeTierInfo: string;
  requiresPaymentOrKey: string;
  envVarHint: string;
  models: AIModelOption[];
}

function getCleanEnvKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = process.env[name]?.trim();
    if (
      raw &&
      !raw.startsWith('MY_') &&
      !raw.includes('YOUR_')
    ) {
      return raw;
    }
  }
  return null;
}

function getGeminiClient(apiVersion?: string): GoogleGenAI | null {
  const apiKey = getCleanEnvKey('GEMINI_API_KEY', 'GOOGLE_API_KEY');
  if (!apiKey) return null;
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

function getProviderKey(providerId: Exclude<AIProviderId, 'auto'>): string | null {
  switch (providerId) {
    case 'gemini':
      return getCleanEnvKey('GEMINI_API_KEY', 'GOOGLE_API_KEY');
    case 'openai':
      return getCleanEnvKey('OPENAI_API_KEY');
    case 'groq':
      return getCleanEnvKey('GROQ_API_KEY');
    case 'openrouter':
      return getCleanEnvKey('OPENROUTER_API_KEY');
    case 'mistral':
      return getCleanEnvKey('MISTRAL_API_KEY');
    case 'custom': {
      const baseUrl = process.env.AI_CUSTOM_BASE_URL?.trim();
      if (!baseUrl) return null;
      return process.env.AI_CUSTOM_API_KEY?.trim() || 'no-key-required';
    }
    default:
      return null;
  }
}

function isAuthOrKeyError(msg: string): boolean {
  const low = msg.toLowerCase();
  return (
    low.includes('incorrect api key') ||
    low.includes('invalid_api_key') ||
    low.includes('invalid api key') ||
    low.includes('http 401') ||
    low.includes('unauthorized')
  );
}

function buildProviderCatalog(): AIProviderInfo[] {
  const geminiKey = getProviderKey('gemini');
  const openaiKey = getProviderKey('openai');
  const groqKey = getProviderKey('groq');
  const openrouterKey = getProviderKey('openrouter');
  const mistralKey = getProviderKey('mistral');
  const customBaseUrl = process.env.AI_CUSTOM_BASE_URL?.trim();
  const customModel = process.env.AI_CUSTOM_MODEL?.trim() || 'llama3.2';

  const anyConfigured = Boolean(
    geminiKey || openaiKey || groqKey || openrouterKey || mistralKey || customBaseUrl
  );

  return [
    {
      id: 'auto',
      name: 'Smart Auto (Best Available)',
      shortName: 'Auto',
      description:
        'Automatically routes requests to the first configured free-tier or active AI provider on the server and falls back cleanly.',
      configured: anyConfigured,
      statusText: anyConfigured ? 'Ready (Auto-Routing Active)' : 'No backend AI key configured',
      freeTierInfo: 'Prioritizes free-tier compatible providers first when configured.',
      requiresPaymentOrKey: 'Uses whichever provider keys are configured in backend secrets.',
      envVarHint: 'GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY',
      models: [
        {
          id: 'auto',
          label: 'Auto-select best model',
          tier: 'free',
          notes: 'Picks the default model of the active provider',
          supportsVision: true,
          supportsJson: true,
        },
      ],
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      shortName: 'Gemini',
      description:
        'Multimodal reasoning, images/homework photos, Smart Notes diagrams, and Google Search syllabus grounding.',
      configured: Boolean(geminiKey),
      statusText: geminiKey ? 'Connected via backend key' : 'Requires GEMINI_API_KEY in backend secrets',
      freeTierInfo: 'Free tier available for standard Gemini models (subject to Google AI rate limits).',
      requiresPaymentOrKey: 'Backend GEMINI_API_KEY required; Gemini 4 Argon requires a billed key.',
      envVarHint: 'GEMINI_API_KEY',
      models: [
        {
          id: 'gemini-4-hydrogen',
          label: 'Gemini 4 Hydrogen (Fast & Capable)',
          tier: 'free',
          notes: 'Free-tier compatible default · text, images & JSON',
          supportsVision: true,
          supportsJson: true,
        },
        {
          id: 'gemini-3.1-flash-lite',
          label: 'Gemini 3.1 Flash Lite (Lightweight)',
          tier: 'free',
          notes: 'Free-tier compatible · ultra-fast explanations',
          supportsVision: true,
          supportsJson: true,
        },
        {
          id: 'gemini-4-argon',
          label: 'Gemini 4 Argon (Deep Reasoning · Paid)',
          tier: 'paid',
          notes: 'Requires paid Gemini API billing',
          supportsVision: true,
          supportsJson: true,
        },
      ],
    },
    {
      id: 'groq',
      name: 'Groq Cloud (Llama & Qwen Free Tier)',
      shortName: 'Groq',
      description:
        'Ultra-low-latency open-weight inference via OpenAI-compatible Groq API with a free developer tier.',
      configured: Boolean(groqKey),
      statusText: groqKey ? 'Connected via backend key' : 'Requires GROQ_API_KEY in backend secrets',
      freeTierInfo: 'Offers a genuine free API tier with rate-limited open models.',
      requiresPaymentOrKey: 'Free API key required on backend (GROQ_API_KEY); paid plans raise rate limits.',
      envVarHint: 'GROQ_API_KEY',
      models: [
        {
          id: 'llama-3.3-70b-versatile',
          label: 'Llama 3.3 70B Versatile',
          tier: 'free',
          notes: 'Free tier · strong STEM, essays & JSON',
          supportsVision: false,
          supportsJson: true,
        },
        {
          id: 'llama-3.1-8b-instant',
          label: 'Llama 3.1 8B Instant',
          tier: 'free',
          notes: 'Free tier · rapid study responses',
          supportsVision: false,
          supportsJson: true,
        },
      ],
    },
    {
      id: 'openrouter',
      name: 'OpenRouter (:free & Multi-Model)',
      shortName: 'OpenRouter',
      description:
        'Unified gateway hosting genuinely free ":free" community models (Llama, Gemma, Qwen) alongside paid frontier models.',
      configured: Boolean(openrouterKey),
      statusText: openrouterKey
        ? 'Connected via backend key'
        : 'Requires OPENROUTER_API_KEY in backend secrets',
      freeTierInfo: 'Models ending in :free are $0/token with an OpenRouter key.',
      requiresPaymentOrKey: 'Free OpenRouter account key required; non-:free models require credits.',
      envVarHint: 'OPENROUTER_API_KEY',
      models: [
        {
          id: 'meta-llama/llama-3.3-70b-instruct:free',
          label: 'Llama 3.3 70B Instruct (:free)',
          tier: 'free',
          notes: 'Free $0 model on OpenRouter',
          supportsVision: false,
          supportsJson: true,
        },
        {
          id: 'google/gemma-3-27b-it:free',
          label: 'Gemma 3 27B IT (:free)',
          tier: 'free',
          notes: 'Free $0 open-weights model',
          supportsVision: true,
          supportsJson: false,
        },
        {
          id: 'qwen/qwen3-32b:free',
          label: 'Qwen 3 32B (:free)',
          tier: 'free',
          notes: 'Free $0 strong math & coding model',
          supportsVision: false,
          supportsJson: true,
        },
        {
          id: 'openai/gpt-4o-mini',
          label: 'GPT-4o Mini (via OpenRouter · Paid)',
          tier: 'paid',
          notes: 'Uses OpenRouter paid credits',
          supportsVision: true,
          supportsJson: true,
        },
      ],
    },
    {
      id: 'openai',
      name: 'OpenAI / ChatGPT',
      shortName: 'OpenAI',
      description:
        'Connect directly to OpenAI ChatGPT models (GPT-4o Mini & GPT-4o) with vision and structured JSON support.',
      configured: Boolean(openaiKey),
      statusText: openaiKey ? 'Connected via backend key' : 'Requires OPENAI_API_KEY in backend secrets',
      freeTierInfo: 'No permanent free API tier — requires funded OpenAI API credits.',
      requiresPaymentOrKey: 'Paid OpenAI API key required (OPENAI_API_KEY).',
      envVarHint: 'OPENAI_API_KEY',
      models: [
        ...(process.env.OPENAI_MODEL?.trim() &&
        !['gpt-4o-mini', 'gpt-4o'].includes(process.env.OPENAI_MODEL.trim())
          ? [
              {
                id: process.env.OPENAI_MODEL.trim(),
                label: `${process.env.OPENAI_MODEL.trim()} (Configured)`,
                tier: 'paid' as const,
                notes: 'Configured via OPENAI_MODEL',
                supportsVision: true,
                supportsJson: true,
              },
            ]
          : []),
        {
          id: 'gpt-4o-mini',
          label: 'GPT-4o Mini',
          tier: 'paid',
          notes: 'Requires paid OpenAI API key · fast & multimodal',
          supportsVision: true,
          supportsJson: true,
        },
        {
          id: 'gpt-4o',
          label: 'GPT-4o',
          tier: 'paid',
          notes: 'Requires paid OpenAI API key · flagship reasoning',
          supportsVision: true,
          supportsJson: true,
        },
      ],
    },
    {
      id: 'mistral',
      name: 'Mistral AI',
      shortName: 'Mistral',
      description:
        'Multilingual European AI models with a free Experiment plan for API key holders.',
      configured: Boolean(mistralKey),
      statusText: mistralKey ? 'Connected via backend key' : 'Requires MISTRAL_API_KEY in backend secrets',
      freeTierInfo: 'Mistral Experiment tier offers free rate-limited API access.',
      requiresPaymentOrKey: 'MISTRAL_API_KEY required on backend.',
      envVarHint: 'MISTRAL_API_KEY',
      models: [
        {
          id: 'mistral-small-latest',
          label: 'Mistral Small Latest',
          tier: 'free',
          notes: 'Free Experiment tier compatible',
          supportsVision: false,
          supportsJson: true,
        },
        {
          id: 'open-mistral-nemo',
          label: 'Open Mistral Nemo',
          tier: 'free',
          notes: 'Free Experiment tier compatible',
          supportsVision: false,
          supportsJson: true,
        },
      ],
    },
    {
      id: 'custom',
      name: 'Custom OpenAI-Compatible (Ollama / Local / Self-Hosted)',
      shortName: 'Custom',
      description:
        'Connect to any OpenAI-compatible server such as local Ollama, LM Studio, Together, or self-hosted endpoints.',
      configured: Boolean(customBaseUrl),
      statusText: customBaseUrl
        ? `Connected (${customBaseUrl})`
        : 'Requires AI_CUSTOM_BASE_URL in backend secrets',
      freeTierInfo: '100% free when pointing to local Ollama / self-hosted models.',
      requiresPaymentOrKey: 'Requires backend AI_CUSTOM_BASE_URL (and optional AI_CUSTOM_API_KEY).',
      envVarHint: 'AI_CUSTOM_BASE_URL',
      models: [
        {
          id: customModel,
          label: `${customModel} (Custom Endpoint)`,
          tier: 'varies',
          notes: 'Depends on configured AI_CUSTOM_BASE_URL',
          supportsVision: false,
          supportsJson: false,
        },
      ],
    },
  ];
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

function buildAITutorBehaviorRules(
  aiSettings?: AITutorSettings,
  profile?: EducationProfile,
  intentHint: 'casual' | 'general' | 'study' = 'study',
  allowFollowUpQuiz = false
): string {
  const depth = aiSettings?.explanationDepth || 'balanced';
  const length = aiSettings?.responseLength || 'medium';
  const approach = aiSettings?.teachingApproach || 'intuitive';
  const relatable = aiSettings?.useRelatableExamples !== false;
  const humorous = aiSettings?.useHumorousExamples !== false;
  const level =
    aiSettings?.educationalLevel && aiSettings.educationalLevel !== 'auto'
      ? aiSettings.educationalLevel
      : profile?.educationLevel || 'Secondary';

  if (intentHint === 'casual') {
    return [
      'NATURAL COMPANION RULE: The user is making a casual greeting, quick comment, or brief remark — reply naturally, warmly, and concisely like a smart friend.',
      'Do NOT force a school lesson, do NOT pitch Practice Area or other tabs, do NOT repeat "I am ALEXYN created by Alex Mbugua", and do NOT end with unsolicited follow-up quiz questions.',
    ].join('\n');
  }

  if (intentHint === 'general') {
    return [
      'OPEN CONVERSATION RULE: Explore is an unrestricted, helpful conversational partner (like ChatGPT) for everyday questions, coding, technology, music, creative writing, brainstorming, life ideas, or study whenever relevant.',
      'Answer the user’s exact question directly, thoughtfully, and clearly without shoehorning school exam framing or textbook lectures when the topic is general.',
      'NEVER pitch the Practice Area, 3D Lab, Quizzes, or follow-up check questions unless the user explicitly asked for practice or interactive tools.',
    ].join('\n');
  }

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
    'CONVERSATION QUALITY RULE: Match your reply style directly to the user’s request. Give direct clear answers when a quick answer is needed, and structured explanations when teaching a concept.',
    `Adapt tone, vocabulary, and rigor to a ${level} learner.`,
    depthRule,
    lengthRule,
    approachRule,
    relatable
      ? 'Use relatable everyday analogies naturally when explaining tricky ideas.'
      : 'Keep explanations direct and literal without everyday analogies.',
    humorous
      ? 'When helpful, weave in a light, imaginative comparison so the concept sticks naturally.'
      : 'Keep a calm, straightforward academic tone without jokes.',
    allowFollowUpQuiz
      ? 'End with 1–2 concise self-check questions because Quick Quiz Check is active.'
      : 'Do NOT add unsolicited follow-up quiz questions or "Would you like to test yourself?" endings.',
    'Do NOT invite the user to open Practice Area, 3D Labs, or interactive studios unless they explicitly ask to practise interactively or open a workspace.',
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
  return low.includes('exceeded your current quota') || low.includes('quota exceeded') || low.includes('insufficient_quota');
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
    preferredModel?: string;
    speedMode?: 'balanced' | 'fast';
    timeoutMs?: number;
  }
) {
  const defaultCandidates: Array<{ model: string; thinkingLevel?: ThinkingLevel }> =
    request.speedMode === 'fast'
      ? [
          { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
          { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.MINIMAL },
        ]
      : [
          { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
          { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
          { model: 'gemini-3.1-flash-lite' },
        ];

  const candidates =
    request.preferredModel && request.preferredModel !== 'auto'
      ? [
          {
            model: request.preferredModel,
            thinkingLevel:
              request.speedMode === 'fast' || request.preferredModel.includes('lite')
                ? ThinkingLevel.MINIMAL
                : ThinkingLevel.LOW,
          },
          { model: request.preferredModel },
        ]
      : defaultCandidates;

  const effectiveTimeout = request.timeoutMs ?? (request.speedMode === 'fast' ? 28000 : UPSTREAM_TIMEOUT_MS);

  let lastErr: unknown = null;
  for (const candidate of candidates) {
    try {
      return await withFastRetry(
        () =>
          ai.models.generateContent({
            model: candidate.model,
            contents: request.contents as never,
            config: {
              ...request.config,
              ...(candidate.thinkingLevel
                ? { thinkingConfig: { thinkingLevel: candidate.thinkingLevel } }
                : {}),
            } as never,
          }),
        effectiveTimeout
      );
    } catch (err) {
      lastErr = err;
      console.warn(`[ALEXYN Gemini] Model "${candidate.model}" failed:`, extractAIError(err));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(extractAIError(lastErr));
}

interface OpenAICompatibleConfig {
  providerId: Exclude<AIProviderId, 'auto' | 'gemini'>;
  endpointUrl: string;
  apiKey: string;
  defaultModel: string;
  extraHeaders?: Record<string, string>;
  supportsVision: boolean;
}

function getOpenAICompatibleConfig(
  providerId: Exclude<AIProviderId, 'auto' | 'gemini'>,
  modelId?: string
): OpenAICompatibleConfig | null {
  if (providerId === 'openai') {
    const key = getProviderKey('openai');
    if (!key) return null;
    return {
      providerId,
      endpointUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: key,
      defaultModel:
        modelId && modelId !== 'auto'
          ? modelId
          : process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      supportsVision: true,
    };
  }
  if (providerId === 'groq') {
    const key = getProviderKey('groq');
    if (!key) return null;
    return {
      providerId,
      endpointUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: key,
      defaultModel:
        modelId && modelId !== 'auto' ? modelId : 'llama-3.3-70b-versatile',
      supportsVision: false,
    };
  }
  if (providerId === 'openrouter') {
    const key = getProviderKey('openrouter');
    if (!key) return null;
    const chosenModel =
      modelId && modelId !== 'auto'
        ? modelId
        : 'meta-llama/llama-3.3-70b-instruct:free';
    return {
      providerId,
      endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: key,
      defaultModel: chosenModel,
      extraHeaders: {
        'HTTP-Referer': 'https://alexyn.app',
        'X-Title': 'ALEXYN',
      },
      supportsVision: chosenModel.includes('gemma') || chosenModel.includes('gpt-4o'),
    };
  }
  if (providerId === 'mistral') {
    const key = getProviderKey('mistral');
    if (!key) return null;
    return {
      providerId,
      endpointUrl: 'https://api.mistral.ai/v1/chat/completions',
      apiKey: key,
      defaultModel:
        modelId && modelId !== 'auto' ? modelId : 'mistral-small-latest',
      supportsVision: false,
    };
  }
  if (providerId === 'custom') {
    const baseUrl = process.env.AI_CUSTOM_BASE_URL?.trim();
    if (!baseUrl) return null;
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const endpointUrl = normalizedBase.endsWith('/chat/completions')
      ? normalizedBase
      : `${normalizedBase}/chat/completions`;
    return {
      providerId,
      endpointUrl,
      apiKey: process.env.AI_CUSTOM_API_KEY?.trim() || 'ollama',
      defaultModel:
        modelId && modelId !== 'auto'
          ? modelId
          : process.env.AI_CUSTOM_MODEL?.trim() || 'llama3.2',
      supportsVision: false,
    };
  }
  return null;
}

async function callOpenAICompatible(params: {
  cfg: OpenAICompatibleConfig;
  systemInstruction: string;
  userPrompt: string;
  history?: ChatHistoryItem[];
  images?: ImagePayload[];
  jsonMode?: boolean;
  timeoutMs?: number;
}): Promise<{ text: string; model: string }> {
  const { cfg } = params;
  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  if (cfg.supportsVision) {
    for (const img of (params.images || []).slice(0, 4)) {
      if (img.base64Data && img.mimeType) {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` },
        });
      }
    }
  }
  userContent.push({ type: 'text', text: params.userPrompt });

  const historyMessages = (params.history || [])
    .slice(-8)
    .filter((item) => item.text?.trim())
    .map((item) => ({
      role: item.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: item.text.length > 1400 ? `${item.text.slice(0, 1400)}…` : item.text,
    }));

  const effectiveTimeoutMs = params.timeoutMs || UPSTREAM_TIMEOUT_MS;
  const attemptRequest = async (useJsonFormat: boolean) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);
    try {
      const response = await fetch(cfg.endpointUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey && cfg.apiKey !== 'no-key-required'
            ? { Authorization: `Bearer ${cfg.apiKey}` }
            : {}),
          ...(cfg.extraHeaders || {}),
        },
        body: JSON.stringify({
          model: cfg.defaultModel,
          ...(useJsonFormat ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: params.systemInstruction },
            ...historyMessages,
            {
              role: 'user',
              content: userContent.length === 1 ? params.userPrompt : userContent,
            },
          ],
        }),
      });

      const rawBody = await response.text();
      let payload: {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      } = {};
      try {
        payload = JSON.parse(rawBody);
      } catch {
        // non-json error body
      }

      if (!response.ok) {
        const providerPrefix = `${cfg.providerId.toUpperCase()} HTTP ${response.status}`;
        throw new Error(
          payload?.error?.message
            ? `${providerPrefix}: ${payload.error.message}`
            : `${providerPrefix}${rawBody ? `: ${rawBody.slice(0, 140)}` : ''}`
        );
      }

      return {
        text: payload?.choices?.[0]?.message?.content?.trim() || '',
        model: cfg.defaultModel,
      };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attemptRequest(Boolean(params.jsonMode));
  } catch (err) {
    const msg = extractAIError(err).toLowerCase();
    // Some OpenRouter/Custom models reject response_format: json_object — retry plain prompt cleanly
    if (
      params.jsonMode &&
      (msg.includes('response_format') || msg.includes('json_object') || msg.includes('http 400'))
    ) {
      return await attemptRequest(false);
    }
    throw err;
  }
}

async function streamOpenAICompatible(params: {
  cfg: OpenAICompatibleConfig;
  systemInstruction: string;
  userPrompt: string;
  history?: ChatHistoryItem[];
  images?: ImagePayload[];
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
}): Promise<{ text: string; model: string }> {
  const { cfg } = params;
  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [];

  if (cfg.supportsVision) {
    for (const img of (params.images || []).slice(0, 4)) {
      if (img.base64Data && img.mimeType) {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` },
        });
      }
    }
  }
  userContent.push({ type: 'text', text: params.userPrompt });

  const historyMessages = (params.history || [])
    .slice(-8)
    .filter((item) => item.text?.trim())
    .map((item) => ({
      role: item.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: item.text.length > 1400 ? `${item.text.slice(0, 1400)}…` : item.text,
    }));

  const controller = new AbortController();
  const abortListener = () => controller.abort();
  params.signal?.addEventListener('abort', abortListener, { once: true });
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(cfg.endpointUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey && cfg.apiKey !== 'no-key-required'
          ? { Authorization: `Bearer ${cfg.apiKey}` }
          : {}),
        ...(cfg.extraHeaders || {}),
      },
      body: JSON.stringify({
        model: cfg.defaultModel,
        stream: true,
        messages: [
          { role: 'system', content: params.systemInstruction },
          ...historyMessages,
          {
            role: 'user',
            content: userContent.length === 1 ? params.userPrompt : userContent,
          },
        ],
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => '');
      const providerPrefix = `${cfg.providerId.toUpperCase()} HTTP ${response.status}`;
      let msg = providerPrefix;
      try {
        const parsed = JSON.parse(errText) as { error?: { message?: string } };
        if (parsed?.error?.message) msg = `${providerPrefix}: ${parsed.error.message}`;
      } catch {
        if (errText) msg = `${providerPrefix}: ${errText.slice(0, 140)}`;
      }
      throw new Error(msg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const piece = parsed?.choices?.[0]?.delta?.content;
          if (typeof piece === 'string' && piece.length > 0) {
            fullText += piece;
            params.onDelta(piece);
          }
        } catch {
          // ignore partial SSE JSON fragment
        }
      }
    }

    return {
      text: fullText.trim(),
      model: cfg.defaultModel,
    };
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', abortListener);
  }
}

function resolveProviderQueue(
  selection?: AISelection,
  requiresVision = false
): Array<{
  providerId: Exclude<AIProviderId, 'auto'>;
  modelId?: string;
}> {
  const requestedProvider = selection?.providerId || 'auto';
  const requestedModel = selection?.modelId?.trim() || undefined;

  if (requestedProvider !== 'auto') {
    return [{ providerId: requestedProvider, modelId: requestedModel }];
  }

  const order: Array<Exclude<AIProviderId, 'auto'>> = requiresVision
    ? ['gemini', 'openai', 'openrouter', 'groq', 'mistral', 'custom']
    : ['gemini', 'groq', 'openrouter', 'mistral', 'openai', 'custom'];

  const configured = order
    .filter((id) => Boolean(getProviderKey(id)))
    .map((id) => ({
      providerId: id,
      modelId:
        requiresVision && id === 'openrouter'
          ? 'google/gemma-3-27b-it:free'
          : undefined,
    }));

  return configured;
}

function describeMissingProviderError(providerId: AIProviderId): string {
  const catalog = buildProviderCatalog();
  const info = catalog.find((p) => p.id === providerId);
  if (!info || providerId === 'auto') {
    return 'No AI provider is configured on the server yet. Add GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY in backend secrets.';
  }
  return `${info.name} is not configured on the backend server (${info.envVarHint}). ${info.requiresPaymentOrKey} Switch to a configured provider or Smart Auto in Settings.`;
}

async function runVisionExtractBridge(images: ImagePayload[]): Promise<{
  extractedDescription: string;
  helperProvider: string;
} | null> {
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = images
        .slice(0, 4)
        .filter((img) => img.base64Data && img.mimeType)
        .map((img) => ({
          inlineData: { mimeType: img.mimeType, data: img.base64Data },
        }));
      parts.push({
        text: 'Transcribe and accurately describe all text, equations, diagrams, labels, tables, and visual details shown in the attached image(s) so another reasoning model can help the learner cleanly.',
      });
      const resp = await generateGeminiContent(gemini, {
        contents: { parts },
        config: { systemInstruction: 'You are an exact visual transcription assistant.' },
      });
      if (resp.text?.trim()) {
        return { extractedDescription: resp.text.trim(), helperProvider: 'Gemini Vision' };
      }
    } catch {
      // fall through
    }
  }
  const openaiCfg = getOpenAICompatibleConfig('openai');
  if (openaiCfg) {
    try {
      const res = await callOpenAICompatible({
        cfg: openaiCfg,
        systemInstruction: 'Transcribe all visible text, equations, diagrams, and details accurately.',
        userPrompt: 'Describe everything shown in these image(s) accurately.',
        images,
        jsonMode: false,
      });
      if (res.text?.trim()) {
        return { extractedDescription: res.text.trim(), helperProvider: 'OpenAI Vision' };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

interface AppControlActionOut {
  id: string;
  type:
    | 'navigate_screen'
    | 'open_practice_lab'
    | 'plot_math_graph'
    | 'open_note'
    | 'generate_notes'
    | 'create_quiz'
    | 'search_exams'
    | 'clear_chat';
  label: string;
  requiresConfirmation?: boolean;
  payload: Record<string, unknown>;
}

const APP_ACTION_FUNCTION_DECL = {
  name: 'execute_app_action',
  description:
    'Trigger an in-app navigation or study action inside ALEXYN when the learner asks to open a workspace, generate notes, plot an equation, create/search quizzes, open Practice Area, or perform an action.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: {
        type: Type.STRING,
        description:
          'Action type: navigate_screen | open_practice_lab | plot_math_graph | open_note | generate_notes | create_quiz | search_exams | clear_chat',
      },
      label: {
        type: Type.STRING,
        description: 'Short clear label describing the action (e.g. "Open Smart Notes on Osmosis").',
      },
      requiresConfirmation: {
        type: Type.BOOLEAN,
        description: 'Must be true for destructive actions like clear_chat.',
      },
      screen: {
        type: Type.STRING,
        description: 'Target ScreenId for navigate_screen: explore | subjects | quizzes | notes | lab | progress | share',
      },
      modelId: {
        type: Type.STRING,
        description: 'Target LabModelId for open_practice_lab (e.g. math-graph, math-working, bio-cell, phys-circuit, lang-practice, humanities-timeline).',
      },
      subject: {
        type: Type.STRING,
        description: 'Subject name for notes, quiz, lab, or exam search.',
      },
      topic: {
        type: Type.STRING,
        description: 'Topic name for notes, quiz, or exam search.',
      },
      noteId: {
        type: Type.STRING,
        description: 'Existing note ID for open_note.',
      },
      equations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Equations to plot when type=plot_math_graph.',
      },
      difficulty: {
        type: Type.STRING,
        description: 'Quiz difficulty: easy | medium | hard.',
      },
      query: {
        type: Type.STRING,
        description: 'Search query for search_exams.',
      },
    },
    required: ['type', 'label'],
  },
};

function parseAppActionsFromText(rawText: string): {
  cleanText: string;
  actions: AppControlActionOut[];
} {
  const actions: AppControlActionOut[] = [];
  const regex = /<app_action>\s*([\s\S]*?)\s*<\/app_action>/gi;
  const cleanText = rawText
    .replace(regex, (_, jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr) as {
          type?: AppControlActionOut['type'];
          label?: string;
          requiresConfirmation?: boolean;
          payload?: Record<string, unknown>;
        };
        if (parsed.type && parsed.label) {
          actions.push({
            id: `act-${Date.now()}-${actions.length}`,
            type: parsed.type,
            label: parsed.label,
            requiresConfirmation: parsed.requiresConfirmation || parsed.type === 'clear_chat',
            payload: parsed.payload || {},
          });
        }
      } catch {
        // ignore malformed tag
      }
      return '';
    })
    .trim();
  return { cleanText, actions };
}

async function runChatAI(params: {
  systemInstruction: string;
  userPrompt: string;
  history?: ChatHistoryItem[];
  images?: ImagePayload[];
  aiSelection?: AISelection;
  enableAppActions?: boolean;
}): Promise<{
  reply: string;
  provider: string;
  model: string;
  visionNote?: string;
  appActions?: AppControlActionOut[];
}> {
  const hasImages = Boolean(params.images && params.images.length > 0);
  const isExplicit = Boolean(params.aiSelection?.providerId && params.aiSelection.providerId !== 'auto');
  const queue = resolveProviderQueue(params.aiSelection, hasImages);

  if (queue.length === 0) {
    throw new Error(describeMissingProviderError('auto'));
  }

  let effectivePrompt = params.userPrompt;
  let visionNote: string | undefined;

  let lastErr: unknown = null;
  for (const item of queue) {
    if (item.providerId === 'gemini') {
      const ai = getGeminiClient();
      if (!ai) {
        if (isExplicit) throw new Error(describeMissingProviderError('gemini'));
        continue;
      }
      try {
        const recentHistory = (params.history || [])
          .slice(-10)
          .map((h) => `${h.role === 'user' ? 'Learner' : 'ALEXYN'}: ${h.text}`)
          .join('\n\n');
        const fullPrompt = recentHistory
          ? `Previous conversation:\n${recentHistory}\n\nLatest learner message:\n${effectivePrompt}`
          : effectivePrompt;

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
        parts.push({ text: fullPrompt });

        const config: Record<string, unknown> = {
          systemInstruction: params.systemInstruction,
        };
        if (params.enableAppActions) {
          config.tools = [{ functionDeclarations: [APP_ACTION_FUNCTION_DECL] }];
        }

        const response = await generateGeminiContent(ai, {
          contents: { parts },
          config,
          preferredModel: item.modelId,
        });

        const functionCalls = (
          response as {
            functionCalls?: Array<{ name?: string; args?: Record<string, unknown> }>;
          }
        ).functionCalls;

        const extractedActions: AppControlActionOut[] = [];
        for (const fc of functionCalls || []) {
          if (fc.name === 'execute_app_action' && fc.args) {
            const { type, label, requiresConfirmation, ...rest } = fc.args;
            if (typeof type === 'string' && typeof label === 'string') {
              extractedActions.push({
                id: `act-${Date.now()}-${extractedActions.length}`,
                type: type as AppControlActionOut['type'],
                label,
                requiresConfirmation: Boolean(requiresConfirmation) || type === 'clear_chat',
                payload: rest,
              });
            }
          }
        }

        const parsedInline = parseAppActionsFromText(response.text?.trim() || '');
        const allActions = [...extractedActions, ...parsedInline.actions];

        // If Gemini only returned a function call without prose, follow up concisely
        let replyText = parsedInline.cleanText;
        if (!replyText && allActions.length > 0) {
          replyText = `Done — ${allActions.map((a) => a.label).join('; ')}.`;
        }

        return {
          reply: replyText || 'I processed your message, could you share a little more detail?',
          provider: 'gemini',
          model: item.modelId || 'gemini-4-hydrogen',
          visionNote,
          appActions: allActions.length > 0 ? allActions : undefined,
        };
      } catch (err) {
        lastErr = err;
        console.warn('[ALEXYN Chat] Gemini failed:', extractAIError(err));
        if (isExplicit) throw err;
      }
    } else {
      const cfg = getOpenAICompatibleConfig(item.providerId, item.modelId);
      if (!cfg) {
        if (isExplicit) throw new Error(describeMissingProviderError(item.providerId));
        continue;
      }

      // Honest vision check: if images attached and chosen model lacks native vision,
      // route image transcription via Gemini/OpenAI vision bridge first OR inform honestly.
      let imagesForModel = params.images;
      if (hasImages && !cfg.supportsVision) {
        const bridged = await runVisionExtractBridge(params.images!);
        if (bridged) {
          effectivePrompt = `[Visual content inspected via ${bridged.helperProvider}]:\n${bridged.extractedDescription}\n\nUser request:\n${params.userPrompt}`;
          imagesForModel = [];
          visionNote = `Image details were inspected using ${bridged.helperProvider} before ${cfg.defaultModel} answered.`;
        } else if (isExplicit) {
          throw new Error(
            `${item.providerId.toUpperCase()} (${cfg.defaultModel}) is text-only and cannot read images directly. Switch to Google Gemini, OpenAI GPT-4o, or Gemma 3 Vision in Settings.`
          );
        } else {
          continue;
        }
      }

      try {
        const result = await withFastRetry(() =>
          callOpenAICompatible({
            cfg,
            systemInstruction: params.systemInstruction,
            userPrompt: effectivePrompt,
            history: params.history,
            images: imagesForModel,
            jsonMode: false,
          })
        );
        if (result.text) {
          const parsedInline = parseAppActionsFromText(result.text);
          return {
            reply: parsedInline.cleanText,
            provider: item.providerId,
            model: result.model,
            visionNote,
            appActions: parsedInline.actions.length > 0 ? parsedInline.actions : undefined,
          };
        }
        throw new Error(`${item.providerId} returned an empty reply.`);
      } catch (err) {
        const msg = extractAIError(err);
        lastErr = err;
        console.warn(`[ALEXYN Chat] ${item.providerId} failed:`, msg);
        if (isExplicit) throw err;
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('All configured AI providers failed.');
}

async function streamChatAI(params: {
  systemInstruction: string;
  userPrompt: string;
  history?: ChatHistoryItem[];
  images?: ImagePayload[];
  aiSelection?: AISelection;
  enableAppActions?: boolean;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}): Promise<{
  reply: string;
  provider: string;
  model: string;
  visionNote?: string;
  appActions?: AppControlActionOut[];
}> {
  const hasImages = Boolean(params.images && params.images.length > 0);
  const isExplicit = Boolean(params.aiSelection?.providerId && params.aiSelection.providerId !== 'auto');
  const queue = resolveProviderQueue(params.aiSelection, hasImages);

  if (queue.length === 0) {
    throw new Error(describeMissingProviderError('auto'));
  }

  let effectivePrompt = params.userPrompt;
  let visionNote: string | undefined;
  let lastErr: unknown = null;

  for (const item of queue) {
    if (params.signal?.aborted) {
      throw new Error('Request cancelled.');
    }

    if (item.providerId === 'gemini') {
      const ai = getGeminiClient();
      if (!ai) {
        if (isExplicit) throw new Error(describeMissingProviderError('gemini'));
        continue;
      }

      const recentHistory = (params.history || [])
        .slice(-8)
        .map((h) => `${h.role === 'user' ? 'Learner' : 'ALEXYN'}: ${h.text.length > 1400 ? `${h.text.slice(0, 1400)}…` : h.text}`)
        .join('\n\n');
      const fullPrompt = recentHistory
        ? `Previous conversation:\n${recentHistory}\n\nLatest learner message:\n${effectivePrompt}`
        : effectivePrompt;

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      for (const img of (params.images || []).slice(0, 4)) {
        if (img.base64Data && img.mimeType) {
          parts.push({
            inlineData: { mimeType: img.mimeType, data: img.base64Data },
          });
        }
      }
      parts.push({ text: fullPrompt });

      const modelCandidates: Array<{ model: string; thinkingLevel?: ThinkingLevel }> =
        item.modelId && item.modelId !== 'auto'
          ? [
              {
                model: item.modelId,
                thinkingLevel: item.modelId.includes('lite')
                  ? ThinkingLevel.MINIMAL
                  : ThinkingLevel.LOW,
              },
              { model: 'gemini-3.1-flash-lite' },
            ]
          : [
              { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
              { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
              { model: 'gemini-3.1-flash-lite' },
            ];

      for (const candidate of modelCandidates) {
        let emittedAnyDelta = false;
        try {
          const streamConfig: Record<string, unknown> = {
            systemInstruction: params.systemInstruction,
            ...(candidate.thinkingLevel
              ? { thinkingConfig: { thinkingLevel: candidate.thinkingLevel } }
              : {}),
          };
          if (params.enableAppActions) {
            streamConfig.tools = [{ functionDeclarations: [APP_ACTION_FUNCTION_DECL] }];
          }

          const stream = await ai.models.generateContentStream({
            model: candidate.model,
            contents: { parts } as never,
            config: streamConfig as never,
          });
          let fullText = '';
          const extractedActions: AppControlActionOut[] = [];
          for await (const chunk of stream) {
            if (params.signal?.aborted) break;
            const partTexts =
              (
                chunk as {
                  candidates?: Array<{
                    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
                  }>;
                }
              )?.candidates?.[0]?.content?.parts
                ?.filter((p) => !p.thought && typeof p.text === 'string' && p.text.length > 0)
                .map((p) => p.text!)
                .join('') || '';
            const piece = chunk.text || partTexts;
            if (piece) {
              emittedAnyDelta = true;
              fullText += piece;
              params.onDelta(piece);
            }
            const fcs = (
              chunk as {
                functionCalls?: Array<{ name?: string; args?: Record<string, unknown> }>;
              }
            ).functionCalls;
            for (const fc of fcs || []) {
              if (fc.name === 'execute_app_action' && fc.args) {
                const { type, label, requiresConfirmation, ...rest } = fc.args;
                if (typeof type === 'string' && typeof label === 'string') {
                  extractedActions.push({
                    id: `act-${Date.now()}-${extractedActions.length}`,
                    type: type as AppControlActionOut['type'],
                    label,
                    requiresConfirmation: Boolean(requiresConfirmation) || type === 'clear_chat',
                    payload: rest,
                  });
                }
              }
            }
          }
          const parsedInline = parseAppActionsFromText(fullText.trim());
          const allActions = [...extractedActions, ...parsedInline.actions];
          const replyText =
            parsedInline.cleanText ||
            (allActions.length > 0 ? `Done — ${allActions.map((a) => a.label).join('; ')}.` : '');

          if (!replyText && !params.signal?.aborted) {
            throw new Error(`${candidate.model} stream finished with empty text.`);
          }

          return {
            reply: replyText,
            provider: 'gemini',
            model: candidate.model,
            visionNote,
            appActions: allActions.length > 0 ? allActions : undefined,
          };
        } catch (err) {
          lastErr = err;
          console.warn(`[ALEXYN Stream] Gemini ${candidate.model} failed:`, extractAIError(err));
          if (emittedAnyDelta) throw err;
        }
      }
      if (isExplicit) throw lastErr;
    } else {
      const cfg = getOpenAICompatibleConfig(item.providerId, item.modelId);
      if (!cfg) {
        if (isExplicit) throw new Error(describeMissingProviderError(item.providerId));
        continue;
      }

      let imagesForModel = params.images;
      if (hasImages && !cfg.supportsVision) {
        const bridged = await runVisionExtractBridge(params.images!);
        if (bridged) {
          effectivePrompt = `[Visual content inspected via ${bridged.helperProvider}]:\n${bridged.extractedDescription}\n\nUser request:\n${params.userPrompt}`;
          imagesForModel = [];
          visionNote = `Image details were inspected using ${bridged.helperProvider} before ${cfg.defaultModel} answered.`;
        } else if (isExplicit) {
          throw new Error(
            `${item.providerId.toUpperCase()} (${cfg.defaultModel}) is text-only and cannot read images directly. Switch to Google Gemini, OpenAI GPT-4o, or Gemma 3 Vision in Settings.`
          );
        } else {
          continue;
        }
      }

      try {
        const streamed = await streamOpenAICompatible({
          cfg,
          systemInstruction: params.systemInstruction,
          userPrompt: effectivePrompt,
          history: params.history,
          images: imagesForModel,
          signal: params.signal,
          onDelta: params.onDelta,
        });
        if (streamed.text || params.signal?.aborted) {
          const parsedInline = parseAppActionsFromText(streamed.text);
          return {
            reply: parsedInline.cleanText,
            provider: item.providerId,
            model: streamed.model,
            visionNote,
            appActions: parsedInline.actions.length > 0 ? parsedInline.actions : undefined,
          };
        }
        throw new Error(`${item.providerId} returned an empty reply.`);
      } catch (err) {
        const msg = extractAIError(err);
        lastErr = err;
        console.warn(`[ALEXYN Stream] ${item.providerId} failed:`, msg);
        if (isExplicit) throw err;
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('All configured AI providers failed.');
}

async function runStructuredJsonAI<T>(params: {
  systemInstruction: string;
  userPrompt: string;
  images?: ImagePayload[];
  responseSchema?: Record<string, unknown>;
  aiSelection?: AISelection;
  speedMode?: 'balanced' | 'fast';
  timeoutMs?: number;
}): Promise<T> {
  const hasImages = Boolean(params.images && params.images.length > 0);
  const isExplicit = Boolean(params.aiSelection?.providerId && params.aiSelection.providerId !== 'auto');
  const queue = resolveProviderQueue(params.aiSelection, hasImages);

  if (queue.length === 0) {
    throw new Error(describeMissingProviderError('auto'));
  }

  let effectivePrompt = params.userPrompt;
  let lastErr: unknown = null;
  for (const item of queue) {
    if (item.providerId === 'gemini') {
      const ai = getGeminiClient();
      if (!ai) {
        if (isExplicit) throw new Error(describeMissingProviderError('gemini'));
        continue;
      }
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
        parts.push({ text: effectivePrompt });

        const response = await generateGeminiContent(ai, {
          contents: { parts },
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            ...(params.responseSchema ? { responseSchema: params.responseSchema } : {}),
          },
          preferredModel: item.modelId,
          speedMode: params.speedMode,
          timeoutMs: params.timeoutMs,
        });

        const raw = (response.text ?? '{}').trim();
        return parseAIJsonSafe<T>(raw);
      } catch (err) {
        lastErr = err;
        console.warn('[ALEXYN Structured AI] Gemini failed:', extractAIError(err));
        if (isExplicit) throw err;
      }
    } else {
      const cfg = getOpenAICompatibleConfig(item.providerId, item.modelId);
      if (!cfg) {
        if (isExplicit) throw new Error(describeMissingProviderError(item.providerId));
        continue;
      }

      let imagesForModel = params.images;
      if (hasImages && !cfg.supportsVision) {
        const bridged = await runVisionExtractBridge(params.images!);
        if (bridged) {
          effectivePrompt = `[Visual content inspected via ${bridged.helperProvider}]:\n${bridged.extractedDescription}\n\n${params.userPrompt}`;
          imagesForModel = [];
        } else if (isExplicit) {
          throw new Error(
            `${item.providerId.toUpperCase()} (${cfg.defaultModel}) does not support image inputs. Switch to Google Gemini or OpenAI in Settings.`
          );
        } else {
          continue;
        }
      }

      try {
        const effectiveTimeout = params.timeoutMs ?? (params.speedMode === 'fast' ? 28000 : UPSTREAM_TIMEOUT_MS);
        const result = await withFastRetry(
          () =>
            callOpenAICompatible({
              cfg,
              systemInstruction: `${params.systemInstruction}\nIMPORTANT: Return ONLY valid JSON matching the requested schema (no prose outside JSON).`,
              userPrompt: effectivePrompt,
              images: imagesForModel,
              jsonMode: true,
              timeoutMs: effectiveTimeout,
            }),
          effectiveTimeout
        );
        if (result.text) {
          return parseAIJsonSafe<T>(result.text);
        }
        throw new Error(`${item.providerId} returned an empty JSON response.`);
      } catch (err) {
        const msg = extractAIError(err);
        lastErr = err;
        console.warn(`[ALEXYN Structured AI] ${item.providerId} failed:`, msg);
        if (isExplicit) throw err;
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('AI provider unavailable.');
}

async function searchDuckDuckGoHtml(query: string, limit = 8): Promise<WebSearchHit[]> {
  const collected: WebSearchHit[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4200);
    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const ddgRes = await fetch(ddgUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
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
        while ((m = linkRegex.exec(html)) !== null && collected.length < limit) {
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
    // ignore DDG failure
  }
  return collected;
}

function detectKenyanAgency(urlStr: string): 'KICD' | 'Kenya Education Cloud' | 'KNEC' | undefined {
  const low = urlStr.toLowerCase();
  if (low.includes('kicd.ac.ke')) return 'KICD';
  if (low.includes('lms.kec.ac.ke') || low.includes('kec.ac.ke')) return 'Kenya Education Cloud';
  if (low.includes('knec.ac.ke')) return 'KNEC';
  return undefined;
}

function looksLikePdfUrl(urlStr: string): boolean {
  const low = urlStr.toLowerCase().split('#')[0].split('?')[0];
  return low.endsWith('.pdf') || urlStr.toLowerCase().includes('.pdf');
}

interface ExamResourceHit {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceDomain: string;
  isKenyanOfficial: boolean;
  kenyanAgency?: 'KICD' | 'Kenya Education Cloud' | 'KNEC';
  resourceType: 'pdf' | 'webpage';
  snippet: string;
  matchedCriteria: string[];
}

const NON_EDUCATIONAL_FILTER_REGEX =
  /\b(tender|procurement|framework-contract|vacancy|vacancies|recruitment|addendum|bidder|supplier|prequalification|quarry|ict-equipment)\b/i;

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchWordPressPortal(
  baseUrl: string,
  searchQueries: string[],
  agencyName: 'KICD' | 'KNEC'
): Promise<WebSearchHit[]> {
  const hits: WebSearchHit[] = [];
  const seen = new Set<string>();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; ALEXYN-Edu/1.0)',
    Accept: 'application/json',
  };

  for (const q of searchQueries.slice(0, 2)) {
    const cleanQ = q.trim();
    if (!cleanQ) continue;
    try {
      const [pageRes, mediaRes] = await Promise.all([
        fetch(
          `${baseUrl}/wp-json/wp/v2/search?search=${encodeURIComponent(cleanQ)}&per_page=6`,
          { headers, signal: AbortSignal.timeout(5000) }
        ).catch(() => null),
        fetch(
          `${baseUrl}/wp-json/wp/v2/media?search=${encodeURIComponent(cleanQ)}&per_page=6`,
          { headers, signal: AbortSignal.timeout(5000) }
        ).catch(() => null),
      ]);

      if (pageRes && pageRes.ok) {
        const items = (await pageRes.json().catch(() => [])) as Array<{
          title?: string;
          url?: string;
          subtype?: string;
        }>;
        for (const item of items) {
          if (!item?.url || seen.has(item.url)) continue;
          const title = decodeHtmlEntities(String(item.title || ''));
          if (!title || NON_EDUCATIONAL_FILTER_REGEX.test(`${title} ${item.url}`)) continue;
          seen.add(item.url);
          hits.push({
            title,
            url: item.url,
            snippet: `Official ${agencyName} curriculum resource (${item.subtype || 'page'}) matching "${cleanQ}".`,
          });
        }
      }

      if (mediaRes && mediaRes.ok) {
        const mediaItems = (await mediaRes.json().catch(() => [])) as Array<{
          source_url?: string;
          mime_type?: string;
          title?: { rendered?: string };
        }>;
        for (const m of mediaItems) {
          const url = m?.source_url;
          if (!url || seen.has(url)) continue;
          if (m.mime_type !== 'application/pdf' && !looksLikePdfUrl(url)) continue;
          const title = decodeHtmlEntities(String(m.title?.rendered || path.basename(url)));
          if (NON_EDUCATIONAL_FILTER_REGEX.test(`${title} ${url}`)) continue;
          seen.add(url);
          hits.push({
            title: title || `${agencyName} PDF Document`,
            url,
            snippet: `Official ${agencyName} PDF document matching "${cleanQ}".`,
          });
        }
      }
    } catch {
      // portal unreachable or timed out cleanly
    }
  }
  return hits;
}

async function searchKECMoodleCourses(searchQueries: string[]): Promise<WebSearchHit[]> {
  const hits: WebSearchHit[] = [];
  const seen = new Set<string>();

  for (const q of searchQueries.slice(0, 2)) {
    const cleanQ = q.trim();
    if (!cleanQ) continue;
    try {
      const url = `https://lms.kec.ac.ke/course/search.php?search=${encodeURIComponent(cleanQ)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ALEXYN-Edu/1.0)',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const cardRegex =
        /<h4[^>]*class=['"]card-title[^'"]*['"][^>]*>[\s\S]*?<a[^>]*href=['"](https:\/\/lms\.kec\.ac\.ke\/course\/view\.php\?id=\d+)['"][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h4>[\s\S]*?(?:Category:\s*<a[^>]*>([\s\S]*?)<\/a>)?/gi;
      let match: RegExpExecArray | null;
      while ((match = cardRegex.exec(html)) !== null && hits.length < 8) {
        const courseUrl = match[1];
        if (!courseUrl || seen.has(courseUrl)) continue;
        seen.add(courseUrl);
        const title = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ''));
        const category = decodeHtmlEntities((match[3] || '').replace(/<[^>]+>/g, ''));
        if (!title) continue;
        hits.push({
          title,
          url: courseUrl,
          snippet: category
            ? `Kenya Education Cloud (KICD LMS) course · Category: ${category}.`
            : 'Kenya Education Cloud (KICD LMS) official digital lesson.',
        });
      }
    } catch {
      // KEC search timeout/error ignored cleanly
    }
  }
  return hits;
}

async function discoverPdfsOnPage(pageUrl: string, criteriaTerms: string[]): Promise<ExamResourceHit[]> {
  try {
    const parsed = new URL(pageUrl);
    if (isPrivateOrBlockedHost(parsed.hostname)) return [];
    const res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(4500),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ALEXYN-Edu/1.0)' },
    });
    if (!res.ok) return [];
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (!ctype.includes('html')) return [];
    const html = await res.text();
    const anchorRegex = /<a[^>]*href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const found: ExamResourceHit[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(html)) !== null && found.length < 4) {
      let resolvedUrl = match[1].trim();
      try {
        resolvedUrl = new URL(resolvedUrl, parsed.toString()).toString();
      } catch {
        continue;
      }
      if (seen.has(resolvedUrl)) continue;
      seen.add(resolvedUrl);

      const linkText = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ''));
      if (NON_EDUCATIONAL_FILTER_REGEX.test(`${linkText} ${resolvedUrl}`)) continue;
      const combined = `${linkText} ${resolvedUrl}`.toLowerCase();
      const matched = criteriaTerms.filter((t) => combined.includes(t.toLowerCase()));
      if (criteriaTerms.length > 0 && matched.length === 0 && !detectKenyanAgency(resolvedUrl)) {
        continue;
      }

      const host = new URL(resolvedUrl).hostname.replace(/^www\./, '');
      const agency = detectKenyanAgency(resolvedUrl);
      found.push({
        id: `res-pdf-${found.length}-${Date.now()}`,
        title: linkText || path.basename(new URL(resolvedUrl).pathname) || 'PDF Document',
        url: resolvedUrl,
        sourceName: agency || host,
        sourceDomain: host,
        isKenyanOfficial: Boolean(agency),
        kenyanAgency: agency,
        resourceType: 'pdf',
        snippet: `Direct PDF document discovered on ${host}`,
        matchedCriteria: matched,
      });
    }
    return found;
  } catch {
    return [];
  }
}

async function searchExamResources(params: {
  query?: string;
  subject?: string;
  grade?: string;
  topic?: string;
  year?: string;
  examType?: string;
  country?: string;
  resourceType?: string;
  prioritizeKenya?: boolean;
  profile?: EducationProfile;
}): Promise<{
  resources: ExamResourceHit[];
  kenyanPrioritized: boolean;
  searchStatus: string | null;
}> {
  const effectiveCountry = (params.country || params.profile?.country || '').toLowerCase();
  const isKenyanProfile = Boolean(
    effectiveCountry.includes('kenya') ||
      params.profile?.curriculum?.toLowerCase().includes('kenya') ||
      params.profile?.curriculum?.toLowerCase().includes('cbc') ||
      params.profile?.curriculum?.toLowerCase().includes('kcse') ||
      /\b(kcse|kpsea|kjsea|kcpe|knec|kicd|kec|cbc|8-4-4)\b/i.test(
        `${params.examType || ''} ${params.query || ''}`
      )
  );
  const kenyanPrioritized =
    params.prioritizeKenya !== undefined
      ? params.prioritizeKenya
      : !effectiveCountry || isKenyanProfile;

  const coreSearchPhrase = [
    params.subject || '',
    params.grade || '',
    params.topic || '',
    params.year || '',
    params.resourceType && params.resourceType !== 'all' ? params.resourceType : '',
    params.country || '',
    params.query || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const portalQueries = Array.from(
    new Set(
      [
        [params.subject, params.topic].filter(Boolean).join(' ').trim(),
        [params.grade, params.subject].filter(Boolean).join(' ').trim(),
        params.subject?.trim() || '',
        params.topic?.trim() || '',
      ].filter((q) => q.length >= 2)
    )
  );

  const criteriaTerms = [params.subject, params.grade, params.topic, params.year, params.examType]
    .flatMap((x) => (x ? x.split(/[\s/,]+/) : []))
    .map((x) => x.trim())
    .filter((x) => x.length >= 3);

  const searchPromises: Array<Promise<WebSearchHit[]>> = [];

  if (kenyanPrioritized) {
    searchPromises.push(searchWordPressPortal('https://kicd.ac.ke', portalQueries, 'KICD'));
    searchPromises.push(searchKECMoodleCourses(portalQueries));
    searchPromises.push(searchWordPressPortal('https://knec.ac.ke', portalQueries, 'KNEC'));
    searchPromises.push(
      searchDuckDuckGoHtml(
        `(site:kicd.ac.ke OR site:lms.kec.ac.ke OR site:knec.ac.ke) ${coreSearchPhrase}`,
        8
      )
    );
  }

  searchPromises.push(
    searchDuckDuckGoHtml(
      `${coreSearchPhrase} ${params.examType || ''} past paper pdf`.trim(),
      8
    )
  );
  searchPromises.push(
    fetchWikipediaSearchHits(`${coreSearchPhrase} ${params.examType || ''}`.trim(), 3)
  );
  searchPromises.push(
    fetchDuckDuckGoInstantHits(`${coreSearchPhrase} ${params.examType || ''}`.trim(), 3)
  );

  // Also check Gemini Google Search grounding if available
  const ai = getGeminiClient();
  if (ai) {
    searchPromises.push(
      (async (): Promise<WebSearchHit[]> => {
        try {
          const siteHint = kenyanPrioritized
            ? 'Prioritize official Kenyan curriculum and examination sites: kicd.ac.ke, lms.kec.ac.ke, and knec.ac.ke.'
            : 'Focus on official examination boards and curriculum portals.';
          const resp = await generateGeminiContent(ai, {
            contents: `Find authentic online curriculum documents, official past papers, and PDF exam links for: ${coreSearchPhrase} (${params.examType || ''}). ${siteHint}`,
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
          const out: WebSearchHit[] = [];
          for (const ch of chunks || []) {
            if (ch.web?.uri) {
              out.push({
                title: ch.web.title || ch.web.uri,
                url: ch.web.uri,
                snippet: (resp.text || '').slice(0, 240),
              });
            }
          }
          return out;
        } catch {
          return [];
        }
      })()
    );
  }

  const settled = await Promise.all(searchPromises);
  const mergedHits = settled.flat();

  const byUrl = new Map<string, ExamResourceHit>();
  for (const hit of mergedHits) {
    let parsed: URL;
    try {
      parsed = new URL(hit.url);
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) continue;
    const cleanUrl = parsed.toString();
    if (byUrl.has(cleanUrl)) continue;
    if (NON_EDUCATIONAL_FILTER_REGEX.test(`${hit.title} ${cleanUrl}`)) continue;

    const host = parsed.hostname.replace(/^www\./, '');
    const agency = detectKenyanAgency(cleanUrl);
    const hay = `${hit.title} ${hit.snippet} ${cleanUrl}`.toLowerCase();
    const matched = criteriaTerms.filter((t) => hay.includes(t.toLowerCase()));

    byUrl.set(cleanUrl, {
      id: `res-${byUrl.size + 1}-${Date.now()}`,
      title: hit.title || host,
      url: cleanUrl,
      sourceName: agency || host,
      sourceDomain: host,
      isKenyanOfficial: Boolean(agency),
      kenyanAgency: agency,
      resourceType: looksLikePdfUrl(cleanUrl) ? 'pdf' : 'webpage',
      snippet: hit.snippet || '',
      matchedCriteria: matched,
    });
  }

  // Inspect top 3 official/relevant webpage hits for direct PDF links inside their pages
  const topPagesForPdfScan = Array.from(byUrl.values())
    .filter((r) => r.resourceType === 'webpage')
    .sort((a, b) => {
      const sa = (a.isKenyanOfficial ? 10 : 0) + a.matchedCriteria.length * 2;
      const sb = (b.isKenyanOfficial ? 10 : 0) + b.matchedCriteria.length * 2;
      return sb - sa;
    })
    .slice(0, 3);

  if (topPagesForPdfScan.length > 0) {
    const pdfLists = await Promise.all(
      topPagesForPdfScan.map((p) => discoverPdfsOnPage(p.url, criteriaTerms))
    );
    for (const pdf of pdfLists.flat()) {
      if (!byUrl.has(pdf.url)) {
        byUrl.set(pdf.url, pdf);
      }
    }
  }

  const resources = Array.from(byUrl.values())
    .sort((a, b) => {
      const scoreA =
        (a.isKenyanOfficial ? 10 : 0) +
        (a.resourceType === 'pdf' ? 5 : 0) +
        a.matchedCriteria.length * 3;
      const scoreB =
        (b.isKenyanOfficial ? 10 : 0) +
        (b.resourceType === 'pdf' ? 5 : 0) +
        b.matchedCriteria.length * 3;
      return scoreB - scoreA;
    })
    .slice(0, 12);

  return {
    resources,
    kenyanPrioritized,
    searchStatus:
      resources.length === 0
        ? 'No live matching online documents were returned from external search in this environment. You can still open the official KICD, KEC, or KNEC portals directly or generate a curriculum-based practice exam clearly marked as AI-generated.'
        : null,
  };
}

async function fetchWikipediaSearchHits(query: string, limit = 3): Promise<WebSearchHit[]> {
  const hits: WebSearchHit[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4200);
  try {
    const cleanQ = query
      .replace(/\b(check\s+wikipedia|on\s+wikipedia|wikipedia|search(\s+the\s+web|\s+online)?|look\s+up|find\s+sources?|latest|current|recent|please|tell\s+me(\s+about)?|briefly|summarize|explain|describe|and\s+also)\b/gi, ' ')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    if (!cleanQ) return [];

    const runWikiQuery = async (srsearch: string): Promise<Array<{ title: string; snippet: string }>> => {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        srsearch
      )}&format=json&srlimit=${limit}`;
      const wRes = await fetch(wikiUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ALEXYN-Edu/1.0 (https://alexyn.app)' },
      });
      if (!wRes.ok) return [];
      const wData = (await wRes.json()) as {
        query?: { search?: Array<{ title: string; snippet: string }> };
      };
      return wData?.query?.search || [];
    };

    let items = await runWikiQuery(cleanQ);
    if (items.length === 0) {
      const keywords = cleanQ
        .split(/\s+/)
        .filter((w) => w.length > 2 && !/^(the|and|for|with|what|who|where|when|why|how|are|was|were|from|that|this|into)$/i.test(w))
        .slice(0, 4)
        .join(' ');
      if (keywords && keywords !== cleanQ) {
        items = await runWikiQuery(keywords);
      }
      if (items.length === 0) {
        const longestTerm = cleanQ
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .sort((a, b) => b.length - a.length)[0];
        if (longestTerm && longestTerm !== keywords) {
          items = await runWikiQuery(longestTerm);
        }
      }
    }

    for (const item of items) {
      hits.push({
        title: `${item.title} — Wikipedia`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(
          item.title.replace(/\s+/g, '_')
        )}`,
        snippet: decodeHtmlEntities(item.snippet.replace(/<[^>]+>/g, '').trim()),
      });
    }
  } catch {
    // ignore Wikipedia search failure
  } finally {
    clearTimeout(timer);
  }
  return hits;
}

async function fetchDuckDuckGoInstantHits(query: string, limit = 3): Promise<WebSearchHit[]> {
  const hits: WebSearchHit[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3800);
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query.slice(0, 160)
    )}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ALEXYN-Edu/1.0' },
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{
        Text?: string;
        FirstURL?: string;
        Topics?: Array<{ Text?: string; FirstURL?: string }>;
      }>;
    };
    if (data.AbstractURL && data.AbstractText) {
      hits.push({
        title: `${data.Heading || data.AbstractSource || 'DuckDuckGo Reference'} (${data.AbstractSource || 'Reference'})`,
        url: data.AbstractURL,
        snippet: data.AbstractText.slice(0, 280),
      });
    }
    for (const rt of data.RelatedTopics || []) {
      if (hits.length >= limit) break;
      if (rt.FirstURL && rt.Text) {
        hits.push({
          title: rt.Text.split(' - ')[0].slice(0, 90),
          url: rt.FirstURL,
          snippet: rt.Text.slice(0, 220),
        });
      } else if (Array.isArray(rt.Topics)) {
        for (const sub of rt.Topics) {
          if (hits.length >= limit) break;
          if (sub.FirstURL && sub.Text) {
            hits.push({
              title: sub.Text.split(' - ')[0].slice(0, 90),
              url: sub.FirstURL,
              snippet: sub.Text.slice(0, 220),
            });
          }
        }
      }
    }
  } catch {
    // ignore DuckDuckGo Instant error
  } finally {
    clearTimeout(timer);
  }
  return hits;
}

function capSearchPromise<T>(promise: Promise<T[]>, capMs: number): Promise<T[]> {
  return Promise.race([
    promise.catch(() => [] as T[]),
    new Promise<T[]>((resolve) => setTimeout(() => resolve([]), capMs)),
  ]);
}

async function fetchPublicWebSearch(query: string): Promise<{
  hits: WebSearchHit[];
  searchError?: string;
}> {
  const ai = getGeminiClient();
  const geminiPromise: Promise<WebSearchHit[]> = ai
    ? (async () => {
        try {
          const resp = await generateGeminiContent(ai, {
            contents: `Search trustworthy educational and factual online sources for: ${query}. Summarize key verifiable facts briefly.`,
            config: {
              tools: [{ googleSearch: {} }],
            },
            speedMode: 'fast',
            timeoutMs: 4200,
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
          const out: WebSearchHit[] = [];
          const summarySnippet = (resp.text || '').replace(/\s+/g, ' ').trim().slice(0, 260);
          for (const ch of chunks || []) {
            if (ch.web?.uri) {
              out.push({
                title: ch.web.title || extractSourceDomain(ch.web.uri) || ch.web.uri,
                url: ch.web.uri,
                snippet: summarySnippet,
              });
            }
          }
          return out.slice(0, 4);
        } catch (err) {
          console.warn('[ALEXYN Search] Gemini search grounding fallback:', extractAIError(err));
          return [];
        }
      })()
    : Promise.resolve([]);

  // Cap every provider independently so slow upstream never discards fast sources
  const [geminiHits, ddgHtmlHits, ddgInstantHits, wikiHits] = await Promise.all([
    capSearchPromise(geminiPromise, 4600),
    capSearchPromise(searchDuckDuckGoHtml(query, 4), 4500),
    capSearchPromise(fetchDuckDuckGoInstantHits(query, 3), 4000),
    capSearchPromise(fetchWikipediaSearchHits(query, 3), 4500),
  ]);

  const deduped: WebSearchHit[] = [];
  const seenUrls = new Set<string>();
  for (const hit of [...geminiHits, ...ddgInstantHits, ...wikiHits, ...ddgHtmlHits]) {
    if (!hit.url) continue;
    try {
      const parsed = new URL(hit.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      const cleanUrl = parsed.toString();
      if (seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);
      deduped.push({
        title: hit.title || extractSourceDomain(cleanUrl) || cleanUrl,
        url: cleanUrl,
        snippet: hit.snippet || '',
      });
      if (deduped.length >= 6) break;
    } catch {
      // skip invalid url
    }
  }

  if (deduped.length === 0) {
    return {
      hits: [],
      searchError:
        'Live online search could not reach external sources right now. The response below relies on the AI model knowledge without live web citations.',
    };
  }
  return { hits: deduped };
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
}): Promise<{
  text: string;
  detailLabel: string;
  pageCount?: number;
  pages?: Array<{ pageNumber: number; text: string }>;
}> {
  const cleanB64 = params.base64Data.includes(',')
    ? params.base64Data.split(',')[1]
    : params.base64Data;
  const buffer = Buffer.from(cleanB64, 'base64');
  const ext = path.extname(params.fileName || '').toLowerCase();
  const mime = (params.mimeType || '').toLowerCase();

  if (ext === '.pdf' || mime.includes('pdf')) {
    const perPage = await extractPdfText(new Uint8Array(buffer), { mergePages: false });
    const rawPages = Array.isArray(perPage.text) ? perPage.text : [String(perPage.text || '')];
    const pages = rawPages.map((pText, idx) => ({
      pageNumber: idx + 1,
      text: String(pText || '').trim(),
    }));
    const pageCount = perPage.totalPages || pages.length;
    const rawText = pages
      .filter((p) => p.text.length > 0)
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n\n')
      .trim();
    return {
      text: rawText,
      detailLabel: `${pageCount || '?'} PDF page(s)`,
      pageCount,
      pages,
    };
  }

  if (ext === '.docx' || mime.includes('wordprocessingml')) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: (result.value || '').trim(),
      detailLabel: 'Word document (.docx)',
    };
  }

  if (ext === '.doc' || mime === 'application/msword') {
    // Legacy binary .doc files are Word 97-2003 OLE2 binary containers. Extract clean readable sequences if present.
    const latin = buffer.toString('latin1');
    const cleanRuns = latin
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]+/g, ' ')
      .split(/\s{2,}/)
      .map((s) => s.replace(/[^\x20-\x7E\n]/g, '').trim())
      .filter((s) => s.length >= 6 && /[a-zA-Z]{3,}/.test(s) && !/^(Microsoft Word|Root Entry|WordDocument|SummaryInformation)/i.test(s));
    const candidate = cleanRuns.join('\n').trim();
    if (candidate.length < 60) {
      throw new Error(
        'Legacy binary .doc files are proprietary binary format — please save or export as .docx or .pdf and upload again.'
      );
    }
    return {
      text: candidate,
      detailLabel: 'Legacy Word document (.doc)',
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
      pageCount: slideFiles.length,
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
    const providers = buildProviderCatalog();
    const firstActive = providers.find((p) => p.id !== 'auto' && p.configured);
    res.json({
      ok: true,
      aiConfigured: Boolean(firstActive),
      provider: firstActive?.id || 'none',
    });
  });

  app.get('/api/ai/providers', (_req: Request, res: Response) => {
    const providers = buildProviderCatalog();
    const firstActive = providers.find((p) => p.id !== 'auto' && p.configured);
    res.json({
      providers,
      activeDefaultProvider: firstActive?.id || 'gemini',
    });
  });

  app.post('/api/ai/test', async (req: Request, res: Response) => {
    const started = Date.now();
    try {
      const { providerId = 'auto', modelId } = req.body as {
        providerId?: AIProviderId;
        modelId?: string;
      };
      const result = await runChatAI({
        systemInstruction: 'You are ALEXYN connection tester. Reply concisely.',
        userPrompt: 'Respond with exactly: Connected to ALEXYN AI.',
        aiSelection: { providerId, modelId },
      });
      return res.json({
        ok: true,
        providerId: result.provider,
        modelId: result.model,
        latencyMs: Date.now() - started,
        replyPreview: result.reply.slice(0, 120),
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        latencyMs: Date.now() - started,
        error: formatFriendlyAIError(extractAIError(error)),
      });
    }
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const {
        message,
        history = [],
        images = [],
        importedMaterials = [],
        plugins = [],
        profile,
        aiSettings,
        subjectFocus,
        strictScope = false,
        learnerContext = '',
        aiSelection,
        graphContext,
      } = req.body as {
        message: string;
        history?: ChatHistoryItem[];
        images?: ImagePayload[];
        importedMaterials?: Array<{
          title?: string;
          sourceType?: 'file' | 'url';
          pageCount?: number;
          url?: string;
          text?: string;
        }>;
        plugins?: string[];
        profile?: EducationProfile;
        aiSettings?: AITutorSettings;
        subjectFocus?: string;
        strictScope?: boolean;
        learnerContext?: string;
        aiSelection?: AISelection;
        graphContext?: {
          equations?: Array<{ expression: string; visible?: boolean }>;
          points?: Array<{ x: number; y: number; label?: string }>;
          viewport?: { xMin: number; xMax: number; yMin: number; yMax: number };
        };
      };

      const validMaterials = Array.isArray(importedMaterials)
        ? importedMaterials.filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
        : [];

      if (!message?.trim() && images.length === 0 && validMaterials.length === 0) {
        return res.status(400).json({ error: 'Please enter a message or attach study material / an image.' });
      }

      // Check if learner enabled Web Search plugin OR asked a question needing current/external info
      let searchHits: WebSearchHit[] = [];
      let searchNotice: string | undefined;
      const wantsOnlineResearch = shouldTriggerOnlineSearch(message || '', plugins, subjectFocus);
      if (wantsOnlineResearch) {
        const searchQuery = [
          subjectFocus || '',
          profile?.curriculum && plugins.some((p) => p.toLowerCase().includes('syllabus'))
            ? profile.curriculum
            : '',
          message || '',
        ]
          .filter(Boolean)
          .join(' ');
        const searchRes = await fetchPublicWebSearch(searchQuery);
        searchHits = searchRes.hits.slice(0, 4);
        if (searchRes.searchError && searchHits.length === 0) {
          searchNotice = searchRes.searchError;
        }
      }

      const pluginRules =
        plugins.length > 0
          ? `Active learning plugins: ${plugins.join(', ')}. Apply their specialized behaviors (e.g. Exam Coach highlights likely exam questions & marking points; Step-by-Step Solver breaks solutions into numbered steps; Visual Mental Model describes clear visual analogies; Quick Quiz Check ends with 1-2 quick self-check questions; Live Web & Syllabus Search cites retrieved online sources honestly).`
          : '';

      const strictTeacherRule =
        strictScope && subjectFocus
          ? `STRICT SUBJECT RULE: You are acting ONLY as a dedicated ${subjectFocus} teacher inside the ${subjectFocus} workspace. If the learner asks a question clearly about a different academic subject outside ${subjectFocus}, politely remind them you are their ${subjectFocus} teacher and recommend switching to that subject's workspace rather than teaching the other subject here.`
          : '';

      const searchContextRule =
        searchHits.length > 0
          ? [
              'ONLINE INFORMATION RETRIEVAL RULE:',
              'External sources retrieved from the internet for verification:',
              ...searchHits.map(
                (h, i) =>
                  `${i + 1}. [${extractSourceDomain(h.url) || 'Web Source'}] ${h.title} (${h.url})${h.snippet ? ` — ${h.snippet}` : ''}`
              ),
              'Clearly distinguish between:',
              '1. **From Retrieved Sources**: facts grounded directly in the retrieved sources above (mention source name cleanly).',
              '2. **AI Explanation**: your educational synthesis, analogies, and context.',
              'NEVER pretend a topic is guaranteed to appear in a future exam, and never invent unverified URLs.',
            ].join('\n')
          : wantsOnlineResearch && searchNotice
          ? `ONLINE SEARCH UNAVAILABLE NOTE: Live web search returned no external hits (${searchNotice}). Be transparent if current live facts cannot be independently verified, and do NOT invent external citations.`
          : '';

      const materialsContextRule =
        validMaterials.length > 0
          ? [
              'IMPORTED STUDY MATERIAL RULE:',
              'The learner provided the following uploaded document/webpage material. Ground your explanation, summary, definitions, or questions accurately in this material.',
              'ALWAYS cite page numbers (e.g. "Page 2", "--- Page 3 ---") or slide/section titles whenever available, AND explicitly distinguish between:',
              '1. **From Uploaded Material**: direct facts, quotes, formulas, and definitions taken from their source.',
              '2. **AI Explanation & Commentary**: your helpful clarifications, simpler analogies, worked breakdowns, or exam tips.',
              ...validMaterials.map((m, i) => {
                const cap = Math.floor(24000 / validMaterials.length);
                return `[Material ${i + 1}: ${m.title || 'Uploaded Material'}${m.url ? ` (${m.url})` : ''}${m.pageCount ? ` · ${m.pageCount} pages` : ''}]\n${String(m.text || '').slice(0, cap)}`;
              }),
            ].join('\n\n')
          : '';

      const isLangFocus = /\b(french|spanish|japanese|chinese|mandarin|kiswahili|swahili|german|arabic|korean|portuguese|italian|hindi|language|translate|pronounce)\b/i.test(
        `${subjectFocus || ''} ${message || ''}`
      );

      const languageTutorRule = isLangFocus
        ? 'BILINGUAL LANGUAGE TUTORING RULE: Conduct conversational guidance and grammar explanations in English (the learner’s explanation language) rather than writing the whole reply solely in the target language, unless the learner explicitly asks for full immersion. Whenever introducing a target-language word or phrase, write it in bold with its English meaning in square brackets right after it (e.g. **Bonjour** [Hello] or **おはようございます** [Good morning]) so the learner can listen to each target-language phrase individually.'
        : '';

      const graphControlRule = graphContext
        ? [
            'INTERACTIVE GRAPH WORKSPACE CONTROL:',
            `Current Coordinate Graph state -> Equations: ${JSON.stringify(graphContext.equations || [])}; Points: ${JSON.stringify(graphContext.points || [])}; Viewport: ${JSON.stringify(graphContext.viewport || {})}.`,
            'Whenever the learner asks you to draw, plot, compare on the same graph, add points, zoom, or extend axes (including negative x-axis), explain the mathematics clearly AND append a single machine-readable tag at the very end of your response:',
            '<graph_action>{"mode":"replace|add|keep","equations":["y = ..."],"addPoints":[{"x":0,"y":0,"label":"P1"}],"extendNegativeX":false,"zoomFactor":null,"resetView":false}</graph_action>',
            'Only include keys that should actually change. Omit <graph_action> if the learner only asked a pure conceptual explanation without requesting a graph change.',
          ].join('\n')
        : '';

      const trimmedMsg = (message || '').trim();
      const isCasualMessage =
        images.length === 0 &&
        validMaterials.length === 0 &&
        plugins.length === 0 &&
        !graphContext &&
        trimmedMsg.length <= 45 &&
        /^(hi+|hey+|hello+|yo+|good\s*(morning|afternoon|evening)|how\s+are\s+you|what'?s\s*up|thanks?|thank\s+you|cool|nice|ok(ay)?|bye|goodnight)[\s!.?]*$/i.test(
          trimmedMsg
        );

      const hasStudySignal =
        Boolean(strictScope) ||
        Boolean(subjectFocus) ||
        Boolean(graphContext) ||
        images.length > 0 ||
        validMaterials.length > 0 ||
        plugins.length > 0 ||
        /\b(exam|quiz|syllabus|curriculum|homework|assignment|explain|solve|equation|formula|photosynthesis|osmosis|mitochondria|newton|ohm|molecule|past\s+paper|smart\s+notes?|practice\s+area|pronounce|translate|chemistry|biology|physics|mathematics|algebra|calculus|history|geography)\b/i.test(
          trimmedMsg
        );

      const chatMode: 'casual' | 'general' | 'study' = isCasualMessage
        ? 'casual'
        : hasStudySignal
        ? 'study'
        : 'general';

      const allowFollowUpQuiz = plugins.some((p) => p.toLowerCase().includes('quiz'));

      const appControlGuide = [
        'APP CONTROL CAPABILITY: You are aware of the user’s subjects, notes, quizzes, and ALEXYN workspaces (Math Calculation Workspace, Coordinate Graph, English & Languages Speaking Studio, 3D STEM Labs, Smart Notes, Quizzes). Execute `execute_app_action` (or `<app_action>...</app_action>`) ONLY when the user actually asks to open a workspace, create notes, create a quiz, plot a graph, or search exams.',
        'NEVER suggest or push Practice Area modules when the user did not ask for them.',
        'CRITICAL SAFETY: For any destructive action (such as clear_chat), set requiresConfirmation=true and ask the learner to confirm.',
      ].join('\n');

      const systemInstruction = [
        'You are ALEXYN, an intelligent, warm, natural conversational AI & personal learning companion created by Alex Mbugua.',
        ALEXYN_IDENTITY_RULE,
        `User profile: ${formatProfileContext(profile)}.`,
        subjectFocus ? `Current subject focus: ${subjectFocus}.` : '',
        learnerContext ? `User app context (shared with consent):\n${learnerContext}` : '',
        buildAITutorBehaviorRules(aiSettings, profile, chatMode, allowFollowUpQuiz),
        chatMode === 'study' ? languageTutorRule : '',
        strictTeacherRule,
        pluginRules,
        materialsContextRule,
        searchContextRule,
        graphControlRule,
        !isCasualMessage ? appControlGuide : '',
        !isCasualMessage
          ? 'Format clearly for readability without filler or repetitive self-introductions.'
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const latestUserMessage =
        trimmedMsg ||
        (validMaterials.length > 0
          ? `Explain and summarize the attached study material (${validMaterials.map((m) => m.title || 'Material').join(', ')}), citing key sections/pages clearly.`
          : 'Please analyze the attached image(s) and help me understand.');

      const formattedSources = searchHits.map((h) => ({
        title: h.title,
        url: h.url,
        sourceName: extractSourceDomain(h.url) || 'Web Source',
        snippet: h.snippet || '',
        kind: 'educational' as const,
      }));

      const result = await runChatAI({
        systemInstruction,
        userPrompt: latestUserMessage,
        history,
        images,
        aiSelection,
        enableAppActions: !isCasualMessage,
      });

      return res.json({
        reply: result.reply,
        provider: result.provider,
        model: result.model,
        visionNote: result.visionNote,
        appActions: result.appActions,
        sources: formattedSources,
        ...(searchNotice ? { searchNotice } : {}),
      });
    } catch (error) {
      const msg = extractAIError(error);
      console.warn('[ALEXYN /api/chat] Error:', msg);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  app.post('/api/chat/stream', async (req: Request, res: Response) => {
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });

    try {
      const {
        message,
        history = [],
        images = [],
        importedMaterials = [],
        plugins = [],
        profile,
        aiSettings,
        subjectFocus,
        strictScope = false,
        learnerContext = '',
        aiSelection,
        graphContext,
      } = req.body as {
        message: string;
        history?: ChatHistoryItem[];
        images?: ImagePayload[];
        importedMaterials?: Array<{
          title?: string;
          sourceType?: 'file' | 'url';
          pageCount?: number;
          url?: string;
          text?: string;
        }>;
        plugins?: string[];
        profile?: EducationProfile;
        aiSettings?: AITutorSettings;
        subjectFocus?: string;
        strictScope?: boolean;
        learnerContext?: string;
        aiSelection?: AISelection;
        graphContext?: {
          equations?: Array<{ expression: string; visible?: boolean }>;
          points?: Array<{ x: number; y: number; label?: string }>;
          viewport?: { xMin: number; xMax: number; yMin: number; yMax: number };
        };
      };

      const validMaterials = Array.isArray(importedMaterials)
        ? importedMaterials.filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
        : [];

      if (!message?.trim() && images.length === 0 && validMaterials.length === 0) {
        return res.status(400).json({ error: 'Please enter a message or attach study material / an image.' });
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const sendEvent = (eventPayload: Record<string, unknown>) => {
        if (res.writableEnded) return;
        res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
      };

      // Quick bounded online research when web search plugin or external/current query is detected
      let searchHits: WebSearchHit[] = [];
      let searchNotice: string | undefined;
      const wantsOnlineResearch = shouldTriggerOnlineSearch(message || '', plugins, subjectFocus);
      if (wantsOnlineResearch) {
        const searchQuery = [
          subjectFocus || '',
          profile?.curriculum && plugins.some((p) => p.toLowerCase().includes('syllabus'))
            ? profile.curriculum
            : '',
          message || '',
        ]
          .filter(Boolean)
          .join(' ');
        const searchRes = await Promise.race([
          fetchPublicWebSearch(searchQuery),
          new Promise<{ hits: WebSearchHit[]; searchError?: string }>((resolve) =>
            setTimeout(
              () =>
                resolve({
                  hits: [],
                  searchError: 'Online web search timed out; answering using AI knowledge without external links.',
                }),
              6500
            )
          ),
        ]);
        searchHits = searchRes.hits.slice(0, 4);
        if (searchRes.searchError && searchHits.length === 0) {
          searchNotice = searchRes.searchError;
        }
      }

      const pluginRules =
        plugins.length > 0
          ? `Active learning plugins: ${plugins.join(', ')}. Apply their specialized behaviors clearly and concisely.`
          : '';
      const strictTeacherRule =
        strictScope && subjectFocus
          ? `STRICT SUBJECT RULE: You are acting ONLY as a dedicated ${subjectFocus} teacher inside the ${subjectFocus} workspace. If the learner asks a question clearly about a different academic subject outside ${subjectFocus}, politely point them to that subject's workspace.`
          : '';
      const searchContextRule =
        searchHits.length > 0
          ? [
              'ONLINE INFORMATION RETRIEVAL RULE:',
              ...searchHits.map(
                (h, i) =>
                  `${i + 1}. [${extractSourceDomain(h.url) || 'Web Source'}] ${h.title} (${h.url})${h.snippet ? ` — ${h.snippet}` : ''}`
              ),
              'Clearly separate **From Retrieved Sources** (citing source name) from **AI Explanation**. Never invent URLs.',
            ].join('\n')
          : wantsOnlineResearch && searchNotice
          ? `ONLINE SEARCH UNAVAILABLE NOTE: Live search unavailable (${searchNotice}). Answer transparently without inventing external web citations.`
          : '';
      const materialsContextRule =
        validMaterials.length > 0
          ? [
              'IMPORTED STUDY MATERIAL RULE: Ground your answer accurately in this material, citing page/section titles whenever available.',
              ...validMaterials.map((m, i) => {
                const cap = Math.floor(20000 / validMaterials.length);
                return `[Material ${i + 1}: ${m.title || 'Uploaded Material'}${m.url ? ` (${m.url})` : ''}]\n${String(m.text || '').slice(0, cap)}`;
              }),
            ].join('\n\n')
          : '';

      const isLangFocus = /\b(french|spanish|japanese|chinese|mandarin|kiswahili|swahili|german|arabic|korean|portuguese|italian|hindi|language|translate|pronounce)\b/i.test(
        `${subjectFocus || ''} ${message || ''}`
      );
      const languageTutorRule = isLangFocus
        ? 'BILINGUAL LANGUAGE TUTORING RULE: Write explanations in English unless full immersion is asked. Format target words in bold with meaning in brackets like **Bonjour** [Hello].'
        : '';
      const graphControlRule = graphContext
        ? `INTERACTIVE GRAPH WORKSPACE CONTROL: State equations=${JSON.stringify(graphContext.equations || [])}. Append <graph_action>...</graph_action> ONLY if learner requests drawing/modifying a graph.`
        : '';

      const trimmedMsg = (message || '').trim();
      const isCasualMessage =
        images.length === 0 &&
        validMaterials.length === 0 &&
        plugins.length === 0 &&
        !graphContext &&
        trimmedMsg.length <= 45 &&
        /^(hi+|hey+|hello+|yo+|good\s*(morning|afternoon|evening)|how\s+are\s+you|what'?s\s*up|thanks?|thank\s+you|cool|nice|ok(ay)?|bye|goodnight)[\s!.?]*$/i.test(
          trimmedMsg
        );
      const hasStudySignal =
        Boolean(strictScope) ||
        Boolean(subjectFocus) ||
        Boolean(graphContext) ||
        images.length > 0 ||
        validMaterials.length > 0 ||
        plugins.length > 0 ||
        /\b(exam|quiz|syllabus|curriculum|homework|assignment|explain|solve|equation|formula|photosynthesis|osmosis|mitochondria|newton|ohm|molecule|past\s+paper|smart\s+notes?|practice\s+area|pronounce|translate|chemistry|biology|physics|mathematics|algebra|calculus|history|geography)\b/i.test(
          trimmedMsg
        );
      const chatMode: 'casual' | 'general' | 'study' = isCasualMessage
        ? 'casual'
        : hasStudySignal
        ? 'study'
        : 'general';
      const allowFollowUpQuiz = plugins.some((p) => p.toLowerCase().includes('quiz'));

      const wantsAppControlTool =
        !isCasualMessage &&
        /\b(open|go\s+to|switch\s+to|navigate|launch|create\s+(a\s+)?quiz|make\s+(a\s+)?quiz|generate\s+(smart\s+)?notes?|make\s+(smart\s+)?notes?|practice\s+area|3d\s+lab|past\s+papers?|search\s+(for\s+)?(exams?|papers?)|plot\b|draw\s+(a\s+)?graph|clear\s+chat)\b/i.test(
          trimmedMsg
        );

      const appControlGuide = wantsAppControlTool
        ? 'APP CONTROL CAPABILITY: Execute `execute_app_action` (or `<app_action>...</app_action>`) ONLY when the user explicitly asks to open a workspace, generate notes/quiz, plot a graph, or search exams, and ALWAYS provide a helpful text reply alongside any action. Set requiresConfirmation=true for destructive actions like clear_chat.'
        : '';

      const systemInstruction = [
        'You are ALEXYN, a warm, fast, clear conversational AI & personal learning companion created by Alex Mbugua.',
        ALEXYN_IDENTITY_RULE,
        `User profile: ${formatProfileContext(profile)}.`,
        subjectFocus ? `Subject focus: ${subjectFocus}.` : '',
        learnerContext ? `Context: ${learnerContext}` : '',
        buildAITutorBehaviorRules(aiSettings, profile, chatMode, allowFollowUpQuiz),
        chatMode === 'study' ? languageTutorRule : '',
        strictTeacherRule,
        pluginRules,
        materialsContextRule,
        searchContextRule,
        graphControlRule,
        appControlGuide,
      ]
        .filter(Boolean)
        .join('\n');

      const latestUserMessage =
        trimmedMsg ||
        (validMaterials.length > 0
          ? `Explain and summarize the attached study material (${validMaterials.map((m) => m.title || 'Material').join(', ')}), citing key sections/pages clearly.`
          : 'Please analyze the attached image(s) and help me understand.');

      const formattedSources = searchHits.map((h) => ({
        title: h.title,
        url: h.url,
        sourceName: extractSourceDomain(h.url) || 'Web Source',
        snippet: h.snippet || '',
        kind: 'educational' as const,
      }));

      const result = await streamChatAI({
        systemInstruction,
        userPrompt: latestUserMessage,
        history,
        images,
        aiSelection,
        enableAppActions: wantsAppControlTool,
        signal: abortController.signal,
        onDelta: (delta) => {
          sendEvent({ type: 'delta', delta });
        },
      });

      sendEvent({
        type: 'done',
        reply: result.reply,
        provider: result.provider,
        model: result.model,
        visionNote: result.visionNote,
        appActions: result.appActions,
        sources: formattedSources,
        ...(searchNotice ? { searchNotice } : {}),
      });
      res.end();
    } catch (error) {
      const msg = extractAIError(error);
      console.warn('[ALEXYN /api/chat/stream] Error:', msg);
      if (!res.headersSent) {
        return res.status(503).json({ error: formatFriendlyAIError(msg) });
      }
      res.write(`data: ${JSON.stringify({ type: 'error', error: formatFriendlyAIError(msg) })}\n\n`);
      res.end();
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
        pageCount: extracted.pageCount,
        pages: extracted.pages,
        text: extracted.text.slice(0, 56000),
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
        return res.status(400).json({ error: 'Please enter a valid educational webpage or PDF URL.' });
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
      const timer = setTimeout(() => controller.abort(), 18000);
      try {
        const resp = await fetch(parsed.toString(), {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ALEXYN-Edu/1.0)',
            Accept: 'text/html,application/pdf,text/plain,*/*;q=0.8',
          },
        });
        if (!resp.ok) {
          return res.status(502).json({
            error: `Source returned HTTP ${resp.status} (${resp.statusText || 'Access restricted or unavailable'}). Try downloading the file and uploading it directly into ALEXYN.`,
          });
        }

        const ctype = (resp.headers.get('content-type') || '').toLowerCase();
        const arrayBuf = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length === 0) {
          return res.status(422).json({
            error: 'The link returned empty content.',
          });
        }

        const magic = buffer.subarray(0, 5).toString('ascii');
        if (magic === '%PDF-' || ctype.includes('application/pdf') || parsed.pathname.toLowerCase().endsWith('.pdf')) {
          if (magic !== '%PDF-') {
            return res.status(422).json({
              error: 'This PDF link did not serve a valid PDF binary (it may require portal login). Download it manually and upload into ALEXYN.',
            });
          }
          const perPage = await extractPdfText(new Uint8Array(buffer), { mergePages: false });
          const rawPages = Array.isArray(perPage.text) ? perPage.text : [String(perPage.text || '')];
          const pages = rawPages.map((pText, idx) => ({
            pageNumber: idx + 1,
            text: String(pText || '').trim(),
          }));
          const pageCount = perPage.totalPages || pages.length;
          const extractedText = pages
            .filter((p) => p.text.length > 0)
            .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
            .join('\n\n')
            .trim();
          if (!extractedText) {
            return res.status(422).json({
              error: 'Downloaded PDF appears to contain scanned images without embedded text.',
            });
          }
          const pdfTitle = decodeURIComponent(path.basename(parsed.pathname) || parsed.hostname);
          return res.json({
            url: parsed.toString(),
            title: pdfTitle,
            contentType: 'pdf',
            detailLabel: `${pageCount} PDF page(s)`,
            pageCount,
            pages,
            text: extractedText.slice(0, 48000),
            charCount: extractedText.length,
          });
        }

        if (ctype.includes('text/plain') || ctype.includes('text/markdown')) {
          const plain = buffer.toString('utf8').trim();
          return res.json({
            url: parsed.toString(),
            title: path.basename(parsed.pathname) || parsed.hostname,
            contentType: 'text',
            detailLabel: 'Plain text resource',
            text: plain.slice(0, 40000),
            charCount: plain.length,
          });
        }

        const html = buffer.toString('utf8');
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
          .replace(/&quot;/g, '"')
          .replace(/&#39;|&#x27;/gi, "'")
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
          contentType: 'webpage',
          detailLabel: `Webpage (${parsed.hostname})`,
          text: cleaned.slice(0, 32000),
          charCount: cleaned.length,
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
        studyAction = 'notes',
        taughtContext = '',
        importedSourceText = '',
        importedMaterialText = '',
        importedSourceLabel = '',
        isLanguage = false,
        images = [],
        profile,
        strictScope = false,
        aiSelection,
      } = req.body as {
        topic: string;
        subject?: string;
        styles?: string[];
        detailLevel?: 'short' | 'detailed';
        studyAction?: 'notes' | 'summarize' | 'definitions' | 'explain-difficult';
        taughtContext?: string;
        importedSourceText?: string;
        importedMaterialText?: string;
        importedSourceLabel?: string;
        isLanguage?: boolean;
        images?: ImagePayload[];
        profile?: EducationProfile;
        strictScope?: boolean;
        aiSelection?: AISelection;
      };

      const resolvedImportedText = (importedSourceText || importedMaterialText || '').trim();

      if (!topic?.trim() && images.length === 0 && !resolvedImportedText) {
        return res.status(400).json({ error: 'Please provide a topic, upload a document/screenshot, or paste a source.' });
      }

      const depthGuide =
        detailLevel === 'detailed'
          ? 'Produce thorough, comprehensive, book-ready study notes with deep explanations, step-by-step clarity, and complete definitions (NOT brief bullet stubs).'
          : 'Produce concise, high-yield quick-review notes optimized for rapid revision.';

      const actionGuide =
        studyAction === 'summarize'
          ? 'STUDY MODE: Produce a crisp, well-structured executive summary of the imported material highlighting main thesis, core sections, and key takeaways.'
          : studyAction === 'definitions'
          ? 'STUDY MODE: Extract ALL key terms, concepts, formulas, and formal definitions from the material, organizing each with exact source meaning + plain-English explanation.'
          : studyAction === 'explain-difficult'
          ? 'STUDY MODE: Identify the hardest, most technical, or dense parts of the imported material and break them down step by step using intuitive everyday analogies.'
          : '';

      const styleGuide =
        styles.length > 0
          ? `Apply ALL of these user-chosen study styles simultaneously: ${styles.join(', ')}.`
          : 'Use clear structured study explanations with practical takeaways.';

      const taughtGuide = taughtContext
        ? `Reference and build upon what ALEXYN already taught the learner in Explore:\n${taughtContext}`
        : '';

      const importedGuide = resolvedImportedText
        ? `IMPORTED SOURCE MATERIAL (${importedSourceLabel || 'Uploaded Material'}):\nCite page numbers (--- Page N ---) or slide/section titles whenever available, preserve key definitions/formulas/terms accurately, and clearly separate **From Uploaded Material** vs **AI Explanation & Commentary** inside sections:\n${resolvedImportedText.slice(0, 18000)}`
        : '';

      const languageGuide = isLanguage
        ? `BILINGUAL LANGUAGE RULE: Since ${subject || 'this subject'} is a language, populate a "bilingual" object combining target-language vocabulary/expressions with English meanings in brackets, pronunciation guides, grammar rules explaining HOW and WHEN to use them, and example sentences with word-by-word/structural explanations. Do NOT just translate mechanically.`
        : 'Set "bilingual" to null unless teaching a language topic.';

      const visualGuide =
        'VISUAL DIAGRAM & INTERACTIVE ANIMATION RULE: Populate "visuals" with 2 to 4 distinct, cleanly labelled educational inline <svg viewBox=\'0 0 600 280\' xmlns=\'http://www.w3.org/2000/svg\'>...</svg> diagrams, charts, cycles, timelines, or labelled illustrations directly clarifying different facets of this exact topic on a dark navy background (#060E24) with crisp cyan (#38BDF8), teal (#5EEAD4), white (#F8FAFC), and indigo (#818CF8) strokes/text (use SINGLE QUOTES inside SVG attributes so JSON stays valid, legible spacing, no overlapping text, no <script> tags). Whenever the topic involves a step-by-step process, biological cycle, physical motion/wave/orbit, chemical reaction, or historical chronology, include "animationKind" ("photosynthesis" | "cell-division" | "circulation" | "reaction" | "wave" | "orbit" | "timeline" | "custom") and 3-5 "interactiveStages" ([{ id, title, description }]) on the primary visual so the learner can step through or animate it live! Also use ### Subheadings, **bold key concepts**, __underlined key words and definitions__, bullet points (- ), and worked Example: steps inside section content.';

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
        actionGuide,
        styleGuide,
        languageGuide,
        visualGuide,
        'Return strict JSON with keys: title (string), subject (string), overview (string), sections (array of {heading, content, kind}), memoryTricks (string[]), funnyExamples (string[]), examTips (string[]), readingAdvice (string[]), flashcards (array of {q, a}), visuals (array of {title, caption, kind, svgMarkup, animationKind, interactiveStages: [{id, title, description}]}), bilingual (null or {targetLanguage, languageCode, vocabulary: [{term, english, pronunciationGuide, usageNote}], exampleSentences: [{targetText, englishTranslation, grammarBreakdown, register}], grammarNotes: string[]}).',
      ]
        .filter(Boolean)
        .join('\n');

      const promptText = [
        `Topic: ${topic || 'Study notes from imported material'}`,
        subject ? `Subject: ${subject}` : '',
        `Study action: ${studyAction}`,
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
          aiSelection,
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
        aiSelection,
      } = req.body as {
        subject: string;
        isLanguage?: boolean;
        profile?: EducationProfile;
        uploadedMaterialsText?: string;
        aiSelection?: AISelection;
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
        aiSelection,
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
        count = 6,
        questionTypes = ['mcq', 'short-answer', 'calculation', 'structured'],
        profile,
        weakTopics = [],
        repeatedMistakes = [],
        improvedTopics = [],
        adaptiveMode = false,
        aiSelection,
      } = req.body as {
        subject: string;
        topic?: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        count?: number;
        questionTypes?: string[];
        profile?: EducationProfile;
        weakTopics?: string[];
        repeatedMistakes?: string[];
        improvedTopics?: string[];
        adaptiveMode?: boolean;
        aiSelection?: AISelection;
      };

      if (!subject?.trim()) {
        return res.status(400).json({ error: 'Subject is required to generate a quiz.' });
      }

      const safeCount = Math.max(3, Math.min(15, Number(count) || 6));
      const allowedTypes = Array.isArray(questionTypes) && questionTypes.length > 0
        ? questionTypes
        : ['mcq', 'short-answer', 'calculation'];

      const formatSpecs: string[] = [];
      if (allowedTypes.includes('mcq')) {
        formatSpecs.push('- "mcq": options (4 items), correctIndex (0..3), marks (1-2), explanation (1-2 clear sentences why the correct option is right)');
      }
      if (allowedTypes.includes('short-answer')) {
        formatSpecs.push('- "short-answer": options=[], correctIndex=null, marks (2-3), markingScheme, sampleAnswer, explanation');
      }
      if (allowedTypes.includes('calculation')) {
        formatSpecs.push('- "calculation": options=[], correctIndex=null, marks (3-5), expectedSteps (steps array), sampleAnswer, explanation');
      }
      if (allowedTypes.includes('structured')) {
        formatSpecs.push('- "structured": options=[], correctIndex=null, subParts: [{id, label: "(a)", prompt, marks, markingScheme}], explanation');
      }
      if (allowedTypes.includes('essay')) {
        formatSpecs.push('- "essay": options=[], correctIndex=null, marks (8-10), markingScheme, sampleAnswer, explanation');
      }
      if (allowedTypes.includes('diagram')) {
        formatSpecs.push('- "diagram": options=[], correctIndex=null, marks (3-5), diagramSpec: {title, instructions, expectedLabels}, explanation');
      }

      const systemInstruction = [
        'You are ALEXYN Examination Author. Generate fast, clear, non-duplicate assessment items.',
        ALEXYN_IDENTITY_RULE,
        `Learner profile: ${formatProfileContext(profile)}.`,
        `Create ${safeCount} distinct questions for ${subject}${topic ? ` on "${topic}"` : ''} (${difficulty} difficulty). Never duplicate or repeat any question.`,
        adaptiveMode
          ? `ADAPTIVE FOCUS: Target weak topics (${weakTopics.join(', ') || 'identified gaps'})${repeatedMistakes.length > 0 ? ` and mistake patterns: ${repeatedMistakes.join(' | ')}` : ''}. Avoid easy drills on (${improvedTopics.join(', ') || 'mastered topics'}).`
          : weakTopics.length > 0
          ? `Emphasize weak topics: ${weakTopics.join(', ')}.`
          : '',
        `Use ONLY these types: ${allowedTypes.join(', ')}.`,
        ...formatSpecs,
        'RELEVANT VISUALS RULE: Whenever a question genuinely benefits from a geometric figure, 3D solid, coordinate graph, triangle, circle, or circuit diagram (in any questionType: mcq, calculation, short-answer, structured, or diagram), attach a structured `visualSpec` object matching:',
        'visualSpec: { kind: "solid-3d"|"coordinate-graph"|"triangle-2d"|"circle-2d"|"science-circuit", title?: string, shapeId?: "cone"|"cylinder"|"sphere"|"hemisphere"|"frustum-cone"|"pyramid"|"cube"|"cuboid"|"triangular-prism"|"compound-hemisphere-cylinder"|"compound-cone-cylinder", dimensions?: { radius?: number, topRadius?: number, height?: number, width?: number, length?: number, slant?: number, angleDeg?: number, a?: number, b?: number, c?: number, unit?: string }, equations?: string[], points?: [{x, y, label}], circuit?: { voltage, r1, r2, mode: "series"|"parallel" } }.',
        'Keep purely verbal/algebraic questions clean without `visualSpec`.',
        'Every question MUST include a concise `explanation` string (1-2 sentences). Return strict JSON: { title: string, topic: string, instructions: string, totalMarks: number, questions: [{ id, questionType, questionNumber, marks, prompt, topic, options, correctIndex, explanation, ... }] }.',
      ]
        .filter(Boolean)
        .join('\n');

      const data = await runStructuredJsonAI<{
        title?: string;
        topic?: string;
        instructions?: string;
        totalMarks?: number;
        questions?: Array<Record<string, unknown>>;
      }>({
        systemInstruction,
        userPrompt: `Generate ${safeCount} unique ${difficulty} questions on ${subject}${topic ? ` — ${topic}` : ''}.`,
        aiSelection,
        speedMode: 'fast',
        timeoutMs: 28000,
      });

      const seenPrompts = new Set<string>();
      const rawUniqueQuestions = (data.questions || []).filter((q) => {
        const promptKey = String(q.prompt || '')
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, '')
          .replace(/\s+/g, ' ');
        if (!promptKey || seenPrompts.has(promptKey)) return false;
        seenPrompts.add(promptKey);
        return true;
      });

      const questions = rawUniqueQuestions.slice(0, safeCount).map((q, idx) => {
        const qType = (typeof q.questionType === 'string' ? q.questionType : 'mcq') as
          | 'mcq'
          | 'short-answer'
          | 'structured'
          | 'essay'
          | 'calculation'
          | 'diagram';
        const opts = qType === 'mcq' && Array.isArray(q.options) && q.options.length >= 2
          ? (q.options as string[]).slice(0, 4)
          : [];
        const subPartTotal = Array.isArray(q.subParts)
          ? (q.subParts as Array<{ marks?: number }>).reduce(
              (sum, sp) => sum + (typeof sp?.marks === 'number' && sp.marks > 0 ? sp.marks : 1),
              0
            )
          : 0;
        const marksNum =
          typeof q.marks === 'number' && q.marks > 0
            ? q.marks
            : qType === 'essay'
            ? 10
            : qType === 'structured'
            ? subPartTotal || 4
            : qType === 'calculation'
            ? 3
            : qType === 'short-answer' || qType === 'diagram'
            ? 2
            : 1;
        return {
          id: `q-${Date.now()}-${idx}`,
          questionType: qType,
          questionNumber: String(idx + 1),
          marks: marksNum,
          prompt: String(q.prompt || ''),
          topic: String(q.topic || topic || subject),
          options: opts,
          correctIndex:
            qType === 'mcq' && typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < opts.length
              ? q.correctIndex
              : null,
          hasOfficialAnswerKey: true,
          explanation:
            (typeof q.explanation === 'string' && q.explanation.trim()) ||
            (typeof q.sampleAnswer === 'string' && q.sampleAnswer.trim()) ||
            (typeof q.markingScheme === 'string' && q.markingScheme.trim()) ||
            (qType === 'mcq' && typeof q.correctIndex === 'number' && opts[q.correctIndex]
              ? `The correct answer is ${opts[q.correctIndex]}. Review this ${String(q.topic || topic || subject)} concept.`
              : `Review the core principle in ${String(q.topic || topic || subject)}.`),
          markingScheme: typeof q.markingScheme === 'string' ? q.markingScheme : undefined,
          sampleAnswer: typeof q.sampleAnswer === 'string' ? q.sampleAnswer : undefined,
          expectedSteps: Array.isArray(q.expectedSteps) ? (q.expectedSteps as string[]) : undefined,
          subParts: Array.isArray(q.subParts) ? q.subParts : undefined,
          visualSpec: q.visualSpec && typeof q.visualSpec === 'object' ? q.visualSpec : undefined,
          diagramSpec: q.diagramSpec && typeof q.diagramSpec === 'object' ? q.diagramSpec : undefined,
          origin: 'ai-generated' as const,
          sourceTitle: adaptiveMode
            ? 'ALEXYN Adaptive Practice (AI-Generated from Your Progress)'
            : 'ALEXYN Practice Paper (AI-Generated)',
        };
      });

      return res.json({
        title: data.title || `${subject}: ${topic || (adaptiveMode ? 'Adaptive Weak-Topic Practice' : 'Practice Paper')}`,
        topic: data.topic || topic || subject,
        instructions: data.instructions || 'Answer all questions clearly. Show working for calculations.',
        totalMarks: questions.reduce((s, q) => s + (q.marks || 1), 0),
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
        aiSelection,
      } = req.body as {
        subject?: string;
        subjectHint?: string;
        fileName?: string;
        mimeType?: string;
        base64Data?: string;
        fileBase64?: string;
        rawText?: string;
        images?: ImagePayload[];
        aiSelection?: AISelection;
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
        'You are ALEXYN Complete Exam Paper Extractor.',
        'Extract ALL examination questions faithfully across EVERY question format: "mcq", "short-answer", "structured" (with subParts like (a), (b), (i), (ii)), "essay", "calculation", and "diagram". NEVER restrict extraction only to multiple-choice!',
        'STRICT PRESERVATION RULE: Preserve original question numbering ("questionNumber" e.g. "1", "2(a)", "Section B Q4"), exact marks allocation ("marks"), section instructions, and original wording without altering or abbreviating questions.',
        'STRICT ANSWER-KEY HONESTY RULE: Only set correctIndex / hasOfficialAnswerKey=true if an explicit answer key or marking scheme is present in the provided material. If missing, set hasOfficialAnswerKey=false and correctIndex=null.',
        'Return strict JSON: { title: string, subject: string, topic: string, grade: string, instructions: string, answerKeyFound: boolean, questions: [{ questionNumber: string, questionType: "mcq"|"short-answer"|"structured"|"essay"|"calculation"|"diagram", marks: number, prompt: string, topic: string, options: string[], correctIndex: number|null, hasOfficialAnswerKey: boolean, subParts?: [{id:string, label:string, prompt:string, marks:number}], diagramSpec?: {title:string, instructions:string}, explanation: string, markingScheme?: string }] }.',
      ].join('\n');

      const data = await runStructuredJsonAI<{
        title?: string;
        subject?: string;
        topic?: string;
        grade?: string;
        instructions?: string;
        answerKeyFound?: boolean;
        questions?: Array<Record<string, unknown>>;
      }>({
        systemInstruction,
        userPrompt: `Subject hint: ${resolvedSubject || 'General'}\nDocument name: ${fileName || 'Uploaded exam'}\n\nExtract the COMPLETE examination paper (preserve all question numbers, sub-parts, marks, and wording):\n${extractedDocumentText.slice(0, 48000)}`,
        images,
        aiSelection,
      });

      const questions = (data.questions || []).map((q, idx) => {
        const qType = (typeof q.questionType === 'string' ? q.questionType : (Array.isArray(q.options) && q.options.length >= 2 ? 'mcq' : 'short-answer')) as
          | 'mcq'
          | 'short-answer'
          | 'structured'
          | 'essay'
          | 'calculation'
          | 'diagram';
        const hasKey = Boolean(q.hasOfficialAnswerKey && (qType !== 'mcq' || typeof q.correctIndex === 'number'));
        const opts = qType === 'mcq' && Array.isArray(q.options) ? (q.options as string[]).slice(0, 6) : [];
        return {
          id: `ext-${Date.now()}-${idx}`,
          questionNumber: String(q.questionNumber || idx + 1),
          questionType: qType,
          marks: typeof q.marks === 'number' && q.marks > 0 ? q.marks : 2,
          prompt: String(q.prompt || ''),
          topic: String(q.topic || data.topic || resolvedSubject || 'Extracted Exam'),
          options: opts,
          correctIndex: hasKey && typeof q.correctIndex === 'number' ? q.correctIndex : null,
          hasOfficialAnswerKey: hasKey,
          subParts: Array.isArray(q.subParts) ? q.subParts : undefined,
          diagramSpec: q.diagramSpec && typeof q.diagramSpec === 'object' ? q.diagramSpec : undefined,
          markingScheme: typeof q.markingScheme === 'string' ? q.markingScheme : undefined,
          explanation: String(
            q.explanation ||
              (hasKey
                ? 'From uploaded marking scheme.'
                : 'No official marking scheme in document — AI Rubric Marking can grade your written answer.')
          ),
          origin: 'uploaded-document' as const,
        };
      });

      return res.json({
        title: data.title || fileName || 'Extracted Examination Paper',
        subject: data.subject || resolvedSubject || 'General',
        topic: data.topic || 'Examination Paper',
        grade: data.grade || undefined,
        instructions: data.instructions || undefined,
        totalMarks: questions.reduce((s, q) => s + (q.marks || 1), 0),
        answerKeyFound: questions.some((q) => q.hasOfficialAnswerKey),
        questions,
      });
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  // REAL EXAM RESOURCE DISCOVERY & HONEST COMPLETE PDF RETRIEVAL
  app.post('/api/quizzes/search-resources', async (req: Request, res: Response) => {
    try {
      const {
        query,
        subject,
        grade,
        topic,
        year,
        examType,
        country,
        resourceType,
        prioritizeKenya,
        profile,
      } = req.body as {
        query?: string;
        subject?: string;
        grade?: string;
        topic?: string;
        year?: string;
        examType?: string;
        country?: string;
        resourceType?: string;
        prioritizeKenya?: boolean;
        profile?: EducationProfile;
      };

      if (![query, subject, grade, topic, year, country].some((v) => Boolean(v?.trim()))) {
        return res.status(400).json({
          error: 'Enter at least a subject, grade, topic, year, country, or search phrase.',
        });
      }

      const result = await searchExamResources({
        query,
        subject,
        grade,
        topic,
        year,
        examType,
        country,
        resourceType,
        prioritizeKenya,
        profile,
      });

      return res.json({
        resources: result.resources,
        kenyanPrioritized: result.kenyanPrioritized,
        searchStatus: result.searchStatus,
        officialPortals: [
          { name: 'KICD (Curriculum & Materials)', url: 'https://kicd.ac.ke/' },
          { name: 'Kenya Education Cloud (LMS)', url: 'https://lms.kec.ac.ke/' },
          { name: 'KNEC (National Examinations)', url: 'https://knec.ac.ke/' },
        ],
      });
    } catch (err) {
      return res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to search online exam resources.',
      });
    }
  });

  app.post('/api/quizzes/fetch-pdf', async (req: Request, res: Response) => {
    try {
      const { url, title } = req.body as { url?: string; title?: string };
      if (!url?.trim()) {
        return res.status(400).json({ downloaded: false, error: 'Document URL is required.' });
      }
      let parsed: URL;
      try {
        parsed = new URL(url.trim());
      } catch {
        return res.status(400).json({ downloaded: false, error: 'Invalid PDF URL.' });
      }
      if (!['http:', 'https:'].includes(parsed.protocol) || isPrivateOrBlockedHost(parsed.hostname)) {
        return res.status(400).json({ downloaded: false, error: 'Blocked or unsupported URL host.' });
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const upstream = await fetch(parsed.toString(), {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/pdf,*/*;q=0.8',
          },
        });

        if (!upstream.ok) {
          return res.status(502).json({
            downloaded: false,
            error: `Source returned HTTP ${upstream.status} (${upstream.statusText || 'Access restricted — login or permission may be required'}). Open the direct source link instead.`,
          });
        }

        const ctype = (upstream.headers.get('content-type') || '').toLowerCase();
        const arrayBuf = await upstream.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length === 0) {
          return res.status(422).json({
            downloaded: false,
            error: 'Source returned an empty file instead of a PDF document.',
          });
        }
        if (buffer.length > 25 * 1024 * 1024) {
          return res.status(413).json({
            downloaded: false,
            error: 'PDF exceeds the 25 MB in-app viewer limit. Open or download directly via the source link.',
          });
        }

        const headerMagic = buffer.subarray(0, 5).toString('ascii');
        const isPdfBinary = headerMagic === '%PDF-' || ctype.includes('application/pdf');
        if (!isPdfBinary) {
          return res.status(422).json({
            downloaded: false,
            error: `This link served ${ctype || 'an HTML webpage'} rather than a direct PDF binary (it may require portal login or downloading directly from the page). Open the source link directly.`,
          });
        }

        let extractedText = '';
        let pageCount = 0;
        let pages: Array<{ pageNumber: number; text: string }> = [];
        try {
          const perPageRes = await extractPdfText(new Uint8Array(buffer), { mergePages: false });
          const rawPages = Array.isArray(perPageRes.text)
            ? perPageRes.text
            : [String(perPageRes.text || '')];
          pages = rawPages.map((pText, idx) => ({
            pageNumber: idx + 1,
            text: String(pText || '').trim(),
          }));
          pageCount = perPageRes.totalPages || pages.length;
          extractedText = pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n').trim();
        } catch {
          // Non-fatal: scanned PDFs still open completely visually inside ALEXYN PDF viewer
        }

        const rawPathName = path.basename(parsed.pathname) || 'document.pdf';
        const safeBase = (title || rawPathName)
          .replace(/[^\w\s.-]/g, '')
          .replace(/\s+/g, '_')
          .slice(0, 64);
        const fileName = safeBase.toLowerCase().endsWith('.pdf')
          ? safeBase
          : `${safeBase || 'exam-resource'}.pdf`;

        return res.json({
          downloaded: true,
          url: parsed.toString(),
          fileName,
          mimeType: 'application/pdf',
          byteLength: buffer.length,
          pageCount,
          pages,
          extractedText: extractedText.slice(0, 90000),
          pdfBase64: buffer.toString('base64'),
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      return res.status(502).json({
        downloaded: false,
        error: `Download failed (${err instanceof Error ? err.message : 'network error'}). Open the source link directly to check access.`,
      });
    }
  });

  app.post('/api/quizzes/research', async (req: Request, res: Response) => {
    try {
      const {
        query,
        subject,
        grade,
        topic,
        year,
        examType,
        prioritizeKenya,
        profile,
        aiSelection,
      } = req.body as {
        query?: string;
        subject?: string;
        grade?: string;
        topic?: string;
        year?: string;
        examType?: string;
        prioritizeKenya?: boolean;
        profile?: EducationProfile;
        aiSelection?: AISelection;
      };

      const combinedQuery = [query, subject, grade, topic, year]
        .filter((v): v is string => Boolean(v && v.trim()))
        .join(' ');
      if (!combinedQuery) {
        return res.status(400).json({
          error: 'Please enter a subject, grade, topic, examination year, or search phrase.',
        });
      }

      const resourceSearch = await searchExamResources({
        query,
        subject,
        grade,
        topic,
        year,
        examType,
        prioritizeKenya,
        profile,
      });

      const systemInstruction = [
        'You are ALEXYN Online Exam & Practice Question Researcher.',
        ALEXYN_IDENTITY_RULE,
        `Learner profile: ${formatProfileContext(profile)}.`,
        'HONEST LABELING RULE: Analyze the retrieved online resources and snippets carefully:',
        '- Label a question origin as "past-paper" ONLY if the retrieved snippet explicitly quotes an actual documented past paper and include its exact verified sourceUrl.',
        '- Label as "educational-practice" ONLY if directly drawn from retrieved online curriculum/study exercises and include its verified sourceUrl.',
        '- If the exact official examination paper text is NOT directly available in the snippets, generate a curriculum-based practice examination aligned with the requested grade, subject, topic, and exam system, and strictly label EVERY such question origin as "ai-generated" (NEVER pretend AI-generated questions are official past-paper items!).',
        'Return strict JSON: { title: string, subject: string, topic: string, summaryNote: string, exactPaperFound: boolean, questions: [{ prompt: string, topic: string, options: string[], correctIndex: number, explanation: string, origin: "past-paper" | "educational-practice" | "ai-generated", sourceTitle: string, sourceUrl: string }] }.',
      ].join('\n');

      const searchContext =
        resourceSearch.resources.length > 0
          ? `Retrieved online resources:\n${resourceSearch.resources
              .map(
                (h, i) =>
                  `[${i + 1}] Title: ${h.title}\nSource: ${h.sourceName} (${h.resourceType})\nURL: ${h.url}\nExcerpt: ${h.snippet}`
              )
              .join('\n\n')}`
          : resourceSearch.searchStatus || 'No external web results available.';

      const data = await runStructuredJsonAI<{
        title?: string;
        subject?: string;
        topic?: string;
        summaryNote?: string;
        exactPaperFound?: boolean;
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
        userPrompt: `Search criteria -> Query: "${query || ''}" | Subject: ${subject || 'Auto'} | Grade/Level: ${grade || profile?.grade || 'Auto'} | Topic: ${topic || 'All'} | Year: ${year || 'Any'} | Exam System: ${examType || profile?.curriculum || 'General'}\n\n${searchContext}\n\nProvide 5 high-quality interactive questions with strictly honest origin labels and verified URLs.`,
        aiSelection,
      });

      const validUrls = new Set(resourceSearch.resources.map((h) => h.url));
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
          topic: q.topic || data.topic || topic || subject || 'Exam Practice',
          options: Array.isArray(q.options) ? q.options.slice(0, 4) : ['A', 'B', 'C', 'D'],
          correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
          hasOfficialAnswerKey: true,
          explanation: q.explanation || '',
          origin: safeOrigin,
          sourceTitle: verifiedUrl
            ? q.sourceTitle || 'Educational Source'
            : 'ALEXYN Curriculum Practice (AI-Generated — Not an Official Exam Paper)',
          sourceUrl: verifiedUrl || undefined,
        };
      });

      return res.json({
        title:
          data.title ||
          `${subject || 'Exam'} ${grade ? `(${grade}) ` : ''}${year ? `${year} ` : ''}Practice`,
        subject: data.subject || subject || 'General',
        topic: data.topic || topic || query || 'Exam Practice',
        summaryNote:
          data.summaryNote ||
          (resourceSearch.resources.length > 0
            ? 'Discovered resources are listed below (download PDFs directly when permitted). Practice questions clearly distinguish retrieved items from AI-generated curriculum questions.'
            : 'Exact official exam paper text could not be fetched directly; below is a clearly labelled AI-generated curriculum-based practice examination.'),
        exactPaperFound: Boolean(data.exactPaperFound && questions.some((q) => q.origin === 'past-paper')),
        kenyanPrioritized: resourceSearch.kenyanPrioritized,
        resources: resourceSearch.resources,
        sources: resourceSearch.resources.map((h) => ({
          title: `${h.sourceName}: ${h.title}`,
          url: h.url,
          kind: h.isKenyanOfficial ? ('past-paper' as const) : ('educational' as const),
        })),
        officialPortals: [
          { name: 'KICD', url: 'https://kicd.ac.ke/' },
          { name: 'Kenya Education Cloud', url: 'https://lms.kec.ac.ke/' },
          { name: 'KNEC', url: 'https://knec.ac.ke/' },
        ],
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
        aiSelection,
      } = req.body as {
        language: string;
        prompt?: string;
        learnerAttempt?: string;
        sentence?: string;
        expectedMeaning?: string;
        mode?: string;
        aiSelection?: AISelection;
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
        aiSelection,
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

  // INTERACTIVE VOICE / TEXT LANGUAGE CONVERSATION PARTNER
  app.post('/api/language/converse', async (req: Request, res: Response) => {
    try {
      const {
        language,
        transcript = '',
        audioBase64,
        audioMimeType = 'audio/webm',
        scenario = 'Everyday conversation',
        history = [],
        aiSelection,
      } = req.body as {
        language: string;
        transcript?: string;
        audioBase64?: string;
        audioMimeType?: string;
        scenario?: string;
        history?: Array<{ role: 'user' | 'partner'; text: string }>;
        aiSelection?: AISelection;
      };

      if (!language?.trim()) {
        return res.status(400).json({ error: 'Target language is required.' });
      }
      if (!transcript.trim() && !audioBase64) {
        return res.status(400).json({ error: 'Speak or type a message in the target language.' });
      }

      const historyBlock = (history || [])
        .slice(-6)
        .map((h) => `${h.role === 'user' ? 'Learner' : 'Partner'}: ${h.text}`)
        .join('\n');

      const ai = getGeminiClient();
      if (ai && audioBase64) {
        const cleanB64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
        const audioPart = {
          inlineData: {
            mimeType: audioMimeType || 'audio/webm',
            data: cleanB64,
          },
        };
        const prompt = [
          `You are a warm, natural ${language} conversation partner & coach inside ALEXYN.`,
          `Scenario: ${scenario}.`,
          historyBlock ? `Recent dialogue:\n${historyBlock}` : '',
          transcript.trim() ? `Speech-to-text hint: "${transcript.trim()}"` : '',
          'Listen carefully to what the learner actually spoke in the attached audio.',
          `1. Transcribe accurately what they said in ${language} ("heardText").`,
          '2. Understand their meaning ("understoodMeaning" in English) and check if phrasing was natural ("isNatural"). If awkward or erroneous, provide a polite natural correction ("correctedPhrasing") + brief English coaching ("coachingNote") + syllable/sound tip ("pronunciationTip").',
          `3. Reply naturally in ${language} ("partnerReplyTarget") to keep the dialogue flowing, plus its English translation ("partnerReplyEnglish").`,
          'Return strict JSON: { heardText: string, understoodMeaning: string, isNatural: boolean, correctedPhrasing: string, coachingNote: string, pronunciationTip: string, partnerReplyTarget: string, partnerReplyEnglish: string }.',
        ]
          .filter(Boolean)
          .join('\n');

        const resp = await withFastRetry(() =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: { parts: [audioPart, { text: prompt }] },
            config: {
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            },
          })
        );
        const parsed = parseAIJsonSafe<Record<string, unknown>>(resp.text || '{}');
        return res.json({
          heardText: String(parsed.heardText || transcript || ''),
          understoodMeaning: String(parsed.understoodMeaning || ''),
          isNatural: Boolean(parsed.isNatural ?? true),
          correctedPhrasing: String(parsed.correctedPhrasing || ''),
          coachingNote: String(parsed.coachingNote || ''),
          pronunciationTip: String(parsed.pronunciationTip || ''),
          partnerReplyTarget: String(parsed.partnerReplyTarget || ''),
          partnerReplyEnglish: String(parsed.partnerReplyEnglish || ''),
          analysisMode: 'audio-gemini',
        });
      }

      const data = await runStructuredJsonAI<Record<string, unknown>>({
        systemInstruction: [
          `You are a warm, encouraging ${language} conversation partner & language tutor inside ALEXYN.`,
          ALEXYN_IDENTITY_RULE,
          `Reply naturally in ${language} to continue the dialogue ("partnerReplyTarget"), provide an English translation ("partnerReplyEnglish"), gently correct any grammar/vocab mistakes if needed ("correctedPhrasing", "coachingNote" in English), and give one clear pronunciation tip for a key word in the reply ("pronunciationTip").`,
          'Return strict JSON: { heardText: string, understoodMeaning: string, isNatural: boolean, correctedPhrasing: string, coachingNote: string, pronunciationTip: string, partnerReplyTarget: string, partnerReplyEnglish: string }.',
        ].join('\n'),
        userPrompt: `Scenario: ${scenario}\n${historyBlock ? `Recent dialogue:\n${historyBlock}\n` : ''}Learner said/wrote in ${language}: "${transcript.trim()}"`,
        aiSelection,
        speedMode: 'fast',
      });

      return res.json({
        heardText: String(data.heardText || transcript.trim()),
        understoodMeaning: String(data.understoodMeaning || ''),
        isNatural: Boolean(data.isNatural ?? true),
        correctedPhrasing: String(data.correctedPhrasing || ''),
        coachingNote: String(data.coachingNote || ''),
        pronunciationTip: String(data.pronunciationTip || ''),
        partnerReplyTarget: String(data.partnerReplyTarget || ''),
        partnerReplyEnglish: String(data.partnerReplyEnglish || ''),
        analysisMode: 'transcript-only',
      });
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  // MULTI-FORMAT EXAM MARKING (Mode A: per-question OR Mode B: full-paper)
  app.post('/api/quizzes/mark', async (req: Request, res: Response) => {
    try {
      const {
        mode = 'single-question',
        subject,
        profile,
        items = [],
        aiSelection,
      } = req.body as {
        mode?: 'single-question' | 'full-paper';
        subject: string;
        profile?: EducationProfile;
        items: Array<{
          questionId: string;
          questionNumber?: string;
          questionType: string;
          prompt: string;
          topic: string;
          marks: number;
          markingScheme?: string;
          sampleAnswer?: string;
          options?: string[];
          correctIndex?: number | null;
          selectedIndex?: number | null;
          textAnswer?: string;
          mathSteps?: string[];
          subParts?: Array<{ id: string; label: string; prompt: string; marks: number }>;
          subPartAnswers?: Record<string, string>;
          diagramAnswer?: string;
        }>;
        aiSelection?: AISelection;
      };

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No answers submitted for marking.' });
      }

      const deterministicResults = new Map<
        string,
        {
          questionId: string;
          marksAwarded: number;
          maxMarks: number;
          isCorrect: boolean;
          aiFeedback: string;
          modelAnswer?: string;
        }
      >();
      const aiItems: typeof items = [];

      for (const item of items) {
        const maxM = Math.max(1, Number(item.marks) || 1);
        if (
          item.questionType === 'mcq' &&
          typeof item.correctIndex === 'number' &&
          item.correctIndex >= 0
        ) {
          const isRight = item.selectedIndex !== null && item.selectedIndex !== undefined && item.selectedIndex === item.correctIndex;
          const correctLetter = String.fromCharCode(65 + item.correctIndex);
          const correctOption = Array.isArray(item.options) ? item.options[item.correctIndex] || '' : '';
          deterministicResults.set(item.questionId, {
            questionId: item.questionId,
            marksAwarded: isRight ? maxM : 0,
            maxMarks: maxM,
            isCorrect: isRight,
            aiFeedback:
              item.selectedIndex === null || item.selectedIndex === undefined
                ? `No option selected. Correct answer: ${correctLetter}${correctOption ? ` (${correctOption})` : ''}.`
                : isRight
                ? 'Correct option selected.'
                : `Incorrect choice. Correct answer: ${correctLetter}${correctOption ? ` (${correctOption})` : ''}.`,
            modelAnswer: correctOption || `Option ${correctLetter}`,
          });
          continue;
        }
        aiItems.push(item);
      }

      if (aiItems.length === 0) {
        const ordered = items.map((it) => deterministicResults.get(it.questionId)!).filter(Boolean);
        return res.json({
          results: ordered,
          weakTopicsIdentified: Array.from(
            new Set(
              items
                .filter((it) => !deterministicResults.get(it.questionId)?.isCorrect)
                .map((it) => it.topic)
                .filter(Boolean)
            )
          ),
          mistakeNotes: [],
          improvementAdvice: ordered.every((r) => r.isCorrect)
            ? 'All answers correct! Try harder or open-ended application questions next.'
            : 'Review missed concepts and try another practice round.',
        });
      }

      const systemInstruction = [
        'You are ALEXYN Examination Marker & Rubric Grader.',
        ALEXYN_IDENTITY_RULE,
        `Subject: ${subject}. Learner profile: ${formatProfileContext(profile)}.`,
        `Marking mode: ${mode}.`,
        'CRITICAL RULE: Copy EVERY "questionId" verbatim into your output "results" array. Grade every single submitted item.',
        'Grade every submitted answer fairly and strictly according to its mark allocation ("marks"), rubric, and educational level:',
        '- For "calculation": inspect each line of "mathSteps" and "textAnswer" sequentially! Identify the exact first step where an error happened (if any), award partial method marks for valid earlier steps, and populate "stepDiagnostics".',
        '- For "structured": grade all "subParts" accurately.',
        '- For "essay" or "short-answer" or "diagram": evaluate key concepts, clarity, terminology, and give constructive feedback plus a concise model answer.',
        '- If an answer is blank, award 0 marks and clearly state what was required.',
        'Return strict JSON: { results: [{ questionId: string, marksAwarded: number, maxMarks: number, isCorrect: boolean, aiFeedback: string, modelAnswer: string, stepDiagnostics?: [{ stepIndex: number, expression: string, status: "correct"|"error"|"unclear", note: string }] }], weakTopicsIdentified: string[], mistakeNotes: string[], improvementAdvice: string }.',
      ].join('\n');

      const parsed = await runStructuredJsonAI<{
        results?: Array<{
          questionId: string;
          marksAwarded: number;
          maxMarks: number;
          isCorrect: boolean;
          aiFeedback: string;
          modelAnswer?: string;
          stepDiagnostics?: Array<{
            stepIndex: number;
            expression: string;
            status: 'correct' | 'error' | 'unclear';
            note: string;
          }>;
        }>;
        weakTopicsIdentified?: string[];
        mistakeNotes?: string[];
        improvementAdvice?: string;
      }>({
        systemInstruction,
        userPrompt: `Mark these ${aiItems.length} examination response(s):\n${JSON.stringify(aiItems, null, 2).slice(0, 42000)}`,
        aiSelection,
      });

      const aiHits = Array.isArray(parsed.results) ? parsed.results : [];
      const mergedResults = items.map((orig) => {
        const det = deterministicResults.get(orig.questionId);
        if (det) return det;
        const aiIdx = aiItems.findIndex((a) => a.questionId === orig.questionId);
        const hit =
          aiHits.find((r) => r.questionId === orig.questionId) ||
          (aiIdx >= 0 ? aiHits[aiIdx] : undefined);
        const maxM = Math.max(1, Number(orig.marks) || 1);
        if (!hit) {
          return {
            questionId: orig.questionId,
            marksAwarded: 0,
            maxMarks: maxM,
            isCorrect: false,
            aiFeedback: 'No grading result returned for this item.',
            modelAnswer: orig.sampleAnswer || '',
          };
        }
        return {
          ...hit,
          questionId: orig.questionId,
          maxMarks: Math.max(1, Number(hit.maxMarks) || maxM),
          marksAwarded: Math.max(0, Math.min(Math.max(1, Number(hit.maxMarks) || maxM), Number(hit.marksAwarded) || 0)),
        };
      });

      return res.json({
        results: mergedResults,
        weakTopicsIdentified: parsed.weakTopicsIdentified || [],
        mistakeNotes: parsed.mistakeNotes || [],
        improvementAdvice:
          parsed.improvementAdvice || 'Review lost marks carefully and practise similar questions.',
      });
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  // MATH STEP-BY-STEP WORKING CHECKER
  app.post('/api/math/check-working', async (req: Request, res: Response) => {
    try {
      const { problem, steps = [], finalAnswer = '', maxMarks = 5, profile, aiSelection } = req.body as {
        problem: string;
        steps: string[];
        finalAnswer?: string;
        maxMarks?: number;
        profile?: EducationProfile;
        aiSelection?: AISelection;
      };

      const cleanedSteps = (Array.isArray(steps) ? steps : []).map((s) => s.trim()).filter(Boolean);
      if (!problem?.trim() || (cleanedSteps.length === 0 && !finalAnswer.trim())) {
        return res.status(400).json({ error: 'Enter the math problem and at least one working step or final answer.' });
      }

      const systemInstruction = [
        'You are ALEXYN Step-by-Step Mathematics Grader.',
        ALEXYN_IDENTITY_RULE,
        `Learner profile: ${formatProfileContext(profile)}.`,
        'Inspect EVERY mathematical working line sequentially against the problem statement.',
        'Pinpoint the exact 0-based index ("firstErrorStepIndex") where the first algebraic, sign, order-of-operations, or conceptual error occurred (or null if all steps are valid).',
        'Award fair method marks out of maxMarks.',
        'Return strict JSON: { overallCorrect: boolean, scoreAwarded: number, maxMarks: number, firstErrorStepIndex: number | null, stepDiagnostics: [{ stepIndex: number, expression: string, status: "correct"|"error"|"unclear", note: string }], correctNextSteps: string[], conceptualTip: string }.',
      ].join('\n');

      const data = await runStructuredJsonAI<Record<string, unknown>>({
        systemInstruction,
        userPrompt: `Problem: ${problem}\nMax marks: ${maxMarks}\nStudent's line-by-line working:\n${cleanedSteps.map((s, i) => `Step ${i + 1}: ${s}`).join('\n')}${finalAnswer ? `\nFinal Answer: ${finalAnswer}` : ''}`,
        aiSelection,
      });

      return res.json(data);
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  async function synthesizeWithOpenAITts(params: {
    text: string;
    voiceName: string;
  }): Promise<{ audioBase64: string; mimeType: string; byteLength: number; voiceUsed: string } | null> {
    const openaiKey = getProviderKey('openai');
    if (!openaiKey) return null;
    const voiceMap: Record<string, string> = {
      Kore: 'nova',
      Puck: 'echo',
      Charon: 'onyx',
      Fenrir: 'fable',
      Zephyr: 'alloy',
    };
    const openaiVoice = voiceMap[params.voiceName] || 'alloy';
    const resp = await withFastRetry(
      () =>
        fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini-tts',
            voice: openaiVoice,
            input: params.text,
            response_format: 'mp3',
          }),
        }),
      25000
    );
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`OpenAI TTS HTTP ${resp.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 128) return null;
    return {
      audioBase64: buf.toString('base64'),
      mimeType: 'audio/mpeg',
      byteLength: buf.length,
      voiceUsed: `${params.voiceName} (${openaiVoice})`,
    };
  }

  // NEURAL TTS AUDIO SYNTHESIS (Gemini Neural TTS or OpenAI TTS + device fallback)
  app.post('/api/tts', async (req: Request, res: Response) => {
    try {
      const {
        text,
        voiceName = 'Kore',
        style = 'Warm, clear and natural educational tutor',
        languageCode = 'en-US',
      } = req.body as {
        text: string;
        voiceName?: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
        style?: string;
        languageCode?: string;
      };

      const clean = (text || '').trim().slice(0, 2600);
      if (!clean) {
        return res.status(400).json({ error: 'Text is required for speech synthesis.' });
      }

      const normalizedLang = normalizeSpeechLangCode(languageCode);
      const allowedVoices = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);
      const safeVoice = allowedVoices.has(voiceName) ? voiceName : 'Kore';

      const ai = getGeminiClient('v1beta');
      if (ai) {
        try {
          const langDisplay = LANGUAGE_DISPLAY_NAMES[normalizedLang] || normalizedLang;
          const effectiveStyle =
            normalizedLang.startsWith('en')
              ? style || 'Warm, clear and natural educational tutor'
              : `Native ${langDisplay} (${normalizedLang}) pronunciation, clear educational pace`;

          const callGeminiTts = async (includeSpeechMetadata: boolean) => {
            const partPayload: Record<string, unknown> = { text: clean };
            if (includeSpeechMetadata) {
              partPayload.speechMetadata = { style: effectiveStyle };
            }
            return withFastRetry(
              () =>
                ai.models.generateContent({
                  model: 'gemini-3.8-flash-lite-tts',
                  contents: [
                    {
                      role: 'user',
                      parts: [partPayload as never],
                    },
                  ],
                  config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: safeVoice },
                      },
                    },
                  } as never,
                }),
              45000
            );
          };

          let response;
          try {
            response = await callGeminiTts(true);
          } catch (metaErr) {
            const metaMsg = extractAIError(metaErr);
            if (metaMsg.toLowerCase().includes('speechmetadata')) {
              response = await callGeminiTts(false);
            } else {
              throw metaErr;
            }
          }

          const inlinePart = response.candidates?.[0]?.content?.parts?.find(
            (p) => (p as { inlineData?: { data?: string; mimeType?: string } }).inlineData?.data
          ) as { inlineData?: { data?: string; mimeType?: string } } | undefined;

          const rawBase64 = inlinePart?.inlineData?.data;
          if (rawBase64) {
            const rawBuffer = Buffer.from(rawBase64, 'base64');
            const playable = ensurePlayableWavBuffer(rawBuffer, inlinePart?.inlineData?.mimeType);
            return res.json({
              audioBase64: playable.buffer.toString('base64'),
              mimeType: playable.mimeType,
              byteLength: playable.buffer.length,
              voiceUsed: safeVoice,
              languageCode: normalizedLang,
              provider: 'gemini-tts',
            });
          }
        } catch (gemErr) {
          console.warn('[ALEXYN /api/tts] Gemini TTS fallback:', extractAIError(gemErr));
        }
      }

      if (getProviderKey('openai')) {
        try {
          const openaiAudio = await synthesizeWithOpenAITts({ text: clean, voiceName: safeVoice });
          if (openaiAudio) {
            return res.json({
              ...openaiAudio,
              languageCode: normalizedLang,
              provider: 'openai-tts',
            });
          }
        } catch (oaErr) {
          console.warn('[ALEXYN /api/tts] OpenAI TTS fallback:', extractAIError(oaErr));
        }
      }

      return res.json({
        fallbackToBrowser: true,
        reason: 'Using device speech synthesis for audio playback.',
      });
    } catch (error) {
      const msg = extractAIError(error);
      console.warn('[ALEXYN /api/tts] Fallback:', msg);
      return res.json({
        fallbackToBrowser: true,
        reason: formatFriendlyAIError(msg),
      });
    }
  });

  // REAL AUDIO LANGUAGE SPEAKING & PRONUNCIATION ASSESSMENT
  app.post('/api/languages/assess', async (req: Request, res: Response) => {
    try {
      const {
        targetPhrase,
        language,
        audioBase64,
        audioMimeType = 'audio/webm',
        transcriptHint = '',
        aiSelection,
      } = req.body as {
        targetPhrase: string;
        language: string;
        audioBase64?: string;
        audioMimeType?: string;
        transcriptHint?: string;
        aiSelection?: AISelection;
      };

      if (!targetPhrase?.trim() || !language?.trim()) {
        return res.status(400).json({ error: 'Target phrase and language are required.' });
      }

      const ai = getGeminiClient();
      if (ai && audioBase64) {
        const cleanB64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
        const audioPart = {
          inlineData: {
            mimeType: audioMimeType || 'audio/webm',
            data: cleanB64,
          },
        };

        // Step 1: Real audio transcription with gemini-3.5-transcribe
        let transcribedSpeech = transcriptHint.trim();
        try {
          const transResp = await withFastRetry(() =>
            ai.models.generateContent({
              model: 'gemini-3.5-transcribe',
              contents: {
                parts: [
                  audioPart,
                  {
                    text: `Transcribe the speaker's spoken words exactly as heard (target language: ${language}). Do NOT auto-correct mistakes — write exactly what they said.`,
                  },
                ],
              },
            })
          );
          if (transResp.text?.trim()) {
            transcribedSpeech = transResp.text.trim();
          }
        } catch (tErr) {
          console.warn('[ALEXYN /api/languages/assess] Transcribe note:', extractAIError(tErr));
        }

        // Step 2: Multimodal pronunciation & clarity evaluation via gemini-4-hydrogen
        const coachPrompt = [
          `Target phrase in ${language}: "${targetPhrase}"`,
          `Transcribed words heard: "${transcribedSpeech || '(inaudible or silent)'}"`,
          'Listen carefully to the attached audio recording AND compare against the target phrase.',
          'Give ALL coaching explanations and tips in English, keeping only the target-language example words in their language.',
          'Be honest and encouraging: note which words were clear, which words need syllable stress/vowel/consonant practice, and give a specific actionable coaching tip.',
          'Return strict JSON: { transcript: string, clarityScore: number (0-100), accuracyScore: number (0-100), overallNote: string, wordFeedback: [{ target: string, heard: string, status: "good"|"practice"|"missing", tip: string }], pronunciationTips: string[], suggestedRetryPhrase: string }.',
        ].join('\n');

        const evalResp = await withFastRetry(() =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: { parts: [audioPart, { text: coachPrompt }] },
            config: {
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          })
        );

        const assessed = parseAIJsonSafe<Record<string, unknown>>(evalResp.text || '{}');
        return res.json({
          transcript: String(assessed.transcript || transcribedSpeech || ''),
          analysisMode: 'audio-gemini',
          clarityScore: Number(assessed.clarityScore || 0),
          accuracyScore: Number(assessed.accuracyScore || 0),
          overallNote: String(assessed.overallNote || 'Audio assessed.'),
          wordFeedback: Array.isArray(assessed.wordFeedback) ? assessed.wordFeedback : [],
          pronunciationTips: Array.isArray(assessed.pronunciationTips) ? assessed.pronunciationTips : [],
          suggestedRetryPhrase: String(assessed.suggestedRetryPhrase || targetPhrase),
        });
      }

      // OpenAI Whisper fallback when Gemini multimodal audio client isn't configured
      let effectiveTranscriptHint = transcriptHint?.trim() || '';
      if (!effectiveTranscriptHint && audioBase64 && getProviderKey('openai')) {
        try {
          const cleanB64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
          const whisper = await transcribeAudioWithOpenAI({
            cleanBase64: cleanB64,
            audioMimeType,
            language,
          });
          if (whisper?.transcript?.trim()) {
            effectiveTranscriptHint = whisper.transcript.trim();
          }
        } catch (whisperErr) {
          console.warn(
            '[ALEXYN /api/languages/assess] OpenAI transcription note:',
            extractAIError(whisperErr)
          );
        }
      }

      // Honest transcript-only fallback when audio upload / Gemini multimodal audio isn't available
      if (!effectiveTranscriptHint) {
        return res.status(422).json({
          error:
            'No speech audio or spoken transcript was captured. Allow microphone access or speak clearly closer to the mic and try again.',
        });
      }

      const textEval = await runStructuredJsonAI<Record<string, unknown>>({
        systemInstruction: [
          `You are an honest ${language} speaking coach.`,
          'NOTE: Only a speech-to-text transcript was provided (not raw acoustic audio). Do NOT claim acoustic tone or nasal/accent accuracy beyond word accuracy and syllable breakdown in English.',
          'Return strict JSON: { transcript: string, clarityScore: number, accuracyScore: number, overallNote: string, wordFeedback: [{ target: string, heard: string, status: "good"|"practice"|"missing", tip: string }], pronunciationTips: string[], suggestedRetryPhrase: string }.',
        ].join('\n'),
        userPrompt: `Target ${language} phrase: "${targetPhrase}"\nTranscribed speech text: "${effectiveTranscriptHint}"`,
        aiSelection,
      });

      return res.json({
        ...textEval,
        transcript: String(textEval.transcript || effectiveTranscriptHint),
        analysisMode: 'transcript-only',
      });
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  // DEEP AI PERFORMANCE ANALYSIS ENDPOINT
  app.post('/api/progress/analyze', async (req: Request, res: Response) => {
    try {
      const { attempts = [], summaries = [], profile, aiSelection } = req.body as {
        attempts: unknown[];
        summaries: unknown[];
        profile?: EducationProfile;
        aiSelection?: AISelection;
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
        aiSelection,
      });
      return res.json(data);
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  async function transcribeAudioWithOpenAI(params: {
    cleanBase64: string;
    audioMimeType: string;
    language?: string;
  }): Promise<{ transcript: string; engine: string } | null> {
    const openaiKey = getProviderKey('openai');
    if (!openaiKey) return null;

    const audioBuffer = Buffer.from(params.cleanBase64, 'base64');
    const mime = (params.audioMimeType || 'audio/webm').split(';')[0].trim();
    const ext = mime.includes('mp4') || mime.includes('m4a')
      ? 'm4a'
      : mime.includes('wav')
      ? 'wav'
      : mime.includes('ogg')
      ? 'ogg'
      : 'webm';
    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: mime }), `speech.${ext}`);
    form.append('model', 'whisper-1');
    const shortLang = normalizeSpeechLangCode(params.language || 'en-US').split('-')[0];
    if (shortLang && shortLang.length === 2) {
      form.append('language', shortLang);
    }

    const resp = await withFastRetry(
      () =>
        fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
          },
          body: form,
        }),
      35000
    );
    const raw = await resp.text();
    let payload: { text?: string; error?: { message?: string } } = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      // non-json response
    }
    if (!resp.ok) {
      throw new Error(payload?.error?.message || `OpenAI Transcription HTTP ${resp.status}`);
    }
    return {
      transcript: String(payload.text || '').trim(),
      engine: 'openai-whisper-1',
    };
  }

  // BUILT-IN MICROPHONE SPEECH TRANSCRIPTION (Server-side Gemini + OpenAI Whisper fallback)
  app.post('/api/speech/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, audioMimeType = 'audio/webm', language = 'en-US' } = req.body as {
        audioBase64?: string;
        audioMimeType?: string;
        language?: string;
      };

      const cleanB64 = String(audioBase64 || '').includes(',')
        ? String(audioBase64 || '').split(',')[1]
        : String(audioBase64 || '').trim();

      if (!cleanB64) {
        return res.status(400).json({ error: 'Audio recording data is required for transcription.' });
      }

      const ai = getGeminiClient();
      const openaiKey = getProviderKey('openai');
      if (!ai && !openaiKey) {
        return res.status(503).json({
          error:
            'Server speech transcription requires GEMINI_API_KEY or OPENAI_API_KEY in backend secrets. Configure a key or type your message directly.',
        });
      }

      let lastErr: unknown = null;
      if (ai) {
        const langLabel = LANGUAGE_DISPLAY_NAMES[normalizeSpeechLangCode(language)] || language;
        const audioPart = {
          inlineData: {
            mimeType: audioMimeType || 'audio/webm',
            data: cleanB64,
          },
        };
        const promptText = `Transcribe the spoken audio accurately into text (expected language: ${langLabel}). Return ONLY the plain spoken words with natural punctuation, no timestamps or commentary. If the recording is silent, return an empty string.`;

        const candidates = ['gemini-3.5-transcribe', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
        for (const model of candidates) {
          try {
            const resp = await withFastRetry(() =>
              ai.models.generateContent({
                model,
                contents: { parts: [audioPart, { text: promptText }] },
              })
            );
            const transcript = (resp.text || '').trim();
            return res.json({
              transcript,
              engine: model,
            });
          } catch (err) {
            lastErr = err;
            console.warn(`[ALEXYN /api/speech/transcribe] ${model} failed:`, extractAIError(err));
          }
        }
      }

      if (openaiKey) {
        try {
          const oaResult = await transcribeAudioWithOpenAI({
            cleanBase64: cleanB64,
            audioMimeType,
            language,
          });
          if (oaResult) {
            return res.json(oaResult);
          }
        } catch (err) {
          lastErr = err;
          console.warn('[ALEXYN /api/speech/transcribe] OpenAI Whisper failed:', extractAIError(err));
        }
      }

      throw lastErr instanceof Error ? lastErr : new Error('Speech transcription failed.');
    } catch (error) {
      const msg = extractAIError(error);
      return res.status(503).json({ error: formatFriendlyAIError(msg) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get('*', async (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) return next();
      try {
        const template = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>ALEXYN — Learn · Explore · Excel</title>
    <meta name="description" content="Understand more. Memorise less. Think smarter. Your personal AI learning space with ChatGPT-style Explore, customizable Smart Notes, exam-focused Subjects & Languages, Practice Area, and community sharing." />
    <meta property="og:title" content="ALEXYN — Learn · Explore · Excel" />
    <meta property="og:description" content="Understand more. Memorise less. Think smarter. Your personal AI learning space." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body class="bg-[#040A1A] text-[#F4F7FF] antialiased selection:bg-[#2E8BFF]/30 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        return next(err);
      }
    });
  } else {
    const fsSync = await import('node:fs');
    const distPath = path.join(__dirname, 'dist');
    const distIndex = path.join(distPath, 'index.html');
    if (fsSync.existsSync(distIndex)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(distIndex);
      });
    } else {
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(__dirname, 'index.html'));
      });
    }
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ALEXYN server running on http://0.0.0.0:${PORT}`);
  });
  httpServer.requestTimeout = 0;
  httpServer.headersTimeout = 120000;
}

startServer().catch((err) => {
  console.error('Failed to start ALEXYN server:', err);
  process.exit(1);
});
