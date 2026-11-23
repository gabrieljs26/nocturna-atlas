import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, Bookmark } from "lucide-react";
import { CatalogUnavailable, ObjectCollection } from "@/components/object-collection";
import { getCatalog } from "@/lib/db";

export const metadata: Metadata = { title: "Mi lista" };

export default async function ObservationList() {
  await connection();
  const objects = await getCatalog().catch((error: unknown) => {
    console.error("Nocturna: error al cargar el catálogo.", error instanceof Error ? error.message : error);
    return null;
  });

  return (
    <div className="shell observation-page">
      <Link className="back-link" href="/#catalogo">
        <ArrowLeft size={18} aria-hidden="true" /> Volver al atlas
      </Link>
      <section aria-labelledby="list-title">
        <div className="list-heading">
          <span className="list-heading-icon"><Bookmark size={25} aria-hidden="true" /></span>
          <h1 id="list-title">Mi lista</h1>
          <p>Tus próximos objetivos de observación. La lista se guarda en este navegador.</p>
        </div>
        {objects ? <ObjectCollection objects={objects} savedOnly /> : <CatalogUnavailable href="/mi-lista" />}
      </section>
    </div>
  );
}
