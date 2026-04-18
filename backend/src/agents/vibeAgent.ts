import groq, { GROQ_MODEL } from '../lib/groq';
import { callWithRetry } from '../utils/retry';
import type { UserProfile } from '@vibetrip/shared/types/userProfile';
import {
  compactAttractionsForPrompt,
  compactUserProfileForPrompt,
} from './promptData';

const HARD_LIMIT = 20;

export type AgentExecutionMeta = {
  usedFallback: boolean;
  retryCount: number;
  llmSuccess: boolean;
};

export type VibeAgentResult = {
  vibeOutput: Array<{
    attraction_id: string;
    vibe_fit_score: number;
    reason: string;
  }>;
  tokensUsed: number;
  meta: AgentExecutionMeta;
};

function extractTokensUsed(response: any) {
  const usage = response?.usage;
  const total =
    usage?.total_tokens ??
    usage?.totalTokens ??
    usage?.total ??
    0;

  return Number.isFinite(total) ? Number(total) : 0;
}

function cleanLLMOutput(text: string) {
  return text
    .replace(/```[\w]*\n?/g, '')
    .replace(/```/g, '')
    .trim();
}

function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateOutput(parsed: any, fallbackSource: any[]) {
  if (!Array.isArray(parsed)) return null;

  return parsed
    .filter((item) => item && item.attraction_id)
    .map((item) => ({
      attraction_id: item.attraction_id,
      vibe_fit_score:
        typeof item.vibe_fit_score === 'number'
          ? Math.max(0, Math.min(1, item.vibe_fit_score))
          : 0.5,
      reason:
        typeof item.reason === 'string'
          ? item.reason.slice(0, 60)
          : 'fallback',
    }));
}

function fallback(attractions: any[]) {
  return attractions.map((a) => ({
    attraction_id: a.id,
    vibe_fit_score: 0.5,
    reason: 'default fallback',
  }));
}

export async function vibeAgent(
  userProfile: UserProfile,
  attractions: any[]
): Promise<VibeAgentResult> {
  // 🔥 HARD ENFORCED LIMIT (ignore env if larger)
  const maxAttractions = Math.min(
    Number(process.env.AGENT_ATTRACTION_LIMIT ?? HARD_LIMIT),
    HARD_LIMIT
  );

  const trimmedAttractions = attractions.slice(0, maxAttractions);

  const compactProfile = compactUserProfileForPrompt(userProfile);
  const compactAttractions = compactAttractionsForPrompt(
    trimmedAttractions,
    maxAttractions
  );

  const prompt = `
You are a travel personality expert.

Score each attraction based on how well it matches the user's vibe.

Return ONLY JSON array:
[
  {
    "attraction_id": string,
    "vibe_fit_score": number (0 to 1),
    "reason": string (max 12 words)
  }
]

User profile:
${JSON.stringify(compactProfile)}

Attractions:
${JSON.stringify(compactAttractions)}
`;

  let retryCount = 0;

  try {
    const response = await callWithRetry(() =>
      groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_completion_tokens: 1500,
        stop: ['\n\n'],
      }),
      {
        onRetry: () => {
          retryCount += 1;
        },
      }
    );
    const tokensUsed = extractTokensUsed(response);

    const raw = response.choices[0]?.message?.content || '[]';
    console.log('[vibeAgent raw output]:', raw);

    // 🔧 CLEAN
    const cleaned = cleanLLMOutput(raw);

    // 🔧 PARSE ATTEMPT 1
    let parsed = safeParse(cleaned);

    // 🔧 PARSE ATTEMPT 2 (extra safety)
    if (!parsed) {
      parsed = safeParse(cleaned.replace(/\n/g, ''));
    }

    const validated = validateOutput(parsed, trimmedAttractions);

    if (!validated || validated.length === 0) {
      console.error('[vibeAgent] invalid output → fallback');
      return {
        vibeOutput: fallback(trimmedAttractions),
        tokensUsed,
        meta: {
          usedFallback: true,
          retryCount,
          llmSuccess: false,
        },
      };
    }

    return {
      vibeOutput: validated,
      tokensUsed,
      meta: {
        usedFallback: false,
        retryCount,
        llmSuccess: true,
      },
    };

  } catch (error) {
    console.error('[vibeAgent] fallback triggered:', error);

    return {
      vibeOutput: fallback(trimmedAttractions),
      tokensUsed: 0,
      meta: {
        usedFallback: true,
        retryCount,
        llmSuccess: false,
      },
    };
  }
}
