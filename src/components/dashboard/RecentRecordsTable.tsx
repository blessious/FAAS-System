import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext.jsx";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Eye, Edit, Trash2, Calendar, User, FileText, History, AlertCircle, ChevronDown, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { RecordTimeline } from "./RecordTimeline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { dashboardAPI } from "@/services/api";

interface FAASRecord {
  id: string | number;
  arf_no: string;
  pin: string;
  owner_name: string;
  property_location: string;
  status: "draft" | "for_approval" | "approved" | "rejected";
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
  encoder_name: string;
  encoder_profile_picture?: string;
  updater_name?: string;
  updater_profile_picture?: string;
  linked_entries_count?: number;
}

interface RecentRecordsTableProps {
  records: FAASRecord[];
  onDelete?: (id: string | number) => void | Promise<void>;
  searchQuery?: string;
}

const statusStyles = {
  draft: "bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 border border-slate-200",
  for_approval: "bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 border border-amber-200",
  approved: "bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 border border-emerald-200",
  rejected: "bg-gradient-to-r from-rose-50 to-rose-100/50 text-rose-700 border border-rose-200",
} as const;

const statusLabels = {
  draft: "Draft",
  for_approval: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const rowHoverStyles = {
  draft: "hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100",
  for_approval: "hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-amber-100/30",
  approved: "hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-emerald-100/30",
  rejected: "hover:bg-gradient-to-r hover:from-rose-50/50 hover:to-rose-100/30",
} as const;

export function RecentRecordsTable({ records, onDelete, searchQuery = "" }: RecentRecordsTableProps) {
  const { isAdmin, isEncoder, isApprover } = useAuth() as { isAdmin?: boolean, isEncoder?: boolean, isApprover?: boolean };
  const navigate = useNavigate();

  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | number | null>(null);
  const [historyRecord, setHistoryRecord] = useState<FAASRecord | null>(null);

  // Nested records state
  const [expandedRootIds, setExpandedRootIds] = useState<Set<string | number>>(new Set());
  const [linkedEntriesMap, setLinkedEntriesMap] = useState<Record<string | number, FAASRecord[]>>({});
  const [loadingLinked, setLoadingLinked] = useState<Set<string | number>>(new Set());

  const fetchLinkedEntries = async (rootId: string | number) => {
    if (linkedEntriesMap[rootId] || loadingLinked.has(rootId)) return;

    try {
      setLoadingLinked(prev => new Set(prev).add(rootId));
      const entries = await dashboardAPI.getLinkedEntries(rootId);
      const sortedEntries = [...entries].sort((a, b) =>
        (a.pin || "").localeCompare(b.pin || "", undefined, { numeric: true, sensitivity: "base" })
      );
      setLinkedEntriesMap(prev => ({ ...prev, [rootId]: sortedEntries }));
    } catch (error) {
      console.error("Failed to fetch linked entries:", error);
    } finally {
      setLoadingLinked(prev => {
        const next = new Set(prev);
        next.delete(rootId);
        return next;
      });
    }
  };

  const matchesSearchQuery = (record: FAASRecord): boolean => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (record.pin || "").toLowerCase().includes(query) ||
      (record.arf_no || "").toLowerCase().includes(query) ||
      (record.owner_name || "").toLowerCase().includes(query) ||
      (record.property_location || "").toLowerCase().includes(query)
    );
  };

  const toggleExpand = async (e: React.MouseEvent, record: FAASRecord) => {
    e.stopPropagation();
    const rootId = record.id;
    const newExpanded = new Set(expandedRootIds);

    if (newExpanded.has(rootId)) {
      newExpanded.delete(rootId);
    } else {
      newExpanded.add(rootId);
      await fetchLinkedEntries(rootId);
    }
    setExpandedRootIds(newExpanded);
  };

  const handleConfirmDelete = async () => {
    if (deleteId && onDelete) {
      await onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const formatId = (id: string | number) => {
    const idStr = String(id);
    return idStr.length > 8 ? `${idStr.substring(0, 8)}...` : idStr;
  };

  const handleView = (record: FAASRecord) => {
    navigate(`/faas/${record.id}`, { state: { mode: 'view' } });
  };

  const handleEdit = (record: FAASRecord) => {
    navigate(`/faas/${record.id}/edit`, { state: { mode: 'edit' } });
  };

  const handleDelete = (id: string | number) => {
    setDeleteId(id);
  };

  // Auto-expand and fetch all linked sub-records when searching.
  useEffect(() => {
    if (searchQuery.trim()) {
      const parentRecordsToExpand = records
        .filter(r => (r.linked_entries_count || 0) > 0)
        .map(r => r.id);
      
      if (parentRecordsToExpand.length > 0) {
        setExpandedRootIds(prev => {
          const newSet = new Set(prev);
          parentRecordsToExpand.forEach(id => newSet.add(id));
          return newSet;
        });

        parentRecordsToExpand.forEach((id) => {
          void fetchLinkedEntries(id);
        });
      }
    }
  }, [searchQuery, records]);

  const handleViewHistory = (record: FAASRecord) => {
    setHistoryRecord(record);
  };

  return (
    <div className="bg-white overflow-hidden">
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-2 border-rose-100 bg-white shadow-xl">
          <AlertDialogHeader>
            <div className="p-3 bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl inline-flex w-12 h-12 items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">Delete record?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This record will be permanently deleted from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-lg shadow-rose-500/30"
            >
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog open={!!historyRecord} onOpenChange={(open) => !open && setHistoryRecord(null)}>
        <DialogContent className="sm:max-w-[650px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-white">
          <DialogHeader className="p-6 bg-white border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                <History className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">Record Progress</DialogTitle>
                <DialogDescription className="text-slate-500 font-medium">
                  Tracking history for PIN: {historyRecord?.pin || historyRecord?.arf_no}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {historyRecord && <RecordTimeline recordId={historyRecord.id} />}
          </div>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30">
            <TableRow className="border-b-2 border-slate-100 hover:bg-transparent text-[10px]">
              <TableHead className="w-14 bg-white/50 border-r border-slate-100 px-0 text-center font-bold align-middle">No.</TableHead>
              <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white/50 border-r border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  PIN
                </div>
              </TableHead>
              <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white/50 border-r border-slate-100">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Owner Name
                </div>
              </TableHead>
              <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white/50 border-r border-slate-100">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Last Actor
                </div>
              </TableHead>
              <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white/50 border-r border-slate-100">
                Status
              </TableHead>
              <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white/50 border-r border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Date Created
                </div>
              </TableHead>
              <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white/50 border-r border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Last Updated
                </div>
              </TableHead>
              <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white/50 text-center">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20">
                  <div className="space-y-3">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">No records found</h3>
                      <p className="text-slate-500 text-sm">Try adjusting your search or filters</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.flatMap((record, index) => {
                // When searching: show record if it matches search OR has linked entries (will be expanded)
                if (searchQuery.trim()) {
                  const matchesSearch = matchesSearchQuery(record);
                  const hasLinkedEntries = (record.linked_entries_count || 0) > 0;
                  if (!matchesSearch && !hasLinkedEntries) {
                    return [];
                  }
                }
                
                const rows = [
                  <TableRow
                    key={`${record.id}-main`}
                    className={cn(
                      "group border-b border-slate-100 transition-all duration-200 cursor-pointer select-none",
                      index % 2 === 1 && "bg-slate-300/30",
                      rowHoverStyles[record.status],
                      hoveredRow === record.id && "shadow-lg shadow-slate-100"
                    )}
                    onMouseEnter={() => setHoveredRow(record.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onDoubleClick={() => handleView(record)}
                  >
                    <TableCell
                      className="w-14 px-0 border-r border-slate-100 text-center font-bold cursor-pointer hover:bg-blue-50/50 align-middle"
                      style={{ verticalAlign: 'middle' }}
                      onClick={(e) => {
                        if ((record.linked_entries_count || 0) > 0) {
                          e.stopPropagation();
                          toggleExpand(e, record);
                        }
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1 select-none min-h-[40px]">
                        <span className="inline-block align-middle leading-none">{index + 1}</span>
                        {(record.linked_entries_count || 0) > 0 && (
                          <span className="inline-flex align-middle ml-1">
                            {loadingLinked.has(record.id) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                            ) : expandedRootIds.has(record.id) ? (
                              <ChevronDown className="w-4 h-4 text-blue-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-blue-500" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 max-w-full">
                            <span className="font-bold text-slate-900 tracking-tight block uppercase truncate flex-1 min-w-0" title={record.pin || "N/A"}>
                              {record.pin || "N/A"}
                            </span>
                            {(record.linked_entries_count || 0) > 0 && (
                              <Badge variant="outline" className="h-5 px-1.5 bg-blue-50 text-blue-600 border-blue-100 text-[9px] font-bold flex-shrink-0 whitespace-nowrap">
                                {record.linked_entries_count} Linked
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-medium">Record ID: {formatId(record.id)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-sm font-semibold text-slate-800">{record.owner_name}</span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-slate-500">Owner</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 border border-slate-200 shrink-0">
                          {(record.updater_profile_picture || record.encoder_profile_picture) ? (
                            <AvatarImage
                              src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${record.updater_profile_picture || record.encoder_profile_picture}`}
                              className="object-cover"
                            />
                          ) : null}
                          <AvatarFallback className="bg-slate-100 text-[10px] font-bold text-slate-600">
                            {(record.updater_name || record.encoder_name || '??').split(' ').map(n => (n ? n[0] : '')).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="text-sm font-medium text-slate-700 line-clamp-1">
                            {record.updater_name || record.encoder_name || "Not specified"}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-slate-500">{record.updater_name ? "Updated by" : "Encoded by"}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm",
                          statusStyles[record.status]
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            record.status === "draft" && "bg-slate-500",
                            record.status === "for_approval" && "bg-amber-500",
                            record.status === "approved" && "bg-emerald-500",
                            record.status === "rejected" && "bg-rose-500"
                          )} />
                          {statusLabels[record.status]}
                          {record.status === "rejected" && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertCircle className="w-3 h-3 text-rose-500 cursor-help ml-1" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-rose-600 text-white border-none rounded-lg p-3 shadow-xl max-w-xs">
                                  <p className="font-bold flex items-center gap-1.5 mb-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Rejection Reason
                                  </p>
                                  <p className="text-xs leading-relaxed opacity-90">{record.rejection_reason || "No reason provided"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-sm font-medium text-slate-700">
                            {new Date(record.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] text-slate-500 font-medium">Created</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-sm font-medium text-slate-700">
                            {new Date(record.updated_at || record.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] text-slate-500 font-medium">Last Updated</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewHistory(record)}
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
                              >
                                <History className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Progress</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(record)}
                          className="h-8 gap-1.5 rounded-lg border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all font-bold px-2.5 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>

                        {(isAdmin || isEncoder) && (record.status === "draft" || record.status === "for_approval" || record.status === "rejected") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(record)}
                            className="h-8 gap-1.5 rounded-lg border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all font-bold px-2.5 shadow-sm"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                        )}

                        {onDelete && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(record.id)}
                                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Record</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {record.status === 'approved' && (isEncoder || isAdmin || isApprover) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={async () => {
                                    try {
                                      const { approvalAPI } = await import("@/services/api");
                                      await approvalAPI.cancelAction(record.id);
                                      window.location.reload();
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Cancel Approval</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ];

                {/* Sub-records Rendering */}
                if (expandedRootIds.has(record.id) && linkedEntriesMap[record.id]) {
                  linkedEntriesMap[record.id]
                    .filter(subRecord => matchesSearchQuery(subRecord))
                    .forEach((subRecord, subIndex) => {
                      rows.push(
                        <TableRow
                          key={subRecord.id}
                          className="bg-slate-50/50 border-b border-slate-100 hover:bg-slate-100 transition-colors"
                          onDoubleClick={() => handleView(subRecord)}
                        >
                          <TableCell className="w-14 px-0 border-r border-slate-100 text-center text-xs text-slate-400 font-bold align-middle" style={{ verticalAlign: 'middle' }}>
                            {`${index + 1}.${subIndex + 1}`}
                          </TableCell>
                          <TableCell className="px-6 py-2 relative overflow-visible" colSpan={1} style={{ paddingLeft: 0 }}>
                            <div className="relative flex items-center" style={{ minHeight: '40px' }}>
                              {/* Vertical line aligned with PIN column */}
                              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-blue-200/50" style={{ left: '2.5rem' }}></div>
                              {/* Horizontal line from vertical to content */}
                              <div className="absolute top-1/2 left-6 w-4 h-0.5 bg-blue-200/50" style={{ left: '2.5rem' }}></div>
                              <div className="pl-24 flex items-center gap-3">
                                <div>
                                  <span className="text-xs font-bold text-slate-600 tracking-tight block uppercase truncate min-w-0" title={subRecord.pin || "N/A"}>{subRecord.pin || "N/A"}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">Revision ID: {formatId(subRecord.id)}</span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-2">
                            <span className="text-xs font-medium text-slate-600 truncate block max-w-[200px]" title={subRecord.owner_name}>{subRecord.owner_name}</span>
                          </TableCell>
                          <TableCell className="px-6 py-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6 border border-slate-200">
                                {(subRecord.updater_profile_picture || subRecord.encoder_profile_picture) ? (
                                  <AvatarImage
                                    src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${subRecord.updater_profile_picture || subRecord.encoder_profile_picture}`}
                                  />
                                ) : null}
                                <AvatarFallback className="text-[8px] font-bold">{(subRecord.updater_name || subRecord.encoder_name || '?')[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="text-[10px] text-slate-500">{subRecord.updater_name || subRecord.encoder_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-2">
                            <Badge variant="outline" className={cn("px-1.5 py-0 text-[9px] font-extrabold uppercase border shadow-none", statusStyles[subRecord.status])}>
                              {statusLabels[subRecord.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-6 py-2">
                            <span className="text-xs text-slate-500">
                              {new Date(subRecord.created_at).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell className="px-6 py-2">
                            <span className="text-xs text-slate-500" title={`Created: ${new Date(subRecord.created_at).toLocaleString()}`}>
                              {new Date(subRecord.updated_at || subRecord.created_at).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewHistory(subRecord)}
                                className="h-7 w-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                title="View Progress"
                              >
                                <History className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleView(subRecord)}
                                className="h-7 gap-1 rounded-lg border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all font-bold px-2 text-[10px]"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </Button>

                              {(isAdmin || isEncoder) && (subRecord.status === "draft" || subRecord.status === "for_approval" || subRecord.status === "rejected") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(subRecord)}
                                  className="h-7 gap-1 rounded-lg border-amber-100 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all font-bold px-2 text-[10px]"
                                >
                                  <Edit className="w-3 h-3" />
                                  Edit
                                </Button>
                              )}

                              {onDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(subRecord.id)}
                                  className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                  title="Delete Revision"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}

                              {subRecord.status === 'approved' && (isEncoder || isAdmin || isApprover) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={async () => {
                                    try {
                                      const { approvalAPI } = await import("@/services/api");
                                      await approvalAPI.cancelAction(subRecord.id);
                                      window.location.reload();
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }}
                                  className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                  title="Cancel Approval"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                }

                return rows;
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}