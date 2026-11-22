import { applyCommand, createDemoState, type Command, type HotelState } from "./bookings";

const databaseName = "troy-demo";
const store = "hotel";
const stateKey = "state";
let connection: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(store);
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          connection = undefined;
        };
        resolve(database);
      };
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  return connection;
}

export async function loadOrUpdateHotel(command?: Command, restoreRequest = false): Promise<HotelState> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    // Reading and checking inside the write transaction serializes conflicts across tabs.
    const transaction = database.transaction(store, "readwrite");
    const records = transaction.objectStore(store);
    const request = records.get(stateKey);
    let state: HotelState;
    let failure: unknown;
    request.onsuccess = () => {
      try {
        state = request.result ?? createDemoState();
        const existingRequest = restoreRequest && command?.type === "request"
          && state.bookings.some(({ id, source }) => id === command.id && source === "site");
        if (command && !existingRequest) applyCommand(state, command);
        if (command || !request.result) records.put(state, stateKey);
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(state);
    transaction.onabort = () => reject(failure ?? transaction.error);
  });
}

export const demoAdmin = { login: "admin", password: "troy-demo" };
export const newRecordId = () => "TR-" + crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
