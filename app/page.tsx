import { ArrowDown, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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
        <div className="hero-photograph">
          <Image className="hero-image" src="/images/paranal.webp" alt="" fill sizes="(min-width: 1340px) 1000px, (min-width: 620px) 76vw, 100vw" preload />
        </div>
        <div className="hero-content">
          <p className="eyebrow hero-eyebrow">Atlas de observación astronómica</p>
          <h1 id="hero-title">El cielo,<br /><span>más cerca.</span></h1>
          <p className="hero-summary">Encuentra las mejores horas para observar tus objetos favoritos y lleva la ruta a tu calendario.</p>
          <div className="hero-actions">
            <Link href="/planificador" className="action-button hero-plan">
              Planificar mi noche <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <a href="#catalogo" className="hero-catalog-link">
              Explorar catálogo <ArrowDown size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="hero-caption">
          <span>Observatorio Paranal, Chile</span>
          <a href="https://www.eso.org/public/images/potw1517a/" target="_blank" rel="noreferrer">ESO/J. Colosimo</a>
        </div>
      </section>
      <section className="catalog-section" id="catalogo" tabIndex={-1} aria-labelledby="catalog-title">
        <div className="section-heading">
          <p className="eyebrow catalog-eyebrow">Catálogo Messier</p>
          <h2 id="catalog-title">Objetos de cielo profundo</h2>
        </div>
        {objects ? <ObjectCollection objects={objects} /> : <CatalogUnavailable href="/" />}
      </section>
    </div>
  );
}
