import groq, { GROQ_MODEL } from '../lib/groq';
import { UserProfile } from '@vibetrip/shared/types/userProfile';
import {
  compactAttractionsForPrompt,
  compactLogisticsOutputForPrompt,
  compactUserProfileForPrompt,
} from './promptData';

export async function diversityAgent(userProfile: UserProfile, logisticsAgentOutput: any[], attractions: any[]) {
  const maxAttractions = Number(process.env.AGENT_ATTRACTION_LIMIT ?? 30);
  const compactProfile = compactUserProfileForPrompt(userProfile);
  const compactLogisticsOutput = compactLogisticsOutputForPrompt(logisticsAgentOutput);
  const compactAttractions = compactAttractionsForPrompt(attractions, maxAttractions);

  const prompt = `
You are a travel experience curator. Your only job is to make sure the trip is not repetitive.

Rules:
- Check each day's cluster for category repetition (e.g. three temples in one day is too much)
- Flag any day where more than 50% of activities share the same category
- Suggest one replacement attraction per flagged day from a different category
- Respect the vibe profile when suggesting replacements (do not suggest nightlife to a culture_nerd)
- If the plan is already diverse, return an empty suggestions array

User profile:
${JSON.stringify(compactProfile)}

Logistics agent output:
${JSON.stringify(compactLogisticsOutput)}

Attractions with categories:
${JSON.stringify(compactAttractions)}

Return a JSON object with this structure:
{
  "diverse": boolean,
  "flagged_days": [
    {
      "day": number,
      "issue": string,
      "suggested_replacement": {
        "remove_attraction_id": string,
        "add_attraction_id": string,
        "reason": string
      }
    }
  ]
}

Return ONLY the JSON object, no prose.
`;

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_completion_tokens: 800,
  });

  const text = response.choices[0].message.content || '{}';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);  } catch {
    console.error('diversityAgent parse error:', text);
    return { diverse: true, flagged_days: [] };
  }
}
