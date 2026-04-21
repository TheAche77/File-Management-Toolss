import { useParams, Link } from "wouter";
import { useGetGalleryById, getGetGalleryByIdQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Phone, MapPin, Building2, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function GalleryDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: gallery, isLoading, error } = useGetGalleryById(id, {
    query: { queryKey: getGetGalleryByIdQueryKey(id), enabled: !!id }
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !gallery) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h2 className="text-2xl font-serif text-destructive">Gallery not found</h2>
        <p className="text-muted-foreground mt-2">The gallery you're looking for doesn't exist or there was an error.</p>
        <Link href="/galleries">
          <Button className="mt-6" variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/galleries" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif text-foreground font-semibold leading-tight">{gallery.name}</h1>
          <div className="flex items-center gap-2 mt-4 text-muted-foreground">
            <MapPin className="w-5 h-5" />
            <span className="text-lg">{gallery.addressLine || 'Address unknown'}, {gallery.city}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Badge variant="outline" className="uppercase tracking-widest text-[10px] rounded-none px-3 py-1 font-normal bg-card">
            {gallery.sourcePrimary}
          </Badge>
          <Badge 
            variant="secondary" 
            className={`uppercase tracking-widest text-[10px] rounded-none px-3 py-1 font-normal ${
              gallery.enrichmentStatus === 'enriched' ? 'bg-primary/10 text-primary border-primary/20' : ''
            }`}
          >
            {gallery.enrichmentStatus.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="bg-card border border-border p-6 md:p-8">
            <h2 className="text-2xl font-serif mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" /> Contact & Details
            </h2>
            
            <dl className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-4 py-3 border-b border-border/50">
                <dt className="text-muted-foreground">Website</dt>
                <dd className="col-span-2 font-medium">
                  {gallery.website ? (
                    <a href={gallery.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1.5">
                      <Globe className="w-4 h-4" /> {new URL(gallery.website).hostname.replace('www.', '')}
                    </a>
                  ) : (
                    <span className="text-muted-foreground/60 italic">Not available</span>
                  )}
                </dd>
              </div>
              
              <div className="grid grid-cols-3 gap-4 py-3 border-b border-border/50">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="col-span-2 font-medium">
                  {gallery.phone ? (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-muted-foreground" /> {gallery.phone}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60 italic">Not available</span>
                  )}
                </dd>
              </div>

              <div className="grid grid-cols-3 gap-4 py-3 border-b border-border/50">
                <dt className="text-muted-foreground">Address</dt>
                <dd className="col-span-2 font-medium">
                  {gallery.addressLine && <div>{gallery.addressLine}</div>}
                  {gallery.postalCode && <div>{gallery.postalCode}</div>}
                  <div>{gallery.city}{gallery.region ? `, ${gallery.region}` : ''}</div>
                  {gallery.country && <div>{gallery.country}</div>}
                  {!gallery.addressLine && !gallery.city && <span className="text-muted-foreground/60 italic">Unknown</span>}
                </dd>
              </div>
              
              {gallery.rating && (
                <div className="grid grid-cols-3 gap-4 py-3 border-b border-border/50">
                  <dt className="text-muted-foreground">Rating</dt>
                  <dd className="col-span-2 font-medium flex items-center gap-2">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-sm">{gallery.rating} / 5</span>
                    {gallery.userRatingsTotal && <span className="text-muted-foreground font-normal">({gallery.userRatingsTotal} reviews)</span>}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-muted/30 border border-border p-5">
            <h3 className="font-serif text-lg mb-4">System Record</h3>
            <ul className="space-y-3 text-xs text-muted-foreground">
              <li className="flex justify-between">
                <span>Added:</span>
                <span className="font-medium text-foreground">{format(new Date(gallery.createdAt), 'MMM d, yyyy')}</span>
              </li>
              <li className="flex justify-between">
                <span>Last Updated:</span>
                <span className="font-medium text-foreground">{format(new Date(gallery.updatedAt), 'MMM d, yyyy')}</span>
              </li>
              {gallery.lastCheckedAt && (
                <li className="flex justify-between">
                  <span>Last Verified:</span>
                  <span className="font-medium text-foreground">{format(new Date(gallery.lastCheckedAt), 'MMM d, yyyy')}</span>
                </li>
              )}
              {gallery.osmId && (
                <li className="flex justify-between pt-2 border-t border-border/50 mt-2">
                  <span>OSM ID:</span>
                  <span className="font-mono">{gallery.osmType?.charAt(0)}{gallery.osmId}</span>
                </li>
              )}
            </ul>
          </div>
          
          {gallery.googleMapsUrl && (
            <a 
              href={gallery.googleMapsUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button variant="outline" className="w-full justify-start h-auto py-3">
                <MapPin className="w-4 h-4 mr-2 text-primary" /> 
                <div className="text-left">
                  <div className="font-medium">Open in Google Maps</div>
                  <div className="text-xs text-muted-foreground font-normal">Get directions & reviews</div>
                </div>
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
