import { expect, test } from "@playwright/test";

const basePath = new URL(process.env.TROY_TEST_URL ?? "http://localhost").pathname.replace(/\/$/, "");
const path = (value: string) => encodeURI(basePath + value);
const stay = "?checkIn=2027-06-14&checkOut=2027-06-16&guests=2";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-21T09:00:00Z"));
});

test("при изменении состава гостей сумма и переход к заявке обновляются вместе", async ({ page }) => {
  await page.goto(path("/номера/") + stay);
  const standard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Стандарт DBL", exact: true }) });
  await expect(standard).toContainText(/9\s500\s₽/);
  await page.getByRole("button", { name: "Гости", exact: true }).click();
  await page.getByRole("dialog", { name: "Гости" }).getByRole("button", { name: "1 гость", exact: true }).click();
  await expect(standard).toContainText(/6\s500\s₽/);
  await expect(standard.getByRole("link", { name: "Оставить заявку" })).toHaveAttribute("href", /guests=1/);
});

test("карточка на телефоне сохраняет условия расчёта и возвращает к тем же результатам", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path("/номера/standard-dbl/") + stay);
  const action = page.getByRole("link", { name: "Оставить заявку" });
  await expect(action).toBeInViewport();
  await page.getByText("Расчёт по ночам", { exact: true }).click();
  await expect(page.getByText(/4\s500\s₽/)).toBeVisible();
  await expect(page.getByText(/5\s000\s₽/)).toBeVisible();
  await page.getByRole("navigation", { name: "Хлебные крошки" }).getByRole("link", { name: "Номера" }).click();
  await expect(page).toHaveURL(/checkIn=2027-06-14/);
  await expect(page.getByRole("heading", { name: "Номера на ваши даты" })).toBeVisible();
});

test("в демо есть рассчитанный тариф для трёх гостей", async ({ page }) => {
  await page.goto(path("/номера/") + stay.replace("guests=2", "guests=3"));
  const result = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Трёхместный эконом", exact: true }) });
  await expect(result).toContainText(/7\s500\s₽/);
  await expect(result.getByRole("link", { name: "Оставить заявку" })).toBeVisible();
});

test("после заезда выезд выбирается в том же календаре", async ({ page }) => {
  await page.goto(path("/номера/"));
  await page.getByRole("button", { name: "Заезд и выезд", exact: true }).click();
  const calendar = page.getByRole("dialog", { name: "Заезд и выезд", exact: true });
  await calendar.getByRole("button", { name: "14 июня 2027", exact: true }).click();
  await expect(calendar).toBeVisible();
  await expect(calendar.getByRole("button", { name: "15 июня 2027", exact: true })).toBeFocused();
  await calendar.getByRole("button", { name: "16 июня 2027", exact: true }).click();
  await expect(calendar).toBeHidden();
  await expect(page.getByRole("button", { name: "Заезд и выезд", exact: true })).toHaveAccessibleDescription(/14 июня.*16 июня.*2 ночи/);
});

test("изменение диапазона заменяет старые даты в ссылке на заявку", async ({ page }) => {
  await page.goto(path("/номера/standard-dbl/") + stay);
  const action = page.getByRole("link", { name: "Оставить заявку" });
  await expect(action).toHaveAttribute("href", /checkIn=2027-06-14/);
  await page.getByRole("button", { name: "Заезд и выезд", exact: true }).click();
  const calendar = page.getByRole("dialog", { name: "Заезд и выезд", exact: true });
  await calendar.getByRole("button", { name: "15 июня 2027", exact: true }).click();
  await calendar.getByRole("button", { name: "16 июня 2027", exact: true }).click();
  await expect(calendar).toBeHidden();
  await expect(action).toHaveAttribute("href", /checkIn=2027-06-15/);
  await expect(page).toHaveURL(/checkIn=2027-06-15/);
  await expect(page.getByRole("region", { name: "На ваши даты" })).toContainText(/5\s000\s₽/);
});

