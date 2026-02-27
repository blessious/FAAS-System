import { useState, useEffect, useMemo } from "react";
import { FileEdit, Loader2, Plus, Search, X } from "lucide-react";
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
}

export default function Drafts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filteredDrafts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return drafts;

    return drafts.filter((r) => {
      const created = new Date(r.created_at);
      const createdText = Number.isNaN(created.getTime())
        ? String(r.created_at ?? "")
        : created.toLocaleDateString();

      const haystack = [
        r.id,
        r.arf_no,
        r.owner_name,
        r.property_location,
        r.encoder_name,
        r.updater_name,
        createdText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [drafts, searchQuery]);

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
                <RecentRecordsTable records={filteredDrafts} onDelete={handleDeleteDraft} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
