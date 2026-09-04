import axios from 'axios';
import dns from 'dns';
import https from 'https';
import { env } from '../config/env';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

export const ANTI_HALLUCINATION_PROMPT = `
CRITICAL INSTRUCTION & GROUNDING RULE:
Use ONLY information contained in the supplied transcript/chunk.
Do NOT use outside knowledge.
Do NOT infer facts that are not explicitly stated.
Do NOT invent financial numbers, percentages, dates, guidance, risks, segment results, or Q&A.
If information is not disclosed in the transcript, return: "Not disclosed in transcript."
Preserve exact financial values (e.g. ₹1,245 crore, $500 million, 12.5%, +150 bps, Q1 FY26, FY25, 2.5x, -5.2%).
`.trim();

/**
 * Safely parses Groq rate-limit reset duration strings into milliseconds.
 *
 * Supported formats:
 * - "1.35s" -> 1350ms
 * - "7.66s" -> 7660ms
 * - "1m2.5s" -> 62500ms
 * - "2m" -> 120000ms
 * - "350ms" -> 350ms
 * - "1.35" -> 1350ms
 * - 1.35 (number) -> 1350ms
 */
export function parseGroqResetDuration(durationStr: string | number | undefined | null): number | null {
  if (durationStr == null) return null;
  const str = String(durationStr).trim();
  if (!str) return null;

  // 1. Matches minutes + seconds (e.g. "1m2.5s", "2m", "15.2s")
  const minSecMatch = str.match(/^(?:(\d+(?:\.\d+)?)m)?\s*(?:(\d+(?:\.\d+)?)s)?$/i);
  if (minSecMatch && (minSecMatch[1] !== undefined || minSecMatch[2] !== undefined)) {
    const mins = minSecMatch[1] ? parseFloat(minSecMatch[1]) : 0;
    const secs = minSecMatch[2] ? parseFloat(minSecMatch[2]) : 0;
    const totalMs = (mins * 60 + secs) * 1000;
    return isNaN(totalMs) || totalMs <= 0 ? null : Math.round(totalMs);
  }

  // 2. Matches milliseconds (e.g. "350ms")
  const msMatch = str.match(/^(\d+(?:\.\d+)?)ms$/i);
  if (msMatch) {
    const ms = parseFloat(msMatch[1]);
    return isNaN(ms) || ms <= 0 ? null : Math.round(ms);
  }

  // 3. Fallback: plain float/int number e.g. "1.35" or 1500
  const rawNum = parseFloat(str);
  if (!isNaN(rawNum) && rawNum > 0) {
    return Math.round(rawNum > 1000 ? rawNum : rawNum * 1000);
  }

  return null;
}

export interface GroqRateLimitCalcResult {
  delayMs: number;
  remainingTokens: number | null;
  resetTokensStr: string | null;
  resetTokensMs: number | null;
  remainingRequests: number | null;
  resetRequestsStr: string | null;
  resetRequestsMs: number | null;
  retryAfterMs: number | null;
  source: string;
}

/**
 * Calculates TPM and RPM-aware rate-limit delay for Groq HTTP 429 errors.
 *
 * Headers inspected:
 * - retry-after / retry-after-ms
 * - x-ratelimit-remaining-tokens
 * - x-ratelimit-reset-tokens
 * - x-ratelimit-remaining-requests
 * - x-ratelimit-reset-requests
 */
