export type Category = "galaxia" | "nebulosa" | "cumulo";

export type CatalogObject = {
  id: string;
  title: string;
  category: Category;
  object_type: string;
  constellation: string;
  season: string;
  instrument: string;
  magnitude: number;
  right_ascension: string;
  declination: string;
  distance: string;
  summary: string;
  description: string;
  observation_tip: string;
  image_path: string;
  image_alt: string;
};

export const categoryFilters = [
  { value: "todos", label: "Todos" },
  { value: "galaxia", label: "Galaxias" },
  { value: "nebulosa", label: "Nebulosas" },
  { value: "cumulo", label: "Cúmulos" },
] as const;

export type CategoryFilter = (typeof categoryFilters)[number]["value"];

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function filterCatalog(
  objects: CatalogObject[],
  category: CategoryFilter,
  query: string,
) {
  const normalized = normalizeSearch(query);
  const exactMessier = /^m(?:essier)?[\s-]*([1-9]\d{0,2})$/.exec(normalized);
  const words = normalized.split(/\s+/).filter(Boolean);

  return objects.filter((object) => {
    if (category !== "todos" && object.category !== category) return false;
    if (exactMessier) return object.id === "m" + exactMessier[1];

    const messierNumber = object.id.slice(1);
    const content = normalizeSearch([
      object.title,
      object.object_type,
      object.constellation,
      object.season,
      object.instrument,
      object.id,
      "M " + messierNumber,
      "Messier " + messierNumber,
    ].join(" "));

    return words.every((word) => content.includes(word));
  });
}

export type ObservationMutation = { objectId: string; saved: boolean };

export function parseObservationMutation(input: unknown): ObservationMutation | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;

  const { objectId, saved } = input as Record<string, unknown>;
  if (typeof objectId !== "string" || !/^m[1-9]\d{0,2}$/.test(objectId)) return null;
  if (typeof saved !== "boolean") return null;

  return { objectId, saved };
}
