// One place for number formatting: USD with separators, percentages to 1 decimal, vials as integers.
export const usd = (v: number, digits = 0) =>
  `USD ${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const vials = (v: number) => `${Math.round(v).toLocaleString("en-US")} vials`;
export const int = (v: number) => Math.round(v).toLocaleString("en-US");
export const num = (v: number, digits = 3) => v.toFixed(digits);
export const signedUsd = (v: number) => `${v >= 0 ? "+" : "-"}USD ${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
export const signedPts = (v: number, digits = 1) => `${v >= 0 ? "+" : "-"}${Math.abs(v * 100).toFixed(digits)} pts`;
