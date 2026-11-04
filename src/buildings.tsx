import { Fragment } from "react";
import type { BuildingData, BuildingForm } from "./cityData";
import { labelHalo, noop, textStyle } from "./mapStyle";

type BodyStyle = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  vectorEffect?: "non-scaling-stroke";
  opacity?: number;
};

/** Силуэт здания одной фигурой: из него рисуются тень, корпус и линия кровли. null — форма из отдельных элементов. */
function buildingBody(b: BuildingData, style: BodyStyle) {
  const { x, y, width: w, height: h } = b;

  switch (b.form) {
    case "rect":
    case "courtyard":
    case "segmented-bar":
    case "depot":
    case "cemetery":
    case "buffer-strip":
    case "terrace":
    case "parking":
    case "garden":
      return <rect x={x} y={y} width={w} height={h} {...style} />;
    case "park":
    case "square":
      return <rect x={x} y={y} width={w} height={h} rx={10} {...style} />;
    case "forest":
      return <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) * 0.3} {...style} />;
    case "harbor":
      return <rect x={x} y={y} width={w} height={h} rx={8} {...style} />;
    case "stadium":
      return <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) / 2} {...style} />;
    case "rotunda":
    case "pond":
      return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...style} />;
    case "plaza":
    case "tower":
      return <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 2} {...style} />;
    case "l":
    case "corner-block": {
      const cutWidth = b.cutWidth ?? (b.form === "l" ? 50 : Math.round(w * 0.55));
      const cutHeight = b.cutHeight ?? (b.form === "l" ? 40 : Math.round(h * 0.45));
      return <path d={`M ${x} ${y} H ${x + w} V ${y + cutHeight} H ${x + cutWidth} V ${y + h} H ${x} Z`} {...style} />;
    }
    case "u": {
      const gapWidth = b.gapWidth ?? Math.round(w * 0.35);
      const gapDepth = b.gapDepth ?? Math.round(h * 0.45);
      const side = (w - gapWidth) / 2;
      return <path d={`M ${x} ${y + h} V ${y} H ${x + w} V ${y + h} H ${x + w - side} V ${y + gapDepth} H ${x + side} V ${y + h} Z`} {...style} />;
    }
    case "t": {
      const neck = b.neckWidth ?? Math.round(w * 0.36);
      const wing = b.wingDepth ?? Math.round(h * 0.42);
      const nx = x + (w - neck) / 2;
      return <path d={`M ${x} ${y} H ${x + w} V ${y + wing} H ${nx + neck} V ${y + h} H ${nx} V ${y + wing} H ${x} Z`} {...style} />;
    }
    case "h": {
      const bar = Math.round(w * 0.3);
      const top = y + Math.round(h * 0.33);
      const bottom = y + h - Math.round(h * 0.33);
      return (
        <path
          d={`M ${x} ${y} H ${x + bar} V ${top} H ${x + w - bar} V ${y} H ${x + w} V ${y + h} H ${x + w - bar} V ${bottom} H ${x + bar} V ${y + h} H ${x} Z`}
          {...style}
        />
      );
    }
    case "cross": {
      const armX = Math.round(w * 0.36);
      const armY = Math.round(h * 0.36);
      const x1 = x + (w - armX) / 2;
      const y1 = y + (h - armY) / 2;
      return (
        <path
          d={`M ${x1} ${y} H ${x1 + armX} V ${y1} H ${x + w} V ${y1 + armY} H ${x1 + armX} V ${y + h} H ${x1} V ${y1 + armY} H ${x} V ${y1} H ${x1} Z`}
          {...style}
        />
      );
    }
    case "hex": {
      const inset = Math.round(w * 0.22);
      return <polygon points={`${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + h / 2} ${x + w - inset},${y + h} ${x + inset},${y + h} ${x},${y + h / 2}`} {...style} />;
    }
    case "trapezoid": {
      const top = b.topWidth ?? Math.round(w * 0.72);
      const offset = (w - top) / 2;
      return <polygon points={`${x + offset},${y} ${x + offset + top},${y} ${x + w},${y + h} ${x},${y + h}`} {...style} />;
    }
    case "sawtooth": {
      const bays = Math.max(3, b.bayCount ?? 4);
      const bay = w / bays;
      const roofY = y + h * 0.35;
      const teeth = Array.from({ length: bays }, (_, i) => `${x + bay * i + bay * 0.45},${y} ${x + bay * (i + 1)},${roofY}`).join(" ");
      return <polygon points={`${x},${y + h} ${x},${roofY} ${teeth} ${x + w},${y + h}`} {...style} />;
    }
    case "oct": {
      const r = b.radius ?? Math.round(Math.min(w, h) / 2);
      const cx = x + r;
      const cy = y + r;
      const points = Array.from({ length: 8 }, (_, i) => {
        const angle = (Math.PI / 4) * i + Math.PI / 8;
        return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
      }).join(" ");
      return <polygon points={points} {...style} />;
    }
    default:
      return null;
  }
}

