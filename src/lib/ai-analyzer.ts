import type { IranEquivalent, PHComment, Product } from '@/types';

export interface AIAnalysis {
  faDescription: string;
  faComments: PHComment[];
  iranEquivalent: IranEquivalent;
  aiReview: string;
}

export interface AnalysisNeed {
  faDescription: boolean;
  faComments: boolean;
  iranEquivalent: boolean;
  aiReview: boolean;
}

const ALL_FIELDS: AnalysisNeed = {
  faDescription: true,
  faComments: true,
  iranEquivalent: true,
  aiReview: true,
};

function normalizeDigits(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function sanitize(text: string): string {
  return text
    .replace(/\[REDACTED\]/gi, '')
    .replace(/\\n/g, '\n')
    .replace(/[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u0400-\u04ff\uac00-\ud7af\u3131-\u3163]/g, '')
    .replace(/(^|[\s،.؛:!؟?])IR(?=[\s،.؛:!؟?]|$)/g, ' ')
    .replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d])
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function cleanJson(text: string): string {
  return normalizeDigits(text.replace(/```json/gi, '').replace(/```/g, '').trim());
}

function repairJsonCandidate(text: string): string {
  return text
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 45000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function buildPrompt(p: Product, need: AnalysisNeed = ALL_FIELDS): string {
  const originals = need.faComments ? (p.comments ?? []).slice(0, 8) : [];
  const commentsEn = originals.map((c, i) => `${i + 1}) ${c.text}`).join('\n');
  const requested: string[] = [];

  if (need.faDescription) requested.push('"faDescription": "ترجمه کامل توضیحات به فارسی روان، حداقل ۴ جمله"');
  if (need.faComments) requested.push('"faComments": ["ترجمه نظر ۱", "... دقیقاً به تعداد نظرات ورودی"]');
  if (need.iranEquivalent) requested.push('"iranEquivalent": {"productName":"...","description":"۳ جمله","marketOpportunity":"۲ جمله","estimatedBudget":"۲ تا ۴ میلیارد تومان","targetAudience":"...","challenges":["...","..."],"monetization":["...","..."],"techStack":["Next.js","PostgreSQL"],"confidence":75}');
  if (need.aiReview) requested.push('"aiReview": "تحلیل فارسی ساختاریافته شامل مسئله و راه‌حل، معماری و تکنولوژی، مدل درآمدی، نقاط قوت، نقاط ضعف و نکته طلایی برای ایران"');

  return `تو یک مترجم حرفه‌ای فارسی و تحلیل‌گر ارشد استارتاپ هستی.\n\nمحصول: ${p.name}\nتگلاین: ${p.tagline}\nتوضیحات: ${(p.description ?? '').slice(0, 650)}${need.faComments ? `\n\nنظرات واقعی کاربران:\n${commentsEn || '—'}` : ''}\n\nفقط فیلدهای زیر را تولید کن و هیچ فیلد اضافه‌ای نساز. خروجی فقط JSON معتبر باشد. متن فارسی روان باشد؛ [REDACTED]، undefined، null، TODO/TBD و متن غیرمرتبط ممنوع است. ${need.faComments ? 'faComments باید دقیقاً به همان ترتیب و همان تعداد نظرات ورودی باشد.' : ''}\n\n{\n  ${requested.join(',\n  ')}\n}`;
}

export function groqOutputBudget(need: AnalysisNeed = ALL_FIELDS): number {
  let budget = 220;
  if (need.faDescription) budget += 420;
  if (need.faComments) budget += 170 * 8;
  if (need.iranEquivalent) budget += 620;
  if (need.aiReview) budget += 780;
  return Math.min(2800, Math.max(700, budget));
}

let geminiUnavailableForProcess = false;

function isGeminiQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('HTTP 429') || message.includes('RESOURCE_EXHAUSTED');
}

async function callGemini(key: string, prompt: string): Promise<string> {
  const model = 'gemini-3.6-flash';
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`Gemini ${model}: HTTP ${res.status}${body ? ` | ${body.slice(0, 500)}` : ''}`);
  const json = JSON.parse(body);
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error(`Gemini ${model}: empty response`);
  console.log(`   ✨ model: ${model}`);
  return text;
}

async function getGroqModels(key: string): Promise<string[]> {
  const res = await fetchWithTimeout('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Groq models HTTP ${res.status}${body ? ` | ${body.slice(0, 500)}` : ''}`);
  const json = JSON.parse(body);
  return (json.data ?? []).map((m: any) => String(m.id ?? '')).filter(Boolean);
}

let cachedGroqModels: Promise<string[]> | null = null;

async function resolveGroqModels(key: string): Promise<string[]> {
  if (!cachedGroqModels) {
    cachedGroqModels = (async () => {
      const available = await getGroqModels(key);
      const preferred = [
        'qwen/qwen3.8-27b',
        'openai/gpt-oss-20b',
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'moonshotai/kimi-k2-instruct',
        'openai/gpt-oss-120b',
        'qwen/qwen3.6-27b',
      ];
      const models = preferred.filter((candidate) => available.includes(candidate)).slice(0, 5);
      if (!models.length) throw new Error(`Groq: no supported preferred model available; discovered=${available.slice(0, 20).join(',')}`);
      console.log(`   🧭 Groq failover pool: ${models.join(', ')}`);
      return models;
    })().catch((error) => {
      cachedGroqModels = null;
      throw error;
    });
  }
  return cachedGroqModels;
}

async function callGroqModel(key: string, model: string, prompt: string, maxTokens: number): Promise<string | null> {
  const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (res.status === 429) {
    console.warn(`   ↪️  Groq ${model} rate limited; trying next available model immediately`);
    return null;
  }

  const body = await res.text();
  if (!res.ok) throw new Error(`Groq ${model}: HTTP ${res.status}${body ? ` | ${body.slice(0, 500)}` : ''}`);
  const json = JSON.parse(body);
  const text = json.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) {
    console.warn(`   ↪️  Groq ${model} returned empty content; trying next available model immediately`);
    return null;
  }
  console.log(`   ✨ model: ${model}`);
  return text;
}

