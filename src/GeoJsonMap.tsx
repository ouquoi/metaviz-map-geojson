import { useEffect, useMemo, useRef, useState } from "react";
import type { CustomVisualizationProps } from "@metabase/custom-viz";
import type { Settings, GeoJSONCoord, GeoJSONGeometry } from "./types";
import {
  TILE_SIZE, lonToTileX, latToTileY, tileXToLon, tileYToLat,
  buildTileList, projectPoint, autoFit,
  type MapState,
} from "./utils";

const TOOLTIP_W = 210;
const TOOLTIP_ROW_H = 16;
const TOOLTIP_HEADER_H = 22;
const TOOLTIP_PAD_V = 8;
const STRIP_W = 4;
const POINT_R = 5;

// ── Geometry helpers ──────────────────────────────────────────────────────────

function parseGeometry(raw: unknown): GeoJSONGeometry | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (obj && typeof obj === "object" && "type" in obj && "coordinates" in obj) {
      return obj as GeoJSONGeometry;
    }
    // Support Feature wrapper
    if (obj && typeof obj === "object" && "type" in obj && (obj as {type:string}).type === "Feature" && "geometry" in obj) {
      return (obj as {geometry: GeoJSONGeometry}).geometry;
    }
  } catch { /* invalid JSON */ }
  return null;
}

function clampByte(n: number): number {
  const rounded = Math.round(n);
  return Math.max(0, Math.min(255, rounded));
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function coordsBbox(coords: unknown): [number, number, number, number] {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  function walk(c: unknown): void {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number") {
      const lon = c[0] as number, lat = c[1] as number;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    } else { for (const item of c) walk(item); }
  }
  walk(coords);
  return [minLon, minLat, maxLon, maxLat];
}

function geometryCenter(geom: GeoJSONGeometry, state: MapState, vpW: number, vpH: number): [number, number] {
  const [minLon, minLat, maxLon, maxLat] = coordsBbox(geom.coordinates);
  return projectPoint((minLat + maxLat) / 2, (minLon + maxLon) / 2, state, vpW, vpH);
}

function ringToPath(ring: GeoJSONCoord[], close: boolean, state: MapState, vpW: number, vpH: number): string {
  if (ring.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    const [px, py] = projectPoint(lat, lon, state, vpW, vpH);
    parts.push(`${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`);
  }
  if (close) parts.push("Z");
  return parts.join(" ");
}

type FeatureEntry = {
  idx: number;
  geom: GeoJSONGeometry;
  color: string;
  title: string;
  label: string;
  valueName: string;
  value: string;
};

