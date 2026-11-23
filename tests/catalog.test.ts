import assert from "node:assert/strict";
import test from "node:test";
import {
  filterCatalog,
  normalizeSearch,
  parseObservationMutation,
  type CatalogObject,
} from "../lib/catalog.ts";

const objectDefaults = {
  constellation: "Orión",
  season: "Invierno",
  instrument: "Prismáticos",
  magnitude: 4,
  right_ascension: "05 h 35 m 17 s",
  declination: "−05° 23′ 28″",
  distance: "1.500 años luz",
  summary: "Resumen de ejemplo.",
  description: "Descripción de ejemplo.",
  observation_tip: "Consejo de ejemplo.",
  image_path: "/images/orion.webp",
  image_alt: "Gas iluminado en la nebulosa",
};

const catalog: CatalogObject[] = [
  {
    ...objectDefaults,
    id: "m42",
    title: "Nebulosa de Orión",
    category: "nebulosa",
    object_type: "Nebulosa de emisión",
  },
  {
    ...objectDefaults,
    id: "m31",
    title: "Galaxia de Andrómeda",
    category: "galaxia",
    object_type: "Galaxia espiral",
    constellation: "Andrómeda",
    season: "Otoño",
  },
];

test("normaliza espacios exteriores, mayúsculas y tildes compuestas o descompuestas", () => {
  assert.equal(normalizeSearch("  ORIÓN  "), "orion");
  assert.equal(normalizeSearch("ANDRO\u0301MEDA"), "andromeda");
});

test("la búsqueda combina palabras, variantes Messier y categoría", () => {
  const orion = catalog[0];
  assert.deepEqual(filterCatalog(catalog, "todos", "orion   INVieRNO"), [orion]);
  assert.deepEqual(filterCatalog(catalog, "nebulosa", "M 42"), [orion]);
  assert.deepEqual(filterCatalog(catalog, "nebulosa", "messier 42"), [orion]);
  assert.deepEqual(filterCatalog(catalog, "galaxia", "orion"), []);
  assert.deepEqual(filterCatalog(catalog, "todos", "desconocido"), []);
  assert.deepEqual(filterCatalog(catalog, "todos", "  "), catalog);
});

test("un identificador Messier completo distingue M3 de M31", () => {
  for (const search of ["M3", "M 3", "Messier 3"]) {
    assert.deepEqual(filterCatalog(catalog, "todos", search).map(({ id }) => id), []);
  }
});

test("solo acepta un identificador canónico y un booleano de guardado", () => {
  for (const payload of [
    null,
    [],
    {},
    { objectId: "M31", saved: true },
    { objectId: "m0", saved: true },
    { objectId: "m31\n", saved: true },
    { objectId: "m31", saved: "false" },
  ]) {
    assert.equal(parseObservationMutation(payload), null);
  }
  assert.deepEqual(parseObservationMutation({ objectId: "m31", saved: true }), { objectId: "m31", saved: true });
  assert.deepEqual(
    parseObservationMutation({ objectId: "m31", saved: false, guestId: "valor de entrada" }),
    { objectId: "m31", saved: false },
  );
});
