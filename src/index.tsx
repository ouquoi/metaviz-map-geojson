import { type CreateCustomVisualization, defineConfig } from "@metabase/custom-viz";
import { GeoJsonMap } from "./GeoJsonMap";
import type { Settings } from "./types";
import { isNumericCol, isTextCol } from "./utils";

const createVisualization: CreateCustomVisualization<Settings> = ({ defineSetting }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds = (def: any) => (defineSetting as any)(def);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allOptions = (series: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols = (series?.[0]?.data?.cols ?? []) as any[];
    return [
      { name: "— none —", value: "" },
      ...cols.map((c) => ({ name: c.display_name || c.name, value: c.name })),
    ];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const numericOptions = (series: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols = (series?.[0]?.data?.cols ?? []) as any[];
    return [
      { name: "— none —", value: "" },
      ...cols.filter((c) => isNumericCol(c)).map((c) => ({ name: c.display_name || c.name, value: c.name })),
    ];
  };

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
        title: "Geometry column",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          const geo = cols.find((c) => /geom|geometry|geojson|shape/i.test(c.name));
          return (geo ?? cols.find((c) => isTextCol(c)) ?? cols[0])?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return { options: cols.map((c) => ({ name: c.display_name || c.name, value: c.name })) };
        },
      }),

      titleColumn: ds({
        id: "titleColumn",
        title: "Title column (tooltip header)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          const text = cols.filter((c: any) => isTextCol(c));
          return (text.find((c: any) => /name|nom|title|titre|label/i.test(c.name)) ?? text[0])?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) { return { options: allOptions(series) }; },
      }),

      labelColumn: ds({
        id: "labelColumn",
        title: "Label column (tooltip sub-label)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(_series: any) { return ""; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) { return { options: allOptions(series) }; },
      }),

      valueColumn: ds({
        id: "valueColumn",
        title: "Value column (metric)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(_series: any) { return ""; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) { return { options: numericOptions(series) }; },
      }),

      weightColumn: ds({
        id: "weightColumn",
        title: "Weight column (line/border thickness)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return cols.find((c: any) => /weight|poids|importance|size/i.test(c.name))?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) { return { options: numericOptions(series) }; },
      }),

      weightScale: ds({
        id: "weightScale",
        title: "Weight scale",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return !settings?.weightColumn; },
        getDefault() { return "linear"; },
        getProps() {
          return {
            options: [
              { name: "Linear", value: "linear" },
              { name: "Logarithmic", value: "log" },
            ],
          };
        },
      }),

      colorMode: ds({
        id: "colorMode",
        title: "Color mode",
        widget: "select",
        getSection() { return "Data"; },
        getDefault() { return "hex"; },
        getProps() {
          return {
            options: [
              { name: "Hex column", value: "hex" },
              { name: "RGB columns", value: "rgb" },
              { name: "Weight gradient", value: "weight" },
            ],
          };
        },
      }),

      colorColumn: ds({
        id: "colorColumn",
        title: "Color column (hex #rrggbb)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return (settings?.colorMode ?? "hex") !== "hex"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return cols.find((c: any) => /^colou?r$|^couleur$|^hex$/i.test(c.name))?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) { return { options: allOptions(series) }; },
      }),

      redColumn: ds({
        id: "redColumn",
        title: "Red column (0-255)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return (settings?.colorMode ?? "hex") !== "rgb"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return cols.find((c: any) => /^r$|red|rouge/i.test(c.name))?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) { return { options: numericOptions(series) }; },
      }),

      greenColumn: ds({
        id: "greenColumn",
        title: "Green column (0-255)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return (settings?.colorMode ?? "hex") !== "rgb"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return cols.find((c: any) => /^g$|green|vert/i.test(c.name))?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) { return { options: numericOptions(series) }; },
      }),

      blueColumn: ds({
        id: "blueColumn",
        title: "Blue column (0-255)",
        widget: "select",
        getSection() { return "Data"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return (settings?.colorMode ?? "hex") !== "rgb"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDefault(series: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cols = (series?.[0]?.data?.cols ?? []) as any[];
          return cols.find((c: any) => /^b$|blue|bleu/i.test(c.name))?.name ?? "";
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getProps(series: any) { return { options: numericOptions(series) }; },
      }),

      // ── Appearance ────────────────────────────────────────────────────
      defaultColor: ds({
        id: "defaultColor",
        title: "Default color",
        widget: "color",
        getSection() { return "Appearance"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return settings?.colorMode === "weight"; },
        getDefault() { return "#509EE3"; },
      }),

      colorLow: ds({
        id: "colorLow",
        title: "Color — low weight",
        widget: "color",
        getSection() { return "Appearance"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return settings?.colorMode !== "weight"; },
        getDefault() { return "#ebedf0"; },
      }),

      colorHigh: ds({
        id: "colorHigh",
        title: "Color — high weight",
        widget: "color",
        getSection() { return "Appearance"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return settings?.colorMode !== "weight"; },
        getDefault() { return "#509EE3"; },
      }),

      strokeWidth: ds({
        id: "strokeWidth",
        title: "Stroke width",
        widget: "number",
        getSection() { return "Appearance"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return !!settings?.weightColumn; },
        getDefault() { return 2; },
      }),

      strokeWidthMin: ds({
        id: "strokeWidthMin",
        title: "Stroke width — min (lowest weight)",
        widget: "number",
        getSection() { return "Appearance"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return !settings?.weightColumn; },
        getDefault() { return 1; },
      }),

      strokeWidthMax: ds({
        id: "strokeWidthMax",
        title: "Stroke width — max (highest weight)",
        widget: "number",
        getSection() { return "Appearance"; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHidden(series: any, settings: any) { return !settings?.weightColumn; },
        getDefault() { return 8; },
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
