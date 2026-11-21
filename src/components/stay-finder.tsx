"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { availableRooms } from "@/lib/bookings";
import { categories, findCategory, quoteStay, type CategoryId } from "@/lib/catalog";
import { countLabel, firstArrival, nightsBetween, season, stayError, stayLabel, type Stay } from "@/lib/dates";
import { readStay, site, stayHref } from "@/lib/site";
import { DateSearch } from "./date-search";
import { useHotel } from "./hotel-provider";
import { RoomCard, type SearchResult } from "./room-card";

type FinderProps = {
  categoryId?: CategoryId;
  browse?: boolean;
  formClassName?: string;
  resultsClassName?: string;
  children?: ReactNode;
};

function Catalog() {
  return (
    <>
      <div className="section-heading"><h2>Категории номеров</h2></div>
      <div className="room-grid">
        {categories.map((category) => <RoomCard key={category.id} category={category} />)}
      </div>
    </>
  );
}

function Finder({ categoryId, browse, formClassName, resultsClassName, children }: FinderProps) {
  const query = useSearchParams();
  const { state, storageError } = useHotel();
  const [earliest, setEarliest] = useState<string>(season.checkIn);
  const [scrollRequest, setScrollRequest] = useState<{ key: string } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => setEarliest(firstArrival()), []);

  const requested = query.has("checkIn") || query.has("checkOut");
  const stay = readStay(query);
  const category = categoryId ? findCategory(categoryId) : undefined;
  const capacityError = category && stay.guests > category.capacity
    ? "В этой категории меньше мест. Уменьшите число гостей."
    : null;
  const error = requested ? stayError(stay, earliest) ?? capacityError : null;
  const searched = requested && !error;
  const searchKey = stayHref("", stay);

  function search(next: Stay) {
    const url = new URL(window.location.href);
    url.searchParams.set("checkIn", next.checkIn);
    url.searchParams.set("checkOut", next.checkOut);
    url.searchParams.set("guests", String(next.guests));
    url.searchParams.delete("category");
    url.hash = "";
    if (url.href !== window.location.href) window.history.pushState(null, "", url.pathname + url.search);
    setScrollRequest({ key: stayHref("", next) });
  }

  useEffect(() => {
    if (!searched || scrollRequest?.key !== searchKey) return;
    const frame = requestAnimationFrame(() => {
      title.current?.focus({ preventScroll: true });
      title.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
      setScrollRequest(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [searched, searchKey, scrollRequest]);

  const rows = searched && state
    ? categories.filter((category) => categoryId ? category.id === categoryId : category.capacity >= stay.guests)
        .map((category) => {
          const available = availableRooms(state, category.id, stay).length > 0;
          const result: SearchResult = {
            available,
            known: state.rooms.some((room) => room.categoryId === category.id),
            total: available ? quoteStay(category.id, stay)?.total ?? null : null,
            nights: nightsBetween(stay),
          };
          return { category, result };
        }).sort((a, b) => rank(a.result) - rank(b.result))
    : [];
  const resultsClass = resultsClassName ? " " + resultsClassName : "";

  return (
    <>
      <div className={formClassName}>
        <DateSearch key={searchKey} initial={requested ? stay : undefined} categoryId={categoryId} onSearch={search} />
        {error && <p className="form-error search-query-error" role="alert">{error}</p>}
      </div>
      {children}
      {searched ? (
        <section className={"finder-results" + resultsClass} id="search-results" aria-labelledby="search-results-title">
          <div className="section-heading">
            <div>
              <h2 id="search-results-title" ref={title} tabIndex={-1}>Номера на ваши даты</h2>
              <p>{stayLabel(stay)} · {countLabel(stay.guests, ["гость", "гостя", "гостей"])}</p>
            </div>
          </div>
          <div key={searchKey} className="finder-content">
            {storageError && <p className="form-error" role="alert">{storageError}</p>}
            {!state && !storageError && <p className="notice" role="status">Проверяем наличие номеров…</p>}
            {state && !categoryId && !rows.some(({ result }) => result.available) && (
              <p className="notice">На эти даты свободных вариантов для онлайн-заявки нет. <a href={"tel:" + site.telephone}>Позвоните администратору</a>, чтобы уточнить наличие.</p>
            )}
            <div className={categoryId ? "category-result" : "room-grid"}>
              {rows.map(({ category, result }) => (
                <RoomCard key={category.id} category={category} stay={stay} result={result} compact={!!categoryId} />
              ))}
            </div>
          </div>
        </section>
      ) : browse && <section className={"catalog-list" + resultsClass}><Catalog /></section>}
    </>
  );
}

export function StayFinder({ children, ...props }: FinderProps) {
  return (
    <Suspense fallback={
      <>
        <div className={props.formClassName}><DateSearch categoryId={props.categoryId} /></div>
        {children}
        {props.browse && <section className={"catalog-list " + (props.resultsClassName ?? "")}><Catalog /></section>}
      </>
    }>
      <Finder {...props}>{children}</Finder>
    </Suspense>
  );
}

function rank({ available, known }: SearchResult) {
  return available ? 0 : known ? 2 : 1;
}