// Формы, у которых уменьшенная копия силуэта читается как линия кровли.
const ROOF_FORMS = new Set<BuildingForm>(["rect", "oct", "hex", "trapezoid", "rotunda", "tower", "segmented-bar", "corner-block", "l", "t"]);

const SPECIAL_FILL: Partial<Record<BuildingForm, string>> = {
  cemetery: "#20161a",
  plaza: "#083141",
  park: "#153728",
  square: "#163a29",
  forest: "#0f2a1e",
  garden: "#1b2f1d",
  harbor: "#173728",
  parking: "#151c25",
  pond: "#0d3146",
  stadium: "#123326",
};

const LABEL_FILL: Partial<Record<BuildingForm, string>> = {
  cemetery: "#fecaca",
  plaza: "#91efff",
  park: "#dcfce7",
  square: "#dcfce7",
  forest: "#bbf7d0",
  garden: "#d9f99d",
  "tree-cluster": "#bbf7d0",
  harbor: "#8df4d0",
  piers: "#cbd5e1",
  pond: "#bae6fd",
};

function labelPosition(b: BuildingData) {
  const cx = b.textX ?? b.x + b.width / 2;
  const cy = b.textY ?? b.y + b.height / 2;
  switch (b.form) {
    case "u":
      return { x: cx, y: cy + 10 };
    case "depot":
      return { x: cx, y: b.y + b.height * 0.28 };
    case "sawtooth":
      return { x: cx, y: b.y + b.height * 0.68 };
    case "harbor":
      return { x: cx, y: b.y + b.height - 20 };
    case "cemetery":
    case "tree-cluster":
    case "piers":
    case "pond":
    case "forest":
      return { x: cx, y: b.y + b.height + 16 };
    case "plaza":
      return { x: b.x + b.width / 2, y: b.y + b.height + 18 };
    default:
      return { x: cx, y: cy };
  }
}

function Tree({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <circle cx={cx + r * 0.3} cy={cy + r * 0.4} r={r} fill="#02070c" opacity={0.45} />
      <circle cx={cx} cy={cy} r={r} fill="#1b4634" stroke="#6ee7b7" strokeWidth={1.1} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.45} fill="#2f6b4d" />
    </>
  );
}

// Детерминированный «шум», чтобы лес на каждом рендере выглядел одинаково.
const jitter = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

