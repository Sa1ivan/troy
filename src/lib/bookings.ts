import { buildInventory, findCategory, quoteStay, roomCapacity, type CategoryId, type NightPrice, type Room } from "./catalog";
import {
  containsNight, eachNight, isDate, overlaps, overlapNights, season, stayError, type DateRange, type Stay,
} from "./dates";

export type Contact = { name: string; phone: string };
export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export type Booking = {
  id: string;
  categoryId: CategoryId | null;
  roomId: string | null;
  stay: Stay;
  contact: Contact;
  status: BookingStatus;
  source: "site" | "manual";
  nights: NightPrice[];
  total: number;
};

export type Block = { id: string; roomId: string; range: DateRange; reason: string };
export type Payment = { id: string; bookingId: string; date: string; amount: number };
export type HotelState = { rooms: Room[]; bookings: Booking[]; blocks: Block[]; payments: Payment[] };

export type Command =
  | { type: "request"; id: string; categoryId: CategoryId; stay: Stay; contact: Contact }
  | { type: "confirm"; id: string; roomId: string; total: number }
  | { type: "reject" | "cancel" | "unblock"; id: string }
  | { type: "manualBooking"; id: string; roomId: string; stay: Stay; contact: Contact; total: number; expectedCategoryId?: CategoryId | null }
  | { type: "block"; id: string; roomId: string; range: DateRange; reason: string }
  | { type: "payment"; id: string; bookingId: string; date: string; amount: number }
  | { type: "room"; id: string; changes: Partial<Pick<Room, "label" | "floor" | "categoryId">> };

export class BookingError extends Error {}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && !phone.trim().startsWith("+")) return "+7" + digits;
  if (digits.length === 11 && digits.startsWith("8") && !phone.trim().startsWith("+")) return "+7" + digits.slice(1);
  return "+" + digits;
}

function validContact(contact: Contact): Contact {
  const name = contact.name.trim();
  const phone = normalizePhone(contact.phone);
  if (name.length < 2 || name.length > 80) throw new BookingError("Введите имя от 2 до 80 символов.");
  if (!/^\+[1-9]\d{9,14}$/.test(phone) || !/^[\d+()\s-]+$/.test(contact.phone)) {
    throw new BookingError("Введите телефон с кодом страны или номер из 10 цифр.");
  }
  return { name, phone };
}

export function parseAmount(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

export function occupiedRanges(state: HotelState, roomId: string) {
  return [
    ...state.bookings.filter((booking) => booking.roomId === roomId && booking.status === "confirmed")
      .map((booking) => ({ kind: "booking" as const, range: booking.stay, record: booking })),
    ...state.blocks.filter((block) => block.roomId === roomId)
      .map((block) => ({ kind: "block" as const, range: block.range, record: block })),
  ];
}

export function availableRooms(state: HotelState, categoryId: CategoryId, stay: Stay): Room[] {
  const category = findCategory(categoryId);
  if (!category || stay.guests > category.capacity || stayError(stay)) return [];
  return state.rooms.filter((room) => room.categoryId === categoryId
    && stay.guests <= roomCapacity(room)
    && !occupiedRanges(state, room.id).some(({ range }) => overlaps(range, stay)));
}

export function paidFor(state: HotelState, bookingId: string): number {
  return state.payments.filter((payment) => payment.bookingId === bookingId)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function outstanding(state: HotelState, booking: Booking): number {
  return booking.status === "confirmed" ? booking.total - paidFor(state, booking.id) : 0;
}

function requireRoom(state: HotelState, id: string): Room {
  const room = state.rooms.find((entry) => entry.id === id);
  if (!room) throw new BookingError("Комната не найдена.");
  return room;
}

function requireBooking(state: HotelState, id: string, status: BookingStatus): Booking {
  const booking = state.bookings.find((entry) => entry.id === id);
  if (!booking || booking.status !== status) throw new BookingError("Статус брони изменился. Откройте её снова.");
  return booking;
}

function requireFree(state: HotelState, roomId: string, next: DateRange) {
  if (occupiedRanges(state, roomId).some(({ range }) => overlaps(range, next))) {
    throw new BookingError("Даты пересекаются с другой бронью или закрытием этой комнаты.");
  }
}

function requireStay(stay: Stay, capacity?: number) {
  const error = stayError(stay);
  if (error) throw new BookingError(error);
  if (capacity && stay.guests > capacity) throw new BookingError("В этой категории меньше мест.");
}

function requireAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new BookingError("Укажите сумму больше нуля в рублях.");
  }
}

