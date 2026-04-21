import { useGetBusinesses } from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { ExternalLink, Globe, Phone, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function MapView() {
  const { data, isLoading } = useGetBusinesses({ pageSize: 500 });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-4xl font-serif text-foreground">Map View</h1>
        <p className="text-muted-foreground mt-2 text-lg">Geographic distribution of businesses across Italy.</p>
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
            {data?.businesses.map(biz => {
              if (!biz.latitude || !biz.longitude) return null;
              const lat = parseFloat(biz.latitude);
              const lng = parseFloat(biz.longitude);
              if (isNaN(lat) || isNaN(lng)) return null;

              return (
                <Marker key={biz.id} position={[lat, lng]} icon={customIcon}>
                  <Popup className="font-sans">
                    <div className="p-1">
                      <h3 className="font-serif font-semibold text-base m-0 mb-1">{biz.name}</h3>
                      <div className="text-xs text-muted-foreground mb-2 flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{biz.addressLine || 'No address'}{biz.city ? `, ${biz.city}` : ''}</span>
                      </div>
                      <div className="space-y-1 pt-2 border-t border-border/50">
                        {biz.website && (
                          <a href={biz.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <Globe className="w-3 h-3" /> Visit Website <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {biz.phone && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone className="w-3 h-3 text-muted-foreground" /> {biz.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