function buildingDetails(b: BuildingData, stroke: string) {
  const { x, y, width: w, height: h } = b;
  const thin = { stroke, strokeWidth: 1.4, fill: "none" };
  const path = { stroke: "#d6c9a8", strokeWidth: 3, strokeLinecap: "round" as const, fill: "none", opacity: 0.55 };

  switch (b.form) {
    case "rect":
      return b.doubleFrame ? <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} fill="none" stroke={b.color} strokeWidth={2} /> : null;
    case "courtyard": {
      const inset = b.innerInset ?? Math.round(Math.min(w, h) * 0.22);
      return <rect x={x + inset} y={y + inset} width={Math.max(16, w - inset * 2)} height={Math.max(16, h - inset * 2)} fill="#0f1a25" stroke={stroke} strokeWidth={1.5} strokeDasharray="5 4" />;
    }
    case "rotunda":
      return <ellipse cx={x + w / 2} cy={y + h / 2} rx={Math.max(12, w * 0.22)} ry={Math.max(10, h * 0.22)} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray="5 4" />;
    case "segmented-bar": {
      const count = Math.max(2, b.segmentCount ?? 4);
      return Array.from({ length: count - 1 }, (_, i) => (
        <line key={i} x1={x + (w / count) * (i + 1)} y1={y + 3} x2={x + (w / count) * (i + 1)} y2={y + h - 3} stroke={stroke} strokeWidth={1.5} opacity={0.8} />
      ));
    }
    case "terrace": {
      // Блокированные дома: у каждой секции свой конёк крыши.
      const count = Math.max(2, b.segmentCount ?? 5);
      const step = w / count;
      return Array.from({ length: count }, (_, i) => (
        <Fragment key={i}>
          {i ? <line x1={x + step * i} y1={y} x2={x + step * i} y2={y + h} stroke={stroke} strokeWidth={1.4} /> : null}
          <polyline points={`${x + step * i + 3},${y + 3} ${x + step * i + step / 2},${y + h / 2} ${x + step * (i + 1) - 3},${y + 3}`} {...thin} opacity={0.7} />
          <polyline points={`${x + step * i + 3},${y + h - 3} ${x + step * i + step / 2},${y + h / 2} ${x + step * (i + 1) - 3},${y + h - 3}`} {...thin} opacity={0.7} />
        </Fragment>
      ));
    }
    case "depot": {
      const bays = Math.max(2, b.bayCount ?? 4);
      const bay = w / bays;
      return Array.from({ length: bays }, (_, i) => <rect key={i} x={x + bay * i + 3} y={y + h * 0.45} width={Math.max(8, bay - 6)} height={h * 0.45 - 3} {...thin} />);
    }
    case "cemetery":
      return (
        <g stroke="#cbd5e1" strokeWidth={2} opacity={0.6}>
          <line x1={x + 14} y1={y + 14} x2={x + w - 12} y2={y + h - 10} />
          <line x1={x + w - 12} y1={y + 14} x2={x + 14} y2={y + h - 10} />
          <line x1={x + w / 2} y1={y + 14} x2={x + w / 2} y2={y + h - 10} />
          <line x1={x + 8} y1={y + h / 2} x2={x + w - 6} y2={y + h / 2} />
        </g>
      );
    case "plaza": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2;
      return (
        <>
          <circle cx={cx} cy={cy} r={r * 0.72} fill="none" stroke="#a5f3fc" strokeWidth={1} strokeDasharray="2 6" opacity={0.6} />
          <circle cx={cx} cy={cy} r={Math.min(34, r * 0.4)} fill="#0c4a5d" stroke="#a5f3fc" strokeWidth={3} />
          <circle cx={cx} cy={cy} r={Math.min(12, r * 0.15)} fill="#d8fafe" />
        </>
      );
    }
    case "park":
      return (
        <>
          <path d={`M ${x + 6} ${y + h * 0.7} C ${x + w * 0.35} ${y + h * 0.35}, ${x + w * 0.6} ${y + h * 0.95}, ${x + w - 6} ${y + h * 0.3}`} {...path} />
          <Tree cx={x + 22} cy={y + 22} r={9} />
          <Tree cx={x + w - 26} cy={y + h - 22} r={10} />
          <Tree cx={x + w * 0.55} cy={y + 20} r={8} />
          <Tree cx={x + w * 0.3} cy={y + h - 16} r={7} />
        </>
      );
    case "square": {
      // Сквер: диагональные дорожки, фонтан в центре и деревья по четвертям.
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h);
      return (
        <>
          <path d={`M ${x + 6} ${y + 6} L ${x + w - 6} ${y + h - 6} M ${x + w - 6} ${y + 6} L ${x + 6} ${y + h - 6}`} {...path} />
          <circle cx={cx} cy={cy} r={r * 0.17} fill="#163a29" stroke="#d6c9a8" strokeWidth={2} opacity={0.9} />
          <circle cx={cx} cy={cy} r={r * 0.1} fill="#0c4a5d" stroke="#a5f3fc" strokeWidth={1.5} />
          <Tree cx={cx} cy={y + h * 0.18} r={r * 0.09} />
          <Tree cx={cx} cy={y + h * 0.82} r={r * 0.09} />
          <Tree cx={x + w * 0.16} cy={cy} r={r * 0.09} />
          <Tree cx={x + w * 0.84} cy={cy} r={r * 0.09} />
        </>
      );
    }
    case "forest": {
      const cols = Math.max(2, Math.round(w / 18));
      const rows = Math.max(2, Math.round(h / 18));
      return Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((__, col) => {
          const seed = row * 31 + col + 1;
          const cx = x + ((col + 0.5 + (row % 2) * 0.4 + (jitter(seed) - 0.5) * 0.5) * w) / (cols + 0.4);
          const cy = y + ((row + 0.5 + (jitter(seed + 7) - 0.5) * 0.4) * h) / rows;
          return <Tree key={`${row}-${col}`} cx={cx} cy={cy} r={6 + jitter(seed + 3) * 4} />;
        }),
      );
    }
    case "garden": {
      // Сад и грядки: полосы посадок и ряд деревьев по краю.
      const rows = Math.max(3, Math.floor((h - 16) / 10));
      const step = (h - 16) / rows;
      return (
        <>
          {Array.from({ length: rows }, (_, i) => (
            <rect key={i} x={x + 8} y={y + 8 + step * i + 1.5} width={w - 34} height={step - 3} rx={2} fill={i % 2 ? "#3d5f2e" : "#2a4a2a"} />
          ))}
          {Array.from({ length: Math.max(2, Math.floor((h - 8) / 20)) }, (_, i) => (
            <Tree key={`t${i}`} cx={x + w - 13} cy={y + 14 + i * 20} r={6} />
          ))}
        </>
      );
    }
    case "harbor":
      return (
        <>
          <rect x={x + 14} y={y + 14} width={w - 28} height={40} fill="#0f1f18" stroke="#86efac" strokeWidth={1.4} />
          <text x={b.textX ?? x + w / 2} y={y + 34} fill="#dcfce7" fontSize={16} textAnchor="middle" dominantBaseline="middle" style={textStyle}>ПОРТ</text>
        </>
      );
    case "tower": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) / 2;
      return (
        <>
          <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke={stroke} strokeWidth={1.5} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (Math.PI / 4) * i;
            return <line key={i} x1={cx + Math.cos(a) * r * 0.62} y1={cy + Math.sin(a) * r * 0.62} x2={cx + Math.cos(a) * r * 0.92} y2={cy + Math.sin(a) * r * 0.92} stroke={stroke} strokeWidth={1.2} opacity={0.75} />;
          })}
        </>
      );
    }
    case "stadium": {
      const inset = Math.min(w, h) * 0.18;
      const fieldH = h - inset * 2;
      return (
        <>
          <rect x={x + inset} y={y + inset} width={w - inset * 2} height={fieldH} rx={fieldH / 2} fill="#1d5a3a" stroke="#bbf7d0" strokeWidth={1.2} />
          <line x1={x + w / 2} y1={y + inset} x2={x + w / 2} y2={y + h - inset} stroke="#bbf7d0" strokeWidth={1.2} opacity={0.8} />
          <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(fieldH * 0.28, 14)} fill="none" stroke="#bbf7d0" strokeWidth={1.2} opacity={0.8} />
        </>
      );
    }
    case "parking": {
      const stalls = Math.max(2, Math.floor(w / 16));
      const step = w / stalls;
      const depth = Math.min(h * 0.38, 26);
      return (
        <g stroke="#94a3b8" strokeWidth={1.2} opacity={0.7}>
          {Array.from({ length: stalls - 1 }, (_, i) => (
            <Fragment key={i}>
              <line x1={x + step * (i + 1)} y1={y} x2={x + step * (i + 1)} y2={y + depth} />
              <line x1={x + step * (i + 1)} y1={y + h - depth} x2={x + step * (i + 1)} y2={y + h} />
            </Fragment>
          ))}
          <line x1={x + 8} y1={y + h / 2} x2={x + w - 8} y2={y + h / 2} strokeDasharray="8 6" />
        </g>
      );
    }
    case "pond": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return (
        <g fill="none" stroke="#7dd3fc" strokeWidth={1.6} opacity={0.7}>
          <path d={`M ${cx - w * 0.22} ${cy - h * 0.08} q ${w * 0.11} ${-h * 0.12} ${w * 0.22} 0 t ${w * 0.22} 0`} />
          <path d={`M ${cx - w * 0.3} ${cy + h * 0.14} q ${w * 0.1} ${-h * 0.12} ${w * 0.2} 0 t ${w * 0.2} 0`} />
        </g>
      );
    }
    case "tree-cluster": {
      const cols = Math.max(1, Math.floor(w / 28));
      const rows = Math.max(1, Math.floor(h / 28));
      return Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((__, col) => {
          const cx = x + 12 + col * 24;
          const cy = y + 12 + row * 24;
          return (
            <Fragment key={`${row}-${col}`}>
              <Tree cx={cx} cy={cy} r={8} />
              <circle cx={cx + 6} cy={cy + 3} r={6} fill="#214d3a" stroke="#86efac" strokeWidth={1} />
            </Fragment>
          );
        }),
      );
    }
    case "piers":
      return (
        <>
          <rect x={x} y={y} width={22} height={h} fill="#334155" stroke="#cbd5e1" strokeWidth={1.6} />
          {Array.from({ length: 4 }, (_, i) => {
            const py = y + 12 + i * 38;
            return (
              <g key={i}>
                <rect x={x + 22} y={py} width={w - 22} height={12} fill="#4b5563" stroke="#d5dde7" strokeWidth={1.2} rx={1.5} />
                <line x1={x + 42} y1={py} x2={x + 42} y2={py + 12} stroke="#e2e8f0" strokeWidth={1} opacity={0.7} />
                <line x1={x + 64} y1={py} x2={x + 64} y2={py + 12} stroke="#e2e8f0" strokeWidth={1} opacity={0.7} />
              </g>
            );
          })}
        </>
      );
    default:
      return null;
  }
}

