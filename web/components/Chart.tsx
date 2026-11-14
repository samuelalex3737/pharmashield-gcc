"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type PlotProps = {
  data: object[];
  layout?: object;
  config?: object;
  className?: string;
  style?: object;
  useResizeHandler?: boolean;
};

const Plot = dynamic<PlotProps>(
  async () => {
    const Plotly = await import("plotly.js-basic-dist-min");
    const factory = (await import("react-plotly.js/factory")).default as (p: unknown) => ComponentType<PlotProps>;
    return factory(Plotly.default ?? Plotly);
  },
  { ssr: false, loading: () => <div className="h-full min-h-48 w-full animate-pulse rounded-lg bg-slate-100" /> },
);

export default function Chart({ data, layout = {}, height = 300 }: { data: object[]; layout?: object; height?: number }) {
  return (
    <div style={{ height }}>
      <Plot
        data={data}
        layout={{
          autosize: true,
          margin: { l: 60, r: 20, t: 30, b: 50 },
          font: { family: "Inter, system-ui, sans-serif", size: 12, color: "#334155" },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          ...layout,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
