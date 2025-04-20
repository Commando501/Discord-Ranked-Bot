import { Link } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { useSidebar } from "@/hooks/use-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/auth-context";

export default function NavigationHeader() {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Button variant="ghost" onClick={toggleSidebar} className="mr-2 px-2 text-base">
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
import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSidebar } from "@/hooks/use-sidebar";

export default function NavigationHeader() {
  return (
    <SidebarProvider>
      <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Late League Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Other navigation items like profile, notifications, etc. */}
        </div>
      </header>
    </SidebarProvider>
  );
}
