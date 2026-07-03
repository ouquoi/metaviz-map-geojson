import { useEffect, useMemo, useRef, useState } from "react";
import type { CustomVisualizationProps } from "@metabase/custom-viz";
import type { Settings, GeoJSONCoord, GeoJSONFeature, GeoJSONFeatureCollection } from "./types";
import {
  TILE_SIZE, lonToTileX, latToTileY, tileXToLon, tileYToLat,
  buildTileList, projectPoint, autoFit,
  type MapState,
} from "./utils";

const TOOLTIP_W = 220;
const TOOLTIP_ROW_H = 16;
const TOOLTIP_HEADER_H = 22;
const TOOLTIP_PAD_V = 10;
const STRIP_W = 4;
const MAX_PROPS = 5;
const POINT_R = 5;

// ── GeoJSON helpers ───────────────────────────────────────────────────────────

function featureColor(props: Record<string, unknown>, fallback: string): string {
  const r = props.r ?? props.R;
  const g = props.g ?? props.G;
  const b = props.b ?? props.B;
  if (typeof r === "number" && typeof g === "number" && typeof b === "number") {
    return `rgb(${r},${g},${b})`;
  }
  const c = props.color ?? props.colour ?? props.fill;
  if (typeof c === "string" && /^#[0-9a-f]{3,6}$/i.test(c.trim())) return c.trim();
  return fallback;
}

function featureLabel(props: Record<string, unknown>, labelProp: string): string {
  if (labelProp && props[labelProp] != null) return String(props[labelProp]);
  const candidates = ["nom_ligne", "name", "nom", "label", "title", "libelle", "NAME"];
  for (const k of candidates) {
    if (typeof props[k] === "string" && props[k]) return props[k] as string;
  }
  const firstStr = Object.entries(props).find(([, v]) => typeof v === "string" && v);
  return firstStr ? String(firstStr[1]) : "";
}

function displayProps(props: Record<string, unknown>, labelProp: string): [string, string][] {
  const label = featureLabel(props, labelProp);
  return Object.entries(props)
    .filter(([, v]) => v != null && typeof v !== "object")
    .filter(([, v]) => String(v) !== label)
    .filter(([k]) => !["r","g","b","R","G","B","color","colour","fill"].includes(k))
    .slice(0, MAX_PROPS)
    .map(([k, v]) => [k, String(v)]);
}

function coordsToBbox(coords: unknown): [number, number, number, number] {
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

function geojsonBbox(fc: GeoJSONFeatureCollection): [number, number, number, number] | null {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const f of fc.features) {
    const [fMinLon, fMinLat, fMaxLon, fMaxLat] = coordsToBbox(f.geometry.coordinates);
    if (fMinLat < minLat) minLat = fMinLat;
    if (fMaxLat > maxLat) maxLat = fMaxLat;
    if (fMinLon < minLon) minLon = fMinLon;
    if (fMaxLon > maxLon) maxLon = fMaxLon;
  }
  if (!isFinite(minLat)) return null;
  return [minLon, minLat, maxLon, maxLat];
}

function featureCenter(coords: unknown, state: MapState, vpW: number, vpH: number): [number, number] {
  const [minLon, minLat, maxLon, maxLat] = coordsToBbox(coords);
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  return projectPoint(centerLat, centerLon, state, vpW, vpH);
}

// Convert coordinate ring(s) to SVG path d string (with optional close)
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

function geometryToSvg(
  feature: GeoJSONFeature,
  idx: number,
  state: MapState,
  vpW: number,
  vpH: number,
  color: string,
  strokeWidth: number,
  fillOpacity: number,
  hovered: boolean,
  anyHovered: boolean,
  onEnter: () => void,
  onLeave: () => void,
): React.ReactElement | null {
  const { geometry } = feature;
  const opacity = anyHovered ? (hovered ? 1 : 0.25) : 1;
  const sw = hovered ? strokeWidth + 1 : strokeWidth;

  const sharedLine = {
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity,
    cursor: "pointer",
    style: { cursor: "pointer" } as React.CSSProperties,
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
  };

  const sharedPoly = {
    fill: color,
    fillOpacity: fillOpacity * opacity,
    stroke: color,
    strokeWidth: sw * 0.5,
    strokeLinejoin: "round" as const,
    cursor: "pointer",
    style: { cursor: "pointer" } as React.CSSProperties,
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
  };

  if (geometry.type === "Point") {
    const [px, py] = projectPoint(geometry.coordinates[1], geometry.coordinates[0], state, vpW, vpH);
    return (
      <circle key={idx} cx={px} cy={py} r={POINT_R}
        fill={color} fillOpacity={opacity} stroke="#fff" strokeWidth={1}
        style={{ cursor: "pointer" }}
        onMouseEnter={onEnter} onMouseLeave={onLeave}
      />
    );
  }

  if (geometry.type === "MultiPoint") {
    return (
      <g key={idx} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {geometry.coordinates.map(([lon, lat], i) => {
          const [px, py] = projectPoint(lat, lon, state, vpW, vpH);
          return <circle key={i} cx={px} cy={py} r={POINT_R} fill={color} fillOpacity={opacity} stroke="#fff" strokeWidth={1} />;
        })}
      </g>
    );
  }

  if (geometry.type === "LineString") {
    const d = ringToPath(geometry.coordinates, false, state, vpW, vpH);
    return <path key={idx} d={d} {...sharedLine} />;
  }

  if (geometry.type === "MultiLineString") {
    const d = geometry.coordinates.map(line => ringToPath(line, false, state, vpW, vpH)).join(" ");
    return <path key={idx} d={d} {...sharedLine} />;
  }

  if (geometry.type === "Polygon") {
    const d = geometry.coordinates.map(ring => ringToPath(ring, true, state, vpW, vpH)).join(" ");
    return <path key={idx} d={d} {...sharedPoly} />;
  }

  if (geometry.type === "MultiPolygon") {
    const d = geometry.coordinates
      .flatMap(poly => poly.map(ring => ringToPath(ring, true, state, vpW, vpH)))
      .join(" ");
    return <path key={idx} d={d} {...sharedPoly} />;
  }

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

type TooltipData = {
  svgX: number;
  svgY: number;
  color: string;
  label: string;
  props: [string, string][];
};

export function GeoJsonMap({
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

  const geojsonUrl   = settings.geojsonUrl ?? "";
  const labelProp    = settings.labelProperty ?? "";
  const defaultColor = settings.defaultColor ?? "#509EE3";
  const strokeWidth  = Math.max(1, Math.min(8, settings.strokeWidth ?? 2));
  const fillOpacity  = Math.max(0, Math.min(1, settings.fillOpacity ?? 0.4));
  const showTiles    = settings.showTiles ?? true;

  // ── Fetch state ─────────────────────────────────────────────────────────────
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!geojsonUrl.trim()) { setGeojson(null); setFetchError(null); return; }
    setLoading(true);
    setFetchError(null);
    setGeojson(null);
    fetch(geojsonUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        return r.json() as Promise<GeoJSONFeatureCollection>;
      })
      .then(data => { setGeojson(data); setLoading(false); })
      .catch(e => { setFetchError(String(e?.message ?? e)); setLoading(false); });
  }, [geojsonUrl]);

  // ── Map state ─────────────────────────────────────────────────────────────
  const [mapState, setMapState] = useState<MapState | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!geojson) return;
    const bbox = geojsonBbox(geojson);
    if (!bbox) return;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    setMapState(autoFit([
      { lat: minLat, lon: minLon },
      { lat: maxLat, lon: maxLon },
    ], cw, ch));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

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
        const pxMin = centerPxX - cw / 2;
        const pyMin = centerPxY - ch / 2;
        const wx = pxMin + cursorX;
        const wy = pyMin + cursorY;
        const newPxMin = wx * scaleFactor - cursorX;
        const newPyMin = wy * scaleFactor - cursorY;
        const newLon = tileXToLon((newPxMin + cw / 2) / TILE_SIZE, newZoom);
        const newLat = tileYToLat((newPyMin + ch / 2) / TILE_SIZE, newZoom);
        return {
          zoom: newZoom,
          lat: Math.max(-85, Math.min(85, newLat)),
          lon: ((newLon + 180) % 360 + 360) % 360 - 180,
        };
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
    const dLon = -dx * 360 / (TILE_SIZE * n);
    const startCyTile = latToTileY(dragRef.current.lat, mapState.zoom);
    const newLat = tileYToLat(startCyTile - dy / TILE_SIZE, mapState.zoom);
    const newLon = dragRef.current.lon + dLon;
    setMapState({
      zoom: mapState.zoom,
      lat: Math.max(-85, Math.min(85, newLat)),
      lon: ((newLon + 180) % 360 + 360) % 360 - 180,
    });
  };

  const onMouseUp = () => { dragRef.current = null; setIsDragging(false); };

  // ── Feature rendering ──────────────────────────────────────────────────────
  const featureEls = useMemo(() => {
    if (!geojson || !mapState) return null;
    const anyHovered = hoveredIdx !== null;
    return geojson.features.map((feature, i) => {
      const color = featureColor(feature.properties, defaultColor);
      const hovered = hoveredIdx === i;
      return geometryToSvg(
        feature, i, mapState, cw, ch, color, strokeWidth, fillOpacity, hovered, anyHovered,
        () => {
          setHoveredIdx(i);
          const [sx, sy] = featureCenter(feature.geometry.coordinates, mapState, cw, ch);
          setTooltip({
            svgX: sx,
            svgY: sy,
            color,
            label: featureLabel(feature.properties, labelProp),
            props: displayProps(feature.properties, labelProp),
          });
        },
        () => { setHoveredIdx(null); setTooltip(null); },
      );
    });
  }, [geojson, mapState, hoveredIdx, defaultColor, strokeWidth, fillOpacity, cw, ch, labelProp]);

  // ── Empty / loading / error states ────────────────────────────────────────
  const msgStyle: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, width: cw, height: ch,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "sans-serif", fontSize: 13, color: axisColor, background: bgColor,
    textAlign: "center", padding: 16,
  };

  if (!geojsonUrl.trim()) {
    return <div style={msgStyle}>Configure a GeoJSON URL in the Data settings.</div>;
  }
  if (loading) {
    return <div style={msgStyle}>Loading GeoJSON…</div>;
  }
  if (fetchError) {
    return (
      <div style={msgStyle}>
        <span>
          <strong>Failed to load GeoJSON</strong><br />
          {fetchError}<br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>Check the URL and CORS headers.</span>
        </span>
      </div>
    );
  }
  if (!geojson || !mapState) {
    return <div style={msgStyle}>No data.</div>;
  }

  // ── Tiles ──────────────────────────────────────────────────────────────────
  const tiles = showTiles ? buildTileList(mapState, cw, ch) : [];

  // ── Zoom buttons ───────────────────────────────────────────────────────────
  const zoomBtnStyle: React.CSSProperties = {
    display: "block", width: 28, height: 28,
    background: dark ? "#2a2a2a" : "#fff",
    color: dark ? "#ccc" : "#333",
    border: `1px solid ${dark ? "#444" : "#ccc"}`,
    borderRadius: 4, fontSize: 18, lineHeight: "26px",
    textAlign: "center", cursor: "pointer", userSelect: "none",
    padding: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.2)", marginBottom: 2,
  };

  // ── Tooltip ────────────────────────────────────────────────────────────────
  let tooltipEl: React.ReactElement | null = null;
  if (tooltip) {
    const tooltipH = TOOLTIP_PAD_V * 2 + TOOLTIP_HEADER_H + tooltip.props.length * TOOLTIP_ROW_H;
    const GAP = 12;
    let top = tooltip.svgY - GAP - tooltipH;
    if (top < 4) top = tooltip.svgY + GAP;
    let left = tooltip.svgX - TOOLTIP_W / 2;
    left = Math.max(4, Math.min(cw - TOOLTIP_W - 4, left));

    const cardBg = dark ? "#1F2335" : "#fff";
    const border = `1px solid ${dark ? "#3A4060" : "#e0e0e0"}`;
    const textMain = dark ? "#e0e0e0" : "#1a1a1a";
    const textSub = dark ? "#9BA7B5" : "#666";

    tooltipEl = (
      <div style={{ position: "absolute", top, left, width: TOOLTIP_W, pointerEvents: "none", zIndex: 9999 }}>
        <div style={{
          background: cardBg, border, borderRadius: 6,
          boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          overflow: "hidden", display: "flex", flexDirection: "row",
        }}>
          <div style={{ width: STRIP_W, background: tooltip.color, flexShrink: 0 }} />
          <div style={{ padding: `${TOOLTIP_PAD_V}px 10px`, minWidth: 0, flex: 1 }}>
            {tooltip.label && (
              <div style={{
                fontSize: 12, fontWeight: 700, color: textMain,
                fontFamily: "sans-serif", whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis",
                marginBottom: tooltip.props.length > 0 ? 4 : 0,
              }}>
                {tooltip.label}
              </div>
            )}
            {tooltip.props.map(([k, v]) => (
              <div key={k} style={{
                fontSize: 11, color: textSub, fontFamily: "sans-serif",
                display: "flex", gap: 4, whiteSpace: "nowrap", overflow: "hidden",
              }}>
                <span style={{ color: textSub, opacity: 0.7, flexShrink: 0 }}>{k}:</span>
                <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative", width: cw, height: ch,
        background: bgColor, overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Map background */}
      <div style={{ position: "absolute", top: 0, left: 0, width: cw, height: ch, background: dark ? "#2a2a2a" : "#e8eef4" }} />

      {/* OSM tile layer */}
      {showTiles && (
        <div style={{ position: "absolute", top: 0, left: 0, width: cw, height: ch, overflow: "hidden" }}>
          {tiles.map(({ tileX, tileY, x, y }) => (
            <img
              key={`${tileX}-${tileY}`}
              src={`https://tile.openstreetmap.org/${mapState.zoom}/${tileX}/${tileY}.png`}
              style={{
                position: "absolute", left: Math.round(x), top: Math.round(y),
                width: TILE_SIZE, height: TILE_SIZE, display: "block", pointerEvents: "none",
              }}
              alt=""
              draggable={false}
            />
          ))}
        </div>
      )}

      {/* SVG overlay — GeoJSON features */}
      <svg
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        width={cw}
        height={ch}
      >
        <clipPath id="gj-clip">
          <rect x={0} y={0} width={cw} height={ch} />
        </clipPath>
        <g clipPath="url(#gj-clip)" style={{ pointerEvents: "all" }}>
          {featureEls}
        </g>
        <text x={cw - 4} y={ch - 4} fontSize={9} fill={dark ? "#888" : "#666"}
          textAnchor="end" fontFamily="sans-serif" style={{ pointerEvents: "none" }}>
          © OpenStreetMap contributors
        </text>
      </svg>

      {/* Zoom controls */}
      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, pointerEvents: "all" }}>
        <button style={zoomBtnStyle}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setMapState(p => p ? { ...p, zoom: Math.min(18, p.zoom + 1) } : p); }}>
          +
        </button>
        <button style={zoomBtnStyle}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setMapState(p => p ? { ...p, zoom: Math.max(0, p.zoom - 1) } : p); }}>
          −
        </button>
      </div>

      {/* Feature count badge */}
      <div style={{
        position: "absolute", bottom: 20, right: 8, zIndex: 10,
        background: dark ? "rgba(30,30,30,0.8)" : "rgba(255,255,255,0.85)",
        border: `1px solid ${dark ? "#444" : "#ddd"}`,
        borderRadius: 4, padding: "2px 6px",
        fontSize: 10, color: axisColor, fontFamily: "sans-serif",
        pointerEvents: "none",
      }}>
        {geojson.features.length} features
      </div>

      {tooltipEl}
    </div>
  );
}
