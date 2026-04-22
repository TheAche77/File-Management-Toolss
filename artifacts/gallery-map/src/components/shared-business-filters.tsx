import type { Category } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TARGET_MARKET_OPTIONS = ["IT", "UK", "NL", "FR", "ES", "PT", "RO"] as const;

type SharedBusinessFiltersProps = {
  categories?: Category[];
  city: string;
  categorySlug: string;
  targetMarket: string;
  onCityChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onTargetMarketChange: (value: string) => void;
};

export function SharedBusinessFilters({
  categories,
  city,
  categorySlug,
  targetMarket,
  onCityChange,
  onCategoryChange,
  onTargetMarketChange,
}: SharedBusinessFiltersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
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
    </div>
  );
}
