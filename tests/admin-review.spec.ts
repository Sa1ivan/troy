import { expect, test, type Page } from "@playwright/test";

const basePath = new URL(process.env.TROY_TEST_URL ?? "http://localhost").pathname.replace(/\/$/, "");

async function signIn(page: Page, day: string) {
  await page.clock.setFixedTime(new Date(`2027-06-${day}T09:00:00Z`));
  await page.goto(basePath + "/admin/");
  await page.getByLabel("Логин").fill("admin");
  await page.getByLabel("Пароль").fill("troy-demo");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Админка", exact: true })).toBeVisible();
}

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const picker = page.getByRole("dialog", { name: label, exact: true });
  await picker.getByRole("button", { name: option, exact: true }).click();
  await expect(picker).toBeHidden();
}

test("шахматка фокусируется одной остановкой Tab и сразу отклоняет занятый интервал", async ({ page }) => {
  await signIn(page, "02");
  const grid = page.getByRole("grid", { name: "Комнаты и ночи" });
  await expect(grid.locator('button[tabindex="0"]')).toHaveCount(1);
  const firstRoom = grid.getByRole("button", { name: "Изменить комнату Люкс 1·1", exact: true });
  await page.getByRole("button", { name: "Открыть шахматку на весь экран" }).focus();
  await page.keyboard.press("Tab");
  await expect(firstRoom).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(grid.getByRole("button", { name: "Люкс 1·1, 1 июня", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(grid.getByRole("button", { name: "Люкс 1·2, 1 июня", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(grid.getByRole("button", { name: "Люкс 1·2, 30 июня", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await grid.evaluate((element) => element.contains(document.activeElement))).toBe(false);

  await grid.getByRole("button", { name: "Люкс 1·1, 5 июня", exact: true }).click();
  await grid.getByRole("button", { name: "Люкс 1·1, 11 июня", exact: true }).click();
  const error = page.getByRole("region", { name: "Шахматка", exact: true }).getByRole("alert");
  await expect(error).toContainText("Даты пересекаются");
  await expect(error).toContainText("Марина (демо)");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("комната с активной бронью требует переселения, шахматка показывает новый отрезок", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "08");
  await page.getByRole("searchbox", { name: "Комната", exact: true }).fill("Люкс 1·1");
  await page.getByRole("button", { name: "Изменить комнату Люкс 1·1", exact: true }).click();
  const room = page.getByRole("dialog", { name: "Редактирование комнаты" });
  await chooseOption(page, "Категория", "Стандарт DBL");
  await expect(room.getByRole("alert")).toContainText("вместимость");
  await expect(room.getByText("TR-DEMO1", { exact: false })).toBeVisible();
  await expect(room.getByRole("button", { name: "Сохранить комнату" })).toBeDisabled();
  await room.getByRole("button", { name: /Переселить/ }).click();

  const booking = page.getByRole("dialog", { name: "Марина (демо)" });
  await chooseOption(page, "Комната", "Корпус 1 · Люкс 3·1");
  await booking.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(booking.getByText("Корпус 1 · Люкс 3·1", { exact: true })).toBeVisible();
  await expect(booking.getByText("TR-DEMO1", { exact: true })).toBeVisible();
  await expect(booking.locator(".finance-summary").getByText(/9\s000\s₽/)).toBeVisible();
  await booking.getByRole("button", { name: "Показать в шахматке" }).click();
  const strip = page.getByRole("button", { name: "Бронь Марина (демо), 8 июня — 11 июня", exact: true });
  await expect(strip).toBeFocused();
  await expect(strip).toHaveAttribute("data-highlighted", "true");
  await expect(strip).toBeInViewport();
  await expect(page.getByRole("button", { name: "Бронь Марина (демо), 6 июня — 8 июня", exact: true })).toHaveCount(1);
});

test("досрочный выезд сохраняет стоимость прожитых ночей, возврат отражается в кассе", async ({ page }) => {
  await signIn(page, "08");
  await page.getByRole("button", { name: /Бронь Марина/ }).click();
  const booking = page.getByRole("dialog", { name: "Марина (демо)" });
  await booking.getByRole("button", { name: "Досрочный выезд" }).click();
  await expect(booking.getByRole("button", { name: "Дата выезда" })).toHaveAccessibleDescription("08.06.2027");
  await expect(booking.getByLabel("Стоимость проживания, ₽")).toHaveValue("12000");
  await booking.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(booking.getByText("6 июня — 8 июня", { exact: true })).toBeVisible();
  await expect(booking.locator(".finance-summary").getByText(/3\s000\s₽/)).toBeVisible();
  await booking.getByRole("button", { name: "Оформить возврат" }).click();
  await booking.getByLabel("Сумма возврата, ₽").fill("3000");
  await booking.getByLabel("Причина возврата").fill("Пересчёт по согласованию");
  await booking.getByRole("button", { name: "Сохранить возврат" }).click();
  await expect(booking.getByText("Пересчёт по согласованию", { exact: true })).toBeVisible();
  await expect(booking.locator(".finance-summary").getByText(/6\s000\s₽/)).toHaveCount(2);
  await booking.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.getByRole("button", { name: "Люкс 1·1, 8 июня", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Деньги и аналитика", exact: true }).click();
  await expect(page.getByText("Возвращено", { exact: true }).locator("..")).toContainText(/3\s000\s₽/);
  await expect(page.getByText("Чистые поступления", { exact: true }).locator("..")).toContainText(/6\s000\s₽/);
});

test("сводка показывает заезд и выезд сегодня, журнал находит гостя по телефону и номеру", async ({ page }) => {
  await signIn(page, "11");
  await page.getByRole("button", { name: "Люкс 1·1, 11 июня", exact: true }).click();
  await page.getByRole("button", { name: "На одну ночь" }).click();
  const booking = page.getByRole("dialog", { name: "Люкс 1·1" });
  await booking.getByLabel("Имя").fill("Гость на сегодня");
  await booking.getByLabel("Телефон").fill("+70000000009");
  await booking.getByLabel("Стоимость проживания, ₽").fill("5000");
  await booking.getByRole("button", { name: "Сохранить бронь" }).click();
  await expect(booking).toBeHidden();
  await page.getByRole("button", { name: /Заявки и брони/ }).click();

  const today = page.getByRole("region", { name: "Сегодня" });
  await expect(today.getByRole("heading", { name: "Заезды" })).toBeVisible();
  await expect(today.getByRole("heading", { name: "Выезды" })).toBeVisible();
  await expect(today.getByRole("button", { name: "Гость на сегодня" }).locator("..")).toContainText(/Люкс 1·1.*5\s000\s₽/s);
  await expect(today.getByRole("button", { name: "Марина (демо)" }).locator("..")).toContainText(/Люкс 1·1.*21\s000\s₽/s);

  const journal = page.getByRole("table", { name: "Журнал заявок и броней" });
  const search = page.getByRole("searchbox", { name: "Поиск по журналу" });
  for (const query of ["маРиНа", "8 (000) 000-00-01", "tr-demo1"]) {
    await search.fill(query);
    await expect(journal.getByRole("button", { name: "Марина (демо)", exact: true })).toBeVisible();
    await expect(journal.getByRole("row")).toHaveCount(2);
  }
});
