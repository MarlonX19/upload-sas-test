# Upload direto para Azure Blob com User Delegation SAS

Este guia mostra a lógica mínima para repetir, em outro projeto, o fluxo usado na tela `/admin/rooms/new`: o servidor gera uma URL SAS assinada com **user delegation key** e o browser faz upload do arquivo **diretamente para o Azure Blob Storage**.

A ideia principal é:

1. O usuário escolhe o arquivo no browser.
2. O frontend pede ao backend uma URL temporária de upload para um blob específico.
3. O backend autentica no Azure, obtém uma user delegation key e gera um SAS de escrita.
4. O frontend usa a URL SAS para enviar o arquivo direto ao Storage.
5. Depois do upload, o frontend informa ao backend a URL pública/estável do blob para persistir no banco.

Neste documento, a lógica de retomada quando o usuário perde internet foi propositalmente removida.

## 1. O que precisa existir no Azure

Crie ou use uma Storage Account com Blob Storage habilitado.

Crie um container para os uploads, por exemplo:

```text
workspace
```

O backend precisa rodar com uma identidade que consiga chamar `getUserDelegationKey`. Normalmente, use uma das opções abaixo:

- Em desenvolvimento local: `az login` com um usuário que tenha permissão no Storage.
- Em produção: Managed Identity, Service Principal ou outra credencial suportada pelo `DefaultAzureCredential`.

Permissão recomendada para a identidade do backend:

```text
Storage Blob Data Contributor
```

Essa permissão deve estar atribuída no escopo da Storage Account ou do container.

## 2. Dependências

Instale os SDKs da Azure:

```bash
npm install @azure/identity @azure/storage-blob
```

No servidor, serão usados:

```ts
import { DefaultAzureCredential } from "@azure/identity";
import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
```

No browser, será usado:

```ts
import { BlockBlobClient } from "@azure/storage-blob";
```

## 3. Variáveis de ambiente

No backend, configure:

```env
AZURE_STORAGE_ACCOUNT_NAME=sua_storage_account
AZURE_STORAGE_UPLOADS_CONTAINER=workspace
```

Não coloque account key no frontend. O browser recebe somente a URL SAS temporária.

## 4. Contrato entre frontend e backend

O endpoint que emite SAS deve receber informações suficientes para escolher o blob. Um contrato simples:

```ts
type IssueUploadSasRequest = {
  fileName: string;
  contentType: string;
};

type IssueUploadSasResponse = {
  uploadUrl: string;
  publicBlobUrl: string;
  blobName: string;
  expiresOn: string;
};
```

Diferença entre as URLs:

- `uploadUrl`: URL do blob com query string SAS. É usada só para upload.
- `publicBlobUrl`: URL sem SAS. É a referência que você salva no banco depois que o upload termina.

## 5. Gerar um nome seguro para o blob

Não use o nome original do arquivo diretamente como caminho final. Gere um nome controlado pelo servidor para evitar caracteres inválidos, colisões e path traversal.

Exemplo simples:

```ts
const INVALID = /[<>:"/\\|?*\x00-\x1f]/g;

export function buildBlobName(originalFileName: string, uniqueId: string): string {
  const baseName = originalFileName.replace(/\\/g, "/").split("/").pop() || "document.pdf";

  if (!/\.pdf$/i.test(baseName)) {
    throw new Error("Apenas PDF é permitido.");
  }

  const stem = baseName
    .slice(0, -4)
    .replace(INVALID, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120) || "document";

  return `pdf-${uniqueId}-${stem}.pdf`.toLowerCase();
}
```

No fluxo de `/admin/rooms/new`, o `uniqueId` é o `fileId` criado no frontend antes de criar o registro. Em outro projeto, pode ser um UUID criado no backend.

## 6. Backend: emitir User Delegation SAS

Este é o núcleo da implementação. O backend:

1. Lê a Storage Account e o container.
2. Autentica com `DefaultAzureCredential`.
3. Cria um `BlobServiceClient`.
4. Define uma janela curta de validade.
5. Chama `getUserDelegationKey`.
6. Gera um SAS para **um blob específico** com permissões `cw`.
7. Retorna `uploadUrl` para o browser.

