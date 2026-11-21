import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, Maximize2, ShowerHead, Snowflake, Tv, UsersRound } from "lucide-react";
import { Gallery } from "@/components/gallery";
import { StayFinder } from "@/components/stay-finder";
import { PageIntro } from "@/components/site-shell";
import { categories, findCategory, fromPrice, money } from "@/lib/catalog";
import { pageMetadata, roomHref, routes } from "@/lib/site";

type Props = { params: Promise<{ category: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return categories.map(({ id }) => ({ category: id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = findCategory((await params).category);
  if (!category) notFound();
  return pageMetadata(category.name, category.summary + " Фотографии и подбор дат в гостевом доме «Троя».", roomHref(category.id), category.galleries[0].photos[0]);
}

export default async function CategoryPage({ params }: Props) {
  const category = findCategory((await params).category);
  if (!category) notFound();
  const price = fromPrice(category);
  return (
    <>
      <PageIntro title={category.name} description={category.summary}>
        <nav aria-label="Хлебные крошки" className="breadcrumbs"><Link href={routes.rooms}>Номера</Link> <span aria-hidden="true">/</span> {category.name}</nav>
      </PageIntro>
      <section className="container section category-section">
        <div className="category-layout">
          <Gallery galleries={category.galleries} />
          <aside className="category-amenities" data-reveal>
            <h2>В номере</h2>
            <ul>
              <li><UsersRound size={19} aria-hidden="true" /> До {category.capacity} гостей</li>
              <li><BedDouble size={19} aria-hidden="true" /> {category.beds}</li>
              {category.area && <li><Maximize2 size={19} aria-hidden="true" /> {category.area} м²</li>}
              <li><ShowerHead size={19} aria-hidden="true" /> Собственный санузел с душем</li>
              <li><Snowflake size={19} aria-hidden="true" /> Кондиционер и холодильник</li>
              <li><Tv size={19} aria-hidden="true" /> Телевизор</li>
            </ul>
            {price !== null && <p className="category-price">от <strong>{money(price)}</strong> за ночь</p>}
            <a className="button button-primary" href="#dates">Выбрать даты</a>
          </aside>
        </div>
        <div className="category-search" id="dates" data-reveal>
          <h2>Проверить наличие</h2>
          <StayFinder categoryId={category.id} />
        </div>
      </section>
    </>
  );
}
