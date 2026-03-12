import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext.jsx";
import { chatAPI } from "@/services/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const ROLE_COLORS: Record<string, string> = {
    administrator: "text-rose-600 bg-rose-50 border-rose-100",
    approver: "text-amber-600 bg-amber-50 border-amber-100",
    encoder: "text-blue-600 bg-blue-50 border-blue-100",
};

export function ChatWindow() {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async () => {
        try {
            const data = await chatAPI.getMessages();
            setMessages(data);
        } catch (error) {
            console.error("Failed to fetch messages:", error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchMessages();

            const userId = user.id;
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
            const sseUrl = `${apiBaseUrl}/api/events/stream?userId=${userId}`;
            const eventSource = new EventSource(sseUrl);

            eventSource.addEventListener('chatMessage', (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    setMessages(prev => {
                        // Avoid duplicates
                        if (prev.some(m => m.id === msg.id)) return prev;

                        // Increment unread if not own and chat is closed
                        if (msg.user_id !== user.id && !isOpen) {
                            setUnreadCount(c => c + 1);
                        }

                        return [...prev, msg];
                    });
                } catch (err) {
                    console.error("Error parsing chat message:", err);
                }
            });

            eventSource.addEventListener('chatCleared', () => {
                setMessages([]);
                setUnreadCount(0);
            });

            return () => eventSource.close();
        }
    }, [user, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    useEffect(() => {
        const scrollToBottom = () => {
            if (scrollRef.current) {
                const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
                if (scrollArea) {
                    scrollArea.scrollTop = scrollArea.scrollHeight;
                }
            }
        };

        // Use a small timeout to ensure DOM update
        const timeout = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timeout);
    }, [messages]);

    const handleClear = async () => {
        if (!window.confirm('Clear all chat history? This cannot be undone.')) return;
        try {
            await chatAPI.clearMessages();
        } catch (error) {
            console.error("Failed to clear messages:", error);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const msg = newMessage;
            setNewMessage("");
            await chatAPI.sendMessage(msg);
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    return (
        <Popover onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="relative bg-white hover:bg-slate-50 transition-all rounded-full h-10 w-10 shadow-md border-slate-200 hover:shadow-lg hover:-translate-y-0.5 shrink-0"
                >
                    <MessageCircle className="w-5 h-5 text-slate-700" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-4.5 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold border-2 border-white rounded-full">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[400px] p-0 shadow-2xl border-slate-200 overflow-hidden rounded-2xl flex flex-col h-[500px]"
                side="right"
                sideOffset={25}
                align="start"
            >
                <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-900">Group Chat</h3>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Connect with team</p>
                    </div>
                    {user?.role === 'administrator' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClear}
                            className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                            title="Clear chat history"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                <ScrollArea ref={scrollRef} className="flex-1 p-4 bg-slate-50/30">
                    <div className="space-y-4">
                        {messages.map((msg, idx) => {
                            const isOwn = msg.user_id === user?.id;
                            const roleColor = ROLE_COLORS[msg.role] || "text-slate-600 bg-slate-50";

                            return (
                                <div key={msg.id || idx} className={cn(
                                    "flex items-end gap-2",
                                    isOwn ? "flex-row-reverse" : "flex-row"
                                )}>
                                    {/* Avatar Column */}
                                    <Avatar className="w-8 h-8 shrink-0 border border-slate-200">
                                        {msg.profile_picture ? (
                                            <AvatarImage src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${msg.profile_picture}`} />
                                        ) : null}
                                        <AvatarFallback className="bg-slate-200 text-[10px] font-bold">
                                            {msg.username?.[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    {/* Message Column */}
                                    <div className={cn(
                                        "flex flex-col max-w-[75%]",
                                        isOwn ? "items-end" : "items-start"
                                    )}>
                                        {!isOwn && (
                                            <div className="flex items-center gap-1.5 mb-1 px-1">
                                                <span className={cn(
                                                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                                                    roleColor
                                                )}>
                                                    {msg.full_name || msg.username}
                                                </span>
                                            </div>
                                        )}

                                        <div className={cn(
                                            "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                                            isOwn
                                                ? "bg-blue-600 text-white rounded-br-none"
                                                : "bg-white text-slate-700 rounded-bl-none border border-slate-100"
                                        )}>
                                            {msg.message}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                    <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 bg-slate-50 border-none focus-visible:ring-1 focus-visible:ring-blue-100 rounded-xl"
                    />
                    <Button type="submit" size="icon" className="shrink-0 bg-blue-600 hover:bg-blue-700 rounded-xl">
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </PopoverContent>
        </Popover>
    );
}
