
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/components/layout/app-layout';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Player {
  id: string;
  discordId: string;
  username: string;
  mmr: number;
  wins: number;
  losses: number;
  rank?: string;
  avatarUrl?: string;
}

interface RankTier {
  id: string;
  name: string;
  minMmr: number;
  maxMmr: number;
  color: string;
  description: string;
  iconPath?: string;
}

// Function to fetch rank tiers moved before its first usage
function getRankTiers() {
  return fetch('/api/rank-tiers')
    .then(res => res.json())
    .catch(err => {
      console.error('Error fetching rank tiers:', err);
      return [];
    });
}

function getRankTierByMmr(mmr: number, tiers: RankTier[]): RankTier | undefined {
  if (!tiers || tiers.length === 0) return undefined;
  
  return tiers.find(tier => mmr >= tier.minMmr && mmr <= tier.maxMmr);
}

function getRankTierRange(tier: RankTier | undefined): string {
  if (!tier) return 'Unranked';
  return `${tier.minMmr} - ${tier.maxMmr}`;
}

function getRankIconUrl(tier: RankTier | undefined): string {
  if (!tier || !tier.iconPath) return '';
  
  // Path resolution logic based on patch history fixes
  let iconPath = tier.iconPath;
  if (!iconPath.startsWith('/')) {
    iconPath = `/client/public/ranks/${iconPath}`;
  }
  console.log('Resolved icon path:', iconPath);
  return iconPath;
}

