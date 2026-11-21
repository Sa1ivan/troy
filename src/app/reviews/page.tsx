import { PageIntro } from "@/components/site-shell";
import { pageMetadata, routes } from "@/lib/site";

export const metadata = pageMetadata("Отзывы гостей", "Отзывы об отдыхе в гостевом доме «Троя» в Лазаревском.", routes.reviews);

const reviews = [
  { id: 184, name: "Владимир", date: "2025-07-27", text: "Отдыхали вдвоём. Понравились чистый номер с балконом, бассейн на крыше и близость моря. До пляжа дошли за пять минут." },
  { id: 181, name: "Светлана", date: "2025-07-20", text: "Приехали рано утром, нас встретили и проводили в номер. Запомнились вид на море и горы с крыши, столовая и близость пляжа." },
  { id: 107, name: "Анжелика", date: "2024-08-24", text: "Отдыхали семьёй. Отметили чистоту номеров, внимательность администратора и панораму с крыши." },
  { id: 105, name: "Александр", date: "2024-08-18", text: "Провели в «Трое» часть июля всей семьёй. Поблагодарили сотрудника столовой и хотели бы вернуться." },
  { id: 71, name: "Дарья", date: "2023-06-15", text: "В двухместном номере понравился вид на море и колесо обозрения. Пляж, развлечения и вокзал были в пешей доступности." },
  { id: 70, name: "Светлана", date: "2023-06-14", text: "Семейный номер оказался просторным и светлым. Понравились уборка, бассейн и вид с крыши." },
];

const formatDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export default function ReviewsPage() {
  return (
    <>
      <PageIntro title="Отзывы гостей" description="Что гости отмечали после отдыха в «Трое»." />
      <section className="container section review-grid">
        {reviews.map(({ id, name, date, text }) => (
          <article className="review-card" key={id} id={"comment-" + id}>
            <p>{text}</p>
            <div><strong>{name}</strong><time dateTime={date}>{formatDate.format(new Date(date))}</time></div>
          </article>
        ))}
      </section>
    </>
  );
}
