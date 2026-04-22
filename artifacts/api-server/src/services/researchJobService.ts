import { randomUUID } from "node:crypto";
import {
  businessSourcesTable,
  businessesTable,
  contactCandidatesTable,
  db,
  researchJobsTable,
  type ResearchJob,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { loadBusinessResearchAggregateById } from "./businessResearchAggregateService";
import { refreshBusinessResearchState } from "./businessResearchPersistenceService";
import { upsertBusinessSources } from "./businessSourceService";
import { upsertContactCandidates } from "./contactCandidateService";
import { enrichOfficialWebsiteContacts } from "./officialWebsiteContactService";

export const RESEARCH_JOB_TYPES = [
  "ranking_refresh",
  "qualification",
  "source_fetch",
  "official_site_enrichment",
  "contact_verification",
  "review_refresh",
] as const;

export type ResearchJobType = (typeof RESEARCH_JOB_TYPES)[number];

export interface EnqueueResearchJobInput {
  jobType: ResearchJobType;
  businessId?: number | null;
  sourceId?: number | null;
  priority?: number;
  scheduledAt?: Date;
  payload?: Record<string, unknown>;
}

function buildDedupeWhere(input: EnqueueResearchJobInput) {
  const conditions = [
    eq(researchJobsTable.jobType, input.jobType),
    inArray(researchJobsTable.status, ["queued", "running", "retrying"]),
  ];

  if (input.businessId != null) conditions.push(eq(researchJobsTable.businessId, input.businessId));
  if (input.sourceId != null) conditions.push(eq(researchJobsTable.sourceId, input.sourceId));
  return and(...conditions);
}

export async function enqueueResearchJob(input: EnqueueResearchJobInput) {
  const existing = await db
    .select()
    .from(researchJobsTable)
    .where(buildDedupeWhere(input))
    .limit(1);

  if (existing[0]) return existing[0];

  const values = {
    jobType: input.jobType,
    businessId: input.businessId ?? null,
    sourceId: input.sourceId ?? null,
    status: "queued",
    priority: input.priority ?? 50,
    scheduledAt: input.scheduledAt ?? new Date(),
    payload: input.payload ?? null,
    resultSummary: null,
    startedAt: null,
    finishedAt: null,
    lockedAt: null,
    lockToken: null,
    errorCode: null,
    errorMessage: null,
    attemptCount: 0,
  };

  const [created] = await db.insert(researchJobsTable).values(values).returning();
  return created ?? null;
}

export async function enqueueResearchJobs(inputs: EnqueueResearchJobInput[]) {
  const jobs: ResearchJob[] = [];
  for (const input of inputs) {
    const job = await enqueueResearchJob(input);
    if (job) jobs.push(job);
  }
  return jobs;
}

export async function listResearchJobs(filters: {
  status?: string;
  limit?: number;
}) {
  const conditions = [];
  if (filters.status) conditions.push(eq(researchJobsTable.status, filters.status));
  return db
    .select()
    .from(researchJobsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(researchJobsTable.status), asc(researchJobsTable.scheduledAt))
    .limit(Math.max(1, Math.min(filters.limit ?? 50, 200)));
}

export async function requeueStuckResearchJobs(maxAgeMinutes = 15) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
  await db
    .update(researchJobsTable)
    .set({
      status: "queued",
      lockedAt: null,
      lockToken: null,
      startedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(researchJobsTable.status, "running"),
        lte(researchJobsTable.lockedAt, cutoff),
      ),
    );
}

