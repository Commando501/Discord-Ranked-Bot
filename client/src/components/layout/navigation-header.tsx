import React from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { useToast } from "../../hooks/use-toast";
import { useMobile } from "../../hooks/use-mobile";

interface NavigationHeaderProps {
  toggleSidebar: () => void;
  user?: {
    id: string;
    username: string;
    avatar?: string;
  };
}

export default function NavigationHeader({ toggleSidebar, user }: NavigationHeaderProps) {
  const { toast } = useToast();
  const location = useLocation();
  const isMobile = useMobile();
  const navigate = useNavigate();

  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard';
      case '/queue':
        return 'Queue Management';
      case '/matches':
        return 'Active Matches';
      case '/history':
        return 'Match History';
      case '/players':
        return 'Player Profiles';
      case '/leaderboards':
        return 'Leaderboards';
      case '/config':
        return 'Bot Configuration';
      case '/admin':
        return 'Admin Controls';
      default:
        return 'Dashboard';
    }
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        toast({
          title: "Logged out",
          description: "Successfully logged out of admin dashboard",
        });
        // Reload to trigger auth check and redirect to login
        window.location.href = '/login';
      }
    })
    .catch(err => {
      console.error('Logout error:', err);
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive"
      });
    });
  };

  return (
    <div className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-[#2F3136] px-4 md:px-6">
      {isMobile && (
        <Button variant="outline" size="icon" onClick={toggleSidebar} className="mr-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <path d="M9 3v18" />
          </svg>
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      )}

      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-[#5865F2]"
          >
            <path d="m7.5 4.27 9 5.15" />
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
          <span className="font-semibold text-lg hidden md:inline-block">Discord Match Bot</span>
        </Link>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <nav className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">{getHeaderTitle()}</h1>
          </nav>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {user && (
          <div className="flex items-center mr-2">
            <div className="mr-2 hidden md:block">
              <div className="text-sm font-medium">{user.username}</div>
              <div className="text-xs text-muted-foreground">Admin</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-[#5865F2] flex items-center justify-center overflow-hidden">
              {user.avatar ? (
                <img 
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} 
                  alt={user.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-primary"
          onClick={() => {
            toast({
              title: "Documentation",
              description: "Documentation links are coming soon.",
            });
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-5 w-5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          <span className="hidden md:inline-block">Help</span>
        </Button>

        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-5 w-5"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="hidden md:inline-block">Logout</span>
        </Button>
      </div>
    </div>
  );
}