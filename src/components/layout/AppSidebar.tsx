import { useState, useMemo } from "react";
import {
  LayoutDashboard,
  FileText,
  FileEdit,
  CheckCircle,
  Printer,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users
} from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext.jsx";

const NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["encoder", "approver", "administrator"] },
  { title: "New FAAS", url: "/faas/new", icon: FileText, roles: ["encoder", "administrator"] },
  { title: "Drafts", url: "/drafts", icon: FileEdit, roles: ["encoder", "administrator"] },
  { title: "Approvals", url: "/approvals", icon: CheckCircle, roles: ["approver", "administrator"] },
  { title: "Print Preview", url: "/print", icon: Printer, roles: ["encoder", "approver", "administrator"] },
  { title: "Edit Profile", url: "/settings", icon: Settings, roles: ["encoder", "approver", "administrator"] },
  { title: "User Management", url: "/users", icon: Users, roles: ["administrator"] },
] as const;


const ROLE_LABELS: Record<string, string> = {
  encoder: "Encoder",
  approver: "Approver",
  administrator: "Administrator",
};

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { user, userRole, logout } = useAuth();

  const userName = user?.full_name || user?.username || "User";
  const displayRole = userRole ? ROLE_LABELS[userRole] ?? userRole : "—";

  const visibleNavItems = useMemo(() => {
    const role = userRole?.toLowerCase?.() ?? userRole;
    if (!role) return [];
    if (role === "administrator") return [...NAV_ITEMS];
    return NAV_ITEMS.filter((item) =>
      item.roles.some((r) => r.toLowerCase() === role)
    );
  }, [userRole]);

  const handleLogout = () => {
    logout();
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-white text-slate-900 transition-all duration-300 border-r border-slate-200 sticky top-0 z-50 shadow-sm",
        collapsed ? "w-[80px]" : "w-[280px]"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center h-20 px-6 shrink-0 border-b border-slate-100">
        <div className={cn(
          "flex items-center gap-3 transition-all duration-300",
          collapsed ? "justify-center w-full" : "justify-start"
        )}>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-100 shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-slate-800">LGU RPAS</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Property System</span>
            </div>
          )}
        </div>
      </div>

      {/* User Profile Section */}
      <div className={cn(
        "px-4 mb-6 mt-5 transition-all duration-300",
        collapsed ? "opacity-0 h-0 overflow-hidden mb-0 mt-0" : "opacity-100"
      )}>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-slate-200 shrink-0 shadow-sm">
            {user?.profile_picture ? (
              <AvatarImage
                src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${user.profile_picture}`}
                className="object-cover"
              />
            ) : null}
            <AvatarFallback className="bg-blue-50 text-xs font-bold text-blue-600">
              {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-slate-800 truncate">{userName}</p>
            <p className="text-[11px] font-medium text-slate-400 truncate">{displayRole}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 space-y-8 py-2">
        <div>
          {!collapsed && (
            <p className="px-4 mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Main Menu
            </p>
          )}
          <nav className="space-y-1.5">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                end={item.url === "/dashboard"}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  "text-slate-800 hover:bg-slate-50 hover:text-slate-800",
                  collapsed && "justify-center px-0"
                )}
                activeClassName="bg-blue-50 text-blue-600 font-semibold shadow-sm shadow-blue-50/50"
              >
                <item.icon className={cn(
                  "w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  "group-[.active]:text-blue-600"
                )} />
                {!collapsed && <span className="text-[15px]">{item.title}</span>}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 mt-auto border-t border-slate-100">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full h-12 justify-start gap-3 rounded-xl text-black hover:bg-rose-50 hover:text-rose-600 transition-all duration-200",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-[15px] font-medium">Sign Out</span>}
        </Button>

        {/* Collapse Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-4 w-full flex items-center justify-center py-2 text-slate-300 hover:text-slate-500 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
}