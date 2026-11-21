import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { HotelProvider } from "@/components/hotel-provider";
import { Brand, SiteFooter } from "@/components/site-shell";
import { SiteHeader } from "@/components/site-header";
import { isPagesDemo, site, withBasePath } from "@/lib/site";
import { themeScript } from "@/lib/theme";
import "./globals.css";
import "./admin.css";
import "./controls.css";
import "./themes.css";
import "./motion.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Гостевой дом «Троя» в Лазаревском", template: "%s | Троя" },
  icons: { icon: withBasePath(site.logo) },
  ...(isPagesDemo && { robots: { index: false, follow: false } }),
};

export const viewport: Viewport = { colorScheme: "light dark" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <HotelProvider>
          <SiteHeader brand={<Brand />} />
          <main id="content">
            {isPagesDemo && <p className="container demo-note">Демо сайта. Для проверки заявок используйте тестовые данные.</p>}
            {children}
          </main>
          <SiteFooter />
        </HotelProvider>
      </body>
    </html>
  );
}
