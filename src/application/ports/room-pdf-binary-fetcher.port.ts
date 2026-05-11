/**
 * Descarrega o binário do PDF a partir de uma URL acessível no servidor (blob público ou SAS válida).
 */
export interface RoomPdfBinaryFetcher {
  fetchFromUrl(url: string): Promise<Uint8Array>;
}
