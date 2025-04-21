import { Button } from "@/components/ui/button";
import { GamepadIcon, Settings, HelpCircle, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";

export default function NavigationHeader() {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
  };

  return (
    <header className="bg-[#2F3136] px-4 py-3 border-b border-black/20 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-[#5865F2] text-2xl">
            <GamepadIcon />
          </div>
          <h1 className="text-white font-bold text-xl">MatchMaker Bot</h1>
          {user && (
            <span className="text-[#B9BBBE] text-sm ml-2">
              Logged in as <span className="text-[#5865F2]">{user.username}</span>
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="text-[#B9BBBE] hover:text-white">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-[#B9BBBE] hover:text-white">
            <HelpCircle className="h-5 w-5" />
          </Button>
          {user && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-[#B9BBBE] hover:text-red-400"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
