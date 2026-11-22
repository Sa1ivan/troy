"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, CircleCheck, Copy, Phone, UsersRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { categoryIsFree } from "@/lib/availability";
import { findCategory, money, quoteStay, type Category } from "@/lib/catalog";
import { countLabel, firstArrival, nightsBetween, stayError, stayLabel, type Stay } from "@/lib/dates";
import { requestStatusLabels, type GuestReceipt } from "@/lib/guest-receipts";
import { readStay, roomHref, routes, site, stayHref } from "@/lib/site";
import { newRecordId } from "@/lib/storage";
import { type GuestAttempt, useHotel } from "./hotel-provider";
import { NightBreakdown } from "./room-card";
import { StayAlternatives, StayFinder } from "./stay-finder";

export function BookingOverview({ invalid }: { invalid?: boolean }) {
  const { mode } = useHotel();
  return (
    <>
      {invalid && <p className="notice">Выберите даты проживания и подходящую категорию.</p>}
      <p className="booking-instructions">{mode === "demo"
        ? "Выберите даты и категорию номера, чтобы сохранить тестовую заявку."
        : "Выберите даты и категорию номера, затем укажите контакты."}</p>
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
  if (!category || stayError(stay) || stay.guests > category.capacity) {
    return <BookingOverview invalid={query.has("category")} />;
  }
  return <BookingForm key={stayHref("", stay, category.id)} category={category} stay={stay} />;
}

function readAttempt(key: string): GuestAttempt | null {
  let value: GuestAttempt | null = null;
  try {
    value = JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {}
  const savedInTab = window.history.state?.troyGuestAttempt;
  if (!value && savedInTab?.key === key) value = savedInTab.attempt;
  return value && typeof value.id === "string" && typeof value.token === "string" ? value : null;
}

function storeAttempt(key: string, attempt: GuestAttempt) {
  try {
    localStorage.setItem(key, JSON.stringify(attempt));
  } catch {
    window.history.replaceState({ ...window.history.state, troyGuestAttempt: { key, attempt } }, "");
  }
}

function useBookingReceipt(stay: Stay, category: Category) {
  const { mode, loadReceipt } = useHotel();
  const key = "troy-guest-" + mode + stayHref("", stay, category.id);
  const attempt = useRef<GuestAttempt | null>(null);
  const [receipt, setReceipt] = useState<GuestReceipt | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mode) return;
    let active = true;
    const saved = readAttempt(key);
    attempt.current = saved;
    if (!saved) {
      setLoadedKey(key);
      return;
    }
    void loadReceipt(saved).then((stored) => {
      if (active) {
        setReceipt(stored);
        setLoadedKey(key);
      }
    }).catch((failure) => {
      if (active) {
        setError(failure instanceof Error ? failure.message : "Не удалось проверить статус заявки.");
        setLoadedKey(key);
      }
    });
    return () => { active = false; };
  }, [key, loadReceipt, mode]);

  function getAttempt() {
    setError("");
    if (attempt.current) return attempt.current;
    const next = readAttempt(key) ?? { id: newRecordId(), token: crypto.randomUUID() };
    storeAttempt(key, next);
    attempt.current = next;
    return next;
  }

  function reset() {
    try { localStorage.removeItem(key); } catch {}
    if (window.history.state?.troyGuestAttempt?.key === key) {
      window.history.replaceState({ ...window.history.state, troyGuestAttempt: null }, "");
    }
    attempt.current = null;
    setReceipt(null);
    setError("");
  }

  async function refresh() {
    const current = attempt.current;
    if (!current) return;
    setError("");
    try {
      const next = await loadReceipt(current);
      if (attempt.current !== current) return;
      if (next) setReceipt(next);
      else setError("Заявка пока недоступна. Сохраните её номер для связи с администратором.");
    } catch (failure) {
      if (attempt.current === current) setError(failure instanceof Error ? failure.message : "Не удалось проверить статус заявки.");
    }
  }

  return { receipt, setReceipt, getAttempt, reset, refresh, loading: !!mode && loadedKey !== key, error };
}

function BookingRules() {
  return (
    <details className="booking-rules">
      <summary>Условия проживания</summary>
      <dl>
        <div><dt>Заезд и выезд</dt><dd>Время согласует администратор при подтверждении.</dd></div>
        <div><dt>Стоимость и питание</dt><dd>Администратор уточнит итоговую цену и какие услуги в неё входят.</dd></div>
        <div><dt>Предоплата и отмена</dt><dd>Сумму, срок предоплаты и условия отмены согласуйте до оплаты.</dd></div>
      </dl>
    </details>
  );
}

