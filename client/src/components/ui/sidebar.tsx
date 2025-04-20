import * as React from "react";
import { createContext, useContext, useState } from "react";

type SidebarContextType = {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  open: () => void;
};

export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, close, open }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }

  return context;
};

export {
  //Sidebar,
  //SidebarContent,
  //SidebarContext,
  //SidebarFooter,
  //SidebarGroup,
  //SidebarGroupAction,
  //SidebarGroupContent,
  //SidebarGroupLabel,
  //SidebarHeader,
  //SidebarInput,
  //SidebarInset,
  //SidebarMenu,
  //SidebarMenuAction,
  //SidebarMenuBadge,
  //SidebarMenuButton,
  //SidebarMenuItem,
  //SidebarMenuSkeleton,
  //SidebarMenuSub,
  //SidebarMenuSubButton,
  //SidebarMenuSubItem,
  //SidebarProvider,
  //SidebarRail,
  //SidebarSeparator,
  //SidebarTrigger,
  //useSidebar,
};