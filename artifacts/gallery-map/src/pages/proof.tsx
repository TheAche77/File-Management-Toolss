import {
  getGetCaseStudiesQueryKey,
  getGetContentAssetsQueryKey,
  getGetCredibilityAssetsQueryKey,
  useGetCaseStudies,
  useGetContentAssets,
  useGetCredibilityAssets,
  type CaseStudy,
  type ContentAsset,
  type CredibilityAsset,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStoredAdminToken } from "@/lib/admin-auth";

export default function ProofPage() {
  const hasAdminToken = Boolean(getStoredAdminToken());
  const { data: assets = [] } = useGetCredibilityAssets({
    query: { queryKey: getGetCredibilityAssetsQueryKey(), enabled: hasAdminToken },
  });
  const { data: caseStudies = [] } = useGetCaseStudies({
    query: { queryKey: getGetCaseStudiesQueryKey(), enabled: hasAdminToken },
  });
  const { data: contentAssets = [] } = useGetContentAssets({
    query: { queryKey: getGetContentAssetsQueryKey(), enabled: hasAdminToken },
  });

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