export function calculateGroqRateLimitDelay(
  headers: Record<string, any> = {},
  retries: number = 1
): GroqRateLimitCalcResult {
  // Normalize header keys to lowercase
  const normHeaders: Record<string, any> = {};
  for (const k of Object.keys(headers || {})) {
    normHeaders[k.toLowerCase()] = headers[k];
  }

  const rawRemainingTokens = normHeaders['x-ratelimit-remaining-tokens'];
  const remainingTokens =
    rawRemainingTokens != null && !isNaN(parseFloat(String(rawRemainingTokens)))
      ? parseFloat(String(rawRemainingTokens))
      : null;

  const resetTokensStr = normHeaders['x-ratelimit-reset-tokens'] ? String(normHeaders['x-ratelimit-reset-tokens']) : null;
  const resetTokensMs = parseGroqResetDuration(resetTokensStr);

  const rawRemainingRequests = normHeaders['x-ratelimit-remaining-requests'];
  const remainingRequests =
    rawRemainingRequests != null && !isNaN(parseFloat(String(rawRemainingRequests)))
      ? parseFloat(String(rawRemainingRequests))
      : null;

  const resetRequestsStr = normHeaders['x-ratelimit-reset-requests'] ? String(normHeaders['x-ratelimit-reset-requests']) : null;
  const resetRequestsMs = parseGroqResetDuration(resetRequestsStr);

  const retryAfterStr =
    normHeaders['retry-after'] || normHeaders['retry-after-ms']
      ? String(normHeaders['retry-after'] || normHeaders['retry-after-ms'])
      : null;
  const retryAfterMs = parseGroqResetDuration(retryAfterStr);

  let baseDelayMs: number;
  let source: string;

  const isTpmExhausted = remainingTokens !== null && remainingTokens <= 0 && resetTokensMs !== null && resetTokensMs > 0;
  const isRpmExhausted = remainingRequests !== null && remainingRequests <= 1 && resetRequestsMs !== null && resetRequestsMs > 0;

  if (isTpmExhausted && isRpmExhausted) {
    baseDelayMs = Math.max(resetTokensMs!, resetRequestsMs!, retryAfterMs || 0);
    source = 'both (TPM & RPM exhausted)';
  } else if (isTpmExhausted) {
    baseDelayMs = Math.max(resetTokensMs!, resetRequestsMs || 0, retryAfterMs || 0);
    source = 'x-ratelimit-reset-tokens (TPM exhausted)';
  } else if (isRpmExhausted) {
    baseDelayMs = Math.max(resetRequestsMs!, resetTokensMs || 0, retryAfterMs || 0);
    source = 'x-ratelimit-reset-requests (RPM exhausted)';
  } else {
    // Neither remaining count is strictly <= 1, so pick max available delay header
    const candidateDelays: { delay: number; src: string }[] = [];
    if (resetTokensMs !== null && resetTokensMs > 0) candidateDelays.push({ delay: resetTokensMs, src: 'x-ratelimit-reset-tokens' });
    if (resetRequestsMs !== null && resetRequestsMs > 0) candidateDelays.push({ delay: resetRequestsMs, src: 'x-ratelimit-reset-requests' });
    if (retryAfterMs !== null && retryAfterMs > 0) candidateDelays.push({ delay: retryAfterMs, src: 'retry-after' });

    if (candidateDelays.length > 0) {
      candidateDelays.sort((a, b) => b.delay - a.delay);
      baseDelayMs = candidateDelays[0].delay;
      source = candidateDelays[0].src;
    } else {
      // Exponential backoff fallback (~5s, ~10s, ~20s) plus bounded random jitter (0-1000ms)
      baseDelayMs = Math.min(5000 * Math.pow(2, retries - 1), 30000);
      source = 'exponential-backoff';
    }
  }

  // Safety margin: Add +1500ms safety buffer so request doesn't hit server at exact boundary
  const safetyMarginMs = 1500;
  let finalDelayMs = baseDelayMs + safetyMarginMs;

  // Floor: Minimum delay floor of 15,000ms if quota window exhaustion is indicated
  if (
    (remainingTokens !== null && remainingTokens <= 0) ||
    (remainingRequests !== null && remainingRequests <= 1) ||
    (resetRequestsMs !== null && resetRequestsMs > 0) ||
    (resetTokensMs !== null && resetTokensMs > 0) ||
    retries > 1
  ) {
    finalDelayMs = Math.max(finalDelayMs, 15000);
  }

  // Ceiling: Cap max delay at 60,000ms
  finalDelayMs = Math.min(finalDelayMs, 60000);


  return {
    delayMs: finalDelayMs,
    remainingTokens,
    resetTokensStr,
    resetTokensMs,
    remainingRequests,
    resetRequestsStr,
    resetRequestsMs,
    retryAfterMs,
    source,
  };
}

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export class LlmClient {
  private provider: string;

  constructor() {
    this.provider = (process.env.LLM_PROVIDER || 'fallback').toLowerCase();
  }

  public getProviderName(): string {
    return this.provider;
  }

  public async generateCompletion(req: LlmRequest): Promise<string> {
    const fullSystemPrompt = `${ANTI_HALLUCINATION_PROMPT}\n\n${req.systemPrompt}`;

    if (this.provider === 'gemini') {
      return this.callGemini(fullSystemPrompt, req.userPrompt);
    } else if (this.provider === 'groq') {
      return this.callGroq(fullSystemPrompt, req.userPrompt);
    } else if (this.provider === 'openai') {
      return this.callOpenAI(fullSystemPrompt, req.userPrompt);
    } else if (this.provider === 'fallback') {
      return this.callFallback(req.userPrompt);
    } else {
      throw new Error(`Unsupported LLM_PROVIDER: "${this.provider}". Valid providers are "gemini", "groq", "openai", or "fallback".`);
    }
  }

  private async callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('LLM_PROVIDER is configured to "gemini", but GEMINI_API_KEY environment variable is not set.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      try {
        const response = await axios.post(
          url,
          {
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          },
          { timeout: 60000 }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('Gemini API returned an empty response candidate.');
        }
        return text;
      } catch (err: any) {
        if (err.response?.status === 413) {
          throw new Error(`Gemini API call failed with HTTP 413 Payload Too Large: request payload size exceeds provider limits.`);
        }
        retries++;
        if (retries > maxRetries) {
          throw new Error(`Gemini API call failed after ${maxRetries} retries: ${err.message}`);
        }
        const isRateLimit = err.response?.status === 429;
        let delay: number;

        const isTestEnv = process.env.NODE_ENV === 'test' || process.env.GEMINI_API_KEY === 'mock_key_for_test' || process.env.GROQ_API_KEY === 'mock_groq_key';
        if (isTestEnv) {
          delay = 10;
        } else if (isRateLimit) {
          const retryAfterHeader = err.response?.headers?.['retry-after'] || err.response?.headers?.['retry-after-ms'];
          if (retryAfterHeader) {
            const parsed = parseGroqResetDuration(retryAfterHeader);
            delay = parsed != null && parsed > 0 ? parsed : 5000;
          } else {
            // Exponential backoff (~5s, ~10s, ~20s) plus bounded random jitter (0-1000ms)
            const baseDelay = Math.min(5000 * Math.pow(2, retries - 1), 30000);
            const jitter = Math.floor(Math.random() * 1000);
            delay = Math.min(baseDelay + jitter, 30000);
          }
          console.warn(`[GEMINI 429 BACKOFF] Rate limit hit (${err.response?.data?.error?.status || 'RESOURCE_EXHAUSTED'}). Retrying attempt ${retries}/${maxRetries} in ${delay}ms...`);
        } else {
          delay = Math.min(1000 * Math.pow(2, retries), 10000);
          console.warn(`[GEMINI BACKOFF] Request failed (${err.message}). Retrying attempt ${retries}/${maxRetries} in ${delay}ms...`);
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error('Gemini API call failed');
  }

  private async callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('LLM_PROVIDER is configured to "groq", but GROQ_API_KEY environment variable is not set.');
    }

    const model = process.env.GROQ_MODEL || env.GROQ_MODEL || 'openai/gpt-oss-120b';
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    let retries = 0;
    const maxRetries = 10;

    while (retries <= maxRetries) {
      try {
        const response = await axios.post(
          url,
          {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: env.HTTP_TIMEOUT_MS || 30000,
            httpsAgent: new https.Agent({
              lookup: (hostname, options, callback) => {
                dns.lookup(hostname, { ...options, family: 4 }, callback);
              },
            }),
          }
        );

        const text = response.data?.choices?.[0]?.message?.content;
        if (!text) {
          throw new Error('Groq API returned an empty response choice.');
        }
        return text;
      } catch (err: any) {
        if (err.response?.status === 413) {
          throw new Error(`Groq API call failed with HTTP 413 Payload Too Large: request payload size exceeds provider limits.`);
        }
        retries++;
        if (retries > maxRetries) {
          throw new Error(`Groq API call failed after ${maxRetries} retries: ${err.message}`);
        }
        const isRateLimit = err.response?.status === 429;
        let delay: number;

        const isTestEnv = process.env.NODE_ENV === 'test' || process.env.GEMINI_API_KEY === 'mock_key_for_test' || process.env.GROQ_API_KEY === 'mock_groq_key';
        if (isTestEnv) {
          delay = 10;
        } else if (isRateLimit) {
          const calc = calculateGroqRateLimitDelay(err.response?.headers, retries);
          delay = calc.delayMs;
          console.warn(
            `[GROQ 429 BACKOFF] model=${model} attempt=${retries}/${maxRetries} remaining_tokens=${calc.remainingTokens ?? 'N/A'} reset_tokens=${calc.resetTokensStr ?? 'N/A'} retry_delay=${(delay / 1000).toFixed(1)}s source="${calc.source}"`
          );
        } else {
          delay = Math.min(1000 * Math.pow(2, retries), 10000);
          console.warn(`[GROQ BACKOFF] Request failed (${err.message}). Retrying attempt ${retries}/${maxRetries} in ${delay}ms...`);
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error('Groq API call failed');
  }

  private async callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('LLM_PROVIDER is configured to "openai", but OPENAI_API_KEY environment variable is not set.');
    }

    const url = 'https://api.openai.com/v1/chat/completions';

    let retries = 0;
    const maxRetries = env.HTTP_MAX_RETRIES || 3;

    while (retries <= maxRetries) {
      try {
        const response = await axios.post(
          url,
          {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: env.HTTP_TIMEOUT_MS || 30000,
          }
        );

        const text = response.data?.choices?.[0]?.message?.content;
        if (!text) {
          throw new Error('OpenAI API returned an empty response choice.');
        }
        return text;
      } catch (err: any) {
        retries++;
        if (retries > maxRetries) {
          throw new Error(`OpenAI API call failed after ${maxRetries} retries: ${err.message}`);
        }
        const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 200, 10000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error('OpenAI API call failed');
  }

  private async callFallback(userPrompt: string): Promise<string> {
    // Deterministic mock json generator for unit tests
    if (userPrompt.includes('TRANSCRIPT CHUNK') || userPrompt.includes('GROUP #')) {
      // Map / intermediate-reduce phase mock response
      return JSON.stringify({
        chunkIndex: 0,
        claims: [
          {
            claim: 'Revenue grew 12.5% to ₹1,245 crore',
            evidence: 'Revenue increased 12.5% to ₹1,245 crore in Q1 FY26',
            chunkIndex: 0,
          },
        ],
        financialFigures: ['₹1,245 crore', '12.5%', '+150 bps', '$500 million', 'Q1 FY26', 'FY25', '2.5x', '-5.2%'],
        segmentObservations: ['Cloud & Services grew 18.5% YoY.'],
        guidanceStatements: ['Targeting double-digit revenue growth in FY26.'],
        managementCommentary: ['Management reported strong demand across key verticals.'],
        qaObservations: [
          {
            asked_by: 'Jane Smith — Goldman Sachs',
            question: 'Could you elaborate on the EBITDA margin expansion trajectory?',
            answer: 'EBITDA margin expanded by +150 bps due to operational efficiencies and higher utilization.',
            answer_continues_in_next_chunk: false,
            evidence: 'Jane Smith — Goldman Sachs: Could you elaborate on the EBITDA margin expansion trajectory? Management: EBITDA margin expanded by +150 bps due to operational efficiencies and higher utilization.',
            chunkIndex: 0,
          },
        ],
        risks: ['Global macroeconomic uncertainty.'],
      });
    }


    // Reduce phase mock response
    return JSON.stringify({
      company: 'Tata Consultancy Services Limited',
      scrip_code: '532540',
      nse_symbol: 'TCS',
      quarter: 'Q1 FY26',
      call_date: '2026-07-15',
      source: 'NSE',
      source_url: 'https://www.nseindia.com',
      tldr: [
        'Revenue increased 12.5% to ₹1,245 crore in Q1 FY26.',
        'Net margin expanded by +150 bps with operating cash flow at $500 million.',
      ],
      management_commentary: ['Management highlighted robust demand across cloud and transformation deals.'],
      guidance: ['Targeting double-digit revenue growth for full year FY26.'],
      segment_performance: [
        {
          segment: 'Cloud & Digital Transformation',
          notes: 'Grew 18.5% YoY driven by enterprise adoption.',
        },
      ],
      key_metrics: [
        {
          metric: 'Revenue',
          value: '₹1,245 crore',
          context: '12.5% YoY growth in Q1 FY26',
        },
        {
          metric: 'Operating Cash Flow',
          value: '$500 million',
          context: '+150 bps margin expansion',
        },
      ],
      notable_qa: [
        {
          question: 'Could you elaborate on the margin expansion trajectory?',
          answer: 'EBITDA margin expanded by +150 bps due to operational efficiencies.',
          asked_by: 'Jane Smith — Goldman Sachs',
        },
      ],
      risks: ['Currency volatility and global macroeconomic headwinds.'],
    });
  }
}
