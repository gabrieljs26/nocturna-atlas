import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const date = "2026-12-15";
const andromeda = /M31.*Galaxia de Andrómeda/i;
const orion = /M42.*Nebulosa de Orión/i;

async function selectNight(page: Page, city: string, day: string) {
  await page.getByRole("combobox", { name: "Ciudad", exact: true }).selectOption(city);
  await page.getByLabel("Fecha de la noche", { exact: true }).fill(day);
}

test.describe("zona horaria distinta de la ciudad de observación", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("llega a Orión desde su ficha y cambia hora, ciudad y fecha", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", {
      name: "Ver ficha de Nebulosa de Orión",
      exact: true,
    }).click();
    await page.getByRole("dialog", { name: "Nebulosa de Orión" }).getByRole("link", {
      name: "Planificar observación",
    }).click();
    await expect(page).toHaveURL(/\/planificador\?objeto=m42$/);
    await expect(page.getByRole("heading", { level: 1, name: "Ruta de observación", exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: orion })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: andromeda })).not.toBeChecked();

    await selectNight(page, "madrid", date);
    const build = page.getByRole("button", { name: "Construir mi ruta", exact: true });
    await build.click();
    await expect(page.getByText(/Mejor ventana/i).first()).toBeVisible();
    const time = page.getByRole("slider", { name: "Hora de observación", exact: true });
    await time.press("Home");
    await expect(time).toHaveAttribute("aria-valuetext", /18:00/);
    const beginning = await time.getAttribute("aria-valuetext");
    await time.press("ArrowRight");
    await expect(time).not.toHaveAttribute("aria-valuetext", beginning ?? "");
    await time.press("End");
    await expect(time).toHaveAttribute("aria-valuetext", /06:00/);

    await selectNight(page, "tenerife", "2027-06-21");
    await expect(page.getByRole("combobox", { name: "Ciudad", exact: true })).toHaveValue("tenerife");
    await build.click();
    await expect(page.getByRole("heading", { name: "Esta noche no hay paradas" })).toBeVisible();
    await expect(page.getByText(/Sin ventana favorable/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar calendario (.ics)" })).toHaveCount(0);
  });
});

function utcTimestamp(value: string) {
  return Date.parse(value.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
    "$1-$2-$3T$4:$5:$6Z",
  ));
}

test("construye una ruta de varias paradas y descarga un calendario que conserva el orden", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Planificar mi noche", exact: true }).click();
  await expect(page).toHaveURL(/\/planificador$/);
  await expect(page.getByRole("checkbox", { name: andromeda })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: orion })).toBeChecked();
  await selectNight(page, "madrid", date);
  await page.getByRole("button", { name: "Construir mi ruta", exact: true }).click();

  const output = page.getByRole("region", { name: "Tu itinerario" });
  await expect(output.locator("time").first()).toHaveAttribute("datetime", date);
  const orderedTitles = await output.getByRole("heading", { level: 3 }).allTextContents();
  const downloading = page.waitForEvent("download");
  await output.getByRole("button", { name: "Descargar calendario (.ics)", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.ics$/i);
  const calendar = (await readFile(await download.path(), "utf8")).replace(/\r\n[ \t]/g, "");
  const events = [...calendar.matchAll(/BEGIN:VEVENT\r\n([\s\S]+?)END:VEVENT\r\n/g)];
  expect(events.length).toBeGreaterThanOrEqual(2);
  const summaries = events.map(([, event]) => /^SUMMARY:(.+)\r$/m.exec(event)?.[1]);
  expect(new Set(summaries).size).toBe(events.length);
  expect(summaries).toEqual(orderedTitles.map((title) => "Observar " + title));

  const stops = events.map(([, event]) => ({
    start: utcTimestamp(/^DTSTART:(.+Z)\r$/m.exec(event)?.[1] ?? ""),
    end: utcTimestamp(/^DTEND:(.+Z)\r$/m.exec(event)?.[1] ?? ""),
  }));
  stops.forEach(({ start, end }, index) => {
    expect(end - start).toBe(20 * 60_000);
    if (index > 0) {
      expect(start - stops[index - 1].end).toBeGreaterThanOrEqual(10 * 60_000);
    }
  });
});

test("puede seleccionar las paradas a partir de la lista de este navegador", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration|hydrated|server.rendered|did not match/i.test(message.text())) {
      errors.push(message.text());
    }
  });

  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Guardar Galaxia de Andrómeda", exact: true }).click();
    await expect(page.getByRole("button", {
      name: "Quitar Galaxia de Andrómeda de mi lista",
      exact: true,
    })).toBeVisible();
    await page.goto("/planificador", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Usar mi lista", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: andromeda })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: orion })).not.toBeChecked();
    await selectNight(page, "madrid", date);
    await page.getByRole("button", { name: "Construir mi ruta", exact: true }).click();
    const output = page.getByRole("region", { name: "Tu itinerario" });
    await expect(output.getByRole("heading", { level: 3 })).toHaveText("Galaxia de Andrómeda");
    expect(errors).toEqual([]);
  } finally {
    await page.request.put("/api/observaciones", { data: { objectId: "m31", saved: false } }).catch(() => undefined);
  }
});

test.describe("planificador en pantalla estrecha", () => {
  test.use({
    viewport: { width: 320, height: 720 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });

  test("la selección, los resultados y la gráfica caben a 320 píxeles", async ({ page }) => {
    await page.goto("/planificador?objeto=m42", { waitUntil: "domcontentloaded" });
    await selectNight(page, "madrid", date);
    const target = page.getByRole("checkbox", { name: orion });
    await target.focus();
    await expect(target).toBeFocused();
    await page.keyboard.press("Space");
    await expect(target).not.toBeChecked();
    await page.keyboard.press("Space");
    await expect(target).toBeChecked();

    await page.getByRole("button", { name: "Construir mi ruta", exact: true }).click();
    await expect(page.getByRole("button", { name: "Descargar calendario (.ics)", exact: true })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Hora de observación", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  });
});
