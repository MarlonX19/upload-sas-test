import type { RoomFileRef } from "@/domain/rooms/value-objects/room-file-ref";

export type AdminHotelOption = {
  id: string;
  name: string;
  slug: string;
};

export type AdminRoomTypeOption = {
  id: string;
  name: string;
  slug: string;
};

export type CreateRoomParams = {
  hotelId: string;
  roomTypeId: string;
  number: string;
  floor: number;
  status: string;
  /**
   * Entradas iniciais: `fileURL` fica vazio até o upload no Azure concluir.
   * Cada `fileId` (ex.: UUID) liga a linha em Mongo ao upload correspondente.
   */
  pendingFiles?: Array<{ fileId: string; fileName: string }>;
};

/**
 * Operações de backoffice em quartos (leitura de listagens + escrita).
 */
export interface RoomAdminRepository {
  listHotelsForAdmin(): Promise<AdminHotelOption[]>;
  listRoomTypesByHotel(hotelId: string): Promise<AdminRoomTypeOption[]>;
  createRoom(params: CreateRoomParams): Promise<{ roomId: string }>;
  getPdfFileCount(roomId: string): Promise<number>;
  roomBelongsToHotel(roomId: string, hotelId: string): Promise<boolean>;
  appendRoomFile(roomId: string, file: RoomFileRef): Promise<void>;
  /** Atualiza `fileURL` do item com o `fileId` dado (preenchimento pós-upload Azure). */
  setRoomFileUrlByFileId(roomId: string, fileId: string, publicBlobUrl: string): Promise<boolean>;
  /**
   * Resolve o nome lógico do ficheiro no quarto (para o nome de blob no Azure) ou `null` se não existir.
   */
  findRoomFileNameByFileId(roomId: string, fileId: string): Promise<string | null>;
}
