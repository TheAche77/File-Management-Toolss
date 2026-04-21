import { useGetStats, useGetCategories } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Globe, Phone, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStats();
  const { data: categories } = useGetCategories();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <h1 className="text-4xl font-serif">Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-2 text-lg">A discovery engine for local businesses across Italy.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Total Businesses</CardTitle>
            <Building2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{stats.totalBusinesses}</div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">With Website</CardTitle>
            <Globe className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{stats.withWebsite}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(((stats.withWebsite ?? 0) / (stats.totalBusinesses || 1)) * 100)}% coverage
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">With Phone</CardTitle>
            <Phone className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{stats.withPhone}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(((stats.withPhone ?? 0) / (stats.totalBusinesses || 1)) * 100)}% coverage
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Enriched</CardTitle>
            <Sparkles className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{stats.enriched ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Google enriched</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-serif mb-4">By Category</h2>
          <div className="bg-card border border-border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(stats.byCategoryBreakdown ?? []).map((item, idx) => {
                  const cat = categories?.find(c => c.slug === item.categorySlug);
                  return (
                    <tr key={idx} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{cat?.label ?? item.categorySlug}</td>
                      <td className="px-4 py-3 text-right">{item.count}</td>
                    </tr>
                  );
                })}
                {(stats.byCategoryBreakdown ?? []).length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-serif mb-4">By City</h2>
          <div className="bg-card border border-border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(stats.byCityBreakdown ?? []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{item.city || 'Unknown'}</td>
                    <td className="px-4 py-3 text-right">{item.count}</td>
                  </tr>
                ))}
                {(stats.byCityBreakdown ?? []).length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
