import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Command {
  name: string;
  description: string;
  usage: string;
}

export default function CommandsWidget() {
  const { data: commands, isLoading } = useQuery<Command[]>({
    queryKey: ['/api/bot/commands'],
  });

  return (
    <div className="bg-[#2F3136] rounded-lg shadow-sm">
      <div className="border-b border-black/20 p-4">
        <h2 className="text-white font-semibold">Bot Commands</h2>
      </div>
      <div className="p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#4F545C]">
              <TableHead className="text-[#B9BBBE] text-xs uppercase w-1/4">Command</TableHead>
              <TableHead className="text-[#B9BBBE] text-xs uppercase w-1/2">Description</TableHead>
              <TableHead className="text-[#B9BBBE] text-xs uppercase w-1/4">Usage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-4 text-[#B9BBBE]">
                  Loading commands...
                </TableCell>
              </TableRow>
            ) : commands?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-4 text-[#B9BBBE]">
                  No commands available
                </TableCell>
              </TableRow>
            ) : (
              commands?.map((command) => (
                <TableRow key={command.name} className="border-t border-[#40444B]">
                  <TableCell className="py-3 px-4 font-medium text-[#DCDDDE]">
                    {command.name}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[#DCDDDE]">
                    {command.description}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-[#B9BBBE]">
                    {command.usage}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
