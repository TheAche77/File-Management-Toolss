import { getBusinesses, getGetBusinessesQueryKey, useGetBusinesses } from "@workspace/api-client-react";
import { Link } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { ExternalLink, Globe, Phone, MapPin } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const TARGET_MARKETS = ["IT", "UK", "NL", "FR", "ES", "PT", "RO"] as const;

const MAP_PAGE_SIZE = 100;
type MapBusiness = Awaited<ReturnType<typeof getBusinesses>>["businesses"][number];
type MapCluster = {
  key: string;
  latitude: number;
  longitude: number;
  businesses: MapBusiness[];
};

function getClusterStep(zoom: number) {
  if (zoom <= 6) return 0.5;
  if (zoom <= 8) return 0.18;
  if (zoom <= 10) return 0.08;
  if (zoom <= 12) return 0.035;
  if (zoom <= 14) return 0.015;
  return 0.006;
}

function getClusterIcon(count: number) {
  const size = count >= 10 ? 42 : 36;

  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:#1f2937;color:#fff;border:3px solid #f9fafb;font-weight:700;font-size:12px;box-shadow:0 8px 20px rgba(0,0,0,0.18);">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function buildClusters(businesses: MapBusiness[], zoom: number) {
  const step = getClusterStep(zoom);
  const buckets = new Map<string, MapBusiness[]>();

  for (const business of businesses) {
    const lat = Number.parseFloat(business.latitude);
    const lng = Number.parseFloat(business.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

    const latBucket = Math.round(lat / step);
    const lngBucket = Math.round(lng / step);
    const key = `${latBucket}:${lngBucket}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.push(business);
    } else {
      buckets.set(key, [business]);
    }
  }

  return Array.from(buckets.entries()).map(([key, clusterBusinesses]): MapCluster => {
    const positions = clusterBusinesses.map((business) => ({
      latitude: Number.parseFloat(business.latitude),
      longitude: Number.parseFloat(business.longitude),
    }));

    return {
      key,
      latitude:
        positions.reduce((sum, position) => sum + position.latitude, 0) / positions.length,
      longitude:
        positions.reduce((sum, position) => sum + position.longitude, 0) / positions.length,
      businesses: clusterBusinesses,
    };
  });
}

function TargetMarketBadge({ market }: { market: string | null | undefined }) {
  if (!market) return null;
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 ml-1">
      {market}
    </span>
  );
}

function SingleBusinessMarker({ business }: { business: MapBusiness }) {
  const lat = Number.parseFloat(business.latitude);
  const lng = Number.parseFloat(business.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return (
    <Marker position={[lat, lng]} icon={customIcon}>
      <Popup className="font-sans">
        <div className="p-1">
          <h3 className="font-serif font-semibold text-base m-0 mb-1">{business.name}</h3>
          <div className="text-xs text-muted-foreground mb-2 flex items-start gap-1">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              {business.addressLine || "No address"}
              {business.city ? `, ${business.city}` : ""}
            </span>
            <TargetMarketBadge market={business.targetMarket} />
          </div>
          <div className="space-y-1 pt-2 border-t border-border/50">
            <Link
              href={`/businesses/${business.id}`}
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "h-auto px-0 text-xs text-primary justify-start",
              })}
            >
              Open details
            </Link>
            {business.website && (
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Globe className="w-3 h-3" /> Visit Website <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {business.phone && (
              <div className="flex items-center gap-1.5 text-xs">
                <Phone className="w-3 h-3 text-muted-foreground" /> {business.phone}
              </div>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function ClusteredMarkers({ businesses }: { businesses: MapBusiness[] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    },
  });

  const clusters = useMemo(() => buildClusters(businesses, zoom), [businesses, zoom]);

  return (
    <>
      {clusters.map((cluster) =>
        cluster.businesses.length === 1 ? (
          <SingleBusinessMarker
            key={cluster.businesses[0]!.id}
            business={cluster.businesses[0]!}
          />
        ) : (
          <Marker
            key={cluster.key}
            position={[cluster.latitude, cluster.longitude]}
            icon={getClusterIcon(cluster.businesses.length)}
          >
            <Popup className="font-sans">
              <div className="space-y-2 p-1">
                <div>
                  <h3 className="font-serif font-semibold text-base">
                    {cluster.businesses.length} businesses in this area
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Zoom in to split this cluster into individual locations.
                  </p>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {cluster.businesses.slice(0, 8).map((business) => (
                    <div key={business.id} className="border-t pt-2 first:border-t-0 first:pt-0">
                      <Link
                        href={`/businesses/${business.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {business.name}
                      </Link>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {business.city || "No location metadata"}
                        <TargetMarketBadge market={business.targetMarket} />
                      </p>
                    </div>
                  ))}
                  {cluster.businesses.length > 8 && (
                    <p className="text-xs text-muted-foreground">
                      +{cluster.businesses.length - 8} more businesses in this cluster
                    </p>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ),
      )}
    </>
  );
}

export default function MapView() {
  const [targetMarket, setTargetMarket] = useState<string | undefined>(undefined);

  const filterParams = useMemo(
    () => (targetMarket ? { targetMarket } : {}),
    [targetMarket],
  );

  const firstPageQuery = useGetBusinesses({ page: 1, pageSize: MAP_PAGE_SIZE, ...filterParams });
  const totalPages = firstPageQuery.data?.totalPages ?? 1;

  const remainingPageQueries = useQueries({
    queries: Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => {
      const page = index + 2;
      const params = { page, pageSize: MAP_PAGE_SIZE, ...filterParams };

      return {
        queryKey: getGetBusinessesQueryKey(params),
        queryFn: () => getBusinesses(params),
        enabled: Boolean(firstPageQuery.data) && totalPages > 1,
        staleTime: 60_000,
      };
    }),
  });

  const businesses = useMemo(() => {
    const seen = new Set<number>();
    const merged: MapBusiness[] = [];

    for (const business of firstPageQuery.data?.businesses ?? []) {
      if (seen.has(business.id)) continue;
      seen.add(business.id);
      merged.push(business);
    }

    for (const query of remainingPageQueries) {
      for (const business of query.data?.businesses ?? []) {
        if (seen.has(business.id)) continue;
        seen.add(business.id);
        merged.push(business);
      }
    }

    return merged;
  }, [firstPageQuery.data?.businesses, remainingPageQueries]);

  const isLoading =
    firstPageQuery.isLoading ||
    remainingPageQueries.some((query) => query.isLoading);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-4xl font-serif text-foreground">Map View</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Geographic distribution of indexed businesses across the current dataset.
        </p>
        {firstPageQuery.data && (
          <p className="text-sm text-muted-foreground mt-1">
            Loaded {businesses.length} of {firstPageQuery.data.total} businesses across {totalPages} page{totalPages === 1 ? "" : "s"}.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap">
          Target market
        </label>
        <Select
          value={targetMarket ?? "all"}
          onValueChange={(value) => setTargetMarket(value === "all" ? undefined : value)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All markets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All markets</SelectItem>
            {TARGET_MARKETS.map((market) => (
              <SelectItem key={market} value={market}>
                {market}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 border border-border relative z-0 bg-card overflow-hidden">
        {isLoading ? (
          <Skeleton className="w-full h-full" />
        ) : (
          <MapContainer
            center={[41.9028, 12.4964]}
            zoom={12}
            className="w-full h-full"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <ClusteredMarkers businesses={businesses} />
          </MapContainer>
        )}
      </div>
    </div>
  );
}
