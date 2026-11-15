"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { suppliers } from "@/lib/data";
import { useIsDark } from "./useTheme";

type PlotProps = { data: object[]; layout?: object; config?: object; style?: object; useResizeHandler?: boolean };

// The geo bundle is large, so it is only loaded when the map is opened.
const GeoPlot = dynamic<PlotProps>(
  async () => {
    const Plotly = await import("plotly.js-geo-dist-min");
    const factory = (await import("react-plotly.js/factory")).default as (p: unknown) => ComponentType<PlotProps>;
    return factory(Plotly.default ?? Plotly);
  },
  { ssr: false, loading: () => <div className="skeleton h-full w-full" /> },
);

type LatLon = [number, number];
const DUBAI: LatLon = [25.2, 55.3];
const HORMUZ: LatLon = [26.57, 56.25];
const FUJAIRAH: LatLon = [25.12, 56.33];
const ORIGIN: Record<string, LatLon> = { India: [17.4, 78.5], "United States": [39.8, -98.6], Canada: [43.7, -79.4] };
// Illustrative sea paths to the Gulf of Oman (waypoints, not real vessel tracks).
const SEA_PATH: Record<string, LatLon[]> = {
  India: [[18.9, 72.8], [21.0, 62.0]],
  "United States": [[36.0, -40.0], [36.0, -5.6], [31.3, 32.3], [12.6, 43.4], [17.0, 57.0]],
  Canada: [[45.0, -40.0], [36.0, -5.6], [31.3, 32.3], [12.6, 43.4], [17.0, 57.0]],
};

export default function RouteMap({ crisis }: { crisis: boolean }) {
  const dark = useIsDark();
  const origins = new Set(suppliers.makers.map((m) => m.country));
  const traces: object[] = [];
  for (const r of suppliers.route_mix.filter((x) => origins.has(x.origin_country))) {
    const o = ORIGIN[r.origin_country];
    const sea = [o, ...SEA_PATH[r.origin_country]];
    // In Crisis mode the Hormuz-bound sea volume is rerouted to the east coast (Fujairah / Khor Fakkan), assumption A36.
    const lanes: { name: string; pts: LatLon[]; share: number; stressed: boolean; color: string }[] = crisis
      ? [
          { name: "Gulf air (cannot reroute)", pts: [o, DUBAI], share: r.air_gulf_share, stressed: true, color: "#0284c7" },
          { name: "Sea rerouted to east coast (was Hormuz)", pts: [...sea, FUJAIRAH], share: r.sea_hormuz_share, stressed: false, color: "#0f766e" },
          { name: "Gulf of Oman sea", pts: [...sea, FUJAIRAH], share: r.sea_gulf_of_oman_share, stressed: false, color: "#0d9488" },
        ]
      : [
          { name: "Gulf air", pts: [o, DUBAI], share: r.air_gulf_share, stressed: true, color: "#0284c7" },
          { name: "Hormuz sea", pts: [...sea, HORMUZ, DUBAI], share: r.sea_hormuz_share, stressed: true, color: "#7c3aed" },
          { name: "Gulf of Oman sea (outside Hormuz)", pts: [...sea, FUJAIRAH], share: r.sea_gulf_of_oman_share, stressed: false, color: "#0d9488" },
        ];
    for (const l of lanes) {
      const hot = crisis && l.stressed;
      traces.push({
        type: "scattergeo",
        mode: "lines",
        lat: l.pts.map((p) => p[0]),
        lon: l.pts.map((p) => p[1]),
        line: { width: 1.5 + l.share * 9, color: hot ? "#be123c" : l.color, dash: l.name.startsWith("Sea rerouted") ? "dash" : l.name.startsWith("Gulf air") ? "dot" : "solid" },
        opacity: 0.85,
        name: `${r.origin_country}: ${l.name} ${(l.share * 100).toFixed(0)}%`,
        hoverinfo: "name",
      });
    }
    traces.push({
      type: "scattergeo",
      mode: "markers+text",
      lat: [o[0]],
      lon: [o[1]],
      text: [r.origin_country],
      textposition: "bottom center",
      marker: { size: 9, color: "#1f4e79" },
      showlegend: false,
      hoverinfo: "text",
    });
  }
  traces.push({
    type: "scattergeo",
    mode: "markers+text",
    lat: [DUBAI[0]],
    lon: [DUBAI[1]],
    text: ["UAE"],
    textposition: "top left",
    marker: { size: 11, color: crisis ? "#be123c" : "#0d9488", symbol: "star" },
    showlegend: false,
    hoverinfo: "text",
  });
  return (
    <div style={{ height: 420 }} role="img" aria-label="Map of supply lanes from India, the United States and Canada to the UAE, by Gulf air, Hormuz sea and Gulf of Oman sea share">
      <GeoPlot
        data={traces}
        layout={{
          autosize: true,
          margin: { l: 0, r: 0, t: 0, b: 0 },
          paper_bgcolor: "rgba(0,0,0,0)",
          font: { family: "Inter, system-ui, sans-serif", size: 11, color: dark ? "#e7eef7" : "#0f1b2d" },
          legend: { orientation: "h", y: -0.05, font: { size: 10 } },
          geo: {
            projection: { type: "natural earth" },
            showland: true,
            landcolor: dark ? "#13213a" : "#eef2f7",
            showocean: true,
            oceancolor: dark ? "#070e1b" : "#ffffff",
            showcountries: true,
            countrycolor: dark ? "#24364f" : "#cbd5e1",
            coastlinecolor: dark ? "#24364f" : "#cbd5e1",
            lataxis: { range: [0, 60] },
            lonaxis: { range: [-110, 95] },
            bgcolor: "rgba(0,0,0,0)",
          },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