export function BuildingShape({
  building,
  hovered,
  selected,
  showLabel = true,
  onEnter,
  onLeave,
  onSelect,
  onDragStart,
}: {
  building: BuildingData;
  hovered: boolean;
  selected: boolean;
  showLabel?: boolean;
  onEnter: (id: string) => void;
  onLeave: () => void;
  onSelect: () => void;
  onDragStart: (event: React.PointerEvent<SVGGElement>, building: BuildingData) => void;
}) {
  const { x, y, width: w, height: h, color, form } = building;
  const active = hovered || selected;
  const rotation = building.rotation ?? 0;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rotate = rotation ? `rotate(${rotation} ${cx} ${cy})` : "";

  const fill = form === "buffer-strip" ? color : SPECIAL_FILL[form] ?? `${color}${active ? "4d" : "33"}`;
  const stroke = form === "buffer-strip" ? "#365314" : color;
  const strokeWidth = selected ? 2.6 : active ? 2.4 : 1.8;

  const shadow = buildingBody(building, { fill: "#02070c", stroke: "none", strokeWidth: 0, opacity: 0.5 });
  const body = buildingBody(building, { fill, stroke, strokeWidth, opacity: form === "buffer-strip" ? 0.92 : undefined });
  const roofInset = Math.min(12, Math.min(w, h) * 0.24);
  const roof =
    ROOF_FORMS.has(form) && Math.min(w, h) > 26
      ? buildingBody(building, { fill: "none", stroke, strokeWidth: 1, vectorEffect: "non-scaling-stroke", opacity: 0.45 })
      : null;
  const label = labelPosition(building);

  return (
    <g
      onMouseEnter={() => onEnter(building.id)}
      onMouseLeave={onLeave}
      onClick={onSelect}
      onPointerDown={(event) => onDragStart(event, building)}
      style={{ cursor: "grab", touchAction: "none" }}
    >
      {shadow ? <g transform={`translate(4 5) ${rotate}`}>{shadow}</g> : null}
      <g transform={rotate || undefined}>
        {body}
        {roof ? <g transform={`translate(${cx} ${cy}) scale(${(w - roofInset * 2) / w} ${(h - roofInset * 2) / h}) translate(${-cx} ${-cy})`}>{roof}</g> : null}
        {buildingDetails(building, stroke)}
        {showLabel && building.label && form !== "buffer-strip" ? (
          <text x={label.x} y={label.y} fill={LABEL_FILL[form] ?? "#ecf3fb"} fontSize={11} textAnchor="middle" dominantBaseline="middle" style={textStyle} {...labelHalo}>
            {building.label}
          </text>
        ) : null}
      </g>
    </g>
  );
}

