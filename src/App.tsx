import { useEffect, useMemo, useRef, useState } from "react";
import {
  cloneMapState,
  initialMapState,
  type BuildingData,
  type BuildingForm,
  type GateData,
  type MapState,
  type OverlayId,
  type Point,
  type RoadData,
  type ZoneData,
} from "./cityData";
import {
  GRID_STEP,
  HISTORY_KEY,
  HISTORY_LIMIT,
  SHARE_PARAM,
  STATE_KEY,
  buildingHitsRoads,
  loadStartState,
  readHistory,
  copyTarget,
  encodeMapState,
  ensureMapState,
  nudgeTarget,
  parsePoints,
  pasteItem,
  resizeZone,
  snap,
  type ClipboardItem,
  type SavedVersion,
  type SelectedTarget,
  type ZoneHandle,
} from "./mapState";
import { BuildingShape, CompassAndScale, Gate, Legend, MapBackdrop, River, Road, TitleStamp, ZoneBlock } from "./mapShapes";

type PanelSection = "zone" | "road" | "building" | "gate" | "service" | "library";
type ToolMode = "select" | "delete";
type ZoneEditMode = "none" | "zone-only-move" | "zone-with-buildings" | "zone-resize";

type DragState =
  | {
      kind: "building";
      id: string;
      start: Point;
      origin: { x: number; y: number };
    }
  | {
      kind: "road";
      id: string;
      start: Point;
      origin: Point[];
    }
  | {
      kind: "road-point";
      id: string;
      pointIndex: number;
      start: Point;
      origin: Point[];
    }
  | {
      kind: "zone";
      id: string;
      moveBuildings: boolean;
      start: Point;
      origin: { x: number; y: number };
      buildingOrigin: Array<{ id: string; x: number; y: number }>;
    }
  | {
      kind: "zone-resize";
      id: string;
      handle: ZoneHandle;
      start: Point;
      origin: { x: number; y: number; width: number; height: number };
    }
  | {
      kind: "gate";
      id: string;
      start: Point;
      origin: { x: number; y: number };
    }
  | {
      kind: "overlay";
      id: OverlayId;
      start: Point;
      origin: Point;
    };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getZoneHandles(zone: ZoneData) {
  return [
    { handle: "nw" as const, x: zone.x, y: zone.y, cursor: "nwse-resize" },
    { handle: "n" as const, x: zone.x + zone.width / 2, y: zone.y, cursor: "ns-resize" },
    { handle: "ne" as const, x: zone.x + zone.width, y: zone.y, cursor: "nesw-resize" },
    { handle: "e" as const, x: zone.x + zone.width, y: zone.y + zone.height / 2, cursor: "ew-resize" },
    { handle: "se" as const, x: zone.x + zone.width, y: zone.y + zone.height, cursor: "nwse-resize" },
    { handle: "s" as const, x: zone.x + zone.width / 2, y: zone.y + zone.height, cursor: "ns-resize" },
    { handle: "sw" as const, x: zone.x, y: zone.y + zone.height, cursor: "nesw-resize" },
    { handle: "w" as const, x: zone.x, y: zone.y + zone.height / 2, cursor: "ew-resize" },
  ];
}

