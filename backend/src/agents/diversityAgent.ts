import groq from '../lib/groq';
import { UserProfile } from '@vibetrip/shared/types/userProfile';

export async function diversityAgent(userProfile: UserProfile, logisticsAgentOutput: any[], attractions: any[]) {
  const prompt = `
You are a travel experience curator. Your only job is to make sure the trip is not repetitive.

Rules:
- Check each day's cluster for category repetition (e.g. three temples in one day is too much)
- Flag any day where more than 50% of activities share the same category
- Suggest one replacement attraction per flagged day from a different category
- Respect the vibe profile when suggesting replacements (do not suggest nightlife to a culture_nerd)
- If the plan is already diverse, return an empty suggestions array

User profile:
${JSON.stringify(userProfile, null, 2)}

Logistics agent output:
${JSON.stringify(logisticsAgentOutput, null, 2)}

Attractions with categories:
${JSON.stringify(attractions, null, 2)}

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
    model: 'llama3-8b-8192',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  const text = response.choices[0].message.content || '{}';

  try {
    return JSON.parse(text);
  } catch {
    console.error('diversityAgent parse error:', text);
    return { diverse: true, flagged_days: [] };
  }
}