import "reflect-metadata";

import { Container } from "inversify";

import type { RoomDocumentAiAnalyzer } from "@/application/ports/room-document-ai-analyzer.port";
import type { HttpClient } from "@/application/ports/http-client.port";
import type { RoomDocumentAnalysisQueuePort } from "@/application/ports/room-document-analysis-queue.port";
import type { RoomPdfStoragePort } from "@/application/ports/room-pdf-storage.port";
import type { UserDelegationWriteSasPort } from "@/application/ports/user-delegation-write-sas.port";
import type { DtpAnalysisQueuePort } from "@/application/ports/dtp-analysis-queue.port";
import type { DtpVideoAiAnalyzer } from "@/application/ports/dtp-video-ai-analyzer.port";
import type { BlobBinaryFetcherPort } from "@/application/ports/blob-binary-fetcher.port";
import type { BlobBinaryUploaderPort } from "@/application/ports/blob-binary-uploader.port";
import type { VideoFrameExtractorPort } from "@/application/ports/video-frame-extractor.port";
import { SearchRoomAvailabilityUseCase } from "@/application/availability/use-cases/search-room-availability.use-case";
import { CreateRoomUseCase } from "@/application/rooms/use-cases/create-room.use-case";
import { ListAdminHotelsUseCase } from "@/application/rooms/use-cases/list-admin-hotels.use-case";
import { ListAdminRoomTypesForHotelUseCase } from "@/application/rooms/use-cases/list-admin-room-types-for-hotel.use-case";
import { GetAdminRoomDetailUseCase } from "@/application/rooms/use-cases/get-admin-room-detail.use-case";
import { UploadRoomPdfUseCase } from "@/application/rooms/use-cases/upload-room-pdf.use-case";
import { CompleteRoomFileUrlUseCase } from "@/application/rooms/use-cases/complete-room-file-url.use-case";
import { ProcessRoomFileDocumentAnalysisUseCase } from "@/application/rooms/use-cases/process-room-file-document-analysis.use-case";
import { IssueRoomFileUploadSasUseCase } from "@/application/rooms/use-cases/issue-room-file-upload-sas.use-case";
import { IssuePdfBlobUploadSasUseCase } from "@/application/upload/use-cases/issue-pdf-blob-upload-sas.use-case";
import { CreateDtpJobUseCase } from "@/application/dtp/use-cases/create-dtp-job.use-case";
import { GetDtpJobUseCase } from "@/application/dtp/use-cases/get-dtp-job.use-case";
import { IssueVideoDtpUploadSasUseCase } from "@/application/dtp/use-cases/issue-video-dtp-upload-sas.use-case";
import { ProcessDtpVideoAnalysisUseCase } from "@/application/dtp/use-cases/process-dtp-video-analysis.use-case";
import type { AvailabilityReadRepository } from "@/domain/repositories/availability-read.repository";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";
import type { DtpJobRepository } from "@/domain/repositories/dtp-job.repository";
import { DisabledRoomDocumentAiAnalyzer } from "@/infrastructure/ai/disabled-room-document-ai.analyzer";
import { DisabledDtpVideoAiAnalyzer } from "@/infrastructure/ai/disabled-dtp-video-ai.analyzer";
import { VertexRoomDocumentAiAnalyzer } from "@/infrastructure/ai/vertex-room-document-ai.analyzer";
import { VertexDtpVideoAiAnalyzer } from "@/infrastructure/ai/vertex-dtp-video-ai.analyzer";
import { AxiosHttpService } from "@/infrastructure/http/axios-http.service";
import { AzureRoomPdfBinaryFetcher } from "@/infrastructure/storage/azure-room-pdf-binary.fetcher";
import { AzureBlobBinaryFetcher } from "@/infrastructure/storage/azure-blob-binary.fetcher";
import { AzureBlobBinaryUploader } from "@/infrastructure/storage/azure-blob-binary.uploader";
import { MongoAvailabilityReadRepository } from "@/infrastructure/repositories/mongo-availability-read.repository";
import { MongoRoomAdminRepository } from "@/infrastructure/repositories/mongo-room-admin.repository";
import { MongoDtpJobRepository } from "@/infrastructure/repositories/mongo-dtp-job.repository";
import { BullmqRoomDocumentAnalysisQueue } from "@/infrastructure/queue/bullmq-room-document-analysis.queue";
import { BullmqDtpAnalysisQueue } from "@/infrastructure/queue/bullmq-dtp-analysis.queue";
import { NoopRoomDocumentAnalysisQueue } from "@/infrastructure/queue/noop-room-document-analysis.queue";
import { NoopDtpAnalysisQueue } from "@/infrastructure/queue/noop-dtp-analysis.queue";
import { LocalRoomPdfStorage } from "@/infrastructure/storage/local-room-pdf.storage";
import { AzureUserDelegationWriteSasAdapter } from "@/infrastructure/storage/azure-user-delegation-write-sas.adapter";
import { FfmpegVideoFrameExtractor } from "@/infrastructure/video/ffmpeg-frame-extractor";

import { TYPES } from "./types";

