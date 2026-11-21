"use client";

import { useRef, useState, type FormEvent } from "react";
import { availableRooms, outstanding, paidFor, parseAmount, type Block, type Booking, type Command, type HotelState } from "@/lib/bookings";
import { categories, findCategory, money, quoteStay, roomCapacity, type CategoryId, type Room } from "@/lib/catalog";
import { countLabel, dateLabel, hotelToday, nightsBetween, stayLabel, type DateRange } from "@/lib/dates";
import { newRecordId } from "@/lib/storage";
import { DateField, SelectField } from "../controls";
import { Dialog } from "../dialog";
import { useHotel } from "../hotel-provider";
import { BookingStatusLabel } from "./bookings-table";

function useCommand() {
  const { dispatch } = useHotel();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function execute(command: Command, onSuccess?: () => void) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await dispatch(command);
      onSuccess?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить изменение.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, execute, clear: () => setError("") };
}

export function BookingDialog({ state, booking, onCalendar, onClose }: {
  state: HotelState; booking: Booking; onCalendar: () => void; onClose: () => void;
}) {
  const { busy, error, execute, clear } = useCommand();
  const [roomId, setRoomId] = useState("");
  const [action, setAction] = useState<"reject" | "cancel" | null>(null);
  const [paymentDate, setPaymentDate] = useState(hotelToday);
  const [goToCalendar, setGoToCalendar] = useState(false);
  const room = state.rooms.find(({ id }) => id === booking.roomId);
  const category = findCategory(booking.categoryId);
  const estimate = category ? quoteStay(category.id, booking.stay) : null;
  const rooms = category && booking.status === "pending" ? availableRooms(state, category.id, booking.stay) : [];
  const payments = state.payments.filter(({ bookingId }) => bookingId === booking.id).sort((a, b) => a.date.localeCompare(b.date));
  const paid = paidFor(state, booking.id);
  const balance = outstanding(state, booking);

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void execute({ type: "confirm", id: booking.id, roomId, total: parseAmount(String(data.get("total"))) });
  }

  function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void execute({ type: "payment", id: newRecordId(), bookingId: booking.id,
      amount: parseAmount(String(data.get("amount"))), date: String(data.get("date")),
    }, () => { const amount = form.elements.namedItem("amount"); if (amount instanceof HTMLInputElement) amount.value = ""; });
  }

  return (
    <Dialog title={booking.contact.name} dismiss={goToCalendar} onClose={goToCalendar ? onCalendar : onClose}>
      <div className="booking-dialog-header"><BookingStatusLabel status={booking.status} /><span>{booking.id}</span></div>
      <dl className="record-details">
        <div><dt>Даты</dt><dd>{stayLabel(booking.stay)}</dd></div>
        <div><dt>Гости</dt><dd>{booking.stay.guests}</dd></div>
        <div><dt>Категория</dt><dd>{category?.name ?? "Уточняется"}</dd></div>
        <div><dt>Телефон</dt><dd><a href={"tel:" + booking.contact.phone}>{booking.contact.phone}</a></dd></div>
        {room && <div><dt>Комната</dt><dd>Корпус {room.building} · {room.label}</dd></div>}
      </dl>
      {booking.status === "pending" && (
        <form onSubmit={confirm} className="field-stack dialog-form view-enter">
          <SelectField label="Комната" value={roomId} placeholder="Выберите комнату" onChange={(next) => { setRoomId(next); clear(); }}
            options={rooms.map((entry) => ({ value: entry.id, label: "Корпус " + entry.building + " · " + entry.label }))} />
          {!rooms.length && <p className="notice">Свободных комнат этой категории на все даты сейчас нет.</p>}
          <label>Стоимость проживания, ₽<input name="total" inputMode="decimal" required defaultValue={estimate ? String(estimate.total / 100) : ""} /></label>
          <div className="button-row">
            <button className="button button-primary" type="submit" disabled={busy || !rooms.some(({ id }) => id === roomId)}>Подтвердить бронь</button>
            <button className="button button-outline" type="button" disabled={busy} onClick={() => { clear(); setAction("reject"); }}>Отклонить заявку</button>
          </div>
        </form>
      )}
      {(booking.status === "confirmed" || (booking.status === "cancelled" && payments.length > 0)) && (
        <div className="dialog-form view-enter" aria-label="Оплаты">
          <dl className="finance-summary">
            <div><dt>Стоимость</dt><dd>{money(booking.total)}</dd></div>
            <div><dt>Оплачено</dt><dd>{money(paid)}</dd></div>
            {booking.status === "confirmed" && <div><dt>Остаток</dt><dd>{money(balance)}</dd></div>}
          </dl>
          {payments.length > 0 && (
            <ul className="payments-list" aria-label="Внесённые оплаты">
              {payments.map(({ id, date, amount }) => <li key={id}><time dateTime={date}>{dateLabel(date)} {date.slice(0, 4)}</time><strong>{money(amount)}</strong></li>)}
            </ul>
          )}
          {booking.status === "confirmed" && (
            <>
              {balance > 0 && (
                <form className="field-stack payment-form" onSubmit={pay}>
                  <div className="inline-fields">
                    <label>Сумма платежа, ₽<input name="amount" inputMode="decimal" required placeholder="0" /></label>
                    <DateField label="Дата платежа" name="date" value={paymentDate} onChange={setPaymentDate} />
                  </div>
                  <button className="button button-primary" type="submit" disabled={busy}>Внести оплату</button>
                </form>
              )}
              <div className="button-row booking-dialog-actions">
                <button type="button" className="button button-outline" onClick={() => setGoToCalendar(true)}>Показать в шахматке</button>
                <button type="button" className="text-button danger-text" disabled={busy} onClick={() => { clear(); setAction("cancel"); }}>Отменить бронь</button>
              </div>
            </>
          )}
        </div>
      )}
      {action && ((action === "reject" && booking.status === "pending") || (action === "cancel" && booking.status === "confirmed")) && (
        <div className="confirmation-box">
          <p>{action === "cancel" ? "Отменить бронь и освободить даты?" : "Отклонить заявку гостя?"}</p>
          <div className="button-row">
            <button className="button button-danger" type="button" disabled={busy}
              onClick={() => void execute({ type: action, id: booking.id }, () => setAction(null))}>
              {action === "cancel" ? "Подтвердить отмену" : "Подтвердить отклонение"}
            </button>
            <button className="button button-outline" type="button" onClick={() => { clear(); setAction(null); }}>Назад</button>
          </div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Dialog>
  );
}

export function RangeDialog({ room, range, onClose }: { room: Room; range: DateRange; onClose: () => void }) {
  const [mode, setMode] = useState<"booking" | "block">("booking");
  const [guests, setGuests] = useState(2);
  const [total, setTotal] = useState<string | null>(null);
  const [dismiss, setDismiss] = useState(false);
  const { busy, error, execute, clear } = useCommand();
  const category = findCategory(room.categoryId);
  const capacity = roomCapacity(room);
  const stay = { ...range, guests };
  const estimate = category ? quoteStay(category.id, stay) : null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = newRecordId();
    if (mode === "block") {
      void execute({ type: "block", id, roomId: room.id, range, reason: String(data.get("reason")) }, () => setDismiss(true));
      return;
    }
    void execute({
      type: "manualBooking", id, roomId: room.id, stay, expectedCategoryId: room.categoryId,
      contact: { name: String(data.get("name")), phone: String(data.get("phone")) },
      total: parseAmount(String(data.get("total"))),
    }, () => setDismiss(true));
  }

  return (
    <Dialog title={room.label} dismiss={dismiss} onClose={onClose}>
      <p className="muted">Корпус {room.building} · {stayLabel(range)} · {countLabel(nightsBetween(range), ["ночь", "ночи", "ночей"])}</p>
      <div className="choice-row" aria-label="Действие с датами">
        <button type="button" aria-pressed={mode === "booking"} onClick={() => { clear(); setMode("booking"); }}>Создать бронь</button>
        <button type="button" aria-pressed={mode === "block"} onClick={() => { clear(); setMode("block"); }}>Закрыть даты</button>
      </div>
      <form className="field-stack dialog-form" onSubmit={submit}>
        {mode === "block" ? (
          <label>Причина закрытия<input name="reason" placeholder="Например, ремонт" required maxLength={120} /></label>
        ) : (
          <>
            <label>Имя<input name="name" required minLength={2} maxLength={80} /></label>
            <label>Телефон<input name="phone" type="tel" required maxLength={30} /></label>
            <div className="inline-fields">
              <SelectField label="Гости" value={String(guests)} onChange={(value) => setGuests(Number(value))}
                options={Array.from({ length: capacity }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} />
              <label>Стоимость проживания, ₽
                <input name="total" inputMode="decimal" required value={total ?? (estimate ? String(estimate.total / 100) : "")}
                  onChange={(event) => setTotal(event.target.value)} />
              </label>
            </div>
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary" disabled={busy}>{mode === "block" ? "Сохранить закрытие" : "Сохранить бронь"}</button>
      </form>
    </Dialog>
  );
}

export function BlockDialog({ block, room, onClose }: { block: Block; room?: Room; onClose: () => void }) {
  const { busy, error, execute } = useCommand();
  const [dismiss, setDismiss] = useState(false);
  return (
    <Dialog title="Закрытые даты" dismiss={dismiss} onClose={onClose}>
      <dl className="record-details">
        {room && <div><dt>Комната</dt><dd>Корпус {room.building} · {room.label}</dd></div>}
        <div><dt>Ночи</dt><dd>{stayLabel(block.range)}</dd></div>
        <div><dt>Причина</dt><dd>{block.reason}</dd></div>
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="button button-primary" disabled={busy} onClick={() =>
        void execute({ type: "unblock", id: block.id }, () => setDismiss(true))}>Снять закрытие</button>
    </Dialog>
  );
}

export function RoomDialog({ room, onClose }: { room: Room; onClose: () => void }) {
  const { busy, error, execute } = useCommand();
  const [initial] = useState(room);
  const [category, setCategory] = useState<CategoryId | null>(initial.categoryId);
  const [dismiss, setDismiss] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const label = String(data.get("label")).trim();
    const floor = data.get("floor") ? Number(data.get("floor")) : null;
    const changes = {
      ...(label !== initial.label && { label }),
      ...(floor !== initial.floor && { floor }),
      ...(category !== initial.categoryId && { categoryId: category }),
    };
    void execute({ type: "room", id: room.id, changes }, () => setDismiss(true));
  }
  return (
    <Dialog title="Редактирование комнаты" dismiss={dismiss} onClose={onClose}>
      <p className="muted">Корпус {room.building}</p>
      <form className="field-stack dialog-form" onSubmit={submit}>
        <label>Номер или подпись<input name="label" defaultValue={initial.label} required maxLength={48} /></label>
        <label>Этаж<input name="floor" type="number" min={1} max={room.building === 1 ? 6 : undefined} defaultValue={initial.floor ?? ""} placeholder="Уточняется" /></label>
        <SelectField label="Категория" value={category ?? ""} onChange={(value) => setCategory(value ? value as CategoryId : null)}
          options={[{ value: "", label: "Уточняется" }, ...categories.map(({ id, name }) => ({ value: id, label: name }))]} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary" disabled={busy}>Сохранить комнату</button>
      </form>
    </Dialog>
  );
}
