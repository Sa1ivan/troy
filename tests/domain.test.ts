import assert from "node:assert/strict";
import test from "node:test";
import { addDays, monthRange, hotelToday } from "../src/lib/dates";
import { buildInventory, findCategory, fromPrice, quoteStay } from "../src/lib/catalog";
import {
  availableRooms, applyCommand, getReport, outstanding, type HotelState,
} from "../src/lib/bookings";

const stay = { checkIn: "2027-06-14", checkOut: "2027-06-16", guests: 2 };
const contact = { name: "Тестовый Гость", phone: "+70000000001" };
const standardId = "standard-dbl";
const makeState = (): HotelState => ({
  rooms: buildInventory().filter((room) => room.categoryId === standardId).slice(0, 2),
  bookings: [],
  blocks: [],
  payments: [],
});

test("сезонный расчёт включает ночь заезда и исключает дату выезда", () => {
  const quote = quoteStay(standardId, stay);
  assert.deepEqual(quote?.nights, [
    { date: "2027-06-14", amount: 450000 },
    { date: "2027-06-15", amount: 500000 },
  ]);
  assert.equal(quote?.total, 950000);
  assert.equal(quoteStay(standardId, { ...stay, guests: 1 })?.total, 650000);
  assert.equal(quoteStay(standardId, { checkIn: "2027-09-30", checkOut: "2027-10-01", guests: 2 })?.total, 400000);
  assert.equal(quoteStay(standardId, { ...stay, checkOut: "2027-10-02" }), null);
  assert.equal(quoteStay("family", { ...stay, guests: 3 }), null);
});

test("календарные даты идут подряд на границе месяцев и учитывают время в Сочи", () => {
  assert.equal(addDays("2028-02-29", 1), "2028-03-01");
  assert.deepEqual(monthRange("2027-06"), { checkIn: "2027-06-01", checkOut: "2027-07-01" });
  assert.equal(hotelToday(new Date("2027-06-14T21:10:00Z")), "2027-06-15");
});

test("фонд соответствует раскладке корпусов и люксов на каждом этаже", () => {
  const rooms = buildInventory();
  const first = rooms.filter((room) => room.building === 1);
  assert.equal(first.length, 64);
  assert.equal(rooms.length, 74);
  assert.equal(new Set(rooms.map((room) => room.id)).size, 74);
  assert.equal(first.filter((room) => room.categoryId === "standard-dbl").length, 27);
  assert.equal(first.filter((room) => room.categoryId === "standard-twin").length, 26);
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((floor) => first.filter((room) => room.categoryId === "suite" && room.floor === floor).length),
    [2, 2, 2, 2, 1, 2],
  );
});

test("заявка не занимает комнату до подтверждения, выезд освобождает дату для заезда", () => {
  const state = makeState();
  const roomId = state.rooms[0].id;
  applyCommand(state, { type: "request", id: "request-1", categoryId: standardId, stay, contact });
  assert.equal(availableRooms(state, standardId, stay).length, 2);
  applyCommand(state, { type: "confirm", id: "request-1", roomId, total: 950000 });
  assert.deepEqual(availableRooms(state, standardId, stay).map((room) => room.id), [state.rooms[1].id]);
  assert.ok(availableRooms(state, standardId, { ...stay, checkIn: stay.checkOut, checkOut: "2027-06-17" })
    .some((room) => room.id === roomId));
  assert.throws(() => applyCommand(state, { type: "block", id: "block-1", roomId, range: stay, reason: "Ремонт" }), /пересекаются/);
  assert.throws(() => applyCommand(state, { type: "manualBooking", id: "manual", roomId, stay, contact, total: 950000 }), /пересекаются/);
  applyCommand(state, { type: "cancel", id: "request-1" });
  assert.equal(availableRooms(state, standardId, stay).length, 2);
});

