import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { GeoJsonMap } from "./GeoJsonMap";
import type { Settings } from "./types";

// Mock Tisséo lines for offline preview (simplified from real data)
const MOCK_GEOJSON_URL = "";

function App() {
  const [dark, setDark] = useState(false);
  const [width, setWidth] = useState(700);
  const [height, setHeight] = useState(480);
  const [url, setUrl] = useState(MOCK_GEOJSON_URL);
  const [defaultColor, setDefaultColor] = useState("#509EE3");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillOpacity, setFillOpacity] = useState(0.4);
  const [showTiles, setShowTiles] = useState(true);

  const settings: Settings = {
    geojsonUrl: url,
    defaultColor,
    strokeWidth,
    fillOpacity,
    showTiles,
  };

  const labelStyle = { color: dark ? "#ccc" : "#333", display: "flex", alignItems: "center", gap: 4 };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24, background: dark ? "#111" : "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ ...labelStyle, flex: "1 1 400px" }}>
          GeoJSON URL:&nbsp;
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/data.geojson"
            style={{ flex: 1, minWidth: 300, fontFamily: "monospace", fontSize: 12 }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <label style={labelStyle}>
          Width:&nbsp;<input type="number" value={width} onChange={e => setWidth(+e.target.value)} style={{ width: 70 }} />
        </label>
        <label style={labelStyle}>
          Height:&nbsp;<input type="number" value={height} onChange={e => setHeight(+e.target.value)} style={{ width: 70 }} />
        </label>
        <label style={labelStyle}>
          Stroke:&nbsp;<input type="number" value={strokeWidth} onChange={e => setStrokeWidth(+e.target.value)} style={{ width: 50 }} min={1} max={8} />
        </label>
        <label style={labelStyle}>
          Fill opacity:&nbsp;<input type="number" value={fillOpacity} onChange={e => setFillOpacity(+e.target.value)} style={{ width: 55 }} min={0} max={1} step={0.05} />
        </label>
        <label style={labelStyle}>
          Color:&nbsp;<input type="color" value={defaultColor} onChange={e => setDefaultColor(e.target.value)} />
        </label>
        <label style={labelStyle}>
          <input type="checkbox" checked={showTiles} onChange={e => setShowTiles(e.target.checked)} />&nbsp;Tiles
        </label>
        <label style={labelStyle}>
          <input type="checkbox" checked={dark} onChange={e => setDark(e.target.checked)} />&nbsp;Dark
        </label>
      </div>

      <div style={{ width, height, border: `1px solid ${dark ? "#333" : "#ddd"}`, borderRadius: 8, overflow: "hidden" }}>
        <GeoJsonMap
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          series={[{ data: { cols: [], rows: [] } }] as any}
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
if (container) {
  createRoot(container).render(<StrictMode><App /></StrictMode>);
}
