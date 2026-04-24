import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { getGetCategoriesQueryKey, useGetCategories } from "@workspace/api-client-react";
import { SharedBusinessFilters } from "@/components/shared-business-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAdminToken } from "@/lib/admin-auth";
import { buildSearchParams, readSharedBusinessFilters, syncSearchParams } from "@/lib/business-filters";
import { formatPipelineValue } from "@/lib/outreach-formatting";
import { useToast } from "@/hooks/use-toast";

type ResearchMetrics = {
  totalBusinesses: number;
  qualifiedBusinesses: number;
  contactableBusinesses: number;
  readyBusinesses: number;
  reviewBusinesses: number;
  staleHighPriorityBusinesses: number;
  engineBreakdown: {
    revenue: number;
    institutional: number;
    authority: number;
  };
  relationshipBreakdown: {
    warmPaths: number;
    prestigeWatchlist: number;
  };
  topNextSteps: { recommendedNextStep: string; total: number }[];
  jobCounts: {
    queued: number;
    running: number;
    retrying: number;
    completed: number;
    failed: number;
  };
  feedback: {
    recentEvents: number;
    manualArtistOverrides: number;
    primaryContactOverrides: number;
    reviewCorrections: number;
  };
};

type ResearchBusiness = {
  id: number;
  name: string;
  city?: string | null;
  country?: string | null;
  categorySlug: string;
  targetMarket?: string | null;
  avatarType?: string | null;
  relevanceScore?: number | null;
  contactabilityScore?: number | null;
  confidenceScore?: number | null;
  freshnessScore?: number | null;
  priorityScore?: number | null;
  researchScore?: number | null;
  readyForOutreach: boolean;
  reviewRequired: boolean;
  reviewReason?: string | null;
  recommendedNextStep?: string | null;
  topGap?: string | null;
};

