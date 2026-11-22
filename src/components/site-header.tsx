"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogIn, LogOut, Menu, Phone } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { mainLinks, routes, site, withBasePath } from "@/lib/site";
import { Dialog } from "./dialog";
import { useHotel } from "./hotel-provider";
import { StayLink } from "./stay-link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ brand }: { brand: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [dismissMenu, setDismissMenu] = useState(false);
  const pathname = usePathname();
  const [visiblePath, setVisiblePath] = useState("");
  useEffect(() => setVisiblePath(window.location.pathname), [pathname]);
  useEffect(() => {
    const mobile = matchMedia("(max-width: 720px)");
    const closeOnResize = () => { if (!mobile.matches) setExpanded(false); };
    mobile.addEventListener("change", closeOnResize);
    return () => mobile.removeEventListener("change", closeOnResize);
  }, []);
  const { authenticated, signOut } = useHotel();
  const current = (href: string) => visiblePath.startsWith(encodeURI(withBasePath(href)));
  const closeMenu = () => { if (expanded) setDismissMenu(true); };
  const navigation = [...mainLinks, ...(authenticated ? [{ href: routes.admin, label: "Админка" }] : [])].map(({ href, label }) => {
    const NavigationLink = href === routes.rooms || href === routes.prices ? StayLink : Link;
    return (
      <NavigationLink key={href} href={href} className={href === routes.admin ? "admin-nav-link" : undefined}
        aria-current={current(href) ? "page" : undefined} onClick={closeMenu}>
        {href === routes.admin && <LayoutDashboard size={16} aria-hidden="true" />}{label}
      </NavigationLink>
    );
  });
  return (
    <header className="site-header">
      <a className="skip-link" href="#content">К содержанию</a>
      <div className="container masthead">
        <div className="masthead-brand">{brand}</div>
        <button className="icon-button mobile-menu" type="button" aria-expanded={expanded} aria-haspopup="dialog"
          aria-label="Открыть меню" onClick={() => { setDismissMenu(false); setExpanded(true); }}>
          <Menu size={22} aria-hidden="true" />
        </button>
        <nav className="site-nav" aria-label="Основная навигация">{navigation}</nav>
        <div className="masthead-actions">
          {!authenticated && <>
            <a className="masthead-phone" href={"tel:" + site.telephone}>{site.phone}</a>
            <a className="button button-primary masthead-call" href={"tel:" + site.telephone} aria-label="Позвонить администратору">
              <Phone size={16} aria-hidden="true" /> <span>Позвонить</span>
            </a>
          </>}
          <ThemeToggle />
          {authenticated && (
            <button className="button button-outline masthead-logout" type="button" onClick={() => void signOut()}>
              <LogOut size={16} aria-hidden="true" /> Выйти
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <Dialog title="Меню" variant="sheet" dismiss={dismissMenu} onClose={() => setExpanded(false)}>
          <nav className="mobile-nav" aria-label="Основная навигация">
            {navigation}
            {!authenticated && <Link href={routes.admin} aria-current={current(routes.admin) ? "page" : undefined} onClick={closeMenu}>
              <LogIn size={16} aria-hidden="true" /> Сотрудникам
            </Link>}
          </nav>
        </Dialog>
      )}
    </header>
  );
}