function renderGeometry(
  entry: FeatureEntry,
  state: MapState,
  vpW: number,
  vpH: number,
  strokeWidth: number,
  fillOpacity: number,
  hovered: boolean,
  anyHovered: boolean,
  onEnter: () => void,
  onLeave: () => void,
): React.ReactElement | null {
  const { geom, color, idx } = entry;
  const opacity = anyHovered ? (hovered ? 1 : 0.25) : 1;
  const sw = hovered ? strokeWidth + 1 : strokeWidth;

  const lineProps = {
    fill: "none" as const,
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity,
    style: { cursor: "pointer" } as React.CSSProperties,
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
  };

  const polyProps = {
    fill: color,
    fillOpacity: fillOpacity * opacity,
    stroke: color,
    strokeWidth: sw * 0.5,
    strokeLinejoin: "round" as const,
    style: { cursor: "pointer" } as React.CSSProperties,
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
  };

  if (geom.type === "Point") {
    const [px, py] = projectPoint(geom.coordinates[1], geom.coordinates[0], state, vpW, vpH);
    return (
      <circle key={idx} cx={px} cy={py} r={POINT_R}
        fill={color} fillOpacity={opacity} stroke="#fff" strokeWidth={1}
        style={{ cursor: "pointer" }} onMouseEnter={onEnter} onMouseLeave={onLeave}
      />
    );
  }
  if (geom.type === "MultiPoint") {
    return (
      <g key={idx} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {geom.coordinates.map(([lon, lat], i) => {
          const [px, py] = projectPoint(lat, lon, state, vpW, vpH);
          return <circle key={i} cx={px} cy={py} r={POINT_R} fill={color} fillOpacity={opacity} stroke="#fff" strokeWidth={1} />;
        })}
      </g>
    );
  }
  if (geom.type === "LineString") {
    return <path key={idx} d={ringToPath(geom.coordinates, false, state, vpW, vpH)} {...lineProps} />;
  }
  if (geom.type === "MultiLineString") {
    const d = geom.coordinates.map(l => ringToPath(l, false, state, vpW, vpH)).join(" ");
    return <path key={idx} d={d} {...lineProps} />;
  }
  if (geom.type === "Polygon") {
    const d = geom.coordinates.map(r => ringToPath(r, true, state, vpW, vpH)).join(" ");
    return <path key={idx} d={d} {...polyProps} />;
  }
  if (geom.type === "MultiPolygon") {
    const d = geom.coordinates.flatMap(poly => poly.map(r => ringToPath(r, true, state, vpW, vpH))).join(" ");
    return <path key={idx} d={d} {...polyProps} />;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

type TooltipData = {
  svgX: number;
  svgY: number;
  color: string;
  title: string;
  label: string;
  valueName: string;
  value: string;
};

export function GeoJsonMap({
  series,
  settings,
  width,
  height,
  colorScheme,
}: CustomVisualizationProps<Settings>) {
  const cw = (width ?? 0) > 0 ? Math.floor(width ?? 0) : 0;
  const ch = (height ?? 0) > 0 ? Math.floor(height ?? 0) : 0;
  if (!cw || !ch) return null;

  const dark = colorScheme === "dark";
  const bgColor = dark ? "#1c1c1c" : "#f0f4f8";
  const axisColor = dark ? "#9BA7B5" : "#6E7B8B";

  const geomCol    = settings.geometryColumn ?? "";
  const titleCol   = settings.titleColumn ?? "";
  const labelCol   = settings.labelColumn ?? "";
  const valueCol   = settings.valueColumn ?? "";
  const colorMode  = settings.colorMode ?? "hex";
  const colorCol   = settings.colorColumn ?? "";
  const redCol     = settings.redColumn ?? "";
  const greenCol   = settings.greenColumn ?? "";
  const blueCol    = settings.blueColumn ?? "";
  const defColor   = settings.defaultColor ?? "#509EE3";
  const strokeWidth = Math.max(1, Math.min(8, settings.strokeWidth ?? 2));
  const fillOpacity = Math.max(0, Math.min(1, settings.fillOpacity ?? 0.4));
  const showTiles  = settings.showTiles ?? true;

  // ── Parse rows ─────────────────────────────────────────────────────────────
  const data = series?.[0]?.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cols = (data?.cols ?? []) as any[];
  const rows = (data?.rows ?? []) as unknown[][];

  const colIdx = (name: string) => cols.findIndex((c) => c.name === name);

  const geomIdx  = colIdx(geomCol);
  const titleIdx = colIdx(titleCol);
  const labelIdx = colIdx(labelCol);
  const valueIdx = colIdx(valueCol);
  const colorIdx = colIdx(colorCol);
  const redIdx   = colIdx(redCol);
  const greenIdx = colIdx(greenCol);
  const blueIdx  = colIdx(blueCol);
  const rgbReady = colorMode === "rgb" && redIdx >= 0 && greenIdx >= 0 && blueIdx >= 0;

  const features: FeatureEntry[] = useMemo(() => {
    if (geomIdx < 0) return [];
    const result: FeatureEntry[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const geom = parseGeometry(row[geomIdx]);
      if (!geom) continue;

      let color = defColor;
      if (rgbReady) {
        const r = Number(row[redIdx]);
        const g = Number(row[greenIdx]);
        const b = Number(row[blueIdx]);
        color = rgbToHex(Number.isFinite(r) ? r : 0, Number.isFinite(g) ? g : 0, Number.isFinite(b) ? b : 0);
      } else if (colorMode === "hex") {
        const rawColor = colorIdx >= 0 ? String(row[colorIdx] ?? "").trim() : "";
        const hexColor = /^#?[0-9a-f]{6}$/i.test(rawColor)
          ? (rawColor.startsWith("#") ? rawColor : `#${rawColor}`)
          : null;
        color = hexColor ?? defColor;
      }

      const title     = titleIdx >= 0 && row[titleIdx] != null ? String(row[titleIdx]) : "";
      const label     = labelIdx >= 0 && row[labelIdx] != null ? String(row[labelIdx]) : "";
      const rawValue  = valueIdx >= 0 ? row[valueIdx] : null;
      const valueName = valueIdx >= 0 ? (cols[valueIdx].display_name || cols[valueIdx].name || "") : "";
      const value     = rawValue != null ? Number(rawValue).toLocaleString() : "";

      result.push({ idx: i, geom, color, title, label, valueName, value });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, geomIdx, titleIdx, labelIdx, valueIdx, colorMode, colorIdx, redIdx, greenIdx, blueIdx, rgbReady, defColor]);

  // ── Map state ──────────────────────────────────────────────────────────────
  const [mapState, setMapState] = useState<MapState | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; lat: number; lon: number } | null>(null);

  // Auto-fit on data change
  const featuresKey = features.length;
  useEffect(() => {
    if (features.length === 0) return;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const f of features) {
      const [fMinLon, fMinLat, fMaxLon, fMaxLat] = coordsBbox(f.geom.coordinates);
      if (fMinLat < minLat) minLat = fMinLat;
      if (fMaxLat > maxLat) maxLat = fMaxLat;
      if (fMinLon < minLon) minLon = fMinLon;
      if (fMaxLon > maxLon) maxLon = fMaxLon;
    }
    if (!isFinite(minLat)) return;
    setMapState(autoFit([{ lat: minLat, lon: minLon }, { lat: maxLat, lon: maxLon }], cw, ch));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuresKey]);

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      setMapState(prev => {
        if (!prev) return prev;
        const newZoom = Math.max(0, Math.min(18, prev.zoom + delta));
        if (newZoom === prev.zoom) return prev;
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const scaleFactor = Math.pow(2, newZoom - prev.zoom);
        const centerPxX = lonToTileX(prev.lon, prev.zoom) * TILE_SIZE;
        const centerPxY = latToTileY(prev.lat, prev.zoom) * TILE_SIZE;
        const wx = (centerPxX - cw / 2) + cursorX;
        const wy = (centerPxY - ch / 2) + cursorY;
        const newLon = tileXToLon((wx * scaleFactor - cursorX + cw / 2) / TILE_SIZE, newZoom);
        const newLat = tileYToLat((wy * scaleFactor - cursorY + ch / 2) / TILE_SIZE, newZoom);
        return { zoom: newZoom, lat: Math.max(-85, Math.min(85, newLat)), lon: ((newLon + 180) % 360 + 360) % 360 - 180 };
      });
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [cw, ch]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, lat: mapState?.lat ?? 0, lon: mapState?.lon ?? 0 };
    setIsDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !mapState) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    const n = Math.pow(2, mapState.zoom);
    const newLat = tileYToLat(latToTileY(dragRef.current.lat, mapState.zoom) - dy / TILE_SIZE, mapState.zoom);
    const newLon = dragRef.current.lon + (-dx * 360 / (TILE_SIZE * n));
    setMapState({ zoom: mapState.zoom, lat: Math.max(-85, Math.min(85, newLat)), lon: ((newLon + 180) % 360 + 360) % 360 - 180 });
  };
  const onMouseUp = () => { dragRef.current = null; setIsDragging(false); };

  // ── Feature rendering ──────────────────────────────────────────────────────
  const featureEls = useMemo(() => {
    if (!mapState || features.length === 0) return null;
    const anyHovered = hoveredIdx !== null;
    return features.map((entry) => renderGeometry(
      entry, mapState, cw, ch, strokeWidth, fillOpacity,
      hoveredIdx === entry.idx, anyHovered,
      () => {
        setHoveredIdx(entry.idx);
        const [sx, sy] = geometryCenter(entry.geom, mapState, cw, ch);
        setTooltip({ svgX: sx, svgY: sy, color: entry.color, title: entry.title, label: entry.label, valueName: entry.valueName, value: entry.value });
      },
      () => { setHoveredIdx(null); setTooltip(null); },
    ));
  }, [features, mapState, hoveredIdx, strokeWidth, fillOpacity, cw, ch]);

  // ── Empty states ───────────────────────────────────────────────────────────
  const msgStyle: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, width: cw, height: ch,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "sans-serif", fontSize: 13, color: axisColor, background: bgColor, textAlign: "center", padding: 16,
  };

  if (geomIdx < 0) {
    return <div style={msgStyle}>Select a geometry column in Data settings.</div>;
  }
  if (features.length === 0 || !mapState) {
    return <div style={msgStyle}>No geometry data to display.</div>;
  }

  // ── Tiles + controls ───────────────────────────────────────────────────────
  const tiles = showTiles ? buildTileList(mapState, cw, ch) : [];

  const zoomBtnStyle: React.CSSProperties = {
    display: "block", width: 28, height: 28,
    background: dark ? "#2a2a2a" : "#fff", color: dark ? "#ccc" : "#333",
    border: `1px solid ${dark ? "#444" : "#ccc"}`,
    borderRadius: 4, fontSize: 18, lineHeight: "26px", textAlign: "center",
    cursor: "pointer", userSelect: "none", padding: 0,
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)", marginBottom: 2,
  };

  // ── Tooltip ────────────────────────────────────────────────────────────────
  let tooltipEl: React.ReactElement | null = null;
  if (tooltip) {
    const rowCount = (tooltip.label ? 1 : 0) + (tooltip.value ? 1 : 0);
    const tooltipH = TOOLTIP_PAD_V * 2 + (tooltip.title ? TOOLTIP_HEADER_H : 0) + rowCount * TOOLTIP_ROW_H;
    const GAP = 12;
    let top = tooltip.svgY - GAP - tooltipH;
    if (top < 4) top = tooltip.svgY + GAP;
    let left = tooltip.svgX - TOOLTIP_W / 2;
    left = Math.max(4, Math.min(cw - TOOLTIP_W - 4, left));

    const cardBg  = dark ? "#1F2335" : "#fff";
    const border  = `1px solid ${dark ? "#3A4060" : "#e0e0e0"}`;
    const textMain = dark ? "#e0e0e0" : "#1a1a1a";
    const textSub  = dark ? "#9BA7B5" : "#666";

    tooltipEl = (
      <div style={{ position: "absolute", top, left, width: TOOLTIP_W, pointerEvents: "none", zIndex: 9999 }}>
        <div style={{ background: cardBg, border, borderRadius: 6, boxShadow: "0 2px 10px rgba(0,0,0,0.18)", overflow: "hidden", display: "flex" }}>
          <div style={{ width: STRIP_W, background: tooltip.color, flexShrink: 0 }} />
          <div style={{ padding: `${TOOLTIP_PAD_V}px 10px`, minWidth: 0, flex: 1 }}>
            {tooltip.title && (
              <div style={{ fontSize: 12, fontWeight: 700, color: textMain, fontFamily: "sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: rowCount > 0 ? 3 : 0 }}>
                {tooltip.title}
              </div>
            )}
            {tooltip.label && (
              <div style={{ fontSize: 11, color: textSub, fontFamily: "sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {tooltip.label}
              </div>
            )}
            {tooltip.value && (
              <div style={{ fontSize: 11, color: textSub, fontFamily: "sans-serif", whiteSpace: "nowrap", marginTop: tooltip.label ? 1 : 0 }}>
                {tooltip.valueName && <span style={{ opacity: 0.7 }}>{tooltip.valueName}: </span>}
                <span style={{ fontWeight: 600, color: textMain }}>{tooltip.value}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: cw, height: ch, background: bgColor, overflow: "hidden", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: cw, height: ch, background: dark ? "#2a2a2a" : "#e8eef4" }} />

      {showTiles && (
        <div style={{ position: "absolute", top: 0, left: 0, width: cw, height: ch, overflow: "hidden" }}>
          {tiles.map(({ tileX, tileY, x, y }) => (
            <img key={`${tileX}-${tileY}`}
              src={`https://tile.openstreetmap.org/${mapState.zoom}/${tileX}/${tileY}.png`}
              style={{ position: "absolute", left: Math.round(x), top: Math.round(y), width: TILE_SIZE, height: TILE_SIZE, display: "block", pointerEvents: "none" }}
              alt="" draggable={false}
            />
          ))}
        </div>
      )}

      <svg style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} width={cw} height={ch}>
        <clipPath id="gj-clip"><rect x={0} y={0} width={cw} height={ch} /></clipPath>
        <g clipPath="url(#gj-clip)" style={{ pointerEvents: "all" }}>{featureEls}</g>
        <text x={cw - 4} y={ch - 4} fontSize={9} fill={dark ? "#888" : "#666"} textAnchor="end" fontFamily="sans-serif" style={{ pointerEvents: "none" }}>
          © OpenStreetMap contributors
        </text>
      </svg>

      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, pointerEvents: "all" }}>
        <button style={zoomBtnStyle} onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setMapState(p => p ? { ...p, zoom: Math.min(18, p.zoom + 1) } : p); }}>+</button>
        <button style={zoomBtnStyle} onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setMapState(p => p ? { ...p, zoom: Math.max(0, p.zoom - 1) } : p); }}>−</button>
      </div>

      <div style={{ position: "absolute", bottom: 20, right: 8, zIndex: 10, background: dark ? "rgba(30,30,30,0.8)" : "rgba(255,255,255,0.85)", border: `1px solid ${dark ? "#444" : "#ddd"}`, borderRadius: 4, padding: "2px 6px", fontSize: 10, color: axisColor, fontFamily: "sans-serif", pointerEvents: "none" }}>
        {features.length} features
      </div>

      {tooltipEl}
    </div>
  );
}
