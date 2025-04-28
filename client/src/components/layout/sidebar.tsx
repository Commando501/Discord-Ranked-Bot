import { Link, useLocation } from "wouter";

export default function Sidebar() {
  const [location] = useLocation();
  
  const isActive = (path: string) => location === path;
  
  const getNavItemClasses = (path: string) => {
    return `flex items-center px-2 py-1.5 rounded hover:bg-[#40444B] transition-colors ${
      isActive(path) 
        ? 'bg-[#5865F2]/10 text-[#5865F2]' 
        : 'text-[#DCDDDE]'
    }`;
  };

  return (
    <div className="w-60 bg-[#2F3136] flex-shrink-0 border-r border-black/20">
      <div className="p-3">
        <div className="text-[#B9BBBE] uppercase text-xs font-semibold mb-2 mt-2 px-2">
          Bot Management
        </div>
        <div className="space-y-1">
          <Link href="/" className={getNavItemClasses("/")}>
            <i className="ri-dashboard-line mr-2"></i>
            <span>Dashboard</span>
          </Link>
          <Link href="/admin" className={getNavItemClasses("/admin")}>
            <i className="ri-user-settings-line mr-2"></i>
            <span>Admin Settings</span>
          </Link>
          <Link href="/config" className={getNavItemClasses("/config")}>
            <i className="ri-settings-3-line mr-2"></i>
            <span>Bot Configuration</span>
          </Link>
          <Link href="/database-management" className={getNavItemClasses("/database-management")}>
            <i className="ri-database-2-line mr-2"></i>
            <span>Database Management</span>
          </Link>
        </div>

        <div className="text-[#B9BBBE] uppercase text-xs font-semibold mb-2 mt-5 px-2">
          Matchmaking
        </div>
        <div className="space-y-1">
          <Link href="/queue" className={getNavItemClasses("/queue")}>
            <i className="ri-team-line mr-2"></i>
            <span>Current Queue</span>
          </Link>
          <Link href="/matches" className={getNavItemClasses("/matches")}>
            <i className="ri-sword-line mr-2"></i>
            <span>Active Matches</span>
          </Link>
          <Link href="/history" className={getNavItemClasses("/history")}>
            <i className="ri-history-line mr-2"></i>
            <span>Match History</span>
          </Link>
        </div>

        <div className="text-[#B9BBBE] uppercase text-xs font-semibold mb-2 mt-5 px-2">
          Players
        </div>
        <div className="space-y-1">
          <Link href="/players" className={getNavItemClasses("/players")}>
            <i className="ri-user-line mr-2"></i>
            <span>Player Profiles</span>
          </Link>
          <Link href="/leaderboards" className={getNavItemClasses("/leaderboards")}>
            <i className="ri-trophy-line mr-2"></i>
            <span>Leaderboards</span>
          </Link>
        </div>

        <div className="text-[#B9BBBE] uppercase text-xs font-semibold mb-2 mt-5 px-2">
          Seasons
        </div>
        <div className="space-y-1">
          <Link href="/seasons" className={getNavItemClasses("/seasons")}>
            <i className="ri-calendar-line mr-2"></i>
            <span>Manage Seasons</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