export type FormGroup = "Здания" | "Особые" | "Зелень и вода";

export const buildingForms: Array<{ form: BuildingForm; label: string; group: FormGroup }> = [
  { form: "rect", label: "Прямоугольник", group: "Здания" },
  { form: "l", label: "L-образное", group: "Здания" },
  { form: "u", label: "U-образное", group: "Здания" },
  { form: "t", label: "T-образное", group: "Здания" },
  { form: "h", label: "H-образное", group: "Здания" },
  { form: "cross", label: "Крестообразное", group: "Здания" },
  { form: "oct", label: "Восьмиугольник", group: "Здания" },
  { form: "hex", label: "Шестиугольник", group: "Здания" },
  { form: "trapezoid", label: "Трапеция", group: "Здания" },
  { form: "courtyard", label: "С двором", group: "Здания" },
  { form: "corner-block", label: "Угловой квартал", group: "Здания" },
  { form: "segmented-bar", label: "Длинный корпус", group: "Здания" },
  { form: "terrace", label: "Таунхаусы", group: "Здания" },
  { form: "tower", label: "Башня", group: "Здания" },
  { form: "rotunda", label: "Ротонда", group: "Особые" },
  { form: "depot", label: "Вокзал / депо", group: "Особые" },
  { form: "sawtooth", label: "Цех", group: "Особые" },
  { form: "stadium", label: "Стадион", group: "Особые" },
  { form: "parking", label: "Парковка", group: "Особые" },
  { form: "harbor", label: "Порт", group: "Особые" },
  { form: "piers", label: "Причалы", group: "Особые" },
  { form: "plaza", label: "Площадь", group: "Особые" },
  { form: "cemetery", label: "Кладбище", group: "Особые" },
  { form: "park", label: "Парк", group: "Зелень и вода" },
  { form: "square", label: "Сквер", group: "Зелень и вода" },
  { form: "forest", label: "Лес", group: "Зелень и вода" },
  { form: "garden", label: "Сад и грядки", group: "Зелень и вода" },
  { form: "tree-cluster", label: "Деревья", group: "Зелень и вода" },
  { form: "buffer-strip", label: "Зелёная полоса", group: "Зелень и вода" },
  { form: "pond", label: "Пруд", group: "Зелень и вода" },
];

