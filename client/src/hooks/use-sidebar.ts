
import { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isOpen: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  isMobile: boolean; // Made non-optional
  state: string; // Made non-optional
  openMobile: boolean; // Made non-optional
  setOpenMobile: (open: boolean) => void; // Made non-optional
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [openMobile, setOpenMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // Track isMobile state
  const state = isOpen ? "open" : "closed";

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const openSidebar = () => setIsOpen(true);
  const closeSidebar = () => setIsOpen(false);

  return (
    <SidebarContext.Provider
      value={{
        isOpen: isOpen,
        toggleSidebar: toggleSidebar,
        openSidebar: openSidebar,
        closeSidebar: closeSidebar,
        isMobile: isMobile,
        state: state,
        openMobile: openMobile,
        setOpenMobile: setOpenMobile,
      }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
