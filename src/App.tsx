import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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

type SelectedTarget =
  | { kind: "zone"; id: string }
  | { kind: "road"; id: string }
  | { kind: "building"; id: string }
  | { kind: "gate"; id: string }
  | { kind: "overlay"; id: OverlayId };

type PanelSection = "zone" | "road" | "building" | "gate" | "service" | "library";
type ToolMode = "select" | "delete";
type ZoneEditMode = "none" | "zone-only-move" | "zone-with-buildings" | "zone-resize";
type ZoneHandle = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

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

type SavedVersion = {
  id: string;
  label: string;
  createdAt: string;
  data: MapState;
};

type ClipboardItem =
  | { kind: "building"; building: BuildingData }
  | { kind: "road"; road: RoadData }
  | { kind: "zone"; zone: ZoneData; buildings: BuildingData[] }
  | { kind: "gate"; gate: GateData };

const textStyle = {
  fontFamily: "IBM Plex Mono, Fira Code, Consolas, monospace",
  letterSpacing: 1.2,
};

const GRID_STEP = 10;
const STATE_KEY = "city-techplan-map-state-v2";
const HISTORY_KEY = "city-techplan-map-history-v2";
const SHARE_PARAM = "map";
const MIN_ZONE_SIZE = 120;

const snap = (value: number) => Math.round(value / GRID_STEP) * GRID_STEP;
const zoneFill = (color: string) => `${color}22`;

