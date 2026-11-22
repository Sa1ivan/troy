import { expect, test, type Page } from "@playwright/test";

const basePath = new URL(process.env.TROY_TEST_URL ?? "http://localhost").pathname.replace(/\/$/, "");
const pagesDemo = basePath !== "";
const submitRequestLabel = "Сохранить тестовую заявку";
const requestSuccessLabel = "Тестовая заявка сохранена";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-21T09:00:00Z"));
});

function sitePath(path: string) {
  return encodeURI(basePath + path);
}

async function chooseStay(page: Page, arrival: string, departure: string) {
  await page.getByRole("button", { name: "Заезд и выезд", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Заезд и выезд", exact: true });
  await picker.getByRole("button", { name: arrival, exact: true }).click();
  await picker.getByRole("button", { name: departure, exact: true }).click();
  await expect(picker).toBeHidden();
}

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const picker = page.getByRole("dialog", { name: label, exact: true });
  await picker.getByRole("button", { name: option, exact: true }).click();
  await expect(picker).toBeHidden();
}

async function signIn(page: Page) {
  await page.goto(sitePath("/admin/"));
  await expect(page.getByRole("heading", { name: "Вход для сотрудников" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Админка", exact: true })).toHaveCount(0);
  await page.getByLabel("Логин").fill("admin");
  await page.getByLabel("Пароль").fill("troy-demo");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("link", { name: "Админка", exact: true })).toBeVisible();
}

for (const { path, action, heading } of [
  { path: "/", action: "Найти номер", heading: "Номера на ваши даты" },
  { path: "/номера/standard-dbl/", action: "Проверить наличие", heading: "На ваши даты" },
]) {
  test("подбор плавно прокручивает к результату на той же странице " + path, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(sitePath(path));
    await chooseStay(page, "14 июня 2027", "16 июня 2027");
    const submit = page.getByRole("button", { name: action, exact: true });
    await submit.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const positions = new Set<number>([window.scrollY]);
      document.documentElement.dataset.scrollPositions = "1";
      window.addEventListener("scroll", () => {
        positions.add(window.scrollY);
        document.documentElement.dataset.scrollPositions = String(positions.size);
      }, { passive: true });
    });
    await submit.click();
    const results = page.getByRole("region", { name: heading, exact: true });
    await expect(results).toContainText(/9\s500\s₽/);
    expect(decodeURI(new URL(page.url()).pathname)).toBe(basePath + path);
    await expect.poll(async () => results.evaluate((element) => {
      const { top, bottom } = element.getBoundingClientRect();
      const atPageEnd = Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) < 2;
      return top > 48 && (top < 130 || (atPageEnd && bottom < window.innerHeight));
    })).toBe(true);
    await expect(results.getByRole("heading", { name: heading })).toBeFocused();
    await expect.poll(async () => Number(await page.locator("html").getAttribute("data-scroll-positions"))).toBeGreaterThan(3);
  });
}

