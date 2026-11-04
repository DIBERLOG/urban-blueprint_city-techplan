import { BuildingShape } from "./buildings";
import type { GateData, MapState, OverlayId, RoadData, ZoneData } from "./cityData";
import { useMemo } from "react";
import { findJunctions, type Junction } from "./mapState";
import { ACCENT, labelHalo, noop, textStyle } from "./mapStyle";

export { BuildingShape, FormThumb, buildingForms, formLabel, formSize } from "./buildings";
export { textStyle } from "./mapStyle";

const zoneFill = (color: string) => `${color}1a`;

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
      <text x={zone.x + 18} y={zone.y + 28} fill={zone.color} fontSize={20} fontWeight={600} style={textStyle} {...labelHalo}>
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
      <path d={d} fill="none" stroke="#64748b" strokeWidth={road.width + 3} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <path d={d} fill="none" stroke={selected ? "#94a3b8" : "#4a5568"} strokeWidth={road.width} strokeLinecap="round" strokeLinejoin="round" />
      {road.major ? (
        <path d={d} fill="none" stroke="#cbd5e1" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="22 18" />
      ) : null}
      {road.label ? (
        <text x={midPoint.x + 14} y={midPoint.y - 12} fill="#a3b3c6" fontSize={12} style={textStyle} {...labelHalo}>
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
      <text x={gate.x + (gate.textDx ?? gate.width + 18)} y={gate.y + (gate.textDy ?? gate.height * 0.72)} fill="#e5e7eb" fontSize={12} style={textStyle} {...labelHalo}>
        {gate.label}
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


/** Та же отрисовка, что в редакторе, но без выделения и перетаскивания. */
export function MapPreview({ mapState, label, highlight }: { mapState: MapState; label: string; highlight?: string }) {
  const highlighted = highlight ? mapState.buildings.find((building) => building.id === highlight) : undefined;
  const junctions = useMemo(() => findJunctions(mapState.roads), [mapState.roads]);
  return (
    <svg viewBox="0 0 2200 1700" role="img" aria-label={label}>
      <MapBackdrop />
      {mapState.roads.map((road) => (
        <Road key={road.id} road={road} selected={false} onSelect={noop} onDragStart={noop} />
      ))}
      <Junctions junctions={junctions} />
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
      {highlighted ? <SelectionFrame x={highlighted.x} y={highlighted.y} width={highlighted.width} height={highlighted.height} rotation={highlighted.rotation} /> : null}
    </svg>
  );
}

const ROAD_FILL = "#4a5568";

/** Перекрёсток: чистая площадка без осевой разметки и «зебра» на каждом луче. */
export function Junctions({ junctions }: { junctions: Junction[] }) {
  return (
    <g pointerEvents="none">
      {junctions.map((junction) => {
        const half = junction.size / 2;
        return (
          <g key={`${junction.x}-${junction.y}`}>
            <circle cx={junction.x} cy={junction.y} r={half + 3} fill={ROAD_FILL} />
            {junction.arms.map((arm, index) => {
              const offset = half + 11;
              const stripes = Math.max(2, Math.floor((arm.width - 4) / 5));
              const px = junction.x + Math.cos(arm.angle) * offset;
              const py = junction.y + Math.sin(arm.angle) * offset;
              return (
                <g key={index} transform={`translate(${px} ${py}) rotate(${(arm.angle * 180) / Math.PI})`}>
                  {Array.from({ length: stripes }, (_, stripe) => (
                    <rect key={stripe} x={-5} y={-arm.width / 2 + 2 + (stripe * (arm.width - 4)) / stripes + 0.75} width={10} height={Math.max(1.5, (arm.width - 4) / stripes - 2.5)} fill="#e2e8f0" opacity={0.85} />
                  ))}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/** Выделение в духе чертежа: рамка с засечками по углам и размерная подпись «ширина × высота». */
export function SelectionFrame({ x, y, width, height, rotation = 0, label }: { x: number; y: number; width: number; height: number; rotation?: number; label?: string }) {
  const pad = 8;
  const left = x - pad;
  const top = y - pad;
  const right = x + width + pad;
  const bottom = y + height + pad;
  const tick = Math.min(16, (width + pad * 2) / 3, (height + pad * 2) / 3);
  const cx = x + width / 2;
  const cy = y + height / 2;
  const corners = [
    `M ${left} ${top + tick} V ${top} H ${left + tick}`,
    `M ${right - tick} ${top} H ${right} V ${top + tick}`,
    `M ${right} ${bottom - tick} V ${bottom} H ${right - tick}`,
    `M ${left + tick} ${bottom} H ${left} V ${bottom - tick}`,
  ].join(" ");
  // Подпись размеров всегда горизонтальна и стоит над габаритом повёрнутой рамки.
  const angle = (rotation * Math.PI) / 180;
  const halfHeight = Math.abs(Math.sin(angle)) * (right - left) / 2 + Math.abs(Math.cos(angle)) * (bottom - top) / 2;
  return (
    <g pointerEvents="none">
      <g transform={rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined}>
        <rect x={left} y={top} width={right - left} height={bottom - top} fill="none" stroke={ACCENT} strokeWidth={1.2} strokeDasharray="4 5" opacity={0.8} />
        <path d={corners} fill="none" stroke={ACCENT} strokeWidth={3} strokeLinecap="square" />
      </g>
      <text x={cx} y={cy - halfHeight - 10} fill={ACCENT} fontSize={12} textAnchor="middle" style={textStyle} {...labelHalo}>
        {label ?? `${Math.round(width)} × ${Math.round(height)}`}
      </text>
    </g>
  );
}
