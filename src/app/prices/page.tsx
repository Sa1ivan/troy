import Link from "next/link";
import { PageIntro } from "@/components/site-shell";
import { money, periods, seasonYear, tariffs } from "@/lib/catalog";
import { pageMetadata, routes } from "@/lib/site";

export const metadata = pageMetadata("Цены на сезон 2027", "Прайс гостевого дома «Троя» в Лазаревском. Цены за ночь с 1 июня по 30 сентября 2027 года по категориям номеров.", routes.prices);

export default function PricesPage() {
  return (
    <>
      <PageIntro title={"Цены на сезон " + seasonYear} description="Заезды с 1 июня, последний выезд 1 октября. В таблице указана ориентировочная стоимость за ночь." />
      <section className="container section prices-section">
        <div className="table-scroll tariff-scroll" tabIndex={0} aria-label="Таблица цен на сезон 2027">
          <table className="tariff-table">
            <thead><tr><th scope="col">Категория</th>{periods.map(({ start, label }) => <th scope="col" key={start}>{label}</th>)}</tr></thead>
            <tbody>
              {Object.values(tariffs).map(({ label, prices }) => (
                <tr key={label}><th scope="row">{label}</th>{prices.map((price, index) => <td key={periods[index].start}>{money(price * 100)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">Окончательную стоимость администратор подтвердит при звонке.</p>
        <Link className="button button-primary" href={routes.rooms}>Подобрать номер</Link>
      </section>
    </>
  );
}
