/**
 * Composição de hóspedes para pesquisa de disponibilidade (imutável).
 */
export class GuestOccupancy {
  private constructor(
    public readonly adults: number,
    public readonly children: number,
  ) {}

  /**
   * Cria ocupação válida: pelo menos 1 adulto; crianças ≥ 0.
   */
  static tryCreate(adults: number, children: number): GuestOccupancy | null {
    if (!Number.isFinite(adults) || !Number.isFinite(children)) return null;
    if (!Number.isInteger(adults) || adults < 1 || adults > 30) return null;
    if (!Number.isInteger(children) || children < 0 || children > 15) return null;
    return new GuestOccupancy(adults, children);
  }

  get totalPax(): number {
    return this.adults + this.children;
  }

  /**
   * Verifica se o tipo de quarto comporta esta ocupação.
   * Se `maxChildren` existir na BD (incluindo 0), aplica-se também ao número de crianças.
   */
  fitsRoomType(maxOccupancy: number, maxChildren?: number | null): boolean {
    if (this.totalPax > maxOccupancy) return false;
    if (typeof maxChildren === "number" && this.children > maxChildren) return false;
    return true;
  }
}
