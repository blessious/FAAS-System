import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, CheckCircle, User, MapPin, Loader2, FileText, Eye, AlertTriangle, ChevronRight, Clock, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { printAPI, approvalAPI } from "@/services/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";


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
  pdf_preview_path?: string;
  unirrig_pdf_preview_path?: string;
}

// Extracts the subpath for the API route
const extractFilename = (filePath: string): string => {
  if (!filePath) return '';
  const normalizedPath = filePath.replace(/\\/g, '/');
  const match = normalizedPath.match(/(FAAS|UNIRRIG)\/generated-pdf\/.+/i);
  if (match) {
    return match[0].replace(/^\/+/, '');
  }
  const parts = normalizedPath.split('/');
  return parts.slice(-3).join('/');
};

export default function PrintPreview() {
  const { toast } = useToast();
  const [selectedRecord, setSelectedRecord] = useState<ApprovedRecord | null>(null);
  const [approvedRecords, setApprovedRecords] = useState<ApprovedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'faas' | 'unirrig'>('faas');
  const [pdfError, setPdfError] = useState(false);
  const [blockIframe, setBlockIframe] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Fetch approved records
  useEffect(() => {
    fetchApprovedRecords();
  }, []);

  const fetchApprovedRecords = async () => {
    try {
      setLoading(true);
      const data = await printAPI.getApprovedRecords();
      setApprovedRecords(data);
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

  // Generate PDF URL based on active tab
  const getPdfUrl = useMemo(() => {
    if (!selectedRecord) return '';

    let pdfPath = '';
    if (activeTab === 'faas') {
      pdfPath = selectedRecord.pdf_preview_path || '';
    } else {
      pdfPath = selectedRecord.unirrig_pdf_preview_path || '';
    }

    if (!pdfPath) return '';

    const filename = extractFilename(pdfPath);
    const baseUrl = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:3000`;
    return filename ? `${baseUrl}/api/print/files/pdf/${filename}` : '';
  }, [selectedRecord, activeTab]);

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

  // Handle record selection
  const handleSelectRecord = (record: ApprovedRecord) => {
    setSelectedRecord(record);
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
        description: `FAAS record ${selectedRecord.arf_no} has been reverted to pending status.`,
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
    <div className="p-6 lg:p-8 space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Approved Records List */}
        <div className="lg:col-span-2">
          <Card className="h-full border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden flex flex-col">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b border-slate-100 py-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg text-white shadow-md shadow-emerald-500/20">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  Approved Records
                </CardTitle>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  {approvedRecords.length}
                </Badge>
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
                  <div className="divide-y divide-slate-100">
                    {approvedRecords.map((record) => (
                      <button
                        key={record.id}
                        onClick={() => handleSelectRecord(record)}
                        className={cn(
                          "w-full p-4 text-left transition-all duration-200 hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-emerald-100/30",
                          selectedRecord?.id === record.id && "bg-gradient-to-r from-emerald-50/50 to-emerald-100/30 border-l-4 border-l-emerald-500 shadow-sm"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-900 truncate uppercase text-base">{record.owner_name}</span>
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                                Approved
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 mb-2">
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
                            selectedRecord?.id === record.id ? "text-emerald-600" : "text-slate-300"
                          )} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Print Preview with PDF Viewer */}
        <div className="lg:col-span-3">
          {selectedRecord ? (
            <Card className="h-full border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden flex flex-col">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b border-slate-100 py-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg text-white shadow-md shadow-emerald-500/20">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900">
                        {selectedRecord.arf_no}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Approved by {selectedRecord.approver_name} • {formatDate(selectedRecord.approved_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tabs defaultValue={activeTab} value={activeTab} onValueChange={val => {
                      setActiveTab(val as 'faas' | 'unirrig');
                      setPdfError(false);
                    }} className="w-auto">
                      <TabsList className="grid w-[180px] grid-cols-2 bg-slate-100 p-1 rounded-lg">
                        <TabsTrigger
                          value="faas"
                          className="rounded-md text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm"
                        >
                          FAAS
                        </TabsTrigger>
                        <TabsTrigger
                          value="unirrig"
                          className="rounded-md text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm"
                        >
                          UNIRRIG
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button
                      size="sm"
                      onClick={handleCancelAction}
                      disabled={cancelling}
                      variant="outline"
                      className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg h-9"
                    >
                      {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      Cancel Approval
                    </Button>
                    <Button
                      size="sm"
                      onClick={handlePrint}
                      disabled={!getPdfUrl || cancelling}
                      className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/30 rounded-lg h-9"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </Button>
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
                            {activeTab.toUpperCase()} Preview - {selectedRecord.arf_no}
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
    </div>
  );
}