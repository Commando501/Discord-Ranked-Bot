import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCcw, Medal, Trophy, Download, ArrowUpDown, Info } from "lucide-react";
import { getPlayerRank } from "@/../../shared/rankSystem";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface Player {
  id: number;
  username: string;
  discriminator: string;
  discordId: string;
  avatar: string | null;
  mmr: number;
  wins: number;
  losses: number;
  winStreak: number;
  lossStreak: number;
  isActive: boolean;
  createdAt: string;
}

interface RankTier {
  name: string;
  mmrThreshold: number;
  color?: string;
}

export default function LeaderboardsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("mmr");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortBy, setSortBy] = useState<'mmr' | 'wins' | 'winRate'>('mmr');
  const [seasonFilter, setSeasonFilter] = useState("current");

  // Get all players
  const { data: players, isLoading, refetch } = useQuery<Player[]>({
    queryKey: ['/api/admin/players'],
  });

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Leaderboard refreshed",
      description: "Player rankings have been updated.",
    });
  };

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const getWinRate = (wins: number, losses: number) => {
    if (wins + losses === 0) return 0;
    return (wins / (wins + losses)) * 100;
  };

  const getTotalGames = (player: Player) => {
    return player.wins + player.losses;
  };

  // Sort players based on current criteria
  const getSortedPlayers = () => {
    if (!players) return [];

    const sorted = [...players].filter(p => getTotalGames(p) > 0);

    if (sortBy === 'mmr') {
      sorted.sort((a, b) => b.mmr - a.mmr);
    } else if (sortBy === 'wins') {
      sorted.sort((a, b) => b.wins - a.wins);
    } else if (sortBy === 'winRate') {
      sorted.sort((a, b) => {
        const aWinRate = getWinRate(a.wins, a.losses);
        const bWinRate = getWinRate(b.wins, b.losses);
        return bWinRate - aWinRate;
      });
    }

    if (sortOrder === 'asc') {
      sorted.reverse();
    }

    return sorted;
  };

  // Get top 3 players based on selected criteria
  const getTopPlayers = () => {
    const sorted = getSortedPlayers();
    return sorted.slice(0, 3);
  };

  // Table data excluding top 3 players
  const getTablePlayers = () => {
    const sorted = getSortedPlayers();
    return sorted.slice(3);
  };

  // Get the rank tiers from the config endpoint - moved to component level to follow React hooks rules
  const { data: config } = useQuery({
    queryKey: ['/api/config'],
  });
  
  // Function to retrieve rank tiers from API or default values
  const getRankTiers = (): RankTier[] => {
    // If we have rankTiers in the config, use them
    if (config?.seasonManagement?.rankTiers && config.seasonManagement.rankTiers.length > 0) {
      return config.seasonManagement.rankTiers;
    }
    
    // Otherwise fall back to the default tiers
    return [
      { name: "Bronze", mmrThreshold: 0, color: "#B9BBBE" },
      { name: "Silver", mmrThreshold: 1000, color: "#5865F2" },
      { name: "Gold", mmrThreshold: 1500, color: "#3BA55C" },
      { name: "Platinum", mmrThreshold: 2000, color: "#FAA61A" },
      { name: "Diamond", mmrThreshold: 2500, color: "#ED4245" },
    ];
  };
  
  const topPlayers = getTopPlayers();
  const tablePlayers = getTablePlayers();

  // Calculate MMR distribution based on rank tiers
  const getMmrDistribution = () => {
    if (!players || players.length === 0) return [];

    const tiers = getRankTiers();
    // Sort tiers by MMR threshold
    const sortedTiers = [...tiers].sort((a, b) => a.mmrThreshold - b.mmrThreshold);
    
    // Create ranges based on the tiers
    const ranges = sortedTiers.map((tier, index) => {
      const nextTier = sortedTiers[index + 1];
      const max = nextTier ? nextTier.mmrThreshold - 1 : Infinity;
      const label = nextTier 
        ? `${tier.mmrThreshold}-${max}` 
        : `${tier.mmrThreshold}+`;
        
      return {
        label,
        min: tier.mmrThreshold,
        max,
        count: 0,
        color: tier.color || '#40444B'
      };
    });

    players.forEach(player => {
      for (const range of ranges) {
        if (player.mmr >= range.min && player.mmr <= range.max) {
          range.count++;
          break;
        }
      }
    });

    const maxCount = Math.max(...ranges.map(r => r.count));
    return ranges.map(range => ({
      ...range,
      percentage: maxCount > 0 ? (range.count / maxCount) * 100 : 0
    }));
  };

  const mmrDistribution = getMmrDistribution();

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-white">Leaderboards</h1>
            <p className="text-[#B9BBBE]">View player rankings, statistics, and performance metrics.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={seasonFilter} onValueChange={setSeasonFilter}>
              <SelectTrigger className="w-[180px] bg-[#2F3136] border-black/10">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent className="bg-[#36393F] border-black/10">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="current">Current Season</SelectItem>
                <SelectItem value="previous">Previous Season</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="secondary">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-[#2F3136] border-b border-black/10 p-0 h-auto w-full justify-start rounded-none">
            <TabsTrigger 
              value="mmr" 
              className="py-3 px-6 bg-transparent data-[state=active]:bg-[#36393F] rounded-none border-b-2 border-transparent data-[state=active]:border-[#5865F2] text-[#B9BBBE] data-[state=active]:text-white"
            >
              MMR Ranking
            </TabsTrigger>
            <TabsTrigger 
              value="wins" 
              className="py-3 px-6 bg-transparent data-[state=active]:bg-[#36393F] rounded-none border-b-2 border-transparent data-[state=active]:border-[#5865F2] text-[#B9BBBE] data-[state=active]:text-white"
            >
              Most Wins
            </TabsTrigger>
            <TabsTrigger 
              value="winrate" 
              className="py-3 px-6 bg-transparent data-[state=active]:bg-[#36393F] rounded-none border-b-2 border-transparent data-[state=active]:border-[#5865F2] text-[#B9BBBE] data-[state=active]:text-white"
            >
              Win Rate
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              className="py-3 px-6 bg-transparent data-[state=active]:bg-[#36393F] rounded-none border-b-2 border-transparent data-[state=active]:border-[#5865F2] text-[#B9BBBE] data-[state=active]:text-white"
            >
              Stats & Distribution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mmr" className="space-y-6">
            {/* Top 3 Players Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isLoading ? (
                <div className="col-span-3 text-center py-10 bg-[#2F3136] rounded-lg">
                  <RefreshCcw className="animate-spin h-8 w-8 mx-auto mb-4 text-[#5865F2]" />
                  <p className="text-[#B9BBBE]">Loading leaderboard data...</p>
                </div>
              ) : topPlayers.length === 0 ? (
                <div className="col-span-3 text-center py-10 bg-[#2F3136] rounded-lg">
                  <Trophy className="h-12 w-12 text-[#B9BBBE]/20 mx-auto mb-4" />
                  <h3 className="text-white font-medium mb-2">No Ranked Players</h3>
                  <p className="text-[#B9BBBE]">Players will appear here once they've completed matches.</p>
                </div>
              ) : (
                <>
                  {/* Second Place */}
                  {topPlayers.length > 1 && (
                    <Card className="bg-[#2F3136] border-black/10 relative pt-6">
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                        <div className="rounded-full bg-[#C0C0C0] p-2 w-10 h-10 flex items-center justify-center">
                          <Medal className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <CardHeader className="text-center pt-2 pb-0">
                        <div className="mx-auto mb-2">
                          <Avatar className="h-16 w-16">
                            <AvatarImage 
                              src={topPlayers[1].avatar 
                                ? `https://cdn.discordapp.com/avatars/${topPlayers[1].discordId}/${topPlayers[1].avatar}.png` 
                                : undefined
                              }
                              alt={topPlayers[1].username}
                            />
                            <AvatarFallback className="bg-[#5865F2] text-white">
                              {getInitials(topPlayers[1].username)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <CardTitle className="text-white">{topPlayers[1].username}</CardTitle>
                        <CardDescription className="text-[#B9BBBE]">
                          {topPlayers[1].wins}W {topPlayers[1].losses}L
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-center pt-2">
                        <div className="text-3xl font-bold text-[#C0C0C0]">{topPlayers[1].mmr}</div>
                        <div className="text-sm text-[#B9BBBE]">MMR</div>
                      </CardContent>
                    </Card>
                  )}

                  {/* First Place */}
                  {topPlayers.length > 0 && (
                    <Card className="bg-[#2F3136] border-black/10 relative pt-6 transform scale-105">
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                        <div className="rounded-full bg-[#FFD700] p-2 w-12 h-12 flex items-center justify-center">
                          <Trophy className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      <CardHeader className="text-center pt-2 pb-0">
                        <div className="mx-auto mb-2">
                          <Avatar className="h-20 w-20">
                            <AvatarImage 
                              src={topPlayers[0].avatar 
                                ? `https://cdn.discordapp.com/avatars/${topPlayers[0].discordId}/${topPlayers[0].avatar}.png` 
                                : undefined
                              }
                              alt={topPlayers[0].username}
                            />
                            <AvatarFallback className="bg-[#5865F2] text-white text-xl">
                              {getInitials(topPlayers[0].username)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <CardTitle className="text-white text-xl">{topPlayers[0].username}</CardTitle>
                        <CardDescription className="text-[#B9BBBE]">
                          {topPlayers[0].wins}W {topPlayers[0].losses}L
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-center pt-2">
                        <div className="text-4xl font-bold text-[#FFD700]">{topPlayers[0].mmr}</div>
                        <div className="text-sm text-[#B9BBBE]">MMR</div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Third Place */}
                  {topPlayers.length > 2 && (
                    <Card className="bg-[#2F3136] border-black/10 relative pt-6">
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                        <div className="rounded-full bg-[#CD7F32] p-2 w-10 h-10 flex items-center justify-center">
                          <Medal className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <CardHeader className="text-center pt-2 pb-0">
                        <div className="mx-auto mb-2">
                          <Avatar className="h-16 w-16">
                            <AvatarImage 
                              src={topPlayers[2].avatar 
                                ? `https://cdn.discordapp.com/avatars/${topPlayers[2].discordId}/${topPlayers[2].avatar}.png` 
                                : undefined
                              }
                              alt={topPlayers[2].username}
                            />
                            <AvatarFallback className="bg-[#5865F2] text-white">
                              {getInitials(topPlayers[2].username)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <CardTitle className="text-white">{topPlayers[2].username}</CardTitle>
                        <CardDescription className="text-[#B9BBBE]">
                          {topPlayers[2].wins}W {topPlayers[2].losses}L
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-center pt-2">
                        <div className="text-3xl font-bold text-[#CD7F32]">{topPlayers[2].mmr}</div>
                        <div className="text-sm text-[#B9BBBE]">MMR</div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>

            {/* Leaderboard Table */}
            <Card className="bg-[#2F3136] border-black/10">
              <CardHeader className="border-b border-black/10 pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white text-lg">MMR Leaderboard</CardTitle>
                  <div className="flex items-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="h-8 text-[#B9BBBE]"
                    >
                      <ArrowUpDown className="h-4 w-4 mr-1" />
                      {sortOrder === 'desc' ? 'Highest First' : 'Lowest First'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-black/20 hover:bg-transparent">
                        <TableHead className="text-[#B9BBBE] font-medium w-20">Rank</TableHead>
                        <TableHead className="text-[#B9BBBE] font-medium">Player</TableHead>
                        <TableHead className="text-[#B9BBBE] font-medium text-right">MMR</TableHead>
                        <TableHead className="text-[#B9BBBE] font-medium text-center">Win/Loss</TableHead>
                        <TableHead className="text-[#B9BBBE] font-medium text-right">Games</TableHead>
                        <TableHead className="text-[#B9BBBE] font-medium text-right">Win Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            <RefreshCcw className="animate-spin h-6 w-6 mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : tablePlayers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-[#B9BBBE]">
                            {topPlayers.length === 0 ? 
                              "No ranked players found" :
                              "No additional ranked players"
                            }
                          </TableCell>
                        </TableRow>
                      ) : (
                        tablePlayers.map((player, index) => (
                          <TableRow key={player.id} className="border-b border-black/10 hover:bg-[#36393F]">
                            <TableCell className="font-medium text-white">
                              #{topPlayers.length + index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Avatar className="h-8 w-8 mr-2">
                                  <AvatarImage 
                                    src={player.avatar 
                                      ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar}.png` 
                                      : undefined
                                    } 
                                    alt={player.username} 
                                  />
                                  <AvatarFallback className="bg-[#5865F2] text-white text-xs">
                                    {getInitials(player.username)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center">
                                  {(() => {
                                    const playerRank = getPlayerRank(player.mmr, getRankTiers());
                                    return playerRank.icon ? (
                                      <div className="flex items-center mr-1">
                                        <img 
                                          src={playerRank.icon.startsWith('/') ? playerRank.icon : `/${playerRank.icon}`} 
                                          alt={`${playerRank.name} rank`}
                                          className="w-4 h-4 object-contain"
                                          onError={(e) => {
                                            console.log(`Failed to load icon: ${playerRank.icon}`);
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            // Display color box as fallback
                                            e.currentTarget.parentElement!.innerHTML = 
                                              `<div class="w-3 h-3 mr-1 rounded-sm" style="background-color: ${playerRank.color || '#40444B'}"></div>`;
                                          }}
                                        />
                                      </div>
                                    ) : playerRank.color ? (
                                      <div 
                                        className="w-3 h-3 mr-1 rounded-sm" 
                                        style={{ backgroundColor: playerRank.color }}
                                      ></div>
                                    ) : null;
                                  })()}
                                  <span className="text-[#DCDDDE]">{player.username}#{player.discriminator}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-white">{player.mmr}</TableCell>
                            <TableCell className="text-center">
                              <span className="text-[#3BA55C]">{player.wins}W</span>
                              {" / "}
                              <span className="text-[#ED4245]">{player.losses}L</span>
                            </TableCell>
                            <TableCell className="text-right text-[#B9BBBE]">
                              {getTotalGames(player)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span 
                                className={
                                  getWinRate(player.wins, player.losses) >= 50 
                                    ? "text-[#3BA55C]" 
                                    : "text-[#ED4245]"
                                }
                              >
                                {getWinRate(player.wins, player.losses).toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wins" className="space-y-4">
            <Card className="bg-[#2F3136] border-black/10">
              <CardHeader className="border-b border-black/10 pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white text-lg">Most Wins Leaderboard</CardTitle>
                  <div className="flex items-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="h-8 text-[#B9BBBE]"
                    >
                      <ArrowUpDown className="h-4 w-4 mr-1" />
                      {sortOrder === 'desc' ? 'Highest First' : 'Lowest First'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 text-center">
                <div className="text-[#B9BBBE] mb-6">
                  Coming soon - Win leaderboard will show players with the most total wins
                </div>
                <Button variant="outline">
                  <Trophy className="h-4 w-4 mr-2" />
                  Preview Feature
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="winrate" className="space-y-4">
            <Card className="bg-[#2F3136] border-black/10">
              <CardHeader className="border-b border-black/10 pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white text-lg">Win Rate Leaderboard</CardTitle>
                  <div className="flex items-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="h-8 text-[#B9BBBE]"
                    >
                      <ArrowUpDown className="h-4 w-4 mr-1" />
                      {sortOrder === 'desc' ? 'Highest First' : 'Lowest First'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 text-center">
                <div className="text-[#B9BBBE] mb-6">
                  Coming soon - Win rate leaderboard will show players with the highest win percentage
                </div>
                <Button variant="outline">
                  <Trophy className="h-4 w-4 mr-2" />
                  Preview Feature
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-[#2F3136] border-black/10">
                <CardHeader className="border-b border-black/10 pb-3">
                  <CardTitle className="text-white text-lg">MMR Distribution</CardTitle>
                  <CardDescription className="text-[#B9BBBE]">
                    Player skill rating distribution across all ranked players
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {isLoading ? (
                    <div className="h-40 flex items-center justify-center">
                      <RefreshCcw className="animate-spin h-6 w-6 text-[#5865F2]" />
                    </div>
                  ) : mmrDistribution.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-[#B9BBBE]">
                      No data available
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {mmrDistribution.map((range, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <div className="text-[#DCDDDE]">{range.label}</div>
                            <div className="text-[#B9BBBE]">{range.count} players</div>
                          </div>
                          <div className="h-2 w-full bg-[#40444B] rounded-full overflow-hidden">
                            <div 
                              className="h-full" 
                              style={{ 
                                width: `${range.percentage}%`,
                                backgroundColor: range.color
                              }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[#2F3136] border-black/10">
                <CardHeader className="border-b border-black/10 pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-white text-lg">Ranking System</CardTitle>
                      <CardDescription className="text-[#B9BBBE]">
                        How player rankings and MMR are calculated
                      </CardDescription>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#B9BBBE]">
                            <Info className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#18191C] border-black/10 text-white">
                          <p>Ranking is based on Elo algorithm</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-4">
                      {getRankTiers().map((tier, index) => {
                        // Calculate max MMR display value
                        const nextTier = getRankTiers()[index + 1];
                        const maxDisplay = nextTier ? `${nextTier.mmrThreshold - 1}` : '+';

                        return (
                          <div 
                            key={tier.name}
                            className="col-span-5 sm:col-span-1 rounded-lg p-3 text-center"
                            style={{ backgroundColor: tier.color || '#40444B' }}
                          >
                            <div className="flex justify-center mb-1 h-8">
                              {tier.icon ? (
                                <img 
                                  src={tier.icon.startsWith('/') ? tier.icon : `/${tier.icon}`} 
                                  alt={`${tier.name} rank`} 
                                  className="w-8 h-8 object-contain"
                                  onError={(e) => {
                                    console.log(`Failed to load icon: ${tier.icon}`);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    // Display a color circle instead as fallback
                                    e.currentTarget.parentElement!.innerHTML = 
                                      `<div class="w-6 h-6 rounded-full" style="background-color: ${tier.color || '#40444B'}"></div>`;
                                  }}
                                />
                              ) : tier.color && (
                                <div 
                                  className="w-6 h-6 rounded-full" 
                                  style={{ backgroundColor: tier.color }}
                                ></div>
                              )}
                            </div>
                            <div className="font-medium text-white">{tier.name}</div>
                            <div className="text-xs text-white/80">
                              {tier.mmrThreshold} {nextTier ? '- ' + (nextTier.mmrThreshold - 1) : '+'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-[#36393F] rounded-lg p-4">
                      <h4 className="text-white font-medium mb-2">MMR Calculation</h4>
                      <p className="text-[#B9BBBE] text-sm mb-3">
                        MMR is calculated using an Elo-based algorithm. Your MMR will increase when you win matches
                        and decrease when you lose. The amount of change depends on the MMR difference between teams.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-[#40444B] rounded-md p-3">
                          <div className="text-sm font-medium text-white mb-1">Winning vs Higher MMR</div>
                          <div className="text-xs text-[#B9BBBE]">
                            Defeating players with higher MMR gives you more points (+25 to +32)
                          </div>
                        </div>
                        <div className="bg-[#40444B] rounded-md p-3">
                          <div className="text-sm font-medium text-white mb-1">Losing vs Lower MMR</div>
                          <div className="text-xs text-[#B9BBBE]">
                            Losing to players with lower MMR results in greater point loss (-25 to -32)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-[#2F3136] border-black/10">
              <CardHeader className="border-b border-black/10 pb-3">
                <CardTitle className="text-white text-lg">Global Stats</CardTitle>
                <CardDescription className="text-[#B9BBBE]">
                  Overall statistics for all ranked players
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-[#36393F] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      {players?.length || 0}
                    </div>
                    <div className="text-[#B9BBBE]">Total Players</div>
                  </div>
                  <div className="bg-[#36393F] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      {players?.reduce((sum, player) => sum + player.wins + player.losses, 0) || 0}
                    </div>
                    <div className="text-[#B9BBBE]">Total Matches</div>
                  </div>
                  <div className="bg-[#36393F] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      {players?.length ? Math.round(players.reduce((avg, player) => avg + player.mmr, 0) / players.length) : 0}
                    </div>
                    <div className="text-[#B9BBBE]">Average MMR</div>
                  </div>
                  <div className="bg-[#36393F] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white mb-1">
                      {players?.length ? players.reduce((max, player) => Math.max(max, player.winStreak), 0) : 0}
                    </div>
                    <div className="text-[#B9BBBE]">Highest Win Streak</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}