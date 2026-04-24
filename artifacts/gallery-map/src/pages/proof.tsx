import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStoredAdminToken } from "@/lib/admin-auth";

type CredibilityAsset = {
  id: number;
  name: string;
  assetType: string;
  summary?: string | null;
  targetClusters?: string | null;
  tags?: string | null;
};

type CaseStudy = {
  id: number;
  title: string;
  summary?: string | null;
  targetCluster?: string | null;
  engineType?: string | null;
  artist?: string | null;
};

type ContentAsset = {
  id: number;
  assetType: string;
  engineType?: string | null;
  targetCluster?: string | null;
  title: string;
  body: string;
};

function apiHeaders() {
  const token = getStoredAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export default function ProofPage() {
  const [assets, setAssets] = useState<CredibilityAsset[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [contentAssets, setContentAssets] = useState<ContentAsset[]>([]);
  const hasAdminToken = Boolean(getStoredAdminToken());

  useEffect(() => {
    if (!hasAdminToken) return;
    void Promise.all([
      fetch("/api/credibility-assets", { headers: apiHeaders() }).then((response) => response.json()),
      fetch("/api/case-studies", { headers: apiHeaders() }).then((response) => response.json()),
      fetch("/api/content-assets", { headers: apiHeaders() }).then((response) => response.json()),
    ]).then(([assetsData, caseStudiesData, contentAssetsData]) => {
      setAssets(assetsData as CredibilityAsset[]);
      setCaseStudies(caseStudiesData as CaseStudy[]);
      setContentAssets(contentAssetsData as ContentAsset[]);
    });
  }, [hasAdminToken]);

  if (!hasAdminToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proof Library</CardTitle>
          <CardDescription>Admin unlock required.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-serif">Proof Library</h1>
        <p className="text-muted-foreground mt-2">Credibility assets e case study riusabili nei pitch SLG.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {assets.map((asset) => (
          <Card key={`asset-${asset.id}`}>
            <CardHeader>
              <CardTitle>{asset.name}</CardTitle>
              <CardDescription>{asset.summary ?? asset.assetType}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{asset.assetType}</Badge>
                {asset.targetClusters && <Badge variant="outline">{asset.targetClusters}</Badge>}
              </div>
              {asset.tags && <div>Tags: {asset.tags}</div>}
            </CardContent>
          </Card>
        ))}
        {caseStudies.map((caseStudy) => (
          <Card key={`case-study-${caseStudy.id}`}>
            <CardHeader>
              <CardTitle>{caseStudy.title}</CardTitle>
              <CardDescription>{caseStudy.summary ?? caseStudy.targetCluster ?? "Case study"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {caseStudy.engineType && <Badge variant="outline">{caseStudy.engineType}</Badge>}
                {caseStudy.targetCluster && <Badge variant="outline">{caseStudy.targetCluster}</Badge>}
                {caseStudy.artist && <Badge variant="outline">{caseStudy.artist}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
        {contentAssets.map((asset) => (
          <Card key={`content-asset-${asset.id}`}>
            <CardHeader>
              <CardTitle>{asset.title}</CardTitle>
              <CardDescription>{asset.assetType}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{asset.assetType}</Badge>
                {asset.engineType && <Badge variant="outline">{asset.engineType}</Badge>}
                {asset.targetCluster && <Badge variant="outline">{asset.targetCluster}</Badge>}
              </div>
              <p className="line-clamp-5 whitespace-pre-wrap text-muted-foreground">{asset.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
