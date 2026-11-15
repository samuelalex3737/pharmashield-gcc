"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useIsDark } from "./useTheme";

type PlotProps = { data: object[]; layout?: object; config?: object; className?: string; style?: object; useResizeHandler?: boolean };

const Plot = dynamic<PlotProps>(
  async () => {
    const Plotly = await import("plotly.js-basic-dist-min");
    const factory = (await import("react-plotly.js/factory")).default as (p: unknown) => ComponentType<PlotProps>;
    return factory(Plotly.default ?? Plotly);
  },
  { ssr: false, loading: () => <div className="skeleton h-full min-h-40 w-full" /> },
);

export const CHART_COLORS = { brand: "#1f4e79", accent: "#0d9488", risk: "#be123c", warn: "#b45309", good: "#15803d", grey: "#94a3b8", violet: "#7c3aed" };
export const CRITERION_COLORS = ["#1f4e79", "#be123c", "#64748b", "#7c3aed", "#0d9488"];

export default function Chart({ data, layout = {}, height = 300, label }: { data: object[]; layout?: object; height?: number; label: string }) {
  const dark = useIsDark();
  const ink = dark ? "#e7eef7" : "#0f1b2d";
  const grid = dark ? "rgba(160,177,200,0.15)" : "rgba(15,27,45,0.08)";
  const base = layout as { xaxis?: object; yaxis?: object };
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <Plot
        data={data}
        layout={{
          autosize: true,
          margin: { l: 60, r: 20, t: 20, b: 50 },
          font: { family: "Inter, system-ui, sans-serif", size: 12, color: ink },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          ...layout,
          xaxis: { gridcolor: grid, zerolinecolor: grid, ...(base.xaxis ?? {}) },
          yaxis: { gridcolor: grid, zerolinecolor: grid, ...(base.yaxis ?? {}) },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
