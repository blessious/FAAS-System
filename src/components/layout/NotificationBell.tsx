import { useState, useEffect } from "react";
import { Bell, Info, AlertTriangle, CheckCircle2, FileX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { notificationAPI } from "@/services/api";
import { useAuth } from "@/context/AuthContext.jsx";
import { toast } from "sonner";

export function NotificationBell() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { user } = useAuth();

    const fetchNotifications = async () => {
        try {
            const data = await notificationAPI.getNotifications();
            setNotifications(data);
            setUnreadCount(data.filter((n: any) => !n.is_read).length);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotifications();

            // Setup SSE for real-time notifications
            const userId = user.id;
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
            const sseUrl = `${apiBaseUrl}/api/events/stream?userId=${userId}`;
            const eventSource = new EventSource(sseUrl);

            eventSource.addEventListener('notification', (event) => {
                try {
                    const newNotif = JSON.parse(event.data);
                    setNotifications(prev => {
                        // Basic duplicate check by ID if available
                        if (prev.some(n => n.id === newNotif.id)) return prev;
                        return [newNotif, ...prev];
                    });
                    setUnreadCount(prev => prev + 1);
                } catch (err) {
                    console.error("Error parsing SSE notification:", err);
                }
            });

            return () => {
                eventSource.close();
            };
        }
    }, [user]);

    const markAsRead = async (id: number) => {
        try {
            await notificationAPI.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    const markAllRead = async () => {
        try {
            await notificationAPI.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'RECORD_SUBMITTED': return <Info className="w-4 h-4 text-blue-500" />;
            case 'RECORD_APPROVED': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'RECORD_REJECTED': return <FileX className="w-4 h-4 text-rose-500" />;
            case 'RECORD_CREATED': return <Info className="w-4 h-4 text-slate-500" />;
            case 'RECORD_UPDATED': return <Info className="w-4 h-4 text-amber-500" />;
            case 'ACTION_CANCELLED': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'RELEASE_CANCELLED': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'RECORD_RELEASED': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            default: return <Bell className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="relative bg-white hover:bg-slate-50 transition-all rounded-full h-10 w-10 shadow-md border-slate-200 hover:shadow-lg hover:-translate-y-0.5 shrink-0"
                >
                    <Bell className="w-5 h-5 text-slate-700" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-4.5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold border-2 border-white rounded-full">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[380px] p-0 shadow-2xl border-slate-200 overflow-hidden rounded-2xl z-[100]"
                side="right"
                sideOffset={25}
                align="start"
            >
                <div className="flex items-center justify-between px-5 py-4 bg-white">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        Notifications
                        {unreadCount > 0 && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                {unreadCount} New
                            </span>
                        )}
                    </h3>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllRead} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs font-semibold h-8 px-3">
                            Mark all read
                        </Button>
                    )}
                </div>
                <Separator className="bg-slate-100" />
                <ScrollArea className="h-[400px]">
                    {notifications.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                                    className={cn(
                                        "p-5 hover:bg-slate-50 transition-all cursor-pointer group flex gap-4",
                                        !notif.is_read ? "bg-blue-50/20" : "bg-white"
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm transition-transform group-hover:scale-105",
                                        !notif.is_read ? "bg-white" : "bg-slate-50"
                                    )}>
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className={cn(
                                            "text-sm leading-relaxed",
                                            !notif.is_read ? "text-slate-900 font-semibold" : "text-slate-600"
                                        )}>
                                            {notif.message}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-medium text-slate-400">
                                                {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                            </span>
                                            {!notif.is_read && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[350px] text-slate-400 text-center px-10">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Bell className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-sm font-semibold text-slate-900 mb-1">No notifications yet</p>
                            <p className="text-xs text-slate-400">We'll let you know when something happens in your records.</p>
                        </div>
                    )}
                </ScrollArea>
                <Separator className="bg-slate-100" />
                <div className="p-3 bg-slate-50/50 text-center">
                    <Button variant="ghost" size="sm" className="w-full text-slate-500 text-xs hover:bg-slate-100 h-9 font-medium" onClick={() => fetchNotifications()}>
                        Refresh notifications
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
