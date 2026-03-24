import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, FileEdit, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { faasAPI } from "@/services/api";
import { RecentRecordsTable } from "@/components/dashboard/RecentRecordsTable";

interface DraftRecord {
  id: string;
  arf_no: string;
  pin: string;
  owner_name: string;
  property_location: string;
  status: "draft" | "for_approval" | "approved" | "rejected";
  created_at: string;
  updated_at?: string;
  encoder_name: string;
  encoder_profile_picture?: string;
  updater_name?: string;
  updater_profile_picture?: string;
  transaction_no?: number;
  linked_entries_count?: number;
}

export default function Drafts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredDrafts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return drafts;

    return drafts.filter((record) => {
      const date = new Date(record.updated_at || record.created_at);
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
        (record.updater_name?.toLowerCase() || "").includes(q) ||
        formattedDate.includes(q);
    });
  }, [drafts, searchQuery]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredDrafts.length / itemsPerPage);
  const paginatedDrafts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDrafts.slice(start, start + itemsPerPage);
  }, [filteredDrafts, currentPage]);

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleDeleteDraft = async (id: string) => {
    try {
      await faasAPI.deleteDraft(id);
      toast({
        title: "Draft deleted",
        description: "The draft has been deleted successfully.",
      });
      fetchDrafts();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.error ?? "Failed to delete draft.",
        variant: "destructive",
      });
    }
  };

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await faasAPI.getDrafts();

      // Backend returns { success: true, data: records }; axios returns response.data
      if (response && typeof response === "object" && "data" in response && Array.isArray((response as any).data)) {
        setDrafts((response as any).data);
      } else if (response && Array.isArray(response)) {
        setDrafts(response);
      } else {
        setDrafts([]);
      }
    } catch (err: any) {
      console.error("Error fetching drafts:", err);
      setError("Failed to load drafts");
      setDrafts([]);
      toast({
        title: "Error",
        description: "Failed to load drafts. Please try refreshing.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Drafts</h1>
          <p className="text-muted-foreground mt-1">
            View and continue editing your draft FAAS records.
          </p>
        </div>
        <Button onClick={() => navigate("/faas/new")} className="gap-2">
          <Plus className="w-4 h-4" />
          New FAAS
        </Button>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-950/20 dark:border-red-800">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDrafts}
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Loading drafts...</p>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Draft Records</CardTitle>

            {drafts.length > 0 && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <div className="relative w-full sm:w-[320px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search drafts..."
                    aria-label="Search drafts"
                    className="pl-9 pr-10"
                  />
                  {searchQuery.trim().length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {filteredDrafts.length} of {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileEdit className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No drafts yet</p>
                <p className="text-sm mt-1">
                  Start a new FAAS and save as draft to see it here.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => navigate("/faas/new")}
                >
                  <Plus className="w-4 h-4" />
                  New FAAS
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <RecentRecordsTable records={paginatedDrafts} onDelete={handleDeleteDraft} searchQuery={searchQuery} startIndex={(currentPage - 1) * itemsPerPage} />

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-5 px-2">
                    <div className="text-sm text-slate-500 font-medium">
                      Showing <span className="text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to{" "}
                      <span className="text-slate-900">
                        {Math.min(currentPage * itemsPerPage, filteredDrafts.length)}
                      </span>{" "}
                      of <span className="text-slate-900">{filteredDrafts.length}</span> records
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all font-semibold"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1.5 px-3">
                        <span className="text-sm font-bold text-blue-600">{currentPage}</span>
                        <span className="text-sm font-medium text-slate-400">/</span>
                        <span className="text-sm font-medium text-slate-500">{totalPages}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all font-semibold"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
