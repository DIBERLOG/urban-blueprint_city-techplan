import {
  initialMapState,
  type BuildingData,
  type GateData,
  type MapState,
  type OverlayId,
  type Point,
  type RoadData,
  type ZoneData,
} from "./cityData";

export type SelectedTarget =
  | { kind: "zone"; id: string }
  | { kind: "road"; id: string }
  | { kind: "building"; id: string }
  | { kind: "gate"; id: string }
  | { kind: "overlay"; id: OverlayId };

export type ZoneHandle = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

export type SavedVersion = {
  id: string;
  label: string;
  createdAt: string;
  data: MapState;
};

export type ClipboardItem =
  | { kind: "building"; building: BuildingData }
  | { kind: "road"; road: RoadData }
  | { kind: "zone"; zone: ZoneData; buildings: BuildingData[] }
  | { kind: "gate"; gate: GateData };

// Ключи localStorage и формат MapState — общий контракт с уже сохранёнными схемами и /transfer.html.
export const STATE_KEY = "city-techplan-map-state-v2";
export const HISTORY_KEY = "city-techplan-map-history-v2";
export const SHARE_PARAM = "map";
export const GRID_STEP = 10;
export const MIN_ZONE_SIZE = 120;
export const HISTORY_LIMIT = 12;
const PASTE_OFFSET = 20;

export const snap = (value: number) => Math.round(value / GRID_STEP) * GRID_STEP;

type Box = { x: number; y: number; width: number; height: number };

function pointToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function pointToBox(point: Point, box: Box) {
  const x = Math.max(box.x, Math.min(point.x, box.x + box.width));
  const y = Math.max(box.y, Math.min(point.y, box.y + box.height));
  return Math.hypot(point.x - x, point.y - y);
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}

function segmentToBox(a: Point, b: Point, box: Box) {
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
  if (pointToBox(a, box) === 0 || pointToBox(b, box) === 0) return 0;
  if (corners.some((corner, index) => segmentsCross(a, b, corner, corners[(index + 1) % 4]))) return 0;
  return Math.min(pointToBox(a, box), pointToBox(b, box), ...corners.map((corner) => pointToSegment(corner, a, b)));
}

function roadTouchesBox(road: RoadData, box: Box) {
  const clearance = road.width / 2 + 8;
  return road.points.slice(1).some((point, index) => segmentToBox(road.points[index], point, box) < clearance);
}

/**
 * Здание не должно заходить на дорогу. Считаем по самим отрезкам дороги (а не по её габариту), и дороги,
 * которых здание касается уже сейчас (`current`), не мешают — иначе такое здание нельзя было сдвинуть вовсе.
 */
export function buildingHitsRoads(candidate: Box, roads: RoadData[], current?: Box) {
  return roads.some((road) => roadTouchesBox(road, candidate) && !(current && roadTouchesBox(road, current)));
}

export function parsePoints(value: string): Point[] | null {
  const parsed = value
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [x, y] = entry.split(",").map((part) => Number(part.trim()));
      return { x, y };
    });

  if (!parsed.length || parsed.some((point) => Number.isNaN(point.x) || Number.isNaN(point.y))) {
    return null;
  }

  return parsed;
}

export function ensureMapState(value: unknown): MapState {
  const maybe = (value ?? {}) as Partial<MapState>;
  return {
    title: typeof maybe.title === "string" && maybe.title.trim() ? maybe.title : initialMapState.title,
    zones: Array.isArray(maybe.zones) ? maybe.zones : initialMapState.zones,
    roads: Array.isArray(maybe.roads) ? maybe.roads : initialMapState.roads,
    buildings: Array.isArray(maybe.buildings) ? maybe.buildings : initialMapState.buildings,
    gates: Array.isArray(maybe.gates) ? maybe.gates : initialMapState.gates,
    overlays: {
      ...initialMapState.overlays,
      ...(typeof maybe.overlays === "object" && maybe.overlays ? maybe.overlays : {}),
    },
  };
}

export function encodeMapState(mapState: MapState) {
  const json = JSON.stringify(mapState);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeMapState(encoded: string): MapState | null {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const binary = atob(`${normalized}${padding}`);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return ensureMapState(JSON.parse(json));
  } catch {
    return null;
  }
}

export function resizeZone(origin: Box, handle: ZoneHandle, dx: number, dy: number) {
  let { x, y, width, height } = origin;

  if (handle.includes("e")) {
    width = snap(Math.max(MIN_ZONE_SIZE, origin.width + dx));
  }
  if (handle.includes("s")) {
    height = snap(Math.max(MIN_ZONE_SIZE, origin.height + dy));
  }
  if (handle.includes("w")) {
    const nextWidth = Math.max(MIN_ZONE_SIZE, origin.width - dx);
    const snappedWidth = snap(nextWidth);
    x = snap(origin.x + (origin.width - snappedWidth));
    width = snappedWidth;
  }
  if (handle.includes("n")) {
    const nextHeight = Math.max(MIN_ZONE_SIZE, origin.height - dy);
    const snappedHeight = snap(nextHeight);
    y = snap(origin.y + (origin.height - snappedHeight));
    height = snappedHeight;
  }

  return { x, y, width, height };
}

