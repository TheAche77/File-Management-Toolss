import { Link } from "wouter";
import {
  getGetStrategicAccountsQueryKey,
  useGetStrategicAccounts,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getStoredAdminToken } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

export default function AccountsPage() {
  const hasAdminToken = Boolean(getStoredAdminToken());
  const { data: accounts = [] } = useGetStrategicAccounts(undefined, {
    query: {
      queryKey: getGetStrategicAccountsQueryKey(),
      enabled: hasAdminToken,
    },
  });

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
