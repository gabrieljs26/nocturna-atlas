"use client";

import {
  ArrowDownRight,
  CalendarPlus,
  Clock3,
  Compass,
  MapPin,
  Route,
} from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useObservations } from "@/components/observations";
import { buildNightRoute, nightRouteCalendar } from "@/lib/night-route";
import {
  calculateNightPlan,
  compassDirection,
  DARK_SUN_ALTITUDE,
  NIGHT_MAX_DATE,
  NIGHT_MIN_DATE,
  observerCities,
  TARGET_ALTITUDE,
  type EquatorialPosition,
  type NightPlan,
  type ObserverCity,
} from "@/lib/planner";

export type PlannerObject = { id: string; title: string; coordinates: EquatorialPosition };
type PlanConfiguration = { city: ObserverCity; date: string; ids: string[] };
type ChartSelection = { id: string; instant?: number };

const clockFormat = (city: ObserverCity, includeOffset = false) => new Intl.DateTimeFormat("es-ES", {
  timeZone: city.timeZone,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  ...(includeOffset ? { timeZoneName: "shortOffset" } : {}),
});
const dateFormat = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" });
const chartWidth = 780;
const chartHeight = 260;
const chartFloor = -30;
const chartCeiling = 90;
const altitudeTicks = [90, 60, 25, 0, -30];
const formatDegrees = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const degrees = (value: number) => formatDegrees.format(value) + "°";
const bearing = (value: number) => Math.round(value) % 360;
// Serialize visible geometry at display precision across Node and browser math engines.
const chartCoordinate = (value: number) => Number(value.toFixed(2));

function positionOfAltitude(altitude: number) {
  return chartCoordinate((chartCeiling - altitude) / (chartCeiling - chartFloor) * chartHeight);
}

function NightChart({ plan, city, initialInstant }: { plan: NightPlan; city: ObserverCity; initialInstant?: number }) {
  const [pointIndex, setPointIndex] = useState(() => {
    if (initialInstant === undefined) return plan.peakIndex;
    const index = plan.samples.findIndex(({ timeMs }) => timeMs >= initialInstant);
    return index === -1 ? plan.peakIndex : index;
  });
  const sample = plan.samples[pointIndex];
  const formatClock = clockFormat(city, plan.endMs - plan.startMs !== 12 * 3_600_000);
  const xAt = (instant: number) => chartCoordinate((instant - plan.startMs) / (plan.endMs - plan.startMs) * chartWidth);
  const altitudePath = plan.samples.map((point, index) => (
    (index === 0 ? "M" : "L") + xAt(point.timeMs) + " " + positionOfAltitude(point.altitude)
  )).join(" ");
  const axisClock = clockFormat(city);
  const tickClocks = [0, 0.25, 0.5, 0.75, 1].map((factor) => (
    axisClock.format(plan.startMs + (plan.endMs - plan.startMs) * factor)
  ));
  const markerTop = chartCoordinate(Math.min(chartHeight, positionOfAltitude(sample.altitude)) / chartHeight * 100);
  const formatWindow = (start: number, end: number) => formatClock.format(start) + "–" + formatClock.format(end);
  const daylight = sample.sunAltitude > 0 ? "luz diurna"
    : sample.sunAltitude <= DARK_SUN_ALTITUDE ? "noche astronómica"
    : "crepúsculo";
  const sampleReading = formatClock.format(sample.timeMs) + ", " + degrees(sample.altitude) + ", " + compassDirection(sample.azimuth) + ", " + daylight;

  return (
    <>
      <p className="planner-window">
        {plan.bestWindow
          ? <><strong>Mejor ventana</strong> <span>{formatWindow(plan.bestWindow.startMs, plan.bestWindow.endMs)}</span></>
          : <strong>Sin ventana favorable</strong>}
      </p>
      <div className="planner-chart">
        <div className="planner-chart-vertical" aria-hidden="true">
          {altitudeTicks.map((altitude) => <span key={altitude} style={{ top: chartCoordinate(positionOfAltitude(altitude) / chartHeight * 100) + "%" }}>{altitude}°</span>)}
        </div>
        <div className="planner-graph">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true">
            {plan.horizonWindows.map((window) => (
              <rect key={window.startMs} className="planner-twilight" x={xAt(window.startMs)} y="0"
                width={chartCoordinate(xAt(window.endMs) - xAt(window.startMs))} height={chartHeight} />
            ))}
            {plan.darkWindows.map((window) => (
              <rect key={window.startMs} className="planner-darkness" x={xAt(window.startMs)} y="0"
                width={chartCoordinate(xAt(window.endMs) - xAt(window.startMs))} height={chartHeight} />
            ))}
            {altitudeTicks.map((altitude) => (
              <line key={altitude} className={altitude === TARGET_ALTITUDE ? "planner-threshold" : "planner-gridline"}
                x1="0" y1={positionOfAltitude(altitude)} x2={chartWidth} y2={positionOfAltitude(altitude)} vectorEffect="non-scaling-stroke" />
            ))}
            <path className="planner-altitude" d={altitudePath} vectorEffect="non-scaling-stroke" />
            <line className="planner-cursor" x1={xAt(sample.timeMs)} y1="0" x2={xAt(sample.timeMs)} y2={chartHeight} vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="planner-chart-marker" aria-hidden="true" style={{
            left: chartCoordinate(xAt(sample.timeMs) / chartWidth * 100) + "%",
            top: markerTop + "%",
          }} />
        </div>
        <div className="planner-chart-times" aria-hidden="true">
          {tickClocks.map((clock, index) => <span key={index}>{clock}</span>)}
        </div>
      </div>
      <div className="planner-graph-key" aria-hidden="true">
        <span><i className="altitude-key" /> Altura del objeto</span>
        <span><i className="twilight-key" /> Crepúsculo</span>
        <span><i className="darkness-key" /> Noche astronómica</span>
      </div>
      <div className="planner-chart-reading">
        <div>
          <label htmlFor="planner-time">Hora de observación</label>
          <input id="planner-time" type="range" min="0" max={plan.samples.length - 1} value={pointIndex}
            aria-valuetext={sampleReading} onChange={(event) => setPointIndex(Number(event.target.value))} />
        </div>
        <p><time dateTime={new Date(sample.timeMs).toISOString()}>{formatClock.format(sample.timeMs)}</time>
          <span>{degrees(sample.altitude)} · {compassDirection(sample.azimuth)} · {daylight}</span>
        </p>
      </div>
    </>
  );
}

