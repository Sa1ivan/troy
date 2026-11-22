import { expect, test } from "@playwright/test";

const basePath = new URL(process.env.TROY_TEST_URL ?? "http://localhost").pathname.replace(/\/$/, "");
const path = (value: string) => encodeURI(basePath + value);

test("на первом экране видны бассейн и подбор номера, ниже можно рассмотреть фасад", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(path("/"));
  const banner = page.getByRole("region", { name: "Гостевой дом «Троя»", exact: true });
  const panorama = banner.getByRole("img", { name: /Бассейн.*крыше/ });
  await expect(panorama).toBeInViewport({ ratio: 0.8 });
  await expect(banner.getByRole("button", { name: "Найти номер" })).toBeInViewport();
  const bounds = await panorama.boundingBox();
  expect(bounds!.width / bounds!.height).toBeGreaterThan(2);
  const facade = page.getByRole("img", { name: "Фасад гостевого дома «Троя» в Лазаревском" });
  await expect(facade).not.toBeInViewport();
  await expect(page.getByRole("link", { name: "Открыть на карте" })).toHaveAttribute("href", "https://yandex.ru/maps/org/troya/1214414623/");
});

test("мобильная шапка даёт позвонить, вход сотрудников доступен из подвала", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(path("/"));
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: /Позвонить/ })).toBeInViewport();
  await expect(header.getByRole("link", { name: /Позвонить/ })).toHaveAttribute("href", "tel:+79384008046");
  await expect(header.getByRole("link", { name: /Войти/ })).toHaveCount(0);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Вход для сотрудников" })).toHaveAttribute("href", path("/admin/"));
});

test("лента фотографий имеет компактные изображения и одну остановку Tab", async ({ page }) => {
  await page.goto(path("/фото/"));
  const strip = page.getByRole("toolbar", { name: "Фотографии подборки" });
  const buttons = strip.getByRole("button");
  await expect(buttons).toHaveCount(19);
  await expect(strip.locator('button[tabindex="0"]')).toHaveCount(1);
  const preview = buttons.first().locator("img");
  await expect(preview).toHaveAttribute("src", /\/images\/thumbs\/hotel\/pool\/14\.webp$/);
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(152);
  await expect(buttons.first()).toHaveAccessibleName(/бассейн/i);
  await buttons.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(buttons.nth(1)).toBeFocused();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("End");
  await expect(buttons.last()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await strip.evaluate((element) => element.contains(document.activeElement))).toBe(false);
});

test("адрес открывает карточку отеля, пересказы ссылаются на оригинальные отзывы", async ({ page }) => {
  await page.goto(path("/контакт/"));
  await expect(page.getByRole("link", { name: "Открыть на карте" })).toHaveAttribute("href", "https://yandex.ru/maps/org/troya/1214414623/");
  await page.goto(path("/отзывы/"));
  await expect(page.getByText(/Краткие пересказы/)).toBeVisible();
  for (const id of [184, 181, 107, 105, 71, 70]) {
    const original = page.locator("#comment-" + id).getByRole("link", { name: /Читать оригинал/ });
    await expect(original).toHaveAttribute("href", "https://troy-laz.ru/отзывы/#comment-" + id);
  }
});
