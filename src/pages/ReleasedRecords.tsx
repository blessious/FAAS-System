import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Printer,
    CheckCircle,
    User,
    MapPin,
    Loader2,
    FileText,
    FileSpreadsheet,
    Eye,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Clock,
    RotateCcw,
    Search,
    X,
    History,
    TrendingUp,
    Download,
    ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { printAPI } from "@/services/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

interface ReleasedRecord {
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
    released_at: string;
    approver_name: string;
    encoder_name: string;
    released_by_name: string;
    encoder_profile_picture?: string;
    status: string;
    excel_file_path?: string;
    unirrig_excel_file_path?: string;
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

const extractExcelFilename = (filePath: string): string => {
    if (!filePath) return '';
    const normalizedPath = filePath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    return parts.slice(-2).join('/');
};

const getStatusBadge = (status: string, small: boolean = false) => {
    return (
        <Badge
            variant="outline"
            className={cn(
                small ? "px-1 py-px text-[8px] font-black uppercase tracking-tighter" : "px-3 py-1.5 rounded-full text-xs font-bold shadow-sm",
                "border leading-none bg-blue-50 text-blue-700 border-blue-200"
            )}
        >
            <div className="flex items-center gap-1">
                <div className={cn(
                    small ? "w-0.5 h-0.5 rounded-full" : "w-1.5 h-1.5 rounded-full",
                    "bg-blue-500"
                )} />
                Released
            </div>
        </Badge>
    );
};

export default function ReleasedRecords() {
    const { toast } = useToast();
    const [selectedRecord, setSelectedRecord] = useState<ReleasedRecord | null>(null);
    const [releasedRecords, setReleasedRecords] = useState<ReleasedRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'faas' | 'unirrig'>('faas');
    const [pdfError, setPdfError] = useState(false);
    const [blockIframe, setBlockIframe] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Fetch released records
    useEffect(() => {
        fetchReleasedRecords();
    }, []);

    const fetchReleasedRecords = async () => {
        try {
            setLoading(true);
            const data = await printAPI.getReleasedHistory();
            setReleasedRecords(data || []);
        } catch (error: any) {
            console.error('Error fetching released records:', error);
            toast({
                title: "Error",
                description: error.error || "Failed to load released records",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // Filter released records based on search query
    const filteredRecords = useMemo(() => {
        if (!searchQuery.trim()) return releasedRecords;

        const q = searchQuery.toLowerCase();
        return releasedRecords.filter(record => {
            const date = new Date(record.released_at);
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
                (record.released_by_name?.toLowerCase() || "").includes(q) ||
                formattedDate.includes(q);
        });
    }, [releasedRecords, searchQuery]);

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
            pdfPath = selectedRecord.unirrig_pdf_preview_path || '';
        }

        if (!pdfPath) return '';

        const filename = extractFilename(pdfPath);
        const baseUrl = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:3001`;
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
    const handleSelectRecord = (record: ReleasedRecord) => {
        setSelectedRecord(record);
        setPdfError(false);
        setBlockIframe(false);
        setPreviewLoading(true);

        // Reset loading state after a short delay
        setTimeout(() => {
            setPreviewLoading(false);
        }, 500);
    };

    const handleCancelRelease = async (id: string) => {
        if (!window.confirm("Are you sure you want to cancel the release of this record? It will be moved back to Print Preview.")) {
            return;
        }

        try {
            await printAPI.cancelRelease(id);
            toast({
                title: "Release Cancelled",
                description: "Record has been moved back to Print Preview.",
            });
            setSelectedRecord(null);
            fetchReleasedRecords(); // Refresh the list
        } catch (error: any) {
            console.error('Cancel release error:', error);
            toast({
                title: "Error",
                description: error.error || "Failed to cancel release",
                variant: "destructive",
            });
        }
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
            <div className="relative rounded-xl bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 p-6 overflow-hidden">
                <div className="absolute inset-0 bg-grid-slate-100/20"></div>
                <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-48 h-48 bg-violet-300/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

                <div className="relative">
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <History className="w-8 h-8" />
                        Released Records History
                    </h1>
                    <p className="text-blue-100/80 mt-1">
                        Archive of records that have been marked as released/printed
                    </p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
                {/* Released Records List */}
                <div className="lg:col-span-4">
                    <Card className="h-full border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden flex flex-col">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100 px-4 py-4 flex-shrink-0 space-y-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white shadow-md shadow-blue-500/20">
                                        <History className="w-4 h-4" />
                                    </div>
                                    Release History
                                </CardTitle>
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                    {filteredRecords.length}
                                </Badge>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="Search history..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-8 h-9 text-xs border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg bg-white"
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
                                            <div className="w-12 h-12 border-3 border-blue-100 rounded-full">
                                                <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-sm font-medium text-slate-700">Loading history...</p>
                                    </div>
                                ) : releasedRecords.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 px-4">
                                        <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-4">
                                            <History className="w-8 h-8 text-slate-400" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-900">No released records</p>
                                        <p className="text-xs text-slate-500 mt-1 text-center">
                                            Records you release from Print Preview will appear here
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
                                                            ? "bg-blue-50/70 border-l-blue-500 border-y-blue-100/50 shadow-sm z-10"
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
                                                                <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-600">
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
                                                                <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
                                                                    <TrendingUp className="w-3 h-3" />
                                                                    Released {formatDate(record.released_at).split(',')[0]}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center self-center pr-1">
                                                            <ChevronRight className={cn(
                                                                "w-4 h-4 transition-colors",
                                                                selectedRecord?.id === record.id ? "text-blue-600" : "text-slate-300"
                                                            )} />
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Pagination Controls */}
                                        {totalPages > 1 && (
                                            <div className="p-3 border-t border-slate-100 bg-gradient-to-r from-slate-50/50 to-blue-50/30 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
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

                {/* Preview with PDF Viewer */}
                <div className="lg:col-span-8">
                    {selectedRecord ? (
                        <Card className="h-full border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden flex flex-col">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100 py-4 flex-shrink-0">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white shadow-md shadow-blue-500/20">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold text-slate-900">
                                                {selectedRecord.pin || "No PIN"}
                                            </CardTitle>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Released by {selectedRecord.released_by_name} • {formatDate(selectedRecord.released_at)}
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
                                                    className="rounded-md text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                                                >
                                                    FAAS
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="unirrig"
                                                    className="rounded-md text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                                                >
                                                    TDC
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>

                                        <Button
                                            size="sm"
                                            onClick={handleDownloadExcel}
                                            variant="outline"
                                            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg h-9 shadow-sm"
                                        >
                                            <FileSpreadsheet className="w-4 h-4" />
                                            Download Excel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handlePrint}
                                            disabled={!getPdfUrl}
                                            className="gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/30 rounded-lg h-9"
                                        >
                                            <Printer className="w-4 h-4" />
                                            Reprint
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleCancelRelease(selectedRecord.id)}
                                            variant="outline"
                                            className="gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg h-9"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-5 flex-1 flex flex-col min-h-0">
                                {/* PDF Preview Section */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    {getPdfUrl ? (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col h-full">
                                            <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 p-3 text-sm font-medium border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-blue-500" />
                                                    <span className="font-semibold text-slate-900">
                                                        {activeTab.toUpperCase()} Preview - {selectedRecord.pin || "No PIN"}
                                                    </span>
                                                </div>
                                                <a
                                                    href={getPdfUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-1"
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
                                                                <div className="w-10 h-10 border-3 border-blue-100 rounded-full">
                                                                    <div className="absolute inset-0 border-3 border-t-blue-600 rounded-full animate-spin"></div>
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
                                        <div className="flex flex-col items-center justify-center h-full p-8 border border-slate-200 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/30">
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

                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="h-full border border-slate-100 shadow-sm rounded-xl overflow-hidden">
                            <CardContent className="flex flex-col items-center justify-center h-[700px] text-muted-foreground">
                                {loading ? (
                                    <>
                                        <div className="relative">
                                            <div className="w-16 h-16 border-4 border-blue-100 rounded-full">
                                                <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin"></div>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-lg font-medium text-slate-700">Loading history...</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-4">
                                            <History className="w-10 h-10 text-slate-400" />
                                        </div>
                                        <p className="text-lg font-bold text-slate-900">Select a record from history</p>
                                        <p className="text-sm text-slate-500 mt-1">View details and re-print released records</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div >
    );
}
