import { db, businessesTable, researchJobsTable } from "@workspace/db";
import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { getResearchFeedbackSummary } from "./researchFeedbackService";

export interface ResearchMetricsFilters {
  categorySlug?: string;
  city?: string;
  targetMarket?: string;
  engineType?: string;
  targetCluster?: string;
}

function buildFilters(filters: ResearchMetricsFilters) {
  const conditions = [];
  if (filters.categorySlug) conditions.push(eq(businessesTable.categorySlug, filters.categorySlug));
  if (filters.city) conditions.push(ilike(businessesTable.city, `%${filters.city}%`));
  if (filters.targetMarket) conditions.push(eq(businessesTable.targetMarket, filters.targetMarket));
  if (filters.engineType) conditions.push(eq(businessesTable.engineType, filters.engineType));
  if (filters.targetCluster) conditions.push(eq(businessesTable.targetCluster, filters.targetCluster));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function getResearchMetrics(filters: ResearchMetricsFilters = {}) {
  const where = buildFilters(filters);
  const [totals, topNextSteps, jobs, feedback] = await Promise.all([
    db
      .select({
        total: count(),
        qualified: sql<number>`count(*) filter (where ${businessesTable.qualificationStatus} = 'qualified')`,
        contactable: sql<number>`count(*) filter (where ${businessesTable.contactabilityStatus} in ('contactable', 'verified'))`,
        ready: sql<number>`count(*) filter (where ${businessesTable.readyForOutreach} = true)`,
        review: sql<number>`count(*) filter (where ${businessesTable.reviewRequired} = true)`,
        stale: sql<number>`count(*) filter (where ${businessesTable.priorityScore} >= 70 and ${businessesTable.nextResearchAt} <= now())`,
        revenue: sql<number>`count(*) filter (where ${businessesTable.engineType} = 'revenue')`,
        institutional: sql<number>`count(*) filter (where ${businessesTable.engineType} = 'institutional')`,
        authority: sql<number>`count(*) filter (where ${businessesTable.engineType} = 'authority')`,
        warmPaths: sql<number>`count(*) filter (where ${businessesTable.warmPathExists} = true)`,
        prestigeWatchlist: sql<number>`count(*) filter (where ${businessesTable.prestigeWatchlist} = true)`,
      })
      .from(businessesTable)
      .where(where),
    db
      .select({
        recommendedNextStep: businessesTable.recommendedNextStep,
        total: count(),
      })
      .from(businessesTable)
      .where(where)
      .groupBy(businessesTable.recommendedNextStep)
      .orderBy(desc(count()))
      .limit(6),
    db
      .select({
        status: researchJobsTable.status,
        total: count(),
      })
      .from(researchJobsTable)
      .groupBy(researchJobsTable.status),
    getResearchFeedbackSummary(),
  ]);

  const jobCounts = Object.fromEntries(jobs.map((job) => [job.status, Number(job.total)]));
  const row = totals[0];

  return {
    totalBusinesses: Number(row?.total ?? 0),
    qualifiedBusinesses: Number(row?.qualified ?? 0),
    contactableBusinesses: Number(row?.contactable ?? 0),
    readyBusinesses: Number(row?.ready ?? 0),
    reviewBusinesses: Number(row?.review ?? 0),
    staleHighPriorityBusinesses: Number(row?.stale ?? 0),
    engineBreakdown: {
      revenue: Number(row?.revenue ?? 0),
      institutional: Number(row?.institutional ?? 0),
      authority: Number(row?.authority ?? 0),
    },
    relationshipBreakdown: {
      warmPaths: Number(row?.warmPaths ?? 0),
      prestigeWatchlist: Number(row?.prestigeWatchlist ?? 0),
    },
    topNextSteps: topNextSteps.map((item) => ({
      recommendedNextStep: item.recommendedNextStep ?? "unspecified",
      total: Number(item.total),
    })),
    jobCounts: {
      queued: Number(jobCounts["queued"] ?? 0),
      running: Number(jobCounts["running"] ?? 0),
      retrying: Number(jobCounts["retrying"] ?? 0),
      completed: Number(jobCounts["completed"] ?? 0),
      failed: Number(jobCounts["failed"] ?? 0),
    },
    feedback,
  };
}
