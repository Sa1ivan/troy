import { PageIntro } from "@/components/site-shell";
import { PriceTable } from "@/components/price-table";
import { StayLink } from "@/components/stay-link";
import { seasonYear } from "@/lib/catalog";
import { pageMetadata, routes } from "@/lib/site";

export const metadata = pageMetadata("Цены на сезон 2027", "Прайс гостевого дома «Троя» в Лазаревском. Цены за ночь с 1 июня по 30 сентября 2027 года по категориям номеров.", routes.prices);

export default function PricesPage() {
  return (
    <>
      <PageIntro title={"Цены на сезон " + seasonYear} description="Заезды с 1 июня, последний выезд 1 октября. В таблице указана ориентировочная стоимость за ночь." />
      <section className="container section prices-section">
        <PriceTable />
        <p className="muted">Окончательную стоимость администратор подтвердит при звонке.</p>
        <StayLink className="button button-primary" href={routes.rooms}>Подобрать номер</StayLink>
      </section>
    </>
  );
}