export const formLabel = (form: BuildingForm) => buildingForms.find((entry) => entry.form === form)?.label ?? form;

/** Размер нового объекта и превью: у некоторых форм свои пропорции. */
export const formSize: Partial<Record<BuildingForm, { width: number; height: number }>> = {
  piers: { width: 84, height: 150 },
  harbor: { width: 120, height: 90 },
  plaza: { width: 80, height: 80 },
  tower: { width: 64, height: 64 },
  oct: { width: 64, height: 64 },
  rotunda: { width: 80, height: 64 },
  square: { width: 100, height: 100 },
  forest: { width: 140, height: 100 },
  garden: { width: 120, height: 80 },
  park: { width: 120, height: 80 },
  pond: { width: 110, height: 70 },
  stadium: { width: 140, height: 80 },
  "buffer-strip": { width: 110, height: 22 },
};

/** Маленькое превью формы — для выбора формы в инспекторе и каталога на главной. */
export function FormThumb({ form, color }: { form: BuildingForm; color: string }) {
  const size = formSize[form] ?? { width: 100, height: 64 };
  const sample: BuildingData = { id: `thumb-${form}`, zoneId: "", label: "", color, form, x: 0, y: 0, ...size };
  const pad = 10;
  return (
    <svg viewBox={`${-pad} ${-pad} ${size.width + pad * 2} ${size.height + pad * 2}`} aria-hidden="true" focusable="false">
      <BuildingShape building={sample} hovered={false} selected={false} showLabel={false} onEnter={noop} onLeave={noop} onSelect={noop} onDragStart={noop} />
    </svg>
  );
}
