"use client";

import { CalendarDays, Search, UsersRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { findCategory, type CategoryId } from "@/lib/catalog";
import { addDays, countLabel, firstArrival, isDate, maxGuests, season, stayError, type Stay } from "@/lib/dates";
import { DateField, SelectField } from "./controls";

export function DateSearch({ initial, categoryId, onSearch }: { initial?: Stay; categoryId?: CategoryId; onSearch?: (stay: Stay) => void }) {
  const [arrivalLimit, setArrivalLimit] = useState<string>(season.checkIn);
  const [checkIn, setCheckIn] = useState(initial?.checkIn && isDate(initial.checkIn) ? initial.checkIn : "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut && isDate(initial.checkOut) ? initial.checkOut : "");
  const capacity = (categoryId && findCategory(categoryId)?.capacity) || maxGuests;
  const [guests, setGuests] = useState(initial?.guests && Number.isInteger(initial.guests) && initial.guests >= 1 && initial.guests <= capacity ? initial.guests : 2);
  const [error, setError] = useState("");
  useEffect(() => setArrivalLimit(firstArrival()), []);
  const minDeparture = isDate(checkIn) && checkIn >= arrivalLimit && checkIn < season.checkOut ? addDays(checkIn, 1) : addDays(arrivalLimit, 1);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const stay = { checkIn, checkOut, guests };
    const invalid = stayError(stay, firstArrival());
    setError(invalid ?? "");
    if (!invalid) onSearch?.(stay);
  }

  return (
    <form className="date-search" aria-label="Подбор номера" inert={!onSearch} onSubmit={search}>
      <div className="search-field">
        <CalendarDays size={22} aria-hidden="true" />
        <DateField className="search-control" label="Заезд" min={arrivalLimit} max={addDays(season.checkOut, -1)}
          value={checkIn} onChange={(date) => {
            setCheckIn(date);
            if (checkOut <= date) setCheckOut("");
            setError("");
          }} />
      </div>
      <div className="search-field">
        <CalendarDays size={22} aria-hidden="true" />
        <DateField className="search-control" label="Выезд" min={minDeparture} max={season.checkOut}
          value={checkOut} onChange={(date) => { setCheckOut(date); setError(""); }} />
      </div>
      <div className="search-field search-guests">
        <UsersRound size={22} aria-hidden="true" />
        <SelectField className="search-control" label="Гости" value={String(guests)} onChange={(count) => setGuests(Number(count))}
          options={Array.from({ length: capacity }, (_, index) => ({
            value: String(index + 1), label: countLabel(index + 1, ["гость", "гостя", "гостей"]),
          }))} />
      </div>
      <button className="button button-primary search-button" type="submit" disabled={!onSearch}>
        <Search size={18} aria-hidden="true" /> {categoryId ? "Проверить наличие" : "Найти номер"}
      </button>
      {error && <p className="form-error search-error" role="alert">{error}</p>}
    </form>
  );
}
