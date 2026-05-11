import { auth } from "@/auth";
import { AppNavbar } from "@/presentation/features/home/components/app-navbar";
import { AdminRoomDetailPanel } from "@/presentation/features/admin/rooms/components/admin-room-detail-panel";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Detalhes do registo — Upload SAS",
  description: "Informações do quarto, URL dos ficheiros e análise (SOCOS e ideias).",
};

type PageProps = { params: Promise<{ roomId: string }> };

export default async function AdminRoomDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { roomId } = await params;

  return (
    <>
      <AppNavbar />
      <main className="flex flex-1 flex-col bg-neutral-50 px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <Link
            href="/admin/rooms/new"
            className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
          >
            ← Novo registo
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">
            Detalhes do registo
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Consulte URLs no storage e o resultado da análise (passos, SOCOS e ideias). Com a análise
            em curso, os dados actualizam automaticamente nesta página.
          </p>
          <div className="mt-8">
            <AdminRoomDetailPanel roomId={roomId} />
          </div>
        </div>
      </main>
    </>
  );
}
