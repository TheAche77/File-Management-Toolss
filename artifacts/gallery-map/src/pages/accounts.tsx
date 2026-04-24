import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getStoredAdminToken } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

type StrategicAccount = {
  id: number;
  businessId: number;
  businessName?: string | null;
  accountType: string;
  owner?: string | null;
  accountTier?: string | null;
  status: string;
  thesis?: string | null;
  milestone?: string | null;
};

function apiHeaders() {
  const token = getStoredAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<StrategicAccount[]>([]);
  const hasAdminToken = Boolean(getStoredAdminToken());

  useEffect(() => {
    if (!hasAdminToken) return;
    void fetch("/api/strategic-accounts", { headers: apiHeaders() })
      .then((response) => response.json())
      .then((data: StrategicAccount[]) => setAccounts(data));
  }, [hasAdminToken]);

  if (!hasAdminToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Strategic Accounts</CardTitle>
          <CardDescription>Admin unlock required.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif">Strategic Accounts</h1>
        <p className="text-muted-foreground mt-2">Top account SLG per revenue, institutional, e authority engine.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardHeader>
              <CardTitle>{account.businessName ?? `Business #${account.businessId}`}</CardTitle>
              <CardDescription>{account.thesis ?? "No thesis yet"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{account.accountType}</Badge>
                {account.accountTier && <Badge variant="outline">{account.accountTier}</Badge>}
                <Badge variant="outline">{account.status}</Badge>
              </div>
              <div>Owner: {account.owner ?? "Unassigned"}</div>
              <div>Milestone: {account.milestone ?? "No milestone"}</div>
              <Link
                href={`/businesses/${account.businessId}`}
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-fit")}
              >
                Open business
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
