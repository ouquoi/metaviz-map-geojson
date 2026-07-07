export type Settings = {
  geometryColumn?: string;
  titleColumn?: string;
  labelColumn?: string;
  valueColumn?: string;
  colorMode?: "hex" | "rgb";
  colorColumn?: string;
  redColumn?: string;
  greenColumn?: string;
  blueColumn?: string;
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
