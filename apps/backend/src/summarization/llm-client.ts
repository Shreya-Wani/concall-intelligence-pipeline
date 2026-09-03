import axios from 'axios';
import { env } from '../config/env';

export const ANTI_HALLUCINATION_PROMPT = `
CRITICAL INSTRUCTION & GROUNDING RULE:
Use ONLY information contained in the supplied transcript/chunk.
Do NOT use outside knowledge.
Do NOT infer facts that are not explicitly stated.
Do NOT invent financial numbers, percentages, dates, guidance, risks, segment results, or Q&A.
If information is not disclosed in the transcript, return: "Not disclosed in transcript."
Preserve exact financial values (e.g. ₹1,245 crore, $500 million, 12.5%, +150 bps, Q1 FY26, FY25, 2.5x, -5.2%).
`.trim();

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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

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
            const parsed = parseInt(String(retryAfterHeader), 10);
            delay = !isNaN(parsed) && parsed > 0 ? (parsed > 1000 ? parsed : parsed * 1000) : 5000;
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
    const maxRetries = env.HTTP_MAX_RETRIES || 3;

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
          const retryAfterHeader = err.response?.headers?.['retry-after'] || err.response?.headers?.['retry-after-ms'];
          if (retryAfterHeader) {
            const parsed = parseInt(String(retryAfterHeader), 10);
            delay = !isNaN(parsed) && parsed > 0 ? (parsed > 1000 ? parsed : parsed * 1000) : 5000;
          } else {
            const baseDelay = Math.min(5000 * Math.pow(2, retries - 1), 30000);
            const jitter = Math.floor(Math.random() * 1000);
            delay = Math.min(baseDelay + jitter, 30000);
          }
          console.warn(`[GROQ 429 BACKOFF] Rate limit hit. Retrying attempt ${retries}/${maxRetries} in ${delay}ms...`);
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
      // Map phase mock response
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
        qaObservations: ['Analyst asked about EBITDA margin expansion.'],
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
