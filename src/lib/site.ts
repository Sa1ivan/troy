import type { Metadata } from "next";
import { categories, photosIn, type CategoryId, type Gallery } from "./catalog";
import type { Stay } from "./dates";

export const site = {
  name: "Гостевой дом «Троя»",
  url: "https://troy-laz.ru",
  address: "Сочи, Лазаревское, ул. Спортивная, 5",
  phone: "+7 (938) 400-80-46",
  telephone: "+79384008046",
  email: "troy-laz@inbox.ru",
  map: "https://yandex.ru/maps/?text=" + encodeURIComponent("Сочи, Лазаревское, Спортивная 5"),
  vk: "https://vk.com/troylazarevskoe",
  hero: "/images/hotel/troy-facade.webp",
  logo: "/images/logo.png",
};

export const routes = {
  home: "/",
  rooms: "/номера/",
  prices: "/цены/",
  photos: "/фото/",
  contacts: "/контакт/",
  reviews: "/отзывы/",
  booking: "/номера/бронирование/",
  policy: "/policy/",
  admin: "/admin/",
} as const;

export const mainLinks = [
  { label: "Номера", href: routes.rooms },
  { label: "Цены", href: routes.prices },
  { label: "Фото", href: routes.photos },
  { label: "Контакты", href: routes.contacts },
];

export const roomHref = (id: CategoryId) => routes.rooms + id + "/";

export function stayHref(path: string, stay: Stay, categoryId?: CategoryId): string {
  const query = new URLSearchParams({
    checkIn: stay.checkIn, checkOut: stay.checkOut, guests: String(stay.guests),
  });
  if (categoryId) query.set("category", categoryId);
  return path + "?" + query;
}

export function readStay(query: Pick<URLSearchParams, "get">): Stay {
  return {
    checkIn: query.get("checkIn") ?? "",
    checkOut: query.get("checkOut") ?? "",
    guests: Number(query.get("guests") ?? 2),
  };
}

export const indexedPaths = [
  routes.home, routes.rooms, routes.prices, routes.photos, routes.contacts, routes.reviews,
  routes.booking, routes.policy, ...categories.map(({ id }) => roomHref(id)),
];

const poolCover = "/images/hotel/pool/14.webp";

export function pageMetadata(title: string, description: string, path: string, photo = poolCover): Metadata {
  return {
    title, description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: [photo], siteName: site.name, locale: "ru_RU", type: "website" },
  };
}

export const hotelGalleries: Gallery[] = [
  { title: "Бассейн и бар на крыше", photos: [poolCover, ...photosIn("hotel/pool", 19).filter((photo) => photo !== poolCover)] },
  { title: "Холл и территория", photos: photosIn("hotel/lobby", 6) },
  { title: "Столовая", photos: photosIn("hotel/dining", 6) },
  { title: "Первый корпус", photos: photosIn("hotel/building-1", 9) },
  { title: "Второй корпус", photos: photosIn("hotel/building-2", 3) },
  { title: "Другие фотографии гостевого дома", photos: photosIn("hotel/hotel", 27) },
  { title: "Фотографии с главной", photos: photosIn("hotel/main", 4) },
  { title: "Другие фотографии комнат", photos: photosIn("hotel/room-photos", 5) },
];
