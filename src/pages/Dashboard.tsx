import { useMemo, useState, useEffect, useCallback } from "react";
import { FileText, Clock, XCircle, Plus, Loader2, Search, X, Filter, ChevronLeft, ChevronRight, CheckCircle, TrendingUp, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RecentRecordsTable } from "@/components/dashboard/RecentRecordsTable";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { dashboardAPI, faasAPI } from "@/services/api";
import { useSSE } from "@/hooks/useSSE";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext.jsx";


interface DashboardStats {
  totalRecords: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
}

interface DashboardRecord {
  id: string;
  arf_no: string;
  pin: string;
  owner_name: string;
  property_location: string;
  status: "approved" | "for_approval" | "draft" | "rejected";
  created_at: string;
  encoder_name: string;
  encoder_profile_picture?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, userRole, isAdmin, isEncoder } = useAuth() as any;

  const [stats, setStats] = useState<DashboardStats>({
    totalRecords: 0,
    pendingApproval: 0,
    approved: 0,
    rejected: 0,
  });
  const [recentRecords, setRecentRecords] = useState<DashboardRecord[]>([]);
  const [recentRecordsQuery, setRecentRecordsQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const recordsPerPage = 10;
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Client-side filtering for search
  const filteredRecentRecords = useMemo(() => {
    const q = recentRecordsQuery.trim().toLowerCase();
    if (!q) return recentRecords;

    const statusLabel: Record<DashboardRecord["status"], string> = {
      draft: "Draft",
      for_approval: "Pending",
      approved: "Approved",
      rejected: "Rejected",
    };

    return recentRecords.filter((r) => {
      const created = new Date(r.created_at);
      const createdText = Number.isNaN(created.getTime())
        ? String(r.created_at ?? "")
        : created.toLocaleDateString();

      const haystack = [
        r.id,
        r.arf_no,
        r.owner_name,
        r.property_location,
        r.status,
        statusLabel[r.status],
        createdText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [recentRecords, recentRecordsQuery]);

  // When searching, use client-side pagination on filtered results
  // When not searching, use server-side pagination info
  const displayedRecords = recentRecordsQuery ? filteredRecentRecords : recentRecords;
  const totalPages = recentRecordsQuery
    ? Math.ceil(filteredRecentRecords.length / recordsPerPage)
    : pagination.totalPages;

  const fetchDashboardData = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const [statsResponse, recordsResponse] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getRecentRecords({ page, limit: recordsPerPage }),
      ]);

      if (statsResponse) {
        setStats({
          totalRecords: statsResponse.totalRecords || 0,
          pendingApproval: statsResponse.pendingApproval || 0,
          approved: statsResponse.approved || 0,
          rejected: statsResponse.rejected || 0,
        });
      }

      // Handle the new paginated response format
      if (recordsResponse && typeof recordsResponse === "object") {
        if (Array.isArray(recordsResponse)) {
          // Legacy format: array of records
          setRecentRecords(recordsResponse);
          setPagination({
            page: 1,
            limit: recordsPerPage,
            totalRecords: recordsResponse.length,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          });
        } else if ("data" in recordsResponse && Array.isArray(recordsResponse.data)) {
          // New paginated format
          setRecentRecords(recordsResponse.data);
          if (recordsResponse.pagination) {
            setPagination(recordsResponse.pagination);
          }
        }
      }
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try refreshing.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, recordsPerPage]);

  const handleDeleteDraft = async (id: string) => {
    try {
      await faasAPI.deleteDraft(id);
      toast({
        title: "Draft deleted",
        description: "The draft has been deleted successfully.",
      });
      fetchDashboardData(currentPage);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.error ?? "Failed to delete draft.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDashboardData(currentPage);
  }, [currentPage]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    if (recentRecordsQuery) {
      setCurrentPage(1);
    }
  }, [recentRecordsQuery]);

  // Handle page changes
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Only fetch from server if not searching
    if (!recentRecordsQuery) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useSSE({
    onRecordChange: useCallback((data) => {
      console.log('📡 Dashboard received record change:', data);

      const actionMessages: Record<string, string> = {
        created: 'New record created',
        updated: 'Record updated',
        approved: 'Record approved',
        rejected: 'Record rejected',
        deleted: 'Record deleted',
        files_generated: 'Files generated for record'
      };

      // Only show toast if it's not a 'submitted' or 'files_generated' event
      if (data.action !== 'submitted' && data.action !== 'files_generated' && actionMessages[data.action] && data.record) {
        toast({
          title: actionMessages[data.action],
          description: `PIN: ${data.record.pin || 'N/A'}`,
        });
      }

      // Small delay to ensure DB is settled before fetching
      setTimeout(() => {
        fetchDashboardData(currentPage);
        setLastRefresh(Date.now()); // Force sub-components to clear local state if needed
      }, 500);
    }, [fetchDashboardData, currentPage, toast]),

    onConnected: useCallback(() => {
      console.log('✅ Dashboard connected to real-time updates');
    }, [])
  });

  // Calculate the correct start and end indices for display
  const getDisplayRange = () => {
    if (recentRecordsQuery) {
      // Client-side pagination when searching
      const start = (currentPage - 1) * recordsPerPage + 1;
      const end = Math.min(filteredRecentRecords.length, currentPage * recordsPerPage);
      return { start, end, total: filteredRecentRecords.length };
    } else {
      // Server-side pagination
      const start = (pagination.page - 1) * pagination.limit + 1;
      const end = Math.min(pagination.totalRecords, pagination.page * pagination.limit);
      return { start, end, total: pagination.totalRecords };
    }
  };

  const { start, end, total } = getDisplayRange();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 lg:p-6 space-y-6">
      {/* Compact Header Section */}
      <div className="relative rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 p-4 lg:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-100/20"></div>
        <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-300/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md flex items-center gap-2">
              <BarChart3 className="w-7 h-7" />
              Dashboard Overview
            </h1>
            <p className="text-blue-100 text-sm mt-1 drop-shadow">
              Welcome back, <span className="font-bold text-white uppercase">{user?.full_name}</span>.
              Monitor your FAAS records and system activity.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 mt-3 md:mt-0">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span className="text-xs font-medium text-white capitalize">{userRole}</span>
            </div>

            {(isEncoder || isAdmin) && (
              <Button
                onClick={() => navigate("/faas/new")}
                className="bg-white hover:bg-blue-50 text-blue-600 shadow-xl hover:shadow-2xl gap-2 px-5 py-2 rounded-lg font-semibold transition-all duration-300 hover:scale-105 w-full md:w-auto"
              >
                <Plus className="w-4 h-4" />
                New Record
              </Button>
            )}
          </div>
        </div>
      </div>


      {loading && !recentRecords.length ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
            <p className="text-slate-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <p className="text-slate-900 font-semibold text-lg">Error Loading Dashboard</p>
              <p className="text-slate-600 text-sm">{error}</p>
            </div>
            <Button
              onClick={() => fetchDashboardData(currentPage)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Try Again
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Records Card */}
            <Card className="group relative overflow-hidden border border-blue-100/50 bg-gradient-to-br from-white to-blue-50/50 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 rounded-xl">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white shadow-md shadow-blue-500/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70">Total</span>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <TrendingUp className="w-3 h-3 text-blue-500" />
                      <span className="text-xs text-blue-600 font-medium">+12%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-slate-900">{stats.totalRecords}</h3>
                  <p className="text-sm text-slate-600 font-medium">Total Records</p>
                </div>
                <div className="mt-4 pt-3 border-t border-blue-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-blue-600/70">This Month</span>
                    <span className="text-xs font-medium text-blue-700">+24</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending Approval Card */}
            <Card className="group relative overflow-hidden border border-amber-100/50 bg-gradient-to-br from-white to-amber-50/50 shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-300 rounded-xl">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg text-white shadow-md shadow-amber-500/20">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600/70">Pending</span>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <TrendingUp className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-amber-600 font-medium">+8%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-slate-900">{stats.pendingApproval}</h3>
                  <p className="text-sm text-slate-600 font-medium">Awaiting Review</p>
                </div>
                <div className="mt-4 pt-3 border-t border-amber-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-600/70">Avg. Time</span>
                    <span className="text-xs font-medium text-amber-700">2.5 days</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Approved Card */}
            <Card className="group relative overflow-hidden border border-emerald-100/50 bg-gradient-to-br from-white to-emerald-50/50 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-300 rounded-xl">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg text-white shadow-md shadow-emerald-500/20">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70">Approved</span>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">+15%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-slate-900">{stats.approved}</h3>
                  <p className="text-sm text-slate-600 font-medium">Completed</p>
                </div>
                <div className="mt-4 pt-3 border-t border-emerald-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-600/70">Success Rate</span>
                    <span className="text-xs font-medium text-emerald-700">94%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rejected Card */}
            <Card className="group relative overflow-hidden border border-rose-100/50 bg-gradient-to-br from-white to-rose-50/50 shadow-sm hover:shadow-md hover:border-rose-200 transition-all duration-300 rounded-xl">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg text-white shadow-md shadow-rose-500/20">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600/70">Rejected</span>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <TrendingUp className="w-3 h-3 text-rose-500" />
                      <span className="text-xs text-rose-600 font-medium">-5%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-slate-900">{stats.rejected}</h3>
                  <p className="text-sm text-slate-600 font-medium">Needs Revision</p>
                </div>
                <div className="mt-4 pt-3 border-t border-rose-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-rose-600/70">Resolved</span>
                    <span className="text-xs font-medium text-rose-700">85%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
                  <p className="text-sm text-slate-500">Monitor all FAAS records and their status</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative group flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <Input
                    type="search"
                    value={recentRecordsQuery}
                    onChange={(e) => setRecentRecordsQuery(e.target.value)}
                    placeholder="Search ARF No, Owner, Location..."
                    className="pl-9 pr-8 w-full sm:w-[280px] bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 rounded-lg transition-all text-sm h-9"
                  />
                  {recentRecordsQuery && (
                    <button
                      onClick={() => setRecentRecordsQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 h-9 w-9"
                >
                  <Filter className="w-3.5 h-3.5 text-slate-600" />
                </Button>
              </div>
            </div>

            <Card className="border border-slate-100 bg-white shadow-sm overflow-hidden rounded-xl">
              <CardContent className="p-0">
                {displayedRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                      <FileText className="w-8 h-8 text-blue-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {recentRecordsQuery ? "No matching records" : "No records found"}
                    </h3>
                    <p className="text-slate-500 text-sm max-w-sm mt-1 mb-4">
                      {recentRecordsQuery
                        ? "Try adjusting your search criteria"
                        : "Start by creating your first FAAS record to track property assessments"}
                    </p>
                    {!recentRecordsQuery && (
                      <Button
                        onClick={() => navigate("/faas/new")}
                        className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md shadow-blue-500/20 gap-2 px-4 rounded-lg font-semibold text-sm h-9"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create First Record
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <RecentRecordsTable
                        key={lastRefresh}
                        records={displayedRecords}
                        onDelete={handleDeleteDraft}
                      />
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
                        <div className="text-sm text-slate-600 font-medium">
                          Showing <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{start}</span> to <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{end}</span> of <span className="font-bold text-slate-900">{total}</span> records
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => handlePageChange(currentPage - 1)}
                            className="rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-600 transition-all h-9 px-4 font-semibold"
                          >
                            <ChevronLeft className="w-4 h-4 mr-1.5" />
                            Previous
                          </Button>

                          <div className="flex items-center gap-1.5 mx-2">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }

                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(pageNum)}
                                  className={cn(
                                    "h-9 w-9 p-0 font-semibold rounded-lg transition-all",
                                    currentPage === pageNum
                                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/30"
                                      : "border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700"
                                  )}
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}

                            {totalPages > 5 && currentPage < totalPages - 2 && (
                              <>
                                <span className="text-slate-400 font-bold">...</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePageChange(totalPages)}
                                  className="h-9 w-9 p-0 font-semibold rounded-lg border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                                >
                                  {totalPages}
                                </Button>
                              </>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className="rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-600 transition-all h-9 px-4 font-semibold"
                          >
                            Next
                            <ChevronRight className="w-4 h-4 ml-1.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}