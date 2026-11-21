"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { BookingError, type Command, type HotelState } from "@/lib/bookings";
import { demoAdmin, loadOrUpdateHotel } from "@/lib/storage";

const sessionKey = "troy-demo-admin";
const connectionError = "Локальное хранилище недоступно. Проверьте настройки браузера и обновите страницу.";

type HotelContextValue = {
  state: HotelState | null;
  storageError: string;
  authenticated: boolean | null;
  dispatch: (command: Command) => Promise<void>;
  signIn: (login: string, password: string) => boolean;
  signOut: () => void;
};

const HotelContext = createContext<HotelContextValue | null>(null);

export function HotelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HotelState | null>(null);
  const [storageError, setStorageError] = useState("");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    try {
      setAuthenticated(sessionStorage.getItem(sessionKey) === "signed-in");
    } catch {
      setAuthenticated(false);
    }
    let active = true;
    async function refresh() {
      try {
        const next = await loadOrUpdateHotel();
        if (active) {
          setState(next);
          setStorageError("");
        }
      } catch {
        if (active) setStorageError(connectionError);
      }
    }
    const updates = typeof BroadcastChannel === "function" ? new BroadcastChannel("troy-hotel-updates") : null;
    channel.current = updates;
    updates?.addEventListener("message", refresh);
    window.addEventListener("focus", refresh);
    void refresh();
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      updates?.close();
      channel.current = null;
    };
  }, []);

  const dispatch = useCallback(async (command: Command) => {
    try {
      setState(await loadOrUpdateHotel(command));
      setStorageError("");
      channel.current?.postMessage("changed");
    } catch (error) {
      if (error instanceof BookingError) throw error;
      throw new Error(connectionError);
    }
  }, []);

  function signIn(login: string, password: string): boolean {
    if (login.trim() !== demoAdmin.login || password !== demoAdmin.password) return false;
    try {
      sessionStorage.setItem(sessionKey, "signed-in");
    } catch {
      // The current view still works when browser session storage is restricted.
    }
    setAuthenticated(true);
    return true;
  }

  function signOut() {
    try {
      sessionStorage.removeItem(sessionKey);
    } catch {}
    setAuthenticated(false);
  }

  return (
    <HotelContext.Provider value={{ state, storageError, authenticated, dispatch, signIn, signOut }}>
      {children}
    </HotelContext.Provider>
  );
}

export function useHotel() {
  const hotel = useContext(HotelContext);
  if (!hotel) throw new Error("HotelProvider is missing");
  return hotel;
}
