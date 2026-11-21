"use client";

import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { addDays, dateLabel, hotelToday, isDate, monthLabel, monthRange, shiftMonth } from "@/lib/dates";
import { Dialog } from "./dialog";

type Option = { value: string; label: string };

function Control({ label, value, placeholder, className = "", open, onOpen, calendar = false, children }: {
  label: string; value?: string; placeholder?: string; className?: string;
  open: boolean; onOpen: () => void; calendar?: boolean; children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={"picker-control " + className}>
      <span id={id} className="control-label">{label}</span>
      <button type="button" className="control-trigger" aria-labelledby={id} aria-describedby={id + "-value"}
        aria-expanded={open} aria-haspopup="dialog" onClick={onOpen}>
        <span id={id + "-value"} data-placeholder={!value}>{value || placeholder || "Выберите"}</span>
        {calendar ? <CalendarDays size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
      {children}
    </div>
  );
}

export function SelectField({ label, name, value, options, onChange, className, placeholder }: {
  label: string; name?: string; value: string; options: ReadonlyArray<Option>;
  onChange: (value: string) => void; className?: string; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  return (
    <Control label={label} value={options.find((option) => option.value === value)?.label} placeholder={placeholder}
      className={className} open={open} onOpen={() => { setClosing(false); setOpen(true); }}>
      {name && <input type="hidden" name={name} value={value} />}
      {open && (
        <Dialog variant="sheet" title={label} dismiss={closing} onClose={() => setOpen(false)}>
          <ul className="picker-options">
            {options.map((option) => (
              <li key={option.value}>
                <button type="button" aria-pressed={value === option.value}
                  onClick={() => { if (!closing) { setClosing(true); onChange(option.value); } }}>
                  {option.label}{value === option.value && <Check size={18} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </Control>
  );
}

type DateFieldProps = {
  label: string; name?: string; value: string; onChange: (value: string) => void;
  min?: string; max?: string; className?: string;
};
const firstDate = "1900-01-01";
const lastDate = "2099-12-31";
const week = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const monthNames = new Intl.DateTimeFormat("ru-RU", { month: "long", timeZone: "UTC" });
const labelOf = (date: string) => dateLabel(date) + " " + date.slice(0, 4);
const shortDay = (value: string) => value.slice(8, 10) + "." + value.slice(5, 7) + "." + value.slice(0, 4);

export function DateField({ label, name, value, onChange, min = firstDate, max = lastDate, className }: DateFieldProps) {
  const [openingDate, setOpeningDate] = useState("");
  const [closing, setClosing] = useState(false);
  function open() {
    const base = isDate(value) ? value : hotelToday();
    setOpeningDate(base < min ? min : base > max ? max : base);
    setClosing(false);
  }
  return (
    <Control label={label} value={value ? shortDay(value) : ""} placeholder="Выберите дату" className={className}
      open={!!openingDate} onOpen={open} calendar>
      {name && <input type="hidden" name={name} value={value} />}
      {openingDate && (
        <Dialog variant="sheet" title={label} dismiss={closing} onClose={() => setOpeningDate("")}>
          <DateCalendar initial={openingDate} value={value} min={min} max={max} onPick={(date) => {
            if (!closing) {
              setClosing(true);
              onChange(date);
            }
          }} />
        </Dialog>
      )}
    </Control>
  );
}

function DateCalendar({ initial, value, min, max, onPick }: {
  initial: string; value: string; min: string; max: string; onPick: (date: string) => void;
}) {
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [focused, setFocused] = useState(initial);
  const [chooseMonth, setChooseMonth] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const focusDay = useRef(false);
  const grid = useRef<HTMLDivElement>(null);
  const start = monthRange(month).checkIn;
  const offset = (new Date(start).getUTCDay() + 6) % 7;
  const today = hotelToday();
  const minMonth = min.slice(0, 7);
  const maxMonth = max.slice(0, 7);

  useEffect(() => {
    if (focusDay.current) {
      grid.current?.querySelector<HTMLElement>('[data-day="' + focused + '"]')?.focus({ preventScroll: true });
      focusDay.current = false;
    }
  }, [focused, month]);

  function switchMonth(next: string) {
    setMonth(next);
    const first = next + "-01";
    setFocused(first < min ? min : first);
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = addDays(date, delta);
    if (next < min || next > max) return;
    focusDay.current = true;
    setMonth(next.slice(0, 7));
    setFocused(next);
  }
  if (min > max) return <p className="notice">В этом сезоне даты закончились.</p>;
  if (chooseMonth) {
    return (
      <div className="picker-calendar">
        <div className="picker-month-bar">
          <button type="button" className="icon-button" aria-label="Предыдущий год"
            disabled={year <= Number(min.slice(0, 4))} onClick={() => setYear(year - 1)}><ChevronLeft size={19} /></button>
          <strong role="status">{year}</strong>
          <button type="button" className="icon-button" aria-label="Следующий год"
            disabled={year >= Number(max.slice(0, 4))} onClick={() => setYear(year + 1)}><ChevronRight size={19} /></button>
        </div>
        <div className="picker-months">
          {Array.from({ length: 12 }, (_, index) => {
            const next = year + "-" + String(index + 1).padStart(2, "0");
            const title = monthNames.format(new Date(next + "-01"));
            return (
              <button key={next} type="button" aria-pressed={next === month} disabled={next < minMonth || next > maxMonth}
                onClick={() => { switchMonth(next); setChooseMonth(false); }}>{title[0].toUpperCase() + title.slice(1)}</button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="picker-calendar">
      <div className="picker-month-bar">
        <button type="button" className="icon-button" aria-label="Предыдущий месяц"
          disabled={month <= minMonth} onClick={() => switchMonth(shiftMonth(month, -1))}><ChevronLeft size={19} /></button>
        <button type="button" className="picker-month-name" aria-label="Выбрать месяц и год"
          onClick={() => { setYear(Number(month.slice(0, 4))); setChooseMonth(true); }}>
          {monthLabel(month)} <ChevronDown size={15} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" aria-label="Следующий месяц"
          disabled={month >= maxMonth} onClick={() => switchMonth(shiftMonth(month, 1))}><ChevronRight size={19} /></button>
      </div>
      <div className="picker-days">
        {week.map((day) => <span key={day} aria-hidden="true">{day}</span>)}
      </div>
      <div className="picker-days picker-dates" ref={grid} key={month}>
        {Array.from({ length: 42 }, (_, index) => {
          const date = addDays(start, index - offset);
          if (!date.startsWith(month)) return <span className="picker-spacer" key={date} aria-hidden="true" />;
          return (
            <button key={date} type="button" data-day={date} aria-label={labelOf(date)} aria-pressed={value === date}
              aria-current={today === date ? "date" : undefined} tabIndex={focused === date ? 0 : -1}
              disabled={date < min || date > max} onKeyDown={(event) => navigate(event, date)} onClick={() => onPick(date)}>
              {Number(date.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
