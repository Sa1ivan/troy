import { eachNight, maxGuests, season, stayError, type Stay } from "./dates";

export const periods = [
  { start: "2027-06-01", label: "1–14 июня" },
  { start: "2027-06-15", label: "15–30 июня" },
  { start: "2027-07-01", label: "Июль" },
  { start: "2027-08-01", label: "Август" },
  { start: "2027-09-01", label: "1–14 сентября" },
  { start: "2027-09-15", label: "15–30 сентября" },
] as const;

export const tariffs = {
  suite5: { label: "Люкс · 5 гостей", prices: [6000, 6500, 8000, 8000, 7000, 6000] },
  suite6: { label: "Люкс · 6 гостей", prices: [6500, 7000, 8500, 8500, 7500, 6500] },
  standard1: { label: "Стандарт · 1 гость", prices: [3000, 3500, 4500, 4500, 3000, 2500] },
  standard2: { label: "Стандарт · 2 гостя", prices: [4500, 5000, 6000, 6000, 5000, 4000] },
  standard3: { label: "Стандарт · 3 гостя", prices: [5000, 5500, 6500, 6500, 5500, 4500] },
  deluxe: { label: "Стандарт De LUX · 2 гостя", prices: [5000, 5500, 6500, 6500, 5500, 5000] },
  deluxe3: { label: "Стандарт De LUX · 3 гостя", prices: [5500, 5800, 6800, 6800, 6000, 5500] },
  noView: { label: "Стандарт без вида · 2 гостя", prices: [3500, 4000, 5200, 5200, 4500, 3000] },
  noView3: { label: "Стандарт без вида · 3 гостя", prices: [4000, 4500, 5700, 5700, 5000, 3500] },
  noView1: { label: "Стандарт без вида · 1 гость", prices: [2000, 2500, 3500, 3500, 2500, 2000] },
  family: { label: "Семейный · 4 гостя", prices: [5500, 6000, 6500, 6500, 6000, 5000] },
  family5: { label: "Семейный · 5 гостей", prices: [6000, 6500, 6800, 6800, 6500, 5500] },
  economy1: { label: "Эконом · 1 гость", prices: [2000, 2500, 3000, 3000, 2500, 2000] },
  economy2: { label: "Эконом · 2 гостя", prices: [3000, 3500, 4500, 4500, 3500, 3000] },
  economy3: { label: "Эконом · 3 гостя", prices: [3500, 4000, 5000, 5000, 4000, 3000] },
} as const;

export type CategoryId =
  | "standard-dbl" | "standard-twin" | "standard-no-view" | "deluxe" | "triple-twin"
  | "economy-dbl" | "economy-twin" | "economy-triple" | "family" | "suite";

export type Gallery = { title: string; photos: string[]; note?: string };
export type RateId = keyof typeof tariffs;
export type Category = {
  id: CategoryId;
  name: string;
  summary: string;
  beds: string;
  capacity: number;
  area?: number;
  galleries: Gallery[];
  rates: Partial<Record<number, RateId>>;
};

export function photosIn(folder: string, last: number): string[] {
  return Array.from({ length: last }, (_, index) =>
    "/images/" + folder + "/" + String(index + 1).padStart(2, "0") + ".webp",
  );
}

const roomGallery = (title: string, folder: string, count: number, note?: string): Gallery => ({
  title, photos: photosIn("rooms/" + folder, count), note,
});

