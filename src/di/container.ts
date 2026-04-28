import "reflect-metadata";

import { Container } from "inversify";

import type { HttpClient } from "@/application/ports/http-client.port";
import type { RoomPdfStoragePort } from "@/application/ports/room-pdf-storage.port";
import type { UserDelegationWriteSasPort } from "@/application/ports/user-delegation-write-sas.port";
import { SearchRoomAvailabilityUseCase } from "@/application/availability/use-cases/search-room-availability.use-case";
import { CreateRoomUseCase } from "@/application/rooms/use-cases/create-room.use-case";
import { ListAdminHotelsUseCase } from "@/application/rooms/use-cases/list-admin-hotels.use-case";
import { ListAdminRoomTypesForHotelUseCase } from "@/application/rooms/use-cases/list-admin-room-types-for-hotel.use-case";
import { UploadRoomPdfUseCase } from "@/application/rooms/use-cases/upload-room-pdf.use-case";
import { CompleteRoomFileUrlUseCase } from "@/application/rooms/use-cases/complete-room-file-url.use-case";
import { IssuePdfBlobUploadSasUseCase } from "@/application/upload/use-cases/issue-pdf-blob-upload-sas.use-case";
import type { AvailabilityReadRepository } from "@/domain/repositories/availability-read.repository";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";
import { AxiosHttpService } from "@/infrastructure/http/axios-http.service";
import { MongoAvailabilityReadRepository } from "@/infrastructure/repositories/mongo-availability-read.repository";
import { MongoRoomAdminRepository } from "@/infrastructure/repositories/mongo-room-admin.repository";
import { LocalRoomPdfStorage } from "@/infrastructure/storage/local-room-pdf.storage";
import { AzureUserDelegationWriteSasAdapter } from "@/infrastructure/storage/azure-user-delegation-write-sas.adapter";

import { TYPES } from "./types";

const container = new Container();

const availabilityRepository: AvailabilityReadRepository = new MongoAvailabilityReadRepository();
const roomAdminRepository: RoomAdminRepository = new MongoRoomAdminRepository();
const roomPdfStorage: RoomPdfStoragePort = new LocalRoomPdfStorage();
const userDelegationWriteSas: UserDelegationWriteSasPort = new AzureUserDelegationWriteSasAdapter();

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
  .toConstantValue(new CompleteRoomFileUrlUseCase(roomAdminRepository));

export { container };
