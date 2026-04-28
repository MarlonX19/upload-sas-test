export class HotelBrief {
  constructor(
    public readonly name: string,
    public readonly slug: string,
    public readonly city: string | undefined,
    public readonly starRating: number | undefined,
  ) {}
}
