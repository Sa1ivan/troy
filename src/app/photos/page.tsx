import { Gallery } from "@/components/gallery";
import { PageIntro } from "@/components/site-shell";
import { hotelGalleries, pageMetadata, routes } from "@/lib/site";

export const metadata = pageMetadata("Фотографии гостевого дома", "Бассейн и бар на крыше, столовая, холл и фотографии двух корпусов гостевого дома «Троя».", routes.photos);

export default function PhotosPage() {
  return (
    <>
      <PageIntro title="Фотографии «Трои»" description="Бассейн и бар на крыше, территория и оба корпуса гостевого дома." />
      <section className="container section hotel-gallery" data-reveal><Gallery galleries={hotelGalleries} /></section>
    </>
  );
}
