import { Link } from "react-router-dom";
import { ReactNode } from "react";
import NavigationHeader from "./navigation-header";
import { useAuth } from "@/contexts/auth-context";
import { useSidebar } from "@/contexts/sidebar-context";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const { isOpen } = useSidebar();

  return (
    <div className="flex min-h-screen flex-col">
      <NavigationHeader />
      <div className="flex flex-1">
        <aside 
          className={`w-64 bg-[#202225] text-white transition-all duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed md:static top-14 bottom-0 z-40 overflow-y-auto`}
        >
          <nav className="p-2">
            <div className="space-y-1">
              <div className="text-[#B9BBBE] uppercase text-xs font-semibold mb-2 mt-2 px-2">
                Dashboard
              </div>
              <Link to="/" className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-white hover:bg-[#36393F]">
                <i className="ri-dashboard-line mr-2"></i>
                <span>Overview</span>
              </Link>
            </div>

            <div className="text-[#B9BBBE] uppercase text-xs font-semibold mb-2 mt-5 px-2">
              Matchmaking
            </div>
            <div className="space-y-1">
              <Link to="/queue" className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-white hover:bg-[#36393F]">
                <i className="ri-team-line mr-2"></i>
                <span>Current Queue</span>
              </Link>
              <Link to="/matches" className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-white hover:bg-[#36393F]">
                <i className="ri-sword-line mr-2"></i>
                <span>Active Matches</span>
              </Link>
              <Link to="/history" className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-white hover:bg-[#36393F]">
                <i className="ri-history-line mr-2"></i>
                <span>Match History</span>
              </Link>
            </div>

            <div className="text-[#B9BBBE] uppercase text-xs font-semibold mb-2 mt-5 px-2">
              Players
            </div>
            <div className="space-y-1">
              <Link to="/players" className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-white hover:bg-[#36393F]">
                <i className="ri-user-line mr-2"></i>
                <span>Player Profiles</span>
              </Link>
              <Link to="/leaderboards" className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-white hover:bg-[#36393F]">
                <i className="ri-trophy-line mr-2"></i>
                <span>Leaderboards</span>
              </Link>
            </div>

            {user && (
              <>
                <div className="text-[#B9BBBE] uppercase text-xs font-semibold mb-2 mt-5 px-2">
                  Admin
                </div>
                <div className="space-y-1">
                  <Link to="/admin" className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-white hover:bg-[#36393F]">
                    <i className="ri-admin-line mr-2"></i>
                    <span>Admin Panel</span>
                  </Link>
                  <Link to="/config" className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-white hover:bg-[#36393F]">
                    <i className="ri-settings-4-line mr-2"></i>
                    <span>Configuration</span>
                  </Link>
                </div>
              </>
            )}
          </nav>
        </aside>
        <main className="flex-1 bg-[#2F3136]">
          {children}
        </main>
      </div>
    </div>
  );
}