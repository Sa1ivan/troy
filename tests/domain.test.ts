import assert from "node:assert/strict";
import test from "node:test";
import { addDays, monthRange, hotelToday } from "../src/lib/dates";
import { buildInventory, findCategory, fromPrice, quoteStay } from "../src/lib/catalog";
import {
  availableRooms, applyCommand, createDemoState, getReport, occupiedRanges, outstanding, paidFor, type HotelState,
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
  const demo = createDemoState();
  assert.equal(demo.rooms.find(({ id }) => id === "b2-triple-1")?.categoryId, "economy-triple");
});

test("заявка не занимает комнату до подтверждения, выезд освобождает дату для заезда", () => {
  const state = makeState();
  const roomId = state.rooms[0].id;
  applyCommand(state, { type: "request", id: "request-1", categoryId: standardId, stay, contact });
  assert.equal(state.bookings[0].quotedTotal, 950000);
  assert.equal(availableRooms(state, standardId, stay).length, 2);
  applyCommand(state, { type: "confirm", id: "request-1", roomId, total: 950000 });
  assert.deepEqual(availableRooms(state, standardId, stay).map((room) => room.id), [state.rooms[1].id]);
  assert.ok(availableRooms(state, standardId, { ...stay, checkIn: stay.checkOut, checkOut: "2027-06-17" })
    .some((room) => room.id === roomId));
  assert.throws(() => applyCommand(state, { type: "block", id: "block-1", roomId, range: stay, reason: "Ремонт" }), /пересекаются/);
  assert.throws(() => applyCommand(state, { type: "manualBooking", id: "manual", roomId, stay, contact, total: 950000 }), /пересекаются/);
  applyCommand(state, { type: "cancel", id: "request-1" }, "2027-06-01");
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
  applyCommand(state, { type: "cancel", id: "stay" }, "2027-06-01");
  const cancelledReport = getReport(state, stay);
  assert.equal(cancelledReport.occupancy, 0);
  assert.equal(cancelledReport.revenue, 0);
  assert.equal(cancelledReport.received, 300000);
});

test("категория проверяется против вместимости подтверждённых будущих броней", () => {
  const state = makeState();
  const room = state.rooms[0];
  const before = "2027-06-01";
  applyCommand(state, { type: "room", id: room.id, changes: { categoryId: "suite" } }, before);
  applyCommand(state, { type: "manualBooking", id: "family", roomId: room.id,
    stay: { ...stay, guests: 5 }, contact, total: 1200000 }, before);
  assert.throws(() => applyCommand(state, { type: "room", id: room.id,
    changes: { categoryId: standardId } }, before), /вместимост|вместимость|пересел/i);
  assert.throws(() => applyCommand(state, { type: "room", id: room.id,
    changes: { categoryId: standardId } }, "2027-06-15"), /вместимост|вместимость|пересел/i);
  assert.equal(room.categoryId, "suite");
  applyCommand(state, { type: "room", id: room.id, changes: { categoryId: standardId } }, stay.checkOut);
  assert.equal(room.categoryId, standardId);
});

test("переселение сохраняет ночи в старом корпусе, номер брони и оплату", () => {
  const state = makeState();
  const first = state.rooms[0];
  const second = buildInventory().find(({ id }) => id === "b2-double-1")!;
  state.rooms.push(second);
  const range = { checkIn: "2027-06-14", checkOut: "2027-06-18", guests: 2 };
  applyCommand(state, { type: "manualBooking", id: "guest", roomId: first.id, stay: range, contact, total: 1950000 });
  applyCommand(state, { type: "payment", id: "deposit", bookingId: "guest", amount: 700000, date: "2027-06-01" });
  const originalNights = state.bookings[0].nights.slice(0, 2);
  const movedStay = { ...range, checkOut: "2027-06-19" };
  const move = { type: "amendBooking", id: "guest", roomId: second.id, stay: movedStay, total: 2400000 } as const;
  applyCommand(state, { type: "block", id: "repair", roomId: second.id,
    range: { checkIn: "2027-06-17", checkOut: "2027-06-18" }, reason: "Ремонт" });
  const beforeMove = structuredClone(state);
  assert.throws(() => applyCommand(state, move, "2027-06-16"), /пересекаются/);
  assert.deepEqual(state, beforeMove);
  applyCommand(state, { type: "unblock", id: "repair" });
  assert.throws(() => applyCommand(state, { ...move, stay: { ...movedStay, guests: 3 } }, "2027-06-16"), /меньше мест/);
  applyCommand(state, move, "2027-06-16");
  assert.equal(state.bookings[0].id, "guest");
  assert.equal(paidFor(state, "guest"), 700000);
  assert.equal(outstanding(state, state.bookings[0]), 1700000);
  assert.deepEqual(state.bookings[0].nights.slice(0, 2), originalNights);
  assert.equal(state.bookings[0].nights.reduce((sum, night) => sum + night.amount, 0), move.total);
  assert.deepEqual(occupiedRanges(state, first.id).map(({ range }) => [range.checkIn, range.checkOut]), [["2027-06-14", "2027-06-16"]]);
  assert.deepEqual(occupiedRanges(state, second.id).map(({ range }) => [range.checkIn, range.checkOut]), [["2027-06-16", "2027-06-19"]]);
  assert.deepEqual(getReport(state, movedStay).buildings.map(({ occupiedNights }) => occupiedNights), [2, 3]);
  applyCommand(state, { ...move, stay: { ...movedStay, checkOut: "2027-06-17" }, total: 1450000 }, "2027-06-16");
  assert.equal(state.bookings[0].stay.checkOut, "2027-06-17");
  assert.equal(state.bookings[0].total, 1450000);
});