test("календарь открывается внутри сезона для ссылки с датами за его пределами", async ({ page }) => {
  await page.goto(path("/номера/") + stay.replaceAll("2027", "2028"));
  await page.getByRole("button", { name: "Заезд и выезд", exact: true }).click();
  const calendar = page.getByRole("dialog", { name: "Заезд и выезд", exact: true });
  await expect(calendar.getByRole("button", { name: "30 сентября 2027", exact: true })).toBeEnabled();
});

test("сохранённая заявка восстанавливается с номером и статусом после обновления", async ({ page }) => {
  await page.goto(path("/номера/бронирование/") + stay + "&category=standard-dbl");
  await page.getByLabel("Имя", { exact: true }).fill("Тестовый Гость");
  await page.getByLabel("Телефон", { exact: true }).fill("+70000000004");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Тестовую заявку|Отправить заявку/i }).click();
  const number = page.getByText(/^TR-[A-F0-9]+$/);
  await expect(number).toBeVisible();
  const id = await number.innerText();
  await page.reload();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
  await expect(page.getByText("Ожидает подтверждения", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Скопировать номер", exact: true })).toBeVisible();
  await expect(page.getByLabel("Имя", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Новая заявка", exact: true }).click();
  await expect(page.getByLabel("Имя", { exact: true })).toBeVisible();
});

test("при заполненном локальном хранилище номер заявки восстанавливается в этой вкладке", async ({ page }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("troy-guest-")) throw new DOMException("Хранилище заполнено", "QuotaExceededError");
      setItem.call(this, key, value);
    };
  });
  await page.goto(path("/номера/бронирование/") + stay + "&category=standard-dbl");
  await page.getByLabel("Имя", { exact: true }).fill("Тестовый Гость");
  await page.getByLabel("Телефон", { exact: true }).fill("+70000000004");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Сохранить тестовую заявку" }).click();
  const number = page.getByText(/^TR-[A-F0-9]+$/);
  await expect(number).toBeVisible();
  const id = await number.innerText();
  await page.reload();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
});

test("на мобильном прайсе период меняется без горизонтального поиска колонки", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path("/цены/"));
  await page.getByLabel("Период", { exact: true }).selectOption("2027-09-15");
  const row = page.getByRole("row").filter({ hasText: "Стандарт · 2 гостя" });
  await expect(row).toContainText(/4\s000\s₽/);
  await expect(row.getByRole("link", { name: "Стандарт DBL" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(1);
});

test("занятая категория предлагает другие номера и ближайшие свободные даты", async ({ page }) => {
  await page.goto(path("/admin/"));
  await page.getByLabel("Логин").fill("admin");
  await page.getByLabel("Пароль").fill("troy-demo");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const calendar = page.getByRole("region", { name: "Шахматка", exact: true });
  await calendar.getByRole("button", { name: "Корпус", exact: true }).click();
  await page.getByRole("dialog", { name: "Корпус", exact: true }).getByRole("button", { name: "Корпус 2", exact: true }).click();
  for (const room of ["Двухместный 04", "Двухместный 05"]) {
    await calendar.getByRole("button", { name: room + ", 14 июня", exact: true }).click();
    await calendar.getByRole("button", { name: room + ", 15 июня", exact: true }).click();
    const roomDialog = page.getByRole("dialog", { name: room, exact: true });
    await roomDialog.getByRole("button", { name: "Закрыть даты", exact: true }).click();
    await roomDialog.getByLabel("Причина закрытия").fill("Подготовка");
    await roomDialog.getByRole("button", { name: "Сохранить закрытие", exact: true }).click();
    await expect(roomDialog).toBeHidden();
  }
  await page.goto(path("/номера/economy-twin/") + stay);
  const results = page.getByRole("region", { name: "На ваши даты" });
  await expect(results.getByText("Нет свободных номеров", { exact: true })).toBeVisible();
  await expect(results.getByRole("link", { name: "Другие номера на ваши даты", exact: true })).toHaveAttribute("href", /checkIn=2027-06-14/);
  await expect(results.getByRole("link", { name: /Ближайшие даты/ })).toHaveAttribute("href", /checkIn=2027-06-16&checkOut=2027-06-18/);
});
