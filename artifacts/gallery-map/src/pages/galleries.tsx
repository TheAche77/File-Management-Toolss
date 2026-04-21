import { useState } from "react";
import { useGetGalleries, getGetGalleriesQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Globe, Phone, ExternalLink } from "lucide-react";

import { Link } from "wouter";

export default function Galleries() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string>("all");
  const [hasWebsite, setHasWebsite] = useState<boolean | "indeterminate">("indeterminate");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const params = {
    search: search || undefined,
    city: city !== "all" ? city : undefined,
    hasWebsite: hasWebsite !== "indeterminate" ? hasWebsite : undefined,
    page,
    pageSize
  };

  const { data, isLoading } = useGetGalleries(params, {
    query: { queryKey: getGetGalleriesQueryKey(params), keepPreviousData: true }
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif text-foreground">Directory</h1>
        <p className="text-muted-foreground mt-2 text-lg">Browse and filter the complete catalogue of galleries.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-card p-4 border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search galleries..." 
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-search"
          />
        </div>
        
        <Select 
          value={city} 
          onValueChange={(val) => { setCity(val); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[180px] bg-background">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            <SelectItem value="Roma">Roma</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center space-x-2 border border-input px-3 py-2 bg-background">
          <Checkbox 
            id="has-website" 
            checked={hasWebsite === true}
            onCheckedChange={(checked) => {
              setHasWebsite(checked ? true : "indeterminate");
              setPage(1);
            }}
          />
          <label 
            htmlFor="has-website" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Has Website
          </label>
        </div>
      </div>

      <div className="bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left" data-testid="table-galleries">
            <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Name & Address</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && !data ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-3 w-32" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-20" /></td>
                  </tr>
                ))
              ) : data?.galleries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No galleries found matching your criteria.
                  </td>
                </tr>
              ) : (
                data?.galleries.map((gallery) => (
                  <tr key={gallery.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/galleries/${gallery.id}`}>
                        <div className="font-serif font-medium text-foreground text-base hover:text-primary transition-colors cursor-pointer">{gallery.name}</div>
                      </Link>
                      <div className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{gallery.addressLine || 'No address'}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{gallery.city}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {gallery.website ? (
                          <a href={gallery.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                            <Globe className="w-3 h-3" /> Website <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> No website</span>
                        )}
                        {gallery.phone ? (
                          <span className="text-foreground text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> {gallery.phone}</span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> No phone</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="uppercase tracking-widest text-[10px] rounded-none font-normal">
                        {gallery.sourcePrimary}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge 
                        variant="secondary" 
                        className={`uppercase tracking-widest text-[10px] rounded-none font-normal ${
                          gallery.enrichmentStatus === 'enriched' ? 'bg-primary/10 text-primary border-primary/20' : ''
                        }`}
                      >
                        {gallery.enrichmentStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {data && data.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{((page - 1) * pageSize) + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * pageSize, data.total)}</span> of <span className="font-medium text-foreground">{data.total}</span> results
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
