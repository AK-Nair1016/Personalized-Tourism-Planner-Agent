import { UserProfile } from '@vibetrip/shared/types/userProfile';
import { DayCluster } from './clusterByProximity';

export interface DiversityOutput {
  diverse: boolean;
  adjustedClusters: DayCluster[];
  flaggedDays: {
    day: number;
    issue: string;
    suggestedReplacement: {
      removeAttractionId: string;
      addAttractionId: string;
      reason: string;
    } | null;
  }[];
}

// vibe to category mapping — used to find replacements that fit the user's personality
const VIBE_CATEGORY_MAP: Record<string, string[]> = {
  adventurer: ['outdoor', 'adventure', 'sports', 'nature'],
  foodie: ['restaurant', 'food', 'market', 'cafe'],
  culture_nerd: ['museum', 'temple', 'history', 'heritage', 'landmark'],
  slow_traveller: ['park', 'cafe', 'neighbourhood', 'garden'],
  night_owl: ['nightlife', 'bar', 'rooftop', 'entertainment'],
  budget_explorer: ['free', 'park', 'market', 'street'],
};

function getCategoryFrequency(slots: DayCluster['slots'], attractions: any[]): Record<string, number> {
  const freq: Record<string, number> = {};
  slots.forEach(slot => {
    const attraction = attractions.find(a => a.id === slot.attractionId);
    if (attraction?.category?.name) {
      const cat = attraction.category.name.toLowerCase();
      freq[cat] = (freq[cat] || 0) + 1;
    }
  });
  return freq;
}

function findReplacementAttraction(
  userProfile: UserProfile,
  currentCluster: DayCluster,
  allAttractions: any[],
  overRepresentedCategory: string
): any | null {
  // get attraction IDs already in the cluster
  const usedIds = currentCluster.slots.map(s => s.attractionId);

  // get categories that match user's vibe
  const vibeCategories = userProfile.vibe
    .flatMap(v => VIBE_CATEGORY_MAP[v] || []);

  // find an unused attraction in a different category that fits the vibe
  return allAttractions.find(a => {
    const cat = a.category?.name?.toLowerCase() || '';
    return (
      !usedIds.includes(a.id) &&
      cat !== overRepresentedCategory &&
      (vibeCategories.length === 0 || vibeCategories.some(vc => cat.includes(vc)))
    );
  }) || null;
}

export function ensureDiversity(
  userProfile: UserProfile,
  clusters: DayCluster[],
  attractions: any[]
): DiversityOutput {
  const flaggedDays: DiversityOutput['flaggedDays'] = [];
  const adjustedClusters = clusters.map(cluster => ({ ...cluster, slots: [...cluster.slots] }));

  for (const cluster of adjustedClusters) {
    const freq = getCategoryFrequency(cluster.slots, attractions);
    const totalSlots = cluster.slots.length;

    // find any category that exceeds 50% of slots
    const overRepresented = Object.entries(freq).find(
      ([, count]) => count / totalSlots > 0.5
    );

    if (overRepresented) {
      const [category] = overRepresented;
      const replacement = findReplacementAttraction(userProfile, cluster, attractions, category);

      if (replacement) {
        // find the last slot with the over-represented category and replace it
        const slotToReplace = [...cluster.slots]
          .reverse()
          .find(slot => {
            const a = attractions.find(a => a.id === slot.attractionId);
            return a?.category?.name?.toLowerCase() === category;
          });

        if (slotToReplace) {
          slotToReplace.attractionId = replacement.id;
          flaggedDays.push({
            day: cluster.day,
            issue: `More than 50% of activities are ${category}`,
            suggestedReplacement: {
              removeAttractionId: slotToReplace.attractionId,
              addAttractionId: replacement.id,
              reason: `Added ${replacement.category?.name} to improve variety`,
            },
          });
        }
      } else {
        flaggedDays.push({
          day: cluster.day,
          issue: `More than 50% of activities are ${category} but no replacement found`,
          suggestedReplacement: null,
        });
      }
    }
  }

  return {
    diverse: flaggedDays.length === 0,
    adjustedClusters,
    flaggedDays,
  };
}