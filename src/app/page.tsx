import { AppNavbar } from "@/presentation/features/home/components/app-navbar";
import { AvailabilitySearch } from "@/presentation/features/home/components/availability-search";

export default function Home() {
  return (
    <>
      <AppNavbar />
      <main className="flex flex-1 flex-col bg-neutral-50">
        <section className="border-b border-neutral-200 bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 sm:text-sm">
              Demonstração
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
              Sistema de exemplo para{" "}
              <span className="text-secondary-600">upload de ficheiros</span> com URLs assinadas (SAS).
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              Abaixo podes explorar o fluxo de pesquisa e anexos; no backoffice registas destinos e envias PDFs
              para o Azure com a mesma pipeline de delegação e retoma local.
            </p>
          </div>
        </section>
        <AvailabilitySearch />
      </main>
    </>
  );
}
