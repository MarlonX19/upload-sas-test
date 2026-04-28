/**
 * Gera URL com SAS (user delegation) com permissão de escrita para um blob específico.
 */
export interface UserDelegationWriteSasPort {
  buildUploadUrlForBlob(params: { blobName: string }): Promise<{
    uploadUrl: string;
    publicBlobUrl: string;
    expiresOn: Date;
  }>;
}
