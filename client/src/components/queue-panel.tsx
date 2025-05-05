import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RefreshCcwIcon, XIcon, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

export default function QueuePanel() {
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const { 
    data: queuePlayers, 
    isLoading, 
    refetch,
    isRefetching
  } = useQuery<QueuePlayer[]>({
    queryKey: ['/api/queue'],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });
  
  const { data: botConfig } = useQuery<{
    matchmaking?: {
      minimumQueueSize?: number
    }
  }>({
    queryKey: ['/api/config'],
  });
  
  const requiredPlayers = botConfig?.matchmaking?.minimumQueueSize || 10;
  
  // Update the last updated timestamp whenever queue data is refreshed
  useEffect(() => {
    if (!isLoading && !isRefetching) {
      setLastUpdated(new Date());
    }
  }, [queuePlayers, isLoading, isRefetching]);

  // Set up a timer to update waiting times independently of the data refresh
  useEffect(() => {
    // Update waiting times every second
    const timer = setInterval(() => {
      // This doesn't trigger a data refetch, just forces a re-render to update the waiting times
      setLastUpdated(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
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
      
      await refetch();
      toast({
        title: "Queue reset",
        description: "The queue has been cleared successfully.",
      });
    } catch (error) {
      console.error("Error resetting queue:", error);
      toast({
        title: "Error",
        description: "Failed to reset the queue. Please try again.",
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
    
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  };
  
  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };
  
  const displayedPlayers = showAll 
    ? queuePlayers 
    : queuePlayers?.slice(0, 3);
    
  const getLastUpdatedText = () => {
    const seconds = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds} seconds ago`;
    return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="bg-[#2F3136] rounded-lg shadow-sm">
      <div className="border-b border-black/20 p-4 flex justify-between items-center">
        <div>
          <h2 className="text-white font-semibold">Current Queue</h2>
          <div className="flex items-center text-xs text-[#B9BBBE] mt-1">
            <Clock className="h-3 w-3 mr-1 opacity-70" />
            <span>Updated {getLastUpdatedText()}</span>
          </div>
        </div>
        <div>
          <Button 
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefetching}
          >
            <RefreshCcwIcon className={`h-4 w-4 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-[#B9BBBE]">
            {queuePlayers?.length || 0} players in queue ({requiredPlayers} required)
          </div>
          <div className="h-2 bg-[#4F545C] rounded-full w-40">
            <Progress 
              value={queuePlayers ? (queuePlayers.length / requiredPlayers) * 100 : 0} 
              className="h-2" 
            />
          </div>
        </div>
        
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-4 text-[#B9BBBE]">
              <RefreshCcwIcon className="animate-spin h-4 w-4 mx-auto mb-2" />
              Loading queue...
            </div>
          ) : queuePlayers?.length === 0 ? (
            <div className="text-center py-4 text-[#B9BBBE]">Queue is empty</div>
          ) : (
            displayedPlayers?.map((entry) => (
              <div 
                key={entry.player.id} 
                className="flex items-center p-3 bg-[#40444B] rounded-md"
              >
                <Avatar className="h-8 w-8 mr-3">
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
                    <span className="font-medium">{entry.player.username}#{entry.player.discriminator}</span>
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
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
          
          {queuePlayers && queuePlayers.length > 3 && (
            <div className="mt-3">
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "Show Less" : "Show All Players"}
              </Button>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex space-x-2">
          <Button onClick={handleForceMatch} className="flex-1">
            Force Match
          </Button>
          <Button variant="destructive" onClick={handleResetQueue}>
            Reset Queue
          </Button>
        </div>
      </div>
    </div>
  );
}
