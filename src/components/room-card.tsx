import Image from "next/image";
import Link from "next/link";
import { BedDouble, Maximize2, UsersRound } from "lucide-react";
import { fromPrice, money, type Category } from "@/lib/catalog";
import { countLabel, type Stay } from "@/lib/dates";
import { roomHref, routes, site, stayHref, withBasePath } from "@/lib/site";

export type SearchResult = { available: boolean; known: boolean; total: number | null; nights: number };

export function RoomCard({ category, stay, result, compact = false }: { category: Category; stay?: Stay; result?: SearchResult; compact?: boolean }) {
  const detail = roomHref(category.id);
  const detailHref = stay ? stayHref(detail, stay) : detail;
  const startPrice = fromPrice(category);
  let action = { href: detailHref, label: "Подробнее" };
  if (stay && result?.available) {
    action = { href: stayHref(routes.booking, stay, category.id), label: result.total === null ? "Уточнить у администратора" : "Оставить заявку" };
  } else if (result && !result.known) {
    action = { href: "tel:" + site.telephone, label: "Уточнить у администратора" };
  }
  return (
    <article className={"room-card" + (compact ? " room-card-compact" : "")}>
      {!compact && (
        <Link href={detailHref} className="room-card-photo" aria-label={category.name + " — фотографии и описание"}>
          <Image src={withBasePath(category.galleries[0].photos[0])} alt={category.name} fill sizes="(min-width: 1080px) 380px, (min-width: 700px) 47vw, 96vw" />
        </Link>
      )}
      <div className="room-card-body">
        <h3>{compact ? category.name : <Link href={detailHref}>{category.name}</Link>}</h3>
        {!compact && (
          <>
            <ul className="room-specs">
              <li><UsersRound size={16} aria-hidden="true" /> До {category.capacity} гостей</li>
              {category.area && <li><Maximize2 size={15} aria-hidden="true" /> {category.area} м²</li>}
            </ul>
            <p className="room-beds"><BedDouble size={17} aria-hidden="true" /> {category.beds}</p>
          </>
        )}
        <div className="room-card-tail">
          {result ? (
            result.available && result.total !== null ? (
              <p className="room-price"><strong>{money(result.total)}</strong><span>за {countLabel(result.nights, ["ночь", "ночи", "ночей"])}</span></p>
            ) : (
              <p className="room-state">{result.known && !result.available ? "Нет свободных номеров" : result.available ? "Стоимость по запросу" : "Наличие по запросу"}</p>
            )
          ) : (
            <p className="room-price">{startPrice !== null ? <><strong>от {money(startPrice)}</strong><span>за ночь</span></> : <span>Стоимость по запросу</span>}</p>
          )}
          {compact && result?.known && !result.available ? (
            <a className="button button-outline" href="#dates">Выбрать другие даты</a>
          ) : (
            <Link className={"button " + (result?.available ? "button-primary" : "button-outline")} href={action.href}>{action.label}</Link>
          )}
        </div>
      </div>
    </article>
  );
}
