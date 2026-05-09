"use server";

import { searchAvailabilityInputSchema } from "@/application/availability/dtos/search-availability.schema";
import { SearchRoomAvailabilityUseCase } from "@/application/availability/use-cases/search-room-availability.use-case";
import { container } from "@/di/container";
import { actionClient } from "@/lib/safe-action";

export const searchAvailabilityAction = actionClient
  .schema(searchAvailabilityInputSchema)
  .action(async ({ parsedInput }) => {
    const uc = container.get(SearchRoomAvailabilityUseCase);
    const out = await uc.execute(parsedInput);
    if (!out.ok) {
      const msg =
        out.code === "INVALID_DATES"
          ? "Datas inválidas."
          : out.code === "PAST_CHECK_IN"
            ? "O check-in não pode ser no passado."
            : out.code === "HOTEL_NOT_FOUND"
              ? "Contexto da pesquisa não encontrado."
              : out.code === "INVALID_GUESTS"
                ? "Número de hóspedes inválido."
                : out.code === "ERROR"
                ? out.message
                : "Não foi possível pesquisar.";
      throw new Error(msg);
    }
    return out.data;
  });
