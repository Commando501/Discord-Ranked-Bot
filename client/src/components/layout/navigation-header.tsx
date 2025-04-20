import { Button } from "@/components/ui/button";
import { GamepadIcon, Settings, HelpCircle } from "lucide-react";

export default function NavigationHeader() {
  return (
    <header className="bg-[#2F3136] px-4 py-3 border-b border-black/20 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-[#5865F2] text-2xl">
            <GamepadIcon />
          </div>
          <h1 className="text-white font-bold text-xl">MatchMaker Bot</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="text-[#B9BBBE] hover:text-white">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-[#B9BBBE] hover:text-white">
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
