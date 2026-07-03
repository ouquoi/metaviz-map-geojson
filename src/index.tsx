import { type CreateCustomVisualization, defineConfig } from "@metabase/custom-viz";
import { GeoJsonMap } from "./GeoJsonMap";
import type { Settings } from "./types";

const createVisualization: CreateCustomVisualization<Settings> = ({ defineSetting }) => {
  return defineConfig<Settings>({
    id: "map-geojson",
    getName: () => "Map GeoJSON",
    minSize: { width: 4, height: 3 },
    defaultSize: { width: 12, height: 6 },

    checkRenderable(_series) {
      // Data comes from the GeoJSON URL setting — no SQL structure required
    },

    settings: {
      // ── Data ──────────────────────────────────────────────────────────
      geojsonUrl: defineSetting({
        id: "geojsonUrl",
        title: "GeoJSON URL",
        widget: "input",
        getSection() { return "Data"; },
        getDefault() { return ""; },
      }),

      labelProperty: defineSetting({
        id: "labelProperty",
        title: "Label property (auto-detect if empty)",
        widget: "input",
        getSection() { return "Data"; },
        getDefault() { return ""; },
      }),

      // ── Appearance ────────────────────────────────────────────────────
      defaultColor: defineSetting({
        id: "defaultColor",
        title: "Default color",
        widget: "color",
        getSection() { return "Appearance"; },
        getDefault() { return "#509EE3"; },
      }),

      strokeWidth: defineSetting({
        id: "strokeWidth",
        title: "Stroke width",
        widget: "number",
        getSection() { return "Appearance"; },
        getDefault() { return 2; },
      }),

      fillOpacity: defineSetting({
        id: "fillOpacity",
        title: "Fill opacity (polygons)",
        widget: "number",
        getSection() { return "Appearance"; },
        getDefault() { return 0.4; },
      }),

      showTiles: defineSetting({
        id: "showTiles",
        title: "Show background map",
        widget: "toggle",
        getSection() { return "Appearance"; },
        getDefault() { return true; },
      }),
    },

    VisualizationComponent: GeoJsonMap,
  });
};

export default createVisualization;
