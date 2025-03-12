import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RefreshCcw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/app-layout";
import { apiRequest } from "@/lib/queryClient";

interface QueuePlayer {
  player: {
    id: number;
    username: string;
    discriminator: string;
    avatar: string | null;
    mmr: number;
    discordId: string;
  };
  joinedAt: string;
}

export default function QueuePage() {
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);
  
  const { data: queuePlayers, isLoading, refetch } = useQuery<QueuePlayer[]>({
    queryKey: ['/api/queue'],
  });

  const { data: botConfig } = useQuery<{
    matchmaking?: {
      minimumQueueSize?: number
    }
  }>({
    queryKey: ['/api/config'],
  });
  
  const requiredPlayers = botConfig?.matchmaking?.minimumQueueSize || 10;
  
  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Queue refreshed",
      description: "Queue data has been updated.",
    });
  };
  
  const handleForceMatch = async () => {
    try {
      await apiRequest('/api/queue/force-match', 'POST');
      toast({
        title: "Match created",
        description: "A match has been forcibly created from the current queue.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create match. Try using Discord commands instead.",
        variant: "destructive"
      });
    }
  };
  
  const handleResetQueue = async () => {
    try {
      await apiRequest('/api/queue/reset', 'POST');
      toast({
        title: "Queue reset",
        description: "The queue has been cleared.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset queue. Try using Discord commands instead.",
        variant: "destructive"
      });
    }
  };
  
  const handleRemovePlayer = async (playerId: number) => {
    try {
      await apiRequest(`/api/queue/remove/${playerId}`, 'POST');
      toast({
        title: "Player removed",
        description: "Player has been removed from the queue.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove player. Try using Discord commands instead.",
        variant: "destructive"
      });
    }
  };
  
  const getWaitingTime = (joinedAt: string) => {
    const joined = new Date(joinedAt);
    const now = new Date();
    const diffMs = now.getTime() - joined.getTime();
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };
  
  const displayedPlayers = showAll 
    ? queuePlayers 
    : queuePlayers?.slice(0, 5);

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2 text-white">Current Queue</h1>
          <p className="text-[#B9BBBE]">View and manage players currently in the matchmaking queue.</p>
        </div>

        <div className="bg-[#2F3136] rounded-lg shadow-sm">
          <div className="border-b border-black/20 p-4 flex justify-between items-center">
            <div>
              <h2 className="text-white font-semibold">Queue Status</h2>
              <p className="text-sm text-[#B9BBBE]">
                {queuePlayers?.length || 0} players in queue ({requiredPlayers} required)
              </p>
            </div>
            <div>
              <Button 
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCcw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
          
          <div className="p-4">
            <div className="mb-4">
              <div className="text-sm text-[#B9BBBE] mb-2">Queue Progress</div>
              <div className="h-4 bg-[#4F545C] rounded-full w-full">
                <Progress 
                  value={queuePlayers ? (queuePlayers.length / requiredPlayers) * 100 : 0} 
                  className="h-4" 
                />
              </div>
            </div>
            
            <div className="space-y-2 mt-6">
              {isLoading ? (
                <div className="text-center py-8 text-[#B9BBBE]">
                  <RefreshCcw className="animate-spin h-6 w-6 mx-auto mb-2" />
                  Loading queue...
                </div>
              ) : queuePlayers?.length === 0 ? (
                <div className="text-center py-8 text-[#B9BBBE]">
                  <div className="text-[#5865F2] text-5xl mb-2">😴</div>
                  Queue is empty. Players can join via Discord using the <code>/queue</code> command.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3">
                    {displayedPlayers?.map((entry) => (
                      <div 
                        key={entry.player.id} 
                        className="flex items-center p-3 bg-[#40444B] rounded-md hover:bg-[#36393F] transition"
                      >
                        <Avatar className="h-10 w-10 mr-3">
                          <AvatarImage 
                            src={entry.player.avatar 
                              ? `https://cdn.discordapp.com/avatars/${entry.player.discordId}/${entry.player.avatar}.png` 
                              : undefined
                            } 
                            alt={entry.player.username} 
                          />
                          <AvatarFallback className="bg-[#5865F2] text-white">
                            {getInitials(entry.player.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className="font-medium text-white">{entry.player.username}#{entry.player.discriminator}</span>
                            <span className="ml-2 text-xs bg-[#5865F2]/20 text-[#5865F2] px-2 py-0.5 rounded">
                              {entry.player.mmr} MMR
                            </span>
                          </div>
                          <div className="text-[#B9BBBE] text-xs">
                            Waiting for {getWaitingTime(entry.joinedAt)}
                          </div>
                        </div>
                        <div>
                          <button 
                            className="text-[#ED4245] hover:bg-[#ED4245]/10 p-1 rounded transition-colors"
                            onClick={() => handleRemovePlayer(entry.player.id)}
                            aria-label="Remove player"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {queuePlayers && queuePlayers.length > 5 && (
                    <div className="mt-4">
                      <Button 
                        variant="secondary" 
                        className="w-full"
                        onClick={() => setShowAll(!showAll)}
                      >
                        {showAll ? "Show Less" : `Show All Players (${queuePlayers.length})`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="mt-6 flex space-x-3 border-t border-black/20 pt-4">
              <Button 
                onClick={handleForceMatch} 
                className="flex-1"
                disabled={queuePlayers?.length === 0}
              >
                Force Match Creation
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleResetQueue}
                disabled={queuePlayers?.length === 0}
              >
                Clear Queue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}