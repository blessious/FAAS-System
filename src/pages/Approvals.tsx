import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Download,
  Eye,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Printer,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Filter,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  MoreVertical,
  Edit,
  Trash2,
  User,
  Calendar,
  RotateCcw,
  History
} from "lucide-react";
import { RecordTimeline } from "@/components/dashboard/RecordTimeline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { approvalAPI } from "@/services/api";
import { useSSE } from "@/hooks/useSSE";
import { useAuth } from "@/context/AuthContext.jsx";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import axios from "axios";

interface ApprovalRecord {
  id: string;
  arf_no: string;
  pin: string;
  owner_name: string;
  property_location: string;
  classification: string;
  market_value: number;
  assessed_value: number;
  created_at: string;
  encoder_name: string;
  encoder_profile_picture?: string;
  status: 'for_approval' | 'approved' | 'rejected';
  excel_file_path?: string;
  pdf_preview_path?: string;
  unirrig_pdf_preview_path?: string;
  rejection_reason?: string;
}

// Extracts the subpath for the API route, e.g. FAAS/PDFs/filename.pdf or UNIRRIG/PDFs/filename.pdf
const extractFilename = (filePath: string): string => {
  if (!filePath) return '';
  const normalizedPath = filePath.replace(/\\/g, '/');
  // Try to find the subpath starting from FAAS/ or UNIRRIG/
  const match = normalizedPath.match(/(FAAS|UNIRRIG)\/generated-pdf\/.+/i);
  if (match) {
    return match[0].replace(/^\/+/, '');
  }
  // Fallback: return last 3 segments (should be subfolder/"generated-pdf"/filename)
  const parts = normalizedPath.split('/');
  return parts.slice(-3).join('/');
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const statusStyles = {
  for_approval: "bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 border border-amber-200",
  approved: "bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 border border-emerald-200",
  rejected: "bg-gradient-to-r from-rose-50 to-rose-100/50 text-rose-700 border border-rose-200",
} as const;

const statusLabels = {
  for_approval: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const getStatusBadge = (status: string) => {
  const statusKey = status as keyof typeof statusStyles;
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm",
        statusStyles[statusKey]
      )}
    >
      <div className="flex items-center gap-1.5">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "for_approval" && "bg-amber-500",
          status === "approved" && "bg-emerald-500",
          status === "rejected" && "bg-rose-500"
        )} />
        {statusLabels[statusKey]}
      </div>
    </Badge>
  );
};