/** Сдвиг выбранного объекта на dx/dy. Здание, упёршееся в дорогу, остаётся на месте — как при перетаскивании. */
export function nudgeTarget(
  state: MapState,
  target: SelectedTarget,
  dx: number,
  dy: number,
  options: { ignoreRoads: boolean; zoneWithBuildings: boolean },
): MapState {
  if (target.kind === "building") {
    return {
      ...state,
      buildings: state.buildings.map((building) => {
        if (building.id !== target.id) return building;
        const candidate = { x: building.x + dx, y: building.y + dy, width: building.width, height: building.height };
        if (!options.ignoreRoads && buildingHitsRoads(candidate, state.roads, building)) return building;
        return { ...building, x: candidate.x, y: candidate.y };
      }),
    };
  }

  if (target.kind === "road") {
    return {
      ...state,
      roads: state.roads.map((road) =>
        road.id === target.id ? { ...road, points: road.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) } : road,
      ),
    };
  }

  if (target.kind === "gate") {
    return {
      ...state,
      gates: state.gates.map((gate) => (gate.id === target.id ? { ...gate, x: gate.x + dx, y: gate.y + dy } : gate)),
    };
  }

  if (target.kind === "zone") {
    return {
      ...state,
      zones: state.zones.map((zone) => (zone.id === target.id ? { ...zone, x: zone.x + dx, y: zone.y + dy } : zone)),
      buildings: options.zoneWithBuildings
        ? state.buildings.map((building) => (building.zoneId === target.id ? { ...building, x: building.x + dx, y: building.y + dy } : building))
        : state.buildings,
    };
  }

  const key = target.id === "legend" ? "legendPosition" : "stampPosition";
  const position = state.overlays[key];
  return { ...state, overlays: { ...state.overlays, [key]: { x: position.x + dx, y: position.y + dy } } };
}

export function copyTarget(state: MapState, target: SelectedTarget): ClipboardItem | null {
  if (target.kind === "building") {
    const building = state.buildings.find((entry) => entry.id === target.id);
    return building ? { kind: "building", building: structuredClone(building) } : null;
  }
  if (target.kind === "road") {
    const road = state.roads.find((entry) => entry.id === target.id);
    return road ? { kind: "road", road: structuredClone(road) } : null;
  }
  if (target.kind === "gate") {
    const gate = state.gates.find((entry) => entry.id === target.id);
    return gate ? { kind: "gate", gate: structuredClone(gate) } : null;
  }
  if (target.kind === "zone") {
    const zone = state.zones.find((entry) => entry.id === target.id);
    if (!zone) return null;
    const buildings = state.buildings.filter((entry) => entry.zoneId === zone.id);
    return { kind: "zone", zone: structuredClone(zone), buildings: structuredClone(buildings) };
  }
  return null;
}

/**
 * Вставляет копию со сдвигом и новыми id. Возвращает и вставленную копию как следующий буфер,
 * чтобы повторная вставка ложилась лесенкой, а не в одну точку.
 */
export function pasteItem(state: MapState, item: ClipboardItem, stamp: string) {
  const offset = PASTE_OFFSET;

  if (item.kind === "building") {
    const building = { ...structuredClone(item.building), id: `building-${stamp}`, x: item.building.x + offset, y: item.building.y + offset };
    return {
      state: { ...state, buildings: [...state.buildings, building] },
      selected: { kind: "building", id: building.id } as SelectedTarget,
      next: { kind: "building", building } as ClipboardItem,
    };
  }

  if (item.kind === "road") {
    const road = { ...structuredClone(item.road), id: `road-${stamp}`, points: item.road.points.map((point) => ({ x: point.x + offset, y: point.y + offset })) };
    return {
      state: { ...state, roads: [...state.roads, road] },
      selected: { kind: "road", id: road.id } as SelectedTarget,
      next: { kind: "road", road } as ClipboardItem,
    };
  }

  if (item.kind === "gate") {
    const gate = { ...structuredClone(item.gate), id: `gate-${stamp}`, x: item.gate.x + offset, y: item.gate.y + offset };
    return {
      state: { ...state, gates: [...state.gates, gate] },
      selected: { kind: "gate", id: gate.id } as SelectedTarget,
      next: { kind: "gate", gate } as ClipboardItem,
    };
  }

  const zoneId = `zone-${stamp}`;
  const zone = { ...structuredClone(item.zone), id: zoneId, x: item.zone.x + offset, y: item.zone.y + offset };
  const buildings = item.buildings.map((building, index) => ({
    ...structuredClone(building),
    id: `building-${stamp}-${index}`,
    zoneId,
    x: building.x + offset,
    y: building.y + offset,
  }));
  return {
    state: { ...state, zones: [...state.zones, zone], buildings: [...state.buildings, ...buildings] },
    selected: { kind: "zone", id: zoneId } as SelectedTarget,
    next: { kind: "zone", zone, buildings } as ClipboardItem,
  };
}

