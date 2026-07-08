# Map GeoJSON — Metabase Custom Visualization

Render GeoJSON geographic features (points, lines, polygons) directly from SQL query results, overlaid on an OpenStreetMap background.

## Requirements

- Metabase ≥ 1.62.0
- `@metabase/custom-viz` SDK

## Installation

1. Download the latest `.tgz` from the [Releases](https://github.com/ouquoi/metaviz-map-geojson/releases) page.
2. In Metabase → **Admin → Visualizations**, upload the `.tgz` file.
3. The **Map GeoJSON** visualization will appear in the chart picker.

## Usage

Your SQL query must return at least one column containing GeoJSON geometry strings. Additional columns are optional and map to visual properties via the settings panel.

Example query (PostGIS):

```sql
SELECT
  ST_AsGeoJSON(geom)   AS geometry,
  name                 AS nom,
  category             AS type,
  ridership            AS passengers,
  '#FF0000'            AS color
FROM transit_lines
```

### Settings

#### Data

| Setting | Description |
|---|---|
| **Geometry column** | Column containing GeoJSON text (`Point`, `LineString`, `Polygon`, etc.). Auto-detected from column names matching `geom`, `geometry`, `geojson`, `shape`. |
| **Title column** | Column used as the tooltip header (bold). |
| **Label column** | Column shown as a sub-label below the title in the tooltip. |
| **Value column** | Numeric column shown as a metric in the tooltip. |
| **Weight column** | Numeric column used to scale line/border thickness (and color, in `Weight gradient` mode) relative to other features. Auto-detected from columns named `weight`, `poids`, `importance`, or `size`. The scale is computed only from features with a valid geometry. Leave empty to use a fixed **Stroke width** for all features. |
| **Weight scale** | *(Weight column set)* `Linear` or `Logarithmic`. Use `Logarithmic` when a few extreme values would otherwise squash every other feature toward the minimum on a linear scale. Default: `Linear`. |
| **Color mode** | `Hex column`, `RGB columns`, or `Weight gradient`. Selects which of the settings below is used to compute each feature's color. Default: `Hex column`. |
| **Color column** | *(Hex column mode)* Column containing a hex color string (`#rrggbb` or `rrggbb`) for each feature. Auto-detected from columns named `color`, `couleur`, or `hex`. Falls back to **Default color** if the value is missing or invalid. |
| **Red column** | *(RGB columns mode)* Numeric column (0–255) for the red channel. Auto-detected from columns named `r`, `red`, or `rouge`. |
| **Green column** | *(RGB columns mode)* Numeric column (0–255) for the green channel. Auto-detected from columns named `g`, `green`, or `vert`. |
| **Blue column** | *(RGB columns mode)* Numeric column (0–255) for the blue channel. Auto-detected from columns named `b`, `blue`, or `bleu`. |

#### Appearance

| Setting | Description |
|---|---|
| **Default color** | *(Hex/RGB modes)* Fallback color applied when no color column is set or the value is invalid. Default: `#509EE3`. |
| **Color — low weight** | *(Weight gradient mode)* Color for the lowest weight. Default: `#ebedf0`. |
| **Color — high weight** | *(Weight gradient mode)* Color for the highest weight. Default: `#509EE3`. |
| **Stroke width** | *(no Weight column)* Fixed width of line and polygon border strokes in pixels. Default: `2`. |
| **Stroke width — min** | *(Weight column set)* Stroke width for the lowest weight value, and for features with a missing/invalid weight. Default: `1`. |
| **Stroke width — max** | *(Weight column set)* Stroke width for the highest weight value. Default: `8`. |
| **Fill opacity** | Opacity of polygon fills (0–1). Default: `0.4`. |
| **Show background map** | Toggle OpenStreetMap tile layer on/off. |

## Capabilities

- Renders all GeoJSON geometry types: `Point`, `MultiPoint`, `LineString`, `MultiLineString`, `Polygon`, `MultiPolygon`
- One SQL row = one GeoJSON feature
- Per-feature color via a hex column, three separate RGB columns (0–255), or a low/high gradient driven by the weight column
- Per-feature line/border thickness scaled by a weight column, relative to the min/max weight across all rendered features
- Linear or logarithmic weight scale, to handle long-tailed distributions without a few outliers squashing everything else
- Interactive tooltip on hover: title, label, and numeric value
- Auto-fits the viewport to all features on load
- Zoom and pan via mouse wheel and drag
- Dark mode support

## Data requirements

| Column | Required | Type | Notes |
|---|---|---|---|
| Geometry | Yes | Text / JSON | GeoJSON string produced by `ST_AsGeoJSON()` or stored directly |
| Title | No | Text | Shown as tooltip header |
| Label | No | Text | Shown as tooltip sub-label |
| Value | No | Number | Shown as a metric in the tooltip |
| Color | No | Text or Number | Hex color `#rrggbb`/`rrggbb` (Hex column mode), or 3 numeric columns 0–255 (RGB columns mode); falls back to default |
| Weight | No | Number | Scales line/border thickness (and color, in Weight gradient mode) relative to other rendered features; missing/invalid falls back to the minimum |

## Development

```bash
# Install dependencies
npm install

# Build and package
npm run build

# Local preview (standalone)
npm run preview:viz

# Preview inside the shared preview tool
cd ../preview-tool && npm run dev
```