test("гость с телефона отправляет заявку, администратор подтверждает и учитывает оплату в другой вкладке", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const staff = await context.newPage();
  await signIn(staff);
  await staff.getByRole("button", { name: /Заявки и брони/ }).click();

  await page.goto(sitePath("/"));
  const facade = page.getByRole("img", { name: "Фасад гостевого дома «Троя» в Лазаревском" });
  await facade.scrollIntoViewIfNeeded();
  await expect.poll(() => facade.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Админка", exact: true })).toHaveCount(0);
  await chooseStay(page, "14 июня 2027", "16 июня 2027");
  await page.getByRole("button", { name: "Найти номер" }).click();
  const result = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Стандарт DBL", exact: true }) });
  await expect(result).toContainText(/9\s500\s₽/);
  await result.getByRole("link", { name: "Оставить заявку" }).click();
  await page.getByLabel("Имя", { exact: true }).fill("Тестовый Гость");
  await page.getByLabel("Телефон", { exact: true }).fill("+70000000004");
  await page.getByRole("checkbox", { name: /Согласен на обработку/ }).check();
  const submit = page.getByRole("button", { name: submitRequestLabel });
  await submit.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await submit.click();
  await expect(page.getByRole("heading", { name: requestSuccessLabel })).toBeVisible();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(2);

  await staff.getByRole("button", { name: /Тестовый Гость/ }).click();
  const dialog = staff.getByRole("dialog");
  await chooseOption(staff, "Комната", "Корпус 1 · Стандарт DBL 01");
  await expect(dialog.getByLabel("Стоимость проживания, ₽")).toHaveValue("9500");
  await dialog.getByRole("button", { name: "Подтвердить бронь" }).click();
  await expect(dialog.getByText("Подтверждена", { exact: true })).toBeVisible();
  await dialog.getByLabel("Сумма платежа, ₽").fill("3000");
  await dialog.getByRole("button", { name: "Дата платежа", exact: true }).click();
  const picker = staff.getByRole("dialog", { name: "Дата платежа", exact: true });
  await picker.getByRole("button", { name: "Выбрать месяц и год" }).click();
  const year = picker.getByRole("status");
  const displayedYear = Number(await year.textContent());
  for (let current = displayedYear; current < 2027; current++) await picker.getByRole("button", { name: "Следующий год" }).click();
  for (let current = displayedYear; current > 2027; current--) await picker.getByRole("button", { name: "Предыдущий год" }).click();
  await picker.getByRole("button", { name: "Июнь", exact: true }).click();
  await picker.getByRole("button", { name: "10 июня 2027", exact: true }).click();
  await expect(picker).toBeHidden();
  await dialog.getByRole("button", { name: "Внести оплату" }).click();
  await expect(dialog.getByText(/6\s500\s₽/)).toBeVisible();
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();

  await staff.getByRole("button", { name: "Шахматка", exact: true }).click();
  const strip = staff.getByRole("button", { name: /Тестовый Гость/ });
  await expect(strip).toBeVisible();
  await expect(strip.locator("..")).toHaveAttribute("colspan", "2");
  await staff.getByRole("button", { name: "Стандарт DBL 01, 13 июня", exact: true }).click();
  await staff.getByRole("button", { name: "Стандарт DBL 01, 16 июня", exact: true }).click();
  await expect(staff.getByRole("region", { name: "Шахматка", exact: true }).getByRole("alert")).toContainText("Даты пересекаются");
  await expect(dialog).toBeHidden();

  await staff.reload();
  await expect(staff.getByRole("button", { name: /Тестовый Гость/ })).toBeVisible();
  await staff.getByRole("button", { name: /Тестовый Гость/ }).click();
  await expect(dialog.getByText(/6\s500\s₽/)).toBeVisible();
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await staff.getByRole("button", { name: "Деньги и аналитика" }).click();
  const received = staff.locator(".metric-card").filter({ has: staff.getByText("Получено", { exact: true }) });
  await expect(received).toContainText(/12\s000\s₽/);
  await staff.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(staff.getByRole("link", { name: "Админка", exact: true })).toHaveCount(0);
  await expect(staff.getByRole("heading", { name: "Вход для сотрудников" })).toBeVisible();
});

