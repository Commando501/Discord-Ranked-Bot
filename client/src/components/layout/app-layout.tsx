import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NavigationHeader from "./navigation-header";
import Sidebar from "./sidebar";
import { useMobile } from "../../hooks/use-mobile";
import StatusBar from "./status-bar";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 1000,
    },
  },
});

interface AppLayoutProps {
  user?: {
    id: string;
    username: string;
    avatar?: string;
  };
}

export default function AppLayout({ user }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMobile = useMobile();

  // On mobile, sidebar is closed by default
  const sidebarOpen = isMobile ? false : isSidebarOpen;

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen flex-col overflow-hidden bg-[#36393F] text-white">
        <NavigationHeader toggleSidebar={toggleSidebar} user={user} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar isOpen={sidebarOpen} setIsOpen={setIsSidebarOpen} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
        <StatusBar />
      </div>
    </QueryClientProvider>
  );
}