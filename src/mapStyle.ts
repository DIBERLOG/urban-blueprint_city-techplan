export const textStyle = {
  fontFamily: "IBM Plex Mono, Fira Code, Consolas, monospace",
  letterSpacing: 1.2,
};

// Тёмная подложка под буквами: подпись читается поверх дорог, деревьев и заливки.
export const labelHalo = { stroke: "#08111a", strokeWidth: 3, strokeLinejoin: "round" as const, paintOrder: "stroke" };

export const ACCENT = "#7dd3fc";

export const noop = () => {};
