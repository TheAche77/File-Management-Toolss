import type { BusinessResearchAggregate } from "./businessResearchAggregateService";

function includesAny(value: string, terms: string[]) {
  const haystack = value.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

export type SlgClassification = {
  engineType: "revenue" | "institutional" | "authority";
  targetType: "buyer" | "funder" | "host" | "referrer" | "prestige" | "hybrid";
  targetCluster:
    | "commercial_collectors_ecosystem"
    | "boutique_hotel_hospitality"
    | "public_cultural_institutions"
    | "festivals_placemaking"
    | "corporate_commission_buyers"
    | "schools_academies"
    | "museum_shop_cultural_retail"
    | "foundations_csr_philanthropy"
    | "international_urban_art_nodes"
    | "residency_exchange_diplomacy";
};

export function classifyBusinessForSlg(
  aggregate: BusinessResearchAggregate,
): SlgClassification {
  const category = aggregate.business.categorySlug;
  const name = aggregate.business.name.toLowerCase();
  const website = (aggregate.business.website ?? "").toLowerCase();
  const combined = `${name} ${website}`;

  if (
    includesAny(combined, ["foundation", "fondazione", "csr", "philanth", "donor"]) ||
    category === "foundation"
  ) {
    return {
      engineType: "institutional",
      targetType: "funder",
      targetCluster: "foundations_csr_philanthropy",
    };
  }

  if (
    includesAny(combined, ["residency", "residenza", "exchange", "institute", "embassy", "cultural institute"]) ||
    category === "cultural_institute"
  ) {
    return {
      engineType: "institutional",
      targetType: "host",
      targetCluster: "residency_exchange_diplomacy",
    };
  }

  if (
    includesAny(combined, ["school", "academy", "univers", "college", "edu"]) ||
    category === "school"
  ) {
    return {
      engineType: "institutional",
      targetType: "host",
      targetCluster: "schools_academies",
    };
  }

  if (
    includesAny(combined, ["festival", "biennale", "placemaking", "public art"]) ||
    category === "festival"
  ) {
    return {
      engineType: "authority",
      targetType: "prestige",
      targetCluster: "festivals_placemaking",
    };
  }

  if (
    includesAny(combined, ["museum shop", "bookshop", "bookstore", "retail", "design store"]) ||
    category === "bookshop" ||
    category === "bookstore"
  ) {
    return {
      engineType: "authority",
      targetType: "buyer",
      targetCluster: "museum_shop_cultural_retail",
    };
  }

  if (
    includesAny(combined, ["hotel", "resort", "hospitality", "suite", "boutique"]) ||
    category === "boutique_hotel" ||
    category === "design_boutique_hotel" ||
    category === "hotel"
  ) {
    return {
      engineType: "revenue",
      targetType: "buyer",
      targetCluster: "boutique_hotel_hospitality",
    };
  }

  if (
    includesAny(combined, ["brand", "agency", "real estate", "development", "corporate", "company", "studio"]) ||
    category === "corporate"
  ) {
    return {
      engineType: "revenue",
      targetType: "buyer",
      targetCluster: "corporate_commission_buyers",
    };
  }

  if (
    includesAny(combined, ["museum", "comune", "municip", "foundation", "cultural center", "arts centre"]) ||
    category === "art_museum" ||
    category === "cultural_institute"
  ) {
    return {
      engineType: "institutional",
      targetType: "host",
      targetCluster: "public_cultural_institutions",
    };
  }

  if (
    includesAny(combined, ["gallery", "urban art", "art fair", "street art", "contemporary"]) ||
    category === "art_gallery" ||
    category === "urban_art_gallery"
  ) {
    return {
      engineType: aggregate.business.targetMarket && aggregate.business.targetMarket !== "IT" ? "authority" : "revenue",
      targetType: aggregate.business.targetMarket && aggregate.business.targetMarket !== "IT" ? "prestige" : "buyer",
      targetCluster: aggregate.business.targetMarket && aggregate.business.targetMarket !== "IT"
        ? "international_urban_art_nodes"
        : "commercial_collectors_ecosystem",
    };
  }

  return {
    engineType: "authority",
    targetType: "hybrid",
    targetCluster: "international_urban_art_nodes",
  };
}
