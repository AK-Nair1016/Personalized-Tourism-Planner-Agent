import groq from '../lib/groq';
import type { UserProfile } from '@vibetrip/shared/types/userProfile';

export async function logisticsAgent(userProfile: UserProfile, vibeAgentOutput: any[], attractions: any[]) {
  const arrivalDate = new Date(userProfile.arrivalDate!);
  const departureDate = new Date(userProfile.departureDate!);
  const effectiveDays = Math.ceil(
    (departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const arrivalHour = parseInt(userProfile.arrivalTime!.split(':')[0]);
  const departureHour = parseInt(userProfile.departureTime!.split(':')[0]);

  const day1StartSlot =
    arrivalHour < 12 ? 'morning' : arrivalHour < 17 ? 'afternoon' : 'evening';

  const lastDayEndSlot =
    departureHour < 10 ? 'none' : departureHour < 14 ? 'morning' : 'morning+afternoon';

  const prompt = `
You are a travel logistics planner. Your only job is to group and order attractions to minimize wasted travel time each day.

Rules:
- Group attractions geographically into clusters, one cluster per day
- Within each cluster, order attractions to minimize backtracking
- Use morning/afternoon/evening slots (3 slots for relaxed, 4 for moderate, 5 for fast)
- Never put attractions from opposite ends of the city in the same day
- If a must_visit attraction exists, anchor that day's cluster around its location

User profile:
${JSON.stringify(userProfile, null, 2)}

Effective days: ${effectiveDays}
Day 1 start slot: ${day1StartSlot}
Last day end slot: ${lastDayEndSlot}

Vibe agent output:
${JSON.stringify(vibeAgentOutput, null, 2)}

Attractions with coordinates:
${JSON.stringify(attractions, null, 2)}

Return a JSON array with this structure:
[
  {
    "day": 1,
    "cluster_center": string,
    "slots": [
      {
        "slot": "morning"|"afternoon"|"evening",
        "attraction_id": string
      }
    ]
  }
]

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
    console.error('logisticsAgent parse error:', text);
    return [];
  }
}