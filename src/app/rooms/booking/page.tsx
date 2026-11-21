import { Suspense } from "react";
import { BookingOverview, GuestBooking } from "@/components/guest-booking";
import { PageIntro } from "@/components/site-shell";
import { pageMetadata, routes } from "@/lib/site";

export const metadata = pageMetadata("Бронирование номеров", "Подберите даты, выберите категорию номера и оставьте заявку на проживание в гостевом доме «Троя» в Лазаревском.", routes.booking);

export default function BookingPage() {
  return (
    <>
      <PageIntro title="Заявка на проживание" />
      <div className="container section booking-section">
        <Suspense fallback={<BookingOverview />}><GuestBooking /></Suspense>
      </div>
    </>
  );
}
