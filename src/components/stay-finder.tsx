"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { categoryIsFree, nearbyStay, roomsForParty, type Availability } from "@/lib/availability";
import { categories, findCategory, fromPrice, money, quoteStay, type Category, type CategoryId } from "@/lib/catalog";
import { countLabel, firstArrival, maxGuests, season, stayError, stayLabel, type Stay } from "@/lib/dates";
import { readStay, roomHref, routes, site, stayHref } from "@/lib/site";
import { DateSearch } from "./date-search";
import { useHotel } from "./hotel-provider";
import { RoomCard, RoomOffer, type SearchResult } from "./room-card";

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

function resultFor(availability: Availability, category: Category, stay: Stay): SearchResult {
  const available = categoryIsFree(availability, category, stay);
  return {
    available,
    known: roomsForParty(availability, category, stay.guests).length > 0,
    quote: available ? quoteStay(category.id, stay) : null,
  };
}

export function StayAlternatives({ availability, stay, earliest, category }: {
  availability: Availability; stay: Stay; earliest: string; category?: Category;
}) {
  const anotherRoom = category && categories.find((item) => item.id !== category.id && categoryIsFree(availability, item, stay));
  const nearby = nearbyStay(availability, stay, earliest, category);
  if (!anotherRoom && !nearby) return null;
  const estimate = nearby && quoteStay(nearby.category.id, nearby.stay);
  return (
    <div className="stay-alternatives">
      {anotherRoom && (
        <Link href={stayHref(routes.rooms, stay)}>Другие номера на ваши даты</Link>
      )}
      {nearby && (
        <Link href={stayHref(roomHref(nearby.category.id), nearby.stay)}>
          Ближайшие даты · {stayLabel(nearby.stay)}{estimate ? " · " + money(estimate.total) : ""}
        </Link>
      )}
    </div>
  );
}

function StartingPrice({ category }: { category: Category }) {
  const price = fromPrice(category);
  return (
    <div className="category-start-price">
      <h2>Подобрать даты</h2>
      {price !== null && <p>от <strong>{money(price)}</strong> за ночь</p>}
    </div>
  );
}

function Finder({ categoryId, browse, formClassName, resultsClassName, children }: FinderProps) {
  const query = useSearchParams();
  const { availability, storageError } = useHotel();
  const [earliest, setEarliest] = useState<string>(season.checkIn);
  const [scrollRequest, setScrollRequest] = useState<{ key: string } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => setEarliest(firstArrival()), []);

  const requested = query.has("checkIn") || query.has("checkOut");
  const committed = readStay(query);
  const category = categoryId ? findCategory(categoryId) : undefined;
  const capacity = category?.capacity ?? maxGuests;
  const committedKey = stayHref("", committed);
  const [draft, setDraft] = useState({ key: committedKey, stay: committed });
  if (draft.key !== committedKey) setDraft({ key: committedKey, stay: committed });
  const stay = draft.key === committedKey ? draft.stay : committed;
  const check = (criteria: Stay) => stayError(criteria, earliest)
    ?? (criteria.guests > capacity ? "В этой категории меньше мест. Уменьшите число гостей." : null);
  const error = requested ? check(stay) : null;
  const searched = requested && !error;
  const searchKey = stayHref("", stay);

  function writeSearch(next: Stay, replace = false) {
    const url = new URL(window.location.href);
    url.searchParams.set("checkIn", next.checkIn);
    url.searchParams.set("checkOut", next.checkOut);
    url.searchParams.set("guests", String(next.guests));
    url.searchParams.delete("category");
    url.hash = "";
    if (url.href !== window.location.href) {
      if (replace) window.history.replaceState(null, "", url.pathname + url.search);
      else window.history.pushState(null, "", url.pathname + url.search);
    }
  }

  function change(next: Stay) {
    setDraft({ key: committedKey, stay: next });
    if (requested && !check(next)) writeSearch(next, true);
  }

  function search(next: Stay) {
    writeSearch(next);
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

  const rows = searched && availability
    ? (category ? [category] : categories.filter((item) => item.capacity >= stay.guests))
        .map((item) => ({ category: item, result: resultFor(availability, item, stay) }))
        .sort((a, b) => rank(a.result) - rank(b.result))
    : [];
  const noRooms = !!availability && !rows.some(({ result }) => result.available);
  const resultsClass = resultsClassName ? " " + resultsClassName : "";

  const results = searched && (
    <section className={"finder-results" + resultsClass} id="search-results" aria-labelledby="search-results-title">
      <div className="section-heading">
        <div>
          <h2 id="search-results-title" ref={title} tabIndex={-1}>{category ? "На ваши даты" : "Номера на ваши даты"}</h2>
          <p>{stayLabel(stay)} · {countLabel(stay.guests, ["гость", "гостя", "гостей"])}</p>
        </div>
      </div>
      <div className="finder-content" aria-live="polite">
        {storageError && <p className="form-error" role="alert">{storageError}</p>}
        {!availability && !storageError && <p className="notice" role="status">Проверяем наличие номеров…</p>}
        {noRooms && !category && (
          <p className="notice">Свободных номеров для заявки на эти даты нет. <a href={"tel:" + site.telephone}>Уточнить наличие по телефону</a></p>
        )}
        {category
          ? rows[0] && <RoomOffer category={category} stay={stay} result={rows[0].result} showNights />
          : <div className="room-grid">{rows.map(({ category, result }) => <RoomCard key={category.id} category={category} stay={stay} result={result} />)}</div>}
        {noRooms && availability && <StayAlternatives availability={availability} stay={stay} earliest={earliest} category={category} />}
      </div>
    </section>
  );

  return (
    <>
      {category && (searched ? results : <StartingPrice category={category} />)}
      <div className={formClassName}>
        <DateSearch stay={stay} earliest={earliest} capacity={capacity} scoped={!!categoryId} onChange={change} onSearch={search} />
        {error && <p className="form-error search-query-error" role="alert">{error}</p>}
      </div>
      {children}
      {!category && results}
      {!searched && browse && <section className={"catalog-list" + resultsClass}><Catalog /></section>}
    </>
  );
}

export function StayFinder({ children, ...props }: FinderProps) {
  const category = props.categoryId ? findCategory(props.categoryId) : undefined;
  return (
    <Suspense fallback={
      <>
        {category && <StartingPrice category={category} />}
        <div className={props.formClassName}><DateSearch capacity={category?.capacity ?? maxGuests} scoped={!!category} /></div>
        {children}
        {props.browse && <section className={"catalog-list " + (props.resultsClassName ?? "")}><Catalog /></section>}
      </>
    }>
      <Finder {...props}>{children}</Finder>
    </Suspense>
  );
}

function rank({ available, known, quote }: SearchResult) {
  return available ? (quote ? 0 : 1) : known ? 3 : 2;
}
