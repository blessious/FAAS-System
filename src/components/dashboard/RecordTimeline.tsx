import { useState, useEffect, useMemo } from "react";
import {
    Clock,
    CheckCircle,
    XCircle,
    Send,
    Plus,
    Edit,
    Trash2,
    Calendar,
    User,
    ArrowRight,
    Loader2,
    Info,
    Search,
    SortAsc,
    SortDesc,
    Trash,
    Filter
} from "lucide-react";
import { faasAPI } from "@/services/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext.jsx";
import { useToast } from "@/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ActivityLog {
    id: number;
    user_id: number;
    action: string;
    table_name: string;
    record_id: number;
    description: string;
    created_at: string;
    username: string;
    full_name: string;
    profile_picture?: string;
}

interface RecordTimelineProps {
    recordId: string | number;
    className?: string;
}

const actionConfig: Record<string, { icon: any, color: string, bg: string, label: string }> = {
    CREATE: { icon: Plus, color: "text-blue-600", bg: "bg-blue-50", label: "Created" },
    UPDATE: { icon: Edit, color: "text-amber-600", bg: "bg-amber-50", label: "Updated" },
    SUBMIT: { icon: Send, color: "text-indigo-600", bg: "bg-indigo-50", label: "Submitted" },
    APPROVE: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", label: "Approved" },
    REJECT: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-50", label: "Rejected" },
    DELETE: { icon: Trash2, color: "text-gray-600", bg: "bg-gray-50", label: "Deleted" },
    CANCEL_ACTION: { icon: Clock, color: "text-gray-600", bg: "bg-gray-50", label: "Cancelled" },
};

