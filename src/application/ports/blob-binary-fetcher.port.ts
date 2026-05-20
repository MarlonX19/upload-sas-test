export interface BlobBinaryFetcherPort {
  fetchFromUrl(url: string): Promise<Uint8Array>;
}
