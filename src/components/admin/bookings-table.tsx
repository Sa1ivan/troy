"use client";

import { ClipboardList, Search } from "lucide-react";
import { useState } from "react";
import { bookingRoomRanges, normalizePhone, outstanding, type BookingStatus, type HotelState } from "@/lib/bookings";
import { findCategory, money } from "@/lib/catalog";
import { countLabel, dateLabel, hotelToday, stayLabel } from "@/lib/dates";
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

type BookingListProps = { state: HotelState; onBooking: (id: string) => void };

function Today({ state, onBooking }: BookingListProps) {
  const today = hotelToday();
  const bookings = state.bookings.filter(({ status, roomHistory }) => status === "confirmed" || !!roomHistory?.length);
  const schedules = [
    { label: "Заезды", field: "checkIn", empty: "Заездов сегодня нет." },
    { label: "Выезды", field: "checkOut", empty: "Выездов сегодня нет." },
  ] as const;
  return (
    <section className="today-panel" aria-labelledby="today-heading">
      <div className="today-heading"><h2 id="today-heading">Сегодня</h2><time dateTime={today}>{dateLabel(today)}</time></div>
      <div className="today-schedules">
        {schedules.map(({ label, field, empty }) => {
          const entries = bookings.filter(({ stay }) => stay[field] === today);
          return <div key={field}>
            <h3>{label}</h3>
            {!entries.length ? <p className="muted">{empty}</p> : <ul>
              {entries.map((booking) => {
                const ranges = bookingRoomRanges(booking);
                const roomId = (field === "checkIn" ? ranges[0] : ranges.at(-1))?.roomId;
                const room = state.rooms.find(({ id }) => id === roomId);
                const due = outstanding(state, booking);
                return <li key={booking.id}>
                  <button type="button" className="table-name" onClick={() => onBooking(booking.id)}>{booking.contact.name}</button>
                  <small>{room ? "Корпус " + room.building + " · " + room.label : "Комната уточняется"}</small>
                  <small>{due > 0 ? "К доплате " + money(due) : due < 0 ? "Переплата " + money(-due) : "Доплаты нет"}</small>
                </li>;
              })}
            </ul>}
          </div>;
        })}
      </div>
    </section>
  );
}

export function BookingsTable({ state, onBooking }: BookingListProps) {
  const [filter, setFilter] = useState<"all" | BookingStatus>("all");
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("ru");
  const digits = /^[+\d()\s-]+$/.test(query) ? query.replace(/\D/g, "") : "";
  const phoneQuery = digits ? normalizePhone(query) : "";
  const rows = [...state.bookings].reverse().filter(({ status, contact, id }) => (
    (filter === "all" || status === filter) && (!query || contact.name.toLocaleLowerCase("ru").includes(query)
      || id.toLowerCase().includes(query) || !!digits && (contact.phone.includes(digits) || contact.phone === phoneQuery))
  ))
    .sort((first, second) => Number(second.status === "pending") - Number(first.status === "pending"));
  return (
    <>
      <Today state={state} onBooking={onBooking} />
      <section aria-labelledby="bookings-heading">
        <div className="admin-section-heading">
          <h2 id="bookings-heading">Заявки и брони</h2>
          <div className="calendar-filters journal-filters">
            <label className="compact-field">Поиск по журналу
              <div className="icon-input"><Search size={16} aria-hidden="true" /><input type="search" placeholder="Имя, телефон или номер" value={search}
                onChange={(event) => setSearch(event.target.value)} /></div>
            </label>
            <SelectField className="compact-field" label="Статус" value={filter} onChange={(value) => setFilter(value as typeof filter)}
              options={[{ value: "all", label: "Все статусы" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
          </div>
        </div>
        {rows.length ? (
          <div className="table-scroll admin-table-wrap" tabIndex={0} aria-label="Список заявок и броней">
            <table className="admin-table" aria-label="Журнал заявок и броней">
              <thead><tr><th scope="col">Гость</th><th scope="col">Проживание</th><th scope="col">Категория и комната</th><th scope="col">Статус</th><th scope="col">Стоимость</th></tr></thead>
              <tbody>{rows.map((booking) => {
                const room = state.rooms.find(({ id }) => id === booking.roomId);
                return (
                  <tr key={booking.id}>
                    <th scope="row"><button type="button" className="table-name" onClick={() => onBooking(booking.id)}>{booking.contact.name}</button><small>{booking.id} · {booking.source === "site" ? "Сайт" : "Вручную"}</small></th>
                    <td>{stayLabel(booking.stay)}<small>{countLabel(booking.stay.guests, ["гость", "гостя", "гостей"])}</small></td>
                    <td>{findCategory(booking.categoryId)?.name ?? "Категория уточняется"}
                      <small>{room ? "Корпус " + room.building + " · " + room.label : "Комната ещё не назначена"}</small></td>
                    <td><BookingStatusLabel status={booking.status} /></td>
                    <td>{booking.total ? money(booking.total) : "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <p className="empty-state"><ClipboardList size={24} aria-hidden="true" /> По выбранным условиям заявок и броней нет.</p>}
      </section>
    </>
  );
}