export async function claimDueResearchJobs(limit = 10) {
  const dueJobs = await db
    .select()
    .from(researchJobsTable)
    .where(
      and(
        inArray(researchJobsTable.status, ["queued", "retrying"]),
        lte(researchJobsTable.scheduledAt, new Date()),
      ),
    )
    .orderBy(desc(researchJobsTable.priority), asc(researchJobsTable.scheduledAt))
    .limit(limit);

  const claimed: ResearchJob[] = [];
  for (const job of dueJobs) {
    const lockToken = randomUUID();
    const [updated] = await db
      .update(researchJobsTable)
      .set({
        status: "running",
        lockToken,
        lockedAt: new Date(),
        startedAt: new Date(),
        attemptCount: (job.attemptCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(researchJobsTable.id, job.id),
          inArray(researchJobsTable.status, ["queued", "retrying"]),
        ),
      )
      .returning();

    if (updated) claimed.push(updated);
  }

  return claimed;
}

export async function completeResearchJob(
  jobId: number,
  resultSummary: Record<string, unknown> | null = null,
) {
  await db
    .update(researchJobsTable)
    .set({
      status: "completed",
      finishedAt: new Date(),
      lockedAt: null,
      lockToken: null,
      resultSummary,
      errorCode: null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(researchJobsTable.id, jobId));
}

export async function failResearchJob(
  job: ResearchJob,
  error: unknown,
  maxAttempts = 3,
) {
  const message = error instanceof Error ? error.message : "Unknown research job failure";
  const shouldRetry = (job.attemptCount ?? 0) < maxAttempts;
  const nextStatus = shouldRetry ? "retrying" : "failed";
  const nextSchedule = shouldRetry
    ? new Date(Date.now() + Math.min(30, job.attemptCount + 1) * 60_000)
    : job.scheduledAt;

  await db
    .update(researchJobsTable)
    .set({
      status: nextStatus,
      errorCode: shouldRetry ? "retry_scheduled" : "failed",
      errorMessage: message,
      scheduledAt: nextSchedule,
      finishedAt: shouldRetry ? null : new Date(),
      lockedAt: null,
      lockToken: null,
      updatedAt: new Date(),
    })
    .where(eq(researchJobsTable.id, job.id));
}

async function refreshBusinessSource(sourceId: number) {
  const sourceRows = await db
    .select()
    .from(businessSourcesTable)
    .where(eq(businessSourcesTable.id, sourceId))
    .limit(1);
  const source = sourceRows[0];
  if (!source?.businessId) return { sourceId, refreshed: false };

  const aggregate = await loadBusinessResearchAggregateById(source.businessId);
  if (!aggregate) return { sourceId, refreshed: false };

  const enrichment = await enrichOfficialWebsiteContacts({
    id: aggregate.business.id,
    action: "update",
    business: aggregate.business,
  });

  await upsertBusinessSources(enrichment.sourceRecords);
  await upsertContactCandidates(enrichment.contactCandidates);
  await refreshBusinessResearchState(aggregate.business.id);

  return {
    sourceId,
    refreshed: true,
    newSources: enrichment.sourceRecords.length,
    newContacts: enrichment.contactCandidates.length,
  };
}

async function verifyContactsForBusiness(businessId: number) {
  const candidates = await db
    .select()
    .from(contactCandidatesTable)
    .where(eq(contactCandidatesTable.businessId, businessId));

  const now = new Date();
  for (const candidate of candidates) {
    const verificationStatus =
      candidate.reviewStatus === "approved"
        ? "verified"
        : candidate.email || candidate.phone || candidate.contactUrl
          ? "reachable"
          : "unverified";
    const nextVerificationAt = new Date(now);
    nextVerificationAt.setDate(nextVerificationAt.getDate() + (candidate.reviewStatus === "approved" ? 30 : 14));

    await db
      .update(contactCandidatesTable)
      .set({
        verificationStatus,
        isReachable: Boolean(candidate.email || candidate.phone || candidate.contactUrl),
        lastVerifiedAt: now,
        nextVerificationAt,
        updatedAt: now,
      })
      .where(eq(contactCandidatesTable.id, candidate.id));
  }

  await refreshBusinessResearchState(businessId);
  return { businessId, verifiedCandidates: candidates.length };
}

export async function runResearchJob(job: ResearchJob) {
  switch (job.jobType as ResearchJobType) {
    case "ranking_refresh":
    case "qualification":
    case "review_refresh":
      if (!job.businessId) return { skipped: true, reason: "missing_business_id" };
      await refreshBusinessResearchState(job.businessId);
      return { businessId: job.businessId, refreshed: true };
    case "source_fetch":
    case "official_site_enrichment":
      if (job.sourceId) return refreshBusinessSource(job.sourceId);
      if (job.businessId) {
        const business = await db
          .select({ id: businessesTable.id, primarySourceId: businessesTable.primarySourceId })
          .from(businessesTable)
          .where(eq(businessesTable.id, job.businessId))
          .limit(1);
        if (business[0]?.primarySourceId) {
          return refreshBusinessSource(business[0].primarySourceId);
        }
      }
      return { skipped: true, reason: "missing_source" };
    case "contact_verification":
      if (!job.businessId) return { skipped: true, reason: "missing_business_id" };
      return verifyContactsForBusiness(job.businessId);
    default:
      return { skipped: true, reason: "unsupported_job_type" };
  }
}

let researchLoopStarted = false;
let researchTickActive = false;
let researchLoopHandle: NodeJS.Timeout | null = null;

export async function runResearchTick(limit = 8) {
  if (researchTickActive) return;
  researchTickActive = true;

  try {
    await requeueStuckResearchJobs();
    const jobs = await claimDueResearchJobs(limit);
    for (const job of jobs) {
      try {
        const result = await runResearchJob(job);
        await completeResearchJob(job.id, result as Record<string, unknown>);
      } catch (error) {
        logger.error({ err: error, jobId: job.id, jobType: job.jobType }, "Research job failed");
        await failResearchJob(job, error);
      }
    }
  } finally {
    researchTickActive = false;
  }
}

export function startResearchJobLoop(intervalMs = 30_000) {
  if (researchLoopStarted) return;
  researchLoopStarted = true;

  queueMicrotask(() => {
    void runResearchTick();
  });

  researchLoopHandle = setInterval(() => {
    void runResearchTick();
  }, intervalMs);
}

export function stopResearchJobLoop() {
  if (researchLoopHandle) clearInterval(researchLoopHandle);
  researchLoopHandle = null;
  researchLoopStarted = false;
}
