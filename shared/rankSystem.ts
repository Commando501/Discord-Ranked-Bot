
import { z } from "zod";

// Define the schema for a rank tier
export const rankTierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mmrThreshold: z.number().int().min(0, "MMR threshold must be at least 0"),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color code"),
  icon: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  imagePath: z.string().optional(),
});

// Define the type for a rank tier
export type RankTier = z.infer<typeof rankTierSchema>;

// Default rank tiers that will be used if none are configured
export const defaultRankTiers: RankTier[] = [
  {
    name: "Bronze",
    mmrThreshold: 0,
    color: "#B9BBBE",
    description: "Beginning of your competitive journey"
  },
  {
    name: "Silver",
    mmrThreshold: 1000,
    color: "#5865F2",
    description: "Climbing the ladder"
  },
  {
    name: "Gold",
    mmrThreshold: 1500,
    color: "#3BA55C",
    description: "Skilled competitor"
  },
  {
    name: "Platinum",
    mmrThreshold: 2000,
    color: "#FAA61A",
    description: "Elite player"
  },
  {
    name: "Diamond",
    mmrThreshold: 2500,
    color: "#ED4245",
    description: "Top tier player"
  }
];

// Function to get a player's rank based on MMR and configured rank tiers
export function getPlayerRank(mmr: number, tiers: RankTier[]): RankTier {
  // If no tiers are defined, use the defaults
  const ranksToUse = tiers.length === 0 ? defaultRankTiers : tiers;
  
  // Sort tiers by MMR threshold (highest first)
  const sortedTiers = [...ranksToUse].sort((a, b) => b.mmrThreshold - a.mmrThreshold);
  
  // Find the first tier where the player's MMR is greater than or equal to the threshold
  for (const tier of sortedTiers) {
    if (mmr >= tier.mmrThreshold) {
      return tier;
    }
  }
  
  // If no tier is found (shouldn't happen with default tiers), return the lowest tier
  return sortedTiers[sortedTiers.length - 1];
}

// Function to get the progress to the next rank (as a percentage)
export function getProgressToNextRank(mmr: number, tiers: RankTier[]): number {
  // If there are less than 2 tiers, return 100% (no progression possible)
  if (tiers.length < 2) return 100;
  
  // Sort tiers by MMR threshold (ascending)
  const sortedTiers = [...tiers].sort((a, b) => a.mmrThreshold - b.mmrThreshold);
  
  // Find the current tier and the next tier
  let currentTier: RankTier | null = null;
  let nextTier: RankTier | null = null;
  
  for (let i = 0; i < sortedTiers.length; i++) {
    if (mmr >= sortedTiers[i].mmrThreshold) {
      currentTier = sortedTiers[i];
      nextTier = sortedTiers[i + 1] || null;
    }
  }
  
  // If at the highest tier or no current tier found, return 100%
  if (!currentTier || !nextTier) return 100;
  
  // Calculate progress percentage
  const rangeSize = nextTier.mmrThreshold - currentTier.mmrThreshold;
  const progress = mmr - currentTier.mmrThreshold;
  
  return Math.min(Math.round((progress / rangeSize) * 100), 100);
}
