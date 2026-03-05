import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, CheckCircle, User, MapPin, Loader2, FileText, FileSpreadsheet, Eye, AlertTriangle, ChevronLeft, ChevronRight, Clock, RotateCcw, Search, X, CheckCheck, Gauge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { printAPI, approvalAPI } from "@/services/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { CalibrationModal } from "@/components/print/CalibrationModal";


interface ApprovedRecord {
  id: string;
  arf_no: string;
  pin: string;
  owner_name: string;
  property_location: string;
  classification: string;
  market_value: number;
  assessed_value: number;
  created_at: string;
  approved_at: string;
  approver_name: string;
  encoder_name: string;
  encoder_profile_picture?: string;
  status: string;
  excel_file_path?: string;
  unirrig_excel_file_path?: string;
  pdf_preview_path?: string;
  unirrig_pdf_preview_path?: string;
  unirrig_plain_excel_path?: string;
  unirrig_plain_pdf_path?: string;
  unirrig_precision_pdf_path?: string;
}

// Extracts the subpath for the API route
const extractFilename = (filePath: string): string => {
  if (!filePath) return '';
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Try to find the part after /generated/
  const genIndex = normalizedPath.toLowerCase().indexOf('/generated/');
  if (genIndex !== -1) {
    return normalizedPath.substring(genIndex + 11); // 11 is length of "/generated/"
  }

  const parts = normalizedPath.split('/');
  return parts.slice(-2).join('/');
};

const extractExcelFilename = (filePath: string): string => {
  if (!filePath) return '';
  const normalizedPath = filePath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  return parts.slice(-2).join('/');
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
} as const;

const getStatusBadge = (status: string, small: boolean = false) => {
  const statusKey = status as keyof typeof statusStyles;
  return (
    <Badge
      variant="outline"
      className={cn(
        small ? "px-1 py-px text-[8px] font-black uppercase tracking-tighter" : "px-3 py-1.5 rounded-full text-xs font-bold shadow-sm",
        "border leading-none",
        statusStyles[statusKey]
      )}
    >
      <div className="flex items-center gap-1">
        <div className={cn(
          small ? "w-0.5 h-0.5 rounded-full" : "w-1.5 h-1.5 rounded-full",
          status === "for_approval" && "bg-amber-500",
          status === "approved" && "bg-emerald-500",
          status === "rejected" && "bg-rose-500"
        )} />
        {statusLabels[statusKey]}
      </div>
    </Badge>
  );
};

