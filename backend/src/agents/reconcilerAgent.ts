import groq, { GROQ_MODEL } from '../lib/groq';
import { UserProfile } from '@vibetrip/shared/types/userProfile';
import {
  compactAttractionsForPrompt,
  compactDiversityOutputForPrompt,
  compactLogisticsOutputForPrompt,
  compactUserProfileForPrompt,
  compactVibeOutputForPrompt,
} from './promptData';

export async function reconcilerAgent(
  userProfile: UserProfile,
  vibeOutput: any[],
  budgetOutput: any,
  logisticsOutput: any[],
  diversityOutput: any,
  attractions: any[]
) {
  const maxAttractions = Number(process.env.AGENT_ATTRACTION_LIMIT ?? 30);
  const compactProfile = compactUserProfileForPrompt(userProfile);
  const compactVibe = compactVibeOutputForPrompt(vibeOutput, maxAttractions);
  const compactLogistics = compactLogisticsOutputForPrompt(logisticsOutput);
  const compactDiversity = compactDiversityOutputForPrompt(diversityOutput);
  const compactAttractions = compactAttractionsForPrompt(attractions, maxAttractions);

  const prompt = `
You are the final travel planner. You receive four specialist reports and must build the best possible itinerary from them.

Conflict resolution rules (in priority order):
1. Budget hard cap: never include an activity that exceeds the daily budget cap from the Budget Agent
2. Must-visit: always include any must_visit attraction the user specified, regardless of other scores
3. Vibe fit: prefer attractions with vibe_fit_score >= 0.6 from the Vibe Agent
4. Logistics: follow the day clusters and slot ordering from the Logistics Agent
5. Diversity: apply any replacements from the Diversity Agent unless they conflict with rules 1-3

For each activity, write a "why this fits your vibe" note of exactly 1-2 sentences in a warm, personal tone.

User profile:
${JSON.stringify(compactProfile)}

Vibe agent output:
${JSON.stringify(compactVibe)}

Budget agent output:
${JSON.stringify(budgetOutput)}

Logistics agent output:
${JSON.stringify(compactLogistics)}

Diversity agent output:
${JSON.stringify(compactDiversity)}

Attractions:
${JSON.stringify(compactAttractions)}

Return a JSON object with this exact structure:
{
  "city": string,
  "total_cost_estimate": number,
  "currency": string,
  "days": [
    {
      "day": number,
      "date_label": string,
      "cluster_area": string,
      "slots": [
        {
          "slot": "morning"|"afternoon"|"evening",
          "attraction_id": string,
          "attraction_name": string,
          "category": string,
          "estimated_cost": number,
          "duration_minutes": number,
          "coordinates": { "lat": number, "lng": number },
          "vibe_note": string
        }
      ],
      "day_cost_estimate": number
    }
  ]
}

Return ONLY the JSON object, no prose.
`;

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_completion_tokens: 1200,
  });

  const text = response.choices[0].message.content || '{}';

  try {
    return JSON.parse(text);
  } catch {
    console.error('reconcilerAgent parse error:', text);
    return {};
  }
}
