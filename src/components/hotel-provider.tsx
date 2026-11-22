"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toAvailability, type Availability } from "@/lib/availability";
import { BookingError, type Command, type HotelState } from "@/lib/bookings";
import { guestReceipt, type GuestReceipt } from "@/lib/guest-receipts";
import { isPagesDemo } from "@/lib/site";
import { demoAdmin, loadOrUpdateHotel } from "@/lib/storage";

const sessionKey = "troy-demo-admin";
const localError = "Локальное хранилище недоступно. Проверьте настройки браузера и обновите страницу.";
const serverError = "Сайт не смог связаться с журналом бронирований. Попробуйте ещё раз.";
const channelName = "troy-hotel-updates";

type RequestCommand = Extract<Command, { type: "request" }>;
export type GuestAttempt = { id: string; token: string };
type HotelMode = "demo" | "live";
type Snapshot = { mode: HotelMode; availability: Availability; staff: HotelState | null };
type HotelContextValue = {
  mode: HotelMode | null;
  availability: Availability | null;
  state: HotelState | null;
  storageError: string;
  authenticated: boolean | null;
  dispatch: (command: Command) => Promise<void>;
  signIn: (login: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  submitRequest: (request: RequestCommand, token: string) => Promise<GuestReceipt>;
  loadReceipt: (attempt: GuestAttempt) => Promise<GuestReceipt | null>;
};

class HotelApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function hotelApi<T>(body?: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/hotel/", body ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    } : { cache: "no-store" });
  } catch {
    throw new Error(serverError);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new HotelApiError(payload?.error || serverError, response.status);
  return payload;
}

const HotelContext = createContext<HotelContextValue | null>(null);

function demoSnapshot(state: HotelState, staff: boolean): Snapshot {
  return { mode: "demo", availability: toAvailability(state), staff: staff ? state : null };
}

export function HotelProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [storageError, setStorageError] = useState("");
  const mode = useRef<HotelMode | null>(isPagesDemo ? "demo" : null);
  const demoSession = useRef<boolean | null>(null);
  const latest = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);

  const publish = useCallback((next: Snapshot) => {
    latest.current++;
    setSnapshot(next);
    setStorageError("");
  }, []);

  const updateDemo = useCallback((next: HotelState) => {
    if (demoSession.current === null) {
      try { demoSession.current = sessionStorage.getItem(sessionKey) === "signed-in"; }
      catch { demoSession.current = false; }
    }
    return demoSnapshot(next, demoSession.current);
  }, []);

  const refresh = useCallback(async () => {
    const request = ++latest.current;
    try {
      const remote = mode.current === "demo" ? { mode: "demo" } as const
        : await hotelApi<Snapshot | { mode: "demo" }>();
      mode.current = remote.mode;
      const next = remote.mode === "demo" ? updateDemo(await loadOrUpdateHotel()) : remote;
      if (request !== latest.current) return;
      publish(next);
    } catch (error) {
      if (request !== latest.current) return;
      setStorageError(mode.current === "demo" ? localError : error instanceof Error ? error.message : serverError);
    }
  }, [publish, updateDemo]);

  useEffect(() => {
    const updates = typeof BroadcastChannel === "function" ? new BroadcastChannel(channelName) : null;
    channel.current = updates;
    updates?.addEventListener("message", refresh);
    window.addEventListener("focus", refresh);
    void refresh();
    return () => {
      latest.current++;
      window.removeEventListener("focus", refresh);
      updates?.close();
      channel.current = null;
    };
  }, [refresh]);

  const staffLive = snapshot?.mode === "live" && !!snapshot.staff;
  useEffect(() => {
    if (!staffLive) return;
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [refresh, staffLive]);

  const dispatch = useCallback(async (command: Command) => {
    try {
      if (mode.current === "demo") {
        if (!demoSession.current) throw new BookingError("Войдите в админку, чтобы сохранить изменения.");
        publish(updateDemo(await loadOrUpdateHotel(command)));
      } else {
        publish(await hotelApi<Snapshot>({ action: "command", command }));
      }
      channel.current?.postMessage("changed");
    } catch (error) {
      if (error instanceof HotelApiError && error.status === 401) void refresh();
      if (mode.current !== "demo" || error instanceof BookingError) throw error;
      throw new Error(localError);
    }
  }, [publish, refresh, updateDemo]);

  async function signIn(login: string, password: string) {
    if (mode.current === "demo") {
      if (login.trim() !== demoAdmin.login || password !== demoAdmin.password) return false;
      const state = await loadOrUpdateHotel();
      demoSession.current = true;
      try { sessionStorage.setItem(sessionKey, "signed-in"); } catch {}
      publish(updateDemo(state));
      return true;
    }
    try {
      publish(await hotelApi<Snapshot>({ action: "login", login, password }));
      channel.current?.postMessage("changed");
      return true;
    } catch (error) {
      if (error instanceof HotelApiError && error.status === 401) return false;
      throw error;
    }
  }

  async function signOut() {
    if (mode.current === "demo") {
      demoSession.current = false;
      try { sessionStorage.removeItem(sessionKey); } catch {}
      latest.current++;
      setSnapshot((next) => next && { ...next, staff: null });
      return;
    }
    try {
      publish(await hotelApi<Snapshot>({ action: "logout" }));
      channel.current?.postMessage("changed");
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : serverError);
    }
  }

  const submitRequest = useCallback(async (request: RequestCommand, token: string) => {
    if (mode.current === "live") {
      try {
        const { receipt } = await hotelApi<{ receipt: GuestReceipt }>({ action: "request", request, token });
        channel.current?.postMessage("changed");
        return receipt;
      } catch (error) {
        if (error instanceof HotelApiError && error.status === 409) void refresh();
        throw error;
      }
    }
    if (mode.current !== "demo") throw new Error(serverError);
    try {
      const next = await loadOrUpdateHotel(request, true);
      publish(updateDemo(next));
      channel.current?.postMessage("changed");
      return guestReceipt(next.bookings.find(({ id }) => id === request.id)!);
    } catch (error) {
      if (error instanceof BookingError) throw error;
      throw new Error(localError);
    }
  }, [publish, refresh, updateDemo]);

  const loadReceipt = useCallback(async (attempt: GuestAttempt) => {
    if (mode.current === "live") {
      const { receipt } = await hotelApi<{ receipt: GuestReceipt | null }>({ action: "receipt", ...attempt });
      return receipt;
    }
    if (mode.current !== "demo") throw new Error(serverError);
    const state = await loadOrUpdateHotel();
    const booking = state.bookings.find(({ id, source }) => id === attempt.id && source === "site");
    return booking ? guestReceipt(booking) : null;
  }, []);

  return (
    <HotelContext.Provider value={{
      mode: snapshot?.mode ?? (isPagesDemo ? "demo" : null),
      availability: storageError ? null : snapshot?.availability ?? null,
      state: snapshot?.staff ?? null,
      authenticated: snapshot ? !!snapshot.staff : null,
      storageError, dispatch, signIn, signOut, submitRequest, loadReceipt,
    }}>
      {children}
    </HotelContext.Provider>
  );
}

export function useHotel() {
  const hotel = useContext(HotelContext);
  if (!hotel) throw new Error("HotelProvider is missing");
  return hotel;
}

export function DemoNotice() {
  const { mode } = useHotel();
  return mode === "demo" && <p className="container demo-note">Демо сайта. Для проверки заявок используйте тестовые данные.</p>;
}

export function BookingDataStorage() {
  const { mode } = useHotel();
  if (mode === "demo") return (
    <>
      <h2>Тестовые заявки</h2>
      <p>Демо хранит заявки и оплаты в браузере. Используйте тестовые данные. Удалить сохранённые записи можно в настройках данных этого сайта.</p>
    </>
  );
  return (
    <>
      <h2>Журнал бронирований</h2>
      <p>Заявки в рабочем режиме сохраняются в журнале бронирований. Контакты из формы видят сотрудники гостевого дома после входа.</p>
    </>
  );
}
