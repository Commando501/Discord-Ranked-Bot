import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { Player } from "@shared/schema";
import { BotConfig } from '@shared/botConfig';
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


interface RankTier {
  name: string;
  minMmr: number;
  maxMmr: number;
  color: string;
  icon?: string;
}

const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
};

const getWinRate = (wins: number, losses: number) => {
    if (wins + losses === 0) return 0;
    return (wins / (wins + losses)) * 100;
};

export default function LeaderboardsPage() {
  const [rankTiers, setRankTiers] = useState<RankTier[]>([]);

  // Function to get player rank tier based on MMR
  const getPlayerRankTier = (mmr: number): RankTier | undefined => {
    return rankTiers.find(tier => mmr >= tier.minMmr && mmr <= tier.maxMmr);
  };

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
                      const rankTier = getPlayerRankTier(player.mmr);
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
                                    console.error("Failed to load image:", rankTier.icon);
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankTiers.map((tier) => (
                      <TableRow key={tier.name}>
                        <TableCell>
                          <span style={{ color: tier.color || 'inherit' }}>
                            {tier.name}
                          </span>
                        </TableCell>
                        <TableCell>{tier.minMmr} - {tier.maxMmr}</TableCell>
                        <TableCell>
                          {tier.icon ? (
                            <img 
                              src={getRankIconUrl(tier.icon)}
                              alt={tier.name}
                              className="h-8 w-8 object-contain"
                              onError={(e) => {
                                console.error("Failed to load image:", tier.icon);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-gray-400">No icon</span>
                          )}
                        </TableCell>
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