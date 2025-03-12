import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RefreshCcwIcon, XIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  
  const { data: queuePlayers, isLoading, refetch } = useQuery<QueuePlayer[]>({
    queryKey: ['/api/queue'],
  });
  
  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Queue refreshed",
      description: "Queue data has been updated.",
    });
  };
  
  const handleForceMatch = () => {
    toast({
      title: "Force match",
      description: "This functionality is only available in Discord.",
      variant: "destructive"
    });
  };
  
  const handleResetQueue = () => {
    toast({
      title: "Reset queue",
      description: "This functionality is only available in Discord.",
      variant: "destructive"
    });
  };
  
  const handleRemovePlayer = (playerId: number) => {
    toast({
      title: "Remove player",
      description: "This functionality is only available in Discord.",
      variant: "destructive"
    });
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
    : queuePlayers?.slice(0, 3);
    
  const requiredPlayers = 10; // This would come from the API in a full implementation

  return (
    <div className="bg-[#2F3136] rounded-lg shadow-sm">
      <div className="border-b border-black/20 p-4 flex justify-between items-center">
        <h2 className="text-white font-semibold">Current Queue</h2>
        <div>
          <Button 
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCcwIcon className="h-4 w-4 mr-1" />
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
            <div className="text-center py-4 text-[#B9BBBE]">Loading queue...</div>
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
                    className="text-[#ED4245] hover:text-opacity-80 transition-colors"
                    onClick={() => handleRemovePlayer(entry.player.id)}
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
