import { expect, test, type Locator, type Page } from "@playwright/test";

const andromeda = "Galaxia de Andrómeda";
const orion = "Nebulosa de Orión";
const bookmarks = "/api/observaciones";

function title(page: Page, name: string) {
  return page.getByRole("heading", { level: 3, name, exact: true });
}

function save(scope: Page | Locator, name: string) {
  return scope.getByRole("button", { name: "Guardar " + name, exact: true });
}

function remove(scope: Page | Locator, name: string) {
  return scope.getByRole("button", { name: "Quitar " + name + " de mi lista", exact: true });
}

function failNextBookmarkMutation(page: Page) {
  let failNextSave = true;
  return page.route("**/api/observaciones", (route) => {
    if (failNextSave && route.request().method() === "PUT") {
      failNextSave = false;
      return route.fulfill({
        status: 503,
        json: { error: "La lista no está disponible ahora mismo." },
      });
    }
    return route.continue();
  });
}

test("una sesión limpia puede abrir y filtrar el catálogo público", async ({ baseURL, context, page }) => {
  expect(await context.cookies()).toEqual([]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(new URL("/", baseURL).href);
  await expect(page.getByRole("heading", { level: 1, name: /El cielo, más cerca/i })).toBeVisible();
  await expect(title(page, andromeda)).toBeVisible();
  await expect(title(page, orion)).toBeVisible();

  await page.getByRole("link", { name: "Explorar catálogo", exact: true }).click();
  await expect(page).toHaveURL(/#catalogo$/);

  const galaxies = page.getByRole("button", { name: "Galaxias", exact: true });
  await galaxies.click();
  await expect(galaxies).toHaveAttribute("aria-pressed", "true");
  await expect(title(page, andromeda)).toBeVisible();
  await expect(title(page, orion)).toHaveCount(0);

  const search = page.getByRole("searchbox", { name: "Buscar objetos" });
  await search.fill("orion");
  await expect(title(page, orion)).toHaveCount(0);

  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await expect(title(page, orion)).toBeVisible();
  await expect(title(page, andromeda)).toHaveCount(0);
  await search.fill("Orión");
  await expect(title(page, orion)).toBeVisible();

  await search.fill("M3");
  await expect(title(page, andromeda)).toHaveCount(0);
  await search.fill("Messier 31");
  await expect(title(page, andromeda)).toBeVisible();

  await search.fill("este-objeto-no-existe");
  await expect(title(page, orion)).toHaveCount(0);
  await expect(
    page.getByText(/(?:sin resultados|no (?:hemos )?encontrado|no encontramos|no hay (?:ningún )?objeto)/i).first(),
  ).toBeVisible();
  await search.clear();
  await expect(title(page, andromeda)).toBeVisible();
  expect(errors).toEqual([]);
});

test("cada visitante tiene una lista persistente e independiente", async ({ baseURL, browser, page }) => {
  const otherVisitor = await browser.newContext({ baseURL });
  try {
    await page.goto("/");
    await save(page, andromeda).click();
    await expect(remove(page, andromeda)).toBeVisible();
    const guestCookie = (await page.context().cookies()).find((cookie) => cookie.name === "nocturna_guest");
    expect(guestCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    if (baseURL?.startsWith("https:")) {
      expect(guestCookie?.secure).toBe(true);
    }
    await page.getByRole("link", { name: /Mi lista/i }).click();
    await expect(page).toHaveURL(/\/mi-lista\/?$/);
    await expect(title(page, andromeda)).toBeVisible();
    await page.reload();
    await expect(title(page, andromeda)).toBeVisible();

    const otherPage = await otherVisitor.newPage();
    await otherPage.goto("/mi-lista");
    await expect(title(otherPage, andromeda)).toHaveCount(0);
    const otherList = await otherVisitor.request.get(bookmarks);
    expect(otherList.ok()).toBe(true);
    expect(await otherList.json()).toEqual({ objectIds: [] });

    await remove(page, andromeda).click();
    await expect(title(page, andromeda)).toHaveCount(0);
    await page.reload();
    await expect(title(page, andromeda)).toHaveCount(0);
    const remaining = await page.request.get(bookmarks);
    expect(remaining.ok()).toBe(true);
    expect(await remaining.json()).toEqual({ objectIds: [] });
  } finally {
    await page.request.put(bookmarks, { data: { objectId: "m31", saved: false } }).catch(() => undefined);
    await otherVisitor.close();
  }
});

test("un fallo al guardar conserva el estado y permite volver a intentarlo", async ({ page }) => {
  await failNextBookmarkMutation(page);

  try {
    await page.goto("/");
    await save(page, andromeda).click();
    const notice = page.getByRole("alert").filter({ hasText: /guardar|lista|intentar/i });
    await expect(notice).toBeVisible();
    await expect(save(page, andromeda)).toBeEnabled();

    await notice.getByRole("button", { name: "Reintentar" }).click();
    await expect(remove(page, andromeda)).toBeVisible();
    await expect(notice).toHaveCount(0);
    await remove(page, andromeda).click();
    await expect(save(page, andromeda)).toBeVisible();
  } finally {
    await page.request.put(bookmarks, { data: { objectId: "m31", saved: false } }).catch(() => undefined);
  }
});

test("la ficha ofrece un reintento accesible si falla el guardado", async ({ page }) => {
  await failNextBookmarkMutation(page);

  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Ver ficha de " + andromeda, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: andromeda });
    await save(dialog, andromeda).click();
    const notice = dialog.getByRole("alert").filter({ hasText: /guardar|lista|intentar/i });
    await expect(notice).toBeVisible();

    await notice.getByRole("button", { name: "Reintentar" }).click();
    await expect(remove(dialog, andromeda)).toBeVisible();
    await expect(notice).toHaveCount(0);
  } finally {
    await page.request.put(bookmarks, { data: { objectId: "m31", saved: false } }).catch(() => undefined);
  }
});

test("las mutaciones validan la entrada y son idempotentes", async ({ baseURL, request }) => {
  const validSave = { objectId: "m31", saved: true };
  const validRemove = { objectId: "m31", saved: false };
  const noSession = await request.put(bookmarks, {
    headers: { Origin: new URL("/", baseURL).origin, "Sec-Fetch-Site": "same-origin" },
    data: validSave,
  });
  expect(noSession.status()).toBe(409);

  const emptyList = await request.get(bookmarks);
  expect(emptyList.ok()).toBe(true);
  expect(emptyList.headers()["cache-control"]).toContain("no-store");
  expect(await emptyList.json()).toEqual({ objectIds: [] });

  try {
    const foreignOrigin = await request.put(bookmarks, {
      headers: { Origin: "https://example.com" },
      data: validSave,
    });
    expect(foreignOrigin.status()).toBe(403);

    const malformed = await request.put(bookmarks, {
      headers: { "Content-Type": "application/json" },
      data: "{",
    });
    expect(malformed.status()).toBe(400);
    const invalidType = await request.put(bookmarks, { data: { objectId: "m31", saved: "true" } });
    expect(invalidType.status()).toBe(400);
    const missingTarget = await request.put(bookmarks, { data: { objectId: "m999", saved: true } });
    expect(missingTarget.status()).toBe(404);

    const savedUpdates = await Promise.all([
      request.put(bookmarks, { data: validSave }),
      request.put(bookmarks, { data: validSave }),
    ]);
    for (const update of savedUpdates) {
      expect(update.ok()).toBe(true);
      expect(await update.json()).toEqual(validSave);
    }
    const savedList = await request.get(bookmarks);
    expect(await savedList.json()).toEqual({ objectIds: ["m31"] });

    const removedUpdates = await Promise.all([
      request.put(bookmarks, { data: validRemove }),
      request.put(bookmarks, { data: validRemove }),
    ]);
    for (const update of removedUpdates) {
      expect(update.ok()).toBe(true);
      expect(await update.json()).toEqual(validRemove);
    }
    const finalList = await request.get(bookmarks);
    expect(await finalList.json()).toEqual({ objectIds: [] });
  } finally {
    await request.put(bookmarks, { data: validRemove }).catch(() => undefined);
  }
});

test("la luz roja se conserva al recargar y se puede desactivar", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const document = page.locator("html");
  const light = page.getByRole("button", { name: "Luz roja", exact: true });
  await expect(document).not.toHaveAttribute("data-light", "red");
  await light.click();
  await expect(light).toHaveAttribute("aria-pressed", "true");
  await expect(document).toHaveAttribute("data-light", "red");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(document).toHaveAttribute("data-light", "red");
  await expect(light).toHaveAttribute("aria-pressed", "true");
  await light.click();
  await expect(document).not.toHaveAttribute("data-light", "red");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(light).toHaveAttribute("aria-pressed", "false");
  await expect(document).not.toHaveAttribute("data-light", "red");
});

test.describe("pantalla estrecha", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("la ficha se abre con teclado, restaura el foco y cabe en el viewport", async ({ page }) => {
    await page.goto("/");
    await expect(title(page, orion)).toBeVisible();
    const search = page.getByRole("searchbox", { name: "Buscar objetos" });
    await search.focus();
    await expect(search).toBeFocused();
    await page.keyboard.type("orion");
    await expect(title(page, andromeda)).toHaveCount(0);

    const details = page.getByRole("button", { name: "Ver ficha de " + orion, exact: true });
    await details.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: orion });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cerrar ficha" })).toBeVisible();
    await expect(dialog.getByText(/(?:ascensión recta|declinación)/i).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(details).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 320, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
    try {
      await save(page, orion).click();
      await expect(page.getByRole("link", { name: "Mi lista" }).locator(".nav-count")).toHaveText("1");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
    } finally {
      await page.request.put(bookmarks, { data: { objectId: "m42", saved: false } }).catch(() => undefined);
    }
  });
});
