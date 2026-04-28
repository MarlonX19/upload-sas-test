/**
 * Intervalo de estadia (check-in / check-out). Imutável, sem dependências externas.
 */
export class StayDateRange {
  private constructor(
    public readonly checkIn: Date,
    public readonly checkOut: Date,
  ) {}

  private static parseIsoDateOnly(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  /**
   * Cria intervalo válido (check-out estritamente depois do check-in) ou null.
   */
  static tryFromIsoStrings(checkIn: string, checkOut: string): StayDateRange | null {
    const a = StayDateRange.parseIsoDateOnly(checkIn);
    const b = StayDateRange.parseIsoDateOnly(checkOut);
    if (!a || !b || b.getTime() <= a.getTime()) return null;
    return new StayDateRange(a, b);
  }

  nights(): number {
    const ms = this.checkOut.getTime() - this.checkIn.getTime();
    return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
  }

  /** true se check-in (UTC meia-noite) não é antes de `todayUtc` */
  checkInOnOrAfter(todayUtcMidnight: Date): boolean {
    const ci = new Date(this.checkIn);
    ci.setUTCHours(0, 0, 0, 0);
    return ci.getTime() >= todayUtcMidnight.getTime();
  }
}
