import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  getGetBusinessesQueryKey,
  getGetCategoriesQueryKey,
  getGetOffersQueryKey,
  useGetBusinesses,
  useGetCategories,
  useGetOffers,
} from "@workspace/api-client-react";
import { ExternalLink, Globe, MapPin, Phone, Radar, ShieldAlert } from "lucide-react";
import { SharedBusinessFilters } from "@/components/shared-business-filters";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildSearchParams,
  readSharedBusinessFilters,
  syncSearchParams,
} from "@/lib/business-filters";
import { formatPipelineValue } from "@/lib/outreach-formatting";

function ScoreBadge({
  label,
  value,
}: {
  label: string;
  value?: number | null;
}) {
  if (value == null) return null;
  return (
    <Badge variant="outline">
      {label} {value}
    </Badge>
  );
}

export default function Businesses() {
  const initialFilters = readSharedBusinessFilters(window.location.search);
  const [search, setSearch] = useState(initialFilters.search);
  const [city, setCity] = useState(initialFilters.city);
  const [category, setCategory] = useState(initialFilters.categorySlug);
  const [targetMarket, setTargetMarket] = useState(initialFilters.targetMarket);
  const [engineType, setEngineType] = useState(initialFilters.engineType);
  const [targetType, setTargetType] = useState(initialFilters.targetType);
  const [targetCluster, setTargetCluster] = useState(initialFilters.targetCluster);
  const [hasWebsite, setHasWebsite] = useState(initialFilters.hasWebsite);
  const [hasPhone, setHasPhone] = useState(initialFilters.hasPhone);
  const [readyOnly, setReadyOnly] = useState(initialFilters.readyForOutreach);
  const [reviewOnly, setReviewOnly] = useState(initialFilters.reviewRequired);
  const [page, setPage] = useState(initialFilters.page);
  const pageSize = 20;

  const { data: categories } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() },
  });

  const queryParams = useMemo(
    () => ({
      search: search || undefined,
      city: city || undefined,
      categorySlug: category === "all" ? undefined : category,
      targetMarket: targetMarket === "all" ? undefined : targetMarket,
      engineType: engineType === "all" ? undefined : engineType,
      targetType: targetType === "all" ? undefined : targetType,
      targetCluster: targetCluster === "all" ? undefined : targetCluster,
      hasWebsite: hasWebsite || undefined,
      hasPhone: hasPhone || undefined,
      readyForOutreach: readyOnly || undefined,
      reviewRequired: reviewOnly || undefined,
      page,
      pageSize,
    }),
    [category, city, engineType, hasPhone, hasWebsite, page, readyOnly, reviewOnly, search, targetCluster, targetMarket, targetType],
  );

  const { data, isLoading } = useGetBusinesses(queryParams, {
    query: { queryKey: getGetBusinessesQueryKey(queryParams) },
  });
  const { data: offers = [] } = useGetOffers({
    query: { queryKey: getGetOffersQueryKey() },
  });
  const offersById = useMemo(() => new Map(offers.map((offer) => [offer.id, offer])), [offers]);

  useEffect(() => {
    const nextSearch = buildSearchParams(window.location.search, {
      search,
      city,
      categorySlug: category,
      targetMarket,
      engineType,
      targetType,
      targetCluster,
      hasWebsite,
      hasPhone,
      readyForOutreach: readyOnly,
      reviewRequired: reviewOnly,
      page,
      horizonDays: undefined,
      limit: undefined,
    });

    syncSearchParams(nextSearch);
  }, [category, city, engineType, hasPhone, hasWebsite, page, readyOnly, reviewOnly, search, targetCluster, targetMarket, targetType]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Directory</h1>
        <p className="text-muted-foreground mt-1">
          Vista canonica dei business con readiness, priorità e bisogno di review.
        </p>
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
          onCityChange={(value) => {
            setCity(value);
            setPage(1);
          }}
          onCategoryChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          onTargetMarketChange={(value) => {
            setTargetMarket(value);
            setPage(1);
          }}
          onEngineTypeChange={(value) => {
            setEngineType(value);
            setPage(1);
          }}
          onTargetTypeChange={(value) => {
            setTargetType(value);
            setPage(1);
          }}
          onTargetClusterChange={(value) => {
            setTargetCluster(value);
            setPage(1);
          }}
        />

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <Input
            placeholder="Search names, addresses, cities..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={hasWebsite}
              onCheckedChange={(checked) => {
                setHasWebsite(Boolean(checked));
                setPage(1);
              }}
            />
            Has website
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={hasPhone}
              onCheckedChange={(checked) => {
                setHasPhone(Boolean(checked));
                setPage(1);
              }}
            />
            Has phone
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={readyOnly}
              onCheckedChange={(checked) => {
                setReadyOnly(Boolean(checked));
                setPage(1);
              }}
            />
            Ready only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={reviewOnly}
              onCheckedChange={(checked) => {
                setReviewOnly(Boolean(checked));
                setPage(1);
              }}
            />
            Review only
          </label>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contactability</TableHead>
                <TableHead>Research State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-[220px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.businesses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No businesses found matching the current research filters.
                  </TableCell>
                </TableRow>
              ) : (
                data?.businesses.map((business) => (
                  <TableRow key={business.id}>
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/businesses/${business.id}`} className="font-medium hover:text-primary transition-colors">
                            {business.name}
                          </Link>
                          <Badge variant="secondary" className="capitalize">
                            {business.categorySlug.replace(/_/g, " ")}
                          </Badge>
                          {business.readyForOutreach && (
                            <Badge variant="outline" className="bg-primary/5 text-primary">
                              Ready
                            </Badge>
                          )}
                          {business.engineType && (
                            <Badge variant="outline">{formatPipelineValue(business.engineType)}</Badge>
                          )}
                          {business.reviewRequired && (
                            <Badge variant="outline" className="text-amber-700">
                              Review
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ScoreBadge label="Priority" value={business.priorityScore} />
                          <ScoreBadge label="Research" value={business.researchScore} />
                          <ScoreBadge label="Confidence" value={business.confidenceScore} />
                          <ScoreBadge label="Economic" value={business.economicValueScore} />
                          <ScoreBadge label="Strategic" value={business.strategicValueScore} />
                          <ScoreBadge label="Actionability" value={business.actionabilityScore} />
                          <ScoreBadge label="Offer fit" value={business.offerFitScore} />
                        </div>
                        {business.bestOfferId && offersById.get(business.bestOfferId) && (
                          <p className="text-xs text-muted-foreground">
                            Best offer: {offersById.get(business.bestOfferId)?.name}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {[business.city, business.country, business.targetMarket]
                            .filter(Boolean)
                            .join(" · ") || "No location metadata"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {business.avatarType && (
                            <Badge variant="outline">{formatPipelineValue(business.avatarType)}</Badge>
                          )}
                          {business.targetType && (
                            <Badge variant="outline">{formatPipelineValue(business.targetType)}</Badge>
                          )}
                          {business.sourceHealth && (
                            <Badge variant="outline">{formatPipelineValue(business.sourceHealth)}</Badge>
                          )}
                          {business.targetCluster && (
                            <Badge variant="outline">{formatPipelineValue(business.targetCluster)}</Badge>
                          )}
                          {business.warmPathExists && (
                            <Badge variant="outline" className="text-emerald-700">Warm path</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="space-y-2 text-sm">
                        {business.website ? (
                          <a
                            href={business.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Globe className="h-3 w-3" />
                            Website
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-muted-foreground">
                            <Globe className="h-3 w-3" />
                            No website
                          </div>
                        )}
                        <div className="inline-flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {business.phone || "No phone"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {business.contactReadiness && (
                            <Badge variant="outline">{formatPipelineValue(business.contactReadiness)}</Badge>
                          )}
                          {business.contactabilityScore != null && (
                            <Badge variant="outline">Contact {business.contactabilityScore}</Badge>
                          )}
                          {business.nextBestContactWindow && (
                            <Badge variant="outline">{formatPipelineValue(business.nextBestContactWindow)}</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="space-y-2 text-sm">
                        <div className="flex flex-wrap gap-2">
                          {business.recommendedNextStep && (
                            <Badge variant="outline" className="bg-primary/5 text-primary">
                              <Radar className="mr-1 h-3 w-3" />
                              {formatPipelineValue(business.recommendedNextStep)}
                            </Badge>
                          )}
                          {business.reviewReason && (
                            <Badge variant="outline" className="text-amber-700">
                              <ShieldAlert className="mr-1 h-3 w-3" />
                              {formatPipelineValue(business.reviewReason)}
                            </Badge>
                          )}
                          {business.cultivationRequired && (
                            <Badge variant="outline">Cultivate</Badge>
                          )}
                          {business.prestigeWatchlist && (
                            <Badge variant="outline">Prestige</Badge>
                          )}
                          {business.readyForRelationship && (
                            <Badge variant="outline" className="text-emerald-700">Relationship-ready</Badge>
                          )}
                          {business.readyForInstitutionalPitch && (
                            <Badge variant="outline" className="text-sky-700">Institutional-ready</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          {business.topGap
                            ? `Top gap: ${formatPipelineValue(business.topGap)}`
                            : "No blocking research gap detected."}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/businesses/${business.id}`}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          Details
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="border-t p-4 flex items-center justify-between bg-muted/20">
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= data.totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
