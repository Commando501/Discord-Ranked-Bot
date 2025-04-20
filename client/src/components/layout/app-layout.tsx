
import React from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, Sidebar, SidebarContent, SidebarInset } from "@/components/ui/sidebar";
import NavigationHeader from "./navigation-header";
import Sidebar2 from "./sidebar";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarContent>
            <Sidebar2 />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <NavigationHeader />
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
