export const TYPES = {
  AvailabilityReadRepository: Symbol.for("AvailabilityReadRepository"),
  HttpClient: Symbol.for("HttpClient"),
  RoomAdminRepository: Symbol.for("RoomAdminRepository"),
  RoomPdfStoragePort: Symbol.for("RoomPdfStoragePort"),
  UserDelegationWriteSasPort: Symbol.for("UserDelegationWriteSasPort"),
} as const;
