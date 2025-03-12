import { useQuery } from "@tanstack/react-query";

interface Player {
  id: number;
  username: string;
  discriminator: string;
  mmr: number;
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
}

export default function ActiveMatchesPanel() {
  const { data: matches, isLoading } = useQuery<Match[]>({
    queryKey: ['/api/matches/active'],
  });

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'bg-[#FAA61A]/20 text-[#FAA61A]';
      case 'ACTIVE':
        return 'bg-[#3BA55C]/20 text-[#3BA55C]';
      default:
        return 'bg-[#5865F2]/20 text-[#5865F2]';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'READY CHECK';
      case 'ACTIVE':
        return 'IN PROGRESS';
      default:
        return status;
    }
  };

  const getBorderColor = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'border-[#FAA61A]';
      case 'ACTIVE':
        return 'border-[#3BA55C]';
      default:
        return 'border-[#5865F2]';
    }
  };

  const getTimeSinceCreation = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    
    const minutes = Math.floor(diffMs / (1000 * 60));
    
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="bg-[#2F3136] rounded-lg shadow-sm">
      <div className="border-b border-black/20 p-4">
        <h2 className="text-white font-semibold">Active Matches</h2>
      </div>
      <div className="p-4">
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-4 text-[#B9BBBE]">Loading matches...</div>
          ) : matches?.length === 0 ? (
            <div className="text-center py-4 text-[#B9BBBE]">No active matches</div>
          ) : (
            matches?.map((match) => (
              <div 
                key={match.id} 
                className={`bg-[#40444B] rounded-md p-3 border-l-4 ${getBorderColor(match.status)}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-[#DCDDDE]">Match #{match.id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadgeClasses(match.status)}`}>
                    {getStatusText(match.status)}
                  </span>
                </div>
                <div className="text-xs text-[#B9BBBE] mb-3">
                  Started {getTimeSinceCreation(match.createdAt)}
                </div>
                <div className="flex justify-between text-sm">
                  {match.teams.map((team) => (
                    <div key={team.id}>
                      <div className="font-medium mb-1 text-[#DCDDDE]">Team {team.name}</div>
                      <div className="text-[#B9BBBE] text-xs">Avg. MMR: {team.avgMMR}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
