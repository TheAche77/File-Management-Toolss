import { useEffect, useMemo, useRef, useState } from "react";
import { 
  useRunImport, 
  useGetImportRuns, 
  useGetImportRunById,
  useGetReviewQueue,
  getGetImportRunsQueryKey,
  getGetImportRunByIdQueryKey,
  getGetReviewQueueQueryKey,
  useGetCategories,
  getGetCategoriesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, RefreshCw, Database, ClipboardCheck, TriangleAlert, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { clearStoredAdminToken, getStoredAdminToken, setStoredAdminToken } from "@/lib/admin-auth";

function formatReviewReason(reason: string) {
  return reason
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lastActiveRunStatus = useRef<string | null>(null);
  
  const [category, setCategory] = useState("art_gallery");
  const [city, setCity] = useState("Rome");
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(Boolean(getStoredAdminToken()));
  const [authError, setAuthError] = useState<string | null>(null);

  const { data: categories } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() }
  });
  
  const { data: runs, isLoading: runsLoading, error: runsError } = useGetImportRuns({
    query: { 
      queryKey: getGetImportRunsQueryKey(),
      enabled: isAdminUnlocked,
      refetchInterval: activeRunId ? 5000 : false,
    }
  });

  const { data: activeRun, error: activeRunError } = useGetImportRunById(activeRunId ?? 0, {
    query: {
      queryKey: getGetImportRunByIdQueryKey(activeRunId ?? 0),
      enabled: isAdminUnlocked && !!activeRunId,
      refetchInterval: activeRunId ? 2000 : false,
    }
  });

  const reviewQueueParams = useMemo(() => ({ limit: 12 }), []);

  const {
    data: reviewQueue,
    isLoading: reviewQueueLoading,
    error: reviewQueueError,
  } = useGetReviewQueue(reviewQueueParams, {
    query: {
      queryKey: getGetReviewQueueQueryKey(reviewQueueParams),
      enabled: isAdminUnlocked,
      refetchInterval: activeRunId ? 5000 : 15000,
    }
  });

  const currentRun = activeRun ?? runs?.find((run) => run.id === activeRunId) ?? null;

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (category && category !== "all") params.set("categorySlug", category);
    if (city.trim()) params.set("city", city.trim());
    const query = params.toString();
    return query ? `/api/export/businesses.csv?${query}` : "/api/export/businesses.csv";
  }, [category, city]);

  useEffect(() => {
    if (!activeRunId) {
      const latestActiveRun = runs?.find((run) => ["queued", "running", "fetching", "merging"].includes(run.status));
      if (latestActiveRun) {
        setActiveRunId(latestActiveRun.id);
      }
    }
  }, [activeRunId, runs]);

  useEffect(() => {
    if (!currentRun) return;

    if (lastActiveRunStatus.current === currentRun.status) return;

    if (currentRun.status === "completed") {
      toast({
        title: "Import Completed",
        description: `Fetched: ${currentRun.fetched || 0}, Inserted: ${currentRun.inserted || 0}, Updated: ${currentRun.updated || 0}, Skipped: ${currentRun.skipped || 0}`,
      });
      queryClient.invalidateQueries({ queryKey: getGetImportRunsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetReviewQueueQueryKey(reviewQueueParams) });
      setActiveRunId(null);
    }

    if (currentRun.status === "failed") {
      toast({
        title: "Import Failed",
        description: currentRun.errorMessage || "The queued import failed.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: getGetImportRunsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetReviewQueueQueryKey(reviewQueueParams) });
      setActiveRunId(null);
    }

    lastActiveRunStatus.current = currentRun.status;
  }, [currentRun, queryClient, reviewQueueParams, toast]);

  const resetAdminAccess = (message?: string) => {
    clearStoredAdminToken();
    setIsAdminUnlocked(false);
    setActiveRunId(null);
    setAuthError(message ?? null);
  };

  const importMutation = useRunImport({
    mutation: {
      onSuccess: (data) => {
        if (data.runId) {
          setActiveRunId(data.runId);
          lastActiveRunStatus.current = data.status;
        }
        queryClient.invalidateQueries({ queryKey: getGetImportRunsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetReviewQueueQueryKey(reviewQueueParams) });
        toast({
          title: "Import Queued",
          description: data.message,
        });
      },
      onError: (error) => {
        if ((error as { status?: number }).status === 401) {
          resetAdminAccess("The admin token was rejected by the API.");
        }
        toast({
          title: "Import Failed",
          description: (error as any)?.response?.data?.error || error.message || "An unknown error occurred",
          variant: "destructive",
        });
      }
    }
  });

  const handleImport = () => {
    if (!category || !city) return;
    importMutation.mutate({ data: { categorySlug: category, city } });
  };

  useEffect(() => {
    const unauthorized =
      (importMutation.error as { status?: number } | null)?.status === 401;

    if (unauthorized) {
      resetAdminAccess("The admin token was rejected by the API.");
    }
  }, [importMutation.error]);

  useEffect(() => {
    const queryErrors = [runsError, activeRunError, reviewQueueError];
    const hasUnauthorized = queryErrors.some(
      (error) => (error as { status?: number } | null)?.status === 401,
    );

    if (hasUnauthorized) {
      resetAdminAccess("The admin token was rejected by the API.");
    }
  }, [activeRunError, reviewQueueError, runsError]);

  const handleUnlock = () => {
    const trimmedToken = tokenInput.trim();
    if (!trimmedToken) {
      setAuthError("Enter the admin token before unlocking.");
      return;
    }

    setStoredAdminToken(trimmedToken);
    setIsAdminUnlocked(true);
    setAuthError(null);
    setTokenInput("");
    queryClient.invalidateQueries({ queryKey: getGetImportRunsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReviewQueueQueryKey(reviewQueueParams) });
  };

  const handleLogout = () => {
    resetAdminAccess();
    toast({
      title: "Admin session cleared",
      description: "The local admin token has been removed from this browser session.",
    });
  };

  if (!isAdminUnlocked) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Admin Access</CardTitle>
            <CardDescription>
              Enter the admin token configured on the API server to unlock imports and review workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Token</label>
              <Input
                type="password"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="Paste ADMIN_API_TOKEN"
              />
            </div>
            {authError && (
              <div className="text-sm text-destructive">{authError}</div>
            )}
            <Button className="w-full" onClick={handleUnlock}>
              Unlock Admin
            </Button>
            <p className="text-xs text-muted-foreground">
              The token is stored only in this browser session and sent as a Bearer token to protected API routes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-4xl font-serif text-foreground font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground mt-1">System controls and data management.</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Lock Admin
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Data Import</CardTitle>
            <CardDescription>Fetch the latest business data from OpenStreetMap for a given category and city.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">City</label>
              <Input 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                placeholder="e.g. Rome" 
              />
            </div>

            <Button 
              onClick={handleImport} 
              disabled={importMutation.isPending || !category || !city || !!currentRun}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
              data-testid="button-run-import"
            >
              {importMutation.isPending ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Queueing...</>
              ) : currentRun ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Import In Progress</>
              ) : (
                <><Database className="mr-2 h-4 w-4" /> Run Import</>
              )}
            </Button>

            {currentRun ? (
              <div className="mt-4 text-sm bg-muted/50 p-3 border border-border rounded-md">
                <p className="font-medium text-foreground mb-1 flex items-center gap-2">
                  <Badge variant={currentRun.status === "failed" ? "destructive" : "secondary"} className="capitalize">
                    {currentRun.status}
                  </Badge>
                  Active Run #{currentRun.id}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-center text-xs">
                  <div className="bg-background p-2 rounded border">
                    <div className="font-bold">{currentRun.fetched || 0}</div>
                    <div className="text-muted-foreground">Fetched</div>
                  </div>
                  <div className="bg-background p-2 rounded border">
                    <div className="font-bold text-primary">{currentRun.inserted || 0}</div>
                    <div className="text-muted-foreground">Inserted</div>
                  </div>
                  <div className="bg-background p-2 rounded border">
                    <div className="font-bold">{currentRun.updated || 0}</div>
                    <div className="text-muted-foreground">Updated</div>
                  </div>
                  <div className="bg-background p-2 rounded border">
                    <div className="font-bold">{currentRun.skipped || 0}</div>
                    <div className="text-muted-foreground">Skipped</div>
                  </div>
                  <div className="bg-background p-2 rounded border">
                    <div className="font-bold">{currentRun.errors || 0}</div>
                    <div className="text-muted-foreground">Errors</div>
                  </div>
                </div>
              </div>
            ) : importMutation.data && (
              <div className="mt-4 text-sm bg-muted/50 p-3 border border-border rounded-md">
                <p className="font-medium text-foreground mb-1 flex items-center gap-2">
                  <Badge variant={importMutation.data.success ? "secondary" : "destructive"}>
                    {importMutation.data.status}
                  </Badge>
                  Last Result
                </p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
                  <div className="bg-background p-2 rounded border">
                    <div className="font-bold">{importMutation.data.fetched}</div>
                    <div className="text-muted-foreground">Fetched</div>
                  </div>
                  <div className="bg-background p-2 rounded border">
                    <div className="font-bold text-primary">{importMutation.data.inserted}</div>
                    <div className="text-muted-foreground">Inserted</div>
                  </div>
                  <div className="bg-background p-2 rounded border">
                    <div className="font-bold">{importMutation.data.updated}</div>
                    <div className="text-muted-foreground">Updated</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Data Export</CardTitle>
            <CardDescription>Download the complete catalogue as a CSV file.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              asChild
            >
              <a href={exportHref} download>
                <Download className="mr-2 h-4 w-4" /> Export Businesses CSV
              </a>
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              The export will respect the selected category and city filters above.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Review Queue
          </CardTitle>
          <CardDescription>
            Prioritized businesses that still need manual review before deeper enrichment or outreach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviewQueueLoading ? (
            <div className="text-sm text-muted-foreground">Loading review queue...</div>
          ) : !reviewQueue || reviewQueue.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No businesses currently need review in the queue.
            </div>
          ) : (
            <div className="space-y-3">
              {reviewQueue.map((item) => (
                <div
                  key={item.business.id}
                  className="rounded-lg border bg-background p-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/businesses/${item.business.id}`} className="font-medium hover:text-primary transition-colors">
                        {item.business.name}
                      </Link>
                      <Badge variant="secondary" className="capitalize">
                        {item.business.categorySlug.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline">Priority {item.priorityScore}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.business.city || "Unknown city"}
                      {item.business.addressLine ? `, ${item.business.addressLine}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.reasons.map((reason) => (
                        <Badge key={reason} variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
                          <TriangleAlert className="mr-1 h-3 w-3" />
                          {formatReviewReason(reason)}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>{item.sourceCount} sources</span>
                      <span>{item.officialSourceCount} official</span>
                      <span>{item.failedSourceCount} failed</span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/businesses/${item.business.id}`}>Open Review</Link>
                    </Button>
                    {item.business.website && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={item.business.website} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-serif mb-4 font-semibold tracking-tight">Import History</h2>
        <div className="bg-card border border-border overflow-hidden rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Fetched</th>
                  <th className="px-4 py-3 font-medium text-right">Inserted</th>
                  <th className="px-4 py-3 font-medium text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runsLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading history...</td></tr>
                ) : runs?.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No import history found.</td></tr>
                ) : (
                  runs?.map((run) => (
                    <tr key={run.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">
                        {format(new Date(run.startedAt), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium">{run.city}</div>
                        <div className="text-xs text-muted-foreground capitalize">{run.categorySlug.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge 
                          variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}
                          className="capitalize text-[10px] rounded-sm font-medium"
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{run.fetched || 0}</td>
                      <td className="px-4 py-3 text-right text-primary font-medium">{run.inserted || 0}</td>
                      <td className="px-4 py-3 text-right">{run.updated || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
