import type { RoomDocumentAnalysisStatus } from "@/domain/rooms/value-objects/room-document-analysis";

export type AdminRoomFileDetail = {
  fileId: string;
  fileName: string;
  fileURL: string;
  analysisStatus?: RoomDocumentAnalysisStatus;
  analysisError?: string;
  analysisSteps?: Array<{ title: string; description: string; order: number }>;
  socos?: Array<{ severity: "low" | "medium" | "high"; topic: string; detail: string }>;
  ideas?: Array<{ title: string; rationale: string }>;
  analysisUpdatedAt: string | null;
};

export type AdminRoomDetail = {
  id: string;
  hotelId: string;
  hotelName: string;
  roomTypeId: string;
  roomTypeName: string;
  number: string;
  floor: number;
  status: string;
  files: AdminRoomFileDetail[];
  createdAt: string;
  updatedAt: string;
};
