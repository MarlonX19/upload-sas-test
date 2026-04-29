# Upload de PDF para Azure Blob via User Delegation SAS

Este documento descreve **passo a passo** como implementar o fluxo em que o **servidor (ex.: Next.js em Node)** **não recebe o binário do ficheiro**. O servidor **autentica na Storage**, obtém uma **user delegation key**, gera um **SAS limitado a um blob** e devolve uma **`uploadUrl`** ao browser. O **browser** envia os bytes **diretamente** para `https://{conta}.blob.core.windows.net`.

---

## 1. Ideia central

| Camada | Responsabilidade |
|--------|------------------|
| **Azure Blob Storage** | Guardar o blob; aceitar upload por blocos quando o SAS é válido. |
| **Servidor** | `DefaultAzureCredential`, `getUserDelegationKey`, `generateBlobSASQueryParameters` com permissões só no blob pretendido, TTL curto. |
| **Cliente** | Um `fetch` ao servidor para obter JSON com `uploadUrl`; depois `@azure/storage-blob` (`BlockBlobClient`) usa essa URL — **o PDF não passa pelo servidor**. |

**User Delegation SAS**: a assinatura vem da **chave de delegação** emitida pela Storage para o teu principal Azure AD — **não** uses **account key** no cliente nem como SAS assinado com key da conta se quiseres este modelo.

---

## 2. Dependências npm

- `@azure/identity` — `DefaultAzureCredential` (Managed Identity em Azure, Azure CLI em desenvolvimento, etc.).
- `@azure/storage-blob` — servidor: `BlobServiceClient`, `BlobSASPermissions`, `generateBlobSASQueryParameters`; browser: `BlockBlobClient` para o upload.

---

## 3. Variáveis de ambiente (servidor)

| Variável | Descrição |
|----------|-----------|
| `AZURE_STORAGE_ACCOUNT_NAME` | Nome da conta Storage (**obrigatório**). |
| `AZURE_STORAGE_UPLOADS_CONTAINER` | Nome do container (opcional; exemplo de default: `uploads`). |

O principal que corre o backend precisa de permissão para operações de dados no blob (ex.: RBAC **Storage Blob Data Contributor**) de modo a conseguir **gerar user delegation key**.

---

## 4. Contrato no código (porta / interface)

Algo neste género permite testar o caso de uso sem Azure:

```ts
buildUploadUrlForBlob(params: { blobName: string }): Promise<{
  uploadUrl: string;      // URL do blob + query string SAS (escrita)
  publicBlobUrl: string;   // URL HTTPS do blob sem SAS (para gravar na BD)
  expiresOn: Date;
}>;
```

- **`uploadUrl`**: usar só no cliente para `Put Block` / `Put Block List` (via SDK).
- **`publicBlobUrl`**: referência estável ao objecto após o upload, para persistir na tua base de dados.

---

## 5. Servidor: gerar User Delegation SAS para um blob

Ordem lógica (como em `AzureUserDelegationWriteSasAdapter`):

1. Ler nome da conta e do container.
2. Criar `BlobServiceClient` com  
   `https://${accountName}.blob.core.windows.net`  
   e credencial `new DefaultAzureCredential()`.
3. Definir janela temporal do SAS:
   - `startsOn`: pouco **antes** de “agora” (margem para skew de relógio).
   - `expiresOn`: curto (ex.: **10 minutos**) — deve cobrir o tempo esperado de upload.
4. Chamar  
   `blobServiceClient.getUserDelegationKey(referênciaInício, referênciaFim)`  
   com instantes **coerentes** com os que vais passar ao SAS.
5. Chamar `generateBlobSASQueryParameters` com:
   - `containerName`, `blobName`
   - `permissions`: `BlobSASPermissions.parse("cw")` — **c**reate + **w**rite (upload por blocos para block blob).
   - `startsOn`, `expiresOn`
   - o objeto **user delegation key** devolvido no passo 4 (não uses account key aqui).
6. Montar **`publicBlobUrl`**:  
   `https://{account}.blob.core.windows.net` + caminho `/{container}/{blob}` com **cada segmento** do path codificado com `encodeURIComponent` (incluindo se `blobName` tiver `/`).
7. **`uploadUrl`** = `publicBlobUrl` + `?` + string SAS devolvida pelo gerador.

Se o upload for muito longo e o SAS expirar a meio, o cliente pode **pedir um novo SAS** ao mesmo endpoint e voltar a tentar — para o primeiro desenho, basta TTL confortável em relação ao tamanho da rede.

---

## 6. Nome do blob (`blobName`)

Convenção típica (ex.: `buildAzurePdfBlobName`):

- Validar extensão pretendida (ex.: `.pdf`).
- Sanitizar caracteres inválidos no nome do ficheiro.
- Prefixar com um **ID único** (UUID, ObjectId, etc.) para evitar colisões.

