import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCategoriesQueryKey,
  getGetResearchFeedQueryKey,
  getGetResearchJobsQueryKey,
  getGetResearchMetricsQueryKey,
  getGetResearchReviewBucketsQueryKey,
  getGetResearchViewsQueryKey,
  useCreateResearchView,
  useDeleteResearchView,
  useGetCategories,
  useGetResearchFeed,
  useGetResearchJobs,
  useGetResearchMetrics,
  useGetResearchReviewBuckets,
  useGetResearchViews,
  useRunResearchJobs,
  type ResearchView,
} from "@workspace/api-client-react";
import { SharedBusinessFilters } from "@/components/shared-business-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildSearchParams, readSharedBusinessFilters, syncSearchParams } from "@/lib/business-filters";
import { formatPipelineValue } from "@/lib/outreach-formatting";
import { useToast } from "@/hooks/use-toast";

function parseOptionalInt(value: string) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function ResearchPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initial = readSharedBusinessFilters(window.location.search);
  const [search, setSearch] = useState(initial.search);
  const [city, setCity] = useState(initial.city);
  const [category, setCategory] = useState(initial.categorySlug);
  const [targetMarket, setTargetMarket] = useState(initial.targetMarket);
  const [engineType, setEngineType] = useState(initial.engineType);
  const [targetType, setTargetType] = useState(initial.targetType);
  const [targetCluster, setTargetCluster] = useState(initial.targetCluster);
  const [warmPathExists, setWarmPathExists] = useState(initial.warmPathExists);
  const [readyForRelationship, setReadyForRelationship] = useState(initial.readyForRelationship);
  const [readyForInstitutionalPitch, setReadyForInstitutionalPitch] = useState(initial.readyForInstitutionalPitch);
  const [prestigeWatchlist, setPrestigeWatchlist] = useState(initial.prestigeWatchlist);
  const [cultivationRequired, setCultivationRequired] = useState(initial.cultivationRequired);
  const [minPriorityScore, setMinPriorityScore] = useState(initial.minPriorityScore?.toString() ?? "60");
  const [minResearchScore, setMinResearchScore] = useState(initial.minResearchScore?.toString() ?? "60");

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
      targetType,
      targetCluster,
      warmPathExists,
      readyForRelationship,
      readyForInstitutionalPitch,
      prestigeWatchlist,
      cultivationRequired,
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
  }, [
    category,
    city,
    cultivationRequired,
    engineType,
    minPriorityScore,
    minResearchScore,
    prestigeWatchlist,
    readyForInstitutionalPitch,
    readyForRelationship,
    search,
    targetCluster,
    targetMarket,
    targetType,
    warmPathExists,
  ]);

  const metricParams = useMemo(
    () => ({
      categorySlug: category === "all" ? undefined : category,
      city: city || undefined,
      targetMarket: targetMarket === "all" ? undefined : targetMarket,
      engineType: engineType === "all" ? undefined : engineType,
      targetType: targetType === "all" ? undefined : targetType,
      targetCluster: targetCluster === "all" ? undefined : targetCluster,
      warmPathExists: warmPathExists || undefined,
      readyForRelationship: readyForRelationship || undefined,
      readyForInstitutionalPitch: readyForInstitutionalPitch || undefined,
      prestigeWatchlist: prestigeWatchlist || undefined,
      cultivationRequired: cultivationRequired || undefined,
    }),
    [
      category,
      city,
      cultivationRequired,
      engineType,
      prestigeWatchlist,
      readyForInstitutionalPitch,
      readyForRelationship,
      targetCluster,
      targetMarket,
      targetType,
      warmPathExists,
    ],
  );

  const feedParams = useMemo(
    () => ({
      ...metricParams,
      search: search || undefined,
      minPriorityScore: parseOptionalInt(minPriorityScore),
      minResearchScore: parseOptionalInt(minResearchScore),
      page: 1,
      pageSize: 20,
    }),
    [metricParams, minPriorityScore, minResearchScore, search],
  );

  const reviewBucketParams = useMemo(
    () => ({
      ...metricParams,
      limit: 60,
    }),
    [metricParams],
  );

  const jobParams = useMemo(() => ({ limit: 12 }), []);

  const metricsQuery = useGetResearchMetrics(metricParams, {
    query: {
      queryKey: getGetResearchMetricsQueryKey(metricParams),
    },
  });
  const feedQuery = useGetResearchFeed(feedParams, {
    query: {
      queryKey: getGetResearchFeedQueryKey(feedParams),
    },
  });
  const reviewBucketsQuery = useGetResearchReviewBuckets(reviewBucketParams, {
    query: {
      queryKey: getGetResearchReviewBucketsQueryKey(reviewBucketParams),
    },
  });
  const jobsQuery = useGetResearchJobs(jobParams, {
    query: {
      queryKey: getGetResearchJobsQueryKey(jobParams),
    },
  });
  const viewsQuery = useGetResearchViews({
    query: {
      queryKey: getGetResearchViewsQueryKey(),
    },
  });

  const invalidateResearchQueries = () => {
    void queryClient.invalidateQueries({ queryKey: getGetResearchMetricsQueryKey(metricParams) });
    void queryClient.invalidateQueries({ queryKey: getGetResearchFeedQueryKey(feedParams) });
    void queryClient.invalidateQueries({ queryKey: getGetResearchReviewBucketsQueryKey(reviewBucketParams) });
    void queryClient.invalidateQueries({ queryKey: getGetResearchJobsQueryKey(jobParams) });
    void queryClient.invalidateQueries({ queryKey: getGetResearchViewsQueryKey() });
  };

  const runAutomationMutation = useRunResearchJobs({
    mutation: {
      onSuccess: invalidateResearchQueries,
      onError: (error) => {
        toast({
          title: "Automation tick failed",
          description: error instanceof Error ? error.message : "Could not run research automation.",
          variant: "destructive",
        });
      },
    },
  });

  const createViewMutation = useCreateResearchView({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetResearchViewsQueryKey() });
      },
      onError: (error) => {
        toast({
          title: "Save view failed",
          description: error instanceof Error ? error.message : "Could not save research view.",
          variant: "destructive",
        });
      },
    },
  });

  const deleteViewMutation = useDeleteResearchView({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetResearchViewsQueryKey() });
      },
      onError: (error) => {
        toast({
          title: "Delete view failed",
          description: error instanceof Error ? error.message : "Could not delete research view.",
          variant: "destructive",
        });
      },
    },
  });

  const metrics = metricsQuery.data ?? null;
  const feed = feedQuery.data ?? null;
  const reviewBuckets = reviewBucketsQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const views = viewsQuery.data ?? [];
  const loading =
    metricsQuery.isLoading ||
    feedQuery.isLoading ||
    reviewBucketsQuery.isLoading ||
    jobsQuery.isLoading ||
    viewsQuery.isLoading;

  useEffect(() => {
    syncSearchParams(queryString);
  }, [queryString]);

  const handleRunAutomation = () => {
    runAutomationMutation.mutate();
  };

  const handleSaveView = () => {
    const name = window.prompt("Saved view name");
    if (!name?.trim()) return;

    createViewMutation.mutate({
      data: {
        name: name.trim(),
        filtersJson: {
          search,
          city,
          categorySlug: category,
          targetMarket,
          engineType,
          targetType,
          targetCluster,
          warmPathExists,
          readyForRelationship,
          readyForInstitutionalPitch,
          prestigeWatchlist,
          cultivationRequired,
          minPriorityScore: parseOptionalInt(minPriorityScore),
          minResearchScore: parseOptionalInt(minResearchScore),
        },
        sortJson: {
          field: "researchScore",
          direction: "desc",
        },
      },
    });
  };

  const applyView = (view: ResearchView) => {
    const filters = view.filtersJson ?? {};
    setSearch(String(filters["search"] ?? ""));
    setCity(String(filters["city"] ?? ""));
    setCategory(String(filters["categorySlug"] ?? "all"));
    setTargetMarket(String(filters["targetMarket"] ?? "all"));
    setEngineType(String(filters["engineType"] ?? "all"));
    setTargetType(String(filters["targetType"] ?? "all"));
    setTargetCluster(String(filters["targetCluster"] ?? "all"));
    setWarmPathExists(Boolean(filters["warmPathExists"]));
    setReadyForRelationship(Boolean(filters["readyForRelationship"]));
    setReadyForInstitutionalPitch(Boolean(filters["readyForInstitutionalPitch"]));
    setPrestigeWatchlist(Boolean(filters["prestigeWatchlist"]));
    setCultivationRequired(Boolean(filters["cultivationRequired"]));
    setMinPriorityScore(filters["minPriorityScore"] ? String(filters["minPriorityScore"]) : "");
    setMinResearchScore(filters["minResearchScore"] ? String(filters["minResearchScore"]) : "");
  };

  const deleteView = (id: number) => {
    deleteViewMutation.mutate({ id });
  };

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
          <Button variant="outline" onClick={invalidateResearchQueries}>Refresh</Button>
          <Button variant="outline" onClick={handleSaveView} disabled={createViewMutation.isPending}>
            Save view
          </Button>
          <Button onClick={handleRunAutomation} disabled={runAutomationMutation.isPending}>
            Run automation
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <SharedBusinessFilters
          categories={categories}
          city={city}
          categorySlug={category}
          targetMarket={targetMarket}
          engineType={engineType}
          targetType={targetType}
          targetCluster={targetCluster}
          onCityChange={setCity}
          onCategoryChange={setCategory}
          onTargetMarketChange={setTargetMarket}
          onEngineTypeChange={setEngineType}
          onTargetTypeChange={setTargetType}
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
        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
          <label className="flex items-center gap-2">
            <Checkbox checked={warmPathExists} onCheckedChange={(checked) => setWarmPathExists(Boolean(checked))} />
            Warm path exists
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={readyForRelationship} onCheckedChange={(checked) => setReadyForRelationship(Boolean(checked))} />
            Ready for relationship
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={readyForInstitutionalPitch} onCheckedChange={(checked) => setReadyForInstitutionalPitch(Boolean(checked))} />
            Institutional pitch
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={prestigeWatchlist} onCheckedChange={(checked) => setPrestigeWatchlist(Boolean(checked))} />
            Prestige watchlist
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={cultivationRequired} onCheckedChange={(checked) => setCultivationRequired(Boolean(checked))} />
            Cultivation required
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((view) => (
          <div key={view.id} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
            <button className="text-sm font-medium hover:text-primary" onClick={() => applyView(view)}>
              {view.name}
            </button>
            {view.isDefault && <Badge variant="outline">Default</Badge>}
            <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => deleteView(view.id)}>
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
