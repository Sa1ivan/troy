import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const liveUrl = process.env.TROY_LIVE_TEST_URL;

test("гость и сотрудник в разных профилях видят одну заявку и её подтверждение", async ({ page, browser }) => {
  test.skip(!liveUrl, "Укажите TROY_LIVE_TEST_URL для проверки рабочего режима.");
  const guestName = "Гость " + randomUUID().slice(0, 8);
  const path = "/номера/бронирование/?checkIn=2027-06-14&checkOut=2027-06-16&guests=2&category=standard-dbl";
  const staffContext = await browser.newContext();
  try {
    await page.goto(liveUrl + path);
    await page.getByLabel("Имя", { exact: true }).fill(guestName);
    await page.getByLabel("Телефон", { exact: true }).fill("+70000000009");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Отправить заявку", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Заявка принята", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Ожидает подтверждения", { exact: true })).toBeVisible();

    const staff = await staffContext.newPage();
    await staff.goto(liveUrl + "/admin/");
    await expect(staff.getByRole("heading", { name: "Вход для сотрудников" })).toBeVisible();
    await expect(staff.getByText("Демоучётка", { exact: false })).toHaveCount(0);
    await staff.getByLabel("Логин").fill(process.env.TROY_ADMIN_LOGIN!);
    await staff.getByLabel("Пароль").fill(process.env.TROY_ADMIN_PASSWORD!);
    await staff.getByRole("button", { name: "Войти", exact: true }).click();
    await staff.getByRole("button", { name: /Заявки и брони/ }).click();
    await staff.getByRole("button", { name: guestName, exact: true }).click();
    const booking = staff.getByRole("dialog", { name: guestName, exact: true });
    await booking.getByRole("button", { name: "Комната", exact: true }).click();
    const rooms = staff.getByRole("dialog", { name: "Комната", exact: true });
    await rooms.getByRole("button", { name: /Корпус 1 · Стандарт DBL/ }).first().click();
    await booking.getByRole("button", { name: "Подтвердить бронь" }).click();
    await expect(booking.getByText("Подтверждена", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Обновить статус", exact: true }).click();
    await expect(page.getByText("Подтверждена", { exact: true })).toBeVisible();
    await expect(page.getByText(/9\s500\s₽/)).toBeVisible();
  } finally {
    await staffContext.close();
  }
});
