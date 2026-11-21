"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Maximize2, Minimize2, Pencil, Search } from "lucide-react";
import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { occupiedRanges, type HotelState } from "@/lib/bookings";
import type { Room } from "@/lib/catalog";
import { addDays, containsNight, dateLabel, eachNight, hotelToday, monthLabel, monthRange, season, shiftMonth, stayLabel, weekdayLabel, type DateRange } from "@/lib/dates";
import { SelectField } from "../controls";

type Selection = { roomId: string; day: string };

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

export function Calendar({ state, month, setMonth, expanded, onToggleFullscreen, onBooking, onBlock, onRoom, onRange }: CalendarProps) {
  const [building, setBuilding] = useState("all");
  const [filter, setFilter] = useState("");
  const [start, setStart] = useState<Selection | null>(null);
  const [hover, setHover] = useState<Selection | null>(null);
  const drag = useRef<Selection | null>(null);
  const days = eachNight(monthRange(month));
  const today = hotelToday();
  const visible = state.rooms.filter((room) => (building === "all" || String(room.building) === building)
    && room.label.toLowerCase().includes(filter.trim().toLowerCase()));
  const groups = roomGroups(visible);
  const preview = start && hover?.roomId === start.roomId ? selectedRange(start.day, hover.day) : null;
  const fullscreenLabel = expanded ? "Выйти из полноэкранной шахматки" : "Открыть шахматку на весь экран";
  const FullscreenIcon = expanded ? Minimize2 : Maximize2;

  function complete(entry: Selection, lastDay: string) {
    onRange(entry.roomId, selectedRange(entry.day, lastDay));
    setStart(null);
    setHover(null);
  }

  function choose(roomId: string, day: string) {
    if (start?.roomId === roomId) complete(start, day);
    else {
      setStart({ roomId, day });
      setHover(null);
    }
  }

  function release(event: MouseEvent, roomId: string, day: string) {
    const anchor = drag.current;
    drag.current = null;
    if (event.button === 0 && anchor?.roomId === roomId && anchor.day !== day) complete(anchor, day);
  }

  function renderRoom(room: Room) {
    const ranges = occupiedRanges(state, room.id);
    return (
      <tr key={room.id} className="calendar-room-row">
        <th scope="row" className="calendar-first">
          <button type="button" className="calendar-room-name" aria-label={"Изменить комнату " + room.label} onClick={() => onRoom(room.id)}>
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
            return (
              <td colSpan={length} key={day} className="calendar-occupied">
                <button className={"calendar-strip strip-" + occupied.kind} type="button"
                  title={label + " · " + stayLabel(occupied.range)}
                  aria-label={(occupied.kind === "booking" ? "Бронь " : "Закрытие ") + label + ", " + stayLabel(occupied.range)}
                  onClick={() => occupied.kind === "booking" ? onBooking(occupied.record.id) : onBlock(occupied.record.id)}>
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
                onClick={() => choose(room.id, day)}
                onMouseDown={(event) => {
                  if (event.button === 0) drag.current = { roomId: room.id, day };
                }}
                onMouseEnter={(event) => {
                  const anchor = drag.current;
                  if (anchor?.roomId === room.id && event.buttons === 1) {
                    setStart(anchor);
                    setHover({ roomId: room.id, day });
                  } else if (start?.roomId === room.id) {
                    setHover({ roomId: room.id, day });
                  }
                }}
                onMouseUp={(event) => release(event, room.id, day)} />
            </td>
          );
        })}
      </tr>
    );
  }

  return (
    <section aria-labelledby="calendar-heading" className="calendar-section">
      <div className="admin-section-heading calendar-heading">
        <div><h2 id="calendar-heading">Шахматка</h2><p>Выберите две клетки в строке комнаты или протяните выделение мышью.</p></div>
        <div className="calendar-filters">
          <SelectField className="compact-field" label="Корпус" value={building}
            onChange={(value) => { setBuilding(value); setStart(null); }}
            options={[{ value: "all", label: "Все корпуса" }, { value: "1", label: "Корпус 1" }, { value: "2", label: "Корпус 2" }]} />
          <label className="compact-field">Комната
            <div className="icon-input"><Search size={16} aria-hidden="true" /><input type="search" placeholder="Номер или подпись" value={filter}
              onChange={(event) => { setFilter(event.target.value); setStart(null); }} /></div>
          </label>
        </div>
      </div>
      <div className="calendar-card">
        <div className="calendar-toolbar">
          <div className="month-control">
            <button className="icon-button" type="button" aria-label="Предыдущий месяц" disabled={month <= "1900-01"}
              onClick={() => { setMonth(shiftMonth(month, -1)); setHover(null); }}><ChevronLeft size={20} /></button>
            <strong aria-live="polite"><CalendarDays size={17} aria-hidden="true" /> {monthLabel(month)}</strong>
            <button className="icon-button" type="button" aria-label="Следующий месяц" disabled={month >= "2099-12"}
              onClick={() => { setMonth(shiftMonth(month, 1)); setHover(null); }}><ChevronRight size={20} /></button>
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
          <div className="calendar-scroll" aria-label="Шахматка по комнатам и датам" tabIndex={0}>
            <table className="calendar-grid" style={{ "--day-count": days.length } as CSSProperties}>
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
          {start ? (
            <>
              <span aria-live="polite">Выбрано {dateLabel(start.day)}. Укажите последнюю ночь.</span>
              <button className="button button-outline button-small" type="button" onClick={() => complete(start, start.day)}>На одну ночь</button>
              <button className="text-button" type="button" onClick={() => { setStart(null); setHover(null); }}>Сбросить выбор</button>
            </>
          ) : <span>Комнат в шахматке: {visible.length}. Нажмите на комнату, чтобы изменить её данные.</span>}
        </div>
      </div>
    </section>
  );
}