const container = new Container();

const availabilityRepository: AvailabilityReadRepository = new MongoAvailabilityReadRepository();
const roomAdminRepository: RoomAdminRepository = new MongoRoomAdminRepository();
const dtpJobRepository: DtpJobRepository = new MongoDtpJobRepository();
const roomPdfStorage: RoomPdfStoragePort = new LocalRoomPdfStorage();
const userDelegationWriteSas: UserDelegationWriteSasPort = new AzureUserDelegationWriteSasAdapter();

const redisUrl = process.env.REDIS_CONNECTION_STRING?.trim();
const genaiKey = process.env.GENAI_KEY?.trim();
const documentAnalysisQueue: RoomDocumentAnalysisQueuePort =
  redisUrl && genaiKey ? new BullmqRoomDocumentAnalysisQueue() : new NoopRoomDocumentAnalysisQueue();
const dtpAnalysisQueue: DtpAnalysisQueuePort =
  redisUrl && genaiKey ? new BullmqDtpAnalysisQueue() : new NoopDtpAnalysisQueue();

const roomPdfBinaryFetcher = new AzureRoomPdfBinaryFetcher();
const blobBinaryFetcher: BlobBinaryFetcherPort = new AzureBlobBinaryFetcher();
const blobBinaryUploader: BlobBinaryUploaderPort = new AzureBlobBinaryUploader();
const videoFrameExtractor: VideoFrameExtractorPort = new FfmpegVideoFrameExtractor();
const roomDocumentAiAnalyzer: RoomDocumentAiAnalyzer = genaiKey
  ? new VertexRoomDocumentAiAnalyzer()
  : new DisabledRoomDocumentAiAnalyzer();
const dtpVideoAiAnalyzer: DtpVideoAiAnalyzer = genaiKey
  ? new VertexDtpVideoAiAnalyzer()
  : new DisabledDtpVideoAiAnalyzer();

container
  .bind<AvailabilityReadRepository>(TYPES.AvailabilityReadRepository)
  .toConstantValue(availabilityRepository);

container.bind<HttpClient>(TYPES.HttpClient).toConstantValue(new AxiosHttpService());

container.bind<RoomAdminRepository>(TYPES.RoomAdminRepository).toConstantValue(roomAdminRepository);

container.bind<RoomPdfStoragePort>(TYPES.RoomPdfStoragePort).toConstantValue(roomPdfStorage);

container
  .bind<UserDelegationWriteSasPort>(TYPES.UserDelegationWriteSasPort)
  .toConstantValue(userDelegationWriteSas);

container
  .bind(SearchRoomAvailabilityUseCase)
  .toConstantValue(new SearchRoomAvailabilityUseCase(availabilityRepository));

container.bind(CreateRoomUseCase).toConstantValue(new CreateRoomUseCase(roomAdminRepository));

container
  .bind(UploadRoomPdfUseCase)
  .toConstantValue(new UploadRoomPdfUseCase(roomAdminRepository, roomPdfStorage));

container.bind(ListAdminHotelsUseCase).toConstantValue(new ListAdminHotelsUseCase(roomAdminRepository));

container
  .bind(ListAdminRoomTypesForHotelUseCase)
  .toConstantValue(new ListAdminRoomTypesForHotelUseCase(roomAdminRepository));

container
  .bind(IssuePdfBlobUploadSasUseCase)
  .toConstantValue(new IssuePdfBlobUploadSasUseCase(userDelegationWriteSas));

container
  .bind(CompleteRoomFileUrlUseCase)
  .toConstantValue(new CompleteRoomFileUrlUseCase(roomAdminRepository, documentAnalysisQueue));

container
  .bind(IssueRoomFileUploadSasUseCase)
  .toConstantValue(new IssueRoomFileUploadSasUseCase(roomAdminRepository, userDelegationWriteSas));

container
  .bind(ProcessRoomFileDocumentAnalysisUseCase)
  .toConstantValue(
    new ProcessRoomFileDocumentAnalysisUseCase(
      roomAdminRepository,
      roomPdfBinaryFetcher,
      roomDocumentAiAnalyzer,
    ),
  );

container
  .bind(GetAdminRoomDetailUseCase)
  .toConstantValue(new GetAdminRoomDetailUseCase(roomAdminRepository));

container
  .bind(IssueVideoDtpUploadSasUseCase)
  .toConstantValue(new IssueVideoDtpUploadSasUseCase(userDelegationWriteSas));

container
  .bind(CreateDtpJobUseCase)
  .toConstantValue(new CreateDtpJobUseCase(dtpJobRepository, dtpAnalysisQueue));

container.bind(GetDtpJobUseCase).toConstantValue(new GetDtpJobUseCase(dtpJobRepository));

container
  .bind(ProcessDtpVideoAnalysisUseCase)
  .toConstantValue(
    new ProcessDtpVideoAnalysisUseCase(
      dtpJobRepository,
      blobBinaryFetcher,
      blobBinaryUploader,
      videoFrameExtractor,
      dtpVideoAiAnalyzer,
    ),
  );

export { container };
