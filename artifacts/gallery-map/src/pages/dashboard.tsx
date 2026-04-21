import { Link } from "wouter";
import {
  getGetOutreachDashboardQueryKey,
  useGetOutreachDashboard,
} from "@workspace/api-client-react";
import {
  ArrowRight,
  Flame,
  MailCheck,
  MessageSquareReply,
  TimerReset,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStoredAdminToken } from "@/lib/admin-auth";
import { formatDueLabel, formatPipelineValue } from "@/lib/outreach-formatting";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-4 w-36 mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const hasAdminToken = Boolean(getStoredAdminToken());
  const { data, isLoading, isError } = useGetOutreachDashboard({
    query: {
      queryKey: getGetOutreachDashboardQueryKey(),
      enabled: hasAdminToken,
    },
  });

  if (!hasAdminToken) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-serif text-foreground">Outreach Dashboard</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            KPI, priorità e follow-up della pipeline commerciale SLG.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Admin unlock required</CardTitle>
            <CardDescription>
              Questa dashboard usa endpoint protetti perché espone dati operativi e contatti outreach.
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
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Outreach dashboard unavailable</CardTitle>
            <CardDescription>
              Non siamo riusciti a caricare i KPI outreach con la sessione admin corrente.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const kpis = [
    {
      label: "Contattati",
      value: data.contacted,
      description: `${data.totalTargets} target totali`,
      icon: MailCheck,
    },
    {
      label: "Risposte Positive",
      value: data.positiveResponses,
      description: "Interested + closed won",
      icon: MessageSquareReply,
    },
    {
      label: "Tasso Risposta",
      value: formatPercent(data.responseRate),
      description: "Positive / contacted",
      icon: Waves,
    },
    {
      label: "Follow-up Scaduti",
      value: data.overdueFollowUps,
      description: "Azioni arretrate da recuperare",
      icon: TimerReset,
    },
    {
      label: "In Corso",
      value: data.inProgress,
      description: "Emailed + follow-up aperti",
      icon: ArrowRight,
    },
    {
      label: "Interest",
      value: data.interested,
      description: "Target caldi da coltivare",
      icon: Flame,
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground">Outreach Dashboard</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            La vista operativa che sostituisce l’Excel: KPI, urgenze e priorità della settimana.
          </p>
        </div>
        <Button asChild>
          <Link href="/pipeline">Apri Follow-up Board</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </CardTitle>
                <Icon className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif">{kpi.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Top urgente questa settimana</CardTitle>
            <CardDescription>
              I contatti che rischiano di rallentare la pipeline se non vengono mossi subito.
            </CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href="/pipeline">Vedi tutta la board</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.urgentThisWeek.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Nessuna urgenza rilevata nella finestra attuale.
            </div>
          ) : (
            data.urgentThisWeek.map((item) => (
              <div
                key={item.businessId}
                className="flex flex-col gap-4 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.urgencyBucket === "urgent" ? "destructive" : "secondary"}>
                      {formatPipelineValue(item.urgencyBucket)}
                    </Badge>
                    <Badge variant="outline">{formatPipelineValue(item.outreachStatus)}</Badge>
                    {item.assignedArtist && (
                      <Badge variant="outline" className="bg-primary/5 text-primary">
                        {item.assignedArtist}
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
                  <p className="text-sm">
                    <span className="font-medium">{item.recommendedAction}</span>
                    <span className="text-muted-foreground"> · {formatDueLabel(item.daysUntilAction, item.nextActionDate)}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`/businesses/${item.businessId}`}>Apri scheda</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
