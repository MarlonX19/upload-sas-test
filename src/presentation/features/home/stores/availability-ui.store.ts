import { create } from "zustand";

type AvailabilityUiState = {
  calendarOpen: boolean;
  setCalendarOpen: (open: boolean) => void;
  guestPickerOpen: boolean;
  setGuestPickerOpen: (open: boolean) => void;
};

export const useAvailabilityUiStore = create<AvailabilityUiState>((set) => ({
  calendarOpen: false,
  setCalendarOpen: (open) => set({ calendarOpen: open }),
  guestPickerOpen: false,
  setGuestPickerOpen: (open) => set({ guestPickerOpen: open }),
}));