function intersects(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function buildingHitsRoads(candidate: { x: number; y: number; width: number; height: number }, roads: RoadData[]) {
  return roads.some((road) => {
    const xs = road.points.map((point) => point.x);
    const ys = road.points.map((point) => point.y);
    const padding = road.width / 2 + 8;
    const roadBox = {
      x: Math.min(...xs) - padding,
      y: Math.min(...ys) - padding,
      width: Math.max(...xs) - Math.min(...xs) + padding * 2,
      height: Math.max(...ys) - Math.min(...ys) + padding * 2,
    };
    return intersects(candidate, roadBox);
  });
}

function parsePoints(value: string): Point[] | null {
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

function encodeMapState(mapState: MapState) {
  const json = JSON.stringify(mapState);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeMapState(encoded: string): MapState | null {
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

function ensureMapState(value: unknown): MapState {
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

function resizeZone(origin: { x: number; y: number; width: number; height: number }, handle: ZoneHandle, dx: number, dy: number) {
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

function ZoneBlock({
  zone,
  selected,
  onSelect,
  onPointerDown,
}: {
  zone: ZoneData;
  selected: boolean;
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent<SVGGElement>, zone: ZoneData) => void;
}) {
  return (
    <g onClick={onSelect} onPointerDown={(event) => onPointerDown(event, zone)} style={{ cursor: "pointer" }}>
      <rect
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        rx={18}
        fill={zoneFill(zone.color)}
        stroke={selected ? "#f8fafc" : zone.color}
        strokeWidth={selected ? 4 : 3}
        strokeDasharray="14 8"
      />
      <text x={zone.x + 18} y={zone.y + 28} fill={zone.color} fontSize={20} fontWeight={700} style={textStyle}>
        {zone.title}
      </text>
    </g>
  );
}

function Road({
  road,
  selected,
  onSelect,
  onDragStart,
}: {
  road: RoadData;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (event: React.PointerEvent<SVGGElement>, road: RoadData) => void;
}) {
  const d = road.points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const midPoint = road.points[Math.floor(road.points.length / 2)];
  return (
    <g onClick={onSelect} onPointerDown={(event) => onDragStart(event, road)} style={{ cursor: "grab" }}>
      <path d={d} fill="none" stroke="#1f2937" strokeWidth={road.width + 10} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={selected ? "#94a3b8" : "#4a5568"} strokeWidth={road.width} strokeLinecap="round" strokeLinejoin="round" />
      {road.major ? (
        <path d={d} fill="none" stroke="#cbd5e1" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="22 18" />
      ) : null}
      {road.label ? (
        <text x={midPoint.x + 14} y={midPoint.y - 12} fill="#93a4b8" fontSize={12} style={textStyle}>
          {road.label}
        </text>
      ) : null}
    </g>
  );
}

function Gate({
  gate,
  selected,
  onSelect,
  onPointerDown,
}: {
  gate: GateData;
  selected: boolean;
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent<SVGGElement>, gate: GateData) => void;
}) {
  const centerX = gate.x + gate.width / 2;
  const centerY = gate.y + gate.height / 2;
  const transform = gate.rotation ? `rotate(${gate.rotation} ${centerX} ${centerY})` : undefined;

  return (
    <g onClick={onSelect} onPointerDown={(event) => onPointerDown(event, gate)} style={{ cursor: "grab" }}>
      <g transform={transform}>
        <rect x={gate.x + gate.width * 0.2} y={gate.y + gate.height * 0.3} width={gate.width * 0.6} height={gate.height * 0.5} fill="#2b1b12" stroke={selected ? "#f8fafc" : "#c08457"} strokeWidth={2} />
        <polygon
          points={`${gate.x},${gate.y + gate.height * 0.3} ${gate.x + gate.width},${gate.y + gate.height * 0.3} ${gate.x + gate.width / 2},${gate.y}`}
          fill="#4b2e1b"
          stroke={selected ? "#f8fafc" : "#c08457"}
          strokeWidth={2}
        />
      </g>
      <text x={gate.x + (gate.textDx ?? gate.width + 18)} y={gate.y + (gate.textDy ?? gate.height * 0.72)} fill="#e5e7eb" fontSize={12} style={textStyle}>
        {gate.label}
      </text>
    </g>
  );
}

function BuildingShape({
  building,
  hovered,
  selected,
  onEnter,
  onLeave,
  onSelect,
  onDragStart,
}: {
  building: BuildingData;
  hovered: boolean;
  selected: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onSelect: () => void;
  onDragStart: (event: React.PointerEvent<SVGGElement>, building: BuildingData) => void;
}) {
  const stroke = selected ? "#f8fafc" : building.color;
  const fill = hovered || selected ? `${building.color}55` : `${building.color}2f`;
  const textX = building.textX ?? building.x + building.width / 2;
  const textY = building.textY ?? building.y + building.height / 2;
  const centerX = building.x + building.width / 2;
  const centerY = building.y + building.height / 2;
  const rotation = building.rotation ?? 0;
  const groupTransform = rotation ? `rotate(${rotation} ${centerX} ${centerY})` : undefined;

  const commonProps = {
    onMouseEnter: () => onEnter(building.id),
    onMouseLeave: onLeave,
    onClick: onSelect,
    onPointerDown: (event: React.PointerEvent<SVGGElement>) => onDragStart(event, building),
    style: { cursor: "grab" },
  };

  if (building.form === "rect") {
    return (
      <g {...commonProps} transform={groupTransform}>
        {building.doubleFrame ? (
          <rect x={building.x - 8} y={building.y - 8} width={building.width + 16} height={building.height + 16} fill="none" stroke={building.color} strokeWidth={2} />
        ) : null}
        <rect x={building.x} y={building.y} width={building.width} height={building.height} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <text x={textX} y={textY} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "l") {
    const path = [
      `M ${building.x} ${building.y}`,
      `L ${building.x + building.width} ${building.y}`,
      `L ${building.x + building.width} ${building.y + (building.cutHeight ?? 40)}`,
      `L ${building.x + (building.cutWidth ?? 50)} ${building.y + (building.cutHeight ?? 40)}`,
      `L ${building.x + (building.cutWidth ?? 50)} ${building.y + building.height}`,
      `L ${building.x} ${building.y + building.height}`,
      "Z",
    ].join(" ");

    return (
      <g {...commonProps} transform={groupTransform}>
        <path d={path} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <text x={textX} y={textY} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "u") {
    const gapWidth = building.gapWidth ?? Math.round(building.width * 0.35);
    const gapDepth = building.gapDepth ?? Math.round(building.height * 0.45);
    const sideWidth = (building.width - gapWidth) / 2;
    const path = [
      `M ${building.x} ${building.y + building.height}`,
      `L ${building.x} ${building.y}`,
      `L ${building.x + building.width} ${building.y}`,
      `L ${building.x + building.width} ${building.y + building.height}`,
      `L ${building.x + building.width - sideWidth} ${building.y + building.height}`,
      `L ${building.x + building.width - sideWidth} ${building.y + gapDepth}`,
      `L ${building.x + sideWidth} ${building.y + gapDepth}`,
      `L ${building.x + sideWidth} ${building.y + building.height}`,
      "Z",
    ].join(" ");

    return (
      <g {...commonProps} transform={groupTransform}>
        <path d={path} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <text x={textX} y={textY + 10} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "t") {
    const neckWidth = building.neckWidth ?? Math.round(building.width * 0.36);
    const wingDepth = building.wingDepth ?? Math.round(building.height * 0.42);
    const neckX = building.x + (building.width - neckWidth) / 2;
    const path = [
      `M ${building.x} ${building.y}`,
      `L ${building.x + building.width} ${building.y}`,
      `L ${building.x + building.width} ${building.y + wingDepth}`,
      `L ${neckX + neckWidth} ${building.y + wingDepth}`,
      `L ${neckX + neckWidth} ${building.y + building.height}`,
      `L ${neckX} ${building.y + building.height}`,
      `L ${neckX} ${building.y + wingDepth}`,
      `L ${building.x} ${building.y + wingDepth}`,
      "Z",
    ].join(" ");

    return (
      <g {...commonProps} transform={groupTransform}>
        <path d={path} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <text x={textX} y={textY} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "courtyard") {
    const inset = building.innerInset ?? Math.round(Math.min(building.width, building.height) * 0.22);
    return (
      <g {...commonProps} transform={groupTransform}>
        <rect x={building.x} y={building.y} width={building.width} height={building.height} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <rect x={building.x + inset} y={building.y + inset} width={Math.max(16, building.width - inset * 2)} height={Math.max(16, building.height - inset * 2)} fill="#0f1a25" stroke={stroke} strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={textX} y={textY} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "trapezoid") {
    const topWidth = building.topWidth ?? Math.round(building.width * 0.72);
    const offset = (building.width - topWidth) / 2;
    const points = [
      `${building.x + offset},${building.y}`,
      `${building.x + offset + topWidth},${building.y}`,
      `${building.x + building.width},${building.y + building.height}`,
      `${building.x},${building.y + building.height}`,
    ].join(" ");
    return (
      <g {...commonProps} transform={groupTransform}>
        <polygon points={points} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <text x={textX} y={textY} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "rotunda") {
    const rx = building.width / 2;
    const ry = building.height / 2;
    const cx = building.x + rx;
    const cy = building.y + ry;
    return (
      <g {...commonProps} transform={groupTransform}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <ellipse cx={cx} cy={cy} rx={Math.max(12, rx * 0.45)} ry={Math.max(10, ry * 0.45)} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={textX} y={textY} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "corner-block") {
    const cutWidth = building.cutWidth ?? Math.round(building.width * 0.55);
    const cutHeight = building.cutHeight ?? Math.round(building.height * 0.45);
    const path = [
      `M ${building.x} ${building.y}`,
      `L ${building.x + building.width} ${building.y}`,
      `L ${building.x + building.width} ${building.y + cutHeight}`,
      `L ${building.x + cutWidth} ${building.y + cutHeight}`,
      `L ${building.x + cutWidth} ${building.y + building.height}`,
      `L ${building.x} ${building.y + building.height}`,
      "Z",
    ].join(" ");
    return (
      <g {...commonProps} transform={groupTransform}>
        <path d={path} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <text x={textX} y={textY} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "segmented-bar") {
    const segmentCount = Math.max(2, building.segmentCount ?? 4);
    const segmentWidth = building.width / segmentCount;
    return (
      <g {...commonProps} transform={groupTransform}>
        <rect x={building.x} y={building.y} width={building.width} height={building.height} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        {Array.from({ length: segmentCount - 1 }, (_, index) => (
          <line key={index} x1={building.x + segmentWidth * (index + 1)} y1={building.y + 3} x2={building.x + segmentWidth * (index + 1)} y2={building.y + building.height - 3} stroke={stroke} strokeWidth={1.5} opacity={0.8} />
        ))}
        <text x={textX} y={textY} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "depot") {
    const bayCount = Math.max(2, building.bayCount ?? 4);
    const bayWidth = building.width / bayCount;
    return (
      <g {...commonProps} transform={groupTransform}>
        <rect x={building.x} y={building.y} width={building.width} height={building.height} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        {Array.from({ length: bayCount }, (_, index) => (
          <rect key={index} x={building.x + bayWidth * index + 3} y={building.y + building.height * 0.45} width={Math.max(8, bayWidth - 6)} height={building.height * 0.45 - 3} fill="none" stroke={stroke} strokeWidth={1.4} />
        ))}
        <text x={textX} y={building.y + building.height * 0.28} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "sawtooth") {
    const bayCount = Math.max(3, building.bayCount ?? 4);
    const bayWidth = building.width / bayCount;
    const roofY = building.y + building.height * 0.35;
    const points = [
      `${building.x},${building.y + building.height}`,
      `${building.x},${roofY}`,
      ...Array.from({ length: bayCount }, (_, index) => {
        const left = building.x + bayWidth * index;
        const peak = left + bayWidth * 0.45;
        const right = left + bayWidth;
        return `${peak},${building.y} ${right},${roofY}`;
      }).join(" ").split(" "),
      `${building.x + building.width},${building.y + building.height}`,
    ].join(" ");
    return (
      <g {...commonProps} transform={groupTransform}>
        <polygon points={points} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <text x={textX} y={building.y + building.height * 0.68} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "cemetery") {
    return (
      <g {...commonProps} transform={groupTransform}>
        <rect x={building.x} y={building.y} width={building.width} height={building.height} fill="#20161a" stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <line x1={building.x + 14} y1={building.y + 14} x2={building.x + building.width - 12} y2={building.y + building.height - 10} stroke="#cbd5e1" strokeWidth={2} opacity={0.6} />
        <line x1={building.x + building.width - 12} y1={building.y + 14} x2={building.x + 14} y2={building.y + building.height - 10} stroke="#cbd5e1" strokeWidth={2} opacity={0.6} />
        <line x1={building.x + building.width / 2} y1={building.y + 14} x2={building.x + building.width / 2} y2={building.y + building.height - 10} stroke="#cbd5e1" strokeWidth={2} opacity={0.6} />
        <line x1={building.x + 8} y1={building.y + building.height / 2} x2={building.x + building.width - 6} y2={building.y + building.height / 2} stroke="#cbd5e1" strokeWidth={2} opacity={0.6} />
        <text x={textX} y={building.y + building.height + 16} fill="#fecaca" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "plaza") {
    const cx = building.x + building.width / 2;
    const cy = building.y + building.height / 2;
    const radius = Math.min(building.width, building.height) / 2;
    return (
      <g {...commonProps} transform={groupTransform}>
        <circle cx={cx} cy={cy} r={radius} fill="#083141" stroke={stroke} strokeWidth={selected ? 3 : 2} strokeDasharray="10 8" />
        <circle cx={cx} cy={cy} r={34} fill="#0c4a5d" stroke="#a5f3fc" strokeWidth={3} />
        <circle cx={cx} cy={cy} r={12} fill="#d8fafe" />
        <text x={cx} y={building.y + building.height + 18} fill="#91efff" fontSize={12} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "buffer-strip") {
    return (
      <g {...commonProps} transform={groupTransform}>
        <rect x={building.x} y={building.y} width={building.width} height={building.height} fill={building.color} stroke={selected ? "#f8fafc" : "#365314"} strokeWidth={selected ? 3 : 1.5} opacity={0.92} />
      </g>
    );
  }

  if (building.form === "park") {
    return (
      <g {...commonProps} transform={groupTransform}>
        <rect x={building.x} y={building.y} width={building.width} height={building.height} rx={10} fill="#153728" stroke={stroke} strokeWidth={selected ? 3 : 2} />
        <circle cx={building.x + 24} cy={building.y + 24} r={10} fill="#214d3a" stroke="#86efac" strokeWidth={1.2} />
        <circle cx={building.x + building.width - 28} cy={building.y + 22} r={9} fill="#214d3a" stroke="#86efac" strokeWidth={1.2} />
        <circle cx={building.x + building.width / 2} cy={building.y + building.height - 18} r={11} fill="#214d3a" stroke="#86efac" strokeWidth={1.2} />
        <text x={textX} y={textY} fill="#dcfce7" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "tree-cluster") {
    const cols = Math.max(1, Math.floor(building.width / 28));
    const rows = Math.max(1, Math.floor(building.height / 28));
    return (
      <g {...commonProps} transform={groupTransform}>
        {Array.from({ length: rows }).map((_, row) =>
          Array.from({ length: cols }).map((__, col) => {
            const cx = building.x + 12 + col * 24;
            const cy = building.y + 12 + row * 24;
            return (
              <Fragment key={`${row}-${col}`}>
                <circle cx={cx} cy={cy} r={8} fill="#173a2e" stroke="#6ee7b7" strokeWidth={1.2} />
                <circle cx={cx + 6} cy={cy + 3} r={6} fill="#214d3a" stroke="#86efac" strokeWidth={1} />
              </Fragment>
            );
          }),
        )}
        <text x={textX} y={building.y + building.height + 14} fill="#bbf7d0" fontSize={10} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "harbor") {
    return (
      <g {...commonProps} transform={groupTransform}>
        <rect x={building.x} y={building.y} width={building.width} height={building.height} fill="#173728" stroke={stroke} strokeWidth={selected ? 3 : 2} rx={8} />
        <rect x={building.x + 14} y={building.y + 14} width={building.width - 28} height={40} fill="#0f1f18" stroke="#86efac" strokeWidth={1.4} />
        <text x={textX} y={building.y + 34} fill="#dcfce7" fontSize={16} textAnchor="middle" dominantBaseline="middle" style={textStyle}>ПОРТ</text>
        <text x={textX} y={building.y + building.height - 20} fill="#8df4d0" fontSize={12} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  if (building.form === "piers") {
    return (
      <g {...commonProps} transform={groupTransform}>
        <rect x={building.x} y={building.y} width={22} height={building.height} fill="#334155" stroke={selected ? "#f8fafc" : "#cbd5e1"} strokeWidth={selected ? 2.6 : 1.6} />
        {Array.from({ length: 4 }, (_, index) => {
          const pierY = building.y + 12 + index * 38;
          return (
            <g key={index}>
              <rect x={building.x + 22} y={pierY} width={building.width - 22} height={12} fill="#4b5563" stroke="#d5dde7" strokeWidth={1.2} rx={1.5} />
              <line x1={building.x + 42} y1={pierY} x2={building.x + 42} y2={pierY + 12} stroke="#e2e8f0" strokeWidth={1} opacity={0.7} />
              <line x1={building.x + 64} y1={pierY} x2={building.x + 64} y2={pierY + 12} stroke="#e2e8f0" strokeWidth={1} opacity={0.7} />
            </g>
          );
        })}
        <text x={textX} y={building.y + building.height + 14} fill="#cbd5e1" fontSize={10} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
          {building.label}
        </text>
      </g>
    );
  }

  const radius = building.radius ?? Math.round(Math.min(building.width, building.height) / 2);
  const cx = building.x + radius;
  const cy = building.y + radius;
  const points = Array.from({ length: 8 }, (_, index) => {
    const angle = (Math.PI / 4) * index + Math.PI / 8;
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
  }).join(" ");

  return (
    <g {...commonProps} transform={groupTransform}>
      <polygon points={points} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
      <text x={textX ?? cx} y={textY ?? cy} fill="#ecf3fb" fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle}>
        {building.label}
      </text>
    </g>
  );
}

export default function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragSnapshotRef = useRef<MapState | null>(null);
  const dragChangedRef = useRef(false);
  const [mapState, setMapState] = useState<MapState>(() => cloneMapState(initialMapState));
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedTarget | null>({ kind: "building", id: "palace" });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [zoneEditMode, setZoneEditMode] = useState<ZoneEditMode>("none");
  const [panelSection, setPanelSection] = useState<PanelSection>("service");
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [undoStack, setUndoStack] = useState<MapState[]>([]);
  const [redoStack, setRedoStack] = useState<MapState[]>([]);
  const [ignoreRoads, setIgnoreRoads] = useState(false);
  const [clipboardItem, setClipboardItem] = useState<ClipboardItem | null>(null);
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

  const legendZones = zones;
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

  const commitStateChange = (updater: () => void) => {
    setUndoStack((current) => [...current, createSnapshot()].slice(-40));
    setRedoStack([]);
    updater();
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

  const cutSelected = () => {
    if (!selected) return;

    if (selected.kind === "building") {
      const building = buildings.find((entry) => entry.id === selected.id);
      if (!building) return;
      setClipboardItem({ kind: "building", building: structuredClone(building) });
      removeSelectedTarget(selected);
      return;
    }

    if (selected.kind === "road") {
      const road = roads.find((entry) => entry.id === selected.id);
      if (!road) return;
      setClipboardItem({ kind: "road", road: structuredClone(road) });
      removeSelectedTarget(selected);
      return;
    }

    if (selected.kind === "gate") {
      const gate = gates.find((entry) => entry.id === selected.id);
      if (!gate) return;
      setClipboardItem({ kind: "gate", gate: structuredClone(gate) });
      removeSelectedTarget(selected);
      return;
    }

    if (selected.kind === "zone") {
      const zone = zones.find((entry) => entry.id === selected.id);
      if (!zone) return;
      const zoneBuildings = buildings.filter((entry) => entry.zoneId === zone.id);
      setClipboardItem({ kind: "zone", zone: structuredClone(zone), buildings: structuredClone(zoneBuildings) });
      removeSelectedTarget(selected);
    }
  };

  const pasteClipboard = () => {
    if (!clipboardItem) return;

    commitStateChange(() => {
      setMapState((current) => {
        if (clipboardItem.kind === "building") {
          const building = { ...structuredClone(clipboardItem.building), id: `building-${Date.now()}`, x: clipboardItem.building.x + 20, y: clipboardItem.building.y + 20 };
          setSelected({ kind: "building", id: building.id });
          setPanelSection("building");
          return { ...current, buildings: [...current.buildings, building] };
        }

        if (clipboardItem.kind === "road") {
          const road = { ...structuredClone(clipboardItem.road), id: `road-${Date.now()}`, points: clipboardItem.road.points.map((point) => ({ x: point.x + 20, y: point.y + 20 })) };
          setSelected({ kind: "road", id: road.id });
          setPanelSection("road");
          return { ...current, roads: [...current.roads, road] };
        }

        if (clipboardItem.kind === "gate") {
          const gate = { ...structuredClone(clipboardItem.gate), id: `gate-${Date.now()}`, x: clipboardItem.gate.x + 20, y: clipboardItem.gate.y + 20 };
          setSelected({ kind: "gate", id: gate.id });
          setPanelSection("gate");
          return { ...current, gates: [...current.gates, gate] };
        }

        const zoneId = `zone-${Date.now()}`;
        const zone = { ...structuredClone(clipboardItem.zone), id: zoneId, x: clipboardItem.zone.x + 20, y: clipboardItem.zone.y + 20 };
        const zoneBuildings = clipboardItem.buildings.map((building, index) => ({
          ...structuredClone(building),
          id: `building-${Date.now()}-${index}`,
          zoneId,
          x: building.x + 20,
          y: building.y + 20,
        }));
        setSelected({ kind: "zone", id: zone.id });
        setPanelSection("zone");
        return { ...current, zones: [...current.zones, zone], buildings: [...current.buildings, ...zoneBuildings] };
      });
    });
  };

  const updateZone = (id: string, key: keyof ZoneData, value: string | number) => {
    setMapState((current) => ({
      ...current,
      zones: current.zones.map((zone) => (zone.id === id ? { ...zone, [key]: value } : zone)),
    }));
  };

  const updateRoad = (id: string, key: keyof RoadData, value: string | number | boolean | Point[]) => {
    setMapState((current) => ({
      ...current,
      roads: current.roads.map((road) => (road.id === id ? { ...road, [key]: value } : road)),
    }));
  };

  const updateGate = (id: string, key: keyof GateData, value: string | number) => {
    setMapState((current) => ({
      ...current,
      gates: current.gates.map((gate) => (gate.id === id ? { ...gate, [key]: value } : gate)),
    }));
  };

  const updateOverlayPosition = (id: OverlayId, point: Point) => {
    setMapState((current) => ({
      ...current,
      overlays: {
        ...current.overlays,
        [id === "legend" ? "legendPosition" : "stampPosition"]: point,
      },
    }));
  };

  const updateBuilding = (id: string, key: keyof BuildingData, value: string | number | boolean) => {
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

          if (!ignoreRoads && buildingHitsRoads(candidate, current.roads)) {
            return building;
          }

          return { ...nextBuilding, ...candidate };
        }

        return nextBuilding;
      }),
    }));
  };

  const setBuildingForm = (id: string, form: BuildingForm) => {
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
    const nextHistory = [version, ...savedVersions].slice(0, 12);
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
    const load = async () => {
      const shared = new URLSearchParams(window.location.search).get(SHARE_PARAM);
      if (shared) {
        const parsedShared = decodeMapState(shared);
        if (parsedShared) {
          setMapState(parsedShared);
          persistSnapshot(parsedShared);
          return;
        }
      }

      const history = localStorage.getItem(HISTORY_KEY);
      const saved = localStorage.getItem(STATE_KEY);
      if (history) {
        try {
          const parsedHistory = JSON.parse(history) as SavedVersion[];
          setSavedVersions(parsedHistory);
          if (parsedHistory[0]) setSelectedVersionId(parsedHistory[0].id);
        } catch {
          // ignore broken history
        }
      }
      if (saved) {
        try {
          setMapState(ensureMapState(JSON.parse(saved)));
        } catch {
          // ignore broken saved state
        }
      }
    };

    void load();
  }, []);

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
            if (!ignoreRoads && buildingHitsRoads(candidate, current.roads)) return building;
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
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
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
  }, [selected, redoLastAction, savePlan, undoLastAction]);

  return (
    <div className="app-shell editor-shell">
      <div className="workspace-column">
        <header className="workspace-header">
          <div className="workspace-copy">
            <div className="workspace-kicker">Градостроительный редактор</div>
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
            <button type="button" onClick={cutSelected} disabled={!selected || selected.kind === "overlay"}>Вырезать</button>
            <button type="button" onClick={pasteClipboard} disabled={!clipboardItem}>Вставить</button>
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

        <div className="board editor-board">
          <div className="canvas-stage" style={{ ["--canvas-zoom" as string]: String(zoomLevel) }}>
            <svg ref={svgRef} viewBox="0 0 2200 1700" role="img" aria-label={mapState.title}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#264154" strokeWidth="1" opacity="0.35" />
              </pattern>
              <pattern id="micro-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1b2d3d" strokeWidth="0.6" opacity="0.5" />
              </pattern>
            </defs>

            <rect width="2200" height="1700" fill="#0f1a25" />
            <rect width="2200" height="1700" fill="url(#micro-grid)" />
            <rect width="2200" height="1700" fill="url(#grid)" />
            <rect x="50" y="50" width="2100" height="1600" fill="none" stroke="#5f748a" strokeWidth="3" />

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
                  <circle key={`${selectedRoad.id}-${index}`} cx={point.x} cy={point.y} r={10} fill="#f8fafc" stroke="#0f1a25" strokeWidth={3} style={{ cursor: "grab" }} onPointerDown={(event) => handleRoadPointDragStart(event, selectedRoad, index)} />
                ))}
              </g>
            ) : null}

            {selectedZone && zoneEditMode === "zone-resize" ? (
              <g>
                {getZoneHandles(selectedZone).map((handle) => (
                  <rect key={handle.handle} x={handle.x - 8} y={handle.y - 8} width={16} height={16} rx={2} fill="#f8fafc" stroke={selectedZone.color} strokeWidth={2} style={{ cursor: handle.cursor }} onPointerDown={(event) => handleZoneHandleDragStart(event, selectedZone, handle.handle)} />
                ))}
              </g>
            ) : null}

            <g>
              <rect x={1840} y={70} width={280} height={1530} fill="#0d3146" stroke="#60a5fa" strokeWidth={3} />
              <text x={1980} y={110} fill="#d7ebff" fontSize={18} textAnchor="middle" style={textStyle}>РЕКА</text>
              {Array.from({ length: 18 }, (_, index) => {
                const y = 150 + index * 78;
                return <path key={y} d={`M 1875 ${y} C 1915 ${y - 12}, 1950 ${y + 12}, 1990 ${y} S 2065 ${y - 12}, 2105 ${y}`} fill="none" stroke="#7dd3fc" strokeWidth={3} opacity={0.75} />;
              })}
            </g>

            {overlays.showLegend ? (
              <g transform={`translate(${overlays.legendPosition.x} ${overlays.legendPosition.y})`} onPointerDown={(event) => handleOverlayDragStart(event, "legend")} style={{ cursor: "grab" }}>
                <rect width="350" height="118" fill="#101c28" stroke={selectedOverlay === "legend" ? "#f8fafc" : "#64748b"} strokeWidth={2} />
                <text x={18} y={24} fill="#e2e8f0" fontSize={15} style={textStyle}>ЛЕГЕНДА РАЙОНОВ</text>
                {legendZones.map((zone, index) => (
                  <g key={zone.id} transform={`translate(18 ${38 + index * 12})`}>
                    <line x1="0" y1="0" x2="22" y2="0" stroke={zone.color} strokeWidth={4} />
                    <text x="30" y="4" fill="#d9e3ee" fontSize={10} style={textStyle}>{zone.title}</text>
                  </g>
                ))}
              </g>
            ) : null}

            <g transform="translate(1900 132)">
              <circle cx="0" cy="0" r="48" fill="#0f1a25" stroke="#94a3b8" strokeWidth={2} />
              <line x1="0" y1="-34" x2="0" y2="34" stroke="#e2e8f0" strokeWidth={2} />
              <line x1="-34" y1="0" x2="34" y2="0" stroke="#e2e8f0" strokeWidth={2} />
              <polygon points="0,-52 -8,-28 8,-28" fill="#f8fafc" />
              <text x="0" y="-62" fill="#f8fafc" fontSize={18} textAnchor="middle" style={textStyle}>N</text>
              <text x="0" y="70" fill="#f8fafc" fontSize={18} textAnchor="middle" style={textStyle}>S</text>
              <text x="58" y="6" fill="#f8fafc" fontSize={18} textAnchor="middle" style={textStyle}>E</text>
              <text x="-58" y="6" fill="#f8fafc" fontSize={18} textAnchor="middle" style={textStyle}>W</text>
            </g>

            <g transform="translate(1870 1520)">
              <rect width="240" height="58" fill="#101c28" stroke="#64748b" strokeWidth={2} />
              <line x1="20" y1="34" x2="200" y2="34" stroke="#f8fafc" strokeWidth={4} />
              <line x1="20" y1="24" x2="20" y2="44" stroke="#f8fafc" strokeWidth={3} />
              <line x1="110" y1="24" x2="110" y2="44" stroke="#f8fafc" strokeWidth={3} />
              <line x1="200" y1="24" x2="200" y2="44" stroke="#f8fafc" strokeWidth={3} />
              <text x="20" y="18" fill="#dce7f5" fontSize={12} textAnchor="middle" style={textStyle}>0</text>
              <text x="110" y="18" fill="#dce7f5" fontSize={12} textAnchor="middle" style={textStyle}>100 м</text>
              <text x="200" y="18" fill="#dce7f5" fontSize={12} textAnchor="middle" style={textStyle}>200 м</text>
            </g>

            {overlays.showTitleStamp ? (
              <g transform={`translate(${overlays.stampPosition.x} ${overlays.stampPosition.y})`} onPointerDown={(event) => handleOverlayDragStart(event, "stamp")} style={{ cursor: "grab" }}>
                <rect width="640" height="90" fill="#0d1824" stroke={selectedOverlay === "stamp" ? "#f8fafc" : "#7b8da1"} strokeWidth={2} />
                <line x1="220" y1="0" x2="220" y2="90" stroke="#7b8da1" strokeWidth={2} />
                <line x1="405" y1="0" x2="405" y2="90" stroke="#7b8da1" strokeWidth={2} />
                <text x="18" y="24" fill="#e2e8f0" fontSize={14} style={textStyle}>ШТАМП ЧЕРТЕЖА</text>
                <text x="18" y="54" fill="#cbd5e1" fontSize={12} style={textStyle}>ОБЪЕКТ: {mapState.title}</text>
                <text x="18" y="74" fill="#cbd5e1" fontSize={12} style={textStyle}>МАСШТАБ: 1:2000</text>
                <text x="240" y="54" fill="#cbd5e1" fontSize={12} style={textStyle}>ДАТА: {new Date().toLocaleDateString()}</text>
                <text x="240" y="74" fill="#cbd5e1" fontSize={12} style={textStyle}>ЛИСТ: 01</text>
                <text x="425" y="54" fill="#cbd5e1" fontSize={12} style={textStyle}>ФОРМАТ: SVG / REACT</text>
                <text x="425" y="74" fill="#cbd5e1" fontSize={12} style={textStyle}>ВИД: СТРОГО СВЕРХУ</text>
              </g>
            ) : null}
            </svg>
          </div>
        </div>
      </div>

      <aside className="editor-panel">
        <div className="panel-inner">
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />

        <div className="panel-block">
          <div className="panel-kicker">РЕЖИМ</div>
          <h2>Редактор генплана</h2>
          <p>Карта хранится локально в этом браузере и может экспортироваться в JSON и PNG.</p>
          <p className="meta-line">Статус: {serverMessage}</p>
          <div className="panel-status-grid">
            <div className="mini-stat"><span>Выбор</span><strong>{selectedSummary}</strong></div>
            <div className="mini-stat"><span>Hotkeys</span><strong>Ctrl/Cmd+S · Ctrl/Cmd+Z · Del</strong></div>
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
            <label>Название карты<input value={mapState.title} onChange={(event) => setMapState((current) => ({ ...current, title: event.target.value }))} /></label>
            <label className="checkbox-row"><input type="checkbox" checked={overlays.showLegend} onChange={(event) => setMapState((current) => ({ ...current, overlays: { ...current.overlays, showLegend: event.target.checked } }))} /> Показать легенду</label>
            <label className="checkbox-row"><input type="checkbox" checked={overlays.showTitleStamp} onChange={(event) => setMapState((current) => ({ ...current, overlays: { ...current.overlays, showTitleStamp: event.target.checked } }))} /> Показать штамп</label>
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
          {zones.map((zone) => (<button key={zone.id} type="button" onClick={() => { setSelected({ kind: "zone", id: zone.id }); setPanelSection("zone"); }}>{zone.title}</button>))}
          {roads.slice(0, 8).map((road) => (<button key={road.id} type="button" onClick={() => { setSelected({ kind: "road", id: road.id }); setPanelSection("road"); }}>{road.label || road.id}</button>))}
          {gates.map((gate) => (<button key={gate.id} type="button" onClick={() => { setSelected({ kind: "gate", id: gate.id }); setPanelSection("gate"); }}>{gate.label}</button>))}
          {buildings.slice(0, 20).map((building) => (<button key={building.id} type="button" onClick={() => { setSelected({ kind: "building", id: building.id }); setPanelSection("building"); }}>{building.label}</button>))}
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
