import { Link } from "wouter";
import {
  getGetBusinessContactCandidatesQueryKey,
  getGetBusinessByIdQueryKey,
  getGetBusinessSourcesQueryKey,
  useGetBusinessContactCandidates,
  useGetBusinessById,
  useGetBusinessSources,
  useUpdateBusinessContactCandidate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Mail,
  type LucideIcon,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Star,
  BadgeCheck,
  Database,
  Clock3,
  CircleSlash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDomain(url?: string | null) {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatSourceType(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConfidence(value?: string | null) {
  if (!value) return "N/A";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return `${Math.round(numeric * 100)}%`;
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-full bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <span className="truncate">{value}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <p className="text-sm font-medium break-words">{value}</p>
        )}
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-5 w-56" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function BusinessDetail({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const businessId = Number(params.id);

  const businessQuery = useGetBusinessById(businessId, {
    query: {
      queryKey: getGetBusinessByIdQueryKey(businessId),
      enabled: Number.isFinite(businessId) && businessId > 0,
    },
  });

  const sourcesQuery = useGetBusinessSources(businessId, {
    query: {
      queryKey: getGetBusinessSourcesQueryKey(businessId),
      enabled: Number.isFinite(businessId) && businessId > 0,
    },
  });

  const contactCandidatesQuery = useGetBusinessContactCandidates(businessId, {
    query: {
      queryKey: getGetBusinessContactCandidatesQueryKey(businessId),
      enabled: Number.isFinite(businessId) && businessId > 0,
    },
  });

  const updateContactCandidateMutation = useUpdateBusinessContactCandidate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetBusinessContactCandidatesQueryKey(businessId),
        });
        toast({
          title: "Contact candidate updated",
          description: "The review status has been saved.",
        });
      },
      onError: (error) => {
        toast({
          title: "Update failed",
          description:
            (error as { message?: string })?.message ||
            "Could not update the contact candidate.",
          variant: "destructive",
        });
      },
    },
  });

  if (!Number.isFinite(businessId) || businessId <= 0) {
    return (
    <div className="space-y-4">
        <Link href="/businesses" className={buttonVariants({ variant: "ghost", className: "pl-0" })}>
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Business not found</CardTitle>
            <CardDescription>The requested identifier is not valid.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (businessQuery.isLoading) {
    return <OverviewSkeleton />;
  }

  if (businessQuery.isError || !businessQuery.data) {
    return (
      <div className="space-y-4">
        <Link href="/businesses" className={buttonVariants({ variant: "ghost", className: "pl-0" })}>
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Business unavailable</CardTitle>
            <CardDescription>
              We could not load this business record from the API.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const business = businessQuery.data;
  const sources = sourcesQuery.data ?? [];
  const contactCandidates = contactCandidatesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/businesses" className={buttonVariants({ variant: "ghost", className: "pl-0" })}>
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {business.categorySlug.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {business.enrichmentStatus.replace(/_/g, " ")}
              </Badge>
              {sources.some((source) => source.isOfficial) && (
                <Badge variant="outline" className="bg-primary/5 text-primary">
                  Official sources tracked
                </Badge>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold tracking-tight">{business.name}</h1>
              <p className="mt-1 text-muted-foreground">
                {business.addressLine || "Address not available"}
                {business.city ? `, ${business.city}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {business.website && (
              <Button variant="outline" asChild>
                <a href={business.website} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4" />
                  Website
                </a>
              </Button>
            )}
            {business.googleMapsUrl && (
              <Button variant="outline" asChild>
                <a href={business.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <MapPin className="h-4 w-4" />
                  Google Maps
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Overview</CardTitle>
              <CardDescription>
                Canonical business data ready for discovery, review, and outreach preparation.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <InfoRow
                icon={MapPin}
                label="Location"
                value={[
                  business.addressLine,
                  business.city,
                  business.postalCode,
                  business.region,
                  business.country,
                ]
                  .filter(Boolean)
                  .join(", ") || "Not available"}
              />
              <InfoRow
                icon={Globe}
                label="Website"
                value={formatDomain(business.website) || "No website"}
                href={business.website ?? undefined}
              />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={business.phone || "No phone"}
              />
              <InfoRow
                icon={Building2}
                label="Slug"
                value={business.slug}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Candidates</CardTitle>
              <CardDescription>
                Safe, source-linked contact paths derived from official business data already in the system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contactCandidatesQuery.isLoading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : contactCandidates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No contact candidates have been derived yet for this business.
                </div>
              ) : (
                contactCandidates.map((candidate, index) => (
                  <div key={candidate.id} className="space-y-4">
                    {index > 0 && <Separator />}
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{formatSourceType(candidate.contactType)}</Badge>
                          <Badge variant="outline" className="capitalize">
                            {candidate.reviewStatus.replace(/_/g, " ")}
                          </Badge>
                          {candidate.isPrimary && (
                            <Badge variant="outline" className="bg-primary/5 text-primary">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-sm">
                          {candidate.contactUrl && (
                            <a
                              href={candidate.contactUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Globe className="h-3 w-3" />
                              <span className="truncate">{formatDomain(candidate.contactUrl) || candidate.contactUrl}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          )}
                          {candidate.phone && (
                            <div className="flex items-center gap-1 text-foreground">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {candidate.phone}
                            </div>
                          )}
                          {candidate.email && (
                            <div className="flex items-center gap-1 text-foreground">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {candidate.email}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                          <span>Confidence: {formatConfidence(candidate.confidenceScore)}</span>
                          <span>Source: {formatSourceType(candidate.sourceType)}</span>
                          <span>Verified: {formatDate(candidate.lastVerifiedAt)}</span>
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground max-w-xs">
                        {candidate.notes || "No notes available."}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {candidate.reviewStatus !== "approved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updateContactCandidateMutation.isPending}
                          onClick={() =>
                            updateContactCandidateMutation.mutate({
                              id: businessId,
                              candidateId: candidate.id,
                              data: { reviewStatus: "approved" },
                            })
                          }
                        >
                          Approve
                        </Button>
                      )}
                      {candidate.reviewStatus !== "rejected" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updateContactCandidateMutation.isPending}
                          onClick={() =>
                            updateContactCandidateMutation.mutate({
                              id: businessId,
                              candidateId: candidate.id,
                              data: { reviewStatus: "rejected" },
                            })
                          }
                        >
                          Reject
                        </Button>
                      )}
                      {!candidate.isPrimary && candidate.reviewStatus !== "rejected" && (
                        <Button
                          size="sm"
                          disabled={updateContactCandidateMutation.isPending}
                          onClick={() =>
                            updateContactCandidateMutation.mutate({
                              id: businessId,
                              candidateId: candidate.id,
                              data: { reviewStatus: "approved", isPrimary: true },
                            })
                          }
                        >
                          Set Primary
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tracked Sources</CardTitle>
              <CardDescription>
                Every source URL saved during import and enrichment, with fetch status and provenance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sourcesQuery.isLoading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : sources.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No tracked sources yet for this business.
                </div>
              ) : (
                sources.map((source, index) => (
                  <div key={source.id} className="space-y-4">
                    {index > 0 && <Separator />}
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{formatSourceType(source.sourceType)}</Badge>
                          <Badge variant="outline" className="capitalize">
                            {source.fetchStatus.replace(/_/g, " ")}
                          </Badge>
                          {source.isOfficial && (
                            <Badge variant="outline" className="bg-primary/5 text-primary">
                              Official
                            </Badge>
                          )}
                        </div>
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          <span className="truncate">{source.sourceUrl}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {source.sourceDomain || formatDomain(source.sourceUrl) || "Unknown domain"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            Last fetch: {formatDate(source.lastFetchedAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CircleSlash className="h-3 w-3" />
                            HTTP: {source.httpStatus ?? "N/A"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        Discovered via{" "}
                        <span className="font-medium text-foreground">
                          {source.discoveredVia || "import pipeline"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Quality</CardTitle>
              <CardDescription>
                A compact summary for review workflows and future contact enrichment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Contact readiness</p>
                  <p className="text-sm text-muted-foreground">
                    {business.hasWebsite && business.hasPhone
                      ? "High: website and phone are already available."
                      : business.hasWebsite || business.hasPhone
                        ? "Medium: one primary contact channel is available."
                        : "Low: no direct contact channel has been captured yet."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Star className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Maps visibility</p>
                  <p className="text-sm text-muted-foreground">
                    {business.rating
                      ? `Rated ${business.rating}${business.userRatingsTotal ? ` across ${business.userRatingsTotal} reviews` : ""}.`
                      : "No public rating stored yet."}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium">Last updated</p>
                <p className="mt-1 text-muted-foreground">{formatDate(business.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identifiers</CardTitle>
              <CardDescription>
                Useful keys for matching, debugging imports, and source reconciliation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Business ID</span>
                <span className="font-medium">{business.id}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">OSM ID</span>
                <span className="font-medium">{business.osmId || "Not available"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">OSM Type</span>
                <span className="font-medium">{business.osmType || "Not available"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Google Place ID</span>
                <span className="font-medium break-all text-right">
                  {business.googlePlaceId || "Not available"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
