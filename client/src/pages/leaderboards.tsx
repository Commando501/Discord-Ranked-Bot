import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { Player } from "@shared/schema";
import { BotConfig } from '@shared/botConfig';
import { RankTier, getPlayerRank } from '@shared/rankSystem';
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
};

const getWinRate = (wins: number, losses: number) => {
    if (wins + losses === 0) return 0;
    return (wins / (wins + losses)) * 100;
};

export default function LeaderboardsPage() {
  const [rankTiers, setRankTiers] = useState<RankTier[]>([]);

  // Get configuration data
  const { data: configData, isLoading: isConfigLoading } = useQuery<BotConfig>({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error('Failed to fetch configuration');
      }
      return response.json();
    }
  });

  // Get top players data
  const { data: topPlayers, isLoading, refetch } = useQuery<Player[]>({
    queryKey: ['topPlayers'],
    queryFn: async () => {
      const response = await fetch('/api/players/top?limit=20');
      if (!response.ok) {
        throw new Error('Failed to fetch top players');
      }
      return response.json();
    }
  });

  // Effect to extract rank tiers from config
  useEffect(() => {
    if (configData && configData.seasonManagement && configData.seasonManagement.rankTiers) {
      setRankTiers(configData.seasonManagement.rankTiers);
    }
  }, [configData]);

  const handleRefresh = () => {
    refetch();
  };

  // Function to get MMR range for a rank tier
  const getRankTierRange = (tier: RankTier, allTiers: RankTier[]): string => {
    if (!tier) return "N/A";

    // Sort tiers by MMR threshold (ascending)
    const sortedTiers = [...allTiers].sort((a, b) => a.mmrThreshold - b.mmrThreshold);

    // Find the current tier index
    const currentTierIndex = sortedTiers.findIndex(t => t.name === tier.name);

    // If it's the highest tier (last in sorted array)
    if (currentTierIndex === sortedTiers.length - 1) {
      return `${tier.mmrThreshold}+`;
    }

    // Otherwise, show range from this tier's threshold to the next tier's threshold - 1
    const nextTierThreshold = sortedTiers[currentTierIndex + 1].mmrThreshold;
    return `${tier.mmrThreshold} - ${nextTierThreshold - 1}`;
  };

  // Helper function to ensure image path is correct
  const getRankIconUrl = (iconPath: string | undefined) => {
    if (!iconPath) return null;

    // If the path already starts with http, it's an external URL
    if (iconPath.startsWith('http')) {
      return iconPath;
    }

    // If it starts with a slash, it's already a root-relative path
    if (iconPath.startsWith('/')) {
      return iconPath;
    }

    // Otherwise, ensure it has a leading slash
    return `/${iconPath}`;
  };

  // Function to get player rank tier based on MMR
  const getPlayerRankTier = (mmr: number, tiers: RankTier[]): RankTier | undefined => {
    if (!tiers || tiers.length === 0) return undefined;
    return getPlayerRank(mmr, tiers);
  };

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-white">Leaderboards</h1>
            <p className="text-[#B9BBBE]">View player rankings and statistics.</p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Players</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Loading player data...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">MMR</TableHead>
                      <TableHead className="text-right">W/L</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPlayers?.map((player, index) => {
                      const rankTier = getPlayerRankTier(player.mmr, rankTiers);
                      const winRate = player.wins + player.losses > 0
                        ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
                        : "0.0";

                      return (
                        <TableRow key={player.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage src={player.avatar ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar}.png` : undefined} alt={player.username} />
                                <AvatarFallback className="bg-[#5865F2] text-white text-xs">{getInitials(player.username)}</AvatarFallback>
                              </Avatar>
                              <span>{player.username}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {rankTier?.icon && (
                                <img 
                                  src={getRankIconUrl(rankTier.icon)} 
                                  alt={rankTier.name}
                                  className="h-6 w-6 object-contain"
                                  onError={(e) => {
                                    // Try alternative casing if the first attempt fails
                                    const originalSrc = (e.target as HTMLImageElement).src;
                                    console.error("Failed to load image:", originalSrc);

                                    // Try lowercase version of the file
                                    if (originalSrc.includes('/ranks/')) {
                                      const pathParts = originalSrc.split('/ranks/');
                                      const filename = pathParts[1];
                                      const lowercaseFilename = filename.toLowerCase();
                                      if (filename !== lowercaseFilename) {
                                        console.log("Trying lowercase version:", lowercaseFilename);
                                        (e.target as HTMLImageElement).src = `${pathParts[0]}/ranks/${lowercaseFilename}`;
                                        return;
                                      }
                                    }

                                    // Hide the image if all attempts fail
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              )}
                              <span style={{ color: rankTier?.color || 'inherit' }}>
                                {rankTier?.name || 'Unranked'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{player.mmr}</TableCell>
                          <TableCell className="text-right">{player.wins}/{player.losses}</TableCell>
                          <TableCell className="text-right">{winRate}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rank Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              {isConfigLoading ? (
                <p>Loading rank tier data...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier</TableHead>
                      <TableHead>MMR Range</TableHead>
                      <TableHead>Icon</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankTiers
                      .sort((a, b) => b.mmrThreshold - a.mmrThreshold)
                      .map((tier) => (
                        <TableRow key={tier.name}>
                          <TableCell>
                            <span style={{ color: tier.color || 'inherit' }}>
                              {tier.name}
                            </span>
                          </TableCell>
                          <TableCell>{getRankTierRange(tier, rankTiers)}</TableCell>
                          <TableCell>
                            {tier.icon ? (
                              <img 
                                src={getRankIconUrl(tier.icon)}
                                alt={tier.name}
                                className="h-8 w-8 object-contain"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  const originalSrc = img.src;
                                  console.error("Failed to load image:", originalSrc);

                                  // Extract the path parts
                                  const urlObj = new URL(originalSrc);
                                  const path = urlObj.pathname;

                                  // Try multiple approaches to fix the path
                                  const attempts = [];

                                  // 1. Try lowercase filename
                                  if (path.includes('/ranks/')) {
                                    const basePath = path.substring(0, path.lastIndexOf('/') + 1);
                                    const filename = path.substring(path.lastIndexOf('/') + 1);
                                    const lowercaseFilename = filename.toLowerCase();

                                    if (filename !== lowercaseFilename) {
                                      attempts.push(`${urlObj.origin}${basePath}${lowercaseFilename}`);
                                    }

                                    // 2. Try alternative extensions
                                    if (filename.endsWith('.png')) {
                                      // Try PNG extension (uppercase)
                                      const altExtension = filename.replace(/\.png$/i, '.PNG');
                                      attempts.push(`${urlObj.origin}${basePath}${altExtension}`);

                                      // Try without extension
                                      const noExtension = filename.replace(/\.png$/i, '');
                                      attempts.push(`${urlObj.origin}${basePath}${noExtension}`);
                                    } else if (!filename.includes('.')) {
                                      // No extension in original, try adding one
                                      attempts.push(`${urlObj.origin}${basePath}${filename}.png`);
                                      attempts.push(`${urlObj.origin}${basePath}${filename}.PNG`);
                                    }

                                    // 3. Try direct path to public folder (no /client/public)
                                    if (path.includes('/client/public/')) {
                                      const fixedPath = path.replace('/client/public/', '/');
                                      attempts.push(`${urlObj.origin}${fixedPath}`);
                                    }
                                  }

                                  // Try each alternative path
                                  let attemptIndex = 0;
                                  const tryNextPath = () => {
                                    if (attemptIndex < attempts.length) {
                                      console.log(`Trying alternative path (${attemptIndex + 1}/${attempts.length}):`, attempts[attemptIndex]);
                                      img.src = attempts[attemptIndex];
                                      attemptIndex++;
                                    } else {
                                      // If all attempts failed, show a placeholder or hide
                                      console.error("All image loading attempts failed for", tier.name);
                                      img.style.display = 'none';
                                    }
                                  };

                                  // Start trying alternative paths
                                  img.onerror = tryNextPath;
                                  tryNextPath();
                                }}
                              />
                            ) : (
                              <span className="text-gray-400">No icon</span>
                            )}
                          </TableCell>
                          <TableCell>{tier.description}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}