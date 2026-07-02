// Dark-mode categorical palette (validated set — see dataviz skill reference).
// Fixed hue order: never cycle or reassign based on filtering.
export const CATEGORICAL = [
  "#3987e5", // blue
  "#199e70", // aqua
  "#c98500", // yellow
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
  "#d55181", // magenta
  "#d95926", // orange
];

export const CHART_INK = {
  surface: "#1a1a19",
  primary: "#ffffff",
  secondary: "#c3c2b7",
  muted: "#898781",
  gridline: "#2c2c2a",
  baseline: "#383835",
};

export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export function scoreColor(score: number) {
  if (score >= 80) return STATUS_COLORS.good;
  if (score >= 60) return CATEGORICAL[2];
  if (score >= 40) return STATUS_COLORS.serious;
  return STATUS_COLORS.critical;
}
