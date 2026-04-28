# Upload de Arquivos para Azure Blob Storage (Next.js + User Delegation SAS)

Este guia descreve como implementar upload de múltiplos arquivos com:

- Upload paralelo
- Upload em chunks (para arquivos grandes)
- Progresso individual por arquivo

Utilizando a biblioteca `@azure/storage-blob`.

---

# 🧠 Arquitetura

```
Frontend (React)
   ↓ (request SAS)
Next.js API (/api/upload-sas)
   ↓
Azure Blob Storage
```

---

# 📦 1. Backend – Gerar SAS (resumo)

Você já possui isso, mas o endpoint deve:

- Receber: `fileName`, `contentType`
- Retornar: `uploadUrl` (SAS)

---

# 📦 2. Frontend – Estrutura

## Tipagem básica

```ts
type UploadItem = {
  file: File;
  progress: number;
  status: "idle" | "uploading" | "done" | "error";
};
```

---

# ⚙️ 3. Função de Upload (com chunks + progresso)

```ts
import { BlockBlobClient } from "@azure/storage-blob";

export async function uploadSingleFile(
  file: File,
  onProgress: (progress: number) => void
) {
  // 1. pegar SAS
  const res = await fetch("/api/upload-sas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
    }),
  });

  const { uploadUrl } = await res.json();

  // 2. cliente
  const client = new BlockBlobClient(uploadUrl);

  // 3. upload com chunk
  await client.uploadData(file, {
    blockSize: 4 * 1024 * 1024, // 4MB
    concurrency: 3,
    onProgress: (ev) => {
      const percent = Math.round((ev.loadedBytes / file.size) * 100);
      onProgress(percent);
    },
  });
}
```

---

# ⚡ 4. Upload paralelo com limite de concorrência

## Função de fila (worker pool)

```ts
export async function uploadFiles(
  files: File[],
  onFileProgress: (index: number, progress: number) => void
) {
  const concurrency = 3;
  let index = 0;

  async function worker() {
    while (index < files.length) {
      const currentIndex = index++;
      const file = files[currentIndex];

      try {
        await uploadSingleFile(file, (progress) => {
          onFileProgress(currentIndex, progress);
        });
      } catch (err) {
        console.error("Erro upload:", err);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
}
```

---

# 🎯 5. Exemplo em React

```tsx
import { useState } from "react";

export default function UploadComponent() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  function handleFiles(files: FileList) {
    const items: UploadItem[] = Array.from(files).map((file) => ({
      file,
      progress: 0,
      status: "idle",
    }));

    setUploads(items);

    uploadFiles(
      items.map((i) => i.file),
      (index, progress) => {
        setUploads((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            progress,
            status: progress === 100 ? "done" : "uploading",
          };
          return updated;
        });
      }
    );
  }

  return (
    <div>
      <input
        type="file"
        multiple
        onChange={(e) => handleFiles(e.target.files!)}
      />

      {uploads.map((u, i) => (
        <div key={i}>
          <p>{u.file.name}</p>
          <progress value={u.progress} max={100} />
          <span>{u.progress}%</span>
        </div>
      ))}
    </div>
  );
}
```

---

# ⚙️ Configurações recomendadas

| Parâmetro | Valor |
|----------|------|
| blockSize | 4MB |
| concurrency (upload interno) | 3 |
| uploads paralelos | 2–3 |

---

# 🔐 Boas práticas

- Validar tipo de arquivo (PDF)
- Limitar tamanho (250MB)
- Gerar nome único (UUID)
- SAS curto (10 min)

---

# 🚀 Possíveis melhorias

- Retry automático
- Cancelamento (AbortController)
- Barra de progresso global
- Persistência no backend (DB)

---

# 🎯 Resultado final

- Upload direto (sem backend)
- Escalável
- Seguro
- Suporte a arquivos grandes
- UX com progresso em tempo real

