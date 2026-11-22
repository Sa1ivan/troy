import { PageIntro } from "@/components/site-shell";
import { pageMetadata, routes, site } from "@/lib/site";

export const metadata = pageMetadata("Отзывы гостей", "Отзывы об отдыхе в гостевом доме «Троя» в Лазаревском.", routes.reviews);

const reviews = [
  { id: 184, name: "Владимир", date: "2025-07-27", text: "Владимир с женой жили в чистом двухместном номере с балконом. Им понравился бассейн на крыше, а дорога до моря заняла около пяти минут." },
  { id: 181, name: "Светлана", date: "2025-07-20", text: "Администратор помог организовать ранний заезд. Светлана отметила просторный номер с двориком, вид с крыши на море и горы и хинкали в столовой." },
  { id: 107, name: "Анжелика", date: "2024-08-24", text: "Анжелика отдыхала с семьёй в августе. Она оценила внимательный приём, чистоту номеров и бассейна и панораму с крыши." },
  { id: 105, name: "Александр", date: "2024-08-18", text: "Александр провёл здесь часть июля с семьёй, поблагодарил Ирину за питание и написал, что хочет вернуться." },
  { id: 71, name: "Дарья", date: "2023-06-15", text: "Из двухместного номера Дарья видела море и колесо обозрения. Ей понравилось, что до пляжа, развлечений и вокзала можно дойти пешком." },
  { id: 70, name: "Светлана", date: "2023-06-14", text: "Светлана жила в светлом семейном номере с тремя балконами. Она отметила регулярную уборку, чистую воду в бассейне и вид с крыши." },
];

const formatDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export default function ReviewsPage() {
  return (
    <>
      <PageIntro title="Отзывы гостей" description="Краткие пересказы отзывов, опубликованных на сайте гостевого дома." />
      <section className="container section review-grid">
        {reviews.map(({ id, name, date, text }) => (
          <article className="review-card" key={id} id={"comment-" + id}>
            <p>{text}</p>
            <div>
              <strong>{name}</strong>
              <time dateTime={date}>{formatDate.format(new Date(date))}</time>
              <a className="text-link" href={site.url + routes.reviews + "#comment-" + id} target="_blank" rel="noreferrer">Читать оригинал</a>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
