import { PageIntro } from "@/components/site-shell";
import { BookingDataStorage } from "@/components/hotel-provider";
import { pageMetadata, routes, site } from "@/lib/site";

export const metadata = pageMetadata("Политика конфиденциальности", "Как сайт «Троя» использует данные из формы бронирования.", routes.policy);

export default function PolicyPage() {
  return (
    <>
      <PageIntro title="Политика конфиденциальности" />
      <div className="container section text-page">
        <h2>Данные заявки</h2>
        <p>Для заявки на проживание форма запрашивает имя, телефон, число гостей, даты и категорию номера. Эти сведения нужны, чтобы администратор мог связаться с гостем и согласовать условия проживания.</p>
        <BookingDataStorage />
        <p>Связаться с гостевым домом можно по адресу <a href={"mailto:" + site.email}>{site.email}</a>.</p>
      </div>
    </>
  );
}
