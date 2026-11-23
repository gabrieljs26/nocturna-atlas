import assert from "node:assert/strict";
import test from "node:test";
import { buildNightRoute, nightRouteCalendar, type RouteTarget } from "../lib/night-route.ts";

const minute = 60_000;
const evening = Date.parse("2026-12-15T23:50:00Z");

function target(
  id: string,
  windows: readonly (readonly [start: number, end: number, altitude: number])[],
  sampleTimes = Array.from({ length: 17 }, (_, index) => index * 5),
): RouteTarget {
  return {
    id,
    title: "Objeto " + id,
    points: sampleTimes.map((offset) => ({
      time: evening + offset * minute,
      altitude: windows.find(([start, end]) => offset >= start && offset <= end)?.[2] ?? -5,
      azimuth: 73,
      sunAltitude: -21,
    })),
  };
}

test("optimiza toda la ruta cuando la parada más alta bloquearía dos objetivos", () => {
  const early = target("m31", [[0, 20, 36]]);
  const tempting = target("m42", [[15, 35, 83]]);
  const late = target("m45", [[30, 50, 37]]);
  const route = buildNightRoute([late, tempting, early]);

  assert.deepEqual(route.map(({ id, start, end }) => [id, start, end]), [
    ["m31", evening, evening + 20 * minute],
    ["m45", evening + 30 * minute, evening + 50 * minute],
  ]);
  assert.equal(route[1].start - route[0].end, 10 * minute);
  assert.equal(route[0].altitude, 36);
  assert.equal(route[0].azimuth, 73);
});

test("usa cada objeto una vez y desempata por elevación media y luego por inicio", () => {
  const twice = target("m31", [[0, 20, 42], [60, 80, 75]]);
  const middle = target("m45", [[30, 50, 60]]);
  const route = buildNightRoute([twice, middle]);
  assert.deepEqual(route.map(({ id }) => id), ["m45", "m31"]);
  assert.equal(route[1].start, evening + 60 * minute);

  const first = target("m31", [[0, 20, 50]]);
  const later = target("m42", [[15, 35, 50]]);
  assert.deepEqual(buildNightRoute([later, first]).map(({ id }) => id), ["m31"]);
});

test("rechaza paradas incompletas, a pleno crepúsculo, por debajo de 25° o sin muestreo suficiente", () => {
  const day = target("m42", [[0, 20, 60]]);
  const daylight = { ...day, points: day.points.map((point) => ({ ...point, sunAltitude: -17.9 })) };
  assert.deepEqual(buildNightRoute([
    target("m31", [[0, 15, 60]]),
    daylight,
    target("m45", [[0, 30, 24.9]]),
    target("m57", [[0, 20, 60]], [0, 20]),
  ]), []);

  const edge = target("m13", [[0, 20, 25]], [0, 10, 20]);
  const atThreshold = { ...edge, points: edge.points.map((point) => ({ ...point, sunAltitude: -18 })) };
  assert.equal(buildNightRoute([atThreshold]).length, 1);
});

test("el calendario usa fechas UTC exactas, eventos distintos y texto escapado", () => {
  const route = buildNightRoute([target("m31", [[0, 20, 36]]), target("m45", [[30, 50, 37]])]);
  const file = nightRouteCalendar(route, "Madrid, Sierra; norte\nSector \\ 1", evening);
  const unfolded = file.replace(/\r\n[ \t]/g, "");
  assert.ok(unfolded.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(unfolded.endsWith("END:VCALENDAR\r\n"));
  assert.match(unfolded, /(?:^|\r\n)VERSION:2\.0\r\n/);
  assert.equal([...unfolded.matchAll(/BEGIN:VEVENT\r\n/g)].length, 2);
  assert.equal(new Set([...unfolded.matchAll(/UID:([^\r\n]+)/g)].map((match) => match[1])).size, 2);
  assert.match(unfolded, /DTSTAMP:20261215T235000Z\r\n/);
  assert.match(unfolded, /DTSTART:20261215T235000Z\r\n/);
  assert.match(unfolded, /DTEND:20261216T001000Z\r\n/);
  assert.match(unfolded, /DTSTART:20261216T002000Z\r\n/);
  assert.match(unfolded, /DTEND:20261216T004000Z\r\n/);
  assert.ok(unfolded.includes("LOCATION:Madrid\\, Sierra\\; norte\\nSector \\\\ 1\r\n"));
});

test("dos ciudades no comparten un UID para el mismo objeto y la misma hora UTC", () => {
  const route = buildNightRoute([target("m31", [[0, 20, 36]])]);
  const uidAt = (city: string, exportedAt: number) => nightRouteCalendar(route, city, exportedAt)
    .replace(/\r\n[ \t]/g, "")
    .match(/^UID:([^\r\n]+)/m)?.[1];
  const madrid = uidAt("Madrid", evening);
  const murcia = uidAt("Murcia", evening);
  assert.ok(madrid && murcia);
  assert.notEqual(madrid, murcia);
  assert.equal(madrid, uidAt("Madrid", evening + minute));
});
