import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { mainLinks, routes, site, withBasePath } from "@/lib/site";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Гостевой дом «Троя» — главная">
      <Image src={withBasePath(site.logo)} alt="" width={44} height={47} />
      <span>
        <span className="brand-name">Троя</span>
        <span className="brand-description">Гостевой дом</span>
      </span>
    </Link>
  );
}

export function PageIntro({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="page-intro">
      <div className="container">
        {children}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

export function ContactsBand() {
  return (
    <section className="contact-band" aria-labelledby="contact-heading">
      <div className="container contact-band-inner" data-reveal>
        <div>
          <h2 id="contact-heading">Как нас найти</h2>
          <p><MapPin size={19} aria-hidden="true" /> {site.address}</p>
        </div>
        <div className="contact-band-actions">
          <a className="button button-light" href={site.map} target="_blank" rel="noreferrer">Открыть на карте</a>
          <a className="contact-phone" href={"tel:" + site.telephone}><Phone size={17} aria-hidden="true" /> {site.phone}</a>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <div><Brand /><p>{site.address}</p></div>
        <nav aria-label="Навигация в подвале">
          {[...mainLinks, { label: "Отзывы", href: routes.reviews }].map(({ href, label }) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="footer-contacts">
          <a href={"tel:" + site.telephone}><Phone size={16} aria-hidden="true" /> {site.phone}</a>
          <a href={"mailto:" + site.email}><Mail size={16} aria-hidden="true" /> {site.email}</a>
          <Link href={routes.policy}>Политика конфиденциальности</Link>
          <Link href={routes.admin}>Вход для сотрудников</Link>
        </div>
      </div>
    </footer>
  );
}
