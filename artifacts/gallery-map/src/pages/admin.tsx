import { useImportOsmRome, useGetImportRuns, getGetImportRunsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, RefreshCw, Database } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: runs, isLoading: runsLoading } = useGetImportRuns({
    query: { queryKey: getGetImportRunsQueryKey() }
  });

  const importMutation = useImportOsmRome({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetImportRunsQueryKey() });
        toast({
          title: "Import Complete",
          description: `Fetched: ${data.fetched}, Inserted: ${data.inserted}, Updated: ${data.updated}`,
        });
      },
      onError: (error) => {
        toast({
          title: "Import Failed",
          description: error.error || "An unknown error occurred",
          variant: "destructive",
        });
      }
    }
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif text-foreground">Administration</h1>
        <p className="text-muted-foreground mt-2 text-lg">System controls and data management.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Data Import</CardTitle>
            <CardDescription>Fetch the latest gallery data from OpenStreetMap for Rome.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => importMutation.mutate()} 
              disabled={importMutation.isPending}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-import-rome"
            >
              {importMutation.isPending ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
              ) : (
                <><Database className="mr-2 h-4 w-4" /> Import Rome from OSM</>
              )}
            </Button>
            {importMutation.data && (
              <div className="mt-4 text-sm bg-muted/50 p-3 border border-border">
                <p className="font-medium text-foreground mb-1">Last Result:</p>
                <p className="text-muted-foreground">Inserted: {importMutation.data.inserted} | Updated: {importMutation.data.updated} | Errors: {importMutation.data.errors}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Data Export</CardTitle>
            <CardDescription>Download the complete catalogue as a CSV file.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              data-testid="button-export-csv"
              asChild
            >
              <a href="/api/export/galleries.csv" download>
                <Download className="mr-2 h-4 w-4" /> Export Complete CSV
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-serif mb-4">Import History</h2>
        <div className="bg-card border border-border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Fetched</th>
                <th className="px-4 py-3 font-medium text-right">Inserted</th>
                <th className="px-4 py-3 font-medium text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runsLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading history...</td></tr>
              ) : runs?.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No import history found.</td></tr>
              ) : (
                runs?.map((run) => (
                  <tr key={run.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">
                      {format(new Date(run.startedAt), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge 
                        variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}
                        className="uppercase tracking-widest text-[10px] rounded-none font-normal"
                      >
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{run.fetched || 0}</td>
                    <td className="px-4 py-3 text-right text-primary font-medium">{run.inserted || 0}</td>
                    <td className="px-4 py-3 text-right">{run.updated || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
