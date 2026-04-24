import type { Category } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TARGET_MARKET_OPTIONS = ["IT", "UK", "NL", "FR", "ES", "PT", "RO"] as const;
const ENGINE_TYPE_OPTIONS = ["revenue", "institutional", "authority"] as const;
const TARGET_CLUSTER_OPTIONS = [
  "commercial_collectors_ecosystem",
  "boutique_hotel_hospitality",
  "public_cultural_institutions",
  "festivals_placemaking",
  "corporate_commission_buyers",
  "schools_academies",
  "museum_shop_cultural_retail",
  "foundations_csr_philanthropy",
  "international_urban_art_nodes",
  "residency_exchange_diplomacy",
] as const;

type SharedBusinessFiltersProps = {
  categories?: Category[];
  city: string;
  categorySlug: string;
  targetMarket: string;
  engineType?: string;
  targetCluster?: string;
  onCityChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onTargetMarketChange: (value: string) => void;
  onEngineTypeChange?: (value: string) => void;
  onTargetClusterChange?: (value: string) => void;
};

export function SharedBusinessFilters({
  categories,
  city,
  categorySlug,
  targetMarket,
  engineType = "all",
  targetCluster = "all",
  onCityChange,
  onCategoryChange,
  onTargetMarketChange,
  onEngineTypeChange,
  onTargetClusterChange,
}: SharedBusinessFiltersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
      <div className="space-y-2">
        <Label htmlFor="shared-city-filter">City</Label>
        <Input
          id="shared-city-filter"
          placeholder="Rome, Paris, London..."
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shared-category-filter">Category</Label>
        <Select value={categorySlug} onValueChange={onCategoryChange}>
          <SelectTrigger id="shared-category-filter">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={category.slug}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shared-market-filter">Target Market</Label>
        <Select value={targetMarket} onValueChange={onTargetMarketChange}>
          <SelectTrigger id="shared-market-filter">
            <SelectValue placeholder="All markets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All markets</SelectItem>
            {TARGET_MARKET_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {onEngineTypeChange && (
        <div className="space-y-2">
          <Label htmlFor="shared-engine-filter">Engine</Label>
          <Select value={engineType} onValueChange={onEngineTypeChange}>
            <SelectTrigger id="shared-engine-filter">
              <SelectValue placeholder="All engines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All engines</SelectItem>
              {ENGINE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {onTargetClusterChange && (
        <div className="space-y-2">
          <Label htmlFor="shared-cluster-filter">SLG Cluster</Label>
          <Select value={targetCluster} onValueChange={onTargetClusterChange}>
            <SelectTrigger id="shared-cluster-filter">
              <SelectValue placeholder="All clusters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clusters</SelectItem>
              {TARGET_CLUSTER_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