test("администратор закрывает и снова открывает диапазон, день выезда доступен для ручной брони", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Люкс 1·1, 11 июня", exact: true }).click();
  await page.getByRole("button", { name: "Люкс 1·1, 12 июня", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Закрыть даты", exact: true }).click();
  await dialog.getByLabel("Причина закрытия").fill("Покраска");
  await dialog.getByRole("button", { name: "Сохранить закрытие" }).click();
  const closure = page.getByRole("button", { name: /Покраска/ });
  await expect(closure).toBeVisible();
  await closure.click();
  await dialog.getByRole("button", { name: "Снять закрытие" }).click();
  await expect(closure).toHaveCount(0);
  await page.getByRole("button", { name: "Люкс 1·1, 11 июня", exact: true }).click();
  await page.getByRole("button", { name: "На одну ночь", exact: true }).click();
  await dialog.getByLabel("Имя", { exact: true }).fill("Гость по телефону");
  await dialog.getByLabel("Телефон", { exact: true }).fill("+70000000005");
  await chooseOption(page, "Гости", "5");
  await dialog.getByLabel("Стоимость проживания, ₽").fill("6000");
  await dialog.getByRole("button", { name: "Сохранить бронь" }).click();
  await expect(page.getByRole("button", { name: /Гость по телефону/ })).toBeVisible();
});

test("в полноэкранной шахматке можно переключать месяцы, читать брони и закрывать даты", async ({ page }) => {
  await signIn(page);
  const calendar = page.getByRole("region", { name: "Шахматка", exact: true });
  const grid = calendar.getByLabel("Шахматка по комнатам и датам");
  const originalHeight = await grid.evaluate((element) => element.clientHeight);
  const enter = calendar.getByRole("button", { name: "Открыть шахматку на весь экран" });
  const exit = calendar.getByRole("button", { name: "Выйти из полноэкранной шахматки" });
  await enter.click();
  await expect(exit).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("admin-page"))).toBe(true);
  await expect.poll(() => grid.evaluate((element) => element.clientHeight)).toBeGreaterThan(originalHeight);
  await expect(page.getByRole("heading", { name: "Админка", exact: true })).toBeHidden();
  await chooseOption(page, "Корпус", "Корпус 1");

  await calendar.getByRole("button", { name: "Следующий месяц", exact: true }).click();
  await expect(calendar.getByText(/Июль 2027/)).toBeVisible();
  await calendar.getByRole("button", { name: "Предыдущий месяц", exact: true }).click();
  await calendar.getByRole("button", { name: /Бронь Марина/ }).click();
  const booking = page.getByRole("dialog", { name: "Марина (демо)", exact: true });
  await expect(booking).toBeVisible();
  await booking.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(booking).toBeHidden();

  await calendar.getByRole("button", { name: "Люкс 1·1, 12 июня", exact: true }).click();
  await calendar.getByRole("button", { name: "Люкс 1·1, 13 июня", exact: true }).click();
  const range = page.getByRole("dialog", { name: "Люкс 1·1", exact: true });
  await range.getByRole("button", { name: "Закрыть даты", exact: true }).click();
  await range.getByLabel("Причина закрытия").fill("Проверка в полноэкранном режиме");
  await range.getByRole("button", { name: "Сохранить закрытие" }).click();
  await expect(range).toBeHidden();
  const closure = calendar.getByRole("button", { name: /Закрытие Проверка в полноэкранном режиме/ });
  await expect(closure).toBeVisible();
  await exit.click();
  await expect(enter).toBeVisible();
  await expect(closure).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true);
});

test("на узком экране шахматка занимает окно и закрывается по Escape при недоступном Fullscreen API", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, "fullscreenEnabled", { value: false }));
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  const calendar = page.getByRole("region", { name: "Шахматка", exact: true });
  const enter = calendar.getByRole("button", { name: "Открыть шахматку на весь экран" });
  await enter.click();
  const exit = calendar.getByRole("button", { name: "Выйти из полноэкранной шахматки" });
  await expect(exit).toBeInViewport();
  const bounds = await page.locator(".admin-page").boundingBox();
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 320, height: 700 });
  await expect(page.getByRole("banner")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.keyboard.press("Escape");
  await expect(enter).toBeVisible();
  await expect(page.getByRole("heading", { name: "Админка", exact: true })).toBeVisible();
});