export const categories: Category[] = [
  {
    id: "standard-dbl", name: "Стандарт DBL", capacity: 2, area: 18,
    beds: "Двуспальная кровать", summary: "Двухместный номер с большой кроватью и собственным санузлом.",
    galleries: [roomGallery("Стандарт DBL", "02", 4), roomGallery("Стандарт DBL · ещё один номер", "03", 4)],
    rates: { 1: "standard1", 2: "standard2" },
  },
  {
    id: "standard-twin", name: "Стандарт TWIN", capacity: 2, area: 18,
    beds: "Две раздельные кровати", summary: "Двухместный стандарт с раздельными кроватями.",
    galleries: [roomGallery("Стандарт TWIN", "04", 16)],
    rates: { 1: "standard1", 2: "standard2" },
  },
  {
    id: "standard-no-view", name: "Стандарт без вида", capacity: 3,
    beds: "Спальные места уточнит администратор",
    summary: "Стандартный номер без вида из окна. Вместимость и планировку конкретной комнаты можно уточнить по телефону.",
    galleries: [],
    rates: { 1: "noView1", 2: "noView", 3: "noView3" },
  },
  {
    id: "family", name: "Семейный двухкомнатный", capacity: 5, area: 40,
    beds: "Двуспальная кровать, дополнительные места зависят от варианта",
    summary: "Семейный номер с двумя комнатами и балконом.",
    galleries: [
      roomGallery("Семейный номер · вариант 1", "11", 5, "Двуспальная кровать в спальне. В соседней комнате есть диван и кресло. Спальные места для детей и вид из номера уточнит администратор."),
      roomGallery("Семейный номер · вариант 2", "12", 4, "В спальне двуспальная кровать и кресло. Уточните у администратора, как расположены дополнительные места и куда выходит балкон."),
      roomGallery("Семейный номер · вариант 3", "13", 9, "Двуспальная кровать в спальне и диван в отдельной комнате. Количество дополнительных мест и вид с балкона уточнит администратор."),
    ],
    rates: { 4: "family", 5: "family5" },
  },
  {
    id: "suite", name: "Двухкомнатный люкс", capacity: 6,
    beds: "Двуспальная кровать в спальне и диван в гостиной",
    summary: "Две просторные комнаты для семьи или компании. Планировка и вид зависят от варианта.",
    galleries: [
      roomGallery("Люкс с балконом · вариант 1", "15", 10, "Двуспальная кровать в спальне, диван и кресло в гостиной. Вид и спальные места для пятого и шестого гостей уточнит администратор."),
      roomGallery("Люкс с балконом · вариант 2", "14", 5, "Двуспальная кровать и диван. С балкона видны зелёная площадка и соседние дома. Дополнительные спальные места согласуются при бронировании."),
    ],
    rates: { 5: "suite5", 6: "suite6" },
  },
  {
    id: "deluxe", name: "Стандарт De LUX", capacity: 3,
    beds: "Планировку уточнит администратор", summary: "Номер категории De LUX. В сезонном прайсе есть тариф для трёх гостей.",
    galleries: [roomGallery("Стандарт De LUX", "01", 5)],
    rates: { 2: "deluxe", 3: "deluxe3" },
  },
  {
    id: "triple-twin", name: "Трёхместный TWIN", capacity: 3,
    beds: "Раздельные кровати", summary: "Номер на троих с раздельными спальными местами.",
    galleries: [roomGallery("Трёхместный TWIN", "08", 5)],
    rates: { 3: "standard3" },
  },
  {
    id: "economy-dbl", name: "Эконом DBL", capacity: 2,
    beds: "Двуспальная кровать", summary: "Двухместный номер эконом с большой кроватью.",
    galleries: [roomGallery("Двухместный эконом DBL", "06", 4)],
    rates: { 1: "economy1", 2: "economy2" },
  },
  {
    id: "economy-twin", name: "Эконом TWIN", capacity: 2,
    beds: "Две раздельные кровати", summary: "Двухместный номер эконом с раздельными кроватями.",
    galleries: [roomGallery("Двухместный эконом TWIN", "05", 3), roomGallery("Эконом TWIN · ещё один номер", "07", 5)],
    rates: { 1: "economy1", 2: "economy2" },
  },
  {
    id: "economy-triple", name: "Трёхместный эконом", capacity: 3,
    beds: "Двуспальная и односпальная кровати", summary: "Номер категории эконом для размещения до трёх гостей.",
    galleries: [roomGallery("Трёхместный эконом", "09", 3), roomGallery("Трёхместный эконом · ещё один номер", "10", 2)],
    rates: { 3: "economy3" },
  },
];

export const findCategory = (value: string | null) => categories.find(({ id }) => id === value);

export function fromPrice(category: Category): number | null {
  const rateIds = Object.values(category.rates).filter((id) => id !== undefined);
  return rateIds.length ? Math.min(...rateIds.flatMap((id) => tariffs[id].prices)) * 100 : null;
}

export function categoriesForRate(rate: RateId): Category[] {
  return categories.filter(({ rates }) => Object.values(rates).includes(rate));
}

export type NightPrice = { date: string; amount: number };

export function quoteStay(categoryId: CategoryId, stay: Stay): { nights: NightPrice[]; total: number } | null {
  const rate = findCategory(categoryId)?.rates[stay.guests];
  if (!rate || stayError(stay)) return null;
  const nights = eachNight(stay).map((date) => ({
    date,
    amount: tariffs[rate].prices[periods.findLastIndex(({ start }) => date >= start)] * 100,
  }));
  return { nights, total: nights.reduce((total, night) => total + night.amount, 0) };
}

export type Room = {
  id: string;
  label: string;
  building: 1 | 2;
  floor: number | null;
  categoryId: CategoryId | null;
};

export function roomCapacity(room: Pick<Room, "id" | "categoryId">): number {
  const categoryCapacity = findCategory(room.categoryId)?.capacity ?? maxGuests;
  // These layouts are part of the initial physical inventory, even if the category changes.
  if (room.id.startsWith("b2-double-")) return Math.min(categoryCapacity, 2);
  if (room.id.startsWith("b2-triple-")) return Math.min(categoryCapacity, 3);
  return categoryCapacity;
}

export function buildInventory(demo = false): Room[] {
  const rooms: Room[] = [];
  for (let floor = 1; floor <= 6; floor++) {
    const count = floor === 5 ? 1 : 2;
    for (let index = 1; index <= count; index++) {
      rooms.push({ id: "b1-suite-" + floor + "-" + index, label: "Люкс " + floor + "·" + index, building: 1, floor, categoryId: "suite" });
    }
  }
  for (const [categoryId, count, name] of [["standard-dbl", 27, "Стандарт DBL"], ["standard-twin", 26, "Стандарт TWIN"]] as const) {
    for (let index = 1; index <= count; index++) {
      const code = String(index).padStart(2, "0");
      rooms.push({ id: "b1-" + categoryId + "-" + code, label: name + " " + code, building: 1, floor: null, categoryId });
    }
  }
  for (const [kind, count, name] of [["family", 2, "Двухкомнатный"], ["triple", 3, "Трёхместный"], ["double", 5, "Двухместный"]] as const) {
    for (let index = 1; index <= count; index++) {
      const demoCategory = kind === "family" ? "family" : kind === "triple" ? "economy-triple" : index <= 3 ? "economy-dbl" : "economy-twin";
      rooms.push({ id: "b2-" + kind + "-" + index, label: name + " 0" + index, building: 2, floor: null,
        categoryId: demo ? demoCategory : null });
    }
  }
  return rooms;
}

const rubles = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 2,
});
export const money = (kopecks: number) => rubles.format(kopecks / 100);
export const seasonYear = season.checkIn.slice(0, 4);
