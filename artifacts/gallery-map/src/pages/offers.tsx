import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStoredAdminToken } from "@/lib/admin-auth";

type Offer = {
  id: number;
  slug: string;
  name: string;
  engineType: string;
  offerType: string;
  summary?: string | null;
  targetClusters?: string | null;
  ticketMin?: number | null;
  ticketMax?: number | null;
  recurringPotential?: number | null;
  bundleable: boolean;
  active: boolean;
};

function apiHeaders() {
  const token = getStoredAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const hasAdminToken = Boolean(getStoredAdminToken());

  useEffect(() => {
    if (!hasAdminToken) return;
    void fetch("/api/offers", { headers: apiHeaders() })
      .then((response) => response.json())
      .then((data: Offer[]) => setOffers(data));
  }, [hasAdminToken]);

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
