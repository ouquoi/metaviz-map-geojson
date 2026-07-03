import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { GeoJsonMap } from "./GeoJsonMap";
import type { Settings } from "./types";

// Simplified Tisséo-like lines around Toulouse
const MOCK_LINES = [
  {
    nom_ligne: "Métro Ligne A — Basso-Cambo / Balma-Gramont",
    ligne: "A", mode: "metro", r: 255, v: 0, b: 0,
    geometry: '{"type":"LineString","coordinates":[[1.3700,43.5980],[1.3900,43.6020],[1.4100,43.6060],[1.4300,43.6100],[1.4442,43.6047],[1.4600,43.6080],[1.4800,43.6120],[1.5050,43.6160],[1.5200,43.6160]]}'
  },
  {
    nom_ligne: "Métro Ligne B — Borderouge / Ramonville",
    ligne: "B", mode: "metro", r: 0, v: 100, b: 200,
    geometry: '{"type":"LineString","coordinates":[[1.4390,43.6600],[1.4400,43.6500],[1.4420,43.6400],[1.4440,43.6300],[1.4442,43.6047],[1.4460,43.5900],[1.4490,43.5750],[1.4740,43.5430]]}'
  },
  {
    nom_ligne: "Tram T1 — Arènes / Beauzelle",
    ligne: "T1", mode: "tram", r: 0, v: 160, b: 70,
    geometry: '{"type":"LineString","coordinates":[[1.3980,43.5980],[1.4050,43.6050],[1.4100,43.6100],[1.4000,43.6200],[1.3900,43.6300],[1.3800,43.6400],[1.3700,43.6500]]}'
  },
  {
    nom_ligne: "Tram T2 — Palais de Justice / Médiathèque",
    ligne: "T2", mode: "tram", r: 200, v: 130, b: 0,
    geometry: '{"type":"LineString","coordinates":[[1.4300,43.5980],[1.4320,43.6050],[1.4380,43.6100],[1.4440,43.6047],[1.4500,43.6000],[1.4560,43.5960],[1.4620,43.5900]]}'
  },
  {
    nom_ligne: "Bus L1 — Colomiers / Fenouillet",
    ligne: "L1", mode: "bus", r: 140, v: 0, b: 140,
    geometry: '{"type":"LineString","coordinates":[[1.3300,43.6100],[1.3500,43.6150],[1.3700,43.6200],[1.3900,43.6250],[1.4100,43.6280],[1.4300,43.6300],[1.4500,43.6320],[1.4700,43.6400]]}'
  },
  {
    nom_ligne: "Bus 101 — Balma / Mondouzil",
    ligne: "101", mode: "bus", r: 128, v: 0, b: 128,
    geometry: '{"type":"MultiLineString","coordinates":[[[1.4800,43.6200],[1.4950,43.6250],[1.5100,43.6300],[1.5350,43.6350]],[[1.5350,43.6350],[1.5500,43.6380],[1.5650,43.6400]]]}'
  },
  {
    nom_ligne: "Bus 37 — Université / Labège",
    ligne: "37", mode: "bus", r: 200, v: 80, b: 0,
    geometry: '{"type":"LineString","coordinates":[[1.4580,43.5600],[1.4600,43.5700],[1.4630,43.5800],[1.4650,43.5900],[1.4680,43.6000],[1.4700,43.6100]]}'
  },
];

const MOCK_SERIES = [
  {
    data: {
      cols: [
        { name: "geometry",  display_name: "Geometry",  base_type: "type/Text"    },
        { name: "nom_ligne", display_name: "Nom ligne", base_type: "type/Text"    },
        { name: "ligne",     display_name: "Ligne",     base_type: "type/Text"    },
        { name: "mode",      display_name: "Mode",      base_type: "type/Text"    },
        { name: "r",         display_name: "R",         base_type: "type/Integer" },
        { name: "v",         display_name: "V",         base_type: "type/Integer" },
        { name: "b",         display_name: "B",         base_type: "type/Integer" },
      ],
      rows: MOCK_LINES.map(l => [l.geometry, l.nom_ligne, l.ligne, l.mode, l.r, l.v, l.b]),
    },
  },
];

const DEFAULT_SETTINGS: Settings = {
  geometryColumn: "geometry",
  titleColumn:    "nom_ligne",
  labelColumn:    "mode",
  valueColumn:    "",
  redColumn:      "r",
  greenColumn:    "v",
  blueColumn:     "b",
  defaultColor:   "#509EE3",
  strokeWidth:    3,
  fillOpacity:    0.4,
  showTiles:      true,
};

function App() {
  const [dark, setDark] = useState(false);
  const [width, setWidth] = useState(700);
  const [height, setHeight] = useState(480);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fillOpacity, setFillOpacity] = useState(0.4);
  const [showTiles, setShowTiles] = useState(true);

  const settings: Settings = { ...DEFAULT_SETTINGS, strokeWidth, fillOpacity, showTiles };
  const labelStyle = { color: dark ? "#ccc" : "#333", display: "flex", alignItems: "center", gap: 4 };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24, background: dark ? "#111" : "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <label style={labelStyle}>Width:&nbsp;<input type="number" value={width} onChange={e => setWidth(+e.target.value)} style={{ width: 70 }} /></label>
        <label style={labelStyle}>Height:&nbsp;<input type="number" value={height} onChange={e => setHeight(+e.target.value)} style={{ width: 70 }} /></label>
        <label style={labelStyle}>Stroke:&nbsp;<input type="number" value={strokeWidth} onChange={e => setStrokeWidth(+e.target.value)} style={{ width: 50 }} min={1} max={8} /></label>
        <label style={labelStyle}>Fill opacity:&nbsp;<input type="number" value={fillOpacity} onChange={e => setFillOpacity(+e.target.value)} style={{ width: 55 }} min={0} max={1} step={0.05} /></label>
        <label style={labelStyle}><input type="checkbox" checked={showTiles} onChange={e => setShowTiles(e.target.checked)} />&nbsp;Tiles</label>
        <label style={labelStyle}><input type="checkbox" checked={dark} onChange={e => setDark(e.target.checked)} />&nbsp;Dark</label>
      </div>

      <div style={{ width, height, border: `1px solid ${dark ? "#333" : "#ddd"}`, borderRadius: 8, overflow: "hidden" }}>
        <GeoJsonMap
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          series={MOCK_SERIES as any}
          settings={settings}
          width={width}
          height={height}
          colorScheme={dark ? "dark" : "light"}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onClick={() => {}}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onHover={() => {}}
        />
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<StrictMode><App /></StrictMode>);
