import { HotelliNavbar } from "@/presentation/features/home/components/hotelli-navbar";
import { PdfMultiPicker } from "@/presentation/features/upload/components/pdf-multi-picker";

export const metadata = {
  title: "Upload de PDFs — hotelli",
  description: "Upload direto de PDFs para o Azure Blob Storage (SAS).",
};

export default function UploadPdfsPage() {
  return (
    <>
      <HotelliNavbar />
      <main className="flex flex-1 flex-col bg-neutral-50 px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Upload de PDFs</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Até 15 ficheiros PDF (máx. 250 MB cada). O pedido de SAS e o write usam a mesma lógica de{" "}
            <code className="rounded bg-neutral-100 px-1 text-xs">/api/test-sas</code> (user delegation). Clica
            em &quot;Enviar para o Azure&quot; após selecionar os ficheiros.
          </p>
          <div className="mt-8">
            <PdfMultiPicker />
          </div>
        </div>
      </main>
    </>
  );
}