export default function App({ onHome }: { onHome: () => void }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragSnapshotRef = useRef<MapState | null>(null);
  const dragChangedRef = useRef(false);
  // Правка в инспекторе кладёт в историю один снимок на поле: снимок «взводится» фокусом/нажатием в панели.
  const fieldEditArmedRef = useRef(false);
  const lastNudgeAtRef = useRef(0);
  // Читаем сохранённое сразу в инициализаторе: иначе автосохранение успевает записать пример города поверх черновика.
  const [mapState, setMapState] = useState<MapState>(() => loadStartState(localStorage, window.location.search));
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedTarget | null>({ kind: "building", id: "palace" });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [zoneEditMode, setZoneEditMode] = useState<ZoneEditMode>("none");
  const [panelSection, setPanelSection] = useState<PanelSection>("service");
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>(() => readHistory(localStorage));
  const [selectedVersionId, setSelectedVersionId] = useState<string>(() => readHistory(localStorage)[0]?.id ?? "");
  const [undoStack, setUndoStack] = useState<MapState[]>([]);
  const [redoStack, setRedoStack] = useState<MapState[]>([]);
  const [ignoreRoads, setIgnoreRoads] = useState(false);
  const [clipboardItem, setClipboardItem] = useState<ClipboardItem | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "done">("idle");
  const [shareState, setShareState] = useState<"idle" | "done" | "error">("idle");
  const [exportState, setExportState] = useState<"idle" | "png">("idle");
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [autosaveLabel, setAutosaveLabel] = useState("Автосохранение активно");
  const [serverState, setServerState] = useState<"idle" | "loading" | "saving" | "done" | "error">("idle");
  const [serverMessage, setServerMessage] = useState<string>("Карты хранятся в этом браузере");

  const zones = mapState.zones;
  const roads = mapState.roads;
  const buildings = mapState.buildings;
  const gates = mapState.gates;
  const overlays = mapState.overlays;

  const selectedZone = selected?.kind === "zone" ? zones.find((zone) => zone.id === selected.id) ?? null : null;
  const selectedRoad = selected?.kind === "road" ? roads.find((road) => road.id === selected.id) ?? null : null;
  const selectedBuilding = selected?.kind === "building" ? buildings.find((building) => building.id === selected.id) ?? null : null;
  const selectedGate = selected?.kind === "gate" ? gates.find((gate) => gate.id === selected.id) ?? null : null;
  const selectedOverlay = selected?.kind === "overlay" ? selected.id : null;

  const selectedZoneTitle = useMemo(() => {
    if (!selectedBuilding) return "";
    return zones.find((zone) => zone.id === selectedBuilding.zoneId)?.title ?? "";
  }, [selectedBuilding, zones]);
  const selectedSummary = useMemo(() => {
    if (!selected) return "Ничего не выбрано";
    if (selected.kind === "building") return selectedBuilding?.label ?? "Здание";
    if (selected.kind === "road") return selectedRoad?.label ?? selectedRoad?.id ?? "Дорога";
    if (selected.kind === "zone") return selectedZone?.title ?? "Зона";
    if (selected.kind === "gate") return selectedGate?.label ?? "Ворота";
    return selectedOverlay === "legend" ? "Легенда" : "Штамп";
  }, [selected, selectedBuilding, selectedRoad, selectedZone, selectedGate, selectedOverlay]);
  const zoomPercent = Math.round(zoomLevel * 100);
  const libraryGroups = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    const groups: Array<{ title: string; items: Array<{ label: string; target: SelectedTarget }> }> = [
      { title: "Зоны", items: zones.map((zone) => ({ label: zone.title, target: { kind: "zone", id: zone.id } })) },
      { title: "Дороги", items: roads.map((road) => ({ label: road.label || road.id, target: { kind: "road", id: road.id } })) },
      { title: "Ворота", items: gates.map((gate) => ({ label: gate.label, target: { kind: "gate", id: gate.id } })) },
      { title: "Здания", items: buildings.map((building) => ({ label: building.label || building.id, target: { kind: "building", id: building.id } })) },
    ];
    return groups
      .map((group) => ({ ...group, items: query ? group.items.filter((item) => item.label.toLowerCase().includes(query)) : group.items }))
      .filter((group) => group.items.length);
  }, [libraryQuery, zones, roads, gates, buildings]);

  const activeSection: PanelSection = selectedZone
    ? "zone"
    : selectedRoad
      ? "road"
      : selectedBuilding
        ? "building"
        : selectedGate
          ? "gate"
          : panelSection;

  const createSnapshot = () => cloneMapState(mapState);

  const persistSnapshot = (snapshot: MapState) => {
    localStorage.setItem(STATE_KEY, JSON.stringify(snapshot));
  };

  const applySnapshot = (snapshot: MapState) => {
    setMapState(ensureMapState(snapshot));
    setSelected(null);
  };

  const pushUndoSnapshot = () => {
    setUndoStack((current) => [...current, createSnapshot()].slice(-40));
    setRedoStack([]);
  };

  const commitStateChange = (updater: () => void) => {
    pushUndoSnapshot();
    updater();
  };

  const rememberFieldEdit = () => {
    if (!fieldEditArmedRef.current) return;
    fieldEditArmedRef.current = false;
    pushUndoSnapshot();
  };

  const removeSelectedTarget = (target: SelectedTarget) => {
    commitStateChange(() => {
      setMapState((current) => {
        if (target.kind === "building") {
          return { ...current, buildings: current.buildings.filter((building) => building.id !== target.id) };
        }
        if (target.kind === "road") {
          return { ...current, roads: current.roads.filter((road) => road.id !== target.id) };
        }
        if (target.kind === "gate") {
          return { ...current, gates: current.gates.filter((gate) => gate.id !== target.id) };
        }
        if (target.kind === "zone") {
          return {
            ...current,
            zones: current.zones.filter((zone) => zone.id !== target.id),
            buildings: current.buildings.filter((building) => building.zoneId !== target.id),
          };
        }
        return current;
      });
      setSelected(null);
    });
  };

  const undoLastAction = () => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((current) => [...current, createSnapshot()].slice(-40));
    setUndoStack((current) => current.slice(0, -1));
    applySnapshot(previous);
  };

  const redoLastAction = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((current) => [...current, createSnapshot()].slice(-40));
    setRedoStack((current) => current.slice(0, -1));
    applySnapshot(next);
  };

  const copySelected = () => {
    if (!selected) return;
    const item = copyTarget(mapState, selected);
    if (item) setClipboardItem(item);
  };

  const cutSelected = () => {
    if (!selected) return;
    const item = copyTarget(mapState, selected);
    if (!item) return;
    setClipboardItem(item);
    removeSelectedTarget(selected);
  };

  const insertItem = (item: ClipboardItem) => {
    const result = pasteItem(mapState, item, String(Date.now()));
    commitStateChange(() => {
      setMapState(result.state);
      setSelected(result.selected);
      setPanelSection(result.selected.kind as PanelSection);
    });
    return result.next;
  };

  const pasteClipboard = () => {
    if (!clipboardItem) return;
    setClipboardItem(insertItem(clipboardItem));
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const item = copyTarget(mapState, selected);
    if (item) insertItem(item);
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selected) return;
    const now = Date.now();
    // Серия нажатий стрелок (или зажатая клавиша) — одна запись в истории.
    if (now - lastNudgeAtRef.current > 800) pushUndoSnapshot();
    lastNudgeAtRef.current = now;
    setMapState(nudgeTarget(mapState, selected, dx, dy, { ignoreRoads, zoneWithBuildings: zoneEditMode === "zone-with-buildings" }));
  };

  const updateZone = (id: string, key: keyof ZoneData, value: string | number) => {
    rememberFieldEdit();
    setMapState((current) => ({
      ...current,
      zones: current.zones.map((zone) => (zone.id === id ? { ...zone, [key]: value } : zone)),
    }));
  };

  const updateRoad = (id: string, key: keyof RoadData, value: string | number | boolean | Point[]) => {
    rememberFieldEdit();
    setMapState((current) => ({
      ...current,
      roads: current.roads.map((road) => (road.id === id ? { ...road, [key]: value } : road)),
    }));
  };

  const updateGate = (id: string, key: keyof GateData, value: string | number) => {
    rememberFieldEdit();
    setMapState((current) => ({
      ...current,
      gates: current.gates.map((gate) => (gate.id === id ? { ...gate, [key]: value } : gate)),
    }));
  };

  const updateOverlayPosition = (id: OverlayId, point: Point) => {
    rememberFieldEdit();
    setMapState((current) => ({
      ...current,
      overlays: {
        ...current.overlays,
        [id === "legend" ? "legendPosition" : "stampPosition"]: point,
      },
    }));
  };

  const updateBuilding = (id: string, key: keyof BuildingData, value: string | number | boolean) => {
    rememberFieldEdit();
    setMapState((current) => ({
      ...current,
      buildings: current.buildings.map((building) => {
        if (building.id !== id) return building;
        const nextBuilding = { ...building, [key]: value } as BuildingData;

        if (key === "x" || key === "y" || key === "width" || key === "height") {
          const candidate = {
            x: key === "x" ? snap(Number(value)) : building.x,
            y: key === "y" ? snap(Number(value)) : building.y,
            width: key === "width" ? Math.max(20, snap(Number(value))) : building.width,
            height: key === "height" ? Math.max(20, snap(Number(value))) : building.height,
          };

          if (!ignoreRoads && buildingHitsRoads(candidate, current.roads, building)) {
            return building;
          }

          return { ...nextBuilding, ...candidate };
        }

        return nextBuilding;
      }),
    }));
  };

  const setBuildingForm = (id: string, form: BuildingForm) => {
    rememberFieldEdit();
    setMapState((current) => ({
      ...current,
      buildings: current.buildings.map((building) => {
        if (building.id !== id) return building;
        return {
          ...building,
          form,
          rotation: building.rotation ?? 0,
          radius: form === "oct" ? building.radius ?? Math.round(Math.min(building.width, building.height) / 2) : building.radius,
          cutWidth: form === "l" || form === "corner-block" ? building.cutWidth ?? Math.round(building.width * 0.55) : building.cutWidth,
          cutHeight: form === "l" || form === "corner-block" ? building.cutHeight ?? Math.round(building.height * 0.45) : building.cutHeight,
          gapWidth: form === "u" ? building.gapWidth ?? Math.round(building.width * 0.4) : building.gapWidth,
          gapDepth: form === "u" ? building.gapDepth ?? Math.round(building.height * 0.5) : building.gapDepth,
          neckWidth: form === "t" ? building.neckWidth ?? Math.round(building.width * 0.36) : building.neckWidth,
          wingDepth: form === "t" ? building.wingDepth ?? Math.round(building.height * 0.42) : building.wingDepth,
          innerInset: form === "courtyard" ? building.innerInset ?? Math.round(Math.min(building.width, building.height) * 0.22) : building.innerInset,
          topWidth: form === "trapezoid" ? building.topWidth ?? Math.round(building.width * 0.72) : building.topWidth,
          segmentCount: form === "segmented-bar" ? building.segmentCount ?? 4 : building.segmentCount,
          bayCount: form === "depot" || form === "sawtooth" ? building.bayCount ?? 4 : building.bayCount,
        };
      }),
    }));
  };

  const getSvgPoint = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 2200,
      y: ((clientY - rect.top) / rect.height) * 1700,
    };
  };

  const handleBuildingDragStart = (event: React.PointerEvent<SVGGElement>, building: BuildingData) => {
    if (event.button !== 0 || toolMode === "delete") return;
    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    dragSnapshotRef.current = createSnapshot();
    dragChangedRef.current = false;
    setSelected({ kind: "building", id: building.id });
    setPanelSection("building");
    setDragState({ kind: "building", id: building.id, start: point, origin: { x: building.x, y: building.y } });
  };

  const handleRoadDragStart = (event: React.PointerEvent<SVGGElement>, road: RoadData) => {
    if (event.button !== 0 || toolMode === "delete") return;
    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    dragSnapshotRef.current = createSnapshot();
    dragChangedRef.current = false;
    setSelected({ kind: "road", id: road.id });
    setPanelSection("road");
    setDragState({ kind: "road", id: road.id, start: point, origin: road.points.map((entry) => ({ ...entry })) });
  };

  const handleRoadPointDragStart = (event: React.PointerEvent<SVGCircleElement>, road: RoadData, pointIndex: number) => {
    if (event.button !== 0 || toolMode === "delete") return;
    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    dragSnapshotRef.current = createSnapshot();
    dragChangedRef.current = false;
    setSelected({ kind: "road", id: road.id });
    setPanelSection("road");
    setDragState({ kind: "road-point", id: road.id, pointIndex, start: point, origin: road.points.map((entry) => ({ ...entry })) });
  };

  const handleZonePointerDown = (event: React.PointerEvent<SVGGElement>, zone: ZoneData) => {
    if (event.button !== 0 || toolMode === "delete" || zoneEditMode === "none" || zoneEditMode === "zone-resize") return;
    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    dragSnapshotRef.current = createSnapshot();
    dragChangedRef.current = false;
    setSelected({ kind: "zone", id: zone.id });
    setPanelSection("zone");
    setDragState({
      kind: "zone",
      id: zone.id,
      moveBuildings: zoneEditMode === "zone-with-buildings",
      start: point,
      origin: { x: zone.x, y: zone.y },
      buildingOrigin: buildings.filter((building) => building.zoneId === zone.id).map((building) => ({ id: building.id, x: building.x, y: building.y })),
    });
  };

  const handleZoneHandleDragStart = (event: React.PointerEvent<SVGRectElement>, zone: ZoneData, handle: ZoneHandle) => {
    if (event.button !== 0 || toolMode === "delete") return;
    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    dragSnapshotRef.current = createSnapshot();
    dragChangedRef.current = false;
    setSelected({ kind: "zone", id: zone.id });
    setPanelSection("zone");
    setDragState({ kind: "zone-resize", id: zone.id, handle, start: point, origin: { x: zone.x, y: zone.y, width: zone.width, height: zone.height } });
  };

  const handleGateDragStart = (event: React.PointerEvent<SVGGElement>, gate: GateData) => {
    if (event.button !== 0 || toolMode === "delete") return;
    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    dragSnapshotRef.current = createSnapshot();
    dragChangedRef.current = false;
    setSelected({ kind: "gate", id: gate.id });
    setPanelSection("gate");
    setDragState({ kind: "gate", id: gate.id, start: point, origin: { x: gate.x, y: gate.y } });
  };

  const handleOverlayDragStart = (event: React.PointerEvent<SVGGElement>, id: OverlayId) => {
    if (event.button !== 0) return;
    const point = getSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    dragSnapshotRef.current = createSnapshot();
    dragChangedRef.current = false;
    setSelected({ kind: "overlay", id });
    setPanelSection("service");
    setDragState({ kind: "overlay", id, start: point, origin: id === "legend" ? overlays.legendPosition : overlays.stampPosition });
  };

  const addBuilding = () => {
    const zoneId = selectedZone?.id ?? selectedBuilding?.zoneId ?? zones[0]?.id ?? "zone";
    const zone = zones.find((entry) => entry.id === zoneId) ?? zones[0];
    const requestedLabel = window.prompt("Название нового здания", "НОВОЕ ЗДАНИЕ");
    if (!zone) return;
    const newBuilding: BuildingData = {
      id: `building-${Date.now()}`,
      zoneId: zone.id,
      label: requestedLabel?.trim() ? requestedLabel.trim() : "НОВОЕ ЗДАНИЕ",
      color: zone.color,
      form: "rect",
      x: snap(zone.x + 40),
      y: snap(zone.y + 60),
      width: 100,
      height: 50,
    };
    commitStateChange(() => {
      setMapState((current) => ({ ...current, buildings: [...current.buildings, newBuilding] }));
      setSelected({ kind: "building", id: newBuilding.id });
      setPanelSection("building");
    });
  };

  const addZone = () => {
    const requestedTitle = window.prompt("Название новой зоны", "НОВАЯ ЗОНА");
    const requestedColor = window.prompt("Цвет новой зоны", "#22c55e");
    const newZone: ZoneData = {
      id: `zone-${Date.now()}`,
      title: requestedTitle?.trim() ? requestedTitle.trim() : "НОВАЯ ЗОНА",
      color: requestedColor?.trim() ? requestedColor.trim() : "#22c55e",
      x: 760,
      y: 1080,
      width: 280,
      height: 220,
    };
    commitStateChange(() => {
      setMapState((current) => ({ ...current, zones: [...current.zones, newZone] }));
      setSelected({ kind: "zone", id: newZone.id });
      setPanelSection("zone");
    });
  };

  const createRoad = (major: boolean) => {
    const requestedLabel = window.prompt(major ? "Название новой магистрали" : "Название новой дороги", major ? "НОВАЯ МАГИСТРАЛЬ" : "НОВАЯ ДОРОГА");
    const newRoad: RoadData = {
      id: `road-${Date.now()}`,
      label: requestedLabel?.trim() ? requestedLabel.trim() : major ? "НОВАЯ МАГИСТРАЛЬ" : "НОВАЯ ДОРОГА",
      width: major ? 30 : 18,
      major,
      points: [{ x: 720, y: 1180 }, { x: 960, y: 1180 }],
    };
    commitStateChange(() => {
      setMapState((current) => ({ ...current, roads: [...current.roads, newRoad] }));
      setSelected({ kind: "road", id: newRoad.id });
      setPanelSection("road");
    });
  };

  const addPark = () => {
    const zoneId = selectedZone?.id ?? selectedBuilding?.zoneId ?? zones[0]?.id ?? "zone";
    const zone = zones.find((entry) => entry.id === zoneId) ?? zones[0];
    if (!zone) return;
    const requestedLabel = window.prompt("Название нового парка", "ПАРК");
    const newBuilding: BuildingData = {
      id: `park-${Date.now()}`,
      zoneId: zone.id,
      label: requestedLabel?.trim() ? requestedLabel.trim() : "ПАРК",
      color: "#22c55e",
      form: "park",
      x: snap(zone.x + 60),
      y: snap(zone.y + 90),
      width: 120,
      height: 80,
      rotation: 0,
    };
    commitStateChange(() => {
      setMapState((current) => ({ ...current, buildings: [...current.buildings, newBuilding] }));
      setSelected({ kind: "building", id: newBuilding.id });
      setPanelSection("building");
    });
  };

  const addTrees = () => {
    const zoneId = selectedZone?.id ?? selectedBuilding?.zoneId ?? zones[0]?.id ?? "zone";
    const zone = zones.find((entry) => entry.id === zoneId) ?? zones[0];
    if (!zone) return;
    const requestedLabel = window.prompt("Название новой группы деревьев", "ДЕРЕВЬЯ");
    const newBuilding: BuildingData = {
      id: `trees-${Date.now()}`,
      zoneId: zone.id,
      label: requestedLabel?.trim() ? requestedLabel.trim() : "ДЕРЕВЬЯ",
      color: "#6ee7b7",
      form: "tree-cluster",
      rotation: 0,
      x: snap(zone.x + 60),
      y: snap(zone.y + 90),
      width: 96,
      height: 72,
    };
    commitStateChange(() => {
      setMapState((current) => ({ ...current, buildings: [...current.buildings, newBuilding] }));
      setSelected({ kind: "building", id: newBuilding.id });
      setPanelSection("building");
    });
  };

  const addGate = () => {
    const requestedLabel = window.prompt("Название новых ворот", "НОВЫЕ ВОРОТА");
    const newGate: GateData = {
      id: `gate-${Date.now()}`,
      label: requestedLabel?.trim() ? requestedLabel.trim() : "НОВЫЕ ВОРОТА",
      x: 400,
      y: 80,
      width: 60,
      height: 58,
      rotation: 0,
      textDx: 80,
      textDy: 52,
    };
    commitStateChange(() => {
      setMapState((current) => ({ ...current, gates: [...current.gates, newGate] }));
      setSelected({ kind: "gate", id: newGate.id });
      setPanelSection("gate");
    });
  };

  const savePlan = () => {
    const snapshot = createSnapshot();
    persistSnapshot(snapshot);
    const version: SavedVersion = {
      id: `version-${Date.now()}`,
      label: `Сохранение ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      data: snapshot,
    };
    const nextHistory = [version, ...savedVersions].slice(0, HISTORY_LIMIT);
    setSavedVersions(nextHistory);
    setSelectedVersionId(version.id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setCopyState("done");
    window.setTimeout(() => setCopyState("idle"), 1200);
  };

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(mapState, null, 2));
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
    }
  };

  const copyShareLink = async () => {
    const encoded = encodeMapState(mapState);
    const url = new URL(window.location.href);
    url.searchParams.set(SHARE_PARAM, encoded);
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareState("done");
      window.setTimeout(() => setShareState("idle"), 1800);
    } catch {
      setShareState("error");
      window.setTimeout(() => setShareState("idle"), 1800);
    }
  };

  const loadSelectedVersion = () => {
    const version = savedVersions.find((entry) => entry.id === selectedVersionId);
    if (!version) return;
    commitStateChange(() => {
      applySnapshot(version.data);
      persistSnapshot(version.data);
    });
  };

  const resetToInitial = () => {
    if (!window.confirm("Сбросить карту к примеру города? До перезагрузки страницы это можно отменить кнопкой «Отменить».")) return;
    commitStateChange(() => {
      applySnapshot(cloneMapState(initialMapState));
      persistSnapshot(initialMapState);
    });
    setSelected(null);
    setSelectedVersionId("");
    setPanelSection("service");
    setZoneEditMode("none");
    setToolMode("select");
    setZoomLevel(1);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(mapState, null, 2)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, "city-techplan-map.json");
  };

  const importJson = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = ensureMapState(JSON.parse(text));
      commitStateChange(() => {
        applySnapshot(parsed);
        persistSnapshot(parsed);
      });
    } catch {
      setServerState("error");
      setServerMessage("Не удалось импортировать JSON");
    } finally {
      event.target.value = "";
    }
  };

  const exportPng = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setExportState("png");
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", "2200");
      clone.setAttribute("height", "1700");
      const serialized = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Не удалось загрузить SVG"));
      });

      image.src = url;
      await loaded;

      const canvas = document.createElement("canvas");
      canvas.width = 2200;
      canvas.height = 1700;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas не поддерживается");
      context.drawImage(image, 0, 0, 2200, 1700);
      URL.revokeObjectURL(url);

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Не удалось создать PNG"));
        }, "image/png");
      });

      downloadBlob(pngBlob, "city-techplan-map.png");
    } catch {
      setServerState("error");
      setServerMessage("Не удалось экспортировать PNG");
    } finally {
      setExportState("idle");
    }
  };

  useEffect(() => {
    document.title = `${mapState.title} — Urban Blueprint`;
  }, [mapState.title]);

  useEffect(() => {
    persistSnapshot(mapState);
    setAutosaveLabel(`Автосохранено ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  }, [mapState]);

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (event: PointerEvent) => {
      const point = getSvgPoint(event.clientX, event.clientY);
      if (!point) return;
      const dx = Math.round(point.x - dragState.start.x);
      const dy = Math.round(point.y - dragState.start.y);

      if (dragState.kind === "building") {
        setMapState((current) => ({
          ...current,
          buildings: current.buildings.map((building) => {
            if (building.id !== dragState.id) return building;
            const candidate = {
              x: snap(dragState.origin.x + dx),
              y: snap(dragState.origin.y + dy),
              width: building.width,
              height: building.height,
            };
            if (!ignoreRoads && buildingHitsRoads(candidate, current.roads, { ...dragState.origin, width: building.width, height: building.height })) return building;
            dragChangedRef.current = true;
            return { ...building, x: candidate.x, y: candidate.y };
          }),
        }));
        return;
      }

      if (dragState.kind === "road") {
        dragChangedRef.current = true;
        setMapState((current) => ({
          ...current,
          roads: current.roads.map((road) =>
            road.id === dragState.id
              ? { ...road, points: dragState.origin.map((roadPoint) => ({ x: roadPoint.x + dx, y: roadPoint.y + dy })) }
              : road,
          ),
        }));
        return;
      }

      if (dragState.kind === "road-point") {
        dragChangedRef.current = true;
        setMapState((current) => ({
          ...current,
          roads: current.roads.map((road) =>
            road.id === dragState.id
              ? {
                  ...road,
                  points: dragState.origin.map((roadPoint, index) => (index === dragState.pointIndex ? { x: roadPoint.x + dx, y: roadPoint.y + dy } : roadPoint)),
                }
              : road,
          ),
        }));
        return;
      }

      if (dragState.kind === "zone") {
        const snappedDx = snap(dragState.origin.x + dx) - dragState.origin.x;
        const snappedDy = snap(dragState.origin.y + dy) - dragState.origin.y;
        dragChangedRef.current = true;
        setMapState((current) => ({
          ...current,
          zones: current.zones.map((zone) => (zone.id === dragState.id ? { ...zone, x: dragState.origin.x + snappedDx, y: dragState.origin.y + snappedDy } : zone)),
          buildings: dragState.moveBuildings
            ? current.buildings.map((building) => {
                const originBuilding = dragState.buildingOrigin.find((entry) => entry.id === building.id);
                if (!originBuilding) return building;
                return { ...building, x: originBuilding.x + snappedDx, y: originBuilding.y + snappedDy };
              })
            : current.buildings,
        }));
        return;
      }

      if (dragState.kind === "zone-resize") {
        const nextRect = resizeZone(dragState.origin, dragState.handle, dx, dy);
        dragChangedRef.current = true;
        setMapState((current) => ({
          ...current,
          zones: current.zones.map((zone) => (zone.id === dragState.id ? { ...zone, ...nextRect } : zone)),
        }));
        return;
      }

      if (dragState.kind === "gate") {
        dragChangedRef.current = true;
        setMapState((current) => ({
          ...current,
          gates: current.gates.map((gate) => (gate.id === dragState.id ? { ...gate, x: snap(dragState.origin.x + dx), y: snap(dragState.origin.y + dy) } : gate)),
        }));
        return;
      }

      dragChangedRef.current = true;
      updateOverlayPosition(dragState.id, { x: snap(dragState.origin.x + dx), y: snap(dragState.origin.y + dy) });
    };

    const handleUp = () => {
      if (dragChangedRef.current && dragSnapshotRef.current) {
        setUndoStack((current) => [...current, dragSnapshotRef.current as MapState].slice(-40));
        setRedoStack([]);
      }
      dragSnapshotRef.current = null;
      dragChangedRef.current = false;
      setDragState(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragState, ignoreRoads]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || Boolean(target?.isContentEditable);
      if (typing) return;

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === "s") {
        event.preventDefault();
        savePlan();
        return;
      }

      if (mod && key === "z" && event.shiftKey) {
        event.preventDefault();
        redoLastAction();
        return;
      }

      if (mod && key === "y") {
        event.preventDefault();
        redoLastAction();
        return;
      }

      if (mod && key === "z") {
        event.preventDefault();
        undoLastAction();
        return;
      }

      const objectSelected = Boolean(selected && selected.kind !== "overlay");
      const textSelected = Boolean(window.getSelection()?.toString());

      if (mod && key === "c" && objectSelected && !textSelected) {
        event.preventDefault();
        copySelected();
        return;
      }

      if (mod && key === "x" && objectSelected && !textSelected) {
        event.preventDefault();
        cutSelected();
        return;
      }

      if (mod && key === "v" && clipboardItem) {
        event.preventDefault();
        pasteClipboard();
        return;
      }

      if (mod && key === "d" && objectSelected) {
        event.preventDefault();
        duplicateSelected();
        return;
      }

      const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (arrow && selected && !mod) {
        event.preventDefault();
        const step = event.shiftKey ? GRID_STEP * 5 : GRID_STEP;
        nudgeSelected(arrow[0] * step, arrow[1] * step);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selected && selected.kind !== "overlay") {
        event.preventDefault();
        removeSelectedTarget(selected);
        return;
      }

      if (event.key === "Escape") {
        setSelected(null);
        setToolMode("select");
        setZoneEditMode("none");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="app-shell editor-shell">
      <div className="workspace-column">
        <header className="workspace-header">
          <div className="workspace-copy">
            <div className="workspace-kicker">
              <a
                className="workspace-home"
                href="./"
                onClick={(event) => {
                  event.preventDefault();
                  onHome();
                }}
              >
                Urban Blueprint
              </a>{" "}
              · Градостроительный редактор
            </div>
            <h1>{mapState.title}</h1>
            <p>Рабочая схема, инспектор свойств и экспорт в единый поток без прокрутки всей страницы.</p>
          </div>
          <div className="workspace-stats">
            <div className="stat-chip"><span>Зоны</span><strong>{zones.length}</strong></div>
            <div className="stat-chip"><span>Дороги</span><strong>{roads.length}</strong></div>
            <div className="stat-chip"><span>Объекты</span><strong>{buildings.length + gates.length}</strong></div>
            <div className={`stat-chip state-${serverState}`}><span>Статус</span><strong>{serverMessage}</strong></div>
          </div>
        </header>

        <div className={`toolbar-frame ${toolbarOpen ? "open" : "collapsed"}`}>
          <div className="toolbar-topbar">
            <button type="button" className="toolbar-toggle" onClick={() => setToolbarOpen((current) => !current)}>
              {toolbarOpen ? "Скрыть инструменты" : "Показать инструменты"}
            </button>
            <div className="toolbar-topbar-group">
              <button type="button" onClick={() => setZoomLevel((current) => Math.max(0.55, Number((current - 0.1).toFixed(2))))}>-</button>
              <button type="button" onClick={() => setZoomLevel(1)}>{zoomPercent}%</button>
              <button type="button" onClick={() => setZoomLevel((current) => Math.min(1.8, Number((current + 0.1).toFixed(2))))}>+</button>
              <button type="button" onClick={() => setZoomLevel(0.82)}>Fit</button>
            </div>
            <div className="toolbar-topbar-status">{autosaveLabel}</div>
          </div>
        <div className="editor-toolbar">
          <div className="toolbar-cluster">
            <button type="button" onClick={undoLastAction} disabled={!undoStack.length}>Отменить</button>
            <button type="button" onClick={redoLastAction} disabled={!redoStack.length}>Повторить</button>
            <button type="button" onClick={copySelected} disabled={!selected || selected.kind === "overlay"}>Копировать</button>
            <button type="button" onClick={cutSelected} disabled={!selected || selected.kind === "overlay"}>Вырезать</button>
            <button type="button" onClick={pasteClipboard} disabled={!clipboardItem}>Вставить</button>
            <button type="button" onClick={duplicateSelected} disabled={!selected || selected.kind === "overlay"}>Дублировать</button>
            <button type="button" className={toolMode === "select" ? "active" : ""} onClick={() => setToolMode("select")}>Режим выбора</button>
            <button type="button" className={toolMode === "delete" ? "danger active" : "danger"} onClick={() => setToolMode(toolMode === "delete" ? "select" : "delete")}>Режим удаления</button>
            <button type="button" className={ignoreRoads ? "active" : ""} onClick={() => setIgnoreRoads((current) => !current)}>{ignoreRoads ? "Дороги игнорируются" : "Игнорировать дороги"}</button>
          </div>
          <div className="toolbar-cluster">
            <button type="button" onClick={addZone}>Добавить зону</button>
            <button type="button" onClick={addBuilding}>Добавить здание</button>
            <button type="button" onClick={addPark}>Добавить парк</button>
            <button type="button" onClick={addTrees}>Добавить деревья</button>
            <button type="button" onClick={() => createRoad(false)}>Добавить дорогу</button>
            <button type="button" onClick={() => createRoad(true)}>Добавить магистраль</button>
            <button type="button" onClick={addGate}>Добавить ворота</button>
            <button type="button" onClick={copyPlan}>{copyState === "done" ? "Скопировано" : "Копировать JSON"}</button>
            <button type="button" onClick={copyShareLink}>{shareState === "done" ? "Ссылка скопирована" : shareState === "error" ? "Не удалось скопировать" : "Копировать ссылку карты"}</button>
            <button type="button" onClick={exportJson}>Экспорт JSON</button>
            <button type="button" onClick={importJson}>Импорт JSON</button>
            <button type="button" onClick={exportPng} disabled={exportState === "png"}>{exportState === "png" ? "Экспорт..." : "Экспорт PNG"}</button>
            <button type="button" onClick={savePlan}>Сохранить</button>
            <button type="button" onClick={loadSelectedVersion} disabled={!selectedVersionId}>Загрузить</button>
            <button type="button" className="danger" onClick={resetToInitial}>Сбросить</button>
          </div>
        </div>
        </div>

        <div className="board editor-board" onPointerDownCapture={() => { fieldEditArmedRef.current = false; }}>
          <div className="canvas-stage" style={{ ["--canvas-zoom" as string]: String(zoomLevel) }}>
            <svg ref={svgRef} viewBox="0 0 2200 1700" role="img" aria-label={mapState.title}>
            <MapBackdrop />

            {roads.map((road) => (
              <Road
                key={road.id}
                road={road}
                selected={selected?.kind === "road" && selected.id === road.id}
                onSelect={() => {
                  if (toolMode === "delete") {
                    removeSelectedTarget({ kind: "road", id: road.id });
                    return;
                  }
                  setSelected({ kind: "road", id: road.id });
                  setPanelSection("road");
                }}
                onDragStart={handleRoadDragStart}
              />
            ))}

            {zones.map((zone) => (
              <ZoneBlock
                key={zone.id}
                zone={zone}
                selected={selected?.kind === "zone" && selected.id === zone.id}
                draggable={zoneEditMode === "zone-only-move" || zoneEditMode === "zone-with-buildings"}
                onSelect={() => {
                  setSelected({ kind: "zone", id: zone.id });
                  setPanelSection("zone");
                }}
                onPointerDown={handleZonePointerDown}
              />
            ))}

            {buildings.map((building) => (
              <BuildingShape
                key={building.id}
                building={building}
                hovered={hoveredBuilding === building.id}
                selected={selected?.kind === "building" && selected.id === building.id}
                onEnter={setHoveredBuilding}
                onLeave={() => setHoveredBuilding(null)}
                onSelect={() => {
                  if (toolMode === "delete") {
                    removeSelectedTarget({ kind: "building", id: building.id });
                    return;
                  }
                  setSelected({ kind: "building", id: building.id });
                  setPanelSection("building");
                }}
                onDragStart={handleBuildingDragStart}
              />
            ))}

            {gates.map((gate) => (
              <Gate
                key={gate.id}
                gate={gate}
                selected={selected?.kind === "gate" && selected.id === gate.id}
                onSelect={() => {
                  if (toolMode === "delete") {
                    removeSelectedTarget({ kind: "gate", id: gate.id });
                    return;
                  }
                  setSelected({ kind: "gate", id: gate.id });
                  setPanelSection("gate");
                }}
                onPointerDown={handleGateDragStart}
              />
            ))}

            {selectedRoad ? (
              <g>
                {selectedRoad.points.map((point, index) => (
                  <circle key={`${selectedRoad.id}-${index}`} cx={point.x} cy={point.y} r={10} fill="#f8fafc" stroke="#0f1a25" strokeWidth={3} style={{ cursor: "grab", touchAction: "none" }} onPointerDown={(event) => handleRoadPointDragStart(event, selectedRoad, index)} />
                ))}
              </g>
            ) : null}

            {selectedZone && zoneEditMode === "zone-resize" ? (
              <g>
                {getZoneHandles(selectedZone).map((handle) => (
                  <rect key={handle.handle} x={handle.x - 8} y={handle.y - 8} width={16} height={16} rx={2} fill="#f8fafc" stroke={selectedZone.color} strokeWidth={2} style={{ cursor: handle.cursor, touchAction: "none" }} onPointerDown={(event) => handleZoneHandleDragStart(event, selectedZone, handle.handle)} />
                ))}
              </g>
            ) : null}

            <River />

            {overlays.showLegend ? <Legend mapState={mapState} selected={selectedOverlay === "legend"} onPointerDown={handleOverlayDragStart} /> : null}

            <CompassAndScale />

            {overlays.showTitleStamp ? <TitleStamp mapState={mapState} selected={selectedOverlay === "stamp"} onPointerDown={handleOverlayDragStart} /> : null}
            </svg>
          </div>
        </div>
      </div>

      <aside className="editor-panel" onFocusCapture={() => { fieldEditArmedRef.current = true; }} onPointerDownCapture={() => { fieldEditArmedRef.current = true; }}>
        <div className="panel-inner">
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />

        <div className="panel-block">
          <div className="panel-kicker">РЕЖИМ</div>
          <h2>Редактор генплана</h2>
          <p>Карта хранится локально в этом браузере и может экспортироваться в JSON и PNG.</p>
          <p className="meta-line">Статус: {serverMessage}</p>
          <div className="panel-status-grid">
            <div className="mini-stat"><span>Выбор</span><strong>{selectedSummary}</strong></div>
            <div className="mini-stat"><span>Hotkeys</span><strong>Ctrl/Cmd+S · Z · C/X/V · D · стрелки (Shift ×5) · Del</strong></div>
          </div>
        </div>

        <div className="panel-block">
          <div className="panel-kicker">СОХРАНЕНИЯ</div>
          <label>
            Версия
            <select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
              <option value="">Выберите сохранение</option>
              {savedVersions.map((version) => (
                <option key={version.id} value={version.id}>{version.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="panel-tabs">
          <button type="button" className={activeSection === "building" ? "active" : ""} onClick={() => setPanelSection("building")}>Здание</button>
          <button type="button" className={activeSection === "road" ? "active" : ""} onClick={() => setPanelSection("road")}>Дорога</button>
          <button type="button" className={activeSection === "zone" ? "active" : ""} onClick={() => setPanelSection("zone")}>Зона</button>
          <button type="button" className={activeSection === "gate" ? "active" : ""} onClick={() => setPanelSection("gate")}>Ворота</button>
          <button type="button" className={activeSection === "service" ? "active" : ""} onClick={() => setPanelSection("service")}>Сервис</button>
          <button type="button" className={activeSection === "library" ? "active" : ""} onClick={() => setPanelSection("library")}>Быстрый выбор</button>
        </div>

        {selectedZone && activeSection === "zone" ? (
          <div className="panel-block">
            <div className="panel-kicker">ЗОНА</div>
            <h3>{selectedZone.title}</h3>
            <div className="segmented-row">
              <button type="button" className={zoneEditMode === "none" ? "active" : ""} onClick={() => setZoneEditMode("none")}>Без drag</button>
              <button type="button" className={zoneEditMode === "zone-only-move" ? "active" : ""} onClick={() => setZoneEditMode("zone-only-move")}>Двигать только зону</button>
              <button type="button" className={zoneEditMode === "zone-with-buildings" ? "active" : ""} onClick={() => setZoneEditMode("zone-with-buildings")}>Зона + здания</button>
              <button type="button" className={zoneEditMode === "zone-resize" ? "active" : ""} onClick={() => setZoneEditMode("zone-resize")}>Изменять размер</button>
            </div>
            <label>Название<input value={selectedZone.title} onChange={(event) => updateZone(selectedZone.id, "title", event.target.value)} /></label>
            <label>Цвет<input value={selectedZone.color} onChange={(event) => updateZone(selectedZone.id, "color", event.target.value)} /></label>
            <label>X<input type="number" value={selectedZone.x} onChange={(event) => updateZone(selectedZone.id, "x", Number(event.target.value))} /></label>
            <label>Y<input type="number" value={selectedZone.y} onChange={(event) => updateZone(selectedZone.id, "y", Number(event.target.value))} /></label>
            <label>Ширина<input type="number" value={selectedZone.width} onChange={(event) => updateZone(selectedZone.id, "width", Number(event.target.value))} /></label>
            <label>Высота<input type="number" value={selectedZone.height} onChange={(event) => updateZone(selectedZone.id, "height", Number(event.target.value))} /></label>
            <button type="button" className="danger" onClick={() => removeSelectedTarget({ kind: "zone", id: selectedZone.id })}>Удалить зону</button>
          </div>
        ) : null}

        {selectedRoad && activeSection === "road" ? (
          <div className="panel-block">
            <div className="panel-kicker">ДОРОГА</div>
            <h3>{selectedRoad.label || selectedRoad.id}</h3>
            <label>Подпись<input value={selectedRoad.label ?? ""} onChange={(event) => updateRoad(selectedRoad.id, "label", event.target.value)} /></label>
            <label>Ширина<input type="number" value={selectedRoad.width} onChange={(event) => updateRoad(selectedRoad.id, "width", Number(event.target.value))} /></label>
            <label className="checkbox-row"><input type="checkbox" checked={Boolean(selectedRoad.major)} onChange={(event) => updateRoad(selectedRoad.id, "major", event.target.checked)} /> Главная магистраль</label>
            <label>
              Точки маршрута
              <textarea rows={4} value={selectedRoad.points.map((point) => `${point.x},${point.y}`).join(" | ")} onChange={(event) => {
                const parsed = parsePoints(event.target.value);
                if (parsed) updateRoad(selectedRoad.id, "points", parsed);
              }} />
            </label>
            <small>Формат: `x,y | x,y | x,y`</small>
          </div>
        ) : null}

        {selectedBuilding && activeSection === "building" ? (
          <div className="panel-block">
            <div className="panel-kicker">ЗДАНИЕ</div>
            <h3>{selectedBuilding.label}</h3>
            <p className="meta-line">Район: {selectedZoneTitle}</p>
            <label>Подпись<input value={selectedBuilding.label} onChange={(event) => updateBuilding(selectedBuilding.id, "label", event.target.value)} /></label>
            <label>Цвет<input value={selectedBuilding.color} onChange={(event) => updateBuilding(selectedBuilding.id, "color", event.target.value)} /></label>
            <label>
              Форма
              <select value={selectedBuilding.form} onChange={(event) => setBuildingForm(selectedBuilding.id, event.target.value as BuildingForm)}>
                <option value="rect">Прямоугольник</option><option value="l">L-образное</option><option value="u">U-образное</option><option value="oct">Восьмиугольник</option><option value="t">T-образное</option><option value="courtyard">Внутренний двор</option><option value="trapezoid">Трапециевидное</option><option value="rotunda">Ротонда</option><option value="corner-block">Угловой квартал</option><option value="segmented-bar">Длинный корпус</option><option value="depot">Вокзал / депо</option><option value="sawtooth">Цех с зубчатым контуром</option><option value="park">Парк</option><option value="tree-cluster">Группа деревьев</option><option value="buffer-strip">Зелёная полоса</option>
              </select>
            </label>
            <label>X<input type="number" value={selectedBuilding.x} onChange={(event) => updateBuilding(selectedBuilding.id, "x", Number(event.target.value))} /></label>
            <label>Y<input type="number" value={selectedBuilding.y} onChange={(event) => updateBuilding(selectedBuilding.id, "y", Number(event.target.value))} /></label>
            <label>Ширина<input type="number" value={selectedBuilding.width} onChange={(event) => updateBuilding(selectedBuilding.id, "width", Number(event.target.value))} /></label>
            <label>Высота<input type="number" value={selectedBuilding.height} onChange={(event) => updateBuilding(selectedBuilding.id, "height", Number(event.target.value))} /></label>
            <label>Поворот (0-360)<input type="number" min={0} max={360} value={selectedBuilding.rotation ?? 0} onChange={(event) => updateBuilding(selectedBuilding.id, "rotation", Number(event.target.value))} /></label>
            <div className="angle-presets">{[0, 45, 90, 180].map((angle) => (<button key={angle} type="button" onClick={() => updateBuilding(selectedBuilding.id, "rotation", angle)}>{angle}°</button>))}</div>
            {(selectedBuilding.form === "l" || selectedBuilding.form === "corner-block") ? (<><label>Вырез X<input type="number" value={selectedBuilding.cutWidth ?? 50} onChange={(event) => updateBuilding(selectedBuilding.id, "cutWidth", Number(event.target.value))} /></label><label>Вырез Y<input type="number" value={selectedBuilding.cutHeight ?? 40} onChange={(event) => updateBuilding(selectedBuilding.id, "cutHeight", Number(event.target.value))} /></label></>) : null}
            {selectedBuilding.form === "u" ? (<><label>Ширина проёма<input type="number" value={selectedBuilding.gapWidth ?? 50} onChange={(event) => updateBuilding(selectedBuilding.id, "gapWidth", Number(event.target.value))} /></label><label>Глубина проёма<input type="number" value={selectedBuilding.gapDepth ?? 40} onChange={(event) => updateBuilding(selectedBuilding.id, "gapDepth", Number(event.target.value))} /></label></>) : null}
            {selectedBuilding.form === "oct" ? <label>Радиус<input type="number" value={selectedBuilding.radius ?? 30} onChange={(event) => updateBuilding(selectedBuilding.id, "radius", Number(event.target.value))} /></label> : null}
            {selectedBuilding.form === "t" ? (<><label>Ширина стойки<input type="number" value={selectedBuilding.neckWidth ?? 50} onChange={(event) => updateBuilding(selectedBuilding.id, "neckWidth", Number(event.target.value))} /></label><label>Глубина перекладины<input type="number" value={selectedBuilding.wingDepth ?? 40} onChange={(event) => updateBuilding(selectedBuilding.id, "wingDepth", Number(event.target.value))} /></label></>) : null}
            {selectedBuilding.form === "courtyard" ? <label>Отступ двора<input type="number" value={selectedBuilding.innerInset ?? 20} onChange={(event) => updateBuilding(selectedBuilding.id, "innerInset", Number(event.target.value))} /></label> : null}
            {selectedBuilding.form === "trapezoid" ? <label>Верхняя ширина<input type="number" value={selectedBuilding.topWidth ?? Math.round(selectedBuilding.width * 0.72)} onChange={(event) => updateBuilding(selectedBuilding.id, "topWidth", Number(event.target.value))} /></label> : null}
            {selectedBuilding.form === "segmented-bar" ? <label>Количество секций<input type="number" min={2} value={selectedBuilding.segmentCount ?? 4} onChange={(event) => updateBuilding(selectedBuilding.id, "segmentCount", Number(event.target.value))} /></label> : null}
            {(selectedBuilding.form === "depot" || selectedBuilding.form === "sawtooth") ? <label>Количество пролётов<input type="number" min={2} value={selectedBuilding.bayCount ?? 4} onChange={(event) => updateBuilding(selectedBuilding.id, "bayCount", Number(event.target.value))} /></label> : null}
            <p className="meta-line">Здания привязываются к сетке 10px и не могут пересекать дороги, если не включён режим игнорирования.</p>
          </div>
        ) : null}

        {selectedGate && activeSection === "gate" ? (
          <div className="panel-block">
            <div className="panel-kicker">ВОРОТА</div>
            <h3>{selectedGate.label}</h3>
            <label>Подпись<input value={selectedGate.label} onChange={(event) => updateGate(selectedGate.id, "label", event.target.value)} /></label>
            <label>X<input type="number" value={selectedGate.x} onChange={(event) => updateGate(selectedGate.id, "x", Number(event.target.value))} /></label>
            <label>Y<input type="number" value={selectedGate.y} onChange={(event) => updateGate(selectedGate.id, "y", Number(event.target.value))} /></label>
            <label>Ширина<input type="number" value={selectedGate.width} onChange={(event) => updateGate(selectedGate.id, "width", Number(event.target.value))} /></label>
            <label>Высота<input type="number" value={selectedGate.height} onChange={(event) => updateGate(selectedGate.id, "height", Number(event.target.value))} /></label>
            <label>Поворот<input type="number" min={0} max={360} value={selectedGate.rotation ?? 0} onChange={(event) => updateGate(selectedGate.id, "rotation", Number(event.target.value))} /></label>
            <button type="button" className="danger" onClick={() => removeSelectedTarget({ kind: "gate", id: selectedGate.id })}>Удалить ворота</button>
          </div>
        ) : null}

        {activeSection === "service" ? (
          <div className="panel-block">
            <div className="panel-kicker">СЕРВИС</div>
            <label>Название карты<input value={mapState.title} onChange={(event) => { rememberFieldEdit(); setMapState((current) => ({ ...current, title: event.target.value })); }} /></label>
            <label className="checkbox-row"><input type="checkbox" checked={overlays.showLegend} onChange={(event) => { rememberFieldEdit(); setMapState((current) => ({ ...current, overlays: { ...current.overlays, showLegend: event.target.checked } })); }} /> Показать легенду</label>
            <label className="checkbox-row"><input type="checkbox" checked={overlays.showTitleStamp} onChange={(event) => { rememberFieldEdit(); setMapState((current) => ({ ...current, overlays: { ...current.overlays, showTitleStamp: event.target.checked } })); }} /> Показать штамп</label>
            <label>Legend X<input type="number" value={overlays.legendPosition.x} onChange={(event) => updateOverlayPosition("legend", { ...overlays.legendPosition, x: Number(event.target.value) })} /></label>
            <label>Legend Y<input type="number" value={overlays.legendPosition.y} onChange={(event) => updateOverlayPosition("legend", { ...overlays.legendPosition, y: Number(event.target.value) })} /></label>
            <label>Stamp X<input type="number" value={overlays.stampPosition.x} onChange={(event) => updateOverlayPosition("stamp", { ...overlays.stampPosition, x: Number(event.target.value) })} /></label>
            <label>Stamp Y<input type="number" value={overlays.stampPosition.y} onChange={(event) => updateOverlayPosition("stamp", { ...overlays.stampPosition, y: Number(event.target.value) })} /></label>
            {selectedOverlay ? <p className="meta-line">Выбран overlay: {selectedOverlay}</p> : null}
          </div>
        ) : null}

        <div className="panel-block compact-list" hidden={activeSection !== "library"}>
          <div className="panel-kicker">БЫСТРЫЙ ВЫБОР</div>
          <h3>Сущности</h3>
          <label>Поиск<input type="search" value={libraryQuery} placeholder="Название объекта" onChange={(event) => setLibraryQuery(event.target.value)} /></label>
          {libraryGroups.map((group) => (
            <div key={group.title} className="library-group">
              <div className="library-group-title">{group.title} · {group.items.length}</div>
              {group.items.map((item) => (
                <button key={item.target.id} type="button" className={selected?.kind === item.target.kind && selected.id === item.target.id ? "active" : ""} onClick={() => { setSelected(item.target); setPanelSection(item.target.kind as PanelSection); }}>{item.label}</button>
              ))}
            </div>
          ))}
          {!libraryGroups.length ? <p className="meta-line">Ничего не найдено.</p> : null}
        </div>
        {activeSection === "building" && !selectedBuilding ? <div className="panel-empty">Выбери здание на карте или создай новое через верхнюю панель.</div> : null}
        {activeSection === "road" && !selectedRoad ? <div className="panel-empty">Выбери дорогу, чтобы менять ширину, магистральность и маршрут.</div> : null}
        {activeSection === "zone" && !selectedZone ? <div className="panel-empty">Выбери зону для движения, resize или смены цвета и названия.</div> : null}
        {activeSection === "gate" && !selectedGate ? <div className="panel-empty">Выбери ворота или добавь новые, чтобы редактировать подпись и поворот.</div> : null}
        </div>
      </aside>
    </div>
  );
}
