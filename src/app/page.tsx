import { AvailabilitySearch } from "@/presentation/features/home/components/availability-search";
import { HotelliNavbar } from "@/presentation/features/home/components/hotelli-navbar";

export default function Home() {
  return (
    <>
      <HotelliNavbar />
      <main className="flex flex-1 flex-col bg-neutral-50">
        <section className="border-b border-neutral-200 bg-gradient-to-br from-primary-50 via-white to-secondary-50 px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 sm:text-sm">
              Reservas online
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
              O teu quarto ideal em Lisboa, com o conforto{" "}
              <span className="text-secondary-600">hotelli</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              Escolhe as datas, vê disponibilidade em tempo real e compara tipos de quarto com fotos e
              preços transparentes.
            </p>
          </div>
        </section>
        <AvailabilitySearch />
      </main>
    </>
  );
}