test("текущую бронь можно завершить сегодня без потери стоимости прожитых ночей", () => {
  const state = makeState();
  const roomId = state.rooms[0].id;
  applyCommand(state, { type: "manualBooking", id: "guest", roomId, stay, contact, total: 950000 });
  const before = structuredClone(state.bookings[0]);
  const today = "2027-06-15";
  const newStay = { ...stay, checkOut: today };
  const edit = { type: "amendBooking", id: "guest", roomId, stay: newStay, total: 450000 } as const;
  assert.throws(() => applyCommand(state, { ...edit, total: 250000 }, today), /прожит/);
  assert.deepEqual(state.bookings[0], before);
  applyCommand(state, edit, today);
  assert.equal(outstanding(state, state.bookings[0]), 450000);
  assert.equal(getReport(state, stay).revenue, 450000);
  assert.equal(getReport(state, stay).occupiedNights, 1);
  assert.equal(availableRooms(state, standardId, { ...stay, checkIn: today }).length, 2);
});

test("бронь можно продлить в день выезда, если следующая ночь свободна", () => {
  const state = makeState();
  const roomId = state.rooms[0].id;
  applyCommand(state, { type: "manualBooking", id: "guest", roomId, stay, contact, total: 950000 });
  const amendment = { type: "amendBooking", id: "guest", roomId, stay: { ...stay, checkOut: "2027-06-17" }, total: 1450000 } as const;
  applyCommand(state, { type: "block", id: "repair", roomId, range: { checkIn: stay.checkOut, checkOut: amendment.stay.checkOut }, reason: "Ремонт" });
  assert.throws(() => applyCommand(state, amendment, stay.checkOut), /пересекаются/);
  applyCommand(state, { type: "unblock", id: "repair" });
  applyCommand(state, amendment, stay.checkOut);
  assert.deepEqual(state.bookings[0].nights.map(({ amount }) => amount), [450000, 500000, 500000]);
});

test("устаревшая форма не перезаписывает изменения брони из другой вкладки", () => {
  const state = makeState();
  const roomId = state.rooms[0].id;
  applyCommand(state, { type: "manualBooking", id: "guest", roomId, stay, contact, total: 950000 });
  const amendment = { type: "amendBooking", id: "guest", roomId, stay: { ...stay, checkOut: "2027-06-17" },
    total: 1450000, expectedRevision: 0 } as const;
  applyCommand(state, amendment, "2027-06-13");
  const after = structuredClone(state.bookings[0]);
  assert.throws(() => applyCommand(state, { ...amendment, stay, total: 950000 }, "2027-06-13"), /изменилась/);
  assert.deepEqual(state.bookings[0], after);
  assert.equal(after.revision, 1);
});

test("отмена после заезда снимает только оставшиеся ночи и сохраняет поступления", () => {
  const state = makeState();
  const roomId = state.rooms[0].id;
  applyCommand(state, { type: "manualBooking", id: "stay", roomId, stay, contact, total: 950000 });
  applyCommand(state, { type: "payment", id: "deposit", bookingId: "stay", amount: 600000, date: stay.checkIn });
  applyCommand(state, { type: "cancel", id: "stay" }, "2027-06-15");
  const report = getReport(state, stay);
  assert.equal(report.occupiedNights, 1);
  assert.equal(report.revenue, 450000);
  assert.equal(report.received, 600000);
  assert.equal(occupiedRanges(state, roomId)[0]?.range.checkOut, "2027-06-15");
  assert.equal(availableRooms(state, standardId, { ...stay, checkIn: "2027-06-15" }).length, 2);
});

test("частичные возвраты привязаны к платежу; карточка и кассовый отчёт учитывают дату", () => {
  const state = makeState();
  applyCommand(state, { type: "manualBooking", id: "stay", roomId: state.rooms[0].id, stay, contact, total: 950000 });
  applyCommand(state, { type: "payment", id: "p", bookingId: "stay", amount: 600000, date: "2027-05-30" });
  const refund = { type: "refund", id: "r", bookingId: "stay", paymentId: "p", amount: 200000, date: "2027-06-01", reason: "Изменение заказа" } as const;
  assert.throws(() => applyCommand(state, { ...refund, paymentId: "missing" }), /платёж|платеж/i);
  assert.throws(() => applyCommand(state, { ...refund, reason: " " }), /причин/i);
  assert.throws(() => applyCommand(state, { ...refund, date: "2027-05-29" }), /дат/i);
  applyCommand(state, refund);
  assert.equal(state.refunds?.[0].paymentId, "p");
  assert.equal(paidFor(state, "stay"), 400000);
  assert.equal(outstanding(state, state.bookings[0]), 550000);
  assert.throws(() => applyCommand(state, refund), /уже/i);
  assert.throws(() => applyCommand(state, { ...refund, id: "r2", amount: 400001 }), /превышает/i);
  applyCommand(state, { type: "cancel", id: "stay" }, "2027-06-01");
  applyCommand(state, { ...refund, id: "r2", amount: 400000 });
  assert.equal(paidFor(state, "stay"), 0);
  assert.equal(getReport(state, monthRange("2027-05")).netReceived, 600000);
  const june = getReport(state, monthRange("2027-06"));
  assert.equal(june.refunded, 600000);
  assert.equal(june.netReceived, -600000);
});
