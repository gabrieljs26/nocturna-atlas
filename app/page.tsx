import { ArrowDown, Sparkles } from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { CatalogUnavailable, ObjectCollection } from "@/components/object-collection";
import { getCatalog } from "@/lib/db";

export default async function AtlasPage() {
  await connection();
  const objects = await getCatalog().catch((error: unknown) => {
    console.error("Nocturna: error al cargar el catálogo.", error instanceof Error ? error.message : error);
    return null;
  });

  return (
    <div className="shell atlas-page">
      <section className="hero" aria-labelledby="hero-title">
        <Image className="hero-image" src="/images/nocturna-hero.webp" alt="" fill sizes="(min-width: 1340px) 1260px, 96vw" preload />
        <div className="hero-content">
          <p className="eyebrow hero-eyebrow"><Sparkles size={15} aria-hidden="true" /> Atlas de observación astronómica</p>
          <h1 id="hero-title">El cielo,<br /><span>más cerca.</span></h1>
          <p className="hero-summary">Encuentra galaxias, nebulosas y cúmulos estelares. Guarda los que quieras observar en tu próxima noche bajo las estrellas.</p>
          <a href="#catalogo" className="action-button">
            Explorar catálogo <ArrowDown size={17} aria-hidden="true" />
          </a>
        </div>
        <span className="hero-caption">Vía Láctea · Ilustración</span>
      </section>
      <section className="catalog-section" id="catalogo" aria-labelledby="catalog-title">
        <div className="section-heading">
          <p className="eyebrow catalog-eyebrow">Catálogo Messier</p>
          <h2 id="catalog-title">Objetos de cielo profundo</h2>
          <p>Elige qué observar y consulta dónde encontrarlo y qué equipo usar.</p>
        </div>
        {objects ? <ObjectCollection objects={objects} /> : <CatalogUnavailable href="/" />}
      </section>
    </div>
  );
}
