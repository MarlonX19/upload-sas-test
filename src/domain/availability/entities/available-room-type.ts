export class AvailableRoomType {
  constructor(
    public readonly roomTypeId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | undefined,
    public readonly basePricePerNight: number,
    public readonly currency: string,
    public readonly maxOccupancy: number,
    /** Limite de crianças quando definido na BD; undefined = sem limite explícito além do total. */
    public readonly maxChildren: number | undefined,
    public readonly bedSummary: string,
    public readonly sizeSqm: number | undefined,
    public readonly amenities: readonly string[],
    public readonly imageUrls: readonly string[],
    public readonly availableRooms: number,
  ) {}
}
