import * as React from "react"
import { createContext, useState, useCallback, useMemo } from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { useMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


const SIDEBAR_COOKIE_NAME = "sidebar:state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContextType = {
  isOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
};

export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const value = useMemo(() => ({
    isOpen,
    toggleSidebar,
    setSidebarOpen,
  }), [isOpen, toggleSidebar, setSidebarOpen]);

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

const sidebarVariants = cva(
  "h-full bg-background flex flex-col border-r transition-all duration-300",
  {
    variants: {
      variant: {
        default: "",
        expanded: `w-[${SIDEBAR_WIDTH}]`,
        collapsed: `w-[${SIDEBAR_WIDTH_ICON}]`,
        mobile: `w-[${SIDEBAR_WIDTH_MOBILE}]`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface SidebarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sidebarVariants> {
  asChild?: boolean
}

function SidebarComponent({
  className,
  variant,
  asChild = false,
  ...props
}: SidebarProps) {
  const Comp = asChild ? Slot : "div"
  return (
    <Comp
      className={cn(sidebarVariants({ variant }), className)}
      {...props}
    />
  )
}

interface SidebarContentProps {
  children: React.ReactNode
}

function SidebarContent({ children }: SidebarContentProps) {
  const { isOpen } = React.useContext(SidebarContext) || { isOpen: false };
  const isMobile = useMobile();

  if (isMobile) {
    return (
      <Sheet open={isOpen}>
        <SheetContent side="left" className="p-0 w-[18rem]">
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <SidebarComponent
      variant={isOpen ? "expanded" : "collapsed"}
      className="hidden md:flex"
    >
      {children}
    </SidebarComponent>
  )
}

interface SidebarHeaderProps {
  children: React.ReactNode
}

function SidebarHeader({ children }: SidebarHeaderProps) {
  return (
    <div className="flex items-center px-4 py-2 h-14">
      {children}
    </div>
  )
}

interface SidebarTriggerProps {
  children?: React.ReactNode
}

function SidebarTrigger({ children }: SidebarTriggerProps) {
  const { toggleSidebar } = React.useContext(SidebarContext) || { toggleSidebar: () => {} };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={toggleSidebar}
          >
            <PanelLeft className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Toggle Sidebar</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface SidebarSearchProps {
  placeholder?: string
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}

function SidebarSearch({
  placeholder = "Search...",
  onChange,
}: SidebarSearchProps) {
  const { isOpen } = React.useContext(SidebarContext) || { isOpen: false };
  if (!isOpen) return null

  return (
    <div className="px-4 py-2">
      <Input
        type="search"
        placeholder={placeholder}
        className="h-8"
        onChange={onChange}
      />
    </div>
  )
}

interface SidebarSectionProps {
  children: React.ReactNode
  title?: string
}

function SidebarSection({ children, title }: SidebarSectionProps) {
  const { isOpen } = React.useContext(SidebarContext) || { isOpen: false };
  return (
    <div className="py-2">
      {title && isOpen && (
        <h3 className="px-4 text-xs font-medium text-muted-foreground">
          {title}
        </h3>
      )}
      {!title && <Separator />}
      <div className="grid gap-1 p-1">{children}</div>
    </div>
  )
}

interface SidebarItemProps
  extends Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "target" | "rel"
  > {
  href: string
  active?: boolean
  icon?: React.ReactNode
  text?: string
  external?: boolean
}

function SidebarItem({
  href,
  active,
  icon,
  text,
  external,
  ...props
}: SidebarItemProps) {
  const { isOpen } = React.useContext(SidebarContext) || { isOpen: false };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
              !isOpen && "justify-center px-0"
            )}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            {...props}
          >
            {icon && (
              <span className={cn("h-4 w-4", text && isOpen && "mr-2")}>
                {icon}
              </span>
            )}
            {text && isOpen && <span>{text}</span>}
          </a>
        </TooltipTrigger>
        {!isOpen && <TooltipContent side="right">{text}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  )
}

interface SidebarItemSkeletonProps {
  isItemExpanded?: boolean
}

function SidebarItemSkeleton({
  isItemExpanded = false,
}: SidebarItemSkeletonProps) {
  const { isOpen } = React.useContext(SidebarContext) || { isOpen: false };
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2",
        !isOpen && "justify-center px-0"
      )}
    >
      <Skeleton
        className={cn(
          "h-4 w-4",
          isOpen && isItemExpanded && "mr-2",
          !isOpen && "h-8 w-8"
        )}
      />
      {isOpen && isItemExpanded && (
        <Skeleton className="h-4 w-[50%]" />
      )}
    </div>
  )
}

export const Sidebar = {
  Content: SidebarContent,
  Header: SidebarHeader,
  Trigger: SidebarTrigger,
  Search: SidebarSearch,
  Section: SidebarSection,
  Item: SidebarItem,
  Skeleton: SidebarItemSkeleton,
}