```ts
import { DefaultAzureCredential } from "@azure/identity";
import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

const SAS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export async function buildUploadUrlForBlob(blobName: string) {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const containerName = process.env.AZURE_STORAGE_UPLOADS_CONTAINER?.trim() || "workspace";

  if (!accountName) {
    throw new Error("AZURE_STORAGE_ACCOUNT_NAME não definido.");
  }

  const credential = new DefaultAzureCredential();
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential,
  );

  const now = new Date();
  const startsOn = new Date(now.getTime() - CLOCK_SKEW_MS);
  const expiresOn = new Date(now.getTime() + SAS_TTL_MS);

  const delegationKey = await blobServiceClient.getUserDelegationKey(now, expiresOn);

  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("cw"),
      startsOn,
      expiresOn,
    },
    delegationKey,
    accountName,
  ).toString();

  const base = `https://${accountName}.blob.core.windows.net`;
  const path = [containerName, ...blobName.split("/")].map(encodeURIComponent).join("/");
  const publicBlobUrl = `${base}/${path}`;
  const uploadUrl = `${publicBlobUrl}?${sas}`;

  return {
    uploadUrl,
    publicBlobUrl,
    blobName,
    expiresOn,
  };
}
```

Sobre as permissões:

- `c` permite criar o blob.
- `w` permite escrever no blob.
- Não inclua permissões de leitura/listagem se o objetivo inicial é apenas upload.

## 7. Backend: endpoint para pedir SAS

Exemplo em Next.js App Router:

```ts
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { buildBlobName } from "@/lib/build-blob-name";
import { buildUploadUrlForBlob } from "@/lib/azure-user-delegation-sas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    fileName?: string;
    contentType?: string;
  };

  if (!body.fileName || !/\.pdf$/i.test(body.fileName)) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const fileId = randomUUID();
  const blobName = buildBlobName(body.fileName, fileId);
  const sas = await buildUploadUrlForBlob(blobName);

  return NextResponse.json({
    uploadUrl: sas.uploadUrl,
    publicBlobUrl: sas.publicBlobUrl,
    blobName: sas.blobName,
    expiresOn: sas.expiresOn.toISOString(),
  });
}
```

No fluxo de `/admin/rooms/new`, existe uma variação com IDs de negócio:

```text
POST /api/admin/rooms/{roomId}/files/{fileId}/upload-sas
```

Esse endpoint valida se o arquivo pertence ao registro, monta o `blobName` usando o nome salvo no banco e só então chama o gerador de SAS.

## 8. Frontend: pedir SAS e subir direto para o Azure

Fluxo mínimo no browser:

```ts
import { BlockBlobClient } from "@azure/storage-blob";

type UploadSasResponse = {
  uploadUrl: string;
  publicBlobUrl: string;
  blobName: string;
  expiresOn: string;
};

async function requestUploadSas(file: File): Promise<UploadSasResponse> {
  const res = await fetch("/api/upload-sas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/pdf",
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || "Não foi possível obter SAS de upload.");
  }

  return body as UploadSasResponse;
}

