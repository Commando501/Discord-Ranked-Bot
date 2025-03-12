import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  color: "primary" | "green" | "red" | "pink" | "yellow";
}

export default function StatCard({ title, value, icon, color }: StatCardProps) {
  const getColorClasses = () => {
    switch (color) {
      case "primary":
        return "bg-[#5865F2]/10 text-[#5865F2]";
      case "green":
        return "bg-[#3BA55C]/10 text-[#3BA55C]";
      case "red":
        return "bg-[#ED4245]/10 text-[#ED4245]";
      case "pink":
        return "bg-[#EB459E]/10 text-[#EB459E]";
      case "yellow":
        return "bg-[#FAA61A]/10 text-[#FAA61A]";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <div className="bg-[#2F3136] rounded-lg p-4 shadow-sm">
      <div className="flex items-center">
        <div className={`p-3 rounded-md ${getColorClasses()}`}>
          {icon}
        </div>
        <div className="ml-4">
          <h3 className="text-[#B9BBBE] text-sm font-medium">{title}</h3>
          <p className="text-white text-xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}
