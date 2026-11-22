import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BedDouble, Maximize2, ShowerHead, Snowflake, Tv, UsersRound } from "lucide-react";
import { Gallery } from "@/components/gallery";
import { StayFinder } from "@/components/stay-finder";
import { StayLink } from "@/components/stay-link";
import { PageIntro } from "@/components/site-shell";
import { categories, findCategory } from "@/lib/catalog";
import { pageMetadata, roomHref, routes } from "@/lib/site";

type Props = { params: Promise<{ category: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return categories.map(({ id }) => ({ category: id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = findCategory((await params).category);
  if (!category) notFound();
  return pageMetadata(category.name, category.summary + " Подбор дат в гостевом доме «Троя».", roomHref(category.id), category.galleries[0]?.photos[0]);
}

export default async function CategoryPage({ params }: Props) {
  const category = findCategory((await params).category);
  if (!category) notFound();
  return (
    <>
      <PageIntro title={category.name} description={category.summary}>
        <nav aria-label="Хлебные крошки" className="breadcrumbs"><StayLink href={routes.rooms}>Номера</StayLink> <span aria-hidden="true">/</span> {category.name}</nav>
      </PageIntro>
      <section className="container section category-section">
        <div className="category-layout">
          <aside className="category-reservation" id="dates">
            <StayFinder categoryId={category.id} />
          </aside>
          <div className="category-details">
            {!!category.galleries.length && <Gallery galleries={category.galleries} />}
            <section className="category-amenities">
              <h2>В номере</h2>
              <ul>
                <li><UsersRound size={19} aria-hidden="true" /> До {category.capacity} гостей</li>
                <li><BedDouble size={19} aria-hidden="true" /> {category.beds}</li>
                {category.area && <li><Maximize2 size={19} aria-hidden="true" /> {category.area} м²</li>}
                <li><ShowerHead size={19} aria-hidden="true" /> Собственный санузел с душем</li>
                <li><Snowflake size={19} aria-hidden="true" /> Кондиционер и холодильник</li>
                <li><Tv size={19} aria-hidden="true" /> Телевизор</li>
              </ul>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
