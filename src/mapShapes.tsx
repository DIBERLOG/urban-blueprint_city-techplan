import { Fragment } from "react";
import type { BuildingData, GateData, MapState, OverlayId, RoadData, ZoneData } from "./cityData";

export const textStyle = {
  fontFamily: "IBM Plex Mono, Fira Code, Consolas, monospace",
  letterSpacing: 1.2,
};

const zoneFill = (color: string) => `${color}22`;

export function ZoneBlock({
  zone,
  selected,
  draggable = false,
  onSelect,
  onPointerDown,
}: {
  zone: ZoneData;
  selected: boolean;
  draggable?: boolean;
  onSelect: () => void;
  onPointerDown: (event: React.PointerEvent<SVGGElement>, zone: ZoneData) => void;
}) {
  return (
    <g onClick={onSelect} onPointerDown={(event) => onPointerDown(event, zone)} style={{ cursor: draggable ? "grab" : "pointer", touchAction: draggable ? "none" : undefined }}>
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

export function Road({
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
    <g onClick={onSelect} onPointerDown={(event) => onDragStart(event, road)} style={{ cursor: "grab", touchAction: "none" }}>
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

export function Gate({
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
    <g onClick={onSelect} onPointerDown={(event) => onPointerDown(event, gate)} style={{ cursor: "grab", touchAction: "none" }}>
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

export function BuildingShape({
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
    style: { cursor: "grab", touchAction: "none" },
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

export function MapBackdrop() {
  return (
    <>
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
    </>
  );
}

export function River() {
  return (
    <g>
      <rect x={1840} y={70} width={280} height={1530} fill="#0d3146" stroke="#60a5fa" strokeWidth={3} />
      <text x={1980} y={110} fill="#d7ebff" fontSize={18} textAnchor="middle" style={textStyle}>РЕКА</text>
      {Array.from({ length: 18 }, (_, index) => {
        const y = 150 + index * 78;
        return <path key={y} d={`M 1875 ${y} C 1915 ${y - 12}, 1950 ${y + 12}, 1990 ${y} S 2065 ${y - 12}, 2105 ${y}`} fill="none" stroke="#7dd3fc" strokeWidth={3} opacity={0.75} />;
      })}
    </g>
  );
}

export function CompassAndScale() {
  return (
    <>
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
    </>
  );
}

type OverlayProps = {
  mapState: MapState;
  selected?: boolean;
  onPointerDown?: (event: React.PointerEvent<SVGGElement>, id: OverlayId) => void;
};

export function Legend({ mapState, selected = false, onPointerDown }: OverlayProps) {
  const { legendPosition } = mapState.overlays;
  return (
    <g
      transform={`translate(${legendPosition.x} ${legendPosition.y})`}
      onPointerDown={onPointerDown ? (event) => onPointerDown(event, "legend") : undefined}
      style={onPointerDown ? { cursor: "grab", touchAction: "none" } : undefined}
    >
      <rect width="350" height="118" fill="#101c28" stroke={selected ? "#f8fafc" : "#64748b"} strokeWidth={2} />
      <text x={18} y={24} fill="#e2e8f0" fontSize={15} style={textStyle}>ЛЕГЕНДА РАЙОНОВ</text>
      {mapState.zones.map((zone, index) => (
        <g key={zone.id} transform={`translate(18 ${38 + index * 12})`}>
          <line x1="0" y1="0" x2="22" y2="0" stroke={zone.color} strokeWidth={4} />
          <text x="30" y="4" fill="#d9e3ee" fontSize={10} style={textStyle}>{zone.title}</text>
        </g>
      ))}
    </g>
  );
}

export function TitleStamp({ mapState, selected = false, onPointerDown }: OverlayProps) {
  const { stampPosition } = mapState.overlays;
  return (
    <g
      transform={`translate(${stampPosition.x} ${stampPosition.y})`}
      onPointerDown={onPointerDown ? (event) => onPointerDown(event, "stamp") : undefined}
      style={onPointerDown ? { cursor: "grab", touchAction: "none" } : undefined}
    >
      <rect width="640" height="90" fill="#0d1824" stroke={selected ? "#f8fafc" : "#7b8da1"} strokeWidth={2} />
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
  );
}

const noop = () => {};

/** Та же отрисовка, что в редакторе, но без выделения и перетаскивания. */
export function MapPreview({ mapState, label }: { mapState: MapState; label: string }) {
  return (
    <svg viewBox="0 0 2200 1700" role="img" aria-label={label}>
      <MapBackdrop />
      {mapState.roads.map((road) => (
        <Road key={road.id} road={road} selected={false} onSelect={noop} onDragStart={noop} />
      ))}
      {mapState.zones.map((zone) => (
        <ZoneBlock key={zone.id} zone={zone} selected={false} onSelect={noop} onPointerDown={noop} />
      ))}
      {mapState.buildings.map((building) => (
        <BuildingShape key={building.id} building={building} hovered={false} selected={false} onEnter={noop} onLeave={noop} onSelect={noop} onDragStart={noop} />
      ))}
      {mapState.gates.map((gate) => (
        <Gate key={gate.id} gate={gate} selected={false} onSelect={noop} onPointerDown={noop} />
      ))}
      <River />
      {mapState.overlays.showLegend ? <Legend mapState={mapState} /> : null}
      <CompassAndScale />
      {mapState.overlays.showTitleStamp ? <TitleStamp mapState={mapState} /> : null}
    </svg>
  );
}
