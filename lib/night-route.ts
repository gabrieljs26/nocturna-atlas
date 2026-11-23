const minute = 60_000;
const stopDuration = 20 * minute;
const travelTime = 10 * minute;
const maximumSampleGap = 10 * minute;

export const ROUTE_MIN_ALTITUDE = 25;
export const ROUTE_MAX_SUN_ALTITUDE = -18;

type RoutePoint = {
  time: number;
  altitude: number;
  sunAltitude: number;
  azimuth: number;
};

export type RouteTarget = {
  id: string;
  title: string;
  points: readonly RoutePoint[];
};

export type RouteStop = {
  id: string;
  title: string;
  start: number;
  end: number;
  altitude: number;
  azimuth: number;
};

type Candidate = {
  stop: RouteStop;
  targetMask: bigint;
  quality: number;
};

type Plan = {
  stops: readonly RouteStop[];
  quality: number;
};

const emptyPlan: Plan = { stops: [], quality: 0 };

function isObservable(point: RoutePoint) {
  return point.altitude >= ROUTE_MIN_ALTITUDE && point.sunAltitude <= ROUTE_MAX_SUN_ALTITUDE;
}

function candidatesForTarget({ id, title, points }: RouteTarget, index: number): Candidate[] {
  const candidates: Candidate[] = [];
  const targetMask = BigInt(1) << BigInt(index);

  for (let startIndex = 0; startIndex < points.length; startIndex += 1) {
    const first = points[startIndex];
    if (!isObservable(first)) continue;

    const end = first.time + stopDuration;
    let sum = first.altitude;

    for (let sampleIndex = startIndex + 1; sampleIndex < points.length; sampleIndex += 1) {
      const point = points[sampleIndex];
      const gap = point.time - points[sampleIndex - 1].time;
      if (gap <= 0 || gap > maximumSampleGap || point.time > end || !isObservable(point)) break;

      sum += point.altitude;
      if (point.time === end) {
        candidates.push({
          stop: { id, title, start: first.time, end, altitude: first.altitude, azimuth: first.azimuth },
          targetMask,
          quality: sum / (sampleIndex - startIndex + 1),
        });
        break;
      }
    }
  }

  return candidates;
}

function findNextCandidate(candidates: Candidate[], startAt: number) {
  let left = 0;
  let right = candidates.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (candidates[middle].stop.start < startAt) left = middle + 1;
    else right = middle;
  }
  return left;
}

function startsEarlier(first: readonly RouteStop[], second: readonly RouteStop[]) {
  const difference = first.findIndex((stop, index) => stop.start !== second[index].start);
  return difference >= 0 && first[difference].start < second[difference].start;
}

export function buildNightRoute(targets: readonly RouteTarget[]): RouteStop[] {
  const uniqueTargets = [...new Map(targets.map((target) => [target.id, target])).values()];
  const candidates = uniqueTargets.flatMap(candidatesForTarget).sort((a, b) => a.stop.start - b.stop.start);
  const nextIndex = candidates.map(({ stop }) => findNextCandidate(candidates, stop.end + travelTime));
  const memo = candidates.map(() => new Map<bigint, Plan>());

  function bestFrom(index: number, usedTargets: bigint): Plan {
    if (index === candidates.length) return emptyPlan;
    const stored = memo[index].get(usedTargets);
    if (stored) return stored;

    const { stop, targetMask, quality } = candidates[index];
    let best = bestFrom(index + 1, usedTargets);

    if ((usedTargets & targetMask) === BigInt(0)) {
      const continuation = bestFrom(nextIndex[index], usedTargets | targetMask);
      const totalQuality = quality + continuation.quality;
      const totalStops = 1 + continuation.stops.length;
      const stops = [stop, ...continuation.stops];
      if (totalStops > best.stops.length ||
          (totalStops === best.stops.length && (totalQuality > best.quality ||
            (totalQuality === best.quality && startsEarlier(stops, best.stops))))) {
        best = { stops, quality: totalQuality };
      }
    }

    memo[index].set(usedTargets, best);
    return best;
  }

  return [...bestFrom(0, BigInt(0)).stops];
}

function calendarDate(time: number) {
  return new Date(time).toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function calendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[;,]/g, "\\$&");
}

function foldCalendarLine(value: string) {
  const encoder = new TextEncoder();
  let bytes = 0;
  let output = "";
  for (const character of value) {
    const width = encoder.encode(character).length;
    if (bytes + width > 75) {
      output += "\r\n ";
      bytes = 1;
    }
    output += character;
    bytes += width;
  }
  return output;
}

export function nightRouteCalendar(stops: readonly RouteStop[], locationName: string, exportedAt = Date.now()) {
  const timestamp = calendarDate(exportedAt);
  const locationId = encodeURIComponent(locationName.normalize("NFC"));
  const events = stops.flatMap((stop) => [
    "BEGIN:VEVENT",
    "UID:" + calendarText(stop.id) + "-" + calendarDate(stop.start) + "-" + locationId + "@nocturna-atlas.vercel.app",
    "DTSTAMP:" + timestamp,
    "DTSTART:" + calendarDate(stop.start),
    "DTEND:" + calendarDate(stop.end),
    "SUMMARY:" + calendarText("Observar " + stop.title),
    "LOCATION:" + calendarText(locationName),
    "DESCRIPTION:" + calendarText("Altura " + Math.round(stop.altitude) + "° · Azimut " + (Math.round(stop.azimuth) % 360) + "°"),
    "END:VEVENT",
  ]);

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nocturna//Ruta de observación//ES", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR", ""]
    .map(foldCalendarLine)
    .join("\r\n");
}
