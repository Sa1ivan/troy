"use client";

import { ClipboardList } from "lucide-react";
import { useState } from "react";
import type { BookingStatus, HotelState } from "@/lib/bookings";
import { findCategory, money } from "@/lib/catalog";
import { stayLabel } from "@/lib/dates";
import { SelectField } from "../controls";

export const statusLabels: Record<BookingStatus, string> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждена",
  rejected: "Отклонена",
  cancelled: "Отменена",
};

export function BookingStatusLabel({ status }: { status: BookingStatus }) {
  return <span className={"booking-tag tag-" + status}>{statusLabels[status]}</span>;
}

export function BookingsTable({ state, onBooking }: { state: HotelState; onBooking: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | BookingStatus>("all");
  const rows = [...state.bookings].reverse().filter(({ status }) => filter === "all" || status === filter)
    .sort((first, second) => Number(second.status === "pending") - Number(first.status === "pending"));
  return (
    <section aria-labelledby="bookings-heading">
      <div className="admin-section-heading">
        <div><h2 id="bookings-heading">Заявки и брони</h2><p>Откройте заявку, чтобы назначить комнату или внести оплату.</p></div>
        <SelectField className="compact-field" label="Статус" value={filter} onChange={(value) => setFilter(value as typeof filter)}
          options={[{ value: "all", label: "Все статусы" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
      </div>
      {rows.length ? (
        <div className="table-scroll admin-table-wrap" tabIndex={0} aria-label="Список заявок и броней">
          <table className="admin-table">
            <thead><tr><th scope="col">Гость</th><th scope="col">Проживание</th><th scope="col">Категория и комната</th><th scope="col">Статус</th><th scope="col">Стоимость</th></tr></thead>
            <tbody>{rows.map((booking) => {
              const room = state.rooms.find(({ id }) => id === booking.roomId);
              return (
                <tr key={booking.id}>
                  <th scope="row"><button type="button" className="table-name" onClick={() => onBooking(booking.id)}>{booking.contact.name}</button><small>{booking.id} · {booking.source === "site" ? "Сайт" : "Вручную"}</small></th>
                  <td>{stayLabel(booking.stay)}<small>Гостей: {booking.stay.guests}</small></td>
                  <td>{findCategory(booking.categoryId)?.name ?? "Категория уточняется"}
                    <small>{room ? "Корпус " + room.building + " · " + room.label : "Комната ещё не назначена"}</small></td>
                  <td><BookingStatusLabel status={booking.status} /></td>
                  <td>{booking.total ? money(booking.total) : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <p className="empty-state"><ClipboardList size={24} aria-hidden="true" /> Заявок и броней с этим статусом пока нет.</p>}
    </section>
  );
}
