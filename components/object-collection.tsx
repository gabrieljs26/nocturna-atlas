"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Compass,
  Crosshair,
  Eye,
  Search,
  SlidersHorizontal,
  Telescope,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MutationNotice, ObservationError, SavedLabel, useObservations } from "@/components/observations";
import { categoryFilters, filterCatalog, type CatalogObject, type CategoryFilter } from "@/lib/catalog";

const magnitudeFormat = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1 });

function SaveButton({ object, full = false }: { object: CatalogObject; full?: boolean }) {
  const list = useObservations();
  const saved = list.objectIds.includes(object.id);
  const label = saved ? "Quitar " + object.title + " de mi lista" : "Guardar " + object.title;
  const unavailable = list.phase !== "ready" || list.pendingId !== null;

  return (
    <button
      type="button"
      className={full ? "action-button dialog-save" : "icon-button bookmark-button"}
      aria-label={label}
      aria-pressed={saved}
      aria-disabled={unavailable}
      aria-busy={list.pendingId === object.id || undefined}
      onClick={() => {
        if (!unavailable) void list.change({ objectId: object.id, title: object.title, saved: !saved });
      }}
    >
      {full && saved ? <SavedLabel /> : (
        <>
          <Bookmark size={full ? 18 : 19} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
          {full && "Guardar en mi lista"}
        </>
      )}
    </button>
  );
}

