import { useState } from "react";
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
import { Eye, Edit, Trash2, Calendar, User, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FAASRecord {
  id: string | number;
  arf_no: string;
  pin: string;
  owner_name: string;
  property_location: string;
  status: "draft" | "for_approval" | "approved" | "rejected";
  created_at: string;
  encoder_name: string;
  encoder_profile_picture?: string;
}

interface RecentRecordsTableProps {
  records: FAASRecord[];
  onDelete?: (id: string | number) => void | Promise<void>;
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

export function RecentRecordsTable({ records, onDelete }: RecentRecordsTableProps) {
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | number | null>(null);

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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30">
            <TableRow className="border-b-2 border-slate-100 hover:bg-transparent">
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
                  Encoded By
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
              <TableHead className="h-14 px-6 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white/50 text-center">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20">
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
              records.map((record) => (
                <TableRow
                  key={record.id}
                  className={cn(
                    "group border-b border-slate-100 transition-all duration-200 cursor-pointer select-none",
                    rowHoverStyles[record.status],
                    hoveredRow === record.id && "shadow-lg shadow-slate-100"
                  )}
                  onMouseEnter={() => setHoveredRow(record.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onDoubleClick={() => handleView(record)}
                >
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="font-bold text-slate-900 tracking-tight block uppercase">{record.pin || "N/A"}</span>
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
                        {record.encoder_profile_picture ? (
                          <AvatarImage
                            src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${record.encoder_profile_picture}`}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-slate-100 text-[10px] font-bold text-slate-600">
                          {record.encoder_name ? record.encoder_name.split(' ').map(n => n[0]).join('').toUpperCase() : '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="text-sm font-medium text-slate-700 line-clamp-1">
                          {record.encoder_name || "Not specified"}
                        </span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-slate-500">Encoded by</span>
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
                          <span className="text-xs text-slate-500">Created</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleView(record)}
                        className="h-9 w-9 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100 transition-all shadow-sm border border-slate-200 hover:border-blue-200"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {(record.status === "draft" || record.status === "for_approval" || record.status === "rejected") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(record)}
                          className="h-9 w-9 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-gradient-to-br hover:from-amber-50 hover:to-amber-100 transition-all shadow-sm border border-slate-200 hover:border-amber-200"
                          title="Edit Record"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}

                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-gradient-to-br hover:from-rose-50 hover:to-rose-100 transition-all shadow-sm border border-slate-200 hover:border-rose-200"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
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