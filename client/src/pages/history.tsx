import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, RefreshCcw, Search, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { format, differenceInSeconds, differenceInMinutes, differenceInHours } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AppLayout from "@/components/layout/app-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Player {
  id: number;
  username: string;
  discriminator: string;
  mmr: number;
  avatar: string | null;
  discordId: string;
  mmrChange?: number; // MMR change after match
}

interface Team {
  id: number;
  name: string;
  matchId: number;
  winner: boolean;
  avgMMR: number;
  players: Player[]; // Add players to team interface
}

interface Match {
  id: number;
  status: string;
  createdAt: string;
  endedAt: string | null;
  teams: Team[];
  map?: string;
  server?: string;
  winningTeamId?: number;
}

export default function HistoryPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);

  const { data: matchHistory, isLoading, refetch } = useQuery<Match[]>({
    queryKey: ['/api/matches/history'],
  });

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "History refreshed",
      description: "Match history data has been updated.",
    });
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy • HH:mm");
  };

  // Get match duration with more detailed formatting
  const getMatchDuration = (startDate: string, endDate: string | null) => {
    if (!endDate) return "In progress";

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const hours = differenceInHours(end, start);
    const minutes = differenceInMinutes(end, start) % 60;
    const seconds = differenceInSeconds(end, start) % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  // Get player rank information based on MMR
  const getRankFromMMR = (mmr: number) => {
    if (mmr >= 2000) return { name: "Challenger", icon: "Challenger.png" };
    if (mmr >= 1900) return { name: "Masters 3", icon: "Masters3.png" };
    if (mmr >= 1800) return { name: "Masters 2", icon: "Masters2.png" };
    if (mmr >= 1700) return { name: "Masters 1", icon: "Masters1.png" };
    if (mmr >= 1600) return { name: "Diamond 3", icon: "Diamond3.png" };
    if (mmr >= 1500) return { name: "Diamond 2", icon: "Diamond2.png" };
    if (mmr >= 1400) return { name: "Diamond 1", icon: "Diamond1.png" };
    if (mmr >= 1300) return { name: "Platinum 3", icon: "Platinum3.png" };
    if (mmr >= 1200) return { name: "Platinum 2", icon: "Platinum2.png" };
    if (mmr >= 1100) return { name: "Platinum 1", icon: "Platinum1.png" };
    if (mmr >= 1000) return { name: "Gold 3", icon: "gold3.png" };
    if (mmr >= 900) return { name: "Gold 2", icon: "Gold2.png" };
    if (mmr >= 800) return { name: "Gold 1", icon: "Gold1.png" };
    if (mmr >= 700) return { name: "Silver 3", icon: "Silver3.png" };
    if (mmr >= 600) return { name: "Silver 2", icon: "Silver2.png" };
    if (mmr >= 500) return { name: "Silver 1", icon: "Silver1.png" };
    if (mmr >= 400) return { name: "Bronze 3", icon: "Bronze3.png" };
    if (mmr >= 300) return { name: "Bronze 2", icon: "Bronze2.png" };
    if (mmr >= 200) return { name: "Bronze 1", icon: "Bronze1.png" };
    if (mmr >= 100) return { name: "Iron 2", icon: "Iron2.png" };
    return { name: "Iron 1", icon: "iron1.png" };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">COMPLETED</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/30">CANCELLED</Badge>;
      case 'ABANDONED':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">ABANDONED</Badge>;
      default:
        return <Badge className="bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/30">{status}</Badge>;
    }
  };

  const toggleExpandMatch = (matchId: number) => {
    if (expandedMatch === matchId) {
      setExpandedMatch(null);
    } else {
      setExpandedMatch(matchId);
    }
  };

  const filteredMatches = matchHistory?.filter(match => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      match.id.toString().includes(query) ||
      match.map?.toLowerCase().includes(query) ||
      match.server?.toLowerCase().includes(query) ||
      match.status.toLowerCase().includes(query)
    );
  });

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-white">Match History</h1>
            <p className="text-[#B9BBBE]">View completed and previous matches.</p>
          </div>
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B9BBBE]" />
            <Input
              placeholder="Search by match ID, map, server, or status..."
              className="pl-10 bg-[#40444B] border-none text-white placeholder:text-[#B9BBBE]/70"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center bg-[#2F3136] rounded-lg p-10">
            <RefreshCcw className="animate-spin h-8 w-8 text-[#5865F2] mb-4" />
            <p className="text-[#B9BBBE]">Loading match history...</p>
          </div>
        ) : !filteredMatches?.length ? (
          <div className="flex flex-col items-center justify-center bg-[#2F3136] rounded-lg p-10 text-center">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 text-[#B9BBBE] mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Matches Found</h3>
                <p className="text-[#B9BBBE] max-w-md">
                  No matches found matching your search criteria. Try different keywords or clear your search.
                </p>
                <Button 
                  variant="secondary" 
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                >
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <Calendar className="h-12 w-12 text-[#B9BBBE] mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Match History</h3>
                <p className="text-[#B9BBBE] max-w-md">
                  There is no match history available yet. Completed matches will appear here.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-[#2F3136] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-black/30 hover:bg-transparent">
                    <TableHead className="text-[#B9BBBE] font-semibold">Match ID</TableHead>
                    <TableHead className="text-[#B9BBBE] font-semibold">Date & Time</TableHead>
                    <TableHead className="text-[#B9BBBE] font-semibold">Duration</TableHead>
                    <TableHead className="text-[#B9BBBE] font-semibold">Status</TableHead>
                    <TableHead className="text-[#B9BBBE] font-semibold">Winner</TableHead>
                    <TableHead className="text-right text-[#B9BBBE] font-semibold">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatches?.map(match => (
                    <React.Fragment key={match.id}> {/* Added key */}
                      <TableRow className="border-b border-black/10 hover:bg-[#36393F]">
                        <TableCell className="font-medium text-white">{match.id}</TableCell>
                        <TableCell className="text-[#B9BBBE]">{formatDate(match.createdAt)}</TableCell>
                        <TableCell className="text-[#B9BBBE]">
                          {getMatchDuration(match.createdAt, match.endedAt)}
                        </TableCell>
                        <TableCell>{getStatusBadge(match.status)}</TableCell>
                        <TableCell>
                          {match.status === 'COMPLETED' ? (
                            match.winningTeamId ? ( // Use winningTeamId
                              match.teams.find(team => team.id === match.winningTeamId)?.name ? ( // Find winner by ID
                                <div className="flex items-center">
                                  <Trophy className="h-4 w-4 mr-1 text-amber-500" />
                                  <span className="text-white">Team {match.teams.find(team => team.id === match.winningTeamId)?.name}</span>
                                </div>
                              ) : "Draw" //Should not happen ideally
                            ) : "—"
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => toggleExpandMatch(match.id)}
                          >
                            {expandedMatch === match.id ? 
                              <ChevronUp className="h-4 w-4 text-[#B9BBBE]" /> : 
                              <ChevronDown className="h-4 w-4 text-[#B9BBBE]" />
                            }
                          </Button>
                        </TableCell>
                      </TableRow>

                      {expandedMatch === match.id && (
                        <TableRow className="hover:bg-[#36393F] bg-[#36393F]/50">
                          <TableCell colSpan={6} className="p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-[#B9BBBE] mb-2">Match Details</h4>
                                <div className="bg-[#40444B] rounded-md p-3 text-sm">
                                  {match.map && (
                                    <div className="flex justify-between py-1 border-b border-black/10">
                                      <span className="text-[#B9BBBE]">Map</span>
                                      <span className="text-white">{match.map}</span>
                                    </div>
                                  )}
                                  {match.server && (
                                    <div className="flex justify-between py-1 border-b border-black/10">
                                      <span className="text-[#B9BBBE]">Server</span>
                                      <span className="text-white">{match.server}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between py-1">
                                    <span className="text-[#B9BBBE]">MMR Difference</span>
                                    <span className="text-white">
                                      {match.teams.length === 2 ? 
                                        Math.abs(match.teams[0].avgMMR - match.teams[1].avgMMR) : 
                                        "—"
                                      }
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-1 border-t border-black/10 mt-1">
                                    <span className="text-[#B9BBBE]">Match Date</span>
                                    <span className="text-white">{formatDate(match.createdAt)}</span>
                                  </div>
                                  {match.status === 'COMPLETED' && match.endedAt && (
                                    <div className="flex justify-between py-1 border-t border-black/10">
                                      <span className="text-[#B9BBBE]">Match Duration</span>
                                      <span className="text-white">{getMatchDuration(match.createdAt, match.endedAt)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-medium text-[#B9BBBE] mb-2">Teams</h4>
                                <div className="space-y-2">
                                  {match.teams.map(team => {
                                    const isWinner = team.id === match.winningTeamId;
                                    return (
                                      <div 
                                        key={team.id} 
                                        className={`bg-[#40444B] rounded-md p-3 text-sm ${
                                          isWinner ? 'border-l-2 border-amber-500' : ''
                                        }`}
                                      >
                                        <div className="flex justify-between items-center mb-2">
                                          <div className="text-white font-medium flex items-center">
                                            {isWinner && <Trophy className="h-3 w-3 mr-1 text-amber-500" />}
                                            Team {team.name}
                                          </div>
                                          <div className="text-xs bg-[#5865F2]/20 text-[#5865F2] px-2 py-0.5 rounded">
                                            Avg MMR: {team.avgMMR}
                                          </div>
                                        </div>
                                        
                                        {/* Players list */}
                                        {team.players && team.players.length > 0 && (
                                          <div className="mt-2 space-y-1.5">
                                            {team.players.map(player => {
                                              // Calculate player rank from MMR
                                              const playerRank = getRankFromMMR(player.mmr);
                                              const mmrChange = player.mmrChange || 0;
                                              
                                              return (
                                                <div key={player.id} className="flex items-center justify-between border-t border-black/10 pt-1.5">
                                                  <div className="flex items-center">
                                                    <div className="relative mr-2">
                                                      <Avatar className="h-6 w-6">
                                                        <AvatarImage 
                                                          src={player.avatar 
                                                            ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar}.png` 
                                                            : undefined
                                                          } 
                                                          alt={player.username} 
                                                        />
                                                        <AvatarFallback className="bg-[#5865F2] text-[9px]">
                                                          {player.username.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                      </Avatar>
                                                      
                                                      {/* Rank icon */}
                                                      {playerRank && (
                                                        <div className="absolute -bottom-1 -right-1 h-3 w-3">
                                                          <img 
                                                            src={`/ranks/${playerRank.icon}`} 
                                                            alt={playerRank.name} 
                                                            className="h-3 w-3 rounded-full"
                                                            title={playerRank.name}
                                                          />
                                                        </div>
                                                      )}
                                                    </div>
                                                    <span className="text-[#DCDDDE] text-xs">{player.username}</span>
                                                  </div>
                                                  
                                                  <div className="flex items-center gap-2">
                                                    {match.status === 'COMPLETED' && (
                                                      <span className={`text-xs ${
                                                        mmrChange > 0 
                                                          ? 'text-emerald-400' 
                                                          : mmrChange < 0 
                                                            ? 'text-rose-400' 
                                                            : 'text-gray-400'
                                                      }`}>
                                                        {mmrChange > 0 ? '+' : ''}{mmrChange}
                                                      </span>
                                                    )}
                                                    <span className="text-xs bg-[#36393F] px-1.5 py-0.5 rounded text-[#B9BBBE]">
                                                      {player.mmr}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}