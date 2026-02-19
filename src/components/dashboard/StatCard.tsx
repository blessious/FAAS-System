import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
}

const variantStyles = {
  default: "bg-white border-slate-100",
  primary: "bg-white border-slate-100",
  success: "bg-white border-slate-100",
  warning: "bg-white border-slate-100",
  destructive: "bg-white border-slate-100",
};

const iconContainerStyles = {
  default: "bg-slate-50 text-slate-500",
  primary: "bg-blue-50 text-blue-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  destructive: "bg-rose-50 text-rose-600",
};

export function StatCard({ title, value, icon: Icon, trend, variant = "default" }: StatCardProps) {
  return (
    <Card className={cn(
      "group relative overflow-hidden rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300", 
      variantStyles[variant]
    )}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={cn("p-2.5 rounded-xl transition-colors duration-300", iconContainerStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {variant === "default" ? "Overview" : variant}
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {value}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 font-medium">{title}</p>
            {trend && (
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                trend.isPositive 
                  ? "bg-emerald-50 text-emerald-600" 
                  : "bg-rose-50 text-rose-600"
              )}>
                {trend.isPositive ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {trend.value}%
              </div>
            )}
          </div>
        </div>

        {/* Subtle Background Decorative Icon */}
        <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-500 pointer-events-none">
          <Icon className="w-24 h-24" />
        </div>
      </CardContent>
    </Card>
  );
}
