import { Link } from "wouter";
import { useGetOutreachPipeline } from "@workspace/api-client-react";
import { CalendarClock, ExternalLink, Mail, MoveRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getArtistRecommendation } from "@/lib/artist-recommendation";
import { getStoredAdminToken } from "@/lib/admin-auth";

function formatPipelineValue(value?: string | null) {
  if (!value) return "Not set";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDueLabel(daysUntilAction?: number | null, nextActionDate?: string | null) {
  if (daysUntilAction === null || daysUntilAction === undefined) {
    return "No action scheduled";
  }
  if (daysUntilAction < 0) return `Scaduto da ${Math.abs(daysUntilAction)} giorno${Math.abs(daysUntilAction) === 1 ? "" : "i"}`;
  if (daysUntilAction === 0) return "Oggi";
  if (daysUntilAction === 1) return "Domani";
  return `${nextActionDate ?? `+${daysUntilAction} giorni`}`;
}

function getUrgencyTone(bucket: string) {
  if (bucket === "urgent") return "destructive";
  if (bucket === "this_week") return "secondary";
  return "outline";
}

function buildMailtoLink(item: {
  contactEmail?: string | null;
  contactName?: string | null;
  businessName: string;
  avatarType?: string | null;
  recommendedAction: string;
}) {
  if (!item.contactEmail) return null;

  const subjectByAvatar: Record<string, string> = {
    gallery_director: `Street Level Gallery x ${item.businessName}`,
    hotel_art_curator: `Art placement proposal for ${item.businessName}`,
    festival: `Street Level Gallery collaboration for ${item.businessName}`,
    museum_shop: `Street Level Gallery proposal for ${item.businessName}`,
    institution: `Cultural collaboration proposal for ${item.businessName}`,
  };

  const subject =
    subjectByAvatar[item.avatarType ?? ""] ??
    `Street Level Gallery | ${item.recommendedAction} | ${item.businessName}`;
  const greeting = item.contactName ? `Hi ${item.contactName},` : "Hello,";
  const body = `${greeting}%0A%0AI%27m reaching out from Street Level Gallery regarding ${item.businessName}.%0A%0A`;

  return `mailto:${encodeURIComponent(item.contactEmail)}?subject=${encodeURIComponent(subject)}&body=${body}`;
}

function PipelineSkeleton() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 2 }).map((__, rowIndex) => (
              <Skeleton key={rowIndex} className="h-24 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PipelinePage() {
  const hasAdminToken = Boolean(getStoredAdminToken());
  const { data, isLoading, isError } = useGetOutreachPipeline(
    { horizonDays: 7, limit: 60 },
    { query: { enabled: hasAdminToken } },
  );

  if (!hasAdminToken) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-serif text-foreground">Follow-up Board</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            La board operativa per i contatti da muovere adesso.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Admin unlock required</CardTitle>
            <CardDescription>
              La pipeline outreach usa endpoint protetti e richiede una sessione admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin">Vai ad Admin</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <PipelineSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Follow-up board unavailable</CardTitle>
            <CardDescription>
              Non siamo riusciti a caricare la board con la sessione admin corrente.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const sections = [
    { key: "urgent", label: "Urgente", description: "Scaduti, oggi, o mai schedulati" },
    { key: "this_week", label: "Questa settimana", description: "Da muovere entro 3 giorni" },
    { key: "next", label: "Prossima", description: "Finestra operativa successiva" },
  ] as const;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground">Follow-up Board</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Contatti con `nextActionDate` imminente o senza azione pianificata, organizzati per priorità.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Torna alla Dashboard</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Urgente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-serif">{data.summary.urgent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Questa Settimana</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-serif">{data.summary.thisWeek}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Prossima</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-serif">{data.summary.next}</p>
          </CardContent>
        </Card>
      </div>

      {sections.map((section) => {
        const items = data.items.filter((item) => item.urgencyBucket === section.key);

        return (
          <Card key={section.key}>
            <CardHeader>
              <CardTitle>{section.label}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Nessun contatto in questa fascia.
                </div>
              ) : (
                items.map((item) => {
                  const mailtoLink = buildMailtoLink(item);
                  const recommendation = getArtistRecommendation({
                    avatarType: item.avatarType,
                    targetMarket: item.targetMarket,
                    categorySlug: item.categorySlug,
                  });

                  return (
                    <div
                      key={item.businessId}
                      className="flex flex-col gap-4 rounded-xl border p-4 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <div className="space-y-3 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getUrgencyTone(item.urgencyBucket) as "destructive" | "secondary" | "outline"}>
                            {formatPipelineValue(item.urgencyBucket)}
                          </Badge>
                          <Badge variant="outline">{formatPipelineValue(item.outreachStatus)}</Badge>
                          {item.assignedArtist && (
                            <Badge variant="outline" className="bg-primary/5 text-primary">
                              {item.assignedArtist}
                            </Badge>
                          )}
                          {item.assignedArtistSource && (
                            <Badge variant="outline" className="capitalize">
                              {item.assignedArtistSource}
                            </Badge>
                          )}
                        </div>

                        <div>
                          <p className="text-base font-semibold">{item.businessName}</p>
                          <p className="text-sm text-muted-foreground">
                            {[item.city, formatPipelineValue(item.avatarType), item.targetMarket]
                              .filter(Boolean)
                              .join(" · ") || "No targeting metadata yet"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                          <span className="inline-flex items-center gap-1 text-foreground">
                            <MoveRight className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.recommendedAction}
                          </span>
                          <span className="inline-flex items-center gap-1 text-foreground">
                            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDueLabel(item.daysUntilAction, item.nextActionDate)}
                          </span>
                          {item.contactEmail && (
                            <span className="inline-flex items-center gap-1 text-foreground">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              {item.contactEmail}
                            </span>
                          )}
                        </div>

                        {(item.contactName || item.warmConnection || item.notes) && (
                          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                            {item.contactName && (
                              <p>
                                <span className="font-medium text-foreground">{item.contactName}</span>
                                {item.contactRole ? ` · ${item.contactRole}` : ""}
                              </p>
                            )}
                            {item.warmConnection && <p>Warm intro: {item.warmConnection}</p>}
                            {item.notes && <p>{item.notes}</p>}
                          </div>
                        )}

                        {recommendation && (
                          <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                            <p>
                              <span className="font-medium text-foreground">
                                Suggested artist: {recommendation.suggestedArtist}
                              </span>
                              <span className="ml-2 capitalize">({recommendation.confidence})</span>
                            </p>
                            <p>{recommendation.reason}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button variant="outline" asChild>
                          <Link href={`/businesses/${item.businessId}`}>Apri scheda</Link>
                        </Button>
                        {mailtoLink ? (
                          <Button asChild>
                            <a href={mailtoLink}>
                              <Mail className="h-4 w-4" />
                              Email template
                            </a>
                          </Button>
                        ) : item.website ? (
                          <Button asChild>
                            <a href={item.website} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                              Website
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
