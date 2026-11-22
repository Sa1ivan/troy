"use client";

import { CalendarDays, Search, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { countLabel, firstArrival, season, stayError, type Stay } from "@/lib/dates";
import { DateRangeField, SelectField } from "./controls";

export const emptyStay: Stay = { checkIn: "", checkOut: "", guests: 2 };

export function DateSearch({ stay = emptyStay, earliest = season.checkIn, capacity, scoped, onChange, onSearch }: {
  stay?: Stay; earliest?: string; capacity: number; scoped?: boolean;
  onChange?: (next: Stay) => void; onSearch?: (stay: Stay) => void;
}) {
  const [error, setError] = useState("");

  function update(next: Stay) {
    setError("");
    onChange?.(next);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = stayError(stay, firstArrival()) ?? (stay.guests > capacity ? "Уменьшите число гостей для этой категории." : null);
    setError(invalid ?? "");
    if (!invalid) onSearch?.(stay);
  }

  return (
    <form className="date-search" aria-label="Подбор номера" inert={!onSearch} onSubmit={search}>
      <div className="search-field search-dates">
        <CalendarDays size={22} aria-hidden="true" />
        <DateRangeField range={stay} min={earliest} max={season.checkOut}
          onChange={(range) => update({ ...stay, ...range })} />
      </div>
      <div className="search-field search-guests">
        <UsersRound size={22} aria-hidden="true" />
        <SelectField className="search-control" label="Гости" value={String(stay.guests)}
          onChange={(count) => update({ ...stay, guests: Number(count) })}
          options={Array.from({ length: capacity }, (_, index) => ({
            value: String(index + 1), label: countLabel(index + 1, ["гость", "гостя", "гостей"]),
          }))} />
      </div>
      <button className="button button-primary search-button" type="submit" disabled={!onSearch}>
        <Search size={18} aria-hidden="true" /> {scoped ? "Проверить наличие" : "Найти номер"}
      </button>
      {error && <p className="form-error search-error" role="alert">{error}</p>}
    </form>
  );
}
