/**
 * Referência a um ficheiro do quarto (metadados persistidos; o binário está no storage).
 */
export class RoomFileRef {
  private constructor(
    public readonly fileName: string,
    public readonly fileURL: string,
  ) {}

  static tryCreate(fileName: string, fileURL: string): RoomFileRef | null {
    const name = fileName.trim();
    const url = fileURL.trim();
    if (name.length === 0 || url.length === 0) return null;
    return new RoomFileRef(name, url);
  }
}