function ObjectCard({ object, open }: { object: CatalogObject; open: () => void }) {
  return (
    <article className="object-card">
      <div className="object-media">
        <Image
          src={object.image_path}
          alt={object.image_alt}
          fill
          sizes="(min-width: 1300px) 396px, (min-width: 1000px) 31vw, (min-width: 620px) 46vw, 92vw"
        />
        <span className="messier-code">{object.id.toUpperCase()}</span>
        <SaveButton object={object} />
      </div>
      <div className="object-copy">
        <p className={"object-type type-" + object.category}>{object.object_type}</p>
        <h3>{object.title}</h3>
        <p className="object-summary">{object.summary}</p>
        <div className="object-footer">
          <span className="object-constellation">
            <Compass size={15} aria-hidden="true" />{object.constellation}
          </span>
          <button type="button" className="details-button" aria-label={"Ver ficha de " + object.title} onClick={open}>
            Ver ficha <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

type ObjectSelection = { object: CatalogObject };

function ObjectDetail({ selection }: { selection: ObjectSelection }) {
  const { object } = selection;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.inert = false;
      dialog.showModal();
      closeRef.current?.focus();
    }
  }, [selection]);

  const sourceLink = "https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-" + object.id.slice(1) + "/";

  return (
    <dialog
      ref={dialogRef}
      className="object-dialog"
      aria-labelledby="object-title"
      onClose={(event) => {
        if (!event.currentTarget.open) event.currentTarget.inert = true;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="dialog-frame">
        <div className="dialog-media">
          <Image src={object.image_path} alt={object.image_alt} fill sizes="(min-width: 750px) 712px, 92vw" />
          <span className="messier-code">{object.id.toUpperCase()}</span>
          <button ref={closeRef} type="button" className="icon-button dialog-close" aria-label="Cerrar ficha" onClick={() => dialogRef.current?.close()}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="dialog-copy">
          <p className={"object-type type-" + object.category}>{object.object_type}</p>
          <h2 id="object-title">{object.title}</h2>
          <p className="dialog-description">{object.description}</p>
          <dl className="object-data">
            <div><dt>Constelación</dt><dd>{object.constellation}</dd></div>
            <div><dt>Distancia aprox.</dt><dd>{object.distance}</dd></div>
            <div><dt>Magnitud aparente</dt><dd>{magnitudeFormat.format(object.magnitude)}</dd></div>
            <div><dt>Ascensión recta</dt><dd>{object.right_ascension}</dd></div>
            <div><dt>Declinación</dt><dd>{object.declination}</dd></div>
            <div><dt>Época de coordenadas</dt><dd>J2000</dd></div>
          </dl>
          <div className="observing-tip">
            <h3><Telescope size={19} aria-hidden="true" /> Cómo observarlo</h3>
            <p>{object.observation_tip}</p>
            <ul className="observing-tags" aria-label="Orientación para la observación">
              <li><Eye size={15} aria-hidden="true" /> {object.instrument}</li>
              <li><CalendarDays size={15} aria-hidden="true" /> {object.season} en el hemisferio norte</li>
            </ul>
          </div>
          <div className="dialog-actions">
            <SaveButton object={object} full />
            <a className="details-button" href={sourceLink} target="_blank" rel="noreferrer">
              Ficha en NASA <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <MutationNotice inDialog />
        </div>
      </div>
    </dialog>
  );
}

export function ObjectCollection({ objects, savedOnly = false }: { objects: CatalogObject[]; savedOnly?: boolean }) {
  const [category, setCategory] = useState<CategoryFilter>("todos");
  const [query, setQuery] = useState("");
  // Keep the last selection mounted so the native dialog can transition out.
  const [selected, setSelected] = useState<ObjectSelection | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const allFilterRef = useRef<HTMLButtonElement>(null);
  const list = useObservations();
  const filtered = savedOnly
    ? list.objectIds.flatMap((id) => objects.filter((object) => object.id === id))
    : filterCatalog(objects, category, query);

  function reset() {
    setCategory("todos");
    setQuery("");
    allFilterRef.current?.focus();
  }

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  return (
    <>
      {!savedOnly && (
        <div className="catalog-controls">
          <div className="category-filters" role="group" aria-label="Categorías de objetos">
            {categoryFilters.map(({ value, label }) => (
              <button key={value} ref={value === "todos" ? allFilterRef : undefined} type="button" className="filter-button" aria-pressed={category === value} onClick={() => setCategory(value)}>
                {label}
              </button>
            ))}
          </div>
          <div className="catalog-search">
            <Search size={19} aria-hidden="true" />
            <input ref={searchRef} aria-label="Buscar objetos" type="search" value={query} maxLength={100} placeholder="Buscar por nombre o número…" onChange={(event) => setQuery(event.target.value)} />
            {query && (
              <button className="icon-button search-clear" type="button" aria-label="Borrar búsqueda" onClick={clearSearch}>
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
      <ObservationError />
      {savedOnly && list.phase === "loading" && <p className="list-loading" role="status">Cargando tu lista…</p>}
      {(!savedOnly || list.phase === "ready") && (
        <>
          <p className="result-count" role="status">
            <span className="result-count-value" key={filtered.map(({ id }) => id).join(",")}>
              {filtered.length + (filtered.length === 1 ? " objeto" : " objetos") + (savedOnly ? (filtered.length === 1 ? " guardado" : " guardados") : "")}
            </span>
          </p>
          {filtered.length > 0 ? (
            <div className="object-grid">
              {filtered.map((object) => <ObjectCard key={object.id} object={object} open={() => setSelected({ object })} />)}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">
                {savedOnly ? <Bookmark size={28} aria-hidden="true" /> : <Crosshair size={28} aria-hidden="true" />}
              </span>
              <h3>{savedOnly ? "Tu lista está vacía" : "Sin resultados"}</h3>
              <p>{savedOnly ? "Guarda desde el atlas los objetos que quieras observar." : "Prueba otro nombre, número Messier o categoría."}</p>
              {savedOnly ? (
                <Link href="/#catalogo" className="action-button">Explorar catálogo <ArrowRight size={18} aria-hidden="true" /></Link>
              ) : (
                <button type="button" className="action-button action-secondary" onClick={reset}>
                  <SlidersHorizontal size={17} aria-hidden="true" /> Restablecer filtros
                </button>
              )}
            </div>
          )}
        </>
      )}
      {selected && <ObjectDetail selection={selected} />}
    </>
  );
}

export function CatalogUnavailable({ href }: { href: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Telescope size={28} aria-hidden="true" /></span>
      <h3>El catálogo no está disponible</h3>
      <p>No hemos podido cargar los objetos. Inténtalo en unos instantes.</p>
      <a href={href} className="action-button action-secondary">Volver a cargar <ArrowDownRight size={18} aria-hidden="true" /></a>
    </div>
  );
}
