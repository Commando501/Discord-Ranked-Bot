import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
}

export default function PlayerStatsPanel() {
  const { data: topPlayers, isLoading } = useQuery<Player[]>({
    queryKey: ['/api/players/top'],
  });

  const getInitials = (username: string) => {
    return username.substring(0, 2).toUpperCase();
  };

  const getWinRate = (wins: number, losses: number) => {
    if (wins + losses === 0) return "0.0%";
    return ((wins / (wins + losses)) * 100).toFixed(1) + "%";
  };

  const getStreakText = (winStreak: number, lossStreak: number) => {
    if (winStreak > 0) return <span className="text-[#3BA55C]">+{winStreak}</span>;
    if (lossStreak > 0) return <span className="text-[#ED4245]">-{lossStreak}</span>;
    return "-";
  };

  return (
    <div className="bg-[#2F3136] rounded-lg shadow-sm">
      <div className="border-b border-black/20 p-4 flex justify-between items-center">
        <h2 className="text-white font-semibold">Top Players</h2>
        <div>
          <a href="#" className="text-[#00AFF4] text-sm hover:underline">View All</a>
        </div>
      </div>
      <div className="p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#4F545C]">
              <TableHead className="text-[#B9BBBE] text-xs uppercase">Rank</TableHead>
              <TableHead className="text-[#B9BBBE] text-xs uppercase">Player</TableHead>
              <TableHead className="text-[#B9BBBE] text-xs uppercase">MMR</TableHead>
              <TableHead className="text-[#B9BBBE] text-xs uppercase">Wins</TableHead>
              <TableHead className="text-[#B9BBBE] text-xs uppercase">Losses</TableHead>
              <TableHead className="text-[#B9BBBE] text-xs uppercase">Win Rate</TableHead>
              <TableHead className="text-[#B9BBBE] text-xs uppercase">Streak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4 text-[#B9BBBE]">
                  Loading players...
                </TableCell>
              </TableRow>
            ) : topPlayers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4 text-[#B9BBBE]">
                  No player data available
                </TableCell>
              </TableRow>
            ) : (
              topPlayers?.map((player, index) => (
                <TableRow key={player.id} className="border-t border-[#40444B]">
                  <TableCell className="py-3 px-4 font-medium text-[#DCDDDE]">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <div className="flex items-center">
                      <Avatar className="h-6 w-6 mr-2">
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
                      <span className="text-[#DCDDDE]">
                        {player.username}#{player.discriminator}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-4 font-medium text-[#DCDDDE]">
                    {player.mmr}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[#DCDDDE]">
                    {player.wins}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[#DCDDDE]">
                    {player.losses}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[#DCDDDE]">
                    {getWinRate(player.wins, player.losses)}
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    {getStreakText(player.winStreak, player.lossStreak)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
