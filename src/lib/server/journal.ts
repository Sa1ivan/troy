import { closeSync, openSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { applyCommand, BookingError, type Command, type HotelState } from "../bookings";
import { buildInventory } from "../catalog";
import { firstArrival, stayError } from "../dates";
import { guestReceipt } from "../guest-receipts";

class HotelJournal {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS hotel_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS guest_receipts (
        id TEXT PRIMARY KEY,
        digest TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS staff_sessions (
        digest TEXT PRIMARY KEY,
        expires INTEGER NOT NULL
      ) STRICT;
    `);
    const initial: HotelState = { rooms: buildInventory(false), bookings: [], blocks: [], payments: [] };
    db.prepare("INSERT OR IGNORE INTO hotel_state (id, data) VALUES (1, ?)").run(JSON.stringify(initial));
  }

  state(): HotelState {
    const row = this.db.prepare("SELECT data FROM hotel_state WHERE id = 1").get();
    if (typeof row?.data !== "string") throw new Error("Hotel state is missing");
    return JSON.parse(row.data) as HotelState;
  }

  private save(state: HotelState) {
    this.db.prepare("UPDATE hotel_state SET data = ? WHERE id = 1").run(JSON.stringify(state));
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }

  isStaff(digest: string | null): boolean {
    return digest !== null && Boolean(this.db.prepare("SELECT 1 FROM staff_sessions WHERE digest = ? AND expires > ?")
      .get(digest, Date.now()));
  }

  startSession(digest: string, previous: string | null, expires: number) {
    this.transaction(() => {
      this.db.prepare("DELETE FROM staff_sessions WHERE expires <= ? OR digest = ?").run(Date.now(), previous);
      this.db.prepare("INSERT INTO staff_sessions (digest, expires) VALUES (?, ?)").run(digest, expires);
    });
  }

  endSession(digest: string | null) {
    if (digest !== null) this.db.prepare("DELETE FROM staff_sessions WHERE digest = ?").run(digest);
  }

  command(digest: string | null, command: Command): HotelState | null {
    if (digest === null) return null;
    return this.transaction(() => {
      if (!this.isStaff(digest)) return null;
      const state = this.state();
      applyCommand(state, command);
      this.save(state);
      return state;
    });
  }

  private hasReceipt(id: string, digest: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM guest_receipts WHERE id = ? AND digest = ?").get(id, digest));
  }

  submit(command: Extract<Command, { type: "request" }>, digest: string) {
    return this.transaction(() => {
      const state = this.state();
      const existing = state.bookings.find(({ id }) => id === command.id);
      if (existing) {
        if (!this.hasReceipt(command.id, digest)) throw new BookingError("Заявка с таким номером уже сохранена.");
        return guestReceipt(existing);
      }

      const error = stayError(command.stay, firstArrival());
      if (error) throw new BookingError(error);
      applyCommand(state, command);
      const booking = state.bookings.at(-1);
      if (booking?.id !== command.id) throw new Error("Submission is missing from the journal");
      this.save(state);
      this.db.prepare("INSERT INTO guest_receipts (id, digest) VALUES (?, ?)").run(command.id, digest);
      return guestReceipt(booking);
    });
  }

  receipt(id: string, digest: string) {
    if (!this.hasReceipt(id, digest)) return null;
    const booking = this.state().bookings.find((item) => item.id === id);
    return booking ? guestReceipt(booking) : null;
  }
}

let connection: Promise<HotelJournal> | undefined;

export function getJournal(path: string): Promise<HotelJournal> {
  connection ??= openJournal(path).catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

async function openJournal(path: string) {
  const { DatabaseSync } = await import("node:sqlite");
  closeSync(openSync(path, "a", 0o600));
  const db = new DatabaseSync(path, { timeout: 5000 });
  try {
    return new HotelJournal(db);
  } catch (error) {
    db.close();
    throw error;
  }
}
