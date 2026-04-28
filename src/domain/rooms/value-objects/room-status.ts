const STATUSES = [
  "available",
  "cleaning",
  "occupied",
  "maintenance",
  "out_of_order",
] as const;

export type RoomStatus = (typeof STATUSES)[number];

export function isRoomStatus(value: string): value is RoomStatus {
  return (STATUSES as readonly string[]).includes(value);
}

export function tryRoomStatus(value: string): RoomStatus | null {
  return isRoomStatus(value) ? value : null;
}