function BookingForm({ category, stay }: { category: Category; stay: Stay }) {
  const { mode, availability, storageError, submitRequest } = useHotel();
  const { receipt, setReceipt, getAttempt, reset, refresh, loading, error: receiptError } = useBookingReceipt(stay, category);
  const [confirmationHeight, setConfirmationHeight] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [earliest, setEarliest] = useState<string | null>(null);
  const submitting = useRef(false);
  const movedToReceipt = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const success = useRef<HTMLHeadingElement>(null);

  useEffect(() => setEarliest(firstArrival()), []);
  useEffect(() => {
    if (receipt && movedToReceipt.current) {
      movedToReceipt.current = false;
      success.current?.focus({ preventScroll: true });
    }
  }, [receipt]);

  const displayedStay = receipt?.stay ?? stay;
  const displayedCategory = receipt ? findCategory(receipt.categoryId) : category;
  const estimate = displayedCategory ? quoteStay(displayedCategory.id, displayedStay) : null;
  const total = receipt ? receipt.total : estimate?.total ?? null;
  const available = availability && categoryIsFree(availability, category, stay);
  const expired = earliest ? !!stayError(stay, earliest) : false;

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
      const { id, token } = getAttempt();
      const saved = await submitRequest({
        type: "request", id, categoryId: category.id, stay,
        contact: { name: String(data.get("name")), phone: String(data.get("phone")) },
      }, token);
      setConfirmationHeight(panel.current?.getBoundingClientRect().height ?? 0);
      movedToReceipt.current = true;
      setReceipt(saved);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить заявку.");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopyStatus("Номер заявки скопирован.");
    } catch {
      setCopyStatus("Выделите номер заявки и скопируйте его.");
    }
  }

  return (
    <div className="booking-layout view-enter">
      <aside className="booking-summary">
        <h2>{displayedCategory?.name ?? "Категория уточняется"}</h2>
        <p><CalendarDays size={18} aria-hidden="true" /> {stayLabel(displayedStay)}</p>
        <p><UsersRound size={18} aria-hidden="true" /> {countLabel(displayedStay.guests, ["гость", "гостя", "гостей"])}</p>
        <div className="booking-summary-total">
          {total !== null
            ? <><strong>{money(total)}</strong><span>за {countLabel(nightsBetween(displayedStay), ["ночь", "ночи", "ночей"])}{!receipt || receipt.status === "pending" ? " · ориентировочная стоимость" : ""}</span></>
            : <span>Стоимость уточнит администратор.</span>}
        </div>
        {estimate && estimate.total === total && <NightBreakdown nights={estimate.nights} />}
        {displayedCategory?.galleries.length
          ? <Link href={stayHref(roomHref(displayedCategory.id), displayedStay)}>Фотографии и описание</Link>
          : displayedCategory && <Link href={stayHref(roomHref(displayedCategory.id), displayedStay)}>Описание номера</Link>}
      </aside>
      <div ref={panel} className={"booking-panel" + (receipt || available ? " booking-contact-panel" : "")}
        style={receipt && confirmationHeight ? { minBlockSize: confirmationHeight } : undefined}>
        {receipt ? (
          <section className="booking-success view-enter" aria-live="polite">
            <CircleCheck size={39} aria-hidden="true" />
            <h2 tabIndex={-1} ref={success}>{mode === "demo" ? "Тестовая заявка сохранена" : "Заявка принята"}</h2>
            <p>Заявка <strong>{receipt.id}</strong><br />Статус <strong>{requestStatusLabels[receipt.status]}</strong></p>
            {receipt.status === "pending" && (
              <p className="muted">{mode === "demo"
                ? "Заявка доступна в админке этого браузера."
                : "Администратор свяжется с вами, чтобы подтвердить даты и стоимость."}</p>
            )}
            <div className="button-row">
              <button className="button button-outline" type="button" onClick={() => void copy(receipt.id)}><Copy size={17} aria-hidden="true" /> Скопировать номер</button>
              <button className="text-button" type="button" onClick={() => void refresh()}>Обновить статус</button>
              <button className="text-button" type="button" onClick={() => { reset(); setCopyStatus(""); }}>Новая заявка</button>
            </div>
            {copyStatus && <p className="muted" role="status">{copyStatus}</p>}
            {receiptError && <p className="form-error" role="alert">{receiptError}</p>}
          </section>
        ) : storageError ? <p className="form-error" role="alert">{storageError}</p>
          : !availability || loading || !earliest ? <p role="status">Проверяем заявку и наличие номера…</p>
          : expired || !available ? (
            <div>
              <h2>{expired ? "Выберите новые даты" : "Уточните наличие"}</h2>
              <p>{expired ? "Даты этой поездки уже прошли." : "На выбранные даты в этой категории нет свободной комнаты для онлайн-заявки."}</p>
              {!expired && <StayAlternatives availability={availability} stay={stay} earliest={earliest} category={category} />}
              <div className="button-row">
                <Link className="button button-primary" href={stayHref(roomHref(category.id), stay) + "#dates"}>Изменить даты</Link>
                <a href={"tel:" + site.telephone} className="button button-outline">Позвонить</a>
              </div>
            </div>
          ) : (
            <form className="field-stack" onSubmit={submit}>
              <h2>Ваши контакты</h2>
              {mode === "demo"
                ? <p className="demo-note">Тестовая заявка сохранится в этом браузере. Используйте тестовое имя и телефон.</p>
                : <p className="muted">Администратор получит заявку и свяжется с вами по указанному номеру.</p>}
              <BookingRules />
              <label>Имя<input name="name" autoComplete="name" placeholder="Как к вам обращаться" required minLength={2} maxLength={80} /></label>
              <label>Телефон<input name="phone" autoComplete="tel" placeholder="+7 (___) ___-__-__" type="tel" required maxLength={30} /></label>
              <label className="consent-field">
                <input type="checkbox" name="consent" required />
                <span>Согласен на обработку <Link href={routes.policy} target="_blank" rel="noreferrer">персональных данных</Link>.</span>
              </label>
              {(error || receiptError) && <p role="alert" className="form-error">{error || receiptError}</p>}
              <button className="button button-primary" type="submit" disabled={busy}>
                {busy ? "Сохраняем…" : mode === "demo" ? "Сохранить тестовую заявку" : "Отправить заявку"}
              </button>
            </form>
          )}
      </div>
    </div>
  );
}
