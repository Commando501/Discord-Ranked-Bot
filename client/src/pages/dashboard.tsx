import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/app-layout";
import StatCard from "@/components/stat-card";
import QueuePanel from "@/components/queue-panel";
import CommandsWidget from "@/components/commands-widget";
import ActiveMatchesPanel from "@/components/active-matches-panel";
import PlayerStatsPanel from "@/components/player-stats-panel";
import { GamepadIcon, SwordIcon, TrophyIcon } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/stats'],
  });
  
  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard 
            title="Players in Queue" 
            value={isLoadingStats ? "..." : stats?.queueCount.toString() || "0"}
            icon={<GamepadIcon />}
            color="primary"
          />
          
          <StatCard 
            title="Active Matches" 
            value={isLoadingStats ? "..." : stats?.activeMatchesCount.toString() || "0"}
            icon={<SwordIcon />}
            color="green"
          />
          
          <StatCard 
            title="Current Season" 
            value="Season 1"
            icon={<TrophyIcon />}
            color="pink"
          />
        </div>
        
        <CommandsWidget />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <QueuePanel />
          </div>
          
          <div>
            <ActiveMatchesPanel />
          </div>
        </div>
        
        <div className="mt-6">
          <PlayerStatsPanel />
        </div>
      </div>
    </AppLayout>
  );
}