function LeaderboardsPage() {
  const [sortField, setSortField] = useState<keyof Player>('mmr');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const { data: players = [], isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: () => fetch('/api/players?includeRank=true').then(res => res.json()),
  });
  
  const { data: rankTiers = [] } = useQuery<RankTier[]>({
    queryKey: ['rankTiers'],
    queryFn: getRankTiers,
  });

  const handleSort = (field: keyof Player) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedPlayers = [...players].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    
    return 0;
  });

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2 text-white">Leaderboards</h1>
          <p className="text-[#B9BBBE]">View player rankings and statistics for the current season.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="bg-[#2F3136] border-[#202225]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Total Players</CardTitle>
              <CardDescription>Active players this season</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{players.length}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-[#2F3136] border-[#202225]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Average MMR</CardTitle>
              <CardDescription>Among all players</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">
                {players.length > 0 
                  ? Math.round(players.reduce((sum, player) => sum + player.mmr, 0) / players.length) 
                  : 0}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-[#2F3136] border-[#202225]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Top Player</CardTitle>
              <CardDescription>Highest MMR player</CardDescription>
            </CardHeader>
            <CardContent>
              {players.length > 0 ? (
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={players[0].avatarUrl} />
                    <AvatarFallback>{players[0].username.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-white font-medium">{players[0].username}</p>
                    <p className="text-sm text-[#B9BBBE]">{players[0].mmr} MMR</p>
                  </div>
                </div>
              ) : (
                <p className="text-[#B9BBBE]">No players yet</p>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-[#2F3136] border-[#202225]">
              <CardHeader>
                <CardTitle className="text-white">Player Rankings</CardTitle>
                <CardDescription>Sorted by MMR</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative w-full overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-[#36393F] border-[#40444b]">
                        <TableHead className="text-[#B9BBBE] w-[60px]">#</TableHead>
                        <TableHead 
                          className="text-[#B9BBBE] cursor-pointer"
                          onClick={() => handleSort('username')}
                        >
                          Player
                          {sortField === 'username' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                        <TableHead 
                          className="text-[#B9BBBE] cursor-pointer text-right"
                          onClick={() => handleSort('mmr')}
                        >
                          MMR
                          {sortField === 'mmr' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                        <TableHead 
                          className="text-[#B9BBBE] cursor-pointer text-right"
                          onClick={() => handleSort('wins')}
                        >
                          W
                          {sortField === 'wins' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                        <TableHead 
                          className="text-[#B9BBBE] cursor-pointer text-right"
                          onClick={() => handleSort('losses')}
                        >
                          L
                          {sortField === 'losses' && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </TableHead>
                        <TableHead className="text-[#B9BBBE] text-right">W/L</TableHead>
                        <TableHead className="text-[#B9BBBE]">Rank</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {playersLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-[#B9BBBE]">
                            Loading players...
                          </TableCell>
                        </TableRow>
                      ) : sortedPlayers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-[#B9BBBE]">
                            No players found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedPlayers.map((player, index) => {
                          const rankTier = getRankTierByMmr(player.mmr, rankTiers);
                          const rankIconUrl = getRankIconUrl(rankTier);
                          
                          return (
                            <TableRow key={player.id} className="hover:bg-[#36393F] border-[#40444b]">
                              <TableCell className="text-[#B9BBBE] font-medium">{index + 1}</TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={player.avatarUrl} />
                                    <AvatarFallback>{player.username.substring(0, 2)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-[#E4E6EB] font-medium">{player.username}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-[#E4E6EB] font-medium">{player.mmr}</TableCell>
                              <TableCell className="text-right text-green-400">{player.wins}</TableCell>
                              <TableCell className="text-right text-red-400">{player.losses}</TableCell>
                              <TableCell className="text-right text-[#B9BBBE]">
                                {player.wins === 0 && player.losses === 0 
                                  ? '-' 
                                  : (player.wins / (player.wins + player.losses)).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <div className="flex items-center space-x-2">
                                        {rankIconUrl && (
                                          <img 
                                            src={rankIconUrl} 
                                            alt={rankTier?.name || 'Rank'} 
                                            className="h-6 w-6"
                                            onError={(e) => {
                                              // Try lowercase version if original file doesn't load
                                              const imgElement = e.target as HTMLImageElement;
                                              if (!imgElement.src.includes('lowercase')) {
                                                const parts = imgElement.src.split('/');
                                                const filename = parts[parts.length - 1].toLowerCase();
                                                parts[parts.length - 1] = filename;
                                                imgElement.src = parts.join('/') + '?lowercase=true';
                                              }
                                            }}
                                          />
                                        )}
                                        <Badge 
                                          style={{ backgroundColor: rankTier?.color || '#40444b' }}
                                          className="text-white"
                                        >
                                          {rankTier?.name || 'Unranked'}
                                        </Badge>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{rankTier?.description || 'No rank description'}</p>
                                      <p className="text-xs mt-1">MMR Range: {getRankTierRange(rankTier)}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card className="bg-[#2F3136] border-[#202225]">
              <CardHeader>
                <CardTitle className="text-white">Rank Tiers</CardTitle>
                <CardDescription>MMR ranges for each rank</CardDescription>
              </CardHeader>
              <CardContent>
                {rankTiers.length === 0 ? (
                  <p className="text-[#B9BBBE]">No rank tiers configured.</p>
                ) : (
                  <div className="space-y-3">
                    {rankTiers.sort((a, b) => b.minMmr - a.minMmr).map((tier) => (
                      <div key={tier.id} className="flex items-center p-2 rounded-md bg-[#36393F]">
                        <div className="mr-3">
                          {tier.iconPath && (
                            <img 
                              src={getRankIconUrl(tier)} 
                              alt={tier.name} 
                              className="h-8 w-8"
                              onError={(e) => {
                                // Try lowercase version if original file doesn't load
                                const imgElement = e.target as HTMLImageElement;
                                if (!imgElement.src.includes('lowercase')) {
                                  const parts = imgElement.src.split('/');
                                  const filename = parts[parts.length - 1].toLowerCase();
                                  parts[parts.length - 1] = filename;
                                  imgElement.src = parts.join('/') + '?lowercase=true';
                                }
                              }}
                            />
                          )}
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between items-center">
                            <Badge style={{ backgroundColor: tier.color }} className="text-white">
                              {tier.name}
                            </Badge>
                            <span className="text-[#B9BBBE] text-sm">{tier.minMmr} - {tier.maxMmr} MMR</span>
                          </div>
                          <p className="text-xs text-[#B9BBBE] mt-1">{tier.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default LeaderboardsPage;
