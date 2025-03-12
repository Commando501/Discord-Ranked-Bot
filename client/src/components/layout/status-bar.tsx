import { useQuery } from "@tanstack/react-query";
import { BotIcon, ClockIcon, CheckCircleIcon } from "lucide-react";

interface BotStatus {
  version: string;
  status: string;
  uptime: number;
  connectedToDiscord: boolean;
}

export default function StatusBar() {
  const { data: status } = useQuery<BotStatus>({
    queryKey: ['/api/bot/status'],
  });
  
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <footer className="bg-[#2F3136] border-t border-black/20 px-4 py-2 text-[#B9BBBE] text-sm">
      <div className="flex justify-between items-center">
        <div>
          <span className="flex items-center">
            <BotIcon className="h-4 w-4 mr-1" />
            <span>
              MatchMaker Bot v{status?.version || '1.0.0'} | Using Node.js v20 & Discord.js v14
            </span>
          </span>
        </div>
        <div className="flex items-center">
          <span className="flex items-center mr-4">
            <ClockIcon className="h-4 w-4 mr-1" />
            <span>
              Uptime: {status ? formatUptime(status.uptime) : '--'}
            </span>
          </span>
          <span className={`flex items-center ${status?.connectedToDiscord ? 'text-[#3BA55C]' : 'text-[#ED4245]'}`}>
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            <span>
              {status?.connectedToDiscord ? 'Connected to Discord API' : 'Disconnected'}
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
