import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TARGET_MARKET_OPTIONS } from "@/lib/business-filters";

type CategoryOption = {
  id: number;
  slug: string;
  label: string;
};

type SharedBusinessFiltersProps = {
  categories?: CategoryOption[];
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Input
        placeholder="Filter by city..."
        value={city}
        onChange={(event) => onCityChange(event.target.value)}
      />

      <Select value={categorySlug} onValueChange={onCategoryChange}>
        <SelectTrigger>
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

      <Select value={targetMarket} onValueChange={onTargetMarketChange}>
        <SelectTrigger>
          <SelectValue placeholder="All markets" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All markets</SelectItem>
          {TARGET_MARKET_OPTIONS.map((market) => (
            <SelectItem key={market} value={market}>
              {market}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
