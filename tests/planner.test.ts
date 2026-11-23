import assert from "node:assert/strict";
import test from "node:test";
import { calculateNightPlan, getNightBounds, observerCities, parseJ2000 } from "../lib/planner.ts";

const minute = 60_000;
const hour = 60 * minute;
const madrid = observerCities.find(({ id }) => id === "madrid");
const tenerife = observerCities.find(({ id }) => id === "tenerife");
assert.ok(madrid);
assert.ok(tenerife);

const orion = parseJ2000("05 h 35 m 17 s", "−05° 23′ 28″");
assert.ok(orion);

function approximately(actual: number, expected: number, tolerance: number) {
  assert.ok(Math.abs(actual - expected) <= tolerance, expected + " ± " + tolerance + " esperado; recibido " + actual);
}

test("interpreta las coordenadas J2000, incluidos el signo menos Unicode y cero grados sur", () => {
  approximately(orion.ra, 5.5880556, 0.000001);
  approximately(orion.dec, -5.3911111, 0.000001);
  assert.deepEqual(parseJ2000("00 h 00 m 00 s", "−00° 30′ 00″"), { ra: 0, dec: -0.5 });
  assert.deepEqual(parseJ2000("00 h 00 m 00 s", "+90° 00′ 00″"), { ra: 0, dec: 90 });
  assert.equal(parseJ2000("12 h 60 m 00 s", "+00° 00′ 00″"), null);
  assert.equal(parseJ2000("12 h 00 m 00 s", "+90° 01′ 00″"), null);
  assert.equal(parseJ2000("dato ausente", "dato ausente"), null);
});

test("interpreta las 18:00 y las 06:00 en la ciudad y cruza medianoche y los cambios de hora", () => {
  const spring = getNightBounds("2026-03-28", madrid);
  const autumn = getNightBounds("2026-10-24", madrid);
  const winter = getNightBounds("2026-12-15", tenerife);
  assert.ok(spring && autumn && winter);

  assert.equal(new Date(spring.startMs).toISOString(), "2026-03-28T17:00:00.000Z");
  assert.equal(new Date(spring.endMs).toISOString(), "2026-03-29T04:00:00.000Z");
  assert.equal(spring.endMs - spring.startMs, 11 * hour);
  assert.equal(new Date(autumn.startMs).toISOString(), "2026-10-24T16:00:00.000Z");
  assert.equal(new Date(autumn.endMs).toISOString(), "2026-10-25T05:00:00.000Z");
  assert.equal(autumn.endMs - autumn.startMs, 13 * hour);
  assert.equal(new Date(winter.startMs).toISOString(), "2026-12-15T18:00:00.000Z");
  assert.equal(new Date(winter.endMs).toISOString(), "2026-12-16T06:00:00.000Z");
  assert.equal(getNightBounds("2026-02-30", madrid), null);
});

test("la geometría de Orión coincide con una referencia independiente y la ventana respeta los umbrales", () => {
  const plan = calculateNightPlan(orion, madrid, "2026-12-15");
  assert.ok(plan);
  const localMidnight = plan.samples.find(({ timeMs }) => timeMs === Date.parse("2026-12-15T23:00:00Z"));
  assert.ok(localMidnight);
  // USNO, tiempo sidéreo y conversión horizontal. Margen para precesión/refracción y posición exacta.
  // https://aa.usno.navy.mil/faq/GAST y https://aa.usno.navy.mil/faq/alt_az
  approximately(localMidnight.altitude, 41.3, 1.25);
  approximately(localMidnight.azimuth, 155.9, 1.5);
  // Cálculo solar independiente de NOAA, https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  approximately(localMidnight.sunAltitude, -67.4, 1.25);
  assert.equal(plan.samples[0].timeMs, plan.startMs);
  assert.equal(plan.samples.at(-1)?.timeMs, plan.endMs);
  for (let index = 1; index < plan.samples.length; index += 1) {
    assert.equal(plan.samples[index].timeMs - plan.samples[index - 1].timeMs, 5 * minute);
  }

  const window = plan.bestWindow;
  assert.ok(window && window.endMs - window.startMs > 2 * hour);
  const favorable = plan.samples.filter(({ timeMs }) =>
    timeMs >= window.startMs && timeMs <= window.endMs,
  );
  assert.ok(favorable.length > 0);
  assert.ok(favorable.every(({ altitude, sunAltitude }) => altitude >= 25 && sunAltitude <= -18));
});

test("distingue puesta de sol, oscuridad astronómica y una noche sin ventana para Orión", () => {
  const spring = calculateNightPlan(orion, madrid, "2026-03-20");
  assert.ok(spring);
  // Puesta aproximadamente a las 18:27 UTC según el cálculo independiente de NOAA.
  const sunsetSample = spring.samples.find(({ sunAltitude }) => sunAltitude <= -0.833);
  assert.ok(sunsetSample && spring.darkWindows[0]);
  approximately(sunsetSample.timeMs, Date.parse("2026-03-20T18:27:00Z"), 9 * minute);
  approximately(spring.darkWindows[0].startMs, Date.parse("2026-03-20T19:58:00Z"), 9 * minute);
  assert.ok(spring.darkWindows[0].startMs - sunsetSample.timeMs > hour);

  const summer = calculateNightPlan(orion, madrid, "2026-06-21");
  assert.ok(summer && summer.darkWindows.length > 0);
  assert.equal(summer.bestWindow, null);
});