export async function uploadFileToAzure(
  file: File,
  onProgress: (percent: number) => void,
) {
  const sas = await requestUploadSas(file);

  const client = new BlockBlobClient(sas.uploadUrl);

  await client.uploadData(file, {
    blockSize: 4 * 1024 * 1024,
    concurrency: 3,
    blobHTTPHeaders: {
      blobContentType: file.type || "application/pdf",
    },
    onProgress: (ev) => {
      const percent = file.size > 0 ? Math.round((ev.loadedBytes / file.size) * 100) : 0;
      onProgress(Math.min(100, percent));
    },
  });

  onProgress(100);

  return {
    publicBlobUrl: sas.publicBlobUrl,
    blobName: sas.blobName,
  };
}
```

O arquivo não passa pelo backend. O backend só entrega uma autorização temporária e limitada.

## 9. Salvar a URL do arquivo após upload

Depois que `uploadData` termina, o blob já está no Azure. O frontend deve chamar um endpoint do seu sistema para salvar a URL do blob no banco.

Exemplo:

```ts
async function saveUploadedFileUrl(params: {
  roomId: string;
  fileId: string;
  hotelId: string;
  publicBlobUrl: string;
}) {
  const res = await fetch(
    `/api/admin/rooms/${params.roomId}/files/${encodeURIComponent(params.fileId)}/url`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelId: params.hotelId,
        publicBlobUrl: params.publicBlobUrl,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Não foi possível salvar a URL do arquivo.");
  }
}
```

No fluxo de `/admin/rooms/new`, isso é feito após cada upload para associar a `publicBlobUrl` ao `fileId` do registro.

## 10. Fluxo completo em uma tela

Versão simples, sem retomada/offline:

```ts
async function handleSubmit(files: File[]) {
  const items = files.map((file) => ({
    file,
    fileId: crypto.randomUUID(),
  }));

  // 1. Crie o registro no seu backend e gere um fileId para cada arquivo.
  const createRes = await fetch("/api/admin/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // campos do formulário...
      hotelId,
      pendingFiles: items.map((item) => ({
        fileId: item.fileId,
        fileName: item.file.name,
      })),
    }),
  });

  const created = await createRes.json();

  if (!createRes.ok) {
    throw new Error(created.error || "Não foi possível criar o registro.");
  }

  // 2. Para cada arquivo: pedir SAS, subir para Azure e salvar URL no banco.
  for (const item of items) {
    const sasRes = await fetch(
      `/api/admin/rooms/${created.roomId}/files/${encodeURIComponent(item.fileId)}/upload-sas`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId,
        }),
      },
    );

    const sas = await sasRes.json();

    if (!sasRes.ok) {
      throw new Error(sas.error || "Não foi possível obter SAS de upload.");
    }

    const client = new BlockBlobClient(sas.uploadUrl);

    await client.uploadData(item.file, {
      blockSize: 4 * 1024 * 1024,
      concurrency: 3,
      blobHTTPHeaders: {
        blobContentType: item.file.type || "application/pdf",
      },
      onProgress: (ev) => {
        const percent =
          item.file.size > 0 ? Math.round((ev.loadedBytes / item.file.size) * 100) : 0;
        console.log(item.file.name, Math.min(100, percent));
      },
    });

    await saveUploadedFileUrl({
      roomId: created.roomId,
      fileId: item.fileId,
      hotelId,
      publicBlobUrl: sas.publicBlobUrl,
    });
  }
}
```

O ponto importante é manter o `fileId` junto com cada `File`. Esse ID liga o arquivo escolhido no browser ao registro criado no banco e também ao blob que recebeu o SAS.

## 11. Checklist de implementação

1. Criar Storage Account e container.
2. Dar ao backend permissão `Storage Blob Data Contributor`.
3. Configurar `AZURE_STORAGE_ACCOUNT_NAME` e `AZURE_STORAGE_UPLOADS_CONTAINER`.
4. Instalar `@azure/identity` e `@azure/storage-blob`.
5. Criar função que gera `blobName` seguro.
6. Criar função backend que chama `getUserDelegationKey` e `generateBlobSASQueryParameters`.
7. Expor endpoint autenticado para retornar `uploadUrl`, `publicBlobUrl`, `blobName` e `expiresOn`.
8. No frontend, pedir SAS e fazer upload com `new BlockBlobClient(uploadUrl).uploadData(file)`.
9. Após upload concluído, salvar `publicBlobUrl` no banco.

## 12. Cuidados importantes

- Gere SAS sempre no backend, nunca no browser.
- Use TTL curto, por exemplo 10 minutos.
- Gere SAS para um blob específico, não para o container inteiro.
- Use permissões mínimas: para upload inicial, `cw` costuma ser suficiente.
- Valide autenticação/autorização antes de emitir SAS.
- Valide tipo, extensão e tamanho do arquivo antes de emitir SAS.
- Salve no banco a URL sem SAS (`publicBlobUrl`), não a `uploadUrl`.
- Se o container for privado, a `publicBlobUrl` é apenas uma referência estável; para download/leitura você precisará de outro fluxo de autorização.
