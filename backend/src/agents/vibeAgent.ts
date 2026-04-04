import groq, { GROQ_MODEL } from '../lib/groq';
import type { UserProfile } from '@vibetrip/shared/types/userProfile';
import {
  compactAttractionsForPrompt,
  compactUserProfileForPrompt,
} from './promptData';

export async function vibeAgent(userProfile: UserProfile, attractions: any[]) {
  const maxAttractions = Number(process.env.AGENT_ATTRACTION_LIMIT ?? 30);
  const compactProfile = compactUserProfileForPrompt(userProfile);
  const compactAttractions = compactAttractionsForPrompt(attractions, maxAttractions);

  const prompt = `
You are a travel personality expert. Your only job is to look at a traveller's vibe profile and score each attraction by how well it matches their personality.

Vibe definitions:
- adventurer: outdoor, physical, offbeat, early starts, hidden spots
- foodie: local eateries, street food, cooking experiences, markets
- culture_nerd: museums, temples, history, architecture, slow deep visits
- slow_traveller: cafes, parks, neighbourhoods, no schedules
- night_owl: evening markets, rooftop bars, nightlife, late brunches
- budget_explorer: free/cheap spots, local transport, hidden gems

User profile:
${JSON.stringify(compactProfile)}

Attractions (trimmed for token safety):
${JSON.stringify(compactAttractions)}

Return a JSON array. Each item must have:
{
  "attraction_id": string,
  "vibe_fit_score": float 0.0-1.0,
  "reason": string (max 12 words)
}

Return ONLY the JSON array, no prose.
`;

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_completion_tokens: 900,
  });

  const text = response.choices[0].message.content || '[]';

  try {
    return JSON.parse(text);
  } catch {
    console.error('vibeAgent parse error:', text);
    return [];
  }
}
