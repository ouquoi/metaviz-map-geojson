export type Settings = {
  geojsonUrl?: string;
  labelProperty?: string;
  defaultColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  showTiles?: boolean;
};

export type GeoJSONCoord = [number, number];

export type GeoJSONGeometry =
  | { type: "Point"; coordinates: GeoJSONCoord }
  | { type: "MultiPoint"; coordinates: GeoJSONCoord[] }
  | { type: "LineString"; coordinates: GeoJSONCoord[] }
  | { type: "MultiLineString"; coordinates: GeoJSONCoord[][] }
  | { type: "Polygon"; coordinates: GeoJSONCoord[][] }
  | { type: "MultiPolygon"; coordinates: GeoJSONCoord[][][] };

export type GeoJSONFeature = {
  type: "Feature";
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
};

export type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};
