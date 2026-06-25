import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  getGetBusinessOutreachQueryKey,
  getGetBusinessContactCandidatesQueryKey,
  getGetBusinessByIdQueryKey,
  getGetBusinessSourcesQueryKey,
  getGetBusinessOutreachEventsQueryKey,
  getGetCaseStudiesQueryKey,
  getGetContentAssetsQueryKey,
  getGetCredibilityAssetsQueryKey,
  getGetNarrativesQueryKey,
  getGetOffersQueryKey,
  useGetBusinessOutreach,
  useGetBusinessContactCandidates,
  useGetBusinessById,
  useGetBusinessSources,
  useGetBusinessOutreachEvents,
  useGetCaseStudies,
  useGetContentAssets,
  useGetCredibilityAssets,
  useGetNarratives,
  useGetOffers,
  useUpdateBusinessContactCandidate,
  useUpdateBusinessOutreach,
  type ContentAsset,
  type OutreachEvent,
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
import {
  getArtistRecommendation,
  getAvatarTypeRecommendation,
} from "@/lib/artist-recommendation";
import { formatPipelineValue } from "@/lib/outreach-formatting";

function selectSuggestedContentAsset(
  assets: ContentAsset[],
  business: {
    engineType?: string | null;
    targetCluster?: string | null;
    bestOfferId?: number | null;
    bestNarrativeId?: number | null;
  } | null | undefined,
  preferredAssetType?: string,
) {
  if (!business) return null;

  const scored = assets
    .filter((asset) => !preferredAssetType || asset.assetType === preferredAssetType)
    .map((asset) => {
      let score = 0;
      if (asset.assetType === "pitch_snippet") score += 35;
      if (asset.assetType === "proof_snippet") score += 20;
      if (asset.assetType === "cta_suggestion") score += 30;
      if (asset.engineType && asset.engineType === business.engineType) score += 25;
      if (asset.targetCluster && asset.targetCluster === business.targetCluster) score += 30;
      if (!asset.engineType) score += 5;
      if (!asset.targetCluster) score += 5;
      if (business.bestNarrativeId) score += 3;
      if (business.bestOfferId) score += 2;
      return { asset, score };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0]?.asset ?? null;
}

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

type AuditDiff = { field: unknown; before: unknown; after: unknown };

const AUDIT_FIELD_LABELS: Record<string, string> = {
  outreachStatus: "Stato outreach",
  outreach_status: "Stato outreach",
  contactName: "Nome contatto",
  contact_name: "Nome contatto",
  contactRole: "Ruolo contatto",
  contact_role: "Ruolo contatto",
  contactEmail: "Email contatto",
  contact_email: "Email contatto",
  lastContactDate: "Ultima data contatto",
  last_contact_date: "Ultima data contatto",
  nextActionDate: "Prossima azione",
  next_action_date: "Prossima azione",
  assignedArtist: "Artista assegnato",
  assigned_artist: "Artista assegnato",
  assignedArtistSource: "Sorgente assegnazione",
  assigned_artist_source: "Sorgente assegnazione",
  avatarType: "Tipo avatar",
  avatar_type: "Tipo avatar",
  targetMarket: "Mercato target",
  target_market: "Mercato target",
  warmConnection: "Connessione calda",
  warm_connection: "Connessione calda",
  pipelineStage: "Fase pipeline",
  pipeline_stage: "Fase pipeline",
  notes: "Note",
  reviewStatus: "Stato revisione",
  review_status: "Stato revisione",
  isPrimary: "Contatto principale",
  is_primary: "Contatto principale",
  contactType: "Tipo contatto",
  contact_type: "Tipo contatto",
  contactUrl: "URL contatto",
  contact_url: "URL contatto",
  sourceType: "Tipo sorgente",
  source_type: "Tipo sorgente",
};

const AUDIT_DATE_FIELDS = new Set([
  "lastContactDate", "last_contact_date",
  "nextActionDate", "next_action_date",
  "createdAt", "created_at",
  "updatedAt", "updated_at",
]);

const AUDIT_ENUM_FIELDS = new Set([
  "outreachStatus", "outreach_status",
  "avatarType", "avatar_type",
  "warmConnection", "warm_connection",
  "assignedArtistSource", "assigned_artist_source",
  "pipelineStage", "pipeline_stage",
]);

function getAuditDiffs(payload: Record<string, unknown>): AuditDiff[] {
  if (!payload || typeof payload !== "object") return [];
  const diffs = payload["diffs"];
  if (!Array.isArray(diffs) || diffs.length === 0) return [];
  return diffs as AuditDiff[];
}

const PAYLOAD_SKIP_KEYS = new Set(["diffs"]);

type PayloadEntry = { key: string; value: string };

function getPayloadContext(payload: Record<string, unknown>): PayloadEntry[] {
  if (!payload || typeof payload !== "object") return [];
  return Object.entries(payload)
    .filter(([key, val]) => {
      if (PAYLOAD_SKIP_KEYS.has(key)) return false;
      if (val === null || val === undefined || val === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    })
    .map(([key, val]) => ({
      key,
      value: formatDiffValue(key, val),
    }));
}

function formatDiffValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "vuoto";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return "[oggetto]"; }
  }
  const str = String(value);
  if (str === "true") return "Sì";
  if (str === "false") return "No";
  if (AUDIT_DATE_FIELDS.has(field)) {
    try {
      return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(str));
    } catch {
      return str;
    }
  }
  if (AUDIT_ENUM_FIELDS.has(field)) {
    return formatPipelineValue(str);
  }
  return str;
}

