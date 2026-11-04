import { describe, expect, it } from "vitest";
import { initialMapState, type MapState } from "./cityData";
import {
  HISTORY_KEY,
  STATE_KEY,
  blankMapState,
  buildingHitsRoads,
  copyTarget,
  decodeMapState,
  encodeMapState,
  ensureMapState,
  findJunctions,
  loadStartState,
  nudgeTarget,
  pasteItem,
  readDraft,
  resizeZone,
  startNewMap,
  type SavedVersion,
} from "./mapState";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const sample = (): MapState => structuredClone(initialMapState);

describe("storage contract", () => {
  it("keeps the localStorage keys existing maps are saved under", () => {
    expect(STATE_KEY).toBe("city-techplan-map-state-v2");
    expect(HISTORY_KEY).toBe("city-techplan-map-history-v2");
  });

  it("keeps the exported JSON shape", () => {
    expect(Object.keys(ensureMapState(sample()))).toEqual(["title", "zones", "roads", "buildings", "gates", "overlays"]);
  });

  it("fills missing parts of an old or partial map from the example", () => {
    const restored = ensureMapState({ title: "Мой город", zones: [] });
    expect(restored.title).toBe("Мой город");
    expect(restored.zones).toEqual([]);
    expect(restored.roads).toBe(initialMapState.roads);
    expect(restored.overlays).toEqual(initialMapState.overlays);
  });
});

describe("share link", () => {
  it("round-trips a map with Cyrillic text", () => {
    const map = { ...sample(), title: "Генплан «Север» — лист 2" };
    expect(decodeMapState(encodeMapState(map))).toEqual(map);
  });

  it("rejects garbage", () => {
    expect(decodeMapState("not-a-map")).toBeNull();
  });
});

describe("loadStartState", () => {
  it("prefers the share link, then the saved draft, then the example", () => {
    const draft = { ...sample(), title: "Черновик" };
    const shared = { ...sample(), title: "Из ссылки" };
    const storage = memoryStorage({ [STATE_KEY]: JSON.stringify(draft) });

    expect(loadStartState(storage, `?map=${encodeMapState(shared)}`).title).toBe("Из ссылки");
    expect(loadStartState(storage, "").title).toBe("Черновик");
    expect(loadStartState(memoryStorage(), "").title).toBe(initialMapState.title);
    expect(loadStartState(memoryStorage({ [STATE_KEY]: "{broken" }), "").title).toBe(initialMapState.title);
  });
});

describe("readDraft / startNewMap", () => {
  it("does not treat the untouched example as a draft", () => {
    expect(readDraft(memoryStorage())).toBeNull();
    expect(readDraft(memoryStorage({ [STATE_KEY]: JSON.stringify(initialMapState) }))).toBeNull();
  });

  it("reports an edited draft", () => {
    const storage = memoryStorage({ [STATE_KEY]: JSON.stringify({ ...sample(), title: "Мой город" }) });
    const draft = readDraft(storage);
    expect(draft?.edited).toBe(true);
    expect(draft?.state.title).toBe("Мой город");
    expect(draft?.objects).toBe(initialMapState.buildings.length + initialMapState.gates.length);
  });

  it("archives an edited draft into versions before starting a new map", () => {
    const old: SavedVersion = { id: "version-1", label: "Старое", createdAt: "2026-01-01T00:00:00.000Z", data: sample() };
    const storage = memoryStorage({
      [STATE_KEY]: JSON.stringify({ ...sample(), title: "Мой город" }),
      [HISTORY_KEY]: JSON.stringify([old]),
    });

    startNewMap(storage, blankMapState(), new Date("2026-11-03T12:00:00Z"));

    const history = JSON.parse(storage.getItem(HISTORY_KEY)!) as SavedVersion[];
    expect(history.map((version) => version.data.title)).toEqual(["Мой город", initialMapState.title]);
    expect(Object.keys(history[0])).toEqual(["id", "label", "createdAt", "data"]);
    expect(JSON.parse(storage.getItem(STATE_KEY)!).zones).toEqual([]);
  });

  it("does not add a version when there is nothing to keep", () => {
    const storage = memoryStorage();
    startNewMap(storage, sample());
    expect(storage.getItem(HISTORY_KEY)).toBeNull();
  });
});

