import Image from "next/image";
import Link from "next/link";
import { BedDouble, Maximize2, UsersRound } from "lucide-react";
import { fromPrice, money, type Category, type NightPrice } from "@/lib/catalog";
import { countLabel, dateLabel, nightsBetween, type Stay } from "@/lib/dates";
import { roomHref, routes, site, stayHref, withBasePath } from "@/lib/site";

export type SearchResult = {
  available: boolean;
  known: boolean;
  quote: { total: number; nights: NightPrice[] } | null;
};

export function NightBreakdown({ nights }: { nights: NightPrice[] }) {
  if (nights.length < 2) return null;
  return (
    <details className="night-breakdown">
      <summary>Расчёт по ночам</summary>
      <ul>
        {nights.map(({ date, amount }) => <li key={date}><time dateTime={date}>{dateLabel(date)}</time><span>{money(amount)}</span></li>)}
      </ul>
    </details>
  );
}

export function RoomOffer({ category, stay, result, showNights }: {
  category: Category; stay?: Stay; result?: SearchResult; showNights?: boolean;
}) {
  const detail = roomHref(category.id);
  const price = fromPrice(category);

  if (!stay || !result) {
    return (
      <div className="room-card-tail">
        <p className="room-price">{price === null ? <span>Стоимость по запросу</span> : <><strong>от {money(price)}</strong><span>за ночь</span></>}</p>
        <Link className="button button-outline" href={detail}>Подробнее</Link>
      </div>
    );
  }

  if (!result.available) {
    return (
      <div className="room-card-tail">
        <p className="room-state">{result.known ? "Нет свободных номеров" : "Наличие по запросу"}</p>
        {result.known
          ? !showNights && <Link className="button button-outline" href={stayHref(detail, stay)}>Другие даты</Link>
          : <a className="button button-outline" href={"tel:" + site.telephone}>Позвонить о наличии</a>}
      </div>
    );
  }

  return (
    <>
      <div className="room-card-tail">
        {result.quote ? (
          <p className="room-price"><strong>{money(result.quote.total)}</strong><span>за {countLabel(nightsBetween(stay), ["ночь", "ночи", "ночей"])}</span></p>
        ) : <p className="room-state">Стоимость по запросу</p>}
        <Link className="button button-primary" href={stayHref(routes.booking, stay, category.id)}>
          {result.quote ? "Оставить заявку" : "Запросить стоимость"}
        </Link>
      </div>
      {showNights && result.quote && <NightBreakdown nights={result.quote.nights} />}
    </>
  );
}

export function RoomCard({ category, stay, result }: { category: Category; stay?: Stay; result?: SearchResult }) {
  const detail = roomHref(category.id);
  const detailHref = stay ? stayHref(detail, stay) : detail;
  const photo = category.galleries[0]?.photos[0];
  return (
    <article className="room-card">
      {photo && (
        <Link href={detailHref} className="room-card-photo" aria-label={category.name + " — фотографии и описание"}>
          <Image src={withBasePath(photo)} alt="" fill sizes="(min-width: 1080px) 380px, (min-width: 700px) 47vw, 96vw" />
        </Link>
      )}
      <div className="room-card-body">
        <h3><Link href={detailHref}>{category.name}</Link></h3>
        <ul className="room-specs">
          <li><UsersRound size={16} aria-hidden="true" /> До {category.capacity} гостей</li>
          {category.area && <li><Maximize2 size={15} aria-hidden="true" /> {category.area} м²</li>}
        </ul>
        <p className="room-beds"><BedDouble size={17} aria-hidden="true" /> {category.beds}</p>
        <RoomOffer category={category} stay={stay} result={result} />
      </div>
    </article>
  );
}
