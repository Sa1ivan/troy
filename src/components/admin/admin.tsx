"use client";

import { CalendarDays, ChartNoAxesCombined, ClipboardList, KeyRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Block } from "@/lib/bookings";
import { seasonMonth, type DateRange } from "@/lib/dates";
import { demoAdmin } from "@/lib/storage";
import { useHotel } from "../hotel-provider";
import { Analytics } from "./analytics";
import { BookingsTable } from "./bookings-table";
import { Calendar } from "./calendar";
import { BlockDialog, BookingDialog, RangeDialog, RoomDialog } from "./dialogs";

type View = "calendar" | "bookings" | "analytics";
type Panel =
  | { kind: "booking" | "room"; id: string }
  | { kind: "block"; block: Block }
  | { kind: "range"; roomId: string; range: DateRange };

const menu = [
  { key: "calendar", label: "Шахматка", icon: CalendarDays },
  { key: "bookings", label: "Заявки и брони", icon: ClipboardList },
  { key: "analytics", label: "Деньги и аналитика", icon: ChartNoAxesCombined },
] as const;

function AdminLogin() {
  const { signIn } = useHotel();
  const [error, setError] = useState("");
  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!signIn(String(data.get("login")), String(data.get("password")))) setError("Проверьте логин и пароль.");
  }
  return (
    <section className="login-page">
      <div className="login-card">
        <span className="login-icon"><KeyRound size={24} aria-hidden="true" /></span>
        <h1>Вход для сотрудников</h1>
        <p className="muted">Заявки, шахматка и учёт оплат гостевого дома «Троя».</p>
        <form className="field-stack" onSubmit={login}>
          <label>Логин<input name="login" autoComplete="username" required onChange={() => setError("")} /></label>
          <label>Пароль<input name="password" type="password" autoComplete="current-password" required onChange={() => setError("")} /></label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button type="submit" className="button button-primary">Войти</button>
        </form>
        <p className="demo-note">Демоучётка <strong>{demoAdmin.login}</strong> / <strong>{demoAdmin.password}</strong></p>
      </div>
    </section>
  );
}

function Workspace() {
  const { state, storageError } = useHotel();
  const [view, setView] = useState<View>("calendar");
  const [month, setMonth] = useState(seasonMonth);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const workspace = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function syncFullscreen(event: Event) {
      if (event.target === workspace.current) {
        setCalendarExpanded(document.fullscreenElement === workspace.current);
      }
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!calendarExpanded) return;
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && !document.fullscreenElement
        && !workspace.current?.querySelector("dialog[open]")) {
        setCalendarExpanded(false);
      }
    }
    document.addEventListener("keydown", closeWithEscape);
    return () => document.removeEventListener("keydown", closeWithEscape);
  }, [calendarExpanded]);

  async function toggleCalendarFullscreen() {
    const element = workspace.current;
    if (!element) return;

    if (calendarExpanded) {
      if (document.fullscreenElement === element) await document.exitFullscreen().catch(() => {});
      setCalendarExpanded(document.fullscreenElement === element);
      return;
    }

    if (document.fullscreenEnabled && element.requestFullscreen) {
      // Keep the calendar fitted to the window when the browser declines fullscreen.
      await element.requestFullscreen().catch(() => {});
    }
    setCalendarExpanded(true);
  }

  if (storageError) return <div className="container section"><p role="alert" className="form-error">{storageError}</p></div>;
  if (!state) return <div className="container section"><p role="status">Загружаем номерной фонд…</p></div>;

  const close = () => setPanel(null);
  const showBooking = (id: string) => setPanel({ kind: "booking", id });
  const pending = state.bookings.filter(({ status }) => status === "pending").length;
  const booking = panel?.kind === "booking" ? state.bookings.find(({ id }) => id === panel.id) : undefined;
  const block = panel?.kind === "block" ? panel.block : undefined;
  const activeRoomId = panel?.kind === "range" ? panel.roomId : panel?.kind === "room" ? panel.id : undefined;
  const activeRoom = state.rooms.find(({ id }) => id === activeRoomId);

  return (
    <div className="admin-page" ref={workspace} data-calendar-expanded={calendarExpanded}>
      <div className="container admin-heading">
        <div><h1>Админка</h1><p>Номерной фонд, заявки и оплаты</p></div>
        <span className="demo-tag">Локальная демонстрация</span>
      </div>
      <div className="admin-tab-strip">
        <nav className="container admin-tabs" aria-label="Разделы админки">
          {menu.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>
              <Icon size={18} aria-hidden="true" /> {label}
              {key === "bookings" && pending > 0 && <span className="pending-count" aria-label={"Новых заявок " + pending}>{pending}</span>}
            </button>
          ))}
        </nav>
      </div>
      <div className="container admin-content view-enter" key={view}>
        {view === "calendar" && <Calendar state={state} month={month} setMonth={setMonth}
          expanded={calendarExpanded} onToggleFullscreen={toggleCalendarFullscreen}
          onBooking={showBooking}
          onBlock={(id) => {
            const selected = state.blocks.find((entry) => entry.id === id);
            if (selected) setPanel({ kind: "block", block: selected });
          }}
          onRoom={(id) => setPanel({ kind: "room", id })}
          onRange={(roomId, range) => setPanel({ kind: "range", roomId, range })} />}
        {view === "bookings" && <BookingsTable state={state} onBooking={showBooking} />}
        {view === "analytics" && <Analytics state={state} month={month} />}
      </div>
      {booking && <BookingDialog key={booking.id} state={state} booking={booking} onClose={close} onCalendar={() => {
        setMonth(booking.stay.checkIn.slice(0, 7));
        setView("calendar");
        close();
      }} />}
      {block && <BlockDialog key={block.id} block={block} room={state.rooms.find(({ id }) => id === block.roomId)} onClose={close} />}
      {panel?.kind === "room" && activeRoom && <RoomDialog room={activeRoom} onClose={close} />}
      {panel?.kind === "range" && activeRoom && <RangeDialog room={activeRoom} range={panel.range} onClose={close} />}
    </div>
  );
}

export function Admin() {
  const { authenticated } = useHotel();
  if (authenticated === null) return <div className="container section"><p role="status">Проверяем вход…</p></div>;
  return authenticated ? <Workspace /> : <AdminLogin />;
}