Para um fluxo “genérico”, podes gerar `blobName` com `randomUUID()` + nome limpo. Para um fluxo “ligado a um registo”, derivas o nome a partir dos dados já guardados (ex.: `fileId` + nome original).

---

## 7. API HTTP que só devolve SAS

### 7.1 Exemplo genérico

- **Body**: por exemplo `{ fileName, contentType }` validado (Zod).
- **Use case**: montar `blobName` → chamar `buildUploadUrlForBlob` → devolver JSON:
  - `uploadUrl`, `publicBlobUrl`, `blobName`, `expiresOn` (ISO).
- **Rota**: ex. `POST /api/upload-sas`, **`runtime = nodejs`** (SDK Azure no servidor).
- **Produção**: protege com autenticação; não expor emissão aberta de SAS.

### 7.2 Exemplo com autorização (recurso já existente)

- **Parâmetros de rota**: ids do recurso (ex.: `roomId`, `fileId`).
- **Body**: ex. `hotelId` para verificar posse.
- **Use case**:  
  `roomBelongsToHotel` → obter nome do ficheiro no registo → `buildAzurePdfBlobName` → SAS.
- **Rota**: `POST .../upload-sas` com sessão do utilizador.

O servidor continua a **não** receber bytes do PDF.

---

## 8. Cliente: upload direto para o Blob

Fluxo mínimo (como em `azure-parallel-pdf-upload.ts`):

1. **`POST`** ao teu endpoint com o mínimo necessário (ex.: `fileName` / ids do recurso) para o servidor devolver o SAS.
2. **`new BlockBlobClient(sas.uploadUrl)`** — a URL já inclui a query string do SAS.
3. **`client.uploadData(file, { blockSize, concurrency, onProgress })`** — o SDK faz **upload por blocos** internamente; não precisas de implementar `stageBlock`/`commitBlockList` manualmente neste desenho inicial.

O tráfego do ficheiro vai **browser → Azure**, não **browser → Next.js → Azure**.

---

## 9. Persistir referência na aplicação (opcional mas comum)

Depois do `uploadData` concluir com sucesso, o blob já existe. Normalmente chamas um segundo endpoint (ex. **`PATCH`**) com `publicBlobUrl` (e ids de negócio) para o servidor validar e gravar só a **string URL** na base de dados — ainda **sem** enviar o PDF pelo servidor.

---

## 10. Passo a passo num projeto novo (checklist)

1. Criar container na Storage (ex.: `uploads`).
2. Garantir RBAC / identidade para o runtime do backend emitir user delegation SAS.
3. Instalar `@azure/identity` e `@azure/storage-blob`.
4. Implementar geração de SAS (secção 5) + convenção de `blobName` (secção 6).
5. Expor rota autenticada que devolve `uploadUrl`, `publicBlobUrl`, `blobName`, `expiresOn`.
6. No frontend: pedir SAS → `BlockBlobClient` → `uploadData`.
7. Opcional: endpoint para persistir `publicBlobUrl` após sucesso.
8. Testes: mock da porta de SAS no use case; testes de integração com credenciais reais só em pipeline/ambiente seguro.

---

## 11. Segurança (resumo)

- SAS com **TTL curto**; emitir só a utilizadores autorizados.
- **Nunca** account key no browser ou em variáveis públicas.
- Validar `publicBlobUrl` ao gravar (prefixo da tua conta/container, HTTPS) se quiseres evitar URLs arbitrárias.

---

## 12. Ficheiros de referência neste repositório

| Peça | Caminho |
|------|---------|
| Adaptador User Delegation SAS | `src/infrastructure/storage/azure-user-delegation-write-sas.adapter.ts` |
| Porta | `src/application/ports/user-delegation-write-sas.port.ts` |
| SAS genérico PDF + rota | `src/application/upload/use-cases/issue-pdf-blob-upload-sas.use-case.ts`, `src/app/api/upload-sas/route.ts` |
| SAS por ficheiro (admin) + rota | `src/application/rooms/use-cases/issue-room-file-upload-sas.use-case.ts`, `src/app/api/admin/rooms/[roomId]/files/[fileId]/upload-sas/route.ts` |
| Gravar URL após upload | `src/application/rooms/use-cases/complete-room-file-url.use-case.ts`, `src/app/api/admin/rooms/[roomId]/files/[fileId]/url/route.ts` |
| Cliente: upload direto com SDK | `src/lib/upload/azure-parallel-pdf-upload.ts` |
| Nome do blob | `src/domain/upload/azure-pdf-blob-name.ts` |
| Política de blocos/concorrência (cliente simples) | `src/domain/upload/general-pdf-upload-policy.ts` |
| DI | `src/di/container.ts` |

*Técnicas adicionais (sessão em IndexedDB, `stageBlock` manual, renovação fina de SAS) são extensões posteriores e não fazem parte deste guia inicial.*
