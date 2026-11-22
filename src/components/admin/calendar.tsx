"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Maximize2, Minimize2, Pencil, Search } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { findRangeConflict, occupiedRanges, type HotelState } from "@/lib/bookings";
import type { Room } from "@/lib/catalog";
import {
  addDays, containsNight, countLabel, dateLabel, eachNight, hotelToday, monthLabel, monthRange, overlaps, season, shiftMonth, stayError,
  stayLabel, weekdayLabel, type DateRange,
} from "@/lib/dates";
import { SelectField } from "../controls";

type Selection = { roomId: string; day: string };
export type CalendarTarget = Selection & { bookingId: string };

type CalendarProps = {
  state: HotelState;
  month: string;
  setMonth: (month: string) => void;
  expanded: boolean;
  onToggleFullscreen: () => void;
  onBooking: (id: string) => void;
  onBlock: (id: string) => void;
  onRoom: (id: string) => void;
  onRange: (roomId: string, range: DateRange) => void;
  target: CalendarTarget | null;
};

function selectedRange(start: string, end: string): DateRange {
  return { checkIn: start < end ? start : end, checkOut: addDays(start < end ? end : start, 1) };
}

function roomGroups(rooms: Room[]) {
  const groups: { building: number; floor: number | null; rooms: Room[] }[] = [];
  for (const room of [...rooms].sort((a, b) => a.building - b.building || (a.floor ?? Infinity) - (b.floor ?? Infinity)
    || a.label.localeCompare(b.label, "ru", { numeric: true }))) {
    const last = groups.at(-1);
    if (last?.building === room.building && last.floor === room.floor) last.rooms.push(room);
    else groups.push({ building: room.building, floor: room.floor, rooms: [room] });
  }
  return groups;
}

function conflictLabel(conflict: NonNullable<ReturnType<typeof findRangeConflict>>) {
  const description = conflict.kind === "booking" ? "с бронью «" + conflict.record.contact.name : "с закрытием «" + conflict.record.reason;
  return "Даты пересекаются " + description + "» (" + stayLabel(conflict.range) + ").";
}

