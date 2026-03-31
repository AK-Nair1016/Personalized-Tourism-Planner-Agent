import groq from '../lib/groq';
import type { UserProfile } from '@vibetrip/shared/types/userProfile';
export async function vibeAgent(userProfile: UserProfile, attractions: any[]) {
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
${JSON.stringify(userProfile, null, 2)}

Attractions:
${JSON.stringify(attractions, null, 2)}

Return a JSON array. Each item must have:
{
  "attraction_id": string,
  "vibe_fit_score": float 0.0-1.0,
  "reason": string (max 12 words)
}

Return ONLY the JSON array, no prose.
`;

  const response = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  const text = response.choices[0].message.content || '[]';

  try {
    return JSON.parse(text);
  } catch {
    console.error('vibeAgent parse error:', text);
    return [];
  }
}
