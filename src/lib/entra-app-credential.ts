import { ClientSecretCredential } from "@azure/identity";

/**
 * Credential for chamadas server-side a APIs Microsoft (Graph, Key Vault, etc.)
 * com o mesmo registo de aplicação que o NextAuth (client id + secret no Entra).
 */
export function getEntraClientSecretCredential() {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Defina AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID e AZURE_AD_CLIENT_SECRET para usar @azure/identity no servidor.",
    );
  }
  return new ClientSecretCredential(tenantId, clientId, clientSecret);
}
