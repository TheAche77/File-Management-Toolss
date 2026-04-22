import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useGetBusinesses, getGetBusinessesQueryKey, useGetCategories, getGetCategoriesQueryKey } from "@workspace/api-client-react";
import { MapPin, Globe, Phone, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SharedBusinessFilters } from "@/components/shared-business-filters";
import {
  buildSearchParams,
  readBooleanSearchParam,
  readNumberSearchParam,
  readSearchParam,
  readSharedBusinessFilters,
  syncSearchParams,
} from "@/lib/business-filters";

export default function Businesses() {
  const initialFilters = readSharedBusinessFilters(window.location.search);
  const [search, setSearch] = useState(() => readSearchParam(window.location.search, "search"));
  const [city, setCity] = useState(initialFilters.city);
  const [category, setCategory] = useState(initialFilters.categorySlug);
  const [targetMarket, setTargetMarket] = useState(initialFilters.targetMarket);
  const [hasWebsite, setHasWebsite] = useState(() =>
    readBooleanSearchParam(window.location.search, "hasWebsite"),
  );
  const [hasPhone, setHasPhone] = useState(() =>
    readBooleanSearchParam(window.location.search, "hasPhone"),
  );
  const [page, setPage] = useState(() =>
    readNumberSearchParam(window.location.search, "page", 1),
  );
  const pageSize = 20;

  const { data: categories } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() }
  });

  const queryParams = {
    search: search || undefined,
    city: city || undefined,
    categorySlug: category === "all" ? undefined : category,
    targetMarket: targetMarket === "all" ? undefined : targetMarket,
    hasWebsite: hasWebsite || undefined,
    hasPhone: hasPhone || undefined,
    page,
    pageSize
  };

  const { data, isLoading } = useGetBusinesses(queryParams, {
    query: { queryKey: getGetBusinessesQueryKey(queryParams) }
  });

  useEffect(() => {
    const nextSearch = buildSearchParams(window.location.search, {
      search,
      city,
      categorySlug: category,
      targetMarket,
      hasWebsite,
      hasPhone,
      page,
      horizonDays: undefined,
      limit: undefined,
    });

    syncSearchParams(nextSearch);
  }, [category, city, hasPhone, hasWebsite, page, search, targetMarket]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Directory</h1>
        <p className="text-muted-foreground mt-1">Browse and filter indexed businesses</p>
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Input 
              placeholder="Search names..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              data-testid="input-search"
            />
          </div>
          <div className="md:col-span-2">
            <SharedBusinessFilters
              categories={categories}
              city={city}
              categorySlug={category}
              targetMarket={targetMarket}
              onCityChange={(value) => { setCity(value); setPage(1); }}
              onCategoryChange={(value) => { setCategory(value); setPage(1); }}
              onTargetMarketChange={(value) => { setTargetMarket(value); setPage(1); }}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="has-website" 
              checked={hasWebsite}
              onCheckedChange={(checked) => { setHasWebsite(checked as boolean); setPage(1); }}
            />
            <label htmlFor="has-website" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Has Website
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="has-phone" 
              checked={hasPhone}
              onCheckedChange={(checked) => { setHasPhone(checked as boolean); setPage(1); }}
            />
            <label htmlFor="has-phone" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Has Phone
            </label>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table data-testid="table-businesses">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.businesses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No businesses found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                data?.businesses.map((business) => (
                    <TableRow key={business.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/businesses/${business.id}`} className="hover:text-primary transition-colors">
                            {business.name}
                          </Link>
                          {business.enrichmentStatus === 'enriched' && (
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary">Enriched</Badge>
                          )}
                        </div>
                      </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {business.categorySlug.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="mr-1 h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {business.addressLine || business.city || 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {business.website ? (
                          <a href={business.website} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-primary transition-colors">
                            <Globe className="mr-1 h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[150px]">Website</span>
                          </a>
                        ) : (
                          <span className="flex items-center opacity-50">
                            <Globe className="mr-1 h-3 w-3 shrink-0" />
                            No website
                          </span>
                        )}
                        {business.phone && (
                          <span className="flex items-center">
                            <Phone className="mr-1 h-3 w-3 shrink-0" />
                            {business.phone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/businesses/${business.id}`}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          Details
                        </Link>
                        {business.googleMapsUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={business.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                              <span className="sr-only">View on Google Maps</span>
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {data && data.totalPages > 1 && (
          <div className="border-t p-4 flex items-center justify-between bg-muted/20">
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => p + 1)}
                disabled={page >= data.totalPages || isLoading}
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
