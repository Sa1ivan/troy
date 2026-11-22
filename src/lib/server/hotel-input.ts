import type { Command, Contact } from "../bookings";
import { findCategory, type CategoryId } from "../catalog";
import type { DateRange, Stay } from "../dates";

type GuestRequest = Extract<Command, { type: "request" }>;
type Action =
  | { action: "login"; login: string; password: string }
  | { action: "logout" }
  | { action: "command"; command: Exclude<Command, GuestRequest> }
  | { action: "request"; request: GuestRequest; token: string }
  | { action: "receipt"; id: string; token: string };

const bodyLimit = 16_384;
const invalidRequest = "Проверьте данные запроса.";

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function isToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{22,128}$/.test(value);
}

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isCategory(value: unknown): value is CategoryId {
  return typeof value === "string" && findCategory(value) !== undefined;
}

function dateRange(value: unknown): DateRange | null {
  if (!isRecord(value) || !isText(value.checkIn, 10) || !isText(value.checkOut, 10)) return null;
  return { checkIn: value.checkIn, checkOut: value.checkOut };
}

function stay(value: unknown): Stay | null {
  if (!isRecord(value) || !isInteger(value.guests)) return null;
  const range = dateRange(value);
  return range ? { ...range, guests: value.guests } : null;
}

function contact(value: unknown): Contact | null {
  if (!isRecord(value) || !isText(value.name, 80) || !isText(value.phone, 30)) return null;
  return { name: value.name, phone: value.phone };
}

function roomChanges(value: unknown): Extract<Command, { type: "room" }>["changes"] | null {
  if (!isRecord(value)) return null;
  const { label, floor, categoryId } = value;
  if (label !== undefined && !isText(label, 48)) return null;
  if (floor !== undefined && floor !== null && !isInteger(floor)) return null;
  if (categoryId !== undefined && categoryId !== null && !isCategory(categoryId)) return null;
  return { label, floor, categoryId };
}

function parseCommand(value: unknown): Command | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  const { type, id, roomId, categoryId, total, reason, bookingId, paymentId, date, amount } = value;
  switch (type) {
    case "request": {
      const dates = stay(value.stay);
      const guest = contact(value.contact);
      return dates && guest && isCategory(categoryId) ? { type, id, categoryId, stay: dates, contact: guest } : null;
    }
    case "confirm":
      return isId(roomId) && isInteger(total) ? { type, id, roomId, total } : null;
    case "amendBooking": {
      const dates = stay(value.stay);
      const { expectedRevision } = value;
      if (expectedRevision !== undefined && (!isInteger(expectedRevision) || expectedRevision < 0)) return null;
      return dates && isId(roomId) && isInteger(total) ? { type, id, roomId, stay: dates, total, expectedRevision } : null;
    }
    case "reject":
    case "cancel":
    case "unblock":
      return { type, id };
    case "manualBooking": {
      const dates = stay(value.stay);
      const guest = contact(value.contact);
      const { expectedCategoryId } = value;
      if (expectedCategoryId !== undefined && expectedCategoryId !== null && !isCategory(expectedCategoryId)) return null;
      return dates && guest && isId(roomId) && isInteger(total)
        ? { type, id, roomId, stay: dates, contact: guest, total, expectedCategoryId } : null;
    }
    case "block": {
      const range = dateRange(value.range);
      return range && isId(roomId) && isText(reason, 120) ? { type, id, roomId, range, reason } : null;
    }
    case "payment":
      return isId(bookingId) && isText(date, 10) && isInteger(amount) ? { type, id, bookingId, date, amount } : null;
    case "refund":
      return isId(bookingId) && isId(paymentId) && isText(date, 10) && isInteger(amount) && isText(reason, 120)
        ? { type, id, bookingId, paymentId, date, amount, reason } : null;
    case "room": {
      const changes = roomChanges(value.changes);
      return changes ? { type, id, changes } : null;
    }
    default:
      return null;
  }
}

function parseAction(value: unknown): Action | null {
  if (!isRecord(value)) return null;
  const { action, login, password, id, token } = value;
  switch (action) {
    case "login":
      return isText(login, 128) && isText(password, 256) ? { action, login, password } : null;
    case "logout":
      return { action };
    case "command": {
      const command = parseCommand(value.command);
      return command && command.type !== "request" ? { action, command } : null;
    }
    case "request": {
      const request = parseCommand(value.request);
      return request?.type === "request" && isToken(token) ? { action, request, token } : null;
    }
    case "receipt":
      return isId(id) && isToken(token) ? { action, id, token } : null;
    default:
      return null;
  }
}

export async function readAction(request: Request): Promise<Action> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new HttpError(415, "Отправьте данные в формате JSON.");
  const tooLarge = new HttpError(413, "Запрос слишком большой.");
  if (Number(request.headers.get("content-length")) > bodyLimit) throw tooLarge;
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, invalidRequest);

  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let length = 0;
    let body = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > bodyLimit) {
        void reader.cancel().catch(() => {});
        throw tooLarge;
      }
      body += decoder.decode(value, { stream: true });
    }
    const action = parseAction(JSON.parse(body + decoder.decode()));
    if (action) return action;
  } catch (error) {
    if (error === tooLarge) throw error;
  } finally {
    reader.releaseLock();
  }
  throw new HttpError(400, invalidRequest);
}