function confirm(booking: Booking, room: Room, total: number) {
  requireAmount(total);
  const estimate = booking.categoryId ? quoteStay(booking.categoryId, booking.stay) : null;
  const dates = eachNight(booking.stay);
  const weight = estimate?.total ?? dates.length;
  let cumulativeWeight = 0;
  let assigned = 0;
  booking.nights = dates.map((date, index) => {
    cumulativeWeight += estimate?.nights[index].amount ?? 1;
    const cumulativeAmount = Number(BigInt(total) * BigInt(cumulativeWeight) / BigInt(weight));
    const amount = cumulativeAmount - assigned;
    assigned = cumulativeAmount;
    return { date, amount };
  });
  booking.roomId = room.id;
  booking.status = "confirmed";
  booking.total = total;
}

export function applyCommand(state: HotelState, command: Command): void {
  switch (command.type) {
    case "request": {
      const category = findCategory(command.categoryId);
      if (!category) throw new BookingError("Категория не найдена.");
      requireStay(command.stay, category.capacity);
      const contact = validContact(command.contact);
      if (!availableRooms(state, command.categoryId, command.stay).length) {
        throw new BookingError("На эти даты больше нет свободных комнат этой категории.");
      }
      if (state.bookings.some(({ id }) => id === command.id)) throw new BookingError("Заявка уже сохранена.");
      state.bookings.push({
        id: command.id, categoryId: command.categoryId, stay: command.stay, contact,
        status: "pending", source: "site", roomId: null, nights: [], total: 0,
      });
      return;
    }
    case "confirm": {
      const booking = requireBooking(state, command.id, "pending");
      const room = requireRoom(state, command.roomId);
      if (room.categoryId !== booking.categoryId) throw new BookingError("Комната относится к другой категории.");
      requireStay(booking.stay, roomCapacity(room));
      requireFree(state, room.id, booking.stay);
      confirm(booking, room, command.total);
      return;
    }
    case "reject":
      requireBooking(state, command.id, "pending").status = "rejected";
      return;
    case "cancel":
      requireBooking(state, command.id, "confirmed").status = "cancelled";
      return;
    case "manualBooking": {
      const room = requireRoom(state, command.roomId);
      if (command.expectedCategoryId !== undefined && command.expectedCategoryId !== room.categoryId) {
        throw new BookingError("Категория комнаты изменилась. Проверьте стоимость перед сохранением.");
      }
      const contact = validContact(command.contact);
      requireStay(command.stay, roomCapacity(room));
      requireFree(state, room.id, command.stay);
      if (state.bookings.some(({ id }) => id === command.id)) throw new BookingError("Бронь уже сохранена.");
      const booking: Booking = {
        id: command.id, categoryId: room.categoryId, stay: command.stay, contact,
        status: "pending", source: "manual", roomId: null, nights: [], total: 0,
      };
      confirm(booking, room, command.total);
      state.bookings.push(booking);
      return;
    }
    case "block": {
      requireRoom(state, command.roomId);
      requireStay({ ...command.range, guests: 1 });
      requireFree(state, command.roomId, command.range);
      const reason = command.reason.trim();
      if (!reason || reason.length > 120) throw new BookingError("Укажите причину закрытия, до 120 символов.");
      if (state.blocks.some(({ id }) => id === command.id)) throw new BookingError("Даты уже закрыты.");
      state.blocks.push({ id: command.id, roomId: command.roomId, range: command.range, reason });
      return;
    }
    case "unblock":
      state.blocks = state.blocks.filter((block) => block.id !== command.id);
      return;
    case "payment": {
      const booking = requireBooking(state, command.bookingId, "confirmed");
      requireAmount(command.amount);
      if (!isDate(command.date)) throw new BookingError("Укажите дату поступления.");
      if (command.amount > outstanding(state, booking)) throw new BookingError("Платёж превышает остаток к оплате.");
      if (state.payments.some(({ id }) => id === command.id)) throw new BookingError("Платёж уже сохранён.");
      state.payments.push({ id: command.id, bookingId: command.bookingId, date: command.date, amount: command.amount });
      return;
    }
    case "room": {
      const room = requireRoom(state, command.id);
      const { label = room.label, floor = room.floor, categoryId = room.categoryId } = command.changes;
      const name = label.trim();
      if (!name || name.length > 48) throw new BookingError("Укажите подпись комнаты, до 48 символов.");
      if (floor !== null && (!Number.isInteger(floor) || floor < 1 || (room.building === 1 && floor > 6))) {
        throw new BookingError("Укажите этаж комнаты. В первом корпусе шесть этажей.");
      }
      if (categoryId && !findCategory(categoryId)) throw new BookingError("Категория не найдена.");
      if (state.rooms.some((entry) => entry.id !== room.id && entry.building === room.building && entry.label.toLowerCase() === name.toLowerCase())) {
        throw new BookingError("В этом корпусе уже есть комната с такой подписью.");
      }
      Object.assign(room, { label: name, floor, categoryId });
    }
  }
}