export default function PrintPreview() {
  const { toast } = useToast();
  const [selectedRecord, setSelectedRecord] = useState<ApprovedRecord | null>(null);
  const [approvedRecords, setApprovedRecords] = useState<ApprovedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [activeTab, setActiveTab] = useState<'faas' | 'unirrig'>('faas');
  const [pdfError, setPdfError] = useState(false);
  const [blockIframe, setBlockIframe] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generatingPlain, setGeneratingPlain] = useState(false);
  const [showPlain, setShowPlain] = useState(false);
  const [generatingPrecision, setGeneratingPrecision] = useState(false);
  const [showPrecision, setShowPrecision] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch approved records
  useEffect(() => {
    fetchApprovedRecords();
  }, []);

  const fetchApprovedRecords = async () => {
    try {
      setLoading(true);
      const data = await printAPI.getApprovedRecords();
      setApprovedRecords(data || []);
    } catch (error: any) {
      console.error('Error fetching approved records:', error);
      toast({
        title: "Error",
        description: error.error || "Failed to load approved records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter approved records based on search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return approvedRecords;

    const q = searchQuery.toLowerCase();
    return approvedRecords.filter(record => {
      const date = new Date(record.created_at);
      const formattedDate = date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).toLowerCase();

      return (record.pin?.toLowerCase() || "").includes(q) ||
        (record.arf_no?.toLowerCase() || "").includes(q) ||
        (record.owner_name?.toLowerCase() || "").includes(q) ||
        (record.property_location?.toLowerCase() || "").includes(q) ||
        (record.encoder_name?.toLowerCase() || "").includes(q) ||
        (record.approver_name?.toLowerCase() || "").includes(q) ||
        formattedDate.includes(q);
    });
  }, [approvedRecords, searchQuery]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

  // Generate PDF URL based on active tab
  const getPdfUrl = useMemo(() => {
    if (!selectedRecord) return '';

    let pdfPath = '';
    if (activeTab === 'faas') {
      pdfPath = selectedRecord.pdf_preview_path || '';
    } else {
      // Use precision if toggled, then plain, then original
      if (showPrecision) {
        pdfPath = selectedRecord.unirrig_precision_pdf_path || '';
      } else if (showPlain) {
        pdfPath = selectedRecord.unirrig_plain_pdf_path || '';
      } else {
        pdfPath = selectedRecord.unirrig_pdf_preview_path || '';
      }
    }

    if (!pdfPath) return '';

    const filename = extractFilename(pdfPath);
    const baseUrl = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:3001`;
    // Add a timestamp as a cache-buster to force the iframe/browser to reload the PDF
    const timestamp = new Date().getTime();
    return filename ? `${baseUrl}/api/print/files/pdf/${filename}?t=${timestamp}` : '';
  }, [selectedRecord, activeTab, showPlain, showPrecision]);

  const handleGeneratePrecision = async () => {
    if (!selectedRecord) return;

    try {
      setGeneratingPrecision(true);
      toast({
        title: "Generating Precision Version",
        description: "Placing text at exact coordinates for pre-printed boxes...",
      });

      const response = await printAPI.generatePrecisionPrint(selectedRecord.id);

      if (response.success) {
        toast({
          title: "Success",
          description: "Precision version is ready. Check the alignment on your form.",
        });

        const updatedRecord = {
          ...selectedRecord,
          unirrig_precision_pdf_path: response.data.pdfPath
        };
        setSelectedRecord(updatedRecord);
        setApprovedRecords(prev => prev.map(r => r.id === selectedRecord.id ? updatedRecord : r));
        setShowPrecision(true);
        setShowPlain(false);
      }
    } catch (error: any) {
      console.error('Error generating precision print:', error);
      toast({
        title: "Generation Failed",
        description: error.error || "Failed to generate precision version",
        variant: "destructive",
      });
    } finally {
      setGeneratingPrecision(false);
    }
  };

  const handleGeneratePlain = async () => {
    if (!selectedRecord) return;

    try {
      setGeneratingPlain(true);
      toast({
        title: "Generating Plain Version",
        description: "Removing tables and formatting for pre-printed forms...",
      });

      const response = await printAPI.generatePlainPrint(selectedRecord.id);

      if (response.success) {
        toast({
          title: "Success",
          description: "Plain version is ready for printing.",
        });

        // Update local state for the selected record
        const updatedRecord = {
          ...selectedRecord,
          unirrig_plain_excel_path: response.data.excelPath,
          unirrig_plain_pdf_path: response.data.pdfPath
        };
        setSelectedRecord(updatedRecord);

        // Also update in the list
        setApprovedRecords(prev => prev.map(r => r.id === selectedRecord.id ? updatedRecord : r));

        setShowPlain(true);
      }
    } catch (error: any) {
      console.error('Error generating plain print:', error);
      toast({
        title: "Generation Failed",
        description: error.error || "Failed to generate plain version",
        variant: "destructive",
      });
    } finally {
      setGeneratingPlain(false);
    }
  };

  // Print the PDF
  const handlePrint = () => {
    if (!getPdfUrl) {
      toast({
        title: "PDF Not Found",
        description: `No PDF file found for ${activeTab.toUpperCase()} record.`,
        variant: "destructive",
      });
      return;
    }

    const printWindow = window.open(getPdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };


  const handleDownloadExcel = async () => {
    if (!selectedRecord) return;

    const filePath = activeTab === 'faas'
      ? selectedRecord.excel_file_path
      : selectedRecord.unirrig_excel_file_path;

    if (!filePath) {
      toast({
        title: "Excel Not Found",
        description: `No Excel file path found for this ${activeTab.toUpperCase()} record.`,
        variant: "destructive",
      });
      return;
    }

    const filename = extractExcelFilename(filePath);
    if (!filename) return;

    try {
      toast({
        title: "Downloading...",
        description: "Preparing your Excel file for download.",
      });

      const response = await printAPI.downloadFile(filename);

      // Create a blob from the response data
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename.split('/').pop() || 'record.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.error || "Failed to download the Excel file.",
        variant: "destructive",
      });
    }
  };

  // Handle record selection
  const handleSelectRecord = (record: ApprovedRecord) => {
    setSelectedRecord(record);
    setShowPlain(false);
    setShowPrecision(false);
    setPdfError(false);
    setBlockIframe(false);
    setPreviewLoading(true);

    // Reset loading state after a short delay
    setTimeout(() => {
      setPreviewLoading(false);
    }, 500);
  };

  const handleCancelAction = async () => {
    if (!selectedRecord) return;

    try {
      setCancelling(true);
      setBlockIframe(true);

      await approvalAPI.cancelAction(selectedRecord.id);

      toast({
        title: "Action Cancelled",
        description: `FAAS record PIN: ${selectedRecord.pin || selectedRecord.arf_no} has been reverted to pending status.`,
      });

      setSelectedRecord(null);
      await fetchApprovedRecords();
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

  const handleReleaseRecord = async () => {
    if (!selectedRecord) return;

    try {
      setReleasing(true);
      setBlockIframe(true);

      await printAPI.releaseRecord(selectedRecord.id);

      toast({
        title: "Record Released",
        description: `FAAS record for ${selectedRecord.owner_name} has been marked as released and moved to history.`,
      });

      setSelectedRecord(null);
      await fetchApprovedRecords();
    } catch (error: any) {
      console.error('Error releasing record:', error);
      toast({
        title: "Error",
        description: error.error || "Failed to mark record as released",
        variant: "destructive",
      });
    } finally {
      setReleasing(false);
      setBlockIframe(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="relative rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-6 overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-100/20"></div>
        <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-teal-300/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight text-white">Print Preview</h1>
          <p className="text-emerald-100/80 mt-1">
            View and print approved FAAS/UNIRRIG records
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Approved Records List */}
        <div className="lg:col-span-4">
          <Card className="h-full border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden flex flex-col">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b border-slate-100 px-4 py-4 flex-shrink-0 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg text-white shadow-md shadow-emerald-500/20">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  Approved Records
                </CardTitle>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  {filteredRecords.length}
                </Badge>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search PIN, owner, location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-lg bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 h-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="relative">
                      <div className="w-12 h-12 border-3 border-emerald-100 rounded-full">
                        <div className="absolute inset-0 border-3 border-t-emerald-600 rounded-full animate-spin"></div>
                      </div>
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-700">Loading records...</p>
                  </div>
                ) : approvedRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-4">
                      <Printer className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">No approved records</p>
                    <p className="text-xs text-slate-500 mt-1 text-center">
                      Approved records will appear here
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full bg-white">
                    <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
                      {paginatedRecords.map((record) => (
                        <button
                          key={record.id}
                          onClick={() => handleSelectRecord(record)}
                          className={cn(
                            "w-full text-left transition-all duration-200 border-l-4 border-y border-y-transparent",
                            selectedRecord?.id === record.id
                              ? "bg-emerald-50/70 border-l-emerald-500 border-y-emerald-100/50 shadow-sm z-10"
                              : "hover:bg-slate-50 border-l-transparent hover:border-l-slate-200"
                          )}
                        >
                          <div className="flex items-start gap-3 p-3 pl-5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-bold text-slate-900 truncate uppercase text-[15px] flex-1 min-w-0" title={record.owner_name}>{record.owner_name}</span>
                                <div className="flex-shrink-0">
                                  {getStatusBadge(record.status || 'approved', true)}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                                  <span className="text-slate-500 font-medium text-xs">PIN:</span> {record.pin || "N/A"}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs text-slate-500 flex items-center gap-2">
                                  <Avatar className="w-5 h-5 border border-slate-200">
                                    {record.encoder_profile_picture ? (
                                      <AvatarImage
                                        src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${record.encoder_profile_picture}`}
                                        className="object-cover"
                                      />
                                    ) : null}
                                    <AvatarFallback className="bg-slate-100 text-[8px] font-bold text-slate-600">
                                      {record.encoder_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  {record.encoder_name}
                                </span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(record.approved_at || record.created_at)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center self-center pr-1">
                              <ChevronRight className={cn(
                                "w-4 h-4 transition-colors",
                                selectedRecord?.id === record.id ? "text-emerald-600" : "text-slate-300"
                              )} />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="p-3 border-t border-slate-100 bg-gradient-to-r from-slate-50/50 to-emerald-50/30 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                        <div className="text-xs text-slate-600 font-medium">
                          Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(filteredRecords.length, currentPage * itemsPerPage)}</span> of <span className="font-bold text-slate-900">{filteredRecords.length}</span> records
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-300 h-8 px-3"
                          >
                            Next
                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Print Preview with PDF Viewer */}
        <div className="lg:col-span-8">
          {selectedRecord ? (
            <Card className="h-full border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden flex flex-col">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b border-slate-100 py-4 px-4 lg:px-6 flex-shrink-0">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg text-white shadow-md shadow-emerald-500/20 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg font-bold text-slate-900 truncate">
                        {selectedRecord.pin || "No PIN"}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Approved by {selectedRecord.approver_name} • {formatDate(selectedRecord.approved_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tabs defaultValue={activeTab} value={activeTab} onValueChange={val => {
                      setActiveTab(val as 'faas' | 'unirrig');
                      setPdfError(false);
                    }} className="w-auto">
                      <TabsList className="grid w-[140px] lg:w-[180px] grid-cols-2 bg-slate-100 p-1 rounded-lg">
                        <TabsTrigger
                          value="faas"
                          className="rounded-md text-[10px] lg:text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm"
                        >
                          FAAS
                        </TabsTrigger>
                        <TabsTrigger
                          value="unirrig"
                          className="rounded-md text-[10px] lg:text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm"
                        >
                          TDC
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleCancelAction}
                        disabled={cancelling}
                        variant="outline"
                        className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg h-9"
                      >
                        {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        <span className="hidden xl:inline">Cancel Approval</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleDownloadExcel}
                        disabled={cancelling}
                        variant="outline"
                        className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg h-9 shadow-sm"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="hidden xl:inline">Excel</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={handlePrint}
                        disabled={!getPdfUrl || cancelling || releasing}
                        className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/30 rounded-lg h-9"
                      >
                        <Printer className="w-4 h-4" />
                        <span className="hidden xl:inline">Print {showPlain ? "Plain" : ""}</span>
                      </Button>

                      {activeTab === 'unirrig' && (
                        <Button
                          size="sm"
                          variant={showPlain ? "secondary" : "outline"}
                          onClick={() => {
                            if (!selectedRecord?.unirrig_plain_pdf_path) {
                              handleGeneratePlain();
                            } else {
                              setShowPlain(!showPlain);
                              setShowPrecision(false);
                            }
                          }}
                          disabled={generatingPlain || generatingPrecision}
                          className={cn(
                            "gap-2 rounded-lg h-9",
                            showPlain ? "bg-amber-100 text-amber-700 border-amber-200" : "border-slate-200 text-slate-600"
                          )}
                        >
                          {generatingPlain ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4 text-amber-500" />}
                          <span>{showPlain ? "Show Original" : "Plain Data"}</span>
                        </Button>
                      )}

                      {activeTab === 'unirrig' && (
                        <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-200 ml-1">
                          <Button
                            size="sm"
                            variant={showPrecision ? "secondary" : "outline"}
                            onClick={() => {
                              if (!selectedRecord?.unirrig_precision_pdf_path) {
                                handleGeneratePrecision();
                              } else {
                                setShowPrecision(!showPrecision);
                                setShowPlain(false);
                              }
                            }}
                            disabled={generatingPrecision || generatingPlain}
                            className={cn(
                              "gap-2 rounded-lg h-9",
                              showPrecision ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "border-slate-200 text-slate-600 bg-white"
                            )}
                          >
                            {generatingPrecision ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4 text-emerald-500" />}
                            <span>{showPrecision ? "Show Original" : "Precision (Shoot)"}</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowCalibration(true)}
                            disabled={generatingPrecision || generatingPlain}
                            className="gap-2 rounded-lg h-9 border-slate-200 text-slate-600 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                          >
                            <Gauge className="w-4 h-4 text-emerald-600" />
                            <span>Calibrate</span>
                          </Button>
                        </div>
                      )}

                      <div className="hidden lg:block w-px h-6 bg-slate-200 mx-1" />

                      <Button
                        size="sm"
                        onClick={handleReleaseRecord}
                        disabled={cancelling || releasing}
                        className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30 rounded-lg h-9"
                      >
                        {releasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                        <span>Release Record</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col min-h-0">
                {/* PDF Preview Section */}
                <div className="flex-1 flex flex-col min-h-0">
                  {getPdfUrl ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col h-full">
                      <div className="bg-gradient-to-r from-slate-50 to-emerald-50/30 p-3 text-sm font-medium border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-500" />
                          <span className="font-semibold text-slate-900">
                            {activeTab.toUpperCase()} Preview - {selectedRecord.pin || "No PIN"}
                          </span>
                        </div>
                        <a
                          href={getPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline flex items-center gap-1"
                        >
                          Open in New Tab
                          <ChevronRight className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="bg-slate-50 relative h-[1355px]">
                        {previewLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <div className="flex flex-col items-center">
                              <div className="relative">
                                <div className="w-10 h-10 border-3 border-emerald-100 rounded-full">
                                  <div className="absolute inset-0 border-3 border-t-emerald-600 rounded-full animate-spin"></div>
                                </div>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">Loading PDF preview...</p>
                            </div>
                          </div>
                        )}
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
                              onClick={() => window.open(getPdfUrl, '_blank')}
                              className="gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                            >
                              <Eye className="w-4 h-4" />
                              Open in New Tab
                            </Button>
                          </div>
                        ) : (
                          <iframe
                            src={`${getPdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                            className={`w-full h-full border-0 ${blockIframe ? 'pointer-events-none' : ''}`}
                            title={`${activeTab.toUpperCase()} PDF Preview`}
                            onLoad={() => {
                              setPreviewLoading(false);
                              setPdfError(false);
                            }}
                            onError={() => {
                              console.error('PDF iframe failed to load');
                              setPdfError(true);
                              setPreviewLoading(false);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 border border-slate-200 rounded-xl bg-gradient-to-br from-slate-50 to-emerald-50/30">
                      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-2">PDF Not Available</h4>
                      <p className="text-sm text-slate-500 text-center max-w-md">
                        No {activeTab.toUpperCase()} PDF file found for this record.
                      </p>
                    </div>
                  )}
                </div>

                {/* Record Details Summary */}
                <div className="mt-6 bg-gradient-to-br from-slate-50 to-emerald-50/30 rounded-xl p-5 border border-slate-100 flex-shrink-0">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
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
                      <p className="font-bold text-emerald-600">{selectedRecord.pin || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Encoded By</label>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Avatar className="w-6 h-6 border border-slate-200">
                          {selectedRecord.encoder_profile_picture ? (
                            <AvatarImage
                              src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${selectedRecord.encoder_profile_picture}`}
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
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full border border-slate-100 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center h-[700px] text-muted-foreground">
                {loading ? (
                  <>
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-emerald-100 rounded-full">
                        <div className="absolute inset-0 border-4 border-t-emerald-600 rounded-full animate-spin"></div>
                      </div>
                    </div>
                    <p className="mt-4 text-lg font-medium text-slate-700">Loading records...</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-4">
                      <Printer className="w-10 h-10 text-slate-400" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">Select a record to preview</p>
                    <p className="text-sm text-slate-500 mt-1">Choose from the approved records list</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <CalibrationModal
        open={showCalibration}
        onOpenChange={setShowCalibration}
        recordId={selectedRecord?.id}
        onCalibrated={() => {
          if (selectedRecord) {
            // New flow: Clear the path and hide the preview so user must click Shoot again
            const updatedRecord = { ...selectedRecord, unirrig_precision_pdf_path: undefined };
            setSelectedRecord(updatedRecord);
            setApprovedRecords(prev => prev.map(r => r.id === selectedRecord.id ? updatedRecord : r));
            setShowPrecision(false);

            toast({
              title: "Calibration Saved",
              description: "Previous PDF deleted. Click 'Precision (Shoot)' to generate the new aligned version.",
            });
          }
        }}
      />
    </div >
  );
}