import { Link } from "react-router-dom";
import { Menu, LogOut, Sun, Moon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { useSidebar } from "@/contexts/sidebar-context";

export default function NavigationHeader() {
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toggleSidebar } = useSidebar();

  // Create a simple theme toggle component
  const ThemeToggle = () => {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Button 
            variant="ghost" 
            className="mr-2 px-2 text-base"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-bold">Late League Bot</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center">
            <div className="flex items-center gap-2">
              {user && (
                <div className="flex items-center gap-2">
                  <span className="text-sm hidden md:inline-block">Logged in as {user.username}</span>
                  <Button variant="ghost" size="sm" onClick={logout}>
                    <LogOut className="h-4 w-4 mr-1" />
                    <span className="hidden md:inline-block">Logout</span>
                  </Button>
                </div>
              )}
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}