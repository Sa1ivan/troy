import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isAbsolute } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { toAvailability } from "../availability";
import { BookingError, type HotelState } from "../bookings";
import { HttpError, readAction } from "./hotel-input";
import { getJournal } from "./journal";

const sessionSeconds = 12 * 60 * 60;
const loginRequired = "Войдите в админку, чтобы изменить журнал.";

function credentialsDigest(login: string, password: string) {
  return createHash("sha256").update(JSON.stringify([login, password])).digest();
}

function liveConfig() {
  const { TROY_MODE, TROY_ORIGIN, TROY_DATA_FILE, TROY_ADMIN_LOGIN, TROY_ADMIN_PASSWORD } = process.env;
  if (!TROY_MODE || TROY_MODE === "demo") return null;
  if (TROY_MODE !== "live") throw new Error("TROY_MODE must be demo or live");
  if (!TROY_DATA_FILE || !isAbsolute(TROY_DATA_FILE)) throw new Error("TROY_DATA_FILE must be an absolute path");

  const login = TROY_ADMIN_LOGIN?.trim();
  if (!login || login.length > 128 || !TROY_ADMIN_PASSWORD || TROY_ADMIN_PASSWORD.length > 256 || TROY_ADMIN_PASSWORD.trim().length < 16) {
    throw new Error("Configure TROY_ADMIN_LOGIN and a TROY_ADMIN_PASSWORD of at least 16 characters");
  }

  const url = URL.parse(TROY_ORIGIN ?? "");
  const secure = url?.protocol === "https:";
  const loopback = url?.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (!url || !(secure || loopback) || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("TROY_ORIGIN must be an HTTPS origin or an HTTP loopback origin");
  }
  return {
    origin: url.origin, secure, path: TROY_DATA_FILE, credentials: credentialsDigest(login, TROY_ADMIN_PASSWORD),
    cookieName: secure ? "__Host-troy-staff" : "troy-staff",
  };
}

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function snapshot(state: HotelState, staff: boolean) {
  return json({ mode: "live", availability: toAvailability(state), staff: staff ? state : null });
}

function sessionDigest(token: string, credentials: Buffer) {
  return createHmac("sha256", credentials).update(token).digest("hex");
}

function receiptDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function handle(request: NextRequest, write: boolean) {
  try {
    const config = liveConfig();
    if (!config) return write ? json({ error: "Рабочий журнал выключен." }, 405) : json({ mode: "demo" });
    if (write && request.headers.get("origin") !== config.origin) {
      return json({ error: "Отправьте запрос со страницы сайта." }, 403);
    }
    const action = write ? await readAction(request) : null;
    const cookie = request.cookies.get(config.cookieName)?.value;
    const session = cookie && /^[A-Za-z0-9_-]{43}$/.test(cookie) ? sessionDigest(cookie, config.credentials) : null;
    const journal = await getJournal(config.path);

    if (!action) return snapshot(journal.state(), journal.isStaff(session));
    const cookieOptions = { httpOnly: true, sameSite: "strict", secure: config.secure, path: "/" } as const;
    switch (action.action) {
      case "login": {
        const supplied = credentialsDigest(action.login.trim(), action.password);
        if (!timingSafeEqual(config.credentials, supplied)) return json({ error: "Проверьте логин и пароль." }, 401);
        const token = randomBytes(32).toString("base64url");
        const response = snapshot(journal.state(), true);
        journal.startSession(sessionDigest(token, config.credentials), session, Date.now() + sessionSeconds * 1000);
        response.cookies.set(config.cookieName, token, { ...cookieOptions, maxAge: sessionSeconds });
        return response;
      }
      case "logout": {
        journal.endSession(session);
        const response = snapshot(journal.state(), false);
        response.cookies.set(config.cookieName, "", { ...cookieOptions, maxAge: 0 });
        return response;
      }
      case "command": {
        const state = journal.command(session, action.command);
        return state ? snapshot(state, true) : json({ error: loginRequired }, 401);
      }
      case "request":
        return json({ receipt: journal.submit(action.request, receiptDigest(action.token)) });
      case "receipt":
        return json({ receipt: journal.receipt(action.id, receiptDigest(action.token)) });
    }
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof BookingError) return json({ error: error.message }, 409);
    console.error("Troy journal unavailable", error);
    return json({ error: "Сервер журнала недоступен. Повторите позже." }, 503);
  }
}

export function GET(request: NextRequest) {
  return handle(request, false);
}

export function POST(request: NextRequest) {
  return handle(request, true);
}
