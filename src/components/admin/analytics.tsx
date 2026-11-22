"use client";

import { Banknote, BedDouble, CircleDollarSign, LogIn, LogOut, Undo2, Wallet } from "lucide-react";
import { useState } from "react";
import { getReport, type HotelState } from "@/lib/bookings";
import { money } from "@/lib/catalog";
import { addDays, isDate, monthRange } from "@/lib/dates";
import { DateField } from "../controls";

const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

export function Analytics({ state, month }: { state: HotelState; month: string }) {
  const period = monthRange(month);
  const [from, setFrom] = useState(period.checkIn);
  const [to, setTo] = useState(addDays(period.checkOut, -1));
  const valid = isDate(from) && isDate(to) && from <= to && to < "9999-12-31";
  const report = valid ? getReport(state, { checkIn: from, checkOut: addDays(to, 1) }) : null;
  const metrics = report && [
    { label: "Стоимость проживаний", value: money(report.revenue), detail: "Ночи за период", icon: Banknote },
    { label: "Загрузка", value: percent.format(report.occupancy) + " %", detail: "Занято " + report.occupiedNights + " из " + report.sellableNights + " доступных ночей", icon: BedDouble },
    { label: "Получено", value: money(report.received), icon: CircleDollarSign },
    { label: "Возвращено", value: money(report.refunded), icon: Undo2 },
    { label: "Чистые поступления", value: money(report.netReceived), icon: Wallet },
    { label: "Заезды", value: report.arrivals, icon: LogIn },
    { label: "Выезды", value: report.departures, icon: LogOut },
  ];
  return (
    <section aria-labelledby="analytics-heading">
      <div className="admin-section-heading">
        <div><h2 id="analytics-heading">Деньги и аналитика</h2><p>Стоимость проживания учитывается по ночам, оплаты и возвраты по дате операции.</p></div>
        <div className="calendar-filters">
          <DateField className="compact-field" label="С" value={from} max={to} onChange={setFrom} />
          <DateField className="compact-field" label="По" value={to} min={from} onChange={setTo} />
        </div>
      </div>
      {report && metrics ? (
        <>
          <dl className="analytics-metrics">
            {metrics.map(({ label, value, detail, icon: Icon }) => (
              <div className="metric-card" key={label}>
                <dt><Icon size={18} aria-hidden="true" /> {label}</dt><dd>{value}</dd>
                {detail && <dd className="metric-detail">{detail}</dd>}
              </div>
            ))}
          </dl>
          <div className="analytics-load">
            <h3>Загрузка по корпусам</h3>
            {report.buildings.map(({ building, occupancy, occupiedNights, sellableNights }) => (
              <div className="load-row" key={building}>
                <div><strong>Корпус {building}</strong><span>{occupiedNights} из {sellableNights} ночей</span></div>
                <progress max={100} value={occupancy} aria-label={"Загрузка корпуса " + building} />
                <strong>{percent.format(occupancy)} %</strong>
              </div>
            ))}
          </div>
        </>
      ) : <p role="alert" className="form-error">Выберите корректные даты отчёта.</p>}
    </section>
  );
}
