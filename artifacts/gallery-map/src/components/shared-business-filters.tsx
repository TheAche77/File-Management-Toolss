import type { Category } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TARGET_MARKET_OPTIONS = ["IT", "UK", "NL", "FR", "ES", "PT", "RO"] as const;

type Props = {
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
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Filtra per città..."
        value={city}
        onChange={(e) => onCityChange(e.target.value)}
        className="w-40"
      />

      <Select value={categorySlug} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Tutte le categorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte le categorie</SelectItem>
          {categories?.map((cat) => (
            <SelectItem key={cat.slug} value={cat.slug}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={targetMarket} onValueChange={onTargetMarketChange}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Target market" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti i mercati</SelectItem>
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