export function RecordTimeline({ recordId, className }: RecordTimelineProps) {
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const { user } = useAuth() as any;
    const { toast } = useToast();
    const isAdmin = user?.role === 'administrator';

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const response = await faasAPI.getRecordHistory(recordId);
            if (response.success) {
                setActivities(response.data);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
            setError("Failed to load history");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (recordId) {
            fetchHistory();
        }
    }, [recordId]);

    const handleDeleteEntry = async (logId: number) => {
        try {
            await faasAPI.deleteHistoryEntry(logId);
            toast({
                title: "Entry Deleted",
                description: "The history entry has been removed.",
            });
            fetchHistory();
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.error || "Failed to delete entry",
                variant: "destructive",
            });
        }
    };

    const handleClearHistory = async () => {
        try {
            await faasAPI.clearRecordHistory(recordId);
            toast({
                title: "History Cleared",
                description: "All history for this record has been removed.",
            });
            fetchHistory();
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.error || "Failed to clear history",
                variant: "destructive",
            });
        }
    };

    const filteredAndSortedActivities = useMemo(() => {
        let result = [...activities];

        // Filter by search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(a =>
                a.description.toLowerCase().includes(q) ||
                a.action.toLowerCase().includes(q) ||
                a.full_name.toLowerCase().includes(q)
            );
        }

        // Filter by action type
        if (actionFilter !== "all") {
            result = result.filter(a => a.action === actionFilter);
        }

        // Filter by date
        if (dateFilter) {
            result = result.filter(a => {
                const activityDate = new Date(a.created_at).toISOString().split('T')[0];
                return activityDate === dateFilter;
            });
        }

        // Sort by date
        result.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [activities, searchQuery, actionFilter, dateFilter, sortOrder]);

    const actionTypes = useMemo(() => {
        const types = new Set(activities.map(a => a.action));
        return Array.from(types);
    }, [activities]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                </div>
                <p className="text-sm text-gray-500 font-medium">Loading record progress...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                <Info className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-6 py-2", className)}>
            {/* Filters Bar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-2 text-gray-700">
                        <Filter className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
                    </div>
                </div>

                <div className="p-4 space-y-3 bg-white">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search history..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 text-sm bg-white border-gray-200 focus-visible:ring-blue-500/20 w-full"
                        />
                    </div>

                    {/* Filter Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Date Filter */}
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="pl-9 pr-8 h-10 text-sm bg-white border-gray-200 focus-visible:ring-blue-500/20 w-full"
                            />
                            {dateFilter && (
                                <button
                                    onClick={() => setDateFilter("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Action Type Filter */}
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="h-10 text-sm bg-white border-gray-200">
                                <SelectValue placeholder="All Actions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                {actionTypes.map(action => (
                                    <SelectItem key={action} value={action}>
                                        {actionConfig[action]?.label || action}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                            className="h-8 px-3 gap-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                            {sortOrder === "desc" ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                            <span className="text-xs font-medium">{sortOrder === "desc" ? "Newest" : "Oldest"} First</span>
                        </Button>

                        {isAdmin && activities.length > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-3 gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                    >
                                        <Trash className="w-4 h-4" />
                                        <span className="text-xs font-medium">Clear All</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Clear Record History?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete all activity logs for this record. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleClearHistory}
                                            className="bg-rose-600 hover:bg-rose-700"
                                        >
                                            Clear History
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </div>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between px-1">
                <p className="text-xs text-gray-600">
                    Showing {filteredAndSortedActivities.length} of {activities.length} entries
                </p>
                {(searchQuery || dateFilter || actionFilter !== "all") && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearchQuery("");
                            setDateFilter("");
                            setActionFilter("all");
                        }}
                        className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                    >
                        Clear filters
                    </Button>
                )}
            </div>

            {/* Timeline */}
            {filteredAndSortedActivities.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">No history entries found</h3>
                    <p className="text-xs text-gray-500">
                        {searchQuery || dateFilter || actionFilter !== "all"
                            ? "Try adjusting your filters"
                            : "No activity has been recorded for this record yet"}
                    </p>
                </div>
            ) : (
                <div className="relative">
                    {/* Timeline Line */}
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-indigo-200 to-purple-200" />

                    {/* Timeline Items */}
                    <div className="space-y-4">
                        {filteredAndSortedActivities.map((activity) => {
                            const config = actionConfig[activity.action] || {
                                icon: Info,
                                color: "text-gray-600",
                                bg: "bg-gray-50",
                                label: activity.action
                            };
                            const Icon = config.icon;

                            return (
                                <div key={activity.id} className="relative pl-14 group">
                                    {/* Timeline Node */}
                                    <div className={cn(
                                        "absolute left-0 top-0 w-10 h-10 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 transition-transform group-hover:scale-110 duration-200",
                                        config.bg
                                    )}>
                                        <Icon className={cn("w-4 h-4", config.color)} />
                                    </div>

                                    {/* Content Card */}
                                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 group-hover:border-blue-200">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                <div className="flex items-center flex-wrap gap-2">
                                                    <span className={cn(
                                                        "text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5",
                                                        config.bg,
                                                        config.color
                                                    )}>
                                                        <Icon className="w-3 h-3" />
                                                        {config.label}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-gray-400">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <time className="text-xs font-medium">
                                                            {new Date(activity.created_at).toLocaleDateString('en-PH', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </time>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-900 leading-relaxed">
                                                    {activity.description}
                                                </p>
                                            </div>

                                            {/* User Avatar and Actions */}
                                            <div className="flex items-start gap-2">
                                                <Avatar className="w-9 h-9 ring-2 ring-white shadow-sm flex-shrink-0">
                                                    {activity.profile_picture ? (
                                                        <AvatarImage src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${activity.profile_picture}`} />
                                                    ) : null}
                                                    <AvatarFallback className="text-xs font-bold bg-gray-100 text-gray-600">
                                                        {activity.full_name ? activity.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
                                                    </AvatarFallback>
                                                </Avatar>

                                                {isAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteEntry(activity.id)}
                                                        className="w-8 h-8 rounded-full text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors lg:opacity-0 lg:group-hover:opacity-100 flex-shrink-0"
                                                        title="Delete entry"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <User className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="text-xs font-medium text-gray-600">
                                                    {activity.full_name}
                                                </span>
                                            </div>

                                            {activity.action === 'REJECT' && (
                                                <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-semibold">Action Required</span>
                                                </div>
                                            )}

                                            {activity.action === 'APPROVE' && (
                                                <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-semibold">Verified</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}