test("сайт сохраняет тему и помещается при ширине от 1440 до 320 px, выбор закрывается по фону", async ({ page }) => {
  for (const path of ["/policy/", "/номера/", "/номера/standard-dbl/", "/номера/бронирование/", "/цены/", "/фото/", "/контакт/", "/отзывы/", "/admin/", "/"]) {
    expect((await page.goto(sitePath(path)))?.ok(), path).toBeTruthy();
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path + " at " + width).toBeLessThanOrEqual(width);
    }
  }
  await page.getByRole("button", { name: "Включить тёмную тему", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Меню", exact: true });
  await expect(menu.getByRole("link", { name: "Номера", exact: true })).toBeVisible();
  await page.mouse.click(20, 16);
  await expect(menu).toBeHidden();
  await page.getByRole("button", { name: "Гости", exact: true }).click();
  const guests = page.getByRole("dialog", { name: "Гости", exact: true });
  await expect(guests).toBeVisible();
  await page.mouse.click(20, 16);
  await expect(guests).toBeHidden();
  await page.getByRole("button", { name: "Заезд и выезд", exact: true }).click();
  const dates = page.getByRole("dialog", { name: "Заезд и выезд", exact: true });
  await expect(dates).toBeVisible();
  await page.mouse.click(20, 16);
  await expect(dates).toBeHidden();
  await page.getByRole("button", { name: "Включить светлую тему", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("одновременное подтверждение двух заявок в одну комнату даёт одну бронь", async ({ page, context }) => {
  const names = ["Гость Первый", "Гость Второй"];
  const bookingPath = sitePath("/номера/бронирование/") + "?checkIn=2027-06-14&checkOut=2027-06-16&guests=2&category=standard-dbl";
  await page.goto(bookingPath);
  for (const [index, name] of names.entries()) {
    if (index > 0) await page.getByRole("button", { name: "Новая заявка", exact: true }).click();
    await page.getByLabel("Имя", { exact: true }).fill(name);
    await page.getByLabel("Телефон", { exact: true }).fill("+70000000008");
    await page.getByRole("checkbox", { name: /Согласен на обработку/ }).check();
    await page.getByRole("button", { name: submitRequestLabel }).click();
    await expect(page.getByRole("heading", { name: requestSuccessLabel })).toBeVisible();
  }
  const staff = [await context.newPage(), await context.newPage()];
  await Promise.all(staff.map(async (tab, index) => {
    await signIn(tab);
    await tab.getByRole("button", { name: /Заявки и брони/ }).click();
    await tab.getByRole("button", { name: names[index], exact: true }).click();
    await chooseOption(tab, "Комната", "Корпус 1 · Стандарт DBL 01");
  }));
  await Promise.all(staff.map((tab) => tab.getByRole("button", { name: "Подтвердить бронь" }).evaluate((button) => (button as HTMLButtonElement).click())));
  await expect.poll(async () => {
    const statuses = await Promise.all(staff.map((tab) =>
      tab.getByRole("dialog").getByText("Подтверждена", { exact: true }).count(),
    ));
    return statuses.reduce((first, second) => first + second, 0);
  }).toBe(1);
  const final = staff[0];
  await final.getByRole("dialog").getByRole("button", { name: "Закрыть", exact: true }).click();
  const rows = final.getByRole("row").filter({ hasText: /Гость Первый|Гость Второй/ });
  await expect(rows.filter({ hasText: "Подтверждена" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "Ожидает подтверждения" })).toHaveCount(1);
});

test("фотографии открываются во весь экран и листаются клавишами и свайпом", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(sitePath("/фото/"));
  await page.getByRole("button", { name: /Увеличить фото/ }).click();
  const viewer = page.getByRole("dialog");
  await expect(viewer).toBeVisible();
  expect(await viewer.boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByText("2 / 19", { exact: true })).toBeVisible();
  await viewer.getByRole("img", { name: /Вид с крыши на море и Лазаревское/ }).evaluate((stage) => {
    for (const [type, clientX] of [["touchstart", 270], ["touchend", 70]] as const) {
      const touch = new Touch({ identifier: 0, target: stage, clientX, clientY: 300 });
      stage.dispatchEvent(new TouchEvent(type, { bubbles: true, changedTouches: [touch] }));
    }
  });
  await expect(viewer.getByText("3 / 19", { exact: true })).toBeVisible();
  await viewer.getByRole("button", { name: "Следующее фото", exact: true }).click();
  await expect(viewer.getByText("4 / 19", { exact: true })).toBeVisible();
  await expect(viewer.getByRole("img", { name: /Бассейн и колесо обозрения вдали/ })).toBeVisible();
  await expect(viewer.locator(".photo-previous")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
});

test("категории отдают готовый HTML, админка исключена из индексации и карты сайта", async ({ request }) => {
  const detail = await request.get(sitePath("/номера/standard-dbl/"));
  expect(detail.ok()).toBeTruthy();
  const html = await detail.text();
  expect(html).toContain(">Стандарт DBL</h1>");
  expect(html).toMatch(/rel="canonical" href="https:\/\/troy-laz\.ru\/[^"]*standard-dbl\/"/);
  const home = await request.get(sitePath("/"));
  expect(await home.text()).toContain('"@type":"LodgingBusiness"');
  const admin = await request.get(sitePath("/admin/"));
  expect(admin.ok()).toBeTruthy();
  expect(await admin.text()).toContain('<meta name="robots" content="noindex, nofollow"');
  if (pagesDemo) {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"');
    expect(html).toMatch(/<form(?=[^>]*\binert)(?=[^>]*aria-label="Подбор номера")/);
  } else {
    expect(admin.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  }
  const sitemap = await request.get(sitePath("/sitemap.xml"));
  expect(await sitemap.text()).toContain("standard-dbl/");
  expect(await sitemap.text()).not.toContain("/admin");
});
