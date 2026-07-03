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
| **Color column** | Column containing a hex color string (`#rrggbb` or `rrggbb`) for each feature. Auto-detected from columns named `color`, `couleur`, or `hex`. Falls back to **Default color** if the value is missing or invalid. |

#### Appearance

| Setting | Description |
|---|---|
| **Default color** | Fallback color applied when no color column is set or the value is invalid. Default: `#509EE3`. |
| **Stroke width** | Width of line and polygon border strokes in pixels. Default: `2`. |
| **Fill opacity** | Opacity of polygon fills (0–1). Default: `0.4`. |
| **Show background map** | Toggle OpenStreetMap tile layer on/off. |

## Capabilities

- Renders all GeoJSON geometry types: `Point`, `MultiPoint`, `LineString`, `MultiLineString`, `Polygon`, `MultiPolygon`
- One SQL row = one GeoJSON feature
- Per-feature hex color via a dedicated column
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
| Color | No | Text | Hex color `#rrggbb` or `rrggbb`; falls back to default |

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
