import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  getGetOutreachDashboardQueryKey,
  getGetOutreachPipelineQueryKey,
  getGetBusinessOutreachQueryKey,
  getGetBusinessContactCandidatesQueryKey,
  getGetBusinessByIdQueryKey,
  getGetBusinessSourcesQueryKey,
  useGetBusinessOutreach,
  useGetBusinessContactCandidates,
  useGetBusinessById,
  useGetBusinessSources,
  useUpdateBusinessContactCandidate,
  useUpdateBusinessOutreach,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getStoredAdminToken } from "@/lib/admin-auth";

const OUTREACH_STATUS_OPTIONS = [
  "not_contacted",
  "emailed",
  "follow_up_1",
  "follow_up_2",
  "interested",
  "closed_won",
  "closed_lost",
] as const;

const ASSIGNED_ARTIST_OPTIONS = ["Ache77", "Exit Enter", "Nian", "Kraita317"] as const;

const AVATAR_TYPE_OPTIONS = [
  "gallery_director",
  "hotel_art_curator",
  "festival",
  "museum_shop",
  "institution",
] as const;

const TARGET_MARKET_OPTIONS = ["IT", "UK", "NL", "FR", "ES", "PT", "RO"] as const;

type OutreachFormState = {
  outreachStatus: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  lastContactDate: string;
  nextActionDate: string;
  assignedArtist: string;
  avatarType: string;
  targetMarket: string;
  warmConnection: string;
  notes: string;
};

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

function formatPipelineValue(value?: string | null) {
  if (!value) return "Not set";
  return formatSourceType(value);
}

function formatConfidence(value?: string | null) {
  if (!value) return "N/A";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return `${Math.round(numeric * 100)}%`;
}

function buildOutreachFormState(
  outreach?: {
    outreachStatus?: string;
    contactName?: string | null;
    contactRole?: string | null;
    contactEmail?: string | null;
    lastContactDate?: string | null;
    nextActionDate?: string | null;
    assignedArtist?: string | null;
    avatarType?: string | null;
    targetMarket?: string | null;
    warmConnection?: string | null;
    notes?: string | null;
  } | null,
): OutreachFormState {
  return {
    outreachStatus: outreach?.outreachStatus ?? "not_contacted",
    contactName: outreach?.contactName ?? "",
    contactRole: outreach?.contactRole ?? "",
    contactEmail: outreach?.contactEmail ?? "",
    lastContactDate: outreach?.lastContactDate ?? "",
    nextActionDate: outreach?.nextActionDate ?? "",
    assignedArtist: outreach?.assignedArtist ?? "",
    avatarType: outreach?.avatarType ?? "",
    targetMarket: outreach?.targetMarket ?? "",
    warmConnection: outreach?.warmConnection ?? "",
    notes: outreach?.notes ?? "",
  };
}