type OutreachFormState = {
  outreachStatus: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  lastContactDate: string;
  nextActionDate: string;
  assignedArtist: string;
  assignedArtistSource: string;
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

function formatConfidence(value?: string | null) {
  if (!value) return "N/A";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return `${Math.round(numeric * 100)}%`;
}

function formatAuditTimestamp(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAuditChangedField(field: string) {
  return AUDIT_FIELD_LABELS[field] ?? formatPipelineValue(field);
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
    assignedArtistSource?: string | null;
    avatarType?: string | null;
    targetMarket?: string | null;
    warmConnection?: string | null;
    notes?: string | null;
  } | null,
  categorySlug?: string | null,
): OutreachFormState {
  const avatarSuggestion = getAvatarTypeRecommendation(categorySlug);
  const avatarType = outreach?.avatarType ?? avatarSuggestion?.avatarType ?? "";
  const artistRecommendation = getArtistRecommendation({
    avatarType,
    targetMarket: outreach?.targetMarket ?? null,
    categorySlug,
  });
  const assignedArtist = outreach?.assignedArtist ?? artistRecommendation?.suggestedArtist ?? "";
  const assignedArtistSource =
    assignedArtist === ""
      ? ""
      : outreach?.assignedArtistSource ??
        (artistRecommendation && assignedArtist === artistRecommendation.suggestedArtist
          ? "auto"
          : "manual");

  return {
    outreachStatus: outreach?.outreachStatus ?? "not_contacted",
    contactName: outreach?.contactName ?? "",
    contactRole: outreach?.contactRole ?? "",
    contactEmail: outreach?.contactEmail ?? "",
    lastContactDate: outreach?.lastContactDate ?? "",
    nextActionDate: outreach?.nextActionDate ?? "",
    assignedArtist,
    assignedArtistSource,
    avatarType,
    targetMarket: outreach?.targetMarket ?? "",
    warmConnection: outreach?.warmConnection ?? "",
    notes: outreach?.notes ?? "",
  };
}

function serializeOutreachFormState(form: OutreachFormState) {
  return JSON.stringify(form);
}

function getAssignedArtistMode(
  form: OutreachFormState,
  categorySlug?: string | null,
): "auto" | "manual" {
  if (form.assignedArtistSource === "manual") {
    return "manual";
  }

  const recommendation = getArtistRecommendation({
    avatarType: form.avatarType,
    targetMarket: form.targetMarket,
    categorySlug,
  });

  return form.assignedArtist &&
    recommendation &&
    form.assignedArtist !== recommendation.suggestedArtist
    ? "manual"
    : "auto";
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
  const [outreachForm, setOutreachForm] = useState<OutreachFormState>(() => buildOutreachFormState());
  const [assignedArtistMode, setAssignedArtistMode] = useState<"auto" | "manual">("auto");

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
      enabled: Number.isFinite(businessId) && businessId > 0,
    },
  });

  const contactCandidatesQuery = useGetBusinessContactCandidates(businessId, {
    query: {
      queryKey: getGetBusinessContactCandidatesQueryKey(businessId),
      enabled: Number.isFinite(businessId) && businessId > 0,
    },
  });

  const outreachEventsQuery = useGetBusinessOutreachEvents(businessId, {
    query: {
      queryKey: getGetBusinessOutreachEventsQueryKey(businessId),
      enabled: Number.isFinite(businessId) && businessId > 0,
    },
  });
  const offersQuery = useGetOffers({
    query: { queryKey: getGetOffersQueryKey() },
  });
  const narrativesQuery = useGetNarratives({
    query: { queryKey: getGetNarrativesQueryKey() },
  });
  const credibilityAssetsQuery = useGetCredibilityAssets({
    query: { queryKey: getGetCredibilityAssetsQueryKey() },
  });
  const caseStudiesQuery = useGetCaseStudies({
    query: { queryKey: getGetCaseStudiesQueryKey() },
  });
  const contentAssetsQuery = useGetContentAssets({
    query: { queryKey: getGetContentAssetsQueryKey() },
  });

  const [filterEventType, setFilterEventType] = useState("all");
  const [filterChangedField, setFilterChangedField] = useState("all");

  useEffect(() => {
    if (outreachQuery.data) {
      const nextForm = buildOutreachFormState(
        outreachQuery.data,
        businessQuery.data?.categorySlug ?? null,
      );

      setOutreachForm(nextForm);
      setAssignedArtistMode(getAssignedArtistMode(nextForm, businessQuery.data?.categorySlug ?? null));
    }
  }, [outreachQuery.data, businessQuery.data?.categorySlug]);

  const referenceLabels = useMemo(
    () => ({
      offers: Object.fromEntries((offersQuery.data ?? []).map((entry) => [entry.id, entry.name ?? `Offer #${entry.id}`])),
      narratives: Object.fromEntries(
        (narrativesQuery.data ?? []).map((entry) => [entry.id, entry.name ?? `Narrative #${entry.id}`]),
      ),
      assets: Object.fromEntries(
        (credibilityAssetsQuery.data ?? []).map((entry) => [entry.id, entry.name ?? `Asset #${entry.id}`]),
      ),
      caseStudies: Object.fromEntries(
        (caseStudiesQuery.data ?? []).map((entry) => [entry.id, entry.title ?? `Case Study #${entry.id}`]),
      ),
    }),
    [caseStudiesQuery.data, credibilityAssetsQuery.data, narrativesQuery.data, offersQuery.data],
  );

  const suggestedPitchAsset = selectSuggestedContentAsset(
    contentAssetsQuery.data ?? [],
    businessQuery.data,
    "pitch_snippet",
  );
  const suggestedProofAsset = selectSuggestedContentAsset(
    contentAssetsQuery.data ?? [],
    businessQuery.data,
    "proof_snippet",
  );
  const suggestedCtaAsset = selectSuggestedContentAsset(
    contentAssetsQuery.data ?? [],
    businessQuery.data,
    "cta_suggestion",
  );

  const updateOutreachMutation = useUpdateBusinessOutreach({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: getGetBusinessByIdQueryKey(businessId),
        });
        queryClient.invalidateQueries({
          queryKey: getGetBusinessOutreachQueryKey(businessId),
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/businesses"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/outreach/dashboard"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/outreach/pipeline"],
        });
        queryClient.invalidateQueries({
          queryKey: getGetBusinessOutreachEventsQueryKey(businessId),
        });
        setOutreachForm(buildOutreachFormState(data, businessQuery.data?.categorySlug ?? null));
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
          queryKey: getGetBusinessByIdQueryKey(businessId),
        });
        queryClient.invalidateQueries({
          queryKey: getGetBusinessContactCandidatesQueryKey(businessId),
        });
        queryClient.invalidateQueries({
          queryKey: getGetBusinessOutreachEventsQueryKey(businessId),
        });
        queryClient.invalidateQueries({
          queryKey: ["business-outreach-events", businessId],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/businesses"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/outreach/dashboard"],
        });
        queryClient.invalidateQueries({
          queryKey: ["/api/outreach/pipeline"],
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

  const liveArtistRecommendation = getArtistRecommendation({
    avatarType: outreachForm.avatarType,
    targetMarket: outreachForm.targetMarket,
    categorySlug: businessQuery.data?.categorySlug ?? null,
  });
  const liveAvatarRecommendation = getAvatarTypeRecommendation(
    businessQuery.data?.categorySlug ?? null,
  );

  useEffect(() => {
    if (assignedArtistMode !== "auto") {
      return;
    }

    const suggestedArtist = liveArtistRecommendation?.suggestedArtist ?? "";
    setOutreachForm((current) => {
      if (current.assignedArtist === suggestedArtist) {
        return current;
      }

      return {
        ...current,
        assignedArtist: suggestedArtist,
        assignedArtistSource: suggestedArtist ? "auto" : "",
      };
    });
  }, [liveArtistRecommendation?.suggestedArtist, assignedArtistMode]);

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
  const artistRecommendation = liveArtistRecommendation;
  const avatarRecommendation = liveAvatarRecommendation;
  const persistedOutreachForm = buildOutreachFormState(outreach, business.categorySlug);
  const isOutreachDirty =
    serializeOutreachFormState(outreachForm) !== serializeOutreachFormState(persistedOutreachForm);

  function updateOutreachField<K extends keyof OutreachFormState>(
    key: K,
    value: OutreachFormState[K],
  ) {
    setOutreachForm((current) => ({ ...current, [key]: value }));
  }

  function updateAssignedArtist(value: string, mode: "auto" | "manual") {
    setAssignedArtistMode(mode);
    setOutreachForm((current) => ({
      ...current,
      assignedArtist: value,
      assignedArtistSource: value ? mode : "",
    }));
  }

  function resetOutreachForm() {
    setOutreachForm(persistedOutreachForm);
    setAssignedArtistMode(getAssignedArtistMode(persistedOutreachForm, business.categorySlug));
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
        assignedArtistSource:
          outreachForm.assignedArtist ? outreachForm.assignedArtistSource || "manual" : null,
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
              <CardTitle>Research State</CardTitle>
              <CardDescription>
                Ranking, readiness e prossima azione della macchina di discovery.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Priority</p>
                  <p className="mt-2 text-2xl font-serif">{business.priorityScore ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Research</p>
                  <p className="mt-2 text-2xl font-serif">{business.researchScore ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Confidence</p>
                  <p className="mt-2 text-2xl font-serif">{business.confidenceScore ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Freshness</p>
                  <p className="mt-2 text-2xl font-serif">{business.freshnessScore ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Economic Value</p>
                  <p className="mt-2 text-2xl font-serif">{business.economicValueScore ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Strategic Value</p>
                  <p className="mt-2 text-2xl font-serif">{business.strategicValueScore ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Referral Value</p>
                  <p className="mt-2 text-2xl font-serif">{business.referralValueScore ?? "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Actionability</p>
                  <p className="mt-2 text-2xl font-serif">{business.actionabilityScore ?? "—"}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {business.engineType && (
                  <Badge variant="outline">{formatPipelineValue(business.engineType)}</Badge>
                )}
                {business.targetType && (
                  <Badge variant="outline">{formatPipelineValue(business.targetType)}</Badge>
                )}
                {business.targetCluster && (
                  <Badge variant="outline">{formatPipelineValue(business.targetCluster)}</Badge>
                )}
                {business.readyForOutreach && (
                  <Badge variant="outline" className="bg-primary/5 text-primary">
                    <BadgeCheck className="mr-1 h-3 w-3" />
                    Ready for outreach
                  </Badge>
                )}
                {business.readyForRelationship && (
                  <Badge variant="outline" className="text-emerald-700">
                    Relationship-ready
                  </Badge>
                )}
                {business.readyForInstitutionalPitch && (
                  <Badge variant="outline" className="text-sky-700">
                    Institutional pitch
                  </Badge>
                )}
                {business.prestigeWatchlist && (
                  <Badge variant="outline">Prestige watchlist</Badge>
                )}
                {business.cultivationRequired && (
                  <Badge variant="outline">Cultivation required</Badge>
                )}
                {business.reviewRequired && (
                  <Badge variant="outline" className="text-amber-700">
                    <CircleSlash className="mr-1 h-3 w-3" />
                    Review required
                  </Badge>
                )}
                {business.sourceHealth && (
                  <Badge variant="outline">
                    <Database className="mr-1 h-3 w-3" />
                    {formatPipelineValue(business.sourceHealth)}
                  </Badge>
                )}
                {business.contactReadiness && (
                  <Badge variant="outline">
                    {formatPipelineValue(business.contactReadiness)}
                  </Badge>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Top Gap</p>
                  <p className="mt-2 font-medium">
                    {business.topGap ? formatPipelineValue(business.topGap) : "No major gap"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommended Next Step</p>
                  <p className="mt-2 font-medium">
                    {business.recommendedNextStep
                      ? formatPipelineValue(business.recommendedNextStep)
                      : "No recommendation yet"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Primary Source</p>
                  <p className="mt-2 font-medium">
                    {business.primarySourceId ? `Source #${business.primarySourceId}` : "Not selected yet"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Primary Contact</p>
                  <p className="mt-2 font-medium">
                    {business.primaryContactCandidateId
                      ? `Candidate #${business.primaryContactCandidateId}`
                      : "Not selected yet"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Best Offer</p>
                  <p className="mt-2 font-medium">
                    {business.bestOfferId
                      ? referenceLabels.offers[business.bestOfferId] ?? `Offer #${business.bestOfferId}`
                      : "Not assigned yet"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Best Narrative</p>
                  <p className="mt-2 font-medium">
                    {business.bestNarrativeId
                      ? referenceLabels.narratives[business.bestNarrativeId] ?? `Narrative #${business.bestNarrativeId}`
                      : "Not assigned yet"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Best Proof</p>
                  <p className="mt-2 font-medium">
                    {business.bestCredibilityAssetId
                      ? referenceLabels.assets[business.bestCredibilityAssetId] ??
                        `Asset #${business.bestCredibilityAssetId}`
                      : business.bestCaseStudyId
                        ? referenceLabels.caseStudies[business.bestCaseStudyId] ??
                          `Case Study #${business.bestCaseStudyId}`
                        : "Not assigned yet"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Pitch Angle</p>
                  <p className="mt-2 font-medium">
                    {business.recommendedPitchAngle ?? business.proofAngle ?? "No angle selected yet"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Suggested Pitch Snippet</p>
                  <p className="mt-2 font-medium">
                    {suggestedPitchAsset?.title ?? "No pitch asset selected yet"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                    {suggestedPitchAsset?.body ?? "No reusable pitch snippet available for this target yet."}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Relationship Path</p>
                  <p className="mt-2 font-medium">
                    {business.warmPathExists ? "Warm or networked path available" : "Cold outreach required"}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Score {business.relationshipPathScore ?? 0} · {business.readyForRelationship ? "use warm intro" : "build first signal"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Proof Snippet</p>
                  <p className="mt-2 font-medium">
                    {suggestedProofAsset?.title ?? business.proofAngle ?? "No proof asset selected yet"}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    {suggestedProofAsset?.body ?? business.riskReductionReason ?? "No reusable proof snippet available."}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">CTA Suggestion</p>
                  <p className="mt-2 font-medium">
                    {suggestedCtaAsset?.title ?? "No CTA asset selected yet"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                    {suggestedCtaAsset?.body ??
                      (business.recommendedNextStep
                        ? `Next action: ${formatPipelineValue(business.recommendedNextStep)}`
                        : "No CTA suggestion available yet.")}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Timing</p>
                  <p className="mt-2 font-medium">
                    {business.nextBestContactWindow ?? "Always-on"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Account Tier</p>
                  <p className="mt-2 font-medium">
                    {business.accountTier ?? "Not tiered"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Discovery: {business.discoveryStatus ?? "n/a"}</span>
                <span>Qualification: {business.qualificationStatus ?? "n/a"}</span>
                <span>Contactability: {business.contactabilityStatus ?? "n/a"}</span>
                <span>Ranking: {business.rankingStatus ?? "n/a"}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  Next research: {business.nextResearchAt ? formatDate(business.nextResearchAt) : "Not scheduled"}
                </span>
              </div>
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
              ) : outreachQuery.isError ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Outreach fields are unavailable.
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
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {outreach?.assignedArtist || outreachForm.assignedArtist || "Not assigned"}
                        </p>
                        {(outreach?.assignedArtistSource || outreachForm.assignedArtistSource) && (
                          <Badge variant="outline" className="capitalize">
                            {outreach?.assignedArtistSource || outreachForm.assignedArtistSource}
                          </Badge>
                        )}
                      </div>
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
                          updateAssignedArtist(value === "__none__" ? "" : value, "manual")
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
                      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        {artistRecommendation ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">
                                Suggested: {artistRecommendation.suggestedArtist}
                              </span>
                              <Badge variant="outline" className="capitalize">
                                {artistRecommendation.confidence}
                              </Badge>
                              {outreachForm.assignedArtistSource === "manual" &&
                                outreachForm.assignedArtist &&
                                outreachForm.assignedArtist !== artistRecommendation.suggestedArtist && (
                                  <Badge variant="secondary">Manual override</Badge>
                                )}
                              {outreachForm.assignedArtistSource === "auto" &&
                                outreachForm.assignedArtist === artistRecommendation.suggestedArtist && (
                                  <Badge variant="outline">Auto assigned</Badge>
                                )}
                            </div>
                            <p>{artistRecommendation.reason}</p>
                            {outreachForm.assignedArtist !== artistRecommendation.suggestedArtist && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateAssignedArtist(artistRecommendation.suggestedArtist, "auto")
                                }
                              >
                                Apply suggestion
                              </Button>
                            )}
                          </div>
                        ) : (
                          <p>
                            Set `avatar type` and `target market` to unlock an artist suggestion.
                          </p>
                        )}
                      </div>
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
                      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        {avatarRecommendation ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">
                                Suggested: {formatPipelineValue(avatarRecommendation.avatarType)}
                              </span>
                              {outreachForm.avatarType === avatarRecommendation.avatarType && (
                                <Badge variant="outline">Category default</Badge>
                              )}
                            </div>
                            <p>{avatarRecommendation.reason}</p>
                            {outreachForm.avatarType !== avatarRecommendation.avatarType && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateOutreachField("avatarType", avatarRecommendation.avatarType)
                                }
                              >
                                Apply suggestion
                              </Button>
                            )}
                          </div>
                        ) : (
                          <p>No avatar suggestion available for this category yet.</p>
                        )}
                      </div>
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
              <CardTitle>Outreach Timeline</CardTitle>
              <CardDescription>
                Audit trail of outreach edits and contact candidate review actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {outreachEventsQuery.isLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : outreachEventsQuery.isError ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Outreach history is unavailable.
                </div>
              ) : (outreachEventsQuery.data ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No outreach history has been recorded for this business yet.
                </div>
              ) : (() => {
                const allEvents = outreachEventsQuery.data ?? [];
                const uniqueEventTypes = Array.from(new Set(allEvents.map((e) => e.eventType)));
                const uniqueChangedFields = Array.from(
                  new Set(allEvents.flatMap((e) => e.changedFields)),
                ).sort();
                const filteredEvents = allEvents.filter((e) => {
                  if (filterEventType !== "all" && e.eventType !== filterEventType) return false;
                  if (filterChangedField !== "all" && !e.changedFields.includes(filterChangedField)) return false;
                  return true;
                });
                return (
                  <>
                    {(uniqueEventTypes.length > 1 || uniqueChangedFields.length > 0) && (
                      <div className="flex flex-wrap items-center gap-2 pb-2">
                        <span className="text-xs text-muted-foreground">Filtra per:</span>
                        {uniqueEventTypes.length > 1 && (
                          <Select value={filterEventType} onValueChange={(v) => { setFilterEventType(v); setFilterChangedField("all"); }}>
                            <SelectTrigger className="h-8 w-44 text-xs">
                              <SelectValue placeholder="Tipo evento" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tutti i tipi</SelectItem>
                              {uniqueEventTypes.map((t) => (
                                <SelectItem key={t} value={t}>{formatSourceType(t)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {uniqueChangedFields.length > 0 && (
                          <Select value={filterChangedField} onValueChange={(v) => { setFilterChangedField(v); setFilterEventType("all"); }}>
                            <SelectTrigger className="h-8 w-52 text-xs">
                              <SelectValue placeholder="Campo modificato" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tutti i campi</SelectItem>
                              {uniqueChangedFields.map((f) => (
                                <SelectItem key={f} value={f}>{formatAuditChangedField(f)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {(filterEventType !== "all" || filterChangedField !== "all") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground"
                            onClick={() => { setFilterEventType("all"); setFilterChangedField("all"); }}
                          >
                            Azzera filtri
                          </Button>
                        )}
                      </div>
                    )}
                    {filteredEvents.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        Nessun evento corrisponde al filtro selezionato.
                      </div>
                    ) : filteredEvents.map((event, index) => {
                  const diffs = getAuditDiffs(event.payload);
                  const context = getPayloadContext(event.payload);
                  return (
                    <div key={event.id} className="space-y-3">
                      {index > 0 && <Separator />}
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{formatSourceType(event.eventType)}</Badge>
                            <Badge variant="outline">{formatSourceType(event.entityType)}</Badge>
                          </div>
                          <p className="text-sm font-medium">{event.summary}</p>
                          {event.changedFields.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {event.changedFields.map((field) => (
                                <Badge key={field} variant="outline">
                                  {formatAuditChangedField(field)}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {diffs.length > 0 ? (
                            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1.5">
                              {diffs.map((diff) => {
                                const fieldKey = String(diff.field);
                                const beforeLabel = formatDiffValue(fieldKey, diff.before);
                                const afterLabel = formatDiffValue(fieldKey, diff.after);
                                return (
                                  <div key={`${event.id}-${fieldKey}`} className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-medium text-foreground">
                                      {formatAuditChangedField(fieldKey)}
                                    </span>
                                    <span className="text-muted-foreground">cambiato:</span>
                                    <span className="line-through text-muted-foreground/70">{beforeLabel}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="font-medium text-foreground">{afterLabel}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : context.length > 0 ? (
                            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1.5">
                              {context.map((entry) => (
                                <div key={`${event.id}-ctx-${entry.key}`} className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-medium text-foreground">
                                    {formatAuditChangedField(entry.key)}:
                                  </span>
                                  <span className="text-foreground">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatAuditTimestamp(event.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                  </>
                );
              })()}
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
              ) : contactCandidatesQuery.isError ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Contact candidates are unavailable.
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
                          {source.sourceLicense && (
                            <span className="inline-flex items-center gap-1">
                              <BadgeCheck className="h-3 w-3" />
                              License: {source.sourceLicense}
                            </span>
                          )}
                        </div>
                        {source.sourcePayloadSummary && (
                          <p className="max-w-2xl text-xs text-muted-foreground">
                            {source.sourcePayloadSummary}
                          </p>
                        )}
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
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Wikidata ID</span>
                <span className="font-medium break-all text-right">
                  {business.wikidataId || "Not available"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">GeoNames ID</span>
                <span className="font-medium break-all text-right">
                  {business.geonamesId || "Not available"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Data quality</span>
                <span className="font-medium">
                  {business.dataQualityScore != null ? `${business.dataQualityScore}/100` : "Not scored"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Last enrichment</span>
                <span className="font-medium text-right">
                  {formatDate(business.lastEnrichmentAt)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