describe("editing helpers", () => {
  it("resizes a zone from the west edge without dropping below the minimum", () => {
    expect(resizeZone({ x: 100, y: 100, width: 300, height: 200 }, "w", 40, 0)).toEqual({ x: 140, y: 100, width: 260, height: 200 });
    expect(resizeZone({ x: 100, y: 100, width: 300, height: 200 }, "w", 400, 0).width).toBe(120);
  });

  it("nudges a zone with or without its buildings", () => {
    const state = sample();
    const zone = state.zones[0];
    const building = state.buildings.find((entry) => entry.zoneId === zone.id)!;

    const alone = nudgeTarget(state, { kind: "zone", id: zone.id }, 10, 0, { ignoreRoads: true, zoneWithBuildings: false });
    expect(alone.zones[0].x).toBe(zone.x + 10);
    expect(alone.buildings.find((entry) => entry.id === building.id)!.x).toBe(building.x);

    const together = nudgeTarget(state, { kind: "zone", id: zone.id }, 10, 0, { ignoreRoads: true, zoneWithBuildings: true });
    expect(together.buildings.find((entry) => entry.id === building.id)!.x).toBe(building.x + 10);
  });

  it("keeps a building in place when a nudge would put it on a road", () => {
    const state = { ...sample(), buildings: [{ ...sample().buildings[0], x: 0, y: 0, width: 20, height: 20 }] };
    state.roads = [{ id: "r", width: 20, points: [{ x: 60, y: 0 }, { x: 60, y: 200 }] }];
    const target = { kind: "building" as const, id: state.buildings[0].id };

    expect(nudgeTarget(state, target, 40, 0, { ignoreRoads: false, zoneWithBuildings: false }).buildings[0].x).toBe(0);
    expect(nudgeTarget(state, target, 40, 0, { ignoreRoads: true, zoneWithBuildings: false }).buildings[0].x).toBe(40);
  });

  it("checks roads by their segments, not by their bounding box", () => {
    const diagonal = { id: "d", width: 20, points: [{ x: 0, y: 0 }, { x: 1000, y: 1000 }] };
    expect(buildingHitsRoads({ x: 700, y: 100, width: 100, height: 60 }, [diagonal])).toBe(false);
    expect(buildingHitsRoads({ x: 480, y: 480, width: 40, height: 40 }, [diagonal])).toBe(true);
  });

  it("lets a building that already touches a road move away from it", () => {
    const road = { id: "r", width: 20, points: [{ x: 0, y: 100 }, { x: 500, y: 100 }] };
    const current = { x: 100, y: 80, width: 40, height: 40 };
    expect(buildingHitsRoads({ ...current, y: 20 }, [road], current)).toBe(false);
    const crossing = { id: "c", width: 20, points: [{ x: 200, y: 0 }, { x: 200, y: 300 }] };
    expect(buildingHitsRoads({ ...current, x: 180 }, [road, crossing], current)).toBe(true);
  });

  it("moves the legend", () => {
    const moved = nudgeTarget(sample(), { kind: "overlay", id: "legend" }, 0, -50, { ignoreRoads: false, zoneWithBuildings: false });
    expect(moved.overlays.legendPosition.y).toBe(initialMapState.overlays.legendPosition.y - 50);
  });

  it("pastes copies with new ids in a staircase", () => {
    const state = sample();
    const item = copyTarget(state, { kind: "building", id: state.buildings[0].id })!;
    const first = pasteItem(state, item, "1");
    const second = pasteItem(first.state, first.next, "2");

    expect(second.state.buildings).toHaveLength(state.buildings.length + 2);
    const [a, b] = second.state.buildings.slice(-2);
    expect(a.id).not.toBe(b.id);
    expect(b.x - a.x).toBe(20);
    expect(second.selected).toEqual({ kind: "building", id: b.id });
  });

  it("copies a zone together with its buildings", () => {
    const state = sample();
    const zone = state.zones[0];
    const result = pasteItem(state, copyTarget(state, { kind: "zone", id: zone.id })!, "7");
    const ownBuildings = state.buildings.filter((entry) => entry.zoneId === zone.id).length;
    expect(result.state.zones).toHaveLength(state.zones.length + 1);
    expect(result.state.buildings.filter((entry) => entry.zoneId === "zone-7")).toHaveLength(ownBuildings);
  });
});

describe("findJunctions", () => {
  it("finds a crossing and a T-junction, with arms only where the road goes on", () => {
    const horizontal = { id: "h", width: 20, points: [{ x: 0, y: 100 }, { x: 400, y: 100 }] };
    const vertical = { id: "v", width: 20, points: [{ x: 200, y: 0 }, { x: 200, y: 300 }] };
    const branch = { id: "b", width: 16, points: [{ x: 300, y: 106 }, { x: 300, y: 300 }] };
    const junctions = findJunctions([horizontal, vertical, branch]);

    expect(junctions).toHaveLength(2);
    const cross = junctions.find((entry) => entry.x === 200)!;
    expect(cross.y).toBe(100);
    expect(cross.arms).toHaveLength(4);
    const tee = junctions.find((entry) => entry.x === 300)!;
    expect(tee.arms).toHaveLength(3);
  });

  it("ignores parallel roads and the joints inside one road", () => {
    const bent = { id: "z", width: 18, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };
    const parallel = { id: "p", width: 18, points: [{ x: 0, y: 200 }, { x: 100, y: 200 }] };
    expect(findJunctions([bent, parallel])).toEqual([]);
  });

  it("finds the crossings of the example city", () => {
    expect(findJunctions(initialMapState.roads).length).toBeGreaterThan(10);
  });
});