function serializeOutreachFormState(form: OutreachFormState) {
  return JSON.stringify(form);
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
  const hasAdminToken = Boolean(getStoredAdminToken());
  const [outreachForm, setOutreachForm] = useState<OutreachFormState>(() => buildOutreachFormState());

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

  const outreachQuery = useGetBusinessOutreach(businessId, {
    query: {
      queryKey: getGetBusinessOutreachQueryKey(businessId),
      enabled: hasAdminToken && Number.isFinite(businessId) && businessId > 0,
    },
  });

  const contactCandidatesQuery = useGetBusinessContactCandidates(businessId, {
    query: {
      queryKey: getGetBusinessContactCandidatesQueryKey(businessId),
      enabled: hasAdminToken && Number.isFinite(businessId) && businessId > 0,
    },
  });

  useEffect(() => {
    if (outreachQuery.data) {
      setOutreachForm(buildOutreachFormState(outreachQuery.data));
    }
  }, [outreachQuery.data]);

  const updateOutreachMutation = useUpdateBusinessOutreach({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: getGetBusinessOutreachQueryKey(businessId),
        });
        queryClient.invalidateQueries({
          queryKey: getGetOutreachDashboardQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetOutreachPipelineQueryKey({ horizonDays: 7, limit: 60 }),
        });
        setOutreachForm(buildOutreachFormState(data));
        toast({
          title: "Outreach updated",
          description: "The outreach pipeline fields have been saved.",
        });
      },
      onError: (error) => {
        toast({
          title: "Outreach update failed",
          description:
            (error as { message?: string })?.message ||
            "Could not update the outreach fields for this business.",
          variant: "destructive",
        });
      },
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
  const outreach = outreachQuery.data;
  const contactCandidates = contactCandidatesQuery.data ?? [];
  const persistedOutreachForm = buildOutreachFormState(outreach);
  const isOutreachDirty =
    serializeOutreachFormState(outreachForm) !== serializeOutreachFormState(persistedOutreachForm);

  function updateOutreachField<K extends keyof OutreachFormState>(
    key: K,
    value: OutreachFormState[K],
  ) {
    setOutreachForm((current) => ({ ...current, [key]: value }));
  }

  function resetOutreachForm() {
    setOutreachForm(buildOutreachFormState(outreach));
  }

  function saveOutreach() {
    updateOutreachMutation.mutate({
      id: businessId,
      data: {
        outreachStatus: outreachForm.outreachStatus,
        contactName: outreachForm.contactName.trim() || null,
        contactRole: outreachForm.contactRole.trim() || null,
        contactEmail: outreachForm.contactEmail.trim() || null,
        lastContactDate: outreachForm.lastContactDate || null,
        nextActionDate: outreachForm.nextActionDate || null,
        assignedArtist: outreachForm.assignedArtist || null,
        avatarType: outreachForm.avatarType || null,
        targetMarket: outreachForm.targetMarket || null,
        warmConnection: outreachForm.warmConnection.trim() || null,
        notes: outreachForm.notes.trim() || null,
      },
    });
  }

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
              <CardTitle>Outreach Pipeline</CardTitle>
              <CardDescription>
                Operational CRM fields for follow-up planning, artist assignment, and market targeting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {outreachQuery.isLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-48 w-full" />
                </>
              ) : !hasAdminToken ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Unlock admin in the <Link href="/admin" className="text-primary hover:underline">Administration</Link> page to manage outreach fields.
                </div>
              ) : outreachQuery.isError ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Outreach fields are unavailable with the current admin session.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                      <p className="mt-2 text-sm font-medium">
                        {formatPipelineValue(outreach?.outreachStatus ?? outreachForm.outreachStatus)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Artist</p>
                      <p className="mt-2 text-sm font-medium">
                        {outreach?.assignedArtist || outreachForm.assignedArtist || "Not assigned"}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Next Action</p>
                      <p className="mt-2 text-sm font-medium">
                        {outreach?.nextActionDate || outreachForm.nextActionDate || "Not scheduled"}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Target Market</p>
                      <p className="mt-2 text-sm font-medium">
                        {outreach?.targetMarket || outreachForm.targetMarket || "Not set"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="outreach-status">Outreach status</Label>
                      <Select
                        value={outreachForm.outreachStatus}
                        onValueChange={(value) => updateOutreachField("outreachStatus", value)}
                      >
                        <SelectTrigger id="outreach-status">
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                        <SelectContent>
                          {OUTREACH_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {formatPipelineValue(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="assigned-artist">Assigned artist</Label>
                      <Select
                        value={outreachForm.assignedArtist || "__none__"}
                        onValueChange={(value) =>
                          updateOutreachField("assignedArtist", value === "__none__" ? "" : value)
                        }
                      >
                        <SelectTrigger id="assigned-artist">
                          <SelectValue placeholder="Select an artist" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not assigned</SelectItem>
                          {ASSIGNED_ARTIST_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="avatar-type">Avatar type</Label>
                      <Select
                        value={outreachForm.avatarType || "__none__"}
                        onValueChange={(value) =>
                          updateOutreachField("avatarType", value === "__none__" ? "" : value)
                        }
                      >
                        <SelectTrigger id="avatar-type">
                          <SelectValue placeholder="Select an avatar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not set</SelectItem>
                          {AVATAR_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {formatPipelineValue(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="target-market">Target market</Label>
                      <Select
                        value={outreachForm.targetMarket || "__none__"}
                        onValueChange={(value) =>
                          updateOutreachField("targetMarket", value === "__none__" ? "" : value)
                        }
                      >
                        <SelectTrigger id="target-market">
                          <SelectValue placeholder="Select a market" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not set</SelectItem>
                          {TARGET_MARKET_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Contact name</Label>
                      <Input
                        id="contact-name"
                        value={outreachForm.contactName}
                        onChange={(event) => updateOutreachField("contactName", event.target.value)}
                        placeholder="Sarah Mitchell"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-role">Contact role</Label>
                      <Input
                        id="contact-role"
                        value={outreachForm.contactRole}
                        onChange={(event) => updateOutreachField("contactRole", event.target.value)}
                        placeholder="Gallery Director"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-email">Contact email</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={outreachForm.contactEmail}
                        onChange={(event) => updateOutreachField("contactEmail", event.target.value)}
                        placeholder="director@example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="warm-connection">Warm connection</Label>
                      <Input
                        id="warm-connection"
                        value={outreachForm.warmConnection}
                        onChange={(event) =>
                          updateOutreachField("warmConnection", event.target.value)
                        }
                        placeholder="Eine tramite The Gathering 2017"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="last-contact-date">Last contact date</Label>
                      <Input
                        id="last-contact-date"
                        type="date"
                        value={outreachForm.lastContactDate}
                        onChange={(event) =>
                          updateOutreachField("lastContactDate", event.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="next-action-date">Next action date</Label>
                      <Input
                        id="next-action-date"
                        type="date"
                        value={outreachForm.nextActionDate}
                        onChange={(event) =>
                          updateOutreachField("nextActionDate", event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="outreach-notes">Notes</Label>
                    <Textarea
                      id="outreach-notes"
                      value={outreachForm.notes}
                      onChange={(event) => updateOutreachField("notes", event.target.value)}
                      placeholder="Internal notes, handover context, or next-step specifics."
                      className="min-h-[120px]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!isOutreachDirty || updateOutreachMutation.isPending}
                      onClick={saveOutreach}
                    >
                      Save Outreach
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!isOutreachDirty || updateOutreachMutation.isPending}
                      onClick={resetOutreachForm}
                    >
                      Reset
                    </Button>
                  </div>
                </>
              )}
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
              ) : !hasAdminToken ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Unlock admin in the <Link href="/admin" className="text-primary hover:underline">Administration</Link> page to review contact candidates.
                </div>
              ) : contactCandidatesQuery.isError ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Contact candidates are unavailable with the current admin session.
                </div>
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
