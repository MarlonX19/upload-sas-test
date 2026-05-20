export interface BlobBinaryUploaderPort {
  uploadBytes(params: {
    blobName: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ publicBlobUrl: string }>;
}
