import { getGetOffersQueryKey, useGetOffers, type Offer } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStoredAdminToken } from "@/lib/admin-auth";

export default function OffersPage() {
  const hasAdminToken = Boolean(getStoredAdminToken());
  const { data: offers = [] } = useGetOffers({
    query: {
      queryKey: getGetOffersQueryKey(),
      enabled: hasAdminToken,
    },
  });

  if (!hasAdminToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Offers Console</CardTitle>
          <CardDescription>Admin unlock required.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif">Offers Console</h1>
        <p className="text-muted-foreground mt-2">Catalogo offerte SLG con fit e potenziale di continuità.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((offer) => (
          <Card key={offer.id}>
            <CardHeader>
              <CardTitle>{offer.name}</CardTitle>
              <CardDescription>{offer.summary ?? offer.offerType}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{offer.engineType}</Badge>
                <Badge variant="outline">{offer.offerType}</Badge>
                {offer.bundleable && <Badge variant="outline">Bundleable</Badge>}
                {offer.active && <Badge variant="outline">Active</Badge>}
              </div>
              <div>Target clusters: {offer.targetClusters ?? "n/a"}</div>
              <div>Ticket: {offer.ticketMin ?? "—"} - {offer.ticketMax ?? "—"}</div>
              <div>Recurring potential: {offer.recurringPotential ?? "—"}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
