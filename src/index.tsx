import { type CreateCustomVisualization, defineConfig } from "@metabase/custom-viz";
import { GeoJsonMap } from "./GeoJsonMap";
import type { Settings } from "./types";
import { isNumericCol, isTextCol } from "./utils";

const createVisualization: CreateCustomVisualization<Settings> = ({ defineSetting }) => {
  return defineConfig<Settings>({
    id: "map-geojson",
    getName: () => "Map GeoJSON",
    minSize: { width: 4, height: 3 },
    defaultSize: { width: 12, height: 6 },

    checkRenderable(series) {
      if (!series || series.length === 0) throw new Error("Select a geometry column");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cols = (series[0]?.data?.cols ?? []) as any[];
      if (cols.length === 0) throw new Error("The query must return at least a geometry column (GeoJSON text)");
    },

    settings: {
      // ── Data ──────────────────────────────────────────────────────────
      geometryColumn: defineSetting({
        id: "geometryColumn",
        title: "Geometry column (GeoJSON text)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          const geo = cols.find((c) => /geom|geometry|geojson|shape|wkt/i.test(c.name));
          return (geo ?? cols.find((c) => isTextCol(c)) ?? cols[0])?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return { options: cols.map((c) => ({ name: c.display_name || c.name, value: c.name })) };
        },
      }),

      labelColumn: defineSetting({
        id: "labelColumn",
        title: "Label column (tooltip)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          const text = cols.filter((c) => isTextCol(c));
          return (text.find((c) => /name|nom|label|title/i.test(c.name)) ?? text[0])?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return {
            options: [
              { name: "— none —", value: "" },
              ...cols.map((c) => ({ name: c.display_name || c.name, value: c.name })),
            ],
          };
        },
      }),

      redColumn: defineSetting({
        id: "redColumn",
        title: "Red (R) column",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return cols.find((c) => /^r$/i.test(c.name) || /\bred\b|\brouge\b/i.test(c.name))?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return {
            options: [
              { name: "— none —", value: "" },
              ...cols.filter((c) => isNumericCol(c)).map((c) => ({ name: c.display_name || c.name, value: c.name })),
            ],
          };
        },
      }),

      greenColumn: defineSetting({
        id: "greenColumn",
        title: "Green (V) column",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return cols.find((c) => /^[gv]$/i.test(c.name) || /\bgreen\b|\bvert\b/i.test(c.name))?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return {
            options: [
              { name: "— none —", value: "" },
              ...cols.filter((c) => isNumericCol(c)).map((c) => ({ name: c.display_name || c.name, value: c.name })),
            ],
          };
        },
      }),

      blueColumn: defineSetting({
        id: "blueColumn",
        title: "Blue (B) column",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return cols.find((c) => /^b$/i.test(c.name) || /\bblue\b|\bbleu\b/i.test(c.name))?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return {
            options: [
              { name: "— none —", value: "" },
              ...cols.filter((c) => isNumericCol(c)).map((c) => ({ name: c.display_name || c.name, value: c.name })),
            ],
          };
        },
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
