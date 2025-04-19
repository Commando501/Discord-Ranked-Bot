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
  const [rankDistribution, setRankDistribution] = useState<{rank: string, count: number, percentage: number}[]>([]);
  const [highestWinRatePlayers, setHighestWinRatePlayers] = useState<Player[]>([]);

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

  // Get all players for rank distribution and win rate calculation
  const { data: allPlayers, isLoading: isLoadingAllPlayers } = useQuery<Player[]>({
    queryKey: ['allPlayers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/players');
      if (!response.ok) {
        throw new Error('Failed to fetch all players');
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

  // Effect to calculate rank distribution
  useEffect(() => {
    if (rankTiers.length > 0 && allPlayers && allPlayers.length > 0) {
      // Sort tiers by MMR threshold (ascending)
      const sortedTiers = [...rankTiers].sort((a, b) => a.mmrThreshold - b.mmrThreshold);
      
      // Initialize counts
      const distribution = sortedTiers.map(tier => ({
        rank: tier.name,
        count: 0,
        percentage: 0,
        color: tier.color || '#ffffff'
      }));
      
      // Count players in each rank
      allPlayers.forEach(player => {
        const playerRank = getPlayerRank(player.mmr, sortedTiers);
        if (playerRank) {
          const rankIndex = distribution.findIndex(d => d.rank === playerRank.name);
          if (rankIndex >= 0) {
            distribution[rankIndex].count++;
          }
        }
      });
      
      // Calculate percentages
      distribution.forEach(item => {
        item.percentage = Math.round((item.count / allPlayers.length) * 100);
      });
      
      setRankDistribution(distribution);
    }
  }, [rankTiers, allPlayers]);

  // Effect to calculate highest win rate players
  useEffect(() => {
    if (allPlayers && allPlayers.length > 0) {
      // Filter players with at least 5 games played
      const playersWithGames = allPlayers.filter(player => 
        (player.wins + player.losses) >= 5
      );
      
      // Sort by win rate
      const sortedByWinRate = [...playersWithGames].sort((a, b) => {
        const winRateA = a.wins / (a.wins + a.losses);
        const winRateB = b.wins / (b.wins + b.losses);
        return winRateB - winRateA;
      });
      
      setHighestWinRatePlayers(sortedByWinRate.slice(0, 10));
    }
  }, [allPlayers]);

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

    // Clean up path: remove any client/public prefix if present
    let cleanPath = iconPath;
    if (cleanPath.includes('client/public/')) {
      cleanPath = cleanPath.replace('client/public/', '');
    }

    // Ensure path starts with / 
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    return cleanPath;
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
                                    const img = e.target as HTMLImageElement;
                                    const originalSrc = img.src;
                                    console.error("Failed to load image:", originalSrc);
                                    
                                    // Create direct paths to try
                                    const attempts = [];
                                    
                                    // Extract the tier name and try direct paths
                                    const tierName = rankTier.name.replace(/\s+/g, '');
                                    attempts.push(`/ranks/${tierName}.png`);
                                    attempts.push(`/ranks/${tierName.toLowerCase()}.png`);
                                    
                                    // Try with separate rank and number
                                    if (rankTier.name.includes(' ')) {
                                      const [rank, number] = rankTier.name.split(' ');
                                      attempts.push(`/ranks/${rank}${number}.png`);
                                      attempts.push(`/ranks/${rank.toLowerCase()}${number}.png`);
                                      attempts.push(`/ranks/${rank}${number}.PNG`);
                                    }
                                    
                                    // Try each alternative path
                                    let attemptIndex = 0;
                                    const tryNextPath = () => {
                                      if (attemptIndex < attempts.length) {
                                        console.log(`Trying rank icon path (${attemptIndex + 1}/${attempts.length}):`, attempts[attemptIndex]);
                                        img.src = attempts[attemptIndex];
                                        attemptIndex++;
                                      } else {
                                        // Just hide the image if all attempts fail
                                        img.style.display = 'none';
                                      }
                                    };

                                    // Start trying alternative paths
                                    img.onerror = tryNextPath;
                                    tryNextPath();
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
              <CardTitle>Highest Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAllPlayers ? (
                <p>Loading win rate data...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Games</TableHead>
                      <TableHead className="text-right">W/L</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {highestWinRatePlayers?.map((player, index) => {
                      const rankTier = getPlayerRankTier(player.mmr, rankTiers);
                      const totalGames = player.wins + player.losses;
                      const winRate = totalGames > 0
                        ? ((player.wins / totalGames) * 100).toFixed(1)
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
                                    const img = e.target as HTMLImageElement;
                                    const originalSrc = img.src;
                                    console.error("Failed to load image:", originalSrc);
                                    
                                    // Create direct paths to try
                                    const attempts = [];
                                    
                                    // Extract the tier name and try direct paths
                                    const tierName = rankTier.name.replace(/\s+/g, '');
                                    attempts.push(`/ranks/${tierName}.png`);
                                    attempts.push(`/ranks/${tierName.toLowerCase()}.png`);
                                    
                                    // Try with separate rank and number
                                    if (rankTier.name.includes(' ')) {
                                      const [rank, number] = rankTier.name.split(' ');
                                      attempts.push(`/ranks/${rank}${number}.png`);
                                      attempts.push(`/ranks/${rank.toLowerCase()}${number}.png`);
                                      attempts.push(`/ranks/${rank}${number}.PNG`);
                                    }
                                    
                                    // Try each alternative path
                                    let attemptIndex = 0;
                                    const tryNextPath = () => {
                                      if (attemptIndex < attempts.length) {
                                        console.log(`Trying rank icon path (${attemptIndex + 1}/${attempts.length}):`, attempts[attemptIndex]);
                                        img.src = attempts[attemptIndex];
                                        attemptIndex++;
                                      } else {
                                        // Just hide the image if all attempts fail
                                        img.style.display = 'none';
                                      }
                                    };

                                    // Start trying alternative paths
                                    img.onerror = tryNextPath;
                                    tryNextPath();
                                  }}
                                />
                              )}
                              <span style={{ color: rankTier?.color || 'inherit' }}>
                                {rankTier?.name || 'Unranked'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{totalGames}</TableCell>
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
              <CardTitle>Rank Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAllPlayers ? (
                <p>Loading rank distribution data...</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Enhanced rank distribution bar chart */}
                    <div className="h-72 relative bg-black/5 dark:bg-white/5 rounded-lg p-4 backdrop-blur-sm">
                      <h3 className="text-sm font-medium mb-3 text-muted-foreground">Player Distribution</h3>
                      {rankDistribution.length > 0 ? (
                        <div className="flex items-end h-[calc(100%-30px)] gap-1 overflow-x-hidden">
                          {rankDistribution
                            .sort((a, b) => {
                              // Find tiers by name
                              const tierA = rankTiers.find(t => t.name === a.rank);
                              const tierB = rankTiers.find(t => t.name === b.rank);
                              // Sort by MMR threshold if found
                              return (tierA?.mmrThreshold || 0) - (tierB?.mmrThreshold || 0);
                            })
                            .map((item, index) => {
                              const tier = rankTiers.find(t => t.name === item.rank);
                              const color = tier?.color || '#6f7280';
                              // Calculate a lighter version of the color for gradient
                              const lighterColor = color.replace(
                                /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i, 
                                (_, r, g, b) => {
                                  // Convert hex to rgb, lighten, and back to hex
                                  const lightenHex = (hex: string) => {
                                    const num = parseInt(hex, 16);
                                    const lightened = Math.min(255, Math.round(num * 1.4)).toString(16).padStart(2, '0');
                                    return lightened;
                                  };
                                  return `#${lightenHex(r)}${lightenHex(g)}${lightenHex(b)}`;
                                }
                              );
                              
                              // Determine how many tiers there are to adjust spacing
                              const totalTiers = rankDistribution.length;
                              // If we have more than 8 tiers, adjust sizing to prevent overflow
                              const isCompact = totalTiers > 8;
                              
                              return (
                                <div 
                                  key={item.rank} 
                                  className={`flex-1 ${isCompact ? 'mx-0.5' : 'mx-1'} flex flex-col items-center justify-end group`}
                                  style={{ minWidth: isCompact ? '28px' : '32px' }}
                                >
                                  <div className="absolute top-12 text-xs px-3 py-2 pointer-events-none bg-background/95 border shadow-md opacity-0 group-hover:opacity-100 transition-all rounded-md z-10 text-center transform -translate-y-2 group-hover:translate-y-0 duration-200">
                                    <div className="font-bold" style={{ color }}>{item.rank}</div>
                                    <div className="font-mono">{item.count} players</div>
                                    <div className="text-muted-foreground">{item.percentage}% of playerbase</div>
                                  </div>
                                  <div 
                                    className="w-full rounded-md transition-all duration-300 ease-in-out group-hover:transform group-hover:scale-105 shadow-sm"
                                    style={{ 
                                      height: `${Math.max(5, (item.percentage || 1) * 2)}%`, 
                                      background: `linear-gradient(to top, ${color}, ${lighterColor})`,
                                    }}
                                  ></div>
                                  <div className="flex flex-col items-center justify-center mt-2 h-10">
                                    {tier?.icon && (
                                      <img 
                                        src={getRankIconUrl(tier.icon)} 
                                        alt={tier.name}
                                        className="h-5 w-5 object-contain mb-1"
                                        onError={(e) => {
                                          const img = e.target as HTMLImageElement;
                                          img.style.display = 'none';
                                        }}
                                      />
                                    )}
                                    <div className="text-xs font-medium truncate w-full text-center" style={{ 
                                      maxWidth: isCompact ? '32px' : '40px',
                                      fontSize: isCompact ? '0.65rem' : '0.75rem' 
                                    }}>
                                      {item.rank}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-400">No rank distribution data available</p>
                        </div>
                      )}
                    </div>

                    {/* Enhanced rank distribution table */}
                    <div className="bg-black/5 dark:bg-white/5 rounded-lg p-4 backdrop-blur-sm">
                      <h3 className="text-sm font-medium mb-3 text-muted-foreground">Detailed Breakdown</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead className="text-right">Players</TableHead>
                            <TableHead className="text-right">Percentage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankDistribution
                            .sort((a, b) => {
                              // Find tiers by name
                              const tierA = rankTiers.find(t => t.name === a.rank);
                              const tierB = rankTiers.find(t => t.name === b.rank);
                              // Sort by MMR threshold descending
                              return (tierB?.mmrThreshold || 0) - (tierA?.mmrThreshold || 0);
                            })
                            .map((item) => {
                              const tier = rankTiers.find(t => t.name === item.rank);
                              return (
                                <TableRow key={item.rank} className="hover:bg-background/40 transition-colors">
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {tier?.icon && (
                                        <img 
                                          src={getRankIconUrl(tier.icon)} 
                                          alt={tier.name}
                                          className="h-5 w-5 object-contain"
                                          onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            img.style.display = 'none';
                                          }}
                                        />
                                      )}
                                      <span className="font-medium" style={{ color: tier?.color || 'inherit' }}>
                                        {item.rank}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono">{item.count}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <div 
                                        className="h-2 rounded-full opacity-75"
                                        style={{ 
                                          width: `${Math.max(5, item.percentage)}%`, 
                                          backgroundColor: tier?.color || '#6f7280',
                                        }}
                                      ></div>
                                      <span className="font-mono">{item.percentage}%</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  
                  {/* Pyramid visualization of rank distribution */}
                  <div className="bg-black/5 dark:bg-white/5 rounded-lg p-4 backdrop-blur-sm mt-6">
                    <h3 className="text-sm font-medium mb-3 text-muted-foreground">Rank Pyramid</h3>
                    <div className="flex justify-center">
                      <div className="w-full max-w-md">
                        {rankDistribution
                          .sort((a, b) => {
                            // Find tiers by name
                            const tierA = rankTiers.find(t => t.name === a.rank);
                            const tierB = rankTiers.find(t => t.name === b.rank);
                            // Sort by MMR threshold descending (highest rank first)
                            return (tierB?.mmrThreshold || 0) - (tierA?.mmrThreshold || 0);
                          })
                          .map((item, index, array) => {
                            const tier = rankTiers.find(t => t.name === item.rank);
                            // Calculate width percentage based on position in the pyramid
                            const widthPercentage = 40 + ((index / (array.length - 1)) * 60);
                            
                            return (
                              <div 
                                key={item.rank} 
                                className="flex items-center justify-center mb-1 mx-auto transition-all duration-200 hover:transform hover:scale-[1.02] rounded-sm overflow-hidden"
                                style={{ width: `${widthPercentage}%` }}
                              >
                                <div 
                                  className="w-full py-1.5 px-3 flex items-center justify-between"
                                  style={{ 
                                    backgroundColor: tier?.color || '#6f7280',
                                    color: '#ffffff',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    {tier?.icon && (
                                      <img 
                                        src={getRankIconUrl(tier.icon)} 
                                        alt={tier.name}
                                        className="h-5 w-5 object-contain"
                                        onError={(e) => {
                                          const img = e.target as HTMLImageElement;
                                          img.style.display = 'none';
                                        }}
                                      />
                                    )}
                                    <span className="text-xs font-bold">{item.rank}</span>
                                  </div>
                                  <span className="text-xs font-mono">{item.percentage}%</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
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
                                  
                                  // Create direct paths to try
                                  const attempts = [];
                                  
                                  // Extract filename
                                  const filename = originalSrc.substring(originalSrc.lastIndexOf('/') + 1);
                                  const filenameWithoutExt = filename.replace(/\.[^/.]+$/, "");
                                  const urlBase = originalSrc.substring(0, originalSrc.lastIndexOf('/') + 1);
                                  
                                  // Try direct paths with different extensions and casing
                                  attempts.push(`/ranks/${filenameWithoutExt}.png`);
                                  attempts.push(`/ranks/${filenameWithoutExt}.PNG`);
                                  attempts.push(`/ranks/${filenameWithoutExt.toLowerCase()}.png`);
                                  attempts.push(`/ranks/${filenameWithoutExt.toUpperCase()}.png`);
                                  
                                  // Try just the filename without path prefix
                                  const tierName = tier.name.replace(/\s+/g, '');
                                  attempts.push(`/ranks/${tierName}.png`);
                                  attempts.push(`/ranks/${tierName.toLowerCase()}.png`);
                                  
                                  // Try exact name matches
                                  if (tier.name.includes(' ')) {
                                    const [rank, number] = tier.name.split(' ');
                                    attempts.push(`/ranks/${rank}${number}.png`);
                                    attempts.push(`/ranks/${rank.toLowerCase()}${number}.png`);
                                    attempts.push(`/ranks/${rank}${number}.PNG`);
                                  }
                                  
                                  console.log(`Attempting to load ${tier.name} icon with ${attempts.length} different paths`);
                                  
                                  // Try each alternative path
                                  let attemptIndex = 0;
                                  const tryNextPath = () => {
                                    if (attemptIndex < attempts.length) {
                                      console.log(`Trying (${attemptIndex + 1}/${attempts.length}):`, attempts[attemptIndex]);
                                      img.src = attempts[attemptIndex];
                                      attemptIndex++;
                                    } else {
                                      // If all attempts failed, show placeholder text
                                      console.error("All image loading attempts failed for", tier.name);
                                      const placeholderText = document.createTextNode(tier.name.charAt(0));
                                      img.parentNode?.insertBefore(placeholderText, img);
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