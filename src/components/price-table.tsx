"use client";

import { useId, useState } from "react";
import { categoriesForRate, money, periods, seasonYear, tariffs, type RateId } from "@/lib/catalog";
import { roomHref } from "@/lib/site";
import { StayLink } from "./stay-link";

const rates = (Object.keys(tariffs) as RateId[]).map((id) => ({ id, ...tariffs[id], rooms: categoriesForRate(id) }));

export function PriceTable() {
  const [period, setPeriod] = useState<string>(periods[0].start);
  const periodId = useId();
  return (
    <>
      <div className="tariff-period">
        <label htmlFor={periodId}>Период</label>
        <select id={periodId} value={period} onChange={(event) => setPeriod(event.target.value)}>
          {periods.map(({ start, label }) => <option value={start} key={start}>{label}</option>)}
        </select>
      </div>
      <div className="table-scroll tariff-scroll" tabIndex={0} aria-label={"Таблица цен на сезон " + seasonYear}>
        <table className="tariff-table">
          <thead>
            <tr><th scope="col">Категория</th>{periods.map(({ start, label }) => (
              <th scope="col" data-current-period={start === period} key={start}>{label}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rates.map(({ id, label, prices, rooms }) => (
              <tr key={id}>
                <th scope="row">
                  {rooms.length === 1
                    ? <StayLink href={roomHref(rooms[0].id)}>{label}</StayLink>
                    : <>{label}<span className="tariff-room-links">{rooms.map((room) => (
                      <StayLink key={room.id} href={roomHref(room.id)}>{room.name}</StayLink>
                    ))}</span></>}
                </th>
                {prices.map((price, index) => (
                  <td data-current-period={periods[index].start === period} key={periods[index].start}>{money(price * 100)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
