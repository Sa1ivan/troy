import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { roomHref, routes } from "@/lib/site";
import Contacts, { metadata as contactsMetadata } from "../contacts/page";
import Photos, { metadata as photosMetadata } from "../photos/page";
import Prices, { metadata as pricesMetadata } from "../prices/page";
import Reviews, { metadata as reviewsMetadata } from "../reviews/page";
import Rooms, { metadata as roomsMetadata } from "../rooms/page";
import Booking, { metadata as bookingMetadata } from "../rooms/booking/page";
import Category, { generateMetadata as categoryMetadata, generateStaticParams as categoryParams } from "../rooms/[category]/page";

type Props = { params: Promise<{ legacy: string[] }> };

const pages = new Map<string, { Page: typeof Rooms; metadata: Metadata }>([
  [routes.rooms, { Page: Rooms, metadata: roomsMetadata }],
  [routes.prices, { Page: Prices, metadata: pricesMetadata }],
  [routes.photos, { Page: Photos, metadata: photosMetadata }],
  [routes.contacts, { Page: Contacts, metadata: contactsMetadata }],
  [routes.reviews, { Page: Reviews, metadata: reviewsMetadata }],
  [routes.booking, { Page: Booking, metadata: bookingMetadata }],
]);

export const dynamicParams = false;

export function generateStaticParams() {
  // Pass the old paths as parameters so segment names stay ASCII during static export.
  return [...pages.keys(), ...categoryParams().map(({ category }) => roomHref(category))]
    .map((path) => ({ legacy: path.slice(1, -1).split("/") }));
}

function categoryProps(path: string) {
  if (!path.startsWith(routes.rooms)) notFound();
  return { params: Promise.resolve({ category: path.slice(routes.rooms.length, -1) }) };
}

async function legacyPath(params: Props["params"]) {
  const { legacy } = await params;
  return "/" + legacy.map(decodeURIComponent).join("/") + "/";
}

export async function generateMetadata({ params }: Props) {
  const path = await legacyPath(params);
  return pages.get(path)?.metadata ?? categoryMetadata(categoryProps(path));
}

export default async function LegacyPage({ params }: Props) {
  const path = await legacyPath(params);
  const Page = pages.get(path)?.Page;
  return Page ? <Page /> : <Category {...categoryProps(path)} />;
}
