"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, CircleCheck, Phone, UsersRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { availableRooms } from "@/lib/bookings";
import { findCategory, money, quoteStay, type Category } from "@/lib/catalog";
import { countLabel, firstArrival, nightsBetween, season, stayError, stayLabel, type Stay } from "@/lib/dates";
import { isPagesDemo, readStay, roomHref, routes, site, stayHref } from "@/lib/site";
import { newRecordId } from "@/lib/storage";
import { useHotel } from "./hotel-provider";
import { StayFinder } from "./stay-finder";

export function BookingOverview({ invalid }: { invalid?: boolean }) {
  return (
    <>
      {invalid && <p className="notice">Выберите даты проживания и подходящую категорию.</p>}
      <p className="booking-instructions">{isPagesDemo
        ? "Выберите даты и категорию номера, чтобы оформить тестовую заявку."
        : "Выберите даты и категорию номера, оставьте имя и телефон. Администратор перезвонит, чтобы подтвердить проживание."}</p>
      <StayFinder>
        <a className="text-link booking-overview-phone" href={"tel:" + site.telephone}><Phone size={17} aria-hidden="true" /> {site.phone}</a>
      </StayFinder>
    </>
  );
}

export function GuestBooking() {
  const query = useSearchParams();
  const category = findCategory(query.get("category"));
  const stay = readStay(query);
  const [earliest, setEarliest] = useState<string>(season.checkIn);
  useEffect(() => setEarliest(firstArrival()), []);
  if (!category || stayError(stay, earliest) || stay.guests > category.capacity) {
    return <BookingOverview invalid={query.has("category")} />;
  }
  return <BookingForm key={query.toString()} category={category} stay={stay} />;
}

function BookingForm({ category, stay }: { category: Category; stay: Stay }) {
  const { state, storageError, dispatch } = useHotel();
  const [id, setId] = useState("");
  const [confirmationHeight, setConfirmationHeight] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const success = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (id) success.current?.focus({ preventScroll: true }); }, [id]);

  const estimate = quoteStay(category.id, stay);
  const available = state && availableRooms(state, category.id, stay).length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    const invalid = stayError(stay, firstArrival());
    if (invalid || !data.has("consent")) {
      setError(invalid ?? "Для обработки заявки нужно согласие на обработку данных.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const nextId = newRecordId();
      await dispatch({
        type: "request", id: nextId, categoryId: category.id, stay,
        contact: { name: String(data.get("name")), phone: String(data.get("phone")) },
      });
      setConfirmationHeight(panel.current?.getBoundingClientRect().height ?? 0);
      setId(nextId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить заявку.");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  return (
    <div className="booking-layout view-enter">
      <aside className="booking-summary">
        <h2>{category.name}</h2>
        <p><CalendarDays size={18} aria-hidden="true" /> {stayLabel(stay)}</p>
        <p><UsersRound size={18} aria-hidden="true" /> {countLabel(stay.guests, ["гость", "гостя", "гостей"])}</p>
        <div className="booking-summary-total">
          {estimate ? <><strong>{money(estimate.total)}</strong><span>за {countLabel(nightsBetween(stay), ["ночь", "ночи", "ночей"])} · ориентировочная стоимость</span></>
            : <span>Стоимость уточнит администратор при звонке.</span>}
        </div>
        <Link href={stayHref(roomHref(category.id), stay)}>Фотографии и описание</Link>
      </aside>
      <div ref={panel} className={"booking-panel" + (id || available ? " booking-contact-panel" : "")}
        style={id && confirmationHeight ? { minBlockSize: confirmationHeight } : undefined}>
        {id ? (
          <section className="booking-success view-enter" aria-live="polite">
            <CircleCheck size={39} aria-hidden="true" />
            <h2 tabIndex={-1} ref={success}>{isPagesDemo ? "Тестовая заявка сохранена" : "Заявка принята"}</h2>
            <p>Номер заявки <strong>{id}</strong>. {isPagesDemo
              ? "Откройте админку в этом же браузере, чтобы подтвердить заявку."
              : "Администратор перезвонит, чтобы подтвердить даты и стоимость."}</p>
            <Link className="button button-primary" href={routes.home}>На главную</Link>
          </section>
        ) : storageError ? <p className="form-error" role="alert">{storageError}</p>
          : !state ? <p role="status">Проверяем наличие…</p>
          : !available ? (
            <div>
              <h2>Уточните наличие</h2>
              <p>На выбранные даты в этой категории нет свободной комнаты для онлайн-заявки.</p>
              <div className="button-row">
                <Link className="button button-primary" href={stayHref(routes.rooms, stay)}>Другие номера</Link>
                <a href={"tel:" + site.telephone} className="button button-outline">Позвонить</a>
              </div>
            </div>
          ) : (
            <form className="field-stack" onSubmit={submit}>
              <h2>Ваши контакты</h2>
              <p className="muted">{isPagesDemo ? "Тестовая заявка сохранится в этом браузере." : "Администратор перезвонит по указанному номеру."}</p>
              <label>Имя<input name="name" autoComplete="name" placeholder="Как к вам обращаться" required minLength={2} maxLength={80} /></label>
              <label>Телефон<input name="phone" autoComplete="tel" placeholder="+7 (___) ___-__-__" type="tel" required maxLength={30} /></label>
              <label className="consent-field">
                <input type="checkbox" name="consent" required />
                <span>Согласен на обработку <Link href={routes.policy} target="_blank" rel="noreferrer">персональных данных</Link>.</span>
              </label>
              <p className="demo-note">Локальная демонстрация. Для проверки используйте тестовое имя и телефон.</p>
              {error && <p role="alert" className="form-error">{error}</p>}
              <button className="button button-primary" type="submit" disabled={busy}>
                {busy ? "Сохраняем…" : isPagesDemo ? "Сохранить тестовую заявку" : "Отправить заявку"}
              </button>
            </form>
          )}
      </div>
    </div>
  );
}
