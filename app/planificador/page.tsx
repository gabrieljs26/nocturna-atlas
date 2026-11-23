import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { NightPlanner, type PlannerObject } from "@/components/night-planner";
import { getCatalog } from "@/lib/db";
import { currentDateInCity, observerCities, parseJ2000 } from "@/lib/planner";
import "./planner.css";

export const metadata: Metadata = {
  title: "Ruta de observación",
  description: "Construye una ruta de observación con objetos del catálogo Messier y llévala a tu calendario.",
};

type Query = { objeto?: string | string[] };

export default async function PlannerPage({ searchParams }: { searchParams: Promise<Query> }) {
  await connection();
  const [{ objeto }, catalog] = await Promise.all([
    searchParams,
    getCatalog().catch((error: unknown) => {
      console.error("Nocturna: error al cargar los objetivos de la ruta.", error instanceof Error ? error.message : error);
      return [];
    }),
  ]);
  const objects: PlannerObject[] = catalog.flatMap((object) => {
    const coordinates = parseJ2000(object.right_ascension, object.declination);
    return coordinates ? [{ id: object.id, title: object.title, coordinates }] : [];
  });
  const preselectedId = typeof objeto === "string" && objects.some(({ id }) => id === objeto) ? objeto : null;

  return (
    <div className="shell planner-page">
      <Link href="/#catalogo" className="back-link"><ArrowLeft size={17} aria-hidden="true" /> Volver al atlas</Link>
      <header className="planner-intro">
        <h1>Ruta de observación</h1>
        <p>Elige una noche y los objetos que quieres ver. Nocturna ordena las paradas según la oscuridad y la altura de cada objeto.</p>
      </header>
      {objects.length ? (
        <NightPlanner
          objects={objects}
          initialDate={currentDateInCity(observerCities[0])}
          preselectedId={preselectedId}
          unknownTarget={objeto !== undefined && !preselectedId}
        />
      ) : (
        <div className="planner-empty">
          <h2>El catálogo no está disponible</h2>
          <p>Necesitamos sus coordenadas para calcular la ruta.</p>
          <Link className="back-link" href="/planificador">Volver a intentar</Link>
        </div>
      )}
    </div>
  );
}