test("две неполные комнаты не складываются в один доступный номер", () => {
  const state = makeState();
  applyCommand(state, {
    type: "block", id: "block-1", roomId: state.rooms[0].id,
    range: { checkIn: stay.checkIn, checkOut: "2027-06-15" }, reason: "Ремонт",
  });
  applyCommand(state, {
    type: "block", id: "block-2", roomId: state.rooms[1].id,
    range: { checkIn: "2027-06-15", checkOut: stay.checkOut }, reason: "Ремонт",
  });
  assert.equal(availableRooms(state, standardId, stay).length, 0);
  assert.throws(() => applyCommand(state, { type: "request", id: "request-1", categoryId: standardId, stay, contact }), /свободных/);
  applyCommand(state, { type: "unblock", id: "block-1" });
  assert.equal(availableRooms(state, standardId, stay)[0]?.id, state.rooms[0].id);
});

test("оплаты идут по дате внесения, стоимость по ночам, а правка комнаты сохраняет бронь", () => {
  const state = makeState();
  const roomId = state.rooms[0].id;
  applyCommand(state, { type: "manualBooking", id: "manual-1", roomId, stay, contact, total: 950000 });
  applyCommand(state, { type: "payment", id: "payment-1", bookingId: "manual-1", date: "2027-05-22", amount: 300000 });
  applyCommand(state, { type: "room", id: roomId, changes: { label: "208", floor: 2, categoryId: "standard-twin" } });
  const may = getReport(state, monthRange("2027-05"));
  const june = getReport(state, { checkIn: "2027-06-15", checkOut: "2027-06-17" });
  assert.equal(may.received, 300000);
  assert.equal(may.revenue, 0);
  assert.equal(june.received, 0);
  assert.equal(june.revenue, 500000);
  assert.equal(june.departures, 1);
  assert.equal(june.occupiedNights, 1);
  assert.equal(outstanding(state, state.bookings[0]), 650000);
  assert.equal(state.bookings[0].roomId, roomId);
  assert.equal(state.bookings[0].categoryId, standardId);
});

test("изменение одной характеристики комнаты не перезаписывает правку другой вкладки", () => {
  const state = makeState();
  const id = state.rooms[0].id;
  applyCommand(state, { type: "room", id, changes: { categoryId: "economy-dbl" } });
  applyCommand(state, { type: "room", id, changes: { label: "208" } });
  assert.equal(state.rooms[0].categoryId, "economy-dbl");
  assert.equal(state.rooms[0].label, "208");
  assert.throws(() => applyCommand(state, {
    type: "manualBooking", id: "old-form", roomId: id, expectedCategoryId: standardId,
    stay, contact, total: 950000,
  }), /категория комнаты изменилась/i);
});

test("двухместную комнату второго корпуса нельзя забронировать на троих после смены категории", () => {
  const state = makeState();
  const room = buildInventory().find(({ id }) => id === "b2-double-1")!;
  state.rooms = [room];
  assert.throws(() => applyCommand(state, {
    type: "manualBooking", id: "stay", roomId: room.id, stay: { ...stay, guests: 3 }, contact, total: 950000,
  }), /меньше мест/);
  applyCommand(state, { type: "room", id: room.id, changes: { categoryId: "suite" } });
  assert.equal(availableRooms(state, "suite", { ...stay, guests: 3 }).length, 0);
  assert.equal(availableRooms(state, "suite", stay).length, 1);
});

test("цена от учитывает самую низкую ставку за ночь среди известных вариантов", () => {
  assert.equal(fromPrice(findCategory(standardId)!), 250000);
});

test("ручное закрытие сокращает доступный фонд, а отмена брони сохраняет полученную оплату", () => {
  const state = makeState();
  const firstRoomId = state.rooms[0].id;
  applyCommand(state, { type: "manualBooking", id: "stay", roomId: firstRoomId, stay, contact, total: 950000 });
  applyCommand(state, { type: "payment", id: "deposit", bookingId: "stay", amount: 300000, date: stay.checkIn });
  applyCommand(state, { type: "block", id: "closed", roomId: state.rooms[1].id, range: stay, reason: "Ремонт" });
  const activeReport = getReport(state, stay);
  assert.equal(activeReport.sellableNights, 2);
  assert.equal(activeReport.occupancy, 100);
  applyCommand(state, { type: "cancel", id: "stay" });
  const cancelledReport = getReport(state, stay);
  assert.equal(cancelledReport.occupancy, 0);
  assert.equal(cancelledReport.revenue, 0);
  assert.equal(cancelledReport.received, 300000);
});
