import Image from "next/image";
import Link from "next/link";
import { Coffee, MapPin, Martini, Waves } from "lucide-react";
import { ContactsBand } from "@/components/site-shell";
import { StayFinder } from "@/components/stay-finder";
import { StayLink } from "@/components/stay-link";
import { season, stayLabel } from "@/lib/dates";
import { roomHref, pageMetadata, routes, site, withBasePath } from "@/lib/site";

const description = "Гостевой дом «Троя» в Лазаревском. Бассейн на крыше, пляж в 250 метрах, двухместные и семейные номера. Подбор номеров и заявки напрямую.";
export const metadata = pageMetadata("Гостевой дом «Троя» в Лазаревском", description, routes.home, site.hero);

const amenities = [
  { icon: MapPin, title: "250 м до пляжа", text: "Лазаревская набережная" },
  { icon: Waves, title: "Бассейн на крыше", text: "Вид на море и горы" },
  { icon: Martini, title: "Бар La Bella", text: "На крыше гостевого дома" },
  { icon: Coffee, title: "Столовая халяль", text: "Завтрак, обед и ужин" },
];

const featured = [
  { id: "standard-dbl", name: "Стандарт DBL", description: "Двуспальная кровать · 18 м²", photo: "/images/rooms/02/01.webp" },
  { id: "family", name: "Семейный номер", description: "Две комнаты и балкон", photo: "/images/rooms/12/01.webp" },
  { id: "suite", name: "Двухкомнатный люкс", description: "До 6 гостей", photo: "/images/rooms/14/01.webp" },
] as const;

export default function Home() {
  const lodging = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: site.name, description, url: site.url, image: site.url + site.hero,
    telephone: site.telephone,
    address: { "@type": "PostalAddress", streetAddress: "ул. Спортивная, 5", addressLocality: "Лазаревское, Сочи", postalCode: "354217", addressCountry: "RU" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(lodging).replace(/</g, "\\u003c") }} />
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="container home-hero-content">
          <p className="hero-location"><MapPin size={15} aria-hidden="true" /> Лазаревское, Сочи</p>
          <h1 id="hero-title">{site.name}</h1>
          <p className="hero-description">Бассейн на крыше. Пляж в пяти минутах ходьбы.</p>
        </div>
        <p className="container home-season">Сезон {season.checkIn.slice(0, 4)} · {stayLabel(season)}</p>
        <StayFinder formClassName="container home-search" resultsClassName="container home-results">
          <figure className="container home-hero-photo">
            <picture>
              <source media="(max-width: 720px)" srcSet={withBasePath(site.heroMobile)} />
              <Image src={withBasePath(site.hero)} alt="Бассейн на крыше гостевого дома «Троя» с видом на горы" fill sizes="(min-width: 1211px) 1080px, 100vw" fetchPriority="high" loading="eager" />
            </picture>
          </figure>
        </StayFinder>
      </section>
      <ul className="container amenities" aria-label="Расположение и удобства" data-reveal>
        {amenities.map(({ icon: Icon, title, text }) => (
          <li key={title}><span className="amenity-icon"><Icon size={23} aria-hidden="true" /></span><div><strong>{title}</strong><span>{text}</span></div></li>
        ))}
      </ul>
      <section className="section home-experience" aria-labelledby="photo-heading">
        <div className="container experience-grid">
          <div className="experience-copy" data-reveal>
            <h2 id="photo-heading">Море и горы с одной крыши</h2>
            <p>Днём можно отдохнуть у бассейна, а вечером зайти в бар La Bella. До набережной, кафе и центрального парка легко дойти пешком.</p>
            <Link className="button button-outline" href={routes.photos}>Смотреть фотографии</Link>
          </div>
          <div className="experience-photo" data-reveal>
            <Image src={withBasePath(site.facade)} alt="Фасад гостевого дома «Троя» в Лазаревском" fill sizes="(min-width: 721px) 50vw, 100vw" />
          </div>
        </div>
      </section>
      <section className="container section home-rooms" aria-labelledby="room-heading">
        <div className="section-heading" data-reveal>
          <h2 id="room-heading">Номера</h2>
          <StayLink className="button button-outline" href={routes.rooms}>Весь каталог</StayLink>
        </div>
        <div className="room-showcase">
          {featured.map(({ id, name, description, photo }) => (
            <StayLink key={id} href={roomHref(id)} className={"room-tile" + (id === "standard-dbl" ? " room-tile-featured" : "")}
              data-reveal suppressHydrationWarning>
              <Image src={withBasePath(photo)} alt="" fill sizes="(min-width: 800px) 55vw, 100vw" />
              <div className="room-tile-copy">
                <h3>{name}</h3>
                <p>{description}</p>
                <span>Подробнее</span>
              </div>
            </StayLink>
          ))}
        </div>
      </section>
      <ContactsBand />
    </>
  );
}