export const blankMapState = (): MapState => ({
  title: "Новая карта",
  zones: [],
  roads: [],
  buildings: [],
  gates: [],
  overlays: structuredClone(initialMapState.overlays),
});

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

function readJson(storage: KeyValueStorage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readHistory(storage: KeyValueStorage): SavedVersion[] {
  const history = readJson(storage, HISTORY_KEY);
  return Array.isArray(history) ? (history as SavedVersion[]) : [];
}

export type DraftSummary = {
  state: MapState;
  edited: boolean;
  versions: number;
  objects: number;
};

/**
 * Черновик — то, что автосохранение положило в STATE_KEY. Нетронутый пример города черновиком не считается,
 * если нет и сохранённых версий: автосохранение пишет его при первом же открытии редактора.
 */
export function readDraft(storage: KeyValueStorage): DraftSummary | null {
  const saved = readJson(storage, STATE_KEY);
  const versions = readHistory(storage).length;
  if (!saved && !versions) return null;
  const state = saved ? ensureMapState(saved) : ensureMapState(initialMapState);
  const edited = Boolean(saved) && JSON.stringify(state) !== JSON.stringify(ensureMapState(initialMapState));
  if (!edited && !versions) return null;
  return { state, edited, versions, objects: state.buildings.length + state.gates.length };
}

/** Начать новую карту, не теряя черновик: изменённый черновик уходит первой версией в «Сохранения». */
export function startNewMap(storage: KeyValueStorage, next: MapState, now = new Date()) {
  const draft = readDraft(storage);
  if (draft?.edited) {
    const version: SavedVersion = {
      id: `version-${now.getTime()}`,
      label: `Черновик до новой карты ${now.toLocaleString()}`,
      createdAt: now.toISOString(),
      data: draft.state,
    };
    storage.setItem(HISTORY_KEY, JSON.stringify([version, ...readHistory(storage)].slice(0, HISTORY_LIMIT)));
  }
  storage.setItem(STATE_KEY, JSON.stringify(next));
}

/** С чего открывается редактор: карта из share-ссылки, затем автосохранённый черновик, затем пример города. */
export function loadStartState(storage: KeyValueStorage, search: string): MapState {
  const shared = new URLSearchParams(search).get(SHARE_PARAM);
  const parsedShared = shared ? decodeMapState(shared) : null;
  if (parsedShared) return parsedShared;
  const saved = readJson(storage, STATE_KEY);
  return saved ? ensureMapState(saved) : structuredClone(initialMapState);
}

export type JunctionArm = { angle: number; width: number; reach: number };
export type Junction = { x: number; y: number; size: number; arms: JunctionArm[] };

const JUNCTION_MERGE = 14;

/** Перекрёстки: точки, где отрезки разных дорог пересекаются или упираются друг в друга. */
export function findJunctions(roads: RoadData[]): Junction[] {
  const segments = roads.flatMap((road, roadIndex) =>
    road.points.slice(1).map((point, index) => ({ a: road.points[index], b: point, width: road.width, roadIndex, index })),
  );
  const found: Array<{ x: number; y: number; segments: Set<number> }> = [];

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const s1 = segments[i];
      const s2 = segments[j];
      if (s1.roadIndex === s2.roadIndex && Math.abs(s1.index - s2.index) <= 1) continue;
      const rx = s1.b.x - s1.a.x;
      const ry = s1.b.y - s1.a.y;
      const sx = s2.b.x - s2.a.x;
      const sy = s2.b.y - s2.a.y;
      const denominator = rx * sy - ry * sx;
      if (Math.abs(denominator) < 1e-6) continue;
      const qx = s2.a.x - s1.a.x;
      const qy = s2.a.y - s1.a.y;
      const t = (qx * sy - qy * sx) / denominator;
      const u = (qx * ry - qy * rx) / denominator;
      // Небольшой допуск: дорога, не дотянутая до другой на полширины, всё равно примыкает к ней.
      const tTol = (Math.max(s2.width / 2, 6) + 2) / Math.hypot(rx, ry);
      const uTol = (Math.max(s1.width / 2, 6) + 2) / Math.hypot(sx, sy);
      if (t < -tTol || t > 1 + tTol || u < -uTol || u > 1 + uTol) continue;
      const x = s1.a.x + rx * Math.max(0, Math.min(1, t));
      const y = s1.a.y + ry * Math.max(0, Math.min(1, t));
      const existing = found.find((entry) => Math.hypot(entry.x - x, entry.y - y) < JUNCTION_MERGE);
      if (existing) {
        existing.segments.add(i);
        existing.segments.add(j);
      } else {
        found.push({ x, y, segments: new Set([i, j]) });
      }
    }
  }

  return found.map(({ x, y, segments: ids }) => {
    const involved = [...ids].map((id) => segments[id]);
    const size = Math.max(...involved.map((segment) => segment.width));
    const arms = involved.flatMap((segment) =>
      [segment.a, segment.b]
        .map((end) => ({ angle: Math.atan2(end.y - y, end.x - x), width: segment.width, reach: Math.hypot(end.x - x, end.y - y) }))
        .filter((arm) => arm.reach > size / 2 + 20),
    );
    return { x, y, size, arms };
  });
}