export function getReport(state: HotelState, range: DateRange) {
  const confirmed = state.bookings.filter((booking) => booking.status === "confirmed");
  const inPeriod = (date: string) => containsNight(range, date);
  const roomNights = overlapNights(range, season);
  const buildings = ([1, 2] as const).map((building) => {
    const roomIds = new Set(state.rooms.filter((room) => room.building === building).map(({ id }) => id));
    const occupiedNights = confirmed.filter((booking) => booking.roomId && roomIds.has(booking.roomId))
      .reduce((sum, booking) => sum + overlapNights(booking.stay, range), 0);
    const closedNights = state.blocks.filter((block) => roomIds.has(block.roomId))
      .reduce((sum, block) => sum + overlapNights(block.range, range), 0);
    const sellableNights = roomIds.size * roomNights - closedNights;
    return { building, occupiedNights, sellableNights, occupancy: sellableNights ? occupiedNights / sellableNights * 100 : 0 };
  });
  const occupiedNights = buildings.reduce((sum, building) => sum + building.occupiedNights, 0);
  const sellableNights = buildings.reduce((sum, building) => sum + building.sellableNights, 0);
  return {
    occupiedNights, sellableNights, buildings,
    occupancy: sellableNights ? occupiedNights / sellableNights * 100 : 0,
    arrivals: confirmed.filter((booking) => inPeriod(booking.stay.checkIn)).length,
    departures: confirmed.filter((booking) => inPeriod(booking.stay.checkOut)).length,
    revenue: confirmed.reduce((sum, booking) =>
      sum + booking.nights.filter((night) => inPeriod(night.date)).reduce((total, night) => total + night.amount, 0), 0),
    received: state.payments.filter((payment) => inPeriod(payment.date)).reduce((sum, payment) => sum + payment.amount, 0),
  };
}

export function createDemoState(): HotelState {
  const state: HotelState = { rooms: buildInventory(), bookings: [], blocks: [], payments: [] };
  applyCommand(state, {
    type: "manualBooking", id: "TR-DEMO1", roomId: "b1-suite-1-1",
    stay: { checkIn: "2027-06-06", checkOut: "2027-06-11", guests: 5 }, total: 3000000,
    contact: { name: "Марина (демо)", phone: "+70000000001" },
  });
  applyCommand(state, { type: "payment", id: "demo-payment", bookingId: "TR-DEMO1", date: "2027-06-02", amount: 900000 });
  applyCommand(state, {
    type: "manualBooking", id: "TR-DEMO2", roomId: "b1-suite-2-2",
    stay: { checkIn: "2027-06-19", checkOut: "2027-06-24", guests: 6 }, total: 3500000,
    contact: { name: "Алексей (демо)", phone: "+70000000002" },
  });
  applyCommand(state, {
    type: "request", id: "TR-DEMO3", categoryId: "standard-twin",
    stay: { checkIn: "2027-06-20", checkOut: "2027-06-24", guests: 2 },
    contact: { name: "Нина (демо)", phone: "+70000000003" },
  });
  applyCommand(state, {
    type: "block", id: "demo-block", roomId: "b1-suite-1-2",
    range: { checkIn: "2027-06-03", checkOut: "2027-06-06" }, reason: "Подготовка номера",
  });
  return state;
}
