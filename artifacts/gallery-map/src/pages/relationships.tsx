import { Link } from "wouter";
import {
  getGetRelationshipPathsQueryKey,
  useGetRelationshipPaths,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getStoredAdminToken } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

export default function RelationshipsPage() {
  const hasAdminToken = Boolean(getStoredAdminToken());
  const { data: paths = [] } = useGetRelationshipPaths(undefined, {
    query: {
      queryKey: getGetRelationshipPathsQueryKey(),
      enabled: hasAdminToken,
    },
  });

  if (!hasAdminToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Relationships</CardTitle>
          <CardDescription>Admin unlock required.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif">Relationships</h1>
        <p className="text-muted-foreground mt-2">Warm paths, introducers, and relationship-first opportunities.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {paths.map((path) => (
          <Card key={path.id}>
            <CardHeader>
              <CardTitle>{path.businessName ?? `Business #${path.businessId}`}</CardTitle>
              <CardDescription>{path.introducerName ?? "No introducer name"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{path.relationshipType}</Badge>
                {path.isWarm && <Badge variant="outline">Warm</Badge>}
                <Badge variant="outline">Confidence {path.confidenceScore}</Badge>
              </div>
              <div>Org: {path.introducerOrg ?? "n/a"}</div>
              <div>{path.notes ?? "No notes"}</div>
              <Link
                href={`/businesses/${path.businessId}`}
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
