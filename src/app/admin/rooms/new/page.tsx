import { auth } from "@/auth";
import { ListAdminHotelsUseCase } from "@/application/rooms/use-cases/list-admin-hotels.use-case";
import { ListAdminRoomTypesForHotelUseCase } from "@/application/rooms/use-cases/list-admin-room-types-for-hotel.use-case";
import { container } from "@/di/container";
import { HotelliNavbar } from "@/presentation/features/home/components/hotelli-navbar";
import { RegisterRoomForm } from "@/presentation/features/admin/rooms/components/register-room-form";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Novo quarto — hotelli",
  description: "Registar um quarto e anexar PDFs informativos.",
};

export default async function AdminNewRoomPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const listHotels = container.get(ListAdminHotelsUseCase);
  const listTypes = container.get(ListAdminRoomTypesForHotelUseCase);
  const hotels = await listHotels.execute();
  const initialRoomTypes = hotels[0] ? await listTypes.execute(hotels[0].id) : [];

  return (
    <>
      <HotelliNavbar />
      <main className="flex flex-1 flex-col bg-neutral-50 px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Novo quarto</h1>
          <p className="mt-2 text-sm text-neutral-600">
            O quarto é criado de imediato no MongoDB; cada PDF recebe um <code className="text-xs">fileId</code>{" "}
            (UUID) e o URL no Azure preenche-se em seguida, à medida dos uploads. Até 12 PDFs (máx. 250 MB
            cada).
          </p>
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-hotel-sm sm:p-8">
            <RegisterRoomForm hotels={hotels} initialRoomTypes={initialRoomTypes} />
          </div>
        </div>
      </main>
    </>
  );
}