export function Calendar({ state, month, setMonth, expanded, onToggleFullscreen, onBooking, onBlock, onRoom, onRange, target }: CalendarProps) {
  const [building, setBuilding] = useState("all");
  const [filter, setFilter] = useState("");
  const [start, setStart] = useState<Selection | null>(null);
  const [hover, setHover] = useState<Selection | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [focused, setFocused] = useState<Selection | null>(null);
  const [highlight, setHighlight] = useState(!!target);
  const grid = useRef<HTMLTableElement>(null);
  const preferredColumn = useRef<number | null>(null);
  const drag = useRef<Selection | null>(null);
  const days = eachNight(monthRange(month));
  const today = hotelToday();
  const visible = state.rooms.filter((room) => (building === "all" || String(room.building) === building)
    && room.label.toLowerCase().includes(filter.trim().toLowerCase()));
  const groups = roomGroups(visible);
  const tabRoom = focused && visible.some(({ id }) => id === focused.roomId) ? focused.roomId : groups[0]?.rooms[0]?.id;
  const tabDay = focused && focused.roomId === tabRoom && days.includes(focused.day) && containsNight(season, focused.day) ? focused.day : "";
  const activeColumn = tabDay ? days.indexOf(tabDay) + 1 : 0;
  const preview = start && hover?.roomId === start.roomId ? selectedRange(start.day, hover.day) : null;
  const previewConflict = start && preview ? findRangeConflict(state, start.roomId, preview) : undefined;
  const fullscreenLabel = expanded ? "Выйти из полноэкранной шахматки" : "Открыть шахматку на весь экран";
  const FullscreenIcon = expanded ? Minimize2 : Maximize2;

  useEffect(() => {
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      const strip = grid.current?.querySelector<HTMLButtonElement>('button[data-highlighted="true"]');
      if (!strip) return;
      strip.focus({ preventScroll: true });
      strip.scrollIntoView({ block: "center", inline: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  function resetSelection() {
    setStart(null);
    setHover(null);
    setSelectionError("");
  }

  function complete(entry: Selection, lastDay: string) {
    const range = selectedRange(entry.day, lastDay);
    const conflict = findRangeConflict(state, entry.roomId, range);
    const error = conflict ? conflictLabel(conflict) : stayError({ ...range, guests: 1 });
    resetSelection();
    if (error) setSelectionError(error);
    else onRange(entry.roomId, range);
  }

  function choose(roomId: string, day: string) {
    setHighlight(false);
    if (start?.roomId === roomId) complete(start, day);
    else {
      setSelectionError("");
      setStart({ roomId, day });
      setHover(null);
    }
  }

  function release(event: MouseEvent, roomId: string, day: string) {
    const anchor = drag.current;
    drag.current = null;
    if (event.button === 0 && anchor?.roomId === roomId && anchor.day !== day) complete(anchor, day);
  }

  function rangeHandlers(roomId: string, day: string) {
    return {
      onMouseEnter: (event: MouseEvent) => {
        const anchor = drag.current;
        if (anchor?.roomId === roomId && event.buttons === 1) {
          setSelectionError("");
          setStart(anchor);
          setHover({ roomId, day });
        } else if (start?.roomId === roomId) {
          setHover({ roomId, day });
        }
      },
      onMouseUp: (event: MouseEvent) => release(event, roomId, day),
    };
  }

  function gridButton(roomId: string, day: string, column: number, columnEnd = column) {
    return {
      tabIndex: tabRoom === roomId && column <= activeColumn && activeColumn <= columnEnd ? 0 : -1,
      "data-calendar-column": column,
      "data-calendar-column-end": columnEnd,
      onFocus: () => {
        setFocused({ roomId, day });
        if (start) setHover(day ? { roomId, day } : null);
      },
      onPointerDown: () => { preferredColumn.current = null; },
    };
  }

  function moveFocus(event: KeyboardEvent<HTMLTableElement>) {
    if (event.key === "Escape" && (start || selectionError)) {
      resetSelection();
      event.preventDefault();
      return;
    }
    const button = event.target;
    if (!(button instanceof HTMLButtonElement)) return;
    if (event.key === "Tab") preferredColumn.current = null;
    const row = button.closest<HTMLTableRowElement>(".calendar-room-row");
    if (!row) return;
    const rowButtons = (entry: HTMLTableRowElement) => [...entry.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const current = rowButtons(row);
    let next: HTMLButtonElement | undefined;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown": {
        const rows = [...event.currentTarget.querySelectorAll<HTMLTableRowElement>(".calendar-room-row")];
        const nextRow = rows[rows.indexOf(row) + (event.key === "ArrowUp" ? -1 : 1)];
        preferredColumn.current ??= Number(button.dataset.calendarColumn);
        const column = preferredColumn.current;
        if (nextRow) {
          const candidates = rowButtons(nextRow);
          next = candidates.find((entry) => column >= Number(entry.dataset.calendarColumn)
            && column <= Number(entry.dataset.calendarColumnEnd)) ?? candidates[0];
        }
        break;
      }
      case "ArrowLeft": next = current[current.indexOf(button) - 1]; break;
      case "ArrowRight": next = current[current.indexOf(button) + 1]; break;
      case "Home": next = current[0]; break;
      case "End": next = current.at(-1); break;
      default: return;
    }
    event.preventDefault();
    if (!next) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") preferredColumn.current = null;
    setHighlight(false);
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }

  function renderRoom(room: Room) {
    const ranges = occupiedRanges(state, room.id);
    return (
      <tr key={room.id} className="calendar-room-row">
        <th scope="row" className="calendar-first">
          <button type="button" className="calendar-room-name" aria-label={"Изменить комнату " + room.label}
            {...gridButton(room.id, "", 0)} onClick={() => onRoom(room.id)}>
            <span>{room.label}</span><Pencil aria-hidden="true" size={13} />
          </button>
        </th>
        {days.map((day, index) => {
          const occupied = ranges.find(({ range }) => containsNight(range, day));
          if (occupied) {
            if (index && containsNight(occupied.range, days[index - 1])) return null;
            const span = days.slice(index).findIndex((date) => !containsNight(occupied.range, date));
            const length = span === -1 ? days.length - index : span;
            const label = occupied.kind === "booking" ? occupied.record.contact.name : occupied.record.reason;
            const highlighted = highlight && target?.roomId === room.id && target.bookingId === occupied.record.id
              && occupied.kind === "booking" && containsNight(occupied.range, target.day);
            const markedConflict = previewConflict?.record.id === occupied.record.id && preview && overlaps(preview, occupied.range);
            return (
              <td colSpan={length} key={day} className="calendar-occupied">
                <button className={"calendar-strip strip-" + occupied.kind} type="button"
                  title={label + " · " + stayLabel(occupied.range)}
                  aria-label={(occupied.kind === "booking" ? "Бронь " : "Закрытие ") + label + ", " + stayLabel(occupied.range)}
                  data-highlighted={highlighted || undefined} data-conflict={markedConflict || undefined}
                  {...gridButton(room.id, day, index + 1, index + length)} {...rangeHandlers(room.id, day)}
                  onClick={() => {
                    if (start?.roomId === room.id) complete(start, day);
                    else if (occupied.kind === "booking") onBooking(occupied.record.id);
                    else onBlock(occupied.record.id);
                  }}>
                  <span>{label}</span>
                </button>
              </td>
            );
          }
          const offSeason = !containsNight(season, day);
          const selected = start?.roomId === room.id && (day === start.day || !!preview && containsNight(preview, day));
          return (
            <td key={day} className={"calendar-empty" + (offSeason ? " off-season" : "")}>
              <button className={selected ? "is-selected" : undefined} type="button" disabled={offSeason}
                aria-label={room.label + ", " + dateLabel(day)} title={dateLabel(day)}
                {...gridButton(room.id, day, index + 1)} {...rangeHandlers(room.id, day)}
                onClick={() => choose(room.id, day)}
                onMouseDown={(event) => {
                  if (event.button === 0) drag.current = { roomId: room.id, day };
                }} />
            </td>
          );
        })}
      </tr>
    );
  }

  return (
    <section aria-labelledby="calendar-heading" className="calendar-section">
      <div className="admin-section-heading calendar-heading">
        <div><h2 id="calendar-heading">Шахматка</h2><p>Выберите первую и последнюю ночь в строке комнаты или протяните выделение мышью.</p></div>
        <div className="calendar-filters">
          <SelectField className="compact-field" label="Корпус" value={building}
            onChange={(value) => { setBuilding(value); setHighlight(false); resetSelection(); }}
            options={[{ value: "all", label: "Все корпуса" }, { value: "1", label: "Корпус 1" }, { value: "2", label: "Корпус 2" }]} />
          <label className="compact-field">Комната
            <div className="icon-input"><Search size={16} aria-hidden="true" /><input type="search" placeholder="Номер или подпись" value={filter}
              onChange={(event) => { setFilter(event.target.value); setHighlight(false); resetSelection(); }} /></div>
          </label>
        </div>
      </div>
      <div className="calendar-card">
        <div className="calendar-toolbar">
          <div className="month-control">
            <button className="icon-button" type="button" aria-label="Предыдущий месяц" disabled={month <= "1900-01"}
              onClick={() => { setMonth(shiftMonth(month, -1)); setHover(null); setSelectionError(""); setHighlight(false); }}><ChevronLeft size={20} /></button>
            <strong aria-live="polite"><CalendarDays size={17} aria-hidden="true" /> {monthLabel(month)}</strong>
            <button className="icon-button" type="button" aria-label="Следующий месяц" disabled={month >= "2099-12"}
              onClick={() => { setMonth(shiftMonth(month, 1)); setHover(null); setSelectionError(""); setHighlight(false); }}><ChevronRight size={20} /></button>
          </div>
          <ul className="calendar-legend" aria-label="Статусы в шахматке">
            <li><span className="legend-free" /> Свободно</li>
            <li><span className="legend-booking" /> Забронировано</li>
            <li><span className="legend-block" /> Закрыто</li>
          </ul>
          <button type="button" className="button button-outline button-small calendar-fullscreen"
            aria-label={fullscreenLabel} title={fullscreenLabel} onClick={onToggleFullscreen}>
            <FullscreenIcon size={16} aria-hidden="true" /> <span>{expanded ? "Свернуть" : "На весь экран"}</span>
          </button>
        </div>
        {groups.length ? (
          <div className="calendar-scroll" aria-label="Шахматка по комнатам и датам" tabIndex={-1}
            onMouseUp={() => { drag.current = null; }} onMouseLeave={() => { drag.current = null; setHover(null); }}>
            <table className="calendar-grid" role="grid" aria-label="Комнаты и ночи" aria-describedby="calendar-keys"
              ref={grid} onKeyDown={moveFocus} style={{ "--day-count": days.length } as CSSProperties}>
              <colgroup><col className="calendar-room-col" />{days.map((day) => <col key={day} className="calendar-day-col" />)}</colgroup>
              <thead><tr><th scope="col" className="calendar-first">Комната</th>{days.map((day) => (
                <th scope="col" key={day} className={day === today ? "calendar-today" : undefined}>
                  <span>{Number(day.slice(-2))}</span><small>{weekdayLabel(day)}</small>
                </th>
              ))}</tr></thead>
              {groups.map(({ building: groupBuilding, floor, rooms }, index) => (
                <tbody key={groupBuilding + "-" + floor}>
                  {groups[index - 1]?.building !== groupBuilding && (
                    <tr className="calendar-building"><th className="calendar-first" scope="rowgroup">Корпус {groupBuilding}</th><td colSpan={days.length} /></tr>
                  )}
                  <tr className="calendar-floor"><th scope="rowgroup" className="calendar-first">{floor ? floor + "-й этаж" : "Этаж уточняется"}</th><td colSpan={days.length} /></tr>
                  {rooms.map(renderRoom)}
                </tbody>
              ))}
            </table>
          </div>
        ) : <p className="empty-state">Комнаты по этому фильтру не найдены.</p>}
        <div className="calendar-selection">
          {selectionError && <span className="form-error" role="alert">{selectionError}</span>}
          {start ? (
            <>
              <span aria-live="polite" className={previewConflict ? "form-error" : undefined}>
                {previewConflict ? conflictLabel(previewConflict) : "Выбрано " + dateLabel(start.day) + ". Укажите последнюю ночь."}
              </span>
              <button className="button button-outline button-small" type="button" onClick={() => complete(start, start.day)}>На одну ночь</button>
              <button className="text-button" type="button" onClick={resetSelection}>Сбросить выбор</button>
            </>
          ) : !selectionError && <span>{countLabel(visible.length, ["комната", "комнаты", "комнат"])} в шахматке</span>}
          <span className="calendar-keys" id="calendar-keys">Стрелки перемещают фокус, Enter выбирает клетку, Escape сбрасывает выбор.</span>
        </div>
      </div>
    </section>
  );
}
