import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  findJunctions,
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
import {
  ChevronDown,
  ClipboardPaste,
  Copy,
  CopyPlus,
  DoorOpen,
  Download,
  Building2,
  Eraser,
  FileJson,
  History,
  Image as ImageIcon,
  Link2,
  Maximize2,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Route,
  Save,
  Scissors,
  Search,
  Spline,
  SquareDashed,
  Trash2,
  Trees,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  BuildingShape,
  CompassAndScale,
  FormThumb,
  Gate,
  Junctions,
  Legend,
  MapBackdrop,
  River,
  Road,
  SelectionFrame,
  TitleStamp,
  ZoneBlock,
  buildingForms,
  formLabel,
  formSize,
} from "./mapShapes";

type PanelSection = "zone" | "road" | "building" | "gate" | "service" | "library";

const ZONE_COLORS = ["#fbbf24", "#06b6d4", "#10b981", "#ef4444", "#8b5cf6", "#f472b6", "#a3e635", "#fb923c", "#38bdf8", "#94a3b8"];
const SWATCHES = ["#fbbf24", "#f59e0b", "#fb923c", "#ef4444", "#f472b6", "#8b5cf6", "#38bdf8", "#06b6d4", "#10b981", "#22c55e", "#a3e635", "#94a3b8"];

const normalizeAngle = (angle = 0) => ((Math.round(angle) % 360) + 360) % 360;

