import groq from '../lib/groq';
import type { UserProfile } from '@vibetrip/shared/types/userProfile';

export async function budgetAgent(userProfile: UserProfile, vibeAgentOutput: any[]) {
  const arrivalDate = new Date(userProfile.arrivalDate!);
  const departureDate = new Date(userProfile.departureDate!);
  const effectiveDays = Math.ceil(
    (departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const prompt = `
You are a travel budget optimizer. Your only job is to make sure the traveller's money is well distributed across their trip.

Rules:
- Divide the total budget across the number of days
- Account for pace: relaxed = fewer activities, moderate = standard, fast = more activities
- Allocate roughly: 40% experiences, 30% food, 20% transport, 10% buffer
- Flag any attraction where avg_cost exceeds 20% of the daily budget

User profile:
${JSON.stringify(userProfile, null, 2)}

Effective days: ${effectiveDays}

Vibe agent output:
${JSON.stringify(vibeAgentOutput, null, 2)}

Return a JSON object with this structure:
{
  "daily_budget_cap": number,
  "category_allocation": {
    "experiences": number,
    "food": number,
    "transport": number,
    "buffer": number
  },
  "flagged_expensive": [
    {
      "attraction_id": string,
      "avg_cost": number,
      "reason": string
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
    console.error('budgetAgent parse error:', text);
    return {};
  }
}