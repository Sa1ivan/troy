import { PageIntro } from "@/components/site-shell";
import { StayFinder } from "@/components/stay-finder";
import { pageMetadata, routes } from "@/lib/site";

export const metadata = pageMetadata("Номера в Лазаревском", "Подберите номер в гостевом доме «Троя» по датам и числу гостей. Фото двухместных, семейных номеров и люксов.", routes.rooms);

export default function RoomsPage() {
  return (
    <>
      <PageIntro title="Номера" description="Выберите даты, чтобы увидеть свободные категории и стоимость проживания." />
      <div className="container catalog-section"><StayFinder browse /></div>
    </>
  );
}
