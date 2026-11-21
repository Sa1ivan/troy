export type DateRange = { checkIn: string; checkOut: string };
export type Stay = DateRange & { guests: number };

export const season = { checkIn: "2027-06-01", checkOut: "2027-10-01" } as const;
export const maxGuests = 6;

const dayInMs = 86_400_000;
const asUtc = (date: string) => new Date(date + "T00:00:00.000Z");
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = asUtc(value);
  return Number.isFinite(date.getTime()) && isoDay(date) === value;
}

export function addDays(date: string, days: number): string {
  return isoDay(new Date(asUtc(date).getTime() + dayInMs * days));
}

export function nightsBetween(range: DateRange): number {
  return (asUtc(range.checkOut).getTime() - asUtc(range.checkIn).getTime()) / dayInMs;
}

export function eachNight(range: DateRange): string[] {
  return Array.from({ length: nightsBetween(range) }, (_, offset) => addDays(range.checkIn, offset));
}

export function containsNight(range: DateRange, date: string): boolean {
  return range.checkIn <= date && date < range.checkOut;
}

export function overlaps(first: DateRange, second: DateRange): boolean {
  return first.checkIn < second.checkOut && second.checkIn < first.checkOut;
}

export function overlapNights(first: DateRange, second: DateRange): number {
  if (!overlaps(first, second)) return 0;
  return nightsBetween({
    checkIn: first.checkIn > second.checkIn ? first.checkIn : second.checkIn,
    checkOut: first.checkOut < second.checkOut ? first.checkOut : second.checkOut,
  });
}

export function hotelToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;
  return [year, month, day].join("-");
}

export function firstArrival(today = hotelToday()): string {
  return today > season.checkIn ? today : season.checkIn;
}

export function stayError(stay: Stay, earliest: string = season.checkIn): string | null {
  if (!isDate(stay.checkIn) || !isDate(stay.checkOut) || stay.checkIn >= stay.checkOut) {
    return "Выберите дату выезда позже даты заезда.";
  }
  if (stay.checkIn < earliest || stay.checkIn < season.checkIn || stay.checkOut > season.checkOut) {
    return "Выберите будущие даты в пределах сезона с 1 июня по 1 октября 2027 года.";
  }
  if (!Number.isInteger(stay.guests) || stay.guests < 1 || stay.guests > maxGuests) {
    return "Укажите число гостей от 1 до 6.";
  }
  return null;
}

export function shiftMonth(month: string, offset: number): string {
  const date = asUtc(month + "-01");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return isoDay(date).slice(0, 7);
}

export function monthRange(month: string): DateRange {
  return { checkIn: month + "-01", checkOut: shiftMonth(month, 1) + "-01" };
}

export function seasonMonth(today = hotelToday()): string {
  return (containsNight(season, today) ? today : season.checkIn).slice(0, 7);
}

const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
const weekdayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" });

export const dateLabel = (date: string) => shortDate.format(asUtc(date));
export function monthLabel(month: string): string {
  const label = monthFormat.format(asUtc(month + "-01"));
  return label[0].toUpperCase() + label.slice(1);
}
export const weekdayLabel = (date: string) => weekdayFormat.format(asUtc(date));
export const stayLabel = (range: DateRange) => dateLabel(range.checkIn) + " — " + dateLabel(range.checkOut);

export function countLabel(count: number, forms: [string, string, string]): string {
  const index = { one: 0, few: 1, many: 2, other: 2, zero: 2, two: 1 };
  return String(count) + " " + forms[index[new Intl.PluralRules("ru").select(count)]];
}