// Enhanced PreviewPanel with FAAS/UNIRRIG tab switching
const PreviewPanel = ({
  selectedRecord,
  rejectionReason,
  setRejectionReason,
  handleApprove,
  handleReject,
  handleDownloadPDF,
  handlePrintPDF,
  approving,
  rejecting,
  handleCancelAction,
  cancelling,
  pdfError,
  setPdfError,
  blockIframe,
  setBlockIframe
}: {
  selectedRecord: ApprovalRecord | null;
  rejectionReason: string;
  setRejectionReason: (val: string) => void;
  handleApprove: () => void;
  handleReject: () => void;
  handleDownloadPDF: () => void;
  handlePrintPDF: () => void;
  approving: boolean;
  rejecting: boolean;
  handleCancelAction: () => void;
  cancelling: boolean;
  pdfError: boolean;
  setPdfError: (val: boolean) => void;
  blockIframe: boolean;
  setBlockIframe: (val: boolean) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'faas' | 'unirrig'>('faas');
  // Always call hooks, use guards inside
  const faasPdfUrl = useMemo(() => {
    if (!selectedRecord) return '';
    const filename = extractFilename(selectedRecord.pdf_preview_path || '');
    const baseUrl = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:3000`;
    return filename ? `${baseUrl}/api/print/files/pdf/${filename}` : '';
  }, [selectedRecord?.id, selectedRecord?.pdf_preview_path]);

  const unirrigPdfUrl = useMemo(() => {
    if (!selectedRecord) return '';
    // Use the explicit UNIRRIG path from DB if available
    const path = selectedRecord.unirrig_pdf_preview_path || selectedRecord.pdf_preview_path;
    if (!path) return '';

    let targetPath = path;
    // Fallback logic if unirrig_pdf_preview_path is missing - try to reconstruct it from pdf_preview_path
    if (!selectedRecord.unirrig_pdf_preview_path && selectedRecord.pdf_preview_path) {
      targetPath = selectedRecord.pdf_preview_path.replace(/\\/g, '/').replace(/FAAS/g, 'UNIRRIG').replace(/faas/g, 'unirrig');
    }

    const filename = extractFilename(targetPath);
    const baseUrl = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:3000`;
    return filename ? `${baseUrl}/api/print/files/pdf/${filename}` : '';
  }, [selectedRecord?.id, selectedRecord?.pdf_preview_path, selectedRecord?.unirrig_pdf_preview_path]);

  if (!selectedRecord) {
    return (
      <Card className="h-full border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl">
        <CardContent className="flex flex-col items-center justify-center h-[700px]">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <Eye className="w-10 h-10 text-blue-300" />
          </div>
          <p className="text-lg font-bold text-slate-900">Select a record to preview</p>
          <p className="text-sm text-slate-500 mt-1">Choose from the records list on the left</p>
        </CardContent>
      </Card>
    );
  }

  // Tab content for PDF preview
  const renderPdfPreview = (type: 'faas' | 'unirrig') => {
    const url = type === 'faas' ? faasPdfUrl : unirrigPdfUrl;
    const label = type === 'faas' ? 'FAAS' : 'UNIRRIG';
    if (!url) {
      return (
        <div className="p-6 border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/30 rounded-xl">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-amber-100 rounded-full mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h4 className="font-bold text-amber-800">{label} PDF Preview Not Available</h4>
            <p className="text-amber-600 text-sm mt-1 max-w-md">
              The {label} PDF file could not be found for this record.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 p-3 text-sm font-medium border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-slate-900">{label} Preview - {selectedRecord.arf_no}</span>
          </div>
        </div>
        <div className="h-[1500px] bg-slate-50">
          {pdfError ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h4 className="font-bold text-slate-900 mb-2">Preview Not Available</h4>
              <p className="text-sm text-slate-500 mb-4 max-w-sm">
                The PDF couldn't be displayed in the preview pane. Click the button below to open it in a new tab.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(url, '_blank')}
                className="gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
              >
                <Eye className="w-4 h-4" />
                Open in New Tab
              </Button>
            </div>
          ) : (
            <iframe
              src={`${url}#toolbar=0&navpanes=0&scrollbar=1`}
              className={`w-full h-full border-0 ${blockIframe ? 'pointer-events-none' : ''}`}
              title={`${label} PDF Preview`}
              onError={() => {
                console.error('PDF iframe failed to load');
                setPdfError(true);
              }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white shadow-md shadow-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                {selectedRecord.arf_no}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Submitted by {selectedRecord.encoder_name} • {formatDate(selectedRecord.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 h-9"
                >
                  <History className="w-4 h-4" />
                  History
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[650px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-white">
                <DialogHeader className="p-6 bg-white border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-slate-900">Record Progress</DialogTitle>
                      <DialogDescription className="text-slate-500 font-medium">
                        Tracking history for ARF No: {selectedRecord.arf_no}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                  <RecordTimeline recordId={selectedRecord.id} />
                </div>
              </DialogContent>
            </Dialog>
            {getStatusBadge(selectedRecord.status)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {/* PDF Preview Section with Tabs */}
        <div className="mb-6">
          <div className="mb-3">
            <Tabs
              defaultValue={activeTab}
              onValueChange={(v) => setActiveTab(v as 'faas' | 'unirrig')}
            >
              <div className="flex items-center justify-between">
                <TabsList className="grid w-full max-w-[280px] grid-cols-2 bg-slate-100 p-1 rounded-lg">
                  <TabsTrigger
                    value="faas"
                    className="rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                  >
                    FAAS
                  </TabsTrigger>
                  <TabsTrigger
                    value="unirrig"
                    className="rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                  >
                    UNIRRIG
                  </TabsTrigger>
                </TabsList>
              </div>
              <Separator className="my-4 bg-slate-200" />
              <TabsContent value="faas" className="mt-0">
                {renderPdfPreview('faas')}
              </TabsContent>
              <TabsContent value="unirrig" className="mt-0">
                {renderPdfPreview('unirrig')}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Record Details */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl p-5 mb-6 border border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
            Record Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Owner Name</label>
              <p className="font-semibold text-slate-900 flex items-center gap-1.5 uppercase">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {selectedRecord.owner_name}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">PIN (Property Index Number)</label>
              <p className="font-bold text-blue-600">{selectedRecord.pin || "N/A"}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Encoded By</label>
              <div className="flex items-center gap-2 mt-0.5">
                <Avatar className="w-6 h-6 border border-slate-200">
                  {selectedRecord.encoder_profile_picture ? (
                    <AvatarImage
                      src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${selectedRecord.encoder_profile_picture}`}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-slate-100 text-[8px] font-bold text-slate-600">
                    {selectedRecord.encoder_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="font-medium text-slate-700">
                  {selectedRecord.encoder_name}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Date Submitted</label>
              <p className="font-medium text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatDate(selectedRecord.created_at)}
              </p>
            </div>
          </div>
        </div>

        <Separator className="my-4 bg-slate-200" />

        {/* Action Buttons */}
        {selectedRecord.status === 'for_approval' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-900 mb-2 block">
                Rejection Reason <span className="text-xs font-normal text-slate-500 ml-1">(required for rejection)</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-white"
                rows={3}
                placeholder="Enter the reason for rejection..."
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleApprove}
                disabled={approving || rejecting}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/30 gap-2 rounded-xl font-semibold h-11"
              >
                {approving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve Record
                  </>
                )}
              </Button>
              <Button
                onClick={handleReject}
                disabled={approving || rejecting || !rejectionReason.trim()}
                className="flex-1 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-lg shadow-rose-500/30 gap-2 rounded-xl font-semibold h-11 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rejecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject Record
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {selectedRecord.status === 'approved' && (
          <div className="p-5 bg-gradient-to-r from-emerald-50 to-emerald-100/30 border border-emerald-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-emerald-800 mb-1">Record Approved</h4>
                <p className="text-emerald-600 text-sm">This FAAS record has been approved and is now active.</p>
              </div>
            </div>
          </div>
        )}

        {selectedRecord.status === 'rejected' && (
          <div className="space-y-4">
            <div className="p-5 bg-gradient-to-r from-rose-50 to-rose-100/30 border border-rose-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h4 className="font-bold text-rose-800 mb-1">Rejection Reason</h4>
                  <p className="text-rose-600 text-sm">{selectedRecord.rejection_reason || "No reason provided"}</p>
                </div>
              </div>
            </div>
            {/* Keeping cancel button for rejected in Approvals since rejected is already a tab here */}
            <Button
              onClick={handleCancelAction}
              disabled={cancelling}
              variant="outline"
              className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 gap-2 rounded-xl font-semibold h-11"
            >
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Cancel Rejection & Revert to Pending
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function Approvals() {
  const { toast } = useToast();
  const { userRole } = useAuth() as { userRole: string };

  const [loading, setLoading] = useState(true);
  const [pendingRecords, setPendingRecords] = useState<ApprovalRecord[]>([]);
  const [rejectedRecords, setRejectedRecords] = useState<ApprovalRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [blockIframe, setBlockIframe] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const [pending, rejected] = await Promise.all([
        approvalAPI.getPendingApprovals(),
        approvalAPI.getRejectedRecords(),
      ]);

      setPendingRecords(pending || []);
      setRejectedRecords(rejected || []);
    } catch (error: any) {
      console.error('Error fetching records:', error);
      toast({
        title: "Error",
        description: "Failed to load approval records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Filter records based on search query
  const filteredPendingRecords = useMemo(() => {
    if (!searchQuery.trim()) return pendingRecords;

    const q = searchQuery.toLowerCase();
    return pendingRecords.filter(record =>
      record.arf_no.toLowerCase().includes(q) ||
      record.owner_name.toLowerCase().includes(q) ||
      record.property_location.toLowerCase().includes(q) ||
      record.encoder_name.toLowerCase().includes(q)
    );
  }, [pendingRecords, searchQuery]);

  const filteredRejectedRecords = useMemo(() => {
    if (!searchQuery.trim()) return rejectedRecords;

    const q = searchQuery.toLowerCase();
    return rejectedRecords.filter(record =>
      record.arf_no.toLowerCase().includes(q) ||
      record.owner_name.toLowerCase().includes(q) ||
      record.property_location.toLowerCase().includes(q) ||
      record.encoder_name.toLowerCase().includes(q)
    );
  }, [rejectedRecords, searchQuery]);

  // Real-time updates via SSE
  useSSE({
    onRecordChange: useCallback((data) => {
      console.log('📡 Approvals received record change:', data);

      const actionMessages: Record<string, string> = {
        submitted: 'New record submitted for approval',
        approved: 'Record has been approved',
        rejected: 'Record has been rejected',
        updated: 'Record has been updated',
        deleted: 'Record has been deleted'
      };

      if (actionMessages[data.action]) {
        toast({
          title: actionMessages[data.action],
          description: `ARF No: ${data.record.arf_no}`,
        });
      }

      fetchRecords();

      if (selectedRecord && selectedRecord.id === String(data.record.id)) {
        if (data.action === 'deleted' || data.action === 'approved' || data.action === 'rejected') {
          setSelectedRecord(null);
          setRejectionReason("");
        }
      }
    }, [fetchRecords, selectedRecord, toast]),

    onConnected: useCallback(() => {
      console.log('✅ Approvals connected to real-time updates');
    }, [])
  });

  const handleSelectRecord = (record: ApprovalRecord) => {
    setSelectedRecord(record);
    setRejectionReason("");
    setPdfError(false);
    setBlockIframe(false);
  };

  const handleApprove = async () => {
    if (!selectedRecord) return;

    try {
      setApproving(true);
      setBlockIframe(true);

      await approvalAPI.approveRecord(selectedRecord.id, {
        comment: rejectionReason || ''
      });

      toast({
        title: "Record Approved",
        description: `FAAS record ${selectedRecord.arf_no} has been approved successfully.`,
      });

      setSelectedRecord(null);
      setRejectionReason("");
      await fetchRecords();
    } catch (error: any) {
      console.error('Error approving record:', error);
      toast({
        title: "Error",
        description: error.error || "Failed to approve record",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
      setBlockIframe(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRecord || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Rejection reason is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setRejecting(true);
      setBlockIframe(true);

      await approvalAPI.rejectRecord(selectedRecord.id, {
        comment: rejectionReason
      });

      toast({
        title: "Record Rejected",
        description: `FAAS record ${selectedRecord.arf_no} has been rejected.`,
      });

      setSelectedRecord(null);
      setRejectionReason("");
      await fetchRecords();
    } catch (error: any) {
      console.error('Error rejecting record:', error);
      toast({
        title: "Error",
        description: error.error || "Failed to reject record",
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
      setBlockIframe(false);
    }
  };

  const handleCancelAction = async () => {
    if (!selectedRecord) return;

    try {
      setCancelling(true);
      setBlockIframe(true);

      await approvalAPI.cancelAction(selectedRecord.id);

      toast({
        title: "Action Cancelled",
        description: `FAAS record ${selectedRecord.arf_no} has been reverted to pending status.`,
      });

      setSelectedRecord(null);
      await fetchRecords();
    } catch (error: any) {
      console.error('Error cancelling action:', error);
      toast({
        title: "Error",
        description: error.error || "Failed to cancel action",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
      setBlockIframe(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedRecord?.pdf_preview_path) return;

    try {
      const filename = extractFilename(selectedRecord.pdf_preview_path);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || `http://localhost:3000`;
      const url = `${baseUrl}/api/files/pdf/${filename}`;

      const response = await axios.get(url, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Download Started",
        description: "PDF file is being downloaded.",
      });

    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: error.response?.data || error.message || "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  const handlePrintPDF = () => {
    if (!selectedRecord?.pdf_preview_path) return;

    const filename = extractFilename(selectedRecord.pdf_preview_path);
    const baseUrl = import.meta.env.VITE_API_BASE_URL || `http://localhost:3000`;
    const url = `${baseUrl}/api/files/pdf/${filename}`;

    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(value);
  };

  const RecordList = ({ records, status, title, icon }: { records: ApprovalRecord[], status: string, title: string, icon: React.ReactNode }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const recordsPerPage = 10;

    const filteredRecords = status === 'pending' ? filteredPendingRecords : filteredRejectedRecords;
    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
    const paginatedRecords = filteredRecords.slice(
      (currentPage - 1) * recordsPerPage,
      currentPage * recordsPerPage
    );

    // Reset to page 1 when search changes
    useEffect(() => {
      setCurrentPage(1);
    }, [searchQuery]);

    return (
      <Card className="h-full border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden flex flex-col">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100 py-4 flex-shrink-0">
          {/* CardHeader content remains the same */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-2 rounded-lg text-white shadow-md",
                status === 'pending' ? "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/20" : "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/20"
              )}>
                {icon}
              </div>
              <CardTitle className="text-base font-bold text-slate-900">
                {title}
              </CardTitle>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm",
                status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-rose-50 text-rose-700 border-rose-200"
              )}
            >
              {filteredRecords.length} {filteredRecords.length === 1 ? 'Record' : 'Records'}
            </Badge>
          </div>

          {/* Search Bar */}
          <div className="relative group mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ARF No, Owner, Location..."
              className="pl-9 pr-8 w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-lg transition-all text-sm h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </CardHeader>

        {/* FIXED: This is the key change - make the content area flex and scrollable */}
        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 h-auto">
            {filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-900">No {status} records</p>
                <p className="text-xs text-slate-500 mt-1 text-center">
                  {status === 'pending'
                    ? 'New records submitted for approval will appear here'
                    : 'Rejected records that need revision will appear here'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {paginatedRecords.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => handleSelectRecord(record)}
                    className={cn(
                      "w-full p-4 text-left transition-all duration-200 hover:bg-gradient-to-r",
                      status === 'pending' ? "hover:from-amber-50/50 hover:to-amber-100/30" :
                        status === 'approved' ? "hover:from-emerald-50/50 hover:to-emerald-100/30" :
                          "hover:from-rose-50/50 hover:to-rose-100/30",
                      selectedRecord?.id === record.id && cn(
                        "border-l-4 shadow-sm",
                        status === 'pending' ? "bg-gradient-to-r from-amber-50/50 to-amber-100/30 border-l-amber-500" :
                          status === 'approved' ? "bg-gradient-to-r from-emerald-50/50 to-emerald-100/30 border-l-emerald-500" :
                            "bg-gradient-to-r from-rose-50/50 to-rose-100/30 border-l-rose-500"
                      )
                    )}
                  >
                    {/* Record item content remains the same */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-900 truncate uppercase text-base">{record.owner_name}</span>
                          {getStatusBadge(record.status)}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 mb-2">
                          <span className="text-slate-500 font-medium">PIN:</span> {record.pin || "N/A"}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-500 flex items-center gap-2">
                            <Avatar className="w-5 h-5 border border-slate-200">
                              {record.encoder_profile_picture ? (
                                <AvatarImage
                                  src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${record.encoder_profile_picture}`}
                                  className="object-cover"
                                />
                              ) : null}
                              <AvatarFallback className="bg-slate-100 text-[8px] font-bold text-slate-600">
                                {record.encoder_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            Encoder: {record.encoder_name}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Submitted: {formatDate(record.created_at)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 flex-shrink-0 transition-colors self-center",
                        selectedRecord?.id === record.id ? "text-blue-600" : "text-slate-300"
                      )} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>

        {/* Pagination - make it flex-shrink-0 so it doesn't shrink */}
        {filteredRecords.length > 0 && (
          <div className="p-3 border-t border-slate-100 bg-gradient-to-r from-slate-50/50 to-blue-50/30 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
            {/* Pagination content remains the same */}
            <div className="text-xs text-slate-600 font-medium">
              Showing <span className="font-bold text-slate-900">{(currentPage - 1) * recordsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(filteredRecords.length, currentPage * recordsPerPage)}</span> of <span className="font-bold text-slate-900">{filteredRecords.length}</span> records
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-300 h-8 px-3"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Prev
              </Button>
              <div className="flex items-center gap-1 px-2 py-1.5 bg-white border border-slate-200 rounded-md">
                <span className="text-sm font-bold text-slate-900">{currentPage}</span>
                <span className="text-sm text-slate-400">/</span>
                <span className="text-sm text-slate-600">{totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-300 h-8 px-3"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 lg:p-6 space-y-6">
      {/* Header Section */}
      <div className="relative rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 p-4 lg:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-100/20"></div>
        <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-300/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Approvals
              </h1>
              <p className="text-blue-100/80 text-sm max-w-xl mt-1">
                Review and manage FAAS records pending approval, track rejected items, and monitor assessment status
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 md:mt-0">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span className="text-xs font-medium text-white capitalize">{userRole}</span>
            </div>
          </div>
        </div>
      </div>


      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-lg">
          <TabsTrigger
            value="pending"
            className="rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm gap-2"
          >
            <Clock className="w-4 h-4" />
            Pending Approval
            <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 border-0">
              {pendingRecords.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="rejected"
            className="rounded-md text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm gap-2"
          >
            <XCircle className="w-4 h-4" />
            Rejected
            <Badge variant="secondary" className="ml-1 bg-rose-100 text-rose-700 border-0">
              {rejectedRecords.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
              <div className="relative">
                <div className="w-12 h-12 border-3 border-blue-100 rounded-full">
                  <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-slate-700 font-semibold animate-pulse">Loading pending records...</p>
                <p className="text-slate-400 text-sm">Fetching records submitted for approval</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-4">
              <div className="lg:col-span-1">
                <RecordList
                  records={pendingRecords}
                  status="pending"
                  title="Pending Records"
                  icon={<Clock className="w-5 h-5" />}
                />
              </div>
              <div className="lg:col-span-3">
                <PreviewPanel
                  selectedRecord={selectedRecord}
                  rejectionReason={rejectionReason}
                  setRejectionReason={setRejectionReason}
                  handleApprove={handleApprove}
                  handleReject={handleReject}
                  handleDownloadPDF={handleDownloadPDF}
                  handlePrintPDF={handlePrintPDF}
                  approving={approving}
                  rejecting={rejecting}
                  handleCancelAction={handleCancelAction}
                  cancelling={cancelling}
                  pdfError={pdfError}
                  setPdfError={setPdfError}
                  blockIframe={blockIframe}
                  setBlockIframe={setBlockIframe}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
              <div className="relative">
                <div className="w-12 h-12 border-3 border-blue-100 rounded-full">
                  <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-slate-700 font-semibold animate-pulse">Loading rejected records...</p>
                <p className="text-slate-400 text-sm">Fetching records that need revision</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-4">
              <div className="lg:col-span-1">
                <RecordList
                  records={rejectedRecords}
                  status="rejected"
                  title="Rejected Records"
                  icon={<XCircle className="w-5 h-5" />}
                />
              </div>
              <div className="lg:col-span-3">
                <PreviewPanel
                  selectedRecord={selectedRecord}
                  rejectionReason={rejectionReason}
                  setRejectionReason={setRejectionReason}
                  handleApprove={handleApprove}
                  handleReject={handleReject}
                  handleDownloadPDF={handleDownloadPDF}
                  handlePrintPDF={handlePrintPDF}
                  approving={approving}
                  rejecting={rejecting}
                  handleCancelAction={handleCancelAction}
                  cancelling={cancelling}
                  pdfError={pdfError}
                  setPdfError={setPdfError}
                  blockIframe={blockIframe}
                  setBlockIframe={setBlockIframe}
                />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}