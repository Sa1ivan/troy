import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

const liveUrl = process.env.TROY_LIVE_TEST_URL;
const endpoint = new URL("/api/hotel/", liveUrl ?? "http://127.0.0.1");
const headers = { Origin: endpoint.origin };
const credentials = { login: process.env.TROY_ADMIN_LOGIN, password: process.env.TROY_ADMIN_PASSWORD };
const stay = { checkIn: "2027-06-14", checkOut: "2027-06-16", guests: 2 };
const contact = { name: "Тестовая заявка", phone: "+70000000019" };

function post(context: APIRequestContext, data: object) {
  return context.post(endpoint.href, { headers, data });
}

test.describe("Серверный журнал", () => {
  test.skip(!liveUrl, "Укажите TROY_LIVE_TEST_URL для запуска тестов рабочего API.");

  test("гость получает квитанцию после записи и может повторно открыть её по ключу", async ({ request, playwright }) => {
    const initial = await request.get(endpoint.href);
    expect(initial.status()).toBe(200);
    expect(await initial.json()).toMatchObject({ mode: "live", staff: null });

    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const booking = { type: "request", id, categoryId: "standard-dbl", stay, contact };
    const requestBody = { action: "request", request: booking, token };
    const payload = { receipt: { id, categoryId: "standard-dbl", stay, status: "pending", total: 950_000 } };
    const submissions = await Promise.all([post(request, requestBody), post(request, requestBody)]);
    for (const submission of submissions) {
      expect(submission.status()).toBe(200);
      expect(await submission.json()).toEqual(payload);
    }

    const anotherGuest = await playwright.request.newContext();
    try {
      const receipt = await post(anotherGuest, { action: "receipt", id, token });
      expect(await receipt.json()).toEqual(payload);
      const retry = await post(anotherGuest, {
        ...requestBody,
        request: { ...booking, stay: { ...stay, checkIn: "2027-05-01" } },
      });
      expect(await retry.json()).toEqual(payload);
      const wrongKey = await post(anotherGuest, { action: "receipt", id, token: randomUUID() });
      expect(await wrongKey.json()).toEqual({ receipt: null });
      const duplicate = await post(anotherGuest, { ...requestBody, token: randomUUID() });
      expect(duplicate.status()).toBe(409);
      const publicState = await anotherGuest.get(endpoint.href);
      expect(await publicState.json()).toMatchObject({ mode: "live", staff: null });
      expect(await publicState.text()).not.toContain(contact.phone);
      expect(await publicState.text()).not.toContain(id);
    } finally {
      await anotherGuest.dispose();
    }
  });

  test("сервер ограничивает изменения владельцем действующей сессии", async ({ request }) => {
    const block = {
      id: randomUUID(), roomId: "b1-suite-1-1", reason: "Тестовое закрытие",
      range: { checkIn: "2027-06-14", checkOut: "2027-06-16" },
    };
    const command = { type: "block", ...block };
    const body = { action: "command", command };
    expect((await post(request, body)).status()).toBe(401);
    expect((await post(request, { action: "login", login: "admin", password: "troy-demo" })).status()).toBe(401);

    const login = await post(request, { action: "login", ...credentials });
    expect(login.status()).toBe(200);
    const session = login.headers()["set-cookie"];
    expect(session).toContain("HttpOnly");
    expect(session).toMatch(/SameSite=Strict/i);
    if (endpoint.protocol === "https:") expect(session).toMatch(/; Secure(?:;|$)/i);
    expect(login.headers()["cache-control"]).toContain("no-store");
    const snapshot = await login.json();
    expect(snapshot.staff.rooms.find(({ id }: { id: string }) => id === "b2-double-1")).toMatchObject({ categoryId: null });
    expect(snapshot.staff.bookings.some(({ id }: { id: string }) => id.startsWith("TR-DEMO"))).toBe(false);

    expect((await request.post(endpoint.href, { data: body })).status()).toBe(403);
    expect((await request.post(endpoint.href, { headers: { Origin: "https://example.org" }, data: body })).status()).toBe(403);
    expect((await post(request, { action: "command", command: { ...command, range: [] } })).status()).toBe(400);
    expect((await post(request, { action: "command", command: { ...command, type: "unknown" } })).status()).toBe(400);
    expect((await post(request, { ...body, padding: "x".repeat(100_000) })).status()).toBe(413);

    const changed = await post(request, body);
    expect(changed.status()).toBe(200);
    expect(await changed.json()).toMatchObject({ availability: { occupied: expect.arrayContaining([
      { roomId: command.roomId, range: command.range },
    ]) }, staff: { blocks: expect.arrayContaining([block]) } });
    const refreshed = await request.get(endpoint.href);
    expect(await refreshed.json()).toMatchObject({ staff: { blocks: expect.arrayContaining([block]) } });

    expect((await post(request, { action: "command", command: { type: "unblock", id: command.id } })).status()).toBe(200);
    const logout = await post(request, { action: "logout" });
    expect(await logout.json()).toMatchObject({ staff: null });
    const oldCookie = session.split(";")[0];
    const loggedOut = await request.get(endpoint.href, { headers: { Cookie: oldCookie } });
    expect(await loggedOut.json()).toMatchObject({ staff: null });
  });

  test("параллельные бронирования одной комнаты сохраняют только одну бронь", async ({ request, playwright }) => {
    const colleague = await playwright.request.newContext();
    try {
      const logins = await Promise.all([request, colleague].map((ctx) => post(ctx, { action: "login", ...credentials })));
      for (const login of logins) expect(login.status()).toBe(200);
      const commands = [request, colleague].map(() => ({
        type: "manualBooking", id: randomUUID(), roomId: "b1-standard-dbl-01", total: 1_000_000,
        stay: { checkIn: "2027-06-23", checkOut: "2027-06-25", guests: 2 }, contact,
      }));
      const results = await Promise.all([request, colleague].map((ctx, index) =>
        post(ctx, { action: "command", command: commands[index] })));
      expect(results.map((response) => response.status()).sort()).toEqual([200, 409]);
      const saved = commands[results.findIndex((response) => response.ok())];
      const snapshot = await colleague.get(endpoint.href);
      const { staff } = await snapshot.json();
      const ids = new Set<string>(commands.map(({ id }) => id));
      expect(staff.bookings.filter(({ id }: { id: string }) => ids.has(id))).toMatchObject([{ id: saved.id, status: "confirmed" }]);
      expect((await post(colleague, { action: "command", command: { type: "cancel", id: saved.id } })).status()).toBe(200);
    } finally {
      await colleague.dispose();
    }
  });
});
