import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { PageIntro } from "@/components/site-shell";
import { pageMetadata, routes, site, withBasePath } from "@/lib/site";

export const metadata = pageMetadata("Контакты и как добраться", "Адрес: Сочи, Лазаревское, Спортивная, 5. Телефоны администратора и управляющего гостевого дома «Троя», маршрут на карте.", routes.contacts);

export default function ContactsPage() {
  return (
    <>
      <PageIntro title="Контакты" description="Свяжитесь с администратором гостевого дома напрямую." />
      <section className="container section contacts-layout">
        <div className="contact-list">
          <div><MapPin size={23} aria-hidden="true" /><div><h2>Адрес</h2><p>{site.address}</p><a className="button button-outline" href={site.map} target="_blank" rel="noreferrer">Открыть на карте</a></div></div>
          <div><Phone size={23} aria-hidden="true" /><div><h2>Телефоны</h2>
            <p><a href={"tel:" + site.telephone}>{site.phone}</a> · администратор</p>
            <p><a href="tel:+79288544888">+7 (928) 854-48-88</a> · управляющий</p>
            <p><a href="tel:+79268800046">+7 (926) 880-00-46</a> · управляющий</p>
          </div></div>
          <div><Mail size={23} aria-hidden="true" /><div><h2>Написать нам</h2><p><a href={"mailto:" + site.email}>{site.email}</a></p><a href={site.vk} target="_blank" rel="noreferrer">«Троя» во ВКонтакте</a></div></div>
        </div>
        <div className="contacts-photo"><Image src={withBasePath("/images/hotel/main/01.webp")} alt="Здание гостевого дома «Троя»" fill sizes="(min-width: 900px) 50vw, 100vw" /></div>
      </section>
    </>
  );
}