/** Закрыть всплывающее меню по клику мимо него или по Escape. */
function useDismiss(ref: React.RefObject<HTMLElement>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [ref, open, close]);
}
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
  const [panelSection, setPanelSection] = useState<PanelSection>("building");
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
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const closeFileMenu = useCallback(() => setFileMenuOpen(false), []);
  const closeAddMenu = useCallback(() => setAddMenuOpen(false), []);
  useDismiss(fileMenuRef, fileMenuOpen, closeFileMenu);
  useDismiss(addMenuRef, addMenuOpen, closeAddMenu);
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

  // Вкладки «Карта» и «Объекты» открываются и при выделенном объекте; иначе показываем свойства выделенного.
  const selectedSection: PanelSection | null = selectedZone ? "zone" : selectedRoad ? "road" : selectedBuilding ? "building" : selectedGate ? "gate" : null;
  const activeSection: PanelSection = panelSection === "service" || panelSection === "library" ? panelSection : selectedSection ?? panelSection;
  const inspectorOpen = activeSection !== "service" && activeSection !== "library";
  const junctions = useMemo(() => findJunctions(roads), [roads]);

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
          segmentCount: form === "segmented-bar" || form === "terrace" ? building.segmentCount ?? (form === "terrace" ? 5 : 4) : building.segmentCount,
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

  const focusLabelField = () => {
    // Новый объект сразу можно переименовать: фокус в поле подписи, текст выделен.
    window.setTimeout(() => {
      const field = document.querySelector<HTMLInputElement>("[data-label-field]");
      field?.focus();
      field?.select();
    }, 0);
  };

  const GREEN_FORMS = new Set<BuildingForm>(["park", "square", "forest", "garden", "tree-cluster", "buffer-strip"]);

  const addObject = (form: BuildingForm) => {
    const zoneId = selectedZone?.id ?? selectedBuilding?.zoneId ?? zones[0]?.id;
    const zone = zones.find((entry) => entry.id === zoneId);
    const size = formSize[form] ?? { width: 100, height: 60 };
    const step = (buildings.filter((entry) => entry.zoneId === zone?.id).length % 6) * GRID_STEP * 2;
    const newBuilding: BuildingData = {
      id: `building-${Date.now()}`,
      zoneId: zone?.id ?? "",
      label: formLabel(form).toUpperCase(),
      color: GREEN_FORMS.has(form) ? "#22c55e" : form === "pond" ? "#38bdf8" : zone?.color ?? "#7dd3fc",
      form,
      rotation: 0,
      x: snap((zone ? zone.x + 40 : 900) + step),
      y: snap((zone ? zone.y + 60 : 760) + step),
      ...size,
    };
    commitStateChange(() => {
      setMapState((current) => ({ ...current, buildings: [...current.buildings, newBuilding] }));
      setSelected({ kind: "building", id: newBuilding.id });
      setPanelSection("building");
    });
    setAddMenuOpen(false);
    focusLabelField();
  };

  const addZone = () => {
    const newZone: ZoneData = {
      id: `zone-${Date.now()}`,
      title: "НОВАЯ ЗОНА",
      color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
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
    setAddMenuOpen(false);
    focusLabelField();
  };

  const createRoad = (major: boolean) => {
    const newRoad: RoadData = {
      id: `road-${Date.now()}`,
      label: major ? "НОВАЯ МАГИСТРАЛЬ" : "НОВАЯ ДОРОГА",
      width: major ? 30 : 18,
      major,
      points: [{ x: 720, y: 1180 }, { x: 960, y: 1180 }],
    };
    commitStateChange(() => {
      setMapState((current) => ({ ...current, roads: [...current.roads, newRoad] }));
      setSelected({ kind: "road", id: newRoad.id });
      setPanelSection("road");
    });
    setAddMenuOpen(false);
    focusLabelField();
  };

  const addGate = () => {
    const newGate: GateData = {
      id: `gate-${Date.now()}`,
      label: "НОВЫЕ ВОРОТА",
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
    setAddMenuOpen(false);
    focusLabelField();
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

  const objectSelected = Boolean(selected && selected.kind !== "overlay");
  const formGroups = (["Здания", "Особые", "Зелень и вода"] as const).map((group) => ({ group, forms: buildingForms.filter((entry) => entry.group === group) }));
  const numberField = (label: string, value: number, onChange: (value: number) => void, extra?: { min?: number; max?: number; step?: number }) => (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={value} {...extra} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
  const colorField = (value: string, onChange: (value: string) => void) => (
    <div className="field">
      <span>Цвет</span>
      <div className="swatches">
        {SWATCHES.map((swatch) => (
          <button key={swatch} type="button" className={`swatch${swatch.toLowerCase() === value.toLowerCase() ? " is-active" : ""}`} style={{ background: swatch }} aria-label={`Цвет ${swatch}`} onClick={() => onChange(swatch)} />
        ))}
        <label className="swatch swatch-custom" title="Свой цвет">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#7dd3fc"} onChange={(event) => onChange(event.target.value)} aria-label="Свой цвет" />
        </label>
      </div>
    </div>
  );

  return (
    <div className="app-shell editor-shell">
      <div className="workspace-column">
        <header className="ed-topbar">
          <a
            className="ed-brand"
            href="./"
            onClick={(event) => {
              event.preventDefault();
              onHome();
            }}
          >
            <img src="/favicon.svg" alt="" width={24} height={24} />
            Urban Blueprint
          </a>
          <div className="ed-title">
            <h1>{mapState.title}</h1>
            <span className="ed-meta">
              {zones.length} зон · {roads.length} дорог · {buildings.length + gates.length} объектов
            </span>
          </div>
          <span className={`ed-status state-${serverState}`}>{serverState === "error" ? serverMessage : autosaveLabel}</span>
          <div className="ed-zoom" role="group" aria-label="Масштаб">
            <button type="button" className="icon-btn" title="Уменьшить" onClick={() => setZoomLevel((current) => Math.max(0.55, Number((current - 0.1).toFixed(2))))}><ZoomOut size={16} /></button>
            <button type="button" className="ed-zoom-value" title="Масштаб 100%" onClick={() => setZoomLevel(1)}>{zoomPercent}%</button>
            <button type="button" className="icon-btn" title="Увеличить" onClick={() => setZoomLevel((current) => Math.min(1.8, Number((current + 0.1).toFixed(2))))}><ZoomIn size={16} /></button>
            <button type="button" className="icon-btn" title="Вписать" onClick={() => setZoomLevel(0.82)}><Maximize2 size={16} /></button>
          </div>
          <div className="menu-anchor" ref={fileMenuRef}>
            <button type="button" className="btn" aria-expanded={fileMenuOpen} onClick={() => setFileMenuOpen((open) => !open)}>
              Файл <ChevronDown size={16} />
            </button>
            {fileMenuOpen ? (
              <div className="menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { exportPng(); setFileMenuOpen(false); }} disabled={exportState === "png"}><ImageIcon size={16} />{exportState === "png" ? "Экспорт…" : "Экспорт PNG"}</button>
                <button type="button" role="menuitem" onClick={() => { exportJson(); setFileMenuOpen(false); }}><Download size={16} />Экспорт JSON</button>
                <button type="button" role="menuitem" onClick={() => { importJson(); setFileMenuOpen(false); }}><Upload size={16} />Импорт JSON</button>
                <div className="menu-sep" />
                <button type="button" role="menuitem" onClick={copyShareLink}><Link2 size={16} />{shareState === "done" ? "Ссылка скопирована" : shareState === "error" ? "Не удалось скопировать" : "Копировать ссылку карты"}</button>
                <button type="button" role="menuitem" onClick={copyPlan}><FileJson size={16} />{copyState === "done" ? "Скопировано" : "Копировать JSON"}</button>
                <div className="menu-sep" />
                <button type="button" role="menuitem" className="danger" onClick={() => { setFileMenuOpen(false); resetToInitial(); }}><RotateCcw size={16} />Сбросить к примеру</button>
              </div>
            ) : null}
          </div>
          <button type="button" className="btn btn-primary" onClick={savePlan} title="Ctrl+S">
            <Save size={16} />
            <span className="btn-label">{copyState === "done" ? "Сохранено" : "Сохранить"}</span>
          </button>
        </header>

        <div className="ed-toolbar" role="toolbar" aria-label="Инструменты">
          <div className="tool-group">
            <button type="button" className="icon-btn" title="Отменить · Ctrl+Z" onClick={undoLastAction} disabled={!undoStack.length}><Undo2 size={16} /></button>
            <button type="button" className="icon-btn" title="Повторить · Ctrl+Shift+Z" onClick={redoLastAction} disabled={!redoStack.length}><Redo2 size={16} /></button>
          </div>
          <div className="tool-group">
            <button type="button" className="icon-btn" title="Копировать · Ctrl+C" onClick={copySelected} disabled={!objectSelected}><Copy size={16} /></button>
            <button type="button" className="icon-btn" title="Вырезать · Ctrl+X" onClick={cutSelected} disabled={!objectSelected}><Scissors size={16} /></button>
            <button type="button" className="icon-btn" title="Вставить · Ctrl+V" onClick={pasteClipboard} disabled={!clipboardItem}><ClipboardPaste size={16} /></button>
            <button type="button" className="icon-btn" title="Дублировать · Ctrl+D" onClick={duplicateSelected} disabled={!objectSelected}><CopyPlus size={16} /></button>
          </div>
          <div className="tool-group segmented" role="group" aria-label="Режим">
            <button type="button" className={toolMode === "select" ? "is-active" : ""} onClick={() => setToolMode("select")}><MousePointer2 size={16} />Выбор</button>
            <button type="button" className={toolMode === "delete" ? "is-active is-danger" : ""} onClick={() => setToolMode(toolMode === "delete" ? "select" : "delete")}><Eraser size={16} />Удаление</button>
          </div>
          <label className="tool-toggle" title="Разрешить зданиям заходить на дороги">
            <input type="checkbox" checked={ignoreRoads} onChange={(event) => setIgnoreRoads(event.target.checked)} />
            Через дороги
          </label>
          <div className="tool-spacer" />
          <div className="tool-group tool-add">
            <button type="button" className="btn" onClick={addZone}><SquareDashed size={16} />Зона</button>
            <button type="button" className="btn" onClick={() => createRoad(false)}><Spline size={16} />Дорога</button>
            <button type="button" className="btn" onClick={() => addObject("rect")}><Building2 size={16} />Здание</button>
            <button type="button" className="btn" onClick={() => addObject("park")}><Trees size={16} />Парк</button>
          </div>
          <div className="menu-anchor" ref={addMenuRef}>
            <button type="button" className="btn btn-accent" aria-expanded={addMenuOpen} onClick={() => setAddMenuOpen((open) => !open)}>
              <Plus size={16} />
              Каталог
            </button>
            {addMenuOpen ? (
              <div className="menu menu-catalog" role="dialog" aria-label="Каталог объектов">
                <div className="catalog-row">
                  <button type="button" onClick={addZone}><SquareDashed size={16} />Зона</button>
                  <button type="button" onClick={() => createRoad(false)}><Spline size={16} />Дорога</button>
                  <button type="button" onClick={() => createRoad(true)}><Route size={16} />Магистраль</button>
                  <button type="button" onClick={addGate}><DoorOpen size={16} />Ворота</button>
                </div>
                {formGroups.map(({ group, forms }) => (
                  <section key={group} className="catalog-group">
                    <h3>{group}</h3>
                    <div className="form-grid">
                      {forms.map((entry) => (
                        <button key={entry.form} type="button" className="form-tile" onClick={() => addObject(entry.form)}>
                          <FormThumb form={entry.form} color={selectedZone?.color ?? "#7dd3fc"} />
                          <span>{entry.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="board editor-board" onPointerDownCapture={() => { fieldEditArmedRef.current = false; }}>
          <div className={`canvas-stage${toolMode === "delete" ? " is-deleting" : ""}`} style={{ ["--canvas-zoom" as string]: String(zoomLevel) }}>
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

            <Junctions junctions={junctions} />

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

            <River />

            {overlays.showLegend ? <Legend mapState={mapState} selected={selectedOverlay === "legend"} onPointerDown={handleOverlayDragStart} /> : null}

            <CompassAndScale />

            {overlays.showTitleStamp ? <TitleStamp mapState={mapState} selected={selectedOverlay === "stamp"} onPointerDown={handleOverlayDragStart} /> : null}

            {selectedBuilding ? <SelectionFrame x={selectedBuilding.x} y={selectedBuilding.y} width={selectedBuilding.width} height={selectedBuilding.height} rotation={selectedBuilding.rotation} /> : null}
            {selectedGate ? <SelectionFrame x={selectedGate.x} y={selectedGate.y} width={selectedGate.width} height={selectedGate.height} rotation={selectedGate.rotation} /> : null}
            {selectedZone && zoneEditMode !== "zone-resize" ? <SelectionFrame x={selectedZone.x} y={selectedZone.y} width={selectedZone.width} height={selectedZone.height} /> : null}

            {selectedRoad ? (
              <g>
                {selectedRoad.points.map((point, index) => (
                  <circle key={`${selectedRoad.id}-${index}`} cx={point.x} cy={point.y} r={9} fill="#0b1520" stroke="#7dd3fc" strokeWidth={3} style={{ cursor: "grab", touchAction: "none" }} onPointerDown={(event) => handleRoadPointDragStart(event, selectedRoad, index)} />
                ))}
              </g>
            ) : null}

            {selectedZone && zoneEditMode === "zone-resize" ? (
              <g>
                {getZoneHandles(selectedZone).map((handle) => (
                  <rect key={handle.handle} x={handle.x - 8} y={handle.y - 8} width={16} height={16} rx={3} fill="#0b1520" stroke="#7dd3fc" strokeWidth={2.5} style={{ cursor: handle.cursor, touchAction: "none" }} onPointerDown={(event) => handleZoneHandleDragStart(event, selectedZone, handle.handle)} />
                ))}
              </g>
            ) : null}
            </svg>
          </div>
        </div>
      </div>

      <aside className="editor-panel" onFocusCapture={() => { fieldEditArmedRef.current = true; }} onPointerDownCapture={() => { fieldEditArmedRef.current = true; }}>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />

        <div className="panel-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={inspectorOpen} className={inspectorOpen ? "is-active" : ""} onClick={() => setPanelSection(selected && selected.kind !== "overlay" ? selected.kind : "building")}>Свойства</button>
          <button type="button" role="tab" aria-selected={activeSection === "service"} className={activeSection === "service" ? "is-active" : ""} onClick={() => setPanelSection("service")}>Карта</button>
          <button type="button" role="tab" aria-selected={activeSection === "library"} className={activeSection === "library" ? "is-active" : ""} onClick={() => setPanelSection("library")}>Объекты</button>
        </div>

        <div className="panel-inner">
        {selectedZone && activeSection === "zone" ? (
          <section className="inspector">
            <div className="inspector-head">
              <span className="inspector-kind" style={{ ["--kind-color" as string]: selectedZone.color }}>Зона</span>
              <button type="button" className="icon-btn danger" title="Удалить зону вместе со зданиями" onClick={() => removeSelectedTarget({ kind: "zone", id: selectedZone.id })}><Trash2 size={16} /></button>
            </div>
            <label className="field"><span>Название</span><input data-label-field value={selectedZone.title} onChange={(event) => updateZone(selectedZone.id, "title", event.target.value)} /></label>
            {colorField(selectedZone.color, (value) => updateZone(selectedZone.id, "color", value))}
            <div className="field">
              <span>На карте</span>
              <div className="segmented segmented-wrap">
                <button type="button" className={zoneEditMode === "none" ? "is-active" : ""} onClick={() => setZoneEditMode("none")}>Закреплена</button>
                <button type="button" className={zoneEditMode === "zone-only-move" ? "is-active" : ""} onClick={() => setZoneEditMode("zone-only-move")}>Двигать</button>
                <button type="button" className={zoneEditMode === "zone-with-buildings" ? "is-active" : ""} onClick={() => setZoneEditMode("zone-with-buildings")}>Со зданиями</button>
                <button type="button" className={zoneEditMode === "zone-resize" ? "is-active" : ""} onClick={() => setZoneEditMode("zone-resize")}>Размер</button>
              </div>
            </div>
            <div className="field-grid">
              {numberField("X", selectedZone.x, (value) => updateZone(selectedZone.id, "x", value))}
              {numberField("Y", selectedZone.y, (value) => updateZone(selectedZone.id, "y", value))}
              {numberField("Ширина", selectedZone.width, (value) => updateZone(selectedZone.id, "width", value))}
              {numberField("Высота", selectedZone.height, (value) => updateZone(selectedZone.id, "height", value))}
            </div>
            <p className="hint">{buildings.filter((entry) => entry.zoneId === selectedZone.id).length} объектов в зоне</p>
          </section>
        ) : null}

        {selectedRoad && activeSection === "road" ? (
          <section className="inspector">
            <div className="inspector-head">
              <span className="inspector-kind">{selectedRoad.major ? "Магистраль" : "Дорога"}</span>
              <button type="button" className="icon-btn danger" title="Удалить дорогу" onClick={() => removeSelectedTarget({ kind: "road", id: selectedRoad.id })}><Trash2 size={16} /></button>
            </div>
            <label className="field"><span>Подпись</span><input data-label-field value={selectedRoad.label ?? ""} onChange={(event) => updateRoad(selectedRoad.id, "label", event.target.value)} /></label>
            <div className="field">
              <span>Тип</span>
              <div className="segmented">
                <button type="button" className={!selectedRoad.major ? "is-active" : ""} onClick={() => updateRoad(selectedRoad.id, "major", false)}>Улица</button>
                <button type="button" className={selectedRoad.major ? "is-active" : ""} onClick={() => updateRoad(selectedRoad.id, "major", true)}>Магистраль</button>
              </div>
            </div>
            <label className="field">
              <span>Ширина · {selectedRoad.width}</span>
              <input type="range" min={8} max={60} step={2} value={selectedRoad.width} onChange={(event) => updateRoad(selectedRoad.id, "width", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Точки маршрута</span>
              <textarea rows={3} value={selectedRoad.points.map((point) => `${point.x},${point.y}`).join(" | ")} onChange={(event) => {
                const parsed = parsePoints(event.target.value);
                if (parsed) updateRoad(selectedRoad.id, "points", parsed);
              }} />
            </label>
            <p className="hint">Формат «x,y | x,y». Точки можно тянуть прямо на карте.</p>
          </section>
        ) : null}

        {selectedBuilding && activeSection === "building" ? (
          <section className="inspector">
            <div className="inspector-head">
              <span className="inspector-kind" style={{ ["--kind-color" as string]: selectedBuilding.color }}>{formLabel(selectedBuilding.form)}</span>
              <span className="inspector-zone">{selectedZoneTitle}</span>
              <button type="button" className="icon-btn" title="Дублировать · Ctrl+D" onClick={duplicateSelected}><CopyPlus size={16} /></button>
              <button type="button" className="icon-btn danger" title="Удалить · Del" onClick={() => removeSelectedTarget({ kind: "building", id: selectedBuilding.id })}><Trash2 size={16} /></button>
            </div>
            <label className="field"><span>Подпись</span><input data-label-field value={selectedBuilding.label} onChange={(event) => updateBuilding(selectedBuilding.id, "label", event.target.value)} /></label>
            <div className="field">
              <span>Форма</span>
              <div className="form-picker">
                {formGroups.map(({ group, forms }) => (
                  <div key={group} className="form-grid form-grid-compact" role="radiogroup" aria-label={group}>
                    {forms.map((entry) => (
                      <button
                        key={entry.form}
                        type="button"
                        role="radio"
                        aria-checked={selectedBuilding.form === entry.form}
                        title={entry.label}
                        className={`form-tile${selectedBuilding.form === entry.form ? " is-active" : ""}`}
                        onClick={() => setBuildingForm(selectedBuilding.id, entry.form)}
                      >
                        <FormThumb form={entry.form} color={selectedBuilding.color} />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {colorField(selectedBuilding.color, (value) => updateBuilding(selectedBuilding.id, "color", value))}
            <div className="field-grid">
              {numberField("X", selectedBuilding.x, (value) => updateBuilding(selectedBuilding.id, "x", value))}
              {numberField("Y", selectedBuilding.y, (value) => updateBuilding(selectedBuilding.id, "y", value))}
              {numberField("Ширина", selectedBuilding.width, (value) => updateBuilding(selectedBuilding.id, "width", value))}
              {numberField("Высота", selectedBuilding.height, (value) => updateBuilding(selectedBuilding.id, "height", value))}
            </div>
            <label className="field">
              <span>Поворот · {normalizeAngle(selectedBuilding.rotation)}°</span>
              <input type="range" min={0} max={360} step={5} value={normalizeAngle(selectedBuilding.rotation)} onChange={(event) => updateBuilding(selectedBuilding.id, "rotation", Number(event.target.value))} />
            </label>
            <div className="chips">{[0, 15, 45, 90, 180].map((angle) => (<button key={angle} type="button" className={normalizeAngle(selectedBuilding.rotation) === angle ? "is-active" : ""} onClick={() => updateBuilding(selectedBuilding.id, "rotation", angle)}>{angle}°</button>))}</div>
            <div className="field-grid">
              {(selectedBuilding.form === "l" || selectedBuilding.form === "corner-block") ? (<>{numberField("Вырез X", selectedBuilding.cutWidth ?? 50, (value) => updateBuilding(selectedBuilding.id, "cutWidth", value))}{numberField("Вырез Y", selectedBuilding.cutHeight ?? 40, (value) => updateBuilding(selectedBuilding.id, "cutHeight", value))}</>) : null}
              {selectedBuilding.form === "u" ? (<>{numberField("Ширина проёма", selectedBuilding.gapWidth ?? 50, (value) => updateBuilding(selectedBuilding.id, "gapWidth", value))}{numberField("Глубина проёма", selectedBuilding.gapDepth ?? 40, (value) => updateBuilding(selectedBuilding.id, "gapDepth", value))}</>) : null}
              {selectedBuilding.form === "oct" ? numberField("Радиус", selectedBuilding.radius ?? 30, (value) => updateBuilding(selectedBuilding.id, "radius", value)) : null}
              {selectedBuilding.form === "t" ? (<>{numberField("Ширина стойки", selectedBuilding.neckWidth ?? 50, (value) => updateBuilding(selectedBuilding.id, "neckWidth", value))}{numberField("Глубина перекладины", selectedBuilding.wingDepth ?? 40, (value) => updateBuilding(selectedBuilding.id, "wingDepth", value))}</>) : null}
              {selectedBuilding.form === "courtyard" ? numberField("Отступ двора", selectedBuilding.innerInset ?? 20, (value) => updateBuilding(selectedBuilding.id, "innerInset", value)) : null}
              {selectedBuilding.form === "trapezoid" ? numberField("Верхняя ширина", selectedBuilding.topWidth ?? Math.round(selectedBuilding.width * 0.72), (value) => updateBuilding(selectedBuilding.id, "topWidth", value)) : null}
              {(selectedBuilding.form === "segmented-bar" || selectedBuilding.form === "terrace") ? numberField("Секций", selectedBuilding.segmentCount ?? (selectedBuilding.form === "terrace" ? 5 : 4), (value) => updateBuilding(selectedBuilding.id, "segmentCount", value), { min: 2 }) : null}
              {(selectedBuilding.form === "depot" || selectedBuilding.form === "sawtooth") ? numberField("Пролётов", selectedBuilding.bayCount ?? 4, (value) => updateBuilding(selectedBuilding.id, "bayCount", value), { min: 2 }) : null}
            </div>
            <p className="hint">Сетка 10 px. Стрелки двигают объект, Shift — на 50 px.</p>
          </section>
        ) : null}

        {selectedGate && activeSection === "gate" ? (
          <section className="inspector">
            <div className="inspector-head">
              <span className="inspector-kind">Ворота</span>
              <button type="button" className="icon-btn danger" title="Удалить ворота" onClick={() => removeSelectedTarget({ kind: "gate", id: selectedGate.id })}><Trash2 size={16} /></button>
            </div>
            <label className="field"><span>Подпись</span><input data-label-field value={selectedGate.label} onChange={(event) => updateGate(selectedGate.id, "label", event.target.value)} /></label>
            <div className="field-grid">
              {numberField("X", selectedGate.x, (value) => updateGate(selectedGate.id, "x", value))}
              {numberField("Y", selectedGate.y, (value) => updateGate(selectedGate.id, "y", value))}
              {numberField("Ширина", selectedGate.width, (value) => updateGate(selectedGate.id, "width", value))}
              {numberField("Высота", selectedGate.height, (value) => updateGate(selectedGate.id, "height", value))}
            </div>
            <label className="field">
              <span>Поворот · {normalizeAngle(selectedGate.rotation)}°</span>
              <input type="range" min={0} max={360} step={5} value={normalizeAngle(selectedGate.rotation)} onChange={(event) => updateGate(selectedGate.id, "rotation", Number(event.target.value))} />
            </label>
          </section>
        ) : null}

        {inspectorOpen && !objectSelected ? (
          <div className="panel-empty">
            <p>Выберите объект на карте или добавьте новый из каталога.</p>
            <button type="button" className="btn btn-accent" onClick={() => setAddMenuOpen(true)}><Plus size={16} />Открыть каталог</button>
          </div>
        ) : null}

        {activeSection === "service" ? (
          <section className="inspector">
            <label className="field"><span>Название карты</span><input value={mapState.title} onChange={(event) => { rememberFieldEdit(); setMapState((current) => ({ ...current, title: event.target.value })); }} /></label>
            <div className="field">
              <span>Сохранённые версии</span>
              <select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
                <option value="">{savedVersions.length ? "Выберите версию" : "Пока нет сохранений"}</option>
                {savedVersions.map((version) => (
                  <option key={version.id} value={version.id}>{version.label}</option>
                ))}
              </select>
              <div className="row-actions">
                <button type="button" className="btn" onClick={savePlan}><Save size={16} />Сохранить версию</button>
                <button type="button" className="btn" onClick={loadSelectedVersion} disabled={!selectedVersionId}><History size={16} />Открыть</button>
              </div>
            </div>
            <label className="check"><input type="checkbox" checked={overlays.showLegend} onChange={(event) => { rememberFieldEdit(); setMapState((current) => ({ ...current, overlays: { ...current.overlays, showLegend: event.target.checked } })); }} />Легенда районов</label>
            <label className="check"><input type="checkbox" checked={overlays.showTitleStamp} onChange={(event) => { rememberFieldEdit(); setMapState((current) => ({ ...current, overlays: { ...current.overlays, showTitleStamp: event.target.checked } })); }} />Штамп чертежа</label>
            <div className="field-grid">
              {numberField("Легенда X", overlays.legendPosition.x, (value) => updateOverlayPosition("legend", { ...overlays.legendPosition, x: value }))}
              {numberField("Легенда Y", overlays.legendPosition.y, (value) => updateOverlayPosition("legend", { ...overlays.legendPosition, y: value }))}
              {numberField("Штамп X", overlays.stampPosition.x, (value) => updateOverlayPosition("stamp", { ...overlays.stampPosition, x: value }))}
              {numberField("Штамп Y", overlays.stampPosition.y, (value) => updateOverlayPosition("stamp", { ...overlays.stampPosition, y: value }))}
            </div>
            <div className="field">
              <span>Клавиши</span>
              <dl className="hotkeys">
                <dt><kbd>Ctrl</kbd><kbd>S</kbd></dt><dd>Сохранить версию</dd>
                <dt><kbd>Ctrl</kbd><kbd>Z</kbd></dt><dd>Отменить</dd>
                <dt><kbd>Ctrl</kbd><kbd>C</kbd> <kbd>X</kbd> <kbd>V</kbd></dt><dd>Копировать, вырезать, вставить</dd>
                <dt><kbd>Ctrl</kbd><kbd>D</kbd></dt><dd>Дублировать</dd>
                <dt><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd></dt><dd>Сдвиг на 10 px, с Shift — на 50</dd>
                <dt><kbd>Del</kbd></dt><dd>Удалить</dd>
              </dl>
            </div>
          </section>
        ) : null}

        <section className="inspector library" hidden={activeSection !== "library"}>
          <label className="field search-field">
            <Search size={16} />
            <input type="search" value={libraryQuery} placeholder="Поиск по названию" aria-label="Поиск по названию" onChange={(event) => setLibraryQuery(event.target.value)} />
          </label>
          {libraryGroups.map((group) => (
            <div key={group.title} className="library-group">
              <div className="library-group-title">{group.title}<span>{group.items.length}</span></div>
              {group.items.map((item) => (
                <button key={item.target.id} type="button" className={selected?.kind === item.target.kind && selected.id === item.target.id ? "is-active" : ""} onClick={() => { setSelected(item.target); setPanelSection(item.target.kind as PanelSection); }}>{item.label}</button>
              ))}
            </div>
          ))}
          {!libraryGroups.length ? <p className="hint">Ничего не найдено</p> : null}
        </section>
        </div>
      </aside>
    </div>
  );
}
