export type ArtistRecommendation = {
  suggestedArtist: "Ache77" | "Exit Enter" | "Nian" | "Kraita317";
  confidence: "high" | "medium" | "low";
  reason: string;
  score: number;
};

export type AvatarRecommendation = {
  avatarType:
    | "gallery_director"
    | "hotel_art_curator"
    | "festival"
    | "museum_shop"
    | "institution";
  reason: string;
};

type RecommendationInput = {
  avatarType?: string | null;
  targetMarket?: string | null;
  categorySlug?: string | null;
};

const ARTIST_PRIORITY: ArtistRecommendation["suggestedArtist"][] = [
  "Exit Enter",
  "Ache77",
  "Kraita317",
  "Nian",
];

const CATEGORY_TAGS = {
  gallery: new Set(["art_gallery", "urban_art_gallery"]),
  hotel: new Set(["hotel", "design_boutique_hotel"]),
  museum: new Set(["museum", "art_museum", "arts_centre"]),
  institution: new Set(["cultural_institute"]),
};

export function getAvatarTypeRecommendation(
  categorySlug?: string | null,
): AvatarRecommendation | null {
  if (!categorySlug) {
    return null;
  }

  if (hasCategoryTag(categorySlug, CATEGORY_TAGS.hotel)) {
    return {
      avatarType: "hotel_art_curator",
      reason: "category suggests boutique hotel or hospitality outreach",
    };
  }

  if (categorySlug === "urban_art_gallery") {
    return {
      avatarType: "gallery_director",
      reason: "category maps directly to urban art gallery outreach",
    };
  }

  if (categorySlug === "art_museum") {
    return {
      avatarType: "museum_shop",
      reason: "category suggests museum or arts-centre buyer outreach",
    };
  }

  if (hasCategoryTag(categorySlug, CATEGORY_TAGS.institution)) {
    return {
      avatarType: "institution",
      reason: "category maps to cultural institute or institutional outreach",
    };
  }

  if (hasCategoryTag(categorySlug, CATEGORY_TAGS.gallery)) {
    return {
      avatarType: "gallery_director",
      reason: "category aligns with gallery outreach by default",
    };
  }

  if (hasCategoryTag(categorySlug, CATEGORY_TAGS.museum)) {
    return {
      avatarType: "museum_shop",
      reason: "category aligns with museum or arts-centre outreach",
    };
  }

  return null;
}

function hasCategoryTag(categorySlug: string | null | undefined, values: Set<string>) {
  return Boolean(categorySlug && values.has(categorySlug));
}

function buildConfidence(score: number, hasMarketMatch: boolean, hasAvatarMatch: boolean) {
  if (score >= 7 && hasMarketMatch && hasAvatarMatch) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export function getArtistRecommendation(
  input: RecommendationInput,
): ArtistRecommendation | null {
  const avatarType = input.avatarType ?? null;
  const targetMarket = input.targetMarket ?? null;
  const categorySlug = input.categorySlug ?? null;

  if (!avatarType && !targetMarket && !categorySlug) {
    return null;
  }

  const candidateScores = ARTIST_PRIORITY.map((artist) => {
    let score = 0;
    const reasons: string[] = [];
    let hasMarketMatch = false;
    let hasAvatarMatch = false;

    if (artist === "Ache77") {
      if (targetMarket && ["IT", "RO", "UK", "NL"].includes(targetMarket)) {
        score += 3;
        hasMarketMatch = true;
        reasons.push(`strong market fit for ${targetMarket}`);
      }
      if (avatarType && ["gallery_director", "festival", "institution"].includes(avatarType)) {
        score += 3;
        hasAvatarMatch = true;
        reasons.push("strong fit for galleries, festivals, and institutions");
      }
      if (categorySlug && (hasCategoryTag(categorySlug, CATEGORY_TAGS.gallery) || hasCategoryTag(categorySlug, CATEGORY_TAGS.institution))) {
        score += 1;
        reasons.push("category aligns with commercial gallery or institutional outreach");
      }
      if (targetMarket && ["IT", "RO"].includes(targetMarket) && avatarType && ["festival", "institution"].includes(avatarType)) {
        score += 2;
        reasons.push("extra fit for institutional and festival work in the selected market");
      }
    }

    if (artist === "Exit Enter") {
      if (targetMarket && ["NL", "UK"].includes(targetMarket)) {
        score += 3;
        hasMarketMatch = true;
        reasons.push(`strong market fit for ${targetMarket}`);
      }
      if (avatarType && ["gallery_director", "museum_shop", "hotel_art_curator"].includes(avatarType)) {
        score += 4;
        hasAvatarMatch = true;
        reasons.push("strong fit for urban galleries, museum shop, and hotel design targets");
      }
      if (categorySlug && (
        hasCategoryTag(categorySlug, CATEGORY_TAGS.gallery) ||
        hasCategoryTag(categorySlug, CATEGORY_TAGS.hotel) ||
        hasCategoryTag(categorySlug, CATEGORY_TAGS.museum)
      )) {
        score += 1;
        reasons.push("category matches gallery, hotel, or museum-led positioning");
      }
      if (targetMarket && ["UK", "NL"].includes(targetMarket) && avatarType === "gallery_director") {
        score += 2;
        reasons.push("preferred gallery recommendation for UK/NL");
      }
    }

    if (artist === "Nian") {
      if (targetMarket === "FR") {
        score += 3;
        hasMarketMatch = true;
        reasons.push("strong market fit for France");
      }
      if (avatarType && ["festival", "gallery_director", "institution"].includes(avatarType)) {
        score += 2;
        hasAvatarMatch = true;
        reasons.push("good fit for alternative galleries, festivals, and non-profit style outreach");
      }
      if (categorySlug && (hasCategoryTag(categorySlug, CATEGORY_TAGS.gallery) || hasCategoryTag(categorySlug, CATEGORY_TAGS.institution))) {
        score += 1;
        reasons.push("category aligns with cultural or alternative programming");
      }
      if (targetMarket === "FR" && avatarType === "festival") {
        score += 2;
        reasons.push("preferred festival recommendation for France");
      }
    }

    if (artist === "Kraita317") {
      if (targetMarket && ["IT", "ES", "PT"].includes(targetMarket)) {
        score += 3;
        hasMarketMatch = true;
        reasons.push(`strong market fit for ${targetMarket}`);
      }
      if (avatarType && ["hotel_art_curator", "gallery_director"].includes(avatarType)) {
        score += 3;
        hasAvatarMatch = true;
        reasons.push("strong fit for boutique hotels and contemporary galleries");
      }
      if (categorySlug && (hasCategoryTag(categorySlug, CATEGORY_TAGS.hotel) || hasCategoryTag(categorySlug, CATEGORY_TAGS.gallery))) {
        score += 1;
        reasons.push("category aligns with hotel or contemporary gallery outreach");
      }
      if (targetMarket && ["ES", "PT"].includes(targetMarket) && avatarType === "hotel_art_curator") {
        score += 2;
        reasons.push("preferred hotel recommendation for Iberian markets");
      }
    }

    return {
      suggestedArtist: artist,
      score,
      confidence: buildConfidence(score, hasMarketMatch, hasAvatarMatch),
      reason: reasons.join("; "),
    };
  });

  const winner = candidateScores.sort((left, right) => right.score - left.score)[0];
  if (!winner || winner.score <= 0) {
    return null;
  }

  return winner;
}
