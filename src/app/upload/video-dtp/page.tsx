import { auth } from "@/auth";
import { AppNavbar } from "@/presentation/features/home/components/app-navbar";
import { VideoDtpUploader } from "@/presentation/features/dtp/components/video-dtp-uploader";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Upload video to create DTP — Upload SAS",
  description: "Transforme gravações de ecrã em documentação passo a passo em PDF.",
};

export default async function VideoDtpPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <AppNavbar />
      <main className="flex flex-1 flex-col bg-neutral-50 px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Upload video to create DTP
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Carregue um vídeo existente ou grave o ecrã diretamente no browser (janela do navegador
            ou ecrã inteiro). Após confirmar o vídeo, o sistema extrai capturas, analisa os passos
            com IA e gera um documento PDF com instruções e screenshots — documentação operacional
            (DTP).
          </p>
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-surface-sm sm:p-8">
            <VideoDtpUploader />
          </div>
        </div>
      </main>
    </>
  );
}