async function callGroq(key: string, prompt: string, maxTokens: number): Promise<string> {
  const models = await resolveGroqModels(key);
  const failures: string[] = [];
  for (const model of models) {
    try {
      const text = await callGroqModel(key, model, prompt, maxTokens);
      if (text) return text;
      failures.push(`${model}: unavailable`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${model}: ${message}`);
      console.warn(`   ↪️  Groq ${model} failed; trying next available model immediately`);
    }
  }
  throw new Error(`Groq exhausted failover pool: ${failures.join(' | ')}`);
}

function tryParse(text: string): any {
  const clean = cleanJson(text);
  const candidates = [clean];
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(clean.slice(firstBrace, lastBrace + 1));

  for (const candidate of candidates) {
    for (const version of [candidate, repairJsonCandidate(candidate)]) {
      try { return JSON.parse(version); } catch { /* continue */ }
    }
  }
  throw new Error(`JSON parse failed: ${clean.slice(0, 180)}`);
}

function existingIranEquivalent(p: Product): IranEquivalent {
  return p.iranEquivalent ?? {
    productName: '', description: '', marketOpportunity: '', estimatedBudget: '', targetAudience: '',
    challenges: [], monetization: [], techStack: [], confidence: 0,
  };
}

export async function analyzeProduct(p: Product, need: AnalysisNeed = ALL_FIELDS): Promise<AIAnalysis> {
  const prompt = buildPrompt(p, need);
  const maxTokens = groqOutputBudget(need);
  let text = '';
  let provider = '';
  const errors: string[] = [];

  if (process.env.GEMINI_API_KEY && !geminiUnavailableForProcess) {
    try {
      text = await callGemini(process.env.GEMINI_API_KEY, prompt);
      provider = 'gemini';
    } catch (e: any) {
      if (isGeminiQuotaError(e)) {
        geminiUnavailableForProcess = true;
        console.warn('   ↪️  Gemini quota exhausted; skipping Gemini for the rest of this process');
      }
      errors.push(`gemini: ${e.message}`);
      console.warn(`   ⚠️  gemini: ${e.message}`);
    }
  }

  if (!text && process.env.GROQ_API_KEY) {
    try {
      text = await callGroq(process.env.GROQ_API_KEY, prompt, maxTokens);
      provider = 'groq';
    } catch (e: any) {
      errors.push(`groq: ${e.message}`);
      console.warn(`   ⚠️  groq: ${e.message}`);
    }
  }

  if (!text) throw new Error(`AI failed: ${errors.join(' | ') || 'no key'}`);
  console.log(`   🤖 provider: ${provider}`);

  const parsed = tryParse(text);
  const originals = (p.comments ?? []).slice(0, 8);
  let faComments = p.faComments ?? [];

  if (need.faComments) {
    const texts = Array.isArray(parsed.faComments)
      ? parsed.faComments.map((x: any) => (typeof x === 'string' ? x : x?.text ?? ''))
      : [];
    faComments = originals
      .map((c, i) => {
        const name = c.user && !String(c.user).includes('REDACTED') ? c.user : `کاربر ProductHunt ${i + 1}`;
        return { user: name, text: sanitize(texts[i] ?? '') };
      })
      .filter((c) => c.text.length > 5);
  }

  let iranEquivalent = existingIranEquivalent(p);
  if (need.iranEquivalent) {
    const eqRaw = parsed.iranEquivalent ?? {};
    iranEquivalent = {
      productName: sanitize(eqRaw.productName ?? ''),
      description: sanitize(eqRaw.description ?? ''),
      marketOpportunity: sanitize(eqRaw.marketOpportunity ?? ''),
      estimatedBudget: sanitize(eqRaw.estimatedBudget ?? ''),
      targetAudience: sanitize(eqRaw.targetAudience ?? ''),
      challenges: (eqRaw.challenges ?? []).map((x: string) => sanitize(x)),
      monetization: (eqRaw.monetization ?? []).map((x: string) => sanitize(x)),
      techStack: (eqRaw.techStack ?? []).map((x: string) => sanitize(x)),
      confidence: Number(eqRaw.confidence ?? 0) || 0,
    };
  }

  return {
    faDescription: need.faDescription ? sanitize(parsed.faDescription ?? '') : (p.faDescription ?? ''),
    faComments,
    iranEquivalent,
    aiReview: need.aiReview ? sanitize(parsed.aiReview ?? '') : (p.aiReview ?? ''),
  };
}
