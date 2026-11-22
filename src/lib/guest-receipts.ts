import type { Booking, BookingStatus } from "./bookings";
import { quoteStay, type CategoryId } from "./catalog";
import type { Stay } from "./dates";

export type GuestReceipt = {
  id: string;
  categoryId: CategoryId | null;
  stay: Stay;
  status: BookingStatus;
  total: number | null;
};

export function guestReceipt(booking: Booking): GuestReceipt {
  const { id, categoryId, stay, status } = booking;
  const estimate = categoryId ? quoteStay(categoryId, stay)?.total ?? null : null;
  const total = booking.total > 0 ? booking.total : booking.quotedTotal === undefined ? estimate : booking.quotedTotal;
  return { id, categoryId, stay, status, total };
}

export const requestStatusLabels: Record<BookingStatus, string> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждена",
  rejected: "Отклонена",
  cancelled: "Отменена",
};