type ResearchFeed = {
  businesses: ResearchBusiness[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ReviewBucket = {
  key: string;
  label: string;
  count: number;
  items: {
    business: ResearchBusiness;
    reasons: string[];
    priorityScore: number;
  }[];
};

type ResearchJob = {
  id: number;
  jobType: string;
  businessId?: number | null;
  status: string;
  priority: number;
  scheduledAt?: string | null;
  errorMessage?: string | null;
};

type ResearchView = {
  id: number;
  name: string;
  scope: string;
  isDefault: boolean;
  filtersJson: Record<string, unknown>;
  sortJson: Record<string, unknown>;
};

function apiHeaders() {
  const token = getStoredAdminToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : undefined;
}

function withParams(path: string, query: string, extra?: string) {
  const params = new URLSearchParams(query);
  if (extra) {
    const extraParams = new URLSearchParams(extra);
    for (const [key, value] of extraParams.entries()) {
      params.set(key, value);
    }
  }

  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export default function ResearchPage() {
  const { toast } = useToast();
  const hasAdminToken = Boolean(getStoredAdminToken());
  const initial = readSharedBusinessFilters(window.location.search);
  const [search, setSearch] = useState(initial.search);
  const [city, setCity] = useState(initial.city);
  const [category, setCategory] = useState(initial.categorySlug);
  const [targetMarket, setTargetMarket] = useState(initial.targetMarket);
  const [engineType, setEngineType] = useState(initial.engineType);
  const [targetCluster, setTargetCluster] = useState(initial.targetCluster);
  const [minPriorityScore, setMinPriorityScore] = useState(initial.minPriorityScore?.toString() ?? "60");
  const [minResearchScore, setMinResearchScore] = useState(initial.minResearchScore?.toString() ?? "60");
  const [metrics, setMetrics] = useState<ResearchMetrics | null>(null);
  const [feed, setFeed] = useState<ResearchFeed | null>(null);
  const [reviewBuckets, setReviewBuckets] = useState<ReviewBucket[]>([]);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [views, setViews] = useState<ResearchView[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const { data: categories } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() },
  });

  const queryString = useMemo(() => {
    const nextSearch = buildSearchParams(window.location.search, {
      search,
      city,
      categorySlug: category,
      targetMarket,
      engineType,
      targetCluster,
      minPriorityScore: minPriorityScore ? Number(minPriorityScore) : undefined,
      minResearchScore: minResearchScore ? Number(minResearchScore) : undefined,
      hasWebsite: false,
      hasPhone: false,
      readyForOutreach: false,
      reviewRequired: false,
      page: 1,
      horizonDays: undefined,
      limit: undefined,
    });
    return nextSearch;
  }, [category, city, engineType, minPriorityScore, minResearchScore, search, targetCluster, targetMarket]);

  useEffect(() => {
    syncSearchParams(queryString);
  }, [queryString]);

  useEffect(() => {
    if (!hasAdminToken) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [metricsData, feedData, bucketData, jobsData, viewsData] = await Promise.all([
          fetchJson<ResearchMetrics>(withParams("/api/research/metrics", queryString), {
            headers: apiHeaders(),
          }),
          fetchJson<ResearchFeed>(withParams("/api/research/feed", queryString, "pageSize=20"), {
            headers: apiHeaders(),
          }),
          fetchJson<ReviewBucket[]>(withParams("/api/research/review-buckets", queryString, "limit=60"), {
            headers: apiHeaders(),
          }),
          fetchJson<ResearchJob[]>(`/api/research/jobs?limit=12`, {
            headers: apiHeaders(),
          }),
          fetchJson<ResearchView[]>(`/api/research/views`, {
            headers: apiHeaders(),
          }),
        ]);

        if (cancelled) return;
        setMetrics(metricsData);
        setFeed(feedData);
        setReviewBuckets(bucketData);
        setJobs(jobsData);
        setViews(viewsData);
      } catch (error) {
        if (cancelled) return;
        toast({
          title: "Research load failed",
          description: error instanceof Error ? error.message : "Could not load research data.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [hasAdminToken, queryString, reloadKey, toast]);

  const handleRunAutomation = async () => {
    try {
      await fetchJson("/api/research/jobs/run", {
        method: "POST",
        headers: apiHeaders(),
      });
      setReloadKey((value) => value + 1);
    } catch (error) {
      toast({
        title: "Automation tick failed",
        description: error instanceof Error ? error.message : "Could not run research automation.",
        variant: "destructive",
      });
    }
  };

  const handleSaveView = async () => {
    const name = window.prompt("Saved view name");
    if (!name?.trim()) return;

    try {
      await fetchJson("/api/research/views", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          filtersJson: {
            search,
            city,
            categorySlug: category,
            targetMarket,
            engineType,
            targetCluster,
            minPriorityScore: minPriorityScore ? Number(minPriorityScore) : undefined,
            minResearchScore: minResearchScore ? Number(minResearchScore) : undefined,
          },
          sortJson: {
            field: "researchScore",
            direction: "desc",
          },
        }),
      });
      setReloadKey((value) => value + 1);
    } catch (error) {
      toast({
        title: "Save view failed",
        description: error instanceof Error ? error.message : "Could not save research view.",
        variant: "destructive",
      });
    }
  };

  const applyView = (view: ResearchView) => {
    const filters = view.filtersJson ?? {};
    setSearch(String(filters["search"] ?? ""));
    setCity(String(filters["city"] ?? ""));
    setCategory(String(filters["categorySlug"] ?? "all"));
    setTargetMarket(String(filters["targetMarket"] ?? "all"));
    setEngineType(String(filters["engineType"] ?? "all"));
    setTargetCluster(String(filters["targetCluster"] ?? "all"));
    setMinPriorityScore(filters["minPriorityScore"] ? String(filters["minPriorityScore"]) : "");
    setMinResearchScore(filters["minResearchScore"] ? String(filters["minResearchScore"]) : "");
  };

  const deleteView = async (id: number) => {
    try {
      await fetch(`/api/research/views/${id}`, {
        method: "DELETE",
        headers: apiHeaders(),
      });
      setReloadKey((value) => value + 1);
    } catch (error) {
      toast({
        title: "Delete view failed",
        description: error instanceof Error ? error.message : "Could not delete research view.",
        variant: "destructive",
      });
    }
  };

  if (!hasAdminToken) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-serif text-foreground">Research Console</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Discovery, qualification, review buckets and machine jobs.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Admin unlock required</CardTitle>
            <CardDescription>Research endpoints are protected because they expose operational internals.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin">Go to Admin</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = metrics
    ? [
        { label: "Qualified", value: metrics.qualifiedBusinesses },
        { label: "Contactable", value: metrics.contactableBusinesses },
        { label: "Ready", value: metrics.readyBusinesses },
        { label: "Review", value: metrics.reviewBusinesses },
        { label: "Revenue Engine", value: metrics.engineBreakdown.revenue },
        { label: "Institutional Engine", value: metrics.engineBreakdown.institutional },
        { label: "Authority Engine", value: metrics.engineBreakdown.authority },
        { label: "Warm Paths", value: metrics.relationshipBreakdown.warmPaths },
        { label: "Prestige Watchlist", value: metrics.relationshipBreakdown.prestigeWatchlist },
        { label: "Queued Jobs", value: metrics.jobCounts.queued + metrics.jobCounts.retrying },
        { label: "Manual Overrides", value: metrics.feedback.manualArtistOverrides + metrics.feedback.primaryContactOverrides },
      ]
    : [];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground">Research Console</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Queue persistenti, freshness scheduling, review buckets e ranking operativo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReloadKey((value) => value + 1)}>Refresh</Button>
          <Button variant="outline" onClick={handleSaveView}>Save view</Button>
          <Button onClick={handleRunAutomation}>Run automation</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <SharedBusinessFilters
          categories={categories}
          city={city}
          categorySlug={category}
          targetMarket={targetMarket}
          engineType={engineType}
          targetCluster={targetCluster}
          onCityChange={setCity}
          onCategoryChange={setCategory}
          onTargetMarketChange={setTargetMarket}
          onEngineTypeChange={setEngineType}
          onTargetClusterChange={setTargetCluster}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            placeholder="Search names and addresses..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Input
            placeholder="Min priority score"
            value={minPriorityScore}
            onChange={(event) => setMinPriorityScore(event.target.value)}
          />
          <Input
            placeholder="Min research score"
            value={minResearchScore}
            onChange={(event) => setMinResearchScore(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((view) => (
          <div key={view.id} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
            <button className="text-sm font-medium hover:text-primary" onClick={() => applyView(view)}>
              {view.name}
            </button>
            {view.isDefault && <Badge variant="outline">Default</Badge>}
            <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => void deleteView(view.id)}>
              delete
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)
          : statCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">{card.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-serif">{card.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Research Candidates</CardTitle>
            <CardDescription>Businesses ordered by research score and next step.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Scores</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feed?.businesses.map((business) => (
                      <TableRow key={business.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <Link href={`/businesses/${business.id}`} className="font-medium hover:text-primary">
                              {business.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {[business.city, business.country, business.targetMarket].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">Priority {business.priorityScore ?? 0}</Badge>
                            <Badge variant="outline">Research {business.researchScore ?? 0}</Badge>
                            <Badge variant="outline">Confidence {business.confidenceScore ?? 0}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {business.readyForOutreach && <Badge>Ready</Badge>}
                            {business.reviewRequired && <Badge variant="outline">Review</Badge>}
                            {business.topGap && (
                              <div className="text-xs text-muted-foreground">
                                Gap: {formatPipelineValue(business.topGap)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {business.recommendedNextStep
                              ? formatPipelineValue(business.recommendedNextStep)
                              : "None"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>Current queue and the last completed failures.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{formatPipelineValue(job.jobType)}</span>
                    <Badge variant="outline">{job.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {job.businessId ? `Business #${job.businessId}` : "Global"} · priority {job.priority}
                  </div>
                  {job.errorMessage && <div className="text-xs text-destructive">{job.errorMessage}</div>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-56 w-full" />)
        ) : (
          reviewBuckets.map((bucket) => (
            <Card key={bucket.key}>
              <CardHeader>
                <CardTitle>{bucket.label}</CardTitle>
                <CardDescription>{bucket.count} businesses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {bucket.items.slice(0, 5).map((item) => (
                  <div key={item.business.id} className="rounded-md border p-3 space-y-1">
                    <Link href={`/businesses/${item.business.id}`} className="text-sm font-medium hover:text-primary">
                      {item.business.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {item.reasons.map((reason) => formatPipelineValue(reason)).join(", ")}
                    </div>
                    <Badge variant="outline">Priority {item.priorityScore}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
