import { ObjectId } from "mongodb";

import type {
  CreateDtpJobParams,
  DtpJobRepository,
  UpdateDtpJobPatch,
} from "@/domain/repositories/dtp-job.repository";
import type { DtpJob } from "@/domain/dtp/dtp-job";
import { DEFAULT_DTP_OUTPUT_LANGUAGE, resolveDtpOutputLanguage } from "@/domain/dtp/dtp-output-language";
import type { DtpStep } from "@/domain/dtp/dtp-step";
import type { DtpJobStatus } from "@/domain/dtp/dtp-job-status";
import { COLLECTIONS } from "@/infrastructure/database/collections";
import clientPromise from "@/infrastructure/database/mongo-client";

type DtpJobDoc = {
  _id: ObjectId;
  id: string;
  userId: string;
  videoFileName: string;
  videoMimeType: string;
  outputLanguage?: string;
  status: DtpJobStatus;
  steps?: DtpStep[];
  pdfBlobUrl?: string;
  pdfBlobName?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  /** Legado — jobs antigos com upload Azure; ignorado no fluxo novo. */
  videoBlobUrl?: string;
  videoBlobName?: string;
};

function toDomain(doc: DtpJobDoc): DtpJob {
  return {
    id: doc.id,
    userId: doc.userId,
    videoFileName: doc.videoFileName,
    videoMimeType: doc.videoMimeType,
    outputLanguage: resolveDtpOutputLanguage(doc.outputLanguage ?? DEFAULT_DTP_OUTPUT_LANGUAGE),
    status: doc.status,
    steps: doc.steps,
    pdfBlobUrl: doc.pdfBlobUrl,
    pdfBlobName: doc.pdfBlobName,
    errorMessage: doc.errorMessage,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoDtpJobRepository implements DtpJobRepository {
  async create(params: CreateDtpJobParams): Promise<DtpJob> {
    const client = await clientPromise;
    const db = client.db();
    const now = new Date();
    const doc: DtpJobDoc = {
      _id: new ObjectId(),
      id: params.id,
      userId: params.userId,
      videoFileName: params.videoFileName,
      videoMimeType: params.videoMimeType,
      outputLanguage: params.outputLanguage,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(COLLECTIONS.dtpJobs).insertOne(doc);
    return toDomain(doc);
  }

  async findByIdForUser(jobId: string, userId: string): Promise<DtpJob | null> {
    const client = await clientPromise;
    const db = client.db();
    const doc = await db.collection<DtpJobDoc>(COLLECTIONS.dtpJobs).findOne({ id: jobId, userId });
    return doc ? toDomain(doc) : null;
  }

  async updateById(jobId: string, patch: UpdateDtpJobPatch): Promise<boolean> {
    const client = await clientPromise;
    const db = client.db();
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) $set.status = patch.status;
    if (patch.steps !== undefined) $set.steps = patch.steps;
    if (patch.pdfBlobUrl !== undefined) $set.pdfBlobUrl = patch.pdfBlobUrl;
    if (patch.pdfBlobName !== undefined) $set.pdfBlobName = patch.pdfBlobName;
    if (patch.errorMessage !== undefined) $set.errorMessage = patch.errorMessage;

    const result = await db.collection(COLLECTIONS.dtpJobs).updateOne({ id: jobId }, { $set });
    return result.matchedCount > 0;
  }
}
