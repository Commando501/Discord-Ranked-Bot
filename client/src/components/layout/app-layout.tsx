import { ReactNode } from "react";
import NavigationHeader from "./navigation-header";
import Sidebar from "./sidebar";
import StatusBar from "./status-bar";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-[#36393F] text-[#DCDDDE]">
      <NavigationHeader />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      
      <StatusBar />
    </div>
  );
}
