import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCcw, Users, User, Trophy, Clock, ChevronDown, UserPlus, Shield, Edit, Save, X } from "lucide-react";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Player {
  id: number;
  username: string;
  discriminator: string;
  discordId: string;
  avatar: string | null;
  xboxGamertag: string | null;
  xuid: string | null;
  mmr: number;
  wins: number;
  losses: number;
  winStreak: number;
  lossStreak: number;
  isActive: boolean;
  createdAt: string;
}

interface PlayerMatch {
  id: number;
  status: string;
  createdAt: string;
  endedAt: string | null;
  winningTeamId: number | null;
  teams: Array<{
    id: number;
    name: string;
    winner: boolean;
    avgMMR: number;
  }>;
}

export default function PlayersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editPlayerData, setEditPlayerData] = useState<{
    mmr: number;
    isActive: boolean;
    xboxGamertag: string | null;
    xuid: string | null;
  }>({ mmr: 0, isActive: true, xboxGamertag: null, xuid: null });
  const playersPerPage = 12;

  // Get all players
  const { data: players, isLoading, refetch } = useQuery<Player[]>({
    queryKey: ['/api/admin/players'],
  });

  // Get selected player's matches if a player is selected
  const { data: playerMatches, isLoading: isLoadingMatches } = useQuery<PlayerMatch[]>({
    queryKey: ['/api/players', selectedPlayer?.id, 'matches'],
    enabled: !!selectedPlayer,
  });

  // Filter players based on search and active tab
  const filteredPlayers = players?.filter(player => {
    const matchesSearch = 
      player.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.discordId.includes(searchQuery) ||
      player.id.toString().includes(searchQuery);
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "active") return matchesSearch && player.isActive;
    if (activeTab === "inactive") return matchesSearch && !player.isActive;
    
    return matchesSearch;
  }) || [];

  // Calculate pagination
  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage);
  const paginatedPlayers = filteredPlayers.slice(
    (currentPage - 1) * playersPerPage,
    currentPage * playersPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Player data refreshed",
      description: "Player list has been updated.",
    });
  };

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const getWinRate = (wins: number, losses: number) => {
    if (wins + losses === 0) return 0;
    return (wins / (wins + losses)) * 100;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const getTotalGames = (player: Player) => {
    return player.wins + player.losses;
  };

  const getStreakText = (winStreak: number, lossStreak: number) => {
    if (winStreak > 0) return `${winStreak} win streak`;
    if (lossStreak > 0) return `${lossStreak} loss streak`;
    return "No streak";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-emerald-500/20 text-emerald-500">COMPLETED</Badge>;
      case 'ACTIVE':
        return <Badge className="bg-blue-500/20 text-blue-500">ACTIVE</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-rose-500/20 text-rose-500">CANCELLED</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getMatchResult = (match: PlayerMatch) => {
    if (match.status !== 'COMPLETED') return 'PENDING';
    
    const playerTeamId = match.teams.find(
      team => team.name === 'A' // This is a simplification - you would need to know which team the player was on
    )?.id;

    if (!playerTeamId || !match.winningTeamId) return 'DRAW';
    return playerTeamId === match.winningTeamId ? 'WIN' : 'LOSS';
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'WIN':
        return <Badge className="bg-emerald-500/20 text-emerald-500">WIN</Badge>;
      case 'LOSS':
        return <Badge className="bg-rose-500/20 text-rose-500">LOSS</Badge>;
      case 'DRAW':
        return <Badge className="bg-amber-500/20 text-amber-500">DRAW</Badge>;
      default:
        return <Badge variant="secondary">{result}</Badge>;
    }
  };

  // Initialize edit form when a player is selected
  useEffect(() => {
    if (selectedPlayer) {
      setEditPlayerData({
        mmr: selectedPlayer.mmr,
        isActive: selectedPlayer.isActive,
        xboxGamertag: selectedPlayer.xboxGamertag,
        xuid: selectedPlayer.xuid
      });
    }
  }, [selectedPlayer]);

  // Update player mutation
  const updatePlayerMutation = useMutation({
    mutationFn: async (data: { id: number, data: Partial<Player> }) => {
      return await apiRequest(
        `/api/admin/players/${data.id}`,
        'PATCH',
        data.data
      );
    },
    onSuccess: () => {
      toast({
        title: "Player Updated",
        description: "Player information has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/players'] });
      // Also invalidate the player matches if they were fetched
      if (selectedPlayer) {
        queryClient.invalidateQueries({ queryKey: ['/api/players', selectedPlayer.id, 'matches'] });
      }
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "There was a problem updating the player.",
        variant: "destructive",
      });
      console.error("Error updating player:", error);
    }
  });

  const handleEditPlayer = () => {
    if (!selectedPlayer) return;
    setIsEditDialogOpen(true);
  };

  const handleSavePlayer = () => {
    if (!selectedPlayer) return;
    updatePlayerMutation.mutate({ 
      id: selectedPlayer.id, 
      data: editPlayerData 
    });
  };

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-white">Player Profiles</h1>
            <p className="text-[#B9BBBE]">View and manage player accounts, statistics, and match history.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button className="bg-[#5865F2] hover:bg-[#4752C4]">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Player
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Player List */}
          <div className="lg:col-span-2">
            <Card className="bg-[#2F3136] border-black/10">
              <CardHeader className="border-b border-black/10 pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white text-lg">Players</CardTitle>
                  <div className="flex items-center">
                    <div className="text-sm text-[#B9BBBE]">
                      {filteredPlayers.length} players found
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B9BBBE]" />
                    <Input
                      placeholder="Search by username or ID..."
                      className="pl-10 bg-[#40444B] border-none text-white placeholder:text-[#B9BBBE]/70"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                    <TabsList className="bg-[#40444B] w-full sm:w-auto">
                      <TabsTrigger value="all" className="text-[#B9BBBE] data-[state=active]:text-white">
                        All
                      </TabsTrigger>
                      <TabsTrigger value="active" className="text-[#B9BBBE] data-[state=active]:text-white">
                        Active
                      </TabsTrigger>
                      <TabsTrigger value="inactive" className="text-[#B9BBBE] data-[state=active]:text-white">
                        Inactive
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="text-center py-8 text-[#B9BBBE]">
                    <RefreshCcw className="animate-spin h-6 w-6 mx-auto mb-2" />
                    Loading players...
                  </div>
                ) : filteredPlayers.length === 0 ? (
                  <div className="text-center py-8 text-[#B9BBBE]">
                    <Users className="h-12 w-12 text-[#B9BBBE]/20 mx-auto mb-3" />
                    <h3 className="text-white font-medium mb-1">No players found</h3>
                    <p className="text-sm">Try a different search term or filter.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                    {paginatedPlayers.map(player => (
                      <div 
                        key={player.id}
                        className={`bg-[#40444B] hover:bg-[#36393F] rounded-md p-3 cursor-pointer transition ${
                          selectedPlayer?.id === player.id ? 'border-2 border-[#5865F2]' : ''
                        }`}
                        onClick={() => setSelectedPlayer(player)}
                      >
                        <div className="flex items-center mb-3">
                          <Avatar className="h-10 w-10 mr-3">
                            <AvatarImage 
                              src={player.avatar 
                                ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar}.png` 
                                : undefined
                              } 
                              alt={player.username} 
                            />
                            <AvatarFallback className="bg-[#5865F2] text-white">
                              {getInitials(player.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-white font-medium">{player.username}#{player.discriminator}</div>
                            <div className="text-[#B9BBBE] text-xs">ID: {player.id}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-[#B9BBBE]">MMR</div>
                          <div className="text-white font-medium">{player.mmr}</div>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-[#B9BBBE]">Record</div>
                          <div className="text-white">
                            <span className="text-[#3BA55C]">{player.wins}W</span> / <span className="text-[#ED4245]">{player.losses}L</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-[#B9BBBE]">Win Rate</div>
                          <div className="text-white">{getWinRate(player.wins, player.losses).toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              {totalPages > 1 && (
                <CardFooter className="border-t border-black/10 p-2 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) setCurrentPage(currentPage - 1);
                          }}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        const pageNumber = i + 1;
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink 
                              href="#" 
                              isActive={currentPage === pageNumber}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(pageNumber);
                              }}
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      {totalPages > 5 && (
                        <>
                          <PaginationItem>
                            <PaginationLink href="#" onClick={(e) => e.preventDefault()}>...</PaginationLink>
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationLink 
                              href="#" 
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(totalPages);
                              }}
                              isActive={currentPage === totalPages}
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}
                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                          }}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </CardFooter>
              )}
            </Card>
          </div>

          {/* Right Column - Player Details */}
          <div className="lg:col-span-1">
            {selectedPlayer ? (
              <div className="space-y-4">
                <Card className="bg-[#2F3136] border-black/10">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Avatar className="h-16 w-16 mr-4">
                          <AvatarImage 
                            src={selectedPlayer.avatar 
                              ? `https://cdn.discordapp.com/avatars/${selectedPlayer.discordId}/${selectedPlayer.avatar}.png` 
                              : undefined
                            } 
                            alt={selectedPlayer.username} 
                          />
                          <AvatarFallback className="bg-[#5865F2] text-white text-xl">
                            {getInitials(selectedPlayer.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center">
                            <CardTitle className="text-white text-xl">
                              {selectedPlayer.username}#{selectedPlayer.discriminator}
                            </CardTitle>
                            {selectedPlayer.isActive ? (
                              <Badge className="ml-2 bg-[#3BA55C]/20 text-[#3BA55C]">Active</Badge>
                            ) : (
                              <Badge className="ml-2 bg-[#ED4245]/20 text-[#ED4245]">Inactive</Badge>
                            )}
                          </div>
                          <CardDescription className="text-[#B9BBBE]">
                            <div className="flex items-center mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              Joined {formatDate(selectedPlayer.createdAt)}
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                      <Button 
                        onClick={handleEditPlayer} 
                        variant="outline" 
                        size="sm"
                        className="h-8 px-2"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-[#40444B] rounded-md p-3 text-center">
                        <div className="text-xs text-[#B9BBBE] uppercase mb-1">MMR</div>
                        <div className="text-xl font-bold text-white">{selectedPlayer.mmr}</div>
                        <div className="text-xs text-[#B9BBBE] mt-1">
                          {getStreakText(selectedPlayer.winStreak, selectedPlayer.lossStreak)}
                        </div>
                      </div>
                      <div className="bg-[#40444B] rounded-md p-3 text-center">
                        <div className="text-xs text-[#B9BBBE] uppercase mb-1">Win Rate</div>
                        <div className="text-xl font-bold text-white">
                          {getWinRate(selectedPlayer.wins, selectedPlayer.losses).toFixed(1)}%
                        </div>
                        <div className="text-xs text-[#B9BBBE] mt-1">
                          {getTotalGames(selectedPlayer)} games played
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-[#36393F] rounded-md">
                        <div className="flex items-center">
                          <Trophy className="h-4 w-4 text-[#FAA61A] mr-2" />
                          <span className="text-white">Wins</span>
                        </div>
                        <span className="text-[#3BA55C] font-medium">{selectedPlayer.wins}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#36393F] rounded-md">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-[#B9BBBE] mr-2" />
                          <span className="text-white">Losses</span>
                        </div>
                        <span className="text-[#ED4245] font-medium">{selectedPlayer.losses}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#36393F] rounded-md">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 text-[#5865F2] mr-2" />
                          <span className="text-white">Discord ID</span>
                        </div>
                        <span className="text-[#DCDDDE] text-sm font-mono">{selectedPlayer.discordId}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#36393F] rounded-md">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-white">Xbox Gamertag</span>
                        </div>
                        <span className="text-[#DCDDDE] text-sm">{selectedPlayer.xboxGamertag || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#36393F] rounded-md">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 text-green-500 mr-2" />
                          <span className="text-white">XUID</span>
                        </div>
                        <span className="text-[#DCDDDE] text-sm font-mono">{selectedPlayer.xuid || 'Not set'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#2F3136] border-black/10">
                  <CardHeader className="border-b border-black/10 pb-3">
                    <CardTitle className="text-white text-lg">Recent Matches</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {isLoadingMatches ? (
                      <div className="text-center py-4 text-[#B9BBBE]">
                        <RefreshCcw className="animate-spin h-4 w-4 mx-auto mb-2" />
                        Loading matches...
                      </div>
                    ) : !playerMatches || playerMatches.length === 0 ? (
                      <div className="text-center py-4 text-[#B9BBBE]">
                        <Trophy className="h-10 w-10 text-[#B9BBBE]/20 mx-auto mb-2" />
                        <p>No match history found</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {playerMatches.slice(0, 5).map(match => (
                          <div 
                            key={match.id} 
                            className="flex items-center justify-between p-2 bg-[#36393F] rounded-md"
                          >
                            <div>
                              <div className="text-white text-sm">Match #{match.id}</div>
                              <div className="text-xs text-[#B9BBBE]">
                                {formatDate(match.createdAt)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getStatusBadge(match.status)}
                              {match.status === 'COMPLETED' && 
                                getResultBadge(getMatchResult(match))
                              }
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <ChevronDown className="h-4 w-4 text-[#B9BBBE]" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {playerMatches.length > 5 && (
                          <Button variant="secondary" className="w-full mt-2">
                            View All Matches
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setSelectedPlayer(null)}
                  >
                    Back to List
                  </Button>
                  <Button 
                    className="flex-1 bg-[#5865F2] hover:bg-[#4752C4]"
                    onClick={handleEditPlayer}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Player
                  </Button>
                </div>
              </div>
            ) : (
              <Card className="bg-[#2F3136] border-black/10 h-full flex flex-col items-center justify-center text-center p-6">
                <User className="h-16 w-16 text-[#B9BBBE]/20 mb-4" />
                <h3 className="text-white text-lg font-medium mb-2">No Player Selected</h3>
                <p className="text-[#B9BBBE] mb-4">
                  Select a player from the list to view their detailed statistics and match history.
                </p>
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    if (players && players.length > 0) {
                      setSelectedPlayer(players[0]);
                    }
                  }}
                  disabled={!players || players.length === 0}
                >
                  View First Player
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Edit Player Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-[#36393F] text-white border-none shadow-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">Edit Player</DialogTitle>
            <DialogDescription className="text-[#B9BBBE]">
              Update player settings and statistics.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-3">
            <div className="flex items-center gap-3 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarImage 
                  src={selectedPlayer?.avatar 
                    ? `https://cdn.discordapp.com/avatars/${selectedPlayer.discordId}/${selectedPlayer.avatar}.png` 
                    : undefined
                  } 
                  alt={selectedPlayer?.username} 
                />
                <AvatarFallback className="bg-[#5865F2] text-white text-xl">
                  {selectedPlayer ? getInitials(selectedPlayer.username) : '??'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-white text-lg font-medium">
                  {selectedPlayer?.username}#{selectedPlayer?.discriminator}
                </h3>
                <p className="text-[#B9BBBE] text-sm">ID: {selectedPlayer?.id}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mmr" className="text-[#DCDDDE] text-sm">MMR</Label>
              <Input 
                id="mmr" 
                type="number" 
                min="0"
                className="bg-[#40444B] border-none text-white"
                value={editPlayerData.mmr}
                onChange={(e) => setEditPlayerData(prev => ({
                  ...prev,
                  mmr: parseInt(e.target.value) || 0
                }))}
              />
            </div>
            
            <div className="space-y-2 mt-4">
              <Label htmlFor="xboxGamertag" className="text-[#DCDDDE] text-sm">Xbox Gamertag</Label>
              <Input 
                id="xboxGamertag" 
                type="text" 
                className="bg-[#40444B] border-none text-white"
                value={editPlayerData.xboxGamertag || ''}
                onChange={(e) => setEditPlayerData(prev => ({
                  ...prev,
                  xboxGamertag: e.target.value || null
                }))}
              />
            </div>
            
            <div className="space-y-2 mt-4">
              <Label htmlFor="xuid" className="text-[#DCDDDE] text-sm">XUID</Label>
              <Input 
                id="xuid" 
                type="text" 
                className="bg-[#40444B] border-none text-white"
                value={editPlayerData.xuid || ''}
                onChange={(e) => setEditPlayerData(prev => ({
                  ...prev,
                  xuid: e.target.value || null
                }))}
              />
            </div>

            <div className="flex items-center space-x-2 my-6">
              <Switch 
                id="isActive"
                checked={editPlayerData.isActive}
                onCheckedChange={(checked) => setEditPlayerData(prev => ({
                  ...prev,
                  isActive: checked
                }))}
                className="data-[state=checked]:bg-[#5865F2]"
              />
              <Label htmlFor="isActive" className="text-[#DCDDDE]">Player is active</Label>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              className="bg-[#36393F] hover:bg-[#2F3136] border-[#202225] text-white"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={handleSavePlayer}
              disabled={updatePlayerMutation.isPending}
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white"
            >
              {updatePlayerMutation.isPending ? (
                <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}