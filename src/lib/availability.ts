import { occupiedRanges, type HotelState } from "./bookings";
import { categories, roomCapacity, type Category, type Room } from "./catalog";
import { addDays, nightsBetween, overlaps, season, stayError, type DateRange, type Stay } from "./dates";

export type Availability = {
  rooms: Pick<Room, "id" | "categoryId">[];
  occupied: { roomId: string; range: DateRange }[];
};

export function toAvailability(state: HotelState): Availability {
  return {
    rooms: state.rooms.map(({ id, categoryId }) => ({ id, categoryId })),
    occupied: state.rooms.flatMap(({ id }) => occupiedRanges(state, id)
      .map(({ range: { checkIn, checkOut } }) => ({ roomId: id, range: { checkIn, checkOut } }))),
  };
}

export function roomsForParty(availability: Availability, category: Category, guests: number) {
  return availability.rooms.filter((room) => room.categoryId === category.id && guests <= roomCapacity(room));
}

export function categoryIsFree(availability: Availability, category: Category, stay: Stay): boolean {
  return roomsForParty(availability, category, stay.guests).some(({ id }) =>
    !availability.occupied.some(({ roomId, range }) => roomId === id && overlaps(range, stay)));
}

export function nearbyStay(availability: Availability, stay: Stay, firstCheckIn: string, category?: Category) {
  if (stayError(stay)) return null;
  const nights = nightsBetween(stay);
  const lastCheckIn = addDays(season.checkOut, -nights);
  const options = category ? [category] : categories;
  const eligible = options.filter((item) => roomsForParty(availability, item, stay.guests).length > 0);
  if (!eligible.length) return null;
  for (let offset = 1; ; offset++) {
    const later = addDays(stay.checkIn, offset);
    const earlier = addDays(stay.checkIn, -offset);
    if (later > lastCheckIn && earlier < firstCheckIn) return null;
    for (const checkIn of [later, earlier]) {
      if (checkIn < firstCheckIn || checkIn > lastCheckIn) continue;
      const alternative = { checkIn, checkOut: addDays(checkIn, nights), guests: stay.guests };
      const room = eligible.find((item) => categoryIsFree(availability, item, alternative));
      if (room) return { category: room, stay: alternative };
    }
  }
}