export function NightPlanner({ objects, initialDate, preselectedId, unknownTarget }: {
  objects: PlannerObject[];
  initialDate: string;
  preselectedId: string | null;
  unknownTarget: boolean;
}) {
  const observations = useObservations();
  const [draft, setDraft] = useState<PlanConfiguration>(() => ({
    city: observerCities[0],
    date: initialDate,
    ids: preselectedId ? [preselectedId] : objects.map(({ id }) => id),
  }));
  const [configuration, setConfiguration] = useState(draft);
  const [chartSelection, setChartSelection] = useState<ChartSelection | null>(null);
  const itineraryHeading = useRef<HTMLHeadingElement>(null);

  const plans = useMemo(() => configuration.ids.flatMap((id) => {
    const object = objects.find((target) => target.id === id);
    if (!object) return [];
    const plan = calculateNightPlan(object.coordinates, configuration.city, configuration.date);
    return plan ? [{ ...object, plan }] : [];
  }), [configuration, objects]);

  const route = useMemo(() => buildNightRoute(plans.map(({ id, title, plan }) => ({
    id,
    title,
    points: plan.samples.map(({ timeMs: time, altitude, azimuth, sunAltitude }) => ({ time, altitude, azimuth, sunAltitude })),
  }))), [plans]);

  const routeStopIds = new Set(route.map(({ id }) => id));
  const unplaced = plans.filter(({ id }) => !routeStopIds.has(id));
  const chartObject = plans.find(({ id }) => id === (chartSelection?.id ?? route[0]?.id)) ?? plans[0];
  const hasDraftChanges = draft.city.id !== configuration.city.id ||
    draft.date !== configuration.date ||
    draft.ids.length !== configuration.ids.length ||
    draft.ids.some((id) => !configuration.ids.includes(id));
  const transitionNight = chartObject && chartObject.plan.endMs - chartObject.plan.startMs !== 12 * 3_600_000;
  const formatClock = clockFormat(configuration.city, transitionNight);
  const hasBookmarks = objects.some(({ id }) => observations.objectIds.includes(id));

  function toggleTarget(id: string) {
    setDraft((previous) => ({
      ...previous,
      ids: previous.ids.includes(id) ? previous.ids.filter((selected) => selected !== id) : [...previous.ids, id],
    }));
  }

  function build(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.ids.length) return;

    setConfiguration(draft);
    setChartSelection(null);
    itineraryHeading.current?.focus();
  }

  function downloadCalendar() {
    const file = new Blob([nightRouteCalendar(route, configuration.city.name)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const download = document.createElement("a");
    download.href = url;
    download.download = "nocturna-" + configuration.date + ".ics";
    document.body.append(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="planner-layout">
      <form className="planner-form" onSubmit={build}>
        <div className="planner-form-inputs">
          <label htmlFor="planner-city">Ciudad</label>
          <select id="planner-city" value={draft.city.id} onChange={(event) => {
            const city = observerCities.find(({ id }) => id === event.target.value);
            if (city) setDraft((previous) => ({ ...previous, city }));
          }}>
            {observerCities.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
          <label htmlFor="planner-date">Fecha de la noche</label>
          <input id="planner-date" type="date" min={NIGHT_MIN_DATE} max={NIGHT_MAX_DATE} required value={draft.date}
            onChange={(event) => setDraft((previous) => ({ ...previous, date: event.target.value }))} />
        </div>
        <fieldset className="planner-targets">
          <legend>Objetos que quieres observar</legend>
          {unknownTarget && <p className="planner-notice" role="status">El objeto solicitado no está en el catálogo.</p>}
          <div className="planner-target-list">
            {objects.map(({ id, title }) => (
              <label key={id} className="planner-target">
                <input type="checkbox" checked={draft.ids.includes(id)} onChange={() => toggleTarget(id)} />
                <span><span className="planner-target-code">{id.toUpperCase()}</span>
                  <span className="sr-only"> · </span>{title}</span>
              </label>
            ))}
          </div>
          <button type="button" className="inline-button planner-use-list" disabled={observations.phase !== "ready" || !hasBookmarks}
            onClick={() => setDraft((previous) => ({ ...previous, ids: objects.filter(({ id }) => observations.objectIds.includes(id)).map(({ id }) => id) }))}>
            Usar mi lista
          </button>
          {observations.phase === "ready" && !hasBookmarks && <p className="planner-hint">Aún no tienes objetos en tu lista.</p>}
        </fieldset>
        <button type="submit" className="action-button planner-submit" disabled={!draft.ids.length}>
          <Route size={18} aria-hidden="true" /> Construir mi ruta
        </button>
        {!draft.ids.length && <p className="planner-hint">Elige al menos un objeto.</p>}
        {hasDraftChanges && draft.ids.length > 0 && <p className="planner-hint">Construye la ruta para aplicar los cambios.</p>}
      </form>
      <div className="planner-output">
        <section className="planner-route" aria-labelledby="planner-route-heading">
          <div className="planner-output-heading">
            <div>
              <h2 id="planner-route-heading" ref={itineraryHeading} tabIndex={-1}>Tu itinerario</h2>
              <p><MapPin size={15} aria-hidden="true" /> {configuration.city.name} <span aria-hidden="true">·</span> <time dateTime={configuration.date}>{dateFormat.format(new Date(configuration.date + "T12:00:00Z"))}</time></p>
            </div>
            {route.length > 0 && (
              <button className="planner-calendar" type="button" onClick={downloadCalendar}>
                <CalendarPlus size={18} aria-hidden="true" /> Descargar calendario (.ics)
              </button>
            )}
          </div>
          {route.length > 0 ? (
            <>
              <p className="planner-route-count" role="status">
                {route.length === 1 ? "1 parada" : route.length + " paradas"} · Hora local
              </p>
              <ol className="planner-stops">
                {route.map((stop, index) => (
                  <li key={stop.id} className="planner-stop">
                    <span className="planner-stop-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <div className="planner-stop-time">
                      <time dateTime={new Date(stop.start).toISOString()}>{formatClock.format(stop.start)}</time>
                      <span>hasta <time dateTime={new Date(stop.end).toISOString()}>{formatClock.format(stop.end)}</time></span>
                    </div>
                    <div className="planner-stop-target">
                      <h3>{stop.title}</h3>
                      <p><Compass size={15} aria-hidden="true" /> {compassDirection(stop.azimuth)} {degrees(bearing(stop.azimuth))} <span aria-hidden="true">·</span> {degrees(stop.altitude)} de altura al empezar</p>
                    </div>
                    <a className="details-button planner-stop-link" href="#grafica" aria-label={"Ver " + stop.title + " en la gráfica"}
                      onClick={() => setChartSelection({ id: stop.id, instant: stop.start })}>
                      <ArrowDownRight size={19} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <div className="planner-empty" role="status">
              <h3>Esta noche no hay paradas</h3>
              <p>Prueba otra noche, otra ciudad o una selección diferente de objetos.</p>
            </div>
          )}
          {unplaced.length > 0 && route.length > 0 && (
            <p className="planner-unplaced"><strong>Sin parada</strong> {unplaced.map(({ title }) => title).join(", ")}.</p>
          )}
          <p className="planner-method">
            <Clock3 size={16} aria-hidden="true" />
            <span>Paradas de 20 min y al menos 10 min entre ellas. Se calcula de 18:00 a 06:00, con objetos a {TARGET_ALTITUDE}° o más y el Sol a {DARK_SUN_ALTITUDE}° o menos. La Luna, el tiempo y los obstáculos pueden cambiar lo que veas.</span>
          </p>
        </section>
        {chartObject && (
          <section id="grafica" tabIndex={-1} aria-labelledby="planner-chart-heading" className="planner-chart-section">
            <div className="planner-chart-heading">
              <h2 id="planner-chart-heading">Altura durante la noche</h2>
              <div className="planner-chart-selector">
                <label htmlFor="planner-chart-target">Objeto en la gráfica</label>
                <select id="planner-chart-target" value={chartObject.id} onChange={(event) => setChartSelection({ id: event.target.value })}>
                  {plans.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
                </select>
              </div>
            </div>
            <NightChart
              key={[configuration.city.id, configuration.date, chartObject.id, chartSelection?.instant].join("-")}
              plan={chartObject.plan}
              city={configuration.city}
              initialInstant={chartSelection?.instant}
            />
          </section>
        )}
      </div>
    </div>
  );
}
