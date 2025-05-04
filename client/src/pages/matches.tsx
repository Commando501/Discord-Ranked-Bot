import { useQuery } from "@tanstack/react-query";
import { Clock, Award, Users, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/layout/app-layout";
import { apiRequest } from "@/lib/queryClient";

interface Player {
  id: number;
  username: string;
  discriminator: string;
  mmr: number;
  avatar: string | null;
  discordId: string;
}

interface Team {
  id: number;
  name: string;
  avgMMR: number;
  players: Player[];
}

interface Match {
  id: number;
  status: string;
  createdAt: string;
  teams: Team[];
  map?: string;
  server?: string;
}

export default function MatchesPage() {
  const { toast } = useToast();
  
  const { data: matches, isLoading, refetch } = useQuery<Match[]>({
    queryKey: ['/api/matches/active'],
  });

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Matches refreshed",
      description: "Active matches data has been updated.",
    });
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
      case 'ACTIVE':
        return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
      case 'PAUSED':
        return 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30';
      default:
        return 'bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'READY CHECK';
      case 'ACTIVE':
        return 'IN PROGRESS';
      case 'PAUSED':
        return 'PAUSED';
      default:
        return status;
    }
  };

  const getBorderColor = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'border-amber-500/40';
      case 'ACTIVE':
        return 'border-emerald-500/40';
      case 'PAUSED':
        return 'border-indigo-500/40';
      default:
        return 'border-[#5865F2]/40';
    }
  };

  const getTimeSinceCreation = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    
    const minutes = Math.floor(diffMs / (1000 * 60));
    
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }
  };

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const handleCancelMatch = async (matchId: number) => {
    try {
      await apiRequest('POST', `/api/matches/${matchId}/cancel`);
      toast({
        title: "Match cancelled",
        description: "The match has been cancelled and players returned to queue.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel match. Try using Discord commands instead.",
        variant: "destructive"
      });
    }
  };
  
  const handleCancelResetMatch = async (matchId: number) => {
    try {
      await apiRequest('POST', `/api/matches/${matchId}/cancel-reset`);
      toast({
        title: "Match reset",
        description: "The match has been cancelled WITHOUT returning players to queue.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset match. Try using Discord commands instead.",
        variant: "destructive"
      });
    }
  };

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-white">Active Matches</h1>
            <p className="text-[#B9BBBE]">Monitor ongoing matches and their status.</p>
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

        {isLoading ? (
          <div className="flex flex-col items-center justify-center bg-[#2F3136] rounded-lg p-10">
            <RefreshCcw className="animate-spin h-8 w-8 text-[#5865F2] mb-4" />
            <p className="text-[#B9BBBE]">Loading active matches...</p>
          </div>
        ) : matches?.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-[#2F3136] rounded-lg p-10 text-center">
            <div className="text-[#5865F2] text-5xl mb-4">🎮</div>
            <h3 className="text-lg font-medium text-white mb-2">No Active Matches</h3>
            <p className="text-[#B9BBBE] max-w-md">
              There are currently no ongoing matches. Players can create matches by joining the queue with the <code>/queue</code> command.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {matches?.map(match => (
              <div 
                key={match.id} 
                className={`bg-[#2F3136] rounded-lg overflow-hidden border-l-4 ${getBorderColor(match.status)}`}
              >
                <div className="p-4 border-b border-black/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-white">Match #{match.id}</h3>
                      <div className="text-xs text-[#B9BBBE]">Started {getTimeSinceCreation(match.createdAt)}</div>
                    </div>
                    <Badge className={`${getStatusBadgeClasses(match.status)}`}>
                      {getStatusText(match.status)}
                    </Badge>
                  </div>
                  
                  {(match.map || match.server) && (
                    <div className="flex mt-3 text-xs">
                      {match.map && (
                        <div className="flex items-center mr-4 text-[#B9BBBE]">
                          <Award className="h-4 w-4 mr-1" />
                          Map: <span className="text-white ml-1">{match.map}</span>
                        </div>
                      )}
                      {match.server && (
                        <div className="flex items-center text-[#B9BBBE]">
                          <Clock className="h-4 w-4 mr-1" />
                          Server: <span className="text-white ml-1">{match.server}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {match.teams.map(team => (
                      <div key={team.id} className="bg-[#40444B] rounded-md p-3">
                        <div className="flex items-center mb-2">
                          <div className="text-white font-medium">Team {team.name}</div>
                          <div className="ml-auto text-xs bg-[#5865F2]/20 text-[#5865F2] px-2 py-0.5 rounded">
                            Avg MMR: {team.avgMMR}
                          </div>
                        </div>
                        
                        <Separator className="bg-black/20 my-2" />
                        
                        <div className="space-y-2 mt-2">
                          {team.players.map(player => (
                            <div key={player.id} className="flex items-center">
                              <Avatar className="h-6 w-6 mr-2">
                                <AvatarImage 
                                  src={player.avatar 
                                    ? `https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatar}.png` 
                                    : undefined
                                  } 
                                  alt={player.username} 
                                />
                                <AvatarFallback className="bg-[#5865F2] text-[9px]">
                                  {getInitials(player.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="text-sm text-[#DCDDDE]">{player.username}</div>
                              <div className="ml-auto text-xs text-[#B9BBBE]">{player.mmr}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-black/20 flex justify-between">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="text-xs"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-xs text-red-500 border-red-500/20 hover:bg-red-500/10 hover:text-red-500"
                        onClick={() => handleCancelResetMatch(match.id)}
                      >
                        Cancel - Reset
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        className="text-xs"
                        onClick={() => handleCancelMatch(match.